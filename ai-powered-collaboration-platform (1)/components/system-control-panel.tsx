import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface SystemControlState {
  project_scope: string
  external_knowledge: boolean
  web_search: boolean
  constraints: string[]
}

export function SystemControlPanel() {
  const [systemState, setSystemState] = useState<SystemControlState>({
    project_scope: '',
    external_knowledge: false,
    web_search: false,
    constraints: []
  })

  const handleToggle = (key: 'external_knowledge' | 'web_search') => {
    setSystemState(prevState => ({
      ...prevState,
      [key]: !prevState[key]
    }))
  }

  const updateSystemControl = async () => {
    // This would be replaced with an actual API call to your system control function
    const response = await fetch('/api/system-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(systemState)
    })
    const result = await response.json()
    setSystemState(result)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Control Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="external-knowledge"
              checked={systemState.external_knowledge}
              onCheckedChange={() => handleToggle('external_knowledge')}
            />
            <Label htmlFor="external-knowledge">Enable External Knowledge</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="web-search"
              checked={systemState.web_search}
              onCheckedChange={() => handleToggle('web_search')}
            />
            <Label htmlFor="web-search">Authorize Web Search</Label>
          </div>
          <Button onClick={updateSystemControl}>Update System Control</Button>
        </div>
      </CardContent>
    </Card>
  )
}

