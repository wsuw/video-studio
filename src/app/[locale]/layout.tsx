import { ThemeProvider } from "@/components/theme-provider"
import React from "react"
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { TooltipProvider } from "@/components/ui/tooltip"
import { getDictionary } from "@/app/dictionaries"
import { TranslationProvider } from "@/components/i18n/translation-provider"

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const metadata: Metadata = {
  title: 'VIDEOAGENT - AI Agents for Video Production',
  description: 'Deploy autonomous AI agents on distributed infrastructure to automate script, storyboard, voiceover, and render workflows.',
  generator: 'v0.app',
}

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh' }];
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale as 'en' | 'zh');

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <TooltipProvider>
            <TranslationProvider dictionary={dictionary} locale={locale}>
              {children}
            </TranslationProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
