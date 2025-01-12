import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { Buffer } from 'buffer';
import { DocumentStore } from '../../../lib/document-store';

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 50;

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Upload to Blob for file viewing
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

    // Get form data
    const formData = await request.formData();
    const entries = Array.from(formData.entries()) as [string, File | string][];
    console.log('FormData entries:', entries.map(([key, value]) => ({
      key,
      type: value instanceof File ? 'File' : typeof value,
      fileName: value instanceof File ? value.name : null
    })));

    // Handle both single file and multiple files
    const singleFile = formData.get('file');
    const multipleFiles = formData.getAll('files');
    
    // Ensure we only process File objects
    const files = (singleFile instanceof File ? [singleFile] : 
                  multipleFiles.filter((f): f is File => f instanceof File));

    // Validate file count
    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    console.log('Files array length:', files.length);
    console.log('Files details:', files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size
    })));

    // Get document store instance
    const store = await DocumentStore.getInstance();

    // Process each file
    const results: UploadResult[] = await Promise.all(files.map(async (file: File) => {
      try {
        const { text, name, blob } = await processFile(file);
        
        if (!text.trim()) {
          throw new Error(`No content extracted from ${name}`);
        }

        // Add document to store with blob URL if available
        const document = await store.addDocument(text, {
          fileName: name,
          fileType: file.type || 'text/plain',
          type: 'source',
          uploadedAt: new Date().toISOString(),
          ...(blob && {
            fileUrl: blob.url,
            filePath: blob.pathname,
            hasBlob: true
          })
        });

        // Verify the document was added
        const verifyResults = await store.searchSimilar(text, { type: 'source' }, 1);
        console.log('Verification results:', {
          found: verifyResults.length > 0,
          firstMatch: verifyResults[0] ? {
            id: verifyResults[0].id,
            fileName: verifyResults[0].metadata.fileName
          } : 'No matches'
        });

        // Export documents to persist them
        const exportData = store.exportDocuments();
        const allDocs = await store.getDocuments();
        console.log('Documents exported:', {
          dataLength: exportData.length,
          documentCount: allDocs.length
        });

        console.log(`Successfully processed ${name}:`, document);
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
