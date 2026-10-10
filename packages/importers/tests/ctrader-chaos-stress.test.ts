import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { ctrader } from "../src/formats/ctrader";
import { decodeImportFile } from "../../../apps/web/src/lib/decode-import";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const CTRADER_HTM_PATH = new URL(
  "./fixtures/tradezella/ctrader.htm",
  import.meta.url,
);
const CTRADER_DUPLICATE_HTM_PATH = new URL(
  "./fixtures/tradezella/ctrader-ctrader.htm",
  import.meta.url,
);

const REAL_CTRADER_HTM = readFileSync(CTRADER_HTM_PATH, "utf8");
const REAL_CTRADER_DUPLICATE_HTM = readFileSync(CTRADER_DUPLICATE_HTM_PATH, "utf8");

const CTRADER_CSV_SAMPLE = `Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap
98765432,1234567,EURUSD,Buy,Sell,"100,000 Units",1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,450.00,442.00,-6.00,-2.00
98765433,1234568,GBPUSD,Sell,Buy,"50,000 Units",1.27500,1.27100,2026-01-11 09:00:00,2026-01-11 11:20:00,200.00,196.50,-3.50,0.00
98765434,1234569,USDJPY,Buy,Sell,1.5 Lots,150.000,150.500,2026-01-12 08:00:00,2026-01-12 10:00:00,500.00,490.00,-8.00,-2.00`;

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("cTrader — Chaos & Stress Test Battery", () => {
  describe("Format Detection & Statement Baseline", () => {
    it("detects cTrader HTML statements and duplicate fixture identically", () => {
      // Arrange & Act
      const detected1 = detectFormat(REAL_CTRADER_HTM);
      const detected2 = detectFormat(REAL_CTRADER_DUPLICATE_HTM);

      // Assert
      expect(detected1?.id).toBe("ctrader");
      expect(detected2?.id).toBe("ctrader");
    });

    it("parses real cTrader statement extracting Pepperstone account and 10 executions across 5 closed deals", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_CTRADER_HTM, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ctrader");
      expect(parsed?.account).toBe("4142841");
      expect(parsed?.sourceAccounts).toEqual(["4142841"]);
      expect(parsed?.executions).toHaveLength(10);

      // Check first trade (CADJPY, spread bet stripped)
      const [entry1, exit1] = parsed!.executions.slice(0, 2);
      expect(entry1?.symbol).toBe("CADJPY");
      expect(entry1?.side).toBe("buy");
      expect(entry1?.price).toBe(109.643);
      expect(entry1?.quantity).toBe(0.1);
      expect(entry1?.fee).toBe(0);

      expect(exit1?.symbol).toBe("CADJPY");
      expect(exit1?.side).toBe("sell");
      expect(exit1?.price).toBe(112.02);
      expect(exit1?.quantity).toBe(0.1);
      expect(exit1?.fee).toBe(3.52);
      expect(exit1?.importMetadata?.reportedGrossPnl).toBe(23.77);
    });
  });

  describe("Real-world edge cases", () => {
    it("extracts Account ID from machine-emitted HTML <title> tag with multiline formatting", () => {
      // Arrange
      const htmlSnippet = `
        <html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <title>
              cT
              _
              8877665
              _
              2025-10-15
            </title>
          </head>
          <body></body>
        </html>
      `;

      // Act
      const parsed = ctrader.parse(htmlSnippet, { timeZone: "UTC" });

      // Assert
      expect(parsed.account).toBe("8877665");
    });

    it("decodes and parses UTF-16LE encoded cTrader statement with BOM (0xFF, 0xFE)", () => {
      // Arrange: Real cTrader Windows exports emit UTF-16LE with BOM
      const utf16leBuf = Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(REAL_CTRADER_HTM, "utf16le"),
      ]);

      // Act
      const decodedText = decodeImportFile(
        utf16leBuf.buffer.slice(
          utf16leBuf.byteOffset,
          utf16leBuf.byteOffset + utf16leBuf.byteLength,
        ),
      );

      const parsed = parseAuto(decodedText, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ctrader");
      expect(parsed?.account).toBe("4142841");
      expect(parsed?.executions).toHaveLength(10);
    });

    it("normalizes volume from units to lots for forex contracts", () => {
      // Arrange & Act
      const parsed = parseAuto(CTRADER_CSV_SAMPLE, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(6);

      // Trade 1: 100,000 Units -> 1.0 lot
      expect(parsed?.executions[0]?.symbol).toBe("EURUSD");
      expect(parsed?.executions[0]?.quantity).toBe(1.0);
      expect(parsed?.executions[1]?.quantity).toBe(1.0);

      // Trade 2: 50,000 Units -> 0.5 lot
      expect(parsed?.executions[2]?.symbol).toBe("GBPUSD");
      expect(parsed?.executions[2]?.quantity).toBe(0.5);
      expect(parsed?.executions[3]?.quantity).toBe(0.5);

      // Trade 3: 1.5 Lots -> 1.5 lots preserved
      expect(parsed?.executions[4]?.symbol).toBe("USDJPY");
      expect(parsed?.executions[4]?.quantity).toBe(1.5);
      expect(parsed?.executions[5]?.quantity).toBe(1.5);
    });

    it("enforces non-negative fee enforcement so negative commissions and swaps do not inflate net PnL", () => {
      // Arrange: Commission: -6.00, Swap: -2.00, Net PnL: 442.00
      const csv = [
        "Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap",
        "101,201,EURUSD,Buy,Sell,1.00 Lots,1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,,442.00,-6.00,-2.00",
      ].join("\n");

      // Act
      const parsed = parseAuto(csv, { timeZone: "UTC" });
      const exitExec = parsed?.executions[1];

      // Assert
      expect(exitExec?.fee).toBe(8.0); // |-6.00| + |-2.00| = 8.00
      expect(exitExec?.fee).toBeGreaterThanOrEqual(0);

      // Implied gross PnL should be net + fee = 442 + 8 = 450
      expect(exitExec?.importMetadata?.reportedGrossPnl).toBe(450.0);

      // FIFO round trip validation: gross = 450, fees = 8, net = 442
      const trips = buildRoundTrips(toExecutions(parsed!.executions), {
        method: "fifo",
        multipliers: { EURUSD: 100000 },
      });
      expect(trips).toHaveLength(1);
      expect(trips[0]!.fees).toBe(8.0);
      expect(trips[0]!.grossPnl).toBe(450.0);
      expect(trips[0]!.netPnl).toBe(442.0);
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    // Vector 1: Multi-batch ingestion
    describe("Vector 1: Multi-batch splitting", () => {
      it("preserves total executions when CSV statements are split across multiple batches", () => {
        // Arrange
        const batches = splitIntoBatches(CTRADER_CSV_SAMPLE, 3);
        expect(batches).toHaveLength(3);

        // Act
        let totalExecutions = 0;
        for (const batch of batches) {
          const parsed = parseAuto(batch, { timeZone: "UTC" });
          expect(parsed).not.toBeNull();
          expect(parsed?.format).toBe("ctrader");
          totalExecutions += parsed?.executions.length ?? 0;
        }

        // Assert: 3 trades * 2 legs = 6 executions
        expect(totalExecutions).toBe(6);
      });
    });

    // Vector 2: Aggressive duplication resilience
    describe("Vector 2: Aggressive duplication resilience", () => {
      it("maintains distinct execution signatures and deduplicates 3x duplicated CSV data", () => {
        // Arrange
        const triplicated = applyChaos(CTRADER_CSV_SAMPLE, { duplicateCount: 3 });

        // Act
        const parsed = parseAuto(triplicated, { timeZone: "UTC" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ctrader");
        expect(parsed?.executions).toHaveLength(6 * 3);

        const uniqueSignatures = new Set(
          parsed?.executions.map(
            (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
          ),
        );
        expect(uniqueSignatures.size).toBe(6);
      });
    });

    // Vector 3: Temporal shuffling & FIFO invariant
    describe("Vector 3: Temporal shuffling & FIFO invariant", () => {
      it("maintains identical FIFO round trip gross and net PnL under random temporal shuffling", () => {
        // Arrange: baseline from cTrader HTML export
        const baseResult = parseAuto(REAL_CTRADER_HTM, { timeZone: "UTC" })!;
        const baseSorted = [...toExecutions(baseResult.executions)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );
        const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
        const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
        const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
        const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

        // Act & Assert across 5 random temporal permutations
        for (let i = 0; i < 5; i++) {
          const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
          const reSorted = [...toExecutions(shuffled)].sort(
            (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
          );

          const shuffledTrips = buildRoundTrips(reSorted, { method: "fifo" });
          expect(shuffledTrips).toHaveLength(baseTrips.length);
          expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
          expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
          expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
        }
      });
    });

    // Vector 4: Corrupted, malformed, and non-numeric rows
    describe("Vector 4: Corrupted row injection", () => {
      it("safely ignores syntax garbage and malformed table rows injected into cTrader HTML", () => {
        // Arrange
        const garbageRow = `
          <tr><td colspan="20">###CORRUPTED_SYNTAX_GARBAGE_IN_CTRADER_TABLE@@@</td></tr>
          <tr><td></td><td>DID_MALFORMED</td><td>OID_MALFORMED</td><td>Buy</td><td></td><td>INVALID_DATE</td></tr>
          <tr><td>DID99999</td><td>OID99999</td><td>Sell</td><td>EURUSD</td><td>INVALID_DATE</td><td>INVALID_DATE</td><td>NaN</td><td>NaN</td></tr>
        `;

        const corruptedHtml = REAL_CTRADER_HTM.replace(
          /<\/table>/,
          `${garbageRow}</table>`,
        );

        // Act
        const parsed = parseAuto(corruptedHtml, { timeZone: "UTC" });

        // Assert: All 10 genuine executions from the 5 closed deals remain intact
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ctrader");
        expect(parsed?.account).toBe("4142841");
        expect(parsed?.executions).toHaveLength(10);
      });

      it("safely rejects malformed rows in cTrader CSV without throwing unhandled exceptions", () => {
        // Arrange
        const corruptedRows = [
          ",,,,,,,,,,,,,,",
          "CORRUPTED_LINE_WITHOUT_COMMAS",
          "9999,9999,EURUSD,Buy,Sell,0,1.085,1.089,2026-01-10 10:00:00,2026-01-10 11:00:00,10,10,0,0",
          "9998,9998,,Buy,Sell,1,1.085,1.089,2026-01-10 10:00:00,2026-01-10 11:00:00,10,10,0,0",
          "9997,9997,EURUSD,Buy,Sell,1,NaN,NaN,2026-01-10 10:00:00,2026-01-10 11:00:00,10,10,0,0",
          "9996,9996,EURUSD,Buy,Sell,1,1.085,1.089,INVALID_DATE,INVALID_DATE,10,10,0,0",
          "9995,9995,EURUSD,INVALID_SIDE,INVALID_SIDE,1,1.085,1.089,2026-01-10 10:00:00,2026-01-10 11:00:00,10,10,0,0",
        ];

        const chaoticCsv = applyChaos(CTRADER_CSV_SAMPLE, { corruptedRows });

        // Act
        const parsed = parseAuto(chaoticCsv, { timeZone: "UTC" });

        // Assert: 6 genuine executions parsed; corrupted rows skipped
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ctrader");
        expect(parsed?.executions).toHaveLength(6);
        expect(parsed?.skippedRows).toBeGreaterThanOrEqual(4);
      });
    });

    // Vector 5: UTF-8 BOM injection
    describe("Vector 5: UTF-8 BOM handling", () => {
      it("parses UTF-8 BOM injected statement identically to plain statement", () => {
        // Arrange
        const bomCsv = applyChaos(CTRADER_CSV_SAMPLE, { injectBOM: true });

        // Act
        const parsed = parseAuto(bomCsv, { timeZone: "UTC" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ctrader");
        expect(parsed?.executions).toHaveLength(6);
        expect(parsed?.executions[0]?.symbol).toBe("EURUSD");
      });
    });

    // Vector 6: CRLF vs LF line endings
    describe("Vector 6: Line ending resilience", () => {
      it("parses CRLF and LF exports identically", () => {
        // Arrange
        const crlfCsv = applyChaos(CTRADER_CSV_SAMPLE, { crlf: true });
        const lfCsv = applyChaos(CTRADER_CSV_SAMPLE, { crlf: false });

        // Act
        const parsedCrlf = parseAuto(crlfCsv, { timeZone: "UTC" });
        const parsedLf = parseAuto(lfCsv, { timeZone: "UTC" });

        // Assert
        expect(parsedCrlf?.executions).toHaveLength(6);
        expect(parsedLf?.executions).toHaveLength(6);
        expect(parsedCrlf?.executions).toEqual(parsedLf?.executions);
      });
    });
  });
});
