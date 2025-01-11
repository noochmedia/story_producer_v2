import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'
import { Pinecone, ScoredPineconeRecord } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'
import { queryMemory, storeMemory, formatMemoryForAI } from '../../../lib/ai-memory'
import { analyzeSourceCategories, processUserChoice, createFinalSummary } from '../../../lib/interactive-search'
import { OpenRouterClient } from '../../../lib/openrouter-client'
import OpenAI from 'openai'

interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

interface TimestampedLine {
  timestamp: string;
  content: string;
}

type PineconeMatch = ScoredPineconeRecord<SourceMetadata>;

function getContentPreview(content: any): string {
  if (typeof content === 'string') {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  return 'No preview available';
}

function cleanTranscriptContent(content: string): string {
  // Remove timestamp lines but keep them for reference
  const lines = content.split('\n');
  const cleanedLines: TimestampedLine[] = [];
  let lastTimestamp = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timestampMatch = line.match(/^\[\d{2}:\d{2}:\d{2}:\d{2}\]/);
    
    if (timestampMatch) {
      lastTimestamp = timestampMatch[0];
      continue;
    }

    if (line.trim() && !line.includes('Inaudible')) {
      // If this is actual content, add it with the last known timestamp
      cleanedLines.push({ timestamp: lastTimestamp, content: line.trim() });
    }
  }

  return JSON.stringify(cleanedLines);
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
  
  // For overview/summary queries, use a different approach
  const isOverviewQuery = query.toLowerCase().includes('summary') || 
                         query.toLowerCase().includes('overview') ||
                         query.toLowerCase().includes('all') ||
                         query.toLowerCase().includes('everything');

  let queryResponse;
  try {
    if (isOverviewQuery) {
      console.log('Using metadata-only query for overview');
      // For overview queries, just get all sources without vector search
      const neutralVector = Array.from({ length: 1536 }, () => 0);
      queryResponse = await index.query({
        vector: neutralVector,
        topK: 100,
        includeMetadata: true,
        filter: { type: { $eq: 'source' } }
      });
    } else {
      console.log('Generating embedding for specific query:', query);
      const embeddingResults = await generateEmbedding(query);
      
      if (!embeddingResults || embeddingResults.length === 0) {
        console.log('No valid embeddings generated for query');
        controller.enqueue(new TextEncoder().encode("I couldn't process your query effectively. Could you try rephrasing it or being more specific?"));
        return [];
      }

      const queryEmbedding = embeddingResults[0].embedding;
      if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
        console.error('Invalid embedding generated:', queryEmbedding);
        throw new Error('Invalid embedding generated for query');
      }

      // Ensure vector values are numbers and not objects
      const validVector = queryEmbedding.map(val => Number(val));
      if (!validVector.every(val => typeof val === 'number' && !isNaN(val))) {
        throw new Error('Invalid vector values');
      }

      console.log('Querying Pinecone with specific vector');
      queryResponse = await index.query({
        vector: validVector,
        topK: 10,
        includeMetadata: true,
        filter: { type: { $eq: 'source' } }
      });
    }
  } catch (error) {
    console.error('Error in vector search:', error);
    throw error;
  }

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

  // Send a message if no matches found
  if (validMatches.length === 0) {
    controller.enqueue(new TextEncoder().encode("I couldn't find any relevant information in the sources about that topic. Would you like to try a different question?"));
    return [];
  }

  return validMatches;
}

function getBaseSystemMessage(projectDetails: string) {
  let message = AI_CONFIG.systemPrompt;

  if (projectDetails) {
    message += `\n\nProject Context:\n${projectDetails}\n\n`;
  }

  return message;
}

export async function POST(req: Request) {
  const { messages, projectDetails, deepDive = false, isSoundbiteRequest = false, model, temperature, max_tokens, stream = false } = await req.json()

  console.log('Processing chat request:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    type: isSoundbiteRequest ? 'Soundbite' : 'Regular',
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content,
    hasProjectDetails: !!projectDetails,
    deepDive // Log the actual deepDive value
  });
  
  try {
    // Get user's latest message
    const userMessage = messages[messages.length - 1];
    console.log('User query:', userMessage.content);

    // Validate deepDive mode
    if (!deepDive) {
      console.log('Sources not enabled, running in normal mode');
    } else {
      console.log('Sources enabled, running in deep dive mode');
    }

    // Initialize clients
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const openrouter = new OpenRouterClient(process.env.OPENROUTER_API_KEY || '');

    // Prepare system message based on mode
    let systemMessage = '';
    let relevantSources: PineconeMatch[] = [];
    let previousAnalyses: string[] = [];
    
    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // Always include project details in system message
              systemMessage = getBaseSystemMessage(projectDetails);

              // Log the mode we're running in
              console.log('Running in mode:', deepDive ? 'Deep Dive' : 'Normal', 'with project details');

              if (deepDive) {
                // Add source-specific context
                systemMessage += `\nYou have access to interview transcripts and can search through them for relevant information.`;
                console.log('Entering deep dive mode with sources');
                // Only check memory and query sources in deep dive mode
                const relevantMemories = await queryMemory(userMessage.content);
                const memoryContext = formatMemoryForAI(relevantMemories);

                console.log('Starting source search for:', userMessage.content);
                try {
                  // Update status to analyzing
                  const { updateStatus } = await import('../sources/status/route');
                  updateStatus('analyzing');

                  // Get initial context from Pinecone
                  relevantSources = await queryPineconeForContext(
                    userMessage.content,
                    'Searching relevant information',
                    controller
                  );
                  console.log('Source search completed, found sources:', relevantSources.length);

                  // Update status to complete
                  updateStatus('complete');
                } catch (searchError) {
                  console.error('Error in source search:', searchError);
                  // Update status to idle on error
                  const { updateStatus } = await import('../sources/status/route');
                  updateStatus('idle');
                  throw searchError;
                }

                console.log('Processing sources, count:', relevantSources.length);
                if (relevantSources.length > 0) {
                  console.log('Starting content analysis');
                  // Check if this is a follow-up to a previous analysis
                  const isFollowUp = userMessage.content.toLowerCase().includes('option') || 
                                   userMessage.content.toLowerCase().includes('category') ||
                                   userMessage.content.match(/^[1-4]$/);

                  // Combine all source content to check size
                  const allContent = relevantSources
                    .map(source => source.metadata?.content || '')
                    .join('\n\n');

                  // Import chunked processing
                  const { processSourcesInChunks } = await import('../../../lib/chunked-processing');

                  // Process sources in chunks with appropriate model selection
                  await processSourcesInChunks(
                    relevantSources,
                    userMessage.content,
                    openai,
                    openrouter,
                    controller
                  );

                  // Add prompt for further exploration
                  controller.enqueue(new TextEncoder().encode('\n\nWould you like to explore any specific aspect in more detail? You can:\n\n'));
                  controller.enqueue(new TextEncoder().encode('1. Get more details about a specific theme\n'));
                  controller.enqueue(new TextEncoder().encode('2. See how different perspectives compare\n'));
                  controller.enqueue(new TextEncoder().encode('3. Look at the timeline of events\n'));
                  controller.enqueue(new TextEncoder().encode('4. Focus on specific examples or quotes\n\n'));
                } else {
                  console.log('No relevant sources found');
                  systemMessage += `\nI've searched the interview transcripts but couldn't find any relevant information about that specific topic. Let me know if you'd like to know about something else from the interviews.`;
                  
                  const response = await openai.chat.completions.create({
                    model: AI_CONFIG.model,
                    messages: [
                      { role: 'system', content: systemMessage },
                      ...messages.slice(-5)
                    ],
                    response_format: { type: "text" },
                    temperature: 0.58,
                    max_tokens: 2000,
                    stream: true
                  });

                  for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                      const formattedContent = content
                        .replace(/\.\s+/g, '.\n\n')
                        .replace(/:\s+/g, ':\n');
                      controller.enqueue(new TextEncoder().encode(formattedContent));
                    }
                  }
                }
              } else {
                console.log('Running in normal mode without sources');
                // In normal mode, just respond without querying sources
                systemMessage += `\nNote: I can use the interview transcripts if you enable the "Use sources" option below.`;
                
                const response = await openai.chat.completions.create({
                  model: AI_CONFIG.model,
                  messages: [
                    { role: 'system', content: systemMessage },
                    ...messages.slice(-5)
                  ],
                  response_format: { type: "text" },
                  temperature: 0.58,
                  max_tokens: 2000,
                  stream: true
                });

                for await (const chunk of response) {
                  const content = chunk.choices[0]?.delta?.content || '';
                  if (content) {
                    const formattedContent = content
                      .replace(/\.\s+/g, '.\n\n')
                      .replace(/:\s+/g, ':\n');
                    controller.enqueue(new TextEncoder().encode(formattedContent));
                  }
                }
              }

              controller.close();
            } catch (error) {
              console.error('Error in streaming response:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('Detailed error:', {
                error: errorMessage,
                stage: 'streaming',
                deepDive,
                hasProjectDetails: !!projectDetails,
                messageCount: messages.length
              });
              controller.enqueue(new TextEncoder().encode(`I encountered an error while analyzing the sources: ${errorMessage}. This might be due to the size of the content or a temporary issue. You can try:\n\n1. Breaking your question into smaller parts\n2. Being more specific about what you want to know\n3. Asking about a different aspect of the sources`));
              controller.close();
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
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemMessage },
        ...messages
      ],
      response_format: { type: "text" },
      temperature: 0.58,
      max_tokens: 2000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error in chat processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', {
      error: errorMessage,
      stage: 'non-streaming',
      deepDive,
      hasProjectDetails: !!projectDetails,
      messageCount: messages.length
    });
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: errorMessage,
      suggestions: [
        'Try breaking your question into smaller parts',
        'Be more specific about what you want to know',
        'Ask about a different aspect of the sources'
      ]
    }, { status: 500 });
  }
}
