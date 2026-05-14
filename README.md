# One-Arm Parent

One-Arm Parent is a voice-first care console for caregivers who have a baby in their arms, low bandwidth, and no realistic chance of using a keyboard.

The project was built as part of the Cursor x ElevenLabs hackathon, but this README is focused on the product itself: what it does, how it works, and how to run it.

## Overview

The app is designed for moments when a parent or caregiver needs help without stopping to type, tap through menus, or fill in forms.

Instead of treating voice as an add-on, the product is built around short commands, visible system state, calm audio, and fast recovery when speech recognition is imperfect.

The main interaction model is:

- one tap to grant microphone permission
- voice-first control after that
- touch only as fallback, emergency pause, or recovery path

## What The App Does

One-Arm Parent currently includes four core capabilities:

- Guided sleep mode with calm spoken steps and recovery prompts
- Quick care logging for feeding, diaper, nap, and notes
- Handoff summaries for the next caregiver
- Soft reminders, including recurring reminders created by voice

Example voice actions:

- start sleep routine
- play brown noise
- log feeding
- read the summary
- remind me in 20 minutes to check diaper
- remind me every 2 hours to check diaper

## Product Structure

The experience is intentionally simple and state-driven. The app revolves around a few high-value modes instead of deep navigation.

### Home

The main voice entry point with the current assistant state, last transcript, and primary fallback controls.

### Sleep Mode

- step-by-step sleep routine guidance
- voice-controlled calming audio
- recovery prompts such as baby is crying and try again

### Quick Log

- feeding, breastfeeding, bottle, diaper, wet diaper, dirty diaper, nap, and note logging
- no form filling required in the main path

### Handoff

- spoken recap of recent events
- quick context for the next caregiver

### Soft Reminders

- one-time reminders
- recurring reminders
- voice-created reminders
- reminder alerts with ElevenLabs TTS playback
- snooze and done flows tuned for hands-busy use

## Design Approach

The app was designed around the constraint first, not around a traditional screen flow.

Key decisions:

- Voice-first, not chat-first
- Mobile-first layout with large fallback controls
- Short command grammar instead of open-ended prompting
- Visible system state at all times: listening, muted, playing, paused, due
- Gentle failure handling when voice recognition misses a command
- Recurring reminders because caregiving tasks repeat in real life, not just once

## Tech Stack

- Next.js App Router
- React 19 + TypeScript
- XState for the assistant state machine
- Howler for looping audio playback
- Zod for validation and reminder contracts
- ElevenLabs for conversational voice sessions, TTS, and generated audio assets

## ElevenLabs In The Product

ElevenLabs is used as part of the core product flow, not as decoration.

Current usage includes:

- conversational voice sessions through the web client
- reminder TTS playback through protected server routes
- configurable voice modes for normal and whisper interactions
- generation pipelines for calm audio, confirmations, and support sounds

## Local Development

### Requirements

- Node.js 20+
- npm
- ElevenLabs credentials for full voice and asset generation flows

### Install

```bash
npm install
```

### Run The App

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run audio:plan
npm run audio:generate
npx tsx scripts/create-elevenlabs-command-agent.ts
```

## Environment Variables

Create a local `.env` file with the variables you need for your setup.

### Core ElevenLabs

- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID
- ELEVENLABS_WHISPER_VOICE_ID
- NEXT_PUBLIC_ELEVENLABS_AGENT_ID
- NEXT_PUBLIC_ELEVENLABS_WHISPER_AGENT_ID

### Optional ElevenLabs Configuration

- ELEVENLABS_BASE_URL
- ELEVENLABS_OUTPUT_FORMAT
- ELEVENLABS_TTS_MODEL
- ELEVENLABS_SOUND_MODEL
- ELEVENLABS_MUSIC_MODEL

### Optional Local Toggles

- NEXT_PUBLIC_USE_GENERATED_AUDIO
- AUDIO_GENERATION_TOKEN

If agent IDs are not configured, the app can still fall back to browser speech recognition for the core command flow.

## Notes

- The product UI is intentionally in English for demo consistency.
- The current focus is a stable, demoable MVP rather than full production hardening.
- The project belongs to the Cursor x ElevenLabs hackathon submission track, but the codebase is organized as a normal Next.js app that can keep evolving after the hackathon.
