"use client";

import { useEffect, useRef } from "react";
import {
  BAYER,
  backingSize,
  bloomLayerStyle,
  clamp01,
  OFF_TIER,
  type BloomInput,
} from "./dither-paint";
import { rgb, seedOfColor } from "./palette";

export type DitherDivergingBarProps = {
  value: number; // positive = green extends right, negative = red extends left
  maxAbs: number; // maximum absolute value representing 100% of half-width
  height?: number; // CSS height in px, default 8
  bloom?: BloomInput; // default "low"
  className?: string;
};

/**
 * Diverging horizontal bar rendered with the retro Dither Kit engine:
 * - Center equilibrium line at 50% (zero baseline), matching DitherRatioBar.
 * - Pill container track with subtle border and dark background.
 * - Positive values extend right in glowing green with 4x4 Bayer dither.
 * - Negative values extend left in glowing red with 4x4 Bayer dither.
 * - Equilibrium baseline (50% center) has the strongest color density and saturation,
 *   dissolving toward the outer tip with Bayer dither and capped by a 1px border.
 * - Additive bloom glow layer for the authentic phosphor aesthetic.
 */
export function DitherDivergingBar({
  value,
  maxAbs,
  height = 8,
  bloom = "low",
  className = "",
}: DitherDivergingBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  const safeMax = maxAbs > 0 && Number.isFinite(maxAbs) ? maxAbs : 1;
  const numVal = Number.isFinite(value) ? value : 0;
  const norm = Math.min(1, Math.abs(numVal) / safeMax);

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

      c.clearRect(0, 0, cols, rows);

      const splitCol = Math.round(cols * 0.5);
      const halfCols = cols * 0.5;
      const fillLen = Math.round(halfCols * norm);

      // Subtle center zero baseline hairline
      c.fillStyle = "rgba(140, 140, 150, 0.4)";
      c.fillRect(splitCol, 0, 1, rows);

      if (numVal > 0 && fillLen > 0) {
        // POSITIVE (Green, extending right from splitCol + 1)
        const seed = seedOfColor("green");
        const startX = splitCol + 1;
        const endX = Math.min(cols, splitCol + 1 + Math.max(1, fillLen));
        const span = endX - startX;

        for (let x = startX; x < endX; x++) {
          const dist = x - startX;
          // Linear falloff: 1.0 at center baseline divider, 0.0 at outer tip
          const t = span > 1 ? 1 - dist / span : 1;
          const density = 0.15 + 0.85 * t;

          for (let y = 0; y < rows; y++) {
            const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0);
            const k = 0.3 + density * 0.7;
            const alpha = clamp01(lit ? k : k * OFF_TIER);
            c.fillStyle = rgb(seed.fill, 1, alpha);
            c.fillRect(x, y, 1, 1);
          }
        }

        // Value edge cap (outer tip 1px border outline, exactly like paintColumn)
        c.fillStyle = rgb(seed.fill, 1, 0.9);
        c.fillRect(endX - 1, 0, 1, rows);

        // Top and bottom borders in seed color
        c.fillStyle = rgb(seed.fill, 1, 0.4);
        c.fillRect(startX, 0, span, 1);
        c.fillRect(startX, rows - 1, span, 1);
      } else if (numVal < 0 && fillLen > 0) {
        // NEGATIVE (Red, extending left up to splitCol)
        const seed = seedOfColor("red");
        const startX = Math.max(0, splitCol - Math.max(1, fillLen));
        const endX = splitCol;
        const span = endX - startX;

        for (let x = startX; x < endX; x++) {
          const dist = endX - 1 - x;
          // Linear falloff: 1.0 at center baseline divider, 0.0 at outer tip
          const t = span > 1 ? 1 - dist / span : 1;
          const density = 0.15 + 0.85 * t;

          for (let y = 0; y < rows; y++) {
            const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0);
            const k = 0.3 + density * 0.7;
            const alpha = clamp01(lit ? k : k * OFF_TIER);
            c.fillStyle = rgb(seed.fill, 1, alpha);
            c.fillRect(x, y, 1, 1);
          }
        }

        // Value edge cap (outer tip 1px border outline, exactly like paintColumn)
        c.fillStyle = rgb(seed.fill, 1, 0.9);
        c.fillRect(startX, 0, 1, rows);

        // Top and bottom borders in seed color
        c.fillStyle = rgb(seed.fill, 1, 0.4);
        c.fillRect(startX, 0, span, 1);
        c.fillRect(startX, rows - 1, span, 1);
      }

      // Single bloom copy
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
  }, [numVal, norm, height, bloom]);

  const bloomStyle = bloomLayerStyle(bloom, bloom !== "off");

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-none select-none bg-muted/20 border border-border/30 ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Performance: ${numVal > 0 ? "+" : ""}${numVal}`}
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
