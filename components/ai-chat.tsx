"use client"

import React, { useState, useEffect, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { useToast } from "./ui/use-toast"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [projectDetails, setProjectDetails] = useState<string>('')
  const [sources, setSources] = useState<string>('')
  const { toast } = useToast()

  useEffect(() => {
    // Fetch project details and sources when component mounts
    const fetchInitialData = async () => {
      try {
        // Fetch project details
        const detailsResponse = await fetch('/api/project-details')
        if (!detailsResponse.ok) {
          throw new Error('Failed to fetch project details')
        }
        const detailsData = await detailsResponse.json()
        setProjectDetails(detailsData.details || '')

        // Fetch sources
        const sourcesResponse = await fetch('/api/sources')
        if (!sourcesResponse.ok) {
          throw new Error('Failed to fetch sources')
        }
        const sourcesData = await sourcesResponse.json()
        console.log('Fetched sources:', sourcesData);
        
        // Format sources for AI consumption
        const formattedSources = Array.isArray(sourcesData) 
          ? sourcesData.map(source => 
              `Source: ${source.name}\nContent: ${source.content || 'No content available'}`
            ).join('\n\n')
          : '';
        
        console.log('Formatted sources length:', formattedSources.length);
        setSources(formattedSources)
      } catch (error) {
        console.error('Error fetching initial data:', error)
        toast({
          title: "Error",
          description: "Failed to fetch required data",
          variant: "destructive",
        })
      }
    }

    fetchInitialData()
  }, [toast])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Add a temporary assistant message that will be updated with streaming content
      const tempAssistantMessage: Message = { role: 'assistant', content: '' }
      setMessages(prev => [...prev, tempAssistantMessage])

      console.log('Sending chat request with sources length:', sources?.length || 0);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          projectDetails,
          sources,
          stream: true
        })
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
    } catch (error) {
      console.error('Error getting AI response:', error)
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      })

      // Remove the temporary assistant message if there was an error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
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
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-grow mr-2"
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
