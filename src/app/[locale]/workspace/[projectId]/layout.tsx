"use client";

import * as React from "react";

import "@copilotkit/react-core/v2/styles.css";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { ThemeProvider } from "@/hooks/use-theme";
// A2UI catalog: definitions + renderers in ./declarative-generative-ui/
import { demonstrationCatalog } from "@/app/declarative-generative-ui/renderers";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

import { CopilotSidebarCustom } from "@/components/copilot-sidebar-custom";
import { AppSidebar } from "@/app/[locale]/workspace/[projectId]/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useGenerativeUIExamples, useExampleSuggestions } from "@/hooks";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

import { useParams } from "next/navigation";


function CopilotHooks() {
  useGenerativeUIExamples();
  return null;
}

export const WorkspaceContext = React.createContext<{
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
}>({
  isChatOpen: false,
  setIsChatOpen: () => { },
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const params = useParams();
  const projectId = params?.projectId as string;

  React.useEffect(() => {
    const stored = localStorage.getItem("isChatOpen");
    if (stored !== null) {
      setIsChatOpen(stored === "true");
    }
  }, []);

  const handleSetChatOpen = React.useCallback((open: boolean) => {
    setIsChatOpen(open);
    localStorage.setItem("isChatOpen", open ? "true" : "false");
  }, []);

  return (
    <ThemeProvider>
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        threadId={projectId}
        inspectorDefaultAnchor={{ horizontal: "right", vertical: "top" }}
        a2ui={{ catalog: demonstrationCatalog }}
        openGenerativeUI={{}}
        useSingleEndpoint={false}
        showDevConsole={true}
      >
        <WorkspaceContext.Provider value={{ isChatOpen, setIsChatOpen: handleSetChatOpen }}>
          <SidebarProvider className="h-screen overflow-hidden">
            <AppSidebar />
            <SidebarInset className="flex flex-col h-full overflow-hidden relative">
              {children}
            </SidebarInset>
            <CopilotSidebarCustom />
            <CopilotHooks />
          </SidebarProvider>
        </WorkspaceContext.Provider>
      </CopilotKit>
    </ThemeProvider>
  );
}


function YourMainContent() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Main Content</h1>
      <p className="text-gray-600">
        This content sits next to the Copilot sidebar.
      </p>
    </div>
  );
}