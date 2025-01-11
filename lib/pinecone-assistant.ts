import { Pinecone, ScoredPineconeRecord } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

interface AssistantOptions {
  apiKey: string;
  indexName: string;
  environment?: string;
}

interface DocumentMetadata {
  fileName: string;
  fileType: string;
  uploadedAt: string;
  type: 'source' | 'project_details';
  relevanceScore?: number;
  [key: string]: any;
}

interface QueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  rerank?: boolean;
}

interface QueryMatch extends ScoredPineconeRecord<DocumentMetadata> {}

export class PineconeAssistant {
  private pinecone: Pinecone;
  private index: any;
  private embeddingHost: string;
  private apiKey: string;
  private openai: OpenAI;

  constructor(options: AssistantOptions) {
    this.apiKey = options.apiKey;
    this.pinecone = new Pinecone({
      apiKey: this.apiKey
    });
    this.index = this.pinecone.index(options.indexName);
    this.embeddingHost = 'https://storytools-embedding-3-sj0uqym.svc.aped-4627-b74a.pinecone.io';
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate embeddings using Pinecone's hosted model
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.embeddingHost}/vectors/embed`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        inputs: texts,
        parameters: {
          input_type: 'passage',
          truncate: 'END'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Pinecone embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
  }

  /**
   * Split text into chunks with intelligent boundaries
   */
  private async splitIntoChunks(text: string): Promise<string[]> {
    // Use OpenAI to identify logical break points
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a text processing assistant. Analyze the text and return a JSON array of indices where logical breaks should occur, considering: paragraph boundaries, topic changes, and semantic completeness. Each chunk should be 300-500 words.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to get break points from OpenAI');
    }

    const breakPoints = JSON.parse(content).breakPoints as number[];
    const chunks: string[] = [];
    let lastIndex = 0;

    // Split text at the identified break points
    breakPoints.forEach(index => {
      const chunk = text.slice(lastIndex, index).trim();
      if (chunk) chunks.push(chunk);
      lastIndex = index;
    });

    // Add the final chunk
    const finalChunk = text.slice(lastIndex).trim();
    if (finalChunk) chunks.push(finalChunk);

    return chunks;
  }

  /**
   * Calculate relevance score for a chunk
   */
  private async calculateRelevanceScore(chunk: string): Promise<number> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a content relevance scorer. Rate the following text chunk on a scale of 0-1 based on: information density, uniqueness, and clarity. Return a JSON object with a score field.'
        },
        {
          role: 'user',
          content: chunk
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to get relevance score from OpenAI');
    }

    return JSON.parse(content).score;
  }

  /**
   * Process and upload a document
   */
  async uploadDocument(content: string, metadata: DocumentMetadata) {
    console.log(`[Assistant] Processing document: ${metadata.fileName}`);

    // Get index stats before upload
    const beforeStats = await this.index.describeIndexStats();
    console.log('[Assistant] Index stats before upload:', beforeStats);

    try {
      // Split content into chunks with intelligent boundaries
      const chunks = await this.splitIntoChunks(content);
      console.log(`[Assistant] Split into ${chunks.length} chunks`);

      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks);
      console.log(`[Assistant] Generated ${embeddings.length} embeddings`);

      // Calculate relevance scores for chunks
      const relevanceScores = await Promise.all(
        chunks.map(chunk => this.calculateRelevanceScore(chunk))
      );

      // Prepare vectors for upload
      const timestamp = Date.now();
      const vectors = chunks.map((chunk, i) => ({
        id: `${metadata.type}_${timestamp}_${metadata.fileName}_chunk${i}`,
        values: embeddings[i],
        metadata: {
          ...metadata,
          content: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          chunkLength: chunk.length,
          relevanceScore: relevanceScores[i],
          updatedAt: new Date().toISOString()
        }
      }));

      // Validate vectors
      vectors.forEach((vector, idx) => {
        if (!Array.isArray(vector.values) || 
            vector.values.length !== 1024 ||
            !vector.values.every(v => typeof v === 'number' && !isNaN(v))) {
          throw new Error(`Invalid vector at index ${idx}`);
        }
      });

      // Upload vectors in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        await this.index.upsert(batch);
        console.log(`[Assistant] Uploaded batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(vectors.length/BATCH_SIZE)}`);
      }

      // Get index stats after upload
      const afterStats = await this.index.describeIndexStats();
      console.log('[Assistant] Index stats after upload:', afterStats);

      return {
        success: true,
        chunks: chunks.length,
        vectors: vectors.length
      };
    } catch (error) {
      console.error('[Assistant] Error processing document:', error);
      throw error;
    }
  }

  /**
   * Generate multiple search queries for better retrieval
   */
  private async generateSearchQueries(query: string): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a search query generator. Generate 3 different versions of the input query to improve search coverage. Return a JSON object with a queries array.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to get search queries from OpenAI');
    }

    return JSON.parse(content).queries;
  }

  /**
   * Rerank search results based on relevance to query
   */
  private async rerankResults(query: string, matches: QueryMatch[]): Promise<QueryMatch[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a search result ranker. Rank the following chunks based on relevance to the query. Return a JSON object with a rankedIndices array.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            query,
            chunks: matches.map(match => match.metadata?.content)
          })
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Failed to get ranked indices from OpenAI');
    }

    const rankedIndices = JSON.parse(content).rankedIndices as number[];
    return rankedIndices.map(i => matches[i]);
  }

  /**
   * Query for relevant documents
   */
  async query(queryText: string, options: QueryOptions = {}) {
    console.log(`[Assistant] Processing query: ${queryText}`);

    // Get index stats before query
    const beforeStats = await this.index.describeIndexStats();
    console.log('[Assistant] Index stats before query:', beforeStats);

    try {
      // Generate multiple search queries
      const searchQueries = await this.generateSearchQueries(queryText);
      console.log('[Assistant] Generated search queries:', searchQueries);

      // Get embeddings for all queries
      const queryEmbeddings = await this.generateEmbeddings(searchQueries);

      // Perform multiple searches and combine results
      const allMatches: QueryMatch[] = [];
      const seenIds = new Set<string>();

      for (let i = 0; i < searchQueries.length; i++) {
        const queryResponse = await this.index.query({
          vector: queryEmbeddings[i],
          topK: options.topK || 10,
          includeMetadata: true,
          filter: options.filter
        });

        // Add unique matches
        queryResponse.matches.forEach((match: QueryMatch) => {
          if (!seenIds.has(match.id)) {
            seenIds.add(match.id);
            allMatches.push(match);
          }
        });
      }

      // Rerank results if requested
      const finalMatches = options.rerank 
        ? await this.rerankResults(queryText, allMatches)
        : allMatches;

      // Get index stats after query
      const afterStats = await this.index.describeIndexStats();
      console.log('[Assistant] Index stats after query:', afterStats);

      return finalMatches;
    } catch (error) {
      console.error('[Assistant] Error processing query:', error);
      throw error;
    }
  }

  /**
   * Delete documents by filter
   */
  async deleteDocuments(filter: Record<string, any>) {
    console.log('[Assistant] Deleting documents with filter:', filter);

    // Get index stats before deletion
    const beforeStats = await this.index.describeIndexStats();
    console.log('[Assistant] Index stats before deletion:', beforeStats);

    try {
      // First query to get all matching document IDs
      const queryResponse = await this.index.query({
        vector: new Array(1024).fill(0),
        topK: 10000,
        includeMetadata: true,
        filter
      });

      if (queryResponse.matches.length > 0) {
        // Delete in batches
        const BATCH_SIZE = 100;
        const ids = queryResponse.matches.map((match: QueryMatch) => match.id);

        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE);
          await this.index.deleteMany(batch);
          console.log(`[Assistant] Deleted batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(ids.length/BATCH_SIZE)}`);
        }
      }

      // Get index stats after deletion
      const afterStats = await this.index.describeIndexStats();
      console.log('[Assistant] Index stats after deletion:', afterStats);

      return {
        success: true,
        deleted: queryResponse.matches.length
      };
    } catch (error) {
      console.error('[Assistant] Error deleting documents:', error);
      throw error;
    }
  }
}
