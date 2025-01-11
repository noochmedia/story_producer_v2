import { OpenAI } from "openai";

// Ensure this code only runs on the server side
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side');
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Maximum tokens for text-embedding-ada-002
const MAX_CHUNK_TOKENS = 8000;

/**
 * Split text into chunks that fit within token limits.
 * Using a simple character-based approach as a rough approximation.
 * On average, 1 token = 4 characters in English.
 */
function splitIntoChunks(text: string): string[] {
  const avgCharsPerToken = 4;
  const maxChunkLength = MAX_CHUNK_TOKENS * avgCharsPerToken;
  const chunks: string[] = [];
  
  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the chunk size
    if ((currentChunk + paragraph).length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If the paragraph itself is too long, split it
      if (paragraph.length > maxChunkLength) {
        const words = paragraph.split(/\s+/);
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > maxChunkLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + word;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Generate embeddings using OpenAI's embedding model.
 * @param {string} text - The input text to generate embeddings for.
 * @returns {Promise<Array<{chunk: string; embedding: number[]}>>} - A promise resolving to chunks and their embeddings.
 */
export async function generateEmbedding(text: string): Promise<Array<{chunk: string; embedding: number[]}>> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    // Split text into chunks
    const chunks = splitIntoChunks(text);
    console.log(`Split text into ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    const results = await Promise.all(chunks.map(async (chunk) => {
      console.log('Generating embedding for chunk:', chunk.substring(0, 50) + '...');
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      });

      if (response.data && response.data.length > 0) {
        console.log('Embedding generated successfully for chunk');
        return {
          chunk,
          embedding: response.data[0].embedding
        };
      } else {
        throw new Error("Failed to generate embedding: No data in response.");
      }
    }));

    return results;
  } catch (error) {
    console.error("Error generating embeddings:", error);
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
