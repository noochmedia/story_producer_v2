import { AIChat } from './ai-chat'

export function MainDashboard() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">STORY TOOLS Dashboard</h1>
      <div className="grid grid-cols-1 gap-4">
        <AIChat />
      </div>
    </div>
  )
}

