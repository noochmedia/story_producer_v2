"use client"

import * as React from 'react'
import { ThemeProvider } from "./theme-provider"
import { ProjectProvider } from "../lib/project-context"
import { Toaster } from "./ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
