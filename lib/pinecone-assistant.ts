
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { DocumentMetadata } from './types';
import { generateEmbedding, processDocument } from './document-processing';

interface PineconeAssistantOptions {
  apiKey: string;
  indexName: string;
  host: string;
}

export class PineconeAssistant {
  private apiKey: string;
  private indexName: string;
  private host: string;
  private pinecone: Pinecone;
  private openai: OpenAI;

  constructor(options: PineconeAssistantOptions) {
    this.apiKey = options.apiKey;
    this.indexName = options.indexName;
    this.host = options.host;

    this.pinecone = new Pinecone({
      apiKey: this.apiKey,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async uploadDocument(text: string, metadata: DocumentMetadata) {
    console.log(`[Upload] Processing document: ${metadata.fileName}`);
    
    try {
      const index = this.pinecone.index(this.indexName);
      const namespace = metadata.namespace || 'default-namespace'; // Add namespace handling
      
      const processedText = await processDocument(text);
      const embeddingResults = await generateEmbedding(processedText);
      
      const vectors = embeddingResults.map((result, i) => ({
        id: `${metadata.fileName}-${i}`,
        values: result.embedding,
        metadata: {
          ...metadata,
          content: result.chunk,
          chunkIndex: i,
          totalChunks: embeddingResults.length,
        },
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        await index.upsert({
          vectors: batch,
          namespace, // Add namespace here
        });
      }

      console.log(`[Upload] Successfully processed document: ${metadata.fileName}`);
      return {
        fileName: metadata.fileName,
        chunks: embeddingResults.length,
      };
    } catch (error) {
      console.error(`[Upload] Error processing document ${metadata.fileName}:`, error);
      throw error;
    }
  }

  async searchSimilar(query: string, filter?: Record<string, any>) {
    try {
      const index = this.pinecone.index(this.indexName);
      const namespace = 'default-namespace'; // Add namespace for queries
      
      const queryEmbedding = await generateEmbedding(query);
      if (!queryEmbedding.length) {
        throw new Error('Failed to generate query embedding');
      }
      
      const results = await index.query({
        vector: queryEmbedding[0].embedding,
        filter: filter,
        includeMetadata: true,
        topK: 5,
        namespace, // Add namespace here
      });
      
      return results;
    } catch (error) {
      console.error('[Search] Error searching similar documents:', error);
      throw error;
    }
  }
}
