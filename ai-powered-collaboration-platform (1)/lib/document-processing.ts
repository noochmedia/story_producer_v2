import { readFile } from 'fs/promises'
import { PineconeClient } from '@pinecone-database/pinecone'

export async function processDocument(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  return content
}

export function generateEmbedding(content: string): number[] {
  // Simple tokenization (split by spaces and punctuation)
  const tokens = content.toLowerCase().split(/\W+/).filter(token => token.length > 0)
  
  // Create a basic embedding (one-hot encoding)
  const vocabulary = Array.from(new Set(tokens))
  const embedding = new Array(vocabulary.length).fill(0)
  
  tokens.forEach(token => {
    const index = vocabulary.indexOf(token)
    if (index !== -1) {
      embedding[index] += 1
    }
  })
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map(val => val / magnitude)
}

export async function storeEmbedding(userId: string, projectId: string, fileName: string, embedding: number[]) {
  const client = new PineconeClient()
  await client.init({
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
  })

  const pineconeIndex = client.Index(process.env.PINECONE_INDEX!)

  await pineconeIndex.upsert([{
    id: `${userId}-${projectId}-${fileName}`,
    values: embedding,
    metadata: {
      userId,
      projectId,
      fileName,
    },
  }])
}

