"use client"

import * as React from "react"
import { useTranslation } from "@/components/i18n/translation-provider"

import { NavDesign } from "@/app/[locale]/workspace/[projectId]/nav-design"
import { NavGeneration } from "@/app/[locale]/workspace/[projectId]/nav-generation"
import { NavRedesign } from "@/app/[locale]/workspace/[projectId]/nav-redesign"
import { NavDistribution } from "@/app/[locale]/workspace/[projectId]/nav-distribution"
import { NavUser } from "@/components/nav-user"
import { ProjectSwitcher } from "@/app/[locale]/workspace/[projectId]/project-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { GalleryVerticalEndIcon, AudioLinesIcon, TerminalIcon, PencilIcon, LayoutTemplateIcon, DatabaseIcon, ClapperboardIcon, ActivityIcon, EyeIcon, Wand2Icon, FilmIcon, UploadCloudIcon, PaletteIcon } from "lucide-react"
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
      id: "318b76e2-2a5b-4b13-011b-26514e2d307b",
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
      title: "Breakdown",
      url: "/design/breakdown",
      icon: (
        <ClapperboardIcon
        />
      ),
    },
    {
      title: "Style",
      url: "/design/style",
      icon: (
        <PaletteIcon
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
  ],
  generation: [
    {
      name: "Voiceover",
      url: "/generation/voiceover",
      icon: (
        <AudioLinesIcon
        />
      ),
    },
    {
      name: "Keyframe Gen",
      url: "/generation/keyframes",
      icon: (
        <ClapperboardIcon
        />
      ),
    },
    {
      name: "Video Gen",
      url: "/generation/video",
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
  const { t, locale } = useTranslation()

  const designItems = [
    {
      title: t("workspace.script", "Script"),
      url: `/${locale}/workspace/${projectId}/design/script`,
      icon: <PencilIcon />,
    },
    {
      title: t("workspace.breakdown", "Breakdown"),
      url: `/${locale}/workspace/${projectId}/design/breakdown`,
      icon: <ClapperboardIcon />,
    },
    {
      title: t("workspace.style", "Style"),
      url: `/${locale}/workspace/${projectId}/design/style`,
      icon: <PaletteIcon />,
    },
    {
      title: t("workspace.storyboard", "Storyboard"),
      url: `/${locale}/workspace/${projectId}/design/storyboard`,
      icon: <LayoutTemplateIcon />,
    },
  ]

  const generationItems = [
    {
      name: t("workspace.voiceover", "Voiceover"),
      url: `/${locale}/workspace/${projectId}/generation/voiceover`,
      icon: <AudioLinesIcon />,
    },
    {
      name: t("workspace.keyframes", "Keyframe Gen"),
      url: `/${locale}/workspace/${projectId}/generation/keyframes`,
      icon: <ClapperboardIcon />,
    },
    {
      name: t("workspace.video", "Video Gen"),
      url: `/${locale}/workspace/${projectId}/generation/video`,
      icon: <ActivityIcon />,
    },
  ]

  const redesignItems = [
    {
      name: t("workspace.review", "HITL Review"),
      url: `/${locale}/workspace/${projectId}/redesign/review`,
      icon: <EyeIcon />,
    },
    {
      name: t("workspace.correction", "Correction"),
      url: `/${locale}/workspace/${projectId}/redesign/correction`,
      icon: <Wand2Icon />,
    },
  ]

  const distributionItems = [
    {
      name: t("workspace.timeline", "Timeline"),
      url: `/${locale}/workspace/${projectId}/distribution/timeline`,
      icon: <FilmIcon />,
    },
    {
      name: t("workspace.export", "Export"),
      url: `/${locale}/workspace/${projectId}/distribution/export`,
      icon: <UploadCloudIcon />,
    },
  ]

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
