import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-csv-hierarchy-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, trades, marketCsvDatasets } = await import("../src/db");
const { marketCsv, importCsvDataset, distinctTradedSymbols, removeCsvDataset } =
  await import("../src/server/market-data/csv");

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

  it("matches US500 request to MES dataset as family fallback when no US500 dataset exists (Priority 2)", async () => {
    const res = await marketCsv.history(
      {
        symbol: "US500",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(res.datasetId).toBe(mesDatasetId);
    expect(res.bars[0]!.open).toBe(5000);
    expect(res.warnings[0]).toContain("Candles from brother instrument MES");
  });

  it("prioritizes US500 dataset over MES fallback when US500 dataset is imported (Ground Truth Preserved)", async () => {
    us500DatasetId = importCsvDataset({
      name: "US500_5m.csv",
      symbol: "US500",
      resolution: "5m",
      currency: "USD",
      priceBasis: "raw",
      content: us500CsvContent,
    });

    const res = await marketCsv.history(
      {
        symbol: "US500",
        resolution: "5m",
        from: fromTime,
        to: toTime,
      },
      "",
    );
    expect(res.datasetId).toBe(us500DatasetId);
    expect(res.bars[0]!.open).toBe(5001); // US500 candle open, not MES!
    expect(res.warnings[0]).toContain("Local file: US500_5m.csv");
    expect(res.warnings[0]).not.toContain("brother instrument");
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

  it("respects customized compatibleSymbols and rejects brothers removed by the user", async () => {
    // Import dataset where user explicitly allowed ONLY MES and US500, excluding SPY
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

    // Request for an unallowed brother symbol like UNKNOWN_PARTNER should NOT find it
    await expect(
      marketCsv.history(
        {
          symbol: "UNKNOWN_PARTNER",
          resolution: "5m",
          from: fromTime,
          to: toTime,
        },
        "",
      ),
    ).rejects.toThrow("No CSV dataset matches this symbol and resolution");

    removeCsvDataset(customId);
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
