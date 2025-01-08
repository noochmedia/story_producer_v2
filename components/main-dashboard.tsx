import { AIChat } from './ai-chat'

export function MainDashboard() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">STORY TOOLS Dashboard</h1>
      <div className="w-full">
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">AI Chat</h2>
          <AIChat />
        </div>
      </div>
    </div>
  )
}

