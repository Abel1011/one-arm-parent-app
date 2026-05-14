import { z } from "zod";

export type AppMode = "home" | "sleep" | "log" | "handoff";
export type AudioTrackId = "white-noise" | "brown-noise" | "rain" | "heartbeat" | "shushing" | "humming";

export const logEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["feeding", "diaper", "nap", "note"]),
  label: z.string(),
  detail: z.string(),
  time: z.string(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

export const sleepSteps = [
  "Dim the lights and lower the room noise.",
  "Hold the baby close and take one slow breath.",
  "Start a gentle sway and keep your voice low.",
  "Wait for the body to soften before transfer.",
  "Place the baby down slowly and pause your hands.",
];

export const audioTracks: Array<{
  id: AudioTrackId;
  label: string;
  command: string;
  tone: "steady" | "soft" | "pulse";
}> = [
  { id: "white-noise", label: "White noise", command: "play white noise", tone: "steady" },
  { id: "brown-noise", label: "Brown noise", command: "play brown noise", tone: "steady" },
  { id: "rain", label: "Rain", command: "play rain", tone: "soft" },
  { id: "heartbeat", label: "Heartbeat", command: "play heartbeat", tone: "pulse" },
  { id: "shushing", label: "Shushing", command: "play shushing", tone: "soft" },
  { id: "humming", label: "Humming", command: "play humming", tone: "soft" },
];

export const modeCards: Array<{
  mode: Exclude<AppMode, "home">;
  label: string;
  command: string;
  description: string;
}> = [
  {
    mode: "sleep",
    label: "Sleep Mode",
    command: "start sleep routine",
    description: "Guided calm routine with audio and step recovery.",
  },
  {
    mode: "log",
    label: "Quick Log",
    command: "log feeding",
    description: "Fast events without forms or typing.",
  },
  {
    mode: "handoff",
    label: "Handoff",
    command: "read the summary",
    description: "A short spoken summary for the next caregiver.",
  },
];

type ParsedCommand =
  | { type: "mode"; mode: Exclude<AppMode, "home"> }
  | { type: "audio"; action: "play"; track: AudioTrackId }
  | { type: "control"; action: "help" | "repeat" | "home" | "pause-audio" | "resume-audio" | "stop-listening" | "start-listening" | "cancel" | "lower-volume" | "raise-volume" | "whisper-on" | "whisper-off" | "toggle-voice-agent" }
  | { type: "sleep"; action: "next" | "back" | "crying" | "try-again" | "log-nap" }
  | { type: "log"; label: string; detail: string; logType: LogEntry["type"] }
  | { type: "handoff"; action: "summary" | "next" | "note-mom" | "note-dad" }
  | { type: "unknown" };

const commandPhrase = (phrase: string, command: ParsedCommand) => ({ phrase, command });

const phraseMap: Array<{ phrase: string; command: ParsedCommand }> = [
  commandPhrase("start sleep routine", { type: "mode", mode: "sleep" }),
  commandPhrase("start nap routine", { type: "mode", mode: "sleep" }),
  commandPhrase("start bedtime routine", { type: "mode", mode: "sleep" }),
  commandPhrase("log feeding", { type: "log", label: "Feeding", detail: "Feeding logged", logType: "feeding" }),
  commandPhrase("log breastfeeding", { type: "log", label: "Breastfeeding", detail: "Breastfeeding logged", logType: "feeding" }),
  commandPhrase("log bottle", { type: "log", label: "Bottle", detail: "Bottle feeding logged", logType: "feeding" }),
  commandPhrase("log diaper", { type: "log", label: "Diaper", detail: "Diaper logged", logType: "diaper" }),
  commandPhrase("wet diaper", { type: "log", label: "Wet diaper", detail: "Wet diaper logged", logType: "diaper" }),
  commandPhrase("dirty diaper", { type: "log", label: "Dirty diaper", detail: "Dirty diaper logged", logType: "diaper" }),
  commandPhrase("leave a note for mom", { type: "handoff", action: "note-mom" }),
  commandPhrase("leave a note for dad", { type: "handoff", action: "note-dad" }),
  commandPhrase("read the summary", { type: "handoff", action: "summary" }),
  commandPhrase("what happened today", { type: "handoff", action: "summary" }),
  commandPhrase("what is next", { type: "handoff", action: "next" }),
  commandPhrase("next step", { type: "sleep", action: "next" }),
  commandPhrase("go back", { type: "sleep", action: "back" }),
  commandPhrase("the baby is crying", { type: "sleep", action: "crying" }),
  commandPhrase("try again", { type: "sleep", action: "try-again" }),
  commandPhrase("log nap", { type: "sleep", action: "log-nap" }),
  commandPhrase("help", { type: "control", action: "help" }),
  commandPhrase("repeat that", { type: "control", action: "repeat" }),
  commandPhrase("go home", { type: "control", action: "home" }),
  commandPhrase("pause audio", { type: "control", action: "pause-audio" }),
  commandPhrase("pause the sound", { type: "control", action: "pause-audio" }),
  commandPhrase("pause the noise", { type: "control", action: "pause-audio" }),
  commandPhrase("stop the sound", { type: "control", action: "pause-audio" }),
  commandPhrase("stop the noise", { type: "control", action: "pause-audio" }),
  commandPhrase("resume audio", { type: "control", action: "resume-audio" }),
  commandPhrase("stop listening", { type: "control", action: "stop-listening" }),
  commandPhrase("start listening", { type: "control", action: "start-listening" }),
  commandPhrase("cancel that", { type: "control", action: "cancel" }),
  commandPhrase("lower volume", { type: "control", action: "lower-volume" }),
  commandPhrase("raise volume", { type: "control", action: "raise-volume" }),
  commandPhrase("whisper", { type: "control", action: "whisper-on" }),
  commandPhrase("whisper mode", { type: "control", action: "whisper-on" }),
  commandPhrase("speak softly", { type: "control", action: "whisper-on" }),
  commandPhrase("use whisper voice", { type: "control", action: "whisper-on" }),
  commandPhrase("normal voice", { type: "control", action: "whisper-off" }),
  commandPhrase("back to normal voice", { type: "control", action: "whisper-off" }),
  commandPhrase("regular voice", { type: "control", action: "whisper-off" }),
  commandPhrase("switch agent", { type: "control", action: "toggle-voice-agent" }),
  commandPhrase("switch voice", { type: "control", action: "toggle-voice-agent" }),
  commandPhrase("other agent", { type: "control", action: "toggle-voice-agent" }),
  ...audioTracks.map((track) => commandPhrase(track.command, { type: "audio", action: "play", track: track.id })),
].sort((left, right) => right.phrase.length - left.phrase.length);

export function resolveCommand(transcript: string): ParsedCommand {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("baby is crying") || normalized.includes("the baby is crying") || normalized.includes("baby is criing") || normalized.includes("baby crying")) {
    return { type: "sleep", action: "crying" };
  }

  const match = phraseMap.find((item) => normalized.includes(item.phrase));
  return match?.command ?? { type: "unknown" };
}

export function makeLogEntry(type: LogEntry["type"], label: string, detail: string): LogEntry {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

  return {
    id,
    type,
    label,
    detail,
    time: new Date().toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }),
  };
}

export function buildHandoffSummary(logs: LogEntry[]) {
  if (logs.length === 0) {
    return "No events logged yet. You can say log feeding, log diaper, or start sleep routine.";
  }

  const latest = logs.slice(0, 3).map((entry) => `${entry.label.toLowerCase()} at ${entry.time}`);
  return `Today so far: ${latest.join(", ")}.`;
}