import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'
import { queryMemory, storeMemory, formatMemoryForAI } from '../../../lib/ai-memory'
import { OpenRouterClient } from '../../../lib/openrouter-client'
import { PineconeAssistant } from '../../../lib/pinecone-assistant'
import OpenAI from 'openai'

export async function POST(req: Request) {
  const { messages, projectDetails, deepDive = false, isSoundbiteRequest = false, model, temperature, max_tokens, stream = false } = await req.json()

  console.log('Processing chat request:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    type: isSoundbiteRequest ? 'Soundbite' : 'Regular',
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content,
    hasProjectDetails: !!projectDetails,
    deepDive
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

    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY!,
      indexName: process.env.PINECONE_INDEX!
    });

    // Prepare system message based on mode
    let systemMessage = '';
    let relevantSources = [];
    
    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // Always include project details in system message
              systemMessage = AI_CONFIG.systemPrompt;
              if (projectDetails) {
                systemMessage += `\n\nProject Context:\n${projectDetails}\n\n`;
              }

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

                  // Query for relevant sources
                  relevantSources = await assistant.query(userMessage.content, {
                    topK: 10,
                    filter: { type: { $eq: 'source' } }
                  });

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

                  // Combine all source content
                  const sourceContent = relevantSources
                    .map(source => source.metadata?.content || '')
                    .join('\n\n');

                  // Add source context to system message
                  systemMessage += `\n\nRelevant source content:\n${sourceContent}`;

                  // Generate response with source context
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
