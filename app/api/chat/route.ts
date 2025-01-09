import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'
import { Pinecone, ScoredPineconeRecord } from '@pinecone-database/pinecone'
import { generateEmbedding } from '../../../lib/document-processing'
import { queryMemory, storeMemory, formatMemoryForAI } from '../../../lib/ai-memory'
import OpenAI from 'openai'

interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

interface TimestampedLine {
  timestamp: string;
  content: string;
}

type PineconeMatch = ScoredPineconeRecord<SourceMetadata>;

function getContentPreview(content: any): string {
  if (typeof content === 'string') {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  return 'No preview available';
}

function cleanTranscriptContent(content: string): string {
  // Remove timestamp lines but keep them for reference
  const lines = content.split('\n');
  const cleanedLines: TimestampedLine[] = [];
  let lastTimestamp = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timestampMatch = line.match(/^\[\d{2}:\d{2}:\d{2}:\d{2}\]/);
    
    if (timestampMatch) {
      lastTimestamp = timestampMatch[0];
      continue;
    }

    if (line.trim() && !line.includes('Inaudible')) {
      // If this is actual content, add it with the last known timestamp
      cleanedLines.push({ timestamp: lastTimestamp, content: line.trim() });
    }
  }

  return JSON.stringify(cleanedLines);
}

function processMatch(match: PineconeMatch): PineconeMatch {
  if (!match.metadata) return match;

  const content = match.metadata.content;
  if (typeof content !== 'string') return match;

  return {
    ...match,
    metadata: {
      ...match.metadata,
      content: cleanTranscriptContent(content)
    }
  };
}

async function queryPineconeForContext(query: string, stage: string, controller: ReadableStreamDefaultController) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  controller.enqueue(new TextEncoder().encode(`[STAGE:${stage}]`));

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  console.log('Generating embedding for context query:', query);
  const queryEmbedding = await generateEmbedding(query);
  
  console.log('Querying Pinecone for relevant context...');
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
    filter: { type: { $eq: 'source' } }
  });

  console.log('Found matches:', queryResponse.matches.length);
  
  // Process and clean matches
  const validMatches = queryResponse.matches
    .filter(match => 
      match.metadata?.content && 
      typeof match.metadata.content === 'string' && 
      match.metadata.content.trim() !== ''
    )
    .map(processMatch);

  console.log('Valid matches with content:', validMatches.length);
  validMatches.forEach((match, i) => {
    console.log(`Match ${i + 1}:`, {
      score: match.score,
      fileName: match.metadata?.fileName,
      contentPreview: match.metadata?.content ? getContentPreview(match.metadata.content) : 'No content'
    });
  });

  return validMatches;
}

export async function POST(req: Request) {
  const { messages, projectDetails, deepDive = false, isSoundbiteRequest = false, model, temperature, max_tokens, stream = false } = await req.json()

  console.log('Processing chat request:', {
    mode: deepDive ? 'Deep Dive' : 'Normal',
    type: isSoundbiteRequest ? 'Soundbite' : 'Regular',
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content
  });
  
  try {
    // Get user's latest message
    const userMessage = messages[messages.length - 1];
    console.log('User query:', userMessage.content);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Prepare system message based on mode
    let systemMessage = '';
    let relevantSources: PineconeMatch[] = [];
    
    if (stream) {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              // First check AI's memory
              const relevantMemories = await queryMemory(userMessage.content);
              const memoryContext = formatMemoryForAI(relevantMemories);

              if (deepDive) {
                // Get initial context from Pinecone
                relevantSources = await queryPineconeForContext(
                  userMessage.content,
                  'Searching relevant information',
                  controller
                );

                if (relevantSources.length > 0) {
                  if (isSoundbiteRequest) {
                    const isFindSoundbite = userMessage.content.startsWith("What theme, idea, or statement type would you like?");
                    
                    systemMessage = `${AI_CONFIG.systemPrompt}

You are a professional video editor searching through interview transcripts ${isFindSoundbite ? 'to find relevant soundbites' : 'to create specific soundbites'}. Your task is to ${isFindSoundbite ? 'identify quotes that match the requested theme or topic' : 'find quotes that best match the requested soundbite and speaker'}.

Here are the relevant interview excerpts:

${relevantSources.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Response Format:
-------------------
For each soundbite, provide:

1. Source: [Filename]
2. Timecode: [Exact timestamp]
3. Quote: "[Exact quote from source]"
4. Context: Brief explanation of the quote's significance

Critical Requirements:
- Only use EXACT quotes from the sources
- Include PRECISE timestamps
- Never modify or paraphrase quotes
- If no suitable quotes found, clearly state this
- Double-check quote accuracy
- Ensure timestamps match the quotes

${isFindSoundbite ? `
Search Strategy:
- Look for quotes that express the requested theme
- Consider both direct and indirect expressions of the theme
- Note any contextual elements that enhance the quote's meaning
- Group related quotes if they build on the same idea` : `
Creation Strategy:
- Find quotes that best match the requested soundbite concept
- Consider the speaker's unique voice and perspective
- Look for natural, authentic expressions
- Identify quotes that capture the intended meaning`}`;
                  } else if (userMessage.content.startsWith("Who would you like a character brief on?")) {
                    systemMessage = `${AI_CONFIG.systemPrompt}

You are a professional story analyst creating a detailed character profile. Your task is to analyze all available information about the specified character from the interview transcripts.

Here are the relevant interview excerpts:

${relevantSources.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Format your response as follows:

CHARACTER PROFILE
----------------

Overview:
[2-3 sentences introducing the character]

Key Characteristics:
• [Trait 1]
• [Trait 2]
• etc.

Notable Quotes:
[Include exact quotes with timestamps that reveal character]

Relationships:
[Describe connections to other characters]

Background:
[Key events and experiences]

Analysis:
[Deeper insights about the character]

Remember to:
- Support all points with exact quotes
- Include timestamps for quotes
- Focus on factual information from sources
- Note any conflicting information
- Maintain objective analysis`;
                  } else if (userMessage.content.includes("relationship map")) {
                    systemMessage = `${AI_CONFIG.systemPrompt}

You are a professional story analyst mapping character relationships. Your task is to analyze the connections between characters mentioned in the interview transcripts.

Here are the relevant interview excerpts:

${relevantSources.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Format your response as follows:

RELATIONSHIP MAP
---------------

Overview:
[Brief summary of key relationships]

Key Relationships:

[Character 1] ↔ [Character 2]
• Nature of Relationship
• Key Interactions
• Supporting Quote: "[exact quote]" [timestamp]

[Continue for each significant relationship pair]

Group Dynamics:
[Analysis of larger group interactions]

Timeline:
[How relationships evolved]

Remember to:
- Support each relationship with quotes
- Include timestamps
- Focus on direct evidence
- Note relationship changes
- Indicate relationship strength`;
                  } else if (userMessage.content.includes("timeline")) {
                    systemMessage = `${AI_CONFIG.systemPrompt}

You are a professional story analyst creating a chronological timeline. Your task is to organize events mentioned in the interview transcripts.

Here are the relevant interview excerpts:

${relevantSources.map(source => 
  `[From ${source.metadata?.fileName || 'Unknown'}]:\n${source.metadata?.content || 'No content available'}`
).join('\n\n')}

Format your response as follows:

CHRONOLOGICAL TIMELINE
---------------------

Overview:
[Brief summary of the time period covered]

Events:

[Date/Period 1]
• Event: [Description]
• Source: [Filename]
• Quote: "[exact quote]" [timestamp]

[Continue chronologically]

Key Periods:
[Identify significant time spans]

Patterns:
[Note recurring events or themes]

Remember to:
- Order events chronologically
- Include exact quotes and timestamps
- Note any timeline uncertainties
- Connect related events
- Highlight key moments`;
                  }
                } else {
                  console.log('No relevant sources found');
                  systemMessage = `${AI_CONFIG.systemPrompt}

I've searched the interview transcripts but couldn't find any relevant information about that specific topic. Let me know if you'd like to know about something else from the interviews.`;
                }
              } else {
                systemMessage = `${AI_CONFIG.systemPrompt}

Let me help you with your question. Note that I'm not currently using the interview transcripts. If you'd like me to check the transcripts, please enable the "Use sources" option.`;
              }

              console.log('System message prepared:', {
                length: systemMessage.length,
                includesSources: relevantSources.length > 0,
                sourcesCount: relevantSources.length,
                isSoundbiteRequest
              });

              const stream = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: 'system', content: systemMessage },
                  ...messages.slice(-5) // Only include last 5 messages to reduce context
                ],
                response_format: { type: "text" },
                temperature: 0.58,
                max_tokens: 12317,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true
              });

              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }

              controller.close();
            } catch (error) {
              console.error('Error in streaming response:', error);
              controller.error(error);
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Non-streaming response handling
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemMessage },
        ...messages
      ],
      response_format: { type: "text" },
      temperature: 0.58,
      max_tokens: 12317,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error in chat processing:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
