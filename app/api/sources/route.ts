import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PineconeMatch {
  id: string;
  metadata?: {
    fileName?: string;
    fileType?: string;
    fileUrl?: string;
    content?: string;
    type?: string;
    uploadedAt?: string;
  };
}

function getContentPreview(content: any): string {
  if (typeof content === 'string') {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  return 'No content preview available';
}

export async function GET() {
  try {
    // Validate environment variables
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

    // Query for all source documents
    const queryResponse = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector
      filter: { type: 'source' },
      includeMetadata: true,
      topK: 100
    });

    // Format response
    const sources = queryResponse.matches.map((match: PineconeMatch) => ({
      id: match.id,
      fileName: match.metadata?.fileName || 'Unknown',
      preview: getContentPreview(match.metadata?.content),
      uploadedAt: match.metadata?.uploadedAt || new Date().toISOString()
    }));

    return NextResponse.json({ 
      success: true,
      sources 
    })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
