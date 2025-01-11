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

    // Use a neutral vector to get all project details
    const neutralVector = Array.from({ length: 1024 }, () => 0);
    const queryResponse = await index.query({
      vector: neutralVector,
      topK: 100, // High number to get all chunks
      includeMetadata: true,
      filter: { type: { $eq: 'project_details' } }
    });

    if (queryResponse.matches?.length > 0) {
      // Sort chunks by index and combine content
      const sortedChunks = queryResponse.matches
        .filter(match => match.metadata?.chunkIndex !== undefined)
        .sort((a, b) => 
          (a.metadata?.chunkIndex as number) - (b.metadata?.chunkIndex as number)
        );

      if (sortedChunks.length > 0) {
        const combinedContent = sortedChunks
          .map(chunk => chunk.metadata?.content)
          .filter(Boolean)
          .join(' ');
        
        return NextResponse.json({ details: combinedContent });
      }
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

    // Generate embeddings for the project details
    const embeddingResults = await generateEmbedding(details);
    
    // Store each chunk in Pinecone
    const timestamp = Date.now();
    for (let i = 0; i < embeddingResults.length; i++) {
      const result = embeddingResults[i];
      // Ensure vector values are numbers
      const validVector = result.embedding.map(val => Number(val));
      if (!validVector.every(val => typeof val === 'number' && !isNaN(val))) {
        throw new Error('Invalid vector values');
      }

      await index.upsert([{
        id: `project_details_chunk${i}`,
        values: validVector,
        metadata: {
          content: result.chunk,
          type: 'project_details',
          chunkIndex: i,
          totalChunks: embeddingResults.length,
          updatedAt: new Date().toISOString()
        }
      }]);
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving project details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
