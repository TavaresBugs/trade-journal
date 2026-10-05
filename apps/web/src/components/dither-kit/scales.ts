// Pure geometry helpers for the dither chart engine. Kept framework-free so the
// context (and, later, bar/line/pie/radar roots) can share the same math.

import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { stack as d3Stack, stackOffsetExpand } from "d3-shape";

export type StackType = "default" | "stacked" | "percent";

type Row = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Per-series [y0, y1] bands for every row. For `default` every series sits on
 * the zero baseline (y0 = 0), so a negative value yields `[0, v]` with `v < 0`
 * and draws below the baseline; for `stacked`/`percent` they pile on top of
 * each other via d3's stack layout (which splits negatives below zero). The
 * shape `bands[key][i] = [y0, y1]` is what both the SVG area paths and the
 * canvas overlay read from. `max`/`min` bound the value range so the y-scale
 * can span a diverging (below-zero) domain.
 */
export function computeBands(
  data: Row[],
  keys: string[],
  stackType: StackType,
): { bands: Record<string, [number, number][]>; max: number; min: number } {
  if (stackType === "default") {
    const bands: Record<string, [number, number][]> = {};
    let max = 0;
    let min = 0;
    for (const key of keys) {
      bands[key] = data.map((row) => {
        const v = num(row[key]);
        if (v > max) max = v;
        if (v < min) min = v;
        return [0, v];
      });
    }
    // Only fall back to a unit span when there's no range at all (empty /
    // all-zero) — a purely negative series keeps max = 0 so the baseline
    // stays pinned to the top of the plot.
    const flat = max === 0 && min === 0;
    return { bands, max: flat ? 1 : max, min };
  }

  const series = d3Stack<Row>()
    .keys(keys)
    .value((row, key) => num(row[key]))
    .offset(stackType === "percent" ? stackOffsetExpand : (undefined as never))(data);

  const bands: Record<string, [number, number][]> = {};
  let max = 0;
  let min = 0;
  series.forEach((layer) => {
    bands[layer.key] = layer.map((point) => {
      if (point[1] > max) max = point[1];
      if (point[0] < min) min = point[0];
      return [point[0], point[1]];
    });
  });
  const flat = max === 0 && min === 0;
  return { bands, max: flat ? 1 : max, min };
}

/** x positions for each row index, evenly spread across the plot width. */
export function buildXScale(length: number, plotWidth: number) {
  return scalePoint<number>()
    .domain(Array.from({ length }, (_, i) => i))
    .range([0, plotWidth]);
}

/** Banded x for bar categories — each index owns a slot of `bandwidth` width. */
export function buildBandScale(length: number, plotWidth: number) {
  // Density-adaptive padding:
  // With few bars (<=25), use comfortable 0.28 inner padding.
  // As bar count increases, proportionally reduce padding so bars retain substance and don't collapse into 1px needles.
  const slotWidth = length > 0 && plotWidth > 0 ? plotWidth / length : 20;
  const paddingInner =
    slotWidth >= 16 ? 0.28 : slotWidth >= 8 ? 0.16 : slotWidth >= 4 ? 0.08 : 0.04;
  const paddingOuter = slotWidth >= 16 ? 0.18 : 0.06;

  return scaleBand<number>()
    .domain(Array.from({ length }, (_, i) => i))
    .range([0, plotWidth])
    .paddingInner(paddingInner)
    .paddingOuter(paddingOuter);
}

/** Index of the category whose band a horizontal pixel offset falls in. */
export function indexAtBand(px: number, length: number, plotWidth: number) {
  if (length <= 0 || plotWidth <= 0) return 0;
  const t = Math.max(0, Math.min(0.999, px / plotWidth));
  return Math.min(length - 1, Math.floor(t * length));
}

export type YScaleOptions = {
  /** Force domain to be symmetric [-maxAbs, +maxAbs] so zero baseline is fixed at 50% height. */
  symmetric?: boolean;
};

/**
 * value → vertical pixel. The domain always includes zero, so charts with only
 * positive values keep a floor at the plot bottom, while diverging data (values
 * below zero) draws below a zero baseline that sits inside the plot.
 *
 * Supports symmetric scaling for oscillating bar charts (fixed 50% baseline),
 * and smart zero-anchored bounds for cumulative curves so tiny negative drawdowns
 * don't balloon into huge empty black voids via unconstrained d3.nice().
 */
export function buildYScale(
  min: number,
  max: number,
  plotHeight: number,
  options: YScaleOptions = {},
) {
  if (options.symmetric) {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1;
    return scaleLinear().domain([-maxAbs, maxAbs]).nice().range([plotHeight, 0]);
  }

  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  // Guard a degenerate (zero-width) domain so `nice()` and the range map stay
  // finite even when every value is exactly zero.
  return scaleLinear()
    .domain([lo, hi === lo ? (lo === 0 ? 1 : lo + 1) : hi])
    .nice()
    .range([plotHeight, 0]);
}

/**
 * value → horizontal pixel for horizontal bar charts.
 * Domain includes zero, range maps from left [0] to right [plotWidth].
 */
export function buildXValueScale(
  min: number,
  max: number,
  plotWidth: number,
  options: YScaleOptions = {},
) {
  if (options.symmetric) {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1;
    return scaleLinear().domain([-maxAbs, maxAbs]).nice().range([0, plotWidth]);
  }

  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  return scaleLinear()
    .domain([lo, hi === lo ? (lo === 0 ? 1 : lo + 1) : hi])
    .nice()
    .range([0, plotWidth]);
}

/** Index of the row nearest a horizontal pixel offset within the plot. */
export function nearestIndex(px: number, length: number, plotWidth: number) {
  if (length <= 1 || plotWidth <= 0) return 0;
  const t = Math.max(0, Math.min(1, px / plotWidth));
  return Math.round(t * (length - 1));
}

/** Standard margins for stacked charts ensuring pixel-perfect vertical crosshair alignment. */
export const STACKED_CHART_MARGINS = { top: 12, right: 12, bottom: 24, left: 56 } as const;

/** Compact margins for sub-charts (e.g. drawdown underwater bars directly beneath equity). */
export const COMPACT_CHART_MARGINS = { top: 6, right: 12, bottom: 8, left: 56 } as const;
