import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { list, del } from '@vercel/blob'
import { generateEmbedding } from '@/lib/document-processing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone();
    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Generate a neutral embedding for listing all sources
    const queryEmbedding = await generateEmbedding("list all sources");

    // Fetch all vectors from Pinecone
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 10000,
      includeMetadata: true,
    })

    // Fetch all files from Vercel Blob
    const { blobs } = await list()

    const pineconeFiles = new Map(queryResponse.matches.map(match => [match.id, match.metadata?.fileUrl]))
    const blobFiles = new Map(blobs.map(blob => [blob.pathname, blob.url]))

    const filesToDeleteFromPinecone = []
    const filesToDeleteFromBlob = []

    // Check for files in Pinecone that don't exist in Blob
    for (const [id, url] of pineconeFiles.entries()) {
      if (!blobFiles.has(url as string)) {
        filesToDeleteFromPinecone.push(id)
      }
    }

    // Check for files in Blob that don't exist in Pinecone
    for (const [pathname, url] of blobFiles.entries()) {
      if (!Array.from(pineconeFiles.values()).includes(url)) {
        filesToDeleteFromBlob.push(pathname)
      }
    }

    // Delete files from Pinecone that don't exist in Blob
    for (const id of filesToDeleteFromPinecone) {
      await index.deleteOne(id)
      console.log(`Deleted file ${id} from Pinecone`)
    }

    // Delete files from Blob that don't exist in Pinecone
    for (const pathname of filesToDeleteFromBlob) {
      await del(blobFiles.get(pathname)!)
      console.log(`Deleted file ${pathname} from Vercel Blob`)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sources synchronized successfully',
      deletedFromPinecone: filesToDeleteFromPinecone.length,
      deletedFromBlob: filesToDeleteFromBlob.length
    })
  } catch (error) {
    console.error('Error synchronizing sources:', error)
    return NextResponse.json({ 
      error: 'Failed to synchronize sources', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}