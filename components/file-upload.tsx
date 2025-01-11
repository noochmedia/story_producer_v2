"use client"

import { useState } from "react"
import { Upload, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

interface FileUploadProps {
  onUploadSuccess: () => void
}

interface FileStatus {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const MAX_FILES = 50;

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    // Check file limit
    if (files.length + selectedFiles.length > MAX_FILES) {
      toast({
        title: "Error",
        description: `Maximum ${MAX_FILES} files allowed at once`,
        variant: "destructive",
      });
      return;
    }

    // Add new files to the queue
    const newFiles: FileStatus[] = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    if (files[index].status !== 'uploading') {
      setFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadFile = async (fileStatus: FileStatus, index: number) => {
    const formData = new FormData();
    formData.append('file', fileStatus.file);

    try {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'uploading' } : f
      ));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'success', progress: 100 } : f
      ));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: 'error', error: errorMessage } : f
      ));
      return false;
    }
  };

  const uploadAllFiles = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    const pendingFiles = files.filter(f => f.status === 'pending');
    let successCount = 0;
    let failureCount = 0;

    // Upload files in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
      const batch = pendingFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(file => {
          const index = files.findIndex(f => f === file);
          return uploadFile(file, index);
        })
      );

      successCount += results.filter(Boolean).length;
      failureCount += results.filter(r => !r).length;
    }

    setIsProcessing(false);

    if (successCount > 0) {
      setSuccessMessage(`Successfully uploaded ${successCount} file${successCount === 1 ? '' : 's'}`);
      onUploadSuccess();
    }

    if (failureCount > 0) {
      setError(`Failed to upload ${failureCount} file${failureCount === 1 ? '' : 's'}`);
    }

    // Clear successful uploads
    setFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-4">
        <input
          type="file"
          className="hidden"
          id="file-upload"
          onChange={handleFileSelect}
          accept=".txt,.pdf,.doc,.docx,.mp3,.mp4,.avi,.mov"
          multiple
        />
        <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            Drag and drop or click to upload (max {MAX_FILES} files)
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <ScrollArea className="h-[200px] rounded-md border p-4">
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-muted rounded"
                  disabled={file.status === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className="truncate">{file.file.name}</span>
                    <span className="text-muted-foreground">
                      {file.status === 'success' && 'Uploaded'}
                      {file.status === 'error' && 'Failed'}
                      {file.status === 'uploading' && 'Uploading...'}
                      {file.status === 'pending' && 'Pending'}
                    </span>
                  </div>
                  {file.status === 'uploading' && (
                    <Progress value={file.progress} className="h-1 mt-1" />
                  )}
                  {file.status === 'error' && (
                    <p className="text-xs text-destructive mt-1">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {pendingCount > 0 && (
        <Button 
          onClick={uploadAllFiles} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? 'Uploading...' : `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}`}
        </Button>
      )}

      {error && (
        <Alert variant="destructive" className="p-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert className="p-2">
          <AlertDescription className="text-xs">{successMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
