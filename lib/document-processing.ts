import { Pinecone } from '@pinecone-database/pinecone'

export async function processDocument(content: string): Promise<string> {
  // Simple processing: just return the content
  // In a real-world scenario, you might want to clean or format the content
  return content
}

export async function generateEmbedding(content: string): Promise<number[]> {
  // This is a placeholder function. In a real-world scenario,
  // you would use a proper embedding model here.
  // For now, we'll just create a random vector of the correct dimension
  const dimension = 384 // This should match your Pinecone index dimension
  return Array.from({ length: dimension }, () => Math.random())
}

export async function storeEmbedding(userId: string, projectId: string, fileName: string, embedding: number[]) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  })

  const index = pinecone.index(process.env.PINECONE_INDEX!)

  await index.upsert([{
    id: `${userId}-${projectId}-${fileName}`,
    values: embedding,
    metadata: {
      userId,
      projectId,
      fileName,
    },
  }])
}

