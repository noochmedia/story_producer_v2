import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'
import { put } from '@vercel/blob'
import { Buffer } from 'buffer'

// Type definitions
interface ProcessedFile {
  text: string;
  name: string;
  blob?: {
    url: string;
    pathname: string;
  };
}

interface UploadResult {
  success: boolean;
  fileName: string;
  error?: string;
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function processFile(file: File): Promise<ProcessedFile> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Extract text based on file type
  let text = ''
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.txt')) {
    text = buffer.toString('utf-8')
  } else if (fileName.endsWith('.pdf')) {
    // Handle PDF extraction
    text = buffer.toString('utf-8') // Replace with proper PDF extraction
  } else if (fileName.endsWith('.docx')) {
    // Handle DOCX extraction
    text = buffer.toString('utf-8') // Replace with proper DOCX extraction
  }

  // Upload to Vercel Blob
  console.log(`[Blob] Attempting to upload ${file.name} to Vercel Blob...`)
  try {
    const blob = await put(file.name, file, {
      access: 'public',
    })
    console.log(`[Blob] Successfully uploaded ${file.name} to Vercel Blob:`, blob)
    return { text, name: file.name, blob }
  } catch (error) {
    console.error(`[Blob] Failed to upload ${file.name} to Vercel Blob:`, error)
    // Continue with just the text content if Blob upload fails
    return { text, name: file.name }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX environment variable is not set');
    }

    // Get form data
    const formData = await request.formData()
    const entries = Array.from(formData.entries()) as [string, File | string][];
    console.log('FormData entries:', entries.map(([key, value]) => ({
      key,
      type: value instanceof File ? 'File' : typeof value,
      fileName: value instanceof File ? value.name : null
    })));

    // Handle both single file and multiple files
    const singleFile = formData.get('file')
    const multipleFiles = formData.getAll('files')
    
    // Ensure we only process File objects
    const files = (singleFile instanceof File ? [singleFile] : 
                  multipleFiles.filter((f): f is File => f instanceof File))

    console.log('Files array length:', files.length);
    console.log('Files details:', files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size
    })));

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);

    // Process each file
    const results: UploadResult[] = await Promise.all(files.map(async (file: File) => {
      try {
        // Extract text from file
        const { text, name, blob } = await processFile(file)
        
        if (!text.trim()) {
          throw new Error(`No content extracted from ${name}`)
        }

        // Generate embeddings for chunks
        const embeddingResults = await generateEmbedding(text)
        console.log(`Generated embeddings for ${embeddingResults.length} chunks`)

        // Store each chunk in Pinecone
        const timestamp = Date.now()
        for (let i = 0; i < embeddingResults.length; i++) {
          const result = embeddingResults[i];
          const metadata: any = {
            fileName: name,
            content: result.chunk,
            type: 'source',
            uploadedAt: new Date().toISOString(),
            chunkIndex: i,
            totalChunks: embeddingResults.length
          }
          
          // Add Blob URL to metadata if available
          if (blob) {
            metadata.fileUrl = blob.url
            console.log(`[Pinecone] Including Blob URL in metadata for chunk ${i + 1}/${embeddingResults.length}`)
          } else {
            console.log(`[Pinecone] No Blob URL available for chunk ${i + 1}/${embeddingResults.length}`)
          }

          // Store chunk in Pinecone
          await index.upsert([{
            id: `source_${timestamp}_${name}_chunk${i}`,
            values: result.embedding,
            metadata
          }]);
          
          console.log(`[Pinecone] Stored chunk ${i + 1}/${embeddingResults.length}`);
        }

        return { success: true, fileName: name }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        return { 
          success: false, 
          fileName: file.name, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }))

    // Count successes and failures
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    // Prepare response message
    let message = `${successful.length} file${successful.length === 1 ? '' : 's'} uploaded successfully.`
    if (failed.length > 0) {
      message += ` ${failed.length} file${failed.length === 1 ? '' : 's'} failed.`
    }

    return NextResponse.json({ 
      message,
      results,
      successful: successful.length,
      failed: failed.length
    })
  } catch (error) {
    console.error('Error in file upload:', error)
    return NextResponse.json({ 
      error: 'Failed to process files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
