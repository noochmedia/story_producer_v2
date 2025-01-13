"use client"

import * as React from 'react'
import { useState, useEffect, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { useToast } from "./ui/use-toast"
import { cn } from "../lib/utils"
import { Checkbox } from "./ui/checkbox"
import { useProject } from "../lib/project-context"

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
  const [useSources, setUseSources] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<string>('')
  const { projectDetails } = useProject()
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

  // Log when sources mode changes
  useEffect(() => {
    console.log('Sources mode changed:', { useSources });
  }, [useSources]);

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

  // Create a ref for the input element
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus input after response
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

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

      // Log the request details
      const requestBody = {
        messages: [...messages, userMessage],
        projectDetails,
        deepDive: useSources,
        isSoundbiteRequest,
        stream: true
      };

      console.log('Sending chat request:', {
        messageCount: messages.length + 1,
        useSources,
        deepDive: requestBody.deepDive,
        isSoundbiteRequest,
        query: userMessage.content,
        mode: useSources ? 'Deep Dive' : 'Normal'
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Log the response status
      console.log('Chat response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Chat response error:', errorData);
        throw new Error(errorData.details || 'Failed to get AI response');
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
            const content = line.replace('data: ', '').trim()
            if (content && !content.includes('[DONE]')) {
              accumulatedContent += content + ' '
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
      if (buffer.trim()) {
        const content = buffer.replace('data: ', '').trim()
        if (content && !content.includes('[DONE]')) {
          accumulatedContent += content + ' '
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
    setInput(e.target.value);
  }

  return (
    <div className="h-full flex flex-col relative">
      <ScrollArea className="absolute inset-0 bottom-[160px] p-4 border rounded">
        {messages.map((message, index) => (
          <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg text-sm ${
              message.role === 'user' 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {message.content}
            </span>
          </div>
        ))}
        {isLoading && analysisStage && (
          <div className="text-xs text-muted-foreground animate-pulse">
            {analysisStage}...
          </div>
        )}
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_0_10px_rgba(0,0,0,0.1)]">
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-1 mb-4">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.action}
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground border-[0.5px]"
              disabled={isLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex gap-2 items-center mt-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Start chatting, ask a question, or choose an option above"
            className="flex-grow text-sm"
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded px-2 py-1 border-[0.5px]">
              <Checkbox
                id="useSources"
                checked={useSources}
                onCheckedChange={(checked) => {
                  const newValue = checked as boolean;
                  console.log('Sources checkbox changed:', { 
                    oldValue: useSources, 
                    newValue 
                  });
                  setUseSources(newValue);
                }}
                disabled={isLoading}
                className="h-3 w-3"
              />
              <label
                htmlFor="useSources"
                className="text-xs text-muted-foreground"
              >
                Use sources
              </label>
            </div>
            <Button 
              onClick={sendMessage} 
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="text-xs min-w-[60px] border-[0.5px]"
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
