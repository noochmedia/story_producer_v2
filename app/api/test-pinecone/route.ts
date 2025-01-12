
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
      host: process.env.PINECONE_HOST!, // Explicitly include host
    });

    const index = pinecone.index(process.env.PINECONE_INDEX || 'story-producer-ada-002');

    const vector = Array(1536).fill(0);

    const queryResponse = await index.query({
      vector,
      topK: 1,
      namespace: 'default-namespace', // Add namespace
      filter: { genre: { $eq: "action" } }, // Example filter
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully tested Pinecone',
      matches: queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
      })),
    });
  } catch (error) {
    console.error('Error testing Pinecone:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test Pinecone',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
