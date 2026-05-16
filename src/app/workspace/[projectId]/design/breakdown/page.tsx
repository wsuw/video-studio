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
import { MessageSquareIcon, ListChecksIcon, CheckCircle2Icon, Wand2Icon, InfoIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { usePhaseSync } from "@/hooks/use-phase-sync"
import { useRouter, useParams } from "next/navigation"
import { useAgent } from "@copilotkit/react-core/v2"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export default function BreakdownPage() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId;
  usePhaseSync("breakdown");

  const { agent } = useAgent({ agentId: "default" });
  const scenes = agent?.state?.design?.scenes || [];
  const isApproved = agent?.state?.design?.is_approved || false;

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

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <ListChecksIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Script Decomposition</h1>
                <p className="text-sm text-muted-foreground">Verify the scene breakdown before visual composition</p>
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
                disabled={scenes.length === 0 || isApproved}
                className={cn(isApproved && "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20")}
              >
                <CheckCircle2Icon className="w-4 h-4 mr-2" />
                {isApproved ? "Approved by Director" : "Approve Breakdown"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {scenes.length > 0 ? (
              scenes.map((scene: any, idx: number) => (
                <Card key={scene.id} className="p-6 border-border/50 bg-card hover:border-primary/30 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {idx + 1}
                      </div>
                      <div className="flex-1 w-px bg-border group-last:hidden"></div>
                    </div>

                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px] font-mono tracking-tighter uppercase font-bold">
                          SCENE {scene.id}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] opacity-60">
                          {scene.status}
                        </Badge>
                      </div>
                      <p className="text-foreground/90 leading-relaxed font-serif italic text-lg">
                        "{scene.description}"
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl bg-muted/5 opacity-50">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse">
                  <InfoIcon className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-medium">No scenes decomposed yet</h3>
                <p className="text-sm text-muted-foreground max-w-md text-center mt-2">
                  Ask the Assistant to "break down the script into scenes" to begin the directorial process.
                </p>
              </div>
            )}
          </div>

          {isApproved && (
            <div className="mt-12 p-6 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-green-500 uppercase tracking-widest mb-1">Director's Note</h4>
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
