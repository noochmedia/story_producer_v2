import OpenAI from 'openai';

export class VercelEmbeddings {
  private static instance: VercelEmbeddings;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  static async getInstance(): Promise<VercelEmbeddings> {
    try {
      if (!this.instance) {
        this.instance = new VercelEmbeddings();
        // Test the OpenAI connection
        await this.instance.generateEmbedding("test");
      }
      return this.instance;
    } catch (error) {
      console.error('Error initializing VercelEmbeddings:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbedding(text))
      );
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, documents: { content: string; embedding: number[]; }[], topK: number = 5): Promise<Array<{ content: string; score: number; }>> {
    try {
      console.log('Starting similarity search:', {
        query,
        documentsCount: documents.length,
        topK
      });

      // Validate inputs
      if (!query.trim()) {
        throw new Error('Query cannot be empty');
      }
      if (!Array.isArray(documents) || documents.length === 0) {
        throw new Error('No documents provided for search');
      }
      if (!documents.every(doc => Array.isArray(doc.embedding))) {
        throw new Error('Invalid document embeddings');
      }

      // Generate embedding for the query
      console.log('Generating query embedding...');
      const queryEmbedding = await this.generateEmbedding(query);
      console.log('Query embedding generated:', {
        dimensions: queryEmbedding.length
      });

      // Calculate cosine similarity with all documents
      console.log('Calculating similarities...');
      const similarities = documents.map(doc => {
        try {
          return {
            content: doc.content,
            score: this.cosineSimilarity(queryEmbedding, doc.embedding)
          };
        } catch (error) {
          console.error('Error calculating similarity for document:', {
            error,
            docEmbeddingLength: doc.embedding.length,
            queryEmbeddingLength: queryEmbedding.length
          });
          throw error;
        }
      });

      // Sort by similarity score and take top K
      console.log('Sorting results...');
      const results = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log('Search complete:', {
        totalResults: similarities.length,
        topScore: results[0]?.score,
        bottomScore: results[results.length - 1]?.score
      });

      return results;
    } catch (error) {
      console.error('Error in searchSimilar:', {
        error,
        query,
        documentsCount: documents?.length
      });
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export default VercelEmbeddings;
