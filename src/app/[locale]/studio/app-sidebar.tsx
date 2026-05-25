"use client"

import * as React from "react"
import { useTranslation } from "@/components/i18n/translation-provider"

import { NavDocuments } from "@/app/[locale]/studio/nav-documents"
import { NavMain } from "@/app/[locale]/studio/nav-main"
import { NavSecondary } from "@/app/[locale]/studio/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, ListIcon, ChartBarIcon, FolderIcon, UsersIcon, CameraIcon, FileTextIcon, Settings2Icon, CircleHelpIcon, SearchIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, CommandIcon, Volume2, Wand2 } from "lucide-react"

const data = {
  user: {
    name: "Guest",
    email: "guest@gmail.com",
    avatar: "https://ui.shadcn.com/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Projects",
      url: "/studio/projects",
      icon: (
        <FolderIcon
        />
      ),
    },
    {
      title: "Voice Library",
      url: "/studio/voices",
      icon: (
        <Volume2
        />
      ),
    },
    {
      title: "Playground",
      url: "/studio/playground",
      icon: (
        <Wand2
        />
      ),
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Get Help",
      url: "#",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t, locale } = useTranslation();

  const navMain = [
    {
      title: t("studio.projects", "Projects"),
      url: `/${locale}/studio/projects`,
      icon: <FolderIcon />,
    },
    {
      title: t("studio.voices", "Voice Library"),
      url: `/${locale}/studio/voices`,
      icon: <Volume2 />,
    },
    {
      title: t("studio.playground", "Playground"),
      url: `/${locale}/studio/playground`,
      icon: <Wand2 />,
    },
  ];

  const navSecondary = [
    {
      title: t("studio.settings", "Settings"),
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: t("studio.help", "Get Help"),
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: t("studio.search", "Search"),
      url: "#",
      icon: <SearchIcon />,
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href={`/${locale}/studio`}>
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Video Studio</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
