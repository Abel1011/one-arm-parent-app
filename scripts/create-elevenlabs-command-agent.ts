import { config as loadEnv } from "dotenv";

type ToolParametersSchema = {
  type: "object";
  description?: string;
  properties: Record<string, unknown>;
  required?: string[];
};

type ToolDefinition = {
  name: string;
  description: string;
  expects_response: boolean;
  parameters?: ToolParametersSchema;
};

type ListToolsResponse = {
  tools: Array<{
    id: string;
    tool_config?: {
      name?: string;
    };
  }>;
};

type CreateToolResponse = {
  id: string;
};

type CreateAgentResponse = {
  agent_id: string;
};

loadEnv({ path: ".env" });

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const whisperVoiceId = process.env.ELEVENLABS_WHISPER_VOICE_ID;
const ttsModel = process.env.ELEVENLABS_TTS_MODEL;
const currentAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
const currentWhisperAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_WHISPER_AGENT_ID;

if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY was not found in .env");
}

const elevenLabsApiKey: string = apiKey;
const devHostAllowlist = [
  { hostname: "localhost" },
  { hostname: "127.0.0.1" },
  { hostname: "localhost:3000" },
  { hostname: "localhost:3001" },
  { hostname: "127.0.0.1:3000" },
  { hostname: "127.0.0.1:3001" },
];

const toolDefinitions: ToolDefinition[] = [
  { name: "startSleepRoutine", description: "Use when the user wants to begin the guided sleep, nap, or bedtime routine and should hear the first sleep step aloud.", expects_response: true },
  { name: "logFeeding", description: "Use when the user wants to log a feeding event.", expects_response: false },
  { name: "logBreastfeeding", description: "Use when the user specifically mentions breastfeeding and wants that logged.", expects_response: false },
  { name: "logBottle", description: "Use when the user wants to log a bottle feeding.", expects_response: false },
  { name: "logDiaper", description: "Use when the user wants to log a diaper event without specifying wet or dirty.", expects_response: false },
  { name: "logWetDiaper", description: "Use when the user says the diaper was wet or wants to log a wet diaper.", expects_response: false },
  { name: "logDirtyDiaper", description: "Use when the user says the diaper was dirty or wants to log a dirty diaper.", expects_response: false },
  { name: "readSummary", description: "Use when the user asks for the caregiver handoff summary or asks what happened today. Read the returned summary aloud.", expects_response: true },
  { name: "whatIsNext", description: "Use when the user asks what should happen next in the current care flow or asks for the next instruction aloud.", expects_response: true },
  { name: "leaveNoteForMom", description: "Use when the user wants to leave a note for mom.", expects_response: false },
  { name: "leaveNoteForDad", description: "Use when the user wants to leave a note for dad.", expects_response: false },
  { name: "nextSleepStep", description: "Use when the user says next step, what next, continue, siguiente paso, or wants the next sleep instruction read aloud.", expects_response: true },
  { name: "goBackStep", description: "Use when the user wants to go back one step in the sleep routine and hear that step again.", expects_response: true },
  { name: "babyIsCrying", description: "Use when the user says the baby is crying, baby crying, fussing, or el bebe llora and needs immediate soothing guidance during the sleep flow.", expects_response: true },
  { name: "trySleepStepAgain", description: "Use when the user wants to repeat the current or previous sleep guidance step aloud.", expects_response: true },
  { name: "logNap", description: "Use when the user wants to log a nap event.", expects_response: false },
  { name: "showHelp", description: "Use when the user asks for help, supported commands, or what they can say. Read the returned help aloud.", expects_response: true },
  { name: "repeatLastMessage", description: "Use when the user asks to repeat the last message or instruction aloud.", expects_response: true },
  { name: "goHome", description: "Use when the user wants to return the app to the home mode.", expects_response: false },
  { name: "pauseAudio", description: "Use when the user wants to pause, hush, mute, stop, or quiet the currently playing calming sound, noise, or audio.", expects_response: true },
  { name: "resumeAudio", description: "Use when the user wants to resume the currently selected calming sound or continue the paused audio.", expects_response: true },
  { name: "stopListening", description: "Use when the user wants the app to stop listening for voice commands.", expects_response: false },
  { name: "startListening", description: "Use when the user wants the app to start listening for voice commands.", expects_response: false },
  { name: "cancelAction", description: "Use when the user wants to cancel the current action.", expects_response: false },
  { name: "lowerVolume", description: "Use when the user wants to lower the calming audio volume.", expects_response: true },
  { name: "raiseVolume", description: "Use when the user wants to raise the calming audio volume.", expects_response: true },
  { name: "enableWhisperMode", description: "Use when the user says whisper, whisper mode, speak softly, or asks for a quieter speaking voice.", expects_response: true },
  { name: "disableWhisperMode", description: "Use when the user says normal voice, regular voice, or asks to leave whisper mode.", expects_response: true },
  { name: "toggleVoiceAgent", description: "Use when the user says other agent, switch agent, switch voice, or wants to swap between whisper and normal voice without naming one directly.", expects_response: true },
  { name: "playWhiteNoise", description: "Use when the user wants to play white noise.", expects_response: false },
  { name: "playBrownNoise", description: "Use when the user wants to play brown noise.", expects_response: false },
  { name: "playRain", description: "Use when the user wants to play rain audio.", expects_response: false },
  { name: "playHeartbeat", description: "Use when the user wants to play the heartbeat track.", expects_response: false },
  { name: "playShushing", description: "Use when the user wants to play shushing audio.", expects_response: false },
  { name: "playHumming", description: "Use when the user wants to play humming audio.", expects_response: false },
  {
    name: "scheduleReminder",
    description: "Use to schedule a one-time or recurring reminder in the app whenever the user asks to be reminded about something, including requests like every 2 hours or cada 2 horas. Ask a concise follow-up question only if the title or delay is missing.",
    expects_response: true,
    parameters: {
      type: "object",
      description: "Structured input for scheduling a reminder in the app.",
      properties: {
        title: { type: "string", description: "Short reminder title, for example Check diaper or Stretch and breathe." },
        detail: { type: "string", description: "One sentence with a little more detail for the reminder." },
        minutes: { type: "string", description: "Initial delay in minutes as a positive integer string, for example 5, 20, or 45." },
        recurring: { type: "boolean", description: "Optional. Set to true when the reminder should repeat." },
        repeatEveryMinutes: {
          type: "string",
          description: "Optional repeat cadence in minutes as a positive integer string. For recurring reminders, omit this only when the repeat cadence should match minutes.",
        },
        tone: {
          type: "string",
          description: "Optional reminder tone.",
          enum: ["plum", "sage", "terracotta", "honey"],
        },
      },
      required: ["title", "minutes"],
    },
  },
  {
    name: "getCareSnapshot",
    description: "Use when you need the current app state before answering a question. Returns the active mode, current audio, recent logs, reminders, and command hints.",
    expects_response: true,
  },
];

const prompt = `You are the voice layer for the One-Arm Parent care console.

Your job is to control the app through tools, not to improvise app actions in plain speech.

Behavior rules:
- Critical interpretation rule:
- Voice input may be incomplete, muffled, whispered, interrupted, mispronounced, or partially transcribed because the user is often speaking quietly near a baby.
- You MUST aggressively infer intent from context instead of relying on exact wording.
- Prioritize semantic meaning over literal transcription.
- Assume unclear words are probably related to baby care, sleep, feeding, diapers, audio, reminders, routines, or handoff actions.
- If a phrase is close to a known command, treat it as that command and call the tool.
- Do not fail a command just because one or two words were transcribed incorrectly.
- Interpret short, fragmented, low-confidence, or imperfect speech as intentional commands whenever a reasonable baby-care interpretation exists.
- Only ask for clarification if multiple tool actions are equally plausible or the request is genuinely ambiguous after contextual inference.
- The user may intentionally speak softly or unclearly to avoid waking the baby. You must compensate for this by being highly tolerant of transcription mistakes.
- Be command-first.
- Prefer tools over free-form replies whenever the user asks the app to do something.
- Understand short command requests in English and map them by meaning.
- Use the dedicated command tools for supported actions.
- Use scheduleReminder for reminders instead of narrating a pretend action, including recurring reminders.
- Use getCareSnapshot before answering questions about current app state if you need live context.
- Do not invent app actions, state, or tools.
- Do not claim an action was completed unless you actually called the relevant tool.
- Keep spoken replies short, calm, and practical.
- For direct app commands, prefer silence after the tool call.
- Do not ask follow-up questions like are you there, anything else, or sigues ahi unless the user explicitly starts a conversation.
- Only speak after a tool call when information is missing, the action failed, or the user explicitly asked a question that needs a spoken answer.
- If the user asks for something unsupported, explain briefly that this demo handles sleep guidance, care logging, handoff summaries, calming audio, and reminders.
- If the user wording matches the meaning of a known command, call the matching tool even if the phrasing is different.
- If the user asks for whisper mode, a softer voice, or speak softly, use enableWhisperMode.
- If the user asks for normal voice again, use disableWhisperMode.
- If the user asks for the other agent or to switch agents without naming a voice, use toggleVoiceAgent.
- If scheduleReminder is missing required information, ask one concise follow-up question.
- When the user asks for a recurring reminder, set recurring to true and pass repeatEveryMinutes when the repeat cadence differs from the first delay.

Tool usage policy:
- Use startSleepRoutine for starting the sleep, nap, or bedtime flow.
- Use logFeeding, logBreastfeeding, logBottle, logDiaper, logWetDiaper, logDirtyDiaper, and logNap for care logging.
- Use readSummary, whatIsNext, leaveNoteForMom, and leaveNoteForDad for handoff and status tasks.
- Use nextSleepStep, goBackStep, babyIsCrying, and trySleepStepAgain for the guided sleep flow.
- Use playWhiteNoise, playBrownNoise, playRain, playHeartbeat, playShushing, playHumming, pauseAudio, resumeAudio, lowerVolume, and raiseVolume for audio control.
- Use enableWhisperMode and disableWhisperMode for voice-style switching.
- Use toggleVoiceAgent when the user wants the other voice agent or wants to swap agents without specifying which one.
- Use goHome, startListening, stopListening, cancelAction, showHelp, and repeatLastMessage for app control.
- Use scheduleReminder for all reminder requests, including recurring ones.
- Use getCareSnapshot for questions about current mode, active audio, reminders, logs, or other live app state.

Response style:
- For guidance and status tools such as sleep steps, summaries, help, repeat, whisper mode changes, and pause or resume audio, say the tool result aloud in one short sentence.
- For silent action tools such as logging, starting sounds, or going home, stay silent after success unless a spoken reply is necessary.
- Never ask if the user is still there after completing a command.
- Only have a longer conversation if the user clearly wants guidance instead of an action.`;

function buildToolConfig(definition: ToolDefinition) {
  return {
    type: "client" as const,
    name: definition.name,
    description: definition.description,
    expects_response: definition.expects_response,
    parameters: definition.parameters ?? null,
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": elevenLabsApiKey,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API ${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function isExpressiveTtsNotAllowed(error: unknown) {
  return error instanceof Error && error.message.includes("expressive_tts_not_allowed");
}

function buildConversationConfig(toolIds: string[], preferredVoiceId?: string) {
  const conversationConfig: Record<string, unknown> = {
    asr: {
      provider: "elevenlabs",
      quality: "high",
    },
    turn: {
      mode: "turn",
      turn_timeout: 12,
      silence_end_call_timeout: -1,
      turn_eagerness: "patient",
      speculative_turn: false,
      retranscribe_on_turn_timeout: false,
      soft_timeout_config: {
        timeout_seconds: -1,
        message: "Okay.",
        use_llm_generated_message: false,
      },
    },
    agent: {
      first_message: "",
      language: "en",
      prompt: {
        prompt,
        tool_ids: toolIds,
      },
    },
  };

  if (preferredVoiceId || ttsModel) {
    conversationConfig.tts = {
      ...(preferredVoiceId ? { voice_id: preferredVoiceId } : {}),
      ...(ttsModel ? { model_id: ttsModel } : {}),
    };
  }

  return conversationConfig;
}

async function upsertAgent({
  agentId,
  name,
  tags,
  toolIds,
  preferredVoiceId,
}: {
  agentId?: string;
  name: string;
  tags: string[];
  toolIds: string[];
  preferredVoiceId?: string;
}) {
  let nextAgentId = agentId;
  let agentAction: "created" | "updated" = "updated";

  if (!nextAgentId) {
    const createdAgent = await requestJson<CreateAgentResponse>("/v1/convai/agents/create", {
      method: "POST",
      body: JSON.stringify({
        name,
        tags,
        conversation_config: {},
      }),
    });

    nextAgentId = createdAgent.agent_id;
    agentAction = "created";
  }

  const conversationConfig = buildConversationConfig(toolIds, preferredVoiceId);
  const updatePayload = {
    name,
    tags,
    conversation_config: conversationConfig,
    platform_settings: {
      auth: {
        allowlist: devHostAllowlist,
      },
    },
  };

  try {
    await requestJson(`/v1/convai/agents/${nextAgentId}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    });
  } catch (error) {
    if (!isExpressiveTtsNotAllowed(error) || !conversationConfig.tts || !("model_id" in (conversationConfig.tts as Record<string, unknown>))) {
      throw error;
    }

    delete (conversationConfig.tts as Record<string, unknown>).model_id;

    await requestJson(`/v1/convai/agents/${nextAgentId}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    });

    console.log(`TTS_MODEL_FALLBACK_${name.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}=default-compatible`);
  }

  return {
    agentId: nextAgentId,
    agentAction,
  };
}

async function main() {
  const listResponse = await requestJson<ListToolsResponse>("/v1/convai/tools?created_by_user_id=%40me&types=client&page_size=100");
  const existingToolsByName = new Map<string, string>();

  for (const tool of listResponse.tools) {
    const toolName = tool.tool_config?.name;
    if (toolName) {
      existingToolsByName.set(toolName, tool.id);
    }
  }

  const toolIds: string[] = [];
  let createdCount = 0;
  let reusedCount = 0;

  for (const definition of toolDefinitions) {
    const existingId = existingToolsByName.get(definition.name);
    if (existingId) {
      await requestJson(`/v1/convai/tools/${existingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          tool_config: buildToolConfig(definition),
        }),
      });

      toolIds.push(existingId);
      reusedCount += 1;
      continue;
    }

    const createdTool = await requestJson<CreateToolResponse>("/v1/convai/tools", {
      method: "POST",
      body: JSON.stringify({
        tool_config: {
          ...buildToolConfig(definition),
        },
      }),
    });

    toolIds.push(createdTool.id);
    createdCount += 1;
  }

  const primaryAgent = await upsertAgent({
    agentId: currentAgentId,
    name: "One-Arm Parent Command-First",
    tags: ["one-arm-parent", "command-first", "hackathon-demo"],
    toolIds,
    preferredVoiceId: voiceId,
  });

  const whisperAgent = whisperVoiceId
    ? await upsertAgent({
        agentId: currentWhisperAgentId,
        name: "One-Arm Parent Whisper Command-First",
        tags: ["one-arm-parent", "command-first", "hackathon-demo", "whisper"],
        toolIds,
        preferredVoiceId: whisperVoiceId,
      })
    : null;

  console.log(`AGENT_ID=${primaryAgent.agentId}`);
  console.log(`AGENT_ACTION=${primaryAgent.agentAction}`);
  console.log(`WHISPER_AGENT_ID=${whisperAgent?.agentId ?? ""}`);
  console.log(`WHISPER_AGENT_ACTION=${whisperAgent?.agentAction ?? "skipped"}`);
  console.log(`TOOLS_CREATED=${createdCount}`);
  console.log(`TOOLS_REUSED=${reusedCount}`);
  console.log(`TOOL_TOTAL=${toolIds.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
