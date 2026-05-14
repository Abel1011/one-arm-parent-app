"use client";

import { LoaderCircle, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceOrbProps = {
  listening: boolean;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
};

export function VoiceOrb({ listening, onClick, busy = false, disabled = false, label }: VoiceOrbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={busy ? "Connecting voice session" : listening ? "Stop listening" : "Start listening"}
      aria-busy={busy}
      disabled={disabled}
      className={cn(
        "group relative flex h-44 w-44 items-center justify-center transition-opacity sm:h-52 sm:w-52",
        disabled && "cursor-wait opacity-80",
      )}
    >
      {/* Pulsing rings */}
      {(listening || busy) && (
        <>
          <span aria-hidden className="orb-ring absolute inset-0 rounded-full bg-[var(--terracotta)]/30" />
          <span aria-hidden className="orb-ring absolute inset-0 rounded-full bg-[var(--honey)]/35" style={{ animationDelay: "-0.8s" }} />
          <span aria-hidden className="orb-ring absolute inset-0 rounded-full bg-[var(--peach)]/45" style={{ animationDelay: "-1.6s" }} />
        </>
      )}

      {/* Halo ring */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-2 rounded-full transition-all duration-500",
          busy
            ? "bg-gradient-to-br from-[var(--honey)] via-[var(--terracotta)] to-[var(--terracotta-deep)]"
            : listening
            ? "bg-gradient-to-br from-[var(--honey)] via-[var(--terracotta)] to-[var(--terracotta-deep)]"
            : "bg-gradient-to-br from-[var(--cream-deep)] via-[var(--peach)] to-[var(--honey)]/70",
        )}
      />

      {/* Inner orb */}
      <span
        className={cn(
          "relative flex h-28 w-28 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:scale-105 group-active:scale-95 sm:h-32 sm:w-32",
          busy
            ? "bg-[var(--terracotta)] shadow-[0_24px_50px_-20px_rgba(196,89,58,0.55)]"
            : listening
            ? "orb-breathe bg-[var(--terracotta-deep)]"
            : "bg-[var(--plum)] shadow-[0_24px_50px_-20px_rgba(59,42,47,0.6)]",
        )}
      >
        {busy ? (
          <LoaderCircle className="h-10 w-10 animate-spin" aria-hidden="true" />
        ) : listening ? (
          <MicOff className="h-10 w-10" aria-hidden="true" />
        ) : (
          <Mic className="h-10 w-10" aria-hidden="true" />
        )}
      </span>

      {/* Label below */}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
          busy
            ? "bg-[var(--terracotta)] text-white"
            : listening
            ? "bg-[var(--terracotta-deep)] text-[var(--cream)]"
            : "bg-white/80 text-[var(--plum-soft)] ring-1 ring-[var(--cream-deep)]",
        )}
      >
        {busy ? label ?? "Connecting..." : listening ? "Listening" : label ?? "Tap to talk"}
      </span>
    </button>
  );
}
