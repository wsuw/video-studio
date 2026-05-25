"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppSidebar } from "@/app/[locale]/studio/app-sidebar"
import { SiteHeader } from "@/app/[locale]/studio/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useTranslation } from "@/components/i18n/translation-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { searchThreads } from "@/lib/langgraph"
import {
  Search,
  FolderPlus,
  Play,
  Trash2,
  Calendar,
  Tv,
  Smartphone,
  Square,
  Sparkles,
  Film,
  Flame,
  Compass,
  User,
  ExternalLink,
  SlidersHorizontal,
  FolderClosed,
  ChevronRight
} from "lucide-react"

// Hardcoded Default Projects to populate the dashboard immediately
const defaultProjects = [
  {
    id: "318b76e2-2a5b-4b13-011b-26514e2d307b",
    name: "Acme SaaS Launch Video",
    prompt: "Create a premium, professional software product video showcasing a clean cybersecurity console dashboard, showing interactive threat maps and real-time collaboration widgets with elegant, sleek geometric transitions.",
    style: "minimalist",
    ratio: "16:9",
    voice: "friendly",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    isDefault: true
  },
  {
    id: "83f0980c-c6f1-4328-986c-486940d93f7c",
    name: "Neon Cyber City Teaser",
    prompt: "A moody, cinematic teaser drenched in rainy neon-cyberpunk aesthetics. Follow a futuristic hacker walking through neon alleyways, hacking digital billboards that flicker with glowing terminal code.",
    style: "cyberpunk",
    ratio: "9:16",
    voice: "deep",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    isDefault: true
  },
  {
    id: "d9b4b1e2-2a5b-4b13-911b-26514e2d307d",
    name: "Retro Pixel Game Trailer",
    prompt: "A fast-paced retro-gaming platformer showcase. A pixelated knight battles through a dark castle dungeon, slashing slimes, unlocking chests overflowing with gold, and facing a giant fire-breathing dragon.",
    style: "pixel",
    ratio: "16:9",
    voice: "tech",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
    isDefault: true
  }
]

// Visual style dictionary for icons and gradients
const styleMetadata: Record<string, { gradient: string; label: string; icon: any; glow: string }> = {
  cinematic: {
    gradient: "from-zinc-900 via-neutral-900 to-stone-900 border-zinc-800/80",
    glow: "shadow-zinc-500/5",
    label: "Cinematic / Realistic",
    icon: Film
  },
  cyberpunk: {
    gradient: "from-purple-950 via-fuchsia-950 to-indigo-950 border-purple-800/30",
    glow: "shadow-purple-500/5",
    label: "Cyberpunk / Neon",
    icon: Flame
  },
  minimalist: {
    gradient: "from-blue-950 via-slate-900 to-indigo-950 border-blue-900/30",
    glow: "shadow-blue-500/5",
    label: "Minimalist Explainer",
    icon: Compass
  },
  pixel: {
    gradient: "from-amber-950 via-orange-950 to-amber-900/80 border-amber-800/30",
    glow: "shadow-amber-500/5",
    label: "16-Bit Pixel Art",
    icon: Sparkles
  }
}

// Ratio dictionary for icons
const ratioMetadata: Record<string, { label: string; icon: any }> = {
  "16:9": { label: "Landscape (16:9)", icon: Tv },
  "9:16": { label: "Vertical (9:16)", icon: Smartphone },
  "1:1": { label: "Square (1:1)", icon: Square }
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [projects, setProjects] = React.useState<any[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedRatio, setSelectedRatio] = React.useState<string>("all")
  const [selectedStyle, setSelectedStyle] = React.useState<string>("all")

  // Load custom projects and combine with default templates
  React.useEffect(() => {
    async function loadProjects() {
      let customList: any[] = []
      
      // 1. Try to load custom projects from LangGraph server
      try {
        const threads = await searchThreads()
        if (Array.isArray(threads)) {
          customList = threads.map((t: any) => ({
            id: t.thread_id,
            name: t.metadata?.name || "Untitled Project",
            prompt: t.metadata?.prompt || "Created via VideoStudio.",
            style: t.metadata?.style || "cinematic",
            ratio: t.metadata?.ratio || "16:9",
            voice: t.metadata?.voice || "deep",
            createdAt: t.metadata?.createdAt || t.created_at || new Date().toISOString(),
          }))
          
          // Cache the synced projects back to localStorage for offline robustness
          localStorage.setItem("video-agent:projects", JSON.stringify(customList))
        }
      } catch (err) {
        console.warn("[Projects Page] Failed to fetch threads from server. Falling back to local storage.", err)
        // 2. Fallback to localStorage if server is offline or fails
        try {
          const stored = localStorage.getItem("video-agent:projects")
          customList = stored ? JSON.parse(stored) : []
        } catch (e) {
          console.error("Failed to load local projects fallback:", e)
        }
      }

      // 3. Merge: unique keys
      const merged = [...defaultProjects]
      customList.forEach((cp: any) => {
        if (!merged.some(p => p.id === cp.id)) {
          merged.push({
            ...cp,
            isDefault: false
          })
        }
      })
      
      // Sort: newest first
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setProjects(merged)
    }

    loadProjects()
  }, [])

  // Handle Project Deletion
  const handleDelete = (id: string, name: string, isDefault: boolean, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent clicking the card navigation
    e.preventDefault()
    
    if (isDefault) {
      toast.error(`"${name}" is a protected system preset and cannot be deleted.`, {
        duration: 3000
      })
      return
    }

    try {
      const stored = localStorage.getItem("video-agent:projects")
      const customList = stored ? JSON.parse(stored) : []
      const filtered = customList.filter((p: any) => p.id !== id)
      localStorage.setItem("video-agent:projects", JSON.stringify(filtered))
      
      // Check if deleted project was current-project, clear it
      const current = localStorage.getItem("video-agent:current-project")
      if (current && JSON.parse(current).id === id) {
        localStorage.removeItem("video-agent:current-project")
      }

      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success(`Project "${name}" successfully deleted!`, {
        description: "All offline local cache has been cleared.",
        duration: 3000
      })
    } catch (err) {
      toast.error("Failed to delete project.")
      console.error(err)
    }
  }

  // Filter projects based on query, aspect ratio, and style
  const filteredProjects = React.useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.prompt.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesRatio = selectedRatio === "all" || project.ratio === selectedRatio
      const matchesStyle = selectedStyle === "all" || project.style === selectedStyle

      return matchesSearch && matchesRatio && matchesStyle
    })
  }, [projects, searchQuery, selectedRatio, selectedStyle])

  // Helper: Format Dates Elegantly
  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
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
        <SiteHeader title={t("studio.projects", "Projects")} />
        <Toaster position="top-right" closeButton richColors />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-zinc-950/40 p-4 md:p-8 lg:p-12">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header intro */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                  <FolderClosed className="size-3 animate-pulse" />
                  VideoStudio Creative Workspace
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                  My Projects
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Manage active AI director agents, screenplay planning pipelines, and rendering pipelines.
                </p>
              </div>

              <Link href="/studio">
                <Button 
                  size="lg"
                  className="bg-primary hover:bg-primary/95 text-white shadow-lg transition-transform hover:-translate-y-0.5 group rounded-xl px-5 h-12"
                >
                  <FolderPlus className="size-4 mr-2" />
                  New Project
                  <ChevronRight className="size-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* Advanced Search, Filters & Controls Bar */}
            <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search input */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <Input
                    placeholder="Search projects by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-white/50 dark:bg-zinc-950/30 border-slate-200 dark:border-zinc-800 focus-visible:ring-primary text-sm font-medium rounded-xl"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-zinc-800/40 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-700/30">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-muted-foreground px-2">Aspect Ratio:</span>
                    {["all", "16:9", "9:16", "1:1"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setSelectedRatio(r)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                          selectedRatio === r
                            ? "bg-primary text-white shadow-sm"
                            : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {r === "all" ? "All" : r}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-zinc-800/40 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-700/30">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-muted-foreground px-2">Style:</span>
                    {["all", "cinematic", "cyberpunk", "minimalist", "pixel"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedStyle(s)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all capitalize ${
                          selectedStyle === s
                            ? "bg-primary text-white shadow-sm"
                            : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {s === "all" ? "All" : s === "pixel" ? "Pixel Art" : s}
                      </button>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Projects Grid Section */}
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => {
                  const styleMeta = styleMetadata[project.style] || styleMetadata.cinematic
                  const ratioMeta = ratioMetadata[project.ratio] || { label: project.ratio, icon: Tv }
                  const StyleIcon = styleMeta.icon
                  const RatioIcon = ratioMeta.icon

                  return (
                    <Card 
                      key={project.id}
                      onClick={() => router.push(`/workspace/${project.id}/design/script`)}
                      className={`group border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900 backdrop-blur-md shadow-sm hover:shadow-xl hover:-translate-y-1.5 duration-300 transition-all cursor-pointer overflow-hidden relative flex flex-col justify-between`}
                    >
                      {/* Interactive Visual Preview Header */}
                      <div className={`h-40 relative bg-gradient-to-tr ${styleMeta.gradient} flex items-center justify-center border-b border-slate-200/50 dark:border-zinc-800/50 overflow-hidden`}>
                        {/* Interactive glow effect */}
                        <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/30 group-hover:scale-105 duration-700 ease-in-out transition-transform" />
                        
                        {/* Artistic Mock Design Element */}
                        <div className="absolute inset-0 opacity-15 mix-blend-overlay flex flex-wrap gap-1 p-2 justify-center content-center select-none pointer-events-none scale-110">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="w-16 h-8 rounded border border-white bg-white/20 animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
                          ))}
                        </div>

                        {/* Floating Metadata Badges */}
                        <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                          {project.isDefault && (
                            <Badge variant="secondary" className="bg-primary/20 hover:bg-primary/20 text-primary border-primary/25 font-mono text-[9px] font-bold uppercase tracking-wider">
                              SYSTEM PRESET
                            </Badge>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 z-10">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-zinc-300 border border-zinc-700/50">
                            ID: {project.id.slice(0, 6)}...
                          </span>
                        </div>

                        {/* Centered Play Button Overlay */}
                        <div className="relative z-10 flex flex-col items-center justify-center gap-2 group-hover:scale-110 transition-transform duration-300">
                          <div className="size-12 rounded-full bg-white/90 dark:bg-zinc-950/80 hover:bg-white text-primary flex items-center justify-center shadow-lg border border-white/25 dark:border-zinc-700/30 transition-colors">
                            <Play className="size-5 fill-primary text-primary ml-0.5" />
                          </div>
                          <span className="text-[10px] font-mono font-bold tracking-wider text-white bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-0.5 border border-white/10 uppercase">
                            Open Workspace
                          </span>
                        </div>

                        {/* Style Overlay label at bottom */}
                        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-white/95 font-mono text-[10px] tracking-wide font-bold bg-black/35 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                          <StyleIcon className="size-3.5 text-primary" />
                          {styleMeta.label}
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2.5">
                          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-primary duration-200 transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 font-medium">
                            {project.prompt}
                          </p>
                        </div>

                        {/* Badges footer row */}
                        <div className="space-y-4 pt-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/20 text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                              <RatioIcon className="size-3" />
                              {project.ratio}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-semibold border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/20 text-slate-600 dark:text-zinc-300 flex items-center gap-1 capitalize">
                              <User className="size-3" />
                              {project.voice} Voice
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-zinc-800/40 pt-3 text-[11px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(project.createdAt)}
                            </span>
                            
                            {/* Delete Action button */}
                            {!project.isDefault && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => handleDelete(project.id, project.name, project.isDefault, e)}
                                className="size-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors z-20"
                                tooltip="Delete Project"
                              >
                                <Trash2 className="size-3.5" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            )}
                          </div>
                        </div>

                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              /* High-End Stunning Empty State */
              <Card className="border border-dashed border-slate-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 backdrop-blur-md py-16 px-4 text-center">
                <CardContent className="space-y-6 max-w-md mx-auto">
                  <div className="relative flex justify-center">
                    <div className="absolute -inset-4 bg-primary/15 rounded-full blur-lg animate-pulse" />
                    <div className="relative p-5 bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 text-primary rounded-full shadow-inner">
                      <FolderClosed className="size-12" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      No Projects Match
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      We couldn't find any projects matching your search term or active filter criteria. Clear filters or create a new project.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedRatio("all")
                        setSelectedStyle("all")
                        toast.success("Filters successfully reset!")
                      }}
                      className="rounded-xl border-slate-200 hover:bg-slate-100 dark:border-zinc-800 dark:hover:bg-zinc-800 text-sm font-semibold"
                    >
                      Clear Filters
                    </Button>
                    <Link href="/studio">
                      <Button className="bg-primary hover:bg-primary/95 text-white shadow-lg rounded-xl text-sm font-semibold">
                        Create Video Workspace
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
