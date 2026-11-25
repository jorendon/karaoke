"use client";

interface SoundEqualizerProps {
  active?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BAR_DELAYS = ["0ms", "180ms", "90ms", "260ms"];
const BAR_DURATIONS = ["0.72s", "0.9s", "0.65s", "0.82s"];

export function SoundEqualizer({
  active = true,
  size = "md",
  className = "",
}: SoundEqualizerProps) {
  const heightClass =
    size === "sm" ? "h-3.5" : size === "lg" ? "h-6" : "h-4";
  const widthClass = size === "lg" ? "w-1.5" : "w-1";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-0.5 ${heightClass} ${className}`}
    >
      {BAR_DELAYS.map((delay, idx) => (
        <span
          key={delay}
          style={{
            animationDelay: delay,
            animationDuration: BAR_DURATIONS[idx],
          }}
          className={`${widthClass} h-full rounded-full ${
            active
              ? "eq-bar bg-stage"
              : "eq-bar-paused bg-ink-muted"
          }`}
        />
      ))}
    </span>
  );
}
