import { cn } from "@/lib/utils";

type EqualizerProps = {
  active: boolean;
  bars?: number;
  className?: string;
  barClassName?: string;
};

export function Equalizer({ active, bars = 5, className, barClassName }: EqualizerProps) {
  // Pseudo-random heights for visual variety; stable per index.
  const heights = ["60%", "100%", "75%", "45%", "90%", "55%", "85%"];
  const delays = ["0s", "-0.3s", "-0.7s", "-0.5s", "-0.1s", "-0.9s", "-0.4s"];

  return (
    <span
      aria-hidden
      className={cn("inline-flex h-5 items-end gap-[3px]", className)}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block w-[3px] rounded-full bg-current",
            active ? "eq-bar" : "opacity-40",
            barClassName,
          )}
          style={{
            height: heights[i % heights.length],
            animationDelay: delays[i % delays.length],
            animationDuration: `${0.8 + (i % 3) * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}
