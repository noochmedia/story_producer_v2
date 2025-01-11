"use client"

import * as React from 'react'
import { useState } from 'react'
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { useToast } from "./ui/use-toast"
import { useProject } from "../lib/project-context"

export function ProjectDetails() {
  const { projectDetails, setProjectDetails, refreshProjectDetails } = useProject()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const saveDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/project-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: projectDetails })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Project details saved successfully.",
        })
        // Refresh project details to ensure we have the latest version
        await refreshProjectDetails()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error('Error saving project details:', error)
      toast({
        title: "Error",
        description: `Failed to save project details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Project Details</h2>
      <Textarea
        value={projectDetails}
        onChange={(e) => setProjectDetails(e.target.value)}
        placeholder="Add your project details. The more information you provide, the better the results will be."
        className="h-40"
      />
      <Button onClick={saveDetails} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Details'}
      </Button>
    </div>
  )
}
