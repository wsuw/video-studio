"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AudioLinesIcon,
  Wand2Icon,
  PlayIcon,
  PauseIcon,
  Loader2Icon,
  SparklesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MessageSquareIcon,
  InfoIcon,
  Volume2Icon,
  ClockIcon,
  FilmIcon,
  CheckCircle2Icon,
  SaveIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { WorkspaceContext } from "@/app/[locale]/workspace/[projectId]/layout";
import React, { useState, useEffect, useRef } from "react";
import { usePhaseSync } from "@/hooks/use-phase-sync";
import { useRouter, useParams } from "next/navigation";
import { useAgent, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { cn } from "@/lib/utils";
import { getThreadState, updateThreadState } from "@/lib/langgraph";
import { PRESET_VOICES } from "@/lib/preset-voices";
import { VoiceSelectorDialog } from "@/components/voices/voice-selector-dialog";

// Presets mapping to 8-dimensional emotion vectors:
// [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
const EMOTION_PRESETS = [
  { id: "calm", name: "Calm / Professional", vector: [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9] },
  { id: "happy", name: "Cheerful / Excited", vector: [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.2] },
  { id: "sad", name: "Melancholic / Sad", vector: [0.0, 0.0, 0.8, 0.0, 0.0, 0.7, 0.0, 0.3] },
  { id: "angry", name: "Angry / Agitated", vector: [0.0, 0.9, 0.0, 0.1, 0.1, 0.0, 0.2, 0.0] },
  { id: "scared", name: "Afraid / Panicked", vector: [0.0, 0.0, 0.1, 0.8, 0.0, 0.3, 0.6, 0.0] },
];

const EMOTION_LABELS = [
  "Happy",
  "Angry",
  "Sad",
  "Afraid",
  "Disgusted",
  "Melancholic",
  "Surprised",
  "Calm",
];

interface DialogueTurn {
  speaker: string;
  text: string;
  emotion_preset?: string;
  emotion_alpha?: number;
  emotion_vector?: number[];
  emotion_text?: string;
  use_emotion_text?: boolean;
}

interface Scene {
  id: string;
  description: string;
  entities: string[];
  status: "pending" | "locked" | "rendered";
  dialogue?: string;
  dialogue_turns?: DialogueTurn[];
  voice_actor_id?: string; // "narrator" or e.g. "e1"
  audio_url?: string;
  audio_duration?: number;
}

interface Entity {
  id: string;
  name: string;
  type: "character" | "prop" | "location";
  description: string;
  visual_reference?: string;
  voice_reference?: string;
}

const formatTurnToString = (t: DialogueTurn) => {
  if (t.emotion_text) {
    return `${t.speaker} (${t.emotion_text}): ${t.text}`;
  }
  return `${t.speaker}: ${t.text}`;
};

function parseDialogueText(text: string, characterNames: string[]): DialogueTurn[] {
  if (!text) return [];
  
  const speakers = new Set(["NARRATOR", "SYSTEM", ...characterNames.map(n => n.toUpperCase())]);
  
  // Auto-detect "NAME: text" or "NAME (modifier): text"
  for (const m of text.matchAll(/(?:^|\s|\n)([A-Z0-9_\-\u4e00-\u9fa5]{2,})(?:\s*\([^)]*\))?\s*[:：]/g)) {
    speakers.add(m[1].toUpperCase());
  }

  const sorted = [...speakers].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
  
  // Regex to match: Speaker name, optional whitespace, optional parentheses, optional whitespace, colon
  const re = new RegExp(`(?:^|\\s|\\n)(${escaped.join("|")})\\s*(?:\\(([^)]*)\\))?\\s*[:：]\\s*`, "gi");

  const turns: DialogueTurn[] = [];
  let lastIndex = 0;
  let currentSpeaker = "NARRATOR";
  let currentEmotionText = "";

  let match;
  while ((match = re.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    
    // The dialogue text is between the end of the last match and the start of the current match
    const textBetween = text.slice(lastIndex, matchIndex).trim();
    if (textBetween || (turns.length === 0 && lastIndex === 0 && textBetween)) {
      turns.push({
        speaker: currentSpeaker,
        text: textBetween,
        emotion_preset: currentSpeaker === "NARRATOR" ? "calm" : "custom",
        emotion_alpha: 0.6,
        emotion_vector: [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9],
        ...(currentEmotionText ? { emotion_preset: "custom", use_emotion_text: true, emotion_text: currentEmotionText } : {})
      });
    }

    currentSpeaker = match[1].toUpperCase();
    currentEmotionText = match[2] ? match[2].trim() : "";
    lastIndex = matchIndex + matchLength;
  }

  // Add the final turn
  const remainingText = text.slice(lastIndex).trim();
  if (remainingText) {
    turns.push({
      speaker: currentSpeaker,
      text: remainingText,
      emotion_preset: currentSpeaker === "NARRATOR" ? "calm" : "custom",
      emotion_alpha: 0.6,
      emotion_vector: [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9],
      ...(currentEmotionText ? { emotion_preset: "custom", use_emotion_text: true, emotion_text: currentEmotionText } : {})
    });
  }

  return turns;
}

function reconcileDialogueTurns(
  newText: string,
  existingTurns: DialogueTurn[] | undefined,
  characterNames: string[]
): DialogueTurn[] {
  const parsed = parseDialogueText(newText, characterNames);
  const reconciled: DialogueTurn[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const existing = existingTurns?.[i];
    
    if (existing && existing.speaker === p.speaker) {
      reconciled.push({
        ...existing,
        text: p.text,
        // Override or merge if parser extracted a new one
        ...(p.emotion_text ? { emotion_preset: "custom", use_emotion_text: true, emotion_text: p.emotion_text } : {})
      });
    } else {
      reconciled.push(p);
    }
  }

  return reconciled;
}

interface DialogueTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onBlur: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const DialogueTextarea = React.memo(({ value, onChange, onBlur, placeholder, className }: DialogueTextareaProps) => {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <Textarea
      value={internalValue}
      onChange={(e) => {
        setInternalValue(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => {
        onBlur(internalValue);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
});
DialogueTextarea.displayName = "DialogueTextarea";

export default function VoiceoverStudio() {
  const { isChatOpen, setIsChatOpen } = React.useContext(WorkspaceContext);
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  // 1. Sync Phase to Copilot State
  usePhaseSync("voiceover");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Auto-Extract Dialogues",
        message: "Please analyze our screenplays and dialogues, map dialogues/narrations onto each structured scene, and assign the appropriate speaking characters.",
      }
    ],
    available: "always"
  });

  const { agent } = useAgent({ agentId: "default" });

  // Local state as the single source of truth
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [script, setScript] = useState<string>("");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const [emoPreset, setEmoPreset] = useState<string>("calm");
  const [emoVector, setEmoVector] = useState<number[]>([0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9]);
  const [emoAlpha, setEmoAlpha] = useState<number>(0.6);
  const [useEmoText, setUseEmoText] = useState<boolean>(false);
  const [emoText, setEmoText] = useState<string>("");
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState<boolean>(false);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [narratorVoice, setNarratorVoice] = useState<string>("cff02830-c816-45bf-ba0c-ab8bd0210a5e");
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);

  const design = {
    narrator_voice: narratorVoice,
    entities,
    scenes,
    script,
    ...(agent?.state?.design || {})
  };

  useEffect(() => {
    fetch("/api/voices")
      .then((res) => res.json())
      .then((data) => setAllVoices(data))
      .catch((err) => console.error("Failed to load voices:", err));
  }, []);

  // Butter-smooth text area input local state
  const [localDialogue, setLocalDialogue] = useState<string>("");
  const localDialogueRef = useRef<string>("");
  const aiRunningRef = useRef<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializedRef = useRef<boolean>(false);
  const prevActiveSceneIdRef = useRef<string | null>(null);

  // Fetch thread state on mount
  useEffect(() => {
    if (!projectId || !agent || initializedRef.current) return;
    getThreadState(projectId)
      .then((data) => {
        const design = data?.values?.design;
        if (design) {
          const loadedScenes = design.scenes || [];
          const loadedEntities = design.entities || [];
          setScenes(loadedScenes);
          setEntities(loadedEntities);
          setScript(design.script || "");
          setNarratorVoice(design.narrator_voice || "cff02830-c816-45bf-ba0c-ab8bd0210a5e");

          agent.setState({
            ...agent.state,
            design,
          });
          initializedRef.current = true;
        }
      })
      .catch((err) => console.warn("[Voiceover] Failed to load state:", err));
  }, [projectId, agent]);

  // Sync AI state changes (from CopilotKit Agent runs) to local state
  useEffect(() => {
    if (initializedRef.current && agent?.state?.design?.scenes && agent.state.design.scenes.length > 0) {
      if (scenes.length === 0 || aiRunningRef.current) {
        setScenes(agent.state.design.scenes);
      }
    }
  }, [agent?.state?.design?.scenes]);

  useEffect(() => {
    if (initializedRef.current && agent?.state?.design?.entities && agent.state.design.entities.length > 0) {
      if (entities.length === 0 || aiRunningRef.current) {
        setEntities(agent.state.design.entities);
      }
    }
  }, [agent?.state?.design?.entities]);

  useEffect(() => {
    if (initializedRef.current && agent?.state?.design?.narrator_voice) {
      setNarratorVoice(agent.state.design.narrator_voice);
    }
  }, [agent?.state?.design?.narrator_voice]);

  // Filter character entities for voice actor mapping
  const characters = entities.filter((e) => e.type === "character");

  // Auto-select first scene if none is selected
  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);

  const handleUpdateActiveTurnEmotion = (updates: Partial<DialogueTurn>) => {
    if (!activeScene || selectedTurnIndex === null) return;
    const currentTurns = activeScene.dialogue_turns || [];
    const updatedTurns = currentTurns.map((t, idx) => {
      if (idx === selectedTurnIndex) {
        return { ...t, ...updates };
      }
      return t;
    });

    const newDialogueStr = updatedTurns.map(formatTurnToString).join("\n\n");
    handleUpdateSceneField(activeScene.id, {
      dialogue: newDialogueStr,
      dialogue_turns: updatedTurns,
    });
  };

  const handleSelectTurn = (turnIdx: number) => {
    setSelectedTurnIndex(turnIdx);
  };

  const handleUpdateTurnText = (turnIdx: number, newText: string) => {
    if (!activeScene) return;
    const currentTurns = activeScene.dialogue_turns || [];
    const updatedTurns = currentTurns.map((t, idx) => {
      if (idx === turnIdx) {
        return { ...t, text: newText };
      }
      return t;
    });

    const newDialogueStr = updatedTurns.map(formatTurnToString).join("\n\n");
    handleUpdateSceneField(activeScene.id, {
      dialogue: newDialogueStr,
      dialogue_turns: updatedTurns,
    });
  };

  const handleUpdateTurnSpeaker = (turnIdx: number, newSpeaker: string) => {
    if (!activeScene) return;
    const currentTurns = activeScene.dialogue_turns || [];
    const updatedTurns = currentTurns.map((t, idx) => {
      if (idx === turnIdx) {
        return { ...t, speaker: newSpeaker.toUpperCase() };
      }
      return t;
    });

    const newDialogueStr = updatedTurns.map(formatTurnToString).join("\n\n");
    handleUpdateSceneField(activeScene.id, {
      dialogue: newDialogueStr,
      dialogue_turns: updatedTurns,
    });
  };

  const handleAddTurn = () => {
    if (!activeScene) return;
    const currentTurns = activeScene.dialogue_turns || [];
    const newTurn: DialogueTurn = {
      speaker: "NARRATOR",
      text: "New dialogue line...",
      emotion_preset: "calm",
      emotion_alpha: 0.6,
      emotion_vector: [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9],
    };
    const updatedTurns = [...currentTurns, newTurn];
    const newDialogueStr = updatedTurns.map(formatTurnToString).join("\n\n");

    handleUpdateSceneField(activeScene.id, {
      dialogue: newDialogueStr,
      dialogue_turns: updatedTurns,
    });

    // Select the new turn
    setSelectedTurnIndex(updatedTurns.length - 1);
    setEmoPreset("calm");
    setEmoAlpha(0.6);
    setEmoVector([0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9]);
    setUseEmoText(false);
    setEmoText("");
    setLocalDialogue(newTurn.text);
    localDialogueRef.current = newTurn.text;
  };

  const handleDeleteTurn = (turnIdx: number) => {
    if (!activeScene) return;
    const currentTurns = activeScene.dialogue_turns || [];
    if (currentTurns.length === 0) return;

    const updatedTurns = currentTurns.filter((_, idx) => idx !== turnIdx);
    const newDialogueStr = updatedTurns.map(formatTurnToString).join("\n\n");

    handleUpdateSceneField(activeScene.id, {
      dialogue: newDialogueStr,
      dialogue_turns: updatedTurns,
    });

    if (updatedTurns.length > 0) {
      const nextIdx = Math.max(0, turnIdx - 1);
      setSelectedTurnIndex(nextIdx);
      const nextTurn = updatedTurns[nextIdx];
      setEmoPreset(nextTurn.emotion_preset || "calm");
      setEmoAlpha(nextTurn.emotion_alpha ?? 0.6);
      setEmoVector(nextTurn.emotion_vector || [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9]);
      setUseEmoText(!!nextTurn.use_emotion_text || !!nextTurn.emotion_text);
      setEmoText(nextTurn.emotion_text || "");
      setLocalDialogue(nextTurn.text);
      localDialogueRef.current = nextTurn.text;
    } else {
      setSelectedTurnIndex(null);
      setLocalDialogue("");
      localDialogueRef.current = "";
    }
  };

  // 1. Initial parse/reconciliation when active scene changes
  useEffect(() => {
    if (activeScene) {
      const val = activeScene.dialogue || "";
      const existing = activeScene.dialogue_turns || [];
      const reconciled = reconcileDialogueTurns(val, existing, characters.map(c => c.name));

      // Update scene dialogue_turns if they changed or were uninitialized
      if (!activeScene.dialogue_turns || activeScene.dialogue_turns.length !== reconciled.length) {
        handleUpdateSceneField(activeScene.id, { dialogue_turns: reconciled });
      }

      if (reconciled.length > 0) {
        if (selectedTurnIndex === null || selectedTurnIndex >= reconciled.length) {
          setSelectedTurnIndex(0);
          const firstTurn = reconciled[0];
          setEmoPreset(firstTurn.emotion_preset || "calm");
          setEmoAlpha(firstTurn.emotion_alpha ?? 0.6);
          setEmoVector(firstTurn.emotion_vector || [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9]);
          setUseEmoText(!!firstTurn.use_emotion_text || !!firstTurn.emotion_text);
          setEmoText(firstTurn.emotion_text || "");
        }
      } else {
        setSelectedTurnIndex(null);
      }
    } else {
      setSelectedTurnIndex(null);
    }
  }, [activeScene?.id]);

  // 2. Synchronize local editing dialogue text and emotions with selected turn
  useEffect(() => {
    if (activeScene && selectedTurnIndex !== null && activeScene.dialogue_turns?.[selectedTurnIndex]) {
      const turn = activeScene.dialogue_turns[selectedTurnIndex];
      const turnText = turn.text || "";
      setLocalDialogue(turnText);
      localDialogueRef.current = turnText;

      setEmoPreset(turn.emotion_preset || "calm");
      setEmoAlpha(turn.emotion_alpha ?? 0.6);
      setEmoVector(turn.emotion_vector || [0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9]);
      setUseEmoText(!!turn.use_emotion_text || !!turn.emotion_text);
      setEmoText(turn.emotion_text || "");
    } else {
      setLocalDialogue("");
      localDialogueRef.current = "";
    }
  }, [activeScene?.id, selectedTurnIndex]);

  // Load preset vectors
  const handleApplyPreset = (presetId: string) => {
    aiRunningRef.current = false;
    setEmoPreset(presetId);
    if (presetId === "custom") return;
    const preset = EMOTION_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const vector = [...preset.vector];
      setEmoVector(vector);
      handleUpdateActiveTurnEmotion({
        emotion_preset: presetId,
        emotion_vector: vector,
      });
    }
  };

  const handleUpdateVectorDim = (index: number, val: number) => {
    aiRunningRef.current = false;
    setEmoPreset("custom");
    const updated = [...emoVector];
    updated[index] = val;
    setEmoVector(updated);
    handleUpdateActiveTurnEmotion({
      emotion_preset: "custom",
      emotion_vector: updated,
    });
  };

  const handleUpdateSceneField = (sceneId: string, fields: Partial<Scene>) => {
    aiRunningRef.current = false;
    const updatedScenes = scenes.map((s) => {
      if (s.id === sceneId) {
        return { ...s, ...fields };
      }
      return s;
    });

    setScenes(updatedScenes);

    // Sync back to agent state asynchronously (lag-free!)
    if (agent) {
      agent.setState({
        ...agent.state,
        design: {
          script,
          entities,
          scenes: updatedScenes,
        },
      });
    }
  };

  const handleSaveVoiceover = async () => {
    if (!projectId) return;
    aiRunningRef.current = false;
    setIsSaving(true);
    try {
      console.log("[Voiceover] Manually persisting dialogue and voice settings...");
      
      let finalDialogue = "";
      if (selectedTurnIndex !== null && activeScene?.dialogue_turns) {
        const updatedTurns = activeScene.dialogue_turns.map((t, idx) => {
          if (idx === selectedTurnIndex) {
            return { ...t, text: localDialogueRef.current };
          }
          return t;
        });
        finalDialogue = updatedTurns.map(formatTurnToString).join("\n\n");
      } else {
        finalDialogue = localDialogueRef.current;
      }

      // Make sure we include the current localDialogue in the active scene!
      const currentScenes = scenes.map((s) => {
        if (selectedSceneId && s.id === selectedSceneId) {
          const reconciled = reconcileDialogueTurns(finalDialogue, s.dialogue_turns, characters.map(c => c.name));
          return { ...s, dialogue: finalDialogue, dialogue_turns: reconciled };
        }
        return s;
      });

      const updatedDesign = {
        ...design,
        script,
        entities,
        scenes: currentScenes,
      };

      await updateThreadState(projectId, {
        design: updatedDesign,
      });

      setScenes(currentScenes);
      if (agent) {
        agent.setState({
          ...agent.state,
          design: updatedDesign,
        });
      }
      alert("Voiceover details saved successfully!");
    } catch (err) {
      console.error("[Voiceover] Failed to save state:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Dialogue extraction tool fallback
  const handleAutoExtractDialogues = () => {
    if (!agent) return;
    aiRunningRef.current = true;
    agent.addMessage({
      role: "user",
      id: `dialogue-extract-${Date.now()}`,
      content: "Please analyze our screenplays and dialogues, map dialogues/narrations onto each structured scene, and assign the appropriate speaking characters.",
    });
    agent.runAgent();
  };

  // Batch synthesize vocal recordings for all scenes
  const handleBatchSynthesizeAll = async () => {
    if (scenes.length === 0) return;
    aiRunningRef.current = false;
    setIsBatchSynthesizing(true);

    // Resolve narrator voice ID
    const narratorVoiceRef = design.narrator_voice || "cff02830-c816-45bf-ba0c-ab8bd0210a5e";
    const narratorVoiceObj = PRESET_VOICES.find(v => v.id === narratorVoiceRef) || allVoices.find(v => v.id === narratorVoiceRef);
    const narratorPath = narratorVoiceObj ? (narratorVoiceObj.path || narratorVoiceObj.sampleUrl) : "speech-samples/en-US_Female_Adult_Ava_Dragon_HD_Latest.wav";

    // Build dynamic speaker voice map
    const characterVoices: Record<string, string> = {};
    characterVoices["NARRATOR"] = narratorPath;
    characterVoices["SYSTEM"] = narratorPath;
    characters.forEach((c) => {
      if (c.voice_reference) {
        const charVoiceObj = PRESET_VOICES.find(v => v.id === c.voice_reference) || allVoices.find(v => v.id === c.voice_reference);
        characterVoices[c.name.toUpperCase()] = charVoiceObj ? (charVoiceObj.path || charVoiceObj.sampleUrl) : c.voice_reference;
      }
    });

    let updatedScenes = [...scenes];

    try {
      for (const scene of scenes) {
        // Find dialogue turns text
        const dialogueTurns = scene.dialogue_turns || reconcileDialogueTurns(scene.dialogue || "", [], characters.map(c => c.name));
        const dialogueText = dialogueTurns.map(formatTurnToString).join("\n\n").trim();

        if (!dialogueText) continue; // Skip scenes with no dialogue

        const clientTurns = dialogueTurns.map(t => ({
          speaker: t.speaker,
          text: t.text,
          emo_alpha: t.emotion_alpha,
          emo_vector: t.emotion_vector,
          emotion_text: t.emotion_text,
        }));

        const res = await fetch("/api/generate-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: dialogueText,
            spk_audio_prompt: narratorPath, // Fallback prompt
            emo_alpha: 0.6,
            emo_vector: null,
            use_emo_text: false,
            emo_text: null,
            sceneId: scene.id,
            character_voices: characterVoices,
            turns: clientTurns,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.url) {
            updatedScenes = updatedScenes.map((s) => {
              if (s.id === scene.id) {
                return {
                  ...s,
                  audio_url: data.url,
                  audio_duration: data.duration,
                  dialogue_turns: dialogueTurns
                };
              }
              return s;
            });
            // Update state in real-time as each scene finishes
            setScenes(updatedScenes);
          }
        }
      }

      // Save all updated scenes back to backend thread
      const updatedDesign = {
        ...design,
        script,
        entities,
        scenes: updatedScenes,
      };

      await updateThreadState(projectId, {
        design: updatedDesign,
      });

      if (agent) {
        agent.setState({
          ...agent.state,
          design: updatedDesign,
        });
      }

      alert("Batch synthesis completed for all scenes!");
    } catch (err) {
      console.error("Batch synthesis failed:", err);
      alert("An error occurred during batch synthesis.");
    } finally {
      setIsBatchSynthesizing(false);
    }
  };

  // Perform TTS Dubbing Call
  const handleSynthesizeAudio = async () => {
    if (!activeScene) return;
    aiRunningRef.current = false;

    let dialogueText = "";
    if (selectedTurnIndex !== null && activeScene.dialogue_turns) {
      const updatedTurns = activeScene.dialogue_turns.map((t, idx) => {
        if (idx === selectedTurnIndex) {
          return { ...t, text: localDialogueRef.current };
        }
        return t;
      });
      dialogueText = updatedTurns.map(formatTurnToString).join("\n\n");
    } else {
      dialogueText = localDialogueRef.current;
    }
    dialogueText = dialogueText.trim();

    if (!dialogueText) {
      alert("Please enter dialogue script text first.");
      return;
    }

    // Resolve narrator voice ID
    const narratorVoiceRef = design.narrator_voice || "cff02830-c816-45bf-ba0c-ab8bd0210a5e";
    const narratorVoiceObj = PRESET_VOICES.find(v => v.id === narratorVoiceRef) || allVoices.find(v => v.id === narratorVoiceRef);
    const narratorPath = narratorVoiceObj ? (narratorVoiceObj.path || narratorVoiceObj.sampleUrl) : "speech-samples/en-US_Female_Adult_Ava_Dragon_HD_Latest.wav";

    // Resolve speaker audio reference path
    let speakerRefPath = narratorPath;
    if (activeScene.voice_actor_id && activeScene.voice_actor_id !== "narrator") {
      const char = characters.find((c) => c.id === activeScene.voice_actor_id);
      if (char?.voice_reference) {
        const charVoiceObj = PRESET_VOICES.find(v => v.id === char.voice_reference) || allVoices.find(v => v.id === char.voice_reference);
        speakerRefPath = charVoiceObj ? (charVoiceObj.path || charVoiceObj.sampleUrl) : char.voice_reference;
      }
    }

    // Build dynamic speaker voice map for multi-character dialogue parsing and stitching
    const characterVoices: Record<string, string> = {};
    characterVoices["NARRATOR"] = narratorPath;
    characterVoices["SYSTEM"] = narratorPath;
    
    characters.forEach((c) => {
      if (c.voice_reference) {
        const charVoiceObj = PRESET_VOICES.find(v => v.id === c.voice_reference) || allVoices.find(v => v.id === c.voice_reference);
        characterVoices[c.name.toUpperCase()] = charVoiceObj ? (charVoiceObj.path || charVoiceObj.sampleUrl) : c.voice_reference;
      }
    });

    const clientTurns = activeScene.dialogue_turns
      ? activeScene.dialogue_turns.map((t, idx) => {
          if (selectedTurnIndex !== null && idx === selectedTurnIndex) {
            return {
              speaker: t.speaker,
              text: localDialogueRef.current,
              emo_alpha: emoAlpha,
              emo_vector: emoPreset === "custom" || emoPreset ? emoVector : null,
              emotion_text: useEmoText ? emoText : t.emotion_text,
            };
          }
          return {
            speaker: t.speaker,
            text: t.text,
            emo_alpha: t.emotion_alpha,
            emo_vector: t.emotion_vector,
            emotion_text: t.emotion_text,
          };
        })
      : [];

    setIsSynthesizing(true);

    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: dialogueText,
          spk_audio_prompt: speakerRefPath,
          emo_alpha: emoAlpha,
          emo_vector: emoPreset === "custom" || emoPreset ? emoVector : null,
          use_emo_text: useEmoText,
          emo_text: useEmoText ? emoText || dialogueText : null,
          sceneId: activeScene.id,
          character_voices: characterVoices,
          turns: clientTurns,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Dubbing synthesis failed");
      }

      const data = await res.json();
      if (data.status === "success" && data.url) {
        const updatedScenes = scenes.map((s) => {
          if (s.id === activeScene.id) {
            return {
              ...s,
              dialogue: dialogueText,
              audio_url: data.url,
              audio_duration: data.duration,
            };
          }
          return s;
        });

        const updatedDesign = {
          script,
          entities,
          scenes: updatedScenes,
        };

        // Update local agent state
        if (agent) {
          agent.setState({
            ...agent.state,
            design: updatedDesign,
          });
        }

        // Persist immediately to backend thread state
        try {
          await updateThreadState(projectId, {
            design: updatedDesign,
          });
          console.log("[Voiceover] Auto-saved synthesized audio reference to backend.");
        } catch (saveErr) {
          console.error("[Voiceover] Failed to auto-save audio reference:", saveErr);
        }

        setScenes(updatedScenes);
        setActiveAudioUrl(data.url);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Synthesis Failed: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Audio Playback Controls
  const togglePlayAudio = (url: string) => {
    if (activeAudioUrl !== url) {
      setActiveAudioUrl(url);
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const renderVoiceCastCard = (currentSpeaker: string) => {
    const isNarrator = currentSpeaker === "NARRATOR" || currentSpeaker === "SYSTEM";
    const char = characters.find(c => c.name.toUpperCase() === currentSpeaker.toUpperCase());

    let currentVoiceRef = "";
    let displayName = currentSpeaker;
    if (isNarrator) {
      currentVoiceRef = design.narrator_voice || "cff02830-c816-45bf-ba0c-ab8bd0210a5e";
      displayName = "Narrator (旁白)";
    } else if (char) {
      currentVoiceRef = char.voice_reference || "";
      displayName = char.name;
    } else {
      return (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500">
          ⚠️ Speaker "{currentSpeaker}" is not created in Character Breakdown. Please add them first in Breakdown page.
        </div>
      );
    }

    const currentVoice = allVoices.find(v => v.id === currentVoiceRef || v.sampleUrl === currentVoiceRef) 
      || PRESET_VOICES.find(v => v.id === currentVoiceRef || v.path === currentVoiceRef);
    const isCustomVoice = currentVoiceRef && !currentVoice;
    const isVoicePlaying = currentVoice && playingVoiceId === currentVoice.id;

    const playVoicePreview = () => {
      if (!currentVoice) return;
      const path = currentVoice.sampleUrl || currentVoice.path;
      const id = currentVoice.id;
      
      let finalUrl = "";
      if (path.startsWith("examples/") || path.startsWith("presets/")) {
        finalUrl = `/api/preview-voice?path=${encodeURIComponent(path)}`;
      } else {
        const filename = path.split("/").pop();
        finalUrl = `/api/speech-samples/${filename}`;
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        if (playingVoiceId === id) {
          setPlayingVoiceId(null);
          return;
        }
      }

      const audio = new Audio(finalUrl);
      audioPlayerRef.current = audio;
      setPlayingVoiceId(id);
      audio.play().catch(err => {
        console.error("Audition playback failed:", err);
        setPlayingVoiceId(null);
      });
      audio.onended = () => {
        setPlayingVoiceId(null);
      };
    };

    const handleSelectVoice = async (voice: any) => {
      if (isNarrator) {
        setNarratorVoice(voice.id);
        const updatedDesign = {
          ...design,
          narrator_voice: voice.id
        };
        if (agent) {
          agent.setState({
            ...agent.state,
            design: updatedDesign
          });
        }
        try {
          await updateThreadState(projectId, { design: updatedDesign });
        } catch (err) {
          console.error("Failed to auto-save narrator voice:", err);
        }
      } else if (char) {
        const updatedEntities = entities.map(e => {
          if (e.id === char.id) {
            return { ...e, voice_reference: voice.id };
          }
          return e;
        });
        setEntities(updatedEntities);
        const updatedDesign = {
          ...design,
          entities: updatedEntities
        };
        if (agent) {
          agent.setState({
            ...agent.state,
            design: updatedDesign
          });
        }
        try {
          await updateThreadState(projectId, { design: updatedDesign });
        } catch (err) {
          console.error("Failed to auto-save character voice:", err);
        }
      }
    };

    return (
      <div className="space-y-2 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 block">
            🎙️ {displayName} Voice Cast (配音声线)
          </label>
        </div>
        <Card
          onClick={() => setIsVoiceDialogOpen(true)}
          className={cn(
            "p-3 cursor-pointer transition-all border text-left relative group select-none shadow-sm hover:bg-muted/10",
            currentVoiceRef 
              ? "border-primary/40 bg-primary/[0.01]"
              : "border-dashed border-border/80 hover:border-primary/30"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground truncate">
                  {currentVoice ? currentVoice.name : (isCustomVoice ? "Custom Voice" : "No Voice Casted")}
                </h4>
                {currentVoice && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0 font-semibold uppercase tracking-wider rounded border shrink-0",
                      currentVoice.gender?.toLowerCase() === "female" && "text-pink-500 border-pink-500/20 bg-pink-500/5",
                      currentVoice.gender?.toLowerCase() === "male" && "text-blue-500 border-blue-500/20 bg-blue-500/5",
                      currentVoice.gender?.toLowerCase() === "narrator" && "text-amber-500 border-amber-500/20 bg-amber-500/5",
                      currentVoice.gender?.toLowerCase() === "special" && "text-purple-500 border-purple-500/20 bg-purple-500/5"
                    )}
                  >
                    {currentVoice.gender}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal line-clamp-1">
                {currentVoice ? currentVoice.description : "Click here to choose a voice for this speaker."}
              </p>
              <div className="text-[9px] text-primary/70 font-semibold flex items-center gap-1 group-hover:text-primary transition-colors">
                <SparklesIcon className="w-2.5 h-2.5" />
                <span>Click to Change Voice</span>
              </div>
            </div>

            {currentVoice && (
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  playVoicePreview();
                }}
                className={cn(
                  "w-8 h-8 rounded-full border transition-all shrink-0 shadow-sm",
                  isVoicePlaying
                    ? "bg-primary text-white border-primary animate-pulse"
                    : "bg-background/80 hover:bg-primary/10 border-border/80 text-muted-foreground hover:text-primary"
                )}
              >
                {isVoicePlaying ? (
                  <PauseIcon className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <PlayIcon className="w-3.5 h-3.5 ml-0.5 fill-current" />
                )}
              </Button>
            )}
          </div>
        </Card>

        <VoiceSelectorDialog
          isOpen={isVoiceDialogOpen}
          onOpenChange={setIsVoiceDialogOpen}
          selectedVoiceId={currentVoiceRef || null}
          onSelect={handleSelectVoice}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Hidden Audio element for auditioning */}
      {activeAudioUrl && (
        <audio
          ref={audioRef}
          src={activeAudioUrl}
          autoPlay={isPlaying}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/workspace" className="text-muted-foreground hover:text-foreground">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground">
                  Generation
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Voiceover Studio</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoExtractDialogues}
            className="h-9 px-3 border-dashed transition-all shadow-sm"
          >
            <SparklesIcon className="w-3.5 h-3.5 mr-2" />
            AI Auto-Extract Dialogues
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchSynthesizeAll}
            disabled={isBatchSynthesizing}
            className="h-9 px-3 border-dashed hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group shadow-sm"
          >
            {isBatchSynthesizing ? (
              <Loader2Icon className="w-3.5 h-3.5 mr-2 animate-spin text-muted-foreground" />
            ) : (
              <Wand2Icon className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
            )}
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {isBatchSynthesizing ? "Synthesizing All..." : "Batch Synthesize All"}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveVoiceover}
            disabled={isSaving}
            className="h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm"
          >
            {isSaving ? (
              <Loader2Icon className="w-3.5 h-3.5 mr-2 animate-spin text-muted-foreground" />
            ) : (
              <SaveIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {isSaving ? "Saving..." : "Save Changes"}
            </span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${projectId}/generation/keyframes`)}
            className="flex items-center gap-2 h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm transition-all group"
          >
            <span className="text-xs font-semibold">Next: Keyframe Gen</span>
            <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          {!isChatOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen?.(true)}
              className="h-9 px-3 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <MessageSquareIcon className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Open Assistant
              </span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {scenes.length > 0 ? (
          <>
            {/* Left Pane: Scenes & Dialogue Timelines */}
            <div className="flex-1 min-w-[340px] flex flex-col p-6 overflow-y-auto border-r border-border/40">
              <div className="flex flex-col gap-4 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                    <AudioLinesIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-md font-bold tracking-tight">Timeline Screenplay Script</h1>
                    <p className="text-xs text-muted-foreground/80">Scene-by-scene vocal recording and timing synchronization</p>
                  </div>
                </div>
              </div>

              {/* Vertical list of script dialogues */}
              <div className="space-y-4">
                {scenes.map((scene) => {
                  const isSelected = selectedSceneId === scene.id;
                  const speakingChar = characters.find((c) => c.id === scene.voice_actor_id);
                  const isSynthesized = !!scene.audio_url;

                  return (
                    <Card
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className={cn(
                        "relative p-5 cursor-pointer transition-all duration-300 border rounded-xl flex flex-col gap-3 group select-none",
                        isSelected
                          ? "bg-background/80 shadow-md border-indigo-500/40 ring-1 ring-indigo-500/10"
                          : "border-border/60 bg-card hover:border-indigo-500/20 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground">
                            #{scene.id.toUpperCase()}
                          </span>
                          {(() => {
                            const turns = parseDialogueText(scene.dialogue || "", characters.map(c => c.name));
                            if (turns.length > 0) {
                              const uniqueSpeakers = Array.from(new Set(turns.map(t => t.speaker)));
                              return (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {uniqueSpeakers.map((spk, idx) => {
                                    const char = characters.find(c => c.name.toUpperCase() === spk);
                                    const isNarrator = spk === "NARRATOR" || spk === "SYSTEM";
                                    return (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className={cn(
                                          "text-[10px] font-bold uppercase py-0 px-1.5 leading-none rounded",
                                          isNarrator
                                            ? "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        )}
                                      >
                                        {char ? char.name : spk}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              );
                            }
                            
                            // Fallback to default speakingChar
                            return (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs font-bold uppercase py-0.5 px-2",
                                  speakingChar
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                                )}
                              >
                                {speakingChar ? speakingChar.name : "Narrator"}
                              </Badge>
                            );
                          })()}
                        </div>

                        {/* Audio Status Indicators */}
                        {isSynthesized ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-400/80 flex items-center gap-1.5">
                              <CheckCircle2Icon className="w-3.5 h-3.5" />
                              Ready ({scene.audio_duration}s)
                            </span>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="w-8 h-8 rounded-full shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlayAudio(scene.audio_url!);
                              }}
                            >
                              {isPlaying && activeAudioUrl === scene.audio_url ? (
                                <PauseIcon className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <PlayIcon className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground/60 border-dashed py-0.5 px-2">
                            Pending TTS
                          </Badge>
                        )}
                      </div>

                      {/* Normal Scene Description at the top (First!) */}
                      <div className="text-xs text-muted-foreground bg-muted/10 p-3 rounded-lg border border-border/30 mb-1 leading-relaxed">
                        <span className="font-bold uppercase tracking-wider block text-[10px] text-muted-foreground/75 mb-1">
                          🎬 Scene Description (场景描述)
                        </span>
                        {scene.description}
                      </div>

                      {/* Dialogue script card preview */}
                      <div className="space-y-2.5 pt-1">
                        {(() => {
                          const turns = parseDialogueText(scene.dialogue || "", characters.map(c => c.name));
                          if (turns.length === 0) {
                            return (
                              <div className="text-xs text-muted-foreground/45 italic bg-muted/5 p-2.5 rounded-lg border border-dashed border-border/40 text-center select-none">
                                💡 No Dialogue/Narration lines set for this scene
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-2">
                              {turns.map((turn, tIdx) => {
                                const isNarrator = turn.speaker === "NARRATOR" || turn.speaker === "SYSTEM";
                                const char = characters.find(c => c.name.toUpperCase() === turn.speaker);
                                const isTurnSelected = isSelected && selectedTurnIndex === tIdx;
                                
                                return (
                                  <div
                                    key={tIdx}
                                    onClick={(e) => {
                                      if (isSelected) {
                                        e.stopPropagation(); // Avoid re-triggering selectedSceneId select
                                        handleSelectTurn(tIdx);
                                      }
                                    }}
                                    className={cn(
                                      "flex gap-2.5 items-start text-xs p-2 rounded-lg border transition-all duration-300",
                                      isSelected
                                        ? "cursor-pointer"
                                        : "pointer-events-none",
                                      isTurnSelected
                                        ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/10"
                                        : "bg-muted/15 border-transparent hover:bg-muted/30 hover:border-border/50"
                                    )}
                                  >
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "font-bold uppercase px-1.5 py-0.5 rounded text-[9px] shrink-0 min-w-[72px] justify-center text-center leading-none",
                                        isNarrator ? "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                      )}
                                    >
                                      {char ? char.name : turn.speaker}
                                    </Badge>
                                    <div className="flex-1 text-foreground/90 font-medium leading-relaxed font-sans pr-1 break-words">
                                      {turn.text}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Dubbing Configuration & Emotion Control (Fixed 420px width) */}
            <div className="w-[420px] shrink-0 flex flex-col bg-muted/10 overflow-y-auto border-l border-border/20">
              <div className="p-6 border-b border-border/40 bg-background/50 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                  <Volume2Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">Voiceover controls</h2>
                  <p className="text-xs text-muted-foreground/60">Configure zero-shot tone parameter and scripts</p>
                </div>
              </div>

              {activeScene ? (
                <div className="p-6 flex-1 flex flex-col gap-6 relative">
                  {/* Active Synthesis Loading Blur Screen */}
                  {isSynthesizing && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-3">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <Loader2Icon className="w-6 h-6 text-indigo-500 animate-spin" />
                      </div>
                      <p className="text-sm font-bold tracking-wider text-foreground">Generating voiceover audio...</p>
                      <p className="text-xs text-muted-foreground">Cloning reference soundwave & blending emotion vectors</p>
                    </div>
                  )}

                  {/* Top Scene Overview & Info Banner */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-indigo-400">
                      {selectedTurnIndex !== null 
                        ? `TURN #${selectedTurnIndex + 1} (${activeScene.dialogue_turns?.[selectedTurnIndex]?.speaker || "NARRATOR"})`
                        : `SCENE DUBBING #${activeScene.id.toUpperCase()}`}
                    </span>
                    {activeScene.audio_duration && (
                      <div className="flex items-center gap-3 text-xs font-bold text-indigo-400">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {activeScene.audio_duration}s
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <FilmIcon className="w-3.5 h-3.5" />
                          {Math.round(activeScene.audio_duration * 24.0)} Frames
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Edit Card Container */}
                  <div className="p-4 rounded-xl border border-border bg-background/60 flex flex-col gap-4">
                    {selectedTurnIndex !== null && activeScene.dialogue_turns?.[selectedTurnIndex] ? (
                      <div className="space-y-4">
                        {/* Speaker Selector Dropdown */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 block">
                            👤 Speaking Character (说话角色)
                          </label>
                          <select
                            value={activeScene.dialogue_turns[selectedTurnIndex].speaker || "NARRATOR"}
                            onChange={(e) => handleUpdateTurnSpeaker(selectedTurnIndex, e.target.value)}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus:border-indigo-500/40 shadow-sm"
                          >
                            <option value="NARRATOR">Narrator (旁白)</option>
                            {characters.map((char) => (
                              <option key={char.id} value={char.name.toUpperCase()}>
                                {char.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Render the voice cast card for this speaker */}
                        {renderVoiceCastCard(activeScene.dialogue_turns[selectedTurnIndex].speaker)}

                        {/* Edit Selected Turn Text */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold tracking-[0.15em] uppercase text-indigo-400 block">
                            🗣️ Dialogue Line Text (台词内容)
                          </label>
                          <DialogueTextarea
                            value={localDialogue}
                            onChange={(val) => {
                              localDialogueRef.current = val;
                            }}
                            onBlur={(val) => {
                              setLocalDialogue(val);
                              handleUpdateTurnText(selectedTurnIndex, val);
                            }}
                            placeholder="Enter dialogue/narration line text..."
                            className="bg-background text-sm min-h-[80px] resize-none border-border/80 focus-visible:ring-indigo-500/20"
                          />
                        </div>

                        {/* Turn action buttons */}
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTurn(selectedTurnIndex)}
                            className="h-8 px-2.5 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 border-rose-500/20"
                          >
                            <Trash2Icon className="w-3.5 h-3.5 mr-1.5" />
                            Delete Turn
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddTurn}
                            className="h-8 px-2.5 text-xs font-semibold"
                          >
                            <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
                            Add Turn
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-muted-foreground/60 py-8">
                        No dialogue turns found for this scene.
                        <div className="mt-3">
                          <Button variant="outline" size="sm" onClick={handleAddTurn} className="h-8 text-xs font-semibold">
                            <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
                            Add First Turn
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Core Emotion controls */}
                  <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Emotional Parameters
                      </h3>
                      <Badge variant="outline" className="text-xs uppercase border-indigo-500/30 text-indigo-400 px-2 py-0.5">
                        Zero-Shot TTS v2
                      </Badge>
                    </div>

                    {/* Preset Buttons */}
                    <div className="space-y-2.5">
                      <label className="text-sm font-bold text-muted-foreground/80 block">
                        Aesthetic Tone Presets
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {EMOTION_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handleApplyPreset(preset.id)}
                            className={cn(
                              "text-xs md:text-sm font-semibold py-2 px-3.5 rounded-lg border transition-all shadow-sm",
                              emoPreset === preset.id
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold"
                                : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {preset.name}
                          </button>
                        ))}
                        <button
                          onClick={() => setEmoPreset("custom")}
                          className={cn(
                            "text-xs md:text-sm font-semibold py-2 px-3.5 rounded-lg border transition-all shadow-sm",
                            emoPreset === "custom"
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold"
                              : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Custom
                        </button>
                      </div>
                    </div>



                    {/* Toggle: Use Text Guide Emotion */}
                    <div className="flex items-center justify-between p-4 bg-background/50 border border-border/60 rounded-xl">
                      <div className="space-y-1 min-w-0">
                        <span className="text-sm font-bold text-muted-foreground block">
                          Use Text-based Emotion Guide
                        </span>
                        <p className="text-xs text-muted-foreground/85 leading-normal">
                          Describe the character's speaking style rather than using vectors.
                        </p>
                      </div>
                      <Switch
                        checked={useEmoText}
                        onCheckedChange={(val) => {
                          aiRunningRef.current = false;
                          setUseEmoText(val);
                        }}
                      />
                    </div>

                    {/* Text guide input */}
                    {useEmoText && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground">
                          Specific Emotion Style Guide
                        </label>
                        <Input
                          value={emoText}
                          onChange={(e) => {
                            aiRunningRef.current = false;
                            setEmoText(e.target.value);
                          }}
                          placeholder="e.g. Whispering softly with a warm smile, trembling in despair..."
                          className="bg-background text-sm h-10 focus-visible:ring-indigo-500/20 shadow-sm"
                        />
                      </div>
                    )}

                    {/* Direct 8D Emotion Sliders (Visible when not using text guide) */}
                    {!useEmoText && (
                      <div className="space-y-4 border border-border/60 p-5 rounded-xl bg-background/40">
                        <label className="text-sm font-bold text-muted-foreground block">
                          8-Dimensional Emotion Vector Controller
                        </label>
                        <div className="space-y-3.5">
                          {EMOTION_LABELS.map((label, idx) => (
                            <div key={label} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs md:text-sm font-bold text-muted-foreground">
                                <span className="capitalize">{label}</span>
                                <span className="font-mono text-indigo-400">{(emoVector[idx] * 100).toFixed(0)}%</span>
                              </div>
                              <Slider
                                min={0.0}
                                max={1.0}
                                step={0.05}
                                value={[emoVector[idx]]}
                                onValueChange={(vals) => handleUpdateVectorDim(idx, vals[0])}
                                className="py-1"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Render Synthesize & Save Buttons */}
                  <div className="border-t border-border/40 pt-4 shrink-0 mt-auto flex flex-col gap-2">
                    <Button
                      onClick={handleSynthesizeAudio}
                      className="w-full font-semibold h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center justify-center gap-2 rounded-xl text-sm"
                    >
                      <Wand2Icon className="w-4 h-4 text-indigo-200" />
                      Synthesize & Cast Scene Voiceover
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSaveVoiceover}
                      disabled={isSaving}
                      className="w-full font-semibold h-9 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group shadow-sm flex items-center justify-center gap-2 rounded-xl"
                    >
                      {isSaving ? (
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <SaveIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {isSaving ? "Saving..." : "Save Changes"}
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center opacity-30 my-auto p-6">
                  <AudioLinesIcon className="w-8 h-8 mb-2" />
                  <p className="text-sm">Select a script scene card from the timeline flow to access emotional voice synthesis panels</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse border border-border">
              <InfoIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">No screenplay scenes decomposed yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 leading-relaxed">
              Synthesize and structure dialogues scene-by-scene after decomposing your screenplays and cast.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleAutoExtractDialogues}
              className="mt-6 font-semibold"
            >
              <SparklesIcon className="w-4 h-4 mr-2" />
              AI Auto-Extract Scenes & Dialogues
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
