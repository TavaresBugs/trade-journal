import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

// ============================================================================
// 12 REAL FIXTURE FILES (Loaded via readFileSync — Zero Synthetic Samples)
// ============================================================================

const IBKR_CSV = readFileSync(new URL("./fixtures/tradezella/ibkr.csv", import.meta.url), "utf8");

const NINJA_REAL_CSV = readFileSync(
  new URL("./fixtures/tradezella/ninjatrader-ninjatrader.csv", import.meta.url),
  "utf8",
);

const NINJA_COPY_CSV = readFileSync(
  new URL("./fixtures/ninjatrader-copy-trades.csv", import.meta.url),
  "utf8",
);

const MT4_HTM = readFileSync(
  new URL("./fixtures/tradezella/mt4-metatrader4-mt4.htm", import.meta.url),
  "utf8",
);

const MT5_HTML = readFileSync(
  new URL("./fixtures/tradezella/mt5-metatrader5-mt5.html", import.meta.url),
  "utf8",
);

const TOPSTEPX_CSV = readFileSync(
  new URL("./fixtures/tradezella/topstepx.csv", import.meta.url),
  "utf8",
);

const TRADOVATE_CSV = readFileSync(
  new URL("./fixtures/tradovate-lucid/Orders.csv", import.meta.url),
  "utf8",
);

const MATCHTRADER_HTML = readFileSync(
  new URL("./fixtures/tradezella/matchtrader.html", import.meta.url),
  "utf8",
);

const TRADINGVIEW_CSV = readFileSync(
  new URL("./fixtures/tradezella/tradingview-tradingview.csv", import.meta.url),
  "utf8",
);

const QUANTOWER_CSV = readFileSync(
  new URL("./fixtures/tradezella/quantower.csv", import.meta.url),
  "utf8",
);

const TOS_CSV = readFileSync(
  new URL("./fixtures/tradezella/thinkorswim.csv", import.meta.url),
  "utf8",
);

const CTRADER_HTM = readFileSync(
  new URL("./fixtures/tradezella/ctrader.htm", import.meta.url),
  "utf8",
);

const RITHMIC_CSV = readFileSync(
  new URL("./fixtures/tradezella/rithmic.csv", import.meta.url),
  "utf8",
);

// Sub-section extractions from multi-section real exports for isolated table manipulation
const RITHMIC_COMPLETED_ORDERS_IDX = RITHMIC_CSV.indexOf('"Account","Status","Remarks"');
const RITHMIC_COMPLETED_ORDERS_CSV = RITHMIC_CSV.slice(RITHMIC_COMPLETED_ORDERS_IDX).trim();

const TOS_HISTORY_START = TOS_CSV.indexOf(",Exec Time,Spread,Side,Qty,Pos Effect,Symbol");
const TOS_HISTORY_END = TOS_CSV.indexOf("\n\n", TOS_HISTORY_START);
const TOS_TRADE_HISTORY_CSV = TOS_CSV.slice(
  TOS_HISTORY_START,
  TOS_HISTORY_END !== -1 ? TOS_HISTORY_END : undefined,
).trim();

// ============================================================================
// HELPER FUNCTIONS FOR HTML TABLE CHAOS & EXECUTION CONVERSION
// ============================================================================

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: e.importMetadata?.id ?? `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

const compareExecutions = (a: Execution, b: Execution): number => {
  const timeDiff = new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return (a.importMetadata?.order ?? 0) - (b.importMetadata?.order ?? 0);
};

/** Partition HTML table data rows across `batchCount` distinct HTML files */
function splitHtmlTableRows(html: string, rowRegex: RegExp, batchCount: number): string[] {
  const matches = [...html.matchAll(rowRegex)].map((m) => m[0]);
  if (!matches.length || batchCount <= 1) return [html];

  const firstIdx = html.indexOf(matches[0]!);
  const lastMatch = matches[matches.length - 1]!;
  const lastIdx = html.indexOf(lastMatch) + lastMatch.length;
  const prefix = html.slice(0, firstIdx);
  const suffix = html.slice(lastIdx);

  const batches: string[] = [];
  const baseSize = Math.floor(matches.length / batchCount);
  const remainder = matches.length % batchCount;
  let start = 0;
  for (let i = 0; i < batchCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = matches.slice(start, start + size);
    start += size;
    if (slice.length > 0) {
      batches.push(`${prefix}${slice.join("\n")}${suffix}`);
    }
  }
  return batches;
}

/** Duplicate matching rows in an HTML export `count` times */
function duplicateHtmlTableRows(html: string, rowRegex: RegExp, count: number): string {
  return html.replace(rowRegex, (match) => Array.from({ length: count }, () => match).join("\n"));
}

// ============================================================================
// 6 UNIVERSAL CHAOS VECTORS ACROSS 12 REAL BROKER FIXTURES
// ============================================================================

describe("Universal Chaos & Stress Test Suite — Real Fixtures", () => {
  // --------------------------------------------------------------------------
  // 1. Interactive Brokers (IBKR) — 675 Executions
  // --------------------------------------------------------------------------
  describe("1. Interactive Brokers (IBKR) — Real Flex Query", () => {
    it("Vector 1: Multi-batch splitting preserves all 675 executions across 5 batches", () => {
      const batches = splitIntoBatches(IBKR_CSV, 5);
      expect(batches).toHaveLength(5);

      let totalExecutions = 0;
      for (const batch of batches) {
        const parsed = parseAuto(batch, { timeZone: "UTC" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ibkr-flex");
        totalExecutions += parsed?.executions.length ?? 0;
      }
      expect(totalExecutions).toBe(675);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to unique execution signatures", () => {
      const triplicated = applyChaos(IBKR_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(675 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      const baseParsed = parseAuto(IBKR_CSV, { timeZone: "UTC" })!;
      const baseUniqueSignatures = new Set(
        baseParsed.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(baseUniqueSignatures.size);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant FIFO round-trip gross and net PnL", () => {
      const baseResult = parseAuto(IBKR_CSV, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      const seeds = [42, 1337, 8888];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(IBKR_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
        expect(shuffledResult.executions).toHaveLength(675);

        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Injected corrupted rows are safely discarded preserving 675 valid fills", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
        "MALFORMED_NON_CSV_LINE_WITHOUT_COMMAS",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,BAD_TIMESTAMP,2,3,ZERO,BUY,1,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BAD_SIDE,1,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BUY,0,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BUY,1,NaN,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
      ];
      const chaotic = applyChaos(IBKR_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(675);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(4);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically to plain LF", () => {
      const chaotic = applyChaos(IBKR_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      const plain = parseAuto(IBKR_CSV, { timeZone: "UTC" })!;

      expect(parsed?.executions).toHaveLength(675);
      expect(parsed?.account).toBe("U2102003");
      expect(parsed?.executions[0]).toEqual(plain.executions[0]);
      expect(parsed?.executions[674]).toEqual(plain.executions[674]);
    });
  });

  // --------------------------------------------------------------------------
  // 2. NinjaTrader — 336 Executions (Full) & 26 Executions (Copy Trades)
  // --------------------------------------------------------------------------
  describe("2. NinjaTrader — Real Exports & Copy Trades", () => {
    it("Vector 1: Multi-batch splitting preserves 336 fills (full) and 26 fills (copy trades)", () => {
      // Full export across 5 batches
      const fullBatches = splitIntoBatches(NINJA_REAL_CSV, 5);
      let fullFills = 0;
      for (const b of fullBatches) {
        const parsed = parseAuto(b, { timeZone: "America/Chicago" });
        fullFills += parsed?.executions.length ?? 0;
      }
      expect(fullFills).toBe(336);

      // Copy trades across 3 batches
      const copyBatches = splitIntoBatches(NINJA_COPY_CSV, 3);
      let copyFills = 0;
      for (const b of copyBatches) {
        const parsed = parseAuto(b, { timeZone: "UTC" });
        copyFills += parsed?.executions.length ?? 0;
      }
      expect(copyFills).toBe(26);
    });

    it("Vector 2: 3x Aggressive duplication collapses to unique execution identities", () => {
      // Full export
      const triplicatedFull = applyChaos(NINJA_REAL_CSV, { duplicateCount: 3 });
      const parsedFull = parseAuto(triplicatedFull, { timeZone: "America/Chicago" });
      expect(parsedFull?.executions).toHaveLength(336 * 3);
      const uniqueFullIds = new Set(parsedFull?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueFullIds.size).toBe(336);

      // Copy trades
      const triplicatedCopy = applyChaos(NINJA_COPY_CSV, { duplicateCount: 3 });
      const parsedCopy = parseAuto(triplicatedCopy, { timeZone: "UTC" });
      expect(parsedCopy?.executions).toHaveLength(26 * 3);
      const multisetCounts = new Map<string, number>();
      for (const e of parsedCopy?.executions ?? []) {
        const key = JSON.stringify([
          e.importMetadata?.group,
          e.symbol,
          e.side,
          e.quantity,
          e.price,
          e.executedAt,
        ]);
        multisetCounts.set(key, (multisetCounts.get(key) || 0) + 1);
      }
      expect(multisetCounts.size).toBe(17);
      let normalizedTotal = 0;
      for (const count of multisetCounts.values()) {
        expect(count % 3).toBe(0);
        normalizedTotal += count / 3;
      }
      expect(normalizedTotal).toBe(26);
    });

    it("Vector 3: Temporal FIFO shuffle maintains exact $5,265 net PnL across 5 copy trades", () => {
      const baseResult = parseAuto(NINJA_COPY_CSV, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo", multipliers: { MNQZ6: 2 } });
      const baseNet = baseTrips.reduce((acc, t) => acc + t.netPnl, 0);
      expect(baseTrips).toHaveLength(5);
      expect(baseNet).toBe(5265);

      const seeds = [101, 202, 303];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(NINJA_COPY_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, {
          method: "fifo",
          multipliers: { MNQZ6: 2 },
        });

        expect(shuffledTrips).toHaveLength(5);
        expect(shuffledTrips.reduce((acc, t) => acc + t.netPnl, 0)).toBe(baseNet);
      }
    });

    it("Vector 4: Corrupted rows are safely discarded without shifting valid identities", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        "NQ 03-24,Buy,0,16793.00,1/17/2024 1:10:38 PM,bad_0,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,-5,16793.00,1/17/2024 1:10:38 PM,bad_neg,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,1,NaN,1/17/2024 1:10:38 PM,bad_nan,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,1,16793.00,NOT_A_TIMESTAMP,bad_time,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,OrderCanceled,1,16793.00,1/17/2024 1:10:38 PM,bad_side,Entry,-,,,$2.29,1,ACC,CONN,",
      ];
      const chaotic = applyChaos(NINJA_COPY_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(26);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(4);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically on both exports", () => {
      const chaoticFull = applyChaos(NINJA_REAL_CSV, { injectBOM: true, crlf: true });
      expect(parseAuto(chaoticFull, { timeZone: "America/Chicago" })?.executions).toHaveLength(336);

      const chaoticCopy = applyChaos(NINJA_COPY_CSV, { injectBOM: true, crlf: true });
      expect(parseAuto(chaoticCopy, { timeZone: "UTC" })?.executions).toHaveLength(26);
    });
  });

  // --------------------------------------------------------------------------
  // 3. MetaTrader 4 — 98 Executions (49 Trades)
  // --------------------------------------------------------------------------
  describe("3. MetaTrader 4 — Real HTML Statement", () => {
    // Regex matching closed transaction table rows
    const mt4ClosedRowRegex =
      /<tr(?: bgcolor=[^>]+)? align=right><td title="[^"]*">\d+<\/td><td class=msdate[^>]*>[\s\S]*?<td>(?:buy|sell)<\/td>[\s\S]*?<td class=msdate[^>]*>[\s\S]*?<\/tr>/gi;

    it("Vector 1: Table partitioning preserves all 98 executions across 3 partitioned batches", () => {
      const batches = splitHtmlTableRows(MT4_HTM, mt4ClosedRowRegex, 3);
      expect(batches).toHaveLength(3);

      let totalExecutions = 0;
      for (const batch of batches) {
        const parsed = parseAuto(batch);
        totalExecutions += parsed?.executions.length ?? 0;
      }
      expect(totalExecutions).toBe(98);
    });

    it("Vector 2: 3x Aggressive row duplication produces 294 executions collapsing to base signatures", () => {
      const triplicated = duplicateHtmlTableRows(MT4_HTM, mt4ClosedRowRegex, 3);
      const parsed = parseAuto(triplicated);
      expect(parsed?.executions).toHaveLength(98 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      const baseParsed = parseAuto(MT4_HTM)!;
      const baseUniqueSignatures = new Set(
        baseParsed.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(baseUniqueSignatures.size);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant FIFO round-trip gross and net PnL", () => {
      const baseResult = parseAuto(MT4_HTM)!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);
      expect(baseTrips).toHaveLength(43);

      for (let i = 0; i < 3; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(reSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Malformed HTML syntax garbage in Summary section is safely ignored", () => {
      const garbageSummary = `
<tr align=left><td colspan=14><b>Summary:</b></td></tr>
<tr><td colspan=99>###SYNTAX_GARBAGE_IN_SUMMARY_SECTION@@@$$$</td></tr>
<tr><td>Summary</td><td>buy</td><td>1.0</td><td>EURUSD</td><td>Fake Trade</td><td>1.000</td></tr>
<tr unclosed_tag><div><span>Malformed Inner HTML</span>
`;
      const corrupted = MT4_HTM.replace(
        /<tr align=left><td colspan=14><b>Summary:<\/b><\/td><\/tr>/,
        garbageSummary,
      );
      const parsed = parseAuto(corrupted);
      expect(parsed?.format).toBe("metatrader");
      expect(parsed?.account).toBe("6059687");
      expect(parsed?.executions).toHaveLength(98);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const bomCrlf = `\uFEFF${MT4_HTM.replace(/\r?\n/g, "\r\n")}`;
      const parsed = parseAuto(bomCrlf);
      expect(parsed?.executions).toHaveLength(98);
      expect(parsed?.account).toBe("6059687");
    });
  });

  // --------------------------------------------------------------------------
  // 4. MetaTrader 5 — 36 Executions (18 Positions)
  // --------------------------------------------------------------------------
  describe("4. MetaTrader 5 — Real HTML Report", () => {
    const mt5PosRowRegex = /<tr bgcolor="#[A-Fa-f0-9]+"[^>]*>[\s\S]*?<\/tr>/gi;

    it("Vector 1: Positions table partitioning preserves all 36 executions across 3 batches", () => {
      const batches = splitHtmlTableRows(MT5_HTML, mt5PosRowRegex, 3);
      expect(batches).toHaveLength(3);

      let totalExecutions = 0;
      for (const batch of batches) {
        const parsed = parseAuto(batch);
        totalExecutions += parsed?.executions.length ?? 0;
      }
      expect(totalExecutions).toBe(36);
    });

    it("Vector 2: 3x Aggressive duplication collapses via dedupeSafe to 36 executions", () => {
      const triplicated = duplicateHtmlTableRows(MT5_HTML, mt5PosRowRegex, 3);
      const parsed = parseAuto(triplicated);
      // MetaTrader adapter automatically deduplicates safe duplicate position rows
      expect(parsed?.executions).toHaveLength(36);
      expect(parsed?.warnings.join(" ")).toContain("duplicate trade");

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(36);
    });

    it("Vector 3: Temporal FIFO shuffle maintains exact 3702.84 gross and 2644.40 net PnL", () => {
      const baseResult = parseAuto(MT5_HTML)!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      expect(baseTrips).toHaveLength(18);

      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);
      expect(baseGross).toBeCloseTo(3702.84, 2);
      expect(baseFees).toBeCloseTo(1058.44, 2);
      expect(baseNet).toBeCloseTo(2644.4, 2);

      for (let i = 0; i < 3; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(reSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(18);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Malformed rows injected into Results summary section are safely ignored", () => {
      const garbageResults = `
<td colspan="13" align="center"><div style="font: 10pt Tahoma"><b>Results</b></div></td>
<tr><td colspan=99>###CORRUPTED_RESULTS_ROW_WITH_COMMAS,,,$$$@@@</td></tr>
<tr><td>Results</td><td>sell</td><td>2.0</td><td>GBPUSD</td><td>1.25000</td></tr>
<div broken="true"><tr><td>Unclosed Div Table Injection</td></tr>
`;
      const corrupted = MT5_HTML.replace(
        /<td colspan="13" align="center"><div style="font: 10pt Tahoma"><b>Results<\/b><\/div><\/td>/,
        garbageResults,
      );
      const parsed = parseAuto(corrupted);
      expect(parsed?.format).toBe("history-metatrader");
      expect(parsed?.account).toBe("1091255053");
      expect(parsed?.executions).toHaveLength(36);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const bomCrlf = `\uFEFF${MT5_HTML.replace(/\r?\n/g, "\r\n")}`;
      const parsed = parseAuto(bomCrlf);
      expect(parsed?.executions).toHaveLength(36);
      expect(parsed?.account).toBe("1091255053");
    });
  });

  // --------------------------------------------------------------------------
  // 5. TopstepX — 76 Executions (38 Trades)
  // --------------------------------------------------------------------------
  describe("5. TopstepX — Real CSV Export", () => {
    it("Vector 1: Multi-batch splitting preserves 76 executions and all unique IDs across 4 batches", () => {
      const batches = splitIntoBatches(TOPSTEPX_CSV, 4);
      expect(batches).toHaveLength(4);

      let totalExecutions = 0;
      const allExecs: ReturnType<typeof parseAuto>["executions"] = [];
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "America/Chicago" });
        totalExecutions += parsed?.executions.length ?? 0;
        if (parsed) allExecs.push(...parsed.executions);
      }
      expect(totalExecutions).toBe(76);
      const uniqueIds = new Set(allExecs.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(76);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to 76 unique execution IDs", () => {
      const triplicated = applyChaos(TOPSTEPX_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76 * 3);

      const uniqueIds = new Set(parsed?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(76);
    });

    it("Vector 3: Temporal FIFO shuffle maintains exact Gross -$315.00 and Net -$385.00", () => {
      const baseResult = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo", multipliers: { NQM4: 20 } });

      const baseGross = baseTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
      const baseNet = baseTrips.reduce((acc, rt) => acc + rt.netPnl, 0);
      expect(baseTrips).toHaveLength(38);
      expect(baseGross).toBe(-315.0);
      expect(baseNet).toBeCloseTo(-385.0, 2);

      const seeds = [12345, 67890, 54321];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(TOPSTEPX_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/Chicago" })!;
        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, {
          method: "fifo",
          multipliers: { NQM4: 20 },
        });

        expect(shuffledTrips).toHaveLength(38);
        expect(shuffledTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(baseGross);
        expect(shuffledTrips.reduce((acc, rt) => acc + rt.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Injected corrupted rows are safely discarded preserving 76 valid fills", () => {
      const corruptedRows = [
        "",
        ",,,,,,,,,,",
        "CORRUPTED_ROW_WITHOUT_COMMAS",
        "99901,NQM4,INVALID_DATE,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
        "99902,NQM4,05/07/2024 13:33:37,INVALID_DATE,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
        "99903,,05/07/2024 13:33:37,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
        "99904,NQM4,05/07/2024 13:33:37,05/07/2024 13:34:07,NaN,18223.75,1.40,90.0,1,Short,05/07/2024",
      ];
      const chaotic = applyChaos(TOPSTEPX_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.skippedRows).toBeGreaterThan(0);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const chaotic = applyChaos(TOPSTEPX_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.executions[0]?.symbol).toBe("NQM4");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Tradovate / Lucid Trading — 76 Executions
  // --------------------------------------------------------------------------
  describe("6. Tradovate / Lucid Trading — Real Orders.csv", () => {
    it("Vector 1: Multi-batch splitting preserves all 76 fills across 4 partitions", () => {
      const batches = splitIntoBatches(TRADOVATE_CSV, 4);
      expect(batches).toHaveLength(4);

      let cumulative = 0;
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "America/Chicago" });
        cumulative += parsed?.executions.length ?? 0;
      }
      expect(cumulative).toBe(76);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to 76 unique fill signatures", () => {
      const triplicated = applyChaos(TRADOVATE_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(76);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant round-trip gross and net PnL", () => {
      const baseResult = parseAuto(TRADOVATE_CSV, { timeZone: "America/Chicago" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, {
        method: "fifo",
        multipliers: { MES: 5, MNQ: 2 },
      });
      const baseGross = baseTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
      const baseNet = baseTrips.reduce((acc, rt) => acc + rt.netPnl, 0);

      const seeds = [777, 888, 999];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(TRADOVATE_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/Chicago" })!;
        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, {
          method: "fifo",
          multipliers: { MES: 5, MNQ: 2 },
        });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(baseGross);
        expect(shuffledTrips.reduce((acc, rt) => acc + rt.netPnl, 0)).toBe(baseNet);
      }
    });

    it("Vector 4: Malformed, cancelled, and rejected order rows are safely rejected", () => {
      const corruptedRows = [
        "999999999999,LFE0506847043001,999999999999, Buy,MESM6,MES,Micro E-mini S&P 500,,,,999999999999, Canceled,-2,0,0.25,,999999999999,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
        "888888888888,LFE0506847043001,888888888888, Sell,MESM6,MES,Micro E-mini S&P 500,,,,888888888888, Rejected,-2,0,0.25,,888888888888,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
        ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        "777777777777,LFE0506847043001,777777777777, Buy,MESM6,MES,Micro E-mini S&P 500,NaN,NaN,INVALID_TIMESTAMP,777777777777, Filled,-2,0,0.25,,777777777777,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
      ];
      const chaotic = applyChaos(TRADOVATE_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const chaotic = applyChaos(TRADOVATE_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.account).toBe("LFE0506847043001");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Match-Trader — 32 Executions (16 Closed Positions)
  // --------------------------------------------------------------------------
  describe("7. Match-Trader — Real HTML Export", () => {
    const matchTraderRowRegex = /<tr align="center"[^>]*><td>(W\d+)<\/td>[\s\S]*?<\/tr>/gi;

    it("Vector 1: Table partitioning preserves 32 executions and all unique IDs across 3 batches", () => {
      const batches = splitHtmlTableRows(MATCHTRADER_HTML, matchTraderRowRegex, 3);
      expect(batches).toHaveLength(3);

      let total = 0;
      const allExecs: ReturnType<typeof parseAuto>["executions"] = [];
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "UTC" });
        total += parsed?.executions.length ?? 0;
        if (parsed) allExecs.push(...parsed.executions);
      }
      expect(total).toBe(32);
      const uniqueIds = new Set(allExecs.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(32);
    });

    it("Vector 2: 3x Aggressive duplication yields 96 executions collapsing to 32 signatures", () => {
      const triplicated = duplicateHtmlTableRows(MATCHTRADER_HTML, matchTraderRowRegex, 3);
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(32);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant FIFO round-trip gross and net PnL", () => {
      const baseResult = parseAuto(MATCHTRADER_HTML, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      for (let i = 0; i < 3; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(reSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Malformed rows injected into Match-Trader table are safely discarded", () => {
      const garbageRows = `
<tr><td colspan="15">###CORRUPTED_SYNTAX_GARBAGE_IN_MATCHTRADER_TABLE@@@</td></tr>
<tr align="center"><td>W99999</td><td></td><td>INVALID_DATE</td><td>0</td><td>BUY</td><td>INVALID_DATE</td><td>NaN</td><td>NaN</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>User</td></tr>
<tr align="center"><td>W99998</td><td>USDJPY</td><td>19.02.2025 04:44:10</td><td>0</td><td>SELL</td><td>19.02.2025 05:56:35</td><td>151.811</td><td>151.754</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>User</td></tr>
`;
      const corrupted = MATCHTRADER_HTML.replace(/<\/table>/, `${garbageRows}</table>`);
      const parsed = parseAuto(corrupted, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(2);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const bomCrlf = `\uFEFF${MATCHTRADER_HTML.replace(/\r?\n/g, "\r\n")}`;
      const parsed = parseAuto(bomCrlf, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.account).toBe("19286");
    });
  });

  // --------------------------------------------------------------------------
  // 8. TradingView — 32 Executions (47 Skipped Rows)
  // --------------------------------------------------------------------------
  describe("8. TradingView — Real Export", () => {
    it("Vector 1: Multi-batch splitting preserves 32 filled executions and 47 skipped rows across 4 partitions", () => {
      const batches = splitIntoBatches(TRADINGVIEW_CSV, 4);
      expect(batches).toHaveLength(4);

      let totalFilled = 0;
      let totalSkipped = 0;
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "UTC" });
        totalFilled += parsed?.executions.length ?? 0;
        totalSkipped += parsed?.skippedRows ?? 0;
      }
      expect(totalFilled).toBe(32);
      expect(totalSkipped).toBe(47);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to 32 unique execution signatures", () => {
      const triplicated = applyChaos(TRADINGVIEW_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32 * 3);
      expect(parsed?.skippedRows).toBe(47 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(32);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant round-trip gross and net PnL", () => {
      const baseResult = parseAuto(TRADINGVIEW_CSV, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((acc, t) => acc + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((acc, t) => acc + t.fees, 0);
      const baseNet = baseTrips.reduce((acc, t) => acc + t.netPnl, 0);

      const seeds = [42, 1337, 9999];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(TRADINGVIEW_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
        expect(shuffledResult.executions).toHaveLength(32);

        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((acc, t) => acc + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((acc, t) => acc + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((acc, t) => acc + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Malformed, non-numeric, and corrupted rows are safely discarded", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        "NQ1!,Buy,Limit,0,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9991",
        "NQ1!,Buy,Limit,NaN,21400,,21400,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9992",
        "NQ1!,Buy,Limit,1,21400,,NaN,Filled,5.00,20:1,,2025-02-03 11:47:59,2025-02-03 11:49:28,9993",
      ];
      const chaotic = applyChaos(TRADINGVIEW_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(47 + 3);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const chaotic = applyChaos(TRADINGVIEW_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.executions[0]?.symbol).toBe("NQ1!");
    });
  });

  // --------------------------------------------------------------------------
  // 9. Quantower — 15 Executions
  // --------------------------------------------------------------------------
  describe("9. Quantower — Real CSV Export", () => {
    it("Vector 1: Multi-batch splitting preserves 15 executions and all 15 unique Trade IDs", () => {
      const batches = splitIntoBatches(QUANTOWER_CSV, 3);
      expect(batches).toHaveLength(3);

      let total = 0;
      const allExecs: ReturnType<typeof parseAuto>["executions"] = [];
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "America/New_York" });
        total += parsed?.executions.length ?? 0;
        if (parsed) allExecs.push(...parsed.executions);
      }
      expect(total).toBe(15);
      const uniqueIds = new Set(allExecs.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(15);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to 15 unique Trade IDs", () => {
      const triplicated = applyChaos(QUANTOWER_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/New_York" });
      expect(parsed?.executions).toHaveLength(15 * 3);

      const uniqueIds = new Set(parsed?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(15);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant round-trip gross and net PnL", () => {
      const baseResult = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      const seeds = [11, 22, 33];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(QUANTOWER_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/New_York" })!;
        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 4);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 4);
      }
    });

    it("Vector 4: Corrupted row injection is safely skipped preserving 15 executions", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,0,1776.04,0,0,0,0,9991,24,,dxFeed,,KBE,",
        "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,NaN,1776.04,0,0,0,0,9992,24,,dxFeed,,KBE,",
        "Account,10/25/2023 3:55:47 PM -05:00,ETH/USD,Desc,Crypto,,0,Buy,Market,1,NaN,0,0,0,0,9993,24,,dxFeed,,KBE,",
      ];
      const chaotic = applyChaos(QUANTOWER_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "America/New_York" });
      expect(parsed?.executions).toHaveLength(15);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(3);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const chaotic = applyChaos(QUANTOWER_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "America/New_York" });
      expect(parsed?.executions).toHaveLength(15);
      expect(parsed?.account).toBe("Account (USD)");
    });
  });

  // --------------------------------------------------------------------------
  // 10. ThinkorSwim — 13 Executions
  // --------------------------------------------------------------------------
  describe("10. ThinkorSwim — Real Statement & Trade History", () => {
    it("Vector 1: Multi-batch splitting preserves all 13 executions across 4 batches", () => {
      const batches = splitIntoBatches(TOS_TRADE_HISTORY_CSV, 4);
      expect(batches).toHaveLength(4);

      let total = 0;
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "America/Chicago" });
        total += parsed?.executions.length ?? 0;
      }
      expect(total).toBe(13);
    });

    it("Vector 2: 3x Aggressive duplication yields 39 executions collapsing to 13 normalized", () => {
      const triplicated = applyChaos(TOS_TRADE_HISTORY_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(13 * 3);

      const signatureCounts = new Map<string, number>();
      for (const e of parsed?.executions ?? []) {
        const key = `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`;
        signatureCounts.set(key, (signatureCounts.get(key) || 0) + 1);
      }
      let normalizedTotal = 0;
      for (const count of signatureCounts.values()) {
        expect(count % 3).toBe(0);
        normalizedTotal += count / 3;
      }
      expect(normalizedTotal).toBe(13);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant round-trip gross and net PnL", () => {
      const baseResult = parseAuto(TOS_TRADE_HISTORY_CSV, { timeZone: "America/Chicago" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      const seeds = [101, 202, 303];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(TOS_TRADE_HISTORY_CSV, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/Chicago" })!;
        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Corrupted order rows are safely skipped preserving 13 executions", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        ",REJECTED_ROW,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,~,MKT,DAY,REJECTED: Oversold",
        ",3/20/24 09:18:55,STOCK,BUY,0,TO CLOSE,TSLA,,,STOCK,173.268,173.268,MKT",
        ",3/20/24 09:18:55,STOCK,BUY,100,TO CLOSE,TSLA,,,STOCK,NaN,NaN,MKT",
      ];
      const chaotic = applyChaos(TOS_TRADE_HISTORY_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(13);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(3);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings on full ThinkorSwim statement", () => {
      const chaotic = applyChaos(TOS_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed?.executions).toHaveLength(13);
      expect(parsed?.account).toBe("92140825SCHW");
    });
  });

  // --------------------------------------------------------------------------
  // 11. cTrader — 10 Executions (5 Closed Deals)
  // --------------------------------------------------------------------------
  describe("11. cTrader — Real HTML Statement", () => {
    const ctraderRowRegex = /<tr(?:(?!<tr)[\s\S])*?DID\d+[\s\S]*?<\/tr>/gi;

    it("Vector 1: Table partitioning preserves all 10 executions across 2 batches", () => {
      const batches = splitHtmlTableRows(CTRADER_HTM, ctraderRowRegex, 2);
      expect(batches).toHaveLength(2);

      let total = 0;
      for (const b of batches) {
        const parsed = parseAuto(b, { timeZone: "UTC" });
        total += parsed?.executions.length ?? 0;
      }
      expect(total).toBe(10);
    });

    it("Vector 2: 3x Aggressive row duplication produces 30 executions collapsing to 10 signatures", () => {
      const triplicated = duplicateHtmlTableRows(CTRADER_HTM, ctraderRowRegex, 3);
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(10 * 3);

      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(10);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant round-trip gross and net PnL", () => {
      const baseResult = parseAuto(CTRADER_HTM, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      for (let i = 0; i < 3; i++) {
        const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
        const reSorted = [...toExecutions(shuffled)].sort(compareExecutions);
        const shuffledTrips = buildRoundTrips(reSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Malformed HTML rows injected into cTrader table are safely skipped", () => {
      const garbageRows = `
<tr><td colspan="20">###CORRUPTED_SYNTAX_GARBAGE_IN_CTRADER_TABLE@@@</td></tr>
<tr><td></td><td>DID_MALFORMED</td><td>OID_MALFORMED</td><td>Buy</td><td></td><td>INVALID_DATE</td></tr>
<tr><td>DID99999</td><td>OID99999</td><td>Sell</td><td>EURUSD</td><td>INVALID_DATE</td><td>INVALID_DATE</td><td>NaN</td><td>NaN</td></tr>
`;
      const corrupted = CTRADER_HTM.replace(/<\/table>/, `${garbageRows}</table>`);
      const parsed = parseAuto(corrupted, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(10);
      expect(parsed?.account).toBe("4142841");
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically", () => {
      const bomCrlf = `\uFEFF${CTRADER_HTM.replace(/\r?\n/g, "\r\n")}`;
      const parsed = parseAuto(bomCrlf, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(10);
      expect(parsed?.account).toBe("4142841");
    });
  });

  // --------------------------------------------------------------------------
  // 12. Rithmic — 7 Executions
  // --------------------------------------------------------------------------
  describe("12. Rithmic (R | Trader) — Real Export", () => {
    it("Vector 1: Multi-batch splitting preserves 7 executions and $7.14 cumulative fees across 3 batches", () => {
      const batches = splitIntoBatches(RITHMIC_COMPLETED_ORDERS_CSV, 3);
      expect(batches).toHaveLength(3);

      let totalExecs = 0;
      let totalFees = 0;
      for (const b of batches) {
        const parsed = parseAuto(b);
        totalExecs += parsed?.executions.length ?? 0;
        totalFees += parsed?.executions.reduce((acc, e) => acc + e.fee, 0) ?? 0;
      }
      expect(totalExecs).toBe(7);
      expect(Math.round(totalFees * 100) / 100).toBe(7.14);
    });

    it("Vector 2: 3x Aggressive duplication collapses back to 7 unique execution IDs", () => {
      const triplicated = applyChaos(RITHMIC_COMPLETED_ORDERS_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated);
      expect(parsed?.executions).toHaveLength(7 * 3);

      const uniqueIds = new Set(parsed?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(7);
    });

    it("Vector 3: Temporal FIFO shuffle maintains exact $200.50 gross and $193.36 net PnL", () => {
      const baseResult = parseAuto(RITHMIC_CSV)!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo", multipliers: { MNQM4: 2 } });
      expect(baseTrips).toHaveLength(2);
      expect(baseTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(200.5);
      expect(Math.round(baseTrips.reduce((acc, rt) => acc + rt.netPnl, 0) * 100) / 100).toBe(
        193.36,
      );

      const shuffledCsv = applyChaos(RITHMIC_COMPLETED_ORDERS_CSV, { shuffle: true, seed: 998877 });
      const shuffledResult = parseAuto(shuffledCsv)!;
      const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(compareExecutions);
      const shuffledTrips = buildRoundTrips(shuffledSorted, {
        method: "fifo",
        multipliers: { MNQM4: 2 },
      });

      expect(shuffledTrips).toHaveLength(2);
      expect(shuffledTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(200.5);
      expect(Math.round(shuffledTrips.reduce((acc, rt) => acc + rt.netPnl, 0) * 100) / 100).toBe(
        193.36,
      );
    });

    it("Vector 4: Malformed, non-numeric, and corrupted rows are safely discarded", () => {
      const corruptedRows = [
        "",
        ",,,,,,,,,,,,,,,,,,,,",
        "CORRUPTED_ROW_WITHOUT_COMMAS",
        '"APEX-33521-11","Filled","","B","1","","MNQM4","M","INVALID_PRICE","","99901","AAG1","AAG1","APEX-33521","2024-04-24 10:30:05","1","2024-04-24 10:30:05","","","","0.51"',
        '"APEX-33521-11","Filled","","B","0","","MNQM4","M","17730.00","","99902","AAG2","AAG2","APEX-33521","2024-04-24 10:30:05","0","2024-04-24 10:30:05","","","","0.51"',
      ];
      const chaotic = applyChaos(RITHMIC_COMPLETED_ORDERS_CSV, { corruptedRows });
      const parsed = parseAuto(chaotic);
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.skippedRows).toBeGreaterThan(5);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings on full Rithmic export", () => {
      const chaotic = applyChaos(RITHMIC_CSV, { injectBOM: true, crlf: true });
      const parsed = parseAuto(chaotic);
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.account).toBe("APEX-33521-11");
    });
  });
});
