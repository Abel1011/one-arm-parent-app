import { z } from "zod";
import type { AppMode, LogEntry } from "@/lib/commands";

export type ReminderTone = "plum" | "sage" | "terracotta" | "honey";
export type ReminderSource = "voice" | "preset";

export const reminderRecurrenceSchema = z.object({
  everyMinutes: z.number().int().min(1).max(30 * 24 * 60),
});

export type ReminderRecurrence = z.infer<typeof reminderRecurrenceSchema>;

export const softReminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  dueAt: z.number(),
  createdAt: z.number(),
  source: z.enum(["voice", "preset"]),
  tone: z.enum(["plum", "sage", "terracotta", "honey"]),
  recurrence: reminderRecurrenceSchema.optional(),
  alertedAt: z.number().optional(),
});

export type SoftReminder = z.infer<typeof softReminderSchema>;

export type ReminderPreset = {
  id: string;
  title: string;
  detail: string;
  minutes: number;
  tone: ReminderTone;
};

export type ReminderRequest = {
  title: string;
  detail: string;
  minutes: number;
  tone: ReminderTone;
  recurrence?: ReminderRecurrence;
};

const minutePattern = "(?:minute|minutes|min|mins)";
const hourPattern = "(?:hour|hours|hr|hrs)";
const dayPattern = "(?:day|days)";

export function buildReminderPresets(mode: AppMode, logs: LogEntry[]): ReminderPreset[] {
  const latestLog = logs[0];
  const presets: ReminderPreset[] = [];

  if (mode === "sleep") {
    presets.push({
      id: "sleep-check",
      title: "Check next sleep step",
      detail: "See if the room, sway, and breathing still feel steady.",
      minutes: 7,
      tone: "terracotta",
    });
    presets.push({
      id: "sleep-transfer",
      title: "Transfer check",
      detail: "Check if the baby is ready for a slow crib transfer.",
      minutes: 15,
      tone: "terracotta",
    });
  }

  if (latestLog?.type === "feeding") {
    presets.push({
      id: "feeding-follow-up",
      title: "Feeding follow-up",
      detail: "Check comfort after the last feeding.",
      minutes: 120,
      tone: "honey",
    });
    presets.push({
      id: "burp-settle",
      title: "Burp and settle",
      detail: "Quick burp and comfort check after feeding.",
      minutes: 15,
      tone: "honey",
    });
  }

  if (latestLog?.type === "diaper") {
    presets.push({
      id: "diaper-check",
      title: "Diaper check",
      detail: "Quick comfort check after the last diaper change.",
      minutes: 45,
      tone: "sage",
    });
  }

  if (latestLog?.type === "nap") {
    presets.push({
      id: "nap-peek",
      title: "Nap peek",
      detail: "Peek in before the next sleep transition.",
      minutes: 30,
      tone: "plum",
    });
  }

  presets.push(
    {
      id: "quick-baby-check",
      title: "Quick baby check",
      detail: "A short check-in for comfort, breathing, and room calm.",
      minutes: 5,
      tone: "terracotta",
    },
    {
      id: "check-diaper-soon",
      title: "Check diaper soon",
      detail: "A gentle reminder for a quick diaper look.",
      minutes: 20,
      tone: "sage",
    },
    {
      id: "handoff-nudge",
      title: "Prep handoff notes",
      detail: "Capture the next thing the other caregiver should know.",
      minutes: 30,
      tone: "plum",
    },
    {
      id: "breathe-reset",
      title: "Stretch and breathe",
      detail: "Two calm breaths for you before the next task.",
      minutes: 10,
      tone: "sage",
    },
    {
      id: "refill-water",
      title: "Refill water",
      detail: "A tiny reset for you before the next caregiving block.",
      minutes: 25,
      tone: "honey",
    },
  );

  const unique = new Map<string, ReminderPreset>();
  presets.forEach((preset) => {
    if (!unique.has(preset.id)) {
      unique.set(preset.id, preset);
    }
  });

  return Array.from(unique.values()).slice(0, 6);
}

export function parseReminderCommand(transcript: string): ReminderRequest | null {
  const cleaned = normalizeReminderTranscript(transcript);

  if (!cleaned.includes("remind me")) {
    return null;
  }

  const recurringLeadingPattern = new RegExp(`remind me every (\\d+)\\s*(${minutePattern}|${hourPattern}|${dayPattern}) to (.+)`);
  const recurringTrailingPattern = new RegExp(`remind me to (.+?) every (\\d+)\\s*(${minutePattern}|${hourPattern}|${dayPattern})`);
  const dailyLeadingPattern = /remind me daily to (.+)/;
  const dailyTrailingPattern = /remind me to (.+?) daily/;
  const everyDayLeadingPattern = /remind me every day to (.+)/;
  const everyDayTrailingPattern = /remind me to (.+?) every day/;
  const leadingPattern = new RegExp(`remind me in (\\d+)\\s*(${minutePattern}|${hourPattern}) to (.+)`);
  const trailingPattern = new RegExp(`remind me to (.+?) in (\\d+)\\s*(${minutePattern}|${hourPattern})`);

  const recurringLeadingMatch = cleaned.match(recurringLeadingPattern);
  if (recurringLeadingMatch) {
    return buildReminderRequest(recurringLeadingMatch[3], Number.parseInt(recurringLeadingMatch[1], 10), recurringLeadingMatch[2], {
      recurring: true,
    });
  }

  const recurringTrailingMatch = cleaned.match(recurringTrailingPattern);
  if (recurringTrailingMatch) {
    return buildReminderRequest(recurringTrailingMatch[1], Number.parseInt(recurringTrailingMatch[2], 10), recurringTrailingMatch[3], {
      recurring: true,
    });
  }

  const dailyLeadingMatch = cleaned.match(dailyLeadingPattern) ?? cleaned.match(everyDayLeadingPattern);
  if (dailyLeadingMatch) {
    return buildReminderRequest(dailyLeadingMatch[1], 1, "day", { recurring: true });
  }

  const dailyTrailingMatch = cleaned.match(dailyTrailingPattern) ?? cleaned.match(everyDayTrailingPattern);
  if (dailyTrailingMatch) {
    return buildReminderRequest(dailyTrailingMatch[1], 1, "day", { recurring: true });
  }

  const leadingMatch = cleaned.match(leadingPattern);
  if (leadingMatch) {
    return buildReminderRequest(leadingMatch[3], Number.parseInt(leadingMatch[1], 10), leadingMatch[2]);
  }

  const trailingMatch = cleaned.match(trailingPattern);
  if (trailingMatch) {
    return buildReminderRequest(trailingMatch[1], Number.parseInt(trailingMatch[2], 10), trailingMatch[3]);
  }

  return null;
}

export function makeSoftReminder(request: ReminderRequest, source: ReminderSource): SoftReminder {
  const createdAt = Date.now();

  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${createdAt}`,
    title: sentenceCase(request.title),
    detail: request.detail,
    dueAt: createdAt + request.minutes * 60_000,
    createdAt,
    source,
    tone: request.tone,
    recurrence: request.recurrence,
  };
}

export function formatReminderCountdown(dueAt: number, now: number) {
  const diff = dueAt - now;

  if (diff <= 0) {
    return "Due now";
  }

  const totalMinutes = Math.max(1, Math.ceil(diff / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `In ${totalMinutes} min`;
  }

  if (minutes === 0) {
    return `In ${hours}h`;
  }

  return `In ${hours}h ${minutes}m`;
}

export function formatReminderDelay(minutes: number) {
  if (minutes < 60) {
    return `in ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) {
    return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `in ${hours}h ${rest}m`;
}

export function formatReminderRecurrence(everyMinutes: number) {
  if (everyMinutes % (24 * 60) === 0) {
    const days = everyMinutes / (24 * 60);
    return `Every ${days} ${days === 1 ? "day" : "days"}`;
  }

  if (everyMinutes % 60 === 0) {
    const hours = everyMinutes / 60;
    return `Every ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `Every ${everyMinutes} min`;
}

export function formatReminderClock(dueAt: number) {
  return new Date(dueAt).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildReminderRequest(
  rawAction: string,
  amount: number,
  unit: string,
  options?: { recurring?: boolean },
): ReminderRequest | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const action = rawAction.trim().replace(/^(to\s+)/, "");
  if (!action) {
    return null;
  }

  const minutes = durationToMinutes(amount, unit);
  const title = sentenceCase(action);

  return {
    title,
    detail: title,
    minutes,
    tone: inferReminderTone(action),
    recurrence: options?.recurring ? { everyMinutes: minutes } : undefined,
  };
}

function durationToMinutes(amount: number, unit: string) {
  if (unit.startsWith("day")) {
    return amount * 24 * 60;
  }

  if (unit.startsWith("hour") || unit.startsWith("hr")) {
    return amount * 60;
  }

  return amount;
}

function inferReminderTone(action: string): ReminderTone {
  if (/(feed|feeding|bottle|nurse|milk)/.test(action)) {
    return "honey";
  }

  if (/(diaper|change|wipe|comfort)/.test(action)) {
    return "sage";
  }

  if (/(sleep|nap|bed|settle|routine)/.test(action)) {
    return "terracotta";
  }

  return "plum";
}

function normalizeReminderTranscript(transcript: string) {
  return transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : trimmed;
}