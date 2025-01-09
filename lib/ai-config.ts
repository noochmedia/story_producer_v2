import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from './document-processing'

export const AI_CONFIG = {
  model: "deepseek-ai/DeepSeek-V3",
  temperature: 0.7,
  max_tokens: 2000,
  systemPrompt: `You are an AI assistant focused on helping with story development and production. 
You excel at analyzing content through multiple lenses: emotional, narrative, technical, and contextual.

CAPABILITIES:
1. Emotional Intelligence
   - Recognize emotional undertones in speech and text
   - Understand character motivations and feelings
   - Identify emotional arcs and transformations

2. Analytical Skills
   - Pattern recognition across different sources
   - Context building from fragmentary information
   - Theme identification and development
   - Subtext analysis

3. Source Integration
   - Use sources as your foundation
   - Draw connections between different pieces of information
   - Identify implications and underlying meanings
   - Make reasoned inferences based on available evidence

IMPORTANT RULES:
1. Never fabricate information - stick to what can be reasonably inferred from sources
2. When citing specific facts, use [Source: filename] format
3. You can analyze, interpret, and draw conclusions from the sources
4. Feel free to point out patterns, connections, or implications you notice
5. If a question can't be answered from sources, explain what you can reasonably determine and what remains uncertain

Project Details and Sources will be provided below. Use them to inform your responses while applying your analytical capabilities:`,
  prompts: [
    "Analyze the narrative structure and suggest improvements.",
    "Identify potential plot holes and propose solutions.",
    "Evaluate character development and offer ideas for deeper characterization.",
    "Assess the pacing and recommend adjustments if needed.",
    "Analyze the dialogue for authenticity and impact.",
    "Suggest ways to enhance the story's themes and motifs.",
    "Identify opportunities for world-building and expanding the story's universe.",
    "Evaluate the story's conflict and tension, suggesting ways to intensify them.",
    "Analyze the story's emotional impact and suggest ways to deepen it.",
    "Identify potential areas for subplots or secondary character arcs.",
    "Suggest creative plot twists or unexpected story developments.",
    "Evaluate the story's ending and propose alternatives if needed.",
    "Analyze the story's marketability and target audience.",
    "Suggest ways to adapt the story for different media (e.g., film, TV series, graphic novel)."
  ]
}

export async function getAIResponse(messages: any[], projectDetails: string) {
  let sources = '';
  
  if (typeof window === 'undefined') {
    // Server-side
    try {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY environment variable is not set');
      }

      if (!process.env.PINECONE_INDEX) {
        throw new Error('PINECONE_INDEX environment variable is not set');
      }

      // Initialize Pinecone client
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });
      
      const index = pinecone.index(process.env.PINECONE_INDEX);
      
      // Get the last message for context
      const lastMessage = messages[messages.length - 1];
      console.log('User query:', lastMessage.content);
      
      console.log('Generating embedding for query...');
      const queryEmbedding = await generateEmbedding(lastMessage.content);
      console.log('Embedding generated, length:', queryEmbedding.length);
      
      console.log('Querying Pinecone for sources...');
      console.log('Query parameters:', {
        vector: `${queryEmbedding.length} dimensions`,
        filter: { type: { $eq: 'source' } }
      });

      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 10,
        includeMetadata: true,
        filter: { type: { $eq: 'source' } }
      });

      // Log the raw matches for debugging
      console.log('Raw matches:', queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata
      })));

      console.log(`Found ${queryResponse.matches.length} sources from Pinecone`);
      
      // Log each match's score and metadata for debugging
      queryResponse.matches.forEach((match, index) => {
        console.log(`Match ${index + 1}:`, {
          score: match.score,
          fileName: match.metadata?.fileName,
          contentLength: typeof match.metadata?.content === 'string' ? match.metadata.content.length : 0
        });
      });

      sources = queryResponse.matches
        .map(match => {
          const fileName = match.metadata?.fileName || 'Unknown File';
          const content = match.metadata?.content || 'No content available';
          return `Source: ${fileName}\nContent: ${content}`;
        })
        .join('\n\n');

      if (sources) {
        console.log('Sources retrieved successfully');
        console.log('Number of sources:', queryResponse.matches.length);
        console.log('Total source content length:', sources.length);
      } else {
        console.log('No sources found in Pinecone');
      }
    } catch (error) {
      console.error('Error fetching sources from Pinecone:', error);
      sources = 'Error fetching sources';
    }
  }

  if (!process.env.DEEPINFRA_TOKEN) {
    throw new Error('DEEPINFRA_TOKEN environment variable is not set');
  }

  const apiUrl = typeof window !== 'undefined' 
    ? '/api/chat'
    : `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/chat`;

  console.log('Sending request to AI chat API...');
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      projectDetails,
      sources,
      ...AI_CONFIG
    }),
  });

  if (!response.ok) {
    throw new Error('AI response failed');
  }

  const data = await response.json();
  console.log('Received AI response successfully');
  return data;
}
