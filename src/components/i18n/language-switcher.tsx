"use client";

import { useState } from "react";
import { Languages, ChevronDown } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/components/i18n/translation-provider";

interface LanguageSwitcherProps {
  className?: string;
  isDark?: boolean;
}

export function LanguageSwitcher({ className = "", isDark = true }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useTranslation();

  const handleLanguageChange = (newLocale: string) => {
    const segments = pathname.split("/");
    // Under i18n middleware, the first segment after / is always the locale
    segments[1] = newLocale;
    const newPath = segments.join("/");
    router.push(newPath);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-300 ${
          isDark
            ? "border-white/10 hover:border-white/20 text-white/80 hover:text-white bg-white/5 hover:bg-white/10"
            : "border-foreground/10 hover:border-foreground/20 text-foreground/80 hover:text-foreground bg-foreground/5 hover:bg-foreground/10"
        }`}
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{locale === "en" ? "EN" : "中文"}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Transparent click overlay to close the dropdown */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={`absolute right-0 mt-2 w-32 rounded-xl border p-1.5 shadow-2xl backdrop-blur-xl z-50 transition-all duration-300 ${
              isDark
                ? "bg-black/90 border-white/10 text-white"
                : "bg-white/90 border-foreground/10 text-foreground"
            }`}
          >
            <button
              onClick={() => handleLanguageChange("en")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-200 ${
                locale === "en"
                  ? isDark ? "bg-white/10 font-semibold text-white" : "bg-foreground/10 font-semibold text-foreground"
                  : isDark ? "text-white/70 hover:bg-white/5 hover:text-white" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageChange("zh")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors duration-200 ${
                locale === "zh"
                  ? isDark ? "bg-white/10 font-semibold text-white" : "bg-foreground/10 font-semibold text-foreground"
                  : isDark ? "text-white/70 hover:bg-white/5 hover:text-white" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              简体中文
            </button>
          </div>
        </>
      )}
    </div>
  );
}
