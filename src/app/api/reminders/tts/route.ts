import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SpeechAudioAsset } from "@/lib/audio-generation/assets";
import { generateElevenLabsAsset } from "@/lib/audio-generation/elevenlabs";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(220),
});

const reminderVoice = {
  stability: 0.82,
  similarity_boost: 0.78,
  style: 0.06,
  speed: 0.92,
  use_speaker_boost: true,
} satisfies SpeechAudioAsset["voiceSettings"];

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: "Reminder TTS is not configured." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const asset: SpeechAudioAsset = {
    id: "reminder-tts-preview",
    kind: "speech",
    group: "confirmations",
    filename: "reminder-tts-preview.mp3",
    title: "Reminder TTS preview",
    text: parsed.data.text,
    voiceSettings: reminderVoice,
  };

  const audio = await generateElevenLabsAsset(asset, {
    apiKey,
    voiceId,
    baseUrl: process.env.ELEVENLABS_BASE_URL,
    outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT,
    ttsModel: process.env.ELEVENLABS_TTS_MODEL,
    soundModel: process.env.ELEVENLABS_SOUND_MODEL,
    musicModel: process.env.ELEVENLABS_MUSIC_MODEL,
  });

  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}