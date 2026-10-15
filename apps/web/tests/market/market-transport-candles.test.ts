import { createMarketTransport, marketTransport } from "../../src/server/market-data/transport";
import { londonStrategicEdge, parseLseBars } from "../../src/server/market-data/london-strategic-edge";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-candles-time-series-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, marketCandles, marketCandleBatches, marketSeriesSummary } = await import("../../src/db");
const {
  ingestCandles,
  revertCandleBatch,
  purgeCandlesBySymbol,
  candleSeriesSummary,
  candleBatches,
  marketCsv,
} = await import("../../src/server/market-data/csv");
const { GET: listCsv, POST: csvRequest } = await import("../../src/app/api/market-data/csv/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/market-data/csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Time-Series Candle Database Engine", () => {
  // Base time: 2025-01-02 14:30:00 UTC = 1735828200000 (epoch ms)
  const baseTime = 1735828200; // 10-digit unix seconds
  const resolutionMs = 300_000; // 5m

  // Batch 1: 5 candles (0m, 5m, 10m, 15m, 20m)
  const batch1Content = `timestamp,open,high,low,close,volume
${baseTime},5000,5010,4990,5005,100
${baseTime + 300},5005,5015,5000,5010,110
${baseTime + 600},5010,5020,5005,5015,120
${baseTime + 900},5015,5025,5010,5020,130
${baseTime + 1200},5020,5030,5015,5025,140`;

  // Batch 2: 5 candles (3 overlapping: 10m, 15m, 20m + 2 new: 25m, 30m)
  const batch2Content = `timestamp,open,high,low,close,volume
${baseTime + 600},5010,5020,5005,5015,120
${baseTime + 900},5015,5025,5010,5020,130
${baseTime + 1200},5020,5030,5015,5025,140
${baseTime + 1500},5025,5035,5020,5030,150
${baseTime + 1800},5030,5040,5025,5035,160`;

  let batch1Id: string;
  let batch2Id: string;

  it("ingests initial batch with ON CONFLICT DO NOTHING and updates catalog summary", () => {
    const res = ingestCandles({
      name: "MES_batch1.csv",
      symbol: "MES",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: batch1Content,
    });

    batch1Id = res.batchId;
    expect(res.newBarCount).toBe(5);
    expect(res.duplicateBarCount).toBe(0);
    expect(res.totalInDb).toBe(5);

    // Verify market_candles
    const candles = db.select().from(marketCandles).all();
    expect(candles).toHaveLength(5);
    expect(candles[0]).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      time: baseTime * 1000,
      open: 5000,
      close: 5005,
      volume: 100,
      batchId: batch1Id,
    });

    // Verify market_candle_batches
    const batches = db.select().from(marketCandleBatches).all();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      id: batch1Id,
      symbol: "MES",
      resolution: "5m",
      name: "MES_batch1.csv",
      barCount: 5,
      newBarCount: 5,
      duplicateBarCount: 0,
      firstTime: baseTime * 1000,
      lastTime: (baseTime + 1200) * 1000,
    });

    // Verify market_series_summary
    const summaries = db.select().from(marketSeriesSummary).all();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      barCount: 5,
      firstTime: baseTime * 1000,
      lastTime: (baseTime + 1200) * 1000,
      currency: "USD",
      priceBasis: "raw",
    });
  });

  it("handles incremental addition without duplicating existing bars", () => {
    const res = ingestCandles({
      name: "MES_batch2.csv",
      symbol: "MES",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: batch2Content,
    });

    batch2Id = res.batchId;
    expect(res.newBarCount).toBe(2);
    expect(res.duplicateBarCount).toBe(3);
    expect(res.totalInDb).toBe(7);

    // Total rows in market_candles must be exactly 7
    const allCandles = db.select().from(marketCandles).all();
    expect(allCandles).toHaveLength(7);

    // Series summary should reflect 7 bars with extended lastTime
    const summary = db.select().from(marketSeriesSummary).all()[0];
    expect(summary).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      barCount: 7,
      firstTime: baseTime * 1000,
      lastTime: (baseTime + 1800) * 1000,
    });

    // Re-ingest exact same content as batch 1; 0 new bars, 5 duplicates
    const resDuplicate = ingestCandles({
      name: "MES_batch1_dup.csv",
      symbol: "MES",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: batch1Content,
    });

    expect(resDuplicate.newBarCount).toBe(0);
    expect(resDuplicate.duplicateBarCount).toBe(5);
    expect(resDuplicate.totalInDb).toBe(7);
    expect(db.select().from(marketCandles).all()).toHaveLength(7);
  });

  it("executes continuous queries across multiple batches without dataset collision errors", async () => {
    // Range spanning from batch 1 (0m) to batch 2 (30m)
    const history = await marketCsv.history(
      {
        symbol: "MES",
        resolution: "5m",
        from: baseTime * 1000,
        to: (baseTime + 2100) * 1000,
      },
      "",
    );

    expect(history.bars).toHaveLength(7);
    expect(history.bars[0]!.open).toBe(5000);
    expect(history.bars[6]!.close).toBe(5035);
    expect(history.warnings[0]).toContain("MES");

    // Check chronological ordering
    for (let i = 1; i < history.bars.length; i++) {
      expect(history.bars[i]!.time).toBeGreaterThan(history.bars[i - 1]!.time);
    }
  });

  it("reverts a specific batch and recalculates series summary correctly", () => {
    const revertResult = revertCandleBatch(batch2Id);
    expect(revertResult.batchId).toBe(batch2Id);
    expect(revertResult.remainingInDb).toBe(5);

    // market_candles now only contains the 5 bars from batch 1
    const candles = db.select().from(marketCandles).all();
    expect(candles).toHaveLength(5);
    expect(candles.every((c) => c.batchId === batch1Id)).toBe(true);

    // Summary reflects remaining 5 bars
    const summary = db.select().from(marketSeriesSummary).all()[0];
    expect(summary).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      barCount: 5,
      firstTime: baseTime * 1000,
      lastTime: (baseTime + 1200) * 1000,
    });

    // Batches list no longer includes batch 2
    const batches = db.select().from(marketCandleBatches).all();
    expect(batches.some((b) => b.id === batch2Id)).toBe(false);
  });

  it("retains shared candles covered by subsequent batches when reverting earlier overlapping batch", () => {
    // Symbol: OVL
    const t0 = 1735828200; // C1: 0m
    const t1 = t0 + 300;   // C2: 5m
    const t2 = t0 + 600;   // C3: 10m
    const t3 = t0 + 900;   // C4: 15m

    // Batch 1: C1, C2, C3
    const b1Content = `timestamp,open,high,low,close\n${t0},10,12,9,11\n${t1},11,13,10,12\n${t2},12,14,11,13`;
    // Batch 2: C2, C3, C4
    const b2Content = `timestamp,open,high,low,close\n${t1},11,13,10,12\n${t2},12,14,11,13\n${t3},13,15,12,14`;

    const b1 = ingestCandles({
      name: "ovl_b1.csv",
      symbol: "OVL",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: b1Content,
    });
    const b2 = ingestCandles({
      name: "ovl_b2.csv",
      symbol: "OVL",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: b2Content,
    });

    expect(b1.newBarCount).toBe(3);
    expect(b2.newBarCount).toBe(1); // C4 is new
    expect(b2.duplicateBarCount).toBe(2); // C2, C3 are duplicates

    // Total rows initially: 4 (C1, C2, C3, C4)
    expect(
      db.select().from(marketCandles).where(eq(marketCandles.symbol, "OVL")).all(),
    ).toHaveLength(4);

    // Revert Batch 1: C1 is exclusive to Batch 1 and must be deleted.
    // C2 and C3 overlap with Batch 2 and must NOT be lost!
    const revertB1 = revertCandleBatch(b1.batchId);
    expect(revertB1.remainingInDb).toBe(3);

    // Verify remaining candles in database: C2, C3, C4
    const remainingCandles = db
      .select()
      .from(marketCandles)
      .where(eq(marketCandles.symbol, "OVL"))
      .all();
    expect(remainingCandles).toHaveLength(3);

    const times = remainingCandles.map((c) => c.time).sort((a, b) => a - b);
    expect(times).toEqual([t1 * 1000, t2 * 1000, t3 * 1000]);

    // All retained candles are now re-stamped to Batch 2
    expect(remainingCandles.every((c) => c.batchId === b2.batchId)).toBe(true);

    // Summary must reflect C2..C4
    const summary = db
      .select()
      .from(marketSeriesSummary)
      .where(eq(marketSeriesSummary.symbol, "OVL"))
      .get();
    expect(summary).toMatchObject({
      symbol: "OVL",
      barCount: 3,
      firstTime: t1 * 1000,
      lastTime: t3 * 1000,
    });

    // Clean up OVL
    purgeCandlesBySymbol("OVL");
  });

  it("purges candles by symbol and resolution cleanly", () => {
    // Add another symbol NQ
    const nqContent = `timestamp,open,high,low,close\n${baseTime},20000,20050,19950,20020`;
    ingestCandles({
      name: "NQ.csv",
      symbol: "NQ",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: nqContent,
    });

    expect(candleSeriesSummary().some((s) => s.symbol === "NQ")).toBe(true);

    // Purge MES 5m
    purgeCandlesBySymbol("MES", "5m");
    const summariesAfterMes = candleSeriesSummary();
    expect(summariesAfterMes.some((s) => s.symbol === "MES")).toBe(false);
    expect(summariesAfterMes.some((s) => s.symbol === "NQ")).toBe(true);

    // Purge all NQ
    purgeCandlesBySymbol("NQ");
    const summariesAfterNq = candleSeriesSummary();
    expect(summariesAfterNq).toHaveLength(0);
  });

  it("exposes series summary and recent batches via HTTP API route", async () => {
    // Import via route
    const importRes = await (
      await csvRequest(
        request({
          action: "import",
          name: "API_MES.csv",
          symbol: "MES",
          resolution: "5m",
          currency: "USD",
          priceBasis: "raw",
          content: batch1Content,
        }),
      )
    ).json();

    expect(importRes.result).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      newBarCount: 5,
      totalInDb: 5,
    });
    expect(importRes.series).toHaveLength(1);
    expect(importRes.batches).toHaveLength(1);

    // GET endpoint returns series, batches, datasets, tradedSymbols
    const getRes = await (await listCsv()).json();
    expect(getRes.series[0]).toMatchObject({
      symbol: "MES",
      resolution: "5m",
      barCount: 5,
    });
    expect(getRes.batches[0]).toMatchObject({
      name: "API_MES.csv",
      symbol: "MES",
    });

    // Revert batch via route
    const revertRes = await (
      await csvRequest(
        request({
          action: "revert_batch",
          batchId: importRes.id,
        }),
      )
    ).json();

    expect(revertRes.reverted.remainingInDb).toBe(0);
    expect(revertRes.series).toHaveLength(0);

    // Import again then purge symbol via route
    await csvRequest(
      request({
        action: "import",
        name: "API_MES.csv",
        symbol: "MES",
        resolution: "5m",
        currency: "USD",
        priceBasis: "raw",
        content: batch1Content,
      }),
    );

    const purgeRes = await (
      await csvRequest(
        request({
          action: "purge_symbol",
          symbol: "MES",
          resolution: "5m",
        }),
      )
    ).json();

    expect(purgeRes.purged).toEqual({ symbol: "MES", resolution: "5m" });
    expect(purgeRes.series).toHaveLength(0);
  });

  it("imports high-timeframe 1d and 4h series via HTTP API route without alignment errors", async () => {
    // Daily CME candles with 22:00 UTC open
    const dailyCsv = `timestamp,datetime_utc,open,high,low,close,volume
1790546400,2026-09-27 22:00:00,7795.75,7803.25,7726.0,7746.75,1207911
1790632800,2026-09-28 22:00:00,7746.75,7767.75,7712.25,7732.0,1102389
1790719200,2026-09-29 22:00:00,7739.0,7782.25,7705.5,7715.5,1166971`;

    const res1d = await (
      await csvRequest(
        request({
          action: "import",
          name: "MES1_1d_websocket.csv",
          symbol: "MES",
          resolution: "1d",
          currency: "USD",
          priceBasis: "raw",
          content: dailyCsv,
        }),
      )
    ).json();

    expect(res1d.result.newBarCount).toBe(3);
    expect(res1d.result.resolution).toBe("1d");

    // 4h CME candles across Daylight Saving Time shift
    const fourHourCsv = `time,open,high,low,close,volume
2023-11-03T18:00:00Z,4450.0,4460.0,4445.0,4455.0,10000
2023-11-03T22:00:00Z,4455.0,4465.0,4450.0,4460.0,12000
2023-11-05T23:00:00Z,4460.0,4470.0,4455.0,4465.0,15000
2023-11-06T03:00:00Z,4465.0,4475.0,4460.0,4470.0,14000`;

    const res4h = await (
      await csvRequest(
        request({
          action: "import",
          name: "MES1_4h_websocket.csv",
          symbol: "MES",
          resolution: "4h",
          currency: "USD",
          priceBasis: "raw",
          content: fourHourCsv,
        }),
      )
    ).json();

    expect(res4h.result.newBarCount).toBe(4);
    expect(res4h.result.resolution).toBe("4h");
  });

  afterAll(() => {
    db.$client.close();
    if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
    else process.env.JOURNAL_DATA_DIR = previousDir;
    rmSync(scratch, { recursive: true, force: true });
  });
});


// ============================================================================
// BOUNDED MARKET TRANSPORT
// ============================================================================

const url = "https://example.test/candles?end=2025-01-01";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("bounded market transport", () => {
  it("shares simultaneous and repeated history while isolating credentials and feeds", async () => {
    const transport = createMarketTransport({ minIntervalMs: 0 });
    const fetcher = vi.fn(async () => Response.json([{ close: 100 }]));
    vi.stubGlobal("fetch", fetcher);
    const replies = await Promise.all(
      Array.from({ length: 20 }, () => transport.read(url, { key: "one" })),
    );
    expect(replies).toHaveLength(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await transport.read(url, { key: "one" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await transport.read(url, { key: "two" });
    await transport.read(url + "&feed=other", { key: "one" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("does not let one subscriber cancel another, but aborts when all leave", async () => {
    const transport = createMarketTransport({ minIntervalMs: 0 });
    let complete!: () => void;
    let upstream!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        upstream = init.signal;
        return new Promise<Response>((resolve, reject) => {
          complete = () => resolve(Response.json({ ok: true }));
          upstream.addEventListener("abort", () => reject(upstream.reason));
        });
      }),
    );
    const a = new AbortController(),
      b = new AbortController();
    const first = transport.read(url, {}, a.signal);
    const second = transport.read(url, {}, b.signal);
    const rejected = expect(first).rejects.toThrow();
    a.abort();
    await rejected;
    expect(upstream.aborted).toBe(false);
    complete();
    expect(await second).toEqual({ ok: true });
    const third = transport.read(url + "&new=1", {}, b.signal);
    const cancelled = expect(third).rejects.toThrow();
    b.abort();
    await cancelled;
    expect(upstream.aborted).toBe(true);
  });
  it("caps per-host and total requests and cancels queued work before fetch", async () => {
    const transport = createMarketTransport({ minIntervalMs: 0 });
    let active = 0,
      peak = 0;
    const perHost = new Map<string, number>();
    const fetcher = vi.fn(async (address: string) => {
      const host = new URL(address).host;
      active++;
      peak = Math.max(peak, active);
      perHost.set(host, (perHost.get(host) ?? 0) + 1);
      expect(perHost.get(host)).toBeLessThanOrEqual(2);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      perHost.set(host, perHost.get(host)! - 1);
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const work = Array.from({ length: 20 }, (_, i) =>
      transport.read(`https://host${i % 4}.test/${i}`),
    );
    const controller = new AbortController();
    const queued = transport.read("https://host0.test/cancelled", {}, controller.signal);
    const cancelled = expect(queued).rejects.toThrow();
    controller.abort();
    await cancelled;
    await Promise.all(work);
    expect(peak).toBe(6);
    expect(fetcher).toHaveBeenCalledTimes(20);
  });
  it("expires old and recent data and bypasses cache for connection tests", async () => {
    vi.useFakeTimers();
    const transport = createMarketTransport({ minIntervalMs: 0 });
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await transport.read(url);
    await transport.read(url, {}, undefined, { cache: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300_001);
    await transport.read(url);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const recent = "https://example.test/latest";
    await transport.read(recent);
    await vi.advanceTimersByTimeAsync(15_001);
    await transport.read(recent);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("does not cache failures and honors Retry-After across requests with the same credential", async () => {
    vi.useFakeTimers();
    const transport = createMarketTransport({ minIntervalMs: 0 });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
      .mockImplementation(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await expect(transport.read(url)).rejects.toThrow("500");
    await expect(transport.read(url)).rejects.toThrow("rate limit");
    await expect(transport.read(url + "&other=1")).rejects.toThrow("rate limit");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await transport.read(url, { key: "different" });
    await vi.advanceTimersByTimeAsync(2001);
    await transport.read(url);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("paces only upstream calls while cached results return immediately", async () => {
    vi.useFakeTimers();
    const transport = createMarketTransport({ minIntervalMs: 350 });
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await transport.read(url);
    const next = transport.read(url + "&other=1");
    await transport.read(url);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(349);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("evicts least recently used entries instead of growing indefinitely", async () => {
    const transport = createMarketTransport({ minIntervalMs: 0 });
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    for (let i = 0; i < 129; i++) await transport.read(`${url}&id=${i}`);
    await transport.read(`${url}&id=128`);
    expect(fetcher).toHaveBeenCalledTimes(129);
    await transport.read(`${url}&id=0`);
    expect(fetcher).toHaveBeenCalledTimes(130);
  });
});

describe("LSE REST contract", () => {
  const start = Date.parse("2026-01-02T10:00:00Z");
  const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
  const raw = (minute: number) => ({
    ts: at(minute).replace("T", " ").replace("Z", ""),
    open: "100",
    high: "104",
    low: "98",
    close: "102",
  });

  afterEach(() => {
    vi.restoreAllMocks();
    marketTransport.clear();
  });

  it("normalizes UTC times, numeric prices, ordering and duplicate bars", () => {
    const rows = parseLseBars([raw(1), raw(0), raw(0)]);
    expect(rows.map((bar) => bar.time)).toEqual([start, start + 60_000]);
    expect(rows[0]!.volume).toBe(0);
  });

  it("rejects malformed data and conflicting duplicates", () => {
    for (const rows of [
      { data: [] },
      [{ ...raw(0), open: null }],
      [{ ...raw(0), high: 90 }],
      [{ ...raw(0), ts: "bad" }],
      [raw(0), { ...raw(0), close: 103 }],
    ])
      expect(() => parseLseBars(rows)).toThrow();
  });

  it("uses date-only windows, checks both ends of plan caps, and filters to the trade", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json([raw(-1), raw(0), raw(1)]))
      .mockResolvedValueOnce(Response.json([raw(3), raw(2), raw(1)]));
    vi.stubGlobal("fetch", fetcher);
    const result = await londonStrategicEdge.history(
      { symbol: "EUR/USD", resolution: "1m", from: start + 10_000, to: start + 180_000 },
      "test-secret",
    );
    expect(result.bars.map((bar) => bar.time)).toEqual([start, start + 60_000, start + 120_000]);
    expect(result.truncated).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[1]!;
    expect(new URL(url).searchParams.get("start")).toBe("2026-01-02");
    expect(new URL(url).searchParams.get("end")).toBe("2026-01-03");
    expect(new URL(url).searchParams.get("order")).toBe("desc");
    expect(new URL(url).pathname).toBe("/vault/candles");
    expect(url).not.toContain("test-secret");
    expect(options.headers["x-api-key"]).toBe("test-secret");
    expect(options.redirect).toBe("error");
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("reuses both validated daily pages across overlapping trades", async () => {
    const fetcher = vi.fn(async () => Response.json([raw(0), raw(1), raw(2)]));
    vi.stubGlobal("fetch", fetcher);
    const histories = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        londonStrategicEdge.history(
          { symbol: "TEST", resolution: "1m", from: start + index * 1000, to: start + 180_000 },
          "test-secret",
        ),
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(histories.every((history) => history.bars.length === 3 && !history.truncated)).toBe(
      true,
    );
  });

  it("marks non-overlapping capped pages and bounded date ranges as truncated", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([raw(0)]))
        .mockResolvedValueOnce(Response.json([raw(2)])),
    );
    expect(
      (
        await londonStrategicEdge.history(
          { symbol: "TEST", resolution: "1m", from: start, to: start + 180_000 },
          "test-secret",
        )
      ).truncated,
    ).toBe(true);
    marketTransport.clear();
    const fetcher = vi.fn(async (_url: string) => Response.json([]));
    vi.stubGlobal("fetch", fetcher);
    const result = await londonStrategicEdge.history(
      { symbol: "TEST", resolution: "1m", from: start, to: start + 8 * 86_400_000 },
      "test-secret",
    );
    expect(result.truncated).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(12);
    const url = String(fetcher.mock.calls.at(-1)?.[0]);
    expect(new URL(url).searchParams.get("start")).toBe("2026-01-07");
  });

  it("rejects out-of-window data and inconsistent overlapping pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([raw(-1440)])),
    );
    await expect(
      londonStrategicEdge.history(
        { symbol: "TEST", resolution: "1m", from: start, to: start + 180_000 },
        "test-secret",
      ),
    ).rejects.toThrow("outside the requested date window");
    marketTransport.clear();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([raw(0)]))
        .mockResolvedValueOnce(Response.json([{ ...raw(0), high: 105 }])),
    );
    await expect(
      londonStrategicEdge.history(
        { symbol: "TEST", resolution: "1m", from: start, to: start + 180_000 },
        "test-secret",
      ),
    ).rejects.toThrow("Conflicting candles");
  });

  it("sanitizes denied access, quota failures, and transport errors", async () => {
    for (const status of [401, 403, 429, 500]) {
      marketTransport.clear();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("test-secret upstream detail", { status })),
      );
      await expect(londonStrategicEdge.test("test-secret")).rejects.not.toThrow("test-secret");
    }
    marketTransport.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("test-secret");
      }),
    );
    await expect(londonStrategicEdge.test("test-secret")).rejects.toThrow("failed or timed out");
  });
});

