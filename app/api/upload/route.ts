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

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

async function processFile(file: File): Promise<ProcessedFile> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File ${file.name} exceeds maximum size of 100MB`);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Extract text based on file type
  let text = '';
  const fileName = file.name.toLowerCase();
  
  console.log(`[Process] Processing file ${fileName} (${file.size} bytes)`);
  
  try {
    if (fileName.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (fileName.endsWith('.pdf')) {
      // Handle PDF extraction
      text = buffer.toString('utf-8'); // Replace with proper PDF extraction
    } else if (fileName.endsWith('.docx')) {
      // Handle DOCX extraction
      text = buffer.toString('utf-8'); // Replace with proper DOCX extraction
    } else {
      throw new Error(`Unsupported file type: ${fileName}`);
    }

    if (!text.trim()) {
      throw new Error(`No content extracted from ${fileName}`);
    }

    // Only upload to Blob if text extraction was successful
    console.log(`[Blob] Attempting to upload ${fileName} to Vercel Blob...`);
    try {
      const blob = await put(fileName, file, {
        access: 'public',
        contentType: file.type || undefined,
        addRandomSuffix: true, // Prevent naming conflicts
      });
      console.log(`[Blob] Successfully uploaded ${fileName} to Vercel Blob:`, blob);
      return { text, name: fileName, blob };
    } catch (error) {
      console.error(`[Blob] Failed to upload ${fileName} to Vercel Blob:`, error);
      // If Blob upload fails but we have text content, continue with processing
      if (text.trim()) {
        console.log(`[Process] Continuing with text content only for ${fileName}`);
        return { text, name: fileName };
      }
      throw error;
    }
  } catch (error) {
    console.error(`[Process] Error processing file ${fileName}:`, error);
    throw error;
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
        const { text, name, blob } = await processFile(file);
        
        if (!text.trim()) {
          throw new Error(`No content extracted from ${name}`);
        }

        const embeddingResults = await generateEmbedding(text);
        console.log(`Generated embeddings for ${embeddingResults.length} chunks`);

        const timestamp = Date.now();
        const chunks = embeddingResults.map((result, i) => {
          // Extract raw embedding and validate
          const rawEmbedding = result.embedding;
          console.log(`Raw embedding for chunk ${i}:`, {
            type: typeof rawEmbedding,
            isArray: Array.isArray(rawEmbedding),
            length: rawEmbedding.length,
            sample: rawEmbedding.slice(0, 3)
          });

          // Convert to array of numbers
          const values = Array.from(rawEmbedding).map(val => {
            const num = Number(val);
            if (isNaN(num)) {
              throw new Error(`Invalid vector value in chunk ${i}`);
            }
            return num;
          });

          // Validate dimensions for multilingual-e5-large
          if (values.length !== 1024) {
            console.error('Invalid vector structure:', {
              index: i,
              type: typeof values,
              isArray: Array.isArray(values),
              length: values.length,
              sample: values.slice(0, 3)
            });
            throw new Error(`Invalid vector dimensions: expected 1024, got ${values.length}`);
          }

          // Log the vector details before storage
          console.log(`Vector for chunk ${i}:`, {
            type: typeof values,
            isArray: Array.isArray(values),
            length: values.length,
            sample: values.slice(0, 3),
            allNumbers: values.every(v => typeof v === 'number' && !isNaN(v)),
            sampleJson: JSON.stringify(values.slice(0, 3))
          });

          return {
            id: `source_${timestamp}_${name}_chunk${i}`,
            values,
            metadata: {
              fileName: name,
              content: result.chunk,
              processedContent: result.chunk,
              type: 'source',
              uploadedAt: new Date().toISOString(),
              chunkIndex: i,
              totalChunks: embeddingResults.length,
              chunkLength: result.chunk.length,
              ...(blob && {
                fileUrl: blob.url,
                filePath: blob.pathname,
                fileType: file.type || undefined,
                hasBlob: true
              }),
              storageVersion: 'dual_storage_v1'
            }
          };
        });

        // Batch upload with validation
        const BATCH_SIZE = 100;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          
          // Validate each vector in the batch
          batch.forEach((chunk, idx) => {
            if (!Array.isArray(chunk.values) || 
                chunk.values.length !== 1024 ||
                !chunk.values.every(v => typeof v === 'number' && !isNaN(v))) {
              console.error('Invalid vector structure:', {
                index: idx,
                type: typeof chunk.values,
                isArray: Array.isArray(chunk.values),
                length: chunk.values?.length,
                sample: chunk.values.slice(0, 3)
              });
              throw new Error(`Invalid vector in batch at index ${idx}`);
            }
          });

          try {
            await index.upsert(batch);
            console.log(`[Pinecone] Successfully stored batch ${i/BATCH_SIZE + 1}, chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);
          } catch (error) {
            console.error('[Pinecone] Upsert error:', {
              error,
              batchSize: batch.length,
              sampleVector: batch[0]?.values.slice(0, 3)
            });
            throw error;
          }
        }

        return { success: true, fileName: name };
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        return { 
          success: false, 
          fileName: file.name, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }));

    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Prepare response message
    let message = `${successful.length} file${successful.length === 1 ? '' : 's'} uploaded successfully.`;
    if (failed.length > 0) {
      message += ` ${failed.length} file${failed.length === 1 ? '' : 's'} failed.`;
    }

    return NextResponse.json({ 
      message,
      results,
      successful: successful.length,
      failed: failed.length
    });
  } catch (error) {
    console.error('Error in file upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
