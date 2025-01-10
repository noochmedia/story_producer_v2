"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"

interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  content: string;
}

export function Sources() {
  const [isLoading, setIsLoading] = useState(true)
  const [sources, setSources] = useState<Source[]>([])
  const [showSources, setShowSources] = useState(true)
  const { toast } = useToast()

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      if (!response.ok) {
        throw new Error('Failed to fetch sources')
      }
      const data = await response.json()
      setSources(data)
    } catch (error) {
      console.error('Error fetching sources:', error)
      toast({
        title: "Error",
        description: "Failed to fetch sources. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSources()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Sources</h2>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowSources(!showSources)}
          >
            {showSources ? 'Hide' : 'Show'} Sources
          </Button>
          <Button
            variant="outline"
            onClick={fetchSources}
            disabled={isLoading}
          >
            Refresh Sources
          </Button>
        </div>
      </div>

      {showSources && (
        <div className="space-y-2">
          {isLoading ? (
            <p>Loading sources...</p>
          ) : sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="p-2 border rounded-lg">
                  <h3 className="font-medium">{source.name}</h3>
                </div>
              ))}
            </div>
          ) : (
            <p>No sources uploaded yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
