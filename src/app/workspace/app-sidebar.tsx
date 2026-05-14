"use client"

import * as React from "react"

import { NavDesign } from "@/app/workspace/nav-design"
import { NavGeneration } from "@/app/workspace/nav-generation"
import { NavRedesign } from "@/app/workspace/nav-redesign"
import { NavDistribution } from "@/app/workspace/nav-distribution"
import { NavUser } from "@/components/nav-user"
import { ProjectSwitcher } from "@/app/workspace/project-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { GalleryVerticalEndIcon, AudioLinesIcon, TerminalIcon, PencilIcon, LayoutTemplateIcon, DatabaseIcon, ClapperboardIcon, ActivityIcon, EyeIcon, Wand2Icon, FilmIcon, UploadCloudIcon } from "lucide-react"

// This is sample data.
const data = {
  user: {
    name: "Guest",
    email: "guest@gmail.com",
    avatar: "https://ui.shadcn.com/avatars/shadcn.jpg",
  },
  projects: [
    {
      name: "Project Name",
      logo: (
        <GalleryVerticalEndIcon
        />
      ),
      plan: "Enterprise",
    },
    {
      name: "Project2",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Startup",
    },
    {
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
      url: "/workspace/design/script",
      icon: (
        <PencilIcon
        />
      ),
    },
    {
      title: "Storyboard",
      url: "/workspace/design/storyboard",
      icon: (
        <LayoutTemplateIcon
        />
      ),
    },
    {
      title: "Assets",
      url: "/workspace/design/assets",
      icon: (
        <DatabaseIcon
        />
      ),
    },
  ],
  generation: [
    {
      name: "Render Queue",
      url: "/workspace/generation/queue",
      icon: (
        <ClapperboardIcon
        />
      ),
    },
    {
      name: "Execution",
      url: "/workspace/generation/execution",
      icon: (
        <ActivityIcon
        />
      ),
    }
  ],
  redesign: [
    {
      name: "HITL Review",
      url: "/workspace/redesign/review",
      icon: (
        <EyeIcon
        />
      ),
    },
    {
      name: "Correction",
      url: "/workspace/redesign/correction",
      icon: (
        <Wand2Icon
        />
      ),
    }
  ],
  distribution: [
    {
      name: "Timeline",
      url: "/workspace/distribution/timeline",
      icon: (
        <FilmIcon
        />
      ),
    },
    {
      name: "Export",
      url: "/workspace/distribution/export",
      icon: (
        <UploadCloudIcon
        />
      ),
    }
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ProjectSwitcher projects={data.projects} />
      </SidebarHeader>
      <SidebarContent>
        <NavDesign items={data.design} />
        <NavGeneration generation={data.generation} />
        <NavRedesign redesign={data.redesign} />
        <NavDistribution distribution={data.distribution} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
