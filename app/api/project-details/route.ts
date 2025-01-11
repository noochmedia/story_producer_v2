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

    // Query for all project detail chunks
    const embeddingResults = await generateEmbedding("project details");
    // Use the first chunk's embedding for querying
    const queryEmbedding = embeddingResults[0].embedding;
    const queryResponse = await index.query({
      vector: queryEmbedding,
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
      await index.upsert([{
        id: `project_details_chunk${i}`,
        values: result.embedding,
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
