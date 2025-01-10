"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"
import { Upload } from 'lucide-react'

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
        formData.append('files', file as File)
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
      
      <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-4">
        <input
          type="file"
          className="hidden"
          id="file-upload"
          onChange={handleUpload}
          multiple
          accept=".txt,.pdf,.docx"
        />
        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Drag and drop or click to upload</span>
        </label>
      </div>

      {showSources && (
        <div className="space-y-4">
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
