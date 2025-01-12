import { NextResponse } from 'next/server';
import pinecone from "@/lib/pinecone-assistant";
import { OpenAI } from 'openai';

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

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX is not set');
    }
    
    const index = pinecone.index(process.env.PINECONE_INDEX);
    const embedding = await generateEmbedding(text);
    
    await index.upsert([{
      id: Date.now().toString(),
      values: embedding,
      metadata: { text }
    }]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
