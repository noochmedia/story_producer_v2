import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    })

    const index = pinecone.index(process.env.PINECONE_INDEX || 'story-tools-embedding2-sj0uqym')

    const queryResponse = await index.query({
      vector: Array(1536).fill(0),  // Dummy vector for 1536 dimensions
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
