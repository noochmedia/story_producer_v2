import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AIChat } from "@/components/ai-chat"
import { AIMemory } from "@/components/ai-memory"

export function Dashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>AI Chat with Source Analysis, Web Research & Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <AIChat />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>AI Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <AIMemory />
        </CardContent>
      </Card>
    </div>
  )
}

