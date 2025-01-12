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
    // Extract environment from host URL (e.g., "storytools-embedding-3-sj0uqym.svc.aped-4627-b74a.pinecone.io")
    const environment = this.host.split('.')[0].split('-').slice(-1)[0];
    
    const response = await fetch(`https://embed-${environment}.us-east-1.aws.pinecone.io/embed`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'multilingual-e5-large',
        inputs: [text],
        parameters: {
          input_type: 'passage',
          truncate: 'END'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinecone API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Pinecone embedding API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings[0];
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
