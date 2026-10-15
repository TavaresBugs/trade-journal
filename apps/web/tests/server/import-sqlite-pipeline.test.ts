
import Database from "better-sqlite3";
import { parseHistory } from "@luxalgo/journal-importers";
import { BOOTSTRAP_SQL } from "../../src/db/bootstrap";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs, { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { ImportedExecution } from "@luxalgo/journal-importers";
import { parseAuto } from "@luxalgo/journal-importers";
import type { ImportReviewOptions } from "../../src/lib/import-review";

// ============================================================================
// SANDBOX LIFECYCLE (Single isolated temporary database)
// ============================================================================

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-database-battery-"));
const realDbPath = path.resolve(__dirname, "../../data/journal.db");
const hasRealDb = existsSync(realDbPath);
const sandboxDbPath = path.join(scratch, "journal.db");

process.env.JOURNAL_DATA_DIR = scratch;
vi.stubEnv("JOURNAL_PASSWORD", "");
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { db, accounts, executions, trades, journalDays, importSources, settings } = await import("../../src/db");
const { insertExecutions, partitionExecutions } = await import("../../src/server/executions");
const { rebuildAccount } = await import("../../src/server/rebuild");
const { reconcileImport } = await import("../../src/server/import-reconciliation");
const { validateCreateAccount } = await import("../../src/server/validation/accounts-schema");
const { decodeImportFile } = await import("../../src/lib/decode-import");
const { POST: importPost } = await import("../../src/app/api/import/route");
const POST = importPost;
const { POST: accountsPost, GET: accountsGet } = await import("../../src/app/api/accounts/route");
const { PATCH: accountsPatch } = await import("../../src/app/api/accounts/[id]/route");
const { POST: executionsPost } = await import("../../src/app/api/executions/route");
const { GET: getTrade } = await import("../../src/app/api/trades/[key]/route");

const post = async (body: object) =>
  importPost(new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body) }));
const request = (body: object) =>
  new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

db.insert(accounts)
  .values({ id: "legacy", name: "Existing", kind: "manual", createdAt: "2026-01-01" })
  .onConflictDoNothing()
  .run();

function resetToRealDbClone() {
  try {
    db.$client.exec("DETACH DATABASE realDb;");
  } catch {}
  if (!hasRealDb) return;
  db.$client.exec(`
    DELETE FROM trades;
    DELETE FROM executions;
    DELETE FROM journal_days;
    DELETE FROM import_sources;
    DELETE FROM accounts;
    ATTACH DATABASE '${realDbPath}' AS realDb;
  `);
  const accCols = new Set(
    (db.$client.pragma("table_info(accounts)") as { name: string }[]).map((c) => c.name),
  );
  const cols = (db.$client.pragma("realDb.table_info(accounts)") as { name: string }[])
    .map((c) => c.name)
    .filter((c) => accCols.has(c));
  const selectExpr = cols
    .map((c) => (c === "initial_balance" ? "COALESCE(initial_balance, 0) AS initial_balance" : c))
    .join(", ");
  db.$client.exec(`
    INSERT INTO accounts (${cols.join(", ")}) SELECT ${selectExpr} FROM realDb.accounts;
    INSERT INTO executions SELECT * FROM realDb.executions;
  `);
  const targetCols = new Set(
    (db.$client.pragma("table_info(trades)") as { name: string }[]).map((c) => c.name),
  );
  const tradeCols = (db.$client.pragma("realDb.table_info(trades)") as { name: string }[])
    .map((c) => c.name)
    .filter((name) => targetCols.has(name))
    .join(", ");
  db.$client.exec(`
    INSERT INTO trades (${tradeCols}) SELECT ${tradeCols} FROM realDb.trades;
    INSERT INTO journal_days (date, note, updated_at) SELECT date, note, COALESCE(updated_at, '2026-09-15T12:00:00Z') FROM realDb.journal_days;
    INSERT INTO import_sources SELECT * FROM realDb.import_sources;
    DETACH DATABASE realDb;
  `);
}

function resetToEmptyDb() {
  db.$client.exec(`
    DELETE FROM trades;
    DELETE FROM executions;
    DELETE FROM journal_days;
    DELETE FROM import_sources;
    DELETE FROM accounts;
  `);
}

// ============================================================================
// 1. DATABASE STRESS & INGESTION BATTERY (9 SCENARIOS)
// ============================================================================

describe("Database Stress & Ingestion Battery (9 Scenarios)", () => {
  beforeAll(() => {
    resetToRealDbClone();
  });

  it("executes the full 9-stage database integrity battery including overlapping date windows", async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 STARTING DATABASE STRESS BATTERY`);
    console.log(`   Sandbox: ${sandboxDbPath}`);
    console.log(`======================================================\n`);

    const initialJournalDays = db.select().from(journalDays).all();

    // -------------------------------------------------------------
    // SCENARIO 1: FRESH INGESTION
    // -------------------------------------------------------------
    console.log(`👉 [SCENARIO 1] Testing Fresh Upload on New Account...`);
    const acc1Id = "battery-acc-fresh";
    db.insert(accounts)
      .values({
        id: acc1Id,
        name: "TradeZero Fresh Account",
        broker: "tradezero",
        platform: "tradezero",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const tradezeroFixture = path.resolve(process.cwd(), "packages/importers/tests/fixtures/tradezella/tradezero-tradezero.csv");
    const tradezeroContent = fs.readFileSync(tradezeroFixture, "utf8");

    const res1 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradezeroContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_fresh.csv",
        }),
      }),
    );
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.inserted).toBe(6);
    expect(json1.duplicates).toBe(0);

    const execs1 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    const trades1 = db.select().from(trades).where(eq(trades.accountId, acc1Id)).all();
    const source1 = db
      .select()
      .from(importSources)
      .where(eq(importSources.accountId, acc1Id))
      .get();

    expect(execs1.length).toBe(6);
    expect(trades1.length).toBe(1);
    expect(trades1[0]!.symbol).toBe("TIVC");
    expect(trades1[0]!.netPnl).toBeCloseTo(-7895.03, 2);
    expect(source1).toBeDefined();
    expect(source1!.format).toBe("tradezero");
    console.log(
      `   ✅ Success: 6 executions inserted, 1 closed trade (-$7,895.03), import_source registered.`,
    );

    // -------------------------------------------------------------
    // SCENARIO 2: IDENTICAL RE-UPLOAD (Absolute Idempotency)
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 2] Testing Identical Re-upload (Absolute Idempotency)...`);
    const res2 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradezeroContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_fresh.csv",
        }),
      }),
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.inserted).toBe(0);
    expect(json2.duplicates).toBe(6);

    const execs2 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    const trades2 = db.select().from(trades).where(eq(trades.accountId, acc1Id)).all();
    expect(execs2.length).toBe(6);
    expect(trades2.length).toBe(1);
    console.log(
      `   ✅ Success: 0 inserted, 6 duplicates detected. Database counts 100% identical.`,
    );

    // -------------------------------------------------------------
    // SCENARIO 3: OUT-OF-ORDER RE-UPLOAD (Order Invariance)
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 3] Testing Reversed Re-upload (Reverse Chronological Order)...`);
    const [tzHeader, ...tzRows] = tradezeroContent.trim().split(/\r?\n/);
    const reversedContent = [tzHeader, ...tzRows.toReversed()].join("\n");

    const res3 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: reversedContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_reversed.csv",
        }),
      }),
    );
    expect(res3.status).toBe(200);
    const json3 = await res3.json();
    expect(json3.inserted).toBe(0);
    expect(json3.duplicates).toBe(6);

    const execs3 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    expect(execs3.length).toBe(6);
    console.log(`   ✅ Success: Inverted rows identified by native hash/id; 0 duplicates created.`);

    // -------------------------------------------------------------
    // SCENARIO 4: MANUAL ANNOTATION SURVIVAL (Annotation Safety)
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 4] Testing Annotation and Notes Survival Post-Rebuild...`);
    const tivcTrade = trades2[0]!;
    db.update(trades)
      .set({
        notes: "Aggressive short trade on pullback. Respected VWAP cleanly.",
        rating: 5,
        playbookId: "momentum-breakdown",
      })
      .where(eq(trades.key, tivcTrade.key))
      .run();

    rebuildAccount(acc1Id);

    const tradeAfterRebuild = db.select().from(trades).where(eq(trades.key, tivcTrade.key)).get()!;
    expect(tradeAfterRebuild.notes).toBe(
      "Aggressive short trade on pullback. Respected VWAP cleanly.",
    );
    expect(tradeAfterRebuild.rating).toBe(5);
    expect(tradeAfterRebuild.playbookId).toBe("momentum-breakdown");
    expect(tradeAfterRebuild.netPnl).toBeCloseTo(-7895.03, 2);
    console.log(
      `   ✅ Success: Annotation, rating, and playbook survived mathematical rebuild intact.`,
    );

    // -------------------------------------------------------------
    // SCENARIO 5: OVERLAPPING DATE WINDOWS
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 5] Testing Overlapping Windows (Jan-Apr ➔ Mar-May)...`);
    const accOverlapId = "battery-acc-overlap";
    db.insert(accounts)
      .values({
        id: accOverlapId,
        name: "Overlapping Windows Test Account",
        broker: "generic",
        platform: "generic",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const csvHeader = "Sym,Time,Bot/Sld,Price,Quantity,Commision,P&L,Amount";
    const tJanBuy = "AAPL,2026-01-10 10:00:00,Bot,150.00,100,1.00,0,15000";
    const tJanSell = "AAPL,2026-01-10 10:30:00,Sld,155.00,100,1.00,500,15500";

    const tFebBuy = "MSFT,2026-02-14 11:00:00,Bot,400.00,50,1.00,0,20000";
    const tFebSell = "MSFT,2026-02-14 11:45:00,Sld,410.00,50,1.00,500,20500";

    const tMarBuy = "TSLA,2026-03-20 09:35:00,Bot,200.00,200,1.00,0,40000";
    const tMarSell = "TSLA,2026-03-20 10:00:00,Sld,205.00,200,1.00,1000,41000";

    const tAprBuy = "NVDA,2026-04-15 14:00:00,Bot,800.00,100,1.00,0,80000";
    const tAprSell = "NVDA,2026-04-15 14:20:00,Sld,820.00,100,1.00,2000,82000";

    const tMayBuy = "AMZN,2026-05-18 10:00:00,Bot,180.00,150,1.00,0,27000";
    const tMaySell = "AMZN,2026-05-18 11:00:00,Sld,185.00,150,1.00,750,27750";

    const file1_JanToApr = [
      csvHeader,
      tJanBuy,
      tJanSell,
      tFebBuy,
      tFebSell,
      tMarBuy,
      tMarSell,
      tAprBuy,
      tAprSell,
    ].join("\n");
    const file2_MarToMay = [
      csvHeader,
      tMarBuy,
      tMarSell,
      tAprBuy,
      tAprSell,
      tMayBuy,
      tMaySell,
    ].join("\n");

    const resOverlap1 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: file1_JanToApr,
          accountId: accOverlapId,
          timeZone: "UTC",
          fileName: "statement_jan_to_apr.csv",
        }),
      }),
    );
    expect(resOverlap1.status).toBe(200);
    const jsonOverlap1 = await resOverlap1.json();
    expect(jsonOverlap1.inserted).toBe(8);
    expect(jsonOverlap1.duplicates).toBe(0);

    const tradesStage1 = db.select().from(trades).where(eq(trades.accountId, accOverlapId)).all();
    expect(tradesStage1.length).toBe(4);
    console.log(`   [Stage 1] File 1 (Jan-Apr): 8 executions inserted, 4 trades created.`);

    const tslaTrade = tradesStage1.find((t) => t.symbol === "TSLA")!;
    expect(tslaTrade).toBeDefined();
    db.update(trades)
      .set({ notes: "TSLA broke resistance in March. Critical note!", rating: 4 })
      .where(eq(trades.key, tslaTrade.key))
      .run();

    const resOverlap2 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: file2_MarToMay,
          accountId: accOverlapId,
          timeZone: "UTC",
          fileName: "statement_mar_to_may.csv",
        }),
      }),
    );
    expect(resOverlap2.status).toBe(200);
    const jsonOverlap2 = await resOverlap2.json();

    expect(jsonOverlap2.inserted).toBe(2);
    expect(jsonOverlap2.duplicates).toBe(4);

    const execsOverlapFinal = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, accOverlapId))
      .all();
    const tradesOverlapFinal = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, accOverlapId))
      .all();

    expect(execsOverlapFinal.length).toBe(10);
    expect(tradesOverlapFinal.length).toBe(5);

    const tslaAfterOverlap = db.select().from(trades).where(eq(trades.key, tslaTrade.key)).get()!;
    expect(tslaAfterOverlap.notes).toBe("TSLA broke resistance in March. Critical note!");
    expect(tslaAfterOverlap.rating).toBe(4);

    console.log(`   ✅ Overlap Success: 4 duplicates detected, 2 inserted, 5 trades in total.`);

    // -------------------------------------------------------------
    // SCENARIO 6: TIGHT ACCOUNT ISOLATION (Zero Leakage)
    // -------------------------------------------------------------
    console.log(
      `\n👉 [SCENARIO 6] Verifying Whether Real FTMO ("Eval") Account Experienced Any Impact...`,
    );
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTrades = db.select().from(trades).where(eq(trades.accountId, ftmoAccount.id)).all();

    expect(ftmoExecs.length).toBe(312);
    expect(ftmoTrades.length).toBe(156);
    console.log(
      `   ✅ Success: FTMO account remained with exactly 312 executions and 156 trades (total isolation).`,
    );

    // -------------------------------------------------------------
    // SCENARIO 7: JOURNAL DAYS IMMUTABILITY
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 7] Verifying Reflective Journal Days Immutability...`);
    const days = db.select().from(journalDays).all();
    expect(days.length).toBe(initialJournalDays.length);
    expect(days.length).toBeGreaterThanOrEqual(6);
    const dayFomc = days.find((d) => d.date === "2026-09-16")!;
    expect(dayFomc).toBeDefined();
    expect(dayFomc.note).toContain("Dia de Fomc");
    console.log(
      `   ✅ Success: ${days.length} journal_days records intact with all pre-market notes.`,
    );

    // -------------------------------------------------------------
    // SCENARIO 8: ACCOUNT MISMATCH GUARD
    // -------------------------------------------------------------
    console.log(`\n👉 [SCENARIO 8] Testing Guard Against Accidental Account Mismatch...`);
    const tradestationFixture = path.resolve(
      process.cwd(),
      "packages/importers/tests/fixtures/tradezella/tradestation-tradestation.csv",
    );
    const tradestationContent = fs.readFileSync(tradestationFixture, "utf8");

    db.update(accounts).set({ accountNumber: "99999999" }).where(eq(accounts.id, acc1Id)).run();

    const resMismatch = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradestationContent,
          accountId: acc1Id,
          timeZone: "UTC",
        }),
      }),
    );
    expect(resMismatch.status).toBe(400);
    const jsonMismatch = await resMismatch.json();
    expect(jsonMismatch.error).toContain("Account mismatch");
    console.log(
      `   ✅ Success: Guard activated successfully! Returned error: "${jsonMismatch.error}"`,
    );

    // -------------------------------------------------------------
    // SCENARIO 9: CROSS-FILE FIFO ROUND TRIP
    // -------------------------------------------------------------
    console.log(
      `\n👉 [SCENARIO 9] Testing Open Position in File A and Closed in File B (Cross-File FIFO)...`,
    );
    const accCrossId = "battery-acc-cross-fifo";
    db.insert(accounts)
      .values({
        id: accCrossId,
        name: "Cross-File FIFO Account",
        broker: "generic",
        platform: "generic",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const fileMon = [csvHeader, "QQQ,2026-06-01 10:00:00,Bot,450.00,100,1.00,0,45000"].join("\n");
    const fileFri = [csvHeader, "QQQ,2026-06-05 15:30:00,Sld,455.00,100,1.00,500,45500"].join("\n");

    await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: fileMon,
          accountId: accCrossId,
          timeZone: "UTC",
        }),
      }),
    );
    const tradesMon = db.select().from(trades).where(eq(trades.accountId, accCrossId)).all();
    expect(tradesMon.length).toBe(1);
    expect(tradesMon[0]!.status).toBe("open");
    expect(tradesMon[0]!.openQuantity).toBe(100);

    await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: fileFri,
          accountId: accCrossId,
          timeZone: "UTC",
        }),
      }),
    );
    const tradesFri = db.select().from(trades).where(eq(trades.accountId, accCrossId)).all();
    expect(tradesFri.length).toBe(1);
    expect(tradesFri[0]!.status).toBe("win");
    expect(tradesFri[0]!.openQuantity).toBe(0);
    expect(tradesFri[0]!.grossPnl).toBe(500);
    expect(tradesFri[0]!.netPnl).toBe(498);
    console.log(
      `   ✅ Success: Friday file matched Monday file; position closed with Net P&L = +$498.00.`,
    );
  });
});

// ============================================================================
// 2. REAL DATABASE CLONE & FTMO JOURNAL SAFETY AUDIT
// ============================================================================

describe("Real Database Clone & FTMO Journal Safety Audit", () => {
  beforeEach(() => {
    resetToRealDbClone();
  });

  it("proves that importing into the database preserves 100% of journal notes and existing trades", async () => {
    const account = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get();
    expect(account).toBeDefined();
    expect(account!.broker).toBe("ftmo");
    expect(account!.accountNumber).toBe("530319802");

    const initialDays = db.select().from(journalDays).all();
    expect(initialDays.length).toBeGreaterThan(0);

    const initialExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, account!.id))
      .all();
    const initialTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    expect(initialExecs.length).toBe(312);
    expect(initialTrades.length).toBe(156);

    const testTradeKey = initialTrades[0]!.key;
    db.update(trades)
      .set({ notes: "MY_GOLDEN_FTMO_NOTE", rating: 5, playbookId: "fvg-reversal" })
      .where(eq(trades.key, testTradeKey))
      .run();

    const ftmoFile = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.html";
    if (existsSync(ftmoFile)) {
      const ftmoBuffer = fs.readFileSync(ftmoFile);
      const ftmoContent =
        ftmoBuffer[0] === 0xff && ftmoBuffer[1] === 0xfe
          ? ftmoBuffer.toString("utf16le")
          : ftmoBuffer.toString("utf8");

      const previewRes = await importPost(
        new Request("http://localhost/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            content: ftmoContent,
            accountId: account!.id,
            timeZone: account!.timeZone || "Europe/Helsinki",
          }),
        }),
      );
      expect(previewRes.status).toBe(200);
      const previewJson = await previewRes.json();
      expect(previewJson.detected).toMatch(/metatrader/);
      expect(previewJson.detectedAccount).toBe("530319802");
      expect(previewJson.accountConflict).toBeUndefined();

      const commitRes = await importPost(
        new Request("http://localhost/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "commit",
            content: ftmoContent,
            accountId: account!.id,
            timeZone: account!.timeZone || "Europe/Helsinki",
          }),
        }),
      );
      expect(commitRes.status).toBe(200);
      const commitJson = await commitRes.json();
      expect(commitJson.inserted).toBe(0);
      expect(commitJson.duplicates).toBe(306);
    }

    const afterExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, account!.id))
      .all();
    const afterTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    const afterDays = db.select().from(journalDays).all();

    expect(afterExecs.length).toBe(312);
    expect(afterTrades.length).toBe(156);
    expect(afterDays.length).toBe(initialDays.length);

    for (const day of initialDays) {
      const current = afterDays.find((d) => d.date === day.date);
      expect(current).toBeDefined();
      expect(current!.note).toBe(day.note);
      expect(current!.updatedAt).toBe(day.updatedAt);
    }

    const annotatedTradeAfter = db.select().from(trades).where(eq(trades.key, testTradeKey)).get();
    expect(annotatedTradeAfter!.notes).toBe("MY_GOLDEN_FTMO_NOTE");
    expect(annotatedTradeAfter!.rating).toBe(5);
    expect(annotatedTradeAfter!.playbookId).toBe("fvg-reversal");
  });

  it("proves that importing other brokers into separate accounts has zero impact on FTMO data", async () => {
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecsInitial = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTradesInitial = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, ftmoAccount.id))
      .all();
    const journalDaysInitial = db.select().from(journalDays).all();

    const newAccountId = "topstep-account-test";
    db.insert(accounts)
      .values({
        id: newAccountId,
        name: "Topstep 50k",
        broker: "topstep",
        platform: "topstepx",
        kind: "import",
        createdAt: "2026-09-25T12:00:00.000Z",
      })
      .run();

    const topstepFile = path.resolve(process.cwd(), "packages/importers/tests/fixtures/tradezella/topstepx-topstepx.csv");
    const topstepContent = fs.readFileSync(topstepFile, "utf8");

    const commitRes = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: topstepContent,
          accountId: newAccountId,
          timeZone: "UTC",
        }),
      }),
    );
    expect(commitRes.status).toBe(200);
    const commitJson = await commitRes.json();
    expect(commitJson.inserted).toBe(76);

    const topstepExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, newAccountId))
      .all();
    const topstepTrades = db.select().from(trades).where(eq(trades.accountId, newAccountId)).all();
    expect(topstepExecs.length).toBe(76);
    expect(topstepTrades.length).toBe(38);

    const ftmoExecsAfter = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTradesAfter = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, ftmoAccount.id))
      .all();
    expect(ftmoExecsAfter.length).toBe(ftmoExecsInitial.length);
    expect(ftmoTradesAfter.length).toBe(ftmoTradesInitial.length);

    const journalDaysAfter = db.select().from(journalDays).all();
    expect(journalDaysAfter.length).toBe(journalDaysInitial.length);
    for (let i = 0; i < journalDaysInitial.length; i++) {
      expect(journalDaysAfter[i]!.note).toBe(journalDaysInitial[i]!.note);
    }
  });
});

// ============================================================================
// 3. IMPORT RECONCILIATION
// ============================================================================

describe("Import Reconciliation", () => {
  beforeAll(() => {
    resetToRealDbClone();
  });

  it("reconciles ReportHistory-530319802 - MT5.html against existing Eval account", () => {
    const filePath = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.html";
    if (!existsSync(filePath)) return;

    const content = readFileSync(filePath, "utf-16le");
    const parsed = parseAuto(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.executions.length).toBe(306);

    const rec = reconcileImport("4U2rW1FjaU17", parsed!.executions);
    expect(["Eval", "FTMO 10K"]).toContain(rec.accountName);
    expect(rec.totalFills).toBe(306);
    expect(rec.existingFills).toBe(306);
    expect(rec.newFills).toBe(0);
    expect(rec.totalTrades).toBe(153);
    expect(rec.existingTrades).toBe(153);
    expect(rec.newTrades).toBe(0);
    expect(rec.isFullyImported).toBe(true);
  });

  it("reconciles ReportHistory-530319802 - MT5.xlsx against existing Eval account", () => {
    const xlsxPath = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.xlsx";
    if (!existsSync(xlsxPath)) return;

    const buf = readFileSync(xlsxPath);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const csv = decodeImportFile(arrayBuf);
    const parsed = parseAuto(csv);

    expect(parsed).not.toBeNull();

    const rec = reconcileImport("4U2rW1FjaU17", parsed!.executions);
    expect(["Eval", "FTMO 10K"]).toContain(rec.accountName);
    expect(rec.totalFills).toBe(308);
    expect(rec.existingFills).toBe(308);
    expect(rec.newFills).toBe(0);
    expect(rec.totalTrades).toBe(154);
    expect(rec.existingTrades).toBe(154);
    expect(rec.newTrades).toBe(0);
    expect(rec.isFullyImported).toBe(true);
  });
});

// ============================================================================
// 4. TRADOVATE END-TO-END IMPORT & IDEMPOTENCY
// ============================================================================

describe("Tradovate End-to-End Import & Idempotency", () => {
  const FALLBACK_TRADOVATE_CSV = `Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp
419496653330,08/04/2026 10:20:44,2026-08-04,0,,1,29219.25,1,29248.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653348,419496653327,419496653346,1,29219.25,29248.50,58.50,USD,08/04/2026 10:05:09,08/04/2026 10:20:44
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653373,419496653371,419496653362,1,29899.75,29843.50,-112.50,USD,08/05/2026 11:49:40,08/05/2026 11:38:15
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653402,419496653400,419496653382,1,29814.00,29794.00,-40.00,USD,08/05/2026 11:54:39,08/05/2026 11:53:50
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653426,419496653416,419496653424,1,29958.00,29955.75,-4.50,USD,08/10/2026 07:04:14,08/10/2026 07:04:29
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653458,419496653437,419496653456,1,29864.00,29805.50,-117.00,USD,08/10/2026 11:18:21,08/10/2026 11:25:22`;
  const csvPath = resolve(
    "/home/jhontavares/.gemini/antigravity/brain/5e6dccf2-6295-4471-ae0f-9fff493c7d25/.user_uploaded/media_1790274711905.csv",
  );
  const csvContent = existsSync(csvPath) ? readFileSync(csvPath, "utf-8") : FALLBACK_TRADOVATE_CSV;

  it("previews the real Tradovate statement and detects the statement account number", async () => {
    if (!csvContent) return;

    const previewReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "preview",
        content: csvContent,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const previewRes = await importPost(previewReq);
    expect(previewRes.status).toBe(200);
    const data = await previewRes.json();

    expect(data.detected).toBe("tradovate");
    expect(data.detectedAccount).toBe("LFE0506847043001");
    expect(data.sourceAccounts).toContain("LFE0506847043001");
    expect(data.totals?.executions).toBe(28);
  });

  it("commits trades into account, auto-binds accountNumber and platform, and guarantees 100% idempotency", async () => {
    if (!csvContent) return;
    const testAccountId = `acc_test_tradovate_${Date.now()}`;

    await db.insert(accounts).values({
      id: testAccountId,
      name: "Lucid 50k Combine",
      broker: "lucid",
      kind: "manual",
      currency: "USD",
      initialBalance: 50000,
      createdAt: new Date().toISOString(),
    });

    const commitReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const commitRes = await importPost(commitReq);
    expect(commitRes.status).toBe(200);
    const commitData = await commitRes.json();

    expect(commitData.inserted).toBe(28);
    expect(commitData.duplicates).toBe(0);

    const updatedAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountId),
    });
    expect(updatedAccount?.accountNumber).toBe("LFE0506847043001");
    expect(updatedAccount?.platform).toBe("tradovate");

    const repeatReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const repeatRes = await importPost(repeatReq);
    expect(repeatRes.status).toBe(200);
    const repeatData = await repeatRes.json();

    expect(repeatData.inserted).toBe(0);
    expect(repeatData.duplicates).toBe(28);

    await db.delete(trades).where(eq(trades.accountId, testAccountId));
    await db.delete(executions).where(eq(executions.accountId, testAccountId));
    await db.delete(accounts).where(eq(accounts.id, testAccountId));
  });
});

// ============================================================================
// 5. IMPORT ACCOUNT MANAGEMENT & VALIDATION
// ============================================================================

describe("Import Account Management & Validation", () => {
  beforeEach(() => {
    resetToEmptyDb();
  });

  it("creates an import destination with the chosen currency/balance and accepts fills under its returned id", async () => {
    const response = await accountsPost(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Import verification",
          kind: "import",
          currency: "USD",
          initialBalance: 50000,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const { id } = await response.json();
    const listed = await (await accountsGet(new Request("http://localhost/api/accounts"))).json();
    expect(listed.accounts).toMatchObject([
      { id, name: "Import verification", kind: "import", currency: "USD", initialBalance: 50000 },
    ]);
    insertExecutions(
      id,
      [
        {
          symbol: "TEST",
          side: "buy",
          quantity: 10,
          price: 100,
          fee: 0.35,
          executedAt: "2026-01-02T14:30:00Z",
          assetClass: "equity",
        },
        {
          symbol: "TEST",
          side: "sell",
          quantity: 10,
          price: 101,
          fee: 0.35,
          executedAt: "2026-01-02T15:30:00Z",
          assetClass: "equity",
        },
      ],
      "import",
    );
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).all()).toMatchObject([
      { accountId: id, status: "win", netPnl: 9.3 },
    ]);

    // Insert an open position (unmatched buy)
    insertExecutions(
      id,
      [
        {
          symbol: "OPEN1",
          side: "buy",
          quantity: 5,
          price: 50,
          fee: 0,
          executedAt: "2026-01-03T10:00:00Z",
          assetClass: "equity",
        },
      ],
      "import",
    );

    // GET aggregation must only count closed positions for tradeCount & netPnl
    const updatedListed = await (
      await accountsGet(new Request("http://localhost/api/accounts"))
    ).json();
    const acc = updatedListed.accounts.find((a: any) => a.id === id);
    expect(acc).toBeDefined();
    expect(acc.tradeCount).toBe(1);
    expect(acc.closedTrades).toBe(1);
    expect(acc.winCount).toBe(1);
    expect(acc.winRate).toBe(100);
    expect(acc.netPnl).toBe(9.3);
  });

  it("validates account creation and rejects malformed payloads natively", () => {
    expect(validateCreateAccount({})).toEqual({
      ok: false,
      error: "name and kind are required",
    });
    expect(validateCreateAccount({ name: "   ", kind: "manual" })).toEqual({
      ok: false,
      error: "name and kind are required",
    });
    expect(validateCreateAccount({ name: "Test", kind: "invalid-kind" })).toEqual({
      ok: false,
      error: "Invalid account kind. Must be 'sync', 'import', or 'manual'",
    });
    expect(validateCreateAccount({ name: "Test", kind: "sync" })).toEqual({
      ok: false,
      error: "sync accounts need a broker and credentials",
    });
    expect(
      validateCreateAccount({ name: "Test", kind: "manual", timeZone: "Invalid/Zone" }),
    ).toEqual({
      ok: false,
      error: "Invalid IANA timezone.",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", currency: "USDT" })).toEqual({
      ok: false,
      error: "Invalid currency. Must be a 3-letter ISO code.",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", initialBalance: -100 })).toEqual({
      ok: false,
      error: "initialBalance must be a finite number greater than or equal to 0",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", maxDrawdown: 0 })).toEqual({
      ok: false,
      error: "maxDrawdown must be a positive number or null",
    });

    const valid = validateCreateAccount({
      name: "  My Account  ",
      kind: "manual",
      currency: "eur",
      initialBalance: 10000,
      maxDrawdown: 1500,
      profitCalcMethod: "fifo",
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.name).toBe("My Account");
      expect(valid.data.currency).toBe("EUR");
      expect(valid.data.initialBalance).toBe(10000);
      expect(valid.data.maxDrawdown).toBe(1500);
      expect(valid.data.profitCalcMethod).toBe("fifo");
    }
  });

  it("validates and applies PATCH /api/accounts/[id] updates", async () => {
    const createRes = await accountsPost(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Patch target",
          kind: "manual",
          currency: "USD",
          initialBalance: 25000,
        }),
      }),
    );
    const { id } = await createRes.json();

    const badRes = await accountsPatch(
      new Request(`http://localhost/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone: "Invalid/Zone" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(badRes.status).toBe(400);

    const goodRes = await accountsPatch(
      new Request(`http://localhost/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Renamed Account",
          currency: "EUR",
          maxDrawdown: 2000,
          profitCalcMethod: "lifo",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(goodRes.status).toBe(200);

    const updated = db.select().from(accounts).where(eq(accounts.id, id)).get();
    expect(updated?.name).toBe("Renamed Account");
    expect(updated?.currency).toBe("EUR");
    expect(updated?.maxDrawdown).toBe(2000);
    expect(updated?.profitCalcMethod).toBe("lifo");
  });
});

// ============================================================================
// 6. EXECUTION STORAGE & COHERENT JOURNAL
// ============================================================================

describe("Execution Storage & Coherent Journal", () => {
  const rows: ImportedExecution[] = [
    {
      symbol: "TEST",
      side: "buy",
      quantity: 10,
      price: 100,
      fee: 0,
      executedAt: "2026-09-01T10:00:00Z",
    },
    {
      symbol: "TEST",
      side: "sell",
      quantity: 10,
      price: 102,
      fee: 0,
      executedAt: "2026-09-01T11:00:00Z",
    },
  ];

  beforeEach(() => {
    resetToEmptyDb();
    db.insert(accounts)
      .values({ id: "test", name: "Test", kind: "manual", createdAt: "2026-01-01" })
      .run();
  });

  it("rejects missing accounts and invalid fills before inserting data", () => {
    expect(() => insertExecutions("missing", rows, "manual")).toThrow("Account not found");
    for (const invalid of [
      { quantity: Infinity },
      { quantity: 0 },
      { fee: NaN },
      { executedAt: "invalid" },
      { side: "hold" },
      { symbol: " " },
    ]) {
      expect(() =>
        insertExecutions(
          "test",
          [rows[0]!, { ...rows[1]!, ...invalid } as ImportedExecution],
          "manual",
        ),
      ).toThrow();
    }
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it("rolls back the fills if calculating their trades fails", () => {
    db.$client.exec(
      "CREATE TRIGGER fail_trade BEFORE INSERT ON trades BEGIN SELECT RAISE(FAIL, 'test storage failure'); END",
    );
    try {
      expect(() => insertExecutions("test", rows, "manual")).toThrow();
      expect(db.select().from(executions).all()).toHaveLength(0);
      expect(db.select().from(trades).all()).toHaveLength(0);
    } finally {
      db.$client.exec("DROP TRIGGER fail_trade");
    }
  });

  it("deduplicates repeated imports while keeping the calculated total", () => {
    expect(insertExecutions("test", rows, "manual")).toMatchObject({ inserted: 2, duplicates: 0 });
    expect(insertExecutions("test", rows, "manual")).toMatchObject({ inserted: 0, duplicates: 2 });
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).all()[0]?.netPnl).toBe(20);
  });

  it("saves Markdown notes with manual trades and preserves them through a rebuild and retry", async () => {
    const notes = "## Setup\n\nWaited for **confirmation**.\n- Followed the plan.";
    const response = await executionsPost(
      new Request("http://localhost/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "test", executions: rows, notes }),
      }),
    );
    expect(response.status).toBe(200);
    const trade = db.select().from(trades).get()!;
    const detail = await getTrade(new Request("http://localhost/api/trades/fixture"), {
      params: Promise.resolve({ key: trade.key }),
    });
    expect((await detail.json()).trade.notes).toBe(notes);
    rebuildAccount("test");
    expect(insertExecutions("test", rows, "manual", notes)).toMatchObject({
      inserted: 0,
      duplicates: 2,
    });
    expect(db.select().from(trades).get()?.notes).toBe(notes);
  });

  it("appends exit notes to the correct position without changing unrelated trade notes", () => {
    insertExecutions("test", [rows[0]!], "manual", "Entry plan");
    insertExecutions(
      "test",
      rows.map((row) => ({ ...row, symbol: "OTHER" })),
      "manual",
      "Unrelated note",
    );
    insertExecutions("test", [rows[1]!], "manual", "Exit review");
    const saved = db.select().from(trades).all();
    expect(saved.find((row) => row.symbol === "TEST")).toMatchObject({
      notes: "Entry plan\n\nExit review",
      netPnl: 20,
    });
    expect(saved.find((row) => row.symbol === "OTHER")?.notes).toBe("Unrelated note");
  });

  it("keeps existing notes when a manual exit has no notes", () => {
    insertExecutions("test", [rows[0]!], "manual", "Keep this plan");
    insertExecutions("test", [rows[1]!], "manual", "   ");
    expect(db.select().from(trades).get()?.notes).toBe("Keep this plan");
  });

  it("saves notes for an already-recorded trade without duplicating fills or repeated notes", () => {
    insertExecutions("test", rows, "manual", "Entry plan");
    expect(insertExecutions("test", rows, "manual", "Later review")).toMatchObject({
      inserted: 0,
      duplicates: 2,
    });
    insertExecutions("test", rows, "manual", "Later review");
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).get()?.notes).toBe("Entry plan\n\nLater review");
  });

  it("attaches a batch note to each trade formed by its new executions", () => {
    insertExecutions(
      "test",
      [
        ...rows,
        ...rows.map((row) => ({ ...row, executedAt: row.executedAt.replace("09-01", "09-02") })),
      ],
      "manual",
      "Session review",
    );
    const saved = db.select().from(trades).all();
    expect(saved).toHaveLength(2);
    expect(saved.every((row) => row.notes === "Session review")).toBe(true);
  });

  it("rejects invalid notes before inserting executions", async () => {
    for (const notes of [null, 42, {}, ["note"], "a".repeat(100001)]) {
      const response = await executionsPost(
        new Request("http://localhost/api/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: "test", executions: rows, notes }),
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(db.select().from(executions).all()).toHaveLength(0);
    expect(db.select().from(trades).all()).toHaveLength(0);
  });

  it("rolls back new executions if appending notes exceeds the existing notes limit", () => {
    const existing = "a".repeat(100000);
    insertExecutions("test", [rows[0]!], "manual", existing);
    expect(() => insertExecutions("test", [rows[1]!], "manual", "Exit review")).toThrow(
      "Combined trade notes",
    );
    expect(db.select().from(executions).all()).toHaveLength(1);
    expect(db.select().from(trades).get()).toMatchObject({ notes: existing, status: "open" });
  });
});

// ============================================================================
// 7. SYNC RESILIENCE & ERROR PARTITIONING
// ============================================================================

describe("Sync Resilience & Error Partitioning", () => {
  const good: ImportedExecution = {
    symbol: "ES",
    side: "buy",
    quantity: 1,
    price: 5000,
    fee: 1.2,
    executedAt: "2026-09-01T10:00:00Z",
  };
  const mixed = [
    good,
    { ...good, side: "sell", price: NaN, executedAt: "2026-09-01T11:00:00Z" },
    { ...good, quantity: 0, executedAt: "2026-09-01T12:00:00Z" },
    { ...good, fee: Infinity, executedAt: "2026-09-01T13:00:00Z" },
    { ...good, side: "sell", price: 5010, executedAt: "2026-09-01T14:00:00Z" },
  ] as ImportedExecution[];

  beforeEach(() => {
    resetToEmptyDb();
    db.insert(accounts)
      .values({ id: "broker", name: "Broker", kind: "sync", createdAt: "2026-01-01" })
      .run();
  });

  it("keeps the valid fills from a mixed broker batch and reports how many were skipped", () => {
    const result = insertExecutions("broker", mixed, "sync");
    expect(result.inserted).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.skipped).toBe(3);
    expect(result.skippedReasons).toHaveLength(3);
    expect(result.skippedReasons.join(" ")).toMatch(/price/);
    expect(result.skippedReasons.join(" ")).toMatch(/quantity/);
    expect(result.skippedReasons.join(" ")).toMatch(/fee/);
    expect(db.select().from(executions).all()).toHaveLength(2);
  });

  it("skips invalid rows from an imported file instead of rejecting the file", () => {
    const result = insertExecutions("broker", mixed, "import");
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(3);
  });

  it("still rejects a manually entered batch when any fill is invalid", () => {
    expect(() => insertExecutions("broker", mixed, "manual")).toThrow();
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it("caps the list of skip reasons so a large broken batch stays reportable", () => {
    const broken = Array.from({ length: 20 }, (_, i) => ({
      ...good,
      quantity: -1,
      executedAt: `2026-09-01T10:${String(i).padStart(2, "0")}:00Z`,
    }));
    const { skipped, skippedReasons, usable } = partitionExecutions(broken, "sync");
    expect(skipped).toBe(20);
    expect(usable).toHaveLength(0);
    expect(skippedReasons.length).toBeLessThanOrEqual(5);
  });
});


// ============================================================================
// 2. END-TO-END SQLITE BROKER INGESTION SUITE
// ============================================================================

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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradovate-lucid/Orders.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/ninjatrader-copy-trades.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/ninjatrader-ninjatrader.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/topstepx.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/ctrader.htm",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/ibkr.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/rithmic.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/quantower.csv",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/matchtrader.html",
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
    relativeUrl: "../../../../packages/importers/tests/fixtures/tradezella/thinkorswim.csv",
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
    relativeUrl: "../../../../docs/samples/demo-trades-tradingview.csv",
    fileName: "demo-trades-tradingview.csv",
    expectedFormat: "tradingview",
    expectedExecutions: 2038,
    expectedTrades: 783,
    expectedGrossPnl: 26143.02,
    expectedFees: 1147.04,
    expectedNetPnl: 24995.98,
  },
];

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


describe("End-to-End SQLite Broker Ingestion Suite", () => {
  beforeEach(() => {
    vi.stubEnv("JOURNAL_PASSWORD", "");
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(accounts).run();
    db.delete(settings).run();
    db.delete(importSources).run();
    try {
      db.$client.exec("DELETE FROM import_source_aliases; DELETE FROM import_batches;");
    } catch {}
    db.insert(settings)
      .values({ key: "multipliers", value: JSON.stringify(DEFAULT_MULTIPLIERS) })
      .run();
  });

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
      new URL("../../../../packages/importers/tests/fixtures/tradezella/ninjatrader-ninjatrader.csv", import.meta.url),
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


// ============================================================================
// 3. HISTORY IMPORT PIPELINE & FILE DECODING
// ============================================================================

describe("history imports use the existing preview, commit and rebuild pipeline", () => {
  const csv = `Symbol;FX:EURUSD
Trade #;Type;Date/Time;Price;Contracts;Profit;Profit %
1;Entry long;2026-01-05 09:00;1.1;0.1;18.5;1
1;Exit long;2026-01-05 10:00;1.102;0.1;18.5;1
2;Entry long;2026-01-05 09:00;1.1;0.1;18.5;1
2;Exit long;2026-01-05 10:00;1.102;0.1;18.5;1`;

  beforeEach(() => {
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(settings).run();
    db.delete(accounts).where(eq(accounts.id, "test")).run();
    db.insert(accounts)
      .values([
        { id: "test", name: "Test", kind: "import", createdAt: "2026-01-01" },
        { id: "legacy", name: "Existing", kind: "manual", createdAt: "2026-01-01" }
      ])
      .onConflictDoNothing()
      .run();
  });
  it("adds storage metadata to an existing database without removing its account", () => {
    for (const table of ["import_sources", "import_source_aliases", "import_batches"]) {
      expect(
        db.$client
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .get(table),
      ).toBeTruthy();
    }
    expect(db.select().from(accounts).where(eq(accounts.id, "legacy")).get()?.name).toBe(
      "Existing",
    );
    expect(
      (db.$client.pragma("table_info(executions)") as { name: string }[]).some(
        (c) => c.name === "import_metadata_json",
      ),
    ).toBe(true);
  });
  it("previews without writes, commits once, and preserves separate positions and annotations on rebuild", async () => {
    const preview = await post({ mode: "preview", content: csv });
    expect(preview.status).toBe(200);
    expect((await preview.json()).totals.executions).toBe(4);
    expect(db.select().from(executions).all()).toHaveLength(0);
    const first = await post({ mode: "commit", content: csv, accountId: "test" });
    expect((await first.json()).inserted).toBe(4);
    expect(db.select().from(trades).all()).toHaveLength(2);
    const saved = db.select().from(trades).all()[0]!;
    db.update(trades)
      .set({ notes: "User-owned note", rating: 5 })
      .where(eq(trades.key, saved.key))
      .run();
    const second = await post({ mode: "commit", content: csv, accountId: "test" });
    expect(await second.json()).toMatchObject({ inserted: 0, duplicates: 4 });
    rebuildAccount("test");
    expect(db.select().from(trades).where(eq(trades.key, saved.key)).get()).toMatchObject({
      netPnl: 18.5,
      notes: "User-owned note",
      rating: 5,
    });
  });
  it("retains legitimately identical generic fills and deduplicates reimports", () => {
    const content = `Timestamp,Ticker,Buy/Sell,Fill Quantity,Execution Price
2026-01-05 09:00,AAPL,buy,1,100
2026-01-05 09:00,AAPL,buy,1,100
2026-01-05 10:00,AAPL,sell,2,101`;
    const parsed = parseHistory(content, { adapterId: "generic-csv" })!;
    expect(insertExecutions("test", parsed.executions, "import")).toMatchObject({
      inserted: 3,
      duplicates: 0,
    });
    expect(insertExecutions("test", parsed.executions, "import")).toMatchObject({
      inserted: 0,
      duplicates: 3,
    });
    expect(db.select().from(trades).all()[0]).toMatchObject({ quantity: 2, netPnl: 2 });
  });
  it("blocks missing-symbol commits and uses the same supplied symbol in preview and commit", async () => {
    const content = `Trade #,Type,Date/Time,Price,Contracts,Profit
1,Entry long,2026-01-05 09:00,100,1,1
1,Exit long,2026-01-05 10:00,101,1,1`;
    expect((await (await post({ mode: "preview", content })).json()).needsSymbol).toBe(true);
    expect((await post({ mode: "commit", content, accountId: "test" })).status).toBe(400);
    expect(db.select().from(executions).all()).toHaveLength(0);
    const preview = await (await post({ mode: "preview", content, symbol: "AAPL" })).json();
    expect(preview.executions.every((e: { symbol: string }) => e.symbol === "AAPL")).toBe(true);
    expect(
      (await post({ mode: "commit", content, symbol: "AAPL", accountId: "test" })).status,
    ).toBe(200);
    expect(db.select().from(trades).all()[0]?.symbol).toBe("AAPL");
  });
  it("does not replace reported zero fees or P&L with account defaults or multiplier recalculations", () => {
    db.insert(settings)
      .values({
        key: "journalDefaults",
        value: JSON.stringify({
          feeRules: [{ id: "fee", accountId: "test", symbol: "", amount: 5, mode: "execution" }],
        }),
      })
      .run();
    db.insert(settings)
      .values({ key: "multipliers", value: JSON.stringify({ AAPL: 100 }) })
      .run();
    const parsed = parseHistory(
      `Position,Symbol,Direction,Open Time,Close Time,Entry Price,Exit Price,Quantity,PnL,Fees
1,AAPL,long,2026-01-05 09:00,2026-01-05 10:00,100,101,1,1,0`,
      { adapterId: "generic-csv" },
    )!;
    insertExecutions("test", parsed.executions, "import");
    rebuildAccount("test");
    expect(db.select().from(trades).all()[0]).toMatchObject({ netPnl: 1, fees: 0, grossPnl: 1 });
  });

  it("retains the mapped import through both preview and commit", async () => {
    const content = "When,Ticker,Way,Amount,Cost\n2026-01-05 09:00,AAPL,bought,2,100";
    const mapping = {
      timestamp: "When",
      symbol: "Ticker",
      side: "Way",
      quantity: "Amount",
      price: "Cost",
    };
    expect(
      (await (await post({ mode: "preview", content, mapping })).json()).totals.executions,
    ).toBe(1);
    expect(
      await (await post({ mode: "commit", content, mapping, accountId: "test" })).json(),
    ).toMatchObject({ inserted: 1 });
  });

  it("handles multi-file batch uploads with cross-file deduplication and per-file stats", async () => {
    const file1 = {
      name: "batch1.csv",
      content: `Symbol;FX:EURUSD\nTrade #;Type;Date/Time;Price;Contracts;Profit;Profit %\n1;Entry long;2026-01-05 09:00;1.1;0.1;18.5;1\n1;Exit long;2026-01-05 10:00;1.102;0.1;18.5;1`,
    };
    const file2 = {
      name: "batch2.csv",
      content: `Symbol;FX:EURUSD\nTrade #;Type;Date/Time;Price;Contracts;Profit;Profit %\n2;Entry long;2026-01-06 09:00;1.1;0.1;18.5;1\n2;Exit long;2026-01-06 10:00;1.102;0.1;18.5;1`,
    };
    // file3 is an exact copy of file1 to test deduplication
    const file3 = {
      name: "batch1_duplicate.csv",
      content: file1.content,
    };

    const previewRes = await (
      await post({
        mode: "preview",
        files: [file1, file2, file3],
        timeZone: "UTC",
      })
    ).json();

    expect(previewRes.batchSummary).toBeDefined();
    expect(previewRes.batchSummary.totalFiles).toBe(3);
    expect(previewRes.batchSummary.totalParsed).toBe(6);
    expect(previewRes.batchSummary.uniqueExecutions).toBe(4);
    expect(previewRes.batchSummary.duplicateExecutions).toBe(2);
    expect(previewRes.totals.executions).toBe(4);
    expect(previewRes.batchSummary.files).toHaveLength(3);
    expect(previewRes.batchSummary.files[0].uniqueAdded).toBe(2);
    expect(previewRes.batchSummary.files[1].uniqueAdded).toBe(2);
    expect(previewRes.batchSummary.files[2].duplicateCount).toBe(2);

    const commitRes = await (
      await post({
        mode: "commit",
        files: [file1, file2, file3],
        accountId: "test",
        timeZone: "UTC",
      })
    ).json();

    expect(commitRes.inserted).toBe(4);
    expect(commitRes.batchSummary).toBeDefined();
    expect(commitRes.batchSummary.totalFiles).toBe(3);
  });
});

describe("file decoding", () => {
  it("reads UTF-8, UTF-16LE and UTF-16BE without damaging non-ASCII text", () => {
    const value = "<html>EURUSD 日本語</html>";
    const utf8 = new TextEncoder().encode(value);
    const le = Buffer.from("\ufeff" + value, "utf16le");
    const be = Buffer.from(le).swap16();
    for (const bytes of [utf8, le, be]) {
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      expect(decodeImportFile(buffer)).toBe(value);
    }
  });

  it("decodes XLSX spreadsheet files with UTF-16LE XML into parseable CSV", () => {
    const realXlsxPath = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.xlsx";
    if (existsSync(realXlsxPath)) {
      const buf = readFileSync(realXlsxPath);
      const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const csv = decodeImportFile(arrayBuf);
      expect(csv).toContain("Positions");
      expect(csv).toContain("530319802");
      expect(csv).toContain("78698762");
    }
  });
});


// ============================================================================
// 4. IMPORT FORMATS COMPATIBILITY REGRESSION
// ============================================================================

const cases = [
  {
    format: "tradervue",
    pnl: 7,
    content: `Date,Time,Symbol,Quantity,Price,Side,Commission,TransFee,ECNFee
2026-01-05,09:30:00,AAPL,1,100,Buy,1,0.25,0.25
2026-01-05,10:00:00,AAPL,1,110,Sell,1,0.25,0.25`,
  },
  {
    format: "tradingview",
    pnl: 10,
    content: `Symbol,Side,Type,Qty,Fill Price,Status,Commission,Closing Time
NASDAQ:AAPL,Buy,Market,1,100,Filled,0,2026-01-05 09:30:00
NASDAQ:AAPL,Sell,Market,1,110,Filled,0,2026-01-05 10:00:00
NASDAQ:AAPL,Buy,Limit,1,99,Cancelled,0,2026-01-05 11:00:00`,
  },
  {
    format: "tradovate",
    pnl: 10,
    content: `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
1001,APEX123,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,1,5000,Filled
1002,APEX123,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,1,5010,Filled`,
  },
  {
    format: "topstepx",
    pnl: 10,
    content: `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-1,/ESU6,5000,2026-08-20 09:31:05,Opening,Bid,1,Filled,Market
TSX-1,/ESU6,5010,2026-08-20 09:45:10,Closing,Ask,1,Filled,Market`,
  },
  {
    format: "ibkr-flex",
    pnl: 8,
    content: `ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass,Code
U1234567,AAPL,20260105;093000,BUY,1,100,-1,STK,O
U1234567,AAPL,20260105;100000,SELL,-1,110,-1,STK,C`,
  },
  {
    format: "ibkr",
    pnl: 8,
    content: `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:30:00",1,100,100,-100,-1,101,0,0,O
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:00:00",-1,110,110,110,-1,-101,8,0,C`,
  },
  {
    format: "webull",
    pnl: 10,
    content: `Symbol,Side,Status,Filled/Total Qty,Price/Avg Price,Filled Time
AAPL,Buy,Filled,1/1,100/100,2026-01-05 09:30:00
AAPL,Sell,Filled,1/1,110/110,2026-01-05 10:00:00`,
  },
  {
    format: "das-trader",
    pnl: 10,
    content: `Symb,B/S,Qty,Price,Date,Time
AAPL,Buy,1,100,2026-01-05,09:30:00
AAPL,Sell,1,110,2026-01-05,10:00:00`,
  },
  {
    format: "thinkorswim",
    pnl: 10,
    content: `Account Trade History
Exec Time,Symbol,Side,Qty,Price
2026-01-05 09:30:00,AAPL,BUY,1,100
2026-01-05 10:00:00,AAPL,SELL,1,110

`,
  },
  {
    format: "tradezella",
    pnl: 8,
    content: `Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions
2026-01-05 09:30:00,2026-01-05 10:00:00,AAPL,LONG,1,100,110,8,2`,
  },
  {
    format: "metatrader",
    pnl: 10,
    content: `<html>MetaTrader 4 Closed Transactions<table><tr><td>12345</td><td>2026.01.05 09:30</td><td>buy</td><td>1</td><td>eurusd</td><td>100</td><td>0</td><td>0</td><td>2026.01.05 10:00</td><td>110</td><td>0</td><td>0</td><td>0</td><td>10</td></tr></table></html>`,
  },
];

describe("Import Formats Compatibility Regression", () => {
  beforeEach(() => {
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(accounts).where(eq(accounts.id, "test")).run();
    db.insert(accounts)
      .values({ id: "test", name: "Regression", kind: "import", createdAt: "2026-01-01" })
      .run();
  });

  it.each(cases)(
  "$format previews, saves and reimports without changing trades or reviews",
  async ({ format, content, pnl }) => {
    const preview = await post({ mode: "preview", content, timeZone: "UTC", accountId: "test" });
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ detected: format, totals: { executions: 2 } });
    expect(db.select().from(executions).all()).toHaveLength(0);
    const first = await post({ mode: "commit", content, timeZone: "UTC", accountId: "test" });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ inserted: 2, duplicates: 0 });
    const saved = db.select().from(trades).all();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      direction: "long",
      quantity: 1,
      openQuantity: 0,
      netPnl: pnl,
    });
    db.update(trades)
      .set({ notes: "Keep review", rating: 5 })
      .where(eq(trades.key, saved[0]!.key))
      .run();
    const repeat = await post({ mode: "commit", content, timeZone: "UTC", accountId: "test" });
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({ inserted: 0, duplicates: 2 });
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).all()[0]).toMatchObject({
      key: saved[0]!.key,
      netPnl: pnl,
      notes: "Keep review",
      rating: 5,
    });
  },
);

it.each(["UTC", "America/New_York"])(
  "blocks unsafe IBKR reimports over old midnight timestamps (%s)",
  async (timeZone) => {
    const { parseAuto } = await import("@luxalgo/journal-importers");
    const { insertExecutions } = await import("../../src/server/executions");
    const content = cases.find((test) => test.format === "ibkr")!.content;
    const parsed = parseAuto(content, { timeZone })!;
    const legacy = parsed.executions.map(({ legacyExecutedAt, ...row }) => ({
      ...row,
      executedAt: legacyExecutedAt!,
    }));
    insertExecutions("test", legacy, "import");
    const before = db.select().from(executions).all();
    db.update(trades).set({ notes: "Legacy review" }).run();
    const response = await post({ mode: "commit", content, accountId: "test", timeZone });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("older parser");
    expect(db.select().from(executions).all()).toEqual(before);
    expect(db.select().from(trades).all()[0]?.notes).toBe("Legacy review");
  },
);

it("blocks reimports over rounded fractional timestamps without affecting manual entries", async () => {
  const { insertExecutions } = await import("../../src/server/executions");
  const content = cases
    .find((test) => test.format === "tradingview")!
    .content.replace("09:30:00", "09:30:00.123")
    .replace("10:00:00", "10:00:00.456");
  const { parseAuto } = await import("@luxalgo/journal-importers");
  const parsed = parseAuto(content, { timeZone: "UTC" })!;
  insertExecutions(
    "test",
    parsed.executions.map((row) => ({
      ...row,
      executedAt: row.executedAt.replace(/\.\d{3}Z$/, ".000Z"),
    })),
    "import",
  );
  const before = db.select().from(executions).all();
  const response = await post({ mode: "commit", content, accountId: "test", timeZone: "UTC" });
  expect(response.status).toBe(400);
  expect(db.select().from(executions).all()).toEqual(before);
  expect(insertExecutions("test", parsed.executions, "manual").inserted).toBe(2);
});

});

afterAll(() => {
  try {
    (db as any)?.$client?.close?.();
  } catch {}
  vi.unstubAllEnvs();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  try {
    rmSync(scratch, { recursive: true, force: true });
  } catch {}
});
