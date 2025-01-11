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
  // Handle both raw text and JSON-stringified timestamped content
  let cleanText = '';
  try {
    // Try to parse as JSON first (for timestamped content)
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      cleanText = parsed
        .map(line => line.content || '')
        .filter(content => content.trim() && !content.includes('Inaudible'))
        .join('\n');
    } else {
      cleanText = text;
    }
  } catch (e) {
    // If not JSON, treat as raw text
    cleanText = text;
  }

  // Clean and normalize
  cleanText = cleanText
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple blank lines to double
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Log the cleaned text length
  console.log(`[CHUNK] Cleaned text length: ${cleanText.length} chars`);

  // Handle empty or too short text
  if (!cleanText || cleanText.length < MIN_CHUNK_LENGTH) {
    console.log(`[CHUNK] Text too short or empty (${cleanText.length} chars), minimum required: ${MIN_CHUNK_LENGTH}`);
    return [];
  }

  // If text is within token limit, return as single chunk
  if (cleanText.length <= MAX_CHUNK_TOKENS * 4) {
    console.log(`[CHUNK] Text within token limit, returning as single chunk`);
    return [cleanText];
  }

  console.log(`[CHUNK] Processing text of length ${cleanText.length} chars`);
  
  // Split into initial segments by double newlines (paragraphs)
  const segments = cleanText.split(/\n\s*\n/).filter(s => s.trim());
  console.log(`[CHUNK] Split into ${segments.length} initial segments`);

  const chunks: string[] = [];
  let currentChunk = '';
  const maxChunkLength = MAX_CHUNK_TOKENS * 4; // Approximate chars per token

  for (const segment of segments) {
    // If adding this segment would exceed max length, save current chunk and start new
    if (currentChunk && (currentChunk.length + segment.length + 2) > maxChunkLength) {
      if (currentChunk.length >= MIN_CHUNK_LENGTH) {
        chunks.push(currentChunk.trim());
        console.log(`[CHUNK] Added chunk of length ${currentChunk.length}`);
      }
      currentChunk = segment;
    } else {
      // Add segment to current chunk
      currentChunk = currentChunk
        ? currentChunk + '\n\n' + segment
        : segment;
    }
  }

  // Add final chunk if it meets minimum length
  if (currentChunk && currentChunk.length >= MIN_CHUNK_LENGTH) {
    chunks.push(currentChunk.trim());
    console.log(`[CHUNK] Added final chunk of length ${currentChunk.length}`);
  }

  console.log(`[CHUNK] Created ${chunks.length} chunks`);
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
    const chunks = splitIntoChunks(text);
    console.log(`Split text into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error('No valid chunks generated from text');
    }

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

    const results = await Promise.all(validChunks.map(async (chunk, index) => {
      console.log(`Generating embedding for chunk ${index + 1}/${validChunks.length} (${chunk.length} chars)`);
      
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });

        // Extract raw embedding
        const rawEmbedding = response.data[0].embedding;

        // Create a pure array of numbers
        const embedding = [];
        for (let i = 0; i < rawEmbedding.length; i++) {
          const num = Number(rawEmbedding[i]);
          if (isNaN(num)) {
            throw new Error('Invalid vector value detected');
          }
          embedding.push(num);
        }

        // Validate dimensions for multilingual-e5-large
        if (embedding.length !== 1024) {
          throw new Error(`Invalid embedding array length: ${embedding.length}`);
        }

        // Log validation success
        console.log(`Validated embedding for chunk ${index + 1}:`, {
          type: typeof embedding,
          isArray: Array.isArray(embedding),
          length: embedding.length,
          sample: embedding.slice(0, 3),
          stringified: JSON.stringify(embedding.slice(0, 3))
        });
        
        return {
          chunk,
          embedding: embedding
        };
      } catch (error) {
        console.error(`Error generating embedding for chunk ${index + 1}:`, error);
        throw error;
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
