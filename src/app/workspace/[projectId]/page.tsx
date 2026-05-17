"use client"

import { AppSidebar } from "@/app/workspace/[projectId]/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { Button } from "@/components/ui/button"
import { PanelRightIcon, MessageSquareIcon } from "lucide-react"

import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { useParams } from "next/navigation";

export default function Page() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const params = useParams();
  const projectId = params?.projectId;

  const [projectName, setProjectName] = React.useState("Project Name");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("video-agent:projects");
      if (stored) {
        const storedProjects = JSON.parse(stored);
        const current = storedProjects.find((p: any) => p.id === projectId);
        if (current) {
          setProjectName(current.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

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
                <BreadcrumbLink href="/studio">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{projectName}</BreadcrumbPage>
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
      <div className="flex flex-1 flex-col gap-4 p-4 pt-4">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
        </div>
        <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  )
}
