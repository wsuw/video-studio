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
import { GalleryVerticalEndIcon, AudioLinesIcon, TerminalIcon, TerminalSquareIcon, BotIcon, BookOpenIcon, Settings2Icon, FrameIcon, PieChartIcon, MapIcon } from "lucide-react"

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
      url: "#",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Storyboard",
      url: "#",
      icon: (
        <BotIcon
        />
      ),
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Assets",
      url: "#",
      icon: (
        <BookOpenIcon
        />
      ),
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
  ],
  generation: [
    {
      name: "Render Queue",
      url: "#",
      icon: (
        <FrameIcon
        />
      ),
    },
    {
      name: "Execution",
      url: "#",
      icon: (
        <PieChartIcon
        />
      ),
    }
  ],
  redesign: [
    {
      name: "HITL Review",
      url: "#",
      icon: (
        <FrameIcon
        />
      ),
    },
    {
      name: "Correction",
      url: "#",
      icon: (
        <PieChartIcon
        />
      ),
    }
  ],
  distribution: [
    {
      name: "Timeline",
      url: "#",
      icon: (
        <FrameIcon
        />
      ),
    },
    {
      name: "Export",
      url: "#",
      icon: (
        <PieChartIcon
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
