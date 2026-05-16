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
import { MessageSquareIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"

export default function StoryboardPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  usePhaseSync("storyboard");

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
                <BreadcrumbLink href="/workspace">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">
                  Design
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Storyboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* 右侧助手开关 */}
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
          <h1 className="text-2xl font-bold tracking-tight">Visual Storyboard</h1>
          <Button variant="default" size="sm">Generate Layouts</Button>
        </div>

        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="aspect-video rounded-xl bg-muted/50 border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Scene 1 (Pending Bbox)</span>
          </div>
          <div className="aspect-video rounded-xl bg-muted/50 border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Scene 2 (Pending Bbox)</span>
          </div>
          <div className="aspect-video rounded-xl bg-muted/50 border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Scene 3 (Pending Bbox)</span>
          </div>
        </div>
        <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min border border-dashed flex items-center justify-center mt-4">
          <span className="text-muted-foreground text-sm">Select a scene to view detailed layout constraints</span>
        </div>
      </div>
    </>
  )
}
