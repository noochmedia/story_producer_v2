import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

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
  controller.enqueue(new TextEncoder().encode('[STAGE:Analyzing available information]\n\n'));

  // Combine all source content for initial analysis
  const combinedContent = sources
    .map(source => source.metadata?.content || '')
    .join('\n\n');

  // First, analyze what types of information are available
  const categoryResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: 'system',
        content: `You are analyzing interview transcripts to identify different categories of information available about: ${query}

Your task is to:
1. Identify distinct types of information present
2. Provide brief examples for each type
3. Note how many sources mention each type
4. Suggest specific aspects to explore

Format your response as a structured list of categories, each with:
- Category name
- Brief description
- Number of sources
- Example quotes or mentions`
      },
      {
        role: 'user',
        content: combinedContent
      }
    ],
    temperature: 0.58,
    max_tokens: 2000,
    stream: true
  });

  // Stream the category analysis
  let categoryAnalysis = '';
  for await (const chunk of categoryResponse) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      const formattedContent = content
        .replace(/\.\s+/g, '.\n\n')
        .replace(/:\s+/g, ':\n');
      controller.enqueue(new TextEncoder().encode(formattedContent));
      categoryAnalysis += formattedContent;
    }
  }

  // Add prompt for user to choose a category
  controller.enqueue(new TextEncoder().encode('\n\nWhich aspect would you like to explore in detail? You can:\n\n'));
  controller.enqueue(new TextEncoder().encode('1. Choose a specific category to dive deeper\n'));
  controller.enqueue(new TextEncoder().encode('2. Ask about relationships between categories\n'));
  controller.enqueue(new TextEncoder().encode('3. Request a timeline of events\n'));
  controller.enqueue(new TextEncoder().encode('4. Focus on specific quotes or examples\n\n'));
  controller.enqueue(new TextEncoder().encode('Please let me know how you\'d like to proceed.\n'));

  return categoryAnalysis;
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
    model: "gpt-4o",
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
    model: "gpt-4o",
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
