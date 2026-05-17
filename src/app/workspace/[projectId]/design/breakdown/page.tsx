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
import {
  MessageSquareIcon,
  ListChecksIcon,
  CheckCircle2Icon,
  Wand2Icon,
  InfoIcon,
  UserIcon,
  PackageIcon,
  MapPinIcon,
  FilmIcon,
} from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useRouter, useParams } from "next/navigation"
import { useAgent } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getThreadState } from "@/lib/langgraph"

// ── Entity type → icon & color mapping ─────────────────────────────
const ENTITY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  character: { icon: UserIcon, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Character" },
  prop: { icon: PackageIcon, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Prop" },
  location: { icon: MapPinIcon, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Location" },
}

export default function BreakdownPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  usePhaseSync("breakdown");

  const { agent } = useAgent({ agentId: "default" });

  // Local state for data loaded directly from LangGraph checkpoint
  const [loadedDesign, setLoadedDesign] = React.useState<any>(null);

  // On mount: fetch persisted state directly from LangGraph API
  React.useEffect(() => {
    if (!projectId) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          setLoadedDesign(design);
          // Also sync to CopilotKit agent state so both stay consistent
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

  // Prefer live agent state (updates in real-time during runs),
  // fall back to loaded state from API (for page refresh)
  const design = agent?.state?.design || loadedDesign || {};
  const entities = design.entities || [];
  const rawScenes = design.raw_scenes || [];
  const isApproved = design.is_approved || false;

  const hasData = entities.length > 0 || rawScenes.length > 0;

  const handleAutoBreakdown = () => {
    if (!agent) return;
    agent.addMessage({
      role: "user",
      id: crypto.randomUUID(),
      content: "Please break down the current script into scenes for me.",
    });
    agent.runAgent();
  };

  const handleApprove = () => {
    agent?.setState({
      ...agent.state,
      design: {
        ...agent.state.design,
        is_approved: true
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
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

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Title Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <ListChecksIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Script Decomposition</h1>
                <p className="text-sm text-muted-foreground">Molecular-level entity extraction & scene breakdown</p>
              </div>
            </div>

            <div className="flex gap-3">
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
                variant={isApproved ? "secondary" : "default"}
                size="sm"
                onClick={handleApprove}
                disabled={!hasData || isApproved}
                className={cn(isApproved && "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20")}
              >
                <CheckCircle2Icon className="w-4 h-4 mr-2" />
                {isApproved ? "Approved by Director" : "Approve Breakdown"}
              </Button>
            </div>
          </div>

          {hasData ? (
            <>
              {/* ── Section 1: Entity Inventory ────────────────── */}
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold tracking-tight">Asset Inventory</h2>
                  <Badge variant="secondary" className="text-[10px]">{entities.length} entities</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entities.map((entity: any) => {
                    const config = ENTITY_CONFIG[entity.type] || ENTITY_CONFIG.prop;
                    const Icon = config.icon;
                    return (
                      <Card
                        key={entity.id}
                        className={cn(
                          "p-4 border transition-all hover:shadow-md",
                          config.color
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-md bg-background/50">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm truncate">{entity.name}</span>
                              <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {entity.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* ── Section 2: Raw Scene Descriptions ─────────── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold tracking-tight">Scene Breakdown</h2>
                  <Badge variant="secondary" className="text-[10px]">{rawScenes.length} scenes</Badge>
                </div>

                <div className="space-y-3">
                  {rawScenes.map((scene: any, idx: number) => (
                    <Card key={scene.id} className="p-5 border-border/50 bg-card hover:border-primary/30 transition-all group">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {idx + 1}
                          </div>
                        </div>

                        <div className="flex-1 pt-0.5">
                          <div className="flex items-center gap-2 mb-2">
                            <FilmIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px] font-mono tracking-tighter uppercase font-bold">
                              {scene.id}
                            </Badge>
                          </div>
                          <p className="text-foreground/90 leading-relaxed">
                            {scene.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          ) : (
            /* ── Empty State ──────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl bg-muted/5 opacity-50">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse">
                <InfoIcon className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-medium">No breakdown data yet</h3>
              <p className="text-sm text-muted-foreground max-w-md text-center mt-2">
                Click &quot;Auto-Breakdown&quot; or ask the Assistant to decompose the script into entities and scenes.
              </p>
            </div>
          )}

          {/* ── Approval Banner → Next Stage ──────────────────── */}
          {isApproved && (
            <div className="mt-12 p-6 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-green-500 uppercase tracking-widest mb-1">Director&apos;s Note</h4>
                <p className="text-sm text-green-500/80">Breakdown confirmed. Proceeding to visual storyboard design.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-green-500/20 text-green-500 hover:bg-green-500/10"
                onClick={() => router.push(`/workspace/${projectId}/design/storyboard`)}
              >
                Next: Storyboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
