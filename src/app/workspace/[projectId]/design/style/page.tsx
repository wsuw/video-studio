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
import { Textarea } from "@/components/ui/textarea"
import {
  MessageSquareIcon,
  PaletteIcon,
  CheckCircle2Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SlidersIcon
} from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useRouter, useParams } from "next/navigation"
import { useAgent } from "@copilotkit/react-core/v2"
import { cn } from "@/lib/utils"
import { getThreadState } from "@/lib/langgraph"

// Predefined elite global art style templates
const PRESET_ART_STYLES = [
  {
    id: "cyberpunk",
    name: "Cinematic Cyberpunk",
    description: "Rainy neon streets, high contrast, warm backlit rim-light, anamorphic lens flares",
    preview: "from-purple-900/40 via-fuchsia-950/40 to-pink-900/40 border-purple-500/20 text-purple-400"
  },
  {
    id: "noir",
    name: "Noir Realism",
    description: "Monochromatic depth, strong shadow plays, dramatic lighting, foggy wet streets",
    preview: "from-slate-900/40 via-zinc-950/40 to-neutral-900/40 border-zinc-500/20 text-zinc-400"
  },
  {
    id: "anime",
    name: "Neo-Anime Ghibli",
    description: "Soft hand-drawn textures, high saturation sky elements, watercolor clouds, glowing keys",
    preview: "from-sky-900/40 via-indigo-950/40 to-emerald-900/40 border-sky-500/20 text-sky-400"
  },
  {
    id: "unreal",
    name: "Unreal Engine 5 Render",
    description: "Hyper-detailed 3D assets, global illumination, ray-traced shadows, metallic surface realism",
    preview: "from-amber-900/40 via-orange-950/40 to-yellow-900/40 border-amber-500/20 text-amber-400"
  }
];

// Aspect Ratio configurations with visual frame ratios
const ASPECT_RATIOS = [
  { id: "2.39", label: "2.39:1 Anamorphic", sub: "Cinema Widescreen", ratioClass: "h-6 w-14" },
  { id: "16.9", label: "16:9 Cinematic", sub: "Standard Landscape", ratioClass: "h-8 w-14" },
  { id: "9.16", label: "9:16 Vertical", sub: "Mobile / TikTok", ratioClass: "h-12 w-7" }
];

// Cinematic color palettes
const COLOR_PALETTES = [
  { id: "matrix", name: "Matrix Green", description: "Monochrome green hues, digital matrix atmosphere", colors: ["#052e16", "#15803d", "#022c22"] },
  { id: "bladerunner", name: "Runner Amber", description: "Dusk amber skies, warm neon reflections", colors: ["#451a03", "#d97706", "#7c2d12"] },
  { id: "interstellar", name: "Deep Space Blue", description: "Deep stellar blues, high-contrast starlight", colors: ["#172554", "#3b82f6", "#1e3a8a"] },
  { id: "tealorange", name: "Teal & Orange", description: "Classic high-contrast cinema blockbusters", colors: ["#0f172a", "#f97316", "#0e7490"] }
];

export default function StylePage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  // Sync to design state
  usePhaseSync("design");

  const { agent } = useAgent({ agentId: "default" });

  // Local state persistence fallback
  const [loadedDesign, setLoadedDesign] = React.useState<any>(null);

  // Load design checkpoint on mount
  React.useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          setLoadedDesign(design);
          if (agent && (!agent.state?.design?.style_prompt)) {
            agent.setState({
              ...agent.state,
              design,
            });
          }
        }
      })
      .catch((err) => console.warn("[Style] Failed to load design state:", err));
  }, [projectId]);

  // Sync design states
  const design = agent?.state?.design || loadedDesign || {};
  const globalArtStyle = design.art_style || "cyberpunk";
  const customStylePrompt = design.style_prompt || "";
  const aspect_ratio = design.aspect_ratio || "16.9";
  const color_palette = design.color_palette || "bladerunner";
  const negative_prompt = design.negative_prompt || "blurry, low quality, distorted, extra limbs, bad proportions";

  const handleUpdateStyleField = (fields: Record<string, any>) => {
    if (!agent) return;
    agent.setState({
      ...agent.state,
      design: {
        ...design,
        ...fields
      }
    });
  };

  const selectArtPreset = (styleId: string) => {
    const preset = PRESET_ART_STYLES.find(p => p.id === styleId);
    handleUpdateStyleField({
      art_style: styleId,
      style_prompt: preset ? preset.description : customStylePrompt
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header Navigation */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
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
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Aesthetic Style Lab</BreadcrumbPage>
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

      {/* Main Centralized Single-Column Workspace */}
      <div className="flex-1 overflow-y-auto bg-background/30">
        <div className="max-w-4xl mx-auto py-8 px-6 space-y-10">

          {/* Section 0: Majestic Header Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl border border-border bg-card/60 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <PaletteIcon className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Aesthetic Style Lab</h1>
                <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                  Sculpt the global art direction, aspect ratios, and cinematic grading colors for your movie universe.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/workspace/${projectId}/design/breakdown`)}
                className="text-xs font-semibold h-9"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-1.5" />
                Back to Breakdown
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push(`/workspace/${projectId}/design/storyboard`)}
                className="text-xs font-semibold h-9"
              >
                Next: Storyboard
                <ArrowRightIcon className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Section 1: Preset Art Styles Grid */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold tracking-wider text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Aesthetic Rendering Presets
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">
                Select a baseline artistic rendering model or pipeline style for the generated shots.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_ART_STYLES.map((style) => {
                const isSelected = globalArtStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => selectArtPreset(style.id)}
                    className={cn(
                      "p-5 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-32 select-none group",
                      isSelected
                        ? "border-primary bg-primary/[0.03] shadow-sm shadow-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-card hover:border-primary/20 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn("absolute inset-0 opacity-[0.08] blur-xl -z-10 bg-gradient-to-br", style.preview)}></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground group-hover:text-primary transition-colors">
                        {style.name}
                      </span>
                      {isSelected && <CheckCircle2Icon className="w-4.5 h-4.5 text-primary" />}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mt-2">
                      {style.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Section 2: Interactive Aspect Ratio Selector */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold tracking-wider text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Aspect Ratio Console (Canvas Format)
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">
                Configure the widescreen or portrait dimensions for video rendering.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ASPECT_RATIOS.map((ratio) => {
                const isSelected = aspect_ratio === ratio.id;
                return (
                  <div
                    key={ratio.id}
                    onClick={() => handleUpdateStyleField({ aspect_ratio: ratio.id })}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between items-center h-32 text-center cursor-pointer transition-all select-none group",
                      isSelected
                        ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                        : "border-border/60 bg-card hover:border-primary/20 hover:bg-muted/30"
                    )}
                  >
                    {/* Visual aspect ratio helper */}
                    <div className="h-16 flex items-center justify-center w-full">
                      <div className={cn(
                        "rounded bg-muted border border-border/80 group-hover:border-primary/20 transition-all flex items-center justify-center text-[8px] font-bold text-muted-foreground/60 shadow-inner",
                        ratio.ratioClass,
                        isSelected && "border-primary/40 bg-primary/5 text-primary/80"
                      )}>
                        {ratio.id === "2.39" ? "2.39" : ratio.id === "16.9" ? "16:9" : "9:16"}
                      </div>
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold leading-none mb-1", isSelected ? "text-primary" : "text-foreground")}>
                        {ratio.label}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-none">
                        {ratio.sub}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Section 3: Cinematic Color Grading & Mood */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold tracking-wider text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Cinematic Color Grading & Mood
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">
                Apply master film grade palettes to enforce harmonious atmospheric lights.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COLOR_PALETTES.map((palette) => {
                const isSelected = color_palette === palette.id;
                return (
                  <div
                    key={palette.id}
                    onClick={() => handleUpdateStyleField({ color_palette: palette.id })}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between h-28 text-left cursor-pointer transition-all select-none group",
                      isSelected
                        ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                        : "border-border/60 bg-card hover:border-primary/20 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold leading-none", isSelected ? "text-primary" : "text-foreground")}>
                        {palette.name}
                      </span>
                      {/* Interactive Palette Dots */}
                      <div className="flex gap-1.5 bg-muted/40 p-1 rounded-full border border-border/40 shrink-0">
                        {palette.colors.map((c, i) => (
                          <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }}></div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mt-2">
                      {palette.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Section 4: Dual Prompt Settings (Atmosphere & Negatives) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Style prompt */}
            <div className="space-y-2 p-5 rounded-2xl border border-border/80 bg-card/40">
              <label className="text-xs font-bold tracking-wider text-foreground block">
                Atmosphere Styling Prompts
              </label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Global lighting elements, detail qualifiers, and camera render styles added to positive prompts.
              </p>
              <Textarea
                value={customStylePrompt}
                onChange={(e) => handleUpdateStyleField({ style_prompt: e.target.value })}
                placeholder="Golden hour warm shafts, volumetric lighting, photorealistic 8k..."
                className="bg-background border-border/80 text-xs focus-visible:ring-primary/20 leading-relaxed min-h-[90px] rounded-xl mt-2"
              />
            </div>

            {/* Negative prompt */}
            <div className="space-y-2 p-5 rounded-2xl border border-border/80 bg-card/40">
              <label className="text-xs font-bold tracking-wider text-foreground block">
                Director Negative Prompts
              </label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Standard elements to exclude from all generated images and videos during pre-rendering.
              </p>
              <Textarea
                value={negative_prompt}
                onChange={(e) => handleUpdateStyleField({ negative_prompt: e.target.value })}
                placeholder="Exclude elements: blurry, cartoon, low contrast..."
                className="bg-background border-border/80 text-xs focus-visible:ring-primary/20 leading-relaxed min-h-[90px] rounded-xl mt-2"
              />
            </div>
          </div>

          {/* Bottom Launcher Row */}
          <div className="flex justify-end pt-4">
            <Button
              variant="default"
              size="lg"
              onClick={() => router.push(`/workspace/${projectId}/design/storyboard`)}
              className="text-xs font-bold px-6 shadow-md"
            >
              Confirm Styles & Launch Storyboard Flow
              <ArrowRightIcon className="w-4.5 h-4.5 ml-2 shrink-0" />
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
