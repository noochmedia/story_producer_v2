import { Pinecone } from '@pinecone-database/pinecone'

export async function processDocument(content: string): Promise<string> {
  // Simple processing: just return the content
  // In a real-world scenario, you might want to clean or format the content
  return content
}

export async function generateEmbedding(content: string): Promise<number[]> {
  // This is a placeholder function. In a real-world scenario,
  // you would use a proper embedding model here.
  // For now, we'll just create a random vector of the correct dimension
  const dimension = 384 // This should match your Pinecone index dimension
  return Array.from({ length: dimension }, () => Math.random())
}

export async function storeEmbedding(userId: string, projectId: string, fileName: string, embedding: number[]) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  })

  const index = pinecone.index(process.env.PINECONE_INDEX!)

  await index.upsert([{
    id: `${userId}-${projectId}-${fileName}`,
    values: embedding,
    metadata: {
      userId,
      projectId,
      fileName,
    },
  }])
}


import { Configuration, OpenAIApi } from 'openai';

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(openaiConfig);

/**
 * Generate embeddings using OpenAI's embedding model.
 * @param {string} text - The input text to generate embeddings for.
 * @returns {Promise<number[]>} - A promise resolving to an array of embedding values.
 */
  try {
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002', // OpenAI's embedding model
      input: text,
    });

    if (response.data && response.data.data.length > 0) {
      return response.data.data[0].embedding;
    } else {
      throw new Error('Failed to generate embedding: No data in response.');
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
