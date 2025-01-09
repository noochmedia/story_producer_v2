import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'
import { Pinecone, ScoredPineconeRecord } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'
import { queryMemory, storeMemory, formatMemoryForAI } from '../../../lib/ai-memory'

interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

type PineconeMatch = ScoredPineconeRecord<SourceMetadata>;

async function queryPineconeForContext(query: string, stage: string, controller: ReadableStreamDefaultController) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  controller.enqueue(new TextEncoder().encode(`[STAGE:${stage}]`));

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  console.log('Generating embedding for context query...');
  const queryEmbedding = await generateEmbedding(query);
  
  console.log('Querying Pinecone for relevant context...');
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
    filter: { type: { $eq: 'source' } }
  });

  return queryResponse.matches as PineconeMatch[];
}

async function streamResponse(response: Response, controller: ReadableStreamDefaultController) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) {
    throw new Error('No response body available');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('Stream complete');
      break;
    }

    const chunk = decoder.decode(value);
    controller.enqueue(new TextEncoder().encode(chunk));
  }
}

function getSourceFileNames(sources: PineconeMatch[]): string[] {
  return sources
    .map(s => s.metadata?.fileName)
    .filter((name): name is string => typeof name === 'string');
}

export async function POST(req: Request) {
  const { messages, projectDetails, deepDive = false, model, temperature, max_tokens, stream = false } = await req.json()

  console.log('Processing chat request:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    messageCount: messages.length
  });
  
  try {
    // Get user's latest message
    const userMessage = messages[messages.length - 1];
    console.log('User query:', userMessage.content);

    // Prepare system message based on mode
    let systemMessage = '';
    let relevantSources: PineconeMatch[] = [];
    
    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // First check AI's memory
              controller.enqueue(new TextEncoder().encode('[STAGE:Checking previous analyses]\n'));
              const relevantMemories = await queryMemory(userMessage.content);
              const memoryContext = formatMemoryForAI(relevantMemories);

              if (deepDive) {
                // Get initial context from Pinecone
                relevantSources = await queryPineconeForContext(
                  userMessage.content,
                  'Searching source material',
                  controller
                );

                systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Previous Analyses:
${memoryContext}

[DEEP DIVE MODE]
I will analyze all available sources thoroughly to provide comprehensive insights.

Available Sources:
${relevantSources.map(source => 
  `[Source: ${source.metadata?.fileName || 'Unknown'}]\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}`;
              } else {
                systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Previous Analyses:
${memoryContext}

[NORMAL MODE]
I will provide assistance based on our conversation and any previous analyses.`;
              }

              controller.enqueue(new TextEncoder().encode('[STAGE:Analyzing information]\n'));

              // Make request to DeepSeek
              const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
                },
                body: JSON.stringify({
                  model: "deepseek-ai/DeepSeek-V3",
                  messages: [
                    { role: "system", content: systemMessage },
                    ...messages
                  ],
                  temperature: temperature || AI_CONFIG.temperature,
                  max_tokens: max_tokens || AI_CONFIG.max_tokens,
                  stream: true,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`DeepSeek API request failed: ${errorText}`);
              }

              // Collect the AI's response for potential storage
              let aiResponse = '';
              const responseReader = response.body?.getReader();
              const decoder = new TextDecoder();

              if (responseReader) {
                controller.enqueue(new TextEncoder().encode('[STAGE:Generating response]\n'));
                
                while (true) {
                  const { done, value } = await responseReader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  aiResponse += chunk;
                  controller.enqueue(new TextEncoder().encode(chunk));
                }

                // Store the AI's response as a memory if it's a special analysis
                const isSpecialAnalysis = userMessage.content.toLowerCase().includes('character brief') ||
                                        userMessage.content.toLowerCase().includes('relationship map') ||
                                        userMessage.content.toLowerCase().includes('timeline');

                if (isSpecialAnalysis && aiResponse) {
                  controller.enqueue(new TextEncoder().encode('[STAGE:Saving analysis]\n'));
                  
                  let analysisType: 'character_brief' | 'relationship_map' | 'timeline';
                  let title = '';
                  
                  if (userMessage.content.toLowerCase().includes('character brief')) {
                    analysisType = 'character_brief';
                    const characterName = userMessage.content.match(/for\s+(\w+)/i)?.[1] || 'Unknown Character';
                    title = `Character Brief: ${characterName}`;
                  } else if (userMessage.content.toLowerCase().includes('relationship map')) {
                    analysisType = 'relationship_map';
                    title = 'Character Relationship Map';
                  } else {
                    analysisType = 'timeline';
                    title = 'Story Timeline';
                  }

                  await storeMemory({
                    type: analysisType,
                    title,
                    content: aiResponse,
                    tags: [analysisType],
                    relatedSources: getSourceFileNames(relevantSources)
                  });
                }
              }

              controller.close();
            } catch (error) {
              console.error('Error in streaming response:', error);
              controller.error(error);
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Non-streaming response handling
    const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [
          { role: "system", content: systemMessage },
          ...messages
        ],
        temperature: temperature || AI_CONFIG.temperature,
        max_tokens: max_tokens || AI_CONFIG.max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API request failed: ${await response.text()}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in chat processing:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
