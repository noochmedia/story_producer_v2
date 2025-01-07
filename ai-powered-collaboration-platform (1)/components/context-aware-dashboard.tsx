import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ContextStatus {
  topic_continuity: boolean
  character_focus: string | null
  reference_type: 'direct' | 'indirect' | 'none'
  context_shift: boolean
}

interface References {
  characters: string[]
  topics: string[]
  transcripts: string[]
}

interface SuggestedAction {
  prompt_type: string
  focus: string
  include_history: boolean
}

interface ContextCheckResult {
  context_status: ContextStatus
  references: References
  suggested_action: SuggestedAction
}

export function ContextAwareDashboard() {
  const [contextCheck, setContextCheck] = useState<ContextCheckResult | null>(null)

  useEffect(() => {
    const fetchContextCheck = async () => {
      // This would be replaced with an actual API call to your context check system
      const response = await fetch('/api/context-check')
      const result = await response.json()
      setContextCheck(result)
    }

    fetchContextCheck()
    // Set up a periodic refresh
    const intervalId = setInterval(fetchContextCheck, 30000) // Refresh every 30 seconds

    return () => clearInterval(intervalId)
  }, [])

  if (!contextCheck) return <div>Loading context...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Context-Aware Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Context Status</h3>
            <p>Topic Continuity: {contextCheck.context_status.topic_continuity ? 'Maintained' : 'Shifted'}</p>
            <p>Character Focus: {contextCheck.context_status.character_focus || 'None'}</p>
            <p>Reference Type: {contextCheck.context_status.reference_type}</p>
            <p>Context Shift: {contextCheck.context_status.context_shift ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <h3 className="font-semibold">References</h3>
            <div className="flex flex-wrap gap-2">
              {contextCheck.references.characters.map((character, index) => (
                <Badge key={index} variant="secondary">{character}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {contextCheck.references.topics.map((topic, index) => (
                <Badge key={index} variant="outline">{topic}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {contextCheck.references.transcripts.map((transcript, index) => (
                <Badge key={index}>{transcript}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Suggested Action</h3>
            <p>Prompt Type: {contextCheck.suggested_action.prompt_type}</p>
            <p>Focus: {contextCheck.suggested_action.focus}</p>
            <p>Include History: {contextCheck.suggested_action.include_history ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

