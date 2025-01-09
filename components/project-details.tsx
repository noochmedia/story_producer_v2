"use client"

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { useToast } from "./ui/use-toast"

export function ProjectDetails() {
  const [details, setDetails] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        const response = await fetch('/api/project-details')
        if (response.ok) {
          const data = await response.json()
          setDetails(data.details || '')
        } else {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
      } catch (error) {
        console.error('Error fetching project details:', error)
        toast({
          title: "Error",
          description: "Failed to load project details. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchProjectDetails()
  }, [toast])

  const saveDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/project-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast({
            title: "Success",
            description: "Project details saved successfully.",
          })
        } else {
          throw new Error(data.error || 'Unknown error occurred')
        }
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
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Add your project details. The more information you provide, the better the results will be."
        className="h-40"
      />
      <Button onClick={saveDetails} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Details'}
      </Button>
    </div>
  )
}
