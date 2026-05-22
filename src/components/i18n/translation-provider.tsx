"use client";

import React, { createContext, useContext } from "react";

const TranslationContext = createContext<{
  t: (key: string, defaultValue?: string) => string;
  locale: string;
} | null>(null);

export function TranslationProvider({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: any;
  locale: string;
}) {
  const t = (key: string, defaultValue?: string): string => {
    const keys = key.split(".");
    let value = dictionary;
    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        return defaultValue || key;
      }
    }
    return typeof value === "string" ? value : (defaultValue || key);
  };

  return (
    <TranslationContext.Provider value={{ t, locale }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}
