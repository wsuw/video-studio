"use client";

import dynamic from "next/dynamic";
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
import { MessageSquareIcon, SaveIcon, ArrowRightIcon } from "lucide-react"
import { WorkspaceContext } from "@/app/workspace/[projectId]/layout"
import React from "react"
import { useRouter, useParams } from "next/navigation";
import { usePhaseSync } from "@/hooks/use-phase-sync";

// 使用动态导入，禁用 SSR，防止 "window is not defined" 错误
const EditorContent = dynamic(() => import("./EditorContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-gray-500 animate-pulse">Loading editor...</div>
    </div>
  ),
});

export default function Page() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId;

  const [projectName, setProjectName] = React.useState("Project Name");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("video-agent:projects");
      if (stored) {
        const storedProjects = JSON.parse(stored);
        const current = storedProjects.find((p: any) => p.id === projectId);
        if (current) {
          setProjectName(current.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  usePhaseSync("design");

  const handleNextStep = () => {
    router.push(`/workspace/${projectId}/design/breakdown`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
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
                <BreadcrumbLink href="/studio">Studio</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink>{projectName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Script</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4 pr-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("save-script-event"))}
              className="flex items-center gap-2 h-9 px-3 text-muted-foreground hover:text-foreground transition-all group"
            >
              <SaveIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Save</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleNextStep}
              className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
            >
              <span className="text-xs font-semibold">Director Breakdown</span>
              <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {!isChatOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen?.(true)}
              className="flex items-center gap-2 h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <MessageSquareIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Open Assistant</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <EditorContent />
      </main>
    </div>
  );
}
