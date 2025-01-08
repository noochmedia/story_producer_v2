import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'

const PROJECT_DETAILS_ID = 'project_details'

// Fetch project details
export async function GET() {
  try {
    // Log environment variables (without exposing sensitive values)
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasPineconeKey: !!process.env.PINECONE_API_KEY,
      hasPineconeIndex: !!process.env.PINECONE_INDEX,
      pineconeIndex: process.env.PINECONE_INDEX,
      nodeEnv: process.env.NODE_ENV
    });

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

    console.log('Initializing Pinecone...');
    const pinecone = new Pinecone();
    console.log('Pinecone initialized');

    console.log('Getting Pinecone index...');
    const index = pinecone.index(process.env.PINECONE_INDEX);
    console.log('Got Pinecone index');

    console.log('Generating embedding...');
    try {
      const queryEmbedding = await generateEmbedding(PROJECT_DETAILS_ID);
      console.log('Generated embedding, length:', queryEmbedding.length);

      console.log('Querying Pinecone...');
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 1,
        includeMetadata: true,
        filter: { id: { $eq: PROJECT_DETAILS_ID } }
      });
      console.log('Pinecone query complete, matches:', queryResponse.matches?.length || 0);

      if (queryResponse.matches?.length > 0 && queryResponse.matches[0].metadata?.details) {
        console.log('Found project details');
        return NextResponse.json({ details: queryResponse.matches[0].metadata.details })
      } else {
        console.log('No project details found');
        return NextResponse.json({ details: '' })
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    // Enhanced error logging
    console.error('Detailed error in project details:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      env: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasPineconeIndex: !!process.env.PINECONE_INDEX,
        pineconeIndex: process.env.PINECONE_INDEX
      }
    });

    return NextResponse.json({ 
      error: 'Failed to fetch project details',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// Store project details
export async function POST(request: NextRequest) {
  try {
    const { details } = await request.json()

    if (typeof details !== 'string' || details.trim() === '') {
      return NextResponse.json({ error: 'Invalid details format' }, { status: 400 })
    }

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

    console.log('Initializing Pinecone...');
    const pinecone = new Pinecone();
    console.log('Pinecone initialized');

    console.log('Getting Pinecone index...');
    const index = pinecone.index(process.env.PINECONE_INDEX);
    console.log('Got Pinecone index');

    console.log('Generating embedding...');
    try {
      const embedding = await generateEmbedding(details);
      console.log('Generated embedding, length:', embedding.length);

      console.log('Upserting to Pinecone...');
      await index.upsert([{
        id: PROJECT_DETAILS_ID,
        values: embedding,
        metadata: { details }
      }]);
      console.log('Successfully upserted to Pinecone');

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    // Enhanced error logging
    console.error('Detailed error in saving project details:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      env: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasPineconeIndex: !!process.env.PINECONE_INDEX,
        pineconeIndex: process.env.PINECONE_INDEX
      }
    });

    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
