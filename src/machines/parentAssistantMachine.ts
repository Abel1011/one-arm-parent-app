import { assign, setup } from "xstate";
import type { AppMode, AudioTrackId, LogEntry } from "@/lib/commands";
import { sleepSteps } from "@/lib/commands";

export type PlaybackStatus = "idle" | "playing" | "paused";

export type AssistantContext = {
  mode: AppMode;
  listening: boolean;
  playback: PlaybackStatus;
  activeTrack: AudioTrackId | null;
  volume: number;
  transcript: string;
  assistantMessage: string;
  sleepStep: number;
  logs: LogEntry[];
  errorCount: number;
};

type AssistantEvent =
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "PLAY_AUDIO"; track: AudioTrackId }
  | { type: "PAUSE_AUDIO" }
  | { type: "RESUME_AUDIO" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_MESSAGE"; message: string }
  | { type: "SET_TRANSCRIPT"; transcript: string }
  | { type: "UNRECOGNIZED"; transcript: string }
  | { type: "NEXT_SLEEP_STEP" }
  | { type: "PREVIOUS_SLEEP_STEP" }
  | { type: "ADD_LOG"; entry: LogEntry; message?: string }
  | { type: "RESTORE_LOGS"; logs: LogEntry[] };

const modeMessages: Record<AppMode, string> = {
  home: "You can say start sleep routine, log feeding, or read the summary.",
  sleep: sleepSteps[0],
  log: "You can say log feeding, log diaper, wet diaper, or dirty diaper.",
  handoff: "You can say read the summary, what is next, or go home.",
};

export const parentAssistantMachine = setup({
  types: {} as {
    context: AssistantContext;
    events: AssistantEvent;
  },
}).createMachine({
  id: "parentAssistant",
  context: {
    mode: "home",
    listening: false,
    playback: "idle",
    activeTrack: null,
    volume: 0.45,
    transcript: "",
    assistantMessage: "You can say start sleep routine, log feeding, or read the summary.",
    sleepStep: 0,
    logs: [],
    errorCount: 0,
  },
  on: {
    START_LISTENING: {
      actions: assign({
        listening: true,
        errorCount: 0,
        assistantMessage: "Listening is on.",
      }),
    },
    STOP_LISTENING: {
      actions: assign({
        listening: false,
        assistantMessage: "Listening is off. Say start listening or tap the mic button.",
      }),
    },
    PLAY_AUDIO: {
      actions: assign(({ event }) => ({
        playback: "playing" as const,
        activeTrack: event.track,
        assistantMessage: `Playing ${event.track.replace("-", " ")}.`,
        errorCount: 0,
      })),
    },
    PAUSE_AUDIO: {
      actions: assign({
        playback: "paused",
        assistantMessage: "Audio is paused. Say resume audio when you are ready.",
      }),
    },
    RESUME_AUDIO: {
      actions: assign(({ context }) => ({
        playback: context.activeTrack ? "playing" : "idle",
        assistantMessage: context.activeTrack ? "Audio resumed." : "No audio is selected yet.",
      })),
    },
    SET_VOLUME: {
      actions: assign(({ event }) => ({
        volume: Math.max(0.1, Math.min(1, event.volume)),
        assistantMessage: "Volume updated.",
      })),
    },
    SET_MODE: {
      actions: assign(({ event }) => ({
        mode: event.mode,
        assistantMessage: modeMessages[event.mode],
        sleepStep: event.mode === "sleep" ? 0 : 0,
        errorCount: 0,
      })),
    },
    SET_MESSAGE: {
      actions: assign(({ event }) => ({
        assistantMessage: event.message,
        errorCount: 0,
      })),
    },
    SET_TRANSCRIPT: {
      actions: assign(({ event }) => ({
        transcript: event.transcript,
      })),
    },
    UNRECOGNIZED: {
      actions: assign(({ context, event }) => ({
        transcript: event.transcript,
        errorCount: context.errorCount + 1,
        assistantMessage:
          context.errorCount >= 1
            ? "I did not catch that. Use one of the fallback buttons below."
            : "I did not catch that. You can say start sleep routine, log feeding, or read the summary.",
      })),
    },
    NEXT_SLEEP_STEP: {
      actions: assign(({ context }) => {
        const nextStep = Math.min(context.sleepStep + 1, sleepSteps.length - 1);
        return {
          mode: "sleep" as const,
          sleepStep: nextStep,
          assistantMessage: sleepSteps[nextStep],
          errorCount: 0,
        };
      }),
    },
    PREVIOUS_SLEEP_STEP: {
      actions: assign(({ context }) => {
        const nextStep = Math.max(context.sleepStep - 1, 0);
        return {
          mode: "sleep" as const,
          sleepStep: nextStep,
          assistantMessage: sleepSteps[nextStep],
          errorCount: 0,
        };
      }),
    },
    ADD_LOG: {
      actions: assign(({ context, event }) => ({
        logs: [event.entry, ...context.logs].slice(0, 8),
        assistantMessage: event.message ?? `${event.entry.label} logged.`,
        errorCount: 0,
      })),
    },
    RESTORE_LOGS: {
      actions: assign(({ event }) => ({
        logs: event.logs,
      })),
    },
  },
});