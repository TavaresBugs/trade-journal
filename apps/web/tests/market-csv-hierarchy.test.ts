import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-csv-hierarchy-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, trades, marketCsvDatasets } = await import("../src/db");
const {
  marketCsv,
  importCsvDataset,
  distinctTradedSymbols,
  removeCsvDataset,
  setCustomSymbolLinks,
  getCustomSymbolLinks,
  ingestCandles,
  purgeCandlesBySymbol,
} = await import("../src/server/market-data/csv");

describe("Market CSV Ground Truth & Family Hierarchy", () => {
  // 2025-01-02 14:30:00 UTC = 1735828200000
  const fromTime = 1735828200000;
  const toTime = fromTime + 600000; // 10 minutes later (covers two 5m candles)

  const mesCsvContent = `timestamp,open,high,low,close,volume
1735828200,5000,5010,4990,5005,100
1735828500,5005,5015,5000,5010,120`;

  const us500CsvContent = `timestamp,open,high,low,close,volume
1735828200,5001,5011,4991,5006,200
1735828500,5006,5016,5001,5011,220`;

  let mesDatasetId: string | undefined;
  let us500DatasetId: string | undefined;

  beforeAll(() => {
    // Populate distinct trades
    db.insert(trades)
      .values([
        {
          key: "trade-1",
          accountId: "acc-1",
          symbol: "US500.CASH",
          direction: "long",
          status: "win",
          quantity: 1,
          openQuantity: 0,
          avgEntry: 5000,
          grossPnl: 10,
          fees: 0,
          netPnl: 10,
          executionCount: 1,
          executionIdsJson: "[]",
          exitsJson: "[]",
          openedAt: "2025-01-02T14:30:00.000Z",
          closedAt: "2025-01-02T14:40:00.000Z",
        },
        {
          key: "trade-2",
          accountId: "acc-1",
          symbol: "MES1!",
          direction: "short",
          status: "win",
          quantity: 1,
          openQuantity: 0,
          avgEntry: 5005,
          grossPnl: 25,
          fees: 0,
          netPnl: 25,
          executionCount: 1,
          executionIdsJson: "[]",
          exitsJson: "[]",
          openedAt: "2025-01-02T14:30:00.000Z",
          closedAt: "2025-01-02T14:40:00.000Z",
        },
      ])
      .run();

    // Import only MES dataset initially
    mesDatasetId = importCsvDataset({
      name: "MES1_5m_websocket.csv",
      symbol: "MES",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCsvContent,
    });
  });

  it("returns distinct traded symbols including normalized forms", () => {
    const symbols = distinctTradedSymbols();
    expect(symbols).toContain("US500.CASH");
    expect(symbols).toContain("US500");
    expect(symbols).toContain("MES1!");
    expect(symbols).toContain("MES");
  });

  it("matches MES request to MES dataset directly (Ground Truth Priority 1)", async () => {
    const res = await marketCsv.history(
      {
        symbol: "MES",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(res.datasetId).toBe(mesDatasetId);
    expect(res.bars).toHaveLength(2);
    expect(res.bars[0]!.open).toBe(5000);
    expect(res.warnings[0]).toContain("Local file: MES1_5m_websocket.csv");
    expect(res.warnings[0]).not.toContain("brother instrument");
  });

  it("matches ES (Futures) to MES (Futures) within the Futures family, while isolating US500 (CFD) by default", async () => {
    // ES is in the same Futures class as MES -> should match automatically
    const esRes = await marketCsv.history(
      {
        symbol: "ES",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(esRes.datasetId).toBe(mesDatasetId);
    expect(esRes.bars[0]!.open).toBe(5000);
    expect(esRes.warnings[0]).toContain("Candles from brother instrument MES");

    // US500 is CFD class -> must NOT cross-contaminate with Futures MES by default
    await expect(
      marketCsv.history(
        {
          symbol: "US500",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");
  });

  it("matches CFD brother symbols (SPX500, US500.CASH) to US500 dataset within the CFD family", async () => {
    us500DatasetId = importCsvDataset({
      name: "US500_5m.csv",
      symbol: "US500",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: us500CsvContent,
    });

    const resExact = await marketCsv.history(
      {
        symbol: "US500",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(resExact.datasetId).toBe(us500DatasetId);
    expect(resExact.bars[0]!.open).toBe(5001);
    expect(resExact.warnings[0]).toContain("Local file: US500_5m.csv");

    // SPX500 normalizes to US500 (Priority 1 alias)
    const resCfdAlias = await marketCsv.history(
      {
        symbol: "SPX500",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(resCfdAlias.datasetId).toBe(us500DatasetId);
    expect(resCfdAlias.bars[0]!.open).toBe(5001);

    // SPX and US500.CASH also resolve to US500 within the CFD family
    const resCfdBrother = await marketCsv.history(
      {
        symbol: "US500.CASH",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(resCfdBrother.datasetId).toBe(us500DatasetId);
    expect(resCfdBrother.bars[0]!.open).toBe(5001);

    // Unlinking SPX500 via setCustomSymbolLinks blocks SPX500 while preserving US500.CASH
    setCustomSymbolLinks("US500", ["US500", "US500.CASH"]);
    await expect(
      marketCsv.history(
        {
          symbol: "SPX500",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");
  });

  it("honors explicit dataset override even if request symbol differs", async () => {
    const res = await marketCsv.history(
      {
        symbol: "US500",
        resolution: "5m",
        from: fromTime,
        to: toTime,
        dataset: mesDatasetId,
      },
      "",
    );
    expect(res.datasetId).toBe(mesDatasetId);
    expect(res.bars[0]!.open).toBe(5000);
  });

  it("respects customized compatibleSymbols and interactive setCustomSymbolLinks (add & unlink tickers)", async () => {
    const customId = importCsvDataset({
      name: "CUSTOM_MES_5m.csv",
      symbol: "MES_CUSTOM",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCsvContent,
      compatibleSymbols: ["MES_CUSTOM", "ALLOWED_PARTNER"],
    });

    // Request for ALLOWED_PARTNER should find it
    const resAllowed = await marketCsv.history(
      {
        symbol: "ALLOWED_PARTNER",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(resAllowed.datasetId).toBe(customId);

    // Unlink ALLOWED_PARTNER via setCustomSymbolLinks (simulating UI [x] button)
    setCustomSymbolLinks("MES_CUSTOM", ["MES_CUSTOM"]);
    expect(getCustomSymbolLinks("MES_CUSTOM")).toEqual(["MES_CUSTOM"]);

    await expect(
      marketCsv.history(
        {
          symbol: "ALLOWED_PARTNER",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");

    removeCsvDataset(customId);

    // Unlink ES from MES (leaving only MES or []) and verify ES is blocked while MES1! still resolves
    setCustomSymbolLinks("MES", ["MES"]);
    await expect(
      marketCsv.history(
        {
          symbol: "ES",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");

    const mesCont = await marketCsv.history(
      {
        symbol: "MES1!",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(mesCont.datasetId).toBe(mesDatasetId);

    // Even when set to empty array [], ES remains blocked and MES1! still resolves to MES
    setCustomSymbolLinks("MES", []);
    await expect(
      marketCsv.history(
        {
          symbol: "ES",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");

    const mesCont2 = await marketCsv.history(
      {
        symbol: "MES1!",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(mesCont2.datasetId).toBe(mesDatasetId);
  });

  it("smartly de-duplicates overlapping candles on bulk/incremental imports without duplicating existing bars", () => {
    const batch1 = ingestCandles({
      name: "US100.cash_5m_part1.csv",
      symbol: "US100",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: `timestamp,open,high,low,close,volume
1735828200,21000,21010,20990,21005,100
1735828500,21005,21020,21000,21015,120`,
    });
    expect(batch1.newBarCount).toBe(2);
    expect(batch1.duplicateBarCount).toBe(0);
    expect(batch1.totalInDb).toBe(2);

    // Second upload has 2 overlapping bars + 1 new surplus bar
    const batch2 = ingestCandles({
      name: "US100.cash_5m_part2.csv",
      symbol: "US100",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: `timestamp,open,high,low,close,volume
1735828200,21000,21010,20990,21005,100
1735828500,21005,21020,21000,21015,120
1735828800,21015,21030,21010,21025,150`,
    });
    expect(batch2.newBarCount).toBe(1);
    expect(batch2.duplicateBarCount).toBe(2);
    expect(batch2.totalInDb).toBe(3);

    purgeCandlesBySymbol("US100", "5m");
  });

  afterAll(() => {
    if (mesDatasetId) removeCsvDataset(mesDatasetId);
    if (us500DatasetId) removeCsvDataset(us500DatasetId);
    db.$client.close();
    if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
    else process.env.JOURNAL_DATA_DIR = previousDir;
    rmSync(scratch, { recursive: true, force: true });
  });
});
