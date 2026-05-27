import voicesJson from "../../speech-samples/_voices_local.json";

export interface PresetVoice {
  id: string;
  name: string;
  gender: string;
  description: string;
  path: string;
  locale?: string;
  ageGroup?: string;
}

export const PRESET_VOICES: PresetVoice[] = (voicesJson as any[]).map((item) => ({
  id: item.id,
  name: item.name,
  gender: item.gender,
  description: item.description,
  path: item.sampleUrl || item.path || "",
  locale: item.locale,
  ageGroup: item.ageGroup,
}));
