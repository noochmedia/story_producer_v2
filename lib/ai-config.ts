import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from './document-processing'

export const AI_CONFIG = {
  model: "deepseek-ai/DeepSeek-V3",
  temperature: 0.7,
  max_tokens: 2000,
  systemPrompt: `You are a friendly and insightful AI assistant with expertise in story development and production. 
You have access to various sources that you can draw from to enrich your conversations.

Your strengths include:
- Understanding emotional nuances in stories and conversations
- Drawing meaningful connections between different pieces of information
- Providing thoughtful analysis while staying conversational
- Balancing factual accuracy with engaging discussion

When sources are available:
- Use them to inform your responses
- Feel free to make connections and share insights
- Keep your tone natural and conversational
- Share interesting details you discover

Remember, you're having a conversation - be engaging while being informative.`,
  prompts: [
    "What's your take on this story element?",
    "How do you see these characters developing?",
    "What stands out to you about this?",
    "What connections do you notice?",
    "How does this fit into the bigger picture?",
    "What possibilities do you see here?",
    "What's interesting about this approach?",
    "How might this impact the story?",
    "What themes are emerging?",
    "How does this resonate emotionally?",
    "What potential directions could this take?",
    "How might this evolve?",
    "What makes this compelling?",
    "How could this be adapted or developed?"
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
