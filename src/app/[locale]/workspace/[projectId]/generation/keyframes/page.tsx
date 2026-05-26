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
  RefreshCwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  FilmIcon,
  CpuIcon,
  SparklesIcon,
  EyeIcon,
  Undo2Icon,
  LayersIcon,
  DicesIcon,
  CheckIcon,
  ArrowRightIcon
} from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React, { useState, useEffect } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useParams, useRouter } from "next/navigation"
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
  master_url?: string;
}

// Preset Multi-Variant Gacha candidates mapping to selected styles & scene numerical suffixes
const GACHA_VARIANTS: Record<string, Record<string, string[]>> = {
  cyberpunk: {
    s1: [
      "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?q=80&w=600&auto=format&fit=crop"
    ],
    s2: [
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop"
    ],
    s3: [
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1580234810907-b40315b76418?q=80&w=600&auto=format&fit=crop"
    ],
    s4: [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544256718-3bcf237f3974?q=80&w=600&auto=format&fit=crop"
    ]
  },
  noir: {
    s1: [
      "https://images.unsplash.com/photo-1533230898528-765be5d3c8c2?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop"
    ],
    s2: [
      "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502134249126-9f3755a50d78?q=80&w=600&auto=format&fit=crop"
    ]
  },
  anime: {
    s1: [
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600&auto=format&fit=crop"
    ],
    s2: [
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=600&auto=format&fit=crop"
    ]
  },
  unreal: {
    s1: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop"
    ]
  }
};

export default function QueuePage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { toast } = useToast();

  // Sync to LangGraph thread
  usePhaseSync("generate");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Batch Generate Keyframes",
        message: "Please automatically design and trigger keyframe image generation for all scenes that do not currently have keyframes.",
      }
    ],
    available: "always"
  });

  const { agent } = useAgent({ agentId: "default" });

  // Helper to dynamically auto-heal local hostnames or relative paths to public domain
  const getCleanUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("/")) {
      return `https://t2i.aianime.space${url}`;
    }
    try {
      const urlObj = new URL(url);
      if (
        urlObj.hostname === "localhost" ||
        urlObj.hostname === "127.0.0.1" ||
        urlObj.hostname === "0.0.0.0"
      ) {
        return `https://t2i.aianime.space${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
      }
    } catch (e) {}
    return url;
  };

  // Helper to dynamically calculate 720p resolution boundaries based on project's aspect ratio
  const getAspectRatioResolution = () => {
    const ratio = design.aspect_ratio || "16:9";
    if (ratio === "9:16") {
      return { width: 720, height: 1280 };
    }
    if (ratio === "1:1") {
      return { width: 720, height: 720 };
    }
    return { width: 1280, height: 720 }; // default 16:9 720p
  };

  // States
  const [loadedDesign, setLoadedDesign] = useState<any>(null);
  const [renderingStates, setRenderingStates] = useState<Record<string, { progress: number; log: string }>>({});

  // Custom Gacha Choice state: sceneId -> chosenMasterImageUrl
  const [masterOutputs, setMasterOutputs] = useState<Record<string, string>>(() => {
    // initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('keyframeMasterOutputs');
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  // Controls variant selection drawer: sceneId -> boolean (active selection mode)
  const [gachaMode, setGachaMode] = useState<Record<string, boolean>>({});

  // Real generated Gacha variants: sceneId -> array of string URLs
  const [realGachaVariants, setRealGachaVariants] = useState<Record<string, string[]>>({});

  // Advanced inference engine controls
  const [renderMode, setRenderMode] = useState<'mock' | 'real_single' | 'real_gacha'>('real_single');
  const [guidanceScale, setGuidanceScale] = useState<number>(1.0);
  const [numInferenceSteps, setNumInferenceSteps] = useState<number>(8);
  const [baseSeed, setBaseSeed] = useState<number>(0);
  const [stylePrompt, setStylePrompt] = useState<string>("");

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
      .catch((err) => console.warn("[Queue] Load design state error:", err));
  }, [projectId, agent]);

  // Sync loadedDesign to Agent state when agent becomes available
  useEffect(() => {
    if (agent && loadedDesign) {
      const agentScenes = agent.state?.design?.scenes;
      const loadedScenes = loadedDesign?.scenes;
      
      const needsSync = !agentScenes || 
        agentScenes.length !== (loadedScenes?.length || 0) ||
        loadedScenes?.some((s: any, idx: number) => s.master_url !== agentScenes[idx]?.master_url || s.status !== agentScenes[idx]?.status);

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
  const [scenes, setScenes] = React.useState<Scene[]>(design?.scenes || []);
  // Sync scenes when design changes
  React.useEffect(() => {
    setScenes(design?.scenes || []);
  }, [design?.scenes]);
  const entities = design.entities || [];
  const globalArtStyle = design.art_style || "cyberpunk";
  const globalColorPalette = design.color_palette || "bladerunner";
  const globalStylePrompt = design.style_prompt || "";

  const handleUpdateSceneStatus = async (sceneId: string, status: "pending" | "locked" | "rendered", masterUrl?: string) => {
    const updatedScenes = scenes.map((s: any) => {
      if (s.id === sceneId) {
        return {
          ...s,
          status,
          master_url: masterUrl !== undefined ? masterUrl : (s.master_url || masterOutputs[sceneId])
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
      console.log(`[LangGraph] Successfully persisted keyframe scene status for ${sceneId}`);
    } catch (err) {
      console.error("[LangGraph] Failed to persist keyframe scene status:", err);
    }
  };

  const getEntityDetails = (entityId: string) => {
    return entities.find((e: any) => e.id === entityId);
  };

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

  // Get all 4 gacha options for this specific scene (with real fallback)
  const getGachaOptions = (sceneId: string): string[] => {
    if (realGachaVariants[sceneId] && realGachaVariants[sceneId].length > 0) {
      return realGachaVariants[sceneId];
    }
    const styleVariants = GACHA_VARIANTS[globalArtStyle] || GACHA_VARIANTS.cyberpunk;
    const key = styleVariants[sceneId] ? sceneId : Object.keys(styleVariants)[0];
    return styleVariants[key] || GACHA_VARIANTS.cyberpunk.s1;
  };

  // Dispatch Render Gacha (Simulate or run real GPU inference)
  const handleStartRender = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Build compound prompt for high-fidelity diffusion synthesis
    const fullPrompt = `${scene.description}.${stylePrompt ? ` Style: ${stylePrompt}.` : ""} ${globalArtStyle} aesthetic, ${scene.shot_type || "medium"} shot, ${scene.lens || "50mm"} lens, ${scene.motion || "static"} camera.`;

    if (renderMode === "mock") {
      // Original mock render
      setRenderingStates(prev => ({
        ...prev,
        [sceneId]: { progress: 5, log: "Allocating cluster cluster GPU nodes..." }
      }));

      const stages = [
        { progress: 25, log: "Parsing structural layout boundary nodes..." },
        { progress: 50, log: "Synthesizing 4 aesthetic variants from design styles..." },
        { progress: 75, log: "Compiling optical lens focal depth fields..." },
        { progress: 95, log: "Applying cinematic film grade LUT palettes..." },
        { progress: 100, log: "Completed variants generation." }
      ];

      let currentStage = 0;
      const interval = setInterval(() => {
        if (currentStage >= stages.length) {
          clearInterval(interval);

          // Render completed: open Gacha selection mode immediately!
          setGachaMode(prev => ({ ...prev, [sceneId]: true }));
          setRenderingStates(prev => {
            const next = { ...prev };
            delete next[sceneId];
            return next;
          });
        } else {
          const stage = stages[currentStage];
          setRenderingStates(prev => ({
            ...prev,
            [sceneId]: { progress: stage.progress, log: stage.log }
          }));
          currentStage++;
        }
      }, 850);
      return;
    }

    // Real GPU single frame generation
    if (renderMode === "real_single") {
      setRenderingStates(prev => ({
        ...prev,
        [sceneId]: { progress: 10, log: "Contacting GPU Server..." }
      }));

      toast({
        title: "⚡ Generation Initiated",
        description: "Executing real-time diffusion models on CUDA.",
      });

      // Periodic progress ticker during long HTTP request
      let currentProgress = 15;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(95, currentProgress + Math.floor(Math.random() * 8) + 2);
        let logText = "Running diffusion model inference...";
        if (currentProgress > 45) logText = "Synthesizing optical composition boundary nodes...";
        if (currentProgress > 75) logText = "Offloading model pipeline to system CPU...";
        if (currentProgress > 90) logText = "Writing finished static image frame...";

        setRenderingStates(prev => {
          if (!prev[sceneId]) return prev;
          return {
            ...prev,
            [sceneId]: { progress: currentProgress, log: logText }
          };
        });
      }, 650);

      try {
        const { width, height } = getAspectRatioResolution();
        const response = await fetch("/api/generate-keyframe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            guidance_scale: guidanceScale,
            num_inference_steps: numInferenceSteps,
            seed: baseSeed || Math.floor(Math.random() * 1000000),
            sceneId: scene.id,
            width,
            height,
          }),
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to render keyframe");
        }

        const data = await response.json();

        // Single frame generated successfully! Save directly to master frame
        // Save master URL to state and persist in localStorage
        setMasterOutputs(prev => ({ ...prev, [sceneId]: data.url }));
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, master_url: data.url, status: 'rendered' } : s));
        // also store in localStorage for quick reload
        const stored = JSON.parse(localStorage.getItem('keyframeMasterOutputs') || '{}');
        stored[sceneId] = data.url;
        localStorage.setItem('keyframeMasterOutputs', JSON.stringify(stored));
        handleUpdateSceneStatus(sceneId, "rendered", data.url);

        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });

        toast({
          title: "🎉 Generation Completed",
          description: `Successfully synthesized scene ${sceneId} in ${data.elapsed_seconds}s!`,
        });

      } catch (error: any) {
        clearInterval(progressInterval);
        console.error("[Render] Single render error:", error);
        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
        toast({
          variant: "destructive",
          title: "❌ Render Failed",
          description: error.message || "Could not connect to model server.",
        });
      }
    }

    // Real GPU multi-variant Gacha generation (sequential to protect VRAM)
    if (renderMode === "real_gacha") {
      setRenderingStates(prev => ({
        ...prev,
        [sceneId]: { progress: 5, log: "Starting 4-Variant Gacha Synthesis..." }
      }));

      toast({
        title: "🎲 Gacha Batch Started",
        description: "Generating 4 variants sequentially for safe VRAM execution.",
      });

      const generatedUrls: string[] = [];
      const totalVariants = 4;

      try {
        for (let i = 0; i < totalVariants; i++) {
          const currentSeed = (baseSeed || Math.floor(Math.random() * 1000000)) + i * 17;

          setRenderingStates(prev => ({
            ...prev,
            [sceneId]: {
              progress: Math.round((i / totalVariants) * 100) + 5,
              log: `Variant ${i + 1}/${totalVariants} - Seed: ${currentSeed}...`
            }
          }));

          const { width, height } = getAspectRatioResolution();
          const response = await fetch("/api/generate-keyframe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: fullPrompt,
              guidance_scale: guidanceScale,
              num_inference_steps: numInferenceSteps,
              seed: currentSeed,
              sceneId: `${scene.id}_v${i}`,
              width,
              height,
            }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Variant ${i + 1} failed: ${errData.error}`);
          }

          const data = await response.json();
          generatedUrls.push(data.url);
        }

        // Store real gacha variants
        setRealGachaVariants(prev => ({
          ...prev,
          [sceneId]: generatedUrls
        }));

        // Render completed: open Gacha selection mode immediately!
        setGachaMode(prev => ({ ...prev, [sceneId]: true }));

        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });

        toast({
          title: "🎉 Gacha Complete",
          description: "All 4 variants rendered successfully. Choose your master frame!",
        });

      } catch (error: any) {
        console.error("[Render] Gacha render error:", error);
        
        // Even if the overall process failed, if some variants succeeded, show them!
        if (generatedUrls.length > 0) {
          setRealGachaVariants(prev => ({
            ...prev,
            [sceneId]: generatedUrls
          }));
          setGachaMode(prev => ({ ...prev, [sceneId]: true }));
          toast({
            variant: "default",
            title: "⚠️ Gacha Partially Complete",
            description: `Batch encountered a timeout or error, but successfully generated ${generatedUrls.length}/4 variants. You can choose from these!`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "❌ Gacha Failed",
            description: error.message || "Failed to complete multi-variant run.",
          });
        }

        setRenderingStates(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
      }
    }
  };

  // Lock selected variant as the master frame
  const handleSelectMaster = (sceneId: string, url: string) => {
        // After real single render, persist master URL similarly
        setMasterOutputs(prev => ({ ...prev, [sceneId]: url }));
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, master_url: url, status: 'rendered' } : s));
        const stored = JSON.parse(localStorage.getItem('keyframeMasterOutputs') || '{}');
        stored[sceneId] = url;
        localStorage.setItem('keyframeMasterOutputs', JSON.stringify(stored));
    setGachaMode(prev => ({ ...prev, [sceneId]: false }));
    handleUpdateSceneStatus(sceneId, "rendered", url);
  };

  // Re-roll to open Gacha selection again
  const handleReRoll = (sceneId: string) => {
    setGachaMode(prev => ({ ...prev, [sceneId]: true }));
    handleUpdateSceneStatus(sceneId, "pending");
  };

  // Batch execute all idle scenes
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
                <BreadcrumbLink href="/workspace" className="text-muted-foreground hover:text-foreground">Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">Generation</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Keyframe Gen</BreadcrumbPage>
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
            Batch Render All ({scenes.length})
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/generation/video`)}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
          >
            <span className="text-xs font-semibold">Next: Video Gen</span>
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
                <FilmIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Cinematic Keyframe Studio</h1>
                <p className="text-xs text-muted-foreground">Synthesize layout bounds, camera optics and aesthetic styles into multi-variant keyframe outputs</p>
              </div>
            </div>
          </div>

          {/* Render Queue Items */}
          <div className="space-y-4">
            {scenes.map((scene) => {
              const layout = getActiveLayout(scene);
              const isRendering = !!renderingStates[scene.id];
              const renderState = renderingStates[scene.id];

              const variants = getGachaOptions(scene.id);
              const masterUrl = masterOutputs[scene.id] || scene.master_url || variants[0];
              const isGachaSelecting = !!gachaMode[scene.id];
              const isRendered = (scene.status === "rendered" || scene.status === "locked") && !isGachaSelecting;
              const isLocked = scene.status === "locked";

              return (
                <div
                  key={scene.id}
                  className={cn(
                    "p-5 rounded-2xl border bg-card transition-all duration-300 flex flex-col gap-4 relative overflow-hidden",
                    isRendering && "border-primary bg-primary/[0.01]",
                    isGachaSelecting && "border-amber-500/30 bg-amber-500/[0.01]",
                    isRendered && "border-emerald-500/20 bg-emerald-500/[0.01]",
                    isLocked && "border-indigo-500/25 bg-indigo-500/[0.005]"
                  )}
                >
                  {/* Top Line Details */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono font-bold text-[10px]">
                          #{scene.id.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                          {scene.lens || "50mm"} Focal • {scene.shot_type || "Medium"} • {scene.motion || "Static"} Motion
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed max-w-xl">
                        {scene.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isRendered ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 text-[9px] font-bold py-0.5 px-2">
                            <CheckCircle2Icon className="w-3 h-3" />
                            Render Mastered
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (renderMode === 'real_single') {
                                handleStartRender(scene.id);
                              } else {
                                handleReRoll(scene.id);
                              }
                            }}
                            className="h-7 px-2 text-[10px] gap-1 hover:border-amber-500/50 hover:text-amber-500 transition-colors"
                          >
                            {renderMode === 'real_single' ? (
                              <>
                                <RefreshCwIcon className="w-3.5 h-3.5 mr-1" />
                                Regenerate
                              </>
                            ) : (
                              <>
                                <DicesIcon className="w-3.5 h-3.5 mr-1" />
                                Re-Roll Gacha
                              </>
                            )}
                          </Button>
                        </div>
                      ) : isRendering ? (
                        <span className="text-[10px] font-bold text-primary animate-pulse flex items-center gap-1">
                          <CpuIcon className="w-3.5 h-3.5 animate-spin" />
                          {renderMode === 'real_single' ? 'Generating Frame...' : 'Generating 4 Variants...'}
                        </span>
                      ) : isGachaSelecting ? (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 text-[9px] font-bold py-0.5 px-2">
                          <LayersIcon className="w-3 h-3" />
                          Gacha Selection Mode
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartRender(scene.id)}
                          className="h-8 text-xs font-bold hover:bg-primary hover:text-primary-foreground border-primary/30 hover:border-primary transition-all duration-300"
                        >
                          <PlayIcon className="w-3.5 h-3.5 mr-1" />
                          {renderMode === 'real_single' ? 'Generate Frame' : 'Generate Variants (4x Gacha)'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Body Content - Box layout + Render Reveal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Visual 1: Structural layout preview */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl aspect-[16/9] relative overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 opacity-[0.03]"
                        style={{ backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}>
                      </div>

                      {layout.map((element, idx) => {
                        const entity = getEntityDetails(element.entity_id);
                        return (
                          <div
                            key={`${element.entity_id}-render-${idx}`}
                            className={cn(
                              "absolute border-2 rounded-lg flex flex-col justify-between p-2 select-none shadow-sm",
                              entity?.type === "character" && "border-blue-500/40 bg-blue-500/10 text-blue-400",
                              entity?.type === "prop" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
                              entity?.type === "location" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                              (!entity) && "border-primary/40 bg-primary/10 text-primary"
                            )}
                            style={{
                              left: `${element.bbox[0] * 100}%`,
                              top: `${element.bbox[1] * 100}%`,
                              width: `${element.bbox[2] * 100}%`,
                              height: `${element.bbox[3] * 100}%`,
                            }}
                          >
                            <span className="text-[7px] font-bold uppercase tracking-wider truncate">
                              {entity?.name || `Subject ${element.entity_id.toUpperCase()}`}
                            </span>
                          </div>
                        );
                      })}

                      <span className="text-[8px] font-mono tracking-widest text-muted-foreground/30 uppercase absolute bottom-2 right-2">
                        Composition Viewfinder
                      </span>
                    </div>

                    {/* Visual 2: Output Image / Gacha Selection Panel */}
                    <div className="bg-muted/10 border border-border/60 rounded-xl aspect-[16/9] relative overflow-hidden flex items-center justify-center">
                      {isRendered ? (
                        <div className="relative w-full h-full group/img">
                          <img
                              src={getCleanUrl(masterUrl)}
                              alt={`Master Scene ${scene.id}`}
                              referrerPolicy="no-referrer"
                              width={800}
                              height={450}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                            />
                        </div>
                      ) : isGachaSelecting ? (
                        /* Gacha 2x2 Selection Grid */
                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 p-1.5 gap-1.5 bg-background border border-border">
                          {variants.map((url, variantIdx) => (
                            <div
                              key={`gacha-card-${variantIdx}`}
                              onClick={() => handleSelectMaster(scene.id, url)}
                              className="group/variant relative w-full h-full rounded-lg overflow-hidden border border-border/80 hover:border-amber-500/70 hover:shadow-lg cursor-pointer transition-all duration-300"
                            >
                              <img
                                src={getCleanUrl(url)}
                                alt={`Variant ${variantIdx + 1}`}
                                className="w-full h-full object-cover group-hover/variant:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/variant:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 border border-amber-500/20 rounded shadow-md flex items-center gap-1 scale-90 group-hover/variant:scale-100 transition-transform duration-300">
                                  <CheckIcon className="w-3 h-3" />
                                  Variant #{variantIdx + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : isRendering ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/80 backdrop-blur-sm space-y-3">
                          <CpuIcon className="w-8 h-8 text-primary animate-spin" />
                          <div className="w-3/4 text-center space-y-1">
                            <span className="text-[10px] font-mono tracking-wider text-muted-foreground truncate block">
                              {renderState?.log}
                            </span>
                            <Progress value={renderState?.progress || 0} className="h-1.5 w-full bg-muted" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground/40">
                          <EyeIcon className="w-8 h-8 opacity-60" />
                          <span className="text-[9px] font-bold tracking-widest uppercase">
                            Awaiting Variant Generation
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {scenes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-2xl text-center p-6 space-y-4 opacity-40">
                <FilmIcon className="w-10 h-10 text-muted-foreground/30 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Render Queue Empty</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Plan your chronological script sequence and lock down compositions in the Storyboard stage first.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Global Art Spec & Denoising Settings (350px width) */}
        <div className="w-[350px] shrink-0 flex flex-col bg-muted/10 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
            <LayersIcon className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
              Aesthetic Settings
            </h2>
          </div>

          {/* Active Rendering Parameters */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs pb-3 border-b border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Model Preset:</span>
              <Badge variant="outline" className="font-mono font-bold capitalize text-primary border-primary/20 bg-primary/5">
                {globalArtStyle}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-xs pb-3 border-b border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Aspect Ratio:</span>
              <span className="font-mono font-bold text-foreground">{design.aspect_ratio || "16:9"}</span>
            </div>
            <div className="flex justify-between items-center text-xs pb-3 border-b border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">LUT Grading:</span>
              <Badge variant="secondary" className="font-mono font-bold capitalize text-foreground text-[10px] px-2 py-0.5">
                {globalColorPalette}
              </Badge>
            </div>
            <div className="space-y-2">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Atmosphere Styling Prompt:</span>
              <Textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Describe cinematic lighting, mood, tone, style modifiers..."
                className="text-[11px] bg-muted/30 border-border/50 text-muted-foreground leading-relaxed rounded-xl placeholder:text-muted-foreground/30 min-h-[70px] resize-none focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Advanced Generation Specs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/40">
              <SparklesIcon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
                Inference Engine Specs
              </h2>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              {/* Render Mode Segmented Control */}
              <div className="space-y-2">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Inference Engine Mode</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-lg border border-border/60">
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
                    onClick={() => setRenderMode('real_single')}
                    className={cn(
                       "text-[9px] font-bold py-1.5 px-2 rounded-md transition-all",
                      renderMode === 'real_single'
                        ? "bg-background text-primary shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    CUDA Single
                  </button>
                  <button
                    onClick={() => setRenderMode('real_gacha')}
                    className={cn(
                       "text-[9px] font-bold py-1.5 px-2 rounded-md transition-all",
                      renderMode === 'real_gacha'
                        ? "bg-background text-amber-500 shadow-sm border border-amber-500/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    CUDA Gacha
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
                  min={1}
                  max={50}
                  step={1}
                  value={[numInferenceSteps]}
                  onValueChange={(val) => setNumInferenceSteps(val[0])}
                  className="py-1 cursor-pointer"
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
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Target Resolution:</span>
                <span className="font-mono text-[10px] font-semibold text-foreground">
                  {design.aspect_ratio === "9:16" ? "720p Vertical (720x1280)" : design.aspect_ratio === "1:1" ? "720p Square (720x720)" : "720p HD (1280x720)"}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
