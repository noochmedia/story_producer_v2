import { NextRequest, NextResponse } from 'next/server';
import { PineconeAssistant } from '@/lib/pinecone-assistant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY!,
      indexName: process.env.PINECONE_INDEX!,
      host: process.env.PINECONE_HOST!
    });

    // Search for project details
    const results = await assistant.searchSimilar('', {
      type: 'project_details'
    });

    // Sort matches by timestamp if available
    const sortedMatches = results.matches.sort((a, b) => {
      const aTime = String(a.metadata?.timestamp || '');
      const bTime = String(b.metadata?.timestamp || '');
      return bTime.localeCompare(aTime);
    });

    // Extract content from chunks
    const chunks = sortedMatches.map(match => {
      const content = match.metadata?.content || '';
      return content;
    });

    return NextResponse.json({ content: chunks.join('\n\n') });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { content } = data;

    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    // Initialize Pinecone Assistant
    const assistant = new PineconeAssistant({
      apiKey: process.env.PINECONE_API_KEY!,
      indexName: process.env.PINECONE_INDEX!,
      host: process.env.PINECONE_HOST!
    });

    // Delete existing project details
    await assistant.deleteDocument('project_details');

    // Upload new project details
    const result = await assistant.uploadDocument(content, {
      fileName: 'project_details',
      fileType: 'text/plain',
      type: 'project_details',
      uploadedAt: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating project details:', error);
    return NextResponse.json({ error: 'Failed to update project details' }, { status: 500 });
  }
}
