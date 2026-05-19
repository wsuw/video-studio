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
  FolderSyncIcon
} from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React, { useState } from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useRouter, useParams } from "next/navigation"
import { useAgent } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getThreadState } from "@/lib/langgraph"

interface Entity {
  id: string;
  name: string;
  type: "character" | "prop" | "location";
  description: string;
  visual_reference?: string;
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

  // Sync to breakdown phase
  usePhaseSync("breakdown");

  const { agent } = useAgent({ agentId: "default" });

  // Local state persistence fallbacks
  const [loadedDesign, setLoadedDesign] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<"character" | "prop" | "location">("character");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
      content: `Please generate a highly detailed, professional visual prompt profile (style parameters, appearance, and textures) for the extracted asset "${entity.name}" (ID: ${entity.id}, Type: ${entity.type}). Align it with our current global style description: "${customStylePrompt || 'cinematic'}"`,
    });
    agent.runAgent();
  };

  const handleAutoPortrait = (entity: Entity) => {
    if (!agent) return;
    agent.addMessage({
      role: "user",
      id: crypto.randomUUID(),
      content: `Please generate a canonical visual reference image (Master Portrait) using the generate_entity_portrait tool for the entity "${entity.name}" (ID: ${entity.id}) with the style prompt: "${entity.description}"`,
    });
    agent.runAgent();
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/workspace" className="text-muted-foreground hover:text-foreground">Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Director Breakdown</BreadcrumbPage>
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {hasData ? (
          <>
            {/* Left Pane: Entity Extraction & Selection (58% width) */}
            <div className="w-[58%] flex flex-col p-6 overflow-y-auto border-r border-border/40">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <ListChecksIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight">Script Decomposition</h1>
                    <p className="text-xs text-muted-foreground">Molecular-level entity extraction (Characters, Props & Locations)</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-dashed"
                    onClick={handleAutoBreakdown}
                  >
                    <Wand2Icon className="w-4 h-4 mr-2" />
                    Auto-Breakdown
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => router.push(`/workspace/${projectId}/design/style`)}
                  >
                    Next: Style Setup
                  </Button>
                </div>
              </div>

              {/* Premium Tabs Selector */}
              <div className="flex border-b border-border/40 mb-5 gap-1.5 bg-background/50 p-1 rounded-lg">
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
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md font-semibold text-xs transition-all focus:outline-none text-muted-foreground hover:text-foreground",
                        isActive ? tab.activeColor : "bg-transparent border-transparent"
                      )}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      <Badge variant={isActive ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 font-bold shrink-0">
                        {tab.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Tab Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(activeTab === "character" ? characters : activeTab === "prop" ? props : locations).map((entity: any) => {
                  const isSelected = selectedEntityId === entity.id;
                  const config = ENTITY_CONFIG[entity.type] || ENTITY_CONFIG.prop;
                  const Icon = config.icon;

                  return (
                    <Card
                      key={entity.id}
                      onClick={() => setSelectedEntityId(entity.id)}
                      className={cn(
                        "relative group overflow-hidden border cursor-pointer transition-all duration-300 p-4 rounded-xl flex flex-col justify-between select-none h-40",
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
                            <span className="font-bold text-xs tracking-tight text-slate-800 dark:text-zinc-100 truncate">
                              {entity.name}
                            </span>
                            <Badge variant="outline" className="text-[8px] font-mono shrink-0 px-1.5 py-0 font-bold">
                              {entity.id.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                            {entity.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Visual Reference Badge */}
                      {entity.visual_reference && (
                        <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground relative z-10 self-start">
                          <span className="font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">
                            Ref: {entity.visual_reference}
                          </span>
                        </div>
                      )}
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

            {/* Right Pane: Casting & Visual Profile Editor (42% width) */}
            <div className="w-[42%] flex flex-col bg-muted/10 overflow-y-auto">
              <div className="p-6 border-b border-border/40 bg-background/50 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <FolderSyncIcon className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Casting & Asset Details</h2>
                  <p className="text-[10px] text-muted-foreground/60">Configure identity descriptions of extracted entities</p>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {activeEntity ? (
                  <div className="space-y-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-background/60 shadow-sm relative overflow-hidden shrink-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-md font-bold shadow-sm",
                          activeEntity.type === "character" && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                          activeEntity.type === "prop" && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                          activeEntity.type === "location" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        )}>
                          {activeEntity.type === "character" ? <UserIcon className="w-5 h-5" /> : activeEntity.type === "prop" ? <PackageIcon className="w-5 h-5" /> : <MapPinIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground">
                              #{activeEntity.id.toUpperCase()}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0",
                              activeEntity.type === "character" && "bg-blue-500/5 text-blue-500 border-blue-500/20",
                              activeEntity.type === "prop" && "bg-amber-500/5 text-amber-500 border-amber-500/20",
                              activeEntity.type === "location" && "bg-emerald-500/5 text-emerald-500 border-emerald-500/20"
                            )}>
                              {activeEntity.type}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-bold text-foreground leading-none">
                            {activeEntity.name}
                          </h3>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAutoStyleProfile(activeEntity)}
                        className="text-xs h-8 px-3 border-dashed text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
                      >
                        <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
                        Auto-Style
                      </Button>
                    </div>

                    {/* Edit Name */}
                    <div className="space-y-1.5 shrink-0">
                      <label className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                        Asset Name
                      </label>
                      <Input
                        value={activeEntity.name}
                        onChange={(e) => handleEntityUpdate(activeEntity.id, { name: e.target.value })}
                        className="bg-background border-border/80 text-sm focus-visible:ring-primary/20 h-10"
                      />
                    </div>

                    {/* Master Portrait / Visual Reference */}
                    <div className="space-y-1.5 shrink-0">
                      <label className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                        Master Portrait (主视觉人设档案)
                      </label>
                      {activeEntity.visual_reference ? (
                        <div className="relative group rounded-xl overflow-hidden border border-border/60 aspect-[16/10] bg-muted/20 shadow-inner flex items-center justify-center">
                          <img
                            src={activeEntity.visual_reference}
                            alt={activeEntity.name}
                            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all duration-300 backdrop-blur-[2px]">
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => handleAutoPortrait(activeEntity)}
                              className="text-[10px] font-semibold h-7 px-3 bg-white text-black hover:bg-zinc-100"
                            >
                              <Wand2Icon className="w-3 h-3 mr-1" />
                              Regenerate
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-[10px] font-semibold h-7 px-3 text-white border-white/20 hover:bg-white/10"
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
                        </div>
                      ) : (
                        <div className="border border-dashed border-border/80 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-muted/5 min-h-[140px] transition-all duration-300 hover:border-primary/30">
                          <SparklesIcon className="w-6 h-6 text-indigo-500/40 mb-2 animate-pulse" />
                          <h4 className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">No Character Reference Image</h4>
                          <p className="text-[10px] text-muted-foreground mt-1 max-w-[240px] leading-normal">
                            Lack of visual reference causes character drift. Generate a canonical visual reference portrait now!
                          </p>
                          <div className="flex gap-2 mt-3.5">
                            <Button 
                              size="sm" 
                              onClick={() => handleAutoPortrait(activeEntity)}
                              className="text-[10px] font-semibold h-7 px-3"
                            >
                              <Wand2Icon className="w-3 h-3 mr-1" />
                              AI Auto-Draw
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-[10px] font-semibold h-7 px-3 border-dashed hover:border-primary/30 text-slate-700 dark:text-zinc-300"
                              onClick={() => {
                                const newRef = prompt("Enter Reference Image URL:");
                                if (newRef) {
                                  handleEntityUpdate(activeEntity.id, { visual_reference: newRef });
                                }
                              }}
                            >
                              Upload URL
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Visual Styling Prompt Description */}
                    <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px]">
                      <label className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                        Visual Identity Profile (Casting Visual Styling)
                      </label>
                      <Textarea
                        value={activeEntity.description}
                        onChange={(e) => handleEntityUpdate(activeEntity.id, { description: e.target.value })}
                        placeholder="Outfit style, material textures, camera features, face/design elements..."
                        className="flex-1 bg-background border-border/80 text-sm focus-visible:ring-primary/20 leading-relaxed min-h-[200px]"
                      />
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
