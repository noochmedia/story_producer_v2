import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import pinecone from "@/lib/pinecone-assistant";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, projectDetails, deepDive, isSoundbiteRequest, stream: shouldStream } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    
    // Create a stream transformer
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Function to send a chunk of data
    const writeChunk = async (text: string) => {
      await writer.write(encoder.encode(`data: ${text}\n\n`));
    };

    // Process the message
    try {
      // Send initial stage
      await writeChunk('[STAGE: Starting conversation]');

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: true
      });

      for await (const chunk of completion) {
        if (chunk.choices[0]?.delta?.content) {
          await writeChunk(chunk.choices[0].delta.content);
        }
      }

      await writer.close();
    } catch (error) {
      console.error('Streaming error:', error);
      await writer.abort(error);
    }

    return new NextResponse(stream.readable, {
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
