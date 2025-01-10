import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { AI_CONFIG } from './ai-config';

interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

type PineconeMatch = ScoredPineconeRecord<SourceMetadata>;

interface SearchCategory {
  category: string;
  description: string;
  sourceCount: number;
  examples: string[];
}

export async function analyzeSourceCategories(
  sources: PineconeMatch[],
  query: string,
  openai: OpenAI,
  controller: ReadableStreamDefaultController
) {
  try {
    controller.enqueue(new TextEncoder().encode('[STAGE:Analyzing available information]\n\n'));
    console.log('Starting initial analysis with sources:', sources.length);

    // Combine content for analysis
    const allContent = sources
      .map(source => source.metadata?.content || '')
      .join('\n\n');

    console.log('Combined content length:', allContent.length);
    console.log('Starting OpenAI completion');

    // First do an initial analysis of the query
    const initialResponse = await openai.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: `You are analyzing interview transcripts to answer questions about: ${query}

Your task is to:
1. First provide a direct answer based on the available information
2. Then identify key themes or aspects that could be explored further
3. Support your answer with specific quotes
4. Note any conflicting or complementary perspectives

Format your response with:
- Initial Answer (2-3 paragraphs)
- Supporting Quotes (2-3 relevant quotes)
- Key Themes (list of themes found)
- Potential Areas for Deeper Analysis`
      },
      {
        role: 'user',
        content: sources
          .map(source => `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || ''}`)
          .join('\n\n')
      }
    ],
    temperature: 0.58,
    max_tokens: 2000,
    stream: true
  });

    // Stream the initial analysis
    console.log('Streaming initial analysis');
    let initialAnalysis = '';
    for await (const chunk of initialResponse) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
      initialAnalysis += formattedContent;
    }
  }

    console.log('Initial analysis complete, length:', initialAnalysis.length);

    // Add prompt for further exploration
    controller.enqueue(new TextEncoder().encode('\n\nWould you like to explore any specific aspect in more detail? You can:\n\n'));
  controller.enqueue(new TextEncoder().encode('1. Get more details about a specific theme\n'));
  controller.enqueue(new TextEncoder().encode('2. See how different perspectives compare\n'));
  controller.enqueue(new TextEncoder().encode('3. Look at the timeline of events\n'));
  controller.enqueue(new TextEncoder().encode('4. Focus on specific examples or quotes\n\n'));

    console.log('Analysis complete, returning result');
    return initialAnalysis;
  } catch (error) {
    console.error('Error in analyzeSourceCategories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    controller.enqueue(new TextEncoder().encode(`Error analyzing sources: ${errorMessage}. Please try again or rephrase your question.`));
    throw error;
  }
}

export async function processUserChoice(
  choice: string,
  sources: PineconeMatch[],
  previousAnalysis: string,
  openai: OpenAI,
  controller: ReadableStreamDefaultController
) {
  controller.enqueue(new TextEncoder().encode('[STAGE:Processing your selection]\n\n'));

  // Filter sources based on user's choice
  const response = await openai.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: `You are helping analyze interview transcripts based on the user's selection: "${choice}"

Previous analysis:
${previousAnalysis}

Your task is to:
1. Focus on the specific aspect requested
2. Provide detailed analysis with quotes
3. Note connections to other aspects
4. Suggest follow-up areas to explore

Format your response with:
- Clear section headings
- Relevant quotes with context
- Analysis of patterns
- Potential follow-up questions`
      },
      {
        role: 'user',
        content: sources
          .map(source => `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || ''}`)
          .join('\n\n')
      }
    ],
    temperature: 0.58,
    max_tokens: 2000,
    stream: true
  });

  // Stream the focused analysis
  let focusedAnalysis = '';
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
      focusedAnalysis += formattedContent;
    }
  }

  // Add prompt for further exploration
  controller.enqueue(new TextEncoder().encode('\n\nWould you like to:\n\n'));
  controller.enqueue(new TextEncoder().encode('1. Explore another aspect of this topic\n'));
  controller.enqueue(new TextEncoder().encode('2. Get more specific details about something mentioned\n'));
  controller.enqueue(new TextEncoder().encode('3. See how this connects to other topics\n'));
  controller.enqueue(new TextEncoder().encode('4. Get a final summary of everything we\'ve discussed\n\n'));

  return focusedAnalysis;
}

export async function createFinalSummary(
  allAnalyses: string[],
  query: string,
  openai: OpenAI,
  controller: ReadableStreamDefaultController
) {
  controller.enqueue(new TextEncoder().encode('[STAGE:Creating final summary]\n\n'));

  const response = await openai.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: `You are creating a final summary of our analysis about: ${query}

Previous analyses:
${allAnalyses.join('\n\n---\n\n')}

Your task is to:
1. Synthesize key findings
2. Highlight most significant insights
3. Show connections between different aspects
4. Provide a coherent narrative

Format your response with:
- Executive summary
- Key findings by category
- Notable quotes and examples
- Overall conclusions`
      },
      {
        role: 'user',
        content: 'Please provide a final summary.'
      }
    ],
    temperature: 0.58,
    max_tokens: 2000,
    stream: true
  });

  // Stream the final summary
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
    }
  }
}
