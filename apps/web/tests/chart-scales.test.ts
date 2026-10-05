import { describe, expect, it } from "vitest";
import { buildXValueScale, buildYScale } from "@/components/dither-kit/scales";
import { normalizeCumulativePoints } from "@/components/charts/equity-area";
import { relativeDrawdownCurve } from "@luxalgo/journal-core";

describe("buildYScale & Zero Baseline Stability", () => {
  const plotHeight = 200;

  it("locks zero baseline at 50% dead center when symmetric is enabled", () => {
    // Typical DailyBars range with gains and losses
    const scale = buildYScale(-25.34, 32.68, plotHeight, { symmetric: true });
    expect(scale.domain()[0]).toBe(-35);
    expect(scale.domain()[1]).toBe(35);
    expect(scale(0)).toBe(100); // 100px in a 200px plot = 50%

    // Small values range
    const scaleSmall = buildYScale(-0.05, 0.05, plotHeight, { symmetric: true });
    expect(scaleSmall(0)).toBe(100);
  });

  it("faithfully preserves negative dips like -$2.32 in the scale domain", () => {
    // YTD scenario: -$2.32 dip with +$65.69 profit
    const scale = buildYScale(-2.32, 65.69, plotHeight);
    const domain = scale.domain();
    expect(domain[0]).toBe(-10);
    expect(domain[1]).toBe(70);
    // Zero sits cleanly within the plot so the negative dip is visible below zero
    expect(scale(0)).toBeLessThan(plotHeight);
    expect(scale(-2.32)).toBeGreaterThan(scale(0));
  });

  it("anchors zero at 0% (plot bottom) for purely non-negative data", () => {
    const scale = buildYScale(0, 100, plotHeight);
    expect(scale.domain()[0]).toBe(0);
    expect(scale(0)).toBe(plotHeight); // Exactly on the bottom line
  });

  it("anchors zero at 100% (plot top) for purely non-positive data", () => {
    const scale = buildYScale(-100, 0, plotHeight);
    expect(scale.domain()[1]).toBe(0);
    expect(scale(0)).toBe(0); // Exactly on the top line
  });

  it("handles balanced cross-zero distributions with standard nice ticks", () => {
    const scale = buildYScale(-33.37, 34.64, plotHeight);
    expect(scale.domain()[0]).toBe(-35);
    expect(scale.domain()[1]).toBe(35);
    expect(scale(0)).toBe(100); // Centered
  });

  it("safely handles degenerate flat zero range", () => {
    const scale = buildYScale(0, 0, plotHeight);
    expect(scale.domain()[0]).toBe(0);
    expect(scale.domain()[1]).toBe(1);
    expect(Number.isFinite(scale(0))).toBe(true);
  });
});

describe("normalizeCumulativePoints & Range Boundary Alignment", () => {
  it("in YTD preset: starts strictly on Jan 1st at $0, flatlines to Jan 6, and extends to today", () => {
    const rawTrades = [
      { t: "2026-01-07", cumNetPnl: 15.5 },
      { t: "2026-02-14", cumNetPnl: 32.0 },
      { t: "2026-09-24", cumNetPnl: 65.69 },
    ];

    const normalized = normalizeCumulativePoints(rawTrades, "2026-01-01", "2026-10-05");

    // 1. Starts on Jan 1st at exactly $0.00
    expect(normalized[0]).toEqual({ t: "2026-01-01", cumNetPnl: 0 });

    // 2. Holds flat at $0.00 until day before first trade (Jan 6th)
    expect(normalized[1]).toEqual({ t: "2026-01-06", cumNetPnl: 0 });

    // 3. Trade points are preserved
    expect(normalized[2]).toEqual({ t: "2026-01-07", cumNetPnl: 15.5 });
    expect(normalized[3]).toEqual({ t: "2026-02-14", cumNetPnl: 32.0 });
    expect(normalized[4]).toEqual({ t: "2026-09-24", cumNetPnl: 65.69 });

    // 4. Extends flat with final cumulative P&L to 'to' date (Oct 5th)
    expect(normalized[5]).toEqual({ t: "2026-10-05", cumNetPnl: 65.69 });

    // 5. Relative drawdown curve syncs 1:1 with normalized points
    const dd = relativeDrawdownCurve(normalized, 1000);
    expect(dd[0]).toEqual({ t: "2026-01-01", drawdownPct: 0 });
    expect(dd[1]).toEqual({ t: "2026-01-06", drawdownPct: 0 });
    expect(dd[5]?.t).toBe("2026-10-05");
  });

  it("in ALL preset (no from/to): anchors 1 day prior to first trade at $0.00 so curve is born on zero", () => {
    const rawTrades = [
      { t: "2025-09-23", cumNetPnl: 10.0 },
      { t: "2025-10-01", cumNetPnl: 25.0 },
    ];

    const normalized = normalizeCumulativePoints(rawTrades, null, null);
    expect(normalized[0]).toEqual({ t: "2025-09-22", cumNetPnl: 0 });
    expect(normalized[1]).toEqual({ t: "2025-09-23", cumNetPnl: 10.0 });
  });

  it("handles empty data with from and to: generates 2-point flatline at $0.00", () => {
    const normalized = normalizeCumulativePoints([], "2026-01-01", "2026-10-05");
    expect(normalized).toEqual([
      { t: "2026-01-01", cumNetPnl: 0 },
      { t: "2026-10-05", cumNetPnl: 0 },
    ]);
  });

  it("anchors on from date at $0.00 when first trade has non-zero P&L on from date", () => {
    const rawTrades = [
      { t: "2026-01-01", cumNetPnl: 5.0 },
      { t: "2026-01-02", cumNetPnl: 10.0 },
    ];

    const normalized = normalizeCumulativePoints(rawTrades, "2026-01-01", "2026-01-02");
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toEqual({ t: "2026-01-01", cumNetPnl: 0 });
    expect(normalized[1]).toEqual({ t: "2026-01-01", cumNetPnl: 5.0 });
    expect(normalized[2]).toEqual({ t: "2026-01-02", cumNetPnl: 10.0 });
  });

  it("does not duplicate points when first trade on from date is already $0", () => {
    const rawTrades = [
      { t: "2026-01-01", cumNetPnl: 0 },
      { t: "2026-01-02", cumNetPnl: 10.0 },
    ];

    const normalized = normalizeCumulativePoints(rawTrades, "2026-01-01", "2026-01-02");
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({ t: "2026-01-01", cumNetPnl: 0 });
    expect(normalized[1]).toEqual({ t: "2026-01-02", cumNetPnl: 10.0 });
  });
});

describe("buildXValueScale & Horizontal Bar Layout", () => {
  const plotWidth = 300;

  it("anchors zero at 0px (left boundary) for non-negative data", () => {
    const scale = buildXValueScale(0, 100, plotWidth);
    expect(scale.domain()[0]).toBe(0);
    expect(scale(0)).toBe(0);
    expect(scale(100)).toBe(plotWidth);
  });

  it("centers zero at 50% width when symmetric is enabled", () => {
    const scale = buildXValueScale(-50, 50, plotWidth, { symmetric: true });
    expect(scale(0)).toBe(150);
    expect(scale(-50)).toBe(0);
    expect(scale(50)).toBe(plotWidth);
  });

  it("faithfully maps negative and positive coordinates across width", () => {
    const scale = buildXValueScale(-20, 80, plotWidth);
    expect(scale(0)).toBeGreaterThan(0);
    expect(scale(-20)).toBeLessThan(scale(0));
    expect(scale(80)).toBe(plotWidth);
  });

  it("safely handles flat zero range without dividing by zero", () => {
    const scale = buildXValueScale(0, 0, plotWidth);
    expect(Number.isFinite(scale(0))).toBe(true);
  });
});

