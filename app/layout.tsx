import * as React from "react"
import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { ThemeProvider } from "../components/theme-provider"
import { ProjectProvider } from "../lib/project-context"
import { Toaster } from "../components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "STORY TOOLS - Producer v2",
  description: "Secure file sharing and AI-assisted project management",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ProjectProvider>
            {children}
            <Toaster />
          </ProjectProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
