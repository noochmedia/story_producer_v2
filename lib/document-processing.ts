
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
export async function generateEmbedding(text: string): Promise<number[]> {
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

/**
 * Process document content before embedding (dummy example).
 * @param {string} content - The input content to process.
 * @returns {Promise<string>} - The processed content.
 */
export async function processDocument(content: string): Promise<string> {
  // Example: Simplified processing logic; customize as needed.
  return content.trim();
}
