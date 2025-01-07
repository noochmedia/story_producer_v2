"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ProjectDetails() {
  const [details, setDetails] = useState('')

  const saveDetails = async () => {
    // This would be replaced with an actual API call to save the project details
    await fetch('/api/save-project-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ details })
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Project Details</h2>
      <Textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Enter project details..."
        className="h-40"
      />
      <Button onClick={saveDetails}>Save Details</Button>
    </div>
  )
}

