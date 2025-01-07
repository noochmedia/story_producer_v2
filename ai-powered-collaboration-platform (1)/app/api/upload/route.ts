import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { processDocument, generateEmbedding, storeEmbedding } from '@/lib/document-processing'

export async function POST(request: NextRequest) {
  const data = await request.formData()
  const file: File | null = data.get('file') as unknown as File

  if (!file) {
    return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save the file
  const fileName = file.name
  const filePath = path.join(process.cwd(), 'uploads', fileName)
  await writeFile(filePath, buffer)

  try {
    // Process the document
    const processedContent = await processDocument(filePath)

    // Generate embedding
    const embedding = generateEmbedding(processedContent)

    // Store embedding (assuming we have a user ID and project ID)
    const userId = 'user123' // This should come from your authentication system
    const projectId = 'project456' // This should be determined based on the current project
    await storeEmbedding(userId, projectId, fileName, embedding)

    return NextResponse.json({ success: true, message: 'File uploaded and processed successfully' })
  } catch (error) {
    console.error('Error processing file:', error)
    return NextResponse.json({ success: false, message: 'Error processing file' }, { status: 500 })
  }
}

