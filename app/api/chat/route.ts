import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { DocumentStore } from '@/lib/document-store';
import { analyzeSourceCategories, processUserChoice } from '@/lib/interactive-search';
import { AI_CONFIG } from '@/lib/ai-config';

interface DocumentWithScore {
  id: string;
  metadata: {
    fileName: string;
    fileType: string;
    type: string;
    uploadedAt: string;
    score?: number;
    [key: string]: any;
  };
  score: number;
  content: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Add project context if available
    if (projectDetails) {
      systemPrompt += `\n\nProject Context: ${projectDetails}`;
    }

    // Add mode-specific instructions
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
              // Get document store instance
              const store = DocumentStore.getInstance();

              // Search for relevant sources
              const sources = await store.searchSimilar(lastUserMessage.content, { type: 'source' });

              if (!sources.length) {
                controller.enqueue(encoder.encode('data: No relevant sources found. Please try a different query or check if sources have been uploaded.\n\n'));
                return;
              }

              // Log found sources
              console.log('Found sources:', sources.map(doc => ({
                id: doc.id,
                fileName: doc.metadata.fileName,
                score: doc.metadata.score
              })));
              
              // Analyze sources and stream response
              await analyzeSourceCategories(
                sources,
                lastUserMessage.content,
                openai,
                controller
              );
            } catch (error) {
              console.error('Error in deep dive mode:', error);
              controller.enqueue(encoder.encode(`data: Error analyzing sources: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.\n\n`));
              return;
            }
          } else {
            // Regular chat mode
            controller.enqueue(encoder.encode('data: [STAGE: Processing request]\n\n'));

            const completion = await openai.chat.completions.create({
              model: AI_CONFIG.model,
              temperature: AI_CONFIG.temperature,
              max_tokens: AI_CONFIG.max_tokens,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages
              ],
              stream: true
            });

            // Stream the response
            for await (const chunk of completion) {
              if (chunk.choices[0]?.delta?.content) {
                controller.enqueue(encoder.encode(`data: ${chunk.choices[0].delta.content}\n\n`));
              }
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
