import { NextRequest, NextResponse } from 'next/server';
import { DocumentStore, Document } from '../../../../lib/document-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Get and validate ID
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      console.error('[VIEW] Missing ID parameter');
      return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
    }

    // Get document store instance
    console.log('[VIEW] Getting document store instance...');
    const store = await DocumentStore.getInstance();
    if (!store) {
      console.error('[VIEW] Failed to get document store instance');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Get all documents and find the one with matching ID
    console.log('[VIEW] Fetching documents...');
    const documents = await store.getDocuments();
    console.log('[VIEW] Documents fetched:', {
      total: documents.length,
      hasContent: documents.every(doc => !!doc.content),
      ids: documents.map(doc => doc.id)
    });

    console.log('[VIEW] Looking for document with ID:', id);
    const document = documents.find((doc) => doc.id === id);

    if (!document) {
      console.log('[VIEW] Document not found');
      return NextResponse.json({ 
        error: 'Source not found',
        availableIds: documents.map(doc => doc.id)
      }, { status: 404 });
    }

    if (!document.content) {
      console.error('[VIEW] Document found but has no content:', document.id);
      return NextResponse.json({ error: 'Document content missing' }, { status: 500 });
    }

    console.log('[VIEW] Document found:', {
      id: document.id,
      contentLength: document.content.length,
      metadata: document.metadata
    });

    return NextResponse.json({ 
      content: document.content,
      metadata: document.metadata
    });
  } catch (error) {
    console.error('[VIEW] Error fetching content:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
