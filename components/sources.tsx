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
      // Create FormData with file
      const formData = new FormData()
      // For now, just upload the first file
      const file = files[0] as File
      formData.append('file', file)

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
        description: "File uploaded successfully",
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
    </div>
  )
}
