import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { quantower } from "../src/formats/quantower";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const QUANTOWER_CSV_PATH = new URL(
  "./fixtures/tradezella/quantower.csv",
  import.meta.url,
);
const QUANTOWER_DUPLICATE_CSV_PATH = new URL(
  "./fixtures/tradezella/quantower-quantower.csv",
  import.meta.url,
);

const REAL_QUANTOWER_CSV = readFileSync(QUANTOWER_CSV_PATH, "utf8");
const REAL_QUANTOWER_DUPLICATE_CSV = readFileSync(
  QUANTOWER_DUPLICATE_CSV_PATH,
  "utf8",
);

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: e.importMetadata?.id ?? `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("Quantower — Chaos & Stress Test Battery", () => {
  describe("Format Detection & Baseline Parsing", () => {
    it("detects Quantower format across identical fixtures", () => {
      // Arrange & Act
      const detected1 = detectFormat(REAL_QUANTOWER_CSV);
      const detected2 = detectFormat(REAL_QUANTOWER_DUPLICATE_CSV);

      // Assert
      expect(detected1?.id).toBe("quantower");
      expect(detected2?.id).toBe("quantower");
    });

    it("parses real Quantower CSV with account auto-binding, Trade IDs and 15 executions", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("quantower");
      expect(parsed?.account).toBe("Account (USD)");
      expect(parsed?.sourceAccounts).toEqual(["Account (USD)"]);
      expect(parsed?.executions).toHaveLength(15);
      expect(parsed?.skippedRows).toBe(0);

      // Trade IDs in importMetadata
      expect(parsed?.executions[0]?.importMetadata?.id).toBe("quantower:trade:1");
      expect(parsed?.executions[14]?.importMetadata?.id).toBe("quantower:trade:15");
      expect(parsed?.executions[0]?.assetClass).toBe("crypto");
    });
  });

  describe("Real-world edge cases", () => {
    it("normalizes negative quantity on Sell rows to positive execution quantity", () => {
      // Arrange & Act: Row 2, Row 4, Row 8..15 in quantower.csv have Quantity = -1 on Sell rows
      const parsed = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });
      const sellExec1 = parsed?.executions[1];
      const sellExec2 = parsed?.executions[3];

      // Assert
      expect(sellExec1?.side).toBe("sell");
      expect(sellExec1?.quantity).toBe(1);
      expect(sellExec1?.quantity).toBeGreaterThan(0);

      expect(sellExec2?.side).toBe("sell");
      expect(sellExec2?.quantity).toBe(1);
      expect(sellExec2?.quantity).toBeGreaterThan(0);
    });

    it("preserves extreme decimal precision in crypto lots (e.g. 0.66578506 ETH)", () => {
      // Arrange & Act: Rows 3 and 5 represent partial fills of ETH
      const parsed = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });
      const partial1 = parsed?.executions[2];
      const partial2 = parsed?.executions[4];

      // Assert
      expect(partial1?.symbol).toBe("ETH/USD");
      expect(partial1?.quantity).toBe(0.66578506);

      expect(partial2?.symbol).toBe("ETH/USD");
      expect(partial2?.quantity).toBe(0.33421494);

      // Sum of partial fills recovers exact whole unit
      expect(partial1!.quantity + partial2!.quantity).toBeCloseTo(1.0, 8);
    });

    it("resists trailing commas in header lines without shifting data columns", () => {
      // Arrange: Real fixture header ends with "Exchange,"
      const cleanHeader = REAL_QUANTOWER_CSV.split(/\r?\n/)[0];
      expect(cleanHeader?.endsWith(",")).toBe(true);

      // Act
      const parsed = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(15);
      expect(parsed?.executions[0]?.symbol).toBe("ETH/USD");
      expect(parsed?.executions[0]?.price).toBe(1776.04);
    });

    it("correctly parses 12-hour AM/PM timestamps with UTC offsets into UTC ISO strings", () => {
      // Arrange: "10/25/2023 3:55:47 PM -05:00" -> 15:55:47 EDT (-05:00) = 20:55:47 UTC
      const parsed = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });
      const firstExec = parsed?.executions[0];
      const lastExec = parsed?.executions[14];

      // Assert
      expect(firstExec?.executedAt).toBe("2023-10-25T20:55:47.000Z");
      expect(lastExec?.executedAt).toBe("2023-10-25T20:55:54.000Z");

      // Verify across midnight boundary
      const midnightCsv = [
        "Account,Date/Time,Symbol,Side,Quantity,Price,Trade ID,Exchange,",
        "TestAccount,12/31/2025 11:59:59 PM -05:00,BTC/USD,Buy,1,95000.00,101,KBE,",
        "TestAccount,01/01/2026 12:00:01 AM -05:00,BTC/USD,Sell,1,95100.00,102,KBE,",
      ].join("\n");

      const midnightParsed = parseAuto(midnightCsv, { timeZone: "America/New_York" });
      expect(midnightParsed?.executions[0]?.executedAt).toBe("2026-01-01T04:59:59.000Z");
      expect(midnightParsed?.executions[1]?.executedAt).toBe("2026-01-01T05:00:01.000Z");
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    // Vector 1: Multi-batch splitting
    describe("Vector 1: Multi-batch splitting", () => {
      it("preserves total execution count and unique Trade IDs across 3 batches", () => {
        // Arrange
        const batches = splitIntoBatches(REAL_QUANTOWER_CSV, 3);
        expect(batches).toHaveLength(3);

        // Act
        let totalExecutions = 0;
        const allExecutions: ReturnType<typeof parseAuto>["executions"] = [];
        for (const batch of batches) {
          const parsed = parseAuto(batch, { timeZone: "America/New_York" });
          expect(parsed).not.toBeNull();
          expect(parsed?.format).toBe("quantower");
          totalExecutions += parsed?.executions.length ?? 0;
          if (parsed) allExecutions.push(...parsed.executions);
        }

        // Assert
        expect(totalExecutions).toBe(15);
        const uniqueIds = new Set(allExecutions.map((e) => e.importMetadata?.id));
        expect(uniqueIds.size).toBe(15);
      });
    });

    // Vector 2: Aggressive duplication resilience
    describe("Vector 2: Aggressive duplication resilience", () => {
      it("collapses 3x duplicated rows back to 15 unique execution identities via Trade IDs", () => {
        // Arrange
        const triplicated = applyChaos(REAL_QUANTOWER_CSV, { duplicateCount: 3 });

        // Act
        const parsed = parseAuto(triplicated, { timeZone: "America/New_York" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("quantower");
        expect(parsed?.executions).toHaveLength(15 * 3);

        const uniqueExecutionIds = new Set(
          parsed?.executions.map((e) => e.importMetadata?.id),
        );
        expect(uniqueExecutionIds.size).toBe(15);
      });
    });

    // Vector 3: Temporal shuffling & FIFO invariant
    describe("Vector 3: Temporal shuffling & FIFO invariant", () => {
      it("maintains identical FIFO round trip gross and net PnL under random shuffling", () => {
        // Arrange: baseline from chronological order
        const baseResult = parseAuto(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" })!;
        const baseExecutions = toExecutions(baseResult.executions);
        const baseTrips = buildRoundTrips(baseExecutions, { method: "fifo" });
        const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
        const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
        const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

        // Act & Assert across 5 random seeds
        const seeds = [11, 22, 33, 44, 55];
        for (const seed of seeds) {
          const shuffledCsv = applyChaos(REAL_QUANTOWER_CSV, { shuffle: true, seed });
          const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/New_York" })!;
          expect(shuffledResult.executions).toHaveLength(15);

          const shuffledExecutions = toExecutions(shuffledResult.executions);
          const shuffledTrips = buildRoundTrips(shuffledExecutions, { method: "fifo" });

          expect(shuffledTrips).toHaveLength(baseTrips.length);
          expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 4);
          expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 4);
          expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 4);
        }
      });
    });

    // Vector 4: Corrupted, malformed, and non-numeric rows
    describe("Vector 4: Corrupted row injection", () => {
      it("safely skips malformed rows and tracks skippedRows without throwing exceptions", () => {
        // Arrange
        const corruptedRows = [
          ",,,,,,,,,,,,,,,,,,,,",
          "CORRUPTED_LINE_WITHOUT_COMMAS",
          "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,0,1776.04,0,0,0,0,9991,24,,dxFeed,,KBE,",
          "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,NaN,1776.04,0,0,0,0,9992,24,,dxFeed,,KBE,",
          "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,1,NaN,0,0,0,0,9993,24,,dxFeed,,KBE,",
          "Account,INVALID_TIMESTAMP,ETH/USD,Desc,Crypto,,0,Buy,Market,1,1776.04,0,0,0,0,9994,24,,dxFeed,,KBE,",
          "Account,10/25/2023 3:55:47 PM -05:00,,Desc,Crypto,,0,Buy,Market,1,1776.04,0,0,0,0,9995,24,,dxFeed,,KBE,",
          "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,INVALID_SIDE,Market,1,1776.04,0,0,0,0,9996,24,,dxFeed,,KBE,",
        ];

        const chaoticCsv = applyChaos(REAL_QUANTOWER_CSV, { corruptedRows });

        // Act
        const parsed = parseAuto(chaoticCsv, { timeZone: "America/New_York" });

        // Assert: 15 valid executions parsed, corrupted rows recorded in skippedRows
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("quantower");
        expect(parsed?.executions).toHaveLength(15);
        expect(parsed?.skippedRows).toBeGreaterThanOrEqual(corruptedRows.length - 2);
      });
    });

    // Vector 5: UTF-8 BOM injection
    describe("Vector 5: UTF-8 BOM handling", () => {
      it("handles native and injected UTF-8 BOM transparently", () => {
        // Arrange
        const bomCsv = applyChaos(REAL_QUANTOWER_CSV, { injectBOM: true });

        // Act
        const parsed = parseAuto(bomCsv, { timeZone: "America/New_York" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("quantower");
        expect(parsed?.executions).toHaveLength(15);
        expect(parsed?.account).toBe("Account (USD)");
      });
    });

    // Vector 6: CRLF vs LF line endings
    describe("Vector 6: Line ending resilience", () => {
      it("parses CRLF and LF exports identically", () => {
        // Arrange
        const crlfCsv = applyChaos(REAL_QUANTOWER_CSV, { crlf: true });
        const lfCsv = applyChaos(REAL_QUANTOWER_CSV, { crlf: false });

        // Act
        const parsedCrlf = parseAuto(crlfCsv, { timeZone: "America/New_York" });
        const parsedLf = parseAuto(lfCsv, { timeZone: "America/New_York" });

        // Assert
        expect(parsedCrlf?.executions).toHaveLength(15);
        expect(parsedLf?.executions).toHaveLength(15);
        expect(parsedCrlf?.executions).toEqual(parsedLf?.executions);
      });
    });
  });
});
