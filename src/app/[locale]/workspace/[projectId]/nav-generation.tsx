"use client"

import Link from "next/link"
import { useTranslation } from "@/components/i18n/translation-provider"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavGeneration({
  generation,
}: {
  generation: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const { t } = useTranslation()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t("workspace.generation", "Generation")}</SidebarGroupLabel>
      <SidebarMenu>
        {generation.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <Link href={item.url}>
                {item.icon}
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
