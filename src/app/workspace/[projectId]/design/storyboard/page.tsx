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
import { MessageSquareIcon, LayoutGridIcon, CameraIcon, InfoIcon, Wand2Icon, CompassIcon, VideoIcon, EyeIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React, { useState } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useAgent } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useRouter, useParams } from "next/navigation"
import { getThreadState } from "@/lib/langgraph"


interface LayoutElement {
  entity_id: string;
  bbox: [number, number, number, number];
}

interface Scene {
  id: string;
  description: string;
  entities?: string[];
  layout_bbox?: [number, number, number, number];
  layout?: LayoutElement[];
  status: "pending" | "locked" | "rendered";
  lens?: string;
  shot_type?: string;
  motion?: string;
}

// Preset high-contrast concept art / storyboard pencil sketch lines
const STORYBOARD_SKETCHES: Record<string, string[]> = {
  cyberpunk: [
    "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800&auto=format&fit=crop", // Glitch grid blueprint
    "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=800&auto=format&fit=crop", // Architectural outline
    "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=800&auto=format&fit=crop", // Grid drafting paper
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop"  // Concept lines
  ],
  noir: [
    "https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?q=80&w=800&auto=format&fit=crop", // Dark ink wash sketch
    "https://images.unsplash.com/photo-1533230898528-765be5d3c8c2?q=80&w=800&auto=format&fit=crop"
  ],
  anime: [
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop", // Manga layout line-art
    "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop"
  ],
  unreal: [
    "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop", // Technical wireframe grid
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop"
  ]
};

export default function StoryboardPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  usePhaseSync("storyboard");

  const { agent } = useAgent({ agentId: "default" });
  
  // Local state for data loaded directly from LangGraph checkpoint
  const [loadedDesign, setLoadedDesign] = React.useState<any>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  // On mount: fetch persisted state directly from LangGraph API
  React.useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          setLoadedDesign(design);
          // Also sync to CopilotKit agent state so both stay consistent
          if (agent && (!agent.state?.design?.scenes?.length)) {
            agent.setState({
              ...agent.state,
              design,
            });
          }
        }
      })
      .catch((err) => console.warn("[Storyboard] Failed to load state:", err));
  }, [projectId]);

  // Prefer live agent state, fall back to loaded state from API
  const design = agent?.state?.design || loadedDesign || {};
  const scenes: Scene[] = design.scenes || [];
  const entities = design.entities || [];

  const selectedScene = scenes.find(s => s.id === selectedSceneId) || scenes[0];

  // Helper to match entity IDs with full details
  const getEntityDetails = (entityId: string) => {
    return entities.find((e: any) => e.id === entityId);
  };

  const handleAutoStoryboard = () => {
    if (!agent) return;
    agent.addMessage({
      role: "user",
      id: crypto.randomUUID(),
      content: "Please plan the visual storyboard for the script, assigning layout bounding boxes and mapping our extracted entities to each scene.",
    });
    agent.runAgent();
  };

  const handleUpdateSceneField = (sceneId: string, fields: Partial<Scene>) => {
    if (!agent) return;
    const updatedScenes = scenes.map(s => {
      if (s.id === sceneId) {
        return { ...s, ...fields };
      }
      return s;
    });
    agent.setState({
      ...agent.state,
      design: {
        ...design,
        scenes: updatedScenes
      }
    });
  };

  // Safe fallback to reconstruct multi-layout elements from legacy layout_bbox if layout is empty
  const getActiveLayout = (scene: Scene): LayoutElement[] => {
    if (scene.layout && scene.layout.length > 0) {
      return scene.layout;
    }
    if (scene.layout_bbox && scene.layout_bbox.length === 4) {
      return [{
        entity_id: scene.entities?.[0] || "e1",
        bbox: scene.layout_bbox
      }];
    }
    return [];
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoStoryboard}
            className="h-9 px-3 border-dashed text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all shadow-sm"
          >
            <Wand2Icon className="w-4 h-4 mr-2" />
            Auto-Storyboard
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/generation/keyframes`)}
            className="h-9 px-4 font-semibold shadow-sm"
          >
            Next: Keyframe Gen
          </Button>

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
        </div>
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
                <p className="text-xs text-muted-foreground">Multi-subject visual layout framing</p>
              </div>
            </div>
          </div>

          <div className="flex-1 relative rounded-2xl bg-muted/20 border border-border shadow-inner overflow-hidden group flex flex-col justify-between">
            {selectedScene ? (
              <div className="absolute inset-0 flex flex-col">
                {/* Visual Bbox Overlay Container - Fullscreen Visualized Canvas */}
                <div className="flex-1 relative bg-black/5 dark:bg-black/40 overflow-hidden select-none">
                  {/* Subtle background grid texture */}
                  <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                  </div>

                  {/* High-End Viewfinder Aspect Ratio Outer brackets */}
                  <div className="absolute inset-4 border border-foreground/[0.02] pointer-events-none">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/30"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/30"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/30"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/30"></div>
                  </div>

                  {/* Absolute Center Crosshair */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="absolute w-3 h-px bg-foreground"></div>
                    <div className="absolute h-3 w-px bg-foreground"></div>
                  </div>

                  {/* Action Safe Zone Border (90% Boundary) */}
                  <div className="absolute inset-[5%] border border-dashed border-foreground/[0.04] rounded-xl pointer-events-none">
                    <span className="absolute top-1.5 left-2.5 text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">90% Action Safe</span>
                  </div>

                  {/* Camera Telemetry Overlay */}
                  <div className="absolute top-3 right-4 flex items-center gap-3 text-[9px] font-mono text-muted-foreground/40 select-none pointer-events-none">
                    <span>STBY</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse"></span>
                  </div>
                  <div className="absolute bottom-3 left-4 flex items-center gap-4 text-[9px] font-mono text-muted-foreground/35 select-none pointer-events-none">
                    <span>RAW 4K UHD</span>
                    <span>FPS 24.00</span>
                    <span>TC 00:01:24:12</span>
                  </div>

                  {/* Render Multi-Bboxes for active layout elements */}
                  {getActiveLayout(selectedScene).map((element, idx) => {
                    const entity = getEntityDetails(element.entity_id);
                    const isCharacter = entity?.type === "character";
                    const isProp = entity?.type === "prop";
                    const isLocation = entity?.type === "location";

                    return (
                      <div
                        key={`${element.entity_id}-${idx}`}
                        className={cn(
                          "absolute border-2 shadow-[0_0_50px_-12px_rgba(0,0,0,0.4)] transition-all duration-500 ease-in-out rounded-2xl flex flex-col justify-between p-2 select-none",
                          isCharacter && "border-blue-500 bg-blue-500/5 shadow-blue-500/10",
                          isProp && "border-amber-500 bg-amber-500/5 shadow-amber-500/10",
                          isLocation && "border-emerald-500 bg-emerald-500/5 shadow-emerald-500/10",
                          (!isCharacter && !isProp && !isLocation) && "border-primary bg-primary/5 shadow-primary/10"
                        )}
                        style={{
                          left: `${element.bbox[0] * 100}%`,
                          top: `${element.bbox[1] * 100}%`,
                          width: `${element.bbox[2] * 100}%`,
                          height: `${element.bbox[3] * 100}%`,
                        }}
                      >
                        {/* Elegant floating badge label INSIDE the box */}
                        <div className={cn(
                          "absolute top-2 left-2 text-[9px] font-bold tracking-wider font-mono flex items-center gap-1.5 px-2 py-0.5 rounded-md backdrop-blur-md border select-none z-10 shadow-sm",
                          isCharacter && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          isProp && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                          isLocation && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          (!isCharacter && !isProp && !isLocation) && "bg-primary/10 text-primary border-primary/20"
                        )}>
                          <span>{isCharacter ? "👤" : isProp ? "📦" : "📍"}</span>
                          <span>{entity?.name || `Subject ${element.entity_id.toUpperCase()}`}</span>
                        </div>

                        {/* Corners for high-end cinematic viewport vibes - ONLY for characters (creates beautiful double-line tracking brackets) */}
                        {isCharacter && (
                          <>
                            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl-[14px]"></div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr-[14px]"></div>
                            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl-[14px]"></div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br-[14px]"></div>
                          </>
                        )}


                        {/* Centered subtle visual focus text */}
                        <div className="m-auto opacity-20 text-[9px] font-mono tracking-widest uppercase">
                          Focus
                        </div>
                      </div>
                    );
                  })}

                  {/* Camera Alignment Guides */}
                  <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-foreground/[0.04] pointer-events-none"></div>
                  <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-foreground/[0.04] pointer-events-none"></div>
                  <div className="absolute inset-y-0 left-1/3 border-l border-dashed border-foreground/[0.04] pointer-events-none"></div>
                  <div className="absolute inset-y-0 left-2/3 border-l border-dashed border-foreground/[0.04] pointer-events-none"></div>
                </div>

                {/* Info Panel Overlay (with horizontal scroll support for small screens) */}
                <div className="p-6 border-t border-border/40 bg-background/90 sticky bottom-0 z-10 w-full overflow-x-auto">
                  <div className="flex items-start justify-between gap-6 min-w-[900px]">
                    {/* Left: Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold tracking-widest uppercase">
                          Scene {selectedScene.id.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest">
                          {selectedScene.status}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                        {selectedScene.description}
                      </p>
                    </div>

                    {/* Right: Per-Scene Optical & Camera Controls */}
                    <div className="flex shrink-0 gap-6 border-l border-border/40 pl-6">
                      {/* Lens Control */}
                      <div className="space-y-1.5 flex flex-col justify-center">
                        <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-muted-foreground block">
                          Camera Lens
                        </span>
                        <div className="flex gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                          {[
                            { id: "24mm", label: "24mm", desc: "Wide" },
                            { id: "50mm", label: "50mm", desc: "Standard" },
                            { id: "85mm", label: "85mm", desc: "Bokeh" }
                          ].map((opt) => {
                            const isSelected = (selectedScene.lens || "50mm") === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleUpdateSceneField(selectedScene.id, { lens: opt.id })}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all select-none focus:outline-none flex flex-col items-center min-w-[56px]",
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span>{opt.label}</span>
                                <span className={cn("text-[7px] font-semibold opacity-60", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
                                  {opt.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Shot Framing Control */}
                      <div className="space-y-1.5 flex flex-col justify-center">
                        <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-muted-foreground block">
                          Shot Framing
                        </span>
                        <div className="flex gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                          {[
                            { id: "wide", label: "Wide", desc: "Establishing" },
                            { id: "medium", label: "Medium", desc: "Standard" },
                            { id: "close-up", label: "Close-up", desc: "Focus" }
                          ].map((opt) => {
                            const isSelected = (selectedScene.shot_type || "medium") === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleUpdateSceneField(selectedScene.id, { shot_type: opt.id })}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all select-none focus:outline-none flex flex-col items-center min-w-[62px]",
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span>{opt.label}</span>
                                <span className={cn("text-[7px] font-semibold opacity-60", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
                                  {opt.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Camera Motion Control */}
                      <div className="space-y-1.5 flex flex-col justify-center">
                        <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-muted-foreground block">
                          Camera Motion
                        </span>
                        <div className="flex gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                          {[
                            { id: "static", label: "Static", desc: "Locked" },
                            { id: "pan", label: "Pan", desc: "Horizontal" },
                            { id: "tilt", label: "Tilt", desc: "Vertical" },
                            { id: "zoom", label: "Zoom", desc: "Push/Pull" }
                          ].map((opt) => {
                            const isSelected = (selectedScene.motion || "static") === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleUpdateSceneField(selectedScene.id, { motion: opt.id })}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all select-none focus:outline-none flex flex-col items-center min-w-[56px]",
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <span>{opt.label}</span>
                                <span className={cn("text-[7px] font-semibold opacity-60", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
                                  {opt.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
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

        {/* Sidebar Scene List - Top to Bottom Vertical Cards */}
        <div className="w-80 border-l border-border bg-background flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Storyboard Flow</h2>
            <p className="text-[10px] text-muted-foreground/60">Sequential scene breakdown</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 scroll-smooth">
            <div className="p-4 space-y-3">
              {scenes.map((scene) => {
                const layout = getActiveLayout(scene);
                const isSelected = selectedSceneId === scene.id || (!selectedSceneId && scenes[0]?.id === scene.id);
                return (
                  <div
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={cn(
                      "group relative p-3 rounded-xl border transition-all duration-300 cursor-pointer bg-card",
                      isSelected
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                        : "bg-card border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    {/* Floating Selection Indicator Dot */}
                    <div className={cn(
                      "absolute top-3 right-3 w-1.5 h-1.5 rounded-full transition-colors shrink-0",
                      isSelected
                        ? "bg-primary"
                        : "bg-primary/20 group-hover:bg-primary/50"
                    )} />

                    <div className="flex gap-3 items-center">
                      {/* Left: Beautiful Square Visual Preview Thumbnail */}
                      <div className="aspect-square w-20 shrink-0 bg-black/5 dark:bg-black/40 rounded-lg relative overflow-hidden border border-border/50 transition-all duration-300 group-hover:bg-black/10 dark:group-hover:bg-black/60">
                        {/* Grid texture inside thumb */}
                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
                          style={{ backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}>
                        </div>

                        {/* Render scaled bounding boxes in square preview */}
                        {layout.map((element, idx) => {
                          const entity = getEntityDetails(element.entity_id);
                          return (
                            <div
                              key={`${element.entity_id}-thumb-${idx}`}
                              className={cn(
                                "absolute border rounded-lg",
                                entity?.type === "character" && "border-blue-500 bg-blue-500/10",
                                entity?.type === "prop" && "border-amber-500 bg-amber-500/10",
                                entity?.type === "location" && "border-emerald-500 bg-emerald-500/10",
                                (!entity) && "border-primary bg-primary/10"
                              )}
                              style={{
                                left: `${element.bbox[0] * 100}%`,
                                top: `${element.bbox[1] * 100}%`,
                                width: `${element.bbox[2] * 100}%`,
                                height: `${element.bbox[3] * 100}%`,
                              }}
                            ></div>
                          );
                        })}
                      </div>

                      {/* Right: Detailed Metadata Stack */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 self-stretch pr-3">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                #{scene.id.toUpperCase()}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0 rounded-full border border-border bg-muted/60 text-muted-foreground group-hover:border-primary/20 group-hover:text-primary capitalize transition-colors scale-90 origin-left">
                                {scene.lens || "50mm"}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0 rounded-full border border-border bg-muted/60 text-muted-foreground group-hover:border-primary/20 group-hover:text-primary capitalize transition-colors scale-90 origin-left">
                                {scene.shot_type || "medium"}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0 rounded-full border border-border bg-muted/60 text-muted-foreground group-hover:border-primary/20 group-hover:text-primary capitalize transition-colors scale-90 origin-left">
                                {scene.motion || "static"}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors line-clamp-3 italic font-serif">
                            "{scene.description}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                );
              })}

              {scenes.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-30">
                  <InfoIcon className="w-5 h-5" />
                  <p className="text-[10px]">Decompose script to populate</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
