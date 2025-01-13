import React from 'react'
import { AIChat } from './ai-chat'
import { ProjectProvider } from '../lib/project-context'

export function MainDashboard() {
  return (
    <ProjectProvider>
      <div className="container mx-auto p-4 space-y-4">
        <h1 className="text-xs text-muted-foreground">Your uploaded content is stored securely on our private servers. Only the relevant parts of your content are used to generate responses, and these are never stored or used for any other purpose outside of this application.</h1>
        <AIChat />
      </div>
    </ProjectProvider>
  )
}
