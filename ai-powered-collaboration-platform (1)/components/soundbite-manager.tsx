import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Soundbite {
  source: string
  location: string
  speaker: string
  quote: string
  context: string
  relevance: string
}

export function SoundbitesManager() {
  const [searchQuery, setSearchQuery] = useState('')
  const [foundSoundbites, setFoundSoundbites] = useState<Soundbite[]>([])
  const [compositeSoundbite, setCompositeSoundbite] = useState('')

  const handleSearch = async () => {
    // This would be replaced with an actual API call to your soundbite search system
    const response = await fetch('/api/find-soundbites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery })
    })
    const result = await response.json()
    setFoundSoundbites(result.soundbites)
  }

  const handleCreateComposite = async () => {
    // This would be replaced with an actual API call to your soundbite creation system
    const response = await fetch('/api/create-soundbite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundbites: foundSoundbites })
    })
    const result = await response.json()
    setCompositeSoundbite(result.compositeSoundbite)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soundbites Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="find">
          <TabsList>
            <TabsTrigger value="find">Find Soundbites</TabsTrigger>
            <TabsTrigger value="create">Create Composite</TabsTrigger>
          </TabsList>
          <TabsContent value="find">
            <div className="space-y-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search query..."
              />
              <Button onClick={handleSearch}>Search</Button>
              {foundSoundbites.map((soundbite, index) => (
                <Card key={index}>
                  <CardContent>
                    <p><strong>Source:</strong> {soundbite.source}</p>
                    <p><strong>Location:</strong> {soundbite.location}</p>
                    <p><strong>Speaker:</strong> {soundbite.speaker}</p>
                    <p><strong>Quote:</strong> "{soundbite.quote}"</p>
                    <p><strong>Context:</strong> {soundbite.context}</p>
                    <p><strong>Relevance:</strong> {soundbite.relevance}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="create">
            <div className="space-y-4">
              <Button onClick={handleCreateComposite}>Create Composite Soundbite</Button>
              {compositeSoundbite && (
                <Textarea
                  value={compositeSoundbite}
                  readOnly
                  className="h-40"
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

