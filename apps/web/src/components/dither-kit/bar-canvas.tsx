"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChart } from "./chart-context";
import {
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  paintColumn,
  paintRow,
  prefersReducedMotion,
  resampleBanded,
} from "./dither-paint";
import { rgb, seedOfColor } from "./palette";

type Bars = { top: number[]; base: number[] }; // per data index, in backing rows/cols

// Fraction of the timeline spent staggering bar starts — the rest is each bar's
// own grow window, so the rise sweeps across the chart as a wave.
const STAGGER = 0.55;

/**
 * Dither canvas for bar charts. Each category owns a band; grouped series split
 * it into side-by-side bars, stacked series share its full width and pile in y.
 * Every bar is filled with the shared {@link paintColumn} ordered dither (or
 * {@link paintRow} when layout is horizontal). Bars grow from their base in a
 * staggered wave, and hovered bars lift while the rest dim.
 */
export function BarCanvas() {
  const ctx = useChart();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);

  const { width, height } = ctx.plot;
  const { cols, rows } = backingSize(width, height);
  const { ready, configKeys, bands, seriesSpecs, y, x, layout } = ctx;

  // Memoized: per-series bar tops/bases (backing rows in vertical, cols in horizontal)
  // over the data indices.
  const targets = useMemo(() => {
    const out: Record<string, Bars> = {};
    if (!ready) return out;
    const registered = Object.keys(seriesSpecs);
    const keys =
      registered.length > 0 ? configKeys.filter((k) => registered.includes(k)) : configKeys;

    if (layout === "horizontal") {
      const w = width || 1;
      for (const key of keys) {
        const band = bands[key];
        if (!band) continue;
        out[key] = {
          top: band.map((b) => (x(b[1]) / w) * (cols - 1)),
          base: band.map((b) => (x(b[0]) / w) * (cols - 1)),
        };
      }
    } else {
      const h = height || 1;
      for (const key of keys) {
        const band = bands[key];
        if (!band) continue;
        out[key] = {
          top: band.map((b) => (y(b[1]) / h) * (rows - 1)),
          base: band.map((b) => (y(b[0]) / h) * (rows - 1)),
        };
      }
    }
    return out;
  }, [ready, configKeys, bands, seriesSpecs, y, x, layout, width, height, rows, cols]);

  // The RAF loop reads these through refs so it always sees the latest values;
  // refs are written in an effect (never during render) — mutating a ref
  // mid-render tears under Strict Mode / concurrent rendering.
  const state = useRef(ctx);
  const targetsRef = useRef(targets);
  useEffect(() => {
    state.current = ctx;
    targetsRef.current = targets;
  });

  useEffect(() => {
    if (cols <= 0 || rows <= 0 || Number.isNaN(cols) || Number.isNaN(rows)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let c: CanvasRenderingContext2D | null = null;
    try {
      c = canvas.getContext("2d") ?? null;
    } catch {
      return;
    }
    if (!c) return;
    canvas.width = cols;
    canvas.height = rows;

    const bloomCanvas = bloomRef.current;
    const bloomCtx = bloomCanvas?.getContext("2d") ?? null;
    if (bloomCanvas) {
      bloomCanvas.width = cols;
      bloomCanvas.height = rows;
    }

    const reduce = prefersReducedMotion();
    const animate = state.current.animate && !reduce;
    const duration = state.current.animationDuration;
    const fx = cols / Math.max(width, 1);

    // Eased grow factor for bar `i` at global progress `prog`.
    const barProgress = (i: number, len: number, prog: number) => {
      if (!animate) return 1;
      const start = len > 1 ? (i / (len - 1)) * STAGGER : 0;
      return easeOutCubic(clamp01((prog - start) / (1 - STAGGER)));
    };

    const paint = (prog: number) => {
      const s = state.current;
      c.clearRect(0, 0, cols, rows);
      const stacked = s.stackType === "stacked" || s.stackType === "percent";
      const barKeys = s.configKeys.filter((key) => s.seriesSpecs[key]?.kind !== "line");
      barKeys.forEach((key, si) => {
        const t = targetsRef.current[key];
        if (!t) return;
        const conf = s.config[key];
        const negSeed = conf?.negativeColor ? seedOfColor(conf.negativeColor) : null;
        const defaultSeed = s.seedOf(key);
        const variant = s.seriesSpecs[key]?.variant ?? "gradient";
        const emphasis = s.selectedDataKey ?? s.focusDataKey;
        const selDim = emphasis !== null && emphasis !== key ? 0.3 : 1;
        if (s.layout === "horizontal") {
          const fy = rows / Math.max(height, 1);
          const sampleSlot = s.barSlot(0, si, barKeys.length);
          const floatRows = sampleSlot.height * fy;
          let maxRows = floatRows;

          if (barKeys.length > 1) {
            const nextSeriesSlot = s.barSlot(0, (si + 1) % barKeys.length, barKeys.length);
            const seriesStepRows = Math.abs(nextSeriesSlot.y - sampleSlot.y) * fy;
            if (seriesStepRows > 0) {
              maxRows =
                seriesStepRows >= 3
                  ? Math.floor(seriesStepRows) - 1
                  : Math.max(1, Math.floor(seriesStepRows));
            }
          } else if (s.dataLength > 1) {
            const nextCatSlot = s.barSlot(1, si, barKeys.length);
            const stepRows = Math.abs(nextCatSlot.y - sampleSlot.y) * fy;
            maxRows = stepRows >= 3 ? Math.floor(stepRows) - 1 : Math.max(1, Math.floor(stepRows));
          }

          const barHeightRows = Math.max(
            1,
            Math.min(Math.round(floatRows), Math.max(1, Math.floor(maxRows))),
          );

          for (let i = 0; i < s.dataLength; i++) {
            const base = t.base[i] ?? 0;
            const rawTarget = t.top[i] ?? base;

            if (Math.abs(rawTarget - base) < 0.001) continue;

            const bp = barProgress(i, s.dataLength, prog);
            const grown = base + (rawTarget - base) * bp;
            const isNeg = rawTarget < base;
            const barSeed = negSeed && isNeg ? negSeed : defaultSeed;

            const grownLength = Math.max(1, Math.round(Math.abs(grown - base)));
            const left = isNeg ? base - grownLength : base;
            const right = isNeg ? base : base + grownLength;

            const activeIndex = s.hoverIndex ?? s.markerIndex;
            const active = activeIndex === i;
            const hoverDim =
              activeIndex != null && !active && (s.isMouseInChart || s.markerIndex != null)
                ? 0.5
                : 1;

            const slot = s.barSlot(i, si, barKeys.length);
            const center = (slot.y + slot.height / 2) * fy;
            let r0 = Math.round(center - barHeightRows / 2);
            let r1 = r0 + barHeightRows;
            if (r0 < 0) {
              r0 = 0;
              r1 = Math.min(rows, barHeightRows);
            } else if (r1 > rows) {
              r1 = rows;
              r0 = Math.max(0, rows - barHeightRows);
            }

            for (let y = r0; y < r1; y++) {
              paintRow(c, y, left, right, barSeed, {
                variant,
                intensity: intensity + (active ? 0.4 : 0),
                dim: selDim * hoverDim,
                stacked,
                inverted: isNeg,
              });
            }
          }
        } else {
          // Precompute uniform bar width in canvas backing columns for this series
          const sampleSlot = s.barSlot(0, si, barKeys.length);
          const floatCols = sampleSlot.width * fx;
          let maxCols = floatCols;

          if (barKeys.length > 1) {
            const nextSeriesSlot = s.barSlot(0, (si + 1) % barKeys.length, barKeys.length);
            const seriesStepCols = Math.abs(nextSeriesSlot.x - sampleSlot.x) * fx;
            if (seriesStepCols > 0) {
              maxCols =
                seriesStepCols >= 3
                  ? Math.floor(seriesStepCols) - 1
                  : Math.max(1, Math.floor(seriesStepCols));
            }
          } else if (s.dataLength > 1) {
            const nextCatSlot = s.barSlot(1, si, barKeys.length);
            const stepCols = Math.abs(nextCatSlot.x - sampleSlot.x) * fx;
            maxCols = stepCols >= 3 ? Math.floor(stepCols) - 1 : Math.max(1, Math.floor(stepCols));
          }

          const barWidthCols = Math.max(
            1,
            Math.min(Math.round(floatCols), Math.max(1, Math.floor(maxCols))),
          );

          for (let i = 0; i < s.dataLength; i++) {
            const base = t.base[i] ?? rows - 1;
            const rawTop = t.top[i] ?? base;

            // If the bar has no height (e.g. 0% drawdown, $0 net P&L), skip painting
            if (Math.abs(rawTop - base) < 0.001) continue;

            const bp = barProgress(i, s.dataLength, prog);
            const grown = base + (rawTop - base) * bp;
            const isNeg = rawTop > base;
            const barSeed = negSeed && isNeg ? negSeed : defaultSeed;

            const grownDepth = Math.max(1, Math.round(Math.abs(grown - base)));
            const top = isNeg ? base : base - grownDepth;
            const bottom = isNeg ? base + grownDepth : base;

            const activeIndex = s.hoverIndex ?? s.markerIndex;
            const active = activeIndex === i;
            const hoverDim =
              activeIndex != null && !active && (s.isMouseInChart || s.markerIndex != null)
                ? 0.5
                : 1;

            const slot = s.barSlot(i, si, barKeys.length);
            const center = (slot.x + slot.width / 2) * fx;
            let c0 = Math.round(center - barWidthCols / 2);
            let c1 = c0 + barWidthCols;
            if (c0 < 0) {
              c0 = 0;
              c1 = Math.min(cols, barWidthCols);
            } else if (c1 > cols) {
              c1 = cols;
              c0 = Math.max(0, cols - barWidthCols);
            }

            for (let x = c0; x < c1; x++) {
              paintColumn(c, x, top, bottom, barSeed, {
                variant,
                intensity: intensity + (active ? 0.4 : 0),
                dim: selDim * hoverDim,
                stacked,
                inverted: isNeg,
              });
            }
          }
        }
      });

      const lineKeys = s.configKeys.filter((key) => s.seriesSpecs[key]?.kind === "line");
      if (lineKeys.length > 0) {
        const xCentersCols = Array.from({ length: s.dataLength }, (_, i) =>
          Math.round((s.xCenter(i) / Math.max(width, 1)) * (cols - 1)),
        );
        const glow = 4;
        lineKeys.forEach((key) => {
          const t = targetsRef.current[key];
          if (!t) return;
          const seed = s.seedOf(key);
          const variant = s.seriesSpecs[key]?.variant ?? "gradient";
          const strokeVariant = s.seriesSpecs[key]?.strokeVariant ?? "solid";
          const emphasis = s.selectedDataKey ?? s.focusDataKey;
          const selDim = emphasis !== null && emphasis !== key ? 0.3 : 1;

          const floor = t.top.map((topVal) => Math.min(rows - 1, (topVal ?? 0) + glow));
          const resampledTop = resampleBanded(t.top, cols, xCentersCols);
          const resampledFloor = resampleBanded(floor, cols, xCentersCols);

          // 1. Paint dither glow hugging the line
          for (let x = 0; x < cols; x++) {
            const topVal = resampledTop[x] ?? 0;
            const floorVal = resampledFloor[x] ?? 0;
            paintColumn(c, x, Math.min(topVal, floorVal), Math.max(topVal, floorVal), seed, {
              variant,
              intensity,
              dim: selDim,
              stacked: false,
            });
          }

          // 2. Draw crisp series line
          c.strokeStyle = rgb(seed.fill, 1, 0.95 * selDim);
          c.lineWidth = 1;
          if (strokeVariant === "dashed") {
            c.setLineDash([4, 3]);
          } else {
            c.setLineDash([]);
          }
          c.beginPath();
          let started = false;
          for (let x = 0; x < cols; x++) {
            const yVal = resampledTop[x];
            if (yVal == null || Number.isNaN(yVal)) continue;
            if (!started) {
              c.moveTo(x, yVal);
              started = true;
            } else {
              c.lineTo(x, yVal);
            }
          }
          c.stroke();
          c.setLineDash([]);
        });
      }

      const marker = s.hoverIndex ?? s.markerIndex;
      if (marker != null && (s.isMouseInChart || s.markerIndex != null) && marker < s.dataLength) {
        const hi = marker;
        barKeys.forEach((key, si) => {
          const t = targetsRef.current[key];
          if (!t) return;
          const conf = s.config[key];
          const negSeed = conf?.negativeColor ? seedOfColor(conf.negativeColor) : null;
          const defaultSeed = s.seedOf(key);

          if (s.layout === "horizontal") {
            const fy = rows / Math.max(height, 1);
            const base = t.base[hi] ?? 0;
            const rawTarget = t.top[hi] ?? base;
            const isNeg = rawTarget < base;
            const pointSeed = negSeed && isNeg ? negSeed : defaultSeed;
            const slot = s.barSlot(hi, si, barKeys.length);
            const my = Math.round((slot.y + slot.height / 2) * fy);
            const mx = Math.round(rawTarget);

            // Subtle full-width horizontal hover beam across the active row band
            c.fillStyle = rgb(pointSeed.fill, 1, 0.12);
            for (let x = 0; x < cols; x++) {
              c.fillRect(x, my, 1, 1);
            }

            // High-contrast guide line from baseline to mx
            c.fillStyle = rgb(pointSeed.fill, 1, 0.65);
            const startX = Math.min(Math.round(base), mx);
            const endX = Math.max(Math.round(base), mx);
            for (let x = startX; x <= endX; x++) {
              c.fillRect(x, my, 1, 1);
            }
            // Highlight cap dot at value edge
            c.fillStyle = rgb(pointSeed.fill);
            c.fillRect(mx - 1, my - 1, 3, 3);
          } else {
            const base = t.base[hi] ?? rows - 1;
            const rawTop = t.top[hi] ?? base;
            const isNeg = rawTop > base;
            const pointSeed = negSeed && isNeg ? negSeed : defaultSeed;
            const slot = s.barSlot(hi, si, barKeys.length);
            const mx = Math.round((slot.x + slot.width / 2) * fx);
            const my = Math.round(rawTop);

            // Vertical guide line in series/value color (matches EquityArea)
            c.fillStyle = rgb(pointSeed.fill, 1, 0.55);
            for (let y = my; y < rows; y++) {
              c.fillRect(mx, y, 1, 1);
            }
            // Highlight cap dot at value edge
            c.fillStyle = rgb(pointSeed.fill);
            c.fillRect(mx - 1, my - 1, 3, 3);
          }
        });

        lineKeys.forEach((key) => {
          const t = targetsRef.current[key];
          if (!t) return;
          const seed = s.seedOf(key);
          const lx = Math.round((s.xCenter(hi) / Math.max(width, 1)) * (cols - 1));
          const ly = Math.round(t.top[hi] ?? 0);
          c.fillStyle = rgb(seed.fill);
          c.fillRect(lx - 1, ly - 1, 3, 3);
        });
      }
    };

    let raf = 0;
    let animStart = 0;
    let lastProg = -1;
    let lastRevision = state.current.revision;
    let intensity = 0;
    let needsFill = true;
    let lastPaintSig = "";
    let lastSelected: string | null | undefined = Symbol() as never;
    let lastHover: number | null | undefined = Symbol() as never;

    const draw = (now: number) => {
      const s = state.current;
      if (!s.ready || cols <= 0 || rows <= 0 || Number.isNaN(cols) || Number.isNaN(rows)) {
        return;
      }
      raf = requestAnimationFrame(draw);
      if (bloomCtx) {
        const on = s.bloom !== "off" && (!s.bloomOnHover || s.isMouseInChart || s.hovered);
        if (on) {
          bloomCtx.clearRect(0, 0, cols, rows);
          bloomCtx.drawImage(canvas, 0, 0);
        }
      }
      if (s.revision !== lastRevision) {
        lastRevision = s.revision;
        animStart = 0; // re-play the wave on data change / replay
        lastProg = -1;
      }
      if (!animStart) animStart = now;
      const prog = animate ? Math.min(1, (now - animStart) / duration) : 1;

      if (prog !== lastProg) {
        lastProg = prog;
        needsFill = true;
      }
      const emphasisNow = s.selectedDataKey ?? s.focusDataKey;
      if (emphasisNow !== lastSelected) {
        lastSelected = emphasisNow;
        needsFill = true;
      }
      const activeHover = s.hoverIndex ?? s.markerIndex;
      if (activeHover !== lastHover) {
        lastHover = activeHover;
        needsFill = true;
      }
      const itTarget = s.isMouseInChart || s.hovered ? 1 : 0;
      if (Math.abs(intensity - itTarget) > 0.001) {
        intensity += (itTarget - intensity) * (reduce ? 1 : 0.16);
        needsFill = true;
      } else intensity = itTarget;

      // Live tweak repaint (variant, stacking) without replaying the wave.
      const paintSig = `${s.stackType}|${s.configKeys
        .map((k) => s.seriesSpecs[k]?.variant ?? "")
        .join(",")}`;
      if (paintSig !== lastPaintSig) {
        lastPaintSig = paintSig;
        needsFill = true;
      }

      if (!needsFill) return;
      paint(prog);
      needsFill = false;
      if (bloomCtx) {
        const on = s.bloom !== "off" && (!s.bloomOnHover || s.isMouseInChart || s.hovered);
        if (on) {
          bloomCtx.clearRect(0, 0, cols, rows);
          bloomCtx.drawImage(canvas, 0, 0);
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, width, height]);

  const bloomActive = ctx.bloomOnHover ? ctx.isMouseInChart || ctx.hovered : true;
  const bloom = bloomLayerStyle(ctx.bloom, bloomActive);
  const pos = {
    left: ctx.margins.left,
    top: ctx.margins.top,
    width,
    height,
  } as const;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ ...pos, imageRendering: "pixelated" }}
      />
      <canvas
        ref={bloomRef}
        className="pointer-events-none absolute"
        style={{
          ...pos,
          transition: "opacity 220ms ease",
          ...(bloom ?? { opacity: 0 }),
        }}
      />
    </>
  );
}
