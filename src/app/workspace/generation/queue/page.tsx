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
import { WorkspaceContext } from "@/app/workspace/layout"
import React from "react"

export default function QueuePage() {
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
                <BreadcrumbLink href="/workspace">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">
                  Generation
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Render Queue</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Render Queue</h1>
          <Button variant="outline" size="sm">Refresh Status</Button>
        </div>
        
        <div className="flex-1 rounded-xl bg-background border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="p-4 border border-dashed rounded-lg flex justify-between items-center bg-muted/20">
                <div>
                    <h3 className="font-medium">Scene_01_Cyberpunk_City</h3>
                    <p className="text-xs text-muted-foreground">ComfyUI Cluster 1 - Base Render</p>
                </div>
                <div className="text-sm font-medium text-blue-500">Processing (45%)</div>
            </div>
            
            <div className="p-4 border border-dashed rounded-lg flex justify-between items-center bg-muted/20">
                <div>
                    <h3 className="font-medium">Scene_02_Dialogue_CloseUp</h3>
                    <p className="text-xs text-muted-foreground">ComfyUI Cluster 2 - Base Render</p>
                </div>
                <div className="text-sm font-medium text-muted-foreground">Queued</div>
            </div>
        </div>
      </div>
    </>
  )
}
