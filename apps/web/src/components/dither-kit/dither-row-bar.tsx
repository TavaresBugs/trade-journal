"use client";

import { useEffect, useRef } from "react";
import {
  BAYER,
  BORDER_ALPHA,
  clamp01,
  OFF_TIER,
} from "./dither-paint";
import { type DitherColor, rgb, seedOfColor } from "./palette";

export type DitherRowBarProps = {
  percent: number; // 0 to 100
  color?: DitherColor | string; // e.g. "green" (#0ca30c), "orange", "red" (#d03b3b)
  isSelected?: boolean;
  className?: string;
};

/**
 * Lightweight retro horizontal dither bar for table / list rows.
 * Fills from x=0 to percent% using the shared 4x4 Bayer matrix with
 * a 1px value-edge cap, pixelated rendering, and selection brightness boost.
 */
export function DitherRowBar({
  percent,
  color = "green",
  isSelected = false,
  className = "",
}: DitherRowBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const width = Math.round(el.getBoundingClientRect().width) || 200;
    const height = Math.round(el.getBoundingClientRect().height) || 28;
    const c = canvas.getContext("2d");
    if (!c) return;

    // 2px per dither pixel for authentic retro feel
    const cols = Math.max(1, Math.round(width / 2));
    const rows = Math.max(1, Math.round(height / 2));
    canvas.width = cols;
    canvas.height = rows;

    const seed = seedOfColor(color);
    const targetCols = Math.max(1, Math.round((Math.max(0, Math.min(100, percent)) / 100) * cols));
    const dim = isSelected ? 1.0 : 0.45;
    const intensity = isSelected ? 0.35 : 0;

    c.clearRect(0, 0, cols, rows);

    // Paint dithered row with density gradient towards the tip
    for (let x = 0; x < targetCols; x++) {
      const density = 0.35 + 0.65 * (x / targetCols);
      for (let y = 0; y < rows; y++) {
        const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0) - 0.1 * intensity;
        const k = (0.3 + density * 0.7) * (1 + 0.22 * intensity);
        const alpha = clamp01((lit ? k : k * OFF_TIER) * dim * 0.32);
        c.fillStyle = rgb(seed.fill, 1, alpha);
        c.fillRect(x, y, 1, 1);
      }
    }

    // 1px cap outline at the value edge
    c.fillStyle = rgb(seed.fill, 1, BORDER_ALPHA * dim * 0.85);
    c.fillRect(targetCols - 1, 0, 1, rows);
    if (targetCols > 2) {
      c.fillStyle = rgb(seed.fill, 1, BORDER_ALPHA * 0.4 * dim);
      c.fillRect(targetCols - 2, 0, 1, rows);
    }
  }, [percent, color, isSelected]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none rounded overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
