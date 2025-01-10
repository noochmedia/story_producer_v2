import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { head } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decodedId = decodeURIComponent(params.id)
  console.log(`Debugging source with id: ${decodedId}`)

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Query Pinecone to find the vector
    console.log('Querying Pinecone for the vector')
    const queryResponse = await index.query({
      vector: Array(384).fill(0), // Dummy vector
      topK: 1,
      includeMetadata: true,
      filter: {
        $or: [
          { id: { $eq: decodedId } },
          { fileName: { $eq: decodedId } },
          { fileName: { $eq: decodedId.split('-').slice(2).join('-') } }
        ]
      }
    })

    console.log('Query response:', JSON.stringify(queryResponse, null, 2))

    if (queryResponse.matches.length === 0) {
      console.log('No matching vectors found in Pinecone')
      return NextResponse.json({ error: 'File not found in Pinecone' }, { status: 404 })
    }

    const matchedVector = queryResponse.matches[0]
    const vectorId = matchedVector.id
    const fileUrl = matchedVector.metadata?.fileUrl as string

    if (!fileUrl) {
      console.log('FileUrl not found in vector metadata')
      return NextResponse.json({ error: 'File metadata not found in Pinecone' }, { status: 404 })
    }

    // Check if file exists in Vercel Blob
    let blobExists = false
    try {
      await head(fileUrl)
      blobExists = true
      console.log('File found in Vercel Blob')
    } catch (error) {
      console.log('File not found in Vercel Blob:', error)
    }

    return NextResponse.json({
      success: true,
      pineconeStatus: 'File found in Pinecone',
      blobStatus: blobExists ? 'File found in Vercel Blob' : 'File not found in Vercel Blob',
      vectorId,
      fileUrl
    })
  } catch (error) {
    console.error('Error debugging source:', error)
    return NextResponse.json({ 
      error: 'Failed to debug source', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

