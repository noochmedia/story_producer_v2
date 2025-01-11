import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    })

    const index = pinecone.index(process.env.PINECONE_INDEX || 'story-tools-embedding2-sj0uqym')

    // Create a test vector with proper validation
    const testVector = Array(1536).fill(0).map(Number);
    
    // Log the test vector details
    console.log('Test vector details:', {
      type: typeof testVector,
      isArray: Array.isArray(testVector),
      length: testVector.length,
      sample: testVector.slice(0, 3),
      allNumbers: testVector.every(v => typeof v === 'number' && !isNaN(v)),
      serializedSample: JSON.stringify(testVector.slice(0, 3))
    });

    // Create the query payload
    const queryPayload = {
      vector: testVector,
      topK: 5,
      includeMetadata: true,
      filter: { type: { $eq: 'source' } }
    };

    console.log('Query payload:', JSON.stringify(queryPayload, null, 2));

    const queryResponse = await index.query(queryPayload);

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
