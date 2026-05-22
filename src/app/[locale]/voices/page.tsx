import React from "react"
import fs from "fs"
import path from "path"
import { VoiceViewer } from "@/components/voices/voice-viewer"
import { AppSidebar } from "@/app/[locale]/studio/app-sidebar"
import { SiteHeader } from "@/app/[locale]/studio/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function VoicesPage() {
  // Read our global voice catalog dynamically on the server
  const filePath = path.join(process.cwd(), "speech-samples", "_voices_local.json")
  let voices = []

  try {
    const fileContent = fs.readFileSync(filePath, "utf8")
    voices = JSON.parse(fileContent)
  } catch (error) {
    console.error("Failed to read local voice database:", error)
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="relative flex flex-col min-h-screen">
        <SiteHeader title="Voice Library" />

        {/* Main Content Area: Dynamic Glassmorphic Showcase */}
        <div className="flex-1 bg-slate-50/60 dark:bg-zinc-950/40 p-4 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto space-y-6">
            <VoiceViewer initialVoices={voices} />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
