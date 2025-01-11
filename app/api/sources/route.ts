import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface BlobSource {
    url: string;
    pathname: string;
    contentType?: string;
    uploadedAt?: string;
}

export async function GET(request: NextRequest) {
    try {
        console.log('Listing files from Vercel Blob...');
        const { blobs } = await list();
        console.log('Found blobs:', blobs.length);

        // Map blobs to source format
        const sources = blobs.map((blob) => ({
            id: blob.pathname, // Use pathname as unique identifier
            name: blob.pathname.split('/').pop() || blob.pathname, // Extract filename from path
            type: blob.downloadUrl.split('.').pop() || 'unknown', // Get type from file extension
            url: blob.downloadUrl,
            uploadedAt: new Date(blob.uploadedAt).toISOString()
        }));

        console.log('Sources processed successfully, count:', sources.length);
        return NextResponse.json(sources)
    } catch (error) {
        console.error('Error fetching sources from Blob:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch sources',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
