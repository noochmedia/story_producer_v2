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
    };
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
        const pinecone = new Pinecone();
        console.log('Pinecone client initialized');

        const index = pinecone.index(process.env.PINECONE_INDEX);
        console.log('Pinecone index accessed:', process.env.PINECONE_INDEX);

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

        if (queryResponse.matches?.length > 0) {
            const sources = queryResponse.matches
                .filter((match: PineconeMatch) => match.metadata?.fileName)
                .map((match: PineconeMatch) => ({
                    id: match.id,
                    name: match.metadata?.fileName as string,
                    type: match.metadata?.fileType || 'unknown',
                    url: match.metadata?.fileUrl || '',
                    content: match.metadata?.content || 'No content available'
                }));

            console.log('Sources processed successfully, count:', sources.length);
            return NextResponse.json({ sources })
        } else {
            console.log('No sources found in Pinecone.');
            return NextResponse.json({ sources: [] })
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
