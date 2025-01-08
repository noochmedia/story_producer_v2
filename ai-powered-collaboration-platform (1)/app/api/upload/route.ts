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
    const fileType = file.type.startsWith('video/') ? 'video' :
                     file.type.startsWith('audio/') ? 'audio' : 'document'

    // Store embedding in Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })

    const index = pinecone.index(process.env.PINECONE_INDEX!)

    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    await index.upsert([{
      id,
      values: embedding,
      metadata: {
        id,
        fileName: file.name,
        fileType,
        fileUrl: blob.url,
        uploadDate: new Date().toISOString(),
        type: 'source',  // Add this to distinguish sources from other data
        content: processedContent  // Store the processed content for AI access
      }
    }])

    return NextResponse.json({ success: true, message: 'File uploaded and processed successfully', fileUrl: blob.url })
  } catch (error) {
    console.error('Error processing file:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing file', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

