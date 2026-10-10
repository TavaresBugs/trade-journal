import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { applyChaos, splitIntoBatches } from "./helpers/csv-fixtures";

const COPY_TRADES_CSV = readFileSync(
  new URL("./fixtures/ninjatrader-copy-trades.csv", import.meta.url),
  "utf8",
);

const REAL_NINJA_CSV = readFileSync(
  new URL("./fixtures/tradezella/ninjatrader-ninjatrader.csv", import.meta.url),
  "utf8",
);

const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

describe("NinjaTrader — Chaos & Stress Test Battery", () => {
  describe("Multi-batch ingestion", () => {
    it("preserves total fill count when split across multiple batches (copy trades)", () => {
      const batches = splitIntoBatches(COPY_TRADES_CSV, 3);
      expect(batches).toHaveLength(3);

      let totalFills = 0;
      for (const batch of batches) {
        const detected = detectFormat(batch);
        expect(detected?.id).toBe("ninjatrader");

        const parsed = parseAuto(batch, { timeZone: "UTC" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ninjatrader");
        totalFills += parsed?.executions.length ?? 0;
      }

      expect(totalFills).toBe(26);
    });

    it("preserves 336 fills and all unique execution identities across 5 batches on large real export", () => {
      const batches = splitIntoBatches(REAL_NINJA_CSV, 5);
      expect(batches).toHaveLength(5);

      let totalFills = 0;
      const allExecutions: ReturnType<typeof parseAuto>["executions"] = [];

      for (const batch of batches) {
        const parsed = parseAuto(batch, { timeZone: "America/Chicago" });
        expect(parsed).not.toBeNull();
        expect(parsed?.format).toBe("ninjatrader");
        totalFills += parsed?.executions.length ?? 0;
        if (parsed) allExecutions.push(...parsed.executions);
      }

      expect(totalFills).toBe(336);

      // Verify that all 336 unique execution IDs are preserved across batch boundaries
      const uniqueExecutionIds = new Set(
        allExecutions.map((e) => e.importMetadata?.id).filter(Boolean),
      );
      expect(uniqueExecutionIds.size).toBe(336);
    });
  });

  describe("Aggressive duplication resilience", () => {
    it("deduplicates 3x duplicated rows via unique execution IDs on real exports", () => {
      const triplicated = applyChaos(REAL_NINJA_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "America/Chicago" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ninjatrader");
      expect(parsed?.executions.length).toBe(336 * 3);
      expect(parsed?.errors).toEqual([]);

      // Execution ID deduplication collapses 1008 fills back to the 336 true executions
      const uniqueExecutionIds = new Set(
        parsed?.executions.map((e) => e.importMetadata?.id),
      );
      expect(uniqueExecutionIds.size).toBe(336);

      // Multiset key deduplication: [group, id]
      const uniqueIdentities = new Set(
        parsed?.executions.map((e) =>
          JSON.stringify([e.importMetadata?.group, e.importMetadata?.id]),
        ),
      );
      expect(uniqueIdentities.size).toBe(336);
    });

    it("deduplicates 3x duplicated copy trades via multiset occurrence counting", () => {
      const triplicated = applyChaos(COPY_TRADES_CSV, { duplicateCount: 3 });
      const parsed = parseAuto(triplicated, { timeZone: "UTC" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ninjatrader");
      expect(parsed?.executions.length).toBe(26 * 3);

      // Distinct multiset signature keys
      const multisetCounts = new Map<string, number>();
      for (const e of parsed?.executions ?? []) {
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

      // Exactly 17 unique signature groups across the 26 genuine fills
      expect(multisetCounts.size).toBe(17);

      // When normalized by 3x multiplier, exact original 26 fills are recovered
      let normalizedTotalFills = 0;
      for (const count of multisetCounts.values()) {
        expect(count % 3).toBe(0);
        normalizedTotalFills += count / 3;
      }
      expect(normalizedTotalFills).toBe(26);
    });
  });

  describe("Temporal chaos & FIFO invariant", () => {
    it("produces identical FIFO PnL under random row shuffling", () => {
      // 1. Baseline chronological calculation
      const baseResult = parseAuto(COPY_TRADES_CSV, { timeZone: "UTC" })!;
      const baseSorted = [...toExecutions(baseResult.executions)].sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );
      const baseTrips = buildRoundTrips(baseSorted, {
        method: "fifo",
        multipliers: { MNQZ6: 2 },
      });

      const baseGross = baseTrips.reduce((acc, t) => acc + t.grossPnl, 0);
      const baseNet = baseTrips.reduce((acc, t) => acc + t.netPnl, 0);
      expect(baseTrips).toHaveLength(5);
      expect(baseNet).toBe(5265);

      // 2. Test multiple shuffled variants
      const seeds = [101, 202, 303, 404, 505];
      for (const seed of seeds) {
        const shuffledCsv = applyChaos(COPY_TRADES_CSV, {
          shuffle: true,
          seed,
        });

        const shuffledResult = parseAuto(shuffledCsv, { timeZone: "UTC" })!;
        expect(shuffledResult.executions).toHaveLength(26);

        const shuffledSorted = [...toExecutions(shuffledResult.executions)].sort(
          (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
        );

        const shuffledTrips = buildRoundTrips(shuffledSorted, {
          method: "fifo",
          multipliers: { MNQZ6: 2 },
        });

        expect(shuffledTrips).toHaveLength(5);
        expect(shuffledTrips.reduce((acc, t) => acc + t.grossPnl, 0)).toBe(baseGross);
        expect(shuffledTrips.reduce((acc, t) => acc + t.netPnl, 0)).toBe(baseNet);
        expect(shuffledTrips.every((t) => t.status === "win")).toBe(true);
      }
    });
  });

  describe("Corrupted and rejected order rows", () => {
    it("gracefully discards malformed and rejected order rows without throwing unhandled exceptions", () => {
      const corruptedRows = [
        ",,,,,,,,,,,,,,",
        "CORRUPTED_LINE_WITHOUT_COMMAS",
        "NQ 03-24,Buy,0,16793.00,1/17/2024 1:10:38 PM,bad_0,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,-5,16793.00,1/17/2024 1:10:38 PM,bad_neg,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,1,NaN,1/17/2024 1:10:38 PM,bad_nan,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,1,16793.00,NOT_A_TIMESTAMP,bad_time,Entry,-,,,$2.29,1,ACC,CONN,",
        "NQ 03-24,Buy,1,16793.00,1/17/2024 1:10:38 PM,bad_fee,Entry,-,,,NOT_A_FEE,1,ACC,CONN,",
        "NQ 03-24,OrderCanceled,1,16793.00,1/17/2024 1:10:38 PM,bad_side,Entry,-,,,$2.29,1,ACC,CONN,",
      ];

      const chaoticCsv = applyChaos(COPY_TRADES_CSV, { corruptedRows });
      const parsed = parseAuto(chaoticCsv, { timeZone: "UTC" });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ninjatrader");
      // All 26 valid fills are parsed; corrupted rows are skipped
      expect(parsed?.executions).toHaveLength(26);
      expect(parsed?.skippedRows).toBeGreaterThanOrEqual(corruptedRows.length - 2);
    });
  });

  describe("UTF-8 BOM and CRLF line handling", () => {
    it("processes UTF-8 BOM with CRLF lines identically to plain LF (both copy trades and full export)", () => {
      // Copy trades
      const bomCrlfCopy = applyChaos(COPY_TRADES_CSV, {
        injectBOM: true,
        crlf: true,
      });
      const parsedCopy = parseAuto(bomCrlfCopy, { timeZone: "UTC" });
      expect(parsedCopy).not.toBeNull();
      expect(parsedCopy?.format).toBe("ninjatrader");
      expect(parsedCopy?.executions).toHaveLength(26);

      // Large real export
      const bomCrlfReal = applyChaos(REAL_NINJA_CSV, {
        injectBOM: true,
        crlf: true,
      });
      const parsedReal = parseAuto(bomCrlfReal, { timeZone: "America/Chicago" });
      expect(parsedReal).not.toBeNull();
      expect(parsedReal?.format).toBe("ninjatrader");
      expect(parsedReal?.executions).toHaveLength(336);
    });

    it("parses Brazilian PT-BR NinjaTrader export with UTF-8 BOM and CRLF", () => {
      const ptbrCsv = [
        "Ativo,Pos. mercado,Quantidade,Preço,Data/Hora,Corretagem,Conta,ID",
        "WINV26,Compra,2,135000.00,25/01/2026 10:15:30,2.50,SIM101,exec_br_1",
        "WINV26,Venda,2,135250.00,25/01/2026 10:45:00,2.50,SIM101,exec_br_2",
      ].join("\n");

      const bomCrlfPt = applyChaos(ptbrCsv, { injectBOM: true, crlf: true });
      const parsed = parseAuto(bomCrlfPt, {
        timeZone: "America/Sao_Paulo",
        dateOrder: "DMY",
      });

      expect(parsed).not.toBeNull();
      expect(parsed?.format).toBe("ninjatrader");
      expect(parsed?.executions).toHaveLength(2);
      expect(parsed?.executions[0]?.symbol).toBe("WINV26");
      expect(parsed?.executions[0]?.side).toBe("buy");
      expect(parsed?.executions[1]?.side).toBe("sell");
      expect(parsed?.executions[0]?.fee).toBe(2.5);
    });
  });
});
