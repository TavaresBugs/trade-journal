import { describe, expect, it } from "vitest";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";
import {
  createExecution,
  createImportedExecution,
  createTradePair,
  createImportedTradePair,
} from "./helpers/trade-factory";

const BASE_TRADEZELLA_CSV = `Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions
2026-01-05 09:31:00,2026-01-05 10:15:00,AAPL,LONG,100,185.50,187.25,171.00,4.00
2026-01-06 09:45:00,2026-01-06 09:52:00,TSLA,SHORT,50,240.00,242.00,-102.50,2.50
2026-01-07 11:00:00,2026-01-07 11:30:00,MSFT,LONG,20,400.00,405.00,98.00,2.00
2026-01-08 14:00:00,2026-01-08 14:45:00,NVDA,SHORT,30,120.00,118.00,57.50,2.50`;

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("TradeZella — Chaos & Stress Test Battery", () => {
  describe("Timezone string stripping", () => {
    const tzCases = [
      { tzAbbr: "EST", zone: "America/New_York", expectedHourUtc: 14 },
      { tzAbbr: "EDT", zone: "America/New_York", expectedHourUtc: 14 },
      { tzAbbr: "CST", zone: "America/Chicago", expectedHourUtc: 15 },
      { tzAbbr: "CDT", zone: "America/Chicago", expectedHourUtc: 15 },
      { tzAbbr: "PST", zone: "America/Los_Angeles", expectedHourUtc: 17 },
      { tzAbbr: "UTC", zone: "UTC", expectedHourUtc: 9 },
      { tzAbbr: "GMT", zone: "UTC", expectedHourUtc: 9 },
    ];

    it.each(tzCases)(
      "strips timezone suffix %s and parses naive timestamp in %s",
      ({ tzAbbr, zone, expectedHourUtc }) => {
        const csv = [
          "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
          `2026-01-05 09:30:00 ${tzAbbr},2026-01-05 10:30:00 ${tzAbbr},AAPL,LONG,100,185.00,187.00,195.00,5.00`,
        ].join("\n");

        const detected = detectFormat(csv);
        expect(detected?.id).toBe("tradezella");

        const parsed = parseAuto(csv, { timeZone: zone });
        expect(parsed).not.toBeNull();
        expect(parsed?.executions).toHaveLength(2);

        const [entry] = parsed!.executions;
        expect(entry!.symbol).toBe("AAPL");
        const entryDate = new Date(entry!.executedAt);
        expect(entryDate.getUTCHours()).toBe(expectedHourUtc);
        expect(entryDate.getUTCMinutes()).toBe(30);
      },
    );
  });

  describe("Ambiguous slash dates (MDY vs DMY)", () => {
    it("interprets ambiguous slash dates differently according to dateOrder", () => {
      // 05/01/2026 can be May 1 (MDY) or Jan 5 (DMY)
      const ambiguousCsv = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "05/01/2026 09:30:00,05/01/2026 10:30:00,AAPL,LONG,10,100.00,105.00,50.00,0.00",
      ].join("\n");

      // MDY parsing -> May 1st
      const parsedMdy = parseAuto(ambiguousCsv, {
        dateOrder: "MDY",
        timeZone: "UTC",
      });
      expect(parsedMdy).not.toBeNull();
      expect(parsedMdy?.executions[0]?.executedAt).toBe("2026-05-01T09:30:00.000Z");

      // DMY parsing -> January 5th
      const parsedDmy = parseAuto(ambiguousCsv, {
        dateOrder: "DMY",
        timeZone: "UTC",
      });
      expect(parsedDmy).not.toBeNull();
      expect(parsedDmy?.executions[0]?.executedAt).toBe("2026-01-05T09:30:00.000Z");
    });

    it("auto-resolves unambiguous slash dates regardless of dateOrder parameter", () => {
      // 25/01/2026 (day 25 > 12) must be DMY
      const unambiguousDmy = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "25/01/2026 09:30:00,25/01/2026 10:30:00,AAPL,LONG,10,100.00,105.00,50.00,0.00",
      ].join("\n");

      const resDmy = parseAuto(unambiguousDmy, {
        dateOrder: "MDY",
        timeZone: "UTC",
      });
      expect(resDmy?.executions[0]?.executedAt).toBe("2026-01-25T09:30:00.000Z");

      // 01/25/2026 (day 25 > 12) must be MDY
      const unambiguousMdy = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "01/25/2026 09:30:00,01/25/2026 10:30:00,AAPL,LONG,10,100.00,105.00,50.00,0.00",
      ].join("\n");

      const resMdy = parseAuto(unambiguousMdy, {
        dateOrder: "DMY",
        timeZone: "UTC",
      });
      expect(resMdy?.executions[0]?.executedAt).toBe("2026-01-25T09:30:00.000Z");
    });
  });

  describe("Implicit fee reconciliation (fees = gross - netPnl)", () => {
    it("reconciles implied fees when TradeZella stated Net P&L includes unstated exchange fees (long)", () => {
      // Long 100 @ 185 -> 187: Gross is $200.00.
      // Explicit commissions in CSV: $2.00.
      // Stated Net P&L in CSV: $192.50 (an unstated $5.50 extra fee was deducted).
      const csv = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "2026-01-05 09:31:00,2026-01-05 10:15:00,AAPL,LONG,100,185.00,187.00,192.50,2.00",
      ].join("\n");

      const parsed = parseAuto(csv)!;
      expect(parsed.executions).toHaveLength(2);

      const [entry, exit] = parsed.executions;
      expect(entry!.fee).toBe(0);
      // Exit fee reconciled: 200 - 192.50 = 7.50
      expect(exit!.fee).toBeCloseTo(7.50, 4);

      const trips = buildRoundTrips(toExecutions(parsed.executions));
      expect(trips).toHaveLength(1);
      expect(trips[0]!.grossPnl).toBe(200.00);
      expect(trips[0]!.fees).toBe(7.50);
      expect(trips[0]!.netPnl).toBe(192.50);
    });

    it("reconciles implied fees when TradeZella stated Net P&L includes unstated fees (short)", () => {
      // Short 50 @ 240 -> 242: Gross is -$100.00.
      // Explicit commissions in CSV: $0.00.
      // Stated Net P&L in CSV: -$103.50 (net loss includes $3.50 fee).
      const csv = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "2026-01-06 09:45:00,2026-01-06 09:52:00,TSLA,SHORT,50,240.00,242.00,-103.50,0.00",
      ].join("\n");

      const parsed = parseAuto(csv)!;
      expect(parsed.executions).toHaveLength(2);

      const [, exit] = parsed.executions;
      // Exit fee reconciled: gross (-100) - net (-103.50) = 3.50
      expect(exit!.fee).toBeCloseTo(3.50, 4);

      const trips = buildRoundTrips(toExecutions(parsed.executions));
      expect(trips).toHaveLength(1);
      expect(trips[0]!.grossPnl).toBe(-100.00);
      expect(trips[0]!.fees).toBe(3.50);
      expect(trips[0]!.netPnl).toBe(-103.50);
      expect(trips[0]!.direction).toBe("short");
    });

    it("guards against absurd divergence when contract multipliers are present", () => {
      // NQ futures: 1 contract @ 17000 -> 17010 (price move 10 pts).
      // Stated Net P&L = $195.00 (because NQ point value = $20, gross = $200, fee = $5).
      // Without multiplier in importer, raw price gross = (17010 - 17000) * 1 = 10.
      // Implied fees would be 10 - 195 = -185 (absurd divergence > 0.5 * 10 + 100 = 105).
      // Importer retains explicit commission ($5.00) rather than computing an absurd fee.
      const csv = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        "2026-01-10 09:30:00,2026-01-10 10:00:00,NQ,LONG,1,17000.00,17010.00,195.00,5.00",
      ].join("\n");

      const parsed = parseAuto(csv)!;
      expect(parsed.executions).toHaveLength(2);
      const [, exit] = parsed.executions;
      expect(exit!.fee).toBe(5.00);
    });
  });

  describe("Corrupted row tokens and missing columns handled gracefully", () => {
    it("safely skips malformed, empty, and non-numeric rows without throwing unhandled exceptions", () => {
      const corruptedRows = [
        ",,,,,,,,",
        "CORRUPTED_TEXT_ROW_WITHOUT_DELIMITERS",
        "2026-01-05 09:30:00,2026-01-05 10:00:00,,LONG,100,185.00,187.00,195.00,5.00",
        "2026-01-05 09:30:00,2026-01-05 10:00:00,AAPL,LONG,NaN,185.00,187.00,195.00,5.00",
        "2026-01-05 09:30:00,2026-01-05 10:00:00,AAPL,LONG,0,185.00,187.00,195.00,5.00",
        "2026-01-05 09:30:00,2026-01-05 10:00:00,AAPL,LONG,10,NaN,187.00,195.00,5.00",
        "2026-01-05 09:30:00,2026-01-05 10:00:00,AAPL,LONG,10,185.00,INVALID_PRICE,195.00,5.00",
        "INVALID_DATE,2026-01-05 10:00:00,AAPL,LONG,10,185.00,187.00,195.00,5.00",
        "2026-01-05 09:30:00,INVALID_DATE,AAPL,LONG,10,185.00,187.00,195.00,5.00",
      ];

      const chaoticCsv = applyChaos(BASE_TRADEZELLA_CSV, {
        corruptedRows,
      });

      const parsed = parseAuto(chaoticCsv);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("tradezella");
      // All 4 valid trades from BASE_TRADEZELLA_CSV yield exactly 8 executions
      expect(parsed?.executions).toHaveLength(8);
      // Completely blank rows are filtered at the tokenizer level; non-empty invalid rows increment skippedRows
      expect(parsed?.skippedRows).toBe(8);
    });
  });

  describe("Multi-batch ingestion and duplication chaos", () => {
    it("preserves total trade executions when split into multiple batches", () => {
      const batches = splitIntoBatches(BASE_TRADEZELLA_CSV, 3);
      expect(batches).toHaveLength(3);

      let totalExecutions = 0;
      for (const batch of batches) {
        const parsed = parseAuto(batch);
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("tradezella");
        totalExecutions += parsed?.executions.length ?? 0;
      }

      expect(totalExecutions).toBe(8); // 4 trades * 2 executions = 8
    });

    it("resists 3x aggressive duplication, temporal shuffling, UTF-8 BOM, and CRLF line endings", () => {
      const chaotic = applyChaos(BASE_TRADEZELLA_CSV, {
        duplicateCount: 3,
        shuffle: true,
        injectBOM: true,
        crlf: true,
      });

      const parsed = parseAuto(chaotic);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("tradezella");
      expect(parsed?.executions).toHaveLength(8 * 3);

      // Deduplication by trade signature
      const uniqueTradeSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      // 4 trades * 2 executions (entry + exit) = 8 unique execution signatures
      expect(uniqueTradeSignatures.size).toBe(8);
    });
  });

  describe("Trade factory object mothers infrastructure", () => {
    it("creates typed executions and imported executions with sensible defaults", () => {
      const imp = createImportedExecution({ symbol: "ES", price: 5000 });
      expect(imp.symbol).toBe("ES");
      expect(imp.price).toBe(5000);
      expect(imp.side).toBe("buy");
      expect(imp.assetClass).toBe("futures");

      const exec = createExecution({ symbol: "NQ", price: 18000 });
      expect(exec.symbol).toBe("NQ");
      expect(exec.price).toBe(18000);
      expect(exec.source).toBe("import");
    });

    it("creates complete round-trip pairs matching FIFO calculations", () => {
      const [longEntry, longExit] = createTradePair({
        symbol: "AAPL",
        direction: "long",
        quantity: 100,
        entryPrice: 185,
        exitPrice: 190,
        entryFee: 1.0,
        exitFee: 1.0,
      });

      const longTrips = buildRoundTrips([longEntry, longExit]);
      expect(longTrips).toHaveLength(1);
      expect(longTrips[0]!.grossPnl).toBe(500);
      expect(longTrips[0]!.fees).toBe(2);
      expect(longTrips[0]!.netPnl).toBe(498);
      expect(longTrips[0]!.direction).toBe("long");

      const [shortEntry, shortExit] = createImportedTradePair({
        symbol: "TSLA",
        direction: "short",
        quantity: 50,
        entryPrice: 240,
        exitPrice: 230,
        entryFee: 0.5,
        exitFee: 0.5,
      });

      expect(shortEntry.side).toBe("sell");
      expect(shortExit.side).toBe("buy");
    });
  });
});
