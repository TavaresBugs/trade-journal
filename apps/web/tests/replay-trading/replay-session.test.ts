import { describe, expect, it, afterEach } from "vitest";
import { GET, queryReplayCatalog } from "../../src/app/api/market-data/replay/route";
import {
  isFuturesOrEquitySymbol,
  filterCandlesBySession,
  snapTimeToCandle,
  type MarketHistory,
} from "../../src/lib/market-data";
import { estimateExcursions } from "../../src/lib/excursions";
import { replayFrame } from "../../src/lib/trade-replay";
import { calculateStrategyMetrics } from "@/components/replay/trading/replay-strategy-report";
import { PaperTradingEngine } from "@/lib/paper-trading/paper-engine";
import { type ClosedTrade } from "@/lib/paper-trading/types";

// --- Excursion and Replay Helpers ---
const start = Date.parse("2026-01-02T10:00:00Z");
const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
const fill = (minute: number, side: "buy" | "sell", quantity: number, price: number) => ({
  executedAt: at(minute),
  side,
  quantity,
  price,
});
const candle = (minute: number, low = 98, high = 104) => ({
  time: start + minute * 60_000,
  open: 100,
  high,
  low,
  close: 100,
  volume: 1,
});
const history = (bars = [candle(0), candle(1), candle(2)]): MarketHistory => ({
  provider: "Test",
  symbol: "TEST",
  resolution: "1m",
  fetchedAt: at(4),
  truncated: false,
  warnings: [],
  bars,
});
const trade = { direction: "long", openedAt: at(0), closedAt: at(3), assetClass: "equity" };

// --- Navigation Helpers ---
export function normalizeTradeTimestamp(
  timestamp: number,
  bars: Array<{ time: number }>
): { targetTime: number; isWithinHistory: boolean } {
  if (!bars.length || !timestamp) {
    return { targetTime: timestamp, isWithinHistory: false };
  }

  const isBarsMs = bars[0]!.time > 1e11;
  const isInputMs = timestamp > 1e11;

  let targetTime = timestamp;
  if (isBarsMs && !isInputMs) {
    targetTime = timestamp * 1000;
  } else if (!isBarsMs && isInputMs) {
    targetTime = Math.round(timestamp / 1000);
  }

  const firstTime = bars[0]!.time;
  const lastTime = bars[bars.length - 1]!.time;
  const isWithinHistory = targetTime >= firstTime && targetTime <= lastTime;

  return { targetTime, isWithinHistory };
}

export function calculateCenteredViewportOffset(
  logicalIndex: number,
  barCount: number,
  viewportWidth: number,
  barSpacing: number,
  spacingScale = 1
): number {
  const visibleBars = viewportWidth / (barSpacing * spacingScale);
  const rightOffset = logicalIndex - (barCount - 1) + visibleBars / 2;
  return Math.round(rightOffset * 100) / 100;
}

describe("Replay Catalog & API Endpoint", () => {
  it("queries distinct symbols and their resolutions from SQLite", () => {
    const catalog = queryReplayCatalog();
    expect(Array.isArray(catalog)).toBe(true);

    if (catalog.length > 0) {
      const first = catalog[0]!;
      expect(typeof first.symbol).toBe("string");
      expect(typeof first.totalBars).toBe("number");
      expect(Array.isArray(first.resolutions)).toBe(true);
      expect(first.resolutions.length).toBeGreaterThan(0);
      expect(typeof first.assetName).toBe("string");
      expect(typeof first.category).toBe("string");
    }
  });

  it("includes known symbols MES or US500 if imported", () => {
    const catalog = queryReplayCatalog();
    const symbols = catalog.map((c) => c.symbol);
    const hasKnown = symbols.some((s) => ["MES", "US500", "US100", "MNQ"].includes(s));
    expect(hasKnown).toBe(true);
  });

  it("returns default market data and symbols catalog when called with no query params", async () => {
    const req = new Request("http://localhost:3000/api/market-data/replay");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.symbol).toBeDefined();
    expect(Array.isArray(data.symbols)).toBe(true);
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(Array.isArray(data.bars)).toBe(true);
    expect(data.bars.length).toBeGreaterThan(0);
  });

  it("returns filtered candles for a specific symbol, resolution and limit", async () => {
    const req = new Request(
      "http://localhost:3000/api/market-data/replay?symbol=MES&resolution=1m&limit=100",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.symbol).toBe("MES");
    expect(data.resolution).toBe("1m");
    expect(Array.isArray(data.bars)).toBe(true);
    expect(data.bars.length).toBeLessThanOrEqual(100);

    // Verify candles are strictly sorted ascending by time
    for (let i = 1; i < data.bars.length; i++) {
      expect(data.bars[i].time).toBeGreaterThan(data.bars[i - 1].time);
    }
  });

  it("respects to cutoff parameter for historical replay slicing", async () => {
    const cutoff = 1791204300000; // 2026-10-05 12:45:00Z
    const req = new Request(
      `http://localhost:3000/api/market-data/replay?symbol=MES&resolution=1m&limit=50&to=${cutoff}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bars.length).toBeGreaterThan(0);
    const lastBar = data.bars[data.bars.length - 1];
    expect(lastBar.time).toBeLessThanOrEqual(cutoff);
  });
});

describe("isFuturesOrEquitySymbol & filterCandlesBySession", () => {
  it("identifies futures and equity symbols vs continuous 24x7 crypto", () => {
    // Futures and indices
    expect(isFuturesOrEquitySymbol("MES")).toBe(true);
    expect(isFuturesOrEquitySymbol("ES")).toBe(true);
    expect(isFuturesOrEquitySymbol("NQ")).toBe(true);
    expect(isFuturesOrEquitySymbol("MNQ")).toBe(true);
    expect(isFuturesOrEquitySymbol("US500")).toBe(true);
    expect(isFuturesOrEquitySymbol("US100")).toBe(true);
    expect(isFuturesOrEquitySymbol("CL")).toBe(true);
    expect(isFuturesOrEquitySymbol("GC")).toBe(true);

    // Equities
    expect(isFuturesOrEquitySymbol("AAPL")).toBe(true);
    expect(isFuturesOrEquitySymbol("TSLA")).toBe(true);

    // Crypto 24x7
    expect(isFuturesOrEquitySymbol("BTCUSDT")).toBe(false);
    expect(isFuturesOrEquitySymbol("ETHUSDT")).toBe(false);
    expect(isFuturesOrEquitySymbol("SOLUSDC")).toBe(false);
    expect(isFuturesOrEquitySymbol("BTC-PERP")).toBe(false);
    expect(isFuturesOrEquitySymbol("BTC")).toBe(false);
    expect(isFuturesOrEquitySymbol("ETH")).toBe(false);
    expect(isFuturesOrEquitySymbol("")).toBe(false);
  });

  it("retains all candles when session is extended", () => {
    const bars = [
      { time: Date.parse("2026-10-05T13:00:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 }, // 09:00 ET (pre)
      { time: Date.parse("2026-10-05T14:00:00Z"), open: 2, high: 3, low: 2, close: 3, volume: 10 }, // 10:00 ET (regular)
      { time: Date.parse("2026-10-05T20:30:00Z"), open: 3, high: 4, low: 3, close: 4, volume: 10 }, // 16:30 ET (post)
    ];

    const result = filterCandlesBySession(bars, "extended", "MES");
    expect(result.length).toBe(3);
  });

  it("filters out pre-market and post-market candles when session is regular", () => {
    const bars = [
      { time: Date.parse("2026-10-05T13:00:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 }, // 09:00 ET (pre)
      { time: Date.parse("2026-10-05T13:30:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 }, // 09:30 ET (regular open)
      { time: Date.parse("2026-10-05T15:00:00Z"), open: 2, high: 3, low: 2, close: 3, volume: 10 }, // 11:00 ET (regular)
      { time: Date.parse("2026-10-05T19:59:00Z"), open: 2, high: 3, low: 2, close: 3, volume: 10 }, // 15:59 ET (regular close)
      { time: Date.parse("2026-10-05T20:00:00Z"), open: 3, high: 4, low: 3, close: 4, volume: 10 }, // 16:00 ET (post-market)
      { time: Date.parse("2026-10-05T21:00:00Z"), open: 3, high: 4, low: 3, close: 4, volume: 10 }, // 17:00 ET (post)
    ];

    const result = filterCandlesBySession(bars, "regular", "MES");
    expect(result.length).toBe(3);
    expect(result.map((b: any) => b.time)).toEqual([
      Date.parse("2026-10-05T13:30:00Z"),
      Date.parse("2026-10-05T15:00:00Z"),
      Date.parse("2026-10-05T19:59:00Z"),
    ]);
  });

  it("does not filter crypto candles even in regular session mode", () => {
    const bars = [
      { time: Date.parse("2026-10-05T04:00:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { time: Date.parse("2026-10-05T13:00:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { time: Date.parse("2026-10-05T22:00:00Z"), open: 1, high: 2, low: 1, close: 2, volume: 10 },
    ];

    const result = filterCandlesBySession(bars, "regular", "BTCUSDT");
    expect(result.length).toBe(3);
  });
});

describe("gross position excursion estimates", () => {
  it("withholds misleading estimates when live market prices disagree with demo fills", () => {
    const fills = [fill(0, "buy", 10, 222), fill(3, "sell", 10, 221)];
    const data = history(
      [0, 1, 2].map((minute) => ({ ...candle(minute, 324, 326), open: 325, close: 325 })),
    );
    for (const confirmed of [true, false])
      expect(estimateExcursions(trade, fills, data, confirmed)).toMatchObject({
        mae: null,
        mfe: null,
        priceBasisMismatch: true,
      });
  });

  it("calculates long and short excursions with adverse values shown as positive magnitudes", () => {
    expect(
      estimateExcursions(
        trade,
        [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)],
        history(),
        true,
      ),
    ).toMatchObject({ mae: 20, mfe: 40, sampledBars: 3 });
    expect(
      estimateExcursions(
        { ...trade, direction: "short" },
        [fill(0, "sell", 10, 100), fill(3, "buy", 10, 102)],
        history(),
        true,
      ),
    ).toMatchObject({ mae: 40, mfe: 20 });
  });

  it("uses actual remaining exposure after partial exits, retaining realized P&L", () => {
    const fills = [fill(0, "buy", 10, 100), fill(1, "sell", 8, 102), fill(3, "sell", 2, 103)];
    expect(
      estimateExcursions(
        trade,
        fills,
        history([candle(0, 100, 102), candle(1, 90, 120), candle(2, 100, 103)]),
        true,
      ),
    ).toMatchObject({ mae: 4, mfe: 56 });
  });

  it("uses cash flows from scale-ins without applying the eventual size to earlier prices", () => {
    const fills = [fill(0, "buy", 2, 100), fill(1, "buy", 8, 110), fill(3, "sell", 10, 111)];
    expect(
      estimateExcursions(
        trade,
        fills,
        history([
          candle(0, 90, 110),
          { ...candle(1, 108, 115), open: 110, close: 110 },
          { ...candle(2, 108, 112), open: 110, close: 110 },
        ]),
        true,
      ),
    ).toMatchObject({ mae: 20, mfe: 70 });
  });

  it("excludes highs and lows from bars crossing an execution or trade boundary", () => {
    const fills = [fill(0.5, "buy", 10, 100), fill(1.5, "sell", 5, 100), fill(3, "sell", 5, 100)];
    expect(
      estimateExcursions(
        { ...trade, openedAt: at(0.5) },
        fills,
        history([candle(0, 1, 999), candle(1, 1, 999), candle(2, 99, 102)]),
        true,
      ),
    ).toMatchObject({ mae: 5, mfe: 10, sampledBars: 1, excludedBars: 2 });
  });

  it("withholds numbers for absent, truncated, unconfirmed, or uncovered data", () => {
    const fills = [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)];
    for (const data of [
      history([]),
      history([candle(1), candle(2)]),
      history([candle(0)]),
      { ...history(), truncated: true },
    ])
      expect(estimateExcursions(trade, fills, data, true).mae).toBeNull();
    expect(estimateExcursions(trade, fills, history(), false).mfe).toBeNull();
    expect(estimateExcursions({ ...trade, closedAt: null }, fills, history(), true).mfe).toBeNull();
  });

  it("requires derivative multipliers and applies configured multipliers", () => {
    const fills = [fill(0, "buy", 1, 100), fill(3, "sell", 1, 102)];
    expect(
      estimateExcursions({ ...trade, assetClass: "futures" }, fills, history(), true).mae,
    ).toBeNull();
    expect(
      estimateExcursions(
        { ...trade, assetClass: "futures", contractMultiplier: 50 },
        fills,
        history(),
        true,
      ),
    ).toMatchObject({ mae: 100, mfe: 200 });
  });

  it("does not treat a reversal spanning two trade cycles as one closed position", () => {
    expect(
      estimateExcursions(
        trade,
        [fill(0, "buy", 10, 100), fill(3, "sell", 15, 102)],
        history(),
        true,
      ).mae,
    ).toBeNull();
  });

  it("reports internal gaps and refuses fill-only estimates", () => {
    const fills = [fill(0, "buy", 10, 100), fill(3, "sell", 10, 102)];
    expect(
      estimateExcursions(trade, fills, history([candle(0), candle(2)]), true).warnings.join(" "),
    ).toContain("gaps");
    expect(
      estimateExcursions(
        { ...trade, openedAt: at(0.2), closedAt: at(0.8) },
        [fill(0.2, "buy", 1, 100), fill(0.8, "sell", 1, 101)],
        history([candle(0)]),
        true,
      ).mae,
    ).toBeNull();
  });
});

describe("replay without future chart data", () => {
  it("reveals only completed candles and executions through the cursor, and rewinds", () => {
    const fills = [fill(0.5, "buy", 10, 100), fill(2.5, "sell", 10, 102)];
    const first = replayFrame(history(), fills, 1);
    expect(first.bars).toHaveLength(1);
    expect(first.fills).toEqual([fills[0]]);
    expect(replayFrame(history(), fills, 3).fills).toHaveLength(2);
    expect(replayFrame(history(), fills, 1).fills).toHaveLength(1);
    expect(replayFrame(history(), fills, 0).fills).toHaveLength(0);
  });
});

describe("Replay Strategy Report Metrics Calculations", () => {
  it("handles empty trades gracefully with zeroed metrics", () => {
    const metrics = calculateStrategyMetrics([], 100000);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.netProfit).toBe(0);
    expect(metrics.netProfitPercent).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
    expect(metrics.maxDrawdownPercent).toBe(0);
    expect(metrics.equityPoints).toHaveLength(1);
    expect(metrics.equityPoints[0]!.equity).toBe(100000);
  });

  it("calculates exact metrics for sequence of winning, losing, and breakeven trades", () => {
    const mockTrades: ClosedTrade[] = [
      {
        id: "t1",
        tradeNumber: 1,
        symbol: "MNQ",
        side: "long",
        entryTime: 1700000000000,
        exitTime: 1700000060000,
        entryPrice: 20000,
        exitPrice: 20050,
        qty: 2,
        profit: 200, // $200 win
        profitPercent: 0.25,
        cumProfit: 200,
        signal: "Take Profit",
      },
      {
        id: "t2",
        tradeNumber: 2,
        symbol: "MNQ",
        side: "long",
        entryTime: 1700000100000,
        exitTime: 1700000160000,
        entryPrice: 20050,
        exitPrice: 20025,
        qty: 1,
        profit: -50, // $50 loss
        profitPercent: -0.12,
        cumProfit: 150,
        signal: "Stop Loss",
      },
      {
        id: "t3",
        tradeNumber: 3,
        symbol: "MNQ",
        side: "short",
        entryTime: 1700000200000,
        exitTime: 1700000260000,
        entryPrice: 20025,
        exitPrice: 20000,
        qty: 1,
        profit: 50, // $50 win
        profitPercent: 0.12,
        cumProfit: 200,
        signal: "Take Profit",
      },
      {
        id: "t4",
        tradeNumber: 4,
        symbol: "MNQ",
        side: "long",
        entryTime: 1700000300000,
        exitTime: 1700000360000,
        entryPrice: 20000,
        exitPrice: 20000,
        qty: 1,
        profit: 0, // breakeven
        profitPercent: 0,
        cumProfit: 200,
        signal: "Exit",
      },
    ];

    const metrics = calculateStrategyMetrics(mockTrades, 100000);

    // Total Closed Trades: 4
    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTradesCount).toBe(2);
    expect(metrics.losingTradesCount).toBe(1);
    expect(metrics.evenTradesCount).toBe(1);

    // Win Rate: 2 wins / 4 total = 50.0%
    expect(metrics.winRate).toBe(50);

    // Net Profit: 200 - 50 + 50 + 0 = 200 USD
    expect(metrics.netProfit).toBe(200);
    expect(metrics.netProfitPercent).toBeCloseTo(0.2, 2);

    // Gross Profit: 200 + 50 = 250 USD
    expect(metrics.grossProfit).toBe(250);

    // Gross Loss: 50 USD
    expect(metrics.grossLoss).toBe(50);

    // Profit Factor: 250 / 50 = 5.0
    expect(metrics.profitFactor).toBe(5);

    // Max Drawdown: Peak after trade 1 was +200, then dropped to +150 -> Max DD = $50
    expect(metrics.maxDrawdown).toBe(50);
    expect(metrics.maxDrawdownPercent).toBeCloseTo((50 / 100200) * 100, 3);

    // Averages:
    expect(metrics.avgTrade).toBe(50); // 200 / 4
    expect(metrics.avgWin).toBe(125); // 250 / 2
    expect(metrics.avgLoss).toBe(50); // 50 / 1
    expect(metrics.winLossRatio).toBe(2.5); // 125 / 50
    expect(metrics.largestWin).toBe(200);
    expect(metrics.largestLoss).toBe(-50);

    // Equity Curve points
    expect(metrics.equityPoints).toHaveLength(5);
    expect(metrics.equityPoints[0]!.equity).toBe(100000);
    expect(metrics.equityPoints[1]!.equity).toBe(100200);
    expect(metrics.equityPoints[2]!.equity).toBe(100150);
    expect(metrics.equityPoints[3]!.equity).toBe(100200);
    expect(metrics.equityPoints[4]!.equity).toBe(100200);
  });

  it("calculates accurate Max Drawdown across multiple peaks and valleys", () => {
    const sequenceTrades: ClosedTrade[] = [
      { id: "1", tradeNumber: 1, symbol: "ES", side: "long", entryTime: 1, exitTime: 2, entryPrice: 5000, exitPrice: 5010, qty: 1, profit: 500, profitPercent: 0.1, cumProfit: 500 },
      { id: "2", tradeNumber: 2, symbol: "ES", side: "long", entryTime: 3, exitTime: 4, entryPrice: 5010, exitPrice: 4990, qty: 1, profit: -1000, profitPercent: -0.2, cumProfit: -500 },
      { id: "3", tradeNumber: 3, symbol: "ES", side: "long", entryTime: 5, exitTime: 6, entryPrice: 4990, exitPrice: 5050, qty: 1, profit: 3000, profitPercent: 0.6, cumProfit: 2500 },
      { id: "4", tradeNumber: 4, symbol: "ES", side: "long", entryTime: 7, exitTime: 8, entryPrice: 5050, exitPrice: 5020, qty: 1, profit: -1500, profitPercent: -0.3, cumProfit: 1000 },
      { id: "5", tradeNumber: 5, symbol: "ES", side: "long", entryTime: 9, exitTime: 10, entryPrice: 5020, exitPrice: 5010, qty: 1, profit: -500, profitPercent: -0.1, cumProfit: 500 },
    ];

    const metrics = calculateStrategyMetrics(sequenceTrades, 100000);
    expect(metrics.maxDrawdown).toBe(2000);
    expect(metrics.netProfit).toBe(500);
    expect(metrics.longestWinStreak).toBe(1);
    expect(metrics.longestLossStreak).toBe(2);
  });

  it("calculates signal/side breakdown, streaks, time patterns, and 12-month results", () => {
    const trades: ClosedTrade[] = [
      {
        id: "a1",
        tradeNumber: 1,
        symbol: "NQ",
        side: "long",
        entryTime: Date.UTC(2026, 2, 11, 14, 0, 0), // March (index 2), Wednesday, 14:00 UTC
        exitTime: Date.UTC(2026, 2, 11, 15, 30, 0), // 1h 30m duration
        entryPrice: 20000,
        exitPrice: 20100,
        qty: 1,
        profit: 2000,
        profitPercent: 2.0,
        cumProfit: 2000,
        signal: "Buy market order",
      },
      {
        id: "a2",
        tradeNumber: 2,
        symbol: "NQ",
        side: "long",
        entryTime: Date.UTC(2026, 2, 18, 14, 0, 0), // March, Wednesday, 14:00 UTC
        exitTime: Date.UTC(2026, 2, 18, 14, 30, 0), // 30m duration
        entryPrice: 20100,
        exitPrice: 20150,
        qty: 1,
        profit: 1000,
        profitPercent: 1.0,
        cumProfit: 3000,
        signal: "Buy market order",
      },
      {
        id: "a3",
        tradeNumber: 3,
        symbol: "NQ",
        side: "short",
        entryTime: Date.UTC(2026, 4, 5, 10, 0, 0), // May (index 4), Tuesday, 10:00 UTC
        exitTime: Date.UTC(2026, 4, 5, 11, 0, 0), // 1h duration
        entryPrice: 20150,
        exitPrice: 20190,
        qty: 1,
        profit: -800,
        profitPercent: -0.8,
        cumProfit: 2200,
        signal: "Sell market order",
      },
    ];

    const m = calculateStrategyMetrics(trades, 100000);
    expect(m.longestWinStreak).toBe(2);
    expect(m.longestLossStreak).toBe(1);
    expect(m.bestHourForEntries).toBe("14:00");
    expect(m.bestDayForEntries).toBe("Wednesday");
    expect(m.bestMonthForEntries).toBe("March");
    expect(m.avgTradeDuration).toBe("1h");
    expect(m.monthlyResults).toHaveLength(12);
    expect(m.monthlyResults[2]!.month).toBe("Mar");
    expect(m.monthlyResults[2]!.winners).toBe(2);
    expect(m.monthlyResults[4]!.month).toBe("May");
    expect(m.monthlyResults[4]!.losers).toBe(1);
    expect(m.bySignals.all.netProfit).toBe(2200);
    expect(m.bySignals.buyMarket.netProfit).toBe(3000);
    expect(m.bySignals.sellMarket.netProfit).toBe(-800);
    expect(m.bySide.long.netProfit).toBe(3000);
    expect(m.bySide.short.netProfit).toBe(-800);
  });
});

describe("PaperTradingEngine Replay Backtest Integration", () => {
  it("produces valid ClosedTrades fed into calculateStrategyMetrics during simulated Replay session", () => {
    const engine = new PaperTradingEngine({ persistKey: null, initialBalance: 100000 });

    // 1. Enter Replay Long MNQ 2 contracts at 20000
    engine.onTick("MNQ", 20000);
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    // 2. Bar replay moves forward to 20040 (+40 pts = +$160 for 2 contracts)
    engine.onTick("MNQ", 20040);
    // Partially take profit: 1 contract
    engine.closePosition("MNQ", 1);

    // 3. Bar replay pulls back to 20010 (+10 pts = +$20 for 1 contract)
    engine.onTick("MNQ", 20010);
    engine.closePosition("MNQ", 1);

    // 4. Enter Replay Short 1 contract at 20010
    engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "market",
      qty: 1,
      price: 20010,
    });

    // 5. Short stopped out at 20030 (-20 pts = -$40)
    engine.onTick("MNQ", 20030);
    engine.closePosition("MNQ", 1);

    const closedTrades = engine.getClosedTrades();
    expect(closedTrades).toHaveLength(3);

    const reportMetrics = calculateStrategyMetrics(closedTrades, 100000);

    expect(reportMetrics.totalTrades).toBe(3);
    expect(reportMetrics.winningTradesCount).toBe(2);
    expect(reportMetrics.losingTradesCount).toBe(1);
    expect(reportMetrics.winRate).toBeCloseTo(66.67, 1);
    // Net profit: +80 + 20 - 40 = +$60
    expect(reportMetrics.netProfit).toBe(60);
    expect(reportMetrics.grossProfit).toBe(100);
    expect(reportMetrics.grossLoss).toBe(40);
    expect(reportMetrics.profitFactor).toBe(2.5);
  });
});

describe("Replay Trades Navigation & GoToTrade Suite", () => {
  const sampleBarsMs = [
    { time: 1728738000000 }, // 13:00:00Z
    { time: 1728738300000 }, // 13:05:00Z
    { time: 1728738600000 }, // 13:10:00Z
    { time: 1728738900000 }, // 13:15:00Z
    { time: 1728739200000 }, // 13:20:00Z
    { time: 1728739500000 }, // 13:25:00Z
  ];

  it("normalizes seconds timestamps to milliseconds when bars are in milliseconds", () => {
    // 13:06:00 in seconds
    const timestampSec = 1728738360;
    const { targetTime, isWithinHistory } = normalizeTradeTimestamp(timestampSec, sampleBarsMs);

    expect(targetTime).toBe(1728738360000);
    expect(isWithinHistory).toBe(true);
  });

  it("keeps milliseconds timestamp intact when bars are in milliseconds", () => {
    const timestampMs = 1728738360000;
    const { targetTime, isWithinHistory } = normalizeTradeTimestamp(timestampMs, sampleBarsMs);

    expect(targetTime).toBe(1728738360000);
    expect(isWithinHistory).toBe(true);
  });

  it("detects timestamps strictly outside loaded chart history", () => {
    // 1 hour before first bar
    const beforeTime = 1728734400000;
    const resBefore = normalizeTradeTimestamp(beforeTime, sampleBarsMs);
    expect(resBefore.isWithinHistory).toBe(false);

    // 1 hour after last bar
    const afterTime = 1728743100000;
    const resAfter = normalizeTradeTimestamp(afterTime, sampleBarsMs);
    expect(resAfter.isWithinHistory).toBe(false);
  });

  it("snaps execution timestamp to correct enclosing candle open", () => {
    // Execution at 13:06:23 inside the 13:05-13:10 5m bar
    const executionTimeMs = 1728738300000 + 83_000;
    const snapped = snapTimeToCandle(executionTimeMs, sampleBarsMs);

    expect(snapped).toBe(1728738300000); // Exactly 13:05:00 bar open
  });

  it("calculates exact rightOffset to center candle horizontally on chart", () => {
    const offset = calculateCenteredViewportOffset(500, 1000, 1200, 6, 1);
    expect(offset).toBe(-399);

    const rightEdgeLogical = 1000 - 1 + offset; // 600
    const pixelDistanceToRight = (rightEdgeLogical - 500) * 6; // 100 * 6 = 600px
    const pixelPosition = 1200 - pixelDistanceToRight; // 600px
    expect(pixelPosition).toBe(600);
  });

  it("handles ClosedTrade contract with entry and exit navigation timestamps", () => {
    const trade: ClosedTrade = {
      id: "trade-123",
      tradeNumber: 1,
      symbol: "MNQ",
      side: "long",
      entryTime: 1728738360000, // 13:06:00
      exitTime: 1728739380000,  // 13:23:00
      entryPrice: 20000,
      exitPrice: 20050,
      qty: 2,
      profit: 200,
      profitPercent: 0.25,
      cumProfit: 200,
      signal: "Market Buy",
    };

    // Entry navigates to 13:05 bar
    const entrySnapped = snapTimeToCandle(trade.entryTime, sampleBarsMs);
    expect(entrySnapped).toBe(1728738300000); // 13:05:00

    // Exit navigates to 13:20 bar
    const exitSnapped = snapTimeToCandle(trade.exitTime, sampleBarsMs);
    expect(exitSnapped).toBe(1728739200000); // 13:20:00
  });

  describe("snapTimeToCandle Multi-Resolution Parity (4H, Daily, Weekly & Edge Cases)", () => {
    const bars4h = [
      { time: 1791165600000 }, // 2026-10-05 02:00:00Z
      { time: 1791180000000 }, // 2026-10-05 06:00:00Z
      { time: 1791194400000 }, // 2026-10-05 10:00:00Z (covers 10:00:00Z to 14:00:00Z)
      { time: 1791208800000 }, // 2026-10-05 14:00:00Z
      { time: 1791223200000 }, // 2026-10-05 18:00:00Z
    ];

    it("snaps an execution inside a 4H candle to that 4H candle open rather than interpolating to next bar", () => {
      const fillTime = 1791204300000;
      const snapped = snapTimeToCandle(fillTime, bars4h);
      expect(snapped).toBe(1791194400000); // 10:00:00Z
    });

    const bars1d = [
      { time: 1791151200000 }, // 2026-10-04 22:00:00Z
      { time: 1791237600000 }, // 2026-10-05 22:00:00Z
    ];

    it("snaps intraday executions to the CME daily session candle open", () => {
      const fillTime = 1791204300000;
      const snapped = snapTimeToCandle(fillTime, bars1d);
      expect(snapped).toBe(1791151200000); // 2026-10-04 22:00:00Z
    });

    const bars1w = [
      { time: 1790546400000 }, // 2026-09-27 22:00:00Z
      { time: 1791151200000 }, // 2026-10-04 22:00:00Z
    ];

    it("snaps trades to the weekly candle open", () => {
      const fillTime = 1791204300000;
      const snapped = snapTimeToCandle(fillTime, bars1w);
      expect(snapped).toBe(1791151200000); // 2026-10-04 22:00:00Z
    });

    it("handles edge cases: empty bars, undefined bars, and out-of-range times", () => {
      const fillTime = 1791204300000;
      expect(snapTimeToCandle(fillTime, [])).toBe(fillTime);
      expect(snapTimeToCandle(fillTime, undefined)).toBe(fillTime);

      const wayEarly = 1000000000000;
      expect(snapTimeToCandle(wayEarly, bars4h)).toBe(wayEarly);

      const latestBar = bars4h[bars4h.length - 1]!;
      expect(snapTimeToCandle(latestBar.time + 3600_000, bars4h)).toBe(latestBar.time);
    });
  });
});

