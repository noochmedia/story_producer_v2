import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateEmbedding } from '@/lib/document-processing'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 })
    }

    // Combine all messages into a single string for embedding
    const conversationText = messages.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n\n')

    // Generate embedding for the conversation
    const embedding = await generateEmbedding(conversationText)

    // Initialize Pinecone client
    const pinecone = new Pinecone()
    const index = pinecone.index(process.env.PINECONE_INDEX!)

    // Create a unique ID for the conversation
    const id = `conversation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the conversation with metadata
    // Convert messages to string arrays to satisfy Pinecone's metadata requirements
    const messageRoles = messages.map(msg => msg.role)
    const messageContents = messages.map(msg => msg.content)

    await index.upsert([{
      id,
      values: embedding,
      metadata: {
        type: 'conversation',
        timestamp: new Date().toISOString(),
        messageCount: messages.length,
        messageRoles,
        messageContents
      }
    }])

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation stored successfully',
      id
    })
  } catch (error) {
    console.error('Error storing conversation:', error)
    return NextResponse.json({ 
      error: 'Failed to store conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
