import React from 'react'
import { AIChat } from './ai-chat'
import { Sources } from './sources'
import { ProjectDetails } from './project-details'
import { ProjectProvider } from '../lib/project-context'
import { 
  Sidebar, 
  SidebarContent,
  SidebarProvider 
} from './ui/sidebar'

export function MainDashboard() {
  return (
    <ProjectProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen">
          <Sidebar>
            <SidebarContent>
              <ProjectDetails />
              <Sources />
            </SidebarContent>
          </Sidebar>
          <div className="flex-1 p-4">
            <h1 className="text-sm text-muted-foreground mb-4">Your uploaded content is stored securely on our private servers. Only the relevant parts of your content are used to generate responses, and these are never stored or used for any other purpose outside of this application.</h1>
            <div className="p-4 border rounded-lg bg-card">
              <h2 className="text-xl font-semibold mb-4">Reflect 1.0 <i>(Beta)</i></h2>
              <AIChat />
            </div>
          </div>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  )
}
