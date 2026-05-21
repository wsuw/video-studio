export interface PresetVoice {
  id: string;
  name: string;
  gender: "Male" | "Female" | "Narrator" | "Special";
  description: string;
  path: string;
}

export const PRESET_VOICES: PresetVoice[] = [
  {
    id: "voice_01",
    name: "Alpha Heroic Male",
    gender: "Male",
    description: "Cinematic, low-frequency, heroic, and resonant masculine speaker.",
    path: "examples/voice_01.wav",
  },
  {
    id: "voice_02",
    name: "Aria Sweet Female",
    gender: "Female",
    description: "Energetic, clear, sweet, and bright young female voice.",
    path: "examples/voice_02.wav",
  },
  {
    id: "voice_03",
    name: "Evelyn Mature Female",
    gender: "Female",
    description: "Warm, professional, mature, and elegant female speaker.",
    path: "examples/voice_03.wav",
  },
  {
    id: "voice_04",
    name: "Marcus Deep Narrator",
    gender: "Narrator",
    description: "Resonant, authoritative, professional, and deep male narrator.",
    path: "examples/voice_04.wav",
  },
  {
    id: "voice_05",
    name: "Leo Action Hero",
    gender: "Male",
    description: "Dramatic, intense, husky, and raspy action movie style.",
    path: "examples/voice_05.wav",
  },
  {
    id: "voice_06",
    name: "Luna Ethereal Sci-Fi",
    gender: "Female",
    description: "Soft, whispering, futuristic, and ethereal artificial voice.",
    path: "examples/voice_06.wav",
  },
  {
    id: "voice_07",
    name: "Oliver Corporate Pro",
    gender: "Male",
    description: "Calm, polite, professional, and corporate male speaker.",
    path: "examples/voice_07.wav",
  },
  {
    id: "voice_08",
    name: "Chloe Animated Kid",
    gender: "Female",
    description: "High-pitched, enthusiastic, and cheerful cartoonish voice.",
    path: "examples/voice_08.wav",
  },
  {
    id: "voice_09",
    name: "Goliath Deep Monster",
    gender: "Special",
    description: "Extremely deep, guttural, threatening monstrous roar voice.",
    path: "examples/voice_09.wav",
  },
  {
    id: "voice_10",
    name: "Spectre Haunted Whisper",
    gender: "Special",
    description: "Breathy, haunting, and spine-chilling horror character speaker.",
    path: "examples/voice_10.wav",
  },
  {
    id: "voice_11",
    name: "Seraphina Cyber AI",
    gender: "Female",
    description: "Monotone, analytical, precise, and cybernetic android voice.",
    path: "examples/voice_11.wav",
  },
  {
    id: "voice_12",
    name: "Wise Arthur Grandfather",
    gender: "Male",
    description: "Elderly, warm, gravelly, and storytelling grandfather voice.",
    path: "examples/voice_12.wav",
  },
];
