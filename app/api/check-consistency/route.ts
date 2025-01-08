import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { list, head } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[CHECK] Starting consistency check')

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Fetch all vectors from Pinecone
    console.log('[CHECK] Fetching vectors from Pinecone')
    const queryResponse = await index.query({
      vector: Array(384).fill(0),  // Dummy vector
      topK: 10000,
      includeMetadata: true,
    })

    console.log(`[CHECK] Found ${queryResponse.matches.length} vectors in Pinecone`)

    // Fetch all files from Vercel Blob
    console.log('[CHECK] Fetching files from Vercel Blob')
    const { blobs } = await list()

    console.log(`[CHECK] Found ${blobs.length} files in Vercel Blob`)

    const pineconeFiles = new Map(queryResponse.matches.map(match => [match.id, match.metadata?.fileUrl]))
    const blobFiles = new Map(blobs.map(blob => [blob.url, blob]))

    const inconsistencies = []

    // Check for files in Pinecone that don't exist in Blob
    for (const [id, url] of pineconeFiles.entries()) {
      if (url && !blobFiles.has(url)) {
        inconsistencies.push({ type: 'missing_in_blob', id, url })
      }
    }

    // Check for files in Blob that don't exist in Pinecone
    for (const [url, blob] of blobFiles.entries()) {
      if (!Array.from(pineconeFiles.values()).includes(url)) {
        inconsistencies.push({ type: 'missing_in_pinecone', url, pathname: blob.pathname })
      }
    }

    console.log(`[CHECK] Found ${inconsistencies.length} inconsistencies`)

    return NextResponse.json({
      totalPineconeFiles: pineconeFiles.size,
      totalBlobFiles: blobFiles.size,
      inconsistencies
    })
  } catch (error) {
    console.error('[CHECK] Error checking consistency:', error)
    return NextResponse.json({ 
      error: 'Failed to check consistency', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

