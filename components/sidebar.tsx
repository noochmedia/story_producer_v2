"use client"

import { useState, useCallback } from 'react'
import { FileUpload } from "./file-upload"
import { Sources } from "./sources"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectDetails } from "./project-details"

export function Sidebar() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1)
  }, [])

  return (
    <aside className="w-80 border-r flex flex-col h-screen">
      <div className="p-4 border-b">
        <div className="text-2xl font-bold">STORY TOOLS</div>
        <div className="text-sm text-muted-foreground">Producer v2</div>
      </div>
      <div className="flex-grow flex flex-col p-4 space-y-4 overflow-hidden">
        <Card className="flex-shrink-0">
          <CardContent className="p-4">
            <ProjectDetails />
          </CardContent>
        </Card>
        <Card className="flex-shrink-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">File Upload</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <FileUpload onUploadSuccess={handleRefresh} />
          </CardContent>
        </Card>
        
        <Card className="flex-grow overflow-hidden flex flex-col">
          <CardContent className="p-4 overflow-y-auto flex-grow">
            <Sources key={refreshKey} />
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
