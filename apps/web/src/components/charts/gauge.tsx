"use client";

import { DitherGauge } from "@/components/dither-kit";

/**
 * Semicircle gauge for a 0-1 ratio (win rate, day win rate).
 * Rendered with the retro Dither Kit engine (4x4 Bayer + bloom glow).
 */
export function Gauge({
  value,
  label,
  size = 100,
}: {
  value: number | null;
  label: string;
  size?: number;
}) {
  return (
    <DitherGauge
      value={value}
      label={label}
      size={size}
      color="blue"
      bloom="low"
      bloomOnHover
    />
  );
}

