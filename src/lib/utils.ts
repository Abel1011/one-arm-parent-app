import { cva } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      tone: {
        primary:
          "bg-[var(--plum)] text-[var(--cream)] shadow-[0_8px_20px_-8px_rgba(59,42,47,0.5)] hover:bg-[var(--plum-soft)] focus-visible:outline-[var(--plum)]",
        soft:
          "bg-white/70 backdrop-blur text-[var(--plum)] shadow-[0_4px_14px_-8px_rgba(59,42,47,0.25)] ring-1 ring-[var(--cream-deep)] hover:bg-white focus-visible:outline-[var(--terracotta)]",
        calm:
          "bg-[var(--sage)] text-white shadow-[0_8px_20px_-8px_rgba(79,122,90,0.55)] hover:bg-[var(--sage-deep)] focus-visible:outline-[var(--sage-deep)]",
        warm:
          "bg-[var(--terracotta)] text-white shadow-[0_10px_24px_-10px_rgba(196,89,58,0.6)] hover:bg-[var(--terracotta-deep)] focus-visible:outline-[var(--terracotta-deep)]",
        honey:
          "bg-[var(--honey)] text-[var(--plum)] shadow-[0_8px_20px_-10px_rgba(245,194,107,0.7)] hover:brightness-95 focus-visible:outline-[var(--honey)]",
        danger:
          "bg-[var(--terracotta-deep)] text-white shadow-[0_8px_20px_-8px_rgba(196,89,58,0.6)] hover:brightness-95 focus-visible:outline-[var(--terracotta-deep)]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-6 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      tone: "soft",
      size: "md",
    },
  },
);