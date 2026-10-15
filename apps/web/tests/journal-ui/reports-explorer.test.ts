import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import { dayKeyOf, matchesFilters, type AnnotatedTrade, type GroupSummary } from "@luxalgo/journal-core";

import {
  compactMoney,
  fmtAdaptivePercent,
  fmtChartDate,
  fmtFullDate,
} from "../../src/lib/utils";
import { performanceTrends } from "../../src/lib/performance-trends";
import {
  calculateOutperformingGroup,
  calculateComparisonDeltas,
  formatCohortMetricLines,
} from "../../src/lib/report-comparison";
import type { Analysis } from "../../src/components/reports/types";
import { buildReviewPdf } from "../../src/lib/export-review";
import {
  tradeLinkLabel,
  tradeMarkdownLink,
  tradePath,
  tradeKeyFromSegment,
} from "../../src/lib/trade-links";
import { clockLabel, plotTradePoints, tradeExplorerPoints } from "../../src/lib/trade-explorer";
import { computeTradePlanning, formatFeeDisplay } from "../../src/components/trade-planning-modal";
import {
  formatToPlatformId,
  getAccountBrokerInfo,
  getBrokerInfo,
  getPlatformOptionsForBroker,
  platformToDefaultBrokerId,
  checkPlatformCompatibility,
  getPresetForDetectedStatement,
} from "../../src/lib/brokers/broker-catalog";
import { THEME_INIT_SCRIPT, THEME_KEY, themePreference } from "../../src/lib/theme";
import { privacyPreference } from "../../src/lib/privacy-preference";
import { formatDateInput, parseDateInput } from "../../src/lib/date-input";
import { timeZoneLabel, timeZoneOptions } from "../../src/lib/timezone-options";
import { formatTimestamp, isTimeZone } from "../../src/lib/timezone";
import { parseJournalDefaults } from "../../src/lib/journal-defaults";
import { createTestDbHarness, type TestDbHarness } from "../helpers/db-harness";

let harness: TestDbHarness;

beforeAll(async () => {
  harness = await createTestDbHarness("journal-reports-explorer-harness-");
});

afterAll(() => {
  if (harness) {
    harness.teardown();
  }
});

// ============================================================================
// 1. FORMATTERS & NUMERICAL UTILITIES
// ============================================================================

describe("Formatters & Numerical Utilities", () => {
  describe("compactMoney", () => {
    it("formats standard amounts in compact notation with sign", () => {
      expect(compactMoney(1500, "USD")).toBe("+$1.5K");
      expect(compactMoney(-2400, "USD")).toBe("-$2.4K");
      expect(compactMoney(450, "USD")).toBe("+$450");
      expect(compactMoney(-50, "USD")).toBe("-$50");
    });

    it("normalizes negative zero and tiny sub-cents to $0 without negative sign", () => {
      expect(compactMoney(0, "USD")).toBe("$0");
      expect(compactMoney(-0, "USD")).toBe("$0");
      expect(compactMoney(-0.00001, "USD")).toBe("$0");
    });

    it("safely handles null, undefined, and NaN with dash", () => {
      expect(compactMoney(null, "USD")).toBe("–");
      expect(compactMoney(undefined, "USD")).toBe("–");
      expect(compactMoney(Number.NaN, "USD")).toBe("–");
    });

    it("supports EUR and GBP currencies", () => {
      expect(compactMoney(10000, "EUR")).toContain("10K");
      expect(compactMoney(-5000, "GBP")).toContain("5K");
    });
  });

  describe("fmtAdaptivePercent", () => {
    it("uses 0 decimals for large spans", () => {
      expect(fmtAdaptivePercent(0.12, 0.15)).toBe("12%");
    });

    it("uses 1 decimal for sub-1% spans", () => {
      expect(fmtAdaptivePercent(-0.005, 0.008)).toBe("-0.5%");
    });

    it("uses 2 decimals for ultra-low spans (< 0.2%)", () => {
      expect(fmtAdaptivePercent(-0.0012, 0.0015)).toBe("-0.12%");
    });

    it("safely handles null and NaN", () => {
      expect(fmtAdaptivePercent(null, 0.01)).toBe("–");
      expect(fmtAdaptivePercent(Number.NaN, 0.01)).toBe("–");
    });
  });

  describe("fmtChartDate", () => {
    it("formats ISO date strings to compact TradingView style (e.g. Sep 23)", () => {
      expect(fmtChartDate("2025-09-23")).toBe("Sep 23");
      expect(fmtChartDate("2026-01-05")).toBe("Jan 5");
      expect(fmtChartDate("2025-12-31")).toBe("Dec 31");
    });

    it("handles ISO timestamps with time component", () => {
      expect(fmtChartDate("2025-09-23T14:30:00Z")).toBe("Sep 23");
      expect(fmtChartDate("2026-04-16T09:15:22.000Z")).toBe("Apr 16");
    });

    it("falls back gracefully for non-standard inputs", () => {
      expect(fmtChartDate("")).toBe("");
      expect(fmtChartDate(null)).toBe("");
      expect(fmtChartDate(undefined)).toBe("");
      expect(fmtChartDate("custom-label")).toBe("custom-lab");
    });
  });

  describe("fmtFullDate", () => {
    it("formats ISO date strings to full date with year for tooltips (e.g. Sep 23, 2025)", () => {
      expect(fmtFullDate("2025-09-23")).toBe("Sep 23, 2025");
      expect(fmtFullDate("2026-01-05")).toBe("Jan 5, 2026");
      expect(fmtFullDate("2025-12-31T23:59:59Z")).toBe("Dec 31, 2025");
    });

    it("falls back gracefully for non-standard inputs", () => {
      expect(fmtFullDate("")).toBe("");
      expect(fmtFullDate(null)).toBe("");
    });
  });
});

// ============================================================================
// 2. PERFORMANCE TRENDS & TRAILING WINDOW CALCULATIONS
// ============================================================================

describe("Performance Trends", () => {
  const trendTrade = (
    index: number,
    netPnl: number,
    patch: Partial<AnnotatedTrade> = {},
  ): AnnotatedTrade => ({
    key: `trade-${String(index).padStart(3, "0")}`,
    accountId: "a",
    symbol: "AAPL",
    direction: "long",
    status: netPnl > 0 ? "win" : netPnl < 0 ? "loss" : "breakeven",
    openedAt: new Date(Date.UTC(2026, 7, index + 1, 12)).toISOString(),
    closedAt: new Date(Date.UTC(2026, 7, index + 1, 13)).toISOString(),
    quantity: 1,
    openQuantity: 0,
    avgEntry: 100,
    avgExit: 100 + netPnl + 2,
    grossPnl: netPnl + 2,
    fees: 2,
    netPnl,
    executionCount: 2,
    executionIds: [],
    exits: [],
    ...patch,
  });

  it("has honest empty and sparse states without partial windows", () => {
    expect(performanceTrends([])).toMatchObject({
      count: 0,
      points: [],
      overallWinRate: null,
      overallAvgNetPnl: null,
      largestWin: null,
      largestLoss: null,
    });
    const result = performanceTrends(Array.from({ length: 19 }, (_, i) => trendTrade(i, 10)));
    expect(result.points).toEqual([]);
    expect(result.overallAvgNetPnl).toBe(10);
    expect(result.overallWinRate).toBe(1);
  });

  it("computes full trailing windows after fees including breakevens in win-rate denominator", () => {
    const values = Array.from({ length: 32 }, (_, i) => [10, -4, 0, 6][i % 4]!);
    const trades = values.map((value, i) => trendTrade(i, value));
    const result = performanceTrends(trades);
    expect(result.points).toHaveLength(13);
    result.points.forEach((point, index) => {
      const window = values.slice(index, index + 20);
      expect(point.sequence).toBe(index + 20);
      expect(point.winRate).toBe(window.filter((value) => value > 0).length / 20);
      expect(point.avgNetPnl).toBeCloseTo(window.reduce((a, b) => a + b, 0) / 20);
      expect(point.key).toBe(trades[index + 19]!.key);
    });
    expect(result.overallWinRate).toBe(0.5);
    expect(result.overallAvgNetPnl).toBe(3);
  });

  it("sorts by closing time deterministically, excludes open trades, and does not mutate input", () => {
    const input = [
      trendTrade(2, -7),
      trendTrade(0, 5),
      trendTrade(1, 4, { closedAt: undefined, status: "open" }),
    ];
    const before = structuredClone(input);
    expect(performanceTrends(input)).toMatchObject({
      count: 2,
      overallAvgNetPnl: -1,
      overallWinRate: 0.5,
    });
    expect(input).toEqual(before);
    const tied = [trendTrade(2, 8, { closedAt: input[1]!.closedAt }), input[1]!];
    expect(performanceTrends(tied).largestWin?.key).toBe("trade-002");
  });

  it("links extrema to actual trades and resolves equal amounts to earliest close", () => {
    const input = [trendTrade(5, -10), trendTrade(3, 12), trendTrade(2, 12), trendTrade(1, -10)];
    expect(performanceTrends(input)).toMatchObject({
      largestWin: { key: "trade-002", netPnl: 12 },
      largestLoss: { key: "trade-001", netPnl: -10 },
    });
    expect(performanceTrends([trendTrade(0, 0)])).toMatchObject({
      largestWin: null,
      largestLoss: null,
      overallWinRate: 0,
    });
    expect(performanceTrends([trendTrade(0, 12)]).largestLoss).toBeNull();
    expect(performanceTrends([trendTrade(0, -12)]).largestWin).toBeNull();
  });

  it("honors configured outcome classification rather than deriving wins from the sign", () => {
    const input = Array.from({ length: 20 }, (_, i) => trendTrade(i, 1, { status: "breakeven" }));
    expect(performanceTrends(input)).toMatchObject({
      overallWinRate: 0,
      largestWin: null,
      points: [{ sequence: 20, winRate: 0, avgNetPnl: 1 }],
    });
  });

  it("does not borrow trades outside account, date, annotation, and timezone scope", () => {
    const input = Array.from({ length: 25 }, (_, i) =>
      trendTrade(i, 10, { annotations: { tags: ["setup"] } }),
    );
    input.push(trendTrade(25, 999, { accountId: "b" }));
    input.push(trendTrade(26, 999));
    input.push(
      trendTrade(27, 5, { closedAt: "2026-09-01T00:30:00Z", annotations: { tags: ["setup"] } }),
    );
    const filters = { accounts: "a", tag: "setup", from: "2026-08-01", to: "2026-08-31" };
    const scoped = performanceTrends(
      input.filter((t) => matchesFilters(t, filters, "America/New_York")),
    );
    expect(scoped.count).toBe(26);
    expect(scoped.points.at(-1)?.avgNetPnl).toBe(9.75);
    expect(performanceTrends(input.filter((t) => matchesFilters(t, filters, "UTC"))).count).toBe(
      25,
    );
    expect(
      performanceTrends(
        input.filter((t) => matchesFilters(t, { ...filters, from: "2026-08-20" }, "UTC")),
      ).points,
    ).toEqual([]);
  });
});

// ============================================================================
// 3. REPORT COMPARISON & COHORT ANALYSIS
// ============================================================================

describe("Report Comparison Calculations", () => {
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

// ============================================================================
// 4. REVIEW EXPORT & PDF GENERATION
// ============================================================================

describe("Review Export PDF", () => {
  const font = readFileSync(new URL("../../public/fonts/NotoSans-Regular.ttf", import.meta.url));

  it("exports a paginated PDF with embedded Unicode text using the production builder", async () => {
    const bytes = await buildReviewPdf(
      {
        title: "Trade review · café",
        subtitle: "ES · 2026-09-02",
        lines: [
          "## Setup review",
          "**Plan followed**",
          ...Array.from(
            { length: 90 },
            (_, i) => `Observation ${i + 1}: planned risk 500 USD, realized 1.99R.`,
          ),
          "FINAL REVIEW LINE",
        ],
      },
      font,
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe("Trade review · café");
    if (process.env.JOURNAL_EXPORT_TEST_PATH)
      writeFileSync(process.env.JOURNAL_EXPORT_TEST_PATH, bytes);
  });

  it("reports unsupported glyphs rather than silently dropping note content", async () => {
    await expect(buildReviewPdf({ title: "Review", lines: ["🚀"] }, font)).rejects.toThrow(
      "does not support",
    );
  });
});

// ============================================================================
// 5. TRADE LINKS & MARKDOWN RENDERING
// ============================================================================

describe("Trade Links", () => {
  const first = {
    key: "one|ES|long|2026-09-01T14:30:00Z",
    symbol: "ES",
    direction: "long",
    openedAt: "2026-09-01T14:30:00Z",
    accountName: "Main account",
  };

  it("accepts encoded client navigation and decoded reload params without decoding a literal percent twice", () => {
    const key = "account|S%P|long|2026-09-01T14:30:00Z";
    expect(tradeKeyFromSegment(encodeURIComponent(key))).toBe(key);
    expect(tradeKeyFromSegment(key)).toBe(key);
  });

  it("distinguishes trades by time and account even with the same symbol and day", () => {
    const later = {
      ...first,
      key: "one|ES|long|2026-09-01T15:30:00Z",
      openedAt: "2026-09-01T15:30:00Z",
    };
    const otherAccount = {
      ...first,
      key: "two|ES|long|2026-09-01T14:30:00Z",
      accountName: "Second account",
    };
    expect(new Set([first, later, otherAccount].map(tradeLinkLabel)).size).toBe(3);
    expect(new Set([first, later, otherAccount].map(tradeMarkdownLink)).size).toBe(3);
  });

  it("renders a clickable exact key and escapes special characters in the label", () => {
    const trade = {
      ...first,
      key: "acct|S%P/[X]|long|2026-09-01T14:30:00Z",
      symbol: "S%P/[X]",
      accountName: "**Main** [account]",
    };
    const html = renderToStaticMarkup(
      createElement(ReactMarkdown, { children: tradeMarkdownLink(trade) }),
    );
    expect(html).toContain(`href="${tradePath(trade.key)}"`);
    expect(decodeURIComponent(tradePath(trade.key).slice("/trades/".length))).toBe(trade.key);
    expect(html).not.toContain("<strong>");
  });
});

// ============================================================================
// 6. TRADE EXPLORER SCATTER PLOTS & OBSERVATIONS
// ============================================================================

describe("Trade Explorer", () => {
  const explorerTrade = (patch: Partial<AnnotatedTrade> = {}): AnnotatedTrade => ({
    key: "a|AAPL|long|2026-09-01T00:30:00Z",
    accountId: "a",
    symbol: "AAPL",
    direction: "long",
    status: "win",
    openedAt: "2026-09-01T00:30:00Z",
    closedAt: "2026-09-01T01:00:30Z",
    quantity: 10,
    openQuantity: 0,
    avgEntry: 100,
    avgExit: 110,
    netPnl: 96,
    grossPnl: 100,
    fees: 4,
    executionCount: 2,
    executionIds: [],
    exits: [],
    annotations: { stopLoss: 98, tags: ["setup"] },
    ...patch,
  });

  it("plots one net-of-fees observation per closed trade with exact elapsed minutes", () => {
    const rows = tradeExplorerPoints(
      [explorerTrade(), explorerTrade({ key: "open", status: "open", closedAt: undefined })],
      "UTC",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      durationMinutes: 30.5,
      entryMinute: 30,
      netPnl: 96,
      realizedR: 4.8,
    });
    expect(plotTradePoints(rows, "durationMinutes", "netPnl")[0]).toMatchObject({ x: 30.5, y: 96 });
  });

  it("plots excursion axes without treating missing estimates as zero or MAE as a loss outcome", () => {
    const rows = tradeExplorerPoints([explorerTrade(), explorerTrade({ key: "missing" })], "UTC");
    rows[0]!.mae = 0;
    rows[0]!.mfe = 140;
    expect(plotTradePoints(rows, "mae", "mfe")).toMatchObject([{ x: 0, y: 140, netPnl: 96 }]);
    expect(plotTradePoints(rows, "mfe", "netPnl")).toMatchObject([{ x: 140, y: 96 }]);
    rows[0]!.mae = Infinity;
    expect(plotTradePoints(rows, "mae", "mfe")).toEqual([]);
  });

  it("uses local entry time while elapsed duration remains timezone independent", () => {
    expect(tradeExplorerPoints([explorerTrade()], "America/New_York")[0]).toMatchObject({
      durationMinutes: 30.5,
      entryMinute: 20 * 60 + 30,
    });
    const dst = explorerTrade({ openedAt: "2026-11-01T05:30:00Z", closedAt: "2026-11-01T06:30:00Z" });
    expect(tradeExplorerPoints([dst], "America/New_York")[0]).toMatchObject({
      durationMinutes: 60,
      entryMinute: 90,
    });
    expect(clockLabel(1230)).toBe("20:30");
    expect(clockLabel(0)).toBe("00:00");
    expect(clockLabel(1440)).toBe("24:00");
  });

  it("preserves zero outcomes and excludes missing risk only from R views", () => {
    const rows = tradeExplorerPoints(
      [
        explorerTrade({ key: "no-risk", annotations: {} }),
        explorerTrade({ key: "zero", netPnl: 0, status: "breakeven" }),
      ],
      "UTC",
    );
    expect(plotTradePoints(rows, "durationMinutes", "netPnl")).toHaveLength(2);
    expect(plotTradePoints(rows, "entryMinute", "realizedR")).toMatchObject([
      { key: "zero", y: 0 },
    ]);
    expect(tradeExplorerPoints([explorerTrade({ assetClass: "futures" })], "UTC")[0]!.realizedR).toBeNull();
    expect(
      tradeExplorerPoints([explorerTrade({ assetClass: "futures", contractMultiplier: 2 })], "UTC")[0]!
        .realizedR,
    ).toBe(2.4);
  });

  it("excludes invalid axis inputs without fabricating zeroes", () => {
    const rows = tradeExplorerPoints(
      [
        explorerTrade({ key: "reverse", closedAt: "2026-08-31T00:00:00Z" }),
        explorerTrade({ key: "bad-open", openedAt: "invalid" }),
        explorerTrade({ key: "bad-close", closedAt: "invalid" }),
        explorerTrade({ key: "infinite", netPnl: Infinity }),
        explorerTrade({ key: "zero-duration", closedAt: "2026-09-01T00:30:00Z" }),
      ],
      "UTC",
    );
    expect(plotTradePoints(rows, "durationMinutes", "netPnl").map((p) => p.key)).toEqual([
      "zero-duration",
    ]);
    expect(plotTradePoints(rows, "entryMinute", "netPnl").map((p) => p.key)).toEqual([
      "zero-duration",
      "reverse",
    ]);
  });

  it("preserves account/date/tag filtering and does not mutate source trades", () => {
    const input = [
      explorerTrade(),
      explorerTrade({ key: "other", accountId: "b" }),
      explorerTrade({ key: "untagged", annotations: {} }),
    ];
    const before = structuredClone(input);
    const filters = { accounts: "a", tag: "setup", from: "2026-08-31", to: "2026-08-31" };
    const rows = tradeExplorerPoints(
      input.filter((t) => matchesFilters(t, filters, "America/New_York")),
      "America/New_York",
    );
    expect(rows).toHaveLength(1);
    expect(input).toEqual(before);
    expect(
      tradeExplorerPoints(
        input.filter((t) => matchesFilters(t, filters, "UTC")),
        "UTC",
      ),
    ).toEqual([]);
    expect(plotTradePoints([], "durationMinutes", "netPnl")).toEqual([]);
  });
});

// ============================================================================
// 7. TRADE PLANNING MODAL & FEE DISPLAY
// ============================================================================

describe("Trade Planning Modal Calculations", () => {
  describe("Long trades", () => {
    it("computes Planned R:R, Risk, and Reward correctly for a standard Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(20);
      expect(result.rewardPerUnit).toBe(25);
      expect(result.totalReward).toBe(50);
      expect(result.plannedR).toBe(2.5);
      expect(result.plannedRFormatted).toBe("1 : 2.50R");
      expect(result.isStopValidForDirection).toBe(true);
      expect(result.isTargetValidForDirection).toBe(true);
    });

    it("correctly computes Realized R for closed winning and losing Long trades", () => {
      const winResult = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
        grossPnl: 30,
        isClosed: true,
      });
      expect(winResult.realizedR).toBe(1.5);
      expect(winResult.realizedRFormatted).toBe("+1.50R");

      const lossResult = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
        grossPnl: -20,
        isClosed: true,
      });
      expect(lossResult.realizedR).toBe(-1);
      expect(lossResult.realizedRFormatted).toBe("-1.00R");
    });

    it("flags invalid stop loss that is above entry price for a Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 105,
        profitTarget: 120,
      });

      expect(result.isStopValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });

    it("flags invalid profit target that is below entry price for a Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: 80,
      });

      expect(result.isTargetValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });
  });

  describe("Short trades", () => {
    it("computes Planned R:R, Risk, and Reward correctly for a Short trade with contract multiplier", () => {
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(500);
      expect(result.rewardPerUnit).toBe(25);
      expect(result.totalReward).toBe(1250);
      expect(result.plannedR).toBe(2.5);
      expect(result.plannedRFormatted).toBe("1 : 2.50R");
      expect(result.isStopValidForDirection).toBe(true);
      expect(result.isTargetValidForDirection).toBe(true);
    });

    it("correctly computes Realized R for closed Short trades", () => {
      const winResult = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
        grossPnl: 1000,
        isClosed: true,
      });
      expect(winResult.realizedR).toBe(2);
      expect(winResult.realizedRFormatted).toBe("+2.00R");

      const lossResult = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
        grossPnl: -500,
        isClosed: true,
      });
      expect(lossResult.realizedR).toBe(-1);
      expect(lossResult.realizedRFormatted).toBe("-1.00R");
    });

    it("flags invalid stop loss that is below entry price for a Short trade", () => {
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 95,
        profitTarget: 80,
      });

      expect(result.isStopValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });

    it("flags invalid profit target that is above entry price for a Short trade", () => {
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 105,
        profitTarget: 110,
      });

      expect(result.isTargetValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });
  });

  describe("Edge cases & Incomplete plans", () => {
    it("handles null stop loss gracefully", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: null,
        profitTarget: 120,
      });

      expect(result.riskPerUnit).toBeNull();
      expect(result.totalRisk).toBeNull();
      expect(result.rewardPerUnit).toBe(20);
      expect(result.plannedR).toBeNull();
      expect(result.realizedR).toBeNull();
    });

    it("handles null profit target gracefully", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: null,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(10);
      expect(result.rewardPerUnit).toBeNull();
      expect(result.plannedR).toBeNull();
    });

    it("does not compute realized R if trade is open", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: 120,
        grossPnl: 15,
        isClosed: false,
      });

      expect(result.realizedR).toBeNull();
      expect(result.realizedRFormatted).toBeNull();
    });
  });

  describe("formatFeeDisplay", () => {
    it("formats positive fees as negative currency deduction (-$X.XX)", () => {
      expect(formatFeeDisplay(5.2)).toBe("-$5.20");
      expect(formatFeeDisplay(142.5)).toBe("-$142.50");
      expect(formatFeeDisplay(0.01)).toBe("-$0.01");
    });

    it("formats zero fees as $0.00", () => {
      expect(formatFeeDisplay(0)).toBe("$0.00");
    });

    it("handles negative zero or zero-like numbers without producing positive or weird signs", () => {
      expect(formatFeeDisplay(-0)).toBe("$0.00");
      expect(formatFeeDisplay(-5)).toBe("$0.00");
    });

    it("NEVER outputs a positive +$ sign for fees under any circumstance", () => {
      const testCases = [0, 1, 5.2, 10, 99.99, 1000, 0.0001];
      for (const val of testCases) {
        const formatted = formatFeeDisplay(val);
        expect(formatted.startsWith("+")).toBe(false);
        expect(formatted).not.toContain("+$");
      }
    });

    it("supports alternative currencies like EUR and GBP with correct negative sign", () => {
      expect(formatFeeDisplay(10.5, "EUR")).toBe("-€10.50");
      expect(formatFeeDisplay(15.75, "GBP")).toBe("-£15.75");
      expect(formatFeeDisplay(0, "EUR")).toBe("€0.00");
      expect(formatFeeDisplay(0, "GBP")).toBe("£0.00");
    });
  });
});

// ============================================================================
// 8. USER PREFERENCES & SETTINGS (Theme, Privacy, Defaults, Date, Timezone)
// ============================================================================

describe("User Preferences & Global Settings", () => {
  describe("Journal Appearance & Theme", () => {
    it("defaults to dark and accepts only explicit light or dark choices", () => {
      expect(themePreference(null)).toBe("dark");
      expect(themePreference("system")).toBe("dark");
      expect(themePreference("invalid")).toBe("dark");
      expect(themePreference("dark")).toBe("dark");
      expect(themePreference("light")).toBe("light");
    });

    it.each([null, "dark", "light", "invalid"])("applies %s before hydration", (saved) => {
      const calls: unknown[] = [];
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: {
          getItem: (key: string) => {
            expect(key).toBe(THEME_KEY);
            return saved;
          },
        },
        document: {
          documentElement: { classList: { toggle: (...args: unknown[]) => calls.push(args) } },
        },
      });
      expect(calls).toEqual([["dark", themePreference(saved) === "dark"]]);
    });

    it("still renders dark when browser storage is blocked", () => {
      let dark = false;
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        document: {
          documentElement: {
            classList: {
              toggle: (_: string, value: boolean) => {
                dark = value;
              },
            },
          },
        },
      });
      expect(dark).toBe(true);
    });
  });

  describe("Global Privacy Preference", () => {
    it("carries forward the dashboard setting before the first global toggle", () => {
      expect(privacyPreference(null, '{"privacy":true}')).toBe(true);
      expect(privacyPreference(null, '{"privacy":false}')).toBe(false);
      expect(privacyPreference(null, null)).toBe(false);
    });

    it("gives the global setting priority over old saved layouts", () => {
      expect(privacyPreference("false", '{"privacy":true}')).toBe(false);
      expect(privacyPreference("true", '{"privacy":false}')).toBe(true);
    });

    it("hides amounts when a stored preference is corrupted", () => {
      expect(privacyPreference("broken", null)).toBe(true);
      expect(privacyPreference(null, "broken")).toBe(true);
    });
  });

  describe("Date-Only Picker Values", () => {
    it("round trips dates without converting through UTC", () => {
      for (const value of ["2026-09-04", "2024-02-29", "2026-12-31", "0099-01-01"]) {
        expect(formatDateInput(parseDateInput(value)!)).toBe(value);
      }
    });

    it("rejects impossible and partial dates", () => {
      for (const value of [
        "",
        "2026-02-29",
        "2026-04-31",
        "2026-13-01",
        "2026-00-01",
        "2026-09-00",
        "2026-9-1",
        "09/04/2026",
      ]) {
        expect(parseDateInput(value)).toBeUndefined();
      }
    });
  });

  describe("Searchable Timezone Choices", () => {
    it("includes every primary timezone supported by the runtime plus UTC", () => {
      const options = timeZoneOptions("");
      expect(options[0]).toBe("UTC");
      for (const zone of Intl.supportedValuesOf("timeZone")) expect(options).toContain(zone);
      expect(new Set(options).size).toBe(options.length);
    });

    it("finds cities regardless of capitalization, accents, underscores, or word order", () => {
      expect(timeZoneOptions("", "HELSINKI")).toEqual(["Europe/Helsinki"]);
      expect(timeZoneOptions("", "jamaica")).toContain("America/Jamaica");
      expect(timeZoneOptions("", "Asunción")).toEqual(["America/Asuncion"]);
      expect(timeZoneOptions("", "New York")).toEqual(["America/New_York"]);
      expect(timeZoneOptions("", "york america")).toEqual(["America/New_York"]);
    });

    it("keeps saved aliases and allows selecting valid full names omitted by the primary list", () => {
      expect(timeZoneOptions("US/Eastern")).toContain("US/Eastern");
      expect(timeZoneOptions("", "US/Eastern")).toEqual(["US/Eastern"]);
      expect(timeZoneOptions("", "Etc/GMT+5")).toEqual(["Etc/GMT+5"]);
      expect(timeZoneOptions("", "  Europe/Kyiv  ")).toContain("Europe/Kyiv");
    });

    it("never offers a misspelled timezone as a selectable custom value", () => {
      expect(timeZoneOptions("", "Europe/Helsinkii")).toEqual([]);
      expect(timeZoneOptions("", "Mars/Olympus")).toEqual([]);
      expect(timeZoneOptions("invalid-saved-zone")).not.toContain("invalid-saved-zone");
    });

    it("shows human-readable names while keeping region context", () => {
      expect(timeZoneLabel("America/Argentina/Buenos_Aires")).toBe(
        "America / Argentina / Buenos Aires",
      );
      expect(timeZoneLabel("UTC")).toBe("UTC");
    });
  });

  describe("Journal Defaults Validation", () => {
    const knows = (id: string) => id === "acct";
    const valid = {
      breakeven: 5,
      breakevenMode: "money",
      feeRules: [{ id: "f1", accountId: "acct", symbol: "ES", amount: 2, mode: "unit" }],
      riskRules: [{ id: "r1", accountId: "", symbol: "", stop: 1, target: 3, mode: "percent" }],
    };

    it("accepts a well-formed payload and returns exactly the known fields", () => {
      const parsed = parseJournalDefaults(valid, knows);
      expect(parsed.error).toBeUndefined();
      if (parsed.error === undefined) expect(parsed.defaults).toEqual(valid);
    });

    it("rejects unknown top-level fields so arbitrary data is never stored in settings", () => {
      expect(parseJournalDefaults({ ...valid, injected: "<script>" }, knows).error).toMatch(
        /unknown/,
      );
    });

    it("rejects unknown fields inside individual fee or risk defaults", () => {
      const withExtra = {
        ...valid,
        feeRules: [{ ...valid.feeRules[0], note: "extra" }],
      };
      expect(parseJournalDefaults(withExtra, knows).error).toMatch(/unknown/);
    });

    it("rejects non-finite numbers and negative or zero distances", () => {
      expect(parseJournalDefaults({ ...valid, breakeven: NaN }, knows).error).toBeDefined();
      expect(parseJournalDefaults({ ...valid, breakeven: "5" }, knows).error).toBeDefined();
      expect(
        parseJournalDefaults(
          { ...valid, feeRules: [{ ...valid.feeRules[0], amount: Infinity }] },
          knows,
        ).error,
      ).toBeDefined();
      expect(
        parseJournalDefaults({ ...valid, riskRules: [{ ...valid.riskRules[0], stop: 0 }] }, knows)
          .error,
      ).toBeDefined();
    });

    it("rejects defaults that point at an account which does not exist", () => {
      expect(
        parseJournalDefaults(
          { ...valid, feeRules: [{ ...valid.feeRules[0], accountId: "ghost" }] },
          knows,
        ).error,
      ).toMatch(/account/);
    });

    it("rejects payloads that are not objects", () => {
      expect(parseJournalDefaults(null, knows).error).toBeDefined();
      expect(parseJournalDefaults([], knows).error).toBeDefined();
      expect(parseJournalDefaults("defaults", knows).error).toBeDefined();
    });
  });
});

// ============================================================================
// 9. AUTO-BINDING, BROKER CATALOG & COMPATIBILITY
// ============================================================================

describe("Auto-Binding & Broker Catalog", () => {
  describe("formatToPlatformId & getBrokerInfo", () => {
    it("maps import formats to canonical platform IDs correctly", () => {
      expect(formatToPlatformId("metatrader")).toBe("metatrader5");
      expect(formatToPlatformId("history-metatrader")).toBe("metatrader5");
      expect(formatToPlatformId("tradovate")).toBe("tradovate");
      expect(formatToPlatformId("ninjatrader")).toBe("ninjatrader");
      expect(formatToPlatformId("topstepx")).toBe("topstepx");
      expect(formatToPlatformId("tradesea")).toBe("tradesea");
      expect(formatToPlatformId("wealthcharts")).toBe("wealthcharts");
      expect(formatToPlatformId("rithmic")).toBe("rithmic");
      expect(formatToPlatformId("ibkr")).toBe("ibkr");
      expect(formatToPlatformId("ibkr-flex")).toBe("ibkr");
      expect(formatToPlatformId("thinkorswim")).toBe("thinkorswim");
      expect(formatToPlatformId("tradingview")).toBe("tradingview");
      expect(formatToPlatformId("unknown-format")).toBeUndefined();
      expect(platformToDefaultBrokerId("metatrader5")).toBe("metatrader");
      expect(platformToDefaultBrokerId("metatrader4")).toBe("metatrader");
      expect(platformToDefaultBrokerId("tradovate")).toBe("tradovate");
      expect(platformToDefaultBrokerId("wealthcharts")).toBe("wealthcharts");
    });

    it("resolves merged identities for prop firms + execution platforms", () => {
      const lucidTradovate = getBrokerInfo("lucid", "tradovate");
      expect(lucidTradovate).toBeDefined();
      expect(lucidTradovate?.name).toBe("Lucid Trading");
      expect(lucidTradovate?.icon).toBe("lucid.png");
      expect(lucidTradovate?.platform).toBe("tradovate");
      expect(lucidTradovate?.platformName).toBe("Tradovate");
      expect(lucidTradovate?.platformIcon).toBe("tradovate.svg");

      const lucidNinja = getBrokerInfo("lucid", "ninjatrader");
      expect(lucidNinja).toBeDefined();
      expect(lucidNinja?.name).toBe("Lucid Trading");
      expect(lucidNinja?.platform).toBe("ninjatrader");
      expect(lucidNinja?.platformName).toBe("NinjaTrader 8");
      expect(lucidNinja?.platformIcon).toBe("ninjatrader.svg");

      const ftmoMt5 = getBrokerInfo("ftmo", "metatrader5");
      expect(ftmoMt5).toBeDefined();
      expect(ftmoMt5?.name).toBe("FTMO");
      expect(ftmoMt5?.platform).toBe("metatrader5");
      expect(ftmoMt5?.platformName).toBe("MetaTrader 5");
      expect(ftmoMt5?.platformIcon).toBe("metatrader5.png");

      const ftmoCtrader = getBrokerInfo("ftmo", "ctrader");
      expect(ftmoCtrader).toBeDefined();
      expect(ftmoCtrader?.name).toBe("FTMO");
      expect(ftmoCtrader?.platform).toBe("ctrader");
      expect(ftmoCtrader?.platformName).toBe("cTrader");
      expect(ftmoCtrader?.platformIcon).toBe("ctrader.png");

      const tradeify = getBrokerInfo("tradeify");
      expect(tradeify).toBeDefined();
      expect(tradeify?.name).toBe("Tradeify");
      expect(tradeify?.icon).toBe("tradeify.png");
      expect(tradeify?.category).toBe("prop-firm");

      const ctrader = getBrokerInfo("ctrader");
      expect(ctrader).toBeDefined();
      expect(ctrader?.name).toBe("cTrader");
      expect(ctrader?.icon).toBe("ctrader.png");
      expect(ctrader?.category).toBe("platform");

      const apexNinja = getBrokerInfo("apex", "ninjatrader");
      expect(apexNinja).toBeDefined();
      expect(apexNinja?.name).toBe("Apex Trader Funding");
      expect(apexNinja?.platform).toBe("ninjatrader");
      expect(apexNinja?.platformName).toBe("NinjaTrader 8");
      expect(apexNinja?.platformIcon).toBe("ninjatrader.svg");

      const apexWealth = getBrokerInfo("apex", "wealthcharts");
      expect(apexWealth).toBeDefined();
      expect(apexWealth?.name).toBe("Apex Trader Funding");
      expect(apexWealth?.platform).toBe("wealthcharts");
      expect(apexWealth?.platformName).toBe("WealthCharts");
      expect(apexWealth?.platformIcon).toBe("wealthcharts.png");

      const topstep = getBrokerInfo("topstep", "topstepx");
      expect(topstep).toBeDefined();
      expect(topstep?.name).toBe("Topstep");
      expect(topstep?.platform).toBe("topstepx");
      expect(topstep?.platformName).toBe("TopstepX");

      const rithmic = getBrokerInfo("rithmic");
      expect(rithmic).toBeDefined();
      expect(rithmic?.name).toBe("Rithmic");
      expect(rithmic?.icon).toBe("rithmic.png");
      expect(rithmic?.platformIcon).toBe("rithmic.png");

      const tradesea = getBrokerInfo("tradesea");
      expect(tradesea).toBeDefined();
      expect(tradesea?.name).toBe("TradeSea");
      expect(tradesea?.icon).toBe("tradesea.png");
      expect(tradesea?.platformIcon).toBe("tradesea.png");

      const ftmoPlatforms = getPlatformOptionsForBroker("ftmo");
      expect(ftmoPlatforms.some((p) => p.value === "ctrader")).toBe(true);

      const tradeifyPlatforms = getPlatformOptionsForBroker("tradeify");
      expect(tradeifyPlatforms.some((p) => p.value === "tradovate")).toBe(true);
      expect(tradeifyPlatforms.some((p) => p.value === "ninjatrader")).toBe(true);

      const matchedTradeify = getAccountBrokerInfo({ name: "Tradeify 50k Funded" });
      expect(matchedTradeify?.name).toBe("Tradeify");
      expect(matchedTradeify?.icon).toBe("tradeify.png");

      const matchedCtrader = getAccountBrokerInfo({ name: "FTMO cTrader Main" });
      expect(matchedCtrader?.name).toBe("FTMO");

      const matchedPureCtrader = getAccountBrokerInfo({ name: "Spotware cTrader Raw" });
      expect(matchedPureCtrader?.name).toBe("cTrader");
      expect(matchedPureCtrader?.icon).toBe("ctrader.png");
    });
  });

  describe("Platform Compatibility & Preset Detection", () => {
    it("detects compatible broker and platform combinations", () => {
      expect(
        checkPlatformCompatibility({ broker: "ftmo", platform: "metatrader5" }, "metatrader")
          .compatible,
      ).toBe(true);
      expect(
        checkPlatformCompatibility({ broker: "ftmo", platform: "ctrader" }, "ctrader").compatible,
      ).toBe(true);

      const ftmoTradovate = checkPlatformCompatibility(
        { broker: "ftmo", platform: "metatrader5" },
        "tradovate",
      );
      expect(ftmoTradovate.compatible).toBe(false);
      expect(ftmoTradovate.reason).toContain("FTMO");

      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "tradovate" }, "tradovate")
          .compatible,
      ).toBe(true);
      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "ninjatrader" }, "ninjatrader")
          .compatible,
      ).toBe(true);
      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "tradovate" }, "metatrader")
          .compatible,
      ).toBe(false);
    });

    it("detects statement presets accurately", () => {
      const lucidPreset = getPresetForDetectedStatement("LFE0506847043001", "tradovate");
      expect(lucidPreset.broker).toBe("lucid");
      expect(lucidPreset.platform).toBe("tradovate");
      expect(lucidPreset.tab).toBe("prop");
      expect(lucidPreset.suggestedName).toBe("Lucid LFE0506847043001");
      expect(lucidPreset.timeZone).toBe("America/Chicago");

      const apexPreset = getPresetForDetectedStatement("PA-APEX-12345", "tradovate");
      expect(apexPreset.broker).toBe("apex");
      expect(apexPreset.suggestedName).toBe("Apex PA-APEX-12345");

      const ftmoPreset = getPresetForDetectedStatement("530319802", "metatrader");
      expect(ftmoPreset.broker).toBe("ftmo");
      expect(ftmoPreset.platform).toBe("metatrader5");
      expect(ftmoPreset.suggestedName).toBe("FTMO 530319802");
    });
  });

  describe("Auto-Binding on import commit & conflict prevention", () => {
    let accountsTable: any;
    let postImport: any;

    beforeAll(async () => {
      const dbModule = await import("../../src/db");
      accountsTable = dbModule.accounts;
      const importRoute = await import("../../src/app/api/import/route");
      postImport = (body: object) =>
        importRoute.POST(
          new Request("http://localhost/api/import", {
            method: "POST",
            body: JSON.stringify(body),
          }),
        );
    });

    beforeEach(() => {
      harness.cleanTables();
    });

    it("binds Tradovate platform to a Lucid Trading account upon file commit", async () => {
      harness.db
        .insert(accountsTable)
        .values({
          id: "lucid-acc",
          name: "Lucid 50k",
          broker: "lucid",
          kind: "import",
          createdAt: "2026-01-01",
        })
        .run();

      const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
1001,LUCID123,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,1,5000,Filled
1002,LUCID123,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,1,5010,Filled`;

      const res = await postImport({
        mode: "commit",
        content: tradovateContent,
        accountId: "lucid-acc",
        timeZone: "UTC",
      });
      expect(res.status).toBe(200);

      const updated = harness.db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.id, "lucid-acc"))
        .get();
      expect(updated?.broker).toBe("lucid");
      expect(updated?.platform).toBe("tradovate");

      const resolved = getBrokerInfo(updated?.broker, updated?.platform);
      expect(resolved?.name).toBe("Lucid Trading");
      expect(resolved?.platformName).toBe("Tradovate");
      expect(resolved?.platformIcon).toBe("tradovate.svg");
    });

    it("binds both broker and platform if target account has no broker set", async () => {
      harness.db
        .insert(accountsTable)
        .values({
          id: "empty-acc",
          name: "My Unassigned Account",
          broker: "",
          kind: "import",
          createdAt: "2026-01-01",
        })
        .run();

      const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
2001,ACC1,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,1,5000,Filled
2002,ACC1,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,1,5010,Filled`;

      const res = await postImport({
        mode: "commit",
        content: tradovateContent,
        accountId: "empty-acc",
        timeZone: "UTC",
      });
      expect(res.status).toBe(200);

      const updated = harness.db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.id, "empty-acc"))
        .get();
      expect(updated?.broker).toBe("tradovate");
      expect(updated?.platform).toBe("tradovate");
    });

    it("rejects commit when statement account conflicts with target account", async () => {
      harness.db
        .insert(accountsTable)
        .values({
          id: "eval-ftmo",
          name: "Eval",
          broker: "ftmo",
          platform: "metatrader5",
          accountNumber: "530319802",
          kind: "import",
          createdAt: "2026-01-01",
        })
        .run();

      const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
3001,LFE0506847043001,08/20/2026,08/20/2026 09:31:05,Buy,MNQU6,MNQ,1,20000,Filled
3002,LFE0506847043001,08/20/2026,08/20/2026 09:45:10,Sell,MNQU6,MNQ,1,20010,Filled`;

      const res = await postImport({
        mode: "commit",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Account mismatch");

      const previewRes = await postImport({
        mode: "preview",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
      });
      expect(previewRes.status).toBe(200);
      const previewJson = await previewRes.json();
      expect(previewJson.accountConflict?.isConflict).toBe(true);
      expect(previewJson.accountConflict?.detectedAccount).toBe("LFE0506847043001");
      expect(previewJson.accountConflict?.targetAccountNumber).toBe("530319802");
      expect(previewJson.compatibility?.compatible).toBe(false);

      const forcedRes = await postImport({
        mode: "commit",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
        forceMismatch: true,
      });
      expect(forcedRes.status).toBe(200);
    });
  });
});

// ============================================================================
// 10. STATEMENT & DISPLAY TIMEZONES INTEGRATION (Isolated DB Harness)
// ============================================================================

describe("Statement & Display Timezones Subsystem", () => {
  let accounts: any;
  let executions: any;
  let trades: any;
  let settings: any;
  let setSetting: any;
  let getTimeZone: any;
  let getImportTimeZone: any;
  let importFile: any;
  let getSettings: any;
  let patchSettings: any;
  let stats: any;
  let journal: any;
  let calendar: any;
  let listTrades: any;
  let tradeDetail: any;
  let exportData: any;
  let html: string;

  const request = (path: string, body?: unknown) =>
    new Request(
      `http://localhost/api/${path}`,
      body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) },
    );
  const save = (body: unknown) => patchSettings(request("settings", body));
  const post = async (body: object) => {
    const response = await importFile(request("import", body));
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    return result;
  };

  beforeAll(async () => {
    const dbModule = await import("../../src/db");
    accounts = dbModule.accounts;
    executions = dbModule.executions;
    trades = dbModule.trades;
    settings = dbModule.settings;

    const settingsModule = await import("../../src/server/settings");
    setSetting = settingsModule.setSetting;
    getTimeZone = settingsModule.getTimeZone;
    getImportTimeZone = settingsModule.getImportTimeZone;

    const importRoute = await import("../../src/app/api/import/route");
    importFile = importRoute.POST;

    const settingsRoute = await import("../../src/app/api/settings/route");
    getSettings = settingsRoute.GET;
    patchSettings = settingsRoute.PATCH;

    const statsRoute = await import("../../src/app/api/stats/route");
    stats = statsRoute.GET;

    const journalRoute = await import("../../src/app/api/journal/route");
    journal = journalRoute.GET;

    const calendarRoute = await import("../../src/app/api/calendar/route");
    calendar = calendarRoute.GET;

    const tradesRoute = await import("../../src/app/api/trades/route");
    listTrades = tradesRoute.GET;

    const tradeDetailRoute = await import("../../src/app/api/trades/[key]/route");
    tradeDetail = tradeDetailRoute.GET;

    const exportRoute = await import("../../src/app/api/export/route");
    exportData = exportRoute.GET;

    html = readFileSync(
      new URL("../../../../docs/samples/mt5-timezone.html", import.meta.url),
      "utf8",
    );
  });

  beforeEach(() => {
    harness.cleanTables();
    harness.db
      .insert(accounts)
      .values({ id: "test", name: "Timezone test", kind: "import", createdAt: "2026-01-01" })
      .run();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves legacy import behavior when only the display timezone changes", async () => {
    expect(getImportTimeZone()).toBe("UTC");
    setSetting("timeZone", "Europe/Helsinki");
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
    expect((await save({ timeZone: "America/Asuncion" })).status).toBe(200);
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
    expect(getTimeZone()).toBe("America/Asuncion");
    await save({ timeZone: "America/New_York" });
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
  });

  it.each([
    ["2026.01.05", "2026-01-05T02:00:00.000Z"],
    ["2026.07.05", "2026-07-05T01:00:00.000Z"],
  ])(
    "imports broker wall-clock time correctly in %s and deduplicates the same file",
    async (date, expected) => {
      await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
      const content = html.replaceAll("2026.07.05", date);
      const preview = await post({ mode: "preview", content });
      expect(preview).toMatchObject({
        detected: "history-metatrader",
        timeZone: "Europe/Helsinki",
      });
      expect(preview.executions[0].executedAt).toBe(expected);
      expect(harness.db.select().from(executions).all()).toHaveLength(0);
      await post({ mode: "commit", accountId: "test", content });
      expect(
        harness.db
          .select()
          .from(executions)
          .all()
          .map((row: any) => row.executedAt),
      ).toContain(expected);
      expect(await post({ mode: "commit", accountId: "test", content })).toMatchObject({
        inserted: 0,
        duplicates: 2,
      });
    },
  );

  it("uses a per-file override in both preview and commit without changing defaults", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "UTC" });
    const preview = await post({ mode: "preview", content: html, timeZone: "Europe/Helsinki" });
    await save({ importTimeZone: "America/New_York" });
    await post({ mode: "commit", accountId: "test", content: html, timeZone: preview.timeZone });
    expect(
      harness.db
        .select()
        .from(executions)
        .all()
        .map((row: any) => row.executedAt),
    ).toContain("2026-07-05T01:00:00.000Z");
    expect(getImportTimeZone()).toBe("America/New_York");
    expect(getTimeZone()).toBe("America/Asuncion");
  });

  it("applies the statement timezone to column-mapped CSV files too", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    const body = {
      content: "Ticker,Action,Units,Cost,When\nEURUSD,buy,1,1.1,2026-07-05 04:00",
      mapping: {
        symbol: "Ticker",
        side: "Action",
        quantity: "Units",
        price: "Cost",
        timestamp: "When",
      },
    };
    const preview = await post({ ...body, mode: "preview" });
    expect(preview.executions[0].executedAt).toBe("2026-07-05T01:00:00.000Z");
    await post({ ...body, mode: "commit", accountId: "test" });
    expect(harness.db.select().from(executions).get()?.executedAt).toBe("2026-07-05T01:00:00.000Z");
  });

  it("honors explicit UTC offsets regardless of the statement timezone", async () => {
    await save({ importTimeZone: "America/Asuncion" });
    const content = html
      .replaceAll("2026.07.05 04:00", "2026-07-05T04:00:00+03:00")
      .replaceAll("2026.07.05 04:30", "2026-07-05T04:30:00+03:00");
    const preview = await post({ mode: "preview", content });
    expect(preview.executions[0].executedAt).toBe("2026-07-05T01:00:00.000Z");
  });

  it.each(["Mars/Olympus", "", null, 42, {}])(
    "rejects invalid zone %j before any setting or execution write",
    async (invalid) => {
      setSetting("timeZone", "Europe/Helsinki");
      expect((await save({ timeZone: "America/Asuncion", importTimeZone: invalid })).status).toBe(
        400,
      );
      expect((await save({ timeZone: invalid, importTimeZone: "UTC" })).status).toBe(400);
      expect(getTimeZone()).toBe("Europe/Helsinki");
      expect(getImportTimeZone()).toBe("Europe/Helsinki");
      for (const mode of ["preview", "commit"])
        expect(
          (
            await importFile(
              request("import", { mode, accountId: "test", content: html, timeZone: invalid }),
            )
          ).status,
        ).toBe(400);
      expect(harness.db.select().from(executions).all()).toHaveLength(0);
    },
  );

  it("aligns trade dates, execution times, analytics and journal/calendar days across midnight", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    await post({ mode: "commit", accountId: "test", content: html });
    const stored = harness.db.select().from(trades).get()!;
    const dashboard = await (await stats(request("stats?calYear=2026&calMonth=7"))).json();
    expect(dashboard.days[0].date).toBe("2026-07-04");
    expect(dashboard.buckets.hour.find((bucket: { trades: number }) => bucket.trades > 0).key).toBe(
      "22",
    );
    const days = await (await journal(request("journal"))).json();
    expect(days.days[0].date).toBe("2026-07-04");
    const month = await (await calendar(request("calendar?calYear=2026&calMonth=7"))).json();
    expect(
      month.calendar.weeks
        .flatMap((week: { days: Array<{ date: string; trades: number } | null> }) => week.days)
        .filter((day: { trades: number } | null) => day?.trades),
    ).toMatchObject([{ date: "2026-07-04" }]);
    const detail = await (
      await tradeDetail(request("trades/test"), { params: Promise.resolve({ key: stored.key }) })
    ).json();
    const listed = await (await listTrades(request("trades?view=list"))).json();
    expect(
      detail.executions
        .map((fill: { executedAt: string }) => formatTimestamp(fill.executedAt, detail.timeZone))
        .sort(),
    ).toEqual(["2026-07-04 22:00:00", "2026-07-04 22:30:00"]);
    expect(dayKeyOf(listed.trades[0].closedAt, listed.timeZone)).toBe("2026-07-04");
    expect(dayKeyOf(dashboard.recentTrades[0].closedAt, dashboard.timeZone)).toBe("2026-07-04");
    await save({ timeZone: "Europe/Helsinki", importTimeZone: "UTC" });
    expect(harness.db.select().from(trades).get()?.closedAt).toBe(stored.closedAt);
    expect((await (await journal(request("journal"))).json()).days[0].date).toBe("2026-07-05");
  });

  it("uses the journal's current month at the UTC month boundary", async () => {
    await save({ timeZone: "America/Asuncion" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-01T01:00:00Z"));
    const result = await (await stats(request("stats"))).json();
    expect(result.calendar).toMatchObject({ year: 2026, month: 7 });
  });

  it("returns and backs up both timezone settings", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    expect(await (await getSettings()).json()).toMatchObject({
      timeZone: "America/Asuncion",
      importTimeZone: "Europe/Helsinki",
    });
    expect((await (await exportData(request("export"))).json()).settings).toMatchObject({
      timeZone: "America/Asuncion",
      importTimeZone: "Europe/Helsinki",
    });
  });

  it("handles DST offsets, midnight and fractional-hour zones without the device timezone", () => {
    expect(formatTimestamp("2026-01-05T07:00:00Z", "Europe/Helsinki")).toBe("2026-01-05 09:00:00");
    expect(formatTimestamp("2026-07-05T06:00:00Z", "Europe/Helsinki")).toBe("2026-07-05 09:00:00");
    expect(formatTimestamp("2026-07-05T03:00:00Z", "America/Asuncion")).toBe("2026-07-05 00:00:00");
    expect(formatTimestamp("2026-07-05T00:00:00Z", "Asia/Kathmandu")).toBe("2026-07-05 05:45:00");
    expect(isTimeZone("Europe/Helsinki")).toBe(true);
    expect(isTimeZone(undefined)).toBe(false);
  });
});
