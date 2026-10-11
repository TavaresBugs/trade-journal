import { describe, expect, it } from "vitest";
import { snapTimeToCandle } from "../src/lib/market-data";

describe("snapTimeToCandle", () => {
  // 1m resolution bars: 12:44, 12:45, 12:46, 12:51, 12:52
  const bars1m = [
    { time: 1791204240000 }, // 12:44:00Z
    { time: 1791204300000 }, // 12:45:00Z
    { time: 1791204360000 }, // 12:46:00Z
    { time: 1791204660000 }, // 12:51:00Z
    { time: 1791204720000 }, // 12:52:00Z
  ];

  it("snaps exact bar open timestamps identically", () => {
    // 12:45:00Z
    const exact = 1791204300000;
    expect(snapTimeToCandle(exact, bars1m)).toBe(exact);
  });

  it("snaps intra-minute execution with seconds to enclosing 1m candle open", () => {
    // 12:51:58Z should snap to 12:51:00Z
    const fillWithSeconds = 1791204660000 + 58_000;
    expect(snapTimeToCandle(fillWithSeconds, bars1m)).toBe(1791204660000);
  });

  // 4H resolution bars: 02:00, 06:00, 10:00, 14:00, 18:00
  const bars4h = [
    { time: 1791165600000 }, // 2026-10-05 02:00:00Z
    { time: 1791180000000 }, // 2026-10-05 06:00:00Z
    { time: 1791194400000 }, // 2026-10-05 10:00:00Z (covers 10:00:00Z to 14:00:00Z)
    { time: 1791208800000 }, // 2026-10-05 14:00:00Z
    { time: 1791223200000 }, // 2026-10-05 18:00:00Z
  ];

  it("snaps an execution inside a 4H candle to that 4H candle open rather than interpolating to next bar", () => {
    // Trade at 12:45:00Z (2h 45m into the 10:00Z-14:00Z bar)
    const fillTime = 1791204300000;
    const snapped = snapTimeToCandle(fillTime, bars4h);
    expect(snapped).toBe(1791194400000); // 10:00:00Z
  });

  // Daily resolution bars: 2026-10-04 22:00:00Z (CME session for Oct 5), 2026-10-05 22:00:00Z (Oct 6)
  const bars1d = [
    { time: 1791151200000 }, // 2026-10-04 22:00:00Z
    { time: 1791237600000 }, // 2026-10-05 22:00:00Z
  ];

  it("snaps intraday executions to the CME daily session candle open", () => {
    // Trade at 2026-10-05 12:45:00Z
    const fillTime = 1791204300000;
    const snapped = snapTimeToCandle(fillTime, bars1d);
    expect(snapped).toBe(1791151200000); // 2026-10-04 22:00:00Z
  });

  // Weekly resolution bars
  const bars1w = [
    { time: 1790546400000 }, // 2026-09-27 22:00:00Z
    { time: 1791151200000 }, // 2026-10-04 22:00:00Z
  ];

  it("snaps trades to the weekly candle open", () => {
    const fillTime = 1791204300000; // Monday 2026-10-05 12:45:00Z
    const snapped = snapTimeToCandle(fillTime, bars1w);
    expect(snapped).toBe(1791151200000); // 2026-10-04 22:00:00Z
  });

  it("handles edge cases: empty bars, undefined bars, and out-of-range times", () => {
    const fillTime = 1791204300000;
    expect(snapTimeToCandle(fillTime, [])).toBe(fillTime);
    expect(snapTimeToCandle(fillTime, undefined)).toBe(fillTime);

    // Prior to earliest bar
    const wayEarly = 1000000000000;
    expect(snapTimeToCandle(wayEarly, bars4h)).toBe(wayEarly);

    // In or after latest bar
    const latestBar = bars4h[bars4h.length - 1]!;
    expect(snapTimeToCandle(latestBar.time + 3600_000, bars4h)).toBe(latestBar.time);
  });
});
