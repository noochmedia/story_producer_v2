import { OpenAI } from "openai";

// Only initialize OpenAI on the server side
const openai = typeof window === 'undefined' 
  ? new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
    }) 
  : null;

/**
 * Generate embeddings using OpenAI's embedding model.
 * @param {string} text - The input text to generate embeddings for.
 * @returns {Promise<number[]>} - A promise resolving to an array of embedding values.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Ensure we're on the server side
  if (typeof window !== 'undefined') {
    throw new Error('generateEmbedding must be called from the server side');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    if (response.data && response.data.length > 0) {
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
