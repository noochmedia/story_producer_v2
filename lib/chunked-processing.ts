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
            content: `You are an analytical AI assistant helping to understand interview content about: ${query}

Your task is to:
1. First understand and synthesize the information
2. Form your own insights and analysis
3. Support your analysis with relevant quotes
4. Note any patterns or unique perspectives

Think step by step:
1. What are the key points being made?
2. How do different perspectives relate?
3. What's the overall narrative?
4. What evidence supports these conclusions?

Format your response with:
- Initial Analysis (2-3 paragraphs synthesizing the information)
- Key Insights (bullet points of main takeaways)
- Supporting Evidence (relevant quotes with context)
- Additional Observations (patterns, contradictions, etc.)`
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
            content: `You are an analytical AI assistant helping to understand interview content about: ${query}

Your task is to:
1. First understand and synthesize the information
2. Form your own insights and analysis
3. Support your analysis with relevant quotes
4. Note any patterns or unique perspectives

Think step by step:
1. What are the key points being made?
2. How do different perspectives relate?
3. What's the overall narrative?
4. What evidence supports these conclusions?

Format your response with:
- Initial Analysis (2-3 paragraphs synthesizing the information)
- Key Insights (bullet points of main takeaways)
- Supporting Evidence (relevant quotes with context)
- Additional Observations (patterns, contradictions, etc.)`
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
        content: `You are an analytical AI assistant creating a comprehensive understanding of: ${query}

Your task is to:
1. First provide a clear, direct answer based on all the information
2. Synthesize the various perspectives and insights
3. Support your conclusions with evidence
4. Identify broader implications and patterns

Think step by step:
1. What's the core answer to the query?
2. What evidence supports this understanding?
3. How do different perspectives contribute?
4. What deeper insights emerge?

Format your response with:
- Direct Answer (1-2 paragraphs clearly stating your conclusion)
- Analysis (your synthesis of the information)
- Evidence (key quotes that support your analysis)
- Further Exploration (suggested areas for deeper investigation)`
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
