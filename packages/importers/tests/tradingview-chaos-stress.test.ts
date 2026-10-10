import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { tradingview } from "../src/formats/simple";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const REAL_TV_CSV_PATH = new URL(
  "./fixtures/tradezella/tradingview-tradingview.csv",
  import.meta.url,
);
const REAL_TV_CSV = readFileSync(REAL_TV_CSV_PATH, "utf8");

const DEMO_TV_CSV_PATH = resolve(
  __dirname,
  "../../../docs/samples/demo-trades-tradingview.csv",
);
const DEMO_TV_CSV = readFileSync(DEMO_TV_CSV_PATH, "utf8");

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("TradingView — Chaos & Stress Test Battery", () => {
  describe("Format Detection & Baseline Parsing", () => {
    it("detects TradingView format from headers and content", () => {
      // Arrange & Act
      const detectedReal = detectFormat(REAL_TV_CSV);
      const detectedDemo = detectFormat(DEMO_TV_CSV);

      // Assert
      expect(detectedReal?.id).toBe("tradingview");
      expect(detectedDemo?.id).toBe("tradingview");
    });

    it("parses real TradingView export extracting exactly 32 filled orders and skipping 47 non-filled rows", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_TV_CSV, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("tradingview");
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.skippedRows).toBe(47);
    });

    it("parses high-volume demo TradingView export with 2038 executions without skipped rows", () => {
      // Arrange & Act
      const parsed = parseAuto(DEMO_TV_CSV, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("tradingview");
      expect(parsed?.executions).toHaveLength(2038);
      expect(parsed?.skippedRows).toBe(0);
    });
  });

  describe("Real-world edge cases", () => {
    it("filters Status === 'Filled' and discards Cancelled, Rejected, Expired orders", () => {
      // Arrange
      const csvWithStatuses = [
        "Symbol,Side,Qty,Fill Price,Status,Placing Time,Closing Time",
        "AAPL,Buy,10,150.00,Filled,2025-02-01 10:00:00,2025-02-01 10:05:00",
        "AAPL,Sell,10,155.00,Cancelled,2025-02-01 10:10:00,2025-02-01 10:15:00",
        "TSLA,Buy,5,200.00,Rejected,2025-02-01 10:20:00,2025-02-01 10:25:00",
        "NVDA,Buy,20,120.00,Expired,2025-02-01 10:30:00,2025-02-01 10:35:00",
        "MSFT,Buy,15,400.00,FILLED,2025-02-01 10:40:00,2025-02-01 10:45:00",
        "AMZN,Sell,8,180.00,filled,2025-02-01 10:50:00,2025-02-01 10:55:00",
      ].join("\n");

      // Act
      const parsed = parseAuto(csvWithStatuses, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(3);
      expect(parsed?.executions.map((e) => e.symbol)).toEqual(["AAPL", "MSFT", "AMZN"]);
      expect(parsed?.skippedRows).toBe(3);
    });

    it("strips exchange prefixes from symbol names", () => {
      // Arrange
      const [firstExec] = parseAuto(REAL_TV_CSV, { timeZone: "UTC" })!.executions;

      // Assert: "CME_MINI:NQ1!" should normalize to "NQ1!"
      expect(firstExec?.symbol).toBe("NQ1!");

      // Additional symbol variations
      const customCsv = [
        "Symbol,Side,Qty,Fill Price,Status,Closing Time",
        "NASDAQ:AAPL,Buy,100,180.50,Filled,2025-02-03 10:00:00",
        "NYSE:BRK.B,Buy,10,400.00,Filled,2025-02-03 10:01:00",
        "BINANCE:BTCUSDT,Buy,1,95000.00,Filled,2025-02-03 10:02:00",
        "CME:ES1!,Sell,2,5800.25,Filled,2025-02-03 10:03:00",
      ].join("\n");

      const parsedCustom = parseAuto(customCsv, { timeZone: "UTC" });
      expect(parsedCustom?.executions.map((e) => e.symbol)).toEqual([
        "AAPL",
        "BRK.B",
        "BTCUSDT",
        "ES1!",
      ]);
    });

    it("prioritizes Closing Time over Placing Time for execution timestamp", () => {
      // Arrange: Real fixture has Placing Time: 2025-02-03 11:47:59, Closing Time: 2025-02-03 11:49:28
      const parsed = parseAuto(REAL_TV_CSV, { timeZone: "UTC" });
      const firstExec = parsed?.executions[0];

      // Assert
      expect(firstExec).toBeDefined();
      expect(firstExec?.executedAt).toBe("2025-02-03T11:49:28.000Z");

      // Synthetic test explicitly verifying fallback when Closing Time is empty
      const fallbackCsv = [
        "Symbol,Side,Qty,Fill Price,Status,Placing Time,Closing Time",
        "AAPL,Buy,10,150.00,Filled,2025-02-03 09:30:00,2025-02-03 09:45:00",
        "AAPL,Sell,10,155.00,Filled,2025-02-03 10:00:00,",
      ].join("\n");

      const fallbackParsed = parseAuto(fallbackCsv, { timeZone: "UTC" });
      expect(fallbackParsed?.executions[0]?.executedAt).toBe("2025-02-03T09:45:00.000Z");
      expect(fallbackParsed?.executions[1]?.executedAt).toBe("2025-02-03T10:00:00.000Z");
    });

    it("parses monetary values with formatted commas and currency symbols without corrupting values", () => {
      // Arrange: Real fixture has Margin: "64,236.75 USD", and tests prices/fees with commas & currency symbols
      const csvWithCurrencyStrings = [
        "Symbol,Side,Qty,Fill Price,Commission,Status,Margin,Closing Time",
        `CME_MINI:NQ1!,Buy,3,"21,412.00","$5.1389",Filled,"64,236.75 USD",2025-02-03 11:49:28`,
        `CME_MINI:ES1!,Sell,2,"5,850.50","$3.50",Filled,"25,000.00 USD",2025-02-03 12:00:00`,
      ].join("\n");

      // Act
      const parsed = parseAuto(csvWithCurrencyStrings, { timeZone: "UTC" });

      // Assert
      expect(parsed?.executions).toHaveLength(2);
      expect(parsed?.executions[0]?.price).toBe(21412);
      expect(parsed?.executions[0]?.fee).toBeCloseTo(5.1389, 4);
      expect(parsed?.executions[1]?.price).toBe(5850.5);
      expect(parsed?.executions[1]?.fee).toBe(3.5);
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    // Vector 1: Multi-batch ingestion
    describe("Vector 1: Multi-batch splitting", () => {
      it("preserves exact cumulative fill count when partitioned across multiple batches", () => {
        // Arrange
        const batches = splitIntoBatches(REAL_TV_CSV, 4);
        expect(batches).toHaveLength(4);

        // Act
        let totalExecutions = 0;
        let totalSkipped = 0;
        for (const batch of batches) {
          const parsed = parseAuto(batch, { timeZone: "UTC" });
          expect(parsed).not.toBeNull();
          expect(parsed?.format).toBe("tradingview");
          totalExecutions += parsed?.executions.length ?? 0;
          totalSkipped += parsed?.skippedRows ?? 0;
        }

        // Assert: 32 filled orders, 47 cancelled orders across partitions
        expect(totalExecutions).toBe(32);
        expect(totalSkipped).toBe(47);
      });
    });

    // Vector 2: Aggressive duplication
    describe("Vector 2: Aggressive duplication resilience", () => {
      it("deduplicates 3x duplicated rows via unique execution signatures", () => {
        // Arrange
        const triplicated = applyChaos(REAL_TV_CSV, { duplicateCount: 3 });

        // Act
        const parsed = parseAuto(triplicated, { timeZone: "UTC" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("tradingview");
        expect(parsed?.executions).toHaveLength(32 * 3);
        expect(parsed?.skippedRows).toBe(47 * 3);

        const uniqueSignatures = new Set(
          parsed?.executions.map(
            (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
          ),
        );
        expect(uniqueSignatures.size).toBe(32);
      });
    });

    // Vector 3: Temporal shuffling & FIFO invariant
    describe("Vector 3: Temporal shuffling & FIFO invariant", () => {
      it("yields identical FIFO round-trip gross and net PnL under random shuffling", () => {
        // Arrange: baseline from demo trades
        const baseParsed = parseAuto(DEMO_TV_CSV, { timeZone: "UTC" })!;
        const baseSorted = [...toExecutions(baseParsed.executions)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );
        const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
        const baseGross = baseTrips.reduce((acc, t) => acc + t.grossPnl, 0);
        const baseFees = baseTrips.reduce((acc, t) => acc + t.fees, 0);
        const baseNet = baseTrips.reduce((acc, t) => acc + t.netPnl, 0);

        // Act & Assert across deterministic seeds
        const seeds = [42, 1337, 9999];
        for (const seed of seeds) {
          const shuffledCsv = applyChaos(DEMO_TV_CSV, { shuffle: true, seed });
          const shuffledParsed = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
          expect(shuffledParsed.executions).toHaveLength(2038);

          const shuffledSorted = [...toExecutions(shuffledParsed.executions)].sort(
            (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
          );
          const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

          expect(shuffledTrips).toHaveLength(baseTrips.length);
          expect(shuffledTrips.reduce((acc, t) => acc + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
          expect(shuffledTrips.reduce((acc, t) => acc + t.fees, 0)).toBeCloseTo(baseFees, 2);
          expect(shuffledTrips.reduce((acc, t) => acc + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
        }
      });
    });

    // Vector 4: Corrupted, malformed, and non-numeric rows
    describe("Vector 4: Corrupted row injection", () => {
      it("safely ignores malformed, non-numeric, and corrupted rows without throwing", () => {
        // Arrange
        const corruptedRows = [
          ",,,,,,,,,,,,,",
          "CORRUPTED_LINE_WITHOUT_COMMAS",
          "NQ1!,Buy,Limit,0,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9991",
          "NQ1!,Buy,Limit,NaN,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9992",
          "NQ1!,Buy,Limit,1,21400,,NaN,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9993",
          ",Buy,Limit,1,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9994",
          "NQ1!,Buy,Limit,1,21400,,21400,Filled,5.00,20:1,,INVALID_DATE,INVALID_DATE,9995",
          "NQ1!,Buy,Limit,1,21400,,INVALID_PRICE,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9996",
          "NQ1!,INVALID_SIDE,Limit,1,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9997",
        ];

        const chaoticCsv = applyChaos(REAL_TV_CSV, { corruptedRows });

        // Act
        const parsed = parseAuto(chaoticCsv, { timeZone: "UTC" });

        // Assert: 32 genuine filled executions remain intact
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("tradingview");
        expect(parsed?.executions).toHaveLength(32);
        expect(parsed?.skippedRows).toBeGreaterThanOrEqual(47 + 5);
      });
    });

    // Vector 5: UTF-8 BOM injection
    describe("Vector 5: UTF-8 BOM handling", () => {
      it("parses UTF-8 BOM injected export identically to plain UTF-8", () => {
        // Arrange
        const bomCsv = applyChaos(REAL_TV_CSV, { injectBOM: true });

        // Act
        const parsed = parseAuto(bomCsv, { timeZone: "UTC" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("tradingview");
        expect(parsed?.executions).toHaveLength(32);
        expect(parsed?.executions[0]?.symbol).toBe("NQ1!");
      });
    });

    // Vector 6: CRLF vs LF line endings
    describe("Vector 6: Line ending resilience", () => {
      it("parses CRLF and LF exports with identical execution counts and properties", () => {
        // Arrange
        const crlfCsv = applyChaos(REAL_TV_CSV, { crlf: true });
        const lfCsv = applyChaos(REAL_TV_CSV, { crlf: false });

        // Act
        const parsedCrlf = parseAuto(crlfCsv, { timeZone: "UTC" });
        const parsedLf = parseAuto(lfCsv, { timeZone: "UTC" });

        // Assert
        expect(parsedCrlf?.executions).toHaveLength(32);
        expect(parsedLf?.executions).toHaveLength(32);
        expect(parsedCrlf?.executions).toEqual(parsedLf?.executions);
      });
    });
  });
});
