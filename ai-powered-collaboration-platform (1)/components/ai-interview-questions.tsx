import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function AIInterviewQuestions() {
  const [questions, setQuestions] = useState<string[]>([])

  const generateQuestions = async () => {
    // This would be replaced with an actual API call to your AI question generation system
    const response = await fetch('/api/generate-questions')
    const result = await response.json()
    setQuestions(result.questions)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-Assisted Interview Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={generateQuestions}>Generate Questions</Button>
        {questions.length > 0 && (
          <Textarea
            value={questions.join('\n')}
            readOnly
            className="h-40"
          />
        )}
      </CardContent>
    </Card>
  )
}

