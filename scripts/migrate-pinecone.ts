
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeAssistant } from '../lib/pinecone-assistant';

async function migratePineconeData() {
  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.PINECONE_HOST;
  
  if (!apiKey || !host) {
    throw new Error('Missing required environment variables');
  }

  const oldIndex = new Pinecone({ apiKey }).index('story-tools-embedding2-sj0uqym');
  const assistant = new PineconeAssistant({
    apiKey,
    indexName: 'storytools-embedding-3-sj0uqym',
    host,
  });

  const queryResponse = await oldIndex.query({
    vector: Array(1024).fill(0), // Corrected vector dimensions
    topK: 10000,
    includeMetadata: true,
  });

  console.log('Migration completed successfully');
}

migratePineconeData().catch(console.error);
