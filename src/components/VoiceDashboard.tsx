"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  type Conversation as ElevenLabsConversationSession,
  type ConversationStatus as ElevenLabsConversationStatus,
} from "@elevenlabs/react";
import { Howl } from "howler";
import { useMachine } from "@xstate/react";
import {
  Baby,
  BellRing,
  Check,
  ClipboardList,
  Clock3,
  HandHeart,
  Home,
  LoaderCircle,
  Mic,
  MicOff,
  Moon,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { Equalizer } from "@/components/Equalizer";
import { VoiceOrb } from "@/components/VoiceOrb";
import { getAudioTrackSources } from "@/lib/audio-assets";
import {
  audioTracks,
  buildHandoffSummary,
  logEntrySchema,
  makeLogEntry,
  modeCards,
  resolveCommand,
  sleepSteps,
  type AppMode,
  type AudioTrackId,
  type LogEntry,
} from "@/lib/commands";
import {
  buildReminderPresets,
  formatReminderClock,
  formatReminderCountdown,
  formatReminderDelay,
  formatReminderRecurrence,
  makeSoftReminder,
  parseReminderCommand,
  softReminderSchema,
  type ReminderTone,
  type SoftReminder,
} from "@/lib/reminders";
import { buttonStyles, cn } from "@/lib/utils";
import { parentAssistantMachine } from "@/machines/parentAssistantMachine";

type SpeechResult = {
  0: { transcript: string };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechResult>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type MicrophoneBarrier = {
  title: string;
  detail: string;
  help: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type ElevenLabsAgentController = {
  start: () => Promise<void>;
  stop: () => void;
  status: ElevenLabsConversationStatus;
  message?: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

const storageKey = "one-arm-parent.logs";
const reminderStorageKey = "one-arm-parent.reminders";
const reminderSoundKey = "one-arm-parent.reminder-sound";
const elevenLabsAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
const whisperElevenLabsAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_WHISPER_AGENT_ID;

type VoiceMode = "default" | "whisper";

const modeIcon: Record<Exclude<AppMode, "home">, typeof Moon> = {
  sleep: Moon,
  log: ClipboardList,
  handoff: HandHeart,
};

const reminderTones: ReminderTone[] = ["plum", "sage", "terracotta", "honey"];

const agentCommandTools = [
  { name: "startSleepRoutine", phrase: "start sleep routine" },
  { name: "logFeeding", phrase: "log feeding" },
  { name: "logBreastfeeding", phrase: "log breastfeeding" },
  { name: "logBottle", phrase: "log bottle" },
  { name: "logDiaper", phrase: "log diaper" },
  { name: "logWetDiaper", phrase: "wet diaper" },
  { name: "logDirtyDiaper", phrase: "dirty diaper" },
  { name: "readSummary", phrase: "read the summary" },
  { name: "whatIsNext", phrase: "what is next" },
  { name: "leaveNoteForMom", phrase: "leave a note for mom" },
  { name: "leaveNoteForDad", phrase: "leave a note for dad" },
  { name: "nextSleepStep", phrase: "next step" },
  { name: "goBackStep", phrase: "go back" },
  { name: "babyIsCrying", phrase: "the baby is crying" },
  { name: "trySleepStepAgain", phrase: "try again" },
  { name: "logNap", phrase: "log nap" },
  { name: "showHelp", phrase: "help" },
  { name: "repeatLastMessage", phrase: "repeat that" },
  { name: "goHome", phrase: "go home" },
  { name: "pauseAudio", phrase: "pause audio" },
  { name: "resumeAudio", phrase: "resume audio" },
  { name: "stopListening", phrase: "stop listening" },
  { name: "startListening", phrase: "start listening" },
  { name: "cancelAction", phrase: "cancel that" },
  { name: "lowerVolume", phrase: "lower volume" },
  { name: "raiseVolume", phrase: "raise volume" },
  { name: "enableWhisperMode", phrase: "whisper" },
  { name: "disableWhisperMode", phrase: "normal voice" },
  { name: "toggleVoiceAgent", phrase: "other agent" },
  { name: "playWhiteNoise", phrase: "play white noise" },
  { name: "playBrownNoise", phrase: "play brown noise" },
  { name: "playRain", phrase: "play rain" },
  { name: "playHeartbeat", phrase: "play heartbeat" },
  { name: "playShushing", phrase: "play shushing" },
  { name: "playHumming", phrase: "play humming" },
] as const;

export function VoiceDashboard() {
  const [snapshot, send] = useMachine(parentAssistantMachine);
  const context = snapshot.context;
  const agentEnabled = Boolean(elevenLabsAgentId || whisperElevenLabsAgentId);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => (whisperElevenLabsAgentId ? "whisper" : "default"));
  const [reminders, setReminders] = useState<SoftReminder[]>([]);
  const [reminderSoundEnabled, setReminderSoundEnabled] = useState(true);
  const [activeReminderAlert, setActiveReminderAlert] = useState<SoftReminder | null>(null);
  const [agentUiState, setAgentUiState] = useState<{ status: ElevenLabsConversationStatus; message?: string }>({
    status: "disconnected",
  });
  const [microphoneBarrier, setMicrophoneBarrier] = useState<MicrophoneBarrier | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(context.listening);
  const agentControllerRef = useRef<ElevenLabsAgentController | null>(null);
  const agentStatusRef = useRef<{ status: ElevenLabsConversationStatus; message?: string } | null>(null);
  const howlsRef = useRef<Partial<Record<AudioTrackId, Howl>>>({});
  const reminderAudioRef = useRef<AudioContext | null>(null);
  const reminderSpeechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const resumeAudioAfterReminderRef = useRef(false);

  const activeMode = modeCards.find((card) => card.mode === context.mode);
  const commandOptions = useMemo(() => getCommandOptions(context.mode, voiceMode), [context.mode, voiceMode]);
  const playbackLabel = context.activeTrack ? context.playback : "No audio";
  const reminderPresets = useMemo(() => buildReminderPresets(context.mode, context.logs), [context.logs, context.mode]);
  const sortedReminders = useMemo(() => [...reminders].sort((left, right) => left.dueAt - right.dueAt), [reminders]);
  const activeAgentId = voiceMode === "whisper" && whisperElevenLabsAgentId ? whisperElevenLabsAgentId : elevenLabsAgentId;
  const agentIsConnecting = agentUiState.status === "connecting";
  const agentIsBusy = agentIsConnecting;
  const agentActionLabel = agentIsConnecting ? "Connecting..." : "Tap to talk";

  useEffect(() => {
    listeningRef.current = context.listening;
  }, [context.listening]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return;
    }

    const parsed = logEntrySchema.array().safeParse(JSON.parse(stored));
    if (parsed.success) {
      send({ type: "RESTORE_LOGS", logs: parsed.data });
    }
  }, [send]);

  useEffect(() => {
    const storedReminders = window.localStorage.getItem(reminderStorageKey);
    if (storedReminders) {
      const parsedReminders = softReminderSchema.array().safeParse(JSON.parse(storedReminders));
      if (parsedReminders.success) {
        setReminders(orderReminders(parsedReminders.data));
      }
    }

    const storedSoundPreference = window.localStorage.getItem(reminderSoundKey);
    if (storedSoundPreference) {
      setReminderSoundEnabled(storedSoundPreference === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(context.logs));
  }, [context.logs]);

  useEffect(() => {
    window.localStorage.setItem(reminderStorageKey, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    window.localStorage.setItem(reminderSoundKey, `${reminderSoundEnabled}`);
  }, [reminderSoundEnabled]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (context.activeTrack) {
      howlsRef.current[context.activeTrack]?.volume(context.volume);
    }
  }, [context.activeTrack, context.volume]);

  useEffect(() => {
    if (activeReminderAlert) {
      return;
    }

    const nextReminder = reminders.find((reminder) => !reminder.alertedAt && reminder.dueAt <= now);
    if (!nextReminder) {
      return;
    }

    setReminders((currentReminders) =>
      currentReminders.map((reminder) =>
        reminder.id === nextReminder.id
          ? { ...reminder, alertedAt: Date.now() }
          : reminder,
      ),
    );

    addLog(makeLogEntry("note", "Reminder due", nextReminder.title));

    if (reminderSoundEnabled) {
      const hasPlayingTrack = Object.values(howlsRef.current).some((howl) => howl?.playing());
      if (hasPlayingTrack) {
        resumeAudioAfterReminderRef.current = true;
        pauseAudio();
      }

      void playReminderAlert(nextReminder);
    } else {
      resumeAudioAfterReminderRef.current = false;
    }

    setActiveReminderAlert(nextReminder);
    send({ type: "SET_MESSAGE", message: `Reminder: ${nextReminder.title}.` });
  }, [activeReminderAlert, now, reminderSoundEnabled, reminders, send]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      Object.values(howlsRef.current).forEach((howl) => howl?.unload());
      reminderSpeechSourceRef.current?.stop();
      window.speechSynthesis?.cancel();
      void reminderAudioRef.current?.close();
    };
  }, []);

  function getHowl(trackId: AudioTrackId) {
    if (!howlsRef.current[trackId]) {
      howlsRef.current[trackId] = new Howl({
        src: getAudioTrackSources(trackId),
        loop: true,
        volume: context.volume,
      });
    }

    return howlsRef.current[trackId];
  }

  async function ensureReminderAudio() {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    if (!reminderAudioRef.current) {
      reminderAudioRef.current = new AudioContextConstructor();
    }

    if (reminderAudioRef.current.state === "suspended") {
      await reminderAudioRef.current.resume();
    }

    return reminderAudioRef.current;
  }

  async function playReminderChime() {
    const audioContext = await ensureReminderAudio();
    if (!audioContext) {
      return;
    }

    const notes = [523.25, 659.25, 783.99];
    const startAt = audioContext.currentTime + 0.01;

    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const offset = index * 0.16;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt + offset);

      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.028, startAt + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.42);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.45);
    });
  }

  async function playReminderAlert(reminder: SoftReminder) {
    await playReminderChime();
    await wait(620);

    const message = buildReminderAlertMessage(reminder);

    try {
      await speakReminderWithElevenLabs(message);
    } catch {
      speakReminderFallback(message);
    }
  }

  async function speakReminderWithElevenLabs(message: string) {
    const audioContext = await ensureReminderAudio();
    if (!audioContext) {
      throw new Error("Reminder audio context is unavailable.");
    }

    const response = await fetch("/api/reminders/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      throw new Error("Reminder TTS request failed.");
    }

    const rawAudio = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(rawAudio.slice(0));

    reminderSpeechSourceRef.current?.stop();

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 0.92;

    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
    source.onended = () => {
      if (reminderSpeechSourceRef.current === source) {
        reminderSpeechSourceRef.current = null;
      }
    };

    reminderSpeechSourceRef.current = source;
  }

  function speakReminderFallback(message: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 0.95;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stopReminderAlertPlayback() {
    reminderSpeechSourceRef.current?.stop();
    reminderSpeechSourceRef.current = null;
    window.speechSynthesis?.cancel();
  }

  function restoreAudioAfterReminder(message: string) {
    if (!resumeAudioAfterReminderRef.current) {
      return;
    }

    resumeAudioAfterReminderRef.current = false;

    if (context.activeTrack) {
      getHowl(context.activeTrack)?.play();
      send({ type: "RESUME_AUDIO" });
      send({ type: "SET_MESSAGE", message });
    }
  }

  function playAudio(trackId: AudioTrackId) {
    Object.values(howlsRef.current).forEach((howl) => howl?.stop());
    getHowl(trackId)?.play();
    send({ type: "PLAY_AUDIO", track: trackId });

    const trackMeta = audioTracks.find((track) => track.id === trackId);
    return `Playing ${trackMeta?.label.toLowerCase() ?? trackId.replace("-", " ")}.`;
  }

  function pauseAudio() {
    let pausedAnyTrack = false;

    Object.values(howlsRef.current).forEach((howl) => {
      if (!howl) {
        return;
      }

      if (howl.playing()) {
        pausedAnyTrack = true;
      }

      howl.pause();
    });

    send({ type: "PAUSE_AUDIO" });

    return pausedAnyTrack || context.activeTrack
      ? "Audio is paused. Say resume audio when you are ready."
      : "No audio is playing right now.";
  }

  function resumeAudio() {
    if (context.activeTrack) {
      getHowl(context.activeTrack)?.play();
    }
    send({ type: "RESUME_AUDIO" });

    return context.activeTrack ? "Audio resumed." : "No audio is selected yet.";
  }

  function buildCareSnapshot() {
    const recentLogs = context.logs.length
      ? context.logs
          .slice(0, 3)
          .map((entry) => `${entry.label} at ${entry.time}`)
          .join(", ")
      : "No care events logged yet.";

    const upcomingReminders = reminders.length
      ? [...reminders]
          .sort((left, right) => left.dueAt - right.dueAt)
          .slice(0, 3)
          .map(
            (reminder) =>
              `${reminder.title} at ${formatReminderClock(reminder.dueAt)}${reminder.recurrence ? ` (${formatReminderRecurrence(reminder.recurrence.everyMinutes).toLowerCase()})` : ""}`,
          )
          .join(", ")
      : "No reminders are scheduled.";

    const activeTrack = context.activeTrack
      ? audioTracks.find((track) => track.id === context.activeTrack)?.label ?? context.activeTrack
      : "None";

    return [
      `Mode: ${context.mode}.`,
      `Voice mode: ${voiceMode}.`,
      `Listening: ${context.listening ? "on" : "off"}.`,
      `Audio: ${activeTrack} (${context.playback}).`,
      context.mode === "sleep"
        ? `Sleep step ${context.sleepStep + 1} of ${sleepSteps.length}: ${sleepSteps[context.sleepStep]}.`
        : null,
      `Recent care log: ${recentLogs}`,
      `Upcoming reminders: ${upcomingReminders}`,
      `App command hints for the current mode: ${commandOptions.join(", ")}.`,
      "Agent mode is command-first: use a dedicated command tool for actions, use scheduleReminder for reminders, and only answer conversationally when no state change is needed.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function scheduleAgentReminder(parameters: Record<string, unknown>) {
    const title = typeof parameters.title === "string" ? parameters.title.trim() : "";
    const detail = typeof parameters.detail === "string" ? parameters.detail.trim() : "";
    const rawMinutes = parsePositiveWholeMinutes(parameters.minutes);
    const rawRepeatEveryMinutes = parsePositiveWholeMinutes(
      parameters.repeatEveryMinutes ?? parameters.everyMinutes ?? parameters.intervalMinutes,
    );
    const recurringFlag = parseReminderBoolean(parameters.recurring ?? parameters.repeats ?? parameters.repeat);
    const minutesToSchedule = Number.isFinite(rawMinutes) ? rawMinutes : rawRepeatEveryMinutes;

    if (!title) {
      return "Reminder rejected because title is required.";
    }

    if (!Number.isFinite(minutesToSchedule) || minutesToSchedule < 1) {
      return "Reminder rejected because minutes must be a number greater than or equal to 1.";
    }

    const minutes = Math.min(30 * 24 * 60, Math.max(1, Math.round(minutesToSchedule)));
    const repeatEveryMinutes = recurringFlag === true || Number.isFinite(rawRepeatEveryMinutes)
      ? Math.min(
          30 * 24 * 60,
          Math.max(1, Math.round(Number.isFinite(rawRepeatEveryMinutes) ? rawRepeatEveryMinutes : minutes)),
        )
      : null;
    const tone = isReminderTone(parameters.tone) ? parameters.tone : "plum";
    const reminderDetail = detail || `Check ${title.toLowerCase()}.`;

    return scheduleReminder(
      makeSoftReminder(
        {
          title,
          detail: reminderDetail,
          minutes,
          tone,
          recurrence: repeatEveryMinutes ? { everyMinutes: repeatEveryMinutes } : undefined,
        },
        "voice",
      ),
    );
  }

  function handleAgentStatusChange(status: ElevenLabsConversationStatus, message?: string) {
    const previous = agentStatusRef.current;

    if (previous?.status === status && previous?.message === message) {
      return;
    }

    agentStatusRef.current = { status, message };
    setAgentUiState({ status, message });

    if (!previous && status === "disconnected") {
      return;
    }

    if (status === "connecting") {
      send({ type: "SET_MESSAGE", message: "Connecting to the ElevenLabs agent..." });
      return;
    }

    if (status === "connected") {
      setMicrophoneBarrier(null);
      listeningRef.current = true;
      send({ type: "START_LISTENING" });
      send({
        type: "SET_MESSAGE",
        message: "Agent connected. Say a command.",
      });
      return;
    }

    listeningRef.current = false;
    send({ type: "STOP_LISTENING" });

    if (status === "error") {
      send({
        type: "SET_MESSAGE",
        message: message
          ? `The ElevenLabs agent hit an error: ${message}`
          : "The ElevenLabs agent hit a problem. Retry the session.",
      });
    }
  }

  function handleAgentTranscript(transcript: string) {
    send({ type: "SET_TRANSCRIPT", transcript });
  }

  function handleAgentReply(message: string) {
    send({ type: "SET_MESSAGE", message });
  }

  function blockForMicrophone(reason: "unsupported" | "permission" | "device") {
    listeningRef.current = false;

    setMicrophoneBarrier(
      reason === "unsupported"
        ? {
            title: "This browser cannot run the hands-free flow.",
            detail: "Speech recognition is unavailable, so the app cannot deliver the voice-first experience required for this demo.",
            help: "Open the app in a supported browser with microphone access enabled, then retry the session.",
          }
        : reason === "device"
          ? {
              title: "No working microphone was detected.",
              detail: "The app needs a microphone to listen for commands, but the browser reported that no capture device is available.",
              help: "Connect a microphone, verify the OS input device, and retry microphone access.",
            }
          : {
              title: "Microphone access is required to use this app.",
              detail: "The browser blocked voice capture, so the hands-free flow cannot start.",
              help: "Allow microphone permission for this site in the browser prompt or site settings, then retry.",
            },
    );

    send({ type: "STOP_LISTENING" });
  }

  function startListening(options?: { auto?: boolean; prewarmAudio?: boolean }) {
    if (agentEnabled) {
      if (!navigator.mediaDevices?.getUserMedia) {
        blockForMicrophone("unsupported");
        return;
      }

      const controller = agentControllerRef.current;

      if (!controller) {
        if (!options?.auto) {
          send({ type: "SET_MESSAGE", message: "The ElevenLabs agent is still loading. Try again in a moment." });
        }
        return;
      }

      if (controller.status === "connected" || controller.status === "connecting") {
        send({ type: "SET_MESSAGE", message: "The ElevenLabs agent is already active." });
        return;
      }

      setMicrophoneBarrier(null);
      send({ type: "SET_MESSAGE", message: "Connecting to the ElevenLabs agent..." });

      void controller.start().catch((error: unknown) => {
        if (isMicrophonePermissionError(error)) {
          blockForMicrophone("permission");
          return;
        }

        if (isMicrophoneDeviceError(error)) {
          blockForMicrophone("device");
          return;
        }

        send({
          type: "SET_MESSAGE",
          message: error instanceof Error
            ? `The ElevenLabs agent could not start: ${error.message}`
            : "The ElevenLabs agent could not start. Try again.",
        });
      });

      return;
    }

    if (options?.prewarmAudio ?? !options?.auto) {
      void ensureReminderAudio();
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      blockForMicrophone("unsupported");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result?.[0]?.transcript?.trim();
        if (transcript) {
          executeTranscript(transcript);
        }
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          blockForMicrophone("permission");
          return;
        }

        if (event.error === "audio-capture") {
          blockForMicrophone("device");
          return;
        }

        send({
          type: "SET_MESSAGE",
          message: "Voice input had a problem. You can use the fallback buttons below.",
        });
      };
      recognition.onend = () => {
        if (listeningRef.current) {
          try {
            recognition.start();
          } catch {
            send({ type: "STOP_LISTENING" });
          }
        }
      };
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setMicrophoneBarrier(null);
      listeningRef.current = true;
      send({ type: "START_LISTENING" });
    } catch {
      const alreadyListening = context.listening || listeningRef.current;
      listeningRef.current = false;

      if (alreadyListening) {
        send({ type: "SET_MESSAGE", message: "Listening is already active." });
        return;
      }

      blockForMicrophone("permission");
    }
  }

  function stopListening() {
    listeningRef.current = false;

    if (agentEnabled) {
      agentControllerRef.current?.stop();
      send({ type: "STOP_LISTENING" });
      return;
    }

    recognitionRef.current?.stop();
    send({ type: "STOP_LISTENING" });
  }

  function addLog(entry: LogEntry, message?: string) {
    send({ type: "ADD_LOG", entry, message });
  }

  function addNoteLog(label: string, detail: string, message?: string) {
    addLog(makeLogEntry("note", label, detail), message);
  }

  function scheduleReminder(reminder: SoftReminder) {
    void ensureReminderAudio();
    setReminders((currentReminders) => orderReminders([reminder, ...currentReminders]));
    const scheduleText = getReminderScheduleText(reminder);
    const message = `Reminder set for ${reminder.title} ${scheduleText}.`;
    addNoteLog("Reminder set", `${reminder.title} ${scheduleText}`);
    send({ type: "SET_MESSAGE", message });
    return message;
  }

  function completeReminder(reminderId: string) {
    const targetReminder = reminders.find((reminder) => reminder.id === reminderId);
    if (!targetReminder) {
      return "Reminder cleared.";
    }

    const rescheduledAt = Date.now();
    const recurrence = targetReminder.recurrence;
    const message = recurrence
      ? `${targetReminder.title} done. Next reminder ${formatReminderDelay(recurrence.everyMinutes)}.`
      : `${targetReminder.title} done.`;

    setReminders((currentReminders) => {
      if (!recurrence) {
        return currentReminders.filter((reminder) => reminder.id !== reminderId);
      }

      return orderReminders(
        currentReminders.map((reminder) =>
          reminder.id === reminderId
            ? {
                ...reminder,
                createdAt: rescheduledAt,
                dueAt: rescheduledAt + recurrence.everyMinutes * 60_000,
                alertedAt: undefined,
              }
            : reminder,
        ),
      );
    });

    if (activeReminderAlert?.id === reminderId) {
      setActiveReminderAlert(null);
      stopReminderAlertPlayback();
      restoreAudioAfterReminder(message);
    }

    addNoteLog(
      recurrence ? "Recurring reminder advanced" : "Reminder completed",
      recurrence
        ? `${targetReminder.title} ${formatReminderRecurrence(recurrence.everyMinutes).toLowerCase()}.`
        : `${targetReminder.title} done.`,
    );

    send({ type: "SET_MESSAGE", message });
    return message;
  }

  function schedulePresetReminder(presetId: string) {
    const preset = reminderPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    scheduleReminder(
      makeSoftReminder(
        {
          title: preset.title,
          detail: preset.detail,
          minutes: preset.minutes,
          tone: preset.tone,
        },
        "preset",
      ),
    );
  }

  function dismissReminder(reminderId: string, message = "Reminder cleared.") {
    const targetReminder = reminders.find((reminder) => reminder.id === reminderId);
    setReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== reminderId));
    if (activeReminderAlert?.id === reminderId) {
      setActiveReminderAlert(null);
      stopReminderAlertPlayback();
      restoreAudioAfterReminder(message);
    }

    if (targetReminder) {
      addNoteLog("Reminder cleared", `${targetReminder.title} cleared.`);
    }

    send({ type: "SET_MESSAGE", message });
    return message;
  }

  function snoozeReminder(reminderId: string, minutes = 10) {
    const targetReminder = reminders.find((reminder) => reminder.id === reminderId);
    const rescheduledAt = Date.now();
    setReminders((currentReminders) =>
      orderReminders(
        currentReminders.map((reminder) =>
          reminder.id === reminderId
            ? {
                ...reminder,
                createdAt: rescheduledAt,
                dueAt: rescheduledAt + minutes * 60_000,
                alertedAt: undefined,
              }
            : reminder,
        ),
      ),
    );
    const message = `Reminder snoozed ${formatReminderDelay(minutes)}.`;
    if (activeReminderAlert?.id === reminderId) {
      setActiveReminderAlert(null);
      stopReminderAlertPlayback();
      restoreAudioAfterReminder(message);
    }

    if (targetReminder) {
      addNoteLog("Reminder snoozed", `${targetReminder.title} ${formatReminderDelay(minutes)}.`);
    }

    send({ type: "SET_MESSAGE", message });
    return message;
  }

  const switchVoiceMode = useCallback((nextMode: VoiceMode) => {
    if (nextMode === "whisper" && !whisperElevenLabsAgentId) {
      const message = "Whisper voice is not configured yet.";
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    if (nextMode === voiceMode) {
      const message = nextMode === "whisper" ? "Whisper voice is already on." : "Normal voice is already on.";
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    setVoiceMode(nextMode);
    const message = nextMode === "whisper"
      ? "Whisper voice enabled. Future replies will be softer."
      : "Normal voice enabled.";

    send({ type: "SET_MESSAGE", message });
    return message;
  }, [send, voiceMode]);

  function executeTranscript(transcript: string) {
    send({ type: "SET_TRANSCRIPT", transcript });

    if (activeReminderAlert) {
      const normalized = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

      if (/(done|mark done|dismiss reminder|clear reminder)/.test(normalized)) {
        return completeReminder(activeReminderAlert.id);
      }

      if (/(tell me later|remind me later|come back later|later|snooze)/.test(normalized)) {
        return snoozeReminder(activeReminderAlert.id, 10);
      }
    }

    const reminderCommand = parseReminderCommand(transcript);
    if (reminderCommand) {
      return scheduleReminder(makeSoftReminder(reminderCommand, "voice"));
    }

    if (transcript.toLowerCase().includes("remind me")) {
      const message = 'Try “remind me in 20 minutes to check diaper” or “remind me every 2 hours to check diaper”.';
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    const command = resolveCommand(transcript, context.mode);

    if (command.type === "unknown") {
      send({ type: "UNRECOGNIZED", transcript });
      return null;
    }

    if (command.type === "mode") {
      send({ type: "SET_MODE", mode: command.mode });
      if (command.mode === "sleep") {
        addNoteLog("Sleep routine", `Started sleep routine. ${sleepSteps[0]}`);
        playAudio("brown-noise");
        send({ type: "SET_MESSAGE", message: sleepSteps[0] });
        return sleepSteps[0];
      }

      return null;
    }

    if (command.type === "audio") {
      return playAudio(command.track);
    }

    if (command.type === "sleep") {
      return handleSleepCommand(command.action);
    }

    if (command.type === "log") {
      const message = `${command.label} logged.`;
      addLog(makeLogEntry(command.logType, command.label, command.detail), message);
      return message;
    }

    if (command.type === "handoff") {
      return handleHandoffCommand(command.action);
    }

    return handleControlCommand(command.action);
  }

  function handleSleepCommand(action: "next" | "back" | "crying" | "try-again" | "log-nap") {
    if (action === "next") {
      const nextStep = Math.min(context.sleepStep + 1, sleepSteps.length - 1);
      send({ type: "NEXT_SLEEP_STEP" });
      addNoteLog(`Sleep step ${nextStep + 1}`, sleepSteps[nextStep]);
      return sleepSteps[nextStep];
    }

    if (action === "back") {
      const nextStep = Math.max(context.sleepStep - 1, 0);
      send({ type: "PREVIOUS_SLEEP_STEP" });
      addNoteLog(`Sleep step ${nextStep + 1}`, sleepSteps[nextStep]);
      return sleepSteps[nextStep];
    }

    if (action === "log-nap") {
      addLog(makeLogEntry("nap", "Nap", "Nap logged"), "Nap logged.");
      return "Nap logged.";
    }

    if (action === "crying") {
      const message = "Stay on the current step. Keep the sound steady and breathe slowly.";
      addNoteLog("Sleep support", "Baby crying guidance used.");
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    const message = sleepSteps[Math.max(context.sleepStep - 1, 0)];
    send({ type: "SET_MESSAGE", message });
    return message;
  }

  function handleHandoffCommand(action: "summary" | "next" | "note-mom" | "note-dad") {
    send({ type: "SET_MODE", mode: "handoff" });

    if (action === "summary") {
      const message = buildHandoffSummary(context.logs);
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    if (action === "next") {
      const message = "Next: keep the room calm and log the next feeding or diaper.";
      send({ type: "SET_MESSAGE", message });
      return message;
    }

    const target = action === "note-mom" ? "Mom" : "Dad";
    addLog(makeLogEntry("note", `Note for ${target}`, `Note left for ${target}`));
    return `Note left for ${target}.`;
  }

  function handleControlCommand(action: string) {
    if (action === "help") {
      const message = commandOptions.join(", ");
      send({ type: "SET_MESSAGE", message });
      return message;
    } else if (action === "repeat") {
      send({ type: "SET_MESSAGE", message: context.assistantMessage });
      return context.assistantMessage;
    } else if (action === "home" || action === "cancel") {
      send({ type: "SET_MODE", mode: "home" });
      return null;
    } else if (action === "pause-audio") {
      return pauseAudio();
    } else if (action === "resume-audio") {
      return resumeAudio();
    } else if (action === "stop-listening") {
      stopListening();
      return "Listening is off. Say start listening or tap the mic button.";
    } else if (action === "start-listening") {
      startListening();
      return "Connecting to voice control.";
    } else if (action === "lower-volume") {
      send({ type: "SET_VOLUME", volume: context.volume - 0.12 });
      return "Volume updated.";
    } else if (action === "raise-volume") {
      send({ type: "SET_VOLUME", volume: context.volume + 0.12 });
      return "Volume updated.";
    } else if (action === "whisper-on") {
      return switchVoiceMode("whisper");
    } else if (action === "whisper-off") {
      return switchVoiceMode("default");
    } else if (action === "toggle-voice-agent") {
      return switchVoiceMode(voiceMode === "whisper" ? "default" : "whisper");
    }

    return null;
  }

  const isPlaying = playbackLabel === "playing";
  const activeTrackMeta = audioTracks.find((t) => t.id === context.activeTrack);
  const isSleepMode = context.mode === "sleep";
  const activeDueReminders = sortedReminders.filter((reminder) => reminder.dueAt <= now);
  const reminderNoticeModeLabel = reminderSoundEnabled ? "Sound notice" : "Silent notice";

  if (microphoneBarrier) {
    return (
      <>
        {agentEnabled && (
          <ElevenLabsAgentBridge
            controllerRef={agentControllerRef}
            executeCareCommand={executeTranscript}
            getCareSnapshot={buildCareSnapshot}
            scheduleAgentReminder={scheduleAgentReminder}
            onReply={handleAgentReply}
            onStatusChange={handleAgentStatusChange}
            onTranscript={handleAgentTranscript}
          />
        )}
        <main className="relative min-h-screen overflow-hidden text-[var(--plum)]">
          <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[var(--honey)]/45 blur-3xl blob-drift" />
          <div aria-hidden className="pointer-events-none absolute -top-10 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[var(--terracotta)]/35 blur-3xl blob-drift" style={{ animationDelay: "-6s" }} />
          <div aria-hidden className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-[var(--sage)]/30 blur-3xl blob-drift" style={{ animationDelay: "-12s" }} />

          <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
            <section className="w-full overflow-hidden rounded-[32px] border border-white/80 bg-white/78 p-6 shadow-[0_30px_60px_-30px_rgba(59,42,47,0.25)] backdrop-blur-md sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <div className="flex items-center justify-center lg:justify-start">
                  <div className="flex h-28 w-28 items-center justify-center rounded-[30px] bg-[var(--terracotta)] text-white shadow-[0_18px_40px_-18px_rgba(196,89,58,0.7)] ring-8 ring-white/70">
                    <MicOff className="h-12 w-12" aria-hidden="true" />
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill icon={MicOff} label="Mic required" tone="slate" />
                    {agentEnabled && <StatusPill icon={Waves} label="Agent mode" tone="amber" />}
                    {voiceMode === "whisper" && <StatusPill icon={VolumeX} label="Whisper voice" tone="blue" />}
                  </div>

                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--terracotta-deep)]">Voice access check</p>
                  <h1 className="font-display mt-2 max-w-3xl text-[2.2rem] font-medium leading-[1.05] text-[var(--plum)] sm:text-[3rem]">
                    {microphoneBarrier.title}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--plum-soft)] sm:text-lg">
                    {microphoneBarrier.detail}
                  </p>

                  <div className="mt-5 rounded-[24px] bg-[var(--cream)] p-4 sm:p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">What to do next</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--plum)] sm:text-base">
                      {microphoneBarrier.help}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      className={buttonStyles({ tone: "warm", size: "lg" })}
                      aria-busy={agentIsBusy}
                      disabled={agentIsBusy}
                      onClick={() => {
                        setMicrophoneBarrier(null);
                        startListening({ prewarmAudio: false });
                      }}
                    >
                      {agentIsBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                      {agentIsBusy ? agentActionLabel : "Retry microphone"}
                    </button>
                    <button className={buttonStyles({ tone: "soft", size: "lg" })} onClick={() => window.location.reload()}>
                      Reload app
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {activeReminderAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--plum)]/82 px-4 py-6 backdrop-blur-md sm:px-6">
          <section className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/20 bg-white/95 p-6 shadow-[0_36px_80px_-32px_rgba(25,18,24,0.65)] sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--terracotta-deep)]">Reminder alert</p>
                  <h2 className="font-display mt-2 text-[2rem] font-medium leading-[1.05] text-[var(--plum)] sm:text-[2.6rem]">{activeReminderAlert.title}</h2>
                </div>
                <button
                  className={buttonStyles({ tone: reminderSoundEnabled ? "warm" : "soft", size: "sm" })}
                  onClick={() => {
                    const nextValue = !reminderSoundEnabled;
                    setReminderSoundEnabled(nextValue);
                    if (nextValue) {
                      void ensureReminderAudio();
                    }
                  }}
                >
                  {reminderSoundEnabled ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
                  {reminderNoticeModeLabel}
                </button>
              </div>

              <div className="rounded-[28px] bg-[var(--cream)] p-5 sm:p-6">
                <div className="flex items-center gap-3 text-[var(--terracotta-deep)]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--terracotta)] text-white shadow-[0_18px_36px_-18px_rgba(196,89,58,0.7)]">
                    <BellRing className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">Due now</p>
                    <p className="text-sm font-semibold text-[var(--plum)]">{formatReminderClock(activeReminderAlert.dueAt)}</p>
                  </div>
                </div>
                <p className="mt-4 text-base leading-7 text-[var(--plum)] sm:text-lg">{activeReminderAlert.detail}</p>
                {activeReminderAlert.recurrence && (
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">
                    {formatReminderRecurrence(activeReminderAlert.recurrence.everyMinutes)}
                  </p>
                )}
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">
                  Say “done” or “tell me later” if voice control is active.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button className={buttonStyles({ tone: "soft", size: "lg" })} onClick={() => snoozeReminder(activeReminderAlert.id, 10)}>
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Tell me later
                </button>
                <button className={buttonStyles({ tone: "warm", size: "lg" })} onClick={() => completeReminder(activeReminderAlert.id)}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {agentEnabled && (
        <ElevenLabsAgentBridge
          agentId={activeAgentId}
          controllerRef={agentControllerRef}
          executeCareCommand={executeTranscript}
          getCareSnapshot={buildCareSnapshot}
          scheduleAgentReminder={scheduleAgentReminder}
          onReply={handleAgentReply}
          onStatusChange={handleAgentStatusChange}
          onTranscript={handleAgentTranscript}
        />
      )}
      <main className="relative min-h-screen overflow-hidden text-[var(--plum)]">
      {/* decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[var(--honey)]/45 blur-3xl blob-drift" />
      <div aria-hidden className="pointer-events-none absolute -top-10 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[var(--terracotta)]/35 blur-3xl blob-drift" style={{ animationDelay: "-6s" }} />
      <div aria-hidden className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-[var(--sage)]/30 blur-3xl blob-drift" style={{ animationDelay: "-12s" }} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--terracotta)] text-white shadow-[0_10px_24px_-10px_rgba(196,89,58,0.7)] ring-4 ring-white/60">
              <Baby className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--terracotta-deep)]">One-Arm Parent</p>
              <h1 className="font-display text-2xl font-medium leading-none text-[var(--plum)]">Care <span className="font-display-wonk italic text-[var(--terracotta-deep)]">console</span></h1>
            </div>
          </div>
          <button className={buttonStyles({ tone: "soft", size: "icon" })} aria-label="Go home" onClick={() => send({ type: "SET_MODE", mode: "home" })}>
            <Home className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {/* HERO — Voice orb + assistant message */}
        <section className="relative mt-2 overflow-hidden rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-[0_30px_60px_-30px_rgba(59,42,47,0.25)] backdrop-blur-md sm:p-8">
          <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--peach)]/80" />
          <div aria-hidden className="absolute right-10 -top-2 h-16 w-16 rounded-full bg-[var(--honey)]/70" />
          <div aria-hidden className="absolute -left-12 bottom-4 h-32 w-32 rounded-full bg-[var(--sage)]/20" />

          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill icon={context.listening ? Mic : MicOff} label={context.listening ? "Listening" : "Muted"} tone={context.listening ? "green" : "slate"} />
                <StatusPill icon={isPlaying ? Volume2 : VolumeX} label={playbackLabel} tone={isPlaying ? "blue" : "slate"} />
                {agentEnabled && <StatusPill icon={agentIsBusy ? LoaderCircle : Waves} label={agentIsBusy ? agentActionLabel : "Agent mode"} tone="amber" />}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">Assistant says</p>
                <p className="font-display mt-2 max-w-2xl text-[2rem] font-medium leading-[1.1] text-[var(--plum)] sm:text-[2.6rem]">
                  {context.assistantMessage}
                </p>
              </div>

              <div className="relative rounded-2xl bg-[var(--plum)] p-4 text-[var(--cream)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--honey)]">Last heard</p>
                  {context.listening && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--terracotta-deep)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                  )}
                </div>
                <p className="mt-1 min-h-6 text-base leading-snug">{context.transcript || "Waiting for a command…"}</p>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <VoiceOrb
                listening={context.listening}
                busy={agentIsBusy}
                disabled={agentIsBusy}
                label={agentActionLabel}
                onClick={context.listening ? stopListening : startListening}
              />
            </div>
          </div>
        </section>

        {/* Sleep banner — contextual */}
        {isSleepMode && (
          <section className="float-in mt-5 relative overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-r from-[var(--blush)] via-[var(--peach)]/70 to-[var(--honey)]/40 p-5 shadow-[0_24px_50px_-30px_rgba(59,42,47,0.3)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[var(--terracotta-deep)] shadow-sm">
                  <Moon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--plum-soft)]">
                    Sleep step <span className="font-display-wonk text-[var(--terracotta-deep)]">{context.sleepStep + 1}</span> of {sleepSteps.length}
                  </p>
                  <p className="font-display mt-1 text-xl font-medium leading-snug text-[var(--plum)] sm:text-2xl">
                    {sleepSteps[context.sleepStep]}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button className={buttonStyles({ tone: "soft", size: "sm" })} onClick={() => handleSleepCommand("back")}>Go back</button>
                <button className={buttonStyles({ tone: "warm", size: "sm" })} onClick={() => handleSleepCommand("next")}>Next step</button>
              </div>
            </div>
          </section>
        )}

        {/* Mode cards */}
        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          {modeCards.map((card) => {
            const Icon = modeIcon[card.mode];
            const active = activeMode?.mode === card.mode;
            return (
              <button
                key={card.mode}
                className={cn(
                  "group relative overflow-hidden rounded-[22px] border bg-white/80 p-5 text-left shadow-[0_20px_40px_-30px_rgba(59,42,47,0.35)] backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_28px_50px_-25px_rgba(59,42,47,0.45)]",
                  active
                    ? "border-[var(--terracotta)] ring-4 ring-[var(--peach)]"
                    : "border-white/70",
                )}
                onClick={() => {
                  if (card.mode === "sleep") {
                    executeTranscript(card.command);
                    return;
                  }

                  send({ type: "SET_MODE", mode: card.mode });
                }}
              >
                <div aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--cream-deep)] transition-transform duration-300 group-hover:scale-125" />
                <div className="relative flex flex-col items-start gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sage)]/15 text-[var(--sage-deep)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="w-fit whitespace-nowrap rounded-full bg-[var(--plum)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cream)] sm:text-[11px]">{card.command}</span>
                </div>
                <h2 className="font-display relative mt-5 text-2xl font-medium tracking-tight text-[var(--plum)]">{card.label}</h2>
                <p className="relative mt-1 text-sm leading-6 text-[var(--plum-soft)]">{card.description}</p>
              </button>
            );
          })}
        </section>

        {/* Bottom grid: Audio (wide) + Care log */}
        <section className="mt-5 grid flex-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_50px_-30px_rgba(59,42,47,0.3)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--plum-soft)]">Audio</p>
                <h2 className="font-display text-2xl font-medium text-[var(--plum)]">Calm <span className="font-display-wonk italic text-[var(--sage-deep)]">tracks</span></h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sage)]/20 text-[var(--sage-deep)]">
                  <Waves className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {audioTracks.map((track) => {
                const isActive = context.activeTrack === track.id;
                const isThisPlaying = isActive && isPlaying;
                return (
                  <button
                    key={track.id}
                    className={cn(
                      "group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm transition-all duration-200",
                      isActive
                        ? "border-[var(--sage)] bg-gradient-to-r from-[var(--sage)]/20 via-white/70 to-[var(--honey)]/20 text-[var(--sage-deep)] shadow-[0_14px_30px_-22px_rgba(79,122,90,0.6)]"
                        : "border-[var(--cream-deep)] bg-white/80 text-[var(--plum)] hover:bg-[var(--cream)] hover:-translate-y-0.5",
                    )}
                    onClick={() => playAudio(track.id)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition",
                          isThisPlaying
                            ? "bg-[var(--sage-deep)] text-white"
                            : isActive
                              ? "bg-[var(--sage)]/30 text-[var(--sage-deep)]"
                              : "bg-[var(--cream-deep)] text-[var(--plum-soft)] group-hover:bg-[var(--peach)]",
                        )}
                      >
                        {isThisPlaying ? (
                          <Equalizer active className="text-white" bars={4} />
                        ) : (
                          <Play className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold leading-tight">{track.label}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--plum-soft)]">
                          {isThisPlaying ? "Playing" : track.command}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--plum-soft)]">Available commands</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {commandOptions.map((command) => (
                  <button key={command} className={buttonStyles({ tone: "soft", size: "sm" })} onClick={() => executeTranscript(command)}>
                    {command}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-5">
            <section className="rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_50px_-30px_rgba(59,42,47,0.3)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--plum-soft)]">Soft reminders</p>
                  <h2 className="font-display text-2xl font-medium text-[var(--plum)]">Gentle <span className="font-display-wonk italic text-[var(--terracotta-deep)]">nudges</span></h2>
                </div>
                <div className="flex items-center gap-2">
                  {activeDueReminders.length > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--terracotta)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--terracotta-deep)] ring-1 ring-[var(--terracotta)]/25">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--terracotta-deep)]" />
                      {activeDueReminders.length} due
                    </span>
                  )}
                  <button
                    className={buttonStyles({ tone: reminderSoundEnabled ? "warm" : "soft", size: "sm" })}
                    onClick={() => {
                      const nextValue = !reminderSoundEnabled;
                      setReminderSoundEnabled(nextValue);
                      if (nextValue) {
                        void ensureReminderAudio();
                      }
                    }}
                  >
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                    {reminderNoticeModeLabel}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {sortedReminders.length === 0 ? (
                  <p className="rounded-2xl bg-[var(--cream)] p-3 text-sm leading-6 text-[var(--plum-soft)]">
                    No reminders yet. Tap a quick preset below or say “remind me in 20 minutes to check diaper” or “remind me every 2 hours to check diaper”.
                  </p>
                ) : (
                  sortedReminders.map((reminder) => {
                    const due = reminder.dueAt <= now;
                    const tone = getReminderToneClasses(reminder.tone, due);

                    return (
                      <div
                        key={reminder.id}
                        className={cn(
                          "rounded-[20px] border bg-white/80 p-4 shadow-[0_12px_30px_-24px_rgba(59,42,47,0.35)] transition",
                          tone.card,
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone.icon)}>
                              {due ? <BellRing className="h-5 w-5" aria-hidden="true" /> : <Clock3 className="h-5 w-5" aria-hidden="true" />}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-[var(--plum)]">{reminder.title}</p>
                                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", tone.badge)}>
                                  {due ? "Due now" : formatReminderCountdown(reminder.dueAt, now)}
                                </span>
                                {reminder.recurrence && (
                                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--plum-soft)] ring-1 ring-black/5">
                                    {formatReminderRecurrence(reminder.recurrence.everyMinutes)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-[var(--plum-soft)]">{reminder.detail}</p>
                              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--plum-soft)]">{formatReminderClock(reminder.dueAt)}</p>
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            {due ? (
                              <>
                                <button className={buttonStyles({ tone: "soft", size: "sm" })} onClick={() => snoozeReminder(reminder.id, 10)}>
                                  Snooze 10m
                                </button>
                                <button className={buttonStyles({ tone: "calm", size: "sm" })} onClick={() => completeReminder(reminder.id)}>
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                  Done
                                </button>
                              </>
                            ) : (
                              <button className={buttonStyles({ tone: "soft", size: "sm" })} onClick={() => dismissReminder(reminder.id)}>
                                <X className="h-4 w-4" aria-hidden="true" />
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--plum-soft)]">Quick set</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reminderPresets.map((preset) => (
                    <button key={preset.id} className={buttonStyles({ tone: "soft", size: "sm" })} onClick={() => schedulePresetReminder(preset.id)}>
                      {preset.title} · {formatReminderDelay(preset.minutes).replace(/^in /, "")}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_50px_-30px_rgba(59,42,47,0.3)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--plum-soft)]">Today</p>
                  <h2 className="font-display text-2xl font-medium text-[var(--plum)]">Care <span className="font-display-wonk italic text-[var(--terracotta-deep)]">log</span></h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--blush)] text-[var(--terracotta-deep)]">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {context.logs.length === 0 ? (
                  <p className="rounded-2xl bg-[var(--cream)] p-3 text-sm text-[var(--plum-soft)]">No events yet.</p>
                ) : (
                  context.logs.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-[var(--cream-deep)] bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[var(--plum)]">{entry.label}</p>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--plum-soft)]">{entry.time}</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--plum-soft)]">{entry.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>

        {/* Floating Now-Playing chip */}
        {context.activeTrack && (
          <div className="float-in pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2 sm:bottom-6">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/70 bg-[var(--plum)]/95 px-4 py-2 text-[var(--cream)] shadow-[0_24px_50px_-15px_rgba(59,42,47,0.55)] backdrop-blur">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--terracotta)] text-white">
                {isPlaying ? <Equalizer active className="text-white" bars={4} /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--honey)]">
                  {isPlaying ? "Now playing" : context.playback === "paused" ? "Paused" : "Selected"}
                </span>
                <span className="text-sm font-semibold">{activeTrackMeta?.label ?? context.activeTrack}</span>
              </span>
              <div className="ml-1 flex items-center gap-1">
                {isPlaying ? (
                  <button onClick={pauseAudio} aria-label="Pause" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button onClick={resumeAudio} aria-label="Resume" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25">
                    <Play className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </main>
    </>
  );
}

function ElevenLabsAgentBridge({
  agentId,
  controllerRef,
  executeCareCommand,
  getCareSnapshot,
  scheduleAgentReminder,
  onReply,
  onStatusChange,
  onTranscript,
}: {
  agentId?: string;
  controllerRef: React.MutableRefObject<ElevenLabsAgentController | null>;
  executeCareCommand: (command: string) => string | null;
  getCareSnapshot: () => string;
  scheduleAgentReminder: (parameters: Record<string, unknown>) => string;
  onReply: (message: string) => void;
  onStatusChange: (status: ElevenLabsConversationStatus, message?: string) => void;
  onTranscript: (transcript: string) => void;
}) {
  const [status, setStatus] = useState<ElevenLabsConversationStatus>("disconnected");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const conversationRef = useRef<ElevenLabsConversationSession | null>(null);
  const startPromiseRef = useRef<Promise<ElevenLabsConversationSession> | null>(null);
  const cancelStartRef = useRef(false);
  const restartWithUpdatedAgentRef = useRef(false);
  const voiceActiveRef = useRef(false);

  const clientTools = useMemo(
    () => ({
      scheduleReminder: (parameters: Record<string, unknown>) => scheduleAgentReminder(parameters),
      getCareSnapshot: () => getCareSnapshot(),
      ...Object.fromEntries(
        agentCommandTools.map((tool) => [tool.name, () => {
          return executeCareCommand(tool.phrase) ?? "";
        }]),
      ),
    }),
    [executeCareCommand, getCareSnapshot, scheduleAgentReminder],
  );

  const start = useCallback(async () => {
    if (!agentId) {
      throw new Error("No ElevenLabs agent is configured for the current voice mode.");
    }

    if (conversationRef.current || startPromiseRef.current) {
      return;
    }

    cancelStartRef.current = false;
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionStream.getTracks().forEach((track) => track.stop());

    setStatus("connecting");
    setMessage(undefined);

    const startPromise = Conversation.startSession({
      agentId,
      connectionType: "websocket",
      clientTools,
      onMessage: (payload) => {
        const text = payload.message.trim();

        if (!text) {
          return;
        }

        if (payload.role === "user") {
          onTranscript(text);
          console.info("[One-Arm Parent][user]", text);
          return;
        }

        onReply(text);
        console.info("[One-Arm Parent][agent]", text);
      },
      onVadScore: ({ vadScore }) => {
        const voiceDetected = vadScore >= 0.45;

        if (voiceDetected === voiceActiveRef.current) {
          return;
        }

        voiceActiveRef.current = voiceDetected;
        console.info("[One-Arm Parent][vad]", voiceDetected ? `voice detected ${vadScore.toFixed(2)}` : "voice ended");
      },
      onStatusChange: ({ status: nextStatus }) => {
        if (nextStatus === "disconnecting") {
          return;
        }

        setStatus(nextStatus);
        setMessage(undefined);

        if (nextStatus === "disconnected") {
          conversationRef.current = null;
        }
      },
      onError: (errorMessage, context) => {
        const detailedMessage = context instanceof Error && context.message !== errorMessage
          ? `${errorMessage}: ${context.message}`
          : errorMessage;

        setStatus("error");
        setMessage(detailedMessage);
      },
      onDisconnect: (details) => {
        conversationRef.current = null;
        startPromiseRef.current = null;

        if (details.reason === "error") {
          setStatus("error");
          setMessage(details.message);
          return;
        }

        setStatus("disconnected");
        setMessage(undefined);
      },
    });

    startPromiseRef.current = startPromise;

    try {
      const session = await startPromise;
      startPromiseRef.current = null;

      if (cancelStartRef.current) {
        await session.endSession();
        return;
      }

      conversationRef.current = session;
    } catch (error) {
      startPromiseRef.current = null;

      if (!cancelStartRef.current) {
        throw error;
      }
    }
  }, [agentId, clientTools, onReply, onTranscript]);

  const stop = useCallback(() => {
    cancelStartRef.current = true;

    const activeConversation = conversationRef.current;
    conversationRef.current = null;
    startPromiseRef.current = null;

    if (activeConversation) {
      void activeConversation.endSession();
    }

    setStatus("disconnected");
    setMessage(undefined);
  }, []);

  useEffect(() => {
    onStatusChange(status, message);
  }, [message, onStatusChange, status]);

  useEffect(() => {
    controllerRef.current = {
      status,
      message,
      start,
      stop,
    };

    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, message, start, status, stop]);

  useEffect(() => {
    if (!agentId) {
      return;
    }

    if (!conversationRef.current && !startPromiseRef.current) {
      return;
    }

    restartWithUpdatedAgentRef.current = true;
    stop();
  }, [agentId, stop]);

  useEffect(() => {
    if (!restartWithUpdatedAgentRef.current || status !== "disconnected") {
      return;
    }

    restartWithUpdatedAgentRef.current = false;
    void start();
  }, [start, status]);

  useEffect(() => {
    return () => {
      cancelStartRef.current = true;
      const activeConversation = conversationRef.current;
      conversationRef.current = null;

      if (activeConversation) {
        void activeConversation.endSession();
      }
    };
  }, []);

  return null;
}

function StatusPill({ icon: Icon, label, tone }: { icon: typeof Mic; label: string; tone: "green" | "blue" | "amber" | "slate" }) {
  const colors = {
    green: "bg-[var(--sage)]/20 text-[var(--sage-deep)] ring-[var(--sage)]/40",
    blue: "bg-[var(--blush)] text-[var(--terracotta-deep)] ring-[var(--peach)]",
    amber: "bg-[var(--honey)]/30 text-[var(--terracotta-deep)] ring-[var(--honey)]/60",
    slate: "bg-white/70 text-[var(--plum-soft)] ring-[var(--cream-deep)]",
  };

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 backdrop-blur", colors[tone])}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function getReminderToneClasses(tone: SoftReminder["tone"], due: boolean) {
  const palette = {
    plum: {
      card: due ? "border-[var(--plum)]/20 bg-[var(--plum)]/5" : "border-[var(--plum)]/10",
      icon: due ? "bg-[var(--plum)] text-white" : "bg-[var(--plum)]/10 text-[var(--plum)]",
      badge: due ? "bg-[var(--plum)] text-white" : "bg-[var(--plum)]/10 text-[var(--plum)]",
    },
    sage: {
      card: due ? "border-[var(--sage)]/30 bg-[var(--sage)]/10" : "border-[var(--sage)]/15",
      icon: due ? "bg-[var(--sage-deep)] text-white" : "bg-[var(--sage)]/20 text-[var(--sage-deep)]",
      badge: due ? "bg-[var(--sage-deep)] text-white" : "bg-[var(--sage)]/20 text-[var(--sage-deep)]",
    },
    terracotta: {
      card: due ? "border-[var(--terracotta)]/30 bg-[var(--terracotta)]/10" : "border-[var(--terracotta)]/15",
      icon: due ? "bg-[var(--terracotta-deep)] text-white" : "bg-[var(--terracotta)]/15 text-[var(--terracotta-deep)]",
      badge: due ? "bg-[var(--terracotta-deep)] text-white" : "bg-[var(--terracotta)]/15 text-[var(--terracotta-deep)]",
    },
    honey: {
      card: due ? "border-[var(--honey)]/40 bg-[var(--honey)]/20" : "border-[var(--honey)]/20",
      icon: due ? "bg-[var(--honey)] text-[var(--terracotta-deep)]" : "bg-[var(--honey)]/25 text-[var(--terracotta-deep)]",
      badge: due ? "bg-[var(--honey)] text-[var(--terracotta-deep)]" : "bg-[var(--honey)]/25 text-[var(--terracotta-deep)]",
    },
  };

  return palette[tone];
}

function buildReminderAlertMessage(reminder: SoftReminder) {
  const detail = reminder.detail.trim().endsWith(".") ? reminder.detail.trim() : `${reminder.detail.trim()}.`;
  const recurrence = reminder.recurrence
    ? ` This reminder repeats ${formatReminderRecurrence(reminder.recurrence.everyMinutes).toLowerCase()}.`
    : "";

  return `Soft reminder. ${reminder.title}. ${detail}${recurrence}`;
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function getCommandOptions(mode: AppMode, voiceMode: VoiceMode) {
  const voiceSwitchCommands = voiceMode === "whisper"
    ? ["normal voice", "other agent"]
    : ["whisper", "other agent"];

  if (mode === "sleep") {
    return ["next step", "go back", "play rain", "the baby is crying", ...voiceSwitchCommands, "remind me in 7 minutes to check the next sleep step", "remind me every 2 hours to check the nursery"];
  }

  if (mode === "log") {
    return ["log feeding", "log diaper", "wet diaper", "dirty diaper", ...voiceSwitchCommands, "remind me in 45 minutes to check diaper", "remind me every 2 hours to check diaper"];
  }

  if (mode === "handoff") {
    return ["read the summary", "what is next", "leave a note for mom", ...voiceSwitchCommands, "remind me in 30 minutes to prep handoff notes", "remind me every day to prep handoff notes"];
  }

  return ["start sleep routine", "log feeding", "read the summary", "pause audio", ...voiceSwitchCommands, "remind me in 20 minutes to check diaper", "remind me every 2 hours to check diaper"];
}

function isMicrophonePermissionError(error: unknown) {
  return error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error.name);
}

function isMicrophoneDeviceError(error: unknown) {
  return error instanceof DOMException && ["NotFoundError", "DevicesNotFoundError", "NotReadableError", "AbortError"].includes(error.name);
}

function isReminderTone(value: unknown): value is ReminderTone {
  return typeof value === "string" && reminderTones.includes(value as ReminderTone);
}

function orderReminders(reminders: SoftReminder[]) {
  return [...reminders].sort((left, right) => left.dueAt - right.dueAt).slice(0, 6);
}

function getReminderScheduleText(reminder: Pick<SoftReminder, "createdAt" | "dueAt" | "recurrence">) {
  const delayMinutes = Math.max(1, Math.round((reminder.dueAt - reminder.createdAt) / 60_000));
  const recurrence = reminder.recurrence
    ? ` and repeats ${formatReminderRecurrence(reminder.recurrence.everyMinutes).toLowerCase()}`
    : "";

  return `${formatReminderDelay(delayMinutes)}${recurrence}`;
}

function parsePositiveWholeMinutes(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string" && value.trim()) {
    return Number.parseInt(value, 10);
  }

  return Number.NaN;
}

function parseReminderBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "repeat", "repeats", "recurring"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "once", "one-time", "one time"].includes(normalized)) {
    return false;
  }

  return null;
}