"use client"

import React, { useState, useEffect, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { useToast } from "./ui/use-toast"
import { cn } from "../lib/utils"

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
  const [isDeepDiveMode, setIsDeepDiveMode] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<string>('')
  const { toast } = useToast()

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
        setInput("Generate a character brief for [character name]")
        setIsDeepDiveMode(true)
        toast({
          title: "Character Brief",
          description: "Enter the character name in the prompt",
        })
      }
    },
    {
      label: "Relationship Map",
      description: "Map character relationships",
      action: () => {
        setIsDeepDiveMode(true)
        setInput("Create a relationship map showing how all the characters are connected")
      }
    },
    {
      label: "Timeline",
      description: "Create a chronological timeline",
      action: () => {
        setIsDeepDiveMode(true)
        setInput("Create a timeline of all major events")
      }
    }
  ]

  const sendMessage = async (useDeepDive = false) => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Add a temporary assistant message that will be updated with streaming content
      const tempAssistantMessage: Message = { 
        role: 'assistant', 
        content: useDeepDive ? 'Analyzing sources...' : 'Thinking...' 
      }
      setMessages(prev => [...prev, tempAssistantMessage])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          projectDetails,
          deepDive: useDeepDive,
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

      let accumulatedContent = useDeepDive ? 'Analyzing sources...\n\n' : ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        
        // Only process stage updates and actual content
        if (chunk.includes('[STAGE:')) {
          const match = chunk.match(/\[STAGE:(.*?)\]/)
          if (match) {
            setAnalysisStage(match[1].trim())
          }
        } else if (!chunk.includes('data:')) {
          accumulatedContent += chunk
        }

        // Update the last message with the accumulated content
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
      sendMessage(isDeepDiveMode)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  return (
    <div className="h-[600px] flex flex-col">
      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          onClick={() => setIsDeepDiveMode(false)}
          variant={isDeepDiveMode ? "outline" : "secondary"}
          className={cn(
            "w-full",
            !isDeepDiveMode && "border-2 border-primary"
          )}
          disabled={isLoading}
        >
          Normal Mode
        </Button>
        <Button
          onClick={() => setIsDeepDiveMode(true)}
          variant={isDeepDiveMode ? "secondary" : "outline"}
          className={cn(
            "w-full",
            isDeepDiveMode && "border-2 border-primary"
          )}
          disabled={isLoading}
        >
          Deep Dive Mode
        </Button>
      </div>

      <ScrollArea className="flex-grow mb-4 p-4 border rounded">
        {messages.map((message, index) => (
          <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {message.content}
            </span>
          </div>
        ))}
        {isLoading && analysisStage && (
          <div className="text-sm text-muted-foreground animate-pulse">
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
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={isDeepDiveMode ? "Ask a detailed question about the sources..." : "Type your message..."}
            className="flex-grow"
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button 
            onClick={() => sendMessage(isDeepDiveMode)} 
            disabled={isLoading}
            className="min-w-[80px]"
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
