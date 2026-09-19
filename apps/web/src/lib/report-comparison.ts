import type { GroupSummary } from "@luxalgo/journal-core";
import type { Analysis } from "@/components/reports/types";
import { number, percent } from "@/components/reports/types";

export interface OutperformingGroup {
  name: string;
  key: "a" | "b";
  pnlAdvantage: number;
  winRateAdvantage: number;
  color: string;
  badgeBg: string;
}

export interface ComparisonDeltas {
  diffPnl: number;
  diffWin: number;
  diffPf: number | null;
  diffR: number | null;
  diffTrades: number;
  diffVol: number;
}

export function calculateOutperformingGroup(
  sumA: GroupSummary,
  sumB: GroupSummary,
  nameA: string,
  nameB: string,
): OutperformingGroup | null {
  const diffPnl = sumB.netPnl - sumA.netPnl;
  const diffWin = (sumB.winRate ?? 0) - (sumA.winRate ?? 0);

  if (diffPnl > 0) {
    return {
      name: nameB,
      key: "b",
      pnlAdvantage: diffPnl,
      winRateAdvantage: diffWin,
      color: "text-purple-400",
      badgeBg: "bg-purple-500/15 text-purple-400",
    };
  }

  if (diffPnl < 0) {
    return {
      name: nameA,
      key: "a",
      pnlAdvantage: Math.abs(diffPnl),
      winRateAdvantage: -diffWin,
      color: "text-primary",
      badgeBg: "bg-primary/15 text-primary",
    };
  }

  return null;
}

export function calculateComparisonDeltas(
  sumA: GroupSummary,
  sumB: GroupSummary,
): ComparisonDeltas {
  const diffPnl = sumB.netPnl - sumA.netPnl;
  const diffWin = (sumB.winRate ?? 0) - (sumA.winRate ?? 0);
  const diffPf =
    sumB.profitFactor !== null && sumA.profitFactor !== null
      ? sumB.profitFactor - sumA.profitFactor
      : null;
  const diffR =
    sumB.avgRealizedR !== null && sumA.avgRealizedR !== null
      ? sumB.avgRealizedR - sumA.avgRealizedR
      : null;
  const diffTrades = sumB.trades - sumA.trades;
  const diffVol = sumB.volume - sumA.volume;

  return {
    diffPnl,
    diffWin,
    diffPf,
    diffR,
    diffTrades,
    diffVol,
  };
}

export function formatCohortMetricLines(name: string, d: Analysis): string[] {
  return [
    name,
    `Trades: ${d.summary.trades} | P&L: ${number(d.summary.netPnl)} ${d.currencies[0] ?? ""}`,
    `Win rate: ${percent(d.summary.winRate)} | Planned R: ${number(d.summary.avgPlannedR)} | Realized R: ${number(d.summary.avgRealizedR)}`,
  ];
}
