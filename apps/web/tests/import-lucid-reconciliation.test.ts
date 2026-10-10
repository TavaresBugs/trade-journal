import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { parseAuto } from "@luxalgo/journal-importers";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-lucid-reconcile-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts, executions, trades, settings } = await import("../src/db");
const { insertExecutions } = await import("../src/server/executions");

afterAll(() => {
  db.$client.close();
  if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = previousDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("Lucid Trading — Real Statement Import & Reconciliation", () => {
  it("imports all 5 statement files and achieves exact penny parity with Lucid site", () => {
    const accountId = "acc_test_tradovate_1790278922593";

    // Ensure account exists
    let acc = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!acc) {
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Lucid 50k Combine",
          broker: "lucid",
          platform: "tradovate",
          accountNumber: "LFE0506847043001",
          initialBalance: 50000,
          kind: "manual",
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    // Configure multipliers in settings
    db.insert(settings)
      .values({
        key: "multipliers",
        value: JSON.stringify({ MES: 5, MNQ: 2, ES: 50, NQ: 20 }),
      })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify({ MES: 5, MNQ: 2, ES: 50, NQ: 20 }) } })
      .run();

    // Clean previous test executions
    db.delete(executions).where(eq(executions.accountId, accountId)).run();
    db.delete(trades).where(eq(trades.accountId, accountId)).run();

    // Load all 5 statement files
    const files = ["Orders.csv", "Orders(1).csv", "Orders(2).csv", "Orders(3).csv", "Orders(4).csv"];
    const dir = join(process.cwd(), "packages/importers/tests/fixtures/tradovate-lucid");
    const allExecs = [];
    for (const f of files) {
      const c = readFileSync(join(dir, f), "utf8");
      const p = parseAuto(c, { timeZone: "America/Chicago" });
      if (p) allExecs.push(...p.executions);
    }

    // Deduplicate executions
    const seen = new Set();
    const uniqueExecs = [];
    for (const e of allExecs) {
      const sig = `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        uniqueExecs.push(e);
      }
    }

    expect(uniqueExecs).toHaveLength(166);

    // The Tradovate parser automatically applies standard micro futures commissions ($0.50/side per contract)
    // 182 contract sides total * $0.50 = $91.00 total fees
    const result = insertExecutions(accountId, uniqueExecs, "import");
    expect(result.inserted).toBe(166);
    expect(result.duplicates).toBe(0);

    const accountTrades = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, accountId))
      .all();

    expect(accountTrades).toHaveLength(83);

    const grossPnl = accountTrades.reduce((acc, t) => acc + t.grossPnl, 0);
    const totalFees = accountTrades.reduce((acc, t) => acc + t.fees, 0);
    const netPnl = accountTrades.reduce((acc, t) => acc + t.netPnl, 0);

    expect(grossPnl).toBe(-636.25);
    expect(totalFees).toBe(91.00);
    expect(netPnl).toBe(-727.25);

    // Exact parity with official Tradovate Statement ($49,272.75, rounded on Lucid UI to $49,273.00)
    const endingBalance = 50000.0 + netPnl;
    expect(endingBalance).toBe(49272.75);
    expect(Math.round(endingBalance)).toBe(49273);
  });
});
