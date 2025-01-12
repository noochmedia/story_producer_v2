import { NextRequest, NextResponse } from 'next/server'
import { PineconeAssistant } from '../../../lib/pinecone-assistant'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        // Initialize Pinecone Assistant
        const assistant = new PineconeAssistant({
            apiKey: process.env.PINECONE_API_KEY!,
            indexName: process.env.PINECONE_INDEX!,
            host: process.env.PINECONE_HOST!
        });

        // Search for all source documents
        const results = await assistant.searchSimilar('', {
            type: 'source'
        }, 100); // Get up to 100 sources

        // Map results to source format with proper typing
        interface Source {
            id: string;
            name: string;
            type: string;
            url?: string;
            uploadedAt: string;
        }

        const sources: Source[] = results.matches.map((match) => ({
            id: match.id,
            name: String(match.metadata?.fileName || 'Unknown'),
            type: String(match.metadata?.fileType || 'unknown'),
            url: match.metadata?.fileUrl ? String(match.metadata.fileUrl) : undefined,
            uploadedAt: typeof match.metadata?.uploadedAt === 'string' 
                ? match.metadata.uploadedAt 
                : new Date().toISOString()
        }));

        // Sort by upload date
        sources.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

        console.log('Sources retrieved successfully, count:', sources.length);
        return NextResponse.json(sources)
    } catch (error) {
        console.error('Error fetching sources from Pinecone:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch sources',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
