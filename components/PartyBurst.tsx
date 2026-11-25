"use client";

import type { CSSProperties } from "react";

interface PartyBurstProps {
  triggerKey: number;
}

const PARTICLES: Array<{
  symbol: string;
  tx: string;
  ty: string;
  rot: string;
  delay: string;
}> = [
  { symbol: "🎤", tx: "-120px", ty: "-95px", rot: "-25deg", delay: "0ms" },
  { symbol: "🎵", tx: "-70px", ty: "-130px", rot: "18deg", delay: "40ms" },
  { symbol: "✨", tx: "-20px", ty: "-145px", rot: "-15deg", delay: "20ms" },
  { symbol: "🎶", tx: "35px", ty: "-135px", rot: "28deg", delay: "60ms" },
  { symbol: "🎉", tx: "95px", ty: "-115px", rot: "20deg", delay: "30ms" },
  { symbol: "⭐", tx: "130px", ty: "-70px", rot: "-30deg", delay: "50ms" },
  { symbol: "🔥", tx: "-105px", ty: "-45px", rot: "15deg", delay: "70ms" },
  { symbol: "✨", tx: "80px", ty: "-45px", rot: "-20deg", delay: "80ms" },
];

/**
 * Celebración liviana con partículas CSS (sin dependencias externas) al
 * agregar canciones, iniciar un nuevo turno o mezclar la fila.
 */
export function PartyBurst({ triggerKey }: PartyBurstProps) {
  if (triggerKey <= 0) return null;

  return (
    <div
      key={triggerKey}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-1/3 z-50 flex justify-center overflow-visible"
    >
      <div className="relative h-0 w-0">
        {PARTICLES.map((p, idx) => (
          <span
            key={idx}
            style={
              {
                "--tx": p.tx,
                "--ty": p.ty,
                "--rot": p.rot,
                animationDelay: p.delay,
              } as CSSProperties
            }
            className="party-particle absolute left-0 top-0 select-none text-2xl sm:text-3xl"
          >
            {p.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}
