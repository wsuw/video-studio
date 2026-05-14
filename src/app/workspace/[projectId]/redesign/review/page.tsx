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
import { MessageSquareIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"

export default function ReviewPage() {
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
                <BreadcrumbPage>HITL Review</BreadcrumbPage>
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-orange-500">Pending Director Review</h1>
            <p className="text-sm text-muted-foreground">Agent execution halted via interrupt(). Waiting for human approval.</p>
          </div>
        </div>

        <div className="flex-1 rounded-xl bg-background border border-border shadow-sm p-6 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-6">
            <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center border border-dashed relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                <span>[Generated Clip Preview]</span>
                <span>Scene: Cyberpunk Dialogue</span>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <h3 className="font-medium text-sm mb-2">VLM QC Report (Automated)</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li className="text-green-500">Character Identity: Match (92%)</li>
                <li className="text-green-500">Layout/Bbox Constraints: Match (88%)</li>
                <li className="text-yellow-500">Temporal Consistency: Minor flicker detected on background light.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" className="flex items-center gap-2 text-red-500 hover:text-red-500 hover:bg-red-500/10">
                <XCircleIcon className="w-4 h-4" /> Reject & Reroute
              </Button>
              <Button variant="default" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2Icon className="w-4 h-4" /> Approve & Resume
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
