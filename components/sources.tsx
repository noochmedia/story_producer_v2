"use client"

import { useState, useEffect, useCallback } from 'react'
import { File, FileAudio, FileVideo, Trash2, Eye, RefreshCw } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface Source {
  id: string
  name: string
  type: 'video' | 'audio' | 'document'
  url: string
}

export function Sources() {
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchSources = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sources', {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch sources')
      }
      const data = await response.json()
      setSources(data)
    } catch (err) {
      console.error('Error fetching sources:', err)
      setError('Failed to load sources')
      toast({
        title: "Error",
        description: "Failed to load sources. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const handleDelete = async (id: string) => {
    setIsDeleting(id)
    try {
      console.log(`Attempting to delete source with id: ${id}`)
      const encodedId = encodeURIComponent(id)
      console.log(`Encoded ID: ${encodedId}`)
      const response = await fetch(`/api/sources/${encodedId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      console.log('Delete response:', response.status, data)
      
      if (!response.ok) {
        throw new Error(data.error || data.details || `Failed to delete source: ${response.statusText}`)
      }
      
      toast({
        title: "Success",
        description: data.message || "Source deleted successfully",
      })
      
      setSources(prevSources => prevSources.filter(source => source.id !== id))
    } catch (err) {
      console.error('Error deleting source:', err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete source',
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
      fetchSources()
    }
  }

  const handleView = (source: Source) => {
    window.open(source.url, '_blank', 'noopener,noreferrer')
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <FileVideo className="h-4 w-4" />
      case 'audio':
        return <FileAudio className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Sources</h2>
        <Button variant="ghost" size="sm" onClick={fetchSources} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <div className="flex justify-center items-center h-20">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <ul className="space-y-1">
          {sources.map((source) => (
            <li 
              key={source.id} 
              className="flex items-center justify-between space-x-2 hover:bg-accent p-1 rounded-md text-sm"
            >
              <div className="flex items-center space-x-2 flex-grow min-w-0">
                {getFileIcon(source.type)}
                <span className="truncate">{source.name}</span>
              </div>
              <div className="flex space-x-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(source)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(source.id)}
                  disabled={isDeleting === source.id}
                >
                  {isDeleting === source.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

