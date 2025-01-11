import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    })

    const index = pinecone.index(process.env.PINECONE_INDEX || 'story-tools-embedding2-sj0uqym')

    // Create a simple test vector
    const vector = new Array(1536).fill(0);

    // Log vector details
    console.log('Test vector:', {
      type: typeof vector,
      isArray: Array.isArray(vector),
      length: vector.length,
      sample: vector.slice(0, 3)
    });

    // Test query with minimal options
    const queryResponse = await index.query({
      vector,
      topK: 1
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully tested Pinecone',
      matches: queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score
      }))
    })
  } catch (error) {
    console.error('Error testing Pinecone:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to test Pinecone',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
