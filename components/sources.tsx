"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"

interface Source {
  id: string;
  fileName: string;
  preview: string;
  uploadedAt: string;
}

export function Sources() {
  const [isUploading, setIsUploading] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const { toast } = useToast()

  // Fetch sources
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch('/api/sources')
        if (!response.ok) {
          throw new Error('Failed to fetch sources')
        }
        const data = await response.json()
        if (data.success) {
          setSources(data.sources)
        }
      } catch (error) {
        console.error('Error fetching sources:', error)
      }
    }

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

      // Refresh sources list
      const sourcesResponse = await fetch('/api/sources')
      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json()
        if (sourcesData.success) {
          setSources(sourcesData.sources)
        }
      }
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
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Upload Sources</h2>
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
            multiple
            onChange={handleUpload}
            className="hidden"
            accept=".txt,.pdf,.docx"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Uploaded Sources</h2>
        {sources.length > 0 ? (
          <div className="space-y-4">
            {sources.map(source => (
              <div key={source.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium">{source.fileName}</h3>
                  <span className="text-sm text-gray-500">
                    {new Date(source.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{source.preview}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No sources uploaded yet.</p>
        )}
      </div>
    </div>
  )
}
