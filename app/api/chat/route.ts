import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import PineconeAssistant from '@/lib/pinecone-assistant';

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

    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY!,
      indexName: process.env.PINECONE_INDEX!,
      host: process.env.PINECONE_HOST!
    });

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];

    // Build system prompt based on mode
    let systemPrompt = `You are a helpful AI assistant with expertise in documentary storytelling and narrative structure.`;
    
    if (projectDetails) {
      systemPrompt += `\n\nProject Context: ${projectDetails}`;
    }

    if (deepDive) {
      systemPrompt += `\n\nYou have access to source materials and can provide detailed, source-based responses.`;
    }

    if (isSoundbiteRequest) {
      systemPrompt += `\n\nYou specialize in identifying and crafting compelling soundbites that capture key themes and moments.`;
    }

    // Prepare messages with system prompt
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Get chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: fullMessages,
      stream: false
    });

    const response = completion.choices[0].message;

    // If in deep dive mode, store the interaction
    if (deepDive) {
      try {
        await assistant.uploadDocument(
          `Q: ${lastUserMessage.content}\nA: ${response.content}`,
          {
            type: 'conversation',
            timestamp: new Date().toISOString()
          }
        );
      } catch (error) {
        console.error('Error storing conversation:', error);
        // Don't throw - we want the chat to continue even if storage fails
      }
    }

    return new Response(response.content);

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
