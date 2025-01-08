import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { MainDashboard } from "@/components/main-dashboard"
 
export default function Home() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4">
          <MainDashboard />
        </main>
      </div>
    </div>
  )
}
