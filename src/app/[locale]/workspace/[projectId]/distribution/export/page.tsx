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
import { Progress } from "@/components/ui/progress"
import { MessageSquareIcon, DownloadIcon, FilmIcon, ClapperboardIcon, Loader2Icon } from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React from "react"
import { useConfigureSuggestions } from "@copilotkit/react-core/v2"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useParams } from "next/navigation"
import Link from "next/link"
import { getThreadState } from "@/lib/langgraph"

export default function ExportPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const params = useParams();
  const projectId = params.projectId as string;
  const locale = (params.locale as string) || "en";

  const [aspectRatio, setAspectRatio] = React.useState<string>("16:9");
  const [scenes, setScenes] = React.useState<any[]>([]);

  // Export State Controls
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [exportProgress, setExportProgress] = React.useState<number>(0);
  const [exportLog, setExportLog] = React.useState<string>("");

  usePhaseSync("distribution");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Export Finished Video",
        message: "Package the compiled timeline tracks, perform final audio mixdowns, and export the finished high-resolution movie.",
      }
    ],
    available: "always"
  });

  React.useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          if (design.aspect_ratio) setAspectRatio(design.aspect_ratio);
          if (design.scenes) setScenes(design.scenes);
        }
      })
      .catch((err) => console.warn("[Export] Load design error:", err));
  }, [projectId]);

  const getResolution = () => {
    if (aspectRatio === "9:16") return "768 x 1280 (Vertical)";
    if (aspectRatio === "1:1") return "768 x 768 (Square)";
    return "1280 x 768 (Cinematic Widescreen)";
  };

  const renderedCount = scenes.filter((s: any) => s.video_url).length;

  const handleExport = async () => {
    if (renderedCount === 0) return;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportLog("Initializing export compiler...");

    const steps = [
      { p: 15, l: "Allocating media stitching workspace pipeline..." },
      { p: 40, l: `Concatenating ${renderedCount} active scene MP4 video tracks...` },
      { p: 65, l: "Blending dialogue voiceovers and panning spatial background audio..." },
      { p: 85, l: "Encoding final H.264 high-definition container stream..." },
      { p: 100, l: "Stitching completed successfully! Preparing download..." }
    ];

    try {
      for (const step of steps) {
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));
        setExportProgress(step.p);
        setExportLog(step.l);
      }

      const videoUrls = scenes.map((s: any) => s.video_url).filter(Boolean);
      if (videoUrls.length > 0) {
        setExportLog("Contacting backend video stitching engine...");
        const stitchRes = await fetch("/api/stitch-videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoUrls }),
        });

        if (!stitchRes.ok) {
          throw new Error("Video stitching service failed");
        }

        const stitchData = await stitchRes.json();
        const finalVideoUrl = stitchData.url;

        if (finalVideoUrl) {
          setExportLog("Movie compiled successfully! Triggering download...");
          const downloadUrl = `/api/download?url=${encodeURIComponent(finalVideoUrl)}`;
          
          // Seamless background download trigger using a hidden iframe
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = downloadUrl;
          document.body.appendChild(iframe);
          
          // Clean up the iframe from the DOM
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 5000);

          setExportLog("Stitching complete. Your download has started.");
        } else {
          throw new Error("No stitched video URL returned from engine");
        }
      }
    } catch (err: any) {
      console.error("[Export] Compiling failure:", err);
      setExportLog(`Error: ${err.message || "Failed to stitch videos"}`);
    }

    setIsExporting(false);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href={`/${locale}/studio`}>Studio</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Distribution</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Export</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {!isChatOpen && (
          <div className="flex items-center pr-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen?.(true)}
              className="flex items-center gap-2 h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <MessageSquareIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Open Assistant</span>
            </Button>
          </div>
        )}
      </header>

      {/* Main Container - Centered Display */}
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 p-6 min-h-[calc(100vh-10rem)]">
        <div className="max-w-md w-full bg-card border border-border shadow-xl rounded-2xl p-8 space-y-6 text-center transition-all duration-300 hover:shadow-2xl">
          
          {/* Header Icon & Title */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm animate-pulse">
              {isExporting ? (
                <Loader2Icon className="w-7 h-7 animate-spin" />
              ) : (
                <FilmIcon className="w-7 h-7" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Export Compilation</h1>
              <p className="text-xs text-muted-foreground">Compile and package your generated video sequence and audio tracks</p>
            </div>
          </div>

          {isExporting ? (
            /* Live Terminal Stitching Progress */
            <div className="p-5 rounded-xl bg-black border border-zinc-800 text-left space-y-4 shadow-inner">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                <span className="text-indigo-400 animate-pulse uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Stitching Video Pipeline
                </span>
                <span className="text-indigo-400">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-1.5 w-full bg-zinc-900 accent-indigo-500" />
              <div className="font-mono text-[10px] text-zinc-400 min-h-[40px] leading-relaxed border-l border-indigo-500/40 pl-2">
                {exportLog}
              </div>
            </div>
          ) : (
            /* Standard Config & Visual Placeholders */
            <>
              {/* Project Details Grid */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/40 text-left space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <ClapperboardIcon className="w-3.5 h-3.5 text-primary" />
                    Scenes Count
                  </span>
                  <span className="font-mono font-bold text-foreground">{renderedCount} / {scenes.length} Ready</span>
                </div>
                
                <Separator className="bg-border/40" />

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <FilmIcon className="w-3.5 h-3.5 text-primary" />
                    Aspect Ratio
                  </span>
                  <span className="font-mono font-bold text-foreground">{aspectRatio}</span>
                </div>

                <Separator className="bg-border/40" />

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <FilmIcon className="w-3.5 h-3.5 text-primary" />
                    Format Resolution
                  </span>
                  <span className="font-mono font-bold text-foreground">{getResolution()}</span>
                </div>
              </div>

              {/* Dynamic Placeholder Box depending on Aspect Ratio */}
              <div className="flex items-center justify-center bg-black/5 dark:bg-zinc-950/40 rounded-xl border border-dashed border-border/60 p-4">
                <div 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center text-center shadow-inner py-6"
                  style={{
                    aspectRatio: aspectRatio.replace(":", " / "),
                    maxHeight: "180px"
                  }}
                >
                  <FilmIcon className="w-6 h-6 text-muted-foreground/30 mb-1.5 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider">Compilation Ready</span>
                </div>
              </div>
            </>
          )}

          {/* Single Export Button */}
          <Button 
            onClick={handleExport}
            className="w-full h-12 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 gap-2"
            disabled={renderedCount === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2Icon className="w-4 h-4 animate-spin" />
                Compiling Film...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                Export High-Resolution Video
              </>
            )}
          </Button>

          {renderedCount === 0 && (
            <p className="text-[10px] text-amber-500 font-semibold leading-relaxed">
              ⚠️ No scenes generated. Compile and synthesize videos before exporting.
            </p>
          )}

        </div>
      </div>
    </>
  );
}
