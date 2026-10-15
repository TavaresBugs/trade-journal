import { describe, expect, it } from "vitest";
import {
  balancedDashboardSpans,
  moveDashboardCard,
  normalizeArrangement,
  readDashboardPreferences,
  visibleCardIds,
} from "../../src/lib/dashboard-layout";
import { isInsideDashboardReorderZone } from "../../src/lib/dashboard-drag";
import {
  advanceCardSwing,
  cardSwingGeometry,
  STILL_CARD,
  type CardSwing,
} from "../../src/lib/card-swing";
import { buildXValueScale, buildYScale } from "@/components/dither-kit/scales";
import { normalizeCumulativePoints } from "@/components/charts/equity-area";
import { relativeDrawdownCurve } from "@luxalgo/journal-core";

describe("dashboard drag stability", () => {
  const rect = { left: 100, right: 300, top: 200, bottom: 400, width: 200, height: 200 };

  it("ignores the unstable rim around a drop target", () => {
    expect(isInsideDashboardReorderZone({ x: 101, y: 300 }, rect)).toBe(false);
    expect(isInsideDashboardReorderZone({ x: 299, y: 300 }, rect)).toBe(false);
    expect(isInsideDashboardReorderZone({ x: 200, y: 201 }, rect)).toBe(false);
    expect(isInsideDashboardReorderZone({ x: 200, y: 399 }, rect)).toBe(false);
  });

  it("accepts deliberate movement into the target", () => {
    expect(isInsideDashboardReorderZone({ x: 118, y: 218 }, rect)).toBe(true);
    expect(isInsideDashboardReorderZone({ x: 200, y: 300 }, rect)).toBe(true);
  });
});

describe("dashboard layout persistence", () => {
  const ids = ["net", "win", "edge", "calendar", "activity"];

  it("preserves a saved order and visibility while adding new cards", () => {
    const current = normalizeArrangement(
      { order: ["edge", "net", "old", "edge", "win"], hidden: ["win", "old", "win"] },
      ids,
    );
    expect(current).toEqual({
      order: ["edge", "net", "win", "calendar", "activity"],
      hidden: ["win"],
    });
    expect(visibleCardIds(current)).toEqual(["edge", "net", "calendar", "activity"]);
  });

  it("recovers incomplete preferences and skips invalid named layouts", () => {
    for (const raw of [null, "null", "[]", '{"current":null,"layouts":null}']) {
      expect(readDashboardPreferences(raw, ids)).toEqual({
        current: { order: ids, hidden: [] },
        layouts: {},
      });
    }
    const state = readDashboardPreferences(
      JSON.stringify({
        current: { order: 7, hidden: {} },
        layouts: { Broken: null, Review: { order: ["edge"], hidden: ["net"] } },
      }),
      ids,
    );
    expect(state.current).toEqual({ order: ids, hidden: [] });
    expect(Object.keys(state.layouts)).toEqual(["Review"]);
    expect(state.layouts.Review?.order).toHaveLength(ids.length);
    expect(() => readDashboardPreferences("invalid json", ids)).toThrow();
  });

  it("moves in both directions and preserves all cards across a saved round trip", () => {
    const start = { order: ids, hidden: [] };
    const moved = moveDashboardCard(start, "net", "edge");
    expect(moved.order).toEqual(["win", "edge", "net", "calendar", "activity"]);
    const loaded = readDashboardPreferences(
      JSON.stringify({ current: moved, layouts: { Review: moved } }),
      ids,
    );
    expect(loaded.current).toEqual(moved);
    expect(moveDashboardCard(loaded.current, "net", "win")).toEqual(start);
    expect(start.order).toEqual(ids);
  });

  it("reorders visible neighbours without getting stuck on a hidden card", () => {
    const start = { order: ids, hidden: ["win"] };
    const moved = moveDashboardCard(start, "net", "edge");
    expect(moved.order).toEqual(["edge", "win", "net", "calendar", "activity"]);
    expect(moved.hidden).toEqual(["win"]);
    expect(visibleCardIds(moved)).toEqual(["edge", "net", "calendar", "activity"]);
  });

  it("does not change the layout for a cancelled, hidden, or unknown drop target", () => {
    const current = { order: ids, hidden: ["win"] };
    for (const to of ["net", "win", "not-a-card"])
      expect(moveDashboardCard(current, "net", to)).toBe(current);
  });

  it("balances responsive rows without reordering cards", () => {
    const cards = [
      { id: "a", size: "small" as const, layoutGroup: "summary" },
      { id: "b", size: "small" as const, layoutGroup: "summary" },
      { id: "c", size: "small" as const, layoutGroup: "summary" },
      { id: "chart", size: "medium" as const, layoutGroup: "visuals" },
    ];
    expect(balancedDashboardSpans(cards, 6, { small: 2, medium: 2, wide: 4, full: 6 })).toEqual({
      a: 2,
      b: 2,
      c: 2,
      chart: 6,
    });
    expect(
      balancedDashboardSpans(cards.slice(0, 2), 6, {
        small: 2,
        medium: 6,
        wide: 6,
        full: 6,
      }),
    ).toEqual({ a: 3, b: 3 });
  });
});

describe("card swing physics connected to cursor movement", () => {
  const geometry = cardSwingGeometry(200, 150, { x: 16, y: 24 });
  function travel(state: CardSwing, vx: number, vy: number, seconds: number, hz = 120) {
    for (let frame = 0; frame < Math.round(seconds * hz); frame++)
      state = advanceCardSwing(state, { x: vx / hz, y: vy / hz }, 1 / hz, geometry);
    return state;
  }

  it("stays completely still when picked up without cursor movement", () => {
    expect(travel(STILL_CARD, 0, 0, 3)).toEqual(STILL_CARD);
  });

  it("trails the direction of travel, with a stronger lean for faster movement", () => {
    const slow = travel(STILL_CARD, 90, 0, 0.5);
    const right = travel(STILL_CARD, 500, 0, 0.5);
    const left = travel(STILL_CARD, -500, 0, 0.5);
    expect(slow.angle).toBeGreaterThan(0);
    expect(right.angle).toBeGreaterThan(slow.angle * 3);
    expect(left.angle).toBeCloseTo(-right.angle, 5);
  });

  it("carries momentum through a direction change and settles after stopping", () => {
    const moving = travel(STILL_CARD, 600, 0, 0.5);
    const reversing = travel(moving, -600, 0, 1 / 120);
    expect(reversing.angle).toBeGreaterThan(0);
    expect(Math.abs(reversing.angle - moving.angle)).toBeLessThan(0.2);
    expect(travel(reversing, -600, 0, 0.3).angle).toBeLessThan(0);
    const stopped = travel(moving, 0, 0, 1 / 120);
    expect(stopped.angle).toBeGreaterThan(0);
    expect(travel(stopped, 0, 0, 2)).toEqual(STILL_CARD);
  });

  it("changes the swing according to which point holds the card", () => {
    const left = cardSwingGeometry(200, 150, { x: 16, y: 24 });
    const right = cardSwingGeometry(200, 150, { x: 184, y: 24 });
    const middle = cardSwingGeometry(200, 150, { x: 100, y: 75 });
    const movement = { x: 0, y: 10 };
    const fromLeft = advanceCardSwing(STILL_CARD, movement, 1 / 60, left);
    const fromRight = advanceCardSwing(STILL_CARD, movement, 1 / 60, right);
    expect(fromLeft.angle).toBeLessThan(0);
    expect(fromRight.angle).toBeCloseTo(-fromLeft.angle, 5);
    expect(advanceCardSwing(STILL_CARD, movement, 1 / 60, middle).angle).toBe(0);
  });

  it("remains consistent across frame rates", () => {
    const slowFrames = travel(STILL_CARD, 450, 100, 0.5, 30);
    const fastFrames = travel(STILL_CARD, 450, 100, 0.5, 120);
    expect(Math.abs(slowFrames.angle - fastFrames.angle)).toBeLessThan(0.05);
    expect(
      Math.abs(travel(slowFrames, 0, 0, 0.5, 30).angle - travel(fastFrames, 0, 0, 0.5, 120).angle),
    ).toBeLessThan(0.05);
  });

  it("limits large-card rotation and discards stale motion after a suspended frame", () => {
    const large = cardSwingGeometry(1040, 360, { x: 16, y: 24 });
    expect(large.maxAngle).toBeLessThan(geometry.maxAngle);
    let state = STILL_CARD;
    for (let frame = 0; frame < 240; frame++) {
      state = advanceCardSwing(state, { x: frame < 120 ? 10000 : -10000, y: 10000 }, 1 / 60, large);
      expect(Math.abs(state.angle)).toBeLessThanOrEqual(large.maxAngle * 1.2);
      expect(Number.isFinite(state.angularVelocity)).toBe(true);
    }
    expect(advanceCardSwing(state, { x: 10000, y: 10000 }, 5, large)).toEqual(STILL_CARD);
  });
});

describe("buildYScale & Zero Baseline Stability", () => {
  const plotHeight = 200;

  it("locks zero baseline at 50% dead center when symmetric is enabled", () => {
    const scale = buildYScale(-25.34, 32.68, plotHeight, { symmetric: true });
    expect(scale.domain()[0]).toBe(-35);
    expect(scale.domain()[1]).toBe(35);
    expect(scale(0)).toBe(100);

    const scaleSmall = buildYScale(-0.05, 0.05, plotHeight, { symmetric: true });
    expect(scaleSmall(0)).toBe(100);
  });

  it("faithfully preserves negative dips like -$2.32 in the scale domain", () => {
    const scale = buildYScale(-2.32, 65.69, plotHeight);
    const domain = scale.domain();
    expect(domain[0]).toBe(-10);
    expect(domain[1]).toBe(70);
    expect(scale(0)).toBeLessThan(plotHeight);
    expect(scale(-2.32)).toBeGreaterThan(scale(0));
  });

  it("anchors zero at 0% (plot bottom) for purely non-negative data", () => {
    const scale = buildYScale(0, 100, plotHeight);
    expect(scale.domain()[0]).toBe(0);
    expect(scale(0)).toBe(plotHeight);
  });

  it("anchors zero at 100% (plot top) for purely non-positive data", () => {
    const scale = buildYScale(-100, 0, plotHeight);
    expect(scale.domain()[1]).toBe(0);
    expect(scale(0)).toBe(0);
  });

  it("handles balanced cross-zero distributions with standard nice ticks", () => {
    const scale = buildYScale(-33.37, 34.64, plotHeight);
    expect(scale.domain()[0]).toBe(-35);
    expect(scale.domain()[1]).toBe(35);
    expect(scale(0)).toBe(100);
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

    expect(normalized[0]).toEqual({ t: "2026-01-01", cumNetPnl: 0 });
    expect(normalized[1]).toEqual({ t: "2026-01-06", cumNetPnl: 0 });
    expect(normalized[2]).toEqual({ t: "2026-01-07", cumNetPnl: 15.5 });
    expect(normalized[3]).toEqual({ t: "2026-02-14", cumNetPnl: 32.0 });
    expect(normalized[4]).toEqual({ t: "2026-09-24", cumNetPnl: 65.69 });
    expect(normalized[5]).toEqual({ t: "2026-10-05", cumNetPnl: 65.69 });

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
