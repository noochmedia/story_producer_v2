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
  const [isUploading, setIsUploading] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    
    setIsUploading(true)
    const files = Array.from(event.target.files);
    
    try {
      // Create FormData with multiple files
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      
      toast({
        title: "Success",
        description: `${files.length} file${files.length === 1 ? '' : 's'} uploaded successfully.`,
      })

      // Refresh sources list after successful upload
      fetchSources()
    } catch (error) {
      console.error('Error uploading files:', error)
      toast({
        title: "Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Upload Sources</h2>
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
      
      <div className="flex items-center gap-4">
        <Button
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Select Files'}
        </Button>
        <input
          id="file-upload"
          type="file"
          multiple // Enable multiple file selection
          onChange={handleUpload}
          className="hidden"
          accept=".txt,.pdf,.docx" // Accept common text and document formats
        />
      </div>

      {showSources && (
        <div className="space-y-4">
          {isLoading ? (
            <p>Loading sources...</p>
          ) : sources.length > 0 ? (
            <div className="space-y-4">
              {sources.map((source) => (
                <div key={source.id} className="p-4 border rounded-lg">
                  <h3 className="font-medium">{source.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {source.content.substring(0, 200)}...
                  </p>
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
