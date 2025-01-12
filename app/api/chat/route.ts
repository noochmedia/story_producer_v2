import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import pinecone from "@/lib/pinecone-assistant";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

async function storeEmbedding(text: string) {
  try {
    if (!process.env.PINECONE_INDEX) {
      console.warn('PINECONE_INDEX not set, skipping embedding storage');
      return;
    }

    const embedding = await generateEmbedding(text);
    const index = pinecone.index(process.env.PINECONE_INDEX);
    
    await index.upsert([{
      id: Date.now().toString(),
      values: embedding,
      metadata: { text }
    }]);
  } catch (error) {
    console.error('Error storing embedding:', error);
    // Don't throw - we want the chat to continue even if embedding fails
  }
}

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

    // Start storing the embedding in the background
    if (deepDive) {
      storeEmbedding(lastUserMessage.content);
    }

    // Get chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: false
    });

    const response = completion.choices[0].message;

    return NextResponse.json({ 
      role: response.role,
      content: response.content
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
