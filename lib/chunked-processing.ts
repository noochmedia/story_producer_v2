import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { AI_CONFIG } from './ai-config';
import { OpenRouterClient } from './openrouter-client';

interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

type PineconeMatch = ScoredPineconeRecord<SourceMetadata>;

const CHUNK_SIZE = 10000; // Characters per chunk
const MAX_CHUNKS = 3; // Process 3 chunks at a time

export async function processSourcesInChunks(
  sources: PineconeMatch[],
  query: string,
  openai: OpenAI,
  openrouter: OpenRouterClient,
  controller: ReadableStreamDefaultController
) {
  // Sort sources by relevance
  const sortedSources = [...sources].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Split sources into chunks
  const chunks: PineconeMatch[][] = [];
  let currentChunk: PineconeMatch[] = [];
  let currentSize = 0;

  for (const source of sortedSources) {
    const content = source.metadata?.content || '';
    if (currentSize + content.length > CHUNK_SIZE) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        if (chunks.length >= MAX_CHUNKS) break;
        currentChunk = [];
        currentSize = 0;
      }
    }
    currentChunk.push(source);
    currentSize += content.length;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Process each chunk
  let combinedAnalysis = '';
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    controller.enqueue(new TextEncoder().encode(`[STAGE:Analyzing sources (part ${i + 1} of ${chunks.length})]`));

    // Create a summary prompt for this chunk
    const chunkContent = chunk
      .map(source => `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || ''}`)
      .join('\n\n');

    // Check if we need to use OpenRouter for this chunk
    const useOpenRouter = OpenRouterClient.estimateTokens(chunkContent) > 30000;
    
    if (useOpenRouter) {
      console.log(`Using OpenRouter for chunk ${i + 1} due to size`);
      const model = await OpenRouterClient.chooseModel(chunkContent, openrouter);
      const response = await openrouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are analyzing a chunk of interview transcripts to find information about: ${query}

Your task is to:
1. Extract relevant quotes and information
2. Provide a brief analysis
3. Focus on facts and direct quotes
4. Include timestamps and sources

Format your response with:
- Clear section headings
- Exact quotes with timestamps
- Brief analysis after each quote
- Connections between different sources`
          },
          {
            role: 'user',
            content: chunkContent
          }
        ],
        model,
        stream: true
      });

      if (response) {
        for await (const chunk of OpenRouterClient.processStream(response)) {
          const formattedContent = chunk
            .replace(/\.\s+/g, '.\n\n')
            .replace(/:\s+/g, ':\n');
          controller.enqueue(new TextEncoder().encode(formattedContent));
          combinedAnalysis += formattedContent;
        }
      }
    } else {
      // Use OpenAI for smaller chunks
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are analyzing a chunk of interview transcripts to find information about: ${query}

Your task is to:
1. Extract relevant quotes and information
2. Provide a brief analysis
3. Focus on facts and direct quotes
4. Include timestamps and sources

Format your response with:
- Clear section headings
- Exact quotes with timestamps
- Brief analysis after each quote
- Connections between different sources`
          },
          {
            role: 'user',
            content: chunkContent
          }
        ],
        temperature: 0.58,
        max_tokens: 2000,
        stream: true
      });

      // Stream the chunk analysis
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          const formattedContent = content
            .replace(/\.\s+/g, '.\n\n')
            .replace(/:\s+/g, ':\n');
          controller.enqueue(new TextEncoder().encode(formattedContent));
          combinedAnalysis += formattedContent;
        }
      }
    }

    // Add spacing between chunks
    if (i < chunks.length - 1) {
      controller.enqueue(new TextEncoder().encode('\n\n---\n\n'));
      combinedAnalysis += '\n\n---\n\n';
    }
  }

  // Final summary using OpenAI (should be small enough)
  controller.enqueue(new TextEncoder().encode('\n\n[STAGE:Creating final summary]\n\n'));
  
  const finalResponse = await openai.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: `You are creating a final summary based on the analyzed chunks of interview transcripts about: ${query}

Your task is to:
1. Synthesize the key points
2. Highlight the most significant quotes
3. Draw overall conclusions
4. Note any patterns or themes

Format your response with:
- Clear introduction
- Main findings
- Supporting evidence
- Conclusion`
      },
      {
        role: 'user',
        content: combinedAnalysis
      }
    ],
    temperature: 0.58,
    max_tokens: 2000,
    stream: true
  });

  // Stream the final summary
  for await (const chunk of finalResponse) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
    }
  }
}
