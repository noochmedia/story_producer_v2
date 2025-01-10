import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PineconeMatch {
    id: string;
    metadata?: {
        fileName?: string;
        fileType?: string;
        fileUrl?: string;
        content?: string;
        type?: string;
    };
}

function getContentPreview(content: any): string {
    if (typeof content === 'string') {
        return content.length > 100 ? content.substring(0, 100) + '...' : content;
    }
    return 'No content preview available';
}

export async function GET(request: NextRequest) {
    try {
        // Validate environment variables first
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        if (!process.env.PINECONE_API_KEY) {
            throw new Error('PINECONE_API_KEY environment variable is not set');
        }
        if (!process.env.PINECONE_INDEX) {
            throw new Error('PINECONE_INDEX environment variable is not set');
        }

        console.log('Initializing Pinecone client...');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!
        });
        console.log('Pinecone client initialized');

        const index = pinecone.index(process.env.PINECONE_INDEX);
        console.log('Pinecone index accessed:', process.env.PINECONE_INDEX);

        // First try to list all vectors to see what's in the index
        console.log('Listing all vectors in index...');
        const stats = await index.describeIndexStats();
        console.log('Index stats:', {
            totalRecords: stats.totalRecordCount,
            indexFullness: stats.indexFullness,
            dimensions: stats.dimension
        });

        // Now query for sources
        console.log('Generating embedding for sources query...');
        const queryEmbedding = await generateEmbedding("list all sources");
        console.log('Embedding generated, length:', queryEmbedding.length);

        console.log('Querying Pinecone...');
        const queryResponse = await index.query({
            vector: queryEmbedding,
            topK: 10000,
            includeMetadata: true,
            filter: { type: { $eq: 'source' } }
        });
        console.log('Pinecone query completed, matches:', queryResponse.matches?.length || 0);

        // Log each match for debugging
        queryResponse.matches?.forEach((match, i) => {
            console.log(`Match ${i + 1}:`, {
                id: match.id,
                score: match.score,
                fileName: match.metadata?.fileName,
                type: match.metadata?.type,
                contentPreview: getContentPreview(match.metadata?.content)
            });
        });

        if (queryResponse.matches?.length > 0) {
            const sources = queryResponse.matches
                .filter((match: PineconeMatch) => 
                    match.metadata?.fileName && 
                    match.metadata?.content && 
                    typeof match.metadata.content === 'string' &&
                    match.metadata.content.trim() !== ''
                )
                .map((match: PineconeMatch) => ({
                    id: match.id,
                    name: match.metadata?.fileName as string,
                    type: match.metadata?.fileType || 'unknown',
                    url: match.metadata?.fileUrl || '',
                    content: match.metadata?.content || 'No content available'
                }));

            console.log('Sources processed successfully, count:', sources.length);
            if (sources.length === 0) {
                console.log('Warning: Found matches but no valid sources after filtering');
            }
            return NextResponse.json(sources)
        } else {
            console.log('No sources found in Pinecone.');
            return NextResponse.json([])
        }
    } catch (error) {
        // Enhanced error logging
        console.error('Detailed error in fetching sources:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            env: {
                hasOpenAI: !!process.env.OPENAI_API_KEY,
                hasPineconeKey: !!process.env.PINECONE_API_KEY,
                hasPineconeIndex: !!process.env.PINECONE_INDEX,
                pineconeIndex: process.env.PINECONE_INDEX
            }
        });

        return NextResponse.json({ 
            error: 'Failed to fetch sources',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
    }
}
