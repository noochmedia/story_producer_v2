import { Pinecone } from "@pinecone-database/pinecone";

export class PineconeAssistant {
  private pinecone: Pinecone;
  private indexName: string;
  private host: string;
  private apiKey: string;

  constructor({ apiKey, indexName, host }: { apiKey: string; indexName: string; host: string }) {
    this.pinecone = new Pinecone({ apiKey });
    this.indexName = indexName;
    this.host = host;
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  }

  async uploadDocument(content: string, metadata: Record<string, any>, embedding?: number[]) {
    try {
      // If no embedding provided, generate one
      const vectorEmbedding = embedding || await this.generateEmbedding(content);
      const index = this.pinecone.index(this.indexName);

      // Generate a unique ID that includes the file name for better traceability
      const id = `${metadata.fileName || 'doc'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      await index.upsert([{
        id,
        values: vectorEmbedding,
        metadata: {
          content,
          ...metadata,
          timestamp: new Date().toISOString() // Add timestamp for sorting
        }
      }]);

      console.log(`[PINECONE] Uploaded document ${id} with metadata:`, {
        fileName: metadata.fileName,
        type: metadata.type,
        hasBlob: metadata.hasBlob
      });

      return { success: true, id };
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  async deleteDocument(type: string) {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.deleteMany({
        filter: { type }
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, filter?: Record<string, any>, topK: number = 5) {
    try {
      console.log('[PINECONE] Searching with query:', query);
      console.log('[PINECONE] Filter:', filter);

      const embedding = await this.generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);
      
      const results = await index.query({
        vector: embedding,
        filter,
        includeMetadata: true,
        topK
      });

      console.log(`[PINECONE] Found ${results.matches.length} matches`);
      console.log('[PINECONE] First match score:', results.matches[0]?.score);

      return results;
    } catch (error) {
      console.error('Error searching similar documents:', error);
      throw error;
    }
  }
}

export default PineconeAssistant;
