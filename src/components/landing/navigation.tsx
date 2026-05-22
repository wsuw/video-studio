"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/components/i18n/translation-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useTranslation();

  const navLinks = [
    { name: t("nav.features", "Features"), href: "#features" },
    { name: t("nav.workflow", "Workflow"), href: "#how-it-works" },
    { name: t("nav.infra", "Render Cloud"), href: "#infra" },
    { name: t("nav.integrations", "Integrations"), href: "#integrations" },
    { name: t("nav.security", "Brand Safety"), href: "#security" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale; // Replace current locale segment (e.g. segments[1] is 'en' or 'zh')
    const newPath = segments.join("/");
    router.push(newPath);
  };

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${isScrolled
          ? "top-4 left-4 right-4"
          : "top-0 left-0 right-0"
        }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
          }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${isScrolled ? "h-14" : "h-20"
            }`}
        >
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl text-foreground" : "text-2xl text-white"}`}>VIDEOAGENT</span>
            <span className={`font-mono transition-all duration-500 ${isScrolled ? "text-[10px] mt-0.5 text-muted-foreground" : "text-xs mt-1 text-white/60"}`}>™</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={`text-sm transition-colors duration-300 relative group ${isScrolled ? "text-foreground/70 hover:text-foreground" : "text-white/70 hover:text-white"}`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full ${isScrolled ? "bg-foreground" : "bg-white"}`} />
              </a>
            ))}
          </div>

          {/* Desktop CTA & Language Switcher */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher isDark={!isScrolled} />

            <a href={`/${locale}/login`} className={`transition-all duration-500 ${isScrolled ? "text-xs text-foreground/70 hover:text-foreground" : "text-sm text-white/70 hover:text-white"}`}>
              {t("nav.signin", "Sign in")}
            </a>
            <a href={`/${locale}/studio`}>
              <Button
                size="sm"
                className={`rounded-full transition-all duration-500 ${isScrolled ? "bg-foreground hover:bg-foreground/90 text-background px-4 h-8 text-xs" : "bg-white hover:bg-white/90 text-black px-6"}`}
              >
                {t("nav.launch", "Launch Studio")}
              </Button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 transition-colors duration-500 ${isScrolled || isMobileMenuOpen ? "text-foreground" : "text-white"}`}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

      </nav>

      {/* Mobile Menu - Full Screen Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
          }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          {/* Navigation Links */}
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-5xl font-display text-foreground hover:text-muted-foreground transition-all duration-500 ${isMobileMenuOpen
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                  }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}

            {/* Mobile Language Toggle */}
            <div
              className={`flex items-center gap-4 mt-4 transition-all duration-500 ${isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${navLinks.length * 75}ms` : "0ms" }}
            >
              <Button
                variant={locale === "en" ? "default" : "outline"}
                onClick={() => handleLanguageChange("en")}
                className="rounded-full flex-1"
              >
                English
              </Button>
              <Button
                variant={locale === "zh" ? "default" : "outline"}
                onClick={() => handleLanguageChange("zh")}
                className="rounded-full flex-1"
              >
                简体中文
              </Button>
            </div>
          </div>

          {/* Bottom CTAs */}
          <div className={`flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500 ${isMobileMenuOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "350ms" : "0ms" }}
          >
            <a href={`/${locale}/login`} className="flex-1" onClick={() => setIsMobileMenuOpen(false)}>
              <Button
                variant="outline"
                className="w-full rounded-full h-14 text-base"
              >
                {t("nav.signin", "Sign in")}
              </Button>
            </a>
            <a href={`/${locale}/studio`} className="flex-1" onClick={() => setIsMobileMenuOpen(false)}>
              <Button
                className="w-full bg-foreground text-background rounded-full h-14 text-base"
              >
                {t("nav.launch", "Launch Studio")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
