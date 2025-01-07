import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MemoryItem {
  id: string
  query: string
  response: string
  timestamp: Date
  relevance: number
  embedding: number[]
}

// Simulated function to generate embeddings
const generateEmbedding = (text: string): number[] => {
  // In a real implementation, this would call an embedding API
  // For now, we'll just return a random vector
  return Array.from({length: 128}, () => Math.random())
}

// Simulated function to calculate cosine similarity
const cosineSimilarity = (a: number[], b: number[]): number => {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}

export function AIMemory() {
  const [memories, setMemories] = useState<MemoryItem[]>([])

  useEffect(() => {
    // In a real implementation, this would fetch memories from a database
    const fetchedMemories: MemoryItem[] = [
      {
        id: '1',
        query: "What's the project timeline?",
        response: "The project is scheduled to be completed in 6 months, with monthly milestones.",
        timestamp: new Date('2023-06-01'),
        relevance: 0.9,
        embedding: generateEmbedding("What's the project timeline? The project is scheduled to be completed in 6 months, with monthly milestones.")
      },
      {
        id: '2',
        query: "Who are the key stakeholders?",
        response: "The key stakeholders are the project manager, lead developer, and client representative.",
        timestamp: new Date('2023-06-15'),
        relevance: 0.8,
        embedding: generateEmbedding("Who are the key stakeholders? The key stakeholders are the project manager, lead developer, and client representative.")
      },
      {
        id: '3',
        query: "What's the budget for this project?",
        response: "The total budget for the project is $500,000, allocated across different phases.",
        timestamp: new Date('2023-07-01'),
        relevance: 0.95,
        embedding: generateEmbedding("What's the budget for this project? The total budget for the project is $500,000, allocated across different phases.")
      }
    ]
    setMemories(fetchedMemories)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Memory</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {memories.map((memory) => (
            <div key={memory.id} className="mb-4 p-2 border rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{memory.query}</span>
                <Badge variant="outline">{memory.relevance.toFixed(2)}</Badge>
              </div>
              <p className="text-sm">{memory.response}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {memory.timestamp.toLocaleDateString()}
              </p>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

