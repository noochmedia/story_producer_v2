"use client"

import { Button } from "@/components/ui/button"

export function ClientSideHeader() {
  return (
    <div className="flex items-center space-x-4">
      <Button variant="ghost" onClick={() => console.log("Dashboard clicked")}>Dashboard</Button>
      <Button variant="ghost" onClick={() => console.log("Projects clicked")}>Projects</Button>
      <Button variant="ghost" onClick={() => console.log("Team clicked")}>Team</Button>
    </div>
  )
}

