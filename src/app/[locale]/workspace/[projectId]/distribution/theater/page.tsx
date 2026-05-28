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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  MessageSquareIcon,
  PlayIcon,
  FilmIcon,
  TvIcon,
  Volume2Icon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ChevronRightIcon,
  EyeIcon
} from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React, { useState, useEffect, useRef } from "react"
import { useConfigureSuggestions } from "@copilotkit/react-core/v2"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { getThreadState } from "@/lib/langgraph"
import { cn } from "@/lib/utils"

interface LayoutElement {
  entity_id: string;
  bbox: [number, number, number, number];
}

interface Scene {
  id: string;
  description: string;
  entities?: string[];
  layout?: LayoutElement[];
  status: "pending" | "locked" | "rendered";
  lens?: string;
  shot_type?: string;
  motion?: string;
  master_url?: string;
  video_url?: string;
  audio_url?: string;
  audio_duration?: number;
}

export default function TheaterPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const locale = (params.locale as string) || "en";

  usePhaseSync("distribution");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Play Full Preview",
        message: "Please automatically sequence all completed scenes and start full sequential cinematic theater playback.",
      }
    ],
    available: "always"
  });

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const videoRefs = React.useRef<Record<string, HTMLVideoElement | null>>({});

  // Fetch thread state on mount
  useEffect(() => {
    if (!projectId) return;
    setIsLoading(true);
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design && design.scenes) {
          setScenes(design.scenes);
          if (design.aspect_ratio) {
            setAspectRatio(design.aspect_ratio);
          }
          // Find first rendered video scene to start with, otherwise default to 0
          const firstRenderedIdx = design.scenes.findIndex((s: Scene) => s.video_url);
          if (firstRenderedIdx !== -1) {
            setCurrentSceneIndex(firstRenderedIdx);
          }
        }
      })
      .catch((err) => console.warn("[Theater] Load design error:", err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  const activeScene = scenes[currentSceneIndex];
  const renderedScenesCount = scenes.filter(s => s.video_url).length;
  const totalScenesCount = scenes.length;
  const progressPercent = totalScenesCount > 0 ? Math.round((renderedScenesCount / totalScenesCount) * 100) : 0;
  const aspectStyle = {
    aspectRatio: aspectRatio.replace(":", " / "),
    maxHeight: aspectRatio === "9:16" ? "640px" : "none"
  };

  const handleSelectScene = (index: number) => {
    // Pause all other playing videos first
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.pause();
    });

    setCurrentSceneIndex(index);
    setIsPlaying(false);

    // Reset playhead for the target scene if it exists
    const targetScene = scenes[index];
    if (targetScene && targetScene.video_url) {
      setTimeout(() => {
        const targetVideo = videoRefs.current[targetScene.id];
        if (targetVideo) {
          targetVideo.currentTime = 0;
        }
      }, 100);
    }
  };

  const handleSingleVideoEnded = (idx: number) => {
    // Auto-play the next rendered scene in sequence if available
    let nextIdx = idx + 1;
    while (nextIdx < scenes.length) {
      if (scenes[nextIdx].video_url) {
        setCurrentSceneIndex(nextIdx);
        setIsPlaying(true);
        const nextVideo = videoRefs.current[scenes[nextIdx].id];
        setTimeout(() => {
          if (nextVideo) {
            nextVideo.currentTime = 0;
            nextVideo.play().catch(e => console.warn("Auto seamless play failed:", e));
          }
        }, 150);
        return;
      }
      nextIdx++;
    }
    // If we reached the end of the sequence, stop playing
    setIsPlaying(false);
  };

  const getCleanUrl = (url: string | undefined) => {
    if (!url) return undefined;
    try {
      return encodeURI(decodeURI(url));
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header Navigation */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                  <Link href={`/${locale}/studio`}>Studio</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">Distribution</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Theater</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/distribution/export`)}
            disabled={renderedScenesCount === 0}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
          >
            <span className="text-xs font-semibold">Next: Export Film</span>
            <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
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

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Sequenced Theater Screen (lg:w-3/5) */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6 lg:border-r border-border/40 bg-muted/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <TvIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Theater Monitor</h1>
                <p className="text-xs text-muted-foreground">Sequentially preview fully synthesized video clips online</p>
              </div>
            </div>

            {/* Play Full movie action trigger */}
            {renderedScenesCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Find first rendered scene
                  const firstRendered = scenes.findIndex(s => s.video_url);
                  if (firstRendered !== -1) {
                    // Pause all videos first
                    Object.values(videoRefs.current).forEach(video => {
                      if (video) video.pause();
                    });

                    setCurrentSceneIndex(firstRendered);
                    setIsPlaying(true);
                    setTimeout(() => {
                      const firstVideo = videoRefs.current[scenes[firstRendered].id];
                      if (firstVideo) {
                        firstVideo.currentTime = 0; // Reset playhead
                        firstVideo.play().catch(e => console.warn("Autoplay start failed:", e));
                      }
                    }, 200);
                  }
                }}
                className="h-9 px-3 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all font-semibold gap-1.5 shadow-sm"
              >
                <PlayIcon className="w-3.5 h-3.5 fill-current" />
                Play Full
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="w-full rounded-2xl bg-card border border-border flex items-center justify-center mx-auto" style={aspectStyle}>
              <div className="text-center space-y-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
                <p className="text-xs text-muted-foreground">Loading cinema sequences...</p>
              </div>
            </div>
          ) : activeScene ? (
            <div className="flex flex-col gap-4">
              {/* Premium Video Container with Outer Glow */}
              <div className="w-full rounded-2xl bg-black border border-border relative overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.06)] group mx-auto" style={aspectStyle}>
                {activeScene.video_url ? (
                  scenes.map((scene, idx) => {
                    if (!scene.video_url) return null;
                    const isCurrent = currentSceneIndex === idx;
                    return (
                      <video
                        key={scene.id}
                        ref={el => { videoRefs.current[scene.id] = el; }}
                        src={getCleanUrl(scene.video_url)}
                        preload={Math.abs(idx - currentSceneIndex) <= 1 ? "auto" : "none"}
                        controls={isCurrent}
                        autoPlay={isCurrent && isPlaying}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => handleSingleVideoEnded(idx)}
                        className={cn(
                          "w-full h-full object-contain bg-zinc-950 transition-opacity duration-300",
                          isCurrent 
                            ? "opacity-100 relative z-10" 
                            : "opacity-0 absolute inset-0 z-0 pointer-events-none"
                        )}
                      />
                    );
                  })
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center space-y-4 w-full h-full min-h-[300px] z-10">
                    {activeScene.master_url ? (
                      <>
                        <img
                          src={getCleanUrl(activeScene.master_url)}
                          alt="Scene placeholder"
                          className="absolute inset-0 w-full h-full object-cover blur-[4px] opacity-40 brightness-[0.25]"
                        />
                        <div className="relative z-10 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                            <AlertCircleIcon className="w-6 h-6 text-amber-500" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">Video Synthesis Awaiting</h4>
                            <p className="text-xs text-muted-foreground max-w-sm">
                              Keyframe base resolved, but video diffusion has not been rendered yet. Return to the Video Gen phase to complete this clip.
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/workspace/${projectId}/generation/video`)}
                            className="h-8 px-4 text-xs font-semibold rounded-xl"
                          >
                            Go to Video Gen
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
                          <FilmIcon className="w-6 h-6 text-muted-foreground/50 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-muted-foreground">Scene Empty</h4>
                          <p className="text-xs text-muted-foreground/60 max-w-sm">
                            No visual keyframes or video assets exist for this scene. Ensure you complete the storyboard generation stages.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtitle overlay */}
                {activeScene.video_url && activeScene.description && (
                  <div className="absolute bottom-16 left-4 right-4 bg-black/60 backdrop-blur-sm border border-white/5 py-2 px-4 rounded-xl max-w-xl mx-auto text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <p className="text-[11px] text-zinc-300 font-medium font-sans leading-relaxed line-clamp-2">
                      {activeScene.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Scene Meta Panel */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                <div className="flex justify-between items-start gap-4 pb-3 border-b border-border/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-mono font-bold text-[9px] py-0.5 px-2">
                        SCENE #{activeScene.id.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {activeScene.lens || "50mm"} Focal • {activeScene.shot_type || "medium"} Shot • {activeScene.motion || "static"}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed font-sans pt-1">
                      {activeScene.description}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold px-2 py-0.5 capitalize border-dashed shadow-sm shrink-0",
                    activeScene.video_url 
                      ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20" 
                      : "text-amber-500 bg-amber-500/5 border-amber-500/20"
                  )}>
                    {activeScene.video_url ? "Video Ready" : "Awaiting Render"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Voiceover Voice</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5 pt-0.5">
                      <Volume2Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      {activeScene.audio_url ? "Audio Track Synced" : "No Audio Synchronized"}
                    </span>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl bg-muted/40 border border-border/40">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Sequence Placement</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5 pt-0.5">
                      <FilmIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      Clip {currentSceneIndex + 1} / {scenes.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 text-center space-y-4 opacity-50 mx-auto" style={aspectStyle}>
              <FilmIcon className="w-10 h-10 text-muted-foreground/40 animate-pulse" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">No Scenes Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Go back to storyboard and video generation stages to compile and synthesize your sequence theater clips.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Chronological Scene Playlist (lg:w-2/5) */}
        <div className="lg:w-[380px] shrink-0 flex flex-col bg-muted/10 overflow-hidden">
          <div className="p-6 border-b border-border/40 space-y-4 bg-background/30 backdrop-blur-md">
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground flex items-center gap-2">
              <FilmIcon className="w-3.5 h-3.5" />
              Sequenced Playlist
            </h2>

            {/* Overall Pipeline Synthesis Status Card */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold">Synthesis Completion</span>
                <span className="font-mono font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5 w-full bg-muted" />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                <span>{renderedScenesCount} / {totalScenesCount} Clips Synthesized</span>
                {progressPercent === 100 && (
                  <span className="text-emerald-500 flex items-center gap-0.5">
                    <CheckCircle2Icon className="w-3 h-3" /> Fully Compiled
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Playlist Scrollable Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {scenes.map((scene, idx) => {
              const isSelected = currentSceneIndex === idx;
              const hasVideo = !!scene.video_url;

              return (
                <div
                  key={`playlist-scene-${scene.id}`}
                  onClick={() => handleSelectScene(idx)}
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-300 flex gap-3 cursor-pointer group/item select-none relative overflow-hidden bg-card",
                    isSelected 
                      ? "border-primary bg-primary/[0.02] ring-1 ring-primary/20 shadow-md" 
                      : "border-border/60 hover:border-primary/40 hover:bg-primary/[0.005]"
                  )}
                >
                  {/* Left: Aspect Frame (Keyframe/Video marker) */}
                  <div 
                    className="w-[100px] shrink-0 rounded-lg bg-zinc-950 border border-border/80 overflow-hidden relative flex items-center justify-center"
                    style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
                  >
                    {scene.master_url ? (
                      <img
                        src={getCleanUrl(scene.master_url)}
                        alt={`Scene ${scene.id} keyframe`}
                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <FilmIcon className="w-4 h-4 text-muted-foreground/30" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <PlayIcon className="w-5 h-5 text-white fill-white/80 drop-shadow-md" />
                    </div>

                    <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-300 font-bold border border-white/5">
                      #{idx + 1}
                    </div>

                    {hasVideo && (
                      <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow border border-white/10">
                        <CheckCircle2Icon className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Right: Information */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="space-y-0.5">
                      <h4 className={cn(
                        "text-[11px] font-bold tracking-tight truncate uppercase font-mono",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        Scene {scene.id.toUpperCase()}
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2 pr-2 font-sans font-medium">
                        {scene.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground pt-1 pr-2">
                      <span className="uppercase font-semibold tracking-wide">
                        {scene.shot_type || "medium"} framing
                      </span>
                      <span className={cn(
                        "font-bold uppercase tracking-wider",
                        hasVideo ? "text-emerald-500" : "text-amber-500 animate-pulse"
                      )}>
                        {hasVideo ? "Ready" : "Awaiting"}
                      </span>
                    </div>
                  </div>

                  {/* Tiny selector bar on the right */}
                  {isSelected && (
                    <div className="absolute top-0 bottom-0 right-0 w-1 bg-primary" />
                  )}
                </div>
              );
            })}

            {scenes.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground/50 border border-dashed rounded-xl bg-card">
                No scenes in playlist.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
