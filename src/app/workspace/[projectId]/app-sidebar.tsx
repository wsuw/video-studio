"use client"

import * as React from "react"

import { NavDesign } from "@/app/workspace/[projectId]/nav-design"
import { NavGeneration } from "@/app/workspace/[projectId]/nav-generation"
import { NavRedesign } from "@/app/workspace/[projectId]/nav-redesign"
import { NavDistribution } from "@/app/workspace/[projectId]/nav-distribution"
import { NavUser } from "@/components/nav-user"
import { ProjectSwitcher } from "@/app/workspace/[projectId]/project-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { GalleryVerticalEndIcon, AudioLinesIcon, TerminalIcon, PencilIcon, LayoutTemplateIcon, DatabaseIcon, ClapperboardIcon, ActivityIcon, EyeIcon, Wand2Icon, FilmIcon, UploadCloudIcon } from "lucide-react"
import { useParams } from "next/navigation"

// This is sample data.
const data = {
  user: {
    name: "Guest",
    email: "guest@gmail.com",
    avatar: "https://ui.shadcn.com/avatars/shadcn.jpg",
  },
  projects: [
    {
      id: "318b76e2-2a5b-4b13-911b-26514e2d307b",
      name: "Project Name",
      logo: (
        <GalleryVerticalEndIcon
        />
      ),
      plan: "Enterprise",
    },
    {
      id: "83f0980c-c6f1-4328-986c-486940d93f7c",
      name: "Project2",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Startup",
    },
    {
      id: "d9b4b1e2-2a5b-4b13-911b-26514e2d307d",
      name: "Project3",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Free",
    },
  ],
  design: [
    {
      title: "Script",
      url: "/design/script",
      icon: (
        <PencilIcon
        />
      ),
    },
    {
      title: "Storyboard",
      url: "/design/storyboard",
      icon: (
        <LayoutTemplateIcon
        />
      ),
    },
    {
      title: "Assets",
      url: "/design/assets",
      icon: (
        <DatabaseIcon
        />
      ),
    },
  ],
  generation: [
    {
      name: "Render Queue",
      url: "/generation/queue",
      icon: (
        <ClapperboardIcon
        />
      ),
    },
    {
      name: "Execution",
      url: "/generation/execution",
      icon: (
        <ActivityIcon
        />
      ),
    }
  ],
  redesign: [
    {
      name: "HITL Review",
      url: "/redesign/review",
      icon: (
        <EyeIcon
        />
      ),
    },
    {
      name: "Correction",
      url: "/redesign/correction",
      icon: (
        <Wand2Icon
        />
      ),
    }
  ],
  distribution: [
    {
      name: "Timeline",
      url: "/distribution/timeline",
      icon: (
        <FilmIcon
        />
      ),
    },
    {
      name: "Export",
      url: "/distribution/export",
      icon: (
        <UploadCloudIcon
        />
      ),
    }
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const params = useParams()
  const projectId = params.projectId as string

  const designItems = data.design.map(item => ({
    ...item,
    url: `/workspace/${projectId}${item.url}`
  }))

  const generationItems = data.generation.map(item => ({
    ...item,
    url: `/workspace/${projectId}${item.url}`
  }))

  const redesignItems = data.redesign.map(item => ({
    ...item,
    url: `/workspace/${projectId}${item.url}`
  }))

  const distributionItems = data.distribution.map(item => ({
    ...item,
    url: `/workspace/${projectId}${item.url}`
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ProjectSwitcher projects={data.projects} />
      </SidebarHeader>
      <SidebarContent>
        <NavDesign items={designItems} />
        <NavGeneration generation={generationItems} />
        <NavRedesign redesign={redesignItems} />
        <NavDistribution distribution={distributionItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
