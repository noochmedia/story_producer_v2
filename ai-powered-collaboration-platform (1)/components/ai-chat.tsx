"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAIResponse } from "@/lib/ai-config"
import { useToast } from "@/components/ui/use-toast"

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
      const aiResponse = await getAIResponse([...messages, userMessage], projectDetails)
      const aiMessage: Message = { role: 'assistant', content: aiResponse.choices[0].message.content }
      setMessages(prev => [...prev, aiMessage])

      // Store the conversation in Pinecone
      await fetch('/api/store-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage, aiMessage] })
      })
    } catch (error) {
      console.error('Error getting AI response:', error)
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-[400px] flex flex-col">
      <ScrollArea className="flex-grow mb-4 p-4 border rounded">
        {messages.map((message, index) => (
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

