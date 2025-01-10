import * as React from "react"
import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { Providers } from "../components/providers"

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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
