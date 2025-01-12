import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class PineconeAssistant {
  private pinecone: Pinecone;
  private indexName: string;

  constructor({ apiKey, indexName, host }: { apiKey: string; indexName: string; host: string }) {
    this.pinecone = new Pinecone({ apiKey });
    this.indexName = indexName;
  }

  async generateEmbedding(text: string) {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  }

  async uploadDocument(content: string, metadata: Record<string, any>) {
    try {
      const embedding = await this.generateEmbedding(content);
      const index = this.pinecone.index(this.indexName);
      
      await index.upsert([{
        id: Date.now().toString(),
        values: embedding,
        metadata: {
          content,
          ...metadata
        }
      }]);

      return { success: true };
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

  async searchSimilar(query: string, filter?: Record<string, any>) {
    try {
      const embedding = await this.generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);
      
      const results = await index.query({
        vector: embedding,
        filter,
        includeMetadata: true,
        topK: 5
      });

      return results;
    } catch (error) {
      console.error('Error searching similar documents:', error);
      throw error;
    }
  }
}

export default PineconeAssistant;
