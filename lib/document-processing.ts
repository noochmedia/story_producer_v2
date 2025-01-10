import { OpenAI } from "openai";

// Ensure this code only runs on the server side
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side');
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

/**
 * Generate embeddings using OpenAI's embedding model.
 * @param {string} text - The input text to generate embeddings for.
 * @returns {Promise<number[]>} - A promise resolving to an array of embedding values.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log('Environment check:', {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  });

  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key missing in environment');
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    console.log('Generating embedding for text:', text.substring(0, 50) + '...');
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    console.log('Embedding generated successfully');

    if (response.data && response.data.length > 0) {
      console.log('Embedding length:', response.data[0].embedding.length);
      return response.data[0].embedding;
    } else {
      throw new Error("Failed to generate embedding: No data in response.");
    }
  } catch (error) {
    console.error("Error generating embedding:", error);
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
