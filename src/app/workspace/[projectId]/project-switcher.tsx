"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, PlusIcon, VideoIcon, FolderIcon } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { searchThreads } from "@/lib/langgraph"

export function ProjectSwitcher({
  projects,
}: {
  projects: {
    id: string
    name: string
    logo: React.ReactNode
    plan: string
  }[]
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const params = useParams()
  const activeProjectId = params.projectId as string

  const [customProjects, setCustomProjects] = React.useState<any[]>([])

  React.useEffect(() => {
    async function syncCustomProjects() {
      // Fast load from localStorage first
      try {
        const stored = localStorage.getItem("video-agent:projects")
        if (stored) {
          setCustomProjects(JSON.parse(stored))
        }
      } catch (e) {
        console.error(e)
      }

      // Then sync from server in background
      try {
        const threads = await searchThreads()
        if (Array.isArray(threads)) {
          const syncedList = threads.map((t: any) => ({
            id: t.thread_id,
            name: t.metadata?.name || "Untitled Project",
            prompt: t.metadata?.prompt || "Created via VideoStudio.",
            style: t.metadata?.style || "cinematic",
            ratio: t.metadata?.ratio || "16:9",
            voice: t.metadata?.voice || "deep",
            createdAt: t.metadata?.createdAt || t.created_at || new Date().toISOString(),
          }))
          setCustomProjects(syncedList)
          localStorage.setItem("video-agent:projects", JSON.stringify(syncedList))
        }
      } catch (err) {
        console.warn("[Project Switcher] Failed to sync custom projects from server.", err)
      }
    }

    syncCustomProjects()
  }, [])

  const allProjects = React.useMemo(() => {
    const list = [...projects]
    customProjects.forEach((cp: any) => {
      if (!list.some(p => p.id === cp.id)) {
        list.push({
          id: cp.id,
          name: cp.name,
          logo: <VideoIcon className="size-4 text-primary" />,
          plan: "Pro Project"
        })
      }
    })
    return list
  }, [customProjects, projects])

  const [activeProject, setActiveProject] = React.useState<any>(null)

  React.useEffect(() => {
    const found = allProjects.find(p => p.id === activeProjectId) || allProjects[0]
    setActiveProject(found)
  }, [allProjects, activeProjectId])

  if (!activeProject) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeProject.logo}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeProject.name}</span>
                <span className="truncate text-xs">{activeProject.plan}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {allProjects.map((project, index) => (
              <DropdownMenuItem
                key={project.id || project.name}
                onClick={() => {
                  setActiveProject(project)
                  router.push(`/workspace/${project.id}/design/script`) // Redirect to default page for project
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  {project.logo}
                </div>
                {project.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push("/studio/projects")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <FolderIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">View All Projects</div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push("/studio")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <PlusIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Create New Project</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
