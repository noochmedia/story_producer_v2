
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { list } from '@vercel/blob'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    console.log('[CHECK] Starting consistency check')

    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        })

        const index = pinecone.index(process.env.PINECONE_INDEX!)

        // Fetch vectors and blobs
        const queryResponse = await index.query({
            vector: Array(384).fill(0), // Dummy vector
            topK: 10000,
            includeMetadata: true,
        })

        const { blobs } = await list()
        console.log(`[CHECK] Found ${queryResponse.matches.length} vectors in Pinecone`)
        console.log(`[CHECK] Found ${blobs.length} files in Vercel Blob`)

        const pineconeFiles = new Map(queryResponse.matches.map(match => [match.id, match.metadata?.fileUrl]))
        const blobFiles = new Map(blobs.map(blob => [blob.url, blob]))

        const inconsistencies = []

        // Find mismatches and resolve them
        for (const [id, url] of pineconeFiles.entries()) {
            if (url && !blobFiles.has(url)) {
                inconsistencies.push({ type: 'missing_in_blob', id, url })
            }
        }

        for (const [url, blob] of blobFiles.entries()) {
            if (!Array.from(pineconeFiles.values()).includes(url)) {
                inconsistencies.push({ type: 'missing_in_pinecone', url, pathname: blob.pathname })
            }
        }

        console.log(`[CHECK] Found ${inconsistencies.length} inconsistencies`)
        return NextResponse.json({ inconsistencies })
    } catch (error) {
        console.error('[CHECK] Error during consistency check:', error)
        return NextResponse.json({ error: 'Consistency check failed' }, { status: 500 })
    }
}
