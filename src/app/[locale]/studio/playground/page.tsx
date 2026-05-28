"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppSidebar } from "@/app/[locale]/studio/app-sidebar";
import { SiteHeader } from "@/app/[locale]/studio/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/components/i18n/translation-provider";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Wand2,
  Sparkles,
  Image as ImageIcon,
  Tv,
  Download,
  Loader2,
  Clock,
  Trash2,
  Sliders,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Settings,
  HelpCircle
} from "lucide-react";

interface GenerationHistoryItem {
  id: string;
  type: "image" | "video";
  prompt: string;
  url: string;
  timestamp: number;
  elapsed: number;
  settings: Record<string, any>;
}

export default function PlaygroundPage() {
  const { t } = useTranslation();

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);

  // --- IMAGE GEN FORM STATE ---
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgWidth, setImgWidth] = useState(1024);
  const [imgHeight, setImgHeight] = useState(1024);
  const [imgSteps, setImgSteps] = useState(8);
  const [imgGuidance, setImgGuidance] = useState(1.0);
  const [imgSeed, setImgSeed] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState<string | null>(null);
  const [imgElapsed, setImgElapsed] = useState<number | null>(null);

  // --- VIDEO GEN FORM STATE ---
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidNegPrompt, setVidNegPrompt] = useState("worst quality, inconsistent motion, blurry, jittery, distorted");
  const [vidWidth, setVidWidth] = useState(768);
  const [vidHeight, setVidHeight] = useState(512);
  const [vidFrames, setVidFrames] = useState(121);
  const [vidFps, setVidFps] = useState(24);
  const [vidSteps, setVidSteps] = useState(8);
  const [vidGuidance, setVidGuidance] = useState(4.0);
  const [vidSeed, setVidSeed] = useState(0);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidResult, setVidResult] = useState<string | null>(null);
  const [vidElapsed, setVidElapsed] = useState<number | null>(null);

  // --- SYSTEM PRESET PROMPTS ---
  const imagePresets = [
    "A futuristic cyberpunk workspace with neon-lit monitors, high-tech holographic interface overlay, synthwave aesthetics, hyperdetailed, 8k",
    "Cinematic shot of an AI agent robotic humanoid operating a glowing control terminal, soft mist, ambient gold volumetric lighting",
    "Minimalist elegant workspace with clean metallic tables, floating glass charts, high-end design, studio photography",
    "A stunning corporate server room with green fiber optic lights pulsing, modern tech infrastructure, clean composition, bokeh"
  ];

  const videoPresets = [
    "Slow tracking shot of a glowing blue data stream traveling through a glass optical fiber network, particle effects, 3d motion",
    "An AI robot turning its head towards the screen and blinking, digital blue eyes, photorealistic, metallic reflection, cinematic lighting",
    "Camera panning over a pristine, high-tech server rack array in a corporate datacenter, server light blink, shallow depth of field",
    "A minimalist logo watermark pulsing dynamically with sound waves in a sleek black cybernetic matrix field, abstract digital art"
  ];

  // --- PERSISTENCE ---
  useEffect(() => {
    try {
      const stored = localStorage.getItem("video-agent:playground-history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load playground history:", e);
    }
  }, []);

  const saveHistory = (items: GenerationHistoryItem[]) => {
    try {
      localStorage.setItem("video-agent:playground-history", JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("video-agent:playground-history");
    } catch (e) {
      console.error(e);
    }
    toast.success("Playground history cleared.");
  };

  const deleteHistoryItem = (id: string) => {
    const next = history.filter(item => item.id !== id);
    setHistory(next);
    saveHistory(next);
    toast.success("Item removed from history.");
  };

  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  const handleDownload = async (url: string, defaultFilename: string, itemId?: string) => {
    const trackingId = itemId || url;
    setDownloadingIds(prev => ({ ...prev, [trackingId]: true }));
    
    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}`;
      
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);

      toast.success("Download started!");
    } catch (error) {
      console.error("Failed to download file:", error);
      toast.error("Could not download the file.");
    } finally {
      setDownloadingIds(prev => ({ ...prev, [trackingId]: false }));
    }
  };

  // --- IMAGE GENERATION HANDLER ---
  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) {
      toast.error("Please enter an image prompt.");
      return;
    }

    setImgLoading(true);
    setImgResult(null);
    setImgElapsed(null);

    const seedVal = imgSeed === 0 ? Math.floor(Math.random() * 1000000) : imgSeed;

    try {
      const res = await fetch("/api/generate-keyframe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imgPrompt,
          width: imgWidth,
          height: imgHeight,
          guidance_scale: imgGuidance,
          num_inference_steps: imgSteps,
          seed: seedVal,
          sceneId: "playground"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Server returned error" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.status !== "success" || !data.url) {
        throw new Error(data.error || "Generation failed");
      }

      setImgResult(data.url);
      setImgElapsed(data.elapsed_seconds || 0);

      // Add to history
      const newHistoryItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        type: "image",
        prompt: imgPrompt,
        url: data.url,
        timestamp: Date.now(),
        elapsed: data.elapsed_seconds || 0,
        settings: {
          width: imgWidth,
          height: imgHeight,
          steps: imgSteps,
          guidance: imgGuidance,
          seed: seedVal
        }
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
      toast.success("Image generated successfully!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to generate image.");
    } finally {
      setImgLoading(false);
    }
  };

  // --- VIDEO GENERATION HANDLER ---
  const handleGenerateVideo = async () => {
    if (!vidPrompt.trim()) {
      toast.error("Please enter a video prompt.");
      return;
    }

    setVidLoading(true);
    setVidResult(null);
    setVidElapsed(null);

    const seedVal = vidSeed === 0 ? Math.floor(Math.random() * 1000000) : vidSeed;

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: vidPrompt,
          negative_prompt: vidNegPrompt,
          width: vidWidth,
          height: vidHeight,
          num_frames: vidFrames,
          frame_rate: vidFps,
          num_inference_steps: vidSteps,
          guidance_scale: vidGuidance,
          seed: seedVal,
          sceneId: "playground"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Server returned error" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.status !== "success" || !data.url) {
        throw new Error(data.error || "Generation failed");
      }

      setVidResult(data.url);
      setVidElapsed(data.elapsed_seconds || 0);

      // Add to history
      const newHistoryItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        type: "video",
        prompt: vidPrompt,
        url: data.url,
        timestamp: Date.now(),
        elapsed: data.elapsed_seconds || 0,
        settings: {
          width: vidWidth,
          height: vidHeight,
          frames: vidFrames,
          fps: vidFps,
          steps: vidSteps,
          guidance: vidGuidance,
          seed: seedVal
        }
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
      toast.success("Video generated successfully!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to generate video.");
    } finally {
      setVidLoading(false);
    }
  };

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
      <SidebarInset className="relative flex flex-col min-h-screen">
        <SiteHeader title={t("studio.playground", "Playground")} />
        <Toaster position="top-right" closeButton richColors />

        {/* Scroll Container */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-zinc-950/40 p-4 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header Title Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Wand2 className="h-6 w-6 text-primary animate-pulse" />
                  Media Generation Lab
                </h2>
                <p className="text-sm text-muted-foreground">
                  Playground for generating custom images and cinematic videos.
                </p>
              </div>

              {/* Status Chips */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg border">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Image Engine: <span className="font-bold text-foreground">Active</span></span>
                </Badge>
                <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg border">
                  <Tv className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Video Engine: <span className="font-bold text-foreground">Active</span></span>
                </Badge>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 bg-white/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 backdrop-blur-md rounded-2xl shadow-sm">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("image")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    activeTab === "image"
                      ? "bg-primary text-primary-foreground shadow-md font-bold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  🎨 1. Image Generator
                </button>
                <button
                  onClick={() => setActiveTab("video")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    activeTab === "video"
                      ? "bg-primary text-primary-foreground shadow-md font-bold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  🎬 2. Video Generator
                </button>
              </div>

              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-950/20 rounded-xl"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Clear Lab History
                </Button>
              )}
            </div>

            {/* WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* LEFT & CENTER COLUMN: FORM AND PREVIEW (col-span-2) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. IMAGE PLAYGROUND */}
                {activeTab === "image" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <ImageIcon className="size-4 text-primary" />
                          Image Generation Parameters
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Generate beautiful high-fidelity 2D image frames locally.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        
                        {/* Prompt Input */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prompt Description</label>
                          <Textarea
                            placeholder="Describe the image you want to generate in detail..."
                            value={imgPrompt}
                            onChange={(e) => setImgPrompt(e.target.value)}
                            rows={3}
                            className="resize-none text-sm bg-background border-slate-200 dark:border-zinc-800 focus-visible:ring-primary/20 rounded-xl"
                          />
                          
                          {/* Presets */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Presets:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {imagePresets.map((preset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setImgPrompt(preset)}
                                  className="text-left p-2.5 h-auto w-full border border-slate-100 dark:border-zinc-800/60 rounded-xl bg-slate-50/50 dark:bg-zinc-900/20 hover:bg-slate-100/50 dark:hover:bg-zinc-800/40 transition-colors"
                                >
                                  <span className="block text-[10px] leading-normal text-muted-foreground line-clamp-2">
                                    {preset}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-200 dark:border-zinc-800/60">
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dimensions</label>
                            <select
                              value={`${imgWidth}x${imgHeight}`}
                              onChange={(e) => {
                                const [w, h] = e.target.value.split("x").map(Number);
                                setImgWidth(w);
                                setImgHeight(h);
                              }}
                              className="h-9 w-full px-3 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus-visible:outline-none"
                            >
                              <option value="1024x1024">Square (1024 x 1024)</option>
                              <option value="1280x768">Landscape (1280 x 768)</option>
                              <option value="768x1280">Portrait (768 x 1280)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Steps ({imgSteps})</label>
                            <input
                              type="range"
                              min={1} max={20} step={1}
                              value={imgSteps}
                              onChange={(e) => setImgSteps(Number(e.target.value))}
                              className="w-full h-9 accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Guidance ({imgGuidance.toFixed(1)})</label>
                            <input
                              type="range"
                              min={0.5} max={5} step={0.5}
                              value={imgGuidance}
                              onChange={(e) => setImgGuidance(Number(e.target.value))}
                              className="w-full h-9 accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5 sm:col-span-3">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seed (0 for random)</label>
                              {imgSeed > 0 && (
                                <button
                                  onClick={() => setImgSeed(0)}
                                  className="text-[9px] font-mono text-primary flex items-center gap-0.5 hover:underline"
                                >
                                  <RotateCcw className="size-2" /> reset to random
                                </button>
                              )}
                            </div>
                            <Input
                              type="number"
                              placeholder="Random seed (0)"
                              value={imgSeed}
                              onChange={(e) => setImgSeed(Number(e.target.value))}
                              className="h-9 text-xs bg-background"
                            />
                          </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                          onClick={handleGenerateImage}
                          disabled={imgLoading}
                          className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                        >
                          {imgLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating Image on GPU Workstation...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate Image
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* LIVE IMAGE RESULT CARD */}
                    {(imgLoading || imgResult) && (
                      <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm overflow-hidden animate-in fade-in duration-300">
                        <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              Active Image Frame Result
                            </CardTitle>
                          </div>
                          {imgElapsed && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5 flex items-center gap-1">
                              <Clock className="size-3" />
                              {imgElapsed.toFixed(2)}s
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="p-6 flex flex-col items-center justify-center">
                          {imgLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                              <Loader2 className="size-10 text-primary animate-spin" />
                              <div className="space-y-1 text-center">
                                <p className="text-xs font-bold">Processing model diffusion pipeline...</p>
                                <p className="text-[10px] text-muted-foreground">Running local image diffusion model</p>
                              </div>
                            </div>
                          ) : (
                            imgResult && (
                              <div className="w-full space-y-4">
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800/80 bg-zinc-950 flex items-center justify-center max-h-[500px]">
                                  <img
                                    src={imgResult}
                                    alt="Generated Result"
                                    className="max-w-full max-h-[500px] object-contain shadow-inner"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={() => handleDownload(imgResult, `img_${Date.now()}.png`)}
                                    disabled={downloadingIds[imgResult]}
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    {downloadingIds[imgResult] ? (
                                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                      <Download className="size-3.5 mr-1.5" />
                                    )}
                                    Download Full PNG
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* 2. VIDEO PLAYGROUND */}
                {activeTab === "video" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                      <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Tv className="size-4 text-primary" />
                          Video Generation Parameters
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Generate cinematic videos locally. Perfect for temporal motion test.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        
                        {/* Prompt Input */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prompt Description</label>
                          <Textarea
                            placeholder="Describe the action and motion you want to render..."
                            value={vidPrompt}
                            onChange={(e) => setVidPrompt(e.target.value)}
                            rows={3}
                            className="resize-none text-sm bg-background border-slate-200 dark:border-zinc-800 focus-visible:ring-primary/20 rounded-xl"
                          />
                          
                          {/* Presets */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Presets:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {videoPresets.map((preset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setVidPrompt(preset)}
                                  className="text-left p-2.5 h-auto w-full border border-slate-100 dark:border-zinc-800/60 rounded-xl bg-slate-50/50 dark:bg-zinc-900/20 hover:bg-slate-100/50 dark:hover:bg-zinc-800/40 transition-colors"
                                >
                                  <span className="block text-[10px] leading-normal text-muted-foreground line-clamp-2">
                                    {preset}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Negative Prompt */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Negative Prompt</label>
                          <Input
                            placeholder="Worst quality, blurry..."
                            value={vidNegPrompt}
                            onChange={(e) => setVidNegPrompt(e.target.value)}
                            className="h-9 text-xs bg-background"
                          />
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-200 dark:border-zinc-800/60">
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resolution</label>
                            <select
                              value={`${vidWidth}x${vidHeight}`}
                              onChange={(e) => {
                                const [w, h] = e.target.value.split("x").map(Number);
                                setVidWidth(w);
                                setVidHeight(h);
                              }}
                              className="h-9 w-full px-3 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus-visible:outline-none"
                            >
                              <option value="768x512">Widescreen (768 x 512)</option>
                              <option value="512x768">Vertical (512 x 768)</option>
                              <option value="512x512">Square (512 x 512)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Frames count</label>
                            <select
                              value={vidFrames}
                              onChange={(e) => setVidFrames(Number(e.target.value))}
                              className="h-9 w-full px-3 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus-visible:outline-none"
                            >
                              <option value={97}>97 frames (Short)</option>
                              <option value={121}>121 frames (Standard - ~5s)</option>
                              <option value={145}>145 frames (Long)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">FPS ({vidFps})</label>
                            <select
                              value={vidFps}
                              onChange={(e) => setVidFps(Number(e.target.value))}
                              className="h-9 w-full px-3 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus-visible:outline-none"
                            >
                              <option value={24}>24 FPS (Cinematic)</option>
                              <option value={30}>30 FPS (Standard)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Steps ({vidSteps})</label>
                            <input
                              type="range"
                              min={1} max={60} step={1}
                              value={vidSteps}
                              onChange={(e) => setVidSteps(Number(e.target.value))}
                              className="w-full h-9 accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Guidance ({vidGuidance.toFixed(1)})</label>
                            <input
                              type="range"
                              min={1.0} max={8.0} step={0.5}
                              value={vidGuidance}
                              onChange={(e) => setVidGuidance(Number(e.target.value))}
                              className="w-full h-9 accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seed (0 for random)</label>
                              {vidSeed > 0 && (
                                <button
                                  onClick={() => setVidSeed(0)}
                                  className="text-[9px] font-mono text-primary flex items-center gap-0.5 hover:underline"
                                >
                                  <RotateCcw className="size-2" /> reset
                                </button>
                              )}
                            </div>
                            <Input
                              type="number"
                              placeholder="Random seed (0)"
                              value={vidSeed}
                              onChange={(e) => setVidSeed(Number(e.target.value))}
                              className="h-9 text-xs bg-background"
                            />
                          </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                          onClick={handleGenerateVideo}
                          disabled={vidLoading}
                          className="w-full h-11 font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                        >
                          {vidLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Rendering video on GPU Workstation...
                            </>
                          ) : (
                            <>
                              <Tv className="w-4 h-4 mr-2" />
                              Render Video
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* LIVE VIDEO RESULT CARD */}
                    {(vidLoading || vidResult) && (
                      <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm overflow-hidden animate-in fade-in duration-300">
                        <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              Active Video Frame Result
                            </CardTitle>
                          </div>
                          {vidElapsed && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5 flex items-center gap-1">
                              <Clock className="size-3" />
                              {vidElapsed.toFixed(2)}s
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="p-6 flex flex-col items-center justify-center">
                          {vidLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                              <Loader2 className="size-10 text-primary animate-spin" />
                              <div className="space-y-1 text-center">
                                <p className="text-xs font-bold">Rendering temporal noise frames...</p>
                                <p className="text-[10px] text-muted-foreground">Local video diffusion model executing rendering cycles</p>
                              </div>
                            </div>
                          ) : (
                            vidResult && (
                              <div className="w-full space-y-4">
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800/80 bg-zinc-950 flex items-center justify-center max-w-[768px] mx-auto">
                                  <video
                                    src={vidResult}
                                    controls
                                    autoPlay
                                    loop
                                    className="w-full shadow-inner object-contain"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    onClick={() => handleDownload(vidResult, `vid_${Date.now()}.mp4`)}
                                    disabled={downloadingIds[vidResult]}
                                    variant="outline"
                                    className="rounded-xl h-10 px-4 text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    {downloadingIds[vidResult] ? (
                                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                      <Download className="size-3.5 mr-1.5" />
                                    )}
                                    Download MP4 Video
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: RECENT HISTORY PANEL (col-span-1) */}
              <div className="space-y-6">
                <Card className="border border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shadow-sm">
                  <CardHeader className="pb-3 border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        <Sliders className="size-4 text-primary" />
                        Lab History
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        Recently generated keyframes & video loops.
                      </CardDescription>
                    </div>
                    <Badge className="font-bold">{history.length}</Badge>
                  </CardHeader>
                  <CardContent className="p-4">
                    {history.length > 0 ? (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                        {history.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl bg-white/40 dark:bg-zinc-950/20 space-y-3 relative group"
                          >
                            <button
                              onClick={() => deleteHistoryItem(item.id)}
                              className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 size-6 rounded-md hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete from cache"
                            >
                              <Trash2 className="size-3" />
                            </button>

                            {/* Type & Time */}
                            <div className="flex items-center gap-1.5">
                              {item.type === "image" ? (
                                <Badge className="text-[9px] bg-blue-500 hover:bg-blue-600 border-none px-1.5 py-0">IMAGE</Badge>
                              ) : (
                                <Badge className="text-[9px] bg-purple-500 hover:bg-purple-600 border-none px-1.5 py-0">VIDEO</Badge>
                              )}
                              <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5">
                                <Clock className="size-2.5" />
                                {item.elapsed.toFixed(1)}s
                              </span>
                            </div>

                            {/* Image/Video Element */}
                            <div className="relative rounded-lg overflow-hidden border border-slate-200/60 dark:border-zinc-800/60 bg-zinc-950 flex items-center justify-center aspect-video max-h-[150px]">
                              {item.type === "image" ? (
                                <img
                                  src={item.url}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <video
                                  src={item.url}
                                  muted
                                  playsInline
                                  autoPlay
                                  loop
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            {/* Prompt text */}
                            <p className="text-[10px] text-slate-800 dark:text-zinc-300 leading-normal line-clamp-2 pr-4">
                              {item.prompt}
                            </p>

                            {/* Quick specs */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/40 text-[9px] font-mono text-muted-foreground">
                              <span>
                                {item.settings.width}x{item.settings.height}
                              </span>
                              <button
                                onClick={() => handleDownload(item.url, `${item.type === "image" ? "img" : "vid"}_${item.id}.${item.type === "image" ? "png" : "mp4"}`, item.id)}
                                disabled={downloadingIds[item.id]}
                                className="text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                              >
                                {downloadingIds[item.id] ? (
                                  <Loader2 className="size-2.5 animate-spin" />
                                ) : (
                                  <Download className="size-2.5" />
                                )}
                                {" "}Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-xs text-muted-foreground flex flex-col items-center gap-2">
                        <HelpCircle className="size-8 text-muted-foreground/55" />
                        <p>No recent generations found in this lab.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
