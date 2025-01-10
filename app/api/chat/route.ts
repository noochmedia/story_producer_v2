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
    hasProjectDetails: !!projectDetails
  });
  
  try {
    // Get user's latest message
    const userMessage = messages[messages.length - 1];
    console.log('User query:', userMessage.content);

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
              // First check AI's memory
              const relevantMemories = await queryMemory(userMessage.content);
              const memoryContext = formatMemoryForAI(relevantMemories);

              // Start with base system message including project details
              systemMessage = getBaseSystemMessage(projectDetails);

              if (deepDive) {
                // Get initial context from Pinecone
                relevantSources = await queryPineconeForContext(
                  userMessage.content,
                  'Searching relevant information',
                  controller
                );

                if (relevantSources.length > 0) {
                  // Check if this is a follow-up to a previous analysis
                  const isFollowUp = userMessage.content.toLowerCase().includes('option') || 
                                   userMessage.content.toLowerCase().includes('category') ||
                                   userMessage.content.match(/^[1-4]$/);

                  // Combine all source content to check size
                  const allContent = relevantSources
                    .map(source => source.metadata?.content || '')
                    .join('\n\n');

                  // Choose appropriate model based on content size
                  const useOpenRouter = OpenRouterClient.estimateTokens(allContent) > 30000;

                  if (useOpenRouter) {
                    console.log('Using OpenRouter due to content size');
                    const model = await OpenRouterClient.chooseModel(allContent, openrouter);
                    console.log('Selected model:', model);

                    if (isFollowUp && messages.length > 2) {
                      // Process the user's choice
                      const analysis = await processUserChoice(
                        userMessage.content,
                        relevantSources,
                        messages[messages.length - 2].content,
                        openai,
                        controller
                      );
                      previousAnalyses.push(analysis);

                      // If user requests final summary
                      if (userMessage.content.toLowerCase().includes('summary') || 
                          userMessage.content === '4') {
                        await createFinalSummary(
                          previousAnalyses,
                          messages[0].content,
                          openai,
                          controller
                        );
                      }
                    } else {
                      // Start new analysis with OpenRouter
                      const response = await openrouter.createChatCompletion({
                        messages: [
                          {
                            role: 'system',
                            content: `You are analyzing interview transcripts to answer questions about: ${userMessage.content}

Your task is to:
1. First provide a direct answer based on the available information
2. Then identify key themes or aspects that could be explored further
3. Support your answer with specific quotes
4. Note any conflicting or complementary perspectives

Format your response with:
- Initial Answer (2-3 paragraphs)
- Supporting Quotes (2-3 relevant quotes)
- Key Themes (list of themes found)
- Potential Areas for Deeper Analysis`
                          },
                          {
                            role: 'user',
                            content: allContent
                          }
                        ],
                        model,
                        stream: true
                      });

                      if (response) {
                        for await (const chunk of OpenRouterClient.processStream(response)) {
                          const formattedContent = chunk
                            .replace(/\.\s+/g, '.\n\n')
                            .replace(/:\s+/g, ':\n');
                          controller.enqueue(new TextEncoder().encode(formattedContent));
                        }
                      }

                      // Add prompt for further exploration
                      controller.enqueue(new TextEncoder().encode('\n\nWould you like to explore any specific aspect in more detail? You can:\n\n'));
                      controller.enqueue(new TextEncoder().encode('1. Get more details about a specific theme\n'));
                      controller.enqueue(new TextEncoder().encode('2. See how different perspectives compare\n'));
                      controller.enqueue(new TextEncoder().encode('3. Look at the timeline of events\n'));
                      controller.enqueue(new TextEncoder().encode('4. Focus on specific examples or quotes\n\n'));
                    }
                  } else {
                    // Use regular OpenAI for smaller content
                    if (isFollowUp && messages.length > 2) {
                      const analysis = await processUserChoice(
                        userMessage.content,
                        relevantSources,
                        messages[messages.length - 2].content,
                        openai,
                        controller
                      );
                      previousAnalyses.push(analysis);

                      if (userMessage.content.toLowerCase().includes('summary') || 
                          userMessage.content === '4') {
                        await createFinalSummary(
                          previousAnalyses,
                          messages[0].content,
                          openai,
                          controller
                        );
                      }
                    } else {
                      const analysis = await analyzeSourceCategories(
                        relevantSources,
                        userMessage.content,
                        openai,
                        controller
                      );
                      previousAnalyses.push(analysis);
                    }
                  }
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
                systemMessage += `\nNote that I'm not currently using the interview transcripts. If you'd like me to check the transcripts, please enable the "Use sources" option.`;
                
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
