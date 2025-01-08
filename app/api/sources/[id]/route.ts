
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { del } from '@vercel/blob'

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

    // Query Pinecone for metadata before deletion
    console.log(`[DELETE] Querying Pinecone for vector metadata with id: ${decodedId}`)
    const queryEmbedding = await generateEmbedding(decodedId)
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
      filter: { id: { $eq: decodedId } },
    })

    if (queryResponse.matches.length === 0 || !queryResponse.matches[0].metadata) {
      console.error(`[DELETE] No metadata found for ID: ${decodedId}`)
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    const metadata = queryResponse.matches[0].metadata
    const fileUrl = metadata.fileUrl

    // Delete from Pinecone
    console.log(`[DELETE] Deleting vector with ID ${decodedId} from Pinecone`)
    await index.deleteOne(decodedId)
    console.log(`[DELETE] Vector deleted from Pinecone: ${decodedId}`)

    // Delete file from Vercel Blob
    if (fileUrl) {
      console.log(`[DELETE] Deleting file from Vercel Blob: ${fileUrl}`)
      try {
        await del(fileUrl)
        console.log(`[DELETE] File deleted from Vercel Blob: ${fileUrl}`)
      } catch (blobError) {
        console.error(`[DELETE] Error deleting file from Vercel Blob:`, blobError)
      }
    }

    return NextResponse.json({ success: true, message: 'Source deleted successfully' })
  } catch (error) {
    console.error(`[DELETE] Error during delete operation:`, error)
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }
}
