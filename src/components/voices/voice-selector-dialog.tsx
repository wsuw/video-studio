"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Play, Pause, Globe, ChevronDown, RotateCcw,
  Volume2, CheckCircle2, Loader2, X, Mic, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

export interface Voice {
  id: string;
  name: string;
  locale: string;
  gender: string;
  ageGroup: string;
  description: string;
  sampleUrl: string;
}

interface VoiceSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVoiceUrl: string | null;
  onSelect: (voice: Voice) => void;
}

export function VoiceSelectorDialog({
  isOpen,
  onOpenChange,
  selectedVoiceUrl,
  onSelect
}: VoiceSelectorDialogProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [selectedLocale, setSelectedLocale] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(24);

  // --- SAMPLE AUDIO PLAYER ---
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch voices list from API on mount/open
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);
    fetch("/api/voices")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setVoices(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load voices catalog:", err);
        setError("Failed to load the local voices database.");
        setIsLoading(false);
      });
  }, [isOpen]);

  // Audio player cleanup
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleEnded = () => {
      setPlayingId(null);
    };
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const getAudioSrc = (sampleUrl: string) => {
    if (sampleUrl.startsWith("examples/") || sampleUrl.startsWith("presets/")) {
      return `/api/preview-voice?path=${encodeURIComponent(sampleUrl)}`;
    }
    const filename = sampleUrl.split("/").pop();
    return `/api/speech-samples/${filename}`;
  };

  const togglePlay = (voice: Voice) => {
    const audioSrc = getAudioSrc(voice.sampleUrl);

    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioSrc;
        audioRef.current.play().catch((err) => console.error("Playback failed", err));
        setPlayingId(voice.id);
      }
    }
  };

  // --- LOCALE INFO HELPERS ---
  const getLocaleInfo = (code: string): { flag: string; name: string } => {
    const special: { [key: string]: { flag: string; name: string } } = {
      "zh-CN": { flag: "🇨🇳", name: "Chinese (Mandarin)" },
      "zh-HK": { flag: "🇭🇰", name: "Chinese (Cantonese HK)" },
      "zh-TW": { flag: "🇹🇼", name: "Chinese (Taiwanese)" },
      "wuu-CN": { flag: "🇨🇳", name: "Wu Chinese (Shanghainese)" },
      "yue-CN": { flag: "🇨🇳", name: "Cantonese (Mainland)" },
      "en-US": { flag: "🇺🇸", name: "English (US)" },
      "en-GB": { flag: "🇬🇧", name: "English (UK)" },
      "ja-JP": { flag: "🇯🇵", name: "Japanese" },
      "ko-KR": { flag: "🇰🇷", name: "Korean" },
      "de-DE": { flag: "🇩🇪", name: "German" },
      "fr-FR": { flag: "🇫🇷", name: "French" },
      "es-ES": { flag: "🇪🇸", name: "Spanish (Spain)" },
      "es-MX": { flag: "🇲🇽", name: "Spanish (Mexico)" },
      "en-AU": { flag: "🇦🇺", name: "English (Australia)" },
      "en-IN": { flag: "🇮🇳", name: "English (India)" },
      "pt-BR": { flag: "🇧🇷", name: "Portuguese (Brazil)" },
      "ru-RU": { flag: "🇷🇺", name: "Russian" },
    };
    if (code in special) return special[code];
    const parts = code.split("-");
    return {
      flag: "🌐",
      name: `${parts[0].toUpperCase()}-${parts[1]?.toUpperCase() || ""}`
    };
  };

  const getLocalePriority = (locale: string): number => {
    const l = locale.toLowerCase();
    if (l.startsWith("zh") || l.startsWith("yue") || l.startsWith("wuu")) return 100;
    if (l.startsWith("en")) return 90;
    if (l === "ja-jp" || l === "ko-kr") return 80;
    if (l === "de-de" || l === "fr-fr" || l.startsWith("es") || l.startsWith("pt") || l === "ru-ru") return 70;
    return 0;
  };

  // --- DYNAMIC FILTERS ---
  const localesWithCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    voices.forEach((v) => {
      counts[v.locale] = (counts[v.locale] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([code, count]) => {
        const info = getLocaleInfo(code);
        return { code, count, label: `${info.flag} ${info.name}` };
      })
      .sort((a, b) => {
        const priorityA = getLocalePriority(a.code);
        const priorityB = getLocalePriority(b.code);
        if (priorityA !== priorityB) return priorityB - priorityA;
        if (b.count !== a.count) return b.count - a.count;
        return a.code.localeCompare(b.code);
      });
  }, [voices]);

  const filteredVoices = useMemo(() => {
    const filtered = voices.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.locale.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGender =
        selectedGender === "all" || v.gender.toLowerCase() === selectedGender.toLowerCase();
      const matchesAge =
        selectedAge === "all" || v.ageGroup.toLowerCase() === selectedAge.toLowerCase();
      const matchesLocale =
        selectedLocale === "all" || v.locale === selectedLocale;

      return matchesSearch && matchesGender && matchesAge && matchesLocale;
    });

    return [...filtered].sort((a, b) => {
      const priorityA = getLocalePriority(a.locale);
      const priorityB = getLocalePriority(b.locale);
      if (priorityA !== priorityB) return priorityB - priorityA;
      const localeCompare = a.locale.localeCompare(b.locale);
      if (localeCompare !== 0) return localeCompare;
      return a.name.localeCompare(b.name);
    });
  }, [voices, searchQuery, selectedGender, selectedAge, selectedLocale]);

  useEffect(() => {
    setVisibleCount(24);
  }, [searchQuery, selectedGender, selectedAge, selectedLocale]);

  const displayedVoices = useMemo(() => {
    return filteredVoices.slice(0, visibleCount);
  }, [filteredVoices, visibleCount]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedGender("all");
    setSelectedAge("all");
    setSelectedLocale("all");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl lg:max-w-7xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="mb-4 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Mic className="w-5.5 h-5.5 text-primary" />
            Neural Voice Catalog (全量声线库)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Explore and select high-fidelity neural voices across 150+ regions. Click a card to instantly select.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Toolbar */}
        <div className="space-y-3 mb-4 shrink-0 bg-muted/40 p-4 rounded-xl border border-border/40">
          {/* Row 1: Search & Language dropdown */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search voice by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full bg-background"
              />
            </div>

            <div className="relative min-w-[240px]">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={selectedLocale}
                onChange={(e) => setSelectedLocale(e.target.value)}
                className="h-9 w-full pl-9 pr-8 bg-background border rounded-md text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer appearance-none"
              >
                <option value="all">🌐 All Languages ({localesWithCounts.length} locales)</option>
                {localesWithCounts.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label} ({loc.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Gender & Age Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              {/* Gender toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Gender:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-background border text-[11px]">
                  {["all", "female", "male"].map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setSelectedGender(gender)}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-all capitalize ${
                        selectedGender === gender
                          ? "bg-muted text-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {gender === "all" ? "All" : gender === "female" ? "👩 Female" : "👨 Male"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Age:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-background border text-[11px]">
                  {["all", "adult", "child", "senior"].map((age) => (
                    <button
                      key={age}
                      onClick={() => setSelectedAge(age)}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-all capitalize ${
                        selectedAge === age
                          ? "bg-muted text-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {age === "all" ? "All" : age}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(searchQuery || selectedGender !== "all" || selectedAge !== "all" || selectedLocale !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-[10px] font-bold h-7 text-primary hover:bg-primary/10"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic List Count info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-2 shrink-0">
          <span>
            Matched <strong className="text-primary font-bold">{filteredVoices.length}</strong> voice{filteredVoices.length !== 1 ? "s" : ""}
          </span>
          {filteredVoices.length !== voices.length && <span>(of {voices.length} total)</span>}
        </div>

        {/* Grid and Scroll Container */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-xs text-muted-foreground font-medium">Loading voice libraries...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-xl bg-destructive/5 border-destructive/20">
              <AlertCircle className="w-8 h-8 text-destructive mb-2" />
              <p className="text-sm font-bold text-destructive">{error}</p>
            </div>
          ) : displayedVoices.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedVoices.map((voice) => {
                  const isSelected = selectedVoiceUrl === voice.sampleUrl;
                  const isPlaying = playingId === voice.id;

                  return (
                    <Card
                      key={voice.id}
                      onClick={() => {
                        onSelect(voice);
                        onOpenChange(false); // Auto close
                      }}
                      className={`group relative p-4 bg-card text-card-foreground border rounded-xl flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 shadow-md bg-primary/5"
                          : isPlaying
                          ? "border-primary ring-1 ring-primary shadow-sm"
                          : "hover:border-accent-foreground/20 hover:shadow-md"
                      }`}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          <CheckCircle2 className="w-3 h-3 text-primary" />
                          <span className="text-[9px] font-bold text-primary">Selected</span>
                        </div>
                      )}

                      {/* Visualizer animation when playing */}
                      {isPlaying && !isSelected && (
                        <div className="absolute top-3 right-3 flex items-center gap-0.5 h-3 px-1.5 bg-primary/10 border border-primary/20 rounded-full">
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_100ms] h-1.5" />
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_200ms] h-2.5" />
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_300ms] h-1" />
                        </div>
                      )}

                      <div>
                        {/* Locale metadata tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                          <span className="text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                            {voice.locale}
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10">
                            {getLocaleInfo(voice.locale).name}
                          </span>
                        </div>

                        {/* Voice Actor Name */}
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[80%] mb-1.5">
                          {voice.name}
                        </h3>

                        {/* Gender and Age tags */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${voice.gender.toLowerCase() === "female"
                            ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          }`}>
                            {voice.gender === "Female" ? "👩 Female" : "👨 Male"}
                          </span>
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-muted border text-muted-foreground">
                            {voice.ageGroup === "Child" ? "👶 " : ""}{voice.ageGroup === "Adult" ? "Adult" : voice.ageGroup === "Child" ? "Child" : "Senior"}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3 mb-4 min-h-[54px]">
                          {voice.description || "No description available for this voice."}
                        </p>
                      </div>

                      {/* Play Preview Audition Footer */}
                      <div className="pt-3 border-t border-muted/80" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => togglePlay(voice)}
                            size="sm"
                            variant={isPlaying ? "destructive" : "default"}
                            className="flex-1 text-xs font-semibold rounded-lg h-9 cursor-pointer"
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 mr-1" />
                                Stop Preview
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                                Preview
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Load More Button */}
              {filteredVoices.length > visibleCount && (
                <div className="flex justify-center mt-3 pb-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((prev) => prev + 24)}
                    className="px-6 h-8 text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    Load More Voices
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-muted/15">
              <Mic className="w-10 h-10 text-muted-foreground/35 mb-2 animate-pulse" />
              <p className="text-xs font-semibold text-muted-foreground">No matching voices found</p>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 text-[10px] font-bold">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
