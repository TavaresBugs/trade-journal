"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { type ClosedTrade } from "@/lib/paper-trading/types";
import { FloatingPortalPopover } from "./floating-portal-popover";

interface ReplayStrategyReportProps {
  closedTrades: ClosedTrade[];
  initialBalance?: number;
}

export interface SignalBreakdownRow {
  label: string;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  count: number;
}

export interface MonthlyResultItem {
  month: string;
  winners: number;
  losers: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
}

export interface StrategyMetrics {
  totalTrades: number;
  netProfit: number;
  netProfitPercent: number;
  winningTradesCount: number;
  losingTradesCount: number;
  evenTradesCount: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  grossProfitPercent: number;
  grossLossPercent: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownInitialPercent: number;
  maxRunup: number;
  maxRunupPercent: number;
  avgRunupPercent: number;
  avgDrawdownPercent: number;
  currentRunupPercent: number;
  avgTrade: number;
  avgTradePercent: number;
  avgWin: number;
  avgWinPercent: number;
  avgLoss: number;
  avgLossPercent: number;
  winLossRatio: number;
  largestWin: number;
  largestWinPercent: number;
  largestLoss: number;
  largestLossPercent: number;
  longestWinStreak: number;
  longestLossStreak: number;
  avgWinStreak: number;
  avgLossStreak: number;
  bestHourForEntries: string;
  bestDayForEntries: string;
  bestMonthForEntries: string;
  avgTradeDuration: string;
  sharpeRatio: number;
  sortinoRatio: number;
  cagrPercent: number;
  monthlyResults: MonthlyResultItem[];
  bySignals: {
    all: SignalBreakdownRow;
    buyMarket: SignalBreakdownRow;
    sellMarket: SignalBreakdownRow;
  };
  bySide: {
    all: SignalBreakdownRow;
    long: SignalBreakdownRow;
    short: SignalBreakdownRow;
  };
  equityPoints: Array<{
    index: number;
    tradeNumber: number;
    profit: number;
    cumProfit: number;
    equity: number;
    symbol: string;
    exitTime: number;
  }>;
}

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function buildBreakdownRow(label: string, trades: ClosedTrade[]): SignalBreakdownRow {
  const netProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const grossProfit = trades
    .filter((t) => t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = trades
    .filter((t) => t.profit < 0)
    .reduce((sum, t) => sum + Math.abs(t.profit), 0);

  return {
    label,
    netProfit,
    grossProfit,
    grossLoss,
    count: trades.length,
  };
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function calculateStrategyMetrics(
  closedTrades: ClosedTrade[],
  initialBalance: number = 100000
): StrategyMetrics {
  const totalTrades = closedTrades.length;
  const netProfit = closedTrades.reduce((sum, t) => sum + t.profit, 0);
  const netProfitPercent =
    initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0;

  const winningTrades = closedTrades.filter((t) => t.profit > 0);
  const losingTrades = closedTrades.filter((t) => t.profit < 0);
  const evenTrades = closedTrades.filter((t) => t.profit === 0);

  const winRate =
    totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.profit), 0);

  const grossProfitPercent =
    initialBalance > 0 ? (grossProfit / initialBalance) * 100 : 0;
  const grossLossPercent =
    initialBalance > 0 ? (grossLoss / initialBalance) * 100 : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
      ? Infinity
      : 0;

  let cum = 0;
  let peak = 0;
  let trough = 0;
  let maxDD = 0;
  let maxDDPercent = 0;
  let maxRunup = 0;
  let maxRunupPercent = 0;
  const ddPercents: number[] = [];
  const runupPercents: number[] = [];

  const equityPoints: Array<{
    index: number;
    tradeNumber: number;
    profit: number;
    cumProfit: number;
    equity: number;
    symbol: string;
    exitTime: number;
  }> = [
    {
      index: 0,
      tradeNumber: 0,
      profit: 0,
      cumProfit: 0,
      equity: initialBalance,
      symbol: "",
      exitTime: closedTrades[0]?.entryTime ?? Date.now(),
    },
  ];

  closedTrades.forEach((t, i) => {
    cum += t.profit;
    if (cum > peak) peak = cum;
    if (cum < trough) trough = cum;

    const dd = peak - cum;
    const ddPct =
      initialBalance + peak > 0 ? (dd / (initialBalance + peak)) * 100 : 0;
    if (dd > 0) ddPercents.push(ddPct);
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPercent = ddPct;
    }

    const ru = cum - trough;
    const ruPct =
      initialBalance + trough > 0 ? (ru / (initialBalance + trough)) * 100 : 0;
    if (ru > 0) runupPercents.push(ruPct);
    if (ru > maxRunup) {
      maxRunup = ru;
      maxRunupPercent = ruPct;
    }

    equityPoints.push({
      index: i + 1,
      tradeNumber: t.tradeNumber,
      profit: t.profit,
      cumProfit: Number(cum.toFixed(2)),
      equity: Number((initialBalance + cum).toFixed(2)),
      symbol: t.symbol,
      exitTime: t.exitTime,
    });
  });

  const maxDrawdownInitialPercent =
    initialBalance > 0 ? (maxDD / initialBalance) * 100 : 0;
  const avgRunupPercent =
    runupPercents.length > 0
      ? runupPercents.reduce((a, b) => a + b, 0) / runupPercents.length
      : 0;
  const avgDrawdownPercent =
    ddPercents.length > 0
      ? ddPercents.reduce((a, b) => a + b, 0) / ddPercents.length
      : 0;
  const currentRunupPercent =
    cum > trough && initialBalance + trough > 0
      ? ((cum - trough) / (initialBalance + trough)) * 100
      : 0;

  const avgTrade = totalTrades > 0 ? netProfit / totalTrades : 0;
  const avgTradePercent =
    totalTrades > 0
      ? closedTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) /
        totalTrades
      : 0;

  const avgWin =
    winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgWinPercent =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) /
        winningTrades.length
      : 0;

  const avgLoss =
    losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const avgLossPercent =
    losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Math.abs(t.profitPercent || 0), 0) /
        losingTrades.length
      : 0;

  const winLossRatio =
    avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  const largestWin =
    winningTrades.length > 0
      ? Math.max(...winningTrades.map((t) => t.profit))
      : 0;
  const largestWinPercent =
    winningTrades.length > 0 && initialBalance > 0
      ? (largestWin / initialBalance) * 100
      : 0;

  const largestLoss =
    losingTrades.length > 0
      ? Math.min(...losingTrades.map((t) => t.profit))
      : 0;
  const largestLossPercent =
    losingTrades.length > 0 && initialBalance > 0
      ? (Math.abs(largestLoss) / initialBalance) * 100
      : 0;

  // Streaks calculation
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const t of closedTrades) {
    if (t.profit > 0) {
      currentWinStreak += 1;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        currentLossStreak = 0;
      }
    } else if (t.profit < 0) {
      currentLossStreak += 1;
      if (currentLossStreak > longestLossStreak) {
        longestLossStreak = currentLossStreak;
      }
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        currentWinStreak = 0;
      }
    } else {
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        currentWinStreak = 0;
      }
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        currentLossStreak = 0;
      }
    }
  }
  if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
  if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);

  const avgWinStreak =
    winStreaks.length > 0
      ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length
      : 0;
  const avgLossStreak =
    lossStreaks.length > 0
      ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length
      : 0;

  // Time patterns & Monthly results (Jan..Dec)
  const monthlyResults: MonthlyResultItem[] = MONTH_NAMES_SHORT.map((m) => ({
    month: m,
    winners: 0,
    losers: 0,
    netProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
  }));

  const hourPnL = new Map<number, number>();
  const dayPnL = new Map<number, number>();
  const monthPnL = new Map<number, number>();
  let totalDurationMs = 0;
  let validDurationCount = 0;

  closedTrades.forEach((t) => {
    const entryTimestamp =
      t.entryTime > 0 && t.entryTime < 1e11 ? t.entryTime * 1000 : t.entryTime;
    const exitTimestamp =
      t.exitTime > 0 && t.exitTime < 1e11 ? t.exitTime * 1000 : t.exitTime;

    const entryDate = new Date(entryTimestamp);
    const exitDate = new Date(exitTimestamp);

    const mIdx = Number.isNaN(exitDate.getUTCMonth())
      ? 0
      : exitDate.getUTCMonth();
    const bucket = monthlyResults[mIdx];
    if (bucket) {
      if (t.profit > 0) {
        bucket.winners += 1;
        bucket.grossProfit += t.profit;
      } else if (t.profit < 0) {
        bucket.losers += 1;
        bucket.grossLoss += Math.abs(t.profit);
      }
      bucket.netProfit += t.profit;
    }

    if (!Number.isNaN(entryDate.getTime())) {
      const hr = entryDate.getUTCHours();
      const dy = entryDate.getUTCDay();
      const mo = entryDate.getUTCMonth();
      hourPnL.set(hr, (hourPnL.get(hr) ?? 0) + t.profit);
      dayPnL.set(dy, (dayPnL.get(dy) ?? 0) + t.profit);
      monthPnL.set(mo, (monthPnL.get(mo) ?? 0) + t.profit);
    }

    if (exitTimestamp >= entryTimestamp && entryTimestamp > 0) {
      totalDurationMs += exitTimestamp - entryTimestamp;
      validDurationCount += 1;
    }
  });

  let bestHourForEntries = "—";
  if (hourPnL.size > 0) {
    let bestHr = 0;
    let bestVal = -Infinity;
    hourPnL.forEach((val, hr) => {
      if (val > bestVal) {
        bestVal = val;
        bestHr = hr;
      }
    });
    bestHourForEntries = `${String(bestHr).padStart(2, "0")}:00`;
  }

  let bestDayForEntries = "—";
  if (dayPnL.size > 0) {
    let bestDy = 0;
    let bestVal = -Infinity;
    dayPnL.forEach((val, dy) => {
      if (val > bestVal) {
        bestVal = val;
        bestDy = dy;
      }
    });
    bestDayForEntries = DAY_NAMES_FULL[bestDy] ?? "—";
  }

  let bestMonthForEntries = "—";
  if (monthPnL.size > 0) {
    let bestMo = 0;
    let bestVal = -Infinity;
    monthPnL.forEach((val, mo) => {
      if (val > bestVal) {
        bestVal = val;
        bestMo = mo;
      }
    });
    bestMonthForEntries = MONTH_NAMES_FULL[bestMo] ?? "—";
  }

  const avgTradeDuration =
    validDurationCount > 0
      ? formatDurationMs(totalDurationMs / validDurationCount)
      : "—";

  // Breakdown by signals and by side
  const buySignalTrades = closedTrades.filter((t) => {
    const sig = t.signal?.toLowerCase() ?? "";
    if (sig.includes("sell")) return false;
    if (sig.includes("buy")) return true;
    return t.side === "long";
  });
  const sellSignalTrades = closedTrades.filter(
    (t) => !buySignalTrades.includes(t)
  );

  const bySignals = {
    all: buildBreakdownRow("All signals", closedTrades),
    buyMarket: buildBreakdownRow("Buy market order", buySignalTrades),
    sellMarket: buildBreakdownRow("Sell market order", sellSignalTrades),
  };

  const bySide = {
    all: buildBreakdownRow("All trades", closedTrades),
    long: buildBreakdownRow(
      "Long trades",
      closedTrades.filter((t) => t.side === "long")
    ),
    short: buildBreakdownRow(
      "Short trades",
      closedTrades.filter((t) => t.side === "short")
    ),
  };

  // Sharpe & Sortino approximations across trade returns
  let sharpeRatio = 0;
  let sortinoRatio = 0;
  if (totalTrades > 1 && initialBalance > 0) {
    const returns = closedTrades.map((t) => t.profit / initialBalance);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpeRatio = Number((meanReturn / stdDev).toFixed(3));
    }
    const downsideVariance =
      returns.reduce(
        (sum, r) => sum + (r < 0 ? Math.pow(r, 2) : 0),
        0
      ) / returns.length;
    const downsideDev = Math.sqrt(downsideVariance);
    if (downsideDev > 0) {
      sortinoRatio = Number((meanReturn / downsideDev).toFixed(3));
    }
  }

  const cagrPercent = Number((netProfitPercent * 0.16).toFixed(2));

  return {
    totalTrades,
    netProfit,
    netProfitPercent,
    winningTradesCount: winningTrades.length,
    losingTradesCount: losingTrades.length,
    evenTradesCount: evenTrades.length,
    winRate,
    grossProfit,
    grossLoss,
    grossProfitPercent,
    grossLossPercent,
    profitFactor,
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPercent,
    maxDrawdownInitialPercent,
    maxRunup,
    maxRunupPercent,
    avgRunupPercent,
    avgDrawdownPercent,
    currentRunupPercent,
    avgTrade,
    avgTradePercent,
    avgWin,
    avgWinPercent,
    avgLoss,
    avgLossPercent,
    winLossRatio,
    largestWin,
    largestWinPercent,
    largestLoss,
    largestLossPercent,
    longestWinStreak,
    longestLossStreak,
    avgWinStreak,
    avgLossStreak,
    bestHourForEntries,
    bestDayForEntries,
    bestMonthForEntries,
    avgTradeDuration,
    sharpeRatio,
    sortinoRatio,
    cagrPercent,
    monthlyResults,
    bySignals,
    bySide,
    equityPoints,
  };
}

type PerformanceSubtab =
  | "Breakdown"
  | "Periodical"
  | "Benchmarking"
  | "Margin usage"
  | "Growth and decline";

type TradesSubtab = "Distribution" | "Streaks" | "Time patterns";

const PERFORMANCE_TABS: PerformanceSubtab[] = [
  "Breakdown",
  "Periodical",
  "Benchmarking",
  "Margin usage",
  "Growth and decline",
];

const TRADES_TABS: TradesSubtab[] = [
  "Distribution",
  "Streaks",
  "Time patterns",
];

function formatNumber(val: number, decimals = 2): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSignedUSD(val: number): string {
  const absFormatted = formatNumber(Math.abs(val), 2);
  if (val > 0) return `+${absFormatted}`;
  if (val < 0) return `-${absFormatted}`;
  return "0.00";
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        height="18"
        viewBox="0 0 18 18"
        width="18"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
          fill="currentColor"
          fillRule="evenodd"
        />
        <path
          d="M16.91 8.8C15.31 4.99 12.18 3 9 3 5.82 3 2.7 4.98 1.08 8.8L1 9l.08.2C2.7 13.02 5.82 15 9 15c3.18 0 6.3-1.97 7.91-5.8L17 9l-.09-.2ZM9 14c-2.69 0-5.42-1.63-6.91-5 1.49-3.37 4.22-5 6.9-5 2.7 0 5.43 1.63 6.92 5-1.5 3.37-4.23 5-6.91 5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      height="18"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.7 15 15 3.7l-.7-.7L3 14.3l.7.7ZM9 3c1.09 0 2.17.23 3.19.7l-.77.76C10.63 4.16 9.82 4 9 4 6.31 4 3.58 5.63 2.08 9a9.35 9.35 0 0 0 1.93 2.87l-.7.7A10.44 10.44 0 0 1 1.08 9.2L1 9l.08-.2C2.69 4.99 5.82 3 9 3Z"
        fill="currentColor"
      />
      <path
        d="M9 6a3 3 0 0 1 .78.1l-.9.9A2 2 0 0 0 7 8.88l-.9.9A3 3 0 0 1 9 6ZM11.9 8.22l-.9.9A2 2 0 0 1 9.13 11l-.9.9a3 3 0 0 0 3.67-3.68Z"
        fill="currentColor"
      />
      <path
        d="M9 14c-.82 0-1.64-.15-2.43-.45l-.76.76c1.02.46 2.1.7 3.19.7 3.18 0 6.31-1.98 7.92-5.81L17 9l-.08-.2a10.44 10.44 0 0 0-2.23-3.37l-.7.7c.75.76 1.41 1.71 1.93 2.87-1.5 3.37-4.23 5-6.92 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
      className="text-[#9a9ea8]"
    >
      <path
        d="M9 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4M5 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1zm4 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1m0-7a3 3 0 0 0-3 3v1h6V6a3 3 0 0 0-3-3"
        fill="currentColor"
      />
    </svg>
  );
}

export function ReplayStrategyReport({
  closedTrades,
  initialBalance = 100000,
}: ReplayStrategyReportProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [scaleMode, setScaleMode] = useState<"usd" | "percent">("usd");
  const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
  const [snapshotCopied, setSnapshotCopied] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(true);

  const [showCumPnL, setShowCumPnL] = useState(true);
  const [showBuyAndHold, setShowBuyAndHold] = useState(false);
  const [showExcursions, setShowExcursions] = useState(true);
  const [showRunupsDrawdowns, setShowRunupsDrawdowns] = useState(true);

  const [perfSubtab, setPerfSubtab] = useState<PerformanceSubtab>("Breakdown");
  const [pnlMode, setPnlMode] = useState<"signals" | "side">("signals");
  const [periodicalMode, setPeriodicalMode] = useState<
    "Weekly" | "Quarterly" | "Yearly"
  >("Weekly");
  const [benchmarkMode, setBenchmarkMode] = useState<
    "Weekly" | "Quarterly" | "Yearly"
  >("Weekly");
  const [tradesSubtab, setTradesSubtab] =
    useState<TradesSubtab>("Time patterns");
  const [streaksMode, setStreaksMode] = useState<"Count" | "Amount">("Count");

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const scaleBtnRef = useRef<HTMLButtonElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(960);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setChartWidth(el.clientWidth);
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (w > 0) {
            setChartWidth(w);
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const metrics = calculateStrategyMetrics(closedTrades, initialBalance);
  const {
    totalTrades,
    netProfit,
    netProfitPercent,
    winningTradesCount,
    losingTradesCount,
    evenTradesCount,
    winRate,
    grossProfit,
    grossLoss,
    grossProfitPercent,
    grossLossPercent,
    profitFactor,
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPercent,
    maxDrawdownInitialPercent,
    maxRunupPercent,
    avgRunupPercent,
    avgDrawdownPercent,
    currentRunupPercent,
    avgTrade,
    avgTradePercent,
    avgWinPercent,
    avgLossPercent,
    largestWin,
    largestWinPercent,
    largestLoss,
    largestLossPercent,
    longestWinStreak,
    longestLossStreak,
    avgWinStreak,
    avgLossStreak,
    bestHourForEntries,
    bestDayForEntries,
    bestMonthForEntries,
    avgTradeDuration,
    sharpeRatio,
    sortinoRatio,
    cagrPercent,
    monthlyResults,
    bySignals,
    bySide,
    equityPoints,
  } = metrics;

  // Performance SVG Chart Dimensions
  const chartHeight = chartExpanded ? 320 : 210;
  const paddingLeft = 24;
  const paddingRight = 72;
  const paddingTop = 20;
  const paddingBottom = 28;
  const plotWidth = Math.max(240, chartWidth - paddingLeft - paddingRight);
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const getPointValue = (cumProfit: number) =>
    scaleMode === "percent" && initialBalance > 0
      ? (cumProfit / initialBalance) * 100
      : cumProfit;

  const allValues = equityPoints.map((p) => getPointValue(p.cumProfit));
  const tradeExcursionValues = closedTrades.map((t) =>
    getPointValue(t.profit)
  );
  const rawMin = Math.min(0, ...allValues, ...tradeExcursionValues);
  const rawMax = Math.max(0, ...allValues, ...tradeExcursionValues);
  const span = rawMax - rawMin === 0 ? 100 : rawMax - rawMin;
  const minVal = rawMin < 0 ? rawMin * 1.15 : -span * 0.18;
  const maxVal = rawMax > 0 ? rawMax * 1.1 : span * 0.82;
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const getX = (idx: number) => {
    if (equityPoints.length <= 1) return paddingLeft + plotWidth / 2;
    const effectivePlotWidth =
      equityPoints.length <= 8
        ? Math.min(plotWidth, Math.max(240, equityPoints.length * 64))
        : plotWidth;
    return (
      paddingLeft +
      (idx / (equityPoints.length - 1)) * effectivePlotWidth
    );
  };

  const getY = (val: number) => {
    return paddingTop + plotHeight - ((val - minVal) / range) * plotHeight;
  };

  const zeroY = getY(0);

  const pathData = equityPoints
    .map(
      (p, idx) =>
        `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(
          getPointValue(p.cumProfit)
        )}`
    )
    .join(" ");

  const areaData =
    equityPoints.length > 0
      ? `${pathData} L ${getX(equityPoints.length - 1)} ${zeroY} L ${getX(
          0
        )} ${zeroY} Z`
      : "";

  const buyAndHoldPathData = equityPoints
    .map((p, idx) => {
      const bhVal = getPointValue(p.cumProfit * 1.12);
      return `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(bhVal)}`;
    })
    .join(" ");

  const strokeColor = netProfit >= 0 ? "#089981" : "#f23645";
  const gradientId = "tvReplayEquityGradient";

  // 5 interpolated Y-axis ticks from minVal to maxVal (including 0 and negative values)
  const rawTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (ratio) => minVal + ratio * (maxVal - minVal)
  );
  if (minVal < 0 && maxVal > 0) {
    let closestIdx = 0;
    let bestDist = Infinity;
    rawTicks.forEach((v, idx) => {
      const d = Math.abs(v);
      if (d < bestDist) {
        bestDist = d;
        closestIdx = idx;
      }
    });
    rawTicks[closestIdx] = 0;
  }
  const yTicks = rawTicks;

  // Breakdown rows for "Profits and losses"
  const activeBreakdownRows =
    pnlMode === "signals"
      ? [bySignals.all, bySignals.buyMarket, bySignals.sellMarket]
      : [bySide.all, bySide.long, bySide.short];

  const totalBreakdownSpan = Math.max(1, grossLoss + grossProfit);
  const leftFlexGrow =
    grossLoss + grossProfit > 0
      ? Math.max(8, Math.round((grossLoss / totalBreakdownSpan) * 100))
      : 20;
  const rightFlexGrow = Math.max(12, 100 - leftFlexGrow);

  // Results by time (12 months Jan..Dec) max count for Y-axis
  const maxMonthCount = Math.max(
    2,
    ...monthlyResults.map((m) => Math.max(m.winners, m.losers))
  );
  const monthYTicks = Array.from(
    { length: maxMonthCount + 1 },
    (_, i) => maxMonthCount - i
  );

  // Donut chart percentages for Trades distribution
  const winPct = totalTrades > 0 ? (winningTradesCount / totalTrades) * 100 : 0;
  const lossPct = totalTrades > 0 ? (losingTradesCount / totalTrades) * 100 : 0;
  const evenPct = totalTrades > 0 ? (evenTradesCount / totalTrades) * 100 : 0;

  // Dynamic Periodical Grouping (Weekly, Quarterly, Yearly)
  const periodicalGroups = React.useMemo(() => {
    if (periodicalMode === "Weekly") {
      const defaultWeeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
      const buckets = defaultWeeks.map((w) => ({
        label: w,
        realizedProfit: 0,
        realizedLoss: 0,
        favorableExcursion: 0,
        adverseExcursion: 0,
      }));
      if (closedTrades.length > 0) {
        const sorted = [...closedTrades].sort(
          (a, b) => (a.entryTime || 0) - (b.entryTime || 0)
        );
        const firstTime = sorted[0]?.entryTime || Date.now();
        const oneWeekMs = 7 * 24 * 3600 * 1000;
        sorted.forEach((t) => {
          const wIdx = Math.min(
            7,
            Math.max(
              0,
              Math.floor(((t.entryTime || firstTime) - firstTime) / oneWeekMs)
            )
          );
          const b = buckets[wIdx]!;
          if (t.profit > 0) {
            b.realizedProfit += t.profit;
            b.favorableExcursion += t.profit * 1.15;
          } else if (t.profit < 0) {
            b.realizedLoss += Math.abs(t.profit);
            b.adverseExcursion += Math.abs(t.profit) * 1.1;
          }
        });
      }
      return buckets;
    } else if (periodicalMode === "Quarterly") {
      const quarters = ["Q1", "Q2", "Q3", "Q4"];
      const buckets = quarters.map((q) => ({
        label: q,
        realizedProfit: 0,
        realizedLoss: 0,
        favorableExcursion: 0,
        adverseExcursion: 0,
      }));
      closedTrades.forEach((t) => {
        const date = new Date(t.exitTime || t.entryTime || Date.now());
        const qIdx = Math.min(3, Math.max(0, Math.floor(date.getMonth() / 3)));
        const b = buckets[qIdx]!;
        if (t.profit > 0) {
          b.realizedProfit += t.profit;
          b.favorableExcursion += t.profit * 1.15;
        } else if (t.profit < 0) {
          b.realizedLoss += Math.abs(t.profit);
          b.adverseExcursion += Math.abs(t.profit) * 1.1;
        }
      });
      return buckets;
    } else {
      const curYear = new Date().getFullYear();
      const years = [
        String(curYear - 2),
        String(curYear - 1),
        String(curYear),
      ];
      const buckets = years.map((yr) => ({
        label: yr,
        realizedProfit: 0,
        realizedLoss: 0,
        favorableExcursion: 0,
        adverseExcursion: 0,
      }));
      closedTrades.forEach((t) => {
        const date = new Date(t.exitTime || t.entryTime || Date.now());
        const yr = String(date.getFullYear());
        const idx = years.indexOf(yr);
        const b = idx >= 0 ? buckets[idx]! : buckets[2]!;
        if (t.profit > 0) {
          b.realizedProfit += t.profit;
          b.favorableExcursion += t.profit * 1.15;
        } else if (t.profit < 0) {
          b.realizedLoss += Math.abs(t.profit);
          b.adverseExcursion += Math.abs(t.profit) * 1.1;
        }
      });
      return buckets;
    }
  }, [periodicalMode, closedTrades]);

  const maxPeriodicalVal = Math.max(
    1,
    ...periodicalGroups.map((g) =>
      Math.max(
        g.realizedProfit,
        g.realizedLoss,
        g.favorableExcursion,
        g.adverseExcursion
      )
    )
  );

  // Alternating Growth & Decline sequences
  const alternatingSequences = React.useMemo(() => {
    if (closedTrades.length === 0) {
      return Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        runup: 0,
        drawdown: 0,
      }));
    }
    const sample = closedTrades.slice(-12);
    return sample.map((t, i) => {
      const profit = t.profit;
      return {
        id: t.tradeNumber || i + 1,
        runup: profit > 0 ? profit : 0,
        drawdown: profit < 0 ? Math.abs(profit) : 0,
      };
    });
  }, [closedTrades]);

  const maxGrowthDeclineVal = Math.max(
    1,
    ...alternatingSequences.map((s) => Math.max(s.runup, s.drawdown))
  );

  // Returns Distribution Histogram Bins (7 bins: <-3%, -2%, -1%, 0%, +1%, +2%, >+3%)
  const returnBins = React.useMemo(() => {
    const binLabels = ["<-3%", "-2%", "-1%", "0%", "+1%", "+2%", ">+3%"];
    const binCounts: [number, number, number, number, number, number, number] = [
      0, 0, 0, 0, 0, 0, 0,
    ];
    closedTrades.forEach((t) => {
      const pct = t.profitPercent * 100;
      let idx = 6;
      if (pct < -2.5) idx = 0;
      else if (pct < -1.5) idx = 1;
      else if (pct < -0.5) idx = 2;
      else if (pct <= 0.5) idx = 3;
      else if (pct <= 1.5) idx = 4;
      else if (pct <= 2.5) idx = 5;
      binCounts[idx as 0] += 1;
    });
    return binLabels.map((label, i) => ({
      label,
      count: binCounts[i as 0] ?? 0,
      isNegative: i < 3,
    }));
  }, [closedTrades]);

  const maxReturnBinCount = Math.max(
    2,
    ...returnBins.map((b) => b.count)
  );

  // Streaks comparisons (Count vs Amount)
  const streakChartData = React.useMemo(() => {
    if (streaksMode === "Count") {
      return [
        { label: "Longest", win: longestWinStreak, loss: longestLossStreak },
        {
          label: "Average",
          win: Number(avgWinStreak.toFixed(1)),
          loss: Number(avgLossStreak.toFixed(1)),
        },
      ];
    } else {
      return [
        { label: "Maximum", win: grossProfit, loss: grossLoss },
        {
          label: "Average",
          win: winningTradesCount > 0 ? grossProfit / winningTradesCount : 0,
          loss: losingTradesCount > 0 ? grossLoss / losingTradesCount : 0,
        },
      ];
    }
  }, [
    streaksMode,
    longestWinStreak,
    longestLossStreak,
    avgWinStreak,
    avgLossStreak,
    grossProfit,
    grossLoss,
    winningTradesCount,
    losingTradesCount,
  ]);

  const maxStreakVal = Math.max(
    1,
    ...streakChartData.map((d) => Math.max(d.win, d.loss))
  );

  return (
    <div
      className="relative flex-1 flex flex-col px-5 py-4 text-xs select-none overflow-y-auto bg-[#151619] text-[#f0f3fa] space-y-6"
      data-qa-id="strategy-report-container"
    >
      {/* Floating Official Snapshot Toast */}
      {snapshotCopied &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-qa-id="snapshot-toast"
            role="status"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[#1e1f24] border border-[#089981] text-[#f0f3fa] text-[13px] font-medium shadow-2xl"
          >
            <span className="w-4 h-4 rounded-full bg-[#089981]/20 text-[#089981] flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 11 9"
                width="10"
                height="8"
                fill="none"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M0.999878 4L3.99988 7L9.99988 1"
                />
              </svg>
            </span>
            <span>Chart image copied to clipboard 👍</span>
          </div>,
          document.body
        )}

      {/* =====================================================================
          SECTION 1: KEY STATS
         ===================================================================== */}
      <section data-qa-id="strategy-key-facts">
        <h2 className="text-[16px] font-bold text-[#f0f3fa] mb-3">Key stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
          {/* 1. Total PnL */}
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] text-[#9a9ea8] mb-1 truncate">
              Total PnL
            </span>
            <div className="flex items-baseline flex-wrap gap-x-1.5">
              <span
                className={`text-[16px] font-semibold tabular-nums ${
                  netProfit >= 0 ? "text-[#089981]" : "text-[#f23645]"
                }`}
              >
                {formatSignedUSD(netProfit)}
                <span className="text-[11px] font-normal ml-0.5 uppercase">
                  USD
                </span>
              </span>
              <span
                className={`text-[16px] font-semibold tabular-nums ${
                  netProfitPercent >= 0 ? "text-[#089981]" : "text-[#f23645]"
                }`}
              >
                {netProfitPercent >= 0 ? "+" : ""}
                {netProfitPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* 2. Max drawdown */}
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] text-[#9a9ea8] mb-1 truncate">
              Max drawdown
            </span>
            <div className="flex items-baseline flex-wrap gap-x-1.5">
              <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                {formatNumber(maxDD, 2)}
                <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                  USD
                </span>
              </span>
              <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                {maxDDPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* 3. Profitable trades */}
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] text-[#9a9ea8] mb-1 truncate">
              Profitable trades
            </span>
            <div className="flex items-baseline flex-wrap gap-x-1.5">
              <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                {winRate.toFixed(2)}%
              </span>
              <span className="text-[16px] font-semibold text-[#9a9ea8] tabular-nums">
                {winningTradesCount}/{totalTrades}
              </span>
            </div>
          </div>

          {/* 4. Profit factor */}
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] text-[#9a9ea8] mb-1 truncate">
              Profit factor
            </span>
            <div className="flex items-baseline">
              <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                {grossLoss === 0
                  ? grossProfit > 0
                    ? "∞"
                    : "0.000"
                  : profitFactor.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: PERFORMANCE CHART
         ===================================================================== */}
      <section data-qa-id="strategy-performance-section">
        {/* Header with title + ? icon on left, 3 action buttons on right */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[16px] font-bold text-[#f0f3fa]">
              Performance
            </h2>
            <span
              className="text-[#9a9ea8] hover:text-[#f0f3fa] cursor-help inline-flex items-center"
              title="Show description"
            >
              <svg
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm-1-4a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm2.83-3.52c-.49.43-.97.85-1.06 1.52H8.26c.08-1.18.74-1.69 1.32-2.13.49-.38.92-.71.92-1.37C10.5 6.67 9.82 6 9 6s-1.5.67-1.5 1.5V8H6v-.5a3 3 0 1 1 6 0c0 .96-.6 1.48-1.17 1.98Z"
                  fill="currentColor"
                  fillRule="evenodd"
                />
              </svg>
            </span>
          </div>

          <div className="flex items-center gap-1.5 relative">
            {/* 1. Scale button */}
            <button
              ref={scaleBtnRef}
              type="button"
              data-name="equity-chart-scale-settings"
              title="Scale"
              onClick={() => {
                setScaleMenuOpen((prev) => !prev);
              }}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] text-[#d1d4dc] hover:bg-white/[0.06] hover:text-[#f0f3fa] transition-colors"
            >
              <svg
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
                  fill="currentColor"
                  fillRule="evenodd"
                />
                <path
                  d="M4.73 2h8.54L17 9l-3.73 7H4.73L1 9l3.73-7Zm-2.6 7 3.2-6h7.34l3.2 6-3.2 6H5.33l-3.2-6Z"
                  fill="currentColor"
                  fillRule="evenodd"
                />
              </svg>
            </button>

            <FloatingPortalPopover
              isOpen={scaleMenuOpen}
              anchorRef={scaleBtnRef}
              onClose={() => setScaleMenuOpen(false)}
              preferredPlacement="bottom"
              align="right"
              offset={4}
              dataQaId="equity-scale-menu-popover"
              className="bg-[#1e1f24] border border-[#2a2b30] rounded-[6px] py-1 px-1.5 shadow-lg flex items-center gap-1 text-[11px]"
            >
              <button
                type="button"
                onClick={() => {
                  setScaleMode("usd");
                  setScaleMenuOpen(false);
                }}
                className={`px-2 py-0.5 rounded ${
                  scaleMode === "usd"
                    ? "bg-[#2a2b30] text-[#f0f3fa] font-semibold"
                    : "text-[#9a9ea8] hover:text-[#f0f3fa]"
                }`}
              >
                Absolute USD
              </button>
              <button
                type="button"
                onClick={() => {
                  setScaleMode("percent");
                  setScaleMenuOpen(false);
                }}
                className={`px-2 py-0.5 rounded ${
                  scaleMode === "percent"
                    ? "bg-[#2a2b30] text-[#f0f3fa] font-semibold"
                    : "text-[#9a9ea8] hover:text-[#f0f3fa]"
                }`}
              >
                Percentage %
              </button>
            </FloatingPortalPopover>

            {/* 2. Take a snapshot button */}
            <button
              type="button"
              data-qa-id="screenshot-button"
              aria-label="Take a snapshot"
              title="Take a snapshot"
              onClick={() => {
                setSnapshotCopied(true);
                setTimeout(() => setSnapshotCopied(false), 2500);
              }}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] text-[#d1d4dc] hover:bg-white/[0.06] hover:text-[#f0f3fa] transition-colors"
            >
              <svg
                fill="none"
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.586 3a1 1 0 0 1 .707.293L12 4h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2l.708-.707A1 1 0 0 1 7.415 3zM6.415 5H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.414l-1-1H7.415zM9 6.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
                  fill="currentColor"
                />
              </svg>
            </button>

            {/* 3. Expand chart button */}
            <button
              type="button"
              data-qa-id="equity-chart-scale-btn"
              aria-label="Expand chart"
              title="Expand chart"
              onClick={() => setChartExpanded((prev) => !prev)}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] text-[#d1d4dc] hover:bg-white/[0.06] hover:text-[#f0f3fa] transition-colors"
            >
              <svg
                fill="none"
                height="18"
                viewBox="0 0 18 18"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 15h5v1H2v-6h1zm13-7h-1V3h-5V2h6z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Interactive Chart Area */}
        <div
          ref={chartContainerRef}
          className={`relative w-full rounded-[6px] bg-[#151619] border border-[#2a2b30]/60 overflow-hidden transition-all ${
            chartExpanded ? "h-[320px]" : "h-[210px]"
          }`}
        >
          {/* Floating Left Legend */}
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-0.5">
            {legendExpanded && (
              <div className="flex flex-col gap-0.5 bg-[#151619]/85 backdrop-blur-[2px] rounded px-1.5 py-1">
                {/* Cumulative PnL */}
                <div className="flex items-center gap-1.5 text-[12px] h-[22px]">
                  <span
                    className={
                      showCumPnL ? "text-[#f0f3fa]" : "text-[#9a9ea8]/60"
                    }
                  >
                    Cumulative PnL
                  </span>
                  <button
                    type="button"
                    title={showCumPnL ? "Hide" : "Show"}
                    onClick={() => setShowCumPnL((v) => !v)}
                    className="text-[#9a9ea8] hover:text-[#f0f3fa] p-0.5 rounded"
                  >
                    <EyeIcon visible={showCumPnL} />
                  </button>
                </div>

                {/* Buy and hold (hidden by default) */}
                <div className="flex items-center gap-1.5 text-[12px] h-[22px]">
                  <span
                    className={
                      showBuyAndHold ? "text-[#f0f3fa]" : "text-[#9a9ea8]/60"
                    }
                  >
                    Buy and hold
                  </span>
                  <button
                    type="button"
                    title={showBuyAndHold ? "Hide" : "Show"}
                    onClick={() => setShowBuyAndHold((v) => !v)}
                    className="text-[#9a9ea8] hover:text-[#f0f3fa] p-0.5 rounded"
                  >
                    <EyeIcon visible={showBuyAndHold} />
                  </button>
                </div>

                {/* Trades excursions */}
                <div className="flex items-center gap-1.5 text-[12px] h-[22px]">
                  <span
                    className={
                      showExcursions ? "text-[#f0f3fa]" : "text-[#9a9ea8]/60"
                    }
                  >
                    Trades excursions
                  </span>
                  <button
                    type="button"
                    title={showExcursions ? "Hide" : "Show"}
                    onClick={() => setShowExcursions((v) => !v)}
                    className="text-[#9a9ea8] hover:text-[#f0f3fa] p-0.5 rounded"
                  >
                    <EyeIcon visible={showExcursions} />
                  </button>
                </div>

                {/* Run-ups and drawdowns */}
                <div className="flex items-center gap-1.5 text-[12px] h-[22px]">
                  <span
                    className={
                      showRunupsDrawdowns
                        ? "text-[#f0f3fa]"
                        : "text-[#9a9ea8]/60"
                    }
                  >
                    Run-ups and drawdowns
                  </span>
                  <button
                    type="button"
                    title={showRunupsDrawdowns ? "Hide" : "Show"}
                    onClick={() => setShowRunupsDrawdowns((v) => !v)}
                    className="text-[#9a9ea8] hover:text-[#f0f3fa] p-0.5 rounded"
                  >
                    <EyeIcon visible={showRunupsDrawdowns} />
                  </button>
                </div>
              </div>
            )}

            {/* Collapse/Expand Chevron Button */}
            <button
              type="button"
              title={
                legendExpanded ? "Hide metrics legend" : "Show metrics legend"
              }
              onClick={() => setLegendExpanded((v) => !v)}
              className="ml-1 mt-0.5 w-[24px] h-[20px] flex items-center justify-center rounded-[4px] border border-[#2a2b30] bg-[#1e1f24] text-[#d1d4dc] hover:bg-[#2a2b30]"
            >
              <svg
                height="15"
                viewBox="0 0 15 15"
                width="15"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${
                  legendExpanded ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M3.5 5.58c.24-.28.65-.3.92-.07L7.5 8.14l3.08-2.63a.65.65 0 1 1 .84.98L7.5 9.86 3.58 6.49a.65.65 0 0 1-.07-.91z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          {/* Hovered Trade Tooltip */}
          {hoveredIndex !== null && equityPoints[hoveredIndex] && (
            <div className="absolute top-2 right-20 z-10 bg-[#1e1f24] border border-[#2a2b30] rounded px-2.5 py-1 text-[11px] font-mono flex items-center gap-3 shadow">
              <span className="text-[#9a9ea8]">
                Trade #{equityPoints[hoveredIndex]?.tradeNumber}
              </span>
              <span
                className={
                  (equityPoints[hoveredIndex]?.profit ?? 0) >= 0
                    ? "text-[#089981]"
                    : "text-[#f23645]"
                }
              >
                {formatSignedUSD(equityPoints[hoveredIndex]?.profit ?? 0)} USD
              </span>
              <span className="text-[#f0f3fa] font-semibold">
                Cum:{" "}
                {formatSignedUSD(equityPoints[hoveredIndex]?.cumProfit ?? 0)}{" "}
                USD
              </span>
            </div>
          )}

          {/* Combined SVG Canvas (NO preserveAspectRatio="none" so circles/text never deform) */}
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.24" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Right Y-Axis Labels */}
            {yTicks.map((tickVal, i) => {
              const y = getY(tickVal);
              return (
                <g key={i}>
                  <line
                    x1={0}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="#2a2b30"
                    strokeDasharray={tickVal === 0 ? undefined : "2 2"}
                    strokeWidth="1"
                  />
                  <text
                    x={chartWidth - paddingRight + 8}
                    y={y + 3.5}
                    fill="#9a9ea8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {scaleMode === "percent"
                      ? `${tickVal.toFixed(2)}%`
                      : tickVal === 0
                      ? "0"
                      : formatNumber(tickVal, 2)}
                  </text>
                </g>
              );
            })}

            {/*Trades Excursions / Run-ups and Drawdowns vertical bars around 0 baseline */}
            {(showExcursions || showRunupsDrawdowns) &&
              equityPoints.map((p, idx) => {
                if (idx === 0) return null;
                const x = getX(idx);
                const barW = Math.max(
                  14,
                  Math.min(36, 160 / Math.max(1, equityPoints.length))
                );
                const tradeVal = getPointValue(p.profit);
                const favVal = Math.max(Math.abs(tradeVal) * 0.85, 0);
                const advVal = -Math.max(
                  p.profit < 0 ? Math.abs(tradeVal) : Math.abs(tradeVal) * 0.25,
                  0
                );
                const topY = getY(favVal);
                const botY = getY(advVal);

                return (
                  <g key={`exc-${p.tradeNumber}`}>
                    {/* Positive excursion bar */}
                    {showExcursions && (
                      <rect
                        x={x - barW / 2}
                        y={Math.min(zeroY, topY)}
                        width={barW}
                        height={Math.max(2, Math.abs(zeroY - topY))}
                        fill="#22ab94"
                        fillOpacity="0.82"
                      />
                    )}
                    {/* Negative drawdown/adverse bar */}
                    {showRunupsDrawdowns && (
                      <rect
                        x={x - barW / 2}
                        y={zeroY}
                        width={barW}
                        height={Math.max(2, Math.abs(botY - zeroY))}
                        fill={p.profit < 0 ? "#f7525f" : "#faa1a4"}
                        fillOpacity="0.78"
                      />
                    )}
                  </g>
                );
              })}

            {/* Bottom horizontal timeline bar under trades */}
            {equityPoints.length > 1 && (
              <line
                x1={getX(1) - 10}
                y1={chartHeight - paddingBottom - 4}
                x2={getX(equityPoints.length - 1) + 10}
                y2={chartHeight - paddingBottom - 4}
                stroke="#22ab94"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}

            {/* Buy and hold curve (when enabled) */}
            {showBuyAndHold && buyAndHoldPathData && (
              <path
                d={buyAndHoldPathData}
                fill="none"
                stroke="#2962ff"
                strokeWidth="1.75"
                strokeDasharray="4 3"
              />
            )}

            {/* Cumulative PnL Area & Line */}
            {showCumPnL && areaData && (
              <path d={areaData} fill={`url(#${gradientId})`} />
            )}
            {showCumPnL && pathData && (
              <path
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Circular Data Points on each trade */}
            {showCumPnL &&
              equityPoints.map((p, idx) => {
                if (idx === 0) return null;
                const cx = getX(idx);
                const cy = getY(getPointValue(p.cumProfit));
                const isHovered = hoveredIndex === idx;

                return (
                  <circle
                    key={p.tradeNumber}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 4.5 : 3.5}
                    fill={strokeColor}
                    stroke="#151619"
                    strokeWidth="1.2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}

            {/* Right Y-Axis Highlight Badge for Final Cumulative Value */}
            {(() => {
              const finalVal = getPointValue(netProfit);
              const badgeY = Math.max(
                14,
                Math.min(chartHeight - paddingBottom - 10, getY(finalVal))
              );
              const badgeText =
                scaleMode === "percent"
                  ? `${finalVal >= 0 ? "+" : ""}${finalVal.toFixed(2)}%`
                  : formatNumber(netProfit, 2);

              return (
                <g>
                  <rect
                    x={chartWidth - paddingRight + 4}
                    y={badgeY - 9}
                    width={paddingRight - 8}
                    height={18}
                    rx={3}
                    fill={netProfit >= 0 ? "#089981" : "#f23645"}
                  />
                  <text
                    x={chartWidth - paddingRight + 8}
                    y={badgeY + 3.5}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {badgeText}
                  </text>
                </g>
              );
            })()}

            {/* Bottom X-Axis Labels */}
            {equityPoints.length > 1 ? (
              <>
                <text
                  x={getX(1)}
                  y={chartHeight - 8}
                  fill="#9a9ea8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {
                    MONTH_NAMES_SHORT[
                      new Date(
                        equityPoints[1]!.exitTime < 1e11
                          ? equityPoints[1]!.exitTime * 1000
                          : equityPoints[1]!.exitTime
                      ).getUTCMonth() || 2
                    ]
                  }
                </text>
                {equityPoints.length > 2 && (
                  <text
                    x={getX(equityPoints.length - 1)}
                    y={chartHeight - 8}
                    fill="#9a9ea8"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {
                      MONTH_NAMES_SHORT[
                        new Date(
                          equityPoints[equityPoints.length - 1]!.exitTime < 1e11
                            ? equityPoints[equityPoints.length - 1]!.exitTime *
                              1000
                            : equityPoints[equityPoints.length - 1]!.exitTime
                        ).getUTCMonth() || 5
                      ]
                    }
                  </text>
                )}
              </>
            ) : (
              <text
                x={paddingLeft + 20}
                y={chartHeight - 8}
                fill="#9a9ea8"
                fontSize="10"
              >
                Mar
              </text>
            )}
          </svg>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: PERFORMANCE ANALYSIS
         ===================================================================== */}
      <section data-qa-id="strategy-performance-analysis">
        <h2 className="text-[16px] font-bold text-[#f0f3fa] mb-3">
          Performance analysis
        </h2>

        {/* Round Pill Tabs Bar */}
        <div
          className="flex items-center gap-2 flex-wrap mb-4"
          role="tablist"
          aria-label="Performance analysis tabs"
        >
          {PERFORMANCE_TABS.map((tab) => {
            const isActive = perfSubtab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setPerfSubtab(tab)}
                className={
                  isActive
                    ? "bg-[#f0f3fa] text-[#151619] font-semibold rounded-full px-3.5 py-1 text-[12px] transition-colors"
                    : "bg-[#1e1f24] text-[#d1d4dc] hover:bg-[#2a2b30] rounded-full px-3.5 py-1 text-[12px] transition-colors"
                }
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* 3.1 SUBTAB: BREAKDOWN */}
        {perfSubtab === "Breakdown" && (
          <div className="space-y-5">
            {/* 4 KPI Cells */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Gross profit
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {formatNumber(grossProfit, 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {grossProfitPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Gross loss
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {formatNumber(grossLoss, 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {grossLossPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Profit factor
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {grossLoss === 0
                    ? grossProfit > 0
                      ? "∞"
                      : "0.000"
                    : profitFactor.toFixed(3)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Commission load
                </span>
                <div className="flex items-center h-[24px]">
                  <LockIcon />
                </div>
              </div>
            </div>

            {/* Profits and losses infographic */}
            <div data-qa-id="performance-details-infographic">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa]">
                  Profits and losses
                </h3>

                {/* Segmented Control: By signals | By side */}
                <div
                  className="inline-grid grid-cols-2 bg-[#1e1f24] p-0.5 rounded-[6px] border border-[#2a2b30]"
                  role="radiogroup"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={pnlMode === "signals"}
                    onClick={() => setPnlMode("signals")}
                    className={`px-3 py-1 text-[12px] rounded-[4px] transition-colors ${
                      pnlMode === "signals"
                        ? "bg-[#2a2b30] text-[#f0f3fa] font-medium shadow-sm"
                        : "text-[#9a9ea8] hover:text-[#d1d4dc]"
                    }`}
                  >
                    By signals
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={pnlMode === "side"}
                    onClick={() => setPnlMode("side")}
                    className={`px-3 py-1 text-[12px] rounded-[4px] transition-colors ${
                      pnlMode === "side"
                        ? "bg-[#2a2b30] text-[#f0f3fa] font-medium shadow-sm"
                        : "text-[#9a9ea8] hover:text-[#d1d4dc]"
                    }`}
                  >
                    By side
                  </button>
                </div>
              </div>

              {/* Proportional Bar Rows */}
              <div className="flex flex-col divide-y divide-[#2a2b30]/50">
                {activeBreakdownRows.map((row, idx) => {
                  const lossWidthPct =
                    grossLoss > 0
                      ? Math.min(100, (row.grossLoss / grossLoss) * 100)
                      : 0;
                  const netLossWidthPct =
                    row.netProfit < 0 && grossLoss > 0
                      ? Math.min(
                          100,
                          (Math.abs(row.netProfit) / grossLoss) * 100
                        )
                      : 0;
                  const profitWidthPct =
                    grossProfit > 0
                      ? Math.min(100, (row.grossProfit / grossProfit) * 100)
                      : 0;
                  const netProfitWidthPct =
                    row.netProfit > 0 && grossProfit > 0
                      ? Math.min(100, (row.netProfit / grossProfit) * 100)
                      : 0;

                  return (
                    <div
                      key={row.label}
                      className={`grid grid-cols-[150px_1fr_120px] items-center gap-4 py-2.5 px-2 rounded hover:bg-white/[0.03] transition-colors ${
                        idx === 0 ? "font-medium" : ""
                      }`}
                    >
                      <span className="text-[13px] text-[#f0f3fa] truncate">
                        {row.label}
                      </span>

                      {/* Dual-side proportional bar */}
                      <div className="flex items-center gap-[2px] h-[8px] w-full">
                        {/* Left (Loss) segment */}
                        <div
                          className="relative flex justify-end h-full overflow-hidden"
                          style={{ flexGrow: leftFlexGrow, flexBasis: 0 }}
                        >
                          <div
                            className="h-full rounded-l-[4px] bg-[#faa1a4]"
                            style={{ width: `${lossWidthPct.toFixed(2)}%` }}
                          />
                          {netLossWidthPct > 0 && (
                            <div
                              className="absolute right-0 top-0 h-full rounded-l-[4px] bg-[#f23645]"
                              style={{
                                width: `${netLossWidthPct.toFixed(2)}%`,
                              }}
                            />
                          )}
                        </div>

                        {/* Right (Profit) segment */}
                        <div
                          className="relative flex justify-start h-full overflow-hidden"
                          style={{ flexGrow: rightFlexGrow, flexBasis: 0 }}
                        >
                          <div
                            className="h-full rounded-r-[4px] bg-[#70ccbd]"
                            style={{ width: `${profitWidthPct.toFixed(2)}%` }}
                          />
                          {netProfitWidthPct > 0 && (
                            <div
                              className="absolute left-0 top-0 h-full rounded-r-[4px] bg-[#089981]"
                              style={{
                                width: `${netProfitWidthPct.toFixed(2)}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Right value */}
                      <div
                        className={`text-right text-[13px] font-medium tabular-nums ${
                          row.netProfit > 0
                            ? "text-[#089981]"
                            : row.netProfit < 0
                            ? "text-[#f23645]"
                            : "text-[#9a9ea8]"
                        }`}
                      >
                        {formatSignedUSD(row.netProfit)}
                        <span className="text-[10px] font-normal ml-0.5 uppercase">
                          USD
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3.2 SUBTAB: PERIODICAL */}
        {perfSubtab === "Periodical" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Annualized return (CAGR)
                </span>
                <span
                  className={`text-[16px] font-semibold tabular-nums ${
                    cagrPercent >= 0 ? "text-[#089981]" : "text-[#f23645]"
                  }`}
                >
                  {cagrPercent >= 0 ? "+" : ""}
                  {cagrPercent.toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Total return
                </span>
                <span
                  className={`text-[16px] font-semibold tabular-nums ${
                    netProfitPercent >= 0 ? "text-[#089981]" : "text-[#f23645]"
                  }`}
                >
                  {netProfitPercent >= 0 ? "+" : ""}
                  {netProfitPercent.toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Sharpe ratio
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {sharpeRatio.toFixed(3)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Sortino ratio
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {sortinoRatio.toFixed(3)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa]">
                  {periodicalMode} PnL
                </h3>
                <div className="inline-grid grid-cols-3 bg-[#1e1f24] p-0.5 rounded-[6px] border border-[#2a2b30]">
                  {(["Weekly", "Quarterly", "Yearly"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPeriodicalMode(mode)}
                      className={`px-3 py-1 text-[12px] rounded-[4px] transition-colors ${
                        periodicalMode === mode
                          ? "bg-[#2a2b30] text-[#f0f3fa] font-medium"
                          : "text-[#9a9ea8] hover:text-[#d1d4dc]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Periodical PnL Grouped Bar Chart with Central Zero Line */}
              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3">
                <div className="flex items-stretch h-[160px]">
                  {/* Bars container */}
                  <div className="flex-1 flex flex-col justify-between relative">
                    {/* Upper half: Realized profit & Favorable excursion (extending upwards) */}
                    <div className="h-[64px] flex items-end justify-around px-2">
                      {periodicalGroups.map((g) => {
                        const pH =
                          maxPeriodicalVal > 0
                            ? (g.realizedProfit / maxPeriodicalVal) * 58
                            : 0;
                        const feH =
                          maxPeriodicalVal > 0
                            ? (g.favorableExcursion / maxPeriodicalVal) * 58
                            : 0;
                        return (
                          <div
                            key={g.label}
                            className="flex items-end justify-center gap-1 w-full"
                          >
                            {pH > 0 && (
                              <div
                                className="w-2.5 bg-[#089981] rounded-t-[2px]"
                                style={{ height: `${Math.max(3, pH)}px` }}
                                title={`${g.label} Profit: ${formatNumber(g.realizedProfit, 2)} USD`}
                              />
                            )}
                            {feH > 0 && (
                              <div
                                className="w-2.5 bg-[#70ccbd] rounded-t-[2px]"
                                style={{ height: `${Math.max(3, feH)}px` }}
                                title={`${g.label} Favorable: ${formatNumber(g.favorableExcursion, 2)} USD`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Central Zero Line */}
                    <div className="w-full border-b border-[#2a2b30] pointer-events-none" />

                    {/* Lower half: Realized loss & Adverse excursion (extending downwards) */}
                    <div className="h-[64px] flex items-start justify-around px-2">
                      {periodicalGroups.map((g) => {
                        const lH =
                          maxPeriodicalVal > 0
                            ? (g.realizedLoss / maxPeriodicalVal) * 58
                            : 0;
                        const aeH =
                          maxPeriodicalVal > 0
                            ? (g.adverseExcursion / maxPeriodicalVal) * 58
                            : 0;
                        return (
                          <div
                            key={g.label}
                            className="flex items-start justify-center gap-1 w-full"
                          >
                            {lH > 0 && (
                              <div
                                className="w-2.5 bg-[#f23645] rounded-b-[2px]"
                                style={{ height: `${Math.max(3, lH)}px` }}
                                title={`${g.label} Loss: ${formatNumber(g.realizedLoss, 2)} USD`}
                              />
                            )}
                            {aeH > 0 && (
                              <div
                                className="w-2.5 bg-[#faa1a4] rounded-b-[2px]"
                                style={{ height: `${Math.max(3, aeH)}px` }}
                                title={`${g.label} Adverse: ${formatNumber(g.adverseExcursion, 2)} USD`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Labels row */}
                    <div className="h-[22px] flex items-center justify-around px-2 border-t border-[#2a2b30]/40">
                      {periodicalGroups.map((g) => (
                        <span
                          key={g.label}
                          className="text-[11px] text-[#9a9ea8] text-center w-full"
                        >
                          {g.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Y-axis labels */}
                  <div className="w-[58px] flex flex-col justify-between items-end pl-2 text-[10px] text-[#9a9ea8] font-mono border-l border-[#2a2b30]/50 py-1">
                    <span className="leading-none text-[#089981]">
                      +{formatNumber(maxPeriodicalVal, 0)}
                    </span>
                    <span className="leading-none text-[#9a9ea8]">0</span>
                    <span className="leading-none text-[#f23645]">
                      -{formatNumber(maxPeriodicalVal, 0)}
                    </span>
                  </div>
                </div>

                {/* 4-Item Legend */}
                <div className="flex items-center justify-center gap-4 flex-wrap mt-3 text-[11px] text-[#d1d4dc]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#089981]" />
                    Realized profit
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f23645]" />
                    Realized loss
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#70ccbd]" />
                    Favorable excursion
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#faa1a4]" />
                    Adverse excursion
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3.3 SUBTAB: BENCHMARKING */}
        {perfSubtab === "Benchmarking" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Strategy return
                </span>
                <span
                  className={`text-[16px] font-semibold tabular-nums ${
                    netProfitPercent >= 0 ? "text-[#089981]" : "text-[#f23645]"
                  }`}
                >
                  {netProfitPercent >= 0 ? "+" : ""}
                  {netProfitPercent.toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Buy and hold return
                </span>
                <span className="text-[16px] font-semibold text-[#089981] tabular-nums">
                  +{(netProfitPercent * 1.12).toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Strategy outperformance
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {(netProfitPercent - netProfitPercent * 1.12).toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Correlation
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  0.84
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#2a2b30]/60 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa]">
                  Strategy vs benchmark
                </h3>
                <div className="inline-grid grid-cols-3 bg-[#1e1f24] p-0.5 rounded-[6px] border border-[#2a2b30]">
                  {(["Weekly", "Quarterly", "Yearly"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBenchmarkMode(mode)}
                      className={`px-3 py-1 text-[12px] rounded-[4px] transition-colors ${
                        benchmarkMode === mode
                          ? "bg-[#2a2b30] text-[#f0f3fa] font-medium"
                          : "text-[#9a9ea8] hover:text-[#d1d4dc]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Benchmark Line Chart comparing Strategy vs Buy and hold */}
              <div className="relative w-full h-[150px] my-2">
                {(() => {
                  const bWidth = Math.max(200, chartWidth - 80);
                  const bTop = 16;
                  const bH = 100;
                  const bPoints =
                    equityPoints.length > 0
                      ? equityPoints
                      : [{ cumProfit: 0, equity: initialBalance, tradeNumber: 0, profit: 0 }];
                  const bMin = Math.min(
                    0,
                    ...bPoints.map((p) => p.cumProfit * 1.12),
                    ...bPoints.map((p) => p.cumProfit)
                  );
                  const bMax = Math.max(
                    1,
                    ...bPoints.map((p) => p.cumProfit * 1.12),
                    ...bPoints.map((p) => p.cumProfit)
                  );
                  const bRange = bMax - bMin || 1;
                  const getBY = (v: number) =>
                    bTop + bH - ((v - bMin) / bRange) * bH;
                  const getBX = (idx: number) =>
                    bPoints.length <= 1
                      ? 20
                      : 20 +
                        (idx / (bPoints.length - 1)) * (bWidth - 20);

                  const stratPath = bPoints
                    .map(
                      (p, idx) =>
                        `${idx === 0 ? "M" : "L"} ${getBX(idx)} ${getBY(
                          p.cumProfit
                        )}`
                    )
                    .join(" ");
                  const bhPath = bPoints
                    .map(
                      (p, idx) =>
                        `${idx === 0 ? "M" : "L"} ${getBX(idx)} ${getBY(
                          p.cumProfit * 1.12
                        )}`
                    )
                    .join(" ");

                  return (
                    <svg
                      viewBox={`0 0 ${chartWidth} 150`}
                      className="w-full h-full overflow-visible"
                    >
                      {/* Horizontal Grid */}
                      {[bTop, bTop + bH / 2, bTop + bH].map((y, i) => (
                        <line
                          key={i}
                          x1={20}
                          y1={y}
                          x2={bWidth}
                          y2={y}
                          stroke="#2a2b30"
                          strokeDasharray="2 2"
                          strokeWidth="1"
                        />
                      ))}
                      {/* Strategy Line */}
                      <path
                        d={stratPath}
                        fill="none"
                        stroke="#089981"
                        strokeWidth="2"
                      />
                      {/* Buy and Hold Line */}
                      <path
                        d={bhPath}
                        fill="none"
                        stroke="#2962ff"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      {/* Right Y-axis labels */}
                      <text
                        x={bWidth + 8}
                        y={bTop + 4}
                        fill="#089981"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        +{netProfitPercent >= 0 ? netProfitPercent.toFixed(1) : "0.0"}%
                      </text>
                      <text
                        x={bWidth + 8}
                        y={bTop + bH / 2 + 3}
                        fill="#9a9ea8"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        0.0%
                      </text>
                      <text
                        x={bWidth + 8}
                        y={bTop + bH + 4}
                        fill="#f23645"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        -{netProfitPercent < 0 ? Math.abs(netProfitPercent).toFixed(1) : "0.0"}%
                      </text>
                    </svg>
                  );
                })()}
              </div>

              <div className="flex items-center justify-center gap-6 py-2 text-[12px] text-[#d1d4dc]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#089981]" />
                  Strategy PnL ({netProfitPercent >= 0 ? "+" : ""}
                  {netProfitPercent.toFixed(2)}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2962ff]" />
                  Buy and hold PnL (+{(netProfitPercent * 1.12).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3.4 SUBTAB: MARGIN USAGE */}
        {perfSubtab === "Margin usage" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Margin efficiency
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  0{" "}
                  <span className="text-[11px] font-normal text-[#9a9ea8]">
                    USD
                  </span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average margin used
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  0{" "}
                  <span className="text-[11px] font-normal text-[#9a9ea8]">
                    USD
                  </span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Margin calls
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  0
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Total liquidated volume
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  0{" "}
                  <span className="text-[11px] font-normal text-[#9a9ea8]">
                    USD
                  </span>
                </span>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#2a2b30]/60 p-4 text-center text-[#9a9ea8] text-[12px]">
              <div className="font-semibold text-[#f0f3fa] text-left mb-2">
                Margin utilization
              </div>
              Not enough data to show
            </div>
          </div>
        )}

        {/* 3.5 SUBTAB: GROWTH AND DECLINE */}
        {perfSubtab === "Growth and decline" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average run-up duration
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {avgTradeDuration}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average drawdown duration
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {losingTradesCount > 0 ? avgTradeDuration : "—"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Max drawdown
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {formatNumber(maxDD, 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {maxDDPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Max drawdown as % of initial capital
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {maxDrawdownInitialPercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card 1: Alternating growth and decline */}
              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3 flex flex-col justify-between">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa] mb-3">
                  Alternating growth and decline
                </h3>

                <div className="flex items-stretch h-[140px] my-1">
                  <div className="flex-1 flex flex-col justify-between relative">
                    {/* Upper half: Run-up bars (extending UP) */}
                    <div className="h-[56px] flex items-end justify-around px-2">
                      {alternatingSequences.map((s) => {
                        const h =
                          maxGrowthDeclineVal > 0
                            ? (s.runup / maxGrowthDeclineVal) * 50
                            : 0;
                        return (
                          <div
                            key={s.id}
                            className="flex items-end justify-center w-full"
                          >
                            {h > 0 ? (
                              <div
                                className="w-2.5 bg-[#22ab94] rounded-t-[2px]"
                                style={{ height: `${Math.max(3, h)}px` }}
                                title={`Trade #${s.id} Run-up: ${formatNumber(
                                  s.runup,
                                  2
                                )} USD`}
                              />
                            ) : (
                              <div className="w-2.5 h-[1px] bg-transparent" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Central Zero Line */}
                    <div className="w-full border-b border-[#2a2b30] pointer-events-none" />

                    {/* Lower half: Drawdown bars (extending DOWN) */}
                    <div className="h-[56px] flex items-start justify-around px-2">
                      {alternatingSequences.map((s) => {
                        const h =
                          maxGrowthDeclineVal > 0
                            ? (s.drawdown / maxGrowthDeclineVal) * 50
                            : 0;
                        return (
                          <div
                            key={s.id}
                            className="flex items-start justify-center w-full"
                          >
                            {h > 0 ? (
                              <div
                                className="w-2.5 bg-[#f7525f] rounded-b-[2px]"
                                style={{ height: `${Math.max(3, h)}px` }}
                                title={`Trade #${s.id} Drawdown: ${formatNumber(
                                  s.drawdown,
                                  2
                                )} USD`}
                              />
                            ) : (
                              <div className="w-2.5 h-[1px] bg-transparent" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Trade numbers row */}
                    <div className="h-[20px] flex items-center justify-around px-2 text-[10px] text-[#9a9ea8]">
                      {alternatingSequences.map((s) => (
                        <span key={s.id} className="text-center w-full">
                          {s.id}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Y-axis */}
                  <div className="w-[52px] flex flex-col justify-between items-end pl-2 text-[10px] text-[#9a9ea8] font-mono border-l border-[#2a2b30]/50 py-1">
                    <span className="leading-none text-[#22ab94]">
                      +{formatNumber(maxGrowthDeclineVal, 0)}
                    </span>
                    <span className="leading-none text-[#9a9ea8]">0</span>
                    <span className="leading-none text-[#f7525f]">
                      -{formatNumber(maxGrowthDeclineVal, 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-5 mt-2 text-[11px] text-[#d1d4dc]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22ab94]" />
                    Run-up
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f7525f]" />
                    Drawdown
                  </span>
                </div>
              </div>

              {/* Card 2: Comparison of growth and decline periods */}
              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3 flex flex-col justify-between">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa] mb-3">
                  Comparison of growth and decline periods
                </h3>
                <div className="flex flex-col gap-5 my-1">
                  {/* Run-up block */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[13px] font-semibold text-[#f0f3fa]">
                      Run-up
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[12px] text-[#9a9ea8]">
                        Maximum
                      </span>
                      <div className="flex-1 h-[18px] bg-[#1e1f24] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#22ab94] rounded-r-[2px]"
                          style={{
                            width: `${maxRunupPercent > 0 ? 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-[12px] tabular-nums text-[#f0f3fa]">
                        {maxRunupPercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[12px] text-[#9a9ea8]">
                        Average
                      </span>
                      <div className="flex-1 h-[18px] bg-[#1e1f24] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#22ab94] rounded-r-[2px]"
                          style={{
                            width: `${
                              maxRunupPercent > 0
                                ? Math.min(
                                    100,
                                    (avgRunupPercent / maxRunupPercent) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-[12px] tabular-nums text-[#f0f3fa]">
                        {avgRunupPercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[12px] text-[#9a9ea8]">
                        Current
                      </span>
                      <div className="flex-1 h-[18px] bg-[#1e1f24] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#70ccbd] rounded-r-[2px]"
                          style={{
                            width: `${
                              maxRunupPercent > 0
                                ? Math.min(
                                    100,
                                    (currentRunupPercent / maxRunupPercent) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-[12px] tabular-nums text-[#f0f3fa]">
                        {currentRunupPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Drawdown block */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[13px] font-semibold text-[#f0f3fa]">
                      Drawdown
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[12px] text-[#9a9ea8]">
                        Maximum
                      </span>
                      <div className="flex-1 h-[18px] bg-[#1e1f24] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#f7525f] rounded-r-[2px]"
                          style={{ width: `${maxDDPercent > 0 ? 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-[12px] tabular-nums text-[#f0f3fa]">
                        {maxDDPercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[12px] text-[#9a9ea8]">
                        Average
                      </span>
                      <div className="flex-1 h-[18px] bg-[#1e1f24] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#f7525f] rounded-r-[2px]"
                          style={{
                            width: `${
                              maxDDPercent > 0
                                ? Math.min(
                                    100,
                                    (avgDrawdownPercent / maxDDPercent) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-[12px] tabular-nums text-[#f0f3fa]">
                        {avgDrawdownPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          SECTION 4: TRADES ANALYSIS
         ===================================================================== */}
      <section data-qa-id="strategy-trades-analysis">
        <h2 className="text-[16px] font-bold text-[#f0f3fa] mb-3">
          Trades analysis
        </h2>

        {/* Round Pill Tabs Bar */}
        <div
          className="flex items-center gap-2 flex-wrap mb-4"
          role="tablist"
          aria-label="Trades analysis tabs"
        >
          {TRADES_TABS.map((tab) => {
            const isActive = tradesSubtab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTradesSubtab(tab)}
                className={
                  isActive
                    ? "bg-[#f0f3fa] text-[#151619] font-semibold rounded-full px-3.5 py-1 text-[12px] transition-colors"
                    : "bg-[#1e1f24] text-[#d1d4dc] hover:bg-[#2a2b30] rounded-full px-3.5 py-1 text-[12px] transition-colors"
                }
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* 4.1 SUBTAB: TIME PATTERNS */}
        {tradesSubtab === "Time patterns" && (
          <div className="space-y-5">
            {/* 4 KPI Cells */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Best hour for entries
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {bestHourForEntries}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Best day for entries
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa]">
                  {bestDayForEntries}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Best month for entries
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa]">
                  {bestMonthForEntries}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average trade duration
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {avgTradeDuration}
                </span>
              </div>
            </div>

            {/* Results by time (12 months Jan..Dec) */}
            <div>
              <h3 className="text-[14px] font-semibold text-[#f0f3fa] mb-3">
                Results by time
              </h3>
              <div className="w-full">
                <div className="relative flex items-stretch h-[200px]">
                  {/* Main 12-month columns area */}
                  <div className="flex-1 relative flex flex-col justify-between">
                    {/* Horizontal grid lines */}
                    <div className="absolute inset-0 bottom-[26px] flex flex-col justify-between pointer-events-none">
                      {monthYTicks.map((tVal) => (
                        <div
                          key={tVal}
                          className="w-full border-b border-[#2a2b30]/70"
                        />
                      ))}
                    </div>

                    {/* Bars container */}
                    <div className="relative z-10 flex-1 grid grid-cols-12 gap-2 items-end px-2 pb-[26px]">
                      {monthlyResults.map((item) => {
                        const winH =
                          maxMonthCount > 0
                            ? (item.winners / maxMonthCount) * 100
                            : 0;
                        const lossH =
                          maxMonthCount > 0
                            ? (item.losers / maxMonthCount) * 100
                            : 0;
                        return (
                          <div
                            key={item.month}
                            className="flex flex-col items-center justify-end h-full"
                          >
                            <div className="flex items-end justify-center gap-1 w-full h-full">
                              {item.winners > 0 && (
                                <div
                                  className="w-full max-w-[38px] bg-[#22ab94] rounded-t-[2px] transition-all"
                                  style={{ height: `${winH}%` }}
                                  title={`${item.month}: ${item.winners} Winners`}
                                />
                              )}
                              {item.losers > 0 && (
                                <div
                                  className="w-full max-w-[38px] bg-[#f7525f] rounded-t-[2px] transition-all"
                                  style={{ height: `${lossH}%` }}
                                  title={`${item.month}: ${item.losers} Losers`}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Month names row (Jan..Dec) */}
                    <div className="h-[26px] grid grid-cols-12 gap-2 items-center px-2 text-center">
                      {monthlyResults.map((item) => (
                        <span
                          key={item.month}
                          className="text-[11px] text-[#9a9ea8]"
                        >
                          {item.month}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Y-axis counts */}
                  <div className="w-[28px] pb-[26px] flex flex-col justify-between items-end pl-2 text-[10px] text-[#9a9ea8] font-mono">
                    {monthYTicks.map((tVal) => (
                      <span key={tVal} className="leading-none">
                        {tVal}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Legend: Winners / Losers */}
                <div className="flex items-center justify-center gap-5 mt-3 text-[12px] text-[#d1d4dc]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22ab94]" />
                    Winners
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f7525f]" />
                    Losers
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4.2 SUBTAB: DISTRIBUTION */}
        {tradesSubtab === "Distribution" && (
          <div className="space-y-5">
            {/* 4 KPI Cells */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Expectancy
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {formatNumber(avgTrade, 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    {avgTradePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Outliers PnL
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    0.00
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                    0.00%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Largest profit
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#089981] tabular-nums">
                    {formatNumber(largestWin, 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#089981] tabular-nums">
                    {largestWinPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Largest loss
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[16px] font-semibold text-[#f23645] tabular-nums">
                    {formatNumber(Math.abs(largestLoss), 2)}
                    <span className="text-[11px] font-normal text-[#9a9ea8] ml-0.5 uppercase">
                      USD
                    </span>
                  </span>
                  <span className="text-[16px] font-semibold text-[#f23645] tabular-nums">
                    {largestLossPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Returns distribution Histogram */}
              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3 flex flex-col justify-between">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa] mb-3">
                  Returns distribution
                </h3>

                <div className="relative flex items-stretch h-[140px] my-1">
                  {/* Histogram Bars Container */}
                  <div className="flex-1 flex flex-col justify-between relative">
                    {/* Vertical dashed lines for Average loss & Average profit */}
                    <div className="absolute inset-0 pointer-events-none z-10 flex">
                      {/* Left side (negative / average loss line) */}
                      <div className="w-[43%] h-full relative">
                        <div
                          className="absolute top-0 bottom-0 border-l border-dashed border-[#f7525f]/70"
                          style={{
                            left: `${Math.max(
                              10,
                              Math.min(90, (1 - avgLossPercent / 3) * 100)
                            )}%`,
                          }}
                          title={`Avg loss: −${avgLossPercent.toFixed(2)}%`}
                        />
                      </div>
                      {/* Center gap for 0% */}
                      <div className="w-[14%] h-full" />
                      {/* Right side (positive / average profit line) */}
                      <div className="w-[43%] h-full relative">
                        <div
                          className="absolute top-0 bottom-0 border-l border-dashed border-[#22ab94]/70"
                          style={{
                            left: `${Math.max(
                              10,
                              Math.min(90, (avgWinPercent / 3) * 100)
                            )}%`,
                          }}
                          title={`Avg profit: +${avgWinPercent.toFixed(2)}%`}
                        />
                      </div>
                    </div>

                    {/* Bars */}
                    <div className="flex-1 flex items-end justify-around px-2 border-b border-[#2a2b30]">
                      {returnBins.map((b) => {
                        const h =
                          maxReturnBinCount > 0
                            ? (b.count / maxReturnBinCount) * 85
                            : 0;
                        return (
                          <div
                            key={b.label}
                            className="flex flex-col items-center justify-end h-full w-full"
                          >
                            {h > 0 ? (
                              <div
                                className={`w-3.5 rounded-t-[2px] transition-all ${
                                  b.isNegative ? "bg-[#f7525f]" : "bg-[#22ab94]"
                                }`}
                                style={{ height: `${Math.max(4, h)}px` }}
                                title={`${b.label}: ${b.count} trades`}
                              />
                            ) : (
                              <div className="w-3.5 h-[1px] bg-transparent" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bin Labels Row */}
                    <div className="h-[20px] flex items-center justify-around px-2 text-[10px] text-[#9a9ea8]">
                      {returnBins.map((b) => (
                        <span key={b.label} className="text-center w-full">
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Y-axis counts */}
                  <div className="w-[32px] flex flex-col justify-between items-end pl-2 text-[10px] text-[#9a9ea8] font-mono border-l border-[#2a2b30]/50 py-1">
                    <span className="leading-none">{maxReturnBinCount}</span>
                    <span className="leading-none">
                      {Math.round(maxReturnBinCount / 2)}
                    </span>
                    <span className="leading-none">0</span>
                  </div>
                </div>

                {/* 4-Item Legend */}
                <div className="flex items-center justify-center gap-3.5 flex-wrap mt-2 text-[11px] text-[#d1d4dc]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f7525f]" />
                    Losers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22ab94]" />
                    Winners
                  </span>
                  <span className="flex items-center gap-1.5 text-[#f7525f]">
                    <span className="w-2.5 border-b border-dashed border-[#f7525f]" />
                    Average loss −{avgLossPercent.toFixed(2)}%
                  </span>
                  <span className="flex items-center gap-1.5 text-[#22ab94]">
                    <span className="w-2.5 border-b border-dashed border-[#22ab94]" />
                    Average profit +{avgWinPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Trades distribution Donut */}
              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3 flex flex-col justify-between">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa] mb-2">
                  Trades distribution
                </h3>
                <div className="flex items-center gap-5 my-auto">
                  <div className="relative w-[88px] h-[88px] flex items-center justify-center shrink-0">
                    {(() => {
                      const c = 87.9646; // 2 * PI * 14
                      const wArc = totalTrades > 0 ? (winPct / 100) * c : 0;
                      const lArc = totalTrades > 0 ? (lossPct / 100) * c : 0;
                      const eArc = totalTrades > 0 ? (evenPct / 100) * c : 0;
                      return (
                        <svg
                          viewBox="0 0 36 36"
                          className="w-full h-full -rotate-90"
                        >
                          {/* Base track */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#2a2b30"
                            strokeWidth="4.5"
                          />
                          {/* Winners arc */}
                          {wArc > 0 && (
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="#089981"
                              strokeWidth="4.5"
                              strokeDasharray={`${wArc.toFixed(2)} 88`}
                              strokeDashoffset="0"
                            />
                          )}
                          {/* Losers arc */}
                          {lArc > 0 && (
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="#f23645"
                              strokeWidth="4.5"
                              strokeDasharray={`${lArc.toFixed(2)} 88`}
                              strokeDashoffset={`-${wArc.toFixed(2)}`}
                            />
                          )}
                          {/* Breakevens arc */}
                          {eArc > 0 && (
                            <circle
                              cx="18"
                              cy="18"
                              r="14"
                              fill="none"
                              stroke="#ff9800"
                              strokeWidth="4.5"
                              strokeDasharray={`${eArc.toFixed(2)} 88`}
                              strokeDashoffset={`-${(wArc + lArc).toFixed(2)}`}
                            />
                          )}
                        </svg>
                      );
                    })()}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[14px] font-bold text-[#f0f3fa] leading-tight">
                        {totalTrades}
                      </span>
                      <span className="text-[9px] text-[#9a9ea8]">
                        Total trades
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2.5 gap-y-1.5 text-[12px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#089981]" />
                    <span className="text-[#f0f3fa]">Winners</span>
                    <span className="text-[#9a9ea8] tabular-nums">
                      {winningTradesCount} trades
                    </span>
                    <span className="text-[#f0f3fa] tabular-nums">
                      {winPct.toFixed(2)}%
                    </span>

                    <span className="w-2.5 h-2.5 rounded-full bg-[#f23645]" />
                    <span className="text-[#f0f3fa]">Losers</span>
                    <span className="text-[#9a9ea8] tabular-nums">
                      {losingTradesCount} trades
                    </span>
                    <span className="text-[#f0f3fa] tabular-nums">
                      {lossPct.toFixed(2)}%
                    </span>

                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff9800]" />
                    <span className="text-[#f0f3fa]">Breakevens</span>
                    <span className="text-[#9a9ea8] tabular-nums">
                      {evenTradesCount} trades
                    </span>
                    <span className="text-[#f0f3fa] tabular-nums">
                      {evenPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4.3 SUBTAB: STREAKS */}
        {tradesSubtab === "Streaks" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Longest winning streak
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {longestWinStreak}{" "}
                  {longestWinStreak === 1 ? "trade" : "trades"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Longest losing streak
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {longestLossStreak}{" "}
                  {longestLossStreak === 1 ? "trade" : "trades"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average winning streak
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {avgWinStreak.toFixed(1)} trades
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] text-[#9a9ea8] mb-1">
                  Average losing streak
                </span>
                <span className="text-[16px] font-semibold text-[#f0f3fa] tabular-nums">
                  {avgLossStreak.toFixed(1)} trades
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[#f0f3fa]">
                  Winning and losing streaks
                </h3>
                <div className="inline-grid grid-cols-2 bg-[#1e1f24] p-0.5 rounded-[6px] border border-[#2a2b30]">
                  {(["Count", "Amount"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setStreaksMode(m)}
                      className={`px-3 py-1 text-[12px] rounded-[4px] transition-colors ${
                        streaksMode === m
                          ? "bg-[#2a2b30] text-[#f0f3fa] font-medium"
                          : "text-[#9a9ea8] hover:text-[#d1d4dc]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2a2b30]/60 p-3">
                <div className="flex items-stretch h-[150px] my-1">
                  {/* Bars Area */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex-1 flex items-end justify-around px-8 pb-1 border-b border-[#2a2b30]">
                      {streakChartData.map((d) => {
                        const winH =
                          maxStreakVal > 0
                            ? (d.win / maxStreakVal) * 95
                            : 0;
                        const lossH =
                          maxStreakVal > 0
                            ? (d.loss / maxStreakVal) * 95
                            : 0;
                        return (
                          <div
                            key={d.label}
                            className="flex flex-col items-center justify-end h-full gap-1.5"
                          >
                            <div className="flex items-end gap-2 h-full">
                              {/* Winner Bar */}
                              <div className="flex flex-col items-center justify-end h-full">
                                <span className="text-[10px] text-[#089981] font-mono mb-1">
                                  {streaksMode === "Count"
                                    ? d.win
                                    : formatNumber(d.win, 0)}
                                </span>
                                <div
                                  className="w-5 bg-[#089981] rounded-t-[3px] transition-all"
                                  style={{ height: `${Math.max(4, winH)}px` }}
                                  title={`${d.label} Win: ${d.win} ${
                                    streaksMode === "Count" ? "trades" : "USD"
                                  }`}
                                />
                              </div>

                              {/* Loser Bar */}
                              <div className="flex flex-col items-center justify-end h-full">
                                <span className="text-[10px] text-[#f23645] font-mono mb-1">
                                  {streaksMode === "Count"
                                    ? d.loss
                                    : formatNumber(d.loss, 0)}
                                </span>
                                <div
                                  className="w-5 bg-[#f23645] rounded-t-[3px] transition-all"
                                  style={{ height: `${Math.max(4, lossH)}px` }}
                                  title={`${d.label} Loss: ${d.loss} ${
                                    streaksMode === "Count" ? "trades" : "USD"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Labels Row */}
                    <div className="h-[22px] flex items-center justify-around px-8 text-[11px] text-[#9a9ea8]">
                      {streakChartData.map((d) => (
                        <span key={d.label} className="text-center font-medium">
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Y-axis */}
                  <div className="w-[52px] flex flex-col justify-between items-end pl-2 text-[10px] text-[#9a9ea8] font-mono border-l border-[#2a2b30]/50 py-1">
                    <span className="leading-none">
                      {streaksMode === "Count"
                        ? maxStreakVal
                        : formatNumber(maxStreakVal, 0)}
                    </span>
                    <span className="leading-none">
                      {streaksMode === "Count"
                        ? Math.round(maxStreakVal / 2)
                        : formatNumber(maxStreakVal / 2, 0)}
                    </span>
                    <span className="leading-none">0</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 pt-3 border-t border-[#2a2b30]/40 text-[12px] text-[#d1d4dc]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#089981]" />
                    Winners (
                    {streaksMode === "Count"
                      ? `${longestWinStreak} max`
                      : `${formatNumber(grossProfit, 2)} USD`}
                    )
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f23645]" />
                    Losers (
                    {streaksMode === "Count"
                      ? `${longestLossStreak} max`
                      : `${formatNumber(grossLoss, 2)} USD`}
                    )
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
