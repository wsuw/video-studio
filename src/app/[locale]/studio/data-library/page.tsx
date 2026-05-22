"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/app/[locale]/studio/app-sidebar"
import { SiteHeader } from "@/app/[locale]/studio/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Trash2,
  FolderOpen,
  Tv,
  Smartphone,
  Square,
  Sparkles,
  User,
  Play,
  Pause,
  Download,
  Copy,
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  Database,
  FileSpreadsheet,
  PlusCircle,
  Volume2,
  Image as ImageIcon,
  Layers,
  Check,
  X,
  AlertTriangle,
  Tag,
  Info,
  Music,
  Eye,
  Sliders,
  Palette,
  Type,
  FileCode,
  ExternalLink
} from "lucide-react"

// --- TYPES & INTERFACES ---
interface BrandColor {
  id: string;
  name: string;
  hex: string;
}

interface LogoAsset {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

interface FontAsset {
  id: string;
  name: string;
  provider: string;
  category: string;
}

interface MediaAsset {
  id: string;
  name: string;
  type: "audio" | "video" | "image" | "watermark";
  duration?: string;
  size: string;
  url?: string;
  resolution?: string;
}

interface DocumentAsset {
  id: string;
  name: string;
  type: string;
  charCount: number;
  content: string;
}

interface DataSourceAsset {
  id: string;
  name: string;
  type: string;
  headers: string[];
  data: string[][];
}

export default function DataLibraryPage() {
  const router = useRouter()

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = React.useState<"brand" | "media" | "docs" | "data">("brand")

  // --- BRAND KIT STATE ---
  const [colors, setColors] = React.useState<BrandColor[]>([
    { id: "col-1", name: "Brand Primary", hex: "#3b82f6" },
    { id: "col-2", name: "Brand Accent", hex: "#8b5cf6" },
    { id: "col-3", name: "Dark Neutral", hex: "#1e293b" },
    { id: "col-4", name: "Light Neutral", hex: "#f8fafc" }
  ])
  const [newColorName, setNewColorName] = React.useState("")
  const [newColorHex, setNewColorHex] = React.useState("#3b82f6")

  const [logos, setLogos] = React.useState<LogoAsset[]>([
    { id: "logo-1", name: "Acme Logo White", type: "PNG", size: "42 KB", url: "/logos/acme_white.png" },
    { id: "logo-2", name: "Acme Mark Gradient", type: "SVG", size: "12 KB", url: "/logos/acme_gradient.svg" }
  ])
  const [selectedLogoId, setSelectedLogoId] = React.useState<string>("logo-1")

  const [fonts, setFonts] = React.useState<FontAsset[]>([
    { id: "font-1", name: "Outfit Display", provider: "Google Fonts", category: "Display" },
    { id: "font-2", name: "Inter Sans", provider: "Google Fonts", category: "Sans-Serif" }
  ])
  const [newFontName, setNewFontName] = React.useState("")

  // --- MEDIA ASSETS STATE ---
  const [mediaList, setMediaList] = React.useState<MediaAsset[]>([
    { id: "med-1", name: "Tech Explainer Ambient Sound track", type: "audio", duration: "2:30", size: "3.4 MB", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { id: "med-2", name: "Upbeat Corporate Background Melody", type: "audio", duration: "1:45", size: "2.1 MB", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { id: "med-3", name: "Cyberpunk Glitch Transition Overlay", type: "video", size: "14.2 MB", resolution: "1080p" },
    { id: "med-4", name: "Premium Subtle Watermark Stamp", type: "watermark", size: "85 KB" }
  ])

  // --- AUDIO PREVIEW PLAYER STATE ---
  const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(null)
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null)
  const [audioProgress, setAudioProgress] = React.useState<{ [key: string]: number }>({})

  // --- DOCUMENTS / SCREENPLAY TEMPLATES STATE ---
  const [docsList, setDocsList] = React.useState<DocumentAsset[]>([
    {
      id: "doc-1",
      name: "SaaS Launch Elevator Pitch",
      type: "Script Outline",
      charCount: 420,
      content: "[Scene 1: Introduction]\nVisual: Cyber threat dashboard blinking red.\nAudio: Deep digital voiceover.\nScript: \"Cybersecurity is complex. But it doesn't have to be.\"\n\n[Scene 2: Problem Show]\nVisual: Graph showing rising security breaches.\nScript: \"In 2026, threats evolved faster than ever. Standard firewalls failed.\"\n\n[Scene 3: Solution Showcase]\nVisual: Acme Shield interface blocking attacks instantly.\nScript: \"Introducing Acme Shield. Autonomous threat remediation in under 3 seconds.\""
    },
    {
      id: "doc-2",
      name: "AI Avatar Promo Intro Guidelines",
      type: "Instruction Outline",
      charCount: 220,
      content: "Ensure custom avatars use friendly tone settings.\nSet character positioning to center-bottom with small circular frame borders.\nAdd active dynamic text highlights to the key benefit keywords."
    }
  ])
  const [selectedDocId, setSelectedDocId] = React.useState<string>("doc-1")
  const selectedDoc = React.useMemo(() => docsList.find(d => d.id === selectedDocId), [docsList, selectedDocId])

  // --- DATA SOURCES (CSV/JSON TABLES) STATE ---
  const [dataSources, setDataSources] = React.useState<DataSourceAsset[]>([
    {
      id: "ds-1",
      name: "Acme SaaS Feature Highlights - Q2 Campaign",
      type: "CSV Source",
      headers: ["Feature ID", "Title", "Benefit Highlight", "Visual Asset Reference"],
      data: [
        ["feat_001", "AI Directing", "Break down scenes and plan shots autonomously", "director_workspace"],
        ["feat_002", "Neural Voices", "Synthesize audio in 150+ realistic locales", "voice_library"],
        ["feat_003", "Brand Assets", "Auto-embed custom logos and colors in frames", "brand_kit_page"],
        ["feat_004", "Batch Generation", "Produce 100+ videos instantly from spreadsheet inputs", "csv_import_tool"],
        ["feat_005", "Interactive Editor", "Tweak screenplay scripts with real-time feedback", "chat_agent_widget"]
      ]
    },
    {
      id: "ds-2",
      name: "Customer Testimonial Soundbites",
      type: "JSON Table",
      headers: ["Customer Name", "Company", "Quote", "Rating"],
      data: [
        ["Sarah Jenkins", "ScaleTech Corp", "Acme Video cut our tutorial production time by 80%.", "5 stars"],
        ["David Chen", "Aether Labs", "The local text-to-speech sounds indistinguishable from real actors.", "4.8 stars"],
        ["Marcus Brody", "Apex Media", "Batch generating product explainer variations is a game changer.", "5 stars"]
      ]
    }
  ])
  const [selectedDsId, setSelectedDsId] = React.useState<string>("ds-1")
  const selectedDs = React.useMemo(() => dataSources.find(ds => ds.id === selectedDsId), [dataSources, selectedDsId])

  // Search filter query
  const [searchQuery, setSearchQuery] = React.useState("")

  // --- LIVE VIDEO MOCKUP PREVIEW CONFIG ---
  const [previewColorId, setPreviewColorId] = React.useState<string>("col-1")
  const activePreviewColor = React.useMemo(() => colors.find(c => c.id === previewColorId)?.hex || "#3b82f6", [colors, previewColorId])
  const [showLogoOverlay, setShowLogoOverlay] = React.useState(true)
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = React.useState(true)
  const [mockVideoPlaying, setMockVideoPlaying] = React.useState(false)

  // --- UPLOAD MODAL SIMULATOR STATE ---
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [uploadType, setUploadType] = React.useState<"color" | "logo" | "font" | "media" | "doc" | "data">("media")
  const [uploadName, setUploadName] = React.useState("")
  const [uploadProgress, setUploadProgress] = React.useState(-1) // -1 means idle
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)

  // --- PERSISTENCE ---
  React.useEffect(() => {
    // Load from local storage on mount
    try {
      const stored = localStorage.getItem("video-agent:brand-library")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.colors) setColors(parsed.colors)
        if (parsed.logos) setLogos(parsed.logos)
        if (parsed.fonts) setFonts(parsed.fonts)
        if (parsed.mediaList) setMediaList(parsed.mediaList)
        if (parsed.docsList) setDocsList(parsed.docsList)
        if (parsed.dataSources) setDataSources(parsed.dataSources)
      }
    } catch (e) {
      console.error("Failed to load local brand library assets:", e)
    }
  }, [])

  const saveToLocalStorage = (updatedState: any) => {
    try {
      const stored = localStorage.getItem("video-agent:brand-library")
      const current = stored ? JSON.parse(stored) : {}
      const merged = { ...current, ...updatedState }
      localStorage.setItem("video-agent:brand-library", JSON.stringify(merged))
    } catch (e) {
      console.error(e)
    }
  }

  // --- AUDIO PREVIEW CONTROLLER ---
  React.useEffect(() => {
    const player = new Audio()
    audioPlayerRef.current = player

    const handleTimeUpdate = () => {
      if (playingAudioId) {
        const progress = (player.currentTime / player.duration) * 100
        setAudioProgress(prev => ({
          ...prev,
          [playingAudioId]: isNaN(progress) ? 0 : progress
        }))
      }
    }

    const handleEnded = () => {
      if (playingAudioId) {
        setAudioProgress(prev => ({ ...prev, [playingAudioId]: 0 }))
        setPlayingAudioId(null)
      }
    }

    player.addEventListener("timeupdate", handleTimeUpdate)
    player.addEventListener("ended", handleEnded)

    return () => {
      player.pause()
      player.removeEventListener("timeupdate", handleTimeUpdate)
      player.removeEventListener("ended", handleEnded)
    }
  }, [playingAudioId])

  const togglePlayAudio = (id: string, url: string) => {
    if (!audioPlayerRef.current) return

    if (playingAudioId === id) {
      audioPlayerRef.current.pause()
      setPlayingAudioId(null)
    } else {
      audioPlayerRef.current.src = url
      audioPlayerRef.current.play().catch(e => {
        console.error("Audio playback error:", e)
        toast.error("Failed to play preview audio track.")
      })
      setPlayingAudioId(id)
    }
  }

  // --- HANDLERS ---
  const handleAddColor = () => {
    if (!newColorName.trim()) {
      toast.error("Please provide a color name label.")
      return
    }
    const hexRegex = /^#([0-9a-f]{3}){1,2}$/i
    if (!hexRegex.test(newColorHex)) {
      toast.error("Invalid hex color code.")
      return
    }

    const newColor: BrandColor = {
      id: `col-${Date.now()}`,
      name: newColorName,
      hex: newColorHex
    }

    const next = [...colors, newColor]
    setColors(next)
    saveToLocalStorage({ colors: next })
    setNewColorName("")
    toast.success(`Color "${newColor.name}" successfully added!`)
  }

  const handleDeleteColor = (id: string, name: string) => {
    if (colors.length <= 1) {
      toast.error("Brand kit must retain at least one color.")
      return
    }
    const next = colors.filter(c => c.id !== id)
    setColors(next)
    saveToLocalStorage({ colors: next })
    if (previewColorId === id) {
      setPreviewColorId(next[0].id)
    }
    toast.success(`Color "${name}" removed.`)
  }

  const handleAddFont = () => {
    if (!newFontName.trim()) {
      toast.error("Please enter a font name.")
      return
    }
    const newFont: FontAsset = {
      id: `font-${Date.now()}`,
      name: newFontName,
      provider: "Local Font System",
      category: "Sans-Serif"
    }
    const next = [...fonts, newFont]
    setFonts(next)
    saveToLocalStorage({ fonts: next })
    setNewFontName("")
    toast.success(`Font "${newFont.name}" loaded into Brand Kit.`)
  }

  const handleDeleteFont = (id: string, name: string) => {
    if (fonts.length <= 1) {
      toast.error("Brand kit must retain at least one font profile.")
      return
    }
    const next = fonts.filter(f => f.id !== id)
    setFonts(next)
    saveToLocalStorage({ fonts: next })
    toast.success(`Font "${name}" removed.`)
  }

  const handleDeleteMedia = (id: string, name: string) => {
    const next = mediaList.filter(m => m.id !== id)
    setMediaList(next)
    saveToLocalStorage({ mediaList: next })
    if (playingAudioId === id) {
      audioPlayerRef.current?.pause()
      setPlayingAudioId(null)
    }
    toast.success(`Media asset "${name}" deleted.`)
  }

  const handleDeleteDoc = (id: string, name: string) => {
    if (docsList.length <= 1) {
      toast.error("Document library must retain at least one script.")
      return
    }
    const next = docsList.filter(d => d.id !== id)
    setDocsList(next)
    saveToLocalStorage({ docsList: next })
    if (selectedDocId === id) {
      setSelectedDocId(next[0].id)
    }
    toast.success(`Document "${name}" deleted.`)
  }

  const handleUpdateDocContent = (val: string) => {
    const next = docsList.map(d => {
      if (d.id === selectedDocId) {
        return { ...d, content: val, charCount: val.length }
      }
      return d
    })
    setDocsList(next)
    saveToLocalStorage({ docsList: next })
  }

  // --- DYNAMIC DATA GRID HANDLERS ---
  const handleUpdateCell = (rowIndex: number, colIndex: number, val: string) => {
    const next = dataSources.map(ds => {
      if (ds.id === selectedDsId) {
        const newData = [...ds.data]
        newData[rowIndex] = [...newData[rowIndex]]
        newData[rowIndex][colIndex] = val
        return { ...ds, data: newData }
      }
      return ds
    })
    setDataSources(next)
    saveToLocalStorage({ dataSources: next })
  }

  const handleAddRow = () => {
    if (!selectedDs) return
    const newRow = Array(selectedDs.headers.length).fill("")
    const next = dataSources.map(ds => {
      if (ds.id === selectedDsId) {
        return { ...ds, data: [...ds.data, newRow] }
      }
      return ds
    })
    setDataSources(next)
    saveToLocalStorage({ dataSources: next })
    toast.success("New spreadsheet row added.")
  }

  const handleDeleteRow = (rowIndex: number) => {
    if (!selectedDs) return
    if (selectedDs.data.length <= 1) {
      toast.error("Spreadsheet data source must have at least 1 row.")
      return
    }
    const next = dataSources.map(ds => {
      if (ds.id === selectedDsId) {
        const newData = ds.data.filter((_, idx) => idx !== rowIndex)
        return { ...ds, data: newData }
      }
      return ds
    })
    setDataSources(next)
    saveToLocalStorage({ dataSources: next })
    toast.success("Row deleted.")
  }

  // --- UPLOAD CONTROLLER SIMULATION ---
  const simulateUpload = () => {
    if (!uploadName.trim()) {
      toast.error("Please enter a name for the asset.")
      return
    }

    setUploadProgress(0)
    let p = 0
    const interval = setInterval(() => {
      p += Math.floor(Math.random() * 20) + 10
      if (p >= 100) {
        p = 100
        clearInterval(interval)
        setTimeout(() => {
          finalizeUpload()
        }, 300)
      }
      setUploadProgress(p)
    }, 150)
  }

  const finalizeUpload = () => {
    const assetId = `upload-${Date.now()}`
    const mockSize = selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "450 KB"

    if (uploadType === "logo") {
      const newLogo: LogoAsset = {
        id: assetId,
        name: uploadName,
        type: selectedFile?.name.split(".").pop()?.toUpperCase() || "PNG",
        size: mockSize,
        url: "#"
      }
      const next = [...logos, newLogo]
      setLogos(next)
      saveToLocalStorage({ logos: next })
      setSelectedLogoId(assetId)
      toast.success(`Logo logo "${uploadName}" uploaded!`)
    } else if (uploadType === "media") {
      const isAudio = selectedFile?.type.startsWith("audio") || uploadName.toLowerCase().includes("audio") || uploadName.toLowerCase().includes("music")
      const newMedia: MediaAsset = {
        id: assetId,
        name: uploadName,
        type: isAudio ? "audio" : "video",
        size: mockSize,
        duration: isAudio ? "2:05" : undefined,
        url: isAudio ? "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" : undefined,
        resolution: isAudio ? undefined : "1080p"
      }
      const next = [...mediaList, newMedia]
      setMediaList(next)
      saveToLocalStorage({ mediaList: next })
      toast.success(`Media asset "${uploadName}" added to library!`)
    } else if (uploadType === "doc") {
      const newDoc: DocumentAsset = {
        id: assetId,
        name: uploadName,
        type: "Screenplay Template",
        charCount: 280,
        content: `[Scene 1: Title]\nVisual: Custom graphic overlay\nScript: "Write details for your custom template screenplay here..."`
      }
      const next = [...docsList, newDoc]
      setDocsList(next)
      saveToLocalStorage({ docsList: next })
      setSelectedDocId(assetId)
      toast.success(`Script template "${uploadName}" generated!`)
    } else if (uploadType === "data") {
      const newDs: DataSourceAsset = {
        id: assetId,
        name: uploadName,
        type: "CSV Table",
        headers: ["Column 1", "Column 2", "Column 3"],
        data: [
          ["Sample Data A1", "Sample Data B1", "Sample Data C1"],
          ["Sample Data A2", "Sample Data B2", "Sample Data C2"]
        ]
      }
      const next = [...dataSources, newDs]
      setDataSources(next)
      saveToLocalStorage({ dataSources: next })
      setSelectedDsId(assetId)
      toast.success(`Data sheet "${uploadName}" uploaded successfully.`)
    }

    // Reset simulator form
    setIsUploadOpen(false)
    setUploadProgress(-1)
    setUploadName("")
    setSelectedFile(null)
  }

  // --- RENDER STYLES AND FILTERING ---
  const activeLogoName = React.useMemo(() => {
    return logos.find(l => l.id === selectedLogoId)?.name || "Acme Logo"
  }, [logos, selectedLogoId])

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
        <Toaster position="top-right" closeButton richColors />

        {/* Outer scroll container */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-zinc-950/40 p-4 md:p-8 lg:p-12">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Header section with Stats row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                  <Database className="size-3 animate-pulse" />
                  Asset Control Hub
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
                  Brand & Assets Library
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Manage reusable brand kits, fonts, media overlays, and structured spreadsheet feeds to automate video creation.
                </p>
              </div>

              {/* Upload Button Trigger */}
              <Button
                onClick={() => {
                  setUploadType(activeTab === "brand" ? "logo" : activeTab === "media" ? "media" : activeTab === "docs" ? "doc" : "data")
                  setIsUploadOpen(true)
                }}
                className="bg-primary hover:bg-primary/95 text-white shadow-lg transition-transform hover:-translate-y-0.5 rounded-xl h-12 px-6 shrink-0"
              >
                <UploadCloud className="size-4 mr-2" />
                Upload Assets
              </Button>
            </div>

            {/* QUICK STATS CHIPS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Colors & Logos", value: `${colors.length} Colors / ${logos.length} Logos`, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
                { label: "Media Overlays", value: `${mediaList.length} Library Items`, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
                { label: "Screenplay Layouts", value: `${docsList.length} Active Docs`, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
                { label: "Batch Data Sheets", value: `${dataSources.length} Linked Tables`, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" }
              ].map((stat) => (
                <Card key={stat.label} className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
                  <CardContent className="p-4 space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-muted-foreground">{stat.label}</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* TAB SELECTOR CONTROL BAR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 bg-white/75 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-2xl shadow-sm">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: "brand", label: "🎨 Brand Kit & Guides" },
                  { id: "media", label: "🎵 Audio & Media" },
                  { id: "docs", label: "📝 Templates & Scripts" },
                  { id: "data", label: "📊 Batch Data Sheets" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      activeTab === t.id
                        ? "bg-primary text-white shadow-md font-bold"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Dynamic search bar */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                <Input
                  type="text"
                  placeholder="Filter active library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-slate-50/50 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* TWO-COLUMN GRID: Left workspace tab content, Right live video overlay mockup */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

              {/* LEFT COLUMN: ACTIVE WORKSPACE TAB (col span 2) */}
              <div className="lg:col-span-2 space-y-6">

                {/* TAB 1: BRAND KIT & GUIDES */}
                {activeTab === "brand" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Brand Colors Card */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Palette className="size-4 text-primary" />
                          Color Palette Guidelines
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Colors defined here will automatically apply to subtitle bounding boxes, video graphics, and typography overlays.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        {/* Colors List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {colors
                            .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((col) => (
                              <div
                                key={col.id}
                                onClick={() => setPreviewColorId(col.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                  previewColorId === col.id
                                    ? "bg-primary/5 border-primary ring-1 ring-primary"
                                    : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="size-8 rounded-lg shadow-sm border border-black/10 shrink-0"
                                    style={{ backgroundColor: col.hex }}
                                  />
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">{col.name}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">{col.hex.toUpperCase()}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      navigator.clipboard.writeText(col.hex)
                                      toast.success(`Copied color ${col.hex} to clipboard!`)
                                    }}
                                    className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
                                  >
                                    <Copy className="size-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteColor(col.id, col.name)}
                                    className="size-7 text-muted-foreground hover:text-red-500 rounded-lg"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Add Color Selector */}
                        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800/60 flex flex-col sm:flex-row gap-3 items-end">
                          <div className="flex-1 space-y-1.5 w-full">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Color Label</label>
                            <Input
                              type="text"
                              placeholder="e.g. Logo Primary, Warning Glow..."
                              value={newColorName}
                              onChange={e => setNewColorName(e.target.value)}
                              className="h-9 text-xs bg-white dark:bg-zinc-900 rounded-lg"
                            />
                          </div>
                          <div className="space-y-1.5 shrink-0 w-full sm:w-32">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hex Value</label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={newColorHex}
                                onChange={e => setNewColorHex(e.target.value)}
                                className="w-9 h-9 p-0.5 border-slate-200 dark:border-zinc-800 rounded-lg cursor-pointer shrink-0"
                              />
                              <Input
                                type="text"
                                placeholder="#ffffff"
                                value={newColorHex}
                                onChange={e => setNewColorHex(e.target.value)}
                                className="h-9 text-xs bg-white dark:bg-zinc-900 rounded-lg flex-1 min-w-0"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleAddColor}
                            className="bg-primary text-white h-9 px-4 rounded-lg text-xs font-semibold shrink-0 w-full sm:w-auto"
                          >
                            <Plus className="size-3.5 mr-1" />
                            Add Color
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Brand Logos Card */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <ImageIcon className="size-4 text-primary" />
                          Brand Logo Watermarks
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Upload transparent logo files to embed into mock overlays and rendering configurations.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {logos
                            .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((logo) => (
                              <div
                                key={logo.id}
                                onClick={() => setSelectedLogoId(logo.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                  selectedLogoId === logo.id
                                    ? "bg-primary/5 border-primary ring-1 ring-primary"
                                    : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="size-9 rounded-lg bg-black/10 dark:bg-white/5 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-xs shrink-0 font-bold font-mono">
                                    {logo.type}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{logo.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{logo.size}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  {selectedLogoId === logo.id && (
                                    <span className="size-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                                      <Check className="size-3" />
                                    </span>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      if (logos.length <= 1) {
                                        toast.error("Brand library must retain at least one logo.")
                                        return
                                      }
                                      const next = logos.filter(l => l.id !== logo.id)
                                      setLogos(next)
                                      saveToLocalStorage({ logos: next })
                                      if (selectedLogoId === logo.id) {
                                        setSelectedLogoId(next[0].id)
                                      }
                                      toast.success(`Logo "${logo.name}" deleted.`)
                                    }}
                                    className="size-7 text-muted-foreground hover:text-red-500 rounded-lg shrink-0"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Brand Fonts Card */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Type className="size-4 text-primary" />
                          Typography Styling
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Manage typography profiles.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {fonts
                            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((f) => (
                              <div
                                key={f.id}
                                className="flex items-center justify-between p-3 rounded-xl border bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white" style={{ fontFamily: `var(--font-${f.name.toLowerCase().split(' ')[0]})` }}>{f.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{f.provider} · {f.category}</div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteFont(f.id, f.name)}
                                  className="size-7 text-muted-foreground hover:text-red-500 rounded-lg shrink-0"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            ))}
                        </div>

                        {/* Add Font input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search Google Font names (e.g. Montserrat, Playfair Display)..."
                            value={newFontName}
                            onChange={e => setNewFontName(e.target.value)}
                            className="h-9 text-xs bg-white dark:bg-zinc-900 rounded-lg flex-1"
                          />
                          <Button
                            onClick={handleAddFont}
                            className="bg-primary text-white h-9 px-4 rounded-lg text-xs font-semibold"
                          >
                            Add Font
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* TAB 2: AUDIO & MEDIA ASSETS */}
                {activeTab === "media" && (
                  <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Volume2 className="size-4 text-primary" />
                        Audio & Video Asset Overlays
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Upload custom background music, scene transitions, sound effects, or foreground watermark animations.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {/* Media List */}
                      <div className="space-y-3">
                        {mediaList
                          .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((item) => {
                            const isPlaying = playingAudioId === item.id
                            const progress = audioProgress[item.id] || 0

                            return (
                              <div
                                key={item.id}
                                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                                  isPlaying
                                    ? "bg-primary/5 border-primary"
                                    : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                                }`}
                              >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {/* Icon representation */}
                                  <div className="size-9 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                                    {item.type === "audio" ? (
                                      <Music className="size-4" />
                                    ) : item.type === "video" ? (
                                      <Tv className="size-4" />
                                    ) : (
                                      <ImageIcon className="size-4" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[80%]">
                                        {item.name}
                                      </span>
                                      <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 uppercase">
                                        {item.type}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                      <span>Size: {item.size}</span>
                                      {item.duration && <span>Duration: {item.duration}</span>}
                                      {item.resolution && <span>Resolution: {item.resolution}</span>}
                                    </div>

                                    {/* Wave progress visualizer for audio preview */}
                                    {item.type === "audio" && item.url && isPlaying && (
                                      <div className="w-full flex items-center gap-2 pt-2">
                                        <span className="text-[9px] font-mono text-primary font-semibold">BGM Stream:</span>
                                        <div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden relative">
                                          <div
                                            className="bg-primary h-full transition-all duration-100 ease-linear rounded-full"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        {/* Micro visualizer waves */}
                                        <div className="flex items-center gap-0.5 h-3 shrink-0">
                                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_100ms] h-2" />
                                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_200ms] h-3.5" />
                                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_300ms] h-1.5" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 justify-end shrink-0">
                                  {/* Audio play preview */}
                                  {item.type === "audio" && item.url && (
                                    <Button
                                      size="sm"
                                      variant={isPlaying ? "destructive" : "default"}
                                      onClick={() => togglePlayAudio(item.id, item.url!)}
                                      className="text-xs font-semibold rounded-lg h-8 cursor-pointer"
                                    >
                                      {isPlaying ? (
                                        <>
                                          <Pause className="w-3.5 h-3.5 mr-1" />
                                          Pause BGM
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                                          Play Preview
                                        </>
                                      )}
                                    </Button>
                                  )}

                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => handleDeleteMedia(item.id, item.name)}
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-lg shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}

                        {mediaList.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <div className="text-center py-8 text-xs text-muted-foreground">
                            No media assets found matching filter criteria.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* TAB 3: DOCUMENT SCREENPLAY TEMPLATES */}
                {activeTab === "docs" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Left List Pane (1 col) */}
                    <div className="md:col-span-1 space-y-3">
                      {docsList
                        .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((d) => (
                          <div
                            key={d.id}
                            onClick={() => setSelectedDocId(d.id)}
                            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                              selectedDocId === d.id
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {d.name}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteDoc(d.id, d.name)
                                }}
                                className="size-6 text-muted-foreground hover:text-red-500 rounded-md"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                              <span>{d.type}</span>
                              <span>{d.charCount} chars</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Right Editor Pane (2 cols) */}
                    <div className="md:col-span-2">
                      {selectedDoc ? (
                        <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                          <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-row items-center justify-between gap-4">
                            <div>
                              <CardTitle className="text-base font-bold flex items-center gap-2">
                                <FileText className="size-4 text-primary" />
                                {selectedDoc.name}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Edit prompt variables or blueprint screenplays to reference in the editor panel chat.
                              </CardDescription>
                            </div>
                            <Badge variant="secondary" className="font-mono text-[9px] font-bold shrink-0">
                              {selectedDoc.type}
                            </Badge>
                          </CardHeader>
                          <CardContent className="p-6 space-y-4">
                            <Textarea
                              className="font-mono text-xs leading-relaxed min-h-[300px] resize-none bg-white dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-800/80 rounded-xl"
                              value={selectedDoc.content}
                              onChange={e => handleUpdateDocContent(e.target.value)}
                            />
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Info className="size-3 text-primary animate-pulse" />
                                Saved automatically to data library cache.
                              </span>
                              <span>{selectedDoc.charCount} characters</span>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/15">
                          <FileText className="size-10 text-muted-foreground/40 mx-auto mb-2 animate-pulse" />
                          <div className="text-sm font-semibold">Select a document blueprint</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: BATCH DATA SOURCES */}
                {activeTab === "data" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Source Selection Header Card */}
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="size-4 text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">Active Spreadsheet Feed</div>
                            <div className="text-[10px] text-muted-foreground">Select a dataset to view or modify table values.</div>
                          </div>
                        </div>

                        {/* List dropdown */}
                        <select
                          value={selectedDsId}
                          onChange={(e) => setSelectedDsId(e.target.value)}
                          className="h-9 w-full sm:w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-semibold px-3 focus-visible:outline-none cursor-pointer"
                        >
                          {dataSources.map(ds => (
                            <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
                          ))}
                        </select>
                      </CardContent>
                    </Card>

                    {/* SpreadSheet Grid card */}
                    {selectedDs ? (
                      <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedDs.name}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Rows: {selectedDs.data.length} | Columns: {selectedDs.headers.length}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleAddRow}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-600/90 text-white text-xs font-semibold h-8 rounded-lg"
                            >
                              <Plus className="size-3 mr-1" />
                              Add Row
                            </Button>
                            <Button
                              onClick={() => {
                                if (dataSources.length <= 1) {
                                  toast.error("Brand library must retain at least one dataset.")
                                  return
                                }
                                const next = dataSources.filter(ds => ds.id !== selectedDsId)
                                setDataSources(next)
                                saveToLocalStorage({ dataSources: next })
                                setSelectedDsId(next[0].id)
                                toast.success(`Dataset "${selectedDs.name}" removed.`)
                              }}
                              size="sm"
                              variant="outline"
                              className="border-slate-200 dark:border-zinc-800 text-xs font-semibold h-8 text-red-500 hover:bg-red-500/10 rounded-lg"
                            >
                              <Trash2 className="size-3 mr-1" />
                              Delete Dataset
                            </Button>
                          </div>
                        </div>

                        {/* Interactive Table Container */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100/50 dark:bg-zinc-950/20 border-b border-slate-200/60 dark:border-zinc-800/60">
                                <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-12 text-center">Row</th>
                                {selectedDs.headers.map((hdr, idx) => (
                                  <th key={idx} className="p-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[150px]">
                                    {hdr}
                                  </th>
                                ))}
                                <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-12 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDs.data.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-slate-200/40 dark:border-zinc-800/30 hover:bg-slate-50/20 dark:hover:bg-zinc-800/10">
                                  <td className="p-2 text-center text-[10px] font-mono text-muted-foreground">{rIdx + 1}</td>
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-2">
                                      <input
                                        type="text"
                                        value={cell}
                                        onChange={e => handleUpdateCell(rIdx, cIdx, e.target.value)}
                                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-lg text-xs font-medium px-2.5 h-8 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
                                      />
                                    </td>
                                  ))}
                                  <td className="p-2 text-center">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDeleteRow(rIdx)}
                                      className="size-7 text-muted-foreground hover:text-red-500 rounded-lg"
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ) : (
                      <div className="text-center py-16 border border-dashed rounded-2xl bg-muted/15">
                        <FileSpreadsheet className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                        <div className="text-sm font-semibold">Select a spreadsheet dataset</div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: STUNNING LIVE VIDEO PREVIEW WORKSPACE (1 col) */}
              <div className="space-y-6 lg:sticky lg:top-6">
                <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-lg overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50 bg-gradient-to-r from-primary/5 to-indigo-500/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Tv className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">Live Brand Overlay</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Real-time simulation canvas</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Simulated Video Player Box */}
                    <div className="aspect-video w-full rounded-2xl border border-slate-800/80 bg-zinc-950 relative overflow-hidden flex flex-col justify-between p-4 shadow-inner">
                      {/* Grid overlay mask for editing */}
                      <div className="absolute inset-0 bg-grid-white/[0.02] select-none pointer-events-none" />

                      {/* Top Header Row of Video Frame */}
                      <div className="flex justify-between items-start z-10">
                        {/* Logo Watermark Overlay */}
                        {showLogoOverlay ? (
                          <div
                            className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm border text-[9px] font-bold font-mono tracking-wider text-white transition-all shadow-md"
                            style={{ borderColor: `${activePreviewColor}30` }}
                          >
                            <span className="inline-block size-1.5 rounded-full mr-1" style={{ backgroundColor: activePreviewColor }} />
                            {activeLogoName.toUpperCase()}
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* Video Metadata label */}
                        <div className="text-[8px] font-mono bg-black/60 text-zinc-400 rounded-full px-2 py-0.5 border border-white/5 uppercase">
                          AI Canvas: 1080p
                        </div>
                      </div>

                      {/* Mock Video Center Screen Art */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none gap-2 px-6 text-center">
                        {/* Dynamic glow backdrops */}
                        <div
                          className="absolute size-24 rounded-full blur-2xl opacity-20 animate-pulse transition-colors"
                          style={{ backgroundColor: activePreviewColor }}
                        />

                        {mockVideoPlaying ? (
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            {/* Animated sound bars */}
                            <div className="flex items-end gap-0.5 h-6">
                              <span className="w-1 bg-primary rounded-full animate-[bounce_0.8s_infinite_100ms] h-4" />
                              <span className="w-1 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite_200ms] h-6" />
                              <span className="w-1 bg-purple-500 rounded-full animate-[bounce_0.8s_infinite_300ms] h-3" />
                              <span className="w-1 bg-pink-500 rounded-full animate-[bounce_0.8s_infinite_400ms] h-5" />
                            </div>
                            <span className="text-xs font-mono font-bold tracking-widest text-white uppercase ml-1 animate-pulse">PLAYING OVERLAY</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-2xl mt-2 filter drop-shadow">🎬</div>
                            <div className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 bg-black/25 rounded-md px-2 py-0.5 border border-white/5">
                              PREVIEW VIEWPORT
                            </div>
                          </>
                        )}
                      </div>

                      {/* Bottom Footer Row of Video Frame: Subtitles */}
                      <div className="z-10 flex flex-col items-center gap-2">
                        {showSubtitlesOverlay && (
                          <div
                            className="px-3.5 py-1.5 rounded-xl bg-black/80 backdrop-blur-sm border shadow-lg max-w-[90%] text-center text-[10px] font-bold text-white transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-300"
                            style={{ borderLeft: `3px solid ${activePreviewColor}`, borderRight: `3px solid ${activePreviewColor}` }}
                          >
                            "Welcome to Acme Video Studio. Batch generate explainer animations autonomously in minutes."
                          </div>
                        )}

                        {/* Player progress line */}
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              backgroundColor: activePreviewColor,
                              width: mockVideoPlaying ? "75%" : "15%"
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* PREVIEW CONTROLS BOX */}
                    <div className="space-y-4 pt-1">
                      {/* Active Preview color selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Sliders className="size-3 text-primary" />
                          Subtitles Theme Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {colors.map(col => (
                            <button
                              key={col.id}
                              onClick={() => setPreviewColorId(col.id)}
                              className={`size-6 rounded-full border border-black/15 shadow-sm transition-transform cursor-pointer hover:scale-110 shrink-0 relative ${
                                previewColorId === col.id ? "ring-2 ring-primary ring-offset-2 scale-105" : ""
                              }`}
                              style={{ backgroundColor: col.hex }}
                              title={col.name}
                            >
                              {previewColorId === col.id && (
                                <Check className="size-3 text-white absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Overlay display checkers */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => setShowLogoOverlay(!showLogoOverlay)}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-all text-center ${
                            showLogoOverlay
                              ? "bg-primary/5 border-primary text-primary"
                              : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <ImageIcon className="size-3.5" />
                          Watermark Logo
                        </button>
                        <button
                          onClick={() => setShowSubtitlesOverlay(!showSubtitlesOverlay)}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-all text-center ${
                            showSubtitlesOverlay
                              ? "bg-primary/5 border-primary text-primary"
                              : "bg-white/40 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <FileText className="size-3.5" />
                          Show Subtitles
                        </button>
                      </div>

                      <Button
                        onClick={() => setMockVideoPlaying(!mockVideoPlaying)}
                        className={`w-full h-10 font-bold text-xs rounded-xl shadow-md transition-all ${
                          mockVideoPlaying
                            ? "bg-red-500 hover:bg-red-500/90 text-white"
                            : "bg-primary hover:bg-primary/95 text-white"
                        }`}
                      >
                        {mockVideoPlaying ? (
                          <>
                            <Pause className="size-3.5 mr-2" />
                            Stop Canvas Simulation
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5 mr-2 fill-current" />
                            Start Canvas Simulation
                          </>
                        )}
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </div>

        {/* --- UPLOAD FILE SIMULATOR MODAL DIALOG --- */}
        {isUploadOpen && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">

              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-zinc-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary animate-bounce" />
                  Upload Asset to Library
                </h3>
                <button
                  onClick={() => {
                    setIsUploadOpen(false)
                    setUploadProgress(-1)
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar View */}
              {uploadProgress >= 0 ? (
                <div className="space-y-4 py-6">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-semibold text-primary flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      Uploading asset file...
                    </span>
                    <span className="font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-150 ease-out rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Please do not close this modal or refresh the webpage during transfer.</p>
                </div>
              ) : (
                /* Form View */
                <div className="space-y-4">
                  {/* Select Type */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asset Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { type: "logo", label: "Logo PNG" },
                        { type: "media", label: "Media BGM" },
                        { type: "doc", label: "Script Outline" },
                        { type: "data", label: "CSV Table" }
                      ].map(t => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() => setUploadType(t.type as any)}
                          className={`p-2 rounded-lg border text-[10px] font-semibold text-center transition-all ${
                            uploadType === t.type
                              ? "bg-primary/10 border-primary text-primary font-bold"
                              : "bg-slate-50 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800 hover:bg-slate-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asset Display Name</label>
                    <Input
                      type="text"
                      placeholder="e.g. Acme Logo Q2, Ambient background loop..."
                      value={uploadName}
                      onChange={e => setUploadName(e.target.value)}
                      className="h-10 text-xs bg-slate-50 dark:bg-zinc-950/20 border-slate-200 dark:border-zinc-800 rounded-lg"
                    />
                  </div>

                  {/* Simulated File Zone */}
                  <div className="border border-dashed border-slate-300 dark:border-zinc-800 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-zinc-950/10 hover:bg-slate-50 dark:hover:bg-zinc-950/30 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      id="upload-file-input"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setSelectedFile(file)
                          if (!uploadName.trim()) {
                            // auto fill name
                            setUploadName(file.name.replace(/\.[^/.]+$/, ""))
                          }
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="size-8 text-muted-foreground/60 mx-auto mb-2" />
                    {selectedFile ? (
                      <div>
                        <div className="text-xs font-bold text-primary truncate max-w-[80%] mx-auto">{selectedFile.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-zinc-300">Choose file or drag & drop</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Supports PNG, SVG, WAV, MP3, CSV, or TXT up to 50MB</div>
                      </div>
                    )}
                  </div>

                  {/* Upload button */}
                  <Button
                    onClick={simulateUpload}
                    className="w-full h-11 bg-primary text-white font-bold text-xs rounded-xl shadow-md"
                  >
                    Start Asset Transfer
                  </Button>
                </div>
              )}

            </div>
          </div>
        )}

      </SidebarInset>
    </SidebarProvider>
  )
}
