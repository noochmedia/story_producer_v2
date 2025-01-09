"use client"

import React, { useState, useEffect, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { useToast } from "./ui/use-toast"
import { cn } from "../lib/utils"
import { Checkbox } from "./ui/checkbox"

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface QuickAction {
  label: string;
  description: string;
  action: () => void;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [projectDetails, setProjectDetails] = useState<string>('')
  const [useSources, setUseSources] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<string>('')
  const { toast } = useToast()

  // Load chat history on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatHistory')
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
  }, [])

  // Save chat history on update
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    // Fetch project details when component mounts
    const fetchProjectDetails = async () => {
      try {
        const response = await fetch('/api/project-details')
        if (!response.ok) {
          throw new Error('Failed to fetch project details')
        }
        const data = await response.json()
        setProjectDetails(data.details || '')
      } catch (error) {
        console.error('Error fetching project details:', error)
        toast({
          title: "Error",
          description: "Failed to fetch project details",
          variant: "destructive",
        })
      }
    }

    fetchProjectDetails()
  }, [toast])

  const quickActions: QuickAction[] = [
    {
      label: "Character Brief",
      description: "Generate a detailed character profile",
      action: () => {
        setInput("Who would you like a character brief on?")
        setUseSources(true)
        toast({
          title: "Character Brief",
          description: "Enter a character's name",
        })
      }
    },
    {
      label: "Relationship Map",
      description: "Map character relationships",
      action: () => {
        setUseSources(true)
        setInput("Create a relationship map showing how all the characters are connected")
      }
    },
    {
      label: "Timeline",
      description: "Create a chronological timeline",
      action: () => {
        setUseSources(true)
        setInput("Create a timeline of all major events")
      }
    },
    {
      label: "Find Soundbites",
      description: "Search for specific types of soundbites",
      action: () => {
        setUseSources(true)
        setInput("What theme, idea, or statement type would you like?")
        toast({
          title: "Find Soundbites",
          description: "Enter a theme or topic to search for",
        })
      }
    },
    {
      label: "Create Soundbite",
      description: "Find ideal soundbites from specific sources",
      action: () => {
        setUseSources(true)
        setInput("What is the ideal soundbite you'd like me to create and who would you like it from?")
        toast({
          title: "Create Soundbite",
          description: "Describe the desired soundbite and source",
        })
      }
    }
  ]

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Add a temporary assistant message that will be updated with streaming content
      const tempAssistantMessage: Message = { 
        role: 'assistant', 
        content: useSources ? 'Analyzing sources...' : 'Thinking...' 
      }
      setMessages(prev => [...prev, tempAssistantMessage])

      // Check if this is a soundbite request
      const isSoundbiteRequest = input.startsWith("What theme, idea, or statement type would you like?") ||
                                input.startsWith("What is the ideal soundbite you'd like me to create");

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          projectDetails,
          deepDive: useSources,
          isSoundbiteRequest,
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
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep the last partial line in the buffer

        for (const line of lines) {
          if (line.trim() === '') continue

          // Handle stage updates
          if (line.includes('[STAGE:')) {
            const match = line.match(/\[STAGE:(.*?)\]/)
            if (match) {
              setAnalysisStage(match[1].trim())
            }
            continue
          }

          // Handle streaming content
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5))
              if (data.choices?.[0]?.delta?.content) {
                accumulatedContent += data.choices[0].delta.content
              }
            } catch (e) {
              // If we can't parse as JSON, check if it's a direct text response
              const content = line.replace('data: ', '').trim()
              if (content && !content.includes('[DONE]')) {
                accumulatedContent += content + ' '
              }
            }
          } else if (!line.includes('data:')) {
            // Direct text content
            accumulatedContent += line + ' '
          }

          // Update the last message with accumulated content
          if (accumulatedContent.trim()) {
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: accumulatedContent.trim()
              }
              return newMessages
            })
          }
        }
      }

      // Handle any remaining content in the buffer
      if (buffer.trim() && !buffer.includes('data:')) {
        accumulatedContent += buffer + ' '
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: accumulatedContent.trim()
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
      setAnalysisStage('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  return (
    <div className="h-[600px] flex flex-col">
      <ScrollArea className="flex-grow mb-4 p-4 border rounded">
        {messages.map((message, index) => (
          <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg ${
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-foreground'
            }`}>
              {message.content}
            </span>
          </div>
        ))}
        {isLoading && analysisStage && (
          <div className="text-sm text-foreground animate-pulse">
            {analysisStage}...
          </div>
        )}
      </ScrollArea>

      <div className="flex flex-col gap-2">
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.action}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Start chatting, ask a question, or choose an option above"
            className="flex-grow"
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Checkbox
                id="useSources"
                checked={useSources}
                onCheckedChange={(checked) => setUseSources(checked as boolean)}
                disabled={isLoading}
              />
              <label
                htmlFor="useSources"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Use sources
              </label>
            </div>
            <Button 
              onClick={sendMessage} 
              disabled={isLoading}
              className="min-w-[80px]"
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
