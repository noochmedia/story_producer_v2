import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart } from '@/components/ui/line-chart'

interface KeywordData {
  keyword: string
  occurrences: { timestamp: string; count: number }[]
}

export function KeywordTracking() {
  const [keyword, setKeyword] = useState('')
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null)

  const trackKeyword = async () => {
    // This would be replaced with an actual API call to your keyword tracking system
    const response = await fetch('/api/track-keyword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    })
    const result = await response.json()
    setKeywordData(result)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword Tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Enter keyword to track"
        />
        <Button onClick={trackKeyword}>Track Keyword</Button>
        {keywordData && (
          <LineChart
            data={keywordData.occurrences}
            xKey="timestamp"
            yKey="count"
            label={keywordData.keyword}
          />
        )}
      </CardContent>
    </Card>
  )
}

