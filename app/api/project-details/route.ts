import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX environment variable is not set');
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);

    // Query for project details
    const queryEmbedding = await generateEmbedding("project details");
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: { type: { $eq: 'project_details' } }
    });

    if (queryResponse.matches?.length > 0 && queryResponse.matches[0].metadata?.content) {
      return NextResponse.json({ details: queryResponse.matches[0].metadata.content })
    }

    return NextResponse.json({ details: '' })
  } catch (error) {
    console.error('Error fetching project details:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX environment variable is not set');
    }

    const data = await request.json()
    const { details } = data

    if (!details) {
      return NextResponse.json({ error: 'No details provided' }, { status: 400 })
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);

    // Generate embedding for the project details
    const embedding = await generateEmbedding(details)

    // Store in Pinecone
    await index.upsert([{
      id: 'project_details',
      values: embedding,
      metadata: {
        content: details,
        type: 'project_details',
        updatedAt: new Date().toISOString()
      }
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
