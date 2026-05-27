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
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React from "react"
import { useConfigureSuggestions } from "@copilotkit/react-core/v2"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useParams } from "next/navigation"
import Link from "next/link"

export default function TimelinePage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const params = useParams();
  const locale = (params.locale as string) || "en";

  usePhaseSync("distribution");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Align Video Tracks",
        message: "Compile and sequence all rendered scene clips on the timeline. Align them with their generated voiceovers and background music tracks.",
      }
    ],
    available: "always"
  });

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
                <BreadcrumbLink asChild>
                  <Link href={`/${locale}/studio`}>Studio</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Distribution</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Timeline</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Timeline & Composition</h1>
          <Button variant="default" size="sm">Render Sequence</Button>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className="aspect-video max-w-2xl mx-auto w-full bg-black rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
            <span className="text-white/50 text-sm">Preview Monitor</span>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full opacity-70">{"<"}</Button>
              <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full opacity-70">{"||"}</Button>
              <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full opacity-70">{">"}</Button>
            </div>
          </div>

          <div className="flex-1 bg-muted/30 rounded-xl border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-b border-border pb-2">
              <div className="w-24">Tracks</div>
              <div className="flex-1 flex justify-between px-2">
                <span>00:00:00</span>
                <span>00:00:15</span>
                <span>00:00:30</span>
                <span>00:00:45</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 text-xs font-medium">Video (V1)</div>
              <div className="flex-1 h-12 bg-background border border-border rounded relative">
                <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-blue-500/20 border-r border-blue-500 flex items-center px-2 text-xs text-blue-500">Scene 1</div>
                <div className="absolute left-1/3 top-0 bottom-0 w-1/3 bg-blue-500/20 border-r border-blue-500 flex items-center px-2 text-xs text-blue-500">Scene 2</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 text-xs font-medium">Dialogue (A1)</div>
              <div className="flex-1 h-10 bg-background border border-border rounded relative">
                <div className="absolute left-[5%] top-0 bottom-0 w-1/4 bg-green-500/20 border-r border-green-500 flex items-center px-2 text-xs text-green-500">TTS Audio 1</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 text-xs font-medium">SFX (A2)</div>
              <div className="flex-1 h-10 bg-background border border-border rounded relative">
                <div className="absolute left-[20%] top-0 bottom-0 w-1/6 bg-amber-500/20 border-r border-amber-500 flex items-center px-2 text-xs text-amber-500">Rain SFX</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
