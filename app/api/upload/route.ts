
import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { put } from '@vercel/blob'
import { processDocument, generateEmbedding } from '@/lib/document-processing'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 })
    }

    // Upload file to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    })

    // Read file content
    const fileContent = await file.text()

    // Process the document
    const processedContent = await processDocument(fileContent)

    // Generate embedding
    const embedding = await generateEmbedding(processedContent)

    // Determine file type
    const fileType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'text'

    // Index metadata in Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const upsertResponse = await index.upsert([{
      id: `source_${Date.now()}`, // Unique ID for the source
      values: embedding,
      metadata: {
        fileName: file.name,
        fileType,
        fileUrl: blob.url,
        type: 'source'
      }
    }])

    if (upsertResponse.upserts?.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'File uploaded and processed successfully',
        fileUrl: blob.url,
      })
    } else {
      throw new Error('Failed to index file metadata in Pinecone.')
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ success: false, message: 'File upload failed' }, { status: 500 })
  }
}
