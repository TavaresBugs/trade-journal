import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { eq } from "drizzle-orm";

describe("Real Database Clone & FTMO Journal Safety Audit", () => {
  it("proves that importing into the database preserves 100% of journal notes and existing trades", async () => {
    // 1. Create isolated sandbox directory with a clone of the user real database
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftmo-safety-test-"));
    const realDbPath = path.resolve(__dirname, "../data/journal.db");
    const sandboxDbPath = path.join(sandboxDir, "journal.db");

    fs.copyFileSync(realDbPath, sandboxDbPath);
    const dbSizeMb = fs.statSync(sandboxDbPath).size / 1024 / 1024;
    console.log(`\n[SAFETY TEST] Cloned real user database (${dbSizeMb.toFixed(2)} MB) to: ${sandboxDbPath}`);

    // Set environment to point to sandbox
    process.env.JOURNAL_DATA_DIR = sandboxDir;

    const { db, accounts, executions, trades, journalDays } = await import("../src/db");
    const { POST } = await import("../src/app/api/import/route");
    const { rebuildAccount } = await import("../src/server/rebuild");

    // 2. Check initial state
    const account = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get();
    expect(account).toBeDefined();
    expect(account!.broker).toBe("ftmo");
    expect(account!.accountNumber).toBe("530319802");
    console.log(`[SAFETY TEST] Target Account: "${account!.name}" (#${account!.accountNumber}), Broker: ${account!.broker}`);

    const initialDays = db.select().from(journalDays).all();
    expect(initialDays.length).toBeGreaterThan(0);
    console.log(`[SAFETY TEST] Found ${initialDays.length} daily journal entries in real DB.`);
    for (const day of initialDays) {
      if (day.note.length > 0) {
        console.log(`  - Date ${day.date}: ${day.note.length} chars note preserved ("${day.note.slice(0, 45).replace(/\n/g, " ")}...")`);
      }
    }

    const initialExecs = db.select().from(executions).where(eq(executions.accountId, account!.id)).all();
    const initialTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    expect(initialExecs.length).toBe(308);
    expect(initialTrades.length).toBe(154);
    console.log(`[SAFETY TEST] Initial FTMO state: 308 executions, 154 closed trades.`);

    // 3. Annotate a trade with a custom note and 5-star rating to test annotation survival
    const testTradeKey = initialTrades[0]!.key;
    db.update(trades)
      .set({ notes: "MINHA_ANOTACAO_DE_OURO_FTMO", rating: 5, playbookId: "fvg-reversal" })
      .where(eq(trades.key, testTradeKey))
      .run();

    // 4. Read the user real FTMO MT5 HTML report
    const ftmoFile = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.html";
    const ftmoBuffer = fs.readFileSync(ftmoFile);
    const ftmoContent = ftmoBuffer[0] === 0xff && ftmoBuffer[1] === 0xfe
      ? ftmoBuffer.toString("utf16le")
      : ftmoBuffer.toString("utf8");

    // 5. Test Preview
    const previewReq = new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "preview",
        content: ftmoContent,
        accountId: account!.id,
        timeZone: account!.timeZone || "Europe/Helsinki",
      }),
    });
    const previewRes = await POST(previewReq);
    expect(previewRes.status).toBe(200);
    const previewJson = await previewRes.json();
    expect(previewJson.detected).toMatch(/metatrader/);
    expect(previewJson.detectedAccount).toBe("530319802");
    expect(previewJson.accountConflict).toBeUndefined();
    console.log(`[SAFETY TEST] Preview succeeded: detected MT5 format, account #${previewJson.detectedAccount}, 0 conflicts.`);

    // 6. Test Commit (Re-importing into the real DB clone)
    const commitReq = new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: ftmoContent,
        accountId: account!.id,
        timeZone: account!.timeZone || "Europe/Helsinki",
      }),
    });
    const commitRes = await POST(commitReq);
    expect(commitRes.status).toBe(200);
    const commitJson = await commitRes.json();
    console.log(`[SAFETY TEST] Commit result: inserted=${commitJson.inserted}, duplicates=${commitJson.duplicates}`);
    expect(commitJson.inserted).toBe(0);
    expect(commitJson.duplicates).toBe(306);

    // 7. Verify post-commit state
    const afterExecs = db.select().from(executions).where(eq(executions.accountId, account!.id)).all();
    const afterTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    const afterDays = db.select().from(journalDays).all();

    expect(afterExecs.length).toBe(308);
    expect(afterTrades.length).toBe(154);
    expect(afterDays.length).toBe(initialDays.length);

    // Verify daily journal notes did NOT change even a single character
    for (const day of initialDays) {
      const current = afterDays.find((d) => d.date === day.date);
      expect(current).toBeDefined();
      expect(current!.note).toBe(day.note);
      expect(current!.updatedAt).toBe(day.updatedAt);
    }
    console.log(`[SAFETY TEST] All ${initialDays.length} daily journals are 100% byte-for-byte identical!`);

    // Verify trade annotation survived 100% intact
    const annotatedTradeAfter = db.select().from(trades).where(eq(trades.key, testTradeKey)).get();
    expect(annotatedTradeAfter!.notes).toBe("MINHA_ANOTACAO_DE_OURO_FTMO");
    expect(annotatedTradeAfter!.rating).toBe(5);
    expect(annotatedTradeAfter!.playbookId).toBe("fvg-reversal");
    console.log(`[SAFETY TEST] Trade annotation survived rebuild intact: note="${annotatedTradeAfter!.notes}", rating=${annotatedTradeAfter!.rating}`);

    // Cleanup sandbox
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log(`[SAFETY TEST] Sandbox cleaned up successfully. Zero risks to production DB.\n`);
  });

  it("proves that importing other brokers into separate accounts has zero impact on FTMO data", async () => {
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftmo-isolation-test-"));
    const realDbPath = path.resolve(__dirname, "../data/journal.db");
    const sandboxDbPath = path.join(sandboxDir, "journal.db");
    fs.copyFileSync(realDbPath, sandboxDbPath);
    process.env.JOURNAL_DATA_DIR = sandboxDir;

    const { db, accounts, executions, trades, journalDays } = await import("../src/db");
    const { POST } = await import("../src/app/api/import/route");

    // 1. Snapshot initial FTMO state
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecsInitial = db.select().from(executions).where(eq(executions.accountId, ftmoAccount.id)).all();
    const ftmoTradesInitial = db.select().from(trades).where(eq(trades.accountId, ftmoAccount.id)).all();
    const journalDaysInitial = db.select().from(journalDays).all();

    // 2. Create a new account for TopstepX
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

    // 3. Import TopstepX fixture
    const topstepFile = path.resolve(__dirname, "../../../packages/importers/tests/fixtures/tradezella/topstepx-topstepx.csv");
    const topstepContent = fs.readFileSync(topstepFile, "utf8");

    const commitRes = await POST(
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

    // 4. Verify TopstepX account has its own trades
    const topstepExecs = db.select().from(executions).where(eq(executions.accountId, newAccountId)).all();
    const topstepTrades = db.select().from(trades).where(eq(trades.accountId, newAccountId)).all();
    expect(topstepExecs.length).toBe(76);
    expect(topstepTrades.length).toBe(38);

    // 5. Strict Assert: FTMO Account was untouched (0 executions added/removed, 0 trades changed)
    const ftmoExecsAfter = db.select().from(executions).where(eq(executions.accountId, ftmoAccount.id)).all();
    const ftmoTradesAfter = db.select().from(trades).where(eq(trades.accountId, ftmoAccount.id)).all();
    expect(ftmoExecsAfter.length).toBe(ftmoExecsInitial.length);
    expect(ftmoTradesAfter.length).toBe(ftmoTradesInitial.length);

    // 6. Strict Assert: Journal Days were untouched
    const journalDaysAfter = db.select().from(journalDays).all();
    expect(journalDaysAfter.length).toBe(journalDaysInitial.length);
    for (let i = 0; i < journalDaysInitial.length; i++) {
      expect(journalDaysAfter[i]!.note).toBe(journalDaysInitial[i]!.note);
    }

    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log("[SAFETY TEST] Cross-account isolation confirmed: Topstep imported 76 execs, FTMO stayed 100% untouched.");
  });
});
