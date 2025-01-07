import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from "@/components/ui/button"

interface MediaViewerProps {
  files: Array<{
    id: string
    name: string
    type: 'video' | 'audio' | 'document'
    url: string
  }>
  initialFileIndex: number
}

export function MediaViewer({ files, initialFileIndex }: MediaViewerProps) {
  const [currentFileIndex, setCurrentFileIndex] = useState(initialFileIndex)
  const currentFile = files[currentFileIndex]

  const handlePrevious = () => {
    setCurrentFileIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : files.length - 1))
  }

  const handleNext = () => {
    setCurrentFileIndex((prevIndex) => (prevIndex < files.length - 1 ? prevIndex + 1 : 0))
  }

  const renderMediaContent = () => {
    switch (currentFile.type) {
      case 'video':
        return (
          <video controls className="w-full h-full">
            <source src={currentFile.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )
      case 'audio':
        return (
          <audio controls className="w-full">
            <source src={currentFile.url} type="audio/mpeg" />
            Your browser does not support the audio tag.
          </audio>
        )
      case 'document':
        return (
          <iframe
            src={currentFile.url}
            className="w-full h-full"
            title={currentFile.name}
          />
        )
      default:
        return <div>Unsupported file type</div>
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-2 bg-muted">
        <Button variant="ghost" size="icon" onClick={handlePrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{currentFile.name}</h2>
        <Button variant="ghost" size="icon" onClick={handleNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-grow overflow-hidden">
        {renderMediaContent()}
      </div>
    </div>
  )
}

