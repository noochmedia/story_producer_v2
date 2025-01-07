"use client"

import { File, FileAudio, FileVideo } from 'lucide-react'

interface RecentFilesProps {
  files: Array<{
    id: string
    name: string
    type: 'video' | 'audio' | 'document'
    url: string
  }>
}

export function RecentFiles({ files }: RecentFilesProps) {
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

  const handleFileSelect = (index: number) => {
    console.log(`File selected: ${files[index].name}`)
  }

  return (
    <ul className="space-y-1">
      {files.map((file, index) => (
        <li 
          key={file.id} 
          className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-1 rounded-md text-sm"
          onClick={() => handleFileSelect(index)}
        >
          {getFileIcon(file.type)}
          <span className="truncate">{file.name}</span>
        </li>
      ))}
    </ul>
  )
}

