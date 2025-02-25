import { Pinecone } from '@pinecone-database/pinecone';

// Ensure this code only runs on the server side
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side');
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

// Maximum tokens for chunking
const MAX_CHUNK_TOKENS = 4000;
const MIN_CHUNK_LENGTH = 20;
const OVERLAP_SIZE = 200;

/**
 * Generate embeddings using Pinecone's hosted model.
 * @param inputs - Array of text inputs to embed
 * @returns Array of embeddings
 */
async function generatePineconeEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!process.env.PINECONE_HOST) {
    throw new Error('PINECONE_HOST environment variable is not set');
  }

  // Extract the base URL without the protocol
  const baseUrl = process.env.PINECONE_HOST.replace(/^https?:\/\//, '');
  
  const response = await fetch(`https://${baseUrl}/vectors/embed`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'multilingual-e5-large',
      inputs,
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
  return data.embeddings;
}

/**
 * Split text into chunks that fit within token limits.
 * Using a sophisticated approach with overlap and proper boundaries.
 */
function splitIntoChunks(text: string): string[] {
  console.log('[CHUNK] Input text type:', typeof text);
  console.log('[CHUNK] Input text sample:', text.slice(0, 200));

  // Handle both raw text and JSON-stringified timestamped content
  let cleanText = '';
  try {
    // Try to parse as JSON first (for timestamped content)
    const parsed = JSON.parse(text);
    console.log('[CHUNK] Successfully parsed JSON:', typeof parsed);
    if (Array.isArray(parsed)) {
      cleanText = parsed
        .map(line => {
          console.log('[CHUNK] Processing line:', line);
          return line.content || '';
        })
        .filter(content => content.trim() && !content.includes('Inaudible'))
        .join('\n');
    } else if (typeof parsed === 'object' && parsed.content) {
      cleanText = parsed.content;
    } else {
      cleanText = text;
    }
  } catch (e) {
    console.log('[CHUNK] Not JSON, using raw text');
    // If not JSON, treat as raw text
    cleanText = text;
  }

  // Clean and normalize
  cleanText = cleanText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  // Log the cleaned text length and sample
  console.log(`[CHUNK] Cleaned text length: ${cleanText.length} chars`);
  console.log('[CHUNK] Cleaned text sample:', cleanText.slice(0, 200));

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
  const maxChunkLength = MAX_CHUNK_TOKENS * 4;

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
  if (chunks.length > 0) {
    console.log('[CHUNK] First chunk sample:', chunks[0].slice(0, 200));
  }
  return chunks;
}

/**
 * Generate embeddings using Pinecone's multilingual-e5-large model.
 * @param {string} text - The input text to generate embeddings for.
 * @returns {Promise<Array<{chunk: string; embedding: number[]}>>} - A promise resolving to chunks and their embeddings.
 */
export async function generateEmbedding(text: string): Promise<Array<{chunk: string; embedding: number[]}>> {
  try {
    console.log('[EMBED] Starting text processing');
    console.log('[EMBED] Input text type:', typeof text);
    console.log('[EMBED] Input text sample:', text.slice(0, 200));

    const chunks = splitIntoChunks(text);
    console.log(`[EMBED] Split text into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.error('[EMBED] No chunks generated. Input text:', {
        type: typeof text,
        length: text.length,
        sample: text.slice(0, 500)
      });
      throw new Error('No valid chunks generated from text');
    }

    const validChunks = chunks.filter((chunk, index) => {
      if (chunk.length < MIN_CHUNK_LENGTH) {
        console.log(`[EMBED] Skipping chunk ${index + 1} (${chunk.length} chars) - too short`);
        return false;
      }
      return true;
    });

    if (validChunks.length === 0) {
      console.error('[EMBED] No valid chunks after filtering. Original chunks:', chunks);
      throw new Error('No valid chunks remaining after filtering');
    }

    // Process chunks in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const results: Array<{chunk: string; embedding: number[]}> = [];

    for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
      const batchChunks = validChunks.slice(i, i + BATCH_SIZE);
      console.log(`[EMBED] Processing batch ${i/BATCH_SIZE + 1}, chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, validChunks.length)}`);

      try {
        // Generate embeddings for the batch
        const embeddings = await generatePineconeEmbeddings(batchChunks);

        // Validate and combine results
        embeddings.forEach((embedding, index) => {
          if (!Array.isArray(embedding)) {
            throw new Error(`Invalid embedding format for chunk ${i + index + 1}`);
          }

          if (embedding.length !== 1024) {
            throw new Error(`Invalid embedding dimensions: expected 1024, got ${embedding.length}`);
          }

          // Log validation success
          console.log(`[EMBED] Validated embedding for chunk ${i + index + 1}:`, {
            type: typeof embedding,
            isArray: Array.isArray(embedding),
            length: embedding.length,
            sample: embedding.slice(0, 3),
            stringified: JSON.stringify(embedding.slice(0, 3))
          });

          results.push({
            chunk: batchChunks[index],
            embedding
          });
        });
      } catch (error) {
        console.error(`[EMBED] Error processing batch starting at chunk ${i + 1}:`, error);
        throw error;
      }
    }

    return results;
  } catch (error) {
    console.error("[EMBED] Error generating embeddings:", error);
    throw error;
  }
}

/**
 * Process document content before embedding.
 * @param {string} content - The input content to process.
 * @returns {Promise<string>} - The processed content.
 */
export async function processDocument(content: string): Promise<string> {
  console.log('[PROCESS] Processing document content:', {
    type: typeof content,
    length: content.length,
    sample: content.slice(0, 200)
  });
  return content.trim();
}
