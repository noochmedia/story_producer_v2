import { NextRequest, NextResponse } from 'next/server'
import { PineconeAssistant } from '../../../../lib/pinecone-assistant'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')
        if (!id) {
            return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 })
        }

        // Initialize Pinecone Assistant
        const assistant = new PineconeAssistant({
            apiKey: process.env.PINECONE_API_KEY!,
            indexName: process.env.PINECONE_INDEX!,
            host: process.env.PINECONE_HOST!
        });

        // Search for the specific document by ID
        const results = await assistant.searchSimilar('', {
            type: 'source',
            id: id
        }, 1);

        if (!results.matches.length) {
            return NextResponse.json({ error: 'Source not found' }, { status: 404 });
        }

        const content = results.matches[0].metadata?.content;
        if (!content) {
            return NextResponse.json({ error: 'Source content not found' }, { status: 404 });
        }

        return NextResponse.json({ content })
    } catch (error) {
        console.error('[VIEW] Error fetching content:', error)
        return NextResponse.json({ 
            error: 'Failed to fetch content',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
