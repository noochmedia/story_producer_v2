import { OpenAI } from "openai";

// Ensure this code only runs on the server side
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side');
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Maximum tokens for text-embedding-ada-002 (reduced for safety)
const MAX_CHUNK_TOKENS = 4000;
const MIN_CHUNK_LENGTH = 20; // Minimum characters per chunk (reduced for better handling)
const OVERLAP_SIZE = 200; // Characters to overlap between chunks for context

/**
 * Split text into chunks that fit within token limits.
 * Using a more sophisticated approach with overlap and proper boundaries.
 */
function splitIntoChunks(text: string): string[] {
  // Clean and normalize the text
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanText.length <= MIN_CHUNK_LENGTH) {
    return [cleanText];
  }

  const chunks: string[] = [];
  const avgCharsPerToken = 4;
  const maxChunkLength = MAX_CHUNK_TOKENS * avgCharsPerToken;
  
  let startIndex = 0;
  
  while (startIndex < cleanText.length) {
    // Calculate the potential end of this chunk
    let endIndex = startIndex + maxChunkLength;
    
    // If we're at the end of the text
    if (endIndex >= cleanText.length) {
      chunks.push(cleanText.slice(startIndex));
      break;
    }
    
    // Find the last sentence boundary within our limit
    let boundaryIndex = endIndex;
    while (boundaryIndex > startIndex + MIN_CHUNK_LENGTH) {
      const char = cleanText[boundaryIndex];
      if ('.!?'.includes(char) && cleanText[boundaryIndex + 1] === ' ') {
        break;
      }
      boundaryIndex--;
    }
    
    // If no good boundary found, fall back to last space
    if (boundaryIndex <= startIndex + MIN_CHUNK_LENGTH) {
      boundaryIndex = cleanText.lastIndexOf(' ', endIndex);
    }
    
    // Extract the chunk
    const chunk = cleanText.slice(startIndex, boundaryIndex + 1).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }
    
    // Move the start index back by the overlap amount
    startIndex = boundaryIndex - OVERLAP_SIZE;
    if (startIndex < 0) startIndex = 0;
  }
  
  return chunks.filter(chunk => chunk.length >= MIN_CHUNK_LENGTH);
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

    if (chunks.length === 0) {
      throw new Error('No valid chunks generated from text');
    }

    // Filter out chunks that are too short
    const validChunks = chunks.filter((chunk, index) => {
      if (chunk.length < MIN_CHUNK_LENGTH) {
        console.log(`Skipping chunk ${index + 1} (${chunk.length} chars) - too short`);
        return false;
      }
      return true;
    });

    if (validChunks.length === 0) {
      throw new Error('No valid chunks remaining after filtering');
    }

    // Generate embeddings for valid chunks
    const results = await Promise.all(validChunks.map(async (chunk, index) => {
      console.log(`Generating embedding for chunk ${index + 1}/${validChunks.length} (${chunk.length} chars)`);
      
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      });

      if (!response.data?.[0]?.embedding) {
        throw new Error(`Failed to generate embedding for chunk ${index + 1}`);
      }

      const embedding = response.data[0].embedding;
      
      // Validate embedding dimensions (should be 1536 for text-embedding-ada-002)
      if (embedding.length !== 1536) {
        throw new Error(`Invalid embedding dimensions for chunk ${index + 1}: ${embedding.length}`);
      }

      // Validate embedding values
      if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
        throw new Error(`Invalid embedding values detected in chunk ${index + 1}`);
      }

      console.log(`Successfully generated embedding for chunk ${index + 1}`);
      return {
        chunk,
        embedding
      };
    }));

    return results.filter(Boolean); // Remove any undefined results
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
