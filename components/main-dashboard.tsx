import React from 'react'
import { AIChat } from './ai-chat'
import { Sources } from './sources'
import { ProjectDetails } from './project-details'
import { ProjectProvider } from '../lib/project-context'

export function MainDashboard() {
  return (
    <ProjectProvider>
      <div className="container mx-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <ProjectDetails />
            <Sources />
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-4">Reflect 1.0 <i>(Beta)</i></h2>
            <AIChat />
          </div>
        </div>
      </div>
    </ProjectProvider>
  )
}
