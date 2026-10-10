import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { rithmic } from "../src/formats/rithmic";
import type { ImportedExecution } from "../src/types";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const RITHMIC_PATH = new URL(
  "./fixtures/tradezella/rithmic.csv",
  import.meta.url,
);
const RITHMIC_COPY_PATH = new URL(
  "./fixtures/tradezella/rithmic-r-trader-rithmic-r-trader.csv",
  import.meta.url,
);

const RITHMIC_CSV = readFileSync(RITHMIC_PATH, "utf8");
const RITHMIC_COPY_CSV = readFileSync(RITHMIC_COPY_PATH, "utf8");

// Slice just the Completed Orders section for isolated testing
const COMPLETED_ORDERS_HEADER_IDX = RITHMIC_CSV.indexOf('"Account","Status","Remarks"');
const COMPLETED_ORDERS_CSV = RITHMIC_CSV.slice(COMPLETED_ORDERS_HEADER_IDX).trim();

const toExecutions = (imported: ImportedExecution[]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("Rithmic (R | Trader) — Chaos & Stress Test Suite", () => {
  describe("Multi-Section Layout Handling", () => {
    it("detects and navigates multi-section layout discarding Working Orders section", () => {
      const format = detectFormat(RITHMIC_CSV);
      expect(format?.id).toBe("rithmic");

      const parsed = parseAuto(RITHMIC_CSV);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("rithmic");
      expect(parsed?.account).toBe("APEX-33521-11");
      expect(parsed?.sourceAccounts).toEqual(["APEX-33521-11"]);
      expect(parsed?.executions).toHaveLength(7);
    });

    it("ignores working and cancelled orders inside Working Orders section", () => {
      const workingSectionWithOrders = [
        "Working Orders",
        '"Account","Status","Buy/Sell","Qty To Fill","Max Show Qty","Symbol","Price Type","Limit Price","Qty Filled","Qty Working","Order Number","Original Sequence Number","Current Sequence Number","User Id","Exchange Order Id","Update Time (EDT)","Expiration Month","Stop/Trigger Price","Duration","Avg Fill Price","Position Disposition","IB Id","FCM Id","Create Time (EDT)","Liquidity Indicator","Executing Venue"',
        '"APEX-33521-11","Working","B","2","","MNQM4","L","17650.00","0","2","999901","AAG999","AAG999","APEX-33521","","2024-04-24 10:20:00","","","DAY","","","","","2024-04-24 10:20:00","",""',
        '"APEX-33521-11","Cancelled","S","1","","MNQM4","L","17800.00","0","0","999902","AAG998","AAG998","APEX-33521","","2024-04-24 10:21:00","","","DAY","","","","","2024-04-24 10:21:00","",""',
        "",
        "",
        "Completed Orders",
        RITHMIC_CSV.slice(COMPLETED_ORDERS_HEADER_IDX),
      ].join("\n");

      const parsed = parseAuto(workingSectionWithOrders);
      expect(parsed).not.toBeNull();
      // Still exactly 7 completed executions, working orders safely ignored
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.account).toBe("APEX-33521-11");
    });

    it("parses standalone Completed Orders export without section header", () => {
      const detected = detectFormat(COMPLETED_ORDERS_CSV);
      expect(detected?.id).toBe("rithmic");

      const parsed = parseAuto(COMPLETED_ORDERS_CSV);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.account).toBe("APEX-33521-11");
    });
  });

  describe("Discarding Cancelled Orders & Non-Filled Records", () => {
    it("discards 5 cancelled orders with Qty Filled === 0 without crashing", () => {
      const parsed = parseAuto(RITHMIC_CSV);
      expect(parsed).not.toBeNull();

      // Total data rows in Completed Orders = 12 (7 filled + 5 cancelled)
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.skippedRows).toBe(5);

      // Verify no cancelled order number exists in parsed executions
      const parsedIds = parsed!.executions.map((e) => e.importMetadata?.id);
      const cancelledOrderNumbers = [
        "1285638967",
        "1285638949",
        "1285604393",
        "1284801530",
        "1284801528",
      ];
      for (const orderNum of cancelledOrderNumbers) {
        expect(parsedIds).not.toContain(`rithmic:APEX-33521-11:${orderNum}`);
      }
    });

    it("safely handles rows with empty avg fill prices, missing fields, or status Rejected", () => {
      const contentWithRejections = [
        "Completed Orders",
        '"Account","Status","Remarks","Buy/Sell","Qty To Fill","Max Show Qty","Symbol","Price Type","Avg Fill Price","Limit Price","Order Number","Original Sequence Number","Current Sequence Number","User Id","Update Time (EDT)","Qty Filled","Create Time (EDT)","Commission","Liquidity Indicator","Executing Venue","Commission Fill Rate"',
        '"APEX-33521-11","Rejected","","B","1","","MNQM4","M","","","999888","AAG1","AAG1","APEX-33521","2024-04-24 10:30:05","0","2024-04-24 10:30:05","","","","0.51"',
        '"APEX-33521-11","Cancelled","","S","1","","MNQM4","M","","","999889","AAG2","AAG2","APEX-33521","2024-04-24 10:30:05","0","2024-04-24 10:30:05","","","","0.51"',
        '"APEX-33521-11","Filled","","B","1","","MNQM4","M","17730.0000","","1285662879","AAG2X5HQ","AAG2X5HQ","APEX-33521","2024-04-24 10:30:05","1","2024-04-24 10:30:05","","","","0.51"',
      ].join("\n");

      const parsed = parseAuto(contentWithRejections);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(1);
      expect(parsed?.skippedRows).toBe(2);
      expect(parsed?.executions[0]!.symbol).toBe("MNQM4");
    });
  });

  describe("Dynamic Per-Contract Commission Calculation", () => {
    it("calculates fee as Qty Filled * Commission Fill Rate ($0.51/contract) when Commission is blank", () => {
      const parsed = parseAuto(RITHMIC_CSV);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(7);

      // Verify each execution's fee based on its Qty Filled:
      // Row 7: 1 contract @ $0.51 = $0.51
      expect(parsed!.executions[0]!.quantity).toBe(1);
      expect(parsed!.executions[0]!.fee).toBe(0.51);
      expect(parsed!.executions[0]!.importMetadata?.preserveFee).toBe(true);

      // Row 8: 1 contract @ $0.51 = $0.51
      expect(parsed!.executions[1]!.quantity).toBe(1);
      expect(parsed!.executions[1]!.fee).toBe(0.51);

      // Row 10: 2 contracts @ $0.51 = $1.02
      expect(parsed!.executions[2]!.quantity).toBe(2);
      expect(parsed!.executions[2]!.fee).toBe(1.02);

      // Row 12: 4 contracts @ $0.51 = $2.04
      expect(parsed!.executions[3]!.quantity).toBe(4);
      expect(parsed!.executions[3]!.fee).toBe(2.04);

      // Row 15: 1 contract @ $0.51 = $0.51
      expect(parsed!.executions[4]!.quantity).toBe(1);
      expect(parsed!.executions[4]!.fee).toBe(0.51);

      // Row 17: 2 contracts @ $0.51 = $1.02
      expect(parsed!.executions[5]!.quantity).toBe(2);
      expect(parsed!.executions[5]!.fee).toBe(1.02);

      // Row 18: 3 contracts @ $0.51 = $1.53
      expect(parsed!.executions[6]!.quantity).toBe(3);
      expect(parsed!.executions[6]!.fee).toBe(1.53);

      // Total commission across all 14 contracts filled: 14 * $0.51 = $7.14
      const totalFees = parsed!.executions.reduce((acc, e) => acc + e.fee, 0);
      expect(Math.round(totalFees * 100) / 100).toBe(7.14);
    });

    it("prefers explicit Commission column when populated instead of fill rate", () => {
      const customCommCsv = [
        "Completed Orders",
        '"Account","Status","Remarks","Buy/Sell","Qty To Fill","Max Show Qty","Symbol","Price Type","Avg Fill Price","Limit Price","Order Number","Original Sequence Number","Current Sequence Number","User Id","Update Time (EDT)","Qty Filled","Create Time (EDT)","Commission","Liquidity Indicator","Executing Venue","Commission Fill Rate"',
        '"APEX-33521-11","Filled","","B","2","","MNQM4","M","17730.0000","","1285662879","AAG2X5HQ","AAG2X5HQ","APEX-33521","2024-04-24 10:30:05","2","2024-04-24 10:30:05","3.50","","","0.51"',
      ].join("\n");

      const parsed = parseAuto(customCommCsv);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(1);
      // Explicit Commission 3.50 wins over 2 * 0.51 = 1.02
      expect(parsed?.executions[0]!.fee).toBe(3.5);
    });
  });

  describe("Header Timezone Suffix Handling ((EDT) vs (CDT))", () => {
    it("automatically detects (EDT) in header and converts naive timestamp to America/New_York (UTC-4 in April)", () => {
      const parsed = parseAuto(RITHMIC_CSV);
      expect(parsed).not.toBeNull();

      // Timestamp "2024-04-24 10:30:05" in EDT (UTC-4) -> "2024-04-24T14:30:05.000Z"
      const firstExec = parsed!.executions[0]!;
      expect(firstExec.executedAt).toBe("2024-04-24T14:30:05.000Z");
    });

    it("automatically detects (CDT) in header and converts naive timestamp to America/Chicago (UTC-5 in April)", () => {
      // Replace (EDT) with (CDT) in header
      const cdtCsv = RITHMIC_CSV.replace(/Update Time \(EDT\)/g, "Update Time (CDT)");

      const parsed = parseAuto(cdtCsv);
      expect(parsed).not.toBeNull();

      // Timestamp "2024-04-24 10:30:05" in CDT (UTC-5) -> "2024-04-24T15:30:05.000Z"
      const firstExec = parsed!.executions[0]!;
      expect(firstExec.executedAt).toBe("2024-04-24T15:30:05.000Z");
    });

    it("respects explicit options.timeZone overriding header detection", () => {
      const parsed = parseAuto(RITHMIC_CSV, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();

      const firstExec = parsed!.executions[0]!;
      expect(firstExec.executedAt).toBe("2024-04-24T15:30:05.000Z");
    });
  });

  describe("FIFO Round Trips & Financial Reconciliation", () => {
    it("reconciles all 7 executions into 2 round trips with exact penny parity", () => {
      const parsed = parseAuto(RITHMIC_CSV);
      expect(parsed).not.toBeNull();

      // Sort chronologically
      const sorted = [...parsed!.executions].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );

      const roundTrips = buildRoundTrips(toExecutions(sorted), {
        method: "fifo",
        multipliers: { MNQM4: 2 },
      });

      expect(roundTrips).toHaveLength(2);

      // Round Trip 1: Long MNQM4, 3 contracts
      // Bought 3 @ 17774.50, Sold 2 @ 17771.625 (-$11.50) + Sold 1 @ 17771.75 (-$5.50)
      // Gross P&L: -$17.00, Fees: 6 sides * $0.51 = $3.06, Net P&L: -$20.06
      const rt1 = roundTrips[0]!;
      expect(rt1.symbol).toBe("MNQM4");
      expect(rt1.direction).toBe("long");
      expect(rt1.grossPnl).toBe(-17.0);
      expect(Math.round(rt1.fees * 100) / 100).toBe(3.06);
      expect(Math.round(rt1.netPnl * 100) / 100).toBe(-20.06);

      // Round Trip 2: Short MNQM4, 4 contracts
      // Sold 4 @ 17732.00, Bought 1 @ 17730.00 (+$4.00) + Bought 2 @ 17699.75 (+$129.00) + Bought 1 @ 17689.75 (+$84.50)
      // Gross P&L: +$217.50, Fees: 8 sides * $0.51 = $4.08, Net P&L: +$213.42
      const rt2 = roundTrips[1]!;
      expect(rt2.symbol).toBe("MNQM4");
      expect(rt2.direction).toBe("short");
      expect(rt2.grossPnl).toBe(217.5);
      expect(Math.round(rt2.fees * 100) / 100).toBe(4.08);
      expect(Math.round(rt2.netPnl * 100) / 100).toBe(213.42);

      // Overall statement parity:
      const totalGross = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
      const totalFees = roundTrips.reduce((acc, rt) => acc + rt.fees, 0);
      const totalNet = roundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);

      expect(totalGross).toBe(200.5);
      expect(Math.round(totalFees * 100) / 100).toBe(7.14);
      expect(Math.round(totalNet * 100) / 100).toBe(193.36);
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    it("Vector 1: 3x Aggressive Duplication collapses back to 7 unique execution IDs", () => {
      const triplicated = applyChaos(COMPLETED_ORDERS_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated);

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("rithmic");
      expect(parsed?.executions.length).toBe(7 * 3); // 21 executions parsed

      // Deduplication by execution ID collapses to exactly 7
      const uniqueIds = new Set(parsed?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(7);
    });

    it("Vector 2: Multi-Batch Splitting preserves cumulative fill count and fees across partitions", () => {
      const batches = splitIntoBatches(COMPLETED_ORDERS_CSV, 3);
      expect(batches).toHaveLength(3);

      let cumulativeExecutions = 0;
      let cumulativeFees = 0;
      const allExecutions: ImportedExecution[] = [];

      for (const batch of batches) {
        const detected = detectFormat(batch);
        expect(detected?.id).toBe("rithmic");

        const parsed = parseAuto(batch);
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("rithmic");
        cumulativeExecutions += parsed?.executions.length ?? 0;
        cumulativeFees += parsed?.executions.reduce((acc, e) => acc + e.fee, 0) ?? 0;
        if (parsed) allExecutions.push(...parsed.executions);
      }

      expect(cumulativeExecutions).toBe(7);
      expect(Math.round(cumulativeFees * 100) / 100).toBe(7.14);
      const uniqueIds = new Set(allExecutions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(7);
    });

    it("Vector 3: Temporal FIFO Shuffle yields identical FIFO P&L regardless of ingestion order", () => {
      const parsed = parseAuto(RITHMIC_CSV);
      const baseExecutions = parsed!.executions;

      // Reverse order
      const reversed = [...baseExecutions].reverse();
      const sortedReversed = [...reversed].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const reversedRoundTrips = buildRoundTrips(toExecutions(sortedReversed), {
        method: "fifo",
        multipliers: { MNQM4: 2 },
      });

      expect(reversedRoundTrips).toHaveLength(2);
      expect(reversedRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(200.5);
      expect(
        Math.round(reversedRoundTrips.reduce((acc, rt) => acc + rt.fees, 0) * 100) / 100,
      ).toBe(7.14);
      expect(
        Math.round(reversedRoundTrips.reduce((acc, rt) => acc + rt.netPnl, 0) * 100) / 100,
      ).toBe(193.36);

      // Pseudo-random shuffle of the data rows
      const shuffledCsv = applyChaos(COMPLETED_ORDERS_CSV, { shuffle: true, seed: 998877 });
      const parsedShuffled = parseAuto(shuffledCsv);
      expect(parsedShuffled).not.toBeNull();
      expect(parsedShuffled?.executions).toHaveLength(7);

      const sortedFromShuffled = [...parsedShuffled!.executions].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const shuffledRoundTrips = buildRoundTrips(toExecutions(sortedFromShuffled), {
        method: "fifo",
        multipliers: { MNQM4: 2 },
      });

      expect(shuffledRoundTrips).toHaveLength(2);
      expect(shuffledRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(200.5);
      expect(
        Math.round(shuffledRoundTrips.reduce((acc, rt) => acc + rt.fees, 0) * 100) / 100,
      ).toBe(7.14);
      expect(
        Math.round(shuffledRoundTrips.reduce((acc, rt) => acc + rt.netPnl, 0) * 100) / 100,
      ).toBe(193.36);
    });

    it("Vector 4: Corrupted & Malformed Rows are safely discarded without crashing", () => {
      const corruptedCsv = applyChaos(COMPLETED_ORDERS_CSV, {
        corruptedRows: [
          "",
          ",,,,,,,,,,,,,,,,,,,,",
          "CORRUPTED_ROW_WITHOUT_COMMAS",
          '"APEX-33521-11","Filled","","B","1","","MNQM4","M","INVALID_PRICE","","99901","AAG1","AAG1","APEX-33521","2024-04-24 10:30:05","1","2024-04-24 10:30:05","","","","0.51"',
          '"APEX-33521-11","Filled","","B","0","","MNQM4","M","17730.00","","99902","AAG2","AAG2","APEX-33521","2024-04-24 10:30:05","0","2024-04-24 10:30:05","","","","0.51"',
          '"APEX-33521-11","Filled","","B","-3","","MNQM4","M","17730.00","","99903","AAG3","AAG3","APEX-33521","2024-04-24 10:30:05","-3","2024-04-24 10:30:05","","","","0.51"',
          '"APEX-33521-11","Filled","","B","1","","","M","17730.00","","99904","AAG4","AAG4","APEX-33521","2024-04-24 10:30:05","1","2024-04-24 10:30:05","","","","0.51"',
          '"APEX-33521-11","Filled","","INVALID_SIDE","1","","MNQM4","M","17730.00","","99905","AAG5","AAG5","APEX-33521","2024-04-24 10:30:05","1","2024-04-24 10:30:05","","","","0.51"',
          '"APEX-33521-11","Filled","","B","1","","MNQM4","M","17730.00","","99906","AAG6","AAG6","APEX-33521","INVALID_TIMESTAMP","1","INVALID_TIMESTAMP","","","","0.51"',
        ],
      });

      const parsed = parseAuto(corruptedCsv);
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("rithmic");
      // Exactly 7 valid executions parsed, all corrupted and cancelled rows safely skipped
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.skippedRows).toBeGreaterThan(5);
    });

    it("Vector 5: UTF-8 BOM is handled transparently", () => {
      const bomCsv = applyChaos(RITHMIC_CSV, { injectBOM: true });
      const detected = detectFormat(bomCsv);
      expect(detected?.id).toBe("rithmic");

      const parsed = parseAuto(bomCsv);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.account).toBe("APEX-33521-11");
    });

    it("Vector 6: CRLF Line Endings are handled transparently", () => {
      const crlfBomCsv = applyChaos(RITHMIC_CSV, {
        injectBOM: true,
        crlf: true,
      });

      const detected = detectFormat(crlfBomCsv);
      expect(detected?.id).toBe("rithmic");

      const parsed = parseAuto(crlfBomCsv);
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(7);
      expect(parsed?.executions[0]?.price).toBe(17730);
    });

    it("Parity check: rithmic.csv and rithmic-r-trader-rithmic-r-trader.csv produce identical outputs", () => {
      const parsed1 = parseAuto(RITHMIC_CSV);
      const parsed2 = parseAuto(RITHMIC_COPY_CSV);

      expect(parsed1).not.toBeNull();
      expect(parsed2).not.toBeNull();
      expect(parsed1!.executions).toHaveLength(parsed2!.executions.length);

      for (let i = 0; i < parsed1!.executions.length; i++) {
        const e1 = parsed1!.executions[i]!;
        const e2 = parsed2!.executions[i]!;
        expect(e1.symbol).toBe(e2.symbol);
        expect(e1.side).toBe(e2.side);
        expect(e1.quantity).toBe(e2.quantity);
        expect(e1.price).toBe(e2.price);
        expect(e1.fee).toBe(e2.fee);
        expect(e1.executedAt).toBe(e2.executedAt);
        expect(e1.importMetadata?.id).toBe(e2.importMetadata?.id);
      }
    });
  });
});
