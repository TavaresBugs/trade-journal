import { alpaca } from "../../src/server/market-data/alpaca";
import { binance, coinbase } from "../../src/server/market-data/public-crypto";
import { oanda } from "../../src/server/market-data/oanda";
import { parseMarketCsv } from "../../src/lib/market-csv";
import { MAX_PAGES, readJson } from "../../src/server/market-data/http";


import {
  formatDateHuman,
  formatSeriesRange,
  formatChunkCanonical,
  formatBatchTitle,
  formatBatchMetrics,
  formatBatchImportDate,
  groupAssetSeries,
  RESOLUTION_ORDER,
} from "../../src/components/settings/market-data-manager-dialog";
import type { MarketSeriesSummary } from "../../src/lib/market-csv";
import type { Resolution } from "../../src/lib/market-data";


import { createMarketTransport, marketTransport } from "../../src/server/market-data/transport";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-market-data-test-"));
process.env.JOURNAL_DATA_DIR = scratch;
const { db, settings, accounts, executions, trades, marketCsvDatasets } = await import("../../src/db");
const { insertExecutions } = await import("../../src/server/executions");
const { GET: savedHistory, POST: loadHistory } =
  await import("../../src/app/api/trades/[key]/market-data/route");
const { GET: listCsv, POST: csvRequest } = await import("../../src/app/api/market-data/csv/route");
const { GET: explorer } = await import("../../src/app/api/trade-explorer/route");
const { connectionKey, connections, saveConnection } =
  await import("../../src/server/market-data/connections");
const { GET, POST } = await import("../../src/app/api/market-data/connections/route");
const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));
const id = "london-strategic-edge";
const request = (body: unknown) =>
  new Request("http://localhost/api/market-data/connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  db.delete(settings).run();
  db.delete(marketCsvDatasets).run();
  db.delete(trades).run();
  db.delete(executions).run();
  db.delete(accounts).run();
  for (const name of [
    "LSE_API_KEY",
    "ALPACA_API_KEY",
    "ALPACA_SECRET_KEY",
    "OANDA_API_TOKEN",
    "OANDA_ACCOUNT_ID",
    "OANDA_ENVIRONMENT",
  ])
    vi.stubEnv(name, "");
  vi.stubEnv("JOURNAL_PASSWORD", "");
});

describe("trade history endpoint", () => {
  const body = {
    provider: "london-strategic-edge",
    symbol: "TEST",
    resolution: "1m",
    basisConfirmed: true,
  };
  function seed(assetClass: "equity" | "option" = "equity") {
    db.insert(accounts)
      .values({ id: "fixture", name: "Fixture", kind: "manual", createdAt: "2026-01-01" })
      .run();
    insertExecutions(
      "fixture",
      [
        {
          symbol: "TEST",
          side: "buy",
          quantity: 10,
          price: 100,
          fee: 0,
          executedAt: "2026-01-02T10:00:00Z",
          assetClass,
        },
        {
          symbol: "TEST",
          side: "sell",
          quantity: 10,
          price: 102,
          fee: 0,
          executedAt: "2026-01-02T10:03:00Z",
          assetClass,
        },
      ],
      "manual",
    );
    return db.select().from(trades).all()[0]!.key;
  }
  it("loads candles and estimates without changing journal facts or exposing credentials", async () => {
    const key = seed();
    saveConnection(id, "fixture-key-only");
    const before = db.select().from(trades).all();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          [0, 1, 2].map((minute) => ({
            ts: `2026-01-02 10:0${minute}:00`,
            open: 100,
            low: 98,
            high: 104,
            close: 102,
          })),
        ),
      ),
    );
    const response = await loadHistory(request(body), { params: Promise.resolve({ key }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const result = await response.json();
    expect(result.estimate).toMatchObject({ mae: 20, mfe: 40 });
    expect(result.bars).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("fixture-key-only");
    expect(db.select().from(trades).all()).toEqual(before);
    const saved = await (
      await savedHistory(request({}), { params: Promise.resolve({ key }) })
    ).json();
    expect(saved.saved.estimate).toMatchObject({ mae: 20, mfe: 40 });
    const report = await (
      await explorer(new Request("http://localhost/api/trade-explorer?accounts=fixture"))
    ).json();
    expect(report.points).toHaveLength(1);
    expect(report.points[0]).toMatchObject({ key, mae: 20, mfe: 40 });
    const other = await (
      await explorer(new Request("http://localhost/api/trade-explorer?accounts=other"))
    ).json();
    expect(other.points).toEqual([]);
    // Chart-only loads do not erase the earlier, explicitly confirmed estimate.
    const chartOnly = await (
      await loadHistory(request({ ...body, basisConfirmed: false }), {
        params: Promise.resolve({ key }),
      })
    ).json();
    expect(chartOnly.bars).toHaveLength(3);
    expect(chartOnly.estimate.mae).toBeNull();
    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved
        .estimate.mae,
    ).toBe(20);
    db.insert(settings)
      .values({ key: "multipliers", value: JSON.stringify({ TEST: 2 }) })
      .run();
    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved,
    ).toBeNull();
    db.delete(settings).where(eq(settings.key, "multipliers")).run();
    // Account currency and execution changes invalidate derived values, even without a rebuild.
    db.update(accounts).set({ currency: "EUR" }).where(eq(accounts.id, "fixture")).run();
    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved,
    ).toBeNull();
    db.update(accounts).set({ currency: "USD" }).where(eq(accounts.id, "fixture")).run();
    db.update(executions).set({ price: 101 }).where(eq(executions.side, "buy")).run();
    const stale = await (await explorer(new Request("http://localhost/api/trade-explorer"))).json();
    expect(stale.points[0]).toMatchObject({ mae: null, mfe: null });
  });
  it("previews CSV without writes, imports candles, replays them, persists estimates and removes their derived results", async () => {
    const key = seed();
    const payload = {
      name: "Fixture.csv",
      symbol: "TEST",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content:
        "time,open,high,low,close\n2026-01-02T10:00:00Z,100,104,98,102\n2026-01-02T10:01:00Z,100,104,98,102\n2026-01-02T10:02:00Z,100,104,98,102",
    };
    expect(
      (await (await csvRequest(request({ ...payload, action: "preview" }))).json()).count,
    ).toBe(3);
    expect((await (await listCsv()).json()).datasets).toHaveLength(0);
    const imported = await (await csvRequest(request({ ...payload, action: "import" }))).json();
    expect(imported.datasets).toMatchObject([{ symbol: "TEST", count: 3 }]);
    expect(connections().find((item) => item.id === "market-csv")?.configured).toBe(true);
    const history = await (
      await loadHistory(request({ ...body, provider: "market-csv", dataset: imported.id }), {
        params: Promise.resolve({ key }),
      })
    ).json();
    expect(history.bars).toHaveLength(3);
    expect(history.estimate).toMatchObject({ mae: 20, mfe: 40 });
    const compact = await (
      await loadHistory(
        request({ ...body, provider: "market-csv", dataset: imported.id, estimateOnly: true }),
        {
          params: Promise.resolve({ key }),
        },
      )
    ).json();
    expect(compact.bars).toBeUndefined();
    expect(compact.estimate).toEqual(history.estimate);

    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved
        .estimate.mae,
    ).toBe(20);
    await csvRequest(request({ action: "revert_batch", batchId: imported.id }));
    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved,
    ).toBeNull();
    expect(db.select().from(trades).all()).toHaveLength(1);
  });
  it("keeps CSV currency mismatches unavailable even with the confirmation checked", async () => {
    const key = seed();
    const imported = await (
      await csvRequest(
        request({
          action: "import",
          name: "EUR.csv",
          symbol: "TEST",
          resolution: "1m",
          currency: "EUR",
          priceBasis: "raw",
          content:
            "time,open,high,low,close\n2026-01-02T10:00:00Z,100,104,98,102\n2026-01-02T10:02:00Z,100,104,98,102",
        }),
      )
    ).json();
    const history = await (
      await loadHistory(request({ ...body, provider: "market-csv", dataset: imported.id }), {
        params: Promise.resolve({ key }),
      })
    ).json();
    expect(history.bars).toHaveLength(2);
    expect(history.estimate.mae).toBeNull();
    expect(history.estimate.warnings.join()).toContain("EUR");
    expect(
      (await (await savedHistory(request({}), { params: Promise.resolve({ key }) })).json()).saved,
    ).toBeNull();
  });
  it("queries provider with 25 candles padding before open and after close", async () => {
    const key = seed();
    const historySpy = vi.fn().mockResolvedValue({
      provider: "Mock",
      symbol: "TEST",
      resolution: "1m",
      bars: [
        {
          time: Date.parse("2026-01-02T10:00:00Z"),
          open: 100,
          high: 104,
          low: 98,
          close: 102,
          volume: 1,
        },
        {
          time: Date.parse("2026-01-02T10:01:00Z"),
          open: 100,
          high: 104,
          low: 98,
          close: 102,
          volume: 1,
        },
        {
          time: Date.parse("2026-01-02T10:02:00Z"),
          open: 100,
          high: 104,
          low: 98,
          close: 102,
          volume: 1,
        },
      ],
      fetchedAt: new Date().toISOString(),
      truncated: false,
      warnings: [],
    });
    const { providerFor } = await import("../../src/server/market-data/connections");
    const originalProvider = providerFor("market-csv");
    const originalHistory = originalProvider.history;
    originalProvider.history = historySpy;
    try {
      await loadHistory(request({ ...body, provider: "market-csv" }), {
        params: Promise.resolve({ key }),
      });
      expect(historySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: Date.parse("2026-01-02T10:00:00Z") - 25 * 60_000,
          to: Date.parse("2026-01-02T10:03:00Z") + 25 * 60_000,
        }),
        expect.anything(),
      );
    } finally {
      originalProvider.history = originalHistory;
    }
  });
  it("loads a small range from a large CSV and reuses decoded candles", async () => {
    const { importCsvDataset, marketCsv, csvDatasets, removeCsvDataset } =
      await import("../../src/server/market-data/csv");
    const start = Date.parse("2025-01-01T00:00:00Z");
    const id = importCsvDataset({
      name: "large.csv",
      symbol: "TEST",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content:
        "time,open,high,low,close\n" +
        Array.from({ length: 50_000 }, (_, i) => `${start + i * 60_000},100,104,98,102`).join("\n"),
    });
    expect(csvDatasets()[0]?.count).toBe(50_000);
    const request = {
      symbol: "TEST",
      resolution: "1m" as const,
      from: start + 40_000 * 60_000 + 1000,
      to: start + 40_003 * 60_000,
    };
    const first = await marketCsv.history(request, "");
    expect(first.bars.map((bar) => bar.time)).toEqual(
      [40_000, 40_001, 40_002].map((i) => start + i * 60_000),
    );
    const prepare = vi.spyOn(db.$client, "prepare");
    try {
      expect((await marketCsv.history(request, "")).bars).toEqual(first.bars);
      expect(prepare.mock.calls.every(([query]) => !query.includes('"bars_json"'))).toBe(true);
    } finally {
      prepare.mockRestore();
    }
    removeCsvDataset(id);
    await expect(marketCsv.history(request, "")).rejects.toThrow("No CSV dataset");
  });
  it("validates hundreds of saved estimates with bounded database reads", async () => {
    const { estimateFingerprint, savedEstimates } =
      await import("../../src/server/market-data/estimates");
    const { rowToTrade } = await import("../../src/server/trades-query");
    const { tradeExcursions } = await import("../../src/db");
    db.insert(accounts)
      .values({ id: "batch", name: "Batch", kind: "manual", createdAt: "2025-01-01" })
      .run();
    const start = Date.parse("2025-01-01T10:00:00Z");
    insertExecutions(
      "batch",
      Array.from({ length: 401 }, (_, index) => [
        {
          symbol: "TEST",
          side: "buy" as const,
          quantity: 10,
          price: 100,
          fee: 0,
          assetClass: "equity" as const,
          executedAt: new Date(start + index * 86_400_000).toISOString(),
        },
        {
          symbol: "TEST",
          side: "sell" as const,
          quantity: 10,
          price: 102,
          fee: 0,
          assetClass: "equity" as const,
          executedAt: new Date(start + index * 86_400_000 + 180_000).toISOString(),
        },
      ]).flat(),
      "manual",
    );
    const selected = db
      .select()
      .from(trades)
      .all()
      .map((row) => rowToTrade(row));
    expect(selected).toHaveLength(401);
    for (const trade of selected)
      db.insert(tradeExcursions)
        .values({
          tradeKey: trade.key,
          fingerprint: estimateFingerprint(trade),
          provider: "Fixture",
          symbol: "TEST",
          resolution: "1m",
          fetchedAt: "2026-01-01",
          estimateJson: JSON.stringify({ mae: 20, mfe: 40, warnings: [] }),
        })
        .run();
    const prepare = vi.spyOn(db.$client, "prepare");
    try {
      expect(savedEstimates(selected).size).toBe(401);
      expect(prepare.mock.calls.length).toBeLessThanOrEqual(10);
    } finally {
      prepare.mockRestore();
    }
  });
  it("rejects missing trades, invalid resolutions, and options before requesting data", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await loadHistory(request(body), { params: Promise.resolve({ key: "missing" }) })).status,
    ).toBe(404);
    const key = seed("option");
    expect(
      (
        await loadHistory(request({ ...body, resolution: "tick" }), {
          params: Promise.resolve({ key }),
        })
      ).status,
    ).toBe(400);
    expect((await loadHistory(request(body), { params: Promise.resolve({ key }) })).status).toBe(
      400,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(() => {
  db.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("market data credential lifecycle", () => {
  it("starts with every source disabled and makes no provider requests", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const state = connections();
    expect(state).toHaveLength(6);
    expect(state.every((item) => !item.configured && item.source === null)).toBe(true);
    expect(state.map((item) => item.name)).toEqual(
      state.map((item) => item.name).sort((a, b) => a.localeCompare(b)),
    );
    const response = await GET();
    expect(response.status).toBe(200);
    for (const id of ["london-strategic-edge", "alpaca", "binance", "coinbase", "oanda"])
      expect(() => connectionKey(id)).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encrypts saved keys and never returns them from status or save responses", async () => {
    const response = await POST(
      request({ provider: id, action: "save", apiKey: "fixture-key-only" }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("fixture-key-only");
    expect(JSON.stringify(db.select().from(settings).all())).not.toContain("fixture-key-only");
    expect(connectionKey(id)).toBe("fixture-key-only");
    expect(await (await GET()).json()).toEqual({
      connections: expect.arrayContaining([
        { id, name: "London Strategic Edge", configured: true, source: "saved" },
      ]),
    });
    expect((await POST(request({ provider: id, action: "remove" }))).status).toBe(200);
    expect(connections()[0]?.configured).toBe(false);
    expect(() => connectionKey(id)).toThrow("Add a market data API key");
  });
  it("encrypts multi-field credentials, validates complete sets and leaves partial environment configs unavailable", async () => {
    expect(
      (
        await POST(
          request({ provider: "alpaca", action: "save", credentials: { apiKey: "fixture-id" } }),
        )
      ).status,
    ).toBe(400);
    const response = await POST(
      request({
        provider: "alpaca",
        action: "save",
        credentials: { apiKey: "fixture-id", secretKey: "fixture-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("fixture-secret");
    expect(JSON.stringify(db.select().from(settings).all())).not.toContain("fixture-secret");
    expect(JSON.parse(connectionKey("alpaca"))).toEqual({
      apiKey: "fixture-id",
      secretKey: "fixture-secret",
    });
    vi.stubEnv("ALPACA_API_KEY", "environment-fixture");
    expect(connections().find((item) => item.id === "alpaca")).toMatchObject({
      configured: false,
      source: "environment",
    });
    expect(() => connectionKey("alpaca")).toThrow("Complete all");
    expect((await POST(request({ provider: "alpaca", action: "remove" }))).status).toBe(400);
    expect(
      (
        await POST(
          request({
            provider: "oanda",
            action: "save",
            credentials: { apiKey: "fixture-token", accountId: "001-123", environment: "other" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({
            provider: "oanda",
            action: "save",
            credentials: { apiKey: "fixture-token", accountId: "001-123", environment: "practice" },
          }),
        )
      ).status,
    ).toBe(200);
  });
  it("enables and disables public sources explicitly without accepting unnecessary secrets", async () => {
    expect(() => connectionKey("binance")).toThrow("Enable");
    expect(
      (await POST(request({ provider: "binance", action: "save", apiKey: "unused-secret" })))
        .status,
    ).toBe(400);
    expect((await POST(request({ provider: "binance", action: "enable" }))).status).toBe(200);
    expect(connectionKey("binance")).toBe("");
    expect(connections().find((item) => item.id === "binance")).toMatchObject({
      configured: true,
      source: "public",
    });
    expect((await POST(request({ provider: "binance", action: "remove" }))).status).toBe(200);
    expect(() => connectionKey("binance")).toThrow("Enable");
  });
  it("honors environment precedence and refuses misleading saves or removals", async () => {
    saveConnection(id, "saved-fixture");
    vi.stubEnv("LSE_API_KEY", "environment-fixture");
    expect(connectionKey(id)).toBe("environment-fixture");
    expect(connections().find((item) => item.id === id)?.source).toBe("environment");
    expect((await POST(request({ provider: id, action: "remove" }))).status).toBe(400);
    expect(
      (await POST(request({ provider: id, action: "save", apiKey: "replacement" }))).status,
    ).toBe(400);
  });
  it("validates input before changing credentials", async () => {
    for (const apiKey of [null, "", " ", 42, "a\nb", "a".repeat(4097)])
      expect((await POST(request({ provider: id, action: "save", apiKey }))).status).toBe(400);
    expect((await POST(request({ provider: "unknown", action: "remove" }))).status).toBe(400);
    expect(connections()[0]?.configured).toBe(false);
  });
  it("tests access only on request and does not relay upstream details", async () => {
    const fetcher = vi.fn(async () => new Response("fixture-key-only", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    saveConnection(id, "fixture-key-only");
    expect(fetcher).not.toHaveBeenCalled();
    const response = await POST(request({ provider: id, action: "test" }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("fixture-key-only");
    expect(fetcher.mock.calls).toHaveLength(1);
  });
  it("uses the app's authentication gate for reads and writes", async () => {
    vi.stubEnv("JOURNAL_PASSWORD", "fixture-password");
    expect((await GET()).status).toBe(401);
    expect((await listCsv()).status).toBe(401);
    expect((await csvRequest(request({ action: "remove", id: "anything" }))).status).toBe(401);
    expect(
      (await POST(request({ provider: id, action: "save", apiKey: "fixture-key" }))).status,
    ).toBe(401);
    expect(connections()[0]?.configured).toBe(false);
  });
});

afterEach(() => marketTransport.clear());

beforeEach(() => Object.assign(marketTransport, createMarketTransport({ minIntervalMs: 0 })));


// ============================================================================
// PROVIDER ADAPTERS & CSV PARSER
// ============================================================================

const from = Date.parse("2025-03-03T14:30:00Z");

describe("market data adapters", () => {
  const request = { from, to: from + 120000, symbol: "BTC-USD", resolution: "1m" as const };
  const candle = { t: new Date(from).toISOString(), o: 100, h: 105, l: 95, c: 102, v: 1000 };
  afterEach(() => vi.unstubAllGlobals());
  it("requires an explicit Alpaca feed before requesting prices", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(alpaca.history({ ...request, symbol: "AAPL" }, "{}")).rejects.toThrow(
      "Choose IEX, SIP or Crypto",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("paginates Alpaca even when a page is short and keeps secrets in headers", async () => {
    const fetcher = vi
      .fn(async () => Response.json({ symbol: "AAPL", bars: [candle], next_page_token: "next" }))
      .mockImplementationOnce(async () =>
        Response.json({ symbol: "AAPL", bars: [candle], next_page_token: "next" }),
      )
      .mockImplementationOnce(async () =>
        Response.json({
          symbol: "AAPL",
          bars: [{ ...candle, t: new Date(from + 60000).toISOString() }],
          next_page_token: null,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const data = await alpaca.history(
      { ...request, symbol: "AAPL", dataset: "iex" },
      JSON.stringify({ apiKey: "fixture-id", secretKey: "fixture-secret" }),
    );
    expect(data.bars).toHaveLength(2);
    expect(data.truncated).toBe(false);
    expect(data.quoteCurrency).toBe("USD");
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[1]![0]).toContain("page_token=next");
    expect(calls[0]![0]).toContain("adjustment=raw");
    expect(calls[0]![1]).toMatchObject({
      redirect: "error",
      headers: { "APCA-API-SECRET-KEY": "fixture-secret" },
    });
    expect(calls.map((call) => call[0]).join()).not.toContain("fixture");
  });
  it("selects Alpaca crypto bars by exact symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          bars: { "BTC/USD": [candle], "ETH/USD": [{ ...candle, o: 2 }] },
          next_page_token: null,
        }),
      ),
    );
    const data = await alpaca.history(
      { ...request, symbol: "BTC/USD", dataset: "crypto" },
      JSON.stringify({ apiKey: "fixture", secretKey: "secret" }),
    );
    expect(data.bars[0]!.open).toBe(100);
    expect(data.quoteCurrency).toBe("USD");
  });
  it("rejects repeating Alpaca page tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ bars: [], next_page_token: "same" })),
    );
    await expect(
      alpaca.history({ ...request, symbol: "AAPL", dataset: "iex" }, "{}"),
    ).rejects.toThrow("pagination");
  });
  it("normalizes Coinbase reverse order and paginates under 300 candles", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const start = Date.parse(new URL(url).searchParams.get("start")!);
      return Response.json([
        [start / 1000 + 60, 99, 105, 100, 104, 5],
        [start / 1000, 98, 102, 100, 101, 2],
      ]);
    });
    vi.stubGlobal("fetch", fetcher);
    const data = await coinbase.history({ ...request, to: from + 301 * 60000 }, "");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(data.bars).toHaveLength(4);
    expect(data.bars[0]).toMatchObject({ time: from, open: 100, high: 102, low: 98 });
    expect(data.quoteCurrency).toBe("USD");
    expect(data.truncated).toBe(false);
  });
  it("caps long history and marks it truncated instead of estimating from an unfinished request", async () => {
    const fetcher = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetcher);
    const data = await coinbase.history(
      { ...request, to: from + 60_000 * 299 * (MAX_PAGES + 1) },
      "",
    );
    expect(fetcher).toHaveBeenCalledTimes(MAX_PAGES);
    expect(data.truncated).toBe(true);
  });
  it("uses Binance's public data host and preserves the quote asset", async () => {
    const fetcher = vi.fn(async (url: string) =>
      Response.json(
        url.includes("exchangeInfo")
          ? { symbols: [{ symbol: "BTCUSDT", quoteAsset: "USDT" }] }
          : [[from, "100", "105", "95", "102", "4"]],
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const data = await binance.history({ ...request, symbol: "BTCUSDT" }, "");
    expect(data.quoteCurrency).toBe("USDT");
    expect(data.bars[0]!.time).toBe(from);
    expect(
      fetcher.mock.calls.every(([url]) => url.startsWith("https://data-api.binance.vision/")),
    ).toBe(true);
  });
  it("uses OANDA practice/live candle endpoints, midpoint prices and completed candles only", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        instrument: "EUR_USD",
        granularity: "M1",
        candles: [
          {
            complete: true,
            time: candle.t,
            mid: { o: "1.1", h: "1.2", l: "1.0", c: "1.15" },
            volume: 30,
          },
          { complete: false, time: new Date(from + 60000).toISOString() },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const data = await oanda.history(
      { ...request, symbol: "EUR_USD" },
      JSON.stringify({ apiKey: "fixture-token", accountId: "001-123", environment: "practice" }),
    );
    expect(data.bars).toHaveLength(1);
    expect(data.quoteCurrency).toBe("USD");
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]![0]).toContain(
      "api-fxpractice.oanda.com/v3/accounts/001-123/instruments/EUR_USD/candles",
    );
    expect(calls[0]![0]).toContain("alignmentTimezone=UTC");
    expect(calls[0]![1].headers).toMatchObject({ Authorization: "Bearer fixture-token" });
  });
  it("does not relay upstream error bodies or credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fixture-secret-token", { status: 403 })),
    );
    await expect(readJson("https://data.alpaca.markets/test")).rejects.toThrow("access denied");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fixture-secret-token");
      }),
    );
    await expect(readJson("https://data.alpaca.markets/test")).rejects.toThrow("timed out");
  });
});

describe("market CSV parser", () => {
  const header = "time,open,high,low,close,volume\n";
  it("normalizes timezone and epoch stamps, sorting without inventing bars", () => {
    const bars = parseMarketCsv(
      header + `1741012260,100,104,98,102,0\n2025-03-03T09:30:00-05:00,100,105,95,102,0`,
      "AAPL",
      "1m",
    );
    expect(bars).toHaveLength(2);
    expect(bars[0]!.time).toBe(from);
    expect(bars[1]!.time).toBe(from + 60000);
  });
  it("accepts missing volume and quoted numeric fields", () => {
    expect(
      parseMarketCsv(
        'timestamp,open,high,low,close\n1741012200000,"100",105,95,102',
        "AAPL",
        "1m",
      )[0]!.volume,
    ).toBe(0);
  });
  it.each([
    ["2025-03-03 14:30:00,100,105,95,102,0", "timezone"],
    ["2025-02-30T14:30:00Z,100,105,95,102,0", "calendar date"],
    ["1741012200,100,90,95,102,0", "OHLC"],
    ["1741012200,100,105,95,102,-1", "negative volume"],
    ["1741012200,100,105,95,102,0\n1741012200,100,105,95,102,0", "Duplicate"],
    ["1741012200,100,105,95,102,0\n1741012261,100,105,95,102,0", "resolution"],
  ])("rejects invalid CSV data (%s)", (rows, message) =>
    expect(() => parseMarketCsv(header + rows, "AAPL", "1m")).toThrow(message),
  );
  it("rejects mixed symbols and trade statements", () => {
    expect(() =>
      parseMarketCsv("symbol," + header + "MSFT,1741012200,100,105,95,102,0", "AAPL", "1m"),
    ).toThrow("symbol");
    expect(() =>
      parseMarketCsv("symbol,side,quantity,price,time\nAAPL,buy,10,100,1741012200", "AAPL", "1m"),
    ).toThrow("open");
  });
});

afterEach(() => marketTransport.clear());

beforeEach(() => Object.assign(marketTransport, createMarketTransport({ minIntervalMs: 0 })));


// ============================================================================
// MARKET DATA MANAGER DIALOG HELPERS
// ============================================================================

describe("MarketDataManagerDialog helpers", () => {
  describe("Date formatting helpers", () => {
    it("formatDateHuman formats UTC timestamps to institutional UK format (DD MMM YYYY)", () => {
      const t1 = Date.UTC(2026, 9, 5); // 05 Oct 2026
      expect(formatDateHuman(t1)).toBe("05 Oct 2026");

      const t2 = Date.UTC(2026, 9, 8); // 08 Oct 2026
      expect(formatDateHuman(t2)).toBe("08 Oct 2026");

      const t3 = Date.UTC(2026, 0, 1); // 01 Jan 2026
      expect(formatDateHuman(t3)).toBe("01 Jan 2026");
    });

    it("formatDateHuman returns fallback dash for missing, zero, or invalid timestamps", () => {
      expect(formatDateHuman(0)).toBe("—");
      expect(formatDateHuman(NaN)).toBe("—");
      expect(formatDateHuman(null)).toBe("—");
      expect(formatDateHuman(undefined)).toBe("—");
      expect(formatDateHuman(-1)).toBe("—");
    });

    it("formatSeriesRange correctly combines firstTime and lastTime into canonical arrow format", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(formatSeriesRange(first, last)).toBe("05 Oct 2026 → 08 Oct 2026");
    });

    it("formatSeriesRange returns fallback dash if either timestamp is missing or invalid", () => {
      const valid = Date.UTC(2026, 9, 5);
      expect(formatSeriesRange(valid, undefined)).toBe("—");
      expect(formatSeriesRange(undefined, valid)).toBe("—");
      expect(formatSeriesRange(0, valid)).toBe("—");
      expect(formatSeriesRange(valid, NaN)).toBe("—");
      expect(formatSeriesRange(undefined, undefined)).toBe("—");
    });

    it("formatBatchImportDate formats UTC import timestamps into readable English format", () => {
      expect(formatBatchImportDate("2026-10-10T17:35:00Z")).toBe("10 Oct 2026, 17:35");
      expect(formatBatchImportDate(Date.UTC(2026, 9, 10, 17, 35))).toBe("10 Oct 2026, 17:35");
      expect(formatBatchImportDate("invalid-date")).toBe("—");
      expect(formatBatchImportDate(null)).toBe("—");
      expect(formatBatchImportDate(undefined)).toBe("—");
    });
  });

  describe("Chunk display name & metrics formatting", () => {
    it("formatChunkCanonical formats canonical chunk string with date range and bar count", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
          barCount: 5000,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026 (5,000 bars)");
    });

    it("formatChunkCanonical handles missing or zero bar counts gracefully", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
          barCount: 0,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026 (0 bars)");

      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026");
    });

    it("formatBatchTitle creates standardized title with TradingView aesthetic resolution notation", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatBatchTitle({
          symbol: "MES",
          resolution: "1m",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("MES · 1m │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "NQ",
          resolution: "1h",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("NQ · 1H │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "ES",
          resolution: "1d",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("ES · D │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "BTC",
          resolution: "1w",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("BTC · W │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "ETH",
          resolution: "1mo",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("ETH · M │ 05 Oct 2026 → 08 Oct 2026");
    });

    it("formatBatchMetrics formats new, duplicate, and total counts with thousands separator", () => {
      expect(
        formatBatchMetrics({
          newBarCount: 5000,
          duplicateBarCount: 120,
          barCount: 5120,
        }),
      ).toBe("+5,000 new · 120 duplicates · 5,120 total");

      expect(formatBatchMetrics({})).toBe("+0 new · 0 duplicates · 0 total");
    });
  });

  describe("Asset grouping and sorting", () => {
    const mockSeries: MarketSeriesSummary[] = [
      {
        symbol: "MES",
        resolution: "5m",
        barCount: 10000,
        firstTime: Date.UTC(2026, 9, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "mes",
        resolution: "1m",
        barCount: 5000,
        firstTime: Date.UTC(2026, 9, 5),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "MES",
        resolution: "1h",
        barCount: 800,
        firstTime: Date.UTC(2026, 8, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "NQ",
        resolution: "15m",
        barCount: 3000,
        firstTime: Date.UTC(2026, 9, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "ES",
        resolution: "1d",
        barCount: 250,
        firstTime: Date.UTC(2025, 0, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
    ];

    it("groups timeframes under the correct symbol and aggregates total bars", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES");

      expect(mesAsset).toBeDefined();
      expect(mesAsset!.totalBars).toBe(15800); // 10000 + 5000 + 800
      expect(mesAsset!.timeframes.length).toBe(3);
    });

    it("sorts grouped assets alphabetically by symbol", () => {
      const grouped = groupAssetSeries(mockSeries);
      const symbols = grouped.map((a) => a.symbol);
      expect(symbols).toEqual(["ES", "MES", "NQ"]);
    });

    it("sorts timeframes within each asset according to canonical resolution hierarchy", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES")!;

      const resolutions = mesAsset.timeframes.map((tf) => tf.resolution);
      expect(resolutions).toEqual(["1m", "5m", "1h"]);
    });

    it("populates display names and class-isolated compatible symbols from symbol specs and family", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES")!;

      // MES has spec name or family name
      expect(mesAsset.displayName).toContain("Micro E-mini");
      // Compatible symbols exclude the asset itself and isolate Futures (MES/ES) from CFDs (US500/SPX500)
      expect(mesAsset.compatibleSymbols).not.toContain("MES");
      expect(mesAsset.compatibleSymbols).toEqual(["ES"]);
      expect(mesAsset.compatibleSymbols).not.toContain("US500");

      // CFD series isolates CFD family members from Futures
      const cfdGrouped = groupAssetSeries([
        {
          symbol: "US100",
          resolution: "5m",
          barCount: 1000,
          firstTime: Date.UTC(2026, 9, 1),
          lastTime: Date.UTC(2026, 9, 2),
          currency: "USD",
          priceBasis: "raw",
        },
      ]);
      expect(cfdGrouped[0]!.compatibleSymbols).toEqual(
        expect.arrayContaining(["US100.CASH", "NAS100", "USTEC", "NDX"]),
      );
      expect(cfdGrouped[0]!.compatibleSymbols).not.toContain("MNQ");
      expect(cfdGrouped[0]!.compatibleSymbols).not.toContain("NQ");
    });

    it("handles assets with no specs gracefully", () => {
      const customSeries: MarketSeriesSummary[] = [
        {
          symbol: "CUSTOM_COIN",
          resolution: "1m",
          barCount: 100,
          firstTime: Date.UTC(2026, 9, 1),
          lastTime: Date.UTC(2026, 9, 2),
          currency: "USD",
          priceBasis: "raw",
        },
      ];

      const grouped = groupAssetSeries(customSeries);
      expect(grouped.length).toBe(1);
      expect(grouped[0]!.symbol).toBe("CUSTOM_COIN");
      expect(grouped[0]!.displayName).toBe("CUSTOM_COIN");
      expect(grouped[0]!.compatibleSymbols).toEqual([]);
    });

    it("sorts arbitrary custom and community resolutions chronologically via parseResolutionMs", () => {
      const customCommunitySeries: MarketSeriesSummary[] = [
        {
          symbol: "XYZ",
          resolution: "4h",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "7m" as Resolution,
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "1m",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "1d",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "20m" as Resolution,
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "8h",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
      ];
      const grouped = groupAssetSeries(customCommunitySeries);
      expect(grouped[0]!.timeframes.map((tf) => tf.resolution)).toEqual([
        "1m",
        "7m",
        "20m",
        "4h",
        "8h",
        "1d",
      ]);
    });

    it("respects RESOLUTION_ORDER ranking", () => {
      expect(RESOLUTION_ORDER["1m"]).toBeLessThan(RESOLUTION_ORDER["3m"]!);
      expect(RESOLUTION_ORDER["3m"]).toBeLessThan(RESOLUTION_ORDER["5m"]!);
      expect(RESOLUTION_ORDER["5m"]).toBeLessThan(RESOLUTION_ORDER["15m"]!);
      expect(RESOLUTION_ORDER["15m"]).toBeLessThan(RESOLUTION_ORDER["30m"]!);
      expect(RESOLUTION_ORDER["30m"]).toBeLessThan(RESOLUTION_ORDER["1h"]!);
      expect(RESOLUTION_ORDER["1h"]).toBeLessThan(RESOLUTION_ORDER["4h"]!);
      expect(RESOLUTION_ORDER["4h"]).toBeLessThan(RESOLUTION_ORDER["1d"]!);
      expect(RESOLUTION_ORDER["1d"]).toBeLessThan(RESOLUTION_ORDER["1w"]!);
      expect(RESOLUTION_ORDER["1w"]).toBeLessThan(RESOLUTION_ORDER["1mo"]!);
    });
  });
});
