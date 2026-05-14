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

export default function ExecutionPage() {
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
                <BreadcrumbLink href="#">Generation</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Execution</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Execution Monitor</h1>
          <Button variant="outline" size="sm">Halt Pipeline</Button>
        </div>

        <div className="flex-1 rounded-xl bg-background border border-border shadow-sm p-6">
          <h3 className="text-lg font-medium mb-4">LangGraph Pipeline Status</h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 p-4 rounded bg-muted/30 border border-dashed border-green-500/30">
              <div className="flex justify-between">
                <span className="font-medium text-green-500">Node: Design Phase</span>
                <span className="text-xs text-green-500">Completed (1m 23s)</span>
              </div>
              <p className="text-xs text-muted-foreground">Logline, Synopsis, Treatment and Locked Script generated.</p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded bg-primary/5 border border-dashed border-primary">
              <div className="flex justify-between">
                <span className="font-medium text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Node: Generation Phase
                </span>
                <span className="text-xs text-primary">Running...</span>
              </div>
              <p className="text-xs text-muted-foreground">Dispatching MCP tools to ComfyUI backend.</p>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded bg-muted/20 border border-dashed opacity-50">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Node: QC & Redesign Phase</span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
