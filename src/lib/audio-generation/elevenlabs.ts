import type { AudioAsset } from "./assets";

const defaultBaseUrl = "https://api.elevenlabs.io";
const defaultOutputFormat = "mp3_44100_128";
const defaultTtsModel = "eleven_v3";
const defaultSoundModel = "eleven_text_to_sound_v2";
const defaultMusicModel = "music_v1";

export type ElevenLabsGenerationOptions = {
  apiKey: string;
  voiceId?: string;
  baseUrl?: string;
  outputFormat?: string;
  ttsModel?: string;
  soundModel?: string;
  musicModel?: string;
};

export async function generateElevenLabsAsset(asset: AudioAsset, options: ElevenLabsGenerationOptions) {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const outputFormat = options.outputFormat ?? defaultOutputFormat;

  if (asset.kind === "speech") {
    if (!options.voiceId) {
      throw new Error("ELEVENLABS_VOICE_ID is required for speech assets.");
    }

    return requestBinary({
      apiKey: options.apiKey,
      url: `${baseUrl}/v1/text-to-speech/${options.voiceId}?output_format=${outputFormat}`,
      body: {
        text: asset.text,
        model_id: asset.modelId ?? options.ttsModel ?? defaultTtsModel,
        language_code: "en",
        voice_settings: asset.voiceSettings,
      },
    });
  }

  if (asset.kind === "sound") {
    return requestBinary({
      apiKey: options.apiKey,
      url: `${baseUrl}/v1/sound-generation?output_format=${outputFormat}`,
      body: {
        text: asset.text,
        duration_seconds: asset.durationSeconds,
        loop: asset.loop,
        prompt_influence: asset.promptInfluence ?? 0.3,
        model_id: asset.modelId ?? options.soundModel ?? defaultSoundModel,
      },
    });
  }

  return requestBinary({
    apiKey: options.apiKey,
    url: `${baseUrl}/v1/music?output_format=${outputFormat}`,
    body: {
      prompt: asset.prompt,
      music_length_ms: asset.musicLengthMs,
      model_id: asset.modelId ?? options.musicModel ?? defaultMusicModel,
      force_instrumental: asset.forceInstrumental,
    },
  });
}

async function requestBinary({ apiKey, url, body }: { apiKey: string; url: string; body: unknown }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`ElevenLabs request failed with ${response.status}: ${details}`);
  }

  return Buffer.from(await response.arrayBuffer());
}