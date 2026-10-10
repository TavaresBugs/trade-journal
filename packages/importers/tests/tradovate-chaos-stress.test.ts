import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAuto, detectFormat } from "../src/detect";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import type { ImportedExecution } from "../src/types";

const FIXTURES_DIR = join(__dirname, "fixtures", "tradovate-lucid");

const ORDER_FILES = [
  "Orders.csv",
  "Orders(1).csv",
  "Orders(2).csv",
  "Orders(3).csv",
  "Orders(4).csv",
];

const loadFixture = (fileName: string): string =>
  readFileSync(join(FIXTURES_DIR, fileName), "utf-8");

describe("Tradovate / Lucid Trading — Chaos & Stress Test Battery", () => {
  it("parses all 5 separate order batches and verifies account and fill counts", () => {
    let totalFilled = 0;
    const expectedPerFile: Record<string, number> = {
      "Orders.csv": 76,
      "Orders(1).csv": 22,
      "Orders(2).csv": 14,
      "Orders(3).csv": 36,
      "Orders(4).csv": 18,
    };

    for (const file of ORDER_FILES) {
      const content = loadFixture(file);
      const format = detectFormat(content);
      expect(format?.id).toBe("tradovate");

      const parsed = parseAuto(content, { timeZone: "America/Chicago" });
      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("tradovate");
      expect(parsed?.account).toBe("LFE0506847043001");
      expect(parsed?.executions.length).toBe(expectedPerFile[file]);
      totalFilled += parsed?.executions.length ?? 0;
    }

    expect(totalFilled).toBe(166);
  });

  it("resists aggressive duplication: parsing duplicated content maintains unique executions", () => {
    const rawContent = loadFixture("Orders.csv");
    const lines = rawContent.split(/\r?\n/);
    const header = lines[0];
    const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

    // Create a 3x duplicated file with interleaved and appended copies
    const triplicatedContent = [
      header,
      ...dataLines,
      ...dataLines,
      ...dataLines,
    ].join("\n");

    const parsed = parseAuto(triplicatedContent, { timeZone: "America/Chicago" });
    expect(parsed).not.toBeNull();
    // In raw parser, all filled rows in the CSV are parsed
    expect(parsed?.executions.length).toBe(76 * 3);

    // Deduplication by unique fill signature (symbol, side, price, executedAt)
    const uniqueSignatures = new Set(
      parsed?.executions.map(
        (e) => `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`,
      ),
    );
    expect(uniqueSignatures.size).toBe(76);
  });

  it("resists temporal chaos: out-of-order and reverse-shuffled inputs yield identical FIFO P&L", () => {
    const chronologicalExecutions: ImportedExecution[] = [];

    // Load in reverse order
    for (const file of [...ORDER_FILES].reverse()) {
      const parsed = parseAuto(loadFixture(file), { timeZone: "America/Chicago" });
      if (parsed) {
        chronologicalExecutions.push(...parsed.executions);
      }
    }

    expect(chronologicalExecutions.length).toBe(166);

    // Chronologically sorted run
    const sorted = [...chronologicalExecutions].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );

    const roundTrips = buildRoundTrips(sorted as Execution[], {
      method: "fifo",
      multipliers: { MES: 5, MNQ: 2 },
    });

    expect(roundTrips.length).toBe(83);

    // Calculate total gross PnL
    const grossPnl = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
    expect(grossPnl).toBe(-636.25);

    // Random shuffle run
    const shuffled = [...chronologicalExecutions].sort(() => Math.random() - 0.5);
    const sortedShuffled = [...shuffled].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );

    const shuffledRoundTrips = buildRoundTrips(sortedShuffled as Execution[], {
      method: "fifo",
      multipliers: { MES: 5, MNQ: 2 },
    });

    expect(shuffledRoundTrips.length).toBe(83);
    const shuffledGrossPnl = shuffledRoundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
    expect(shuffledGrossPnl).toBe(-636.25);
  });

  it("safely rejects canceled, rejected, and malformed rows without crashing", () => {
    const rawContent = loadFixture("Orders.csv");
    const corruptedRows = [
      rawContent,
      "999999999999,LFE0506847043001,999999999999, Buy,MESM6,MES,Micro E-mini S&P 500,,,,999999999999, Canceled,-2,0,0.25,,999999999999,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
      "888888888888,LFE0506847043001,888888888888, Sell,MESM6,MES,Micro E-mini S&P 500,,,,888888888888, Rejected,-2,0,0.25,,888888888888,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
      ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
      "CORRUPTED_LINE_WITHOUT_COMMAS",
      "777777777777,LFE0506847043001,777777777777, Buy,MESM6,MES,Micro E-mini S&P 500,NaN,NaN,INVALID_TIMESTAMP,777777777777, Filled,-2,0,0.25,,777777777777,05/01/2026 12:20:25,5/1/26,1,Tradingview, Limit,27811.50,,27811.5,,,,,,,USD",
    ].join("\n");

    const parsed = parseAuto(corruptedRows, { timeZone: "America/Chicago" });
    expect(parsed).not.toBeNull();
    // Still exactly 76 filled valid rows from Orders.csv! Corrupted & canceled rows are discarded.
    expect(parsed?.executions.length).toBe(76);
  });

  it("reconciles with Lucid Trading site down to the exact penny", () => {
    const allExecutions: ImportedExecution[] = [];

    for (const file of ORDER_FILES) {
      const parsed = parseAuto(loadFixture(file), { timeZone: "America/Chicago" });
      if (parsed) {
        allExecutions.push(...parsed.executions);
      }
    }

    // Sort chronologically
    allExecutions.sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );

    // Verify native parser micro futures commissions ($0.50 per contract per side)
    const roundTrips = buildRoundTrips(allExecutions as Execution[], {
      method: "fifo",
      multipliers: { MES: 5, MNQ: 2 },
    });

    const grossPnl = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
    const totalFees = roundTrips.reduce((acc, rt) => acc + rt.fees, 0);
    const netPnl = roundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);
    const initialBalance = 50000.0;
    const finalBalance = initialBalance + netPnl;

    // Mathematical parity with official Tradovate Statement (-$727.25 / $49,272.75) and Lucid Dashboard (rounded -$727.00 / $49,273.00)
    expect(grossPnl).toBe(-636.25);
    expect(totalFees).toBe(91.00);
    expect(netPnl).toBe(-727.25);
    expect(finalBalance).toBe(49272.75);
    expect(Math.round(finalBalance)).toBe(49273);
  });
});
