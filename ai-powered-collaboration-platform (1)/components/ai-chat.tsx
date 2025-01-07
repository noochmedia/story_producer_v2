"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAIResponse } from "@/lib/ai-config"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [projectDetails, setProjectDetails] = useState('')

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const response = await fetch('/api/project-details')
        if (!response.ok) {
          throw new Error('Failed to fetch project details')
        }
        const details = await response.json()
        setProjectDetails(details.description)
      } catch (error) {
        console.error('Error fetching project details:', error)
        setProjectDetails('No project details available')
      }
    }
    fetchProjectDetails()
  }, [])

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
    } catch (error) {
      console.error('Error getting AI response:', error)
      const errorMessage: Message = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AI Chat</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow mb-4">
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
      </CardContent>
    </Card>
  )
}

