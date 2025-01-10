import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: 'aped-4627-b74a',
    })

    const index = pinecone.index('story-tools-embeddings-sj0uqym')

    const queryResponse = await index.query({
      vector: Array(384).fill(0),  // Dummy vector
      topK: 5,
      includeMetadata: true,
      filter: { type: { $eq: 'source' } }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully queried Pinecone',
      matches: queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      }))
    })
  } catch (error) {
    console.error('Error querying Pinecone:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to query Pinecone',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

