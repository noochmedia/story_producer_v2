import { NextRequest, NextResponse } from 'next/server';
import { DocumentStore } from '../../../../lib/document-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
    }

    // Get document store instance
    const store = DocumentStore.getInstance();

    // Get all documents and find the one with matching ID
    const documents = store.getDocuments();
    const document = documents.find(doc => doc.id === id);

    if (!document) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    return NextResponse.json({ content: document.content });
  } catch (error) {
    console.error('[VIEW] Error fetching content:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
