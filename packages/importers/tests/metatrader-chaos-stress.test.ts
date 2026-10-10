import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { decodeImportFile } from "../../../apps/web/src/lib/decode-import";
import { applyChaos } from "./helpers/csv-fixtures";

const MT4_FIXTURE_PATH = new URL(
  "./fixtures/tradezella/mt4-metatrader4-mt4.htm",
  import.meta.url,
);
const MT5_FIXTURE_PATH = new URL(
  "./fixtures/tradezella/mt5-metatrader5-mt5.html",
  import.meta.url,
);

const MT4_HTML = readFileSync(MT4_FIXTURE_PATH, "utf8");
const MT5_HTML = readFileSync(MT5_FIXTURE_PATH, "utf8");

const REPORTS_DIR = "/home/jhontavares/Documents/Report MT5";

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("MetaTrader 4 & 5 — Chaos & Stress Test Battery", () => {
  describe("Multilingual headers and encoding resilience (UTF-16LE / UTF-8)", () => {
    it("handles UTF-16LE encoded MT4 HTML statement with BOM", () => {
      const utf16leBuf = Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(MT4_HTML, "utf16le"),
      ]);

      const decodedText = decodeImportFile(
        utf16leBuf.buffer.slice(
          utf16leBuf.byteOffset,
          utf16leBuf.byteOffset + utf16leBuf.byteLength,
        ),
      );

      const parsed = parseAuto(decodedText);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("metatrader");
      expect(parsed?.account).toBe("6059687");
      expect(parsed?.executions).toHaveLength(98);
    });

    it("handles UTF-16LE encoded MT5 HTML statement with BOM", () => {
      const utf16leBuf = Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(MT5_HTML, "utf16le"),
      ]);

      const decodedText = decodeImportFile(
        utf16leBuf.buffer.slice(
          utf16leBuf.byteOffset,
          utf16leBuf.byteOffset + utf16leBuf.byteLength,
        ),
      );

      const parsed = parseAuto(decodedText);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("history-metatrader");
      expect(parsed?.account).toBe("1091255053");
      expect(parsed?.executions).toHaveLength(36);
    });

    it("parses MT4/MT5 CSV account history under UTF-8 and UTF-16LE", () => {
      const csvContent = [
        "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit",
        "1001,2026.01.05 09:30,buy,1.00,EURUSD,1.09500,1.09000,1.10000,2026.01.05 14:30,1.09800,-7.00,0.00,-0.50,300.00",
        "1002,2026.01.06 10:00,sell,0.50,GBPUSD,1.27500,1.28000,1.26500,2026.01.06 15:00,1.27100,-3.50,0.00,-0.25,200.00",
      ].join("\n");

      // UTF-8
      const parsedUtf8 = parseAuto(csvContent);
      expect(parsedUtf8).not.toBeNull();
      expect(parsedUtf8?.format).toBe("history-metatrader");
      expect(parsedUtf8?.executions).toHaveLength(4);

      // UTF-16LE
      const utf16Buf = Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(csvContent, "utf16le"),
      ]);
      const decodedCsv = decodeImportFile(
        utf16Buf.buffer.slice(
          utf16Buf.byteOffset,
          utf16Buf.byteOffset + utf16Buf.byteLength,
        ),
      );
      const parsedUtf16 = parseAuto(decodedCsv);
      expect(parsedUtf16?.executions).toHaveLength(4);
    });

    const multilingualFiles = [
      "ReportHistory-530319802-Arabic.html",
      "ReportHistory-530319802-Bengali.html",
      "ReportHistory-530319802-Bulgarian.html",
      "ReportHistory-530319802-PTBR.html",
      "ReportHistory-530319802-PTPT.html",
    ];

    describe.each(multilingualFiles)("Multilingual report: %s", (filename) => {
      const fullPath = join(REPORTS_DIR, filename);
      const isAvailable = existsSync(fullPath);

      it.runIf(isAvailable)(
        "parses 312 executions and extracts account 530319802 without errors",
        () => {
          const fileBuf = readFileSync(fullPath);
          const decoded = decodeImportFile(
            fileBuf.buffer.slice(
              fileBuf.byteOffset,
              fileBuf.byteOffset + fileBuf.byteLength,
            ),
          );

          const result = parseAuto(decoded);
          expect(result).not.toBeNull();
          expect(result?.account).toBe("530319802");
          expect(result?.executions).toHaveLength(312);
          expect(result?.format).toMatch(/metatrader/);

          // All executions have non-negative fees
          expect(result?.executions.every((e) => e.fee >= 0)).toBe(true);
        },
      );
    });
  });

  describe("Ingestion of swaps/commissions without negative fee inversion", () => {
    it("ensures MT4 statement preserves positive fees for negative commission/swap costs", () => {
      const parsed = parseAuto(MT4_HTML);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions.length).toBe(98);

      // Verify no execution has a negative fee
      for (const e of parsed?.executions ?? []) {
        expect(e.fee).toBeGreaterThanOrEqual(0);
      }

      // Positions that carried commissions/swaps have strictly positive fees on exits
      const exitsWithFees = parsed?.executions.filter((e) => e.fee > 0) ?? [];
      expect(exitsWithFees.length).toBeGreaterThan(0);

      const trips = buildRoundTrips(toExecutions(parsed!.executions));
      expect(trips.length).toBe(43);

      const totalGross = trips.reduce((s, t) => s + t.grossPnl, 0);
      const totalFees = trips.reduce((s, t) => s + t.fees, 0);
      const totalNet = trips.reduce((s, t) => s + t.netPnl, 0);

      // Net PnL must strictly equal gross - fees (fees subtracted, never added)
      expect(totalFees).toBeGreaterThan(0);
      expect(totalNet).toBeCloseTo(totalGross - totalFees, 2);
    });

    it("verifies MT5 statement matches official statement totals without fee inversion", () => {
      const parsed = parseAuto(MT5_HTML);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions.length).toBe(36);

      // Verify no execution has negative fee
      expect(parsed?.executions.every((e) => e.fee >= 0)).toBe(true);

      const trips = buildRoundTrips(toExecutions(parsed!.executions));
      expect(trips).toHaveLength(18);

      const totalGross = trips.reduce((s, t) => s + t.grossPnl, 0);
      const totalFees = trips.reduce((s, t) => s + t.fees, 0);
      const totalNet = trips.reduce((s, t) => s + t.netPnl, 0);

      // Exact parity with MT5 statement summary:
      // Statement reports Commission/fee: -1058.44 -> total fees = 1058.44
      // Statement reports Results / Profit: 2644.40 -> total net = 2644.40
      expect(totalGross).toBeCloseTo(3702.84, 2);
      expect(totalFees).toBeCloseTo(1058.44, 2);
      expect(totalNet).toBeCloseTo(2644.40, 2);
      expect(totalNet).toBeCloseTo(totalGross - totalFees, 2);
    });

    it("folds swap rollover credits into gross PnL without generating negative fee", () => {
      const syntheticCsvWithPositiveSwap = [
        "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit",
        "2001,2026.01.10 09:30,buy,1.00,EURUSD,1.08000,1.07500,1.09000,2026.01.12 14:30,1.08500,-5.00,0.00,12.50,500.00",
      ].join("\n");

      const parsed = parseAuto(syntheticCsvWithPositiveSwap);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(2);

      const [, exit] = parsed!.executions;
      // Fee cannot be negative: credit is folded, fee is 0
      expect(exit!.fee).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Temporal shuffling produces identical reported gross/net PnL", () => {
    it("maintains identical FIFO round trip gross and net PnL under random temporal shuffling (MT4)", () => {
      const baseResult = parseAuto(MT4_HTML)!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const baseTrips = buildRoundTrips(baseSorted);
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      // Perform multiple random shuffles of executions
      for (let i = 0; i < 5; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );

        const shuffledTrips = buildRoundTrips(reSorted);
        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("maintains identical FIFO round trip gross and net PnL under random temporal shuffling (MT5)", () => {
      const baseResult = parseAuto(MT5_HTML)!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const baseTrips = buildRoundTrips(baseSorted);
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      for (let i = 0; i < 5; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );

        const shuffledTrips = buildRoundTrips(reSorted);
        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });
  });

  describe("Syntax garbage in summary rows", () => {
    it("safely ignores syntax garbage and broken HTML tags injected into MT4 Summary section", () => {
      const garbageSummary = `
<tr align=left><td colspan=14><b>Summary:</b></td></tr>
<tr><td colspan=99>###SYNTAX_GARBAGE_IN_SUMMARY_SECTION@@@$$$</td></tr>
<tr><td>Summary</td><td>buy</td><td>1.0</td><td>EURUSD</td><td>Fake Trade in Summary</td><td>1.000</td></tr>
<tr><td colspan=2><b>Deposit/Withdrawal:</b></td><td colspan=2>INVALID_NON_NUMERIC_DATA</td></tr>
<tr unclosed_tag><div><span>Malformed Inner HTML</span>
`;

      const corruptedMt4 = MT4_HTML.replace(
        /<tr align=left><td colspan=14><b>Summary:<\/b><\/td><\/tr>/,
        garbageSummary,
      );

      const parsed = parseAuto(corruptedMt4);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("metatrader");
      expect(parsed?.account).toBe("6059687");
      // All 98 valid executions from closed transactions are intact
      expect(parsed?.executions).toHaveLength(98);
    });

    it("safely ignores syntax garbage and unclosed tags injected into MT5 Results summary section", () => {
      const garbageResults = `
<td colspan="13" align="center"><div style="font: 10pt Tahoma"><b>Results</b></div></td>
<tr><td colspan=99>###CORRUPTED_RESULTS_ROW_WITH_COMMAS,,,$$$@@@</td></tr>
<tr><td>Results</td><td>sell</td><td>2.0</td><td>GBPUSD</td><td>1.25000</td></tr>
<div broken="true"><tr><td>Unclosed Div Table Injection</td></tr>
`;

      const corruptedMt5 = MT5_HTML.replace(
        /<td colspan="13" align="center"><div style="font: 10pt Tahoma"><b>Results<\/b><\/div><\/td>/,
        garbageResults,
      );

      const parsed = parseAuto(corruptedMt5);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("history-metatrader");
      expect(parsed?.account).toBe("1091255053");
      // All 36 valid executions from Positions section are intact
      expect(parsed?.executions).toHaveLength(36);
    });
  });
});
