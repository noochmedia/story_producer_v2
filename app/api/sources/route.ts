
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        })

        const index = pinecone.index(process.env.PINECONE_INDEX!)

        // Fetch all vectors of type 'source' directly without embeddings
        const queryResponse = await index.query({
            vector: Array(384).fill(0), // Dummy vector
            topK: 10000,
            includeMetadata: true,
            filter: { type: { $eq: 'source' } }
        })

        if (queryResponse.matches?.length > 0) {
            const sources = queryResponse.matches
                .filter(match => match.metadata?.fileName) // Validate metadata
                .map(match => ({
                    id: match.id,
                    name: match.metadata.fileName as string,
                    type: match.metadata.fileType || 'unknown',
                    url: match.metadata.fileUrl || '',
                    content: match.metadata.content || 'No content available' // Include content
                }))

            return NextResponse.json({ sources })
        } else {
            console.error('No sources found in Pinecone.')
            return NextResponse.json({ sources: [] })
        }
    } catch (error) {
        console.error('Error fetching sources:', error)
        return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 })
    }
}
