import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { put } from '@vercel/blob'
import { processDocument, generateEmbedding } from '../../../lib/document-processing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    console.log('Starting file upload process...');
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 })
    }

    console.log('Uploading file to Vercel Blob:', file.name);
    // Upload file to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    })
    console.log('File uploaded to Vercel Blob:', blob.url);

    // Read file content
    console.log('Reading file content...');
    const fileContent = await file.text()
    console.log('File content length:', fileContent.length);

    // Process the document
    console.log('Processing document...');
    const processedContent = await processDocument(fileContent)
    console.log('Document processed, length:', processedContent.length);

    // Generate embedding
    console.log('Generating embedding...');
    const embedding = await generateEmbedding(processedContent)
    console.log('Embedding generated, length:', embedding.length);

    // Validate embedding dimensions
    const expectedDimension = 1536; // Updated to match text-embedding-ada-002 dimensions
    if (embedding.length !== expectedDimension) {
      console.error(`Dimension mismatch: got ${embedding.length}, expected ${expectedDimension}`);
      throw new Error(`Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`)
    }

    // Determine file type
    const fileType = file.type.startsWith('video/') ? 'video' :
                     file.type.startsWith('audio/') ? 'audio' : 'document'
    console.log('File type determined:', fileType);

    // Initialize Pinecone client
    console.log('Initializing Pinecone client...');
    const pinecone = new Pinecone()
    console.log('Pinecone client initialized');

    const index = pinecone.index(process.env.PINECONE_INDEX!)
    console.log('Pinecone index accessed:', process.env.PINECONE_INDEX);

    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const metadata = {
      id,
      fileName: file.name,
      fileType,
      fileUrl: blob.url,
      uploadDate: new Date().toISOString(),
      type: 'source',  // Ensure this key is always present
      content: processedContent  // Store the processed content for AI access
    }

    // Log metadata for debugging purposes
    console.log('Preparing to store metadata:', {
      id: metadata.id,
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      contentLength: metadata.content.length
    });

    console.log('Upserting to Pinecone...');
    await index.upsert([{
      id,
      values: embedding,
      metadata
    }])
    console.log('Successfully upserted to Pinecone');

    return NextResponse.json({ 
      success: true, 
      message: 'File uploaded and processed successfully', 
      fileUrl: blob.url 
    })
  } catch (error) {
    // Enhanced error logging
    console.error('Detailed error in file upload:', {
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
      success: false, 
      message: 'Error processing file', 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
