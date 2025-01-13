import { NextResponse } from 'next/server';
import { DocumentStore } from '@/lib/document-store';
import { analyzeSourceCategories } from '@/lib/interactive-search';
import { AI_CONFIG } from '@/lib/ai-config';
import { OpenRouterClient } from '@/lib/openrouter-client';

// Initialize OpenRouter client
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key not configured');
}
const openRouter = new OpenRouterClient(process.env.OPENROUTER_API_KEY);

export async function POST(request: Request) {
  try {
    const { messages, projectDetails, deepDive, isSoundbiteRequest } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];

    // Build system prompt based on mode and project context
    let systemPrompt = AI_CONFIG.systemPrompt;
    if (projectDetails) {
      systemPrompt += `\n\nProject Context: ${projectDetails}`;
    }
    if (deepDive) {
      systemPrompt += `\n\nYou are in Deep Dive mode. Analyze source materials thoroughly and provide detailed, evidence-based responses.`;
    }
    if (isSoundbiteRequest) {
      systemPrompt += `\n\nYou are in Soundbite mode. Focus on identifying or crafting compelling, concise quotes that capture key themes and moments.`;
    }

    // Create readable stream for response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          if (deepDive) {
            // Send initial stage marker
            controller.enqueue(encoder.encode('data: [STAGE: Analyzing source materials]\n\n'));

            try {
              // Get document store instance and search for relevant sources
              const store = await DocumentStore.getInstance();
              const sources = await store.searchSimilar(lastUserMessage.content, { type: 'source' });

              if (!sources.length) {
                controller.enqueue(encoder.encode('data: No relevant sources found. Please try a different query or check if sources have been uploaded.\n\n'));
                return;
              }

              // Log found sources for debugging
              console.log('Found sources:', sources.length);
              
              // Analyze sources using OpenRouter
              await analyzeSourceCategories(
                sources,
                lastUserMessage.content,
                openRouter,
                controller
              );

            } catch (error) {
              console.error('Error in deep dive mode:', error);
              controller.enqueue(encoder.encode(`data: Error analyzing sources: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.\n\n`));
              return;
            }
          } else {
            // Regular chat mode using OpenRouter
            controller.enqueue(encoder.encode('data: [STAGE: Processing request]\n\n'));

            const response = await openRouter.streamResponse([
              { role: 'system', content: systemPrompt },
              ...messages
            ], AI_CONFIG.max_tokens, controller);

            if (!response) {
              throw new Error('Failed to get response from OpenRouter');
            }
          }

          // Send completion marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
