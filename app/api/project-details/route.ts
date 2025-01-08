
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

const PROJECT_DETAILS_ID = 'project_details'

async function generateEmbedding(text: string): Promise<number[]> {
  // Replace with your actual embedding model logic
  const dimension = 384; // Match the Pinecone index dimension
  return Array.from({ length: dimension }, (_, i) => text.charCodeAt(i % text.length) % 100);
}

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const queryEmbedding = await generateEmbedding(PROJECT_DETAILS_ID);

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: { id: { $eq: PROJECT_DETAILS_ID } }
    })

    if (queryResponse.matches.length > 0) {
      return NextResponse.json({ details: queryResponse.matches[0].metadata?.details || '' })
    } else {
      return NextResponse.json({ details: '' })
    }
  } catch (error) {
    console.error('Error fetching project details:', error)
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { details } = await request.json()

    if (typeof details !== 'string') {
      return NextResponse.json({ error: 'Invalid details format' }, { status: 400 })
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const embedding = await generateEmbedding(details);

    await index.upsert([{
      id: PROJECT_DETAILS_ID,
      values: embedding,
      metadata: { details }
    }])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving project details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
