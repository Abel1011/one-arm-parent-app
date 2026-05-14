import type { AudioTrackId } from "@/lib/commands";
import { getGeneratedSoundPublicUrl } from "@/lib/audio-generation/assets";

const sampleRate = 22050;
const durationSeconds = 1.8;

export function getAudioTrackSources(trackId: AudioTrackId) {
  if (process.env.NEXT_PUBLIC_USE_GENERATED_AUDIO === "true") {
    const generatedUrl = getGeneratedSoundPublicUrl(trackId);
    if (generatedUrl) {
      return [generatedUrl];
    }
  }

  return [createAmbientDataUri(trackId)];
}

export function createAmbientDataUri(trackId: AudioTrackId) {
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const samples = new Int16Array(sampleCount);
  let brown = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const noise = seededNoise(index, trackId);
    const fade = Math.min(1, index / 1200, (sampleCount - index) / 1200);
    let value = 0;

    if (trackId === "heartbeat") {
      const beat = Math.exp(-18 * (time % 0.82)) * Math.sin(2 * Math.PI * 62 * time);
      value = beat * 0.75;
    } else if (trackId === "humming") {
      value = Math.sin(2 * Math.PI * (128 + Math.sin(time * 2) * 4) * time) * 0.22;
    } else if (trackId === "rain") {
      const drop = seededNoise(index * 7, trackId) > 0.986 ? 0.75 : 0;
      value = noise * 0.24 + drop;
    } else if (trackId === "shushing") {
      const gate = 0.45 + Math.sin(2 * Math.PI * 0.8 * time) * 0.35;
      value = noise * gate * 0.42;
    } else if (trackId === "brown-noise") {
      brown = (brown + noise * 0.07) / 1.03;
      value = brown * 1.9;
    } else {
      value = noise * 0.28;
    }

    samples[index] = Math.max(-1, Math.min(1, value * fade)) * 0x7fff;
  }

  return `data:audio/wav;base64,${encodeWav(samples)}`;
}

function seededNoise(index: number, seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= index + 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return ((hash ^ (hash >>> 16)) >>> 0) / 2147483648 - 1;
}

function encodeWav(samples: Int16Array) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}