"use client"

import React, { useState } from 'react'
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"

export function Sources() {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

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
      <h2 className="text-lg font-semibold">Upload Sources</h2>
      <div className="flex items-center gap-4">
        <Button
          onClick={() => document.getElementById('sources-file-upload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Select Files'}
        </Button>
        <input
          id="sources-file-upload"
          type="file"
          multiple // Enable multiple file selection
          onChange={handleUpload}
          className="hidden"
          accept=".txt,.pdf,.docx" // Accept common text and document formats
        />
      </div>
    </div>
  )
}
