export type AudioAssetKind = "speech" | "sound" | "music";

type BaseAudioAsset = {
  id: string;
  kind: AudioAssetKind;
  group: "routine" | "confirmations" | "fallbacks" | "emotional" | "sounds" | "music";
  filename: string;
  title: string;
};

export type SpeechAudioAsset = BaseAudioAsset & {
  kind: "speech";
  text: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
    use_speaker_boost?: boolean;
  };
};

export type SoundAudioAsset = BaseAudioAsset & {
  kind: "sound";
  text: string;
  durationSeconds: number;
  loop: boolean;
  promptInfluence?: number;
  modelId?: string;
  localSynthesis?: {
    type: "brown-noise";
    durationSeconds: number;
  };
};

export type MusicAudioAsset = BaseAudioAsset & {
  kind: "music";
  prompt: string;
  musicLengthMs: number;
  forceInstrumental: boolean;
  modelId?: "music_v1";
};

export type AudioAsset = SpeechAudioAsset | SoundAudioAsset | MusicAudioAsset;

export const generatedAudioRoot = "public/audio/generated";
export const publicAudioBase = "/audio/generated";

const calmVoice = {
  stability: 0.76,
  similarity_boost: 0.75,
  style: 0.06,
  speed: 0.9,
  use_speaker_boost: true,
};

export const audioAssets: AudioAsset[] = [
  {
    id: "routine-start-short",
    kind: "speech",
    group: "routine",
    filename: "routine-start-short.mp3",
    title: "Routine start",
    text: "Let's start a short and calm routine.",
    voiceSettings: calmVoice,
  },
  {
    id: "routine-dim-lights",
    kind: "speech",
    group: "routine",
    filename: "routine-dim-lights.mp3",
    title: "Dim lights",
    text: "Dim the lights and take one slow breath with me.",
    voiceSettings: calmVoice,
  },
  {
    id: "routine-gentle-transfer",
    kind: "speech",
    group: "routine",
    filename: "routine-gentle-transfer.mp3",
    title: "Gentle transfer",
    text: "Now try the transfer very gently. Move slowly and pause your hands.",
    voiceSettings: calmVoice,
  },
  {
    id: "routine-baby-woke-up",
    kind: "speech",
    group: "routine",
    filename: "routine-baby-woke-up.mp3",
    title: "Baby woke up",
    text: "The baby woke up. That's okay. Let's go back one step.",
    voiceSettings: { ...calmVoice, stability: 0.8, style: 0.08 },
  },
  {
    id: "confirm-feeding",
    kind: "speech",
    group: "confirmations",
    filename: "confirm-feeding.mp3",
    title: "Feeding confirmed",
    text: "Feeding logged.",
    voiceSettings: { ...calmVoice, speed: 0.95 },
  },
  {
    id: "confirm-diaper",
    kind: "speech",
    group: "confirmations",
    filename: "confirm-diaper.mp3",
    title: "Diaper confirmed",
    text: "Diaper logged.",
    voiceSettings: { ...calmVoice, speed: 0.95 },
  },
  {
    id: "fallback-not-caught",
    kind: "speech",
    group: "fallbacks",
    filename: "fallback-not-caught.mp3",
    title: "Command not caught",
    text: "I didn't catch that. You can say start sleep routine, log feeding, or read the summary.",
    voiceSettings: calmVoice,
  },
  {
    id: "fallback-listening-off",
    kind: "speech",
    group: "fallbacks",
    filename: "fallback-listening-off.mp3",
    title: "Listening off",
    text: "Listening is off. Say start listening or tap the mic button.",
    voiceSettings: calmVoice,
  },
  {
    id: "emotion-you-are-doing-well",
    kind: "speech",
    group: "emotional",
    filename: "emotion-you-are-doing-well.mp3",
    title: "You are doing well",
    text: "You're doing well. One step at a time.",
    voiceSettings: { ...calmVoice, style: 0.1, speed: 0.88 },
  },
  {
    id: "white-noise",
    kind: "sound",
    group: "sounds",
    filename: "white-noise.mp3",
    title: "White noise",
    text: "A seamless soft white noise loop for helping a baby sleep, gentle, even, no melody, no sudden changes.",
    durationSeconds: 30,
    loop: true,
    promptInfluence: 0.45,
  },
  {
    id: "brown-noise",
    kind: "sound",
    group: "sounds",
    filename: "brown-noise.mp3",
    title: "Brown noise",
    text: "Locally synthesized warm brown noise for a nursery, rich low-mid body, smooth and steady, clear and close, mastered at a comfortable listening level.",
    durationSeconds: 180,
    loop: true,
    localSynthesis: {
      type: "brown-noise",
      durationSeconds: 180,
    },
  },
  {
    id: "rain",
    kind: "sound",
    group: "sounds",
    filename: "rain.mp3",
    title: "Rain",
    text: "A seamless gentle rain loop heard from inside a quiet room, soft droplets, calming, no thunder, no birds, no voices.",
    durationSeconds: 30,
    loop: true,
    promptInfluence: 0.5,
  },
  {
    id: "heartbeat",
    kind: "sound",
    group: "sounds",
    filename: "heartbeat.mp3",
    title: "Heartbeat",
    text: "Soft human heartbeat loop, slow, warm, muffled, close and steady, womb-like, no medical beeps, no room ambience.",
    durationSeconds: 30,
    loop: true,
    promptInfluence: 0.88,
  },
  {
    id: "shushing",
    kind: "sound",
    group: "sounds",
    filename: "shushing.mp3",
    title: "Shushing",
    text: "Close-mic human shushing loop, soft steady shhh sound, intimate, clear, soothing, no words, no echo, no room tone.",
    durationSeconds: 30,
    loop: true,
    promptInfluence: 0.9,
  },
  {
    id: "humming",
    kind: "sound",
    group: "sounds",
    filename: "humming.mp3",
    title: "Humming",
    text: "Close-mic human humming loop, gentle warm wordless hum, intimate and soothing, no lyrics, no words, no reverb, no accompaniment, steady and calm.",
    durationSeconds: 30,
    loop: true,
    promptInfluence: 0.86,
  },
  {
    id: "lullaby-hum-short",
    kind: "music",
    group: "music",
    filename: "lullaby-hum-short.mp3",
    title: "Short humming lullaby",
    prompt: "A three-minute original instrumental lullaby for a baby sleep routine, warm humming-like pads, gentle celesta, soft felt piano, subtle evolving arrangement, no lyrics, no recognizable melody, calm and tender from start to finish.",
    musicLengthMs: 180000,
    forceInstrumental: true,
  },
  {
    id: "breathing-calm-bed",
    kind: "music",
    group: "music",
    filename: "breathing-calm-bed.mp3",
    title: "Breathing calm bed",
    prompt: "A three-minute YouTube-style calming breathing bed for a parent holding a baby, warm ambient tones, slow rounded pulse, soft low percussion like a gentle breath, subtle evolving pads, stable relaxing volume, no lyrics, no spoken words, no recognizable melody, no sudden changes.",
    musicLengthMs: 180000,
    forceInstrumental: true,
  },
];

export function getAssetById(assetId: string) {
  return audioAssets.find((asset) => asset.id === assetId);
}

export function getAssetRelativePath(asset: AudioAsset) {
  return `${asset.group}/${asset.filename}`;
}

export function getAssetOutputPath(asset: AudioAsset) {
  return `${generatedAudioRoot}/${getAssetRelativePath(asset)}`;
}

export function getAssetPublicUrl(asset: AudioAsset) {
  return `${publicAudioBase}/${getAssetRelativePath(asset)}`;
}

export function getGeneratedSoundPublicUrl(assetId: string) {
  const asset = getAssetById(assetId);
  return asset && asset.kind !== "speech" ? getAssetPublicUrl(asset) : null;
}