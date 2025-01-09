import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'
import { Pinecone, ScoredPineconeRecord } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'
import { queryMemory, storeMemory, formatMemoryForAI } from '../../../lib/ai-memory'
import OpenAI from 'openai'

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

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
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
${memoryContext}

I have found relevant information in the interview transcripts. Here are the excerpts:

${relevantSources.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Analyze these interview excerpts carefully and provide a detailed response to the user's question. Focus on:
1. Understanding the context and relationships between different pieces of information
2. Drawing meaningful connections and insights
3. Quoting relevant parts of the sources to support your points
4. Providing a coherent and complete analysis

If you find relevant information in the sources, incorporate it into your response and explain its significance. If you don't find a direct answer, explain what you can infer from the available information.`;
                } else {
                  console.log('No relevant sources found');
                  systemMessage = `${AI_CONFIG.systemPrompt}

I've searched the interview transcripts but couldn't find any relevant information about that specific topic. Let me know if you'd like to know about something else from the interviews.`;
                }
              } else {
                systemMessage = `${AI_CONFIG.systemPrompt}

Let me help you with your question. Note that I'm not currently using the interview transcripts. If you'd like me to check the transcripts, please enable the "Use sources" option.`;
              }

              console.log('System message prepared:', {
                length: systemMessage.length,
                includesSources: relevantSources.length > 0,
                sourcesCount: relevantSources.length
              });

              const stream = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: 'system', content: systemMessage },
                  ...messages.slice(-5) // Only include last 5 messages to reduce context
                ],
                response_format: { type: "text" },
                temperature: 0.58,
                max_tokens: 12317,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true
              });

              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemMessage },
        ...messages
      ],
      response_format: { type: "text" },
      temperature: 0.58,
      max_tokens: 12317,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error in chat processing:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
