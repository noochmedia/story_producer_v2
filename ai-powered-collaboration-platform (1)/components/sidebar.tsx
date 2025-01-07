import { FileUpload } from "./file-upload"
import { RecentFiles } from "./recent-files"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectDetails } from "./project-details"

const recentFiles = [
  { id: '1', name: "Project Proposal.docx", type: "document" as const, url: "/placeholder.pdf" },
  { id: '2', name: "Meeting Recording.mp4", type: "video" as const, url: "/placeholder.mp4" },
  { id: '3', name: "Podcast Episode.mp3", type: "audio" as const, url: "/placeholder.mp3" },
]

export function Sidebar() {
  return (
    <aside className="w-80 border-r flex flex-col h-screen">
      <div className="p-4 border-b">
        <div className="text-2xl font-bold">STORY TOOLS</div>
        <div className="text-sm text-muted-foreground">Producer v1</div>
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
            <FileUpload />
          </CardContent>
        </Card>
        
        <Card className="flex-grow overflow-hidden flex flex-col">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg">Recent Files</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 overflow-y-auto flex-grow">
            <RecentFiles files={recentFiles} />
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}

