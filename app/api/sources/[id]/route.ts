
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const pathname = decodeURIComponent(params.id)
    console.log(`[DELETE] Attempting to delete source with pathname: ${pathname}`)

    try {
        // First delete from Vercel Blob
        console.log(`[DELETE] Deleting from Vercel Blob: ${pathname}`)
        await del(pathname)
        console.log(`[DELETE] Successfully deleted from Vercel Blob`)

        // Then clean up vectors from Pinecone
        console.log(`[DELETE] Cleaning up vectors from Pinecone`)
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        })

        const index = pinecone.index(process.env.PINECONE_INDEX!)

        // Get the filename from the pathname
        const filename = pathname.split('/').pop()
        if (!filename) {
            throw new Error('Invalid pathname')
        }

        // Delete all chunks for this file from Pinecone
        const queryResponse = await index.query({
            vector: Array(1024).fill(0), // Neutral vector for multilingual-e5-large
            topK: 10000,
            includeMetadata: true,
            filter: { 
                fileName: { $eq: filename }
            }
        })

        if (queryResponse.matches.length > 0) {
            console.log(`[DELETE] Found ${queryResponse.matches.length} vectors to delete from Pinecone`)
            const chunkIds = queryResponse.matches.map(match => match.id)
            
            // Delete chunks in batches
            const BATCH_SIZE = 100
            for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
                const batch = chunkIds.slice(i, i + BATCH_SIZE)
                await index.deleteMany(batch)
                console.log(`[DELETE] Deleted chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, chunkIds.length)}`)
            }
        } else {
            console.log(`[DELETE] No vectors found in Pinecone for file: ${filename}`)
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Source and associated vectors deleted successfully' 
        })
    } catch (error) {
        console.error(`[DELETE] Error during deletion:`, error)
        return NextResponse.json({ 
            error: 'Failed to delete source',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
