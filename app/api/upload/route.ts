import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function processFile(file: File): Promise<{ text: string; name: string }> {
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

  return { text, name: file.name }
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables with detailed logging
    const requiredEnvVars = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_INDEX: process.env.PINECONE_INDEX
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
      return NextResponse.json({ 
        error: 'Configuration error',
        details: `Missing environment variables: ${missingVars.join(', ')}`,
        debug: {
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV
        }
      }, { status: 500 });
    }

    // Get form data
    const formData = await request.formData()
    const files = [formData.get('file')] as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    console.log('Processing files:', files.map(f => f.name));

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });

    const index = pinecone.index(process.env.PINECONE_INDEX);

    // Process each file
    const results = await Promise.all(files.map(async (file) => {
      try {
        // Extract text from file
        const { text, name } = await processFile(file)
        
        if (!text.trim()) {
          throw new Error(`No content extracted from ${name}`)
        }

        // Generate embedding
        const embedding = await generateEmbedding(text)

        // Store in Pinecone
        await index.upsert([{
          id: `source_${Date.now()}_${name}`,
          values: embedding,
          metadata: {
            fileName: name,
            content: text,
            type: 'source',
            uploadedAt: new Date().toISOString()
          }
        }])

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
    let message = `${successful.length} file(s) uploaded successfully.`
    if (failed.length > 0) {
      message += ` ${failed.length} file(s) failed.`
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
