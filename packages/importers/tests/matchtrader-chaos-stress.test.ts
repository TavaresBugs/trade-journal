import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { matchtrader } from "../src/formats/matchtrader";
import { applyChaos } from "./helpers/csv-fixtures";

const MATCHTRADER_HTML_PATH = new URL(
  "./fixtures/tradezella/matchtrader.html",
  import.meta.url,
);
const MATCHTRADER_DUPLICATE_HTML_PATH = new URL(
  "./fixtures/tradezella/match-trader-match-trader.html",
  import.meta.url,
);

const REAL_MATCHTRADER_HTML = readFileSync(MATCHTRADER_HTML_PATH, "utf8");
const REAL_MATCHTRADER_DUPLICATE_HTML = readFileSync(
  MATCHTRADER_DUPLICATE_HTML_PATH,
  "utf8",
);

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: e.importMetadata?.id ?? `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

/** Helper to partition a MatchTrader HTML table into `n` smaller HTML files */
function splitMatchTraderHtml(html: string, batchCount: number): string[] {
  const headerMatch = html.match(
    /([\s\S]*?<table[^>]*>[\s\S]*?Closed positions[\s\S]*?<tr[^>]*><td>ID<\/td>[\s\S]*?<\/tr>)/i,
  );
  if (!headerMatch) return [html];

  const prefix = headerMatch[1]!;
  const suffix = "</table></div></div></body></html>";

  const rowRegex = /<tr align="center"[^>]*><td>(W\d+)<\/td>[\s\S]*?<\/tr>/gi;
  const dataRows: string[] = [];
  let m;
  while ((m = rowRegex.exec(html)) !== null) {
    dataRows.push(m[0]);
  }

  const batches: string[] = [];
  const baseSize = Math.floor(dataRows.length / batchCount);
  const remainder = dataRows.length % batchCount;

  let start = 0;
  for (let i = 0; i < batchCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = dataRows.slice(start, start + size);
    start += size;
    if (slice.length > 0) {
      batches.push(`${prefix}${slice.join("\n")}${suffix}`);
    }
  }

  return batches;
}

describe("Match-Trader — Chaos & Stress Test Battery", () => {
  describe("Format Detection & Baseline Parsing", () => {
    it("detects Match-Trader HTML export across identical fixtures", () => {
      // Arrange & Act
      const detected1 = detectFormat(REAL_MATCHTRADER_HTML);
      const detected2 = detectFormat(REAL_MATCHTRADER_DUPLICATE_HTML);

      // Assert
      expect(detected1?.id).toBe("matchtrader");
      expect(detected2?.id).toBe("matchtrader");
    });

    it("parses real Match-Trader HTML statement extracting account 19286 and 32 executions across 16 rows", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });

      // Assert
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("matchtrader");
      expect(parsed?.account).toBe("19286");
      expect(parsed?.sourceAccounts).toEqual(["19286"]);
      expect(parsed?.executions).toHaveLength(32);
      expect(parsed?.skippedRows).toBe(0);
    });
  });

  describe("Real-world edge cases", () => {
    it("ensures unique execution IDs for multiple partial closes sharing position ID (e.g. W250539060040427)", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
      const executions = parsed!.executions;

      // Assert: All 32 executions in the file MUST have 100% unique IDs so none are overwritten
      const allIds = executions.map((e) => e.importMetadata?.id);
      expect(allIds).toHaveLength(32);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(32);

      // Verify specific position with multiple partial closes: W250539060040427
      const posTrades = executions.filter(
        (e) => e.importMetadata?.group === "matchtrader:19286:W250539060040427",
      );
      expect(posTrades).toHaveLength(4); // 2 rows * 2 legs (entry + exit)

      // Leg 0 has base ID
      expect(posTrades[0]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:entry");
      expect(posTrades[1]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:exit");

      // Leg 1 (partial close) has leg-indexed ID
      expect(posTrades[2]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:1:entry");
      expect(posTrades[3]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:1:exit");

      // Verify 3 partial closes on position W250539060038615
      const threeLegPos = executions.filter(
        (e) => e.importMetadata?.group === "matchtrader:19286:W250539060038615",
      );
      expect(threeLegPos).toHaveLength(6); // 3 rows * 2 legs
      expect(threeLegPos[0]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:entry");
      expect(threeLegPos[1]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:exit");
      expect(threeLegPos[2]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:1:entry");
      expect(threeLegPos[3]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:1:exit");
      expect(threeLegPos[4]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:2:entry");
      expect(threeLegPos[5]?.importMetadata?.id).toBe("matchtrader:19286:W250539060038615:2:exit");
    });

    it("parses European dot dates (DD.MM.YYYY HH:mm:ss) accurately", () => {
      // Arrange & Act: Row 1 in matchtrader.html has Open: 19.02.2025 04:44:10, Close: 19.02.2025 05:56:35
      const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
      const [entry, exit] = parsed!.executions.slice(0, 2);

      // Assert
      expect(entry?.executedAt).toBe("2025-02-19T04:44:10.000Z");
      expect(exit?.executedAt).toBe("2025-02-19T05:56:35.000Z");

      // Ambiguous dot date (05.02.2025 -> 5th February 2025 in DMY)
      const ambiguousHtml = REAL_MATCHTRADER_HTML.replace(
        /19\.02\.2025 04:44:10/g,
        "05.02.2025 04:44:10",
      );
      const parsedAmbiguous = parseAuto(ambiguousHtml, {
        timeZone: "UTC",
        dateOrder: "DMY",
      });
      expect(parsedAmbiguous?.executions[0]?.executedAt).toBe("2025-02-05T04:44:10.000Z");
    });

    it("correctly infers asset classes across forex, crypto, and indices", () => {
      // Arrange & Act
      const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
      const execs = parsed!.executions;

      // Assert
      const usdjpy = execs.find((e) => e.symbol === "USDJPY");
      const btcusd = execs.find((e) => e.symbol === "BTCUSD");
      const us30 = execs.find((e) => e.symbol === "US30");
      const us100 = execs.find((e) => e.symbol === "US100");

      expect(usdjpy?.assetClass).toBe("forex");
      expect(btcusd?.assetClass).toBe("crypto");
      expect(us30?.assetClass).toBe("futures");
      expect(us100?.assetClass).toBe("futures");
    });

    it("enforces non-negative commission fees so negative fees do not inflate net PnL", () => {
      // Arrange: Row 1 has Commission: -18.00 in HTML
      const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
      const exitExec = parsed!.executions[1];

      // Assert: Fee must be non-negative positive 18.00
      expect(exitExec?.fee).toBe(18.0);
      expect(exitExec?.fee).toBeGreaterThanOrEqual(0);
      expect(exitExec?.importMetadata?.preserveFee).toBe(true);
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    // Vector 1: Multi-batch ingestion
    describe("Vector 1: Multi-batch splitting", () => {
      it("preserves total executions and unique execution IDs across 3 batches", () => {
        // Arrange
        const batches = splitMatchTraderHtml(REAL_MATCHTRADER_HTML, 3);
        expect(batches).toHaveLength(3);

        // Act
        let totalExecutions = 0;
        const allExecutions: ReturnType<typeof parseAuto>["executions"] = [];
        for (const batch of batches) {
          const parsed = parseAuto(batch, { timeZone: "UTC" });
          expect(parsed).not.toBeNull();
          expect(parsed?.format).toBe("matchtrader");
          totalExecutions += parsed?.executions.length ?? 0;
          if (parsed) allExecutions.push(...parsed.executions);
        }

        // Assert: 16 closed deals * 2 legs = 32 executions
        expect(totalExecutions).toBe(32);
        const uniqueIds = new Set(allExecutions.map((e) => e.importMetadata?.id));
        expect(uniqueIds.size).toBe(32);
      });
    });

    // Vector 2: Aggressive duplication resilience
    describe("Vector 2: Aggressive duplication resilience", () => {
      it("maintains distinct execution signatures and deduplicates duplicated HTML rows", () => {
        // Arrange: Duplicate all table rows 2x
        const rowRegex = /<tr align="center"[^>]*><td>(W\d+)<\/td>[\s\S]*?<\/tr>/gi;
        const duplicatedHtml = REAL_MATCHTRADER_HTML.replace(
          rowRegex,
          (match) => `${match}\n${match}`,
        );

        // Act
        const parsed = parseAuto(duplicatedHtml, { timeZone: "UTC" });

        // Assert: 32 original executions * 2 = 64 total executions
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("matchtrader");
        expect(parsed?.executions).toHaveLength(32 * 2);

        // Unique execution signatures collapse back to the original 32 distinct trades
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
      it("maintains identical FIFO round trip gross and net PnL under random temporal shuffling", () => {
        // Chronological comparator breaking sub-second ties by order index
        const compareExecutions = (a: Execution, b: Execution) => {
          const timeDiff = new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime();
          if (timeDiff !== 0) return timeDiff;
          return (a.importMetadata?.order ?? 0) - (b.importMetadata?.order ?? 0);
        };

        // Arrange: baseline from chronological order
        const baseResult = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" })!;
        const baseSorted = [...toExecutions(baseResult.executions)].sort(compareExecutions);
        const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
        const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
        const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
        const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

        // Act & Assert across 5 random shuffles of executions
        for (let i = 0; i < 5; i++) {
          const shuffled = [...baseResult.executions].sort(() => Math.random() - 0.5);
          const reSorted = [...toExecutions(shuffled)].sort(compareExecutions);

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
      it("safely ignores syntax garbage and malformed table rows injected into Match-Trader HTML", () => {
        // Arrange: Inject malformed rows into HTML table
        const garbageRows = `
          <tr><td colspan="15">###CORRUPTED_SYNTAX_GARBAGE_IN_MATCHTRADER_TABLE@@@</td></tr>
          <tr align="center"><td>W99999</td><td></td><td>INVALID_DATE</td><td>0</td><td>BUY</td><td>INVALID_DATE</td><td>NaN</td><td>NaN</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>User</td></tr>
          <tr align="center"><td>W99998</td><td>USDJPY</td><td>19.02.2025 04:44:10</td><td>0</td><td>SELL</td><td>19.02.2025 05:56:35</td><td>151.811</td><td>151.754</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>User</td></tr>
          <tr align="center"><td>W99997</td><td>USDJPY</td><td>19.02.2025 04:44:10</td><td>1.0</td><td>SELL</td><td>19.02.2025 05:56:35</td><td>NaN</td><td>151.754</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>User</td></tr>
        `;

        const corruptedHtml = REAL_MATCHTRADER_HTML.replace(
          /<\/table>/,
          `${garbageRows}</table>`,
        );

        // Act
        const parsed = parseAuto(corruptedHtml, { timeZone: "UTC" });

        // Assert: All 32 genuine executions from the 16 closed deals remain intact
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("matchtrader");
        expect(parsed?.account).toBe("19286");
        expect(parsed?.executions).toHaveLength(32);
        expect(parsed?.skippedRows).toBeGreaterThanOrEqual(3);
      });
    });

    // Vector 5: UTF-8 BOM injection
    describe("Vector 5: UTF-8 BOM handling", () => {
      it("parses UTF-8 BOM injected HTML identically to plain UTF-8", () => {
        // Arrange
        const bomHtml = `\uFEFF${REAL_MATCHTRADER_HTML}`;

        // Act
        const parsed = parseAuto(bomHtml, { timeZone: "UTC" });

        // Assert
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("matchtrader");
        expect(parsed?.account).toBe("19286");
        expect(parsed?.executions).toHaveLength(32);
      });
    });

    // Vector 6: CRLF vs LF line endings
    describe("Vector 6: Line ending resilience", () => {
      it("parses CRLF and LF exports identically", () => {
        // Arrange
        const crlfHtml = REAL_MATCHTRADER_HTML.replace(/\r?\n/g, "\r\n");
        const lfHtml = REAL_MATCHTRADER_HTML.replace(/\r?\n/g, "\n");

        // Act
        const parsedCrlf = parseAuto(crlfHtml, { timeZone: "UTC" });
        const parsedLf = parseAuto(lfHtml, { timeZone: "UTC" });

        // Assert
        expect(parsedCrlf?.executions).toHaveLength(32);
        expect(parsedLf?.executions).toHaveLength(32);
        expect(parsedCrlf?.executions).toEqual(parsedLf?.executions);
      });
    });
  });
});
