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

function cleanTranscriptContent(content: string): string {
  // Remove timestamp lines
  const lines = content.split('\n').filter(line => !line.match(/^\[\d{2}:\d{2}:\d{2}:\d{2}\]/));
  
  // Remove empty lines and [Inaudible]
  return lines
    .filter(line => line.trim() && !line.includes('Inaudible'))
    .join('\n')
    .trim();
}

function splitSourcesIntoChunks(sources: PineconeMatch[], chunkSize: number = 2): PineconeMatch[][] {
  const chunks: PineconeMatch[][] = [];
  for (let i = 0; i < sources.length; i += chunkSize) {
    chunks.push(sources.slice(i, i + chunkSize));
  }
  return chunks;
}

function processMatch(match: PineconeMatch): PineconeMatch {
  if (!match.metadata) return match;

  const content = match.metadata.content;
  if (typeof content !== 'string') return match;

  return {
    ...match,
    metadata: {
      ...match.metadata,
      content: cleanTranscriptContent(content)
    }
  };
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
  
  // Process and clean matches
  const validMatches = queryResponse.matches
    .filter(match => 
      match.metadata?.content && 
      typeof match.metadata.content === 'string' && 
      match.metadata.content.trim() !== ''
    )
    .map(processMatch);

  console.log('Valid matches with content:', validMatches.length);
  validMatches.forEach((match, i) => {
    console.log(`Match ${i + 1}:`, {
      score: match.score,
      fileName: match.metadata?.fileName,
      contentPreview: match.metadata?.content ? getContentPreview(match.metadata.content) : 'No content'
    });
  });

  return validMatches;
}

async function handleStreamingResponse(reader: ReadableStreamDefaultReader<Uint8Array>, controller: ReadableStreamDefaultController) {
  const decoder = new TextDecoder();
  let buffer = '';

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
            controller.enqueue(new TextEncoder().encode(content));
          }
        } catch (e) {
          // If we can't parse as JSON but have content, send it directly
          if (!line.includes('"content":null') && !line.includes('"role"')) {
            const cleanLine = line.replace('data: ', '').trim();
            if (cleanLine) {
              controller.enqueue(new TextEncoder().encode(cleanLine));
            }
          }
        }
      } else if (!line.includes('data:')) {
        // Direct text content
        if (line.trim()) {
          controller.enqueue(new TextEncoder().encode(line));
        }
      }
    }
  }

  // Handle any remaining content in the buffer
  if (buffer.trim() && !buffer.includes('data:')) {
    controller.enqueue(new TextEncoder().encode(buffer));
  }
}

async function processSourceChunk(
  chunk: PineconeMatch[],
  systemPrompt: string,
  userMessage: string,
  controller: ReadableStreamDefaultController,
  isFirstChunk: boolean,
  isLastChunk: boolean
) {
  const chunkSystemMessage = `${systemPrompt}

Here are some relevant excerpts from the interviews:

${chunk.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

${isFirstChunk ? 'Begin answering the user\'s question. Be specific and quote directly from the sources when possible.' : 
  'Continue the previous response with information from these additional sources.'}
${isLastChunk ? '\n\nThis is all the available information. Please conclude your response.' : 
  '\n\nThere is more information to come in the next part.'}`;

  const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3",
      messages: [
        { role: "system", content: chunkSystemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API request failed: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body available');

  if (!isFirstChunk) {
    controller.enqueue(new TextEncoder().encode('\n\nContinuing with additional information...\n\n'));
  }

  await handleStreamingResponse(reader, controller);
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

              if (deepDive) {
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
${memoryContext}`;

                  // Split sources into chunks and process each chunk
                  const sourceChunks = splitSourcesIntoChunks(relevantSources);
                  
                  for (let i = 0; i < sourceChunks.length; i++) {
                    await processSourceChunk(
                      sourceChunks[i],
                      systemMessage,
                      userMessage.content,
                      controller,
                      i === 0,
                      i === sourceChunks.length - 1
                    );
                  }
                } else {
                  console.log('No relevant sources found');
                  systemMessage = `${AI_CONFIG.systemPrompt}

I've searched the interview transcripts but couldn't find any relevant information about that specific topic. Let me know if you'd like to know about something else from the interviews.`;

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
                        { role: "user", content: userMessage.content }
                      ],
                      temperature: temperature || AI_CONFIG.temperature,
                      max_tokens: max_tokens || AI_CONFIG.max_tokens,
                      stream: true,
                    }),
                  });

                  if (!response.ok) {
                    throw new Error(`DeepSeek API request failed: ${await response.text()}`);
                  }

                  const reader = response.body?.getReader();
                  if (!reader) throw new Error('No response body available');

                  await handleStreamingResponse(reader, controller);
                }
              } else {
                systemMessage = `${AI_CONFIG.systemPrompt}

Let me help you with your question. Note that I'm not currently using the interview transcripts. If you'd like me to check the transcripts, please enable the "Use sources" option.`;

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
                      { role: "user", content: userMessage.content }
                    ],
                    temperature: temperature || AI_CONFIG.temperature,
                    max_tokens: max_tokens || AI_CONFIG.max_tokens,
                    stream: true,
                  }),
                });

                if (!response.ok) {
                  throw new Error(`DeepSeek API request failed: ${await response.text()}`);
                }

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
