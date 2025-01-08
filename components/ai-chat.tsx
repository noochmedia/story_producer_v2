"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { AI_CONFIG } from "@/lib/ai-config"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [projectDetails, setProjectDetails] = useState('')
  const { toast } = useToast()
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const response = await fetch('/api/project-details')
        if (response.ok) {
          const data = await response.json()
          setProjectDetails(data.details || '')
        }
      } catch (error) {
        console.error('Error fetching project details:', error)
        toast({
          title: "Error",
          description: "Failed to fetch project details. AI responses may lack context.",
          variant: "destructive",
        })
      }
    }

    fetchProjectDetails()
  }, [toast])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController()

      // Add a temporary assistant message that will be updated with streaming content
      const tempAssistantMessage: Message = { role: 'assistant', content: '' }
      setMessages(prev => [...prev, tempAssistantMessage])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          projectDetails,
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.max_tokens,
          prompts: AI_CONFIG.prompts,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body available')
      }

      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        accumulatedContent += chunk

        // Update the last message with the accumulated content
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: accumulatedContent
          }
          return newMessages
        })
      }

      // Store the conversation in Pinecone
      await fetch('/api/store-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage, { role: 'assistant', content: accumulatedContent }]
        })
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled')
      } else {
        console.error('Error getting AI response:', error)
        toast({
          title: "Error",
          description: "Failed to get AI response. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // Cancel ongoing request when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return (
    <div className="h-[400px] flex flex-col">
      <ScrollArea className="flex-grow mb-4 p-4 border rounded">
        {Array.isArray(messages) && messages.map((message, index) => (
          <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {message.content}
            </span>
          </div>
        ))}
      </ScrollArea>
      <div className="flex">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow mr-2"
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}