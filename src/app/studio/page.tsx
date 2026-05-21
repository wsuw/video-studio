"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/app/studio/app-sidebar"
import { SiteHeader } from "@/app/studio/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateThreadState, createThread } from "@/lib/langgraph"
import {
  Sparkles,
  Video,
  Tv,
  Smartphone,
  Square,
  Wand2,
  Film,
  Flame,
  User,
  Compass,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Bookmark,
  Check
} from "lucide-react"

// Creative Templates / Presets for Right Side Gallery
const creativeTemplates = [
  {
    id: "saas",
    name: "Tech SaaS Explainer",
    icon: "🚀",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    projectName: "SaaS Launch Explainer Video",
    prompt: "Create a premium, professional software product video showcasing a clean cybersecurity console dashboard, showing interactive threat maps and real-time collaboration widgets with elegant, sleek geometric transitions.",
    style: "minimalist",
    ratio: "16:9",
    voice: "friendly",
    tagline: "Ideal for product demos & tech pitches"
  },
  {
    id: "cyberpunk",
    name: "Neon Cyberpunk Teaser",
    icon: "🔮",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    projectName: "Cyber City Neon Teaser",
    prompt: "A moody, cinematic teaser drenched in rainy neon-cyberpunk aesthetics. Follow a futuristic hacker walking through neon alleyways, hacking digital billboards that flicker with glowing terminal code.",
    style: "cyberpunk",
    ratio: "9:16",
    voice: "deep",
    tagline: "Great for TikTok / Reels teasers"
  },
  {
    id: "retro",
    name: "16-Bit Retro Game Promo",
    icon: "🎮",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    projectName: "80s Style Game Trailer",
    prompt: "A fast-paced retro-gaming platformer showcase. A pixelated knight battles through a dark castle dungeon, slashing slimes, unlocking chests overflowing with gold, and facing a giant fire-breathing dragon.",
    style: "pixel",
    ratio: "16:9",
    voice: "tech",
    tagline: "Perfect for indie game creators"
  },
  {
    id: "resort",
    name: "Luxury Resort Showcase",
    icon: "🌴",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    projectName: "Elysian Island Social Promo",
    prompt: "A high-end luxury resort social media showcase. Capture stunning drone shots of beach infinity pools at sunset, wood cabins nested deep in tropical greenery, and guests enjoying fresh coconut juices on white sands.",
    style: "cinematic",
    ratio: "9:16",
    voice: "friendly",
    tagline: "Perfect for marketing & travel promos"
  }
]

// Prompt Presets (in-context suggestions)
const promptPresets = [
  {
    icon: "🚀",
    label: "SaaS Launch",
    prompt: "A dynamic, high-energy SaaS product launch video. Display a modern cloud dashboard, real-time collaboration charts, and showcase how AI automates redundant workflows with slick, modern transition animations."
  },
  {
    icon: "🔮",
    label: "Cyberpunk Cinematic",
    prompt: "A moody, cinematic teaser drenched in rainy neon-cyberpunk aesthetics. Follow a futuristic hacker walking through neon alleyways, hacking digital billboards that flicker with green terminal code."
  },
  {
    icon: "✏️",
    label: "Minimalist Explainer",
    prompt: "A clean and engaging minimalist flat-vector explainer video. Simple geometric shapes assembly to explain the concept of neural networks and deep learning in a friendly, lighthearted tone."
  }
]

// Visual Style Profiles
const styleProfiles = [
  { id: "cinematic", name: "Cinematic / Realistic", icon: Film, desc: "Anamorphic lens, rich shadows, high production value" },
  { id: "cyberpunk", name: "Cyberpunk / Neon", icon: Flame, desc: "Saturated neon colors, techno-futures, foggy night-scapes" },
  { id: "minimalist", name: "Minimalist Explainer", icon: Compass, desc: "Simple clean illustrations, corporate-friendly vector look" },
  { id: "pixel", name: "16-Bit Pixel Art", icon: Sparkles, desc: "Retro-gaming style, vibrant palettes, nostalgic atmosphere" }
]

// Aspect Ratio Options
const aspectRatios = [
  { id: "16:9", label: "Landscape (16:9)", icon: Tv, desc: "YouTube, TV, Presentations" },
  { id: "9:16", label: "Vertical (9:16)", icon: Smartphone, desc: "TikTok, Reels, Shorts" },
  { id: "1:1", label: "Square (1:1)", icon: Square, desc: "Instagram, LinkedIn feeds" }
]

// Voiceover Tones
const voiceTones = [
  { id: "deep", label: "Deep Cinematic Narrator", accent: "Rich & Dramatic" },
  { id: "friendly", label: "Friendly Corporate Explainer", accent: "Warm & Clear" },
  { id: "tech", label: "High-Energy Tech Reviewer", accent: "Fast & Enthusiastic" },
  { id: "none", label: "No Voiceover (BGM only)", accent: "Instrumental Focus" }
]

export default function Page() {
  const router = useRouter()
  const [projectName, setProjectName] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [selectedStyle, setSelectedStyle] = React.useState("cinematic")
  const [selectedRatio, setSelectedRatio] = React.useState("16:9")
  const [selectedVoice, setSelectedVoice] = React.useState("deep")

  // Track currently applied template ID
  const [activeTemplateId, setActiveTemplateId] = React.useState<string | null>(null)

  // Loading Simulation Overlay State
  const [isInitializing, setIsInitializing] = React.useState(false)
  const [loadingStep, setLoadingStep] = React.useState(0)

  const handlePresetClick = (presetPrompt: string) => {
    setPrompt(presetPrompt)
    setActiveTemplateId(null) // Reset active template if custom preset clicked
  }

  const handleApplyTemplate = (tmpl: typeof creativeTemplates[number]) => {
    setProjectName(tmpl.projectName)
    setPrompt(tmpl.prompt)
    setSelectedStyle(tmpl.style)
    setSelectedRatio(tmpl.ratio)
    setSelectedVoice(tmpl.voice)
    setActiveTemplateId(tmpl.id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsInitializing(true)

    // 1. Trigger visual pipeline building milestones (matches loader overlay checkmark animations)
    const timer1 = setTimeout(() => setLoadingStep(1), 800)
    const timer2 = setTimeout(() => setLoadingStep(2), 1600)
    const timer3 = setTimeout(() => setLoadingStep(3), 2400)

    const finalProjectName = projectName || "Untitled Video Project"
    const finalPrompt = prompt || "A creative video project"

    // Create a minimum delay promise of 3200ms to allow visual step animations to play smoothly
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 3200))

    // 2. Real async network sync to LangGraph server running on port 8123 in the background!
    const syncAndRedirect = async () => {
      try {
        const LANGGRAPH_API_URL = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:8123"

        // A. First, create the thread with custom metadata (user_id, name, prompt, ratio, style, voice)
        const threadData = await createThread({
          name: finalProjectName,
          prompt: finalPrompt,
          style: selectedStyle,
          ratio: selectedRatio,
          voice: selectedVoice,
          createdAt: new Date().toISOString()
        })
        const newProjectId = threadData.thread_id // This is the server-generated valid UUID!

        // B. Second, populate the initial screenplay state
        const initialScript = `# 🎬 ${finalProjectName}\n\n## Creative Concept\n${finalPrompt}\n\n## Configurations\n- **Aspect Ratio**: ${selectedRatio}\n- **Style Profile**: ${selectedStyle}\n- **Narrative Voice**: ${selectedVoice} Voice\n\n---\n\n*Your AI director agent is ready! Type in the right sidebar chat to instruct the agent to expand this script.*`

        await updateThreadState(newProjectId, {
          design: {
            script: initialScript
          }
        })
        console.log("Successfully created and seeded LangGraph thread:", newProjectId)

        // C. Save project metadata to localStorage projects list
        const newProject = {
          id: newProjectId,
          name: finalProjectName,
          prompt: finalPrompt,
          style: selectedStyle,
          ratio: selectedRatio,
          voice: selectedVoice,
          createdAt: new Date().toISOString()
        }

        const stored = localStorage.getItem("video-agent:projects")
        const currentProjects = stored ? JSON.parse(stored) : []
        currentProjects.push(newProject)
        localStorage.setItem("video-agent:projects", JSON.stringify(currentProjects))
        localStorage.setItem("video-agent:current-project", JSON.stringify(newProject))

        // D. Wait for minimum visual onboarding delay to complete so step checks render perfectly
        await delayPromise

        // E. Redirect to the newly created project workspace
        router.push(`/workspace/${newProjectId}/design/script`)
      } catch (err) {
        console.error("Pipeline initialization failed:", err)
        // Fallback to client-side optimistic routing if server is offline
        const fallbackId = "bf49d9af-74ed-46bb-aacd-a842c92e1a1b" // static fallback UUID
        const fallbackProject = {
          id: fallbackId,
          name: finalProjectName,
          prompt: finalPrompt,
          style: selectedStyle,
          ratio: selectedRatio,
          voice: selectedVoice,
          createdAt: new Date().toISOString()
        }
        try {
          const stored = localStorage.getItem("video-agent:projects")
          const currentProjects = stored ? JSON.parse(stored) : []
          if (!currentProjects.some((p: any) => p.id === fallbackId)) {
            currentProjects.push(fallbackProject)
          }
          localStorage.setItem("video-agent:projects", JSON.stringify(currentProjects))
          localStorage.setItem("video-agent:current-project", JSON.stringify(fallbackProject))
        } catch (e) {
          console.error(e)
        }
        await delayPromise
        router.push(`/workspace/${fallbackId}/design/script`)
      }
    }

    syncAndRedirect()

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="relative">
        <SiteHeader />

        {/* Main interactive quick create page container */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-zinc-950/40 p-4 md:p-8 lg:p-12">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Header intro */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-3 animate-pulse" />
                Autonomous Creative Engine
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                Quick Create Video Project
              </h1>
              <p className="text-muted-foreground text-lg max-w-3xl">
                Initialize your autonomous AI director to handle scriptwriting, actor breakdown, and shot composition.
              </p>
            </div>

            {/* Two Column Workspace Setup Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left Side: Creation Form (Col Span 2) */}
              <div className="lg:col-span-2 space-y-8">
                <form onSubmit={handleSubmit} className="space-y-8">

                  {/* Card 1: Core Details */}
                  <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                    <CardContent className="p-6 space-y-6">

                      {/* Field A: Project Name */}
                      <div className="space-y-2">
                        <Label htmlFor="projectName" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                          Project Name
                        </Label>
                        <Input
                          id="projectName"
                          required
                          placeholder="e.g. Acme SaaS Product Launch, Cyberpunk Short Teaser..."
                          value={projectName}
                          onChange={(e) => {
                            setProjectName(e.target.value)
                            setActiveTemplateId(null) // Reset template if modified
                          }}
                          className="h-12 bg-white/50 dark:bg-zinc-950/30 border-slate-200 dark:border-zinc-800 focus-visible:ring-primary focus-visible:border-primary text-base font-medium rounded-xl"
                        />
                      </div>

                      {/* Field B: prompt */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="prompt" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                            Creative Concept / Prompt
                          </Label>
                          <span className="text-xs font-mono text-muted-foreground">
                            Detailed prompts deliver stellar results
                          </span>
                        </div>
                        <Textarea
                          id="prompt"
                          required
                          placeholder="Describe what you want to achieve. Let our AI director know about the mood, storyline, transitions, or details..."
                          value={prompt}
                          onChange={(e) => {
                            setPrompt(e.target.value)
                            setActiveTemplateId(null) // Reset template if modified
                          }}
                          className="min-h-[140px] bg-white/50 dark:bg-zinc-950/30 border-slate-200 dark:border-zinc-800 focus-visible:ring-primary focus-visible:border-primary rounded-xl text-base leading-relaxed p-4"
                        />

                        {/* Prompt Presets / Fast Fillers */}
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-slate-500">
                            Or start with a quick concept template:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {promptPresets.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handlePresetClick(preset.prompt)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60 border border-slate-200/50 dark:border-zinc-700/30 transition-all text-slate-700 dark:text-zinc-200"
                              >
                                <span>{preset.icon}</span>
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Visual Style Selector */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardContent className="p-6 space-y-4">
                        <Label className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                          Visual Style Profile
                        </Label>
                        <div className="grid grid-cols-1 gap-3">
                          {styleProfiles.map((style) => {
                            const Icon = style.icon
                            const isSelected = selectedStyle === style.id
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => {
                                  setSelectedStyle(style.id)
                                  setActiveTemplateId(null)
                                }}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${isSelected
                                  ? "bg-primary/5 border-primary shadow-sm dark:bg-primary/10"
                                  : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/60 hover:bg-slate-50/80 dark:hover:bg-zinc-800/30"
                                  }`}
                              >
                                <div className={`p-2 rounded-lg border ${isSelected ? "bg-primary text-white border-primary" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                                  }`}>
                                  <Icon className="size-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{style.name}</div>
                                  <div className="text-xs text-muted-foreground leading-tight">{style.desc}</div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Aspect Ratio Selector */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardContent className="p-6 space-y-4">
                        <Label className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                          Aspect Ratio
                        </Label>
                        <div className="grid grid-cols-1 gap-3">
                          {aspectRatios.map((ratio) => {
                            const Icon = ratio.icon
                            const isSelected = selectedRatio === ratio.id
                            return (
                              <button
                                key={ratio.id}
                                type="button"
                                onClick={() => {
                                  setSelectedRatio(ratio.id)
                                  setActiveTemplateId(null)
                                }}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${isSelected
                                  ? "bg-primary/5 border-primary shadow-sm dark:bg-primary/10"
                                  : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/60 hover:bg-slate-50/80 dark:hover:bg-zinc-800/30"
                                  }`}
                              >
                                <div className={`p-2 rounded-lg border ${isSelected ? "bg-primary text-white border-primary" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                                  }`}>
                                  <Icon className="size-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{ratio.label}</div>
                                  <div className="text-xs text-muted-foreground leading-tight">{ratio.desc}</div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                  </div>

                  {/* Card 3: Voiceover Settings */}
                  <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                    <CardContent className="p-6 space-y-4">
                      <Label className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                        Narrative Voice / Tone Accent
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {voiceTones.map((voice) => {
                          const isSelected = selectedVoice === voice.id
                          return (
                            <button
                              key={voice.id}
                              type="button"
                              onClick={() => {
                                setSelectedVoice(voice.id)
                                setActiveTemplateId(null)
                              }}
                              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${isSelected
                                ? "bg-primary/5 border-primary shadow-sm dark:bg-primary/10"
                                : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/60 hover:bg-slate-50/80 dark:hover:bg-zinc-800/30"
                                }`}
                            >
                              <div className={`p-2.5 rounded-full border mb-2 ${isSelected ? "bg-primary text-white border-primary" : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                                }`}>
                                <User className="size-4" />
                              </div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{voice.label}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{voice.accent}</div>
                            </button>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-14 px-8 text-base bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 group"
                    >
                      Create Video Workspace
                      <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>

                </form>
              </div>

              {/* Right Side: Inspiration Gallery of Templates */}
              <div className="space-y-6">
                <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm sticky top-6">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Bookmark className="size-4 text-primary" />
                      <CardTitle className="text-lg font-bold">Premium Presets</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Deploy with a pre-configured director profile to launch in one click.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {creativeTemplates.map((tmpl) => {
                      const isApplied = activeTemplateId === tmpl.id
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => handleApplyTemplate(tmpl)}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${isApplied
                            ? "bg-primary/5 border-primary shadow-md dark:bg-primary/10"
                            : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                            }`}
                        >
                          <div className="text-2xl mt-1 shrink-0">{tmpl.icon}</div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {tmpl.name}
                              </span>
                              {isApplied && (
                                <span className="inline-flex items-center justify-center size-4 bg-primary text-white rounded-full">
                                  <Check className="size-2.5" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {tmpl.prompt}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 uppercase tracking-wider">
                                {tmpl.ratio}
                              </span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 capitalize">
                                {tmpl.style}
                              </span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 capitalize">
                                {tmpl.voice} Voice
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </div>

        {/* Dynamic Glowing Pipeline Initialization Overlay */}
        {isInitializing && (
          <div className="fixed inset-0 bg-slate-50/95 dark:bg-zinc-950/95 z-50 flex items-center justify-center p-6 backdrop-blur-sm transition-colors duration-300">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8 animate-in fade-in zoom-in-95 duration-300">

              {/* Glow effect at top */}
              <div className="relative flex justify-center">
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="relative p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-primary rounded-full shadow-inner">
                  <Loader2 className="size-10 animate-spin" />
                </div>
              </div>

              {/* Copy */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Initializing Autonomous Video Pipeline</h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm text-center">
                  Spinning up LangGraph agent workflows and supervisors for <span className="text-primary font-semibold">"{projectName || "Untitled Video"}"</span>...
                </p>
              </div>

              {/* Progress Milestones Checklist */}
              <div className="space-y-4 pt-2">
                {[
                  { label: "Supervisor Agent: Bootstrapping breakdown state...", desc: "Initializing subgraphs and context checkpoints" },
                  { label: "Director Agent: Designing script blueprint outline...", desc: "Structuring text concepts and narration hooks" },
                  { label: "Storyboard Supervisor: Pre-framing key asset layouts...", desc: "Synthesizing dynamic composition matrices" }
                ].map((step, idx) => {
                  const isDone = loadingStep > idx
                  const isActive = loadingStep === idx
                  return (
                    <div
                      key={step.label}
                      className={`flex items-start gap-3.5 p-3 rounded-2xl transition-all duration-300 border ${isDone
                        ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/20 text-slate-800 dark:text-zinc-100"
                        : isActive
                          ? "bg-primary/5 border-primary/20 text-slate-800 dark:text-zinc-100 font-medium"
                          : "border-transparent text-slate-400 dark:text-zinc-500 opacity-40"
                        }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-5 text-green-500 shrink-0 mt-0.5" />
                      ) : isActive ? (
                        <Loader2 className="size-5 text-primary shrink-0 animate-spin mt-0.5" />
                      ) : (
                        <div className="size-5 rounded-full border border-slate-300 dark:border-zinc-700 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 text-left">
                        <div className={`text-xs font-semibold ${isDone ? "text-green-600 dark:text-green-400" : isActive ? "text-primary" : "text-slate-700 dark:text-zinc-300"}`}>{step.label}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">{step.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        )}

      </SidebarInset>
    </SidebarProvider>
  )
}
