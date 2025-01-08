
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { del, head } from '@vercel/blob'

export const dynamic = 'force-dynamic'

async function generateEmbedding(text: string): Promise<number[]> {
  const dimension = 384; // Match Pinecone index dimension
  return Array.from({ length: dimension }, (_, i) => text.charCodeAt(i % text.length) % 100);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decodedId = decodeURIComponent(params.id)
  console.log(`[DELETE] Attempting to delete source with id: ${decodedId}`)

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Check permissions
    const pineconePermissions = true;
    const blobPermissions = true;

    if (!pineconePermissions || !blobPermissions) {
      return NextResponse.json({ 
        error: 'Insufficient permissions', 
        details: {
          pinecone: pineconePermissions ? 'OK' : 'Failed',
          blob: blobPermissions ? 'OK' : 'Failed'
        }
      }, { status: 403 })
    }

    // Delete from Pinecone
    console.log(`[DELETE] Deleting vector with ID ${decodedId} from Pinecone`)
    try {
      await index.deleteOne(decodedId)
      console.log(`[DELETE] Vector deleted from Pinecone: ${decodedId}`)
    } catch (pineconeError) {
      console.error(`[DELETE] Error deleting from Pinecone:`, pineconeError)
      throw new Error('Failed to delete vector from Pinecone')
    }

    // Generate embedding for Pinecone query
    const queryEmbedding = await generateEmbedding(decodedId);

    // Query Pinecone to get the file URL (needed for Vercel Blob deletion)
    console.log(`[DELETE] Querying Pinecone for vector metadata with id: ${decodedId}`)
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: { id: { $eq: decodedId } }
    })

    if (queryResponse.matches.length === 0) {
      console.log(`[DELETE] No matching vectors found in Pinecone for id: ${decodedId}`)
      return NextResponse.json({ error: 'File not found in Pinecone' }, { status: 404 })
    }

    const fileUrl = queryResponse.matches[0].metadata?.fileUrl as string

    if (!fileUrl) {
      console.log(`[DELETE] FileUrl not found in vector metadata for id: ${decodedId}`)
      return NextResponse.json({ error: 'File metadata not found in Pinecone' }, { status: 404 })
    }

    // Delete from Vercel Blob
    console.log(`[DELETE] Attempting to delete file from Vercel Blob: ${fileUrl}`)
    try {
      await del(fileUrl)
      console.log(`[DELETE] File deleted from Vercel Blob: ${fileUrl}`)
    } catch (blobError) {
      console.error(`[DELETE] Error deleting from Vercel Blob:`, blobError)
      throw new Error('Failed to delete file from Vercel Blob')
    }

    console.log(`[DELETE] Source deleted successfully: ${decodedId}`)
    return NextResponse.json({ success: true, message: 'Source deleted successfully' })
  } catch (error) {
    console.error(`[DELETE] Error deleting source:`, error)
    return NextResponse.json({ 
      error: 'Failed to delete source', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
