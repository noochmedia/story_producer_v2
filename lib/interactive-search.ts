import { OpenRouterClient } from './openrouter-client';
import { AI_CONFIG } from './ai-config';
import { Document } from './document-store';
import VercelEmbeddings from './vercel-embeddings';

let embeddings: VercelEmbeddings | null = null;

async function getEmbeddings() {
  if (!embeddings) {
    embeddings = await VercelEmbeddings.getInstance();
  }
  return embeddings;
}

export async function analyzeSourceCategories(
  sources: Document[],
  query: string,
  openRouter: OpenRouterClient,
  controller: ReadableStreamDefaultController
) {
  try {
    controller.enqueue(new TextEncoder().encode('[STAGE:Analyzing available information]\n\n'));
    console.log('Starting initial analysis with sources:', sources.length);

    // Process sources in chunks to avoid token limits
    const CHUNK_SIZE = 3; // Process 3 sources at a time
    let combinedAnalysis = '';

    // Process sources in chunks
    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
      const chunk = sources.slice(i, i + CHUNK_SIZE);
      const chunkContent = chunk
        .map(source => `[From ${source.metadata.fileName}]:\n${source.content}`)
        .join('\n\n');

      console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(sources.length / CHUNK_SIZE)}`);
      controller.enqueue(new TextEncoder().encode(`[STAGE:Analyzing part ${i / CHUNK_SIZE + 1} of ${Math.ceil(sources.length / CHUNK_SIZE)}]\n\n`));

      // Analyze this chunk using OpenRouter
      const chunkAnalysis = await openRouter.generateAnalysis([
        {
          role: 'system',
          content: `You are analyzing a subset of interview transcripts to answer questions about: ${query}

Your task is to:
1. Analyze this portion of the content
2. Identify relevant information and quotes
3. Note key themes and insights
4. Keep your analysis focused and concise

Previous findings (if any):
${combinedAnalysis ? combinedAnalysis : "No previous analysis"}

Format your response with:
- Key Information Found
- Relevant Quotes
- New Themes Identified`
        },
        {
          role: 'user',
          content: chunkContent
        }
      ], 1000, controller);

      combinedAnalysis += chunkAnalysis + '\n\n';
    }

    // Final synthesis of all chunks
    console.log('Creating final synthesis');
    controller.enqueue(new TextEncoder().encode('[STAGE:Creating final synthesis]\n\n'));

      // Generate final synthesis using OpenRouter
      console.log('Creating final synthesis');
      const finalAnalysis = await openRouter.generateAnalysis([
        {
          role: 'system',
          content: `You are creating a final synthesis of the analysis about: ${query}

Previous analysis:
${combinedAnalysis}

Your task is to:
1. Provide a comprehensive answer based on all analyzed information
2. Highlight the most important findings
3. Present key quotes and evidence
4. Identify overarching themes

Format your response with:
- Initial Answer (2-3 paragraphs)
- Supporting Quotes (2-3 relevant quotes)
- Key Themes (list of themes found)
- Potential Areas for Deeper Analysis`
        },
        {
          role: 'user',
          content: 'Please provide a final synthesis.'
        }
      ], 1000, controller);

    console.log('Final synthesis complete');

    // Add prompt for further exploration
    controller.enqueue(new TextEncoder().encode('\n\nWould you like to explore any specific aspect in more detail? You can:\n\n'));
    controller.enqueue(new TextEncoder().encode('1. Get more details about a specific theme\n'));
    controller.enqueue(new TextEncoder().encode('2. See how different perspectives compare\n'));
    controller.enqueue(new TextEncoder().encode('3. Look at the timeline of events\n'));
    controller.enqueue(new TextEncoder().encode('4. Focus on specific examples or quotes\n\n'));

    console.log('Analysis complete, returning result');
    return finalAnalysis;
  } catch (error) {
    console.error('Error in analyzeSourceCategories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    controller.enqueue(new TextEncoder().encode(`Error analyzing sources: ${errorMessage}. Please try again or rephrase your question.`));
    throw error;
  }
}

export async function processUserChoice(
  choice: string,
  sources: Document[],
  previousAnalysis: string,
  openRouter: OpenRouterClient,
  controller: ReadableStreamDefaultController
) {
  controller.enqueue(new TextEncoder().encode('[STAGE:Processing your selection]\n\n'));

  // Process sources in chunks
  const CHUNK_SIZE = 3;
  let combinedAnalysis = previousAnalysis;

  for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
    const chunk = sources.slice(i, i + CHUNK_SIZE);
    const chunkContent = chunk
      .map(source => `[From ${source.metadata.fileName}]:\n${source.content}`)
      .join('\n\n');

    console.log(`Processing chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(sources.length / CHUNK_SIZE)}`);
    controller.enqueue(new TextEncoder().encode(`[STAGE:Analyzing part ${i / CHUNK_SIZE + 1} of ${Math.ceil(sources.length / CHUNK_SIZE)}]\n\n`));

    const chunkAnalysis = await openRouter.generateAnalysis([
      {
        role: 'system',
        content: `You are helping analyze interview transcripts based on the user's selection: "${choice}"

Previous analysis:
${combinedAnalysis}

Your task is to:
1. Focus on the specific aspect requested
2. Analyze this portion of content
3. Note connections to previous findings
4. Keep analysis focused and concise

Format your response with:
- New Information Found
- Relevant Quotes
- Connections to Previous Analysis`
      },
      {
        role: 'user',
        content: chunkContent
      }
    ], 1000, controller);

    combinedAnalysis += '\n\n' + chunkAnalysis;
  }

  // Create final synthesis
  console.log('Creating final synthesis');
  controller.enqueue(new TextEncoder().encode('[STAGE:Creating final synthesis]\n\n'));

  const finalAnalysis = await openRouter.generateAnalysis([
    {
      role: 'system',
      content: `You are creating a synthesis of the analysis about: "${choice}"

Previous analysis:
${combinedAnalysis}

Your task is to:
1. Provide a comprehensive analysis
2. Highlight key findings and patterns
3. Present most relevant quotes
4. Suggest follow-up areas

Format your response with:
- Clear section headings
- Key findings and patterns
- Most relevant quotes
- Potential follow-up questions`
    },
    {
      role: 'user',
      content: 'Please provide a final synthesis.'
    }
  ], 1000, controller);

  // Add prompt for further exploration
  controller.enqueue(new TextEncoder().encode('\n\nWould you like to:\n\n'));
  controller.enqueue(new TextEncoder().encode('1. Explore another aspect of this topic\n'));
  controller.enqueue(new TextEncoder().encode('2. Get more specific details about something mentioned\n'));
  controller.enqueue(new TextEncoder().encode('3. See how this connects to other topics\n'));
  controller.enqueue(new TextEncoder().encode('4. Get a final summary of everything we\'ve discussed\n\n'));

  return finalAnalysis;
}

export async function createFinalSummary(
  allAnalyses: string[],
  query: string,
  openRouter: OpenRouterClient,
  controller: ReadableStreamDefaultController
) {
  controller.enqueue(new TextEncoder().encode('[STAGE:Creating final summary]\n\n'));

  await openRouter.generateAnalysis([
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
  ], 2000, controller);
}
