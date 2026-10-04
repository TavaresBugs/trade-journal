"use client";

import { useEffect, useRef, useState } from "react";
import {
  BAYER,
  backingSize,
  bloomLayerStyle,
  easeOutCubic,
  OFF_TIER,
  prefersReducedMotion,
  type BloomInput,
} from "./dither-paint";
import { rgb, seedOfColor, type DitherColor } from "./palette";

export type DitherGaugeProps = {
  value: number | null; // 0 to 1 (e.g. 0.56 for 56%)
  label?: string;
  size?: number; // width in px, default 104
  innerRadiusRatio?: number; // default 0.80 for a sleeker, more refined arch
  color?: DitherColor; // default "blue"
  bloom?: BloomInput; // default "low"
  bloomOnHover?: boolean;
  className?: string;
};

/**
 * Semicircle (180°) gauge rendered with the retro Dither Kit engine:
 * - 4x4 Bayer ordered dither texture across the arch.
 * - Solid bright neon rim on the outer edge.
 * - Additive bloom glow layer for the neon phosphor aesthetic.
 * - Faint dithered CRT track for the unreached portion.
 * - Centered tabular percentage text.
 */
export function DitherGauge({
  value,
  label,
  size = 104,
  innerRadiusRatio = 0.8,
  color = "blue",
  bloom = "low",
  bloomOnHover = true,
  className = "",
}: DitherGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  const ratio = value === null ? 0 : Math.min(Math.max(value, 0), 1);
  const width = size;
  const height = Math.round(size * 0.58); // ~60px for size 104

  useEffect(() => {
    const canvas = canvasRef.current;
    const bloomCanvas = bloomRef.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;

    const { cols, rows } = backingSize(width, height);
    canvas.width = cols;
    canvas.height = rows;

    const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
    if (bloomCanvas) {
      bloomCanvas.width = cols;
      bloomCanvas.height = rows;
    }

    const reduce = prefersReducedMotion();
    let animStart = 0;
    let raf = 0;
    let intensity = 0;
    const duration = 750;

    const activeSeed = seedOfColor(color);
    const trackSeed = seedOfColor("grey");

    // Geometry in CSS px
    const cx = width / 2;
    const cy = height - 5;
    const outerR = width / 2 - 4;
    const innerR = outerR * innerRadiusRatio;

    const draw = (now: number) => {
      if (!animStart) animStart = now;
      const progress = reduce ? 1 : Math.min(1, (now - animStart) / duration);
      const ease = easeOutCubic(progress);
      const currentRatio = ratio * ease;

      c.clearRect(0, 0, cols, rows);

      for (let y = 0; y < rows; y++) {
        const py = ((y + 0.5) * height) / rows;
        // Only paint above the equator
        if (py > cy + 1.2) continue;

        for (let x = 0; x < cols; x++) {
          const px = ((x + 0.5) * width) / cols;
          const dx = px - cx;
          const dy = py - cy;
          const r = Math.hypot(dx, dy);

          if (r < innerR || r > outerR) continue;

          // Angle from -PI (left) to 0 (right)
          const angle = Math.atan2(dy, dx);
          if (angle < -Math.PI || angle > 0) continue;

          // Normalized progress along the arch: 0 (left) -> 1 (right)
          const prog = (angle + Math.PI) / Math.PI;

          const density = (r - innerR) / Math.max(outerR - innerR, 1);
          const isOuterRim = outerR - r < 1.6;

          if (prog <= currentRatio && currentRatio > 0) {
            // ACTIVE SLICE (Win rate portion with neon glow)
            if (isOuterRim) {
              c.fillStyle = rgb(activeSeed.fill, 1, 1);
              c.fillRect(x, y, 1, 1);
            } else {
              const bayerThreshold = BAYER[y & 3]?.[x & 3] ?? 0;
              const lit = density > bayerThreshold;
              const alpha = lit
                ? Math.min(1, 0.45 + density * 0.55)
                : OFF_TIER * 0.45;
              c.fillStyle = rgb(activeSeed.fill, 1, alpha);
              c.fillRect(x, y, 1, 1);
            }
          } else {
            // TRACK SLICE (Inactive background track)
            if (isOuterRim) {
              c.fillStyle = rgb(trackSeed.fill, 1, 0.35);
              c.fillRect(x, y, 1, 1);
            } else {
              const bayerThreshold = BAYER[y & 3]?.[x & 3] ?? 0;
              const lit = density > bayerThreshold;
              const alpha = lit ? 0.16 : 0.05;
              c.fillStyle = rgb(trackSeed.fill, 1, alpha);
              c.fillRect(x, y, 1, 1);
            }
          }
        }
      }

      // Bloom layer copy
      if (bloomCtx && bloom !== "off") {
        bloomCtx.clearRect(0, 0, cols, rows);
        bloomCtx.drawImage(canvas, 0, 0);
      }

      // Continue animating until entrance completes, then rest peacefully
      if (progress < 1) {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, ratio, innerRadiusRatio, color, bloom]);

  const bloomBaseStyle = bloomLayerStyle(bloom, bloom !== "off");

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      style={{ width, height }}
      onMouseEnter={() => {
        hoveredRef.current = true;
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        setIsHovered(false);
      }}
      role="img"
      aria-label={`${label ?? "Gauge"}: ${
        value === null ? "no data" : `${(ratio * 100).toFixed(1)}%`
      }`}
    >
      {/* Crisp Canvas (Retro 4x4 Bayer Dither) */}
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          imageRendering: "pixelated",
        }}
        className="absolute inset-0 block pointer-events-none"
      />

      {/* Bloom Canvas (Additive Phosphor Glow with smooth discreet transition) */}
      {bloomBaseStyle && (
        <canvas
          ref={bloomRef}
          style={{
            width,
            height,
            filter: bloomBaseStyle.filter,
            opacity: bloomBaseStyle.opacity * (isHovered ? 1 : 0.55),
            mixBlendMode: bloomBaseStyle.mixBlendMode,
            transition: "opacity 300ms ease-out",
          }}
          className="absolute inset-0 block pointer-events-none"
        />
      )}

      {/* Centered Tabular Percentage */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-0.5 pointer-events-none">
        <span className="text-base sm:text-lg font-semibold tracking-tight tnum text-foreground">
          {value === null ? "–" : `${(ratio * 100).toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}
