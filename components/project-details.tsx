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
  const [isEditing, setIsEditing] = useState(false)
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

  const handleSave = async () => {
    await saveDetails();
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm text-muted-foreground">Project Details</h2>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={projectDetails}
            onChange={(e) => setProjectDetails(e.target.value)}
            placeholder="Add your project details. The more information you provide, the better the results will be."
            className="h-40 text-sm"
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : projectDetails ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {projectDetails}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No project details added yet.
        </p>
      )}
    </div>
  )
}
