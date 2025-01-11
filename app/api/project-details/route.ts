import { NextRequest, NextResponse } from 'next/server'
import { PineconeAssistant } from '../../../lib/pinecone-assistant'

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

    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX
    });

    // Query for project details
    const matches = await assistant.query('', {
      topK: 100,
      filter: { type: { $eq: 'project_details' } }
    });

    if (matches.length > 0) {
      // Sort chunks by index and combine content
      const sortedChunks = matches
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

    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX
    });

    // First delete any existing project details
    await assistant.deleteDocuments({ type: { $eq: 'project_details' } });

    // Upload new project details
    const result = await assistant.uploadDocument(details, {
      fileName: 'project_details.txt',
      fileType: 'text/plain',
      uploadedAt: new Date().toISOString(),
      type: 'project_details'
    });

    console.log('Successfully updated project details:', result);

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving project details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
