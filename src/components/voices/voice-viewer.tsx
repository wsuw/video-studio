"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, Play, Pause, Download, Volume2, Globe,
  ChevronDown, RotateCcw, Music, Sparkles, Wand2,
  CheckCircle2, Loader2, X, Mic, Zap, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface Voice {
  id: string;
  name: string;
  locale: string;
  gender: string;
  ageGroup: string;
  description: string;
  sampleUrl: string;
}

interface VoiceViewerProps {
  initialVoices: Voice[];
}


export function VoiceViewer({ initialVoices }: VoiceViewerProps) {
  // --- FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [selectedLocale, setSelectedLocale] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(24);

  // --- SELECTED VOICE (for synthesis panel) ---
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);

  // --- SAMPLE AUDIO PLAYER ---
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [id: string]: number }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingIdRef = useRef<string | null>(null);

  // --- SYNTHESIS PANEL STATE ---
  const [synthText, setSynthText] = useState("Hello! This is a test of the voice synthesis system. How does it sound?");
  const [synthStatus, setSynthStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [synthError, setSynthError] = useState<string | null>(null);
  const [synthAudioUrl, setSynthAudioUrl] = useState<string | null>(null);
  const [synthPlaying, setSynthPlaying] = useState(false);
  const synthAudioRef = useRef<HTMLAudioElement | null>(null);
  const [useEmoText, setUseEmoText] = useState(false);
  const [emoText, setEmoText] = useState("");
  const [emoAlpha, setEmoAlpha] = useState(0.8);

  // Sync playingId to ref for event handlers
  useEffect(() => {
    playingIdRef.current = playingId;
  }, [playingId]);

  // --- SAMPLE AUDIO SETUP ---
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const currentId = playingIdRef.current;
      if (currentId) {
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(prev => ({ ...prev, [currentId]: isNaN(progress) ? 0 : progress }));
      }
    };

    const handleEnded = () => {
      const currentId = playingIdRef.current;
      if (currentId) {
        setAudioProgress(prev => ({ ...prev, [currentId]: 0 }));
        setPlayingId(null);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!playingId) setAudioProgress({});
  }, [playingId]);

  const togglePlay = (voice: Voice) => {
    const filename = voice.sampleUrl.split("/").pop();
    const audioSrc = `/api/speech-samples/${filename}`;

    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audioSrc;
        audioRef.current.play().catch(err => console.error("Playback failed", err));
        setPlayingId(voice.id);
      }
    }
  };

  // --- SELECT VOICE FOR SYNTHESIS ---
  const handleSelectVoice = (voice: Voice) => {
    setSelectedVoice(voice);
    setSynthStatus("idle");
    setSynthAudioUrl(null);
    setSynthError(null);
    setSynthPlaying(false);
    synthAudioRef.current?.pause();
  };

  // --- SYNTHESIS ---
  const handleSynthesize = async () => {
    if (!selectedVoice || !synthText.trim()) return;

    setSynthStatus("loading");
    setSynthError(null);
    setSynthAudioUrl(null);
    setSynthPlaying(false);
    synthAudioRef.current?.pause();

    const filename = selectedVoice.sampleUrl.split("/").pop();
    // Map sample URL to a local file path that IndexTTS2 can resolve
    const spkPath = `speech-samples/${filename}`;

    const body: Record<string, unknown> = {
      text: synthText,
      spk_audio_prompt: spkPath,
      emo_alpha: emoAlpha,
      use_emo_text: useEmoText,
      use_random: false,
      interval_silence: 200,
      sceneId: "preview",
    };
    if (useEmoText && emoText.trim()) {
      body.emo_text = emoText;
    }

    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.error || data.status !== "success") {
        throw new Error(data.error || "Audio synthesis failed");
      }

      setSynthAudioUrl(data.url);
      setSynthStatus("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to synthesize voiceover with local model server";
      setSynthError(message);
      setSynthStatus("error");
    }
  };

  // --- SYNTH AUDIO PLAYBACK ---
  const toggleSynthPlay = () => {
    if (!synthAudioUrl) return;
    if (!synthAudioRef.current) {
      synthAudioRef.current = new Audio(synthAudioUrl);
      synthAudioRef.current.onended = () => setSynthPlaying(false);
    }
    if (synthPlaying) {
      synthAudioRef.current.pause();
      setSynthPlaying(false);
    } else {
      synthAudioRef.current.src = synthAudioUrl;
      synthAudioRef.current.play().catch(() => setSynthPlaying(false));
      setSynthPlaying(true);
    }
  };

  // --- LANG RESOLVER ---
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

  // --- LANG PRIORITY RESOLVER ---
  const getLocalePriority = (locale: string): number => {
    const l = locale.toLowerCase();
    
    // 1. English & Chinese -> Highest Priority
    if (l.startsWith("zh") || l.startsWith("yue") || l.startsWith("wuu")) return 100;
    if (l.startsWith("en")) return 90;
    
    // 2. Other common major languages -> Medium-High Priority
    if (l === "ja-jp") return 80;
    if (l === "ko-kr") return 80;
    
    // 3. European & major American languages -> Medium Priority
    if (l === "de-de") return 70;
    if (l === "fr-fr") return 70;
    if (l.startsWith("es")) return 70;
    if (l.startsWith("pt")) return 70;
    if (l === "ru-ru") return 70;
    
    // 4. Other languages -> Low Priority
    return 0;
  };

  // --- DYNAMIC OPTION LISTS ---
  const localesWithCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    initialVoices.forEach(v => { counts[v.locale] = (counts[v.locale] || 0) + 1; });
    return Object.entries(counts)
      .map(([code, count]) => {
        const info = getLocaleInfo(code);
        return { code, count, label: `${info.flag} ${info.name}` };
      })
      .sort((a, b) => {
        const priorityA = getLocalePriority(a.code);
        const priorityB = getLocalePriority(b.code);
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        if (b.count !== a.count) {
          return b.count - a.count; // Sort by voice count descending
        }
        return a.code.localeCompare(b.code); // Stable alphabetical sort
      });
  }, [initialVoices]);

  // --- STATISTICS ---
  const stats = useMemo(() => {
    const total = initialVoices.length;
    let female = 0, male = 0;
    initialVoices.forEach(v => {
      if (v.gender.toLowerCase() === "female") female++;
      if (v.gender.toLowerCase() === "male") male++;
    });
    return { total, female, male };
  }, [initialVoices]);

  // --- FILTERING & SORTING LOGIC ---
  const filteredVoices = useMemo(() => {
    const filtered = initialVoices.filter(v => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.locale.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGender = selectedGender === "all" || v.gender.toLowerCase() === selectedGender.toLowerCase();
      const matchesAge = selectedAge === "all" || v.ageGroup.toLowerCase() === selectedAge.toLowerCase();
      const matchesLocale = selectedLocale === "all" || v.locale === selectedLocale;

      return matchesSearch && matchesGender && matchesAge && matchesLocale;
    });

    return [...filtered].sort((a, b) => {
      const priorityA = getLocalePriority(a.locale);
      const priorityB = getLocalePriority(b.locale);
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }
      const localeCompare = a.locale.localeCompare(b.locale);
      if (localeCompare !== 0) {
        return localeCompare; // Group by locale code alphabetically
      }
      return a.name.localeCompare(b.name); // Sort by voice name alphabetically
    });
  }, [initialVoices, searchQuery, selectedGender, selectedAge, selectedLocale]);

  useEffect(() => { setVisibleCount(24); }, [searchQuery, selectedGender, selectedAge, selectedLocale]);

  const displayedVoices = useMemo(() => filteredVoices.slice(0, visibleCount), [filteredVoices, visibleCount]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedGender("all");
    setSelectedAge("all");
    setSelectedLocale("all");
  };

  return (
    <div className="w-full space-y-6">
      {/* HEADER & STATISTICS ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Volume2 className="h-6 w-6 text-primary" />
            Neural Voice Control Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore {stats.total} high-fidelity neural voices across 150+ languages and locales.
          </p>
        </div>

        {/* STATS CHIPS */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg border">
            <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Total Voices: <span className="font-bold text-foreground">{stats.total}</span></span>
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg border">
            <span>👩</span>
            <span>Female: <span className="font-bold text-foreground">{stats.female}</span></span>
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-lg border">
            <span>👨</span>
            <span>Male: <span className="font-bold text-foreground">{stats.male}</span></span>
          </Badge>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="flex flex-col gap-4">
        {/* ROW 1: Search & Locale Select */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, description or language tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>

          <div className="relative min-w-[260px]">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              className="h-10 w-full pl-9 pr-8 bg-background border rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer appearance-none"
            >
              <option value="all">🌐 All Languages & Regions ({localesWithCounts.length} locales)</option>
              {localesWithCounts.map(loc => (
                <option key={loc.code} value={loc.code}>
                  {loc.label} ({loc.count})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* ROW 2: Gender / Age / Reset */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-muted/40 border rounded-lg">
          <div className="flex flex-wrap items-center gap-6">
            {/* Gender switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Gender:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-muted border">
                {["all", "female", "male"].map(gender => (
                  <button
                    key={gender}
                    onClick={() => setSelectedGender(gender)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${selectedGender === gender
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {gender === "all" ? "All" : gender === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Age group selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Age:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-muted border">
                {["all", "adult", "child", "senior"].map(age => (
                  <button
                    key={age}
                    onClick={() => setSelectedAge(age)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${selectedAge === age
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {age === "all" ? "All" : age === "adult" ? "Adult" : age === "child" ? "Child" : "Senior"}
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
              className="text-xs font-semibold h-8 text-primary hover:text-primary hover:bg-primary/10"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* RESULTS METADATA BAR */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing <strong className="text-primary font-bold">{filteredVoices.length}</strong> neural voice{filteredVoices.length !== 1 ? "s" : ""}
          </span>
          {filteredVoices.length !== initialVoices.length && (
            <span>(of {initialVoices.length} total)</span>
          )}
        </div>
      </div>

      {/* MAIN: VOICE GRID + SYNTHESIS PANEL */}
      <div className="flex gap-6 items-start">
        {/* LEFT: VOICE GRID */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {displayedVoices.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedVoices.map((voice) => {
                  const isPlaying = playingId === voice.id;
                  const isSelected = selectedVoice?.id === voice.id;
                  const progress = audioProgress[voice.id] || 0;

                  return (
                    <Card
                      key={voice.id}
                      onClick={() => handleSelectVoice(voice)}
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

                      {/* CONTROLS */}
                      <div className="pt-3 border-t border-muted/80" onClick={(e) => e.stopPropagation()}>
                        {/* Progress bar */}
                        <div className="w-full bg-secondary h-1 rounded-full mb-3 overflow-hidden relative">
                          <div
                            className="bg-primary h-full transition-all duration-100 ease-linear rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Play/Pause Sample */}
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

                          {/* Download button */}
                          <Button
                            asChild
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-lg cursor-pointer"
                          >
                            <a
                              href={`/api/speech-samples/${voice.sampleUrl.split("/").pop()}`}
                              download={`${voice.locale}_${voice.name}.wav`}
                              title="Download high-fidelity WAV sample"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* LOAD MORE */}
              {filteredVoices.length > visibleCount && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount(prev => prev + 24)}
                    className="px-6 h-10 text-xs font-semibold flex items-center gap-1.5 rounded-lg shadow-sm group cursor-pointer"
                  >
                    Load More Voices
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* NO MATCHED RESULTS */
            <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl bg-muted/10">
              <Music className="w-12 h-12 text-muted-foreground mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-foreground mb-1">No voices found</h3>
              <p className="text-muted-foreground text-xs max-w-sm text-center px-4">
                Try a shorter search term, or reset the age, gender, and language filters to explore all voices.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-5 text-xs font-semibold rounded-lg"
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT: SYNTHESIS PANEL (sticky) */}
        <div className="w-[340px] shrink-0 sticky top-4">
          {selectedVoice ? (
            <Card className="border border-border/80 rounded-2xl overflow-hidden shadow-lg bg-card">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-indigo-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-none">Voice Synthesis</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">AI Voice Clone · Zero-Shot</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedVoice(null); setSynthAudioUrl(null); setSynthStatus("idle"); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Selected Voice Info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    selectedVoice.gender.toLowerCase() === "female"
                      ? "bg-pink-500/10 text-pink-500 border border-pink-500/20"
                      : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  }`}>
                    {selectedVoice.gender === "Female" ? "👩" : "👨"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{selectedVoice.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{getLocaleInfo(selectedVoice.locale).name}</p>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border text-muted-foreground shrink-0">
                    {selectedVoice.locale}
                  </span>
                </div>

                {/* Text to Synthesize */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Text to Synthesize
                  </label>
                  <Textarea
                    value={synthText}
                    onChange={(e) => setSynthText(e.target.value)}
                    placeholder="Enter text to synthesize with this voice..."
                    className="resize-none min-h-[100px] text-sm bg-background border-border/80 focus-visible:ring-primary/20 rounded-xl"
                    rows={4}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{synthText.length} chars</p>
                </div>

                {/* Emotion Mode Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      Emotion Guidance
                    </label>
                    <button
                      onClick={() => setUseEmoText(!useEmoText)}
                      className={`relative w-9 h-5 rounded-full transition-all duration-200 border ${
                        useEmoText
                          ? "bg-primary border-primary"
                          : "bg-muted border-border"
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        useEmoText ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  {useEmoText && (
                    <div className="space-y-3 pt-1 pl-1 border-l-2 border-primary/20">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Emotion Description
                        </label>
                        <Input
                          value={emoText}
                          onChange={(e) => setEmoText(e.target.value)}
                          placeholder="e.g. Excited and full of energy!"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Emotion Strength
                          </label>
                          <span className="text-[10px] font-bold text-primary">{emoAlpha.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min={0} max={1} step={0.1}
                          value={emoAlpha}
                          onChange={(e) => setEmoAlpha(parseFloat(e.target.value))}
                          className="w-full h-1.5 accent-primary cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>Subtle</span>
                          <span>Strong</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="opacity-50" />

                {/* Synthesize Button */}
                <Button
                  onClick={handleSynthesize}
                  disabled={synthStatus === "loading" || !synthText.trim()}
                  className="w-full h-10 font-bold text-sm rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-md transition-all"
                >
                  {synthStatus === "loading" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Synthesize Audio
                    </>
                  )}
                </Button>

                {/* Result Area */}
                {synthStatus === "success" && synthAudioUrl && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Synthesis Complete!</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={toggleSynthPlay}
                        size="sm"
                        variant={synthPlaying ? "destructive" : "default"}
                        className="flex-1 h-9 text-xs font-bold rounded-lg"
                      >
                        {synthPlaying ? (
                          <><Pause className="w-3.5 h-3.5 mr-1.5" />Stop</>
                        ) : (
                          <><Play className="w-3.5 h-3.5 mr-1.5 fill-current" />Play Result</>
                        )}
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-lg border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        <a href={synthAudioUrl} download={`synth_${selectedVoice.name}.wav`} title="Download synthesized audio">
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      </Button>
                    </div>
                  </div>
                )}

                {synthStatus === "error" && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-destructive mb-1">Synthesis Failed</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{synthError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </Card>
          ) : (
            /* Empty State — No Voice Selected */
            <Card className="border border-dashed border-border/60 rounded-2xl bg-muted/5">
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center mb-1">
                  <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Select a Voice</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  Click any voice card on the left to open the AI synthesis workstation
                </p>
                <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">AI Voice Clone · Zero-Shot</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
