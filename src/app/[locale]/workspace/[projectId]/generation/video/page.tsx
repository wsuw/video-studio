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
import { useToast } from "@/components/ui/use-toast"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  MessageSquareIcon,
  PlayIcon,
  CheckCircle2Icon,
  FilmIcon,
  CpuIcon,
  SparklesIcon,
  EyeIcon,
  Undo2Icon,
  LayersIcon,
  VideoIcon,
  DownloadIcon,
  Loader2,
  ArrowRightIcon
} from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React, { useState, useEffect } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAgent, useConfigureSuggestions } from "@copilotkit/react-core/v2"
import { cn } from "@/lib/utils"
import { getThreadState, updateThreadState } from "@/lib/langgraph"

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
  audio_url?: string;
  audio_duration?: number;
  dialogue?: string;
  voice_actor_id?: string;
  video_url?: string;
  master_url?: string;
}

// Premium stock video placeholders for mock mode
const MOCK_VIDEOS: Record<string, string[]> = {
  cyberpunk: [
    "https://assets.mixkit.co/videos/preview/mixkit-neon-light-from-a-building-in-a-futuristic-city-43187-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-blue-neon-lights-42283-large.mp4"
  ],
  noir: [
    "https://assets.mixkit.co/videos/preview/mixkit-rain-drops-on-a-window-at-night-42861-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-mysterious-man-in-a-coat-walking-in-foggy-street-43200-large.mp4"
  ],
  anime: [
    "https://assets.mixkit.co/videos/preview/mixkit-clouds-passing-by-a-mountain-peak-41655-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-sun-rays-shining-through-forest-trees-41842-large.mp4"
  ],
  unreal: [
    "https://assets.mixkit.co/videos/preview/mixkit-futuristic-glowing-wireframe-terrain-42999-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-abstract-glowing-digital-particles-background-42646-large.mp4"
  ]
};

export default function VideoExecutionPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const locale = (params.locale as string) || "en";
  const { toast } = useToast();

  // Sync to LangGraph thread
  usePhaseSync("generate");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Synthesize Scene Videos",
        message: "Please initiate video rendering pipeline using our configured keyframes, styles, motions, and audio tracks for all scenes.",
      }
    ],
    available: "always"
  });

  const { agent } = useAgent({ agentId: "default" });

  const getCleanImageUrl = (url: string | undefined) => {
    if (!url) return url;
    try {
      return encodeURI(decodeURI(url));
    } catch (e) {
      return url;
    }
  };

  const getCleanVideoUrl = (url: string | undefined) => {
    if (!url) return url;
    try {
      return encodeURI(decodeURI(url));
    } catch (e) {
      return url;
    }
  };

  // States
  const [loadedDesign, setLoadedDesign] = useState<any>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [renderingStates, setRenderingStates] = useState<Record<string, { progress: number; log: string }>>({});

  // Generated/Mocked video outputs mapping: sceneId -> video URL path
  const [videoOutputs, setVideoOutputs] = useState<Record<string, string>>({});

  // Advanced inference engine controls
  const [renderMode, setRenderMode] = useState<'mock' | 'real_gpu'>('real_gpu');
  const [guidanceScale, setGuidanceScale] = useState<number>(4.0);
  const [numInferenceSteps, setNumInferenceSteps] = useState<number>(8);
  const [numFrames, setNumFrames] = useState<number>(121);
  const [frameRate, setFrameRate] = useState<number>(24.0);
  const [baseSeed, setBaseSeed] = useState<number>(0);
  const [negativePrompt, setNegativePrompt] = useState<string>("worst quality, inconsistent motion, blurry, jittery, distorted");
  const [stylePrompt, setStylePrompt] = useState<string>("");
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  const handleDownload = async (url: string, defaultFilename: string, itemId: string) => {
    setDownloadingIds(prev => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast({
        title: "📥 Download started",
        description: "The video file download has started.",
      });
    } catch (error) {
      console.error("Failed to download file directly:", error);
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "ℹ️ Link opened",
        description: "Opening link in a new tab to download.",
      });
    } finally {
      setDownloadingIds(prev => ({ ...prev, [itemId]: false }));
    }
  };

  // Load state on mount
  useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          setLoadedDesign(design);
          if (design.style_prompt) {
            setStylePrompt(design.style_prompt);
          }
          if (agent && (!agent.state?.design?.scenes?.length)) {
            agent.setState({
              ...agent.state,
              design,
            });
          }
        }
      })
      .catch((err) => console.warn("[Video] Load design state error:", err));
  }, [projectId, agent]);

  // Sync loadedDesign to Agent state when agent becomes available
  useEffect(() => {
    if (agent && loadedDesign) {
      const agentScenes = agent.state?.design?.scenes;
      const loadedScenes = loadedDesign?.scenes;

      const needsSync = !agentScenes ||
        agentScenes.length !== (loadedScenes?.length || 0) ||
        loadedScenes?.some((s: any, idx: number) => s.video_url !== agentScenes[idx]?.video_url || s.status !== agentScenes[idx]?.status);

      if (needsSync) {
        agent.setState({
          ...agent.state,
          design: {
            ...agent.state?.design,
            ...loadedDesign,
            scenes: loadedScenes
          }
        });
      }
    }
  }, [agent, loadedDesign]);

  // Pull states from Agent or fallback
  const design = (agent?.state?.design?.scenes && agent.state.design.scenes.length > 0)
    ? agent.state.design
    : (loadedDesign || {});
  const scenes: Scene[] = design.scenes || [];
  const globalArtStyle = design.art_style || "cyberpunk";

  // Auto-select the first scene if activeSceneId is not set yet
  useEffect(() => {
    if (scenes.length > 0 && !activeSceneId) {
      setActiveSceneId(scenes[0].id);
    }
  }, [scenes, activeSceneId]);

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const isAudioSynced = !!(activeScene && activeScene.audio_duration && activeScene.audio_duration > 0);
  const lockedFrameCount = isAudioSynced && activeScene && activeScene.audio_duration ? Math.round(activeScene.audio_duration * frameRate) : null;

  const handleUpdateSceneStatus = async (sceneId: string, status: "pending" | "locked" | "rendered", videoUrl?: string) => {
    const updatedScenes = scenes.map((s: any) => {
      if (s.id === sceneId) {
        return {
          ...s,
          status,
          video_url: videoUrl !== undefined ? videoUrl : (s.video_url || videoOutputs[sceneId])
        };
      }
      return s;
    });

    const updatedDesign = {
      ...design,
      scenes: updatedScenes
    };

    if (agent) {
      agent.setState({
        ...agent.state,
        design: updatedDesign
      });
    }

    setLoadedDesign(updatedDesign);

    try {
      await updateThreadState(projectId, {
        design: updatedDesign
      });
      console.log(`[LangGraph] Successfully persisted video scene status for ${sceneId}`);
    } catch (err) {
      console.error("[LangGraph] Failed to persist video scene status:", err);
    }
  };

  // Dispatch Video Render
  const handleStartRender = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Immediately reset the status to pending and clear old video output locally/in DB
    setVideoOutputs(prev => {
      const next = { ...prev };
      delete next[sceneId];
      return next;
    });
    handleUpdateSceneStatus(sceneId, "pending", "");

    const isSceneAudioSynced = !!(scene.audio_duration && scene.audio_duration > 0);
    const finalNumFrames = isSceneAudioSynced && scene.audio_duration
      ? Math.round(scene.audio_duration * frameRate)
      : numFrames;

    // Compound prompt with lens and movement language
    const fullPrompt = `${scene.description}.${stylePrompt ? ` Style: ${stylePrompt}.` : ""} ${globalArtStyle} cinematic aesthetic, ${scene.shot_type || "medium"} shot, ${scene.lens || "50mm"} lens, ${scene.motion || "static"} camera movement.`;

    if (renderMode === "mock") {
      setRenderingStates(prev => ({
        ...prev,
        [sceneId]: { progress: 5, log: "Initializing video synthesis pipeline..." }
      }));

      const stages = [
        { progress: 20, log: "Parsing scene screenplay structures..." },
        { progress: 40, log: "Distributing spatial bounding coordinates..." },
        { progress: 65, log: `Synthesizing ${finalNumFrames} frames of latent motion...` },
        { progress: 85, log: "Offloading neural pipelines to CPU..." },
        { progress: 95, log: "Encoding cinematic raw MP4 container..." },
        { progress: 100, log: "Video synthesis complete." }
      ];

      let currentStage = 0;
      const interval = setInterval(() => {
        if (currentStage >= stages.length) {
          clearInterval(interval);

          // Render completed
          const styleVideos = MOCK_VIDEOS[globalArtStyle] || MOCK_VIDEOS.cyberpunk;
          const matchedVideo = styleVideos[Math.floor(Math.random() * styleVideos.length)];

          setVideoOutputs(prev => ({ ...prev, [sceneId]: matchedVideo }));
          handleUpdateSceneStatus(sceneId, "rendered", matchedVideo);

          setRenderingStates(prev => {
            const next = { ...prev };
            delete next[sceneId];
            return next;
          });

          toast({
            title: "🎉 Video Synthesized (Mock)",
            description: `Mock generation complete for scene ${sceneId}!`,
          });
        } else {
          const stage = stages[currentStage];
          setRenderingStates(prev => ({
            ...prev,
            [sceneId]: { progress: stage.progress, log: stage.log }
          }));
          currentStage++;
        }
      }, 900);
      return;
    }

    // Real GPU video generation
    if (renderMode === "real_gpu") {
      setRenderingStates(prev => ({
        ...prev,
        [sceneId]: { progress: 10, log: "Contacting GPU model server..." }
      }));

      toast({
        title: "⚡ Video Generation Initiated",
        description: `Executing real-time video diffusion on CUDA (${finalNumFrames} frames).`,
      });

      // Periodic progress ticker
      let currentProgress = 15;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(95, currentProgress + Math.floor(Math.random() * 4) + 1);
        let logText = "Running video diffusion inference steps...";
        if (currentProgress > 30) logText = "Calculating temporal latent trajectories...";
        if (currentProgress > 60) logText = "Decoding frame lattices through VAE...";
        if (currentProgress > 80) logText = "Running vocoder for cinematic audio synthesis...";
        if (currentProgress > 90) logText = "Compressing raw streams using FFmpeg encoder...";

        setRenderingStates(prev => {
          if (!prev[sceneId]) return prev;
          return {
            ...prev,
            [sceneId]: { progress: currentProgress, log: logText }
          };
        });
      }, 1000);

      try {
        const response = await fetch("/api/generate-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            negative_prompt: negativePrompt,
            guidance_scale: guidanceScale,
            num_inference_steps: numInferenceSteps,
            num_frames: finalNumFrames,
            frame_rate: frameRate,
            seed: baseSeed || Math.floor(Math.random() * 1000000),
            sceneId: scene.id,
          }),
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to render video");
        }

        const data = await response.json();

        // Save generated video URL
        setVideoOutputs(prev => ({ ...prev, [sceneId]: data.url }));
        handleUpdateSceneStatus(sceneId, "rendered", data.url);

        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });

        toast({
          title: "🎉 Video Synthesized",
          description: `Successfully created scene ${sceneId} in ${data.elapsed_seconds}s!`,
        });

      } catch (error: any) {
        clearInterval(progressInterval);
        console.error("[Render] Video synthesis render error:", error);
        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
        toast({
          variant: "destructive",
          title: "❌ Video Generation Failed",
          description: error.message || "Failed to complete video synthesis run.",
        });
      }
    }
  };

  const handleRenderAll = () => {
    scenes.forEach(scene => {
      if (scene.status !== "rendered" && !renderingStates[scene.id]) {
        handleStartRender(scene.id);
      }
    });
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
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">Generation</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Video Gen</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRenderAll}
            disabled={scenes.length === 0}
            className="h-9 px-3 border-dashed transition-all shadow-sm font-semibold gap-1.5"
          >
            <SparklesIcon className="w-4 h-4" />
            Render All Videos ({scenes.length})
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/redesign/review`)}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
          >
            <span className="text-xs font-semibold">Next: HITL Review</span>
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

      {/* Main Central Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Active Render List (flex-1) */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-border/40 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <VideoIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Cinematic Video Synthesis</h1>
                <p className="text-xs text-muted-foreground">Synthesize high-fidelity cinematic video frames dynamically utilizing advanced AI Diffusion models</p>
              </div>
            </div>
          </div>

          {/* Render Queue Items */}
          <div className="space-y-6">
            {scenes.map((scene) => {
              const isRendering = !!renderingStates[scene.id];
              const renderState = renderingStates[scene.id];
              const videoUrl = getCleanVideoUrl(videoOutputs[scene.id] || scene.video_url);
              const imageUrl = getCleanImageUrl(scene.master_url);
              const isRendered = scene.status === "rendered" && !!videoUrl;
              const isActive = activeSceneId === scene.id;

              return (
                <div
                  key={scene.id}
                  className={cn(
                    "p-6 rounded-2xl border bg-card transition-all duration-300 flex flex-col gap-4 relative overflow-hidden cursor-pointer hover:border-primary/40",
                    isActive ? "border-primary shadow-[0_0_15px_rgba(99,102,241,0.12)] ring-1 ring-primary/20 bg-primary/[0.01]" : "border-border/60",
                    isRendering && "border-primary bg-primary/[0.01]",
                    isRendered && "border-emerald-500/20 bg-emerald-500/[0.01]"
                  )}
                  onClick={() => setActiveSceneId(scene.id)}
                >
                  {/* Top Line Details */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono font-bold text-[10px]">
                          #{scene.id.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                          {scene.lens || "50mm"} Lens • {scene.shot_type || "medium"} Framing • {scene.motion || "static"} Motion
                        </span>
                        {scene.audio_duration && (
                          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 gap-1 text-[9px] font-bold py-0.5 px-2">
                            Audio Synced ({scene.audio_duration.toFixed(1)}s)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed max-w-xl">
                        {scene.description}
                      </p>
                      {scene.dialogue && (
                        <p className="text-[11px] text-indigo-400/90 italic mt-2 border-l-2 border-indigo-500/30 pl-2">
                          “{scene.dialogue}”
                        </p>
                      )}
                      {scene.audio_url && (
                        <div className="mt-3 flex items-center gap-2.5 bg-muted/40 p-1.5 px-3 rounded-lg border border-border/40 w-fit" onClick={(e) => e.stopPropagation()}>
                          <audio src={scene.audio_url} className="h-6 w-[250px]" controls />
                          <span className="text-[10px] font-mono text-muted-foreground font-semibold shrink-0">
                            {scene.audio_duration?.toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isRendering ? (
                        <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1">
                          <CpuIcon className="w-3.5 h-3.5 animate-spin" />
                          Synthesizing Video...
                        </span>
                      ) : isRendered ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 text-[9px] font-bold py-0.5 px-2">
                            <CheckCircle2Icon className="w-3.5 h-3.5" />
                            Render Complete
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartRender(scene.id)}
                            className="h-7 px-2 text-[10px] gap-1 hover:border-primary hover:text-primary transition-colors"
                          >
                            <PlayIcon className="w-3.5 h-3.5" />
                            Re-generate
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartRender(scene.id)}
                          className="h-8 text-xs font-bold hover:bg-primary hover:text-primary-foreground border-primary/30 hover:border-primary transition-all duration-300"
                        >
                          <PlayIcon className="w-3.5 h-3.5 mr-1" />
                          Generate Video
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Body Content - Description + Video player */}
                  <div className="bg-muted/30 border border-border/60 rounded-xl aspect-[16/9] relative overflow-hidden flex items-center justify-center">
                    {isRendered ? (
                      <div className="relative w-full h-full group">
                        <video
                          src={videoUrl}
                          controls
                          loop
                          poster={imageUrl}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg shadow-md cursor-pointer disabled:opacity-50"
                            onClick={() => handleDownload(videoUrl, `scene_${scene.id}.mp4`, scene.id)}
                            disabled={downloadingIds[scene.id]}
                          >
                            {downloadingIds[scene.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <DownloadIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : isRendering ? (
                      <div className="relative w-full h-full">
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt="Keyframe Preview"
                            className="absolute inset-0 w-full h-full object-cover blur-sm brightness-[0.3]"
                          />
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-background/40 backdrop-blur-sm space-y-4">
                          <CpuIcon className="w-9 h-9 text-primary animate-spin" />
                          <div className="w-2/3 text-center space-y-2">
                            <span className="text-[10px] font-mono tracking-wider text-muted-foreground truncate block">
                              {renderState?.log}
                            </span>
                            <Progress value={renderState?.progress || 0} className="h-1.5 w-full bg-muted" />
                          </div>
                        </div>
                      </div>
                    ) : imageUrl ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={imageUrl}
                          alt="Scene Keyframe"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary/20 text-primary border-primary/30 backdrop-blur-md text-[9px] font-bold py-0.5 px-2 tracking-wider">
                            MASTER KEYFRAME
                          </Badge>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleStartRender(scene.id)}
                            className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md rounded-xl text-xs flex items-center gap-1.5"
                          >
                            <PlayIcon className="w-3.5 h-3.5" />
                            Synthesize Video
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center text-muted-foreground/40">
                        <EyeIcon className="w-8 h-8 opacity-60 animate-pulse" />
                        <span className="text-[9px] font-bold tracking-widest uppercase">
                          Awaiting Video Generation
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {scenes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-2xl text-center p-6 space-y-4 opacity-40">
                <FilmIcon className="w-10 h-10 text-muted-foreground/30 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Storyboard/Scenes Empty</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ensure scenes are designed and written during the Screenplay and pre-production phase first.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Global Art Spec & Tuning Settings (350px width) */}
        <div className="w-[350px] shrink-0 flex flex-col bg-muted/10 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
            <LayersIcon className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
              Production Styles
            </h2>
          </div>

          {/* Active Rendering Parameters */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs pb-3 border-b border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Aesthetic preset:</span>
              <Badge variant="outline" className="font-mono font-bold capitalize text-primary border-primary/20 bg-primary/5">
                {globalArtStyle}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-xs pb-3 border-b border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Target Pipeline:</span>
              <span className="font-mono font-bold text-foreground">AI Video Engine</span>
            </div>
            <div className="space-y-2">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Custom Atmosphere Style:</span>
              <Textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Cinematic volumetric lighting, photorealistic details, soft sunset glow..."
                className="text-[11px] bg-muted/30 border-border/50 text-muted-foreground leading-relaxed rounded-xl placeholder:text-muted-foreground/30 min-h-[70px] resize-none focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Advanced Generation Specs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/40">
              <SparklesIcon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
                Video Diffusion Parameters
              </h2>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              {/* Pipeline Selection */}
              <div className="space-y-2">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Inference Mode</span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted/50 rounded-lg border border-border/60">
                  <button
                    onClick={() => setRenderMode('mock')}
                    className={cn(
                      "text-[9px] font-bold py-1.5 px-2 rounded-md transition-all",
                      renderMode === 'mock'
                        ? "bg-background text-foreground shadow-sm border border-border/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Mock Preview
                  </button>
                  <button
                    onClick={() => setRenderMode('real_gpu')}
                    className={cn(
                      "text-[9px] font-bold py-1.5 px-2 rounded-md transition-all",
                      renderMode === 'real_gpu'
                        ? "bg-background text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    CUDA Synthesis
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase font-bold tracking-wider">CFG Guidance Scale</span>
                  <span className="font-mono font-bold text-primary">{guidanceScale.toFixed(1)}</span>
                </div>
                <Slider
                  min={1.0}
                  max={10.0}
                  step={0.1}
                  value={[guidanceScale]}
                  onValueChange={(val) => setGuidanceScale(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase font-bold tracking-wider">Inference Steps</span>
                  <span className="font-mono font-bold text-primary">{numInferenceSteps} Steps</span>
                </div>
                <Slider
                  min={10}
                  max={100}
                  step={1}
                  value={[numInferenceSteps]}
                  onValueChange={(val) => setNumInferenceSteps(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase font-bold tracking-wider">Target Frame Count</span>
                  <span className="font-mono font-bold text-primary">
                    {isAudioSynced ? `${lockedFrameCount} Frames` : `${numFrames} Frames`}
                  </span>
                </div>
                {isAudioSynced && activeScene ? (
                  <div className="space-y-2">
                    <div className="relative py-1 opacity-50 cursor-not-allowed">
                      <Slider
                        min={24}
                        max={240}
                        step={8}
                        value={[lockedFrameCount || 120]}
                        disabled
                        className="py-1 pointer-events-none"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Voiceover Lock Active
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Synced to voiceover duration of <span className="text-foreground font-semibold">{activeScene.audio_duration?.toFixed(2)}s</span> at <span className="text-foreground font-semibold">{frameRate} FPS</span> to ensure frame-perfect lip sync.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Slider
                    min={24}
                    max={240}
                    step={8}
                    value={[numFrames]}
                    onValueChange={(val) => setNumFrames(val[0])}
                    className="py-1 cursor-pointer"
                  />
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase font-bold tracking-wider">Target Frame Rate</span>
                  <span className="font-mono font-bold text-primary">{frameRate} FPS</span>
                </div>
                <Slider
                  min={12}
                  max={60}
                  step={1}
                  value={[frameRate]}
                  onValueChange={(val) => setFrameRate(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Negative Prompt:</span>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="text-[10px] bg-muted/20 border-border/50 text-muted-foreground rounded-lg min-h-[50px] resize-none focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="uppercase font-bold tracking-wider">Generation Seed</span>
                  <span className="font-mono font-semibold text-muted-foreground">
                    {baseSeed === 0 ? "🎲 Auto-Randomize" : `Manual: ${baseSeed}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={baseSeed === 0 ? "" : baseSeed}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setBaseSeed(isNaN(val) ? 0 : val);
                    }}
                    placeholder="Enter manual seed (0 for auto)"
                    className="h-8 text-[10px] font-mono bg-muted/20 border-border/50 focus-visible:ring-primary/20"
                  />
                  {baseSeed !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBaseSeed(0)}
                      className="h-8 text-[9px] px-2"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-border/40">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Output Resolution:</span>
                <span className="font-mono text-[10px] font-semibold text-foreground">
                  Standard HD (768x512)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
