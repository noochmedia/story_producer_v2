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

function shouldQuerySources(query: string, deepDive: boolean): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Always query sources in deep dive mode
  if (deepDive) return true;

  // Check for special analysis requests
  if (lowerQuery.includes('character brief') ||
      lowerQuery.includes('relationship map') ||
      lowerQuery.includes('timeline')) {
    return true;
  }

  // Check for source-related queries
  if (lowerQuery.includes('source') ||
      lowerQuery.includes('document') ||
      lowerQuery.includes('file') ||
      lowerQuery.includes('transcript') ||
      lowerQuery.includes('interview')) {
    return true;
  }

  // Check for question words
  if (lowerQuery.includes('who') ||
      lowerQuery.includes('what') ||
      lowerQuery.includes('when') ||
      lowerQuery.includes('where') ||
      lowerQuery.includes('why') ||
      lowerQuery.includes('how')) {
    return true;
  }

  // Check for names or specific content queries
  if (lowerQuery.includes('bob') ||
      lowerQuery.includes('joyce') ||
      lowerQuery.includes('tell me about') ||
      lowerQuery.includes('explain') ||
      lowerQuery.includes('describe')) {
    return true;
  }

  return false;
}

async function queryPineconeForContext(query: string, stage: string, controller: ReadableStreamDefaultController) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  controller.enqueue(new TextEncoder().encode(`[STAGE:${stage}]`));

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  // First check what's in the index
  const stats = await index.describeIndexStats();
  console.log('Index stats:', {
    totalRecords: stats.totalRecordCount,
    indexFullness: stats.indexFullness,
    dimensions: stats.dimension
  });
  
  console.log('Generating embedding for context query:', query);
  const queryEmbedding = await generateEmbedding(query);
  
  console.log('Querying Pinecone for relevant context...');
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
    filter: { type: { $eq: 'source' } }
  });

  console.log('Found matches:', queryResponse.matches.length);
  queryResponse.matches.forEach((match, i) => {
    console.log(`Match ${i + 1}:`, {
      score: match.score,
      fileName: match.metadata?.fileName,
      contentPreview: getContentPreview(match.metadata?.content)
    });
  });

  // Filter out matches with no content
  const validMatches = queryResponse.matches.filter(match => 
    match.metadata?.content && 
    typeof match.metadata.content === 'string' && 
    match.metadata.content.trim() !== ''
  );

  console.log('Valid matches with content:', validMatches.length);
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
    buffer = lines.pop() || ''; // Keep the last partial line in the buffer

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
          console.error('Error parsing line:', line, e);
          // If we can't parse as JSON but have content, send it directly
          if (!line.includes('"content":null') && !line.includes('"role"')) {
            const cleanLine = line.replace('data: ', '').trim();
            if (cleanLine) {
              responseStarted = true;
              controller.enqueue(new TextEncoder().encode(cleanLine));
            }
          }
        }
      } else if (!line.includes('data:')) {
        // Direct text content
        if (line.trim()) {
          responseStarted = true;
          controller.enqueue(new TextEncoder().encode(line));
        }
      }
    }
  }

  // Handle any remaining content in the buffer
  if (buffer.trim() && !buffer.includes('data:')) {
    controller.enqueue(new TextEncoder().encode(buffer));
  }

  // If no response was generated, provide a fallback
  if (!responseStarted) {
    controller.enqueue(new TextEncoder().encode(
      "I apologize, but I'm having trouble processing that request. Could you please rephrase your question?"
    ));
  }
}

export async function POST(req: Request) {
  const { messages, projectDetails, deepDive = false, model, temperature, max_tokens, stream = false } = await req.json()

  console.log('Processing chat request:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content
  });
  
  try {
    // Get user's latest message
    const userMessage = messages[messages.length - 1];
    console.log('User query:', userMessage.content);

    // Check if we need sources
    const needsSources = shouldQuerySources(userMessage.content, deepDive);
    console.log('Source analysis:', {
      query: userMessage.content,
      deepDive,
      needsSources,
      reason: needsSources ? 'Query matches source criteria' : 'No source criteria matched'
    });

    // Prepare system message based on mode
    let systemMessage = '';
    let relevantSources: PineconeMatch[] = [];
    
    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // First check AI's memory
              const relevantMemories = await queryMemory(userMessage.content);
              const memoryContext = formatMemoryForAI(relevantMemories);

              if (needsSources) {
                // Get initial context from Pinecone
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

Based on these sources, provide a detailed response to the user's query. If you find relevant information in the sources, incorporate it into your response.`;
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
                includesSources: relevantSources.length > 0,
                sourcesCount: relevantSources.length
              });

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
                console.error('DeepSeek API error:', errorText);
                
                // If token limit exceeded, try with reduced context
                if (errorText.includes('maximum context length')) {
                  controller.enqueue(new TextEncoder().encode('Let me try with a more focused approach...\n\n'));
                  
                  // Take only the most relevant sources
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
                        messages[messages.length - 1] // Just use the last message
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
