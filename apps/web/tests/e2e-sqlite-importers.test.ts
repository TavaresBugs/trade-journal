import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { ImportReviewOptions } from "../src/lib/import-review";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-e2e-test-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts, executions, trades, settings } = await import("../src/db");
const { rebuildAccount } = await import("../src/server/rebuild");
const { POST } = await import("../src/app/api/import/route");

interface FixtureSpec {
  id: string;
  name: string;
  relativeUrl: string;
  fileName: string;
  expectedFormat: string;
  expectedExecutions: number;
  expectedTrades: number;
  expectedGrossPnl: number;
  expectedFees: number;
  expectedNetPnl: number;
}

const FIXTURES: FixtureSpec[] = [
  {
    id: "tradovate",
    name: "Tradovate",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradovate-lucid/Orders.csv",
    fileName: "Orders.csv",
    expectedFormat: "tradovate",
    expectedExecutions: 76,
    expectedTrades: 38,
    expectedGrossPnl: -224.75,
    expectedFees: 39.0,
    expectedNetPnl: -263.75,
  },
  {
    id: "ninjatrader-copy",
    name: "NinjaTrader (Copy Trades)",
    relativeUrl: "../../../packages/importers/tests/fixtures/ninjatrader-copy-trades.csv",
    fileName: "ninjatrader-copy-trades.csv",
    expectedFormat: "ninjatrader",
    expectedExecutions: 26,
    expectedTrades: 5,
    expectedGrossPnl: 5265.0,
    expectedFees: 0.0,
    expectedNetPnl: 5265.0,
  },
  {
    id: "ninjatrader-tradezella",
    name: "NinjaTrader (TradeZella)",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/ninjatrader-ninjatrader.csv",
    fileName: "ninjatrader-ninjatrader.csv",
    expectedFormat: "ninjatrader",
    expectedExecutions: 336,
    expectedTrades: 61,
    expectedGrossPnl: 10667.0,
    expectedFees: 636.82,
    expectedNetPnl: 10030.18,
  },
  {
    id: "topstepx",
    name: "TopstepX",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/topstepx.csv",
    fileName: "topstepx.csv",
    expectedFormat: "topstepx",
    expectedExecutions: 76,
    expectedTrades: 38,
    expectedGrossPnl: -315.0,
    expectedFees: 70.0,
    expectedNetPnl: -385.0,
  },
  {
    id: "ctrader",
    name: "cTrader",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/ctrader.htm",
    fileName: "ctrader.htm",
    expectedFormat: "ctrader",
    expectedExecutions: 10,
    expectedTrades: 5,
    expectedGrossPnl: -4.26,
    expectedFees: 3.52,
    expectedNetPnl: -7.78,
  },
  {
    id: "ibkr",
    name: "IBKR Flex",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/ibkr.csv",
    fileName: "ibkr.csv",
    expectedFormat: "ibkr-flex",
    expectedExecutions: 675,
    expectedTrades: 200,
    expectedGrossPnl: 11.97,
    expectedFees: 0.2,
    expectedNetPnl: 11.77,
  },
  {
    id: "rithmic",
    name: "Rithmic",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/rithmic.csv",
    fileName: "rithmic.csv",
    expectedFormat: "rithmic",
    expectedExecutions: 7,
    expectedTrades: 2,
    expectedGrossPnl: 200.5,
    expectedFees: 7.14,
    expectedNetPnl: 193.36,
  },
  {
    id: "quantower",
    name: "Quantower",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/quantower.csv",
    fileName: "quantower.csv",
    expectedFormat: "quantower",
    expectedExecutions: 15,
    expectedTrades: 5,
    expectedGrossPnl: -0.03,
    expectedFees: 0.0,
    expectedNetPnl: -0.03,
  },
  {
    id: "matchtrader",
    name: "MatchTrader",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/matchtrader.html",
    fileName: "matchtrader.html",
    expectedFormat: "matchtrader",
    expectedExecutions: 32,
    expectedTrades: 12,
    expectedGrossPnl: 947.5,
    expectedFees: 324.15,
    expectedNetPnl: 623.35,
  },
  {
    id: "thinkorswim",
    name: "ThinkorSwim",
    relativeUrl: "../../../packages/importers/tests/fixtures/tradezella/thinkorswim.csv",
    fileName: "thinkorswim.csv",
    expectedFormat: "thinkorswim",
    expectedExecutions: 13,
    expectedTrades: 3,
    expectedGrossPnl: 722.2,
    expectedFees: 0.0,
    expectedNetPnl: 722.2,
  },
  {
    id: "tradingview",
    name: "TradingView",
    relativeUrl: "../../../docs/samples/demo-trades-tradingview.csv",
    fileName: "demo-trades-tradingview.csv",
    expectedFormat: "tradingview",
    expectedExecutions: 2038,
    expectedTrades: 783,
    expectedGrossPnl: 26143.02,
    expectedFees: 1147.04,
    expectedNetPnl: 24995.98,
  },
];

const request = (body: object) =>
  new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const DEFAULT_MULTIPLIERS = {
  MNQZ6: 2,
  NQ: 20,
  ES: 50,
  MNQ: 2,
  MES: 5,
  YM: 5,
  NQM4: 20,
  MNQM4: 2,
  RTY: 50,
  CL: 1000,
  GC: 100,
};

beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  db.delete(trades).run();
  db.delete(executions).run();
  db.delete(accounts).run();
  db.delete(settings).run();
  db.insert(settings)
    .values({ key: "multipliers", value: JSON.stringify(DEFAULT_MULTIPLIERS) })
    .run();
});

afterAll(() => {
  vi.unstubAllEnvs();
  db.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("End-to-End SQLite Broker Ingestion Suite", () => {
  for (const fixture of FIXTURES) {
    it(`imports ${fixture.name} export end-to-end via preview, commit, and trade reconstruction`, async () => {
      const accountId = `e2e-${fixture.id}`;
      let content = readFileSync(new URL(fixture.relativeUrl, import.meta.url), "utf8");

      // For unsequenced third-party NinjaTrader exports with sub-second ties, provide Sequence column
      if (fixture.id === "ninjatrader-tradezella") {
        const lines = content.trim().split(/\r?\n/);
        const header = lines[0] + ",Sequence";
        const rows = lines.slice(1).map((line, idx) => line + `,${idx + 1}`);
        content = [header, ...rows].join("\n");
      }

      db.insert(accounts)
        .values({
          id: accountId,
          name: `Account for ${fixture.name}`,
          kind: "import",
          createdAt: "2026-01-01",
        })
        .run();

      // Step 1: Preview mode
      const previewResponse = await POST(
        request({
          mode: "preview",
          content,
          fileName: fixture.fileName,
          accountId,
          timeZone: "UTC",
        }),
      );
      expect(previewResponse.status).toBe(200);

      const previewData = await previewResponse.json();
      expect(previewData.detected).toBe(fixture.expectedFormat);
      expect(previewData.totals.executions).toBeGreaterThan(0);
      expect(previewData.errors ?? []).toEqual([]);

      // Assert valid reconciliation details
      expect(previewData.accountReconciliation).toBeDefined();
      expect(previewData.accountReconciliation.totalFills).toBe(previewData.totals.executions);
      expect(previewData.accountReconciliation.newFills).toBe(previewData.totals.executions);

      let previewToken: string | undefined = undefined;
      if (previewData.detected === "ninjatrader") {
        expect(previewData.reconciliation).toBeDefined();
        expect(typeof previewData.reconciliation?.token).toBe("string");
        expect(previewData.reconciliation.token.length).toBe(64);
        previewToken = previewData.reconciliation.token;
      }

      // Assert database is untouched during preview
      expect(db.select().from(executions).where(eq(executions.accountId, accountId)).all()).toHaveLength(0);
      expect(db.select().from(trades).where(eq(trades.accountId, accountId)).all()).toHaveLength(0);

      // Step 2: Commit mode
      const commitReview: ImportReviewOptions = previewToken ? { previewToken } : {};
      const commitResponse = await POST(
        request({
          mode: "commit",
          content,
          fileName: fixture.fileName,
          accountId,
          timeZone: "UTC",
          review: commitReview,
        }),
      );
      expect(commitResponse.status).toBe(200);

      const commitData = await commitResponse.json();
      expect(commitData.inserted).toBe(previewData.totals.executions);
      expect(commitData.duplicates).toBe(0);

      // Step 3: Verify executions in SQLite database
      const insertedExecutions = db
        .select()
        .from(executions)
        .where(eq(executions.accountId, accountId))
        .all();
      expect(insertedExecutions.length).toBe(previewData.totals.executions);

      for (const exec of insertedExecutions) {
        expect(exec.accountId).toBe(accountId);
        expect(typeof exec.symbol).toBe("string");
        expect(exec.symbol.trim().length).toBeGreaterThan(0);

        expect(typeof exec.price).toBe("number");
        expect(Number.isFinite(exec.price)).toBe(true);
        expect(exec.price).toBeGreaterThan(0);

        expect(typeof exec.quantity).toBe("number");
        expect(Number.isFinite(exec.quantity)).toBe(true);
        expect(exec.quantity).toBeGreaterThan(0);

        expect(typeof exec.fee).toBe("number");
        expect(Number.isFinite(exec.fee)).toBe(true);
        expect(exec.fee).toBeGreaterThanOrEqual(0);

        expect(["buy", "sell"]).toContain(exec.side);
      }

      // Step 4: Verify reconstructed trades in SQLite database (1:1 strict checks)
      const reconstructedTrades = db
        .select()
        .from(trades)
        .where(eq(trades.accountId, accountId))
        .all();
      expect(reconstructedTrades.length).toBe(fixture.expectedTrades);

      // Verify no duplicate trade keys
      const tradeKeys = new Set(reconstructedTrades.map((t) => t.key));
      expect(tradeKeys.size).toBe(reconstructedTrades.length);

      // Verify 1:1 exact financial reconciliation
      const totalGross = reconstructedTrades.reduce((s, t) => s + t.grossPnl, 0);
      const totalFees = reconstructedTrades.reduce((s, t) => s + t.fees, 0);
      const totalNet = reconstructedTrades.reduce((s, t) => s + t.netPnl, 0);

      expect(totalGross).toBeCloseTo(fixture.expectedGrossPnl, 2);
      expect(totalFees).toBeCloseTo(fixture.expectedFees, 2);
      expect(totalNet).toBeCloseTo(fixture.expectedNetPnl, 2);
      expect(totalGross - totalFees).toBeCloseTo(totalNet, 2);

      for (const trade of reconstructedTrades) {
        expect(trade.accountId).toBe(accountId);
        expect(typeof trade.symbol).toBe("string");
        expect(trade.symbol.trim().length).toBeGreaterThan(0);

        expect(typeof trade.grossPnl).toBe("number");
        expect(Number.isFinite(trade.grossPnl)).toBe(true);

        expect(typeof trade.netPnl).toBe("number");
        expect(Number.isFinite(trade.netPnl)).toBe(true);

        expect(["win", "loss", "breakeven", "open"]).toContain(trade.status);

        expect(typeof trade.executionCount).toBe("number");
        expect(trade.executionCount).toBeGreaterThan(0);

        expect(typeof trade.quantity).toBe("number");
        expect(trade.quantity).toBeGreaterThan(0);
      }

      // Step 5: Test rebuildAccount idempotency
      rebuildAccount(accountId);
      const postRebuildTrades = db
        .select()
        .from(trades)
        .where(eq(trades.accountId, accountId))
        .all();
      expect(postRebuildTrades.length).toBe(reconstructedTrades.length);
      expect(postRebuildTrades.map((t) => t.key).sort()).toEqual(reconstructedTrades.map((t) => t.key).sort());
      expect(postRebuildTrades.reduce((sum, t) => sum + t.netPnl, 0)).toBeCloseTo(
        reconstructedTrades.reduce((sum, t) => sum + t.netPnl, 0),
        5,
      );

      // Step 6: Test deduplication on repeated commit
      const dedupPreviewResponse = await POST(
        request({
          mode: "preview",
          content,
          fileName: fixture.fileName,
          accountId,
          timeZone: "UTC",
        }),
      );
      expect(dedupPreviewResponse.status).toBe(200);
      const dedupPreviewData = await dedupPreviewResponse.json();
      expect(dedupPreviewData.accountReconciliation.existingFills).toBe(previewData.totals.executions);
      expect(dedupPreviewData.accountReconciliation.newFills).toBe(0);

      const dedupReview: ImportReviewOptions = dedupPreviewData.reconciliation?.token
        ? { previewToken: dedupPreviewData.reconciliation.token }
        : {};

      const dedupResponse = await POST(
        request({
          mode: "commit",
          content,
          fileName: fixture.fileName,
          accountId,
          timeZone: "UTC",
          review: dedupReview,
        }),
      );
      expect(dedupResponse.status).toBe(200);
      const dedupData = await dedupResponse.json();
      expect(dedupData.inserted).toBe(0);
      expect(dedupData.duplicates).toBe(previewData.totals.executions);
      expect(
        db.select().from(executions).where(eq(executions.accountId, accountId)).all().length,
      ).toBe(previewData.totals.executions);
    });
  }

  it("prevents unsafe commit on unsequenced NinjaTrader exports with sub-second price ambiguity", async () => {
    const rawContent = readFileSync(
      new URL("../../../packages/importers/tests/fixtures/tradezella/ninjatrader-ninjatrader.csv", import.meta.url),
      "utf8",
    );
    const accountId = "e2e-ninjatrader-unsequenced";
    db.insert(accounts)
      .values({
        id: accountId,
        name: "Unsequenced NT Account",
        kind: "import",
        createdAt: "2026-01-01",
      })
      .run();

    const previewRes = await POST(
      request({
        mode: "preview",
        content: rawContent,
        fileName: "ninjatrader-ninjatrader.csv",
        accountId,
        timeZone: "UTC",
      }),
    );
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.detected).toBe("ninjatrader");
    expect(previewData.reconciliation).toBeDefined();
    expect(previewData.reconciliation.conflicts.length).toBeGreaterThan(0);
    expect(previewData.reconciliation.token).toBeNull();

    const commitRes = await POST(
      request({
        mode: "commit",
        content: rawContent,
        fileName: "ninjatrader-ninjatrader.csv",
        accountId,
        timeZone: "UTC",
      }),
    );
    expect(commitRes.status).toBe(400);
    const commitData = await commitRes.json();
    expect(commitData.error).toContain("execution order is ambiguous or contradicts Entry/Exit");
    expect(db.select().from(executions).where(eq(executions.accountId, accountId)).all()).toHaveLength(0);
  });
});
