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

const CHUNK_SIZE = 8000; // Reduced chunk size for better handling
const MAX_CHUNKS = 3; // Process 3 chunks at a time

export async function processSourcesInChunks(
  sources: PineconeMatch[],
  query: string,
  openai: OpenAI,
  openrouter: OpenRouterClient,
  controller: ReadableStreamDefaultController
) {
  // Check if this is an overview query
  const isOverviewQuery = query.toLowerCase().includes('summary') || 
                         query.toLowerCase().includes('overview') ||
                         query.toLowerCase().includes('all') ||
                         query.toLowerCase().includes('everything');

  // Sort sources by relevance (or by timestamp for overview queries)
  const sortedSources = [...sources]
    .sort((a, b) => {
      if (isOverviewQuery) {
        // For overview queries, try to sort by timestamp if available
        const aTime = a.metadata?.timestamp || '';
        const bTime = b.metadata?.timestamp || '';
        return aTime.localeCompare(bTime);
      }
      // Otherwise sort by relevance score
      return (b.score || 0) - (a.score || 0);
    })
    .filter(source => {
      let content = source.metadata?.content || '';
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          content = parsed
            .map(line => line.content || '')
            .filter(content => content.trim() && !content.includes('Inaudible'))
            .join('\n');
        }
      } catch (e) {
        // If not JSON, use content as-is
      }
      return content.trim().length > 0;
    });

  console.log(`Processing ${sortedSources.length} sources in ${isOverviewQuery ? 'overview' : 'specific'} mode`);

  if (sortedSources.length === 0) {
    console.log('No valid sources found after filtering');
    controller.enqueue(new TextEncoder().encode("I couldn't find any valid sources to analyze. Please try a different query."));
    return [];
  }

  // For overview queries, we want to process more sources
  const maxChunks = isOverviewQuery ? MAX_CHUNKS * 2 : MAX_CHUNKS;
  console.log(`Using max chunks: ${maxChunks}`);

  // Log source structure for debugging
  console.log('Source structure sample:', {
    firstSource: sources[0] ? {
      hasValues: 'values' in sources[0],
      valueType: sources[0].values ? typeof sources[0].values : 'N/A',
      metadata: sources[0].metadata ? Object.keys(sources[0].metadata) : [],
      score: sources[0].score
    } : 'No sources'
  });

  // Skip vector validation for now as we're focused on content processing
  console.log('Proceeding with content processing...');

  // Split sources into chunks based on token count
  const chunks: PineconeMatch[][] = [];
  let currentChunk: PineconeMatch[] = [];
  let currentSize = 0;
  const maxTokens = CHUNK_SIZE * 4; // Approximate chars per token

  for (const source of sortedSources) {
    let content = source.metadata?.content || '';
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        content = parsed
          .map(line => line.content || '')
          .filter(content => content.trim() && !content.includes('Inaudible'))
          .join('\n');
      }
    } catch (e) {
      // If not JSON, use content as-is
    }

    const contentLength = content.length;
    console.log(`Processing source ${source.metadata?.fileName}: ${contentLength} chars`);

    // Start new chunk if current one would exceed size
    if (currentSize + contentLength > maxTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        if (chunks.length >= MAX_CHUNKS) break;
        currentChunk = [];
        currentSize = 0;
      }
      // If single source is too large, split it
      if (contentLength > maxTokens) {
        console.log(`Source ${source.metadata?.fileName} exceeds max tokens, will be split`);
        const parts = Math.ceil(contentLength / maxTokens);
        for (let i = 0; i < parts && chunks.length < MAX_CHUNKS; i++) {
          const start = i * maxTokens;
          const end = Math.min(start + maxTokens, contentLength);
          const partContent = content.slice(start, end);
          chunks.push([{
            ...source,
            metadata: {
              ...source.metadata,
              content: partContent,
              partIndex: i,
              totalParts: parts
            }
          }]);
        }
        continue;
      }
    }
    currentChunk.push(source);
    currentSize += contentLength;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Process each chunk
  let combinedAnalysis = '';
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    controller.enqueue(new TextEncoder().encode(`[STAGE:Analyzing sources (part ${i + 1} of ${chunks.length})]\n\n`));

    // Create a summary prompt for this chunk
    const chunkContent = chunk
      .map(source => {
        let content = source.metadata?.content || '';
        
        // Try to parse JSON content
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            content = parsed
              .map(line => line.content || '')
              .filter(content => content.trim() && !content.includes('Inaudible'))
              .join('\n');
          }
        } catch (e) {
          // If not JSON, use content as-is
        }

        return `[From ${source.metadata?.fileName || 'Unknown'}]:\n${content}`;
      })
      .join('\n\n');

    console.log(`Processing chunk with content length: ${chunkContent.length}`);

    // Check if we need to use OpenRouter for this chunk
    const useOpenRouter = OpenRouterClient.estimateTokens(chunkContent) > 30000;
    
    if (useOpenRouter) {
      console.log(`Using OpenRouter for chunk ${i + 1} due to size`);
      const model = await OpenRouterClient.chooseModel(chunkContent, openrouter);
      const response = await openrouter.createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are analyzing interview content about: ${query}

Your task is to:
1. Provide a brief overview
2. List 2-3 key points
3. Keep responses concise

Format your response with clear spacing:

Overview:
[2-3 sentences maximum]

Key Points:
• [Point 1]
• [Point 2]
• [Point 3]

Would you like me to provide specific quotes for any of these points?`
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
            .replace(/:\s+/g, ':\n')
            .replace(/•\s+/g, '\n\n• ')
            .replace(/\n{3,}/g, '\n\n');
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
            content: `You are analyzing interview content about: ${query}

Your task is to:
1. Provide a brief overview
2. List 2-3 key points
3. Keep responses concise

Format your response with clear spacing:

Overview:
[2-3 sentences maximum]

Key Points:
• [Point 1]
• [Point 2]
• [Point 3]

Would you like me to provide specific quotes for any of these points?`
          },
          {
            role: 'user',
            content: chunkContent
          }
        ],
        temperature: 0.58,
        max_tokens: 1000,
        stream: true
      });

      // Stream the chunk analysis
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          const formattedContent = content
            .replace(/\.\s+/g, '.\n\n')
            .replace(/:\s+/g, ':\n')
            .replace(/•\s+/g, '\n\n• ')
            .replace(/\n{3,}/g, '\n\n');
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
        content: `You are creating a concise summary about: ${query}

Your task is to:
1. Give a clear, brief answer
2. List key insights
3. Keep it focused

Format your response with clear spacing:

Summary:
[1-2 sentences]

Key Points:
• [Point 1]
• [Point 2]
• [Point 3]

Would you like me to provide specific quotes or explore any of these points in detail?`
      },
      {
        role: 'user',
        content: combinedAnalysis
      }
    ],
    temperature: 0.58,
    max_tokens: 1000,
    stream: true
  });

  // Stream the final summary
  for await (const chunk of finalResponse) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n')
        .replace(/•\s+/g, '\n\n• ')
        .replace(/\n{3,}/g, '\n\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
    }
  }
}
