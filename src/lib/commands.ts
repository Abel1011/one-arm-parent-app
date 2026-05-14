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

type PhraseEntry = {
  phrase: string;
  command: ParsedCommand;
  tokens: string[];
};

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

const phraseEntries: PhraseEntry[] = phraseMap.map((entry) => ({
  ...entry,
  tokens: entry.phrase.split(" "),
}));

export function resolveCommand(transcript: string, mode: AppMode = "home"): ParsedCommand {
  const normalized = normalizeCommandTranscript(transcript);

  if (normalized.includes("baby is crying") || normalized.includes("the baby is crying") || normalized.includes("baby is criing") || normalized.includes("baby crying")) {
    return { type: "sleep", action: "crying" };
  }

  const match = phraseMap.find((item) => normalized.includes(item.phrase));
  if (match) {
    return match.command;
  }

  const fuzzyMatch = findFuzzyCommandMatch(normalized, mode);
  return fuzzyMatch?.command ?? { type: "unknown" };
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

function normalizeCommandTranscript(transcript: string) {
  const normalized = transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return applyContextualCommandCorrections(normalized);
}

function applyContextualCommandCorrections(transcript: string) {
  return transcript
    .replace(/\b(?:love|luv|look|lock|long|lug) feeding\b/g, "log feeding")
    .replace(/\b(?:love|luv|look|lock|long|lug) breastfeeding\b/g, "log breastfeeding")
    .replace(/\b(?:love|luv|look|lock|long|lug) bottle\b/g, "log bottle")
    .replace(/\b(?:love|luv|look|lock|long|lug) diaper\b/g, "log diaper")
    .replace(/\b(?:love|luv|look|lock|long|lug) nap\b/g, "log nap")
    .replace(/\b(?:love|luv|look|lock|long|lug) wet diaper\b/g, "wet diaper")
    .replace(/\b(?:love|luv|look|lock|long|lug) dirty diaper\b/g, "dirty diaper");
}

function findFuzzyCommandMatch(transcript: string, mode: AppMode) {
  const transcriptTokens = transcript.split(" ").filter(Boolean);
  if (transcriptTokens.length === 0) {
    return null;
  }

  let bestMatch: { entry: PhraseEntry; score: number } | null = null;

  for (const entry of phraseEntries) {
    const score = scorePhraseAgainstTranscript(entry, transcriptTokens, mode);
    if (score === null) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { entry, score };
    }
  }

  if (!bestMatch) {
    return null;
  }

  return isAcceptableFuzzyMatch(bestMatch.score, bestMatch.entry.tokens.length)
    ? bestMatch.entry
    : null;
}

function scorePhraseAgainstTranscript(entry: PhraseEntry, transcriptTokens: string[], mode: AppMode) {
  const minWindowLength = Math.max(1, entry.tokens.length - 1);
  const maxWindowLength = Math.min(transcriptTokens.length, entry.tokens.length + 2);

  if (maxWindowLength < minWindowLength) {
    return null;
  }

  let bestScore = Number.NEGATIVE_INFINITY;

  for (let windowLength = minWindowLength; windowLength <= maxWindowLength; windowLength += 1) {
    for (let startIndex = 0; startIndex <= transcriptTokens.length - windowLength; startIndex += 1) {
      const windowTokens = transcriptTokens.slice(startIndex, startIndex + windowLength);
      const joinedWindow = windowTokens.join(" ");
      const stringScore = similarityScore(joinedWindow, entry.phrase);
      const tokenScore = alignedTokenSimilarity(windowTokens, entry.tokens);
      const anchorScore = anchorTokenSimilarity(windowTokens, entry.tokens);
      const modeBoost = commandModeBoost(entry.command, mode);
      const score = tokenScore * 0.55 + stringScore * 0.35 + anchorScore * 0.1 + modeBoost;

      if (score > bestScore) {
        bestScore = score;
      }
    }
  }

  return Number.isFinite(bestScore) ? bestScore : null;
}

function alignedTokenSimilarity(leftTokens: string[], rightTokens: string[]) {
  const totalSlots = Math.max(leftTokens.length, rightTokens.length);
  let score = 0;

  for (let index = 0; index < totalSlots; index += 1) {
    const left = leftTokens[index];
    const right = rightTokens[index];

    if (!left || !right) {
      score += 0.35;
      continue;
    }

    score += tokenSimilarity(left, right);
  }

  return score / totalSlots;
}

function anchorTokenSimilarity(leftTokens: string[], rightTokens: string[]) {
  let best = 0;

  for (const left of leftTokens) {
    for (const right of rightTokens) {
      best = Math.max(best, tokenSimilarity(left, right));
    }
  }

  return best;
}

function tokenSimilarity(left: string, right: string) {
  if (left === right) {
    return 1;
  }

  const simplifiedLeft = simplifySpokenToken(left);
  const simplifiedRight = simplifySpokenToken(right);

  if (simplifiedLeft === simplifiedRight) {
    return 0.96;
  }

  if (simplifiedLeft.includes(simplifiedRight) || simplifiedRight.includes(simplifiedLeft)) {
    const shorterLength = Math.min(simplifiedLeft.length, simplifiedRight.length);
    if (shorterLength >= 4) {
      return 0.9;
    }
  }

  return similarityScore(simplifiedLeft, simplifiedRight);
}

function simplifySpokenToken(token: string) {
  return token
    .replace(/ough/g, "o")
    .replace(/au/g, "a")
    .replace(/ou/g, "u")
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/ght/g, "t")
    .replace(/ing$/g, "in")
    .replace(/ed$/g, "d")
    .replace(/(.)\1+/g, "$1");
}

function similarityScore(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  const longestLength = Math.max(left.length, right.length);
  if (longestLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / longestLength;
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[rows - 1][columns - 1];
}

function commandModeBoost(command: ParsedCommand, mode: AppMode) {
  if (command.type === "sleep" && mode === "sleep") {
    return 0.04;
  }

  if (command.type === "handoff" && mode === "handoff") {
    return 0.04;
  }

  if (command.type === "log" && mode === "log") {
    return 0.04;
  }

  return 0;
}

function isAcceptableFuzzyMatch(score: number, phraseTokenLength: number) {
  if (phraseTokenLength >= 3) {
    return score >= 0.76;
  }

  if (phraseTokenLength === 2) {
    return score >= 0.82;
  }

  return score >= 0.92;
}