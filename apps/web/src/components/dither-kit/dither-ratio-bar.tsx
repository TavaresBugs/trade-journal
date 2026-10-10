"use client";

import { useEffect, useRef } from "react";
import {
  backingSize,
  bloomLayerStyle,
  paintHorizontalSpan,
  type BloomInput,
} from "./dither-paint";
import { seedOfColor } from "./palette";

export type DitherRatioBarProps = {
  winValue: number | null;
  lossValue: number | null;
  height?: number; // CSS height in px, default 10
  bloom?: BloomInput; // default "low"
  direction?: "outward" | "inward" | "left-to-right"; // default "outward"
  order?: "win-loss" | "loss-win"; // default "win-loss"
  className?: string;
};

export function DitherRatioBar({
  winValue,
  lossValue,
  height = 10,
  bloom = "low",
  direction = "outward",
  order = "win-loss",
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
  const isLossFirst = order === "loss-win";
  const leftValue = isLossFirst ? loss : win;
  const leftRatio = total > 0 ? leftValue / total : 0.5;

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

    const leftSeed = seedOfColor(isLossFirst ? "red" : "green");
    const rightSeed = seedOfColor(isLossFirst ? "green" : "red");
    const leftAnchor = direction === "inward" ? "left" : "right";
    const rightAnchor = direction === "outward" ? "left" : "right";

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
      const splitCol = Math.round(cols * leftRatio);
      const { inside, side } = hoverRef.current;

      const leftSideKey = isLossFirst ? "loss" : "win";
      const rightSideKey = isLossFirst ? "win" : "loss";
      const leftActive = inside && side === leftSideKey;
      const rightActive = inside && side === rightSideKey;
      const leftDim = inside && !leftActive ? 0.5 : 1;
      const rightDim = inside && !rightActive ? 0.5 : 1;

      c.clearRect(0, 0, cols, rows);
      paintHorizontalSpan(c, 0, splitCol, 0, rows, leftSeed, {
        anchor: leftAnchor,
        intensity: intensity + (leftActive ? 0.4 : 0),
        dim: leftDim,
        doubleCap: true,
      });
      c.fillStyle = "rgba(140, 140, 150, 0.45)";
      c.fillRect(splitCol, 0, 1, rows);
      paintHorizontalSpan(c, splitCol + 1, cols, 0, rows, rightSeed, {
        anchor: rightAnchor,
        intensity: intensity + (rightActive ? 0.4 : 0),
        dim: rightDim,
        doubleCap: true,
      });

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
      const isLeft = x <= rect.width * leftRatio;
      hoverRef.current = {
        inside: true,
        side: isLeft ? (isLossFirst ? "loss" : "win") : (isLossFirst ? "win" : "loss"),
      };
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
  }, [leftRatio, height, bloom, direction, isLossFirst]);

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
