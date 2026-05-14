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

export default function AssetsPage() {
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
                <BreadcrumbLink href="#">Design</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Assets</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Project Assets</h1>
          <Button variant="default" size="sm">Upload Asset</Button>
        </div>

        <div className="grid auto-rows-min gap-4 md:grid-cols-4">
          <div className="aspect-square rounded-xl bg-muted/50 border border-dashed flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-muted/80 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold">M</div>
            <div>
              <p className="text-sm font-medium">Main Character</p>
              <p className="text-xs text-muted-foreground">Identity Profile</p>
            </div>
          </div>
          <div className="aspect-square rounded-xl bg-muted/50 border border-dashed flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-muted/80 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-500 text-xl font-bold">C</div>
            <div>
              <p className="text-sm font-medium">Cyber City Base</p>
              <p className="text-xs text-muted-foreground">Environment Ref</p>
            </div>
          </div>
          <div className="aspect-square rounded-xl bg-muted/20 border border-dashed flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer opacity-70">
            <p className="text-sm font-medium text-muted-foreground">+ Add New Asset</p>
          </div>
        </div>
      </div>
    </>
  )
}
