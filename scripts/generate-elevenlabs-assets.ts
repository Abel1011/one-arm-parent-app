import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { config } from "dotenv";
import {
  audioAssets,
  generatedAudioRoot,
  getAssetOutputPath,
  getAssetPublicUrl,
  type AudioAsset,
  type AudioAssetKind,
} from "../src/lib/audio-generation/assets";
import { generateElevenLabsAsset } from "../src/lib/audio-generation/elevenlabs";

const execFileAsync = promisify(execFile);

config({ path: ".env" });
config({ path: ".env.local" });

type CliOptions = {
  dryRun: boolean;
  force: boolean;
  kind?: AudioAssetKind;
  id?: string;
  limit?: number;
};

type ManifestEntry = ReturnType<typeof toManifestEntry>;

const options = parseArgs(process.argv.slice(2));
const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const baseUrl = process.env.ELEVENLABS_BASE_URL;
const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT;
const ttsModel = process.env.ELEVENLABS_TTS_MODEL;
const soundModel = process.env.ELEVENLABS_SOUND_MODEL;
const musicModel = process.env.ELEVENLABS_MUSIC_MODEL;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const selectedAssets = audioAssets
    .filter((asset) => !options.kind || asset.kind === options.kind)
    .filter((asset) => !options.id || asset.id === options.id)
    .slice(0, options.limit ?? audioAssets.length);

  if (selectedAssets.length === 0) {
    throw new Error("No matching audio assets found.");
  }

  if (options.dryRun) {
    printPlan(selectedAssets);
    return;
  }

  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY. Add it to .env before running audio:generate.");
  }

  await mkdir(generatedAudioRoot, { recursive: true });

  const manifestPath = path.join(generatedAudioRoot, "manifest.json");
  const manifest = await readExistingManifest(manifestPath);

  for (const asset of selectedAssets) {
    const outputPath = getAssetOutputPath(asset);
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (existsSync(outputPath) && !options.force) {
      console.log(`Skipping ${asset.id}; file already exists. Use --force to regenerate.`);
      manifest.set(asset.id, toManifestEntry(asset, "skipped"));
      continue;
    }

    console.log(`Generating ${asset.kind}: ${asset.id}`);

    if (asset.kind === "sound" && asset.localSynthesis?.type === "brown-noise") {
      await synthesizeBrownNoise(outputPath, asset.localSynthesis.durationSeconds);
    } else {
      const audio = await generateElevenLabsAsset(asset, {
        apiKey,
        voiceId,
        baseUrl,
        outputFormat,
        ttsModel,
        soundModel,
        musicModel,
      });

      await writeFile(outputPath, audio);
    }

    await masterGeneratedAsset(asset.id, outputPath);

    manifest.set(asset.id, toManifestEntry(asset, "generated"));
  }

  const orderedAssets = audioAssets.flatMap((asset) => {
    const entry = manifest.get(asset.id);
    return entry ? [entry] : [];
  });

  await writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), assets: orderedAssets }, null, 2));

  console.log(`Done. Wrote ${orderedAssets.length} asset entries to ${generatedAudioRoot}/manifest.json.`);
}

async function readExistingManifest(manifestPath: string) {
  const entries = new Map<string, ManifestEntry>();

  if (!existsSync(manifestPath)) {
    return entries;
  }

  const rawManifest = await readFile(manifestPath, "utf8");
  const parsedManifest = JSON.parse(rawManifest) as { assets?: ManifestEntry[] };

  for (const entry of parsedManifest.assets ?? []) {
    entries.set(entry.id, entry);
  }

  return entries;
}

function parseArgs(args: string[]): CliOptions {
  const parsedOptions: CliOptions = {
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
  };

  for (const arg of args) {
    if (arg.startsWith("--kind=")) {
      parsedOptions.kind = arg.replace("--kind=", "") as AudioAssetKind;
    }
    if (arg.startsWith("--id=")) {
      parsedOptions.id = arg.replace("--id=", "");
    }
    if (arg.startsWith("--limit=")) {
      parsedOptions.limit = Number(arg.replace("--limit=", ""));
    }
  }

  return parsedOptions;
}

function printPlan(assets: AudioAsset[]) {
  console.log("Audio generation plan");
  for (const asset of assets) {
    console.log(`- ${asset.kind} | ${asset.id} | ${getAssetPublicUrl(asset)}`);
  }
}

function toManifestEntry(asset: AudioAsset, status: "generated" | "skipped") {
  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    status,
    path: getAssetPublicUrl(asset),
  };
}

async function synthesizeBrownNoise(outputPath: string, durationSeconds: number) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anoisesrc=color=brown:duration=${durationSeconds}:sample_rate=44100:amplitude=0.82`,
    "-af",
    `highpass=f=35,lowpass=f=1400,acompressor=threshold=-20dB:ratio=1.7:attack=40:release=350,alimiter=limit=0.92,loudnorm=I=-17:TP=-1.5:LRA=4,afade=t=in:st=0:d=0.03,afade=t=out:st=${Math.max(0, durationSeconds - 0.03)}:d=0.03`,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    outputPath,
  ]);
}

async function masterGeneratedAsset(assetId: string, outputPath: string) {
  const filter = getMasteringFilter(assetId);
  if (!filter) {
    return;
  }

  const parsedPath = path.parse(outputPath);
  const tempPath = path.join(parsedPath.dir, `${parsedPath.name}.mastered${parsedPath.ext}`);

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    outputPath,
    "-af",
    filter,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    tempPath,
  ]);

  await rename(tempPath, outputPath);
}

function getMasteringFilter(assetId: string) {
  if (assetId === "heartbeat") {
    return "highpass=f=30,lowpass=f=220,volume=28dB,acompressor=threshold=-18dB:ratio=3.5:attack=8:release=160,loudnorm=I=-18:TP=-1.5:LRA=7,alimiter=limit=0.95";
  }

  if (assetId === "shushing") {
    return "highpass=f=120,lowpass=f=6500,volume=18dB,acompressor=threshold=-26dB:ratio=2.8:attack=8:release=140,loudnorm=I=-17:TP=-1.5:LRA=7,alimiter=limit=0.95";
  }

  if (assetId === "humming") {
    return "highpass=f=120,lowpass=f=2800,volume=13dB,acompressor=threshold=-24dB:ratio=2.2:attack=12:release=170,loudnorm=I=-17:TP=-1.5:LRA=6,alimiter=limit=0.95";
  }

  return null;
}