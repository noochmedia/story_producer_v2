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

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { headers });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400, headers }
      );
    }

    if (!body || typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json(
        { error: "Text field is required and must be a non-empty string" },
        { status: 400, headers }
      );
    }

    const text = body.text.trim();

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

    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers }
    );
  }
}
