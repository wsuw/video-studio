import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"

interface SiteHeaderProps {
  title?: string
}

export function SiteHeader({ title = "Studio" }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) w-full bg-background/50 backdrop-blur-md">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <h1 className="text-base font-medium">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher isDark={false} />
        </div>
      </div>
    </header>
  )
}
