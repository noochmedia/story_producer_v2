import { NextRequest, NextResponse } from 'next/server';
import { DocumentStore } from '../../../lib/document-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Source {
  id: string;
  name: string;
  type: string;
  url?: string;
  uploadedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get document store instance
    const store = DocumentStore.getInstance();

    // Get all source documents
    const documents = store.getDocuments({ type: 'source' });

    // Map documents to source format
    const sources: Source[] = documents.map(doc => ({
      id: doc.id,
      name: doc.metadata.fileName,
      type: doc.metadata.fileType,
      url: doc.metadata.fileUrl,
      uploadedAt: doc.metadata.uploadedAt
    }));

    // Sort by upload date
    sources.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    console.log('Sources retrieved successfully, count:', sources.length);
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch sources',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
