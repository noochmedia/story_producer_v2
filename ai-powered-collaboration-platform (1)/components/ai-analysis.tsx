import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AIAnalysisProps {
  analysis: {
    summary: string
    keywords: string[]
    sentiment: string
    citations: string[]
  }
}

export function AIAnalysis({ analysis }: AIAnalysisProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>{analysis.summary}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, index) => (
              <span key={index} className="bg-muted px-2 py-1 rounded-full text-sm">
                {keyword}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sentiment</CardTitle>
        </CardHeader>
        <CardContent>{analysis.sentiment}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Citations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-4">
            {analysis.citations.map((citation, index) => (
              <li key={index}>{citation}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

