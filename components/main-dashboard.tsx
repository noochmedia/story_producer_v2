import React from 'react'
import { AIChat } from './ai-chat'
import { ProjectProvider } from '../lib/project-context'

export function MainDashboard() {
  return (
    <ProjectProvider>
      <div className="container mx-auto p-4 min-h-screen flex flex-col">
        <h1 className="text-xs text-muted-foreground mb-4">Your uploaded content is stored securely on our private servers. Only the relevant parts of your content are used to generate responses, and these are never stored or used for any other purpose outside of this application.</h1>
        <div className="flex-1">
          <AIChat />
        </div>
      </div>
    </ProjectProvider>
  )
}
