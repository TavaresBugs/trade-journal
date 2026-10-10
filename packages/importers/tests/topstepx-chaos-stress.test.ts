import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { topstepx } from "../src/formats/topstepx";
import type { ImportedExecution } from "../src/types";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const TOPSTEPX_PATH = new URL(
  "./fixtures/tradezella/topstepx.csv",
  import.meta.url,
);
const TOPSTEPX_COPY_PATH = new URL(
  "./fixtures/tradezella/topstepx-topstepx.csv",
  import.meta.url,
);

const TOPSTEPX_CSV = readFileSync(TOPSTEPX_PATH, "utf8");
const TOPSTEPX_COPY_CSV = readFileSync(TOPSTEPX_COPY_PATH, "utf8");

const LEGACY_FILLS_CSV = `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-101,/ESU6,5000.25,2026-08-20 09:31:05,Opening,Bid,2,Filled,Market
TSX-101,/ESU6,5010.50,2026-08-20 09:45:10,Closing,Ask,2,Filled,Market`;

const toExecutions = (imported: ImportedExecution[]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("TopstepX — Chaos & Stress Test Suite", () => {
  describe("Futures Point Multiplier & Reported Gross P&L", () => {
    it("preserves reported gross P&L on execution legs for NQM4 futures", () => {
      const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("topstepx");
      expect(parsed?.executions).toHaveLength(76); // 38 trades * 2 legs

      // Trade 1 in NQM4:
      // Entry: 18228.25, Exit: 18223.75 -> 4.50 pts difference
      // NQ multiplier: $20/pt -> 4.50 * 20 = $90.00 reported gross P&L
      const entry1 = parsed!.executions[0]!;
      expect(entry1.symbol).toBe("NQM4");
      expect(entry1.side).toBe("sell"); // Short trade entry
      expect(entry1.quantity).toBe(1);
      expect(entry1.price).toBe(18228.25);
      expect(entry1.fee).toBe(0);
      expect(entry1.assetClass).toBe("futures");
      expect(entry1.importMetadata?.id).toBe("topstepx:trade:37199170:entry");

      const exit1 = parsed!.executions[1]!;
      expect(exit1.symbol).toBe("NQM4");
      expect(exit1.side).toBe("buy"); // Short trade exit
      expect(exit1.quantity).toBe(1);
      expect(exit1.price).toBe(18223.75);
      expect(exit1.fee).toBe(1.4);
      expect(exit1.assetClass).toBe("futures");
      expect(exit1.importMetadata?.id).toBe("topstepx:trade:37199170:exit");
      expect(exit1.importMetadata?.reportedGrossPnl).toBe(90.0);
      expect(exit1.importMetadata?.preserveFee).toBe(true);

      // Verify FIFO round-trip engine directly uses reported gross PnL
      const pair = toExecutions([entry1, exit1]);
      const roundTrips = buildRoundTrips(pair, { method: "fifo" });
      expect(roundTrips).toHaveLength(1);
      expect(roundTrips[0]?.grossPnl).toBe(90.0);
      expect(roundTrips[0]?.fees).toBe(1.4);
      expect(roundTrips[0]?.netPnl).toBe(88.6);
    });

    it("reconciles all 38 trades with penny-perfect parity against reported statement", () => {
      const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();

      const sorted = [...parsed!.executions].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );

      const roundTrips = buildRoundTrips(toExecutions(sorted), {
        method: "fifo",
        multipliers: { NQM4: 20 },
      });

      expect(roundTrips).toHaveLength(38);

      const totalGross = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
      const totalFees = roundTrips.reduce((acc, rt) => acc + rt.fees, 0);
      const totalNet = roundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);

      // Official statement sums: Gross -$315.00, Fees $70.00, Net -$385.00
      expect(totalGross).toBe(-315.0);
      expect(Math.round(totalFees * 100) / 100).toBe(70.0);
      expect(Math.round(totalNet * 100) / 100).toBe(-385.0);
    });
  });

  describe("Dual Format Parsing: Trades Tab vs Fills Tab", () => {
    it("detects and parses Trades tab format (with PnL)", () => {
      const format = detectFormat(TOPSTEPX_CSV);
      expect(format?.id).toBe("topstepx");

      const parsed = topstepx.parse(TOPSTEPX_CSV, { timeZone: "UTC" });
      expect(parsed.format).toBe("topstepx");
      expect(parsed.skippedRows).toBe(0);
      expect(parsed.executions).toHaveLength(76);
      expect(parsed.executions[0]!.assetClass).toBe("futures");
      expect(parsed.executions[1]!.importMetadata?.reportedGrossPnl).toBe(90.0);
    });

    it("detects and parses Fills tab format (legacy fills)", () => {
      const format = detectFormat(LEGACY_FILLS_CSV);
      expect(format?.id).toBe("topstepx");

      const parsed = topstepx.parse(LEGACY_FILLS_CSV, { timeZone: "America/Chicago" });
      expect(parsed.format).toBe("topstepx");
      expect(parsed.account).toBe("TSX-101");
      expect(parsed.sourceAccounts).toEqual(["TSX-101"]);
      expect(parsed.executions).toHaveLength(2);

      // Normalizes symbol (strips leading slash)
      expect(parsed.executions[0]!.symbol).toBe("ESU6");
      expect(parsed.executions[0]!.side).toBe("buy"); // Bid
      expect(parsed.executions[0]!.quantity).toBe(2);
      expect(parsed.executions[0]!.price).toBe(5000.25);
      expect(parsed.executions[0]!.assetClass).toBe("futures");

      expect(parsed.executions[1]!.symbol).toBe("ESU6");
      expect(parsed.executions[1]!.side).toBe("sell"); // Ask
      expect(parsed.executions[1]!.quantity).toBe(2);
      expect(parsed.executions[1]!.price).toBe(5010.5);
      expect(parsed.executions[1]!.assetClass).toBe("futures");
    });
  });

  describe("Direction Fallback Logic", () => {
    it("infers side via (entryPrice < exitPrice) === (pnl > 0) when Type is missing", () => {
      // 4 scenarios: Winning Long, Losing Long, Winning Short, Losing Short
      const testCases = [
        {
          name: "Winning Long",
          entryPrice: 100,
          exitPrice: 110,
          pnl: 50,
          expectedEntrySide: "buy",
          expectedExitSide: "sell",
        },
        {
          name: "Losing Long",
          entryPrice: 110,
          exitPrice: 100,
          pnl: -50,
          expectedEntrySide: "buy",
          expectedExitSide: "sell",
        },
        {
          name: "Winning Short",
          entryPrice: 110,
          exitPrice: 100,
          pnl: 50,
          expectedEntrySide: "sell",
          expectedExitSide: "buy",
        },
        {
          name: "Losing Short",
          entryPrice: 100,
          exitPrice: 110,
          pnl: -50,
          expectedEntrySide: "sell",
          expectedExitSide: "buy",
        },
      ];

      for (const tc of testCases) {
        const csvWithoutType = [
          "Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,TradeDay",
          `99901,NQM4,05/07/2024 13:30:00 +00:00,05/07/2024 13:35:00 +00:00,${tc.entryPrice},${tc.exitPrice},1.40,${tc.pnl},1,05/07/2024 05:00:00 +00:00`,
        ].join("\n");

        const parsed = parseAuto(csvWithoutType, { timeZone: "UTC" });
        expect(parsed, `Failed for case: ${tc.name}`).not.toBeNull();
        expect(parsed?.executions).toHaveLength(2);

        const [entry, exit] = parsed!.executions;
        expect(entry!.side, `${tc.name} entry side`).toBe(tc.expectedEntrySide);
        expect(exit!.side, `${tc.name} exit side`).toBe(tc.expectedExitSide);
      }
    });

    it("reconstructs 100% of directions identically on real CSV when Type column is stripped", () => {
      // Strip Type column from real TOPSTEPX_CSV
      const lines = TOPSTEPX_CSV.trim().split("\n");
      const headerParts = lines[0]!.split(",");
      const typeIndex = headerParts.indexOf("Type");
      expect(typeIndex).toBeGreaterThan(-1);

      const strippedLines = lines.map((line) => {
        const parts = line.split(",");
        parts.splice(typeIndex, 1);
        return parts.join(",");
      });
      const strippedCsv = strippedLines.join("\n");

      const parsedOriginal = parseAuto(TOPSTEPX_CSV, { timeZone: "UTC" });
      const parsedStripped = parseAuto(strippedCsv, { timeZone: "UTC" });

      expect(parsedOriginal).not.toBeNull();
      expect(parsedStripped).not.toBeNull();
      expect(parsedStripped?.executions).toHaveLength(parsedOriginal!.executions.length);

      for (let i = 0; i < parsedOriginal!.executions.length; i++) {
        expect(parsedStripped!.executions[i]!.side).toBe(
          parsedOriginal!.executions[i]!.side,
        );
      }
    });
  });

  describe("Fee Consolidation ($1.40 Round-Trip Fee)", () => {
    it("consolidates $1.40 round-trip fee on the exit execution leg", () => {
      const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();

      // Check standard 1-contract trade
      const entry = parsed!.executions[0]!;
      const exit = parsed!.executions[1]!;
      expect(entry.fee).toBe(0);
      expect(exit.fee).toBe(1.4);
      expect(exit.importMetadata?.preserveFee).toBe(true);

      // Check 3-contract trade (e.g. trade index 15: Id 37419652, Size 3, Fees 4.20)
      const size3Entry = parsed!.executions[30]!;
      const size3Exit = parsed!.executions[31]!;
      expect(size3Entry.quantity).toBe(3);
      expect(size3Entry.fee).toBe(0);
      expect(size3Exit.quantity).toBe(3);
      expect(size3Exit.fee).toBe(4.2);
      expect(size3Exit.importMetadata?.preserveFee).toBe(true);
    });
  });

  describe("6 Universal Chaos Vectors", () => {
    it("Vector 1: 3x Aggressive Duplication collapses to exact unique executions", () => {
      const triplicated = applyChaos(TOPSTEPX_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("topstepx");
      expect(parsed?.executions.length).toBe(76 * 3);

      // Deduplication by import metadata ID collapses back to 76
      const uniqueIds = new Set(parsed?.executions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(76);

      // Deduplication by fill signature: in real export, trades 38892826 & 38892828 and 38932256 & 38932257
      // scaled in separately but exited at the exact same second & price (74 unique signatures among 76 legs).
      const uniqueSignatures = new Set(
        parsed?.executions.map(
          (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
        ),
      );
      expect(uniqueSignatures.size).toBe(74);
    });

    it("Vector 2: Multi-Batch Splitting preserves cumulative fill count across partitions", () => {
      const batches = splitIntoBatches(TOPSTEPX_CSV, 4);
      expect(batches).toHaveLength(4);

      let cumulativeExecutions = 0;
      const allExecutions: ImportedExecution[] = [];

      for (const batch of batches) {
        const detected = detectFormat(batch);
        expect(detected?.id).toBe("topstepx");

        const parsed = parseAuto(batch, { timeZone: "America/Chicago" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("topstepx");
        cumulativeExecutions += parsed?.executions.length ?? 0;
        if (parsed) allExecutions.push(...parsed.executions);
      }

      expect(cumulativeExecutions).toBe(76);
      const uniqueIds = new Set(allExecutions.map((e) => e.importMetadata?.id));
      expect(uniqueIds.size).toBe(76);
    });

    it("Vector 3: Temporal FIFO Shuffle yields identical FIFO P&L regardless of order", () => {
      const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
      const baseExecutions = parsed!.executions;

      // Chronological sort run
      const sorted = [...baseExecutions].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const sortedRoundTrips = buildRoundTrips(toExecutions(sorted), {
        method: "fifo",
        multipliers: { NQM4: 20 },
      });
      const expectedGross = sortedRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
      const expectedNet = sortedRoundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);

      // Reverse shuffle run
      const reversed = [...baseExecutions].reverse();
      const sortedReversed = [...reversed].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const reversedRoundTrips = buildRoundTrips(toExecutions(sortedReversed), {
        method: "fifo",
        multipliers: { NQM4: 20 },
      });
      expect(reversedRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(expectedGross);
      expect(reversedRoundTrips.reduce((acc, rt) => acc + rt.netPnl, 0)).toBe(expectedNet);

      // Random seed-shuffled CSV content
      const shuffledCsv = applyChaos(TOPSTEPX_CSV, { shuffle: true, seed: 12345 });
      const parsedShuffled = parseAuto(shuffledCsv, { timeZone: "America/Chicago" });
      expect(parsedShuffled).not.toBeNull();
      expect(parsedShuffled?.executions).toHaveLength(76);

      const sortedFromShuffled = [...parsedShuffled!.executions].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const shuffledRoundTrips = buildRoundTrips(toExecutions(sortedFromShuffled), {
        method: "fifo",
        multipliers: { NQM4: 20 },
      });
      expect(shuffledRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0)).toBe(expectedGross);
      expect(shuffledRoundTrips.reduce((acc, rt) => acc + rt.netPnl, 0)).toBe(expectedNet);
    });

    it("Vector 4: Corrupted & Malformed Rows are safely discarded without crashing", () => {
      const corruptedCsv = applyChaos(TOPSTEPX_CSV, {
        corruptedRows: [
          "",
          ",,,,,,,,,,",
          "CORRUPTED_ROW_WITHOUT_COMMAS",
          "99901,NQM4,INVALID_DATE,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
          "99902,NQM4,05/07/2024 13:33:37,INVALID_DATE,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
          "99903,,05/07/2024 13:33:37,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,1,Short,05/07/2024",
          "99904,NQM4,05/07/2024 13:33:37,05/07/2024 13:34:07,NaN,18223.75,1.40,90.0,1,Short,05/07/2024",
          "99905,NQM4,05/07/2024 13:33:37,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,0,Short,05/07/2024",
          "99906,NQM4,05/07/2024 13:33:37,05/07/2024 13:34:07,18228.25,18223.75,1.40,90.0,-5,Short,05/07/2024",
        ],
      });

      const parsed = parseAuto(corruptedCsv, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("topstepx");
      // All 76 valid executions intact, corrupted rows skipped
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.skippedRows).toBeGreaterThan(0);
    });

    it("Vector 5: UTF-8 BOM is handled transparently", () => {
      const bomCsv = applyChaos(TOPSTEPX_CSV, { injectBOM: true });
      const detected = detectFormat(bomCsv);
      expect(detected?.id).toBe("topstepx");

      const parsed = parseAuto(bomCsv, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.executions[0]?.symbol).toBe("NQM4");
    });

    it("Vector 6: CRLF Line Endings are handled transparently", () => {
      const crlfBomCsv = applyChaos(TOPSTEPX_CSV, {
        injectBOM: true,
        crlf: true,
      });

      const detected = detectFormat(crlfBomCsv);
      expect(detected?.id).toBe("topstepx");

      const parsed = parseAuto(crlfBomCsv, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.executions).toHaveLength(76);
      expect(parsed?.executions[0]?.price).toBe(18228.25);
    });

    it("Parity check: topstepx.csv and topstepx-topstepx.csv produce identical outputs", () => {
      const parsed1 = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
      const parsed2 = parseAuto(TOPSTEPX_COPY_CSV, { timeZone: "America/Chicago" });

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
        expect(e1.importMetadata?.reportedGrossPnl).toBe(
          e2.importMetadata?.reportedGrossPnl,
        );
      }
    });
  });
});
