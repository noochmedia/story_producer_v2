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

function getContentPreview(content: any): string {
  if (typeof content === 'string') {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  return 'No preview available';
}

async function queryPineconeForContext(query: string, stage: string, controller: ReadableStreamDefaultController) {
  console.log('Starting Pinecone context query for:', query);
  
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  controller.enqueue(new TextEncoder().encode(`[STAGE:${stage}]`));

  console.log('Initializing Pinecone client...');
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  // First check what's in the index
  const stats = await index.describeIndexStats();
  console.log('Pinecone Index Stats:', {
    totalRecords: stats.totalRecordCount,
    indexFullness: stats.indexFullness,
    dimensions: stats.dimension
  });
  
  console.log('Generating embedding for context query');
  const queryEmbedding = await generateEmbedding(query);
  console.log('Embedding generated, length:', queryEmbedding.length);
  
  console.log('Querying Pinecone for relevant context...');
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
    filter: { type: { $eq: 'source' } }
  });

  console.log('Raw Pinecone matches:', queryResponse.matches.length);
  queryResponse.matches.forEach((match, i) => {
    console.log(`Match ${i + 1} details:`, {
      id: match.id,
      score: match.score,
      fileName: match.metadata?.fileName,
      contentPreview: getContentPreview(match.metadata?.content),
      hasContent: !!match.metadata?.content,
      contentType: typeof match.metadata?.content
    });
  });

  // Filter out matches with no content
  const validMatches = queryResponse.matches.filter(match => 
    match.metadata?.content && 
    typeof match.metadata.content === 'string' && 
    match.metadata.content.trim() !== ''
  );

  console.log('Valid matches with content:', validMatches.length);
  console.log('Valid matches details:', validMatches.map(match => ({
    fileName: match.metadata?.fileName,
    contentPreview: match.metadata?.content?.substring(0, 100),
    score: match.score,
    contentLength: match.metadata?.content?.length
  })));

  return validMatches as PineconeMatch[];
}

async function handleStreamingResponse(reader: ReadableStreamDefaultReader<Uint8Array>, controller: ReadableStreamDefaultController) {
  const decoder = new TextDecoder();
  let buffer = '';
  let responseStarted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim() === '') continue;
      if (line.includes('data: [DONE]')) continue;

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(5));
          const content = data.choices?.[0]?.delta?.content || 
                         data.choices?.[0]?.text || '';
          if (content) {
            responseStarted = true;
            controller.enqueue(new TextEncoder().encode(content));
          }
        } catch (e) {
          console.error('Error parsing streaming response line:', e);
          if (!line.includes('"content":null') && !line.includes('"role"')) {
            const cleanLine = line.replace('data: ', '').trim();
            if (cleanLine) {
              responseStarted = true;
              controller.enqueue(new TextEncoder().encode(cleanLine));
            }
          }
        }
      } else if (!line.includes('data:')) {
        if (line.trim()) {
          responseStarted = true;
          controller.enqueue(new TextEncoder().encode(line));
        }
      }
    }
  }

  if (buffer.trim() && !buffer.includes('data:')) {
    controller.enqueue(new TextEncoder().encode(buffer));
  }

  if (!responseStarted) {
    controller.enqueue(new TextEncoder().encode(
      "I apologize, but I'm having trouble processing that request. Could you please rephrase your question?"
    ));
  }
}

export async function POST(req: Request) {
  console.log('Processing new chat request');
  const { messages, projectDetails, deepDive = false, model, temperature, max_tokens, stream = false } = await req.json();

  console.log('Request details:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content,
    hasProjectDetails: !!projectDetails
  });
  
  try {
    const userMessage = messages[messages.length - 1];
    console.log('Processing user query:', userMessage.content);

    const isSpecialAnalysis = userMessage.content.toLowerCase().includes('character brief') ||
                             userMessage.content.toLowerCase().includes('relationship map') ||
                             userMessage.content.toLowerCase().includes('timeline');

    const needsSources = deepDive || 
                        isSpecialAnalysis || 
                        userMessage.content.toLowerCase().includes('who') ||
                        userMessage.content.toLowerCase().includes('what') ||
                        userMessage.content.toLowerCase().includes('when') ||
                        userMessage.content.toLowerCase().includes('where') ||
                        userMessage.content.toLowerCase().includes('why') ||
                        userMessage.content.toLowerCase().includes('how');

    console.log('Analysis type:', {
      isSpecialAnalysis,
      needsSources,
      deepDive
    });

    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              console.log('Starting streaming response');
              
              // Query AI's memory
              console.log('Querying AI memory...');
              const relevantMemories = await queryMemory(userMessage.content);
              const memoryContext = formatMemoryForAI(relevantMemories);
              console.log('Memory context length:', memoryContext.length);

              let systemMessage = '';
              let relevantSources: PineconeMatch[] = [];
              
              if (needsSources) {
                console.log('Getting source context...');
                relevantSources = await queryPineconeForContext(
                  userMessage.content,
                  'Searching relevant information',
                  controller
                );

                if (relevantSources.length > 0) {
                  systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Previous Analyses:
${memoryContext}

Available Sources:
${relevantSources.map(source => 
  `[Source: ${source.metadata?.fileName || 'Unknown'}]\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Based on these sources, provide a detailed response to the user's query.`;
                } else {
                  console.log('No relevant sources found');
                  systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Previous Analyses:
${memoryContext}

Note: I don't have any specific information about that in my sources, but I'll help based on our conversation and general knowledge.`;
                }
              } else {
                systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Previous Analyses:
${memoryContext}`;
              }

              console.log('System message prepared:', {
                length: systemMessage.length,
                includesSources: systemMessage.includes('Available Sources:'),
                sourcesCount: relevantSources.length
              });

              console.log('Making request to DeepSeek...');
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
                console.error('DeepSeek API error:', errorText);
                
                if (errorText.includes('maximum context length')) {
                  console.log('Token limit exceeded, trying with reduced context...');
                  controller.enqueue(new TextEncoder().encode('Let me try with a more focused approach...\n\n'));
                  
                  const topSources = relevantSources
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .slice(0, 3);

                  const reducedSystemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Most Relevant Sources:
${topSources.map(source => 
  `[Source: ${source.metadata?.fileName || 'Unknown'}]\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Based on these sources, provide a concise response to the user's query.`;

                  console.log('Retrying with reduced context:', {
                    reducedLength: reducedSystemMessage.length,
                    topSourcesCount: topSources.length
                  });

                  const retryResponse = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
                    },
                    body: JSON.stringify({
                      model: "deepseek-ai/DeepSeek-V3",
                      messages: [
                        { role: "system", content: reducedSystemMessage },
                        messages[messages.length - 1]
                      ],
                      temperature: temperature || AI_CONFIG.temperature,
                      max_tokens: max_tokens || AI_CONFIG.max_tokens,
                      stream: true,
                    }),
                  });

                  if (!retryResponse.ok) {
                    throw new Error(`Retry failed: ${await retryResponse.text()}`);
                  }

                  const retryReader = retryResponse.body?.getReader();
                  if (!retryReader) throw new Error('No response body available');

                  await handleStreamingResponse(retryReader, controller);
                } else {
                  throw new Error(`DeepSeek API request failed: ${errorText}`);
                }
              } else {
                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body available');

                await handleStreamingResponse(reader, controller);
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
    console.log('Processing non-streaming response');
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