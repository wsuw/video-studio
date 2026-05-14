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

export default function CorrectionPage() {
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
                <BreadcrumbLink href="#">Redesign</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Correction</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Atomic Correction</h1>
          <Button variant="default" size="sm">Apply Inpaint</Button>
        </div>

        <div className="flex-1 rounded-xl bg-background border border-border shadow-sm p-6 grid grid-cols-3 gap-6">
          <div className="col-span-2 aspect-video bg-muted/50 rounded-lg flex items-center justify-center border border-dashed relative">
            <span className="text-muted-foreground text-sm">Draw Bbox to define re-paint area</span>
            <div className="absolute w-32 h-32 border-2 border-primary bg-primary/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-dashed"></div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <h3 className="font-medium text-sm mb-2">Routing Strategy</h3>
              <p className="text-xs text-muted-foreground mb-4">Select the specific agent/model to fix the localized issue.</p>

              <div className="space-y-2">
                <div className="p-2 text-sm border rounded bg-primary/5 border-primary cursor-pointer">
                  Identify Agent (Fix Face/IP-Adapter)
                </div>
                <div className="p-2 text-sm border rounded bg-background cursor-pointer hover:bg-muted/50">
                  Layout Agent (Fix Composition)
                </div>
                <div className="p-2 text-sm border rounded bg-background cursor-pointer hover:bg-muted/50">
                  Lighting/ControlNet Agent
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border flex-1">
              <h3 className="font-medium text-sm mb-2">Correction Prompt</h3>
              <textarea className="w-full h-32 bg-background border border-border rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Describe what needs to change inside the bounding box..."></textarea>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
