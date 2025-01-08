
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { put } from '@vercel/blob'
import { processDocument, generateEmbedding } from '@/lib/document-processing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("[UPLOAD] Starting file upload process");

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error("[UPLOAD] No file uploaded");
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    // Upload file to Vercel Blob
    console.log("[UPLOAD] Uploading file to Vercel Blob:", file.name);
    const blob = await put(file.name, file, {
      access: 'public',
    });
    console.log("[UPLOAD] File uploaded to Vercel Blob:", blob.url);

    // Read file content
    const fileContent = await file.text();
    console.log("[UPLOAD] File content read successfully");

    // Process the document
    const processedContent = await processDocument(fileContent);
    console.log("[UPLOAD] Document processed successfully");

    // Generate embedding
    const embedding = await generateEmbedding(processedContent);
    console.log("[UPLOAD] Embedding generated successfully:", embedding);

    // Determine file type
    const fileType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'text';

    // Index metadata in Pinecone with namespace
    console.log("[UPLOAD] Attempting to upsert metadata in Pinecone with namespace 'sources':", {
      id: `source_${Date.now()}`,
      values: embedding,
      metadata: {
        fileName: file.name,
        fileType,
        fileUrl: blob.url,
        type: 'source',
      },
    });

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.index(process.env.PINECONE_INDEX!);

    const upsertResponse = await index.upsert(
      [
        {
          id: `source_${Date.now()}`, // Unique ID for the source
          values: embedding,
          metadata: {
            fileName: file.name,
            fileType,
            fileUrl: blob.url,
            type: 'source',
          },
        },
      ],
      { namespace: 'sources' } // Added namespace here
    );

    console.log("[UPLOAD] Pinecone upsert response:", upsertResponse);

    if (!upsertResponse.upserts?.length) {
      console.error("[UPLOAD] Pinecone upsert failed. Response:", upsertResponse);
      throw new Error("Failed to index file metadata in Pinecone.");
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded and processed successfully',
      fileUrl: blob.url,
    });
  } catch (error) {
    console.error("[UPLOAD] Error during file upload process:", error);
    return NextResponse.json({ success: false, message: 'File upload failed' }, { status: 500 });
  }
}
