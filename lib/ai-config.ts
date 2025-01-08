
import { Pinecone } from '@pinecone-database/pinecone'

export const AI_CONFIG = {
  model: "deepseek-chat",
  temperature: 0.7,
  max_tokens: 2000,
  systemPrompt: `You are an AI assistant focused on helping with story development and production. 
Analyze content thoughtfully and provide detailed, constructive feedback.
When discussing story elements, consider structure, character development, pacing, and thematic coherence.
For production-related queries, focus on practical implementation and industry best practices.
Always consider the following project details and available sources in your responses:`,
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
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
        environment: 'aped-4627-b74a',
      });
      const index = pinecone.index('story-tools-embeddings-sj0uqym');
      
      console.log('Querying Pinecone for sources...');
      const queryResponse = await index.query({
        vector: Array(384).fill(0),  // Dummy vector
        topK: 10,  // Retrieve more matches for better coverage
        includeMetadata: true,
        filter: { type: { $eq: 'source' } }
      });

      console.log(`Found ${queryResponse.matches.length} sources from Pinecone`);
      sources = queryResponse.matches
        .map(match => {
          const fileName = match.metadata?.fileName || 'Unknown File';
          const content = match.metadata?.content || 'No content available';
          return `Source: ${fileName}\nContent: ${content}`;
        })
        .join('\n\n');

      if (sources) {
        console.log('Sources retrieved successfully');
      } else {
        console.log('No sources found in Pinecone');
      }
    } catch (error) {
      console.error('Error fetching sources from Pinecone:', error);
      sources = 'Error fetching sources';
    }
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
