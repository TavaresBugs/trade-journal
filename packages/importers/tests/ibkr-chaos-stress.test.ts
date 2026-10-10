import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { ibkr, FEE_COLUMNS } from "../src/formats/ibkr";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const IBKR_FLEX_FIXTURE = readFileSync(
  new URL("./fixtures/tradezella/ibkr.csv", import.meta.url),
  "utf8",
);

const IBKR_GUIDE_FIXTURE = readFileSync(
  new URL(
    "./fixtures/tradezella/interactive-broker-how-to-import-your-trades-from-interactive-broker-ibkr.csv",
    import.meta.url,
  ),
  "utf8",
);

const CLASSIC_ACTIVITY_CSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:31:00",100,185.50,187.0,-18550,-1.00,18551,0,150,O
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:15:00",-100,187.25,187.0,18725,-1.25,-18551,173,-25,C
Trades,Data,ClosedLot,Stocks,USD,AAPL,"2026-01-05, 10:15:00",-100,187.25,187.0,18725,-1.25,-18551,173,-25,C
Trades,SubTotal,,Stocks,USD,AAPL,,0,,,175,-2.25,0,173,125,
Trades,Total,,Stocks,USD,,,,0,,,175,-2.25,0,173,125,`;

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("Interactive Brokers (IBKR) — Chaos & Stress Test Suite", () => {
  describe("Fixture parity and base detection", () => {
    it("detects and parses Flex Query fixture ibkr.csv into 675 executions with account U2102003", () => {
      const detected = detectFormat(IBKR_FLEX_FIXTURE);
      expect(detected?.id).toBe("ibkr-flex");

      const parsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ibkr-flex");
      expect(parsed?.account).toBe("U2102003");
      expect(parsed?.sourceAccounts).toEqual(["U2102003"]);
      expect(parsed?.executions).toHaveLength(675);
      expect(parsed?.skippedRows).toBe(0);
    });

    it("detects and parses interactive-broker-...-ibkr.csv identically to ibkr.csv", () => {
      const parsed1 = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
      const parsed2 = parseAuto(IBKR_GUIDE_FIXTURE, { timeZone: "UTC" });

      expect(parsed1).toEqual(parsed2);
      expect(parsed2?.executions).toHaveLength(675);
    });

    it("parses Flex Query directly through ibkr.parse fallback", () => {
      const parsed = ibkr.parse(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
      expect(parsed.format).toBe("ibkr-flex");
      expect(parsed.account).toBe("U2102003");
      expect(parsed.executions).toHaveLength(675);
      expect(parsed.skippedRows).toBe(0);
    });
  });

  describe("Semicolon timestamp parsing (YYYYMMDD;HHmmss)", () => {
    it("parses real semicolon timestamps like 20210820;110555 accurately into UTC ISO strings", () => {
      const sample = [
        "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass",
        "U2102003,A,20210820;110555,BUY,0.5,168.71,0,STK",
        "U2102003,A,20210820;122916,BUY,0.5,168.56,0,STK",
      ].join("\n");

      const parsedUtc = parseAuto(sample, { timeZone: "UTC" });
      expect(parsedUtc?.executions).toHaveLength(2);
      expect(parsedUtc?.executions[0]?.executedAt).toBe("2021-08-20T11:05:55.000Z");
      expect(parsedUtc?.executions[1]?.executedAt).toBe("2021-08-20T12:29:16.000Z");

      const parsedNy = parseAuto(sample, { timeZone: "America/New_York" });
      expect(parsedNy?.executions).toHaveLength(2);
      // EDT is UTC-4 in August
      expect(parsedNy?.executions[0]?.executedAt).toBe("2021-08-20T15:05:55.000Z");
    });
  });

  describe("Fractional shares handling (Quantity: 0.5)", () => {
    it("accurately parses fractional quantities from real executions in ibkr.csv", () => {
      const parsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
      expect(parsed).not.toBeNull();

      // Rows 2 and 3 in ibkr.csv are 0.5 shares of A (Agilent)
      const fractionalBuys = parsed!.executions.filter(
        (e) => e.symbol === "A" && e.quantity === 0.5 && e.side === "buy",
      );
      expect(fractionalBuys.length).toBeGreaterThan(0);
      expect(fractionalBuys[0]!.quantity).toBe(0.5);

      const fractionalSells = parsed!.executions.filter(
        (e) => e.symbol === "A" && e.quantity === 0.5 && e.side === "sell",
      );
      expect(fractionalSells.length).toBeGreaterThan(0);
      expect(fractionalSells[0]!.quantity).toBe(0.5);
    });

    it("preserves various fractional quantities without float rounding truncation", () => {
      const csv = [
        "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass",
        "U1234567,AMZN,20260105;093000,BUY,0.125,200.00,-0.50,STK",
        "U1234567,GOOG,20260105;094500,BUY,0.005,180.00,-0.20,STK",
        "U1234567,MSFT,20260105;100000,SELL,-10.75,420.00,-1.00,STK",
      ].join("\n");

      const parsed = parseAuto(csv, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(3);
      expect(parsed?.executions[0]?.quantity).toBe(0.125);
      expect(parsed?.executions[1]?.quantity).toBe(0.005);
      expect(parsed?.executions[2]?.quantity).toBe(10.75);
      expect(parsed?.executions[2]?.side).toBe("sell");
    });
  });

  describe("Summing of all 8 commission/fee columns", () => {
    it("sums all 8 fee breakdown columns in Classic Activity Statement", () => {
      const multiFeeActivityCsv = [
        "Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Commission,BrokerExecutionCommission,BrokerClearingCommission,ThirdPartyExecutionCommission,ThirdPartyClearingCommission,ThirdPartyRegulatoryCommission,OtherCommission,Tax",
        'Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:30:00",100,185.00,-1.00,-0.50,-0.25,-0.10,-0.05,-0.02,-0.08,-0.50',
        'Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:00:00",-100,190.00,-1.00,0,0,0,0,0,0,-0.50',
      ].join("\n");

      const parsed = ibkr.parse(multiFeeActivityCsv, { timeZone: "UTC" });
      expect(parsed.executions).toHaveLength(2);

      // Row 1: 1.00 + 0.50 + 0.25 + 0.10 + 0.05 + 0.02 + 0.08 + 0.50 = 2.50
      expect(parsed.executions[0]?.fee).toBeCloseTo(2.5, 4);
      // Row 2: 1.00 + 0.50 = 1.50
      expect(parsed.executions[1]?.fee).toBeCloseTo(1.5, 4);
    });

    it("sums all 8 fee breakdown columns in Flex Query format", () => {
      const multiFeeFlexCsv = [
        "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,AssetClass," +
          "Commission,BrokerExecutionCommission,BrokerClearingCommission,ThirdPartyExecutionCommission,ThirdPartyClearingCommission,ThirdPartyRegulatoryCommission,OtherCommission,Tax",
        "U1234567,NVDA,20260105;093000,BUY,50,130.00,STK,-1.00,-0.40,-0.20,-0.15,-0.05,-0.03,-0.07,-0.60",
      ].join("\n");

      const parsed = ibkr.parse(multiFeeFlexCsv, { timeZone: "UTC" });
      expect(parsed?.executions).toHaveLength(1);
      // 1.00 + 0.40 + 0.20 + 0.15 + 0.05 + 0.03 + 0.07 + 0.60 = 2.50
      expect(parsed?.executions[0]?.fee).toBeCloseTo(2.5, 4);
    });

    it("verifies FEE_COLUMNS constant covers all 8 documented columns", () => {
      expect(FEE_COLUMNS).toEqual([
        "commission",
        "brokerexecutioncommission",
        "brokerclearingcommission",
        "thirdpartyexecutioncommission",
        "thirdpartyclearingcommission",
        "thirdpartyregulatorycommission",
        "othercommission",
        "tax",
      ]);
    });
  });

  describe("Classic Activity Statement: DataDiscriminator Order filter", () => {
    it("filters DataDiscriminator === 'Order' and ignores ClosedLot, SubTotal, and Total rows", () => {
      const detected = detectFormat(CLASSIC_ACTIVITY_CSV);
      expect(detected?.id).toBe("ibkr");

      const parsed = ibkr.parse(CLASSIC_ACTIVITY_CSV, { timeZone: "UTC" });
      expect(parsed.format).toBe("ibkr");
      expect(parsed.executions).toHaveLength(2);
      expect(parsed.skippedRows).toBe(1); // ClosedLot row counted as skipped

      expect(parsed.executions[0]?.symbol).toBe("AAPL");
      expect(parsed.executions[0]?.side).toBe("buy");
      expect(parsed.executions[0]?.quantity).toBe(100);
      expect(parsed.executions[0]?.price).toBe(185.5);
      expect(parsed.executions[0]?.fee).toBe(1.0);

      expect(parsed.executions[1]?.symbol).toBe("AAPL");
      expect(parsed.executions[1]?.side).toBe("sell");
      expect(parsed.executions[1]?.quantity).toBe(100);
      expect(parsed.executions[1]?.price).toBe(187.25);
      expect(parsed.executions[1]?.fee).toBe(1.25);
    });

    it("computes exact round-trip FIFO PnL on Classic Activity Statement fills", () => {
      const parsed = ibkr.parse(CLASSIC_ACTIVITY_CSV, { timeZone: "UTC" });
      const execs = toExecutions(parsed.executions);
      const trips = buildRoundTrips(execs, { method: "fifo" });

      expect(trips).toHaveLength(1);
      const [trip] = trips;
      expect(trip?.symbol).toBe("AAPL");
      expect(trip?.direction).toBe("long");
      // (187.25 - 185.50) * 100 = 175.00 gross PnL
      expect(trip?.grossPnl).toBe(175);
      // fees: 1.00 + 1.25 = 2.25
      expect(trip?.fees).toBe(2.25);
      expect(trip?.netPnl).toBe(172.75);
      expect(trip?.status).toBe("win");
    });
  });

  describe("6 Universal Chaos Vectors (Flex Query ibkr.csv)", () => {
    it("Vector 1: Multi-batch ingestion preserves all 675 executions across 5 batches", () => {
      const batches = splitIntoBatches(IBKR_FLEX_FIXTURE, 5);
      expect(batches).toHaveLength(5);

      let totalExecutions = 0;
      const allExecutions: ReturnType<typeof parseAuto>["executions"] = [];

      for (const batch of batches) {
        const detected = detectFormat(batch);
        expect(detected?.id).toBe("ibkr-flex");

        const parsed = parseAuto(batch, { timeZone: "UTC" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ibkr-flex");
        totalExecutions += parsed?.executions.length ?? 0;
        if (parsed) allExecutions.push(...parsed.executions);
      }

      expect(totalExecutions).toBe(675);
      // All 675 unique execution metadata order indices are preserved
      expect(allExecutions).toHaveLength(675);
    });

    it("Vector 2: 3x Aggressive duplication yields 2025 executions deduplicatable to 675", () => {
      const triplicated = applyChaos(IBKR_FLEX_FIXTURE, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ibkr-flex");
      expect(parsed?.executions).toHaveLength(675 * 3);

      // Deduplication by execution signature: symbol | side | quantity | price | executedAt
      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      // The original 675 rows have distinct execution events
      const baseParsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" })!;
      const baseUniqueSignatures = new Set(
        baseParsed.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(baseUniqueSignatures.size);
    });

    it("Vector 3: Temporal FIFO shuffle maintains invariant FIFO round trip PnL", () => {
      const baseResult = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const baseTrips = buildRoundTrips(baseSorted, { method: "fifo" });
      const baseGross = baseTrips.reduce((s, t) => s + t.grossPnl, 0);
      const baseFees = baseTrips.reduce((s, t) => s + t.fees, 0);
      const baseNet = baseTrips.reduce((s, t) => s + t.netPnl, 0);

      const seeds = [42, 1337, 8888];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(IBKR_FLEX_FIXTURE, { shuffle: true, seed });
        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
        expect(shuffledResult.executions).toHaveLength(675);

        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );
        const shuffledTrips = buildRoundTrips(shuffledSorted, { method: "fifo" });

        expect(shuffledTrips).toHaveLength(baseTrips.length);
        expect(shuffledTrips.reduce((s, t) => s + t.grossPnl, 0)).toBeCloseTo(baseGross, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.fees, 0)).toBeCloseTo(baseFees, 2);
        expect(shuffledTrips.reduce((s, t) => s + t.netPnl, 0)).toBeCloseTo(baseNet, 2);
      }
    });

    it("Vector 4: Corrupted and empty rows are safely discarded while preserving 675 valid fills", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
        "MALFORMED_NON_CSV_LINE_WITHOUT_COMMAS",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,BAD_TIMESTAMP,2,3,ZERO,BUY,1,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BAD_SIDE,1,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BUY,0,100,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
        "U2102003,,,USD,STK,COMMON,A,AGILENT,1,2,ISIN,3,4,,NYSE,,,,,,1,,,,,ExchTrade,1,2,3,4,,,,0,,,1,0,20210608;121957,2,3,ZERO,BUY,1,NaN,100,-100,-100,0,0,0,0,0,0,0,USD,0,O,LMT,EXECUTION,,N,,0,,,,,0,0.0 ()",
      ];

      const chaoticCsv = applyChaos(IBKR_FLEX_FIXTURE, { corruptedRows });
      const parsed = parseAuto(chaoticCsv, { timeZone: "UTC" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ibkr-flex");
      expect(parsed?.executions).toHaveLength(675);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(4);
    });

    it("Vector 5 & 6: UTF-8 BOM injection and CRLF line endings parse identically to plain LF", () => {
      const chaotic = applyChaos(IBKR_FLEX_FIXTURE, {
        injectBOM: true,
        crlf: true,
      });

      const parsed = parseAuto(chaotic, { timeZone: "UTC" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ibkr-flex");
      expect(parsed?.account).toBe("U2102003");
      expect(parsed?.executions).toHaveLength(675);

      const plainParsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" })!;
      expect(parsed?.executions[0]).toEqual(plainParsed.executions[0]);
      expect(parsed?.executions[674]).toEqual(plainParsed.executions[674]);
    });
  });
});
