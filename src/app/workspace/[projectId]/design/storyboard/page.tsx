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
import { MessageSquareIcon, LayoutGridIcon, CameraIcon, InfoIcon, Wand2Icon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React, { useState } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useAgent } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Scene {
  id: string;
  description: string;
  layout_bbox: [number, number, number, number]; // [x, y, w, h]
  status: "pending" | "locked" | "rendered";
}

export default function StoryboardPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  usePhaseSync("storyboard");

  const { agent } = useAgent({ agentId: "default" });
  const scenes: Scene[] = agent?.state?.design?.scenes || [];
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const selectedScene = scenes.find(s => s.id === selectedSceneId) || scenes[0];

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/workspace" className="text-muted-foreground hover:text-foreground">Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Storyboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {!isChatOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChatOpen?.(true)}
            className="h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <MessageSquareIcon className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Open Assistant</span>
          </Button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Composition Viewport */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <CameraIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Composition Viewport</h1>
                <p className="text-xs text-muted-foreground">Visual layout and camera focus constraints</p>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="font-semibold px-4"
            >
              <Wand2Icon className="w-4 h-4 mr-2" />
              Regenerate Layout
            </Button>
          </div>

          <div className="flex-1 relative rounded-2xl bg-muted/20 border border-border shadow-inner overflow-hidden group">
            {selectedScene ? (
              <div className="absolute inset-0 flex flex-col">
                {/* Visual Bbox Overlay Container */}
                <div className="flex-1 relative bg-black/5 dark:bg-black/40 overflow-hidden">
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                  </div>

                  {/* The Bbox Visualizer */}
                  <div
                    className="absolute border-2 border-primary bg-primary/5 shadow-[0_0_50px_-12px_rgba(var(--primary),0.5)] transition-all duration-500 ease-in-out rounded-sm"
                    style={{
                      left: `${selectedScene.layout_bbox[0] * 100}%`,
                      top: `${selectedScene.layout_bbox[1] * 100}%`,
                      width: `${selectedScene.layout_bbox[2] * 100}%`,
                      height: `${selectedScene.layout_bbox[3] * 100}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-0 text-[10px] font-mono uppercase text-primary tracking-wider font-bold">
                      Subject Focus Area
                    </div>
                    {/* Corners for aesthetics */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary"></div>
                  </div>

                  {/* Camera Guides */}
                  <div className="absolute inset-x-0 top-1/3 border-t border-foreground/[0.03]"></div>
                  <div className="absolute inset-x-0 top-2/3 border-t border-foreground/[0.03]"></div>
                  <div className="absolute inset-y-0 left-1/3 border-l border-foreground/[0.03]"></div>
                  <div className="absolute inset-y-0 left-2/3 border-l border-foreground/[0.03]"></div>
                </div>

                {/* Info Panel Overlay */}
                <div className="p-6 bg-gradient-to-t from-background via-background/90 to-transparent pt-12">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold tracking-widest uppercase">
                          Scene {selectedScene.id.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest">
                          {selectedScene.status}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/80 line-clamp-3">
                        {selectedScene.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center animate-pulse">
                  <LayoutGridIcon className="w-8 h-8 text-muted-foreground/20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">No scenes detected</p>
                  <p className="text-xs text-muted-foreground px-12">
                    Ask the AI Assistant to decompose your script into a visual storyboard to begin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Scene List */}
        <div className="w-80 border-l border-border bg-background flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Storyboard Flow</h2>
            <p className="text-[10px] text-muted-foreground/60">Sequential scene breakdown</p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => setSelectedSceneId(scene.id)}
                  className={cn(
                    "group relative p-3 rounded-xl border transition-all duration-300 cursor-pointer",
                    selectedSceneId === scene.id || (!selectedSceneId && scenes[0]?.id === scene.id)
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-card border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-primary transition-colors">
                      #{scene.id.toUpperCase()}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2 italic font-serif">
                    "{scene.description}"
                  </p>

                  {/* Tiny Bbox Preview in Thumbnail */}
                  <div className="mt-3 h-12 w-full bg-black/5 dark:bg-black/40 rounded-md relative overflow-hidden">
                    <div
                      className="absolute border border-primary/40 bg-primary/10 rounded-[1px]"
                      style={{
                        left: `${scene.layout_bbox[0] * 100}%`,
                        top: `${scene.layout_bbox[1] * 100}%`,
                        width: `${scene.layout_bbox[2] * 100}%`,
                        height: `${scene.layout_bbox[3] * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}

              {scenes.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-30">
                  <InfoIcon className="w-5 h-5" />
                  <p className="text-[10px]">Decompose script to populate</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
