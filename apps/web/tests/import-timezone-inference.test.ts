import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { parseAuto } from "@luxalgo/journal-importers";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-import-tz-inference-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts, executions, marketCandles, marketCandleBatches, marketSeriesSummary } =
  await import("../src/db");
const { ingestCandles } = await import("../src/server/market-data/csv");
const {
  inferImportTimeZoneFromCandles,
  reparseOrShiftImportedExecutions,
  extractNaiveWallClock,
  normalizeSymbolForCandleLookup,
} = await import("../src/server/import-timezone-inference");
const { POST: importRoute } = await import("../src/app/api/import/route");

function makeImportRequest(body: unknown): Request {
  return new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Market Candle Timezone Inference & Auto-Calibration", () => {
  // 2026-10-05 12:45:00 UTC (09:45:00 America/Sao_Paulo) = 1791204300 seconds
  // 2026-10-05 12:51:00 UTC (09:51:00 America/Sao_Paulo) = 1791204660 seconds
  // 2026-10-05 14:45:00 UTC (09:45:00 America/Chicago)   = 1791211500 seconds
  // 2026-10-05 14:51:00 UTC (09:51:00 America/Chicago)   = 1791211860 seconds
  const mesCandlesCsv = [
    "timestamp,open,high,low,close,volume",
    "1791204240,7768.50,7769.50,7768.00,7769.00,450", // 12:44:00Z
    "1791204300,7769.00,7770.00,7768.50,7769.25,520", // 12:45:00Z (09:45 BRT @ 7769.25)
    "1791204360,7769.25,7769.75,7768.25,7768.75,410", // 12:46:00Z
    "1791204600,7767.75,7768.25,7767.00,7767.50,390", // 12:50:00Z
    "1791204660,7767.50,7768.00,7766.75,7767.25,610", // 12:51:00Z (09:51:58 BRT @ 7767.25)
    "1791204720,7767.25,7767.75,7766.50,7767.00,480", // 12:52:00Z
    // Later at 14:45:00Z..14:52:00Z (09:45..09:52 America/Chicago), price is much higher (~7795)
    "1791211440,7794.00,7795.50,7793.50,7795.00,800", // 14:44:00Z
    "1791211500,7795.00,7796.50,7794.25,7796.00,950", // 14:45:00Z
    "1791211560,7796.00,7797.00,7795.00,7796.25,870", // 14:46:00Z
    "1791211800,7797.50,7798.50,7796.50,7798.00,720", // 14:50:00Z
    "1791211860,7798.00,7799.25,7797.25,7798.75,830", // 14:51:00Z
    "1791211920,7798.75,7800.00,7798.00,7799.50,790", // 14:52:00Z
  ].join("\n");

  beforeEach(() => {
    db.delete(executions).run();
    db.delete(accounts).run();
    db.delete(marketCandles).run();
    db.delete(marketCandleBatches).run();
    db.delete(marketSeriesSummary).run();
  });

  afterAll(() => {
    db.$client.close();
    if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
    else process.env.JOURNAL_DATA_DIR = previousDir;
    rmSync(scratch, { recursive: true, force: true });
  });

  it("recovers exact naive wall-clock and normalizes futures/CFD symbols", () => {
    // 2026-10-05 09:51:58 in America/Chicago (UTC-5) is 2026-10-05T14:51:58.000Z
    const wall = extractNaiveWallClock("2026-10-05T14:51:58.000Z", "America/Chicago");
    expect(wall).toBe("2026-10-05 09:51:58");

    expect(normalizeSymbolForCandleLookup("MESZ6")).toContain("MES");
    expect(normalizeSymbolForCandleLookup("US500.CASH")).toContain("US500");
  });

  it("detects and auto-calibrates MES executions on 2026-10-05 from America/Chicago to America/Sao_Paulo", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const parsedChicago = parseAuto(naiveStatement, { timeZone: "America/Chicago" });
    expect(parsedChicago).not.toBeNull();
    expect(parsedChicago!.executions[0]!.executedAt).toBe("2026-10-05T14:45:00.000Z");
    expect(parsedChicago!.executions[1]!.executedAt).toBe("2026-10-05T14:51:58.000Z");

    const inference = inferImportTimeZoneFromCandles({
      executions: parsedChicago!.executions,
      initialTimeZone: "America/Chicago",
      reparseExecutions: (tz) => parseAuto(naiveStatement, { timeZone: tz })?.executions,
      rawContent: naiveStatement,
    });

    expect(inference.autoCalibrated).toBe(true);
    expect(inference.timeZone).toBe("America/Sao_Paulo");
    expect(inference.originalTimeZone).toBe("America/Chicago");
    expect(inference.bestHitRate).toBe(1);
    expect(inference.initialHitRate).toBe(0);
    expect(inference.evaluatedCount).toBe(2);
    expect(inference.hitCount).toBe(2);

    const shifted = reparseOrShiftImportedExecutions(
      parsedChicago!.executions,
      "America/Chicago",
      inference.timeZone,
    );
    expect(shifted[0]!.executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(shifted[1]!.executedAt).toBe("2026-10-05T12:51:58.000Z");
  });

  it("does not alter timestamps that already carry an explicit Z or timezone offset", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    // Explicit Z timestamps at 14:45:00Z and 14:51:58Z with prices from 12:45:00Z
    // Because they have explicit 'Z', they are absolute UTC instants and must NOT be shifted.
    const explicitZStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05T14:45:00Z",
      "MESZ6,Sell,1,7767.25,2026-10-05T14:51:58Z",
    ].join("\n");

    const parsed = parseAuto(explicitZStatement, { timeZone: "America/Chicago" });
    expect(parsed).not.toBeNull();
    expect(parsed!.executions[0]!.executedAt).toBe("2026-10-05T14:45:00.000Z");

    const inference = inferImportTimeZoneFromCandles({
      executions: parsed!.executions,
      initialTimeZone: "America/Chicago",
      reparseExecutions: (tz) => parseAuto(explicitZStatement, { timeZone: tz })?.executions,
      rawContent: explicitZStatement,
    });

    expect(inference.autoCalibrated).toBe(false);
    expect(inference.timeZone).toBe("America/Chicago");
  });

  it("auto-calibrates via /api/import in preview and commit modes and honors lockTimeZone", async () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    db.insert(accounts)
      .values({
        id: "acc_mes_test",
        name: "MES Test Account",
        broker: "tradovate",
        timeZone: "America/Chicago",
        kind: "import",
        currency: "USD",
        initialBalance: 50000,
        profitCalcMethod: "fifo",
        createdAt: new Date().toISOString(),
      })
      .run();

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    // 1. Preview with initialTimeZone = America/Chicago -> auto-calibrates to America/Sao_Paulo
    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Sao_Paulo");
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T12:51:58.000Z");
    expect(previewRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );

    // 2. Preview with lockTimeZone = true -> keeps America/Chicago
    const lockedPreviewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
          lockTimeZone: true,
        }),
      )
    ).json();

    expect(lockedPreviewRes.timeZone).toBe("America/Chicago");
    expect(lockedPreviewRes.executions[0].executedAt).toBe("2026-10-05T14:45:00.000Z");

    // 3. Commit with uncalibrated timeZone -> auto-calibrates and persists 12:45:00Z & 12:51:58Z
    const commitRes = await (
      await importRoute(
        makeImportRequest({
          mode: "commit",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
          forceMismatch: true,
        }),
      )
    ).json();

    expect(commitRes.inserted).toBe(2);
    expect(commitRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );

    const savedExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, "acc_mes_test"))
      .all()
      .sort((a, b) => a.executedAt.localeCompare(b.executedAt));

    expect(savedExecs).toHaveLength(2);
    expect(savedExecs[0]!.executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(savedExecs[1]!.executedAt).toBe("2026-10-05T12:51:58.000Z");
  });

  it("auto-calibrates multi-file batch imports and normalizes .CASH CFD symbols", async () => {
    ingestCandles({
      name: "US500_1m_2026-10-05.csv",
      symbol: "US500",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const file1 = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "US500.CASH,Buy,1,7769.25,2026-10-05 09:45:00",
    ].join("\n");
    const file2 = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "US500.CASH,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          files: [
            { name: "part1.csv", content: file1 },
            { name: "part2.csv", content: file2 },
          ],
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Sao_Paulo");
    expect(previewRes.executions).toHaveLength(2);
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T12:51:58.000Z");
    expect(previewRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );
  });

  it("preserves initialTimeZone when it already aligns with market candles", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const parsedBrt = parseAuto(naiveStatement, { timeZone: "America/Sao_Paulo" });
    const inference = inferImportTimeZoneFromCandles({
      executions: parsedBrt!.executions,
      initialTimeZone: "America/Sao_Paulo",
      reparseExecutions: (tz) => parseAuto(naiveStatement, { timeZone: tz })?.executions,
      rawContent: naiveStatement,
    });

    expect(inference.autoCalibrated).toBe(false);
    expect(inference.timeZone).toBe("America/Sao_Paulo");
    expect(inference.initialHitRate).toBe(1);
  });

  it("preserves explicit offsets across multi-file out-of-order batches and MM/DD/YYYY formats", async () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    // File 1 has a LATER timestamp than File 2, both carrying explicit Z offsets
    const fileLater = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Sell,1,7767.25,2026-10-05T14:51:58Z",
    ].join("\n");
    const fileEarlier = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05T14:45:00Z",
    ].join("\n");

    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          files: [
            { name: "later.csv", content: fileLater },
            { name: "earlier.csv", content: fileEarlier },
          ],
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Chicago");
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T14:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T14:51:58.000Z");

    // Also verify MM/DD/YYYY with GMT-0300 explicit offset in rawContent fallback
    const slashExplicit = inferImportTimeZoneFromCandles({
      executions: previewRes.executions,
      initialTimeZone: "America/Chicago",
      rawContent: "MESZ6,Buy,1,7769.25,10/05/2026 09:45:00 GMT-0300",
    });
    expect(slashExplicit.autoCalibrated).toBe(false);
  });
});
