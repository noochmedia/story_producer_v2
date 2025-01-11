import { Pinecone, ScoredPineconeRecord, RecordMetadata } from '@pinecone-database/pinecone';
import { PineconeAssistant } from '../lib/pinecone-assistant';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Define metadata types that match Pinecone's expectations
type RecordMetadataValue = string | number | boolean | string[];

interface BaseMetadata extends RecordMetadata {
  [key: string]: RecordMetadataValue;
}

interface OldSourceMetadata extends BaseMetadata {
  fileName: string;
  fileType: string;
  type: string;
  content: string;
  chunkIndex: string; // Store numbers as strings to match RecordMetadataValue
  fileUrl: string;
  filePath: string;
  hasBlob: string;
  totalChunks: string;
  chunkLength: string;
  uploadedAt: string;
}

async function migratePineconeData() {
  // Validate environment variables
  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.PINECONE_HOST;
  
  if (!apiKey || !host) {
    throw new Error('Missing required environment variables');
  }

  console.log('Starting Pinecone data migration...');

  // Initialize old index client
  const oldPinecone = new Pinecone({
    apiKey
  });
  const oldIndex = oldPinecone.index('story-tools-embedding2-sj0uqym');

  // Initialize new PineconeAssistant
  const assistant = new PineconeAssistant({
    apiKey,
    indexName: 'storytools-embedding-3-sj0uqym',
    host
  });

  try {
    // Get all records from old index
    console.log('Fetching records from old index...');
    const queryResponse = await oldIndex.query({
      vector: Array(1536).fill(0), // Old index uses 1536 dimensions
      topK: 10000,
      includeMetadata: true
    });

    // Group records by source file
    const sourceGroups = new Map<string, ScoredPineconeRecord<OldSourceMetadata>[]>();
    
    // Type assertion since we know the structure of our old records
    const matches = queryResponse.matches as ScoredPineconeRecord<OldSourceMetadata>[];
    
    matches.forEach(match => {
      if (match.metadata?.fileName) {
        const fileName = match.metadata.fileName;
        if (!sourceGroups.has(fileName)) {
          sourceGroups.set(fileName, []);
        }
        const group = sourceGroups.get(fileName);
        if (group) {
          group.push(match);
        }
      }
    });

    console.log(`Found ${sourceGroups.size} unique source files`);

    // Process each source file
    for (const [fileName, matches] of sourceGroups) {
      console.log(`Processing ${fileName}...`);

      // Sort chunks by index
      const sortedMatches = matches.sort((a, b) => {
        const indexA = parseInt(a.metadata?.chunkIndex || '0', 10);
        const indexB = parseInt(b.metadata?.chunkIndex || '0', 10);
        return indexA - indexB;
      });

      // Combine chunks back into full text
      const fullText = sortedMatches
        .map(match => match.metadata?.content || '')
        .join('\n\n');

      // Get metadata from first chunk
      const firstChunk = sortedMatches[0].metadata;
      if (!firstChunk) {
        console.warn(`Skipping ${fileName}: No metadata found`);
        continue;
      }

      const metadata = {
        fileName,
        fileType: firstChunk.fileType || 'text/plain',
        type: (firstChunk.type === 'project_details' ? 'project_details' : 'source') as 'source' | 'project_details',
        uploadedAt: new Date().toISOString(),
        ...(firstChunk.fileUrl && {
          fileUrl: firstChunk.fileUrl,
          filePath: firstChunk.filePath || '',
          hasBlob: 'true'
        })
      };

      // Upload to new index
      try {
        const result = await assistant.uploadDocument(fullText, metadata);
        console.log(`Successfully migrated ${fileName}:`, result);
      } catch (error) {
        console.error(`Failed to migrate ${fileName}:`, error);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration
migratePineconeData().catch(console.error);
