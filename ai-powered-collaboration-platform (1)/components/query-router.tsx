import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const routeQuery = async (query: string) => {
  // This would be replaced with an actual API call to your routing system
  const response = await fetch('/api/route-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  return response.json()
}

export function QueryRouter() {
  const [query, setQuery] = useState('')
  const [routingResult, setRoutingResult] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await routeQuery(query)
    setRoutingResult(result.promptType)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Router</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
          />
          <Button type="submit">Route Query</Button>
        </form>
        {routingResult && (
          <div className="mt-4">
            <p>Routed to: {routingResult}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

