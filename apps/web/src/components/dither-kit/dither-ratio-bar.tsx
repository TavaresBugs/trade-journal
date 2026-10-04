"use client";

import { useEffect, useRef } from "react";
import {
  BAYER,
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  OFF_TIER,
  prefersReducedMotion,
  type BloomInput,
} from "./dither-paint";
import { rgb, seedOfColor } from "./palette";

export type DitherRatioBarProps = {
  winValue: number | null;
  lossValue: number | null;
  height?: number; // CSS height in px, default 8
  bloom?: BloomInput; // default "low"
  className?: string;
};

/**
 * Dual-ratio horizontal bar rendered with the retro Dither Kit engine:
 * - Left side: Average Win in glowing green with 4x4 Bayer dither.
 * - Right side: Average Loss in glowing red with 4x4 Bayer dither.
 * - Micro-divider separating the two values.
 * - Additive bloom glow layer for the authentic phosphor aesthetic.
 * - Steady render without annoying re-animations or hover replays.
 */
export function DitherRatioBar({
  winValue,
  lossValue,
  height = 8,
  bloom = "low",
  className = "",
}: DitherRatioBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  const win = winValue !== null && Number.isFinite(winValue) ? Math.max(0, winValue) : 0;
  const loss = lossValue !== null && Number.isFinite(lossValue) ? Math.max(0, Math.abs(lossValue)) : 0;
  const total = win + loss;
  const ratio = total > 0 ? win / total : 0.5;

  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    const bloomCanvas = bloomRef.current;
    if (!el || !canvas) return;

    let width = Math.round(el.getBoundingClientRect().width) || 120;
    const c = canvas.getContext("2d");
    if (!c) return;

    const render = (w: number) => {
      const { cols, rows } = backingSize(w, height);
      canvas.width = cols;
      canvas.height = rows;

      const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
      if (bloomCanvas) {
        bloomCanvas.width = cols;
        bloomCanvas.height = rows;
      }

      const winSeed = seedOfColor("green");
      const lossSeed = seedOfColor("red");

      const splitCol = Math.round(cols * ratio);
      const gap = 1;

      c.clearRect(0, 0, cols, rows);

      for (let y = 0; y < rows; y++) {
        const isBorder = y === 0 || y === rows - 1;
        for (let x = 0; x < cols; x++) {
          if (x < splitCol) {
            // WIN SECTION (Green)
            // Equilibrium point is at splitCol - 1 (strongest / peak saturation & density)
            // Gradient fades outward toward the left edge (x = 0) with a steeper quadratic falloff
            const t = splitCol > 1 ? x / (splitCol - 1) : 1;
            const falloff = Math.pow(t, 2.0);
            const density = 0.12 + 0.88 * falloff;
            const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0);
            const k = 0.25 + density * 0.75;
            const alpha = clamp01(lit ? k : k * OFF_TIER);

            if (isBorder) {
              const borderAlpha = clamp01(0.25 + 0.75 * falloff);
              c.fillStyle = rgb(winSeed.fill, 1, borderAlpha);
            } else {
              c.fillStyle = rgb(winSeed.fill, 1, alpha);
            }
            c.fillRect(x, y, 1, 1);
          } else if (x >= splitCol + gap && x < cols) {
            // LOSS SECTION (Red)
            // Equilibrium point is at splitCol + gap (strongest / peak saturation & density)
            // Gradient fades outward toward the right edge (x = cols - 1) with a steeper quadratic falloff
            const lossWidth = cols - (splitCol + gap);
            const distFromDivider = x - (splitCol + gap);
            const t = lossWidth > 1 ? 1 - distFromDivider / (lossWidth - 1) : 1;
            const falloff = Math.pow(t, 2.0);
            const density = 0.12 + 0.88 * falloff;
            const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0);
            const k = 0.25 + density * 0.75;
            const alpha = clamp01(lit ? k : k * OFF_TIER);

            if (isBorder) {
              const borderAlpha = clamp01(0.25 + 0.75 * falloff);
              c.fillStyle = rgb(lossSeed.fill, 1, borderAlpha);
            } else {
              c.fillStyle = rgb(lossSeed.fill, 1, alpha);
            }
            c.fillRect(x, y, 1, 1);
          }
        }
      }

      // Single bloom copy (no jitter, no re-run)
      if (bloomCtx && bloom !== "off") {
        bloomCtx.clearRect(0, 0, cols, rows);
        bloomCtx.drawImage(canvas, 0, 0);
      }
    };

    render(width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newW = Math.round(entry.contentRect.width);
        if (newW > 0 && newW !== width) {
          width = newW;
          render(width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ratio, height, bloom]);

  const bloomStyle = bloomLayerStyle(bloom, bloom !== "off");

  if (total <= 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-[3px] select-none ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Average win vs loss ratio: ${(ratio * 100).toFixed(1)}% win to ${((1 - ratio) * 100).toFixed(1)}% loss`}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height,
          imageRendering: "pixelated",
        }}
        className="absolute inset-0 block pointer-events-none"
      />
      {bloomStyle && (
        <canvas
          ref={bloomRef}
          style={{
            width: "100%",
            height,
            filter: bloomStyle.filter,
            opacity: bloomStyle.opacity * 0.7,
            mixBlendMode: bloomStyle.mixBlendMode,
          }}
          className="absolute inset-0 block pointer-events-none"
        />
      )}
    </div>
  );
}
