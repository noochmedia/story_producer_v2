import React from 'react'
import { AIChat } from './ai-chat'
import { Sources } from './sources'
import { ProjectDetails } from './project-details'
import { Sidebar } from './ui/sidebar'

export function MainDashboard() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-sm text-muted-foreground">Your uploaded content is stored securely on our private servers. Only your team has direct access to it. The AI cannot access your files directly or store them. The content that you upload and share is not added to any AI training data.</h1>
      <div className="w-full">
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Reflect 1.0 <i>(Beta)</i></h2>
          <AIChat />
        </div>
      </div>
    </div>
  )
}
