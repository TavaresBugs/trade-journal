"use client";

import { useEffect, useRef } from "react";
import {
  BAYER,
  BORDER_ALPHA,
  backingSize,
  bloomLayerStyle,
  clamp01,
  OFF_TIER,
  type BloomInput,
} from "./dither-paint";
import { rgb, seedOfColor, type Seed } from "./palette";

export type DitherRatioBarProps = {
  winValue: number | null;
  lossValue: number | null;
  height?: number; // CSS height in px, default 10
  bloom?: BloomInput; // default "low"
  direction?: "outward" | "inward" | "left-to-right"; // default "outward"
  className?: string;
};

/**
 * Horizontal transpose of paintColumn — same formulas, same constants:
 * density 0 at the value tip → 1 at the baseline, Bayer threshold lowered by
 * `0.1 * intensity`, alpha lifted by `1 + 0.22 * intensity`, tip capped with
 * BORDER_ALPHA outlines. `anchor` is the side where the baseline sits.
 */
function paintHorizontalSection(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xEnd: number,
  rows: number,
  seed: Seed,
  anchor: "left" | "right",
  intensity: number,
  dim: number,
) {
  const depth = xEnd - xStart;
  if (depth <= 0) return;

  for (let x = xStart; x < xEnd; x++) {
    const density =
      anchor === "left" ? 1 - (x - xStart) / depth : (x - xStart + 1) / depth;
    for (let y = 0; y < rows; y++) {
      const lit = density > (BAYER[y & 3]?.[x & 3] ?? 0) - 0.1 * intensity;
      const k = (0.3 + density * 0.7) * (1 + 0.22 * intensity);
      const alpha = clamp01((lit ? k : k * OFF_TIER) * dim);
      ctx.fillStyle = rgb(seed.fill, 1, alpha);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Cap perpendicular to growth, at the value tip (same as paintColumn's top cap)
  const tipX = anchor === "left" ? xEnd - 1 : xStart;
  ctx.fillStyle = rgb(seed.fill, 1, BORDER_ALPHA * dim);
  ctx.fillRect(tipX, 0, 1, rows);
  if (depth > 1) {
    ctx.fillStyle = rgb(seed.fill, 1, BORDER_ALPHA * 0.5 * dim);
    ctx.fillRect(anchor === "left" ? tipX - 1 : tipX + 1, 0, 1, rows);
  }
}

export function DitherRatioBar({
  winValue,
  lossValue,
  height = 10,
  bloom = "low",
  direction = "outward",
  className = "",
}: DitherRatioBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  // Hover target: 0 = idle, 1 = mouse inside. side: which half is hovered.
  const hoverRef = useRef<{ inside: boolean; side: "win" | "loss" | null }>({
    inside: false,
    side: null,
  });

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

    let intensity = 0;
    let raf = 0;
    let lastCols = 0;
    let lastRows = 0;

    const winSeed = seedOfColor("green");
    const lossSeed = seedOfColor("red");
    const winAnchor = direction === "inward" ? "left" : "right";
    const lossAnchor = direction === "outward" ? "left" : "right";

    const paint = () => {
      const { cols, rows } = backingSize(width, height);
      if (cols !== lastCols || rows !== lastRows) {
        canvas.width = cols;
        canvas.height = rows;
        if (bloomCanvas) {
          bloomCanvas.width = cols;
          bloomCanvas.height = rows;
        }
        lastCols = cols;
        lastRows = rows;
      }
      const splitCol = Math.round(cols * ratio);
      const { inside, side } = hoverRef.current;

      // Same rule as BarChart: hovered item lifts +0.4, the others dim to 0.5.
      const winActive = inside && side === "win";
      const lossActive = inside && side === "loss";
      const winDim = inside && side === "loss" ? 0.5 : 1;
      const lossDim = inside && side === "win" ? 0.5 : 1;

      c.clearRect(0, 0, cols, rows);
      paintHorizontalSection(
        c, 0, splitCol, rows, winSeed, winAnchor,
        intensity + (winActive ? 0.4 : 0), winDim,
      );
      c.fillStyle = "rgba(140, 140, 150, 0.45)";
      c.fillRect(splitCol, 0, 1, rows);
      paintHorizontalSection(
        c, splitCol + 1, cols, rows, lossSeed, lossAnchor,
        intensity + (lossActive ? 0.4 : 0), lossDim,
      );

      const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
      if (bloomCtx && bloom !== "off") {
        bloomCtx.clearRect(0, 0, cols, rows);
        bloomCtx.drawImage(canvas, 0, 0);
      }
    };

    const tick = () => {
      const target = hoverRef.current.inside ? 1 : 0;
      if (Math.abs(intensity - target) > 0.001) {
        intensity += (target - intensity) * 0.16;
        paint();
        raf = requestAnimationFrame(tick);
      } else {
        intensity = target;
        paint();
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      hoverRef.current = { inside: true, side: x <= rect.width * ratio ? "win" : "loss" };
      paint();
      kick();
    };
    const onLeave = () => {
      hoverRef.current = { inside: false, side: null };
      kick();
    };

    paint();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newW = Math.round(entry.contentRect.width);
        if (newW > 0 && newW !== width) {
          width = newW;
          paint();
        }
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ratio, height, bloom, direction]);

  const bloomStyle = bloomLayerStyle(bloom, bloom !== "off");

  if (total <= 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-none select-none ${className}`}
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
