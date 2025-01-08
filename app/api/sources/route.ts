
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function generateEmbedding(text: string): Promise<number[]> {
  const dimension = 384; // Match Pinecone index dimension
  return Array.from({ length: dimension }, (_, i) => text.charCodeAt(i % text.length) % 100);
}

export async function GET(request: NextRequest) {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Generate a meaningful embedding for querying file sources
    const queryEmbedding = await generateEmbedding('list_sources')

    // Fetch all vectors of type 'source'
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 10000,
      includeMetadata: true,
      filter: {
        type: { $eq: 'source' } // Only fetch vectors of type 'source'
      }
    })

    // Parse the results into a list of sources
    if (queryResponse.matches?.length > 0) {
      const sources = queryResponse.matches
        .filter(match => match.metadata && match.metadata.fileName) // Ensure valid metadata
        .map(match => ({
          id: match.id,
          name: match.metadata!.fileName as string,
          type: match.metadata!.fileType as string || 'unknown',
          url: match.metadata!.fileUrl as string || ''
        }))

      return NextResponse.json({ sources })
    } else {
      console.error('No sources found in Pinecone.')
      return NextResponse.json({ sources: [] })
    }
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
  }
}
