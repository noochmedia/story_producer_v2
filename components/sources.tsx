"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"
import { Loader2, Eye, X } from 'lucide-react'

interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  content: string;
  uploadedAt?: string;
}

export function Sources() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [showSources, setShowSources] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  const handleView = (source: Source) => {
    if (source.url) {
      window.open(source.url, '_blank')
    } else {
      toast({
        title: "Error",
        description: "Source URL not available",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(id)
      const response = await fetch(`/api/sources/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete source')
      }

      toast({
        title: "Success",
        description: "Source deleted successfully",
      })
      
      // Refresh the sources list
      fetchSources()
    } catch (error) {
      console.error('Error deleting source:', error)
      toast({
        title: "Error",
        description: "Failed to delete source. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const fetchSources = async () => {
    try {
      setIsLoading(true)
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

  // Listen for analysis state changes
  useEffect(() => {
    const eventSource = new EventSource('/api/sources/status')
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.status === 'analyzing') {
        setIsAnalyzing(true)
      } else if (data.status === 'complete') {
        setIsAnalyzing(false)
        fetchSources() // Refresh sources after analysis
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
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
            disabled={isLoading || isAnalyzing}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Refresh Sources'
            )}
          </Button>
        </div>
      </div>

      {showSources && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <p>Loading sources...</p>
            </div>
          ) : sources.length > 0 ? (
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{source.name}</h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(source)}
                        title="View source"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(source.id)}
                        disabled={isDeleting === source.id}
                        title="Delete source"
                      >
                        {isDeleting === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-4 border rounded-lg">
              <p className="text-muted-foreground">No sources uploaded yet.</p>
              <p className="text-sm mt-1">Upload files to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
