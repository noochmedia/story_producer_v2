import { Bell, Search, Settings } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ClientSideHeader } from "./client-side-header"

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <ClientSideHeader />
      <div className="flex items-center space-x-4">
        <Input
          type="search"
          placeholder="Search files, projects..."
          className="w-64"
        />
        <Button variant="ghost" size="icon">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
        <Avatar>
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

