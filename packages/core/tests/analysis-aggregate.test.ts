import { describe, expect, it } from "vitest";
import { byDuration, DURATION_BUCKETS } from "../src/aggregate";
import { dimensionKeys, analyzeGroups } from "../src/analysis";
import { analyzeAdherence } from "../src/adherence";
import { computeEdgeScore, EDGE_SCORE_VERSION } from "../src/edge-score";
import { computeMetrics } from "../src/metrics";
import type { AnnotatedTrade } from "../src/types";

const makeTrade = (
  durationMs: number,
  status: "win" | "loss" = "win",
  netPnl = 100,
): AnnotatedTrade => ({
  id: `trade-${durationMs}`,
  key: `trade-${durationMs}`,
  accountId: "acc-1",
  symbol: "ES",
  direction: "long",
  status,
  quantity: 1,
  avgEntry: 5000,
  avgExit: 5010,
  openedAt: "2026-03-09T10:00:00Z",
  closedAt: new Date(new Date("2026-03-09T10:00:00Z").getTime() + durationMs).toISOString(),
  durationMs,
  grossPnl: netPnl + 2,
  fee: 2,
  netPnl,
  source: "import",
  executionsCount: 2,
  annotations: { playbook: "breakout" },
});

describe("Core Parity: Aggregate vs Analysis vs Adherence", () => {
  it("guarantees 100% duration bucket key parity between aggregate and analysis across all bands", () => {
    const testCases: [number, string][] = [
      [30_000, "< 1m"],
      [180_000, "1-5m"],
      [600_000, "5-15m"],
      [1_800_000, "15-60m"],
      [7_200_000, "1-4h"],
      [28_800_000, "4-24h"],
      [172_800_000, "> 1d"],
    ];

    for (const [durationMs, expectedKey] of testCases) {
      const trade = makeTrade(durationMs);

      // 1. Check dimensionKeys from analysis.ts
      const analysisKeys = dimensionKeys(trade, "duration", "UTC");
      expect(analysisKeys).toEqual([expectedKey]);

      // 2. Check byDuration from aggregate.ts
      const aggregateBuckets = byDuration([trade]);
      expect(aggregateBuckets).toHaveLength(1);
      expect(aggregateBuckets[0]!.key).toBe(expectedKey);
    }
  });

  it("exports DURATION_BUCKETS matching all canonical bucket definitions", () => {
    expect(DURATION_BUCKETS.map((b) => b.key)).toEqual([
      "< 1m",
      "1-5m",
      "5-15m",
      "15-60m",
      "1-4h",
      "4-24h",
      "> 1d",
    ]);
  });

  it("calculates playbook adherence accurately with analyzeAdherence", () => {
    const trade1 = makeTrade(60_000, "win", 200);
    const trade2 = { ...makeTrade(120_000, "loss", -100), id: "trade-broken", key: "trade-broken" };

    const books = [{ id: "breakout", rules: ["Wait for 15m candle close", "Risk max 1%"] }];
    const checks = [
      {
        tradeKey: trade1.key!,
        playbookId: "breakout",
        rule: "Wait for 15m candle close",
        followed: true,
      },
      { tradeKey: trade1.key!, playbookId: "breakout", rule: "Risk max 1%", followed: true },
      {
        tradeKey: trade2.key!,
        playbookId: "breakout",
        rule: "Wait for 15m candle close",
        followed: false,
      },
      { tradeKey: trade2.key!, playbookId: "breakout", rule: "Risk max 1%", followed: true },
    ];

    const result = analyzeAdherence([trade1, trade2], books, checks);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("breakout");
    expect(result[0]!.followed.trades).toBe(1);
    expect(result[0]!.broken.trades).toBe(1);
    expect(result[0]!.rate).toBe(0.75); // 3 out of 4 followed
  });

  it("computes edge score with proper null guard for less than 5 closed trades", () => {
    const fewTrades = [makeTrade(60_000, "win", 100), makeTrade(120_000, "loss", -50)];
    const metricsFew = computeMetrics(fewTrades);
    const scoreFew = computeEdgeScore(metricsFew);

    expect(scoreFew.score).toBeNull();
    expect(scoreFew.version).toBe(EDGE_SCORE_VERSION);

    // 5 trades allows scoring
    const fiveTrades = [
      makeTrade(60_000, "win", 100),
      makeTrade(120_000, "loss", -50),
      makeTrade(180_000, "win", 150),
      makeTrade(240_000, "win", 80),
      makeTrade(300_000, "loss", -40),
    ];
    const metricsFive = computeMetrics(fiveTrades);
    const scoreFive = computeEdgeScore(metricsFive);

    expect(scoreFive.score).not.toBeNull();
    expect(scoreFive.score).toBeGreaterThan(0);
    expect(scoreFive.score).toBeLessThanOrEqual(100);
    expect(scoreFive.closedTrades).toBe(5);
  });
});
