"use client"

import Link from "next/link"
import { useTranslation } from "@/components/i18n/translation-provider"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, FolderIcon, ArrowRightIcon, Trash2Icon } from "lucide-react"

export function NavRedesign({
    redesign,
}: {
    redesign: {
        name: string
        url: string
        icon: React.ReactNode
    }[]
}) {
    const { isMobile } = useSidebar()
    const { t } = useTranslation()

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>{t("workspace.redesign", "Redesign")}</SidebarGroupLabel>
            <SidebarMenu>
                {redesign.map((item) => (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild>
                            <Link href={item.url}>
                                {item.icon}
                                <span>{item.name}</span>
                            </Link>
                        </SidebarMenuButton>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuAction
                                    showOnHover
                                    className="aria-expanded:bg-muted"
                                >
                                    <MoreHorizontalIcon
                                    />
                                    <span className="sr-only">{t("workspace.more", "More")}</span>
                                </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-48 rounded-lg"
                                side={isMobile ? "bottom" : "right"}
                                align={isMobile ? "end" : "start"}
                            >
                                <DropdownMenuItem>
                                    <FolderIcon className="text-muted-foreground" />
                                    <span>{t("workspace.viewProject", "View Project")}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <ArrowRightIcon className="text-muted-foreground" />
                                    <span>{t("workspace.shareProject", "Share Project")}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <Trash2Icon className="text-muted-foreground" />
                                    <span>{t("workspace.deleteProject", "Delete Project")}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    )
}
