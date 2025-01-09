
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const decodedId = decodeURIComponent(params.id)
    console.log(`[DELETE] Attempting to delete source with id: ${decodedId}`)

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        })

        const index = pinecone.index(process.env.PINECONE_INDEX!)

        // Fetch metadata for the given ID
        const queryResponse = await index.query({
            vector: Array(1536).fill(0), // Dummy vector for text-embedding-ada-002 dimensions
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
            console.log(`[DELETE] File URL not found in metadata for id: ${decodedId}`)
            return NextResponse.json({ error: 'File metadata missing in Pinecone' }, { status: 404 })
        }

        // Delete from Pinecone and Vercel Blob
        try {
            await index.deleteOne(decodedId)
            console.log(`[DELETE] Vector deleted from Pinecone: ${decodedId}`)
            await del(fileUrl)
            console.log(`[DELETE] File deleted from Vercel Blob: ${fileUrl}`)
        } catch (error) {
            console.error(`[DELETE] Error during deletion:`, error)
            throw new Error('Failed to delete source')
        }

        return NextResponse.json({ success: true, message: 'Source deleted successfully' })
    } catch (error) {
        console.error(`[DELETE] Error deleting source:`, error)
        return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
    }
}
