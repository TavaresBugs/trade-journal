import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { thinkorswim } from "../src/formats/thinkorswim";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const TOS_FIXTURE = readFileSync(
  new URL("./fixtures/tradezella/thinkorswim.csv", import.meta.url),
  "utf8",
);

const TOS_SECOND_FIXTURE = readFileSync(
  new URL("./fixtures/tradezella/thinkorswim-thinkorswim.csv", import.meta.url),
  "utf8",
);

// Standalone Trade History section extracted from the fixture
const TOS_TRADE_HISTORY_SECTION = [
  "Account Trade History",
  ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
  ",3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
  ",3/20/24 09:18:01,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
  ",3/20/24 08:26:41,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,170.856,170.856,MKT",
  ",3/20/24 08:25:31,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,171.0102,171.0102,MKT",
  ",3/20/24 07:42:17,STOCK,BUY,+309,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+20,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+99,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+300,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+72,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:39:38,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,172.2599,172.2599,MKT",
  ",3/20/24 07:38:08,STOCK,SELL,-2000,TO OPEN,TSLA,,,STOCK,172.3629,172.3629,MKT",
].join("\n");

// Header with data lines only for splitIntoBatches
const TOS_FLAT_TRADE_HISTORY = [
  ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
  ",3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
  ",3/20/24 09:18:01,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
  ",3/20/24 08:26:41,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,170.856,170.856,MKT",
  ",3/20/24 08:25:31,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,171.0102,171.0102,MKT",
  ",3/20/24 07:42:17,STOCK,BUY,+309,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+20,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+99,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+300,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:42:17,STOCK,BUY,+72,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
  ",3/20/24 07:39:38,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,172.2599,172.2599,MKT",
  ",3/20/24 07:38:08,STOCK,SELL,-2000,TO OPEN,TSLA,,,STOCK,172.3629,172.3629,MKT",
].join("\n");

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("ThinkorSwim (Charles Schwab) — Chaos & Stress Test Suite", () => {
  describe("Fixture parity and base detection", () => {
    it("detects and parses real ThinkorSwim export into 13 executions with account 92140825SCHW", () => {
      const detected = detectFormat(TOS_FIXTURE);
      expect(detected?.id).toBe("thinkorswim");

      const parsed = parseAuto(TOS_FIXTURE, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("thinkorswim");
      expect(parsed?.account).toBe("92140825SCHW");
      expect(parsed?.sourceAccounts).toEqual(["92140825SCHW"]);
      expect(parsed?.executions).toHaveLength(13);
      expect(parsed?.skippedRows).toBe(0);
    });

    it("parses thinkorswim-thinkorswim.csv identically to thinkorswim.csv", () => {
      const parsed1 = parseAuto(TOS_FIXTURE, { timeZone: "America/Chicago" });
      const parsed2 = parseAuto(TOS_SECOND_FIXTURE, { timeZone: "America/Chicago" });

      expect(parsed1).toEqual(parsed2);
      expect(parsed2?.executions).toHaveLength(13);
    });

    it("parses standalone Account Trade History table directly through thinkorswim.parse", () => {
      const parsed = thinkorswim.parse(TOS_TRADE_HISTORY_SECTION, {
        timeZone: "America/Chicago",
      });
      expect(parsed.format).toBe("thinkorswim");
      expect(parsed.executions).toHaveLength(13);
      expect(parsed.executions[0]?.symbol).toBe("TSLA");
      expect(parsed.executions[0]?.side).toBe("sell");
      expect(parsed.executions[0]?.quantity).toBe(1000);
      expect(parsed.executions[0]?.price).toBe(173.268);
    });
  });

  describe("First column empty offset resilience", () => {
    it("preserves accurate column alignment when both header and data rows start with empty leading comma", () => {
      const parsed = thinkorswim.parse(TOS_TRADE_HISTORY_SECTION, {
        timeZone: "America/Chicago",
      });

      const e0 = parsed.executions[0]!;
      expect(e0.symbol).toBe("TSLA");
      expect(e0.side).toBe("sell");
      expect(e0.quantity).toBe(1000);
      expect(e0.price).toBe(173.268);
      expect(e0.assetClass).toBe("equity");
      expect(e0.executedAt).toBe("2024-03-20T14:18:55.000Z");

      const e1 = parsed.executions[1]!;
      expect(e1.symbol).toBe("TSLA");
      expect(e1.side).toBe("buy");
      expect(e1.quantity).toBe(1000);
      expect(e1.price).toBe(173.0859);
    });

    it("prevents off-by-one shifts when header has leading comma but data rows do NOT", () => {
      // Header has leading comma, but data rows are stripped of leading comma
      const asymmetricCsv = [
        "Account Trade History",
        ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
        "3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
        "3/20/24 09:18:01,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
      ].join("\n");

      const parsed = thinkorswim.parse(asymmetricCsv, { timeZone: "America/Chicago" });
      expect(parsed.executions).toHaveLength(2);

      const [first, second] = parsed.executions;
      expect(first?.symbol).toBe("TSLA");
      expect(first?.side).toBe("sell");
      expect(first?.quantity).toBe(1000);
      expect(first?.price).toBe(173.268);

      expect(second?.symbol).toBe("TSLA");
      expect(second?.side).toBe("buy");
      expect(second?.quantity).toBe(1000);
      expect(second?.price).toBe(173.0859);
    });

    it("prevents off-by-one shifts when header has NO leading comma but data rows DO have leading comma", () => {
      // Header has no leading comma, but data rows have leading comma
      const asymmetricCsv = [
        "Account Trade History",
        "Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
        ",3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
        ",3/20/24 09:18:01,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
      ].join("\n");

      const parsed = thinkorswim.parse(asymmetricCsv, { timeZone: "America/Chicago" });
      expect(parsed.executions).toHaveLength(2);

      const [first, second] = parsed.executions;
      expect(first?.symbol).toBe("TSLA");
      expect(first?.side).toBe("sell");
      expect(first?.quantity).toBe(1000);
      expect(first?.price).toBe(173.268);

      expect(second?.symbol).toBe("TSLA");
      expect(second?.side).toBe("buy");
      expect(second?.quantity).toBe(1000);
      expect(second?.price).toBe(173.0859);
    });
  });

  describe("Signed quantities and position effects (TO OPEN, TO CLOSE)", () => {
    it("correctly converts signed quantities (-2000, +1000) into positive magnitude numbers", () => {
      const parsed = thinkorswim.parse(TOS_TRADE_HISTORY_SECTION, {
        timeZone: "America/Chicago",
      });

      // The last execution in Trade History is SELL -2000
      const lastExec = parsed.executions[parsed.executions.length - 1]!;
      expect(lastExec.symbol).toBe("TSLA");
      expect(lastExec.side).toBe("sell");
      expect(lastExec.quantity).toBe(2000);
      expect(lastExec.price).toBe(172.3629);

      // The second execution is BUY +1000
      const secondExec = parsed.executions[1]!;
      expect(secondExec.side).toBe("buy");
      expect(secondExec.quantity).toBe(1000);
    });

    it("builds exact short round-trip trade from TO OPEN sell and TO CLOSE buy legs", () => {
      // Row 1: SELL -1000 @ 173.268 (TO OPEN)
      // Row 2: BUY +1000 @ 173.0859 (TO CLOSE)
      const twoLegs = [
        "Account Trade History",
        ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
        ",3/20/24 09:18:00,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
        ",3/20/24 09:18:55,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
      ].join("\n");

      const parsed = thinkorswim.parse(twoLegs, { timeZone: "America/Chicago" });
      expect(parsed.executions).toHaveLength(2);

      const execs = toExecutions(parsed.executions);
      const trips = buildRoundTrips(execs, { method: "fifo" });

      expect(trips).toHaveLength(1);
      const [trip] = trips;
      expect(trip?.symbol).toBe("TSLA");
      expect(trip?.direction).toBe("short");
      expect(trip?.status).toBe("win");
      // (173.268 - 173.0859) * 1000 = 182.10
      expect(trip?.grossPnl).toBeCloseTo(182.1, 2);
      expect(trip?.netPnl).toBeCloseTo(182.1, 2);
    });

    it("infers side from signed quantity (+1000 = BUY, -2000 = SELL) when Side column is blank", () => {
      const missingSideCsv = [
        "Account Trade History",
        ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
        ",3/20/24 09:18:55,STOCK,,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
        ",3/20/24 09:18:01,STOCK,,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
      ].join("\n");

      const parsed = thinkorswim.parse(missingSideCsv, { timeZone: "America/Chicago" });
      expect(parsed.executions).toHaveLength(2);
      expect(parsed.executions[0]?.side).toBe("sell");
      expect(parsed.executions[0]?.quantity).toBe(1000);
      expect(parsed.executions[1]?.side).toBe("buy");
      expect(parsed.executions[1]?.quantity).toBe(1000);
    });
  });

  describe("Multi-section preamble navigation", () => {
    it("extracts Account ID from preamble header", () => {
      const parsed = thinkorswim.parse(TOS_FIXTURE, { timeZone: "America/Chicago" });
      expect(parsed.account).toBe("92140825SCHW");
      expect(parsed.sourceAccounts).toEqual(["92140825SCHW"]);
    });

    it("completely ignores Forex Statements, Futures, Orders, and postamble Equities/Options", () => {
      const parsed = thinkorswim.parse(TOS_FIXTURE, { timeZone: "America/Chicago" });

      // Only the 13 trades in Account Trade History are parsed
      expect(parsed.executions).toHaveLength(13);

      // Verify that no Forex currencies (e.g. EUR/USD) or cash amounts were parsed as symbols
      const symbols = new Set(parsed.executions.map((e) => e.symbol));
      expect(symbols).toEqual(new Set(["TSLA"]));

      // Verify that symbols from the Equities section (AYRWF, TCNNF, MSOX, GTBIF) are not parsed
      expect(symbols.has("AYRWF")).toBe(false);
      expect(symbols.has("TCNNF")).toBe(false);
      expect(symbols.has("MSOX")).toBe(false);

      // Verify that symbols from Options section (CGC) are not parsed
      expect(symbols.has("CGC")).toBe(false);
    });

    it("navigates statements with alternative preamble patterns (Account: XXXXX)", () => {
      const altPreamble = [
        "Account: 123456789",
        "Cash Balance",
        "DATE,TIME,TYPE,AMOUNT",
        "3/19/24,23:00:00,BAL,50000",
        "",
        "Account Trade History",
        ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Price",
        ",3/20/24 09:18:55,STOCK,SELL,-500,TO OPEN,NVDA,120.50",
      ].join("\n");

      const parsed = thinkorswim.parse(altPreamble, { timeZone: "America/Chicago" });
      expect(parsed.account).toBe("123456789");
      expect(parsed.executions).toHaveLength(1);
      expect(parsed.executions[0]?.symbol).toBe("NVDA");
      expect(parsed.executions[0]?.importMetadata?.id).toContain("thinkorswim:123456789:");
    });
  });

  describe("6 Universal Chaos Vectors (ThinkorSwim)", () => {
    it("Vector 1: Multi-batch ingestion preserves all 13 executions across 4 batches", () => {
      const batches = splitIntoBatches(TOS_FLAT_TRADE_HISTORY, 4);
      expect(batches).toHaveLength(4);

      let totalExecutions = 0;
      const allExecutions: ReturnType<typeof parseAuto>["executions"] = [];

      for (const batch of batches) {
        const detected = detectFormat(batch);
        expect(detected?.id).toBe("thinkorswim");

        const parsed = parseAuto(batch, { timeZone: "America/Chicago" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("thinkorswim");
        totalExecutions += parsed?.executions.length ?? 0;
        if (parsed) allExecutions.push(...parsed.executions);
      }

      expect(totalExecutions).toBe(13);
      expect(allExecutions).toHaveLength(13);
    });

    it("Vector 2: 3x Aggressive duplication yields 39 executions deduplicatable to 13", () => {
      const triplicated = applyChaos(TOS_FLAT_TRADE_HISTORY, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("thinkorswim");
      expect(parsed?.executions).toHaveLength(13 * 3);

      // Multiset occurrence counting
      const signatureCounts = new Map<string, number>();
      for (const e of parsed?.executions ?? []) {
        const key = `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`;
        signatureCounts.set(key, (signatureCounts.get(key) || 0) + 1);
      }

      // In TOS fixture, there are 13 rows (some may share identical timestamps/prices)
      let normalizedTotal = 0;
      for (const count of signatureCounts.values()) {
        expect(count % 3).toBe(0);
        normalizedTotal += count / 3;
      }
      expect(normalizedTotal).toBe(13);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant FIFO round trip PnL", () => {
      const baseResult = parseAuto(TOS_FLAT_TRADE_HISTORY, {
        timeZone: "America/Chicago",
      })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      const seeds = [101, 202, 303, 404];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(TOS_FLAT_TRADE_HISTORY, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "America/Chicago" })!;
        expect(shuffledResult.executions).toHaveLength(13);

        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Corrupted and rejected order rows are safely discarded while preserving 13 fills", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        ",REJECTED_ROW,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,~,MKT,DAY,REJECTED: Oversold",
        ",3/20/24 09:18:55,STOCK,BUY,0,TO CLOSE,TSLA,,,STOCK,173.268,173.268,MKT",
        ",3/20/24 09:18:55,STOCK,BUY,100,TO CLOSE,TSLA,,,STOCK,NaN,NaN,MKT",
        ",NOT_A_VALID_DATE,STOCK,BUY,100,TO CLOSE,TSLA,,,STOCK,173.268,173.268,MKT",
      ];

      const chaoticCsv = applyChaos(TOS_FLAT_TRADE_HISTORY, { corruptedRows });
      const parsed = parseAuto(chaoticCsv, { timeZone: "America/Chicago" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("thinkorswim");
      expect(parsed?.executions).toHaveLength(13);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(corruptedRows.length - 2);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically on full TOS statement", () => {
      const chaotic = applyChaos(TOS_FIXTURE, {
        injectBOM: true,
        crlf: true,
      });

      const parsed = parseAuto(chaotic, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("thinkorswim");
      expect(parsed?.account).toBe("92140825SCHW");
      expect(parsed?.executions).toHaveLength(13);

      const plainParsed = parseAuto(TOS_FIXTURE, { timeZone: "America/Chicago" })!;
      expect(parsed?.executions[0]).toEqual(plainParsed.executions[0]);
      expect(parsed?.executions[12]).toEqual(plainParsed.executions[12]);
    });
  });
});
