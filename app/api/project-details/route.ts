import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '@/lib/document-processing'

const PROJECT_DETAILS_ID = 'project_details'

// Fetch project details
export async function GET() {
  try {
    const pinecone = new Pinecone();
    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const queryEmbedding = await generateEmbedding(PROJECT_DETAILS_ID);

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: { id: { $eq: PROJECT_DETAILS_ID } }
    })

    if (queryResponse.matches.length > 0 && queryResponse.matches[0].metadata?.details) {
      return NextResponse.json({ details: queryResponse.matches[0].metadata.details })
    } else {
      console.warn('No project details found or metadata is missing.')
      return NextResponse.json({ details: '' })
    }
  } catch (error) {
    console.error('Error fetching project details:', error)
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 })
  }
}

// Store project details
export async function POST(request: NextRequest) {
  try {
    const { details } = await request.json()

    if (typeof details !== 'string' || details.trim() === '') {
      return NextResponse.json({ error: 'Invalid details format' }, { status: 400 })
    }

    const pinecone = new Pinecone();
    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const embedding = await generateEmbedding(details);

    await index.upsert([{
      id: PROJECT_DETAILS_ID,
      values: embedding,
      metadata: { details }
    }]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving project details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details' 
    }, { status: 500 })
  }
}