import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from './document-processing'

export interface AIMemoryEntry {
  type: 'character_brief' | 'relationship_map' | 'timeline' | 'insight' | 'analysis';
  title: string;
  content: string;
  timestamp: string;
  relatedSources?: string[];
  tags?: string[];
  [key: string]: any;  // Allow additional properties for Pinecone metadata
}

function isAIMemoryEntry(obj: any): obj is AIMemoryEntry {
  return (
    obj &&
    typeof obj.type === 'string' &&
    ['character_brief', 'relationship_map', 'timeline', 'insight', 'analysis'].includes(obj.type) &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.timestamp === 'string'
  );
}

export async function storeMemory(entry: Pick<AIMemoryEntry, 'type' | 'title' | 'content'> & Partial<AIMemoryEntry>) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  // Generate embedding for the content
  const embedding = await generateEmbedding(entry.content);
  
  // Create memory entry
  const memoryEntry: AIMemoryEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    tags: entry.tags || []
  };

  // Store in Pinecone with special type
  const id = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await index.upsert([{
    id,
    values: embedding,
    metadata: {
      id,
      ...memoryEntry,
      recordType: 'ai_memory'  // Special type to distinguish from sources
    }
  }]);

  return memoryEntry;
}

export async function queryMemory(query: string, type?: AIMemoryEntry['type']) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('Pinecone configuration missing');
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);
  
  // Build filter based on type
  const filter = {
    recordType: { $eq: 'ai_memory' },
    ...(type && { type: { $eq: type } })
  };

  // Query Pinecone
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true,
    filter
  });

  // Filter and validate memory entries
  return queryResponse.matches
    .map(match => match.metadata)
    .filter((metadata): metadata is AIMemoryEntry => {
      if (!metadata) return false;
      return isAIMemoryEntry(metadata);
    });
}

export async function generateCharacterBrief(name: string, sources: string[]) {
  return {
    type: 'character_brief' as const,
    title: `Character Brief: ${name}`,
    content: '',  // Will be filled by AI
    relatedSources: sources,
    tags: ['character', name.toLowerCase()]
  };
}

export async function generateRelationshipMap(characters: string[], sources: string[]) {
  return {
    type: 'relationship_map' as const,
    title: 'Character Relationship Map',
    content: '',  // Will be filled by AI
    relatedSources: sources,
    tags: ['relationships', ...characters.map(c => c.toLowerCase())]
  };
}

export async function generateTimeline(sources: string[]) {
  return {
    type: 'timeline' as const,
    title: 'Story Timeline',
    content: '',  // Will be filled by AI
    relatedSources: sources,
    tags: ['timeline', 'events']
  };
}

export function formatMemoryForAI(memories: AIMemoryEntry[]): string {
  if (memories.length === 0) return '';
  
  return `[AI Previous Analyses]
${memories
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(memory => 
      `Type: ${memory.type}
Title: ${memory.title}
Created: ${new Date(memory.timestamp).toLocaleString()}
Content:
${memory.content}
${memory.tags?.length ? `Tags: ${memory.tags.join(', ')}` : ''}`
    )
    .join('\n\n---\n\n')
}`;
}
