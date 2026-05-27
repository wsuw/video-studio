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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  MessageSquareIcon,
  ListChecksIcon,
  Wand2Icon,
  InfoIcon,
  UserIcon,
  PackageIcon,
  MapPinIcon,
  SparklesIcon,
  LayoutGridIcon,
  FolderSyncIcon,
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  ArrowRightIcon,
  Loader2
} from "lucide-react"
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout"
import React, { useState } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useAgent, useConfigureSuggestions } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getThreadState, updateThreadState } from "@/lib/langgraph"
import { v4 as uuidv4 } from "uuid"
import { PRESET_VOICES } from "@/lib/preset-voices"
import { VoiceSelectorDialog, Voice } from "@/components/voices/voice-selector-dialog"

interface Entity {
  id: string;
  name: string;
  type: "character" | "prop" | "location";
  description: string;
  visual_reference?: string;
  voice_reference?: string;
}

// ── Entity type → icon & color mapping ─────────────────────────────
const ENTITY_CONFIG: Record<string, { icon: React.ElementType; color: string; activeBorder: string; activeBg: string; text: string }> = {
  character: { icon: UserIcon, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", activeBorder: "border-blue-500/40 ring-1 ring-blue-500/20", activeBg: "bg-blue-500/[0.03]", text: "text-blue-500" },
  prop: { icon: PackageIcon, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", activeBorder: "border-amber-500/40 ring-1 ring-amber-500/20", activeBg: "bg-amber-500/[0.03]", text: "text-amber-500" },
  location: { icon: MapPinIcon, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", activeBorder: "border-emerald-500/40 ring-1 ring-emerald-500/20", activeBg: "bg-emerald-500/[0.03]", text: "text-emerald-500" },
}

export default function BreakdownPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const locale = (params.locale as string) || "en";

  // Sync to breakdown phase
  usePhaseSync("breakdown");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Decompose Screenplay",
        message: "Please analyze the screenplay and extract all character, prop, and location entities.",
      },
      {
        title: "Style Extracted Assets",
        message: "Please generate a highly detailed visual prompt profile (style parameters, appearance, and textures) for the extracted assets, and call the generate_entity_portrait tool to render their master portraits.",
      }
    ],
    available: "always"
  });

  const { agent } = useAgent({ agentId: "default" });

  // Local state persistence fallbacks
  const [loadedDesign, setLoadedDesign] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<"character" | "prop" | "location">("character");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Real-time audition preview state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = React.useState<boolean>(false);
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    fetch("/api/voices")
      .then((res) => res.json())
      .then((data) => setAllVoices(data))
      .catch((err) => console.error("Failed to load voices:", err));
  }, []);

  const playPreview = (voicePath: string, voiceId: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if (playingVoiceId === voiceId) {
        setPlayingVoiceId(null);
        return;
      }
    }

    const previewUrl = `/api/preview-voice?path=${encodeURIComponent(voicePath)}`;
    const audio = new Audio(previewUrl);
    audioPlayerRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.play().catch((err) => {
      console.error("Audition playback failed:", err);
      setPlayingVoiceId(null);
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // Fetch persisted design state directly from LangGraph API on mount
  React.useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          setLoadedDesign(design);
          if (agent && (!agent.state?.design?.entities?.length)) {
            agent.setState({
              ...agent.state,
              design,
            });
          }
        }
      })
      .catch((err) => console.warn("[Breakdown] Failed to load state:", err));
  }, [projectId]);

  // Live state bindings
  const design = agent?.state?.design || loadedDesign || {};
  const entities: Entity[] = design.entities || [];
  const customStylePrompt = design.style_prompt || "";

  const hasData = entities.length > 0;

  // Filter entities by type
  const characters = entities.filter((e: any) => e.type === "character");
  const props = entities.filter((e: any) => e.type === "prop");
  const locations = entities.filter((e: any) => e.type === "location");

  // Auto-select active entity if none is selected
  React.useEffect(() => {
    if (hasData && !selectedEntityId) {
      const tabEntities = activeTab === "character" ? characters : activeTab === "prop" ? props : locations;
      if (tabEntities.length > 0) {
        setSelectedEntityId(tabEntities[0].id);
      } else if (entities.length > 0) {
        setSelectedEntityId(entities[0].id);
      }
    }
  }, [entities, activeTab, selectedEntityId, hasData]);

  const activeEntity = entities.find(e => e.id === selectedEntityId) || entities[0];

  const handleAutoBreakdown = () => {
    if (!agent) return;
    agent.addMessage({
      role: "user",
      id: uuidv4(),
      content: "Please analyze the script and extract all character, prop, and location entities.",
    });
    agent.runAgent();
  };

  const handleEntityUpdate = (entityId: string, updates: Partial<Entity>) => {
    if (!agent) return;
    const updatedEntities = entities.map(e => {
      if (e.id === entityId) {
        return { ...e, ...updates };
      }
      return e;
    });

    agent.setState({
      ...agent.state,
      design: {
        ...design,
        entities: updatedEntities
      }
    });
  };

  const handleAutoStyleProfile = (entity: Entity) => {
    if (!agent) return;
    agent.addMessage({
      role: "user",
      id: uuidv4(),
      content: `Please generate a highly detailed, professional visual prompt profile (style parameters, appearance, and textures) for the extracted asset "${entity.name}" (ID: ${entity.id}, Type: ${entity.type}). Align it with our current global style description: "${customStylePrompt || 'cinematic'}".
After generating the visual profile, please ALSO call the generate_entity_portrait tool to regenerate/update the portrait image for this entity.`,
    });
    agent.runAgent();
  };

  const handleAutoPortrait = async (entity: Entity) => {
    if (!entity.description) {
      alert("Please enter a description for the asset first.");
      return;
    }
    
    setIsGeneratingPortrait(true);
    try {
      const response = await fetch("/api/generate-keyframe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `${entity.description}. Master portrait visual reference, high resolution.`,
          width: 1024,
          height: 1024,
          guidance_scale: 1.0,
          num_inference_steps: 8,
          seed: Math.floor(Math.random() * 1000000),
          sceneId: "breakdown"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Status ${response.status}`);
      }

      const data = await response.json();
      if (data.status === "success" && data.url) {
        const updatedEntities = entities.map(e => {
          if (e.id === entity.id) {
            return { ...e, visual_reference: data.url };
          }
          return e;
        });

        const updatedDesign = {
          ...design,
          entities: updatedEntities
        };

        if (agent) {
          agent.setState({
            ...agent.state,
            design: updatedDesign
          });
        }
        
        setLoadedDesign(updatedDesign);

        await updateThreadState(projectId, {
          design: updatedDesign
        });
      } else {
        throw new Error(data.error || "Generation returned unsuccessful status");
      }
    } catch (err: any) {
      console.error("[Breakdown] Auto portrait generation failed:", err);
      alert(`Image generation failed: ${err.message || err}`);
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
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
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Director Breakdown</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoBreakdown}
            className="h-9 px-3 border-dashed transition-all shadow-sm"
          >
            <Wand2Icon className="w-3.5 h-3.5 mr-2" />
            Auto-Breakdown Script
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/design/style`)}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
          >
            <span className="text-xs font-semibold">Next: Style Setup</span>
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {hasData ? (
          <>
            {/* Left Pane: Entity Extraction & Selection (flex-1 width to fill remaining space) */}
            <div className="flex-1 min-w-[340px] flex flex-col p-6 overflow-y-auto border-r border-border/40">
              {/* Premium spacious layout for left pane header */}
              <div className="flex flex-col gap-4 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <ListChecksIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-md font-bold tracking-tight truncate">Script Decomposition</h1>
                    <p className="text-xs text-muted-foreground truncate">Molecular-level entity extraction</p>
                  </div>
                </div>
              </div>

              {/* Premium Tabs Selector */}
              <div className="flex border-b border-border/40 mb-5 gap-1 bg-background/50 p-1 rounded-lg shrink-0">
                {[
                  { id: "character", label: "Characters", count: characters.length, icon: UserIcon, activeColor: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                  { id: "prop", label: "Props", count: props.length, icon: PackageIcon, activeColor: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
                  { id: "location", label: "Locations", count: locations.length, icon: MapPinIcon, activeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        const tabEntities = tab.id === "character" ? characters : tab.id === "prop" ? props : locations;
                        if (tabEntities.length > 0) {
                          setSelectedEntityId(tabEntities[0].id);
                        }
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-bold text-xs transition-all focus:outline-none text-muted-foreground hover:text-foreground truncate",
                        isActive ? tab.activeColor : "bg-transparent border-transparent"
                      )}
                    >
                      <TabIcon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                      <Badge variant={isActive ? "default" : "secondary"} className="text-xs px-2 py-0.5 font-bold shrink-0">
                        {tab.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Tab Grid Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {(activeTab === "character" ? characters : activeTab === "prop" ? props : locations).map((entity: any) => {
                  const isSelected = selectedEntityId === entity.id;
                  const config = ENTITY_CONFIG[entity.type] || ENTITY_CONFIG.prop;
                  const Icon = config.icon;

                  return (
                    <Card
                      key={entity.id}
                      onClick={() => setSelectedEntityId(entity.id)}
                      className={cn(
                        "relative group overflow-hidden border cursor-pointer transition-all duration-300 p-4 rounded-xl select-none",
                        isSelected
                          ? cn("bg-background/80 shadow-md", config.activeBorder, config.activeBg)
                          : "border-border/60 bg-card hover:border-primary/20 hover:bg-muted/30"
                      )}
                    >
                      {/* Glow Gradient Overlay on Hover */}
                      <div className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500 bg-gradient-to-br from-transparent to-transparent",
                        entity.type === "character" && "group-hover:from-blue-500/10",
                        entity.type === "prop" && "group-hover:from-amber-500/10",
                        entity.type === "location" && "group-hover:from-emerald-500/10",
                      )} />

                      <div className="flex items-start gap-3 relative z-10">
                        <div className={cn(
                          "w-10 h-10 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center bg-muted/20 relative transition-all duration-300",
                          isSelected
                            ? cn("border-transparent", entity.type === "character" && "bg-blue-500 text-white", entity.type === "prop" && "bg-amber-500 text-white", entity.type === "location" && "bg-emerald-500 text-white")
                            : config.color
                        )}>
                          {entity.visual_reference ? (
                            <img src={entity.visual_reference} className="w-full h-full object-cover" />
                          ) : (
                            <Icon className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs tracking-tight text-foreground truncate">
                              {entity.name}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono shrink-0 px-2 py-0.5 font-bold">
                              {entity.id.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {entity.description}
                          </p>
                        </div>
                      </div>


                    </Card>
                  );
                })}
              </div>

              {/* Tab Empty State */}
              {(activeTab === "character" ? characters : activeTab === "prop" ? props : locations).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl bg-muted/5 opacity-50 flex-1">
                  <InfoIcon className="w-6 h-6 text-muted-foreground/30 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    No {activeTab}s extracted yet
                  </p>
                </div>
              )}
            </div>

            {/* Right Pane: Casting & Visual Profile Editor (Fixed 350px width) */}
            <div className="w-[350px] shrink-0 flex flex-col bg-muted/10 overflow-y-auto border-l border-border/20">
              <div className="p-6 border-b border-border/40 bg-background/50 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <FolderSyncIcon className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Casting & Asset Details</h2>
                  <p className="text-xs text-muted-foreground/85">Configure identity descriptions of extracted entities</p>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {activeEntity ? (
                  <div className="space-y-6 flex-1 flex flex-col">
                    {/* Header Card */}
                    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/60 bg-background/60 shadow-sm relative overflow-hidden shrink-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-md font-bold shadow-sm shrink-0",
                          activeEntity.type === "character" && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                          activeEntity.type === "prop" && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                          activeEntity.type === "location" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        )}>
                          {activeEntity.type === "character" ? <UserIcon className="w-5 h-5" /> : activeEntity.type === "prop" ? <PackageIcon className="w-5 h-5" /> : <MapPinIcon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-mono font-bold text-muted-foreground">
                              #{activeEntity.id.toUpperCase()}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 leading-none shrink-0",
                              activeEntity.type === "character" && "bg-blue-500/5 text-blue-500 border-blue-500/20",
                              activeEntity.type === "prop" && "bg-amber-500/5 text-amber-500 border-amber-500/20",
                              activeEntity.type === "location" && "bg-emerald-500/5 text-emerald-500 border-emerald-500/20"
                            )}>
                              {activeEntity.type}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-bold text-foreground leading-none truncate">
                            {activeEntity.name}
                          </h3>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAutoStyleProfile(activeEntity)}
                        className="text-xs h-8 w-full border-dashed transition-all hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30"
                      >
                        <SparklesIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                        AI Auto-Style Description
                      </Button>
                    </div>

                    {/* Vertical Form Fields */}
                    <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-1">
                      {/* Master Portrait Section */}
                      <div className="space-y-2 shrink-0 flex flex-col">
                        <label className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground block text-left">
                          Master Portrait
                        </label>
                        <div className="w-full aspect-square relative group rounded-xl overflow-hidden border border-border/60 bg-muted/20 shadow-inner flex items-center justify-center">
                          {isGeneratingPortrait ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-3">
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mb-1.5" />
                              <p className="text-[10px] text-muted-foreground leading-snug">Generating...</p>
                            </div>
                          ) : activeEntity.visual_reference ? (
                            <>
                              <img
                                src={activeEntity.visual_reference}
                                alt={activeEntity.name}
                                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 backdrop-blur-[1px] p-2 text-center">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleAutoPortrait(activeEntity)}
                                  disabled={isGeneratingPortrait}
                                  className="text-xs font-bold h-6 px-2 w-full"
                                >
                                  <Wand2Icon className="w-2.5 h-2.5 mr-1" />
                                  Regenerate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs font-bold h-6 px-2 w-full text-white border border-white/25 bg-transparent hover:bg-white/10 hover:text-white"
                                  onClick={() => {
                                    const newRef = prompt("Enter Custom Image URL:", activeEntity.visual_reference);
                                    if (newRef !== null) {
                                      handleEntityUpdate(activeEntity.id, { visual_reference: newRef });
                                    }
                                  }}
                                >
                                  Edit URL
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center p-3">
                              <SparklesIcon className="w-5 h-5 text-indigo-500/40 mb-1.5 animate-pulse" />
                              <p className="text-xs text-muted-foreground leading-snug">No reference image</p>
                              <Button
                                size="sm"
                                onClick={() => handleAutoPortrait(activeEntity)}
                                disabled={isGeneratingPortrait}
                                className="text-xs font-bold h-5 px-1.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                Auto-Draw
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Asset Name Input */}
                      <div className="space-y-2 shrink-0">
                        <label className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground block">
                          Asset Name
                        </label>
                        <Input
                          value={activeEntity.name}
                          onChange={(e) => handleEntityUpdate(activeEntity.id, { name: e.target.value })}
                          className="bg-background border-border/80 text-sm focus-visible:ring-primary/20 h-10 max-w-md"
                        />
                      </div>

                      {/* Character Voice Reference Selection */}
                      {activeEntity.type === "character" && (() => {
                        const currentVoice = allVoices.find(v => v.id === activeEntity.voice_reference || v.sampleUrl === activeEntity.voice_reference) || PRESET_VOICES.find(v => v.id === activeEntity.voice_reference || v.path === activeEntity.voice_reference);
                        const isCustomVoice = activeEntity.voice_reference && !currentVoice;
                        const isVoicePlaying = currentVoice && playingVoiceId === currentVoice.id;

                        const playVoicePreview = () => {
                          if (!currentVoice) return;
                          const path = currentVoice.sampleUrl || currentVoice.path;
                          const id = currentVoice.id;
                          
                          let finalUrl = "";
                          if (path.startsWith("examples/") || path.startsWith("presets/")) {
                            finalUrl = `/api/preview-voice?path=${encodeURIComponent(path)}`;
                          } else {
                            const filename = path.split("/").pop();
                            finalUrl = `/api/speech-samples/${filename}`;
                          }

                          if (audioPlayerRef.current) {
                            audioPlayerRef.current.pause();
                            if (playingVoiceId === id) {
                              setPlayingVoiceId(null);
                              return;
                            }
                          }

                          const audio = new Audio(finalUrl);
                          audioPlayerRef.current = audio;
                          setPlayingVoiceId(id);
                          audio.play().catch(err => {
                            console.error("Audition playback failed:", err);
                            setPlayingVoiceId(null);
                          });
                          audio.onended = () => {
                            setPlayingVoiceId(null);
                          };
                        };

                        return (
                          <div className="space-y-4 shrink-0">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <label className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground block">
                                Voice Casting
                              </label>
                              {activeEntity.voice_reference && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEntityUpdate(activeEntity.id, { voice_reference: "" })}
                                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/20 transition-all font-medium"
                                >
                                  Mute / Clear
                                </Button>
                              )}
                            </div>

                            {/* Active Voice Card */}
                            <div className="relative">
                              <Card
                                onClick={() => setIsVoiceDialogOpen(true)}
                                className={cn(
                                  "p-4 cursor-pointer transition-all border text-left relative group select-none shadow-sm",
                                  activeEntity.voice_reference 
                                    ? "border-primary/40 bg-primary/[0.02] hover:bg-primary/[0.04]"
                                    : "border-dashed border-border/80 hover:border-primary/30 hover:bg-muted/10"
                                )}
                              >
                                {activeEntity.voice_reference ? (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-foreground truncate">
                                          {currentVoice ? currentVoice.name : "Custom Voice"}
                                        </h4>
                                        {currentVoice && (
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[9px] px-1 py-0 font-semibold uppercase tracking-wider rounded border shrink-0",
                                              currentVoice.gender?.toLowerCase() === "female" && "text-pink-500 border-pink-500/20 bg-pink-500/5",
                                              currentVoice.gender?.toLowerCase() === "male" && "text-blue-500 border-blue-500/20 bg-blue-500/5",
                                              currentVoice.gender?.toLowerCase() === "narrator" && "text-amber-500 border-amber-500/20 bg-amber-500/5",
                                              currentVoice.gender?.toLowerCase() === "special" && "text-purple-500 border-purple-500/20 bg-purple-500/5"
                                            )}
                                          >
                                            {currentVoice.gender}
                                          </Badge>
                                        )}
                                        {currentVoice?.locale && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-semibold uppercase tracking-wider rounded border text-indigo-500 border-indigo-500/20 bg-indigo-500/5 shrink-0">
                                            {currentVoice.locale}
                                          </Badge>
                                        )}
                                        {isCustomVoice && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-semibold uppercase tracking-wider rounded border text-emerald-500 border-emerald-500/20 bg-emerald-500/5 shrink-0">
                                            Custom
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
                                        {currentVoice ? currentVoice.description : activeEntity.voice_reference}
                                      </p>
                                      <div className="text-[10px] text-primary/70 font-semibold flex items-center gap-1 group-hover:text-primary transition-colors">
                                        <SparklesIcon className="w-3 h-3" />
                                        <span>Click to Change Voice</span>
                                      </div>
                                    </div>

                                    {currentVoice && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playVoicePreview();
                                        }}
                                        className={cn(
                                          "w-8 h-8 rounded-full border transition-all shrink-0 shadow-sm",
                                          isVoicePlaying
                                            ? "bg-primary text-white border-primary animate-pulse"
                                            : "bg-background/80 hover:bg-primary/10 border-border/80 text-muted-foreground hover:text-primary"
                                        )}
                                      >
                                        {isVoicePlaying ? (
                                          <PauseIcon className="w-3.5 h-3.5 fill-current" />
                                        ) : (
                                          <PlayIcon className="w-3.5 h-3.5 ml-0.5 fill-current" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-5 text-center text-muted-foreground group-hover:text-primary transition-colors">
                                    <Volume2Icon className="w-5 h-5 mb-1.5 text-muted-foreground/45 group-hover:text-primary/60 transition-colors" />
                                    <p className="text-xs font-bold">No Voice Casted</p>
                                    <p className="text-[10px] opacity-75 mt-0.5">Click to choose a character voice</p>
                                  </div>
                                )}
                              </Card>

                              {/* Reusable VoiceSelectorDialog component */}
                              <VoiceSelectorDialog
                                isOpen={isVoiceDialogOpen}
                                onOpenChange={setIsVoiceDialogOpen}
                                selectedVoiceId={activeEntity.voice_reference || null}
                                onSelect={(voice) => {
                                  handleEntityUpdate(activeEntity.id, { voice_reference: voice.id });
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Visual Identity Profile Textarea */}
                      <div className="space-y-2 flex flex-col flex-1 min-h-[200px]">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground truncate">
                            Visual Description
                          </label>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal shrink-0 border-border bg-muted/20 text-muted-foreground">
                            Style: {customStylePrompt || "cinematic"}
                          </Badge>
                        </div>
                        <Textarea
                          value={activeEntity.description}
                          onChange={(e) => handleEntityUpdate(activeEntity.id, { description: e.target.value })}
                          placeholder="Outfit style, material textures, camera features, face/design elements..."
                          className="bg-background border-border/80 text-sm focus-visible:ring-primary/20 leading-relaxed p-3.5 flex-1 min-h-[160px] resize-none focus-visible:border-primary/30 shadow-inner rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center opacity-30 my-auto">
                    <LayoutGridIcon className="w-6 h-6 mb-2" />
                    <p className="text-xs">Select an asset card on the left to edit its visual parameters</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse border border-border">
              <InfoIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">No asset breakdown data yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-2 leading-relaxed">
              Decompose your script to extract and auto-populate the layout and visual asset setup.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleAutoBreakdown}
              className="mt-6 font-semibold"
            >
              <Wand2Icon className="w-4 h-4 mr-2" />
              Auto-Breakdown Script
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
