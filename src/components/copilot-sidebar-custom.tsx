"use client";

import * as React from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BotIcon, PanelRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceContext } from "@/app/workspace/layout";

export function CopilotSidebarCustom() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);

  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="none"
      className={cn(
        "border-l border-border transition-[width,margin] duration-300 ease-in-out",
        !isChatOpen && "w-0 border-none"
      )}
      style={{
        "--sidebar-width": isChatOpen ? "500px" : "0px",
      } as React.CSSProperties}
    >
      <div className="w-[500px] flex flex-col h-full shrink-0 overflow-hidden">
        <SidebarHeader className="h-16 border-b border-border flex flex-row items-center justify-between px-2 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BotIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-foreground leading-none truncate">Video Assistant</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1 truncate">AI Studio</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="h-8 w-8 shrink-0 hover:bg-muted transition-colors ml-2">
            <PanelRightIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </SidebarHeader>
        <SidebarContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
          <div className="flex-1 min-h-0 w-full relative">
            <CopilotChat
              labels={{
                welcomeMessageText: "Welcome to Video Studio! I'm your creative assistant.",
              }}
              attachments={{ enabled: true }}
              className="h-full w-full border-none"
              style={{ "--cpk-container-3xl": "95%" } as React.CSSProperties}
            />
          </div>
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
