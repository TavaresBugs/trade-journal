import { describe, expect, it } from "vitest";
import type { GroupSummary } from "@luxalgo/journal-core";
import {
  calculateOutperformingGroup,
  calculateComparisonDeltas,
  formatCohortMetricLines,
} from "../src/lib/report-comparison";
import type { Analysis } from "../src/components/reports/types";

const mockSummary = (patch: Partial<GroupSummary> = {}): GroupSummary => ({
  trades: 10,
  winRate: 0.6,
  netPnl: 1500,
  profitFactor: 2.5,
  avgPlannedR: 2.0,
  avgRealizedR: 1.5,
  volume: 50,
  avgDurationMs: 1800000,
  noLosses: false,
  ...patch,
});

describe("report comparison calculations", () => {
  it("determines when Group B is outperforming Group A", () => {
    const sumA = mockSummary({ netPnl: 1000, winRate: 0.5 });
    const sumB = mockSummary({ netPnl: 2500, winRate: 0.65 });

    const leader = calculateOutperformingGroup(sumA, sumB, "Long trades", "Short trades");
    expect(leader).not.toBeNull();
    expect(leader?.name).toBe("Short trades");
    expect(leader?.key).toBe("b");
    expect(leader?.pnlAdvantage).toBe(1500);
    expect(leader?.winRateAdvantage).toBeCloseTo(0.15);
    expect(leader?.color).toBe("text-purple-400");
  });

  it("determines when Group A is outperforming Group B", () => {
    const sumA = mockSummary({ netPnl: 3000, winRate: 0.7 });
    const sumB = mockSummary({ netPnl: 1000, winRate: 0.4 });

    const leader = calculateOutperformingGroup(sumA, sumB, "Group A", "Group B");
    expect(leader).not.toBeNull();
    expect(leader?.name).toBe("Group A");
    expect(leader?.key).toBe("a");
    expect(leader?.pnlAdvantage).toBe(2000);
    expect(leader?.winRateAdvantage).toBeCloseTo(0.3);
    expect(leader?.color).toBe("text-primary");
  });

  it("returns null when PnL is identical", () => {
    const sumA = mockSummary({ netPnl: 1000 });
    const sumB = mockSummary({ netPnl: 1000 });

    const leader = calculateOutperformingGroup(sumA, sumB, "A", "B");
    expect(leader).toBeNull();
  });

  it("calculates accurate deltas between cohort metrics", () => {
    const sumA = mockSummary({
      netPnl: 1000,
      winRate: 0.5,
      profitFactor: 1.5,
      avgRealizedR: 1.0,
      trades: 20,
      volume: 100,
    });
    const sumB = mockSummary({
      netPnl: 1800,
      winRate: 0.6,
      profitFactor: 2.2,
      avgRealizedR: 1.8,
      trades: 25,
      volume: 120,
    });

    const deltas = calculateComparisonDeltas(sumA, sumB);
    expect(deltas.diffPnl).toBe(800);
    expect(deltas.diffWin).toBeCloseTo(0.1);
    expect(deltas.diffPf).toBeCloseTo(0.7);
    expect(deltas.diffR).toBeCloseTo(0.8);
    expect(deltas.diffTrades).toBe(5);
    expect(deltas.diffVol).toBe(20);
  });

  it("handles null values safely in profit factor and realized R deltas", () => {
    const sumA = mockSummary({ profitFactor: null, avgRealizedR: null });
    const sumB = mockSummary({ profitFactor: 2.0, avgRealizedR: null });

    const deltas = calculateComparisonDeltas(sumA, sumB);
    expect(deltas.diffPf).toBeNull();
    expect(deltas.diffR).toBeNull();
  });

  it("formats cohort metrics lines for document export", () => {
    const mockAnalysis: Analysis = {
      accounts: [{ id: "acc1", name: "Main" }],
      summary: mockSummary({ trades: 42, netPnl: 3450, winRate: 0.58 }),
      groups: [],
      playbooks: [],
      currencies: ["USD"],
      timeZone: "America/New_York",
    };

    const lines = formatCohortMetricLines("Long Trades", mockAnalysis);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Long Trades");
    expect(lines[1]).toContain("Trades: 42");
    expect(lines[1]).toContain("P&L: 3,450 USD");
    expect(lines[2]).toContain("Win rate: 58.0%");
  });
});
