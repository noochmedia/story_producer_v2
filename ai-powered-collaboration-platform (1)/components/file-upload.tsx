"use client"

import { useState } from "react"
import { Upload } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface FileUploadProps {
  onUploadSuccess: () => void
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadProgress(0)
      setIsProcessing(true)
      setError(null)
      setSuccessMessage(null)

      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Upload failed')
        }

        const result = await response.json()
        console.log('File uploaded and processed:', result)
        setSuccessMessage(result.message)
        setUploadProgress(100)
        onUploadSuccess()
        toast({
          title: "Success",
          description: "File uploaded successfully",
        })
      } catch (err) {
        console.error('Error uploading file:', err)
        setError(err instanceof Error ? err.message : 'Failed to upload and process file')
        toast({
          title: "Error",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-2">
        <input
          type="file"
          className="hidden"
          id="file-upload"
          onChange={handleFileUpload}
          accept=".txt,.pdf,.doc,.docx,.mp3,.mp4,.avi,.mov"
        />
        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Drag and drop or click to upload</span>
        </label>
      </div>
      {uploadProgress > 0 && uploadProgress < 100 && (
        <Progress value={uploadProgress} className="w-full h-1" />
      )}
      {isProcessing && <p className="text-center text-xs">Processing file...</p>}
      {error && (
        <Alert variant="destructive" className="p-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" className="p-2">
          <AlertDescription className="text-xs">{successMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

