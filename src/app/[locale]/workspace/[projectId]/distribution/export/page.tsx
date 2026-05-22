"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { MessageSquareIcon, DownloadIcon, SmartphoneIcon, MonitorIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React from "react"

export default function ExportPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/workspace">Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Distribution</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Export</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {!isChatOpen && (
          <div className="flex items-center pr-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen?.(true)}
              className="flex items-center gap-2 h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <MessageSquareIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Open Assistant</span>
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Export & Distribution</h1>
        </div>

        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          <div className="bg-background border border-border shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2"><MonitorIcon className="w-5 h-5" /> Cinematic Format (16:9)</h2>
            <p className="text-sm text-muted-foreground mb-6">Original raw composition perfect for YouTube or internal review.</p>

            <div className="aspect-video bg-muted/50 rounded-lg border border-dashed mb-6 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Preview 16:9</span>
            </div>

            <Button className="w-full gap-2"><DownloadIcon className="w-4 h-4" /> Export MP4 (4K)</Button>
          </div>

          <div className="bg-background border border-border shadow-sm rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">AI AUTO CROP</div>
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2"><SmartphoneIcon className="w-5 h-5" /> Social Format (9:16)</h2>
            <p className="text-sm text-muted-foreground mb-6">Automatically cropped using visual anchor points for TikTok/Shorts.</p>

            <div className="flex justify-center mb-6">
              <div className="aspect-[9/16] h-40 bg-muted/50 rounded border border-dashed flex items-center justify-center">
                <span className="text-xs text-muted-foreground">9:16</span>
              </div>
            </div>

            <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"><DownloadIcon className="w-4 h-4" /> Export Short (1080p)</Button>
          </div>
        </div>
      </div>
    </>
  )
}
