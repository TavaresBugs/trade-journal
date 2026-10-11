import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

// 1. Isolate test database in temporary directory
const scratch = mkdtempSync(join(tmpdir(), "journal-data-maintenance-test-"));
vi.stubEnv("JOURNAL_DATA_DIR", scratch);
vi.stubEnv("JOURNAL_PASSWORD", "");
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

// Dynamic imports to ensure environment variables are evaluated first
const {
  db,
  accounts,
  executions,
  trades,
  attachments,
  tradeRuleChecks,
  notes,
  folders,
  journalDays,
  playbooks,
  importBatches,
  importSources,
  importSourceAliases,
} = await import("../src/db");
const { rebuildAccount } = await import("../src/server/rebuild");
const { getDataMaintenanceMetrics, resetBrokerTrades, clearScreenshots, factoryResetAllData } =
  await import("../src/server/data-maintenance");
const { GET: getMaintenanceRoute, POST: postMaintenanceRoute } =
  await import("../src/app/api/data-maintenance/route");

describe("Data Maintenance & Cleanup Controls (/api/data-maintenance)", () => {
  const accountA = "acc_maint_alpha";
  const accountB = "acc_maint_beta";
  const defaultFolderId = "folder_default";

  beforeEach(() => {
    // Clear test tables in dependency order
    db.delete(attachments).run();
    db.delete(tradeRuleChecks).run();
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(notes).run();
    db.delete(folders).run();
    db.delete(journalDays).run();
    db.delete(playbooks).run();
    db.delete(importBatches).run();
    db.delete(importSourceAliases).run();
    db.delete(importSources).run();
    db.delete(accounts).run();

    // Default folder for notes
    db.insert(folders)
      .values({
        id: defaultFolderId,
        name: "Default Folder",
        kind: "user",
        createdAt: "2026-10-01T00:00:00Z",
      })
      .run();

    // Seed test accounts
    db.insert(accounts)
      .values([
        {
          id: accountA,
          name: "Alpha Apex",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-10-01T00:00:00Z",
        },
        {
          id: accountB,
          name: "Beta Topstep",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-10-01T00:00:00Z",
        },
      ])
      .run();
  });

  afterAll(() => {
    try {
      (db as any)?.$client?.close?.();
    } catch {}
    rmSync(scratch, { recursive: true, force: true });
  });

  describe("Metrics Inspection (getDataMaintenanceMetrics & GET)", () => {
    it("reports zero metrics on fresh accounts", async () => {
      const res = await getMaintenanceRoute();
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.tradesCount).toBe(0);
      expect(data.executionsCount).toBe(0);
      expect(data.attachmentsCount).toBe(0);
      expect(data.attachmentsSizeBytes).toBe(0);
      expect(data.imageAttachmentsCount).toBe(0);
      expect(data.imageAttachmentsSizeBytes).toBe(0);
      expect(data.notesCount).toBe(0);
      expect(data.journalDaysCount).toBe(0);
      expect(data.playbooksCount).toBe(0);
      expect(data.accounts).toHaveLength(2);
      expect(data.accounts[0]?.tradeCount).toBe(0);
      expect(data.accounts[0]?.executionCount).toBe(0);
    });

    it("accurately tallies populated trades, executions, attachments, notes, and playbooks", async () => {
      // 1. Add executions for account A and rebuild
      db.insert(executions)
        .values([
          {
            id: "exec_1",
            accountId: accountA,
            symbol: "NQ",
            side: "buy",
            quantity: 1,
            price: 18000,
            fee: 1.5,
            executedAt: "2026-10-01T10:00:00Z",
            source: "manual",
            contentHash: "hash-exec-1",
            createdAt: "2026-10-01T10:00:00Z",
          },
          {
            id: "exec_2",
            accountId: accountA,
            symbol: "NQ",
            side: "sell",
            quantity: 1,
            price: 18020,
            fee: 1.5,
            executedAt: "2026-10-01T10:15:00Z",
            source: "manual",
            contentHash: "hash-exec-2",
            createdAt: "2026-10-01T10:15:00Z",
          },
        ])
        .run();
      rebuildAccount(accountA);

      const generatedTrades = db.select().from(trades).where(eq(trades.accountId, accountA)).all();
      expect(generatedTrades.length).toBe(1);
      const tradeKey = generatedTrades[0]!.key;

      // 2. Add attachments, notes, journalDays, playbooks
      db.insert(attachments)
        .values([
          {
            id: "att_img_1",
            ownerType: "trade",
            ownerId: tradeKey,
            name: "setup.png",
            mime: "image/png",
            size: 204800, // 200 KB
            data: Buffer.from("fake-png-data"),
            createdAt: "2026-10-01T10:20:00Z",
          },
          {
            id: "att_pdf_1",
            ownerType: "trade",
            ownerId: tradeKey,
            name: "statement.pdf",
            mime: "application/pdf",
            size: 51200, // 50 KB
            data: Buffer.from("fake-pdf-data"),
            createdAt: "2026-10-01T10:20:00Z",
          },
        ])
        .run();

      db.insert(notes)
        .values({
          id: "note_1",
          folderId: defaultFolderId,
          tradeKey,
          title: "NQ Sweep Note",
          content: "Clean liquidity sweep entry on NQ.",
          createdAt: "2026-10-01T10:20:00Z",
          updatedAt: "2026-10-01T10:20:00Z",
        })
        .run();

      db.insert(journalDays)
        .values({
          date: "2026-10-01",
          note: "Solid trading session, high focus.",
          updatedAt: "2026-10-01T10:20:00Z",
        })
        .run();

      db.insert(playbooks)
        .values({
          id: "pb_1",
          name: "FVG Scalp",
          description: "Fair Value Gap scalping strategy",
          rulesJson: JSON.stringify(["HTF Bias", "Sweep"]),
          createdAt: "2026-10-01T10:20:00Z",
        })
        .run();

      const metrics = getDataMaintenanceMetrics();
      expect(metrics.tradesCount).toBe(1);
      expect(metrics.executionsCount).toBe(2);
      expect(metrics.attachmentsCount).toBe(2);
      expect(metrics.attachmentsSizeBytes).toBe(256000);
      expect(metrics.imageAttachmentsCount).toBe(1);
      expect(metrics.imageAttachmentsSizeBytes).toBe(204800);
      expect(metrics.notesCount).toBe(1);
      expect(metrics.journalDaysCount).toBe(1);
      expect(metrics.playbooksCount).toBe(1);

      const accAMetrics = metrics.accounts.find((a) => a.id === accountA);
      expect(accAMetrics?.tradeCount).toBe(1);
      expect(accAMetrics?.executionCount).toBe(2);

      const accBMetrics = metrics.accounts.find((a) => a.id === accountB);
      expect(accBMetrics?.tradeCount).toBe(0);
      expect(accBMetrics?.executionCount).toBe(0);
    });
  });

  describe("Safe Broker Trade Reset (resetBrokerTrades & action: 'reset_trades')", () => {
    it("resets executions and trades for a target account while strictly preserving screenshots, notes, and thesis", async () => {
      // 1. Seed account A trade
      db.insert(executions)
        .values([
          {
            id: "exec_a1",
            accountId: accountA,
            symbol: "ES",
            side: "buy",
            quantity: 1,
            price: 5000,
            fee: 2.0,
            executedAt: "2026-10-05T14:30:00Z",
            source: "manual",
            contentHash: "hash-exec-a1",
            createdAt: "2026-10-05T14:30:00Z",
          },
          {
            id: "exec_a2",
            accountId: accountA,
            symbol: "ES",
            side: "sell",
            quantity: 1,
            price: 5010,
            fee: 2.0,
            executedAt: "2026-10-05T15:00:00Z",
            source: "manual",
            contentHash: "hash-exec-a2",
            createdAt: "2026-10-05T15:00:00Z",
          },
        ])
        .run();
      rebuildAccount(accountA);

      // 2. Seed account B trade (sibling account)
      db.insert(executions)
        .values([
          {
            id: "exec_b1",
            accountId: accountB,
            symbol: "MES",
            side: "buy",
            quantity: 2,
            price: 5000,
            fee: 1.0,
            executedAt: "2026-10-05T14:35:00Z",
            source: "manual",
            contentHash: "hash-exec-b1",
            createdAt: "2026-10-05T14:35:00Z",
          },
          {
            id: "exec_b2",
            accountId: accountB,
            symbol: "MES",
            side: "sell",
            quantity: 2,
            price: 5005,
            fee: 1.0,
            executedAt: "2026-10-05T14:45:00Z",
            source: "manual",
            contentHash: "hash-exec-b2",
            createdAt: "2026-10-05T14:45:00Z",
          },
        ])
        .run();
      rebuildAccount(accountB);

      const [tradeA] = db.select().from(trades).where(eq(trades.accountId, accountA)).all();
      const [tradeB] = db.select().from(trades).where(eq(trades.accountId, accountB)).all();
      expect(tradeA).toBeDefined();
      expect(tradeB).toBeDefined();
      if (!tradeA || !tradeB) throw new Error("Expected trades to be defined");

      // 3. Attach screenshot, rule check, and note to Trade A
      db.insert(attachments)
        .values({
          id: "att_a",
          ownerType: "trade",
          ownerId: tradeA.key,
          name: "chart_trade_a.png",
          mime: "image/png",
          size: 10240,
          data: Buffer.from("image"),
          createdAt: "2026-10-05T15:00:00Z",
        })
        .run();

      db.insert(tradeRuleChecks)
        .values({
          id: "trc_a1",
          tradeKey: tradeA.key,
          playbookId: "pb_1",
          rule: "HTF Confluence",
          followed: true,
        })
        .run();

      db.insert(notes)
        .values({
          id: "note_a",
          folderId: defaultFolderId,
          tradeKey: tradeA.key,
          title: "Execution note",
          content: "Perfect execution off 15m order block.",
          createdAt: "2026-10-05T15:00:00Z",
          updatedAt: "2026-10-05T15:00:00Z",
        })
        .run();

      db.insert(journalDays)
        .values({
          date: "2026-10-05",
          note: "Trading session notes.",
          updatedAt: "2026-10-05T15:00:00Z",
        })
        .run();

      db.insert(importSources)
        .values({
          id: "src_test_a",
          accountId: accountA,
          format: "ninjatrader",
          name: "NinjaTrader Test",
          createdAt: "2026-10-05T15:00:00Z",
        })
        .run();

      db.insert(importBatches)
        .values({
          id: "batch_test_a",
          accountId: accountA,
          format: "ninjatrader",
          fingerprint: "fp_test_a",
          rawHash: "hash_test_a",
          timeZone: "America/Chicago",
          sourceIdsJson: JSON.stringify(["src_test_a"]),
          fromTime: "2026-10-05T14:30:00Z",
          toTime: "2026-10-05T15:00:00Z",
          snapshotJson: "{}",
          createdAt: "2026-10-05T15:00:00Z",
        })
        .run();

      // 4. Execute reset_trades via POST route for account A ONLY
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reset_trades",
            accountId: accountA,
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.deletedTradeCount).toBe(1);
      expect(body.deletedExecutionCount).toBe(2);
      expect(body.preservedAttachmentCount).toBe(1);
      expect(body.preservedRuleCheckCount).toBe(1);
      expect(body.preservedNoteCount).toBe(1);
      expect(body.preservedJournalDayCount).toBe(1);

      // 5. Verify Account A trades, executions, and import batches are gone
      const remainingTradesA = db.select().from(trades).where(eq(trades.accountId, accountA)).all();
      const remainingExecsA = db
        .select()
        .from(executions)
        .where(eq(executions.accountId, accountA))
        .all();
      const remainingBatchesA = db
        .select()
        .from(importBatches)
        .where(eq(importBatches.accountId, accountA))
        .all();
      expect(remainingTradesA).toHaveLength(0);
      expect(remainingExecsA).toHaveLength(0);
      expect(remainingBatchesA).toHaveLength(0);

      // 6. Verify Sibling Account B is 100% UNTOUCHED
      const remainingTradesB = db.select().from(trades).where(eq(trades.accountId, accountB)).all();
      const remainingExecsB = db
        .select()
        .from(executions)
        .where(eq(executions.accountId, accountB))
        .all();
      expect(remainingTradesB).toHaveLength(1);
      expect(remainingExecsB).toHaveLength(2);

      // 7. Verify intellectual property is PRESERVED
      const remainingAtts = db.select().from(attachments).all();
      expect(remainingAtts).toHaveLength(1);
      expect(remainingAtts[0]?.ownerId).toBe(tradeA.key);

      const remainingChecks = db.select().from(tradeRuleChecks).all();
      expect(remainingChecks).toHaveLength(1);

      const remainingNotes = db.select().from(notes).all();
      expect(remainingNotes).toHaveLength(1);
      expect(remainingNotes[0]?.tradeKey).toBe(tradeA.key);

      const remainingDays = db.select().from(journalDays).all();
      expect(remainingDays).toHaveLength(1);

      // 8. CRITICAL: Re-importing corrected executions re-anchors preserved screenshots seamlessly!
      db.insert(executions)
        .values([
          {
            id: "exec_a1_fixed",
            accountId: accountA,
            symbol: "ES",
            side: "buy",
            quantity: 1,
            price: 5000,
            fee: 1.8, // corrected fee
            executedAt: "2026-10-05T14:30:00Z",
            source: "manual",
            contentHash: "hash-exec-a1-fixed",
            createdAt: "2026-10-05T14:30:00Z",
          },
          {
            id: "exec_a2_fixed",
            accountId: accountA,
            symbol: "ES",
            side: "sell",
            quantity: 1,
            price: 5012, // corrected exit
            fee: 1.8,
            executedAt: "2026-10-05T15:00:00Z",
            source: "manual",
            contentHash: "hash-exec-a2-fixed",
            createdAt: "2026-10-05T15:00:00Z",
          },
        ])
        .run();
      rebuildAccount(accountA);

      const rebuiltTradesA = db.select().from(trades).where(eq(trades.accountId, accountA)).all();
      expect(rebuiltTradesA).toHaveLength(1);
      // Deterministic natural key matches!
      expect(rebuiltTradesA[0]?.key).toBe(tradeA.key);

      // The attachment is still linked to the exact same tradeKey
      const reattached = db
        .select()
        .from(attachments)
        .where(eq(attachments.ownerId, rebuiltTradesA[0]!.key))
        .all();
      expect(reattached).toHaveLength(1);
    });

    it("resets all accounts when accountId is omitted or 'all'", async () => {
      db.insert(executions)
        .values([
          {
            id: "ex_1",
            accountId: accountA,
            symbol: "ES",
            side: "buy",
            quantity: 1,
            price: 5000,
            fee: 1,
            executedAt: "2026-10-06T10:00:00Z",
            source: "manual",
            contentHash: "hash-1",
            createdAt: "2026-10-06T10:00:00Z",
          },
          {
            id: "ex_2",
            accountId: accountB,
            symbol: "NQ",
            side: "buy",
            quantity: 1,
            price: 18000,
            fee: 1,
            executedAt: "2026-10-06T10:00:00Z",
            source: "manual",
            contentHash: "hash-2",
            createdAt: "2026-10-06T10:00:00Z",
          },
        ])
        .run();
      rebuildAccount(accountA);
      rebuildAccount(accountB);

      expect(db.select().from(trades).all()).toHaveLength(2);
      expect(db.select().from(executions).all()).toHaveLength(2);

      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_trades", accountId: "all" }),
        }),
      );
      expect(res.status).toBe(200);

      expect(db.select().from(trades).all()).toHaveLength(0);
      expect(db.select().from(executions).all()).toHaveLength(0);
      expect(db.select().from(accounts).all()).toHaveLength(2); // accounts preserved
    });
  });

  describe("Clear Screenshots (clearScreenshots & action: 'clear_screenshots')", () => {
    it("deletes image attachments to reclaim disk space while keeping non-image files and trades intact", async () => {
      db.insert(executions)
        .values({
          id: "ex_media",
          accountId: accountA,
          symbol: "ES",
          side: "buy",
          quantity: 1,
          price: 5000,
          fee: 1,
          executedAt: "2026-10-07T10:00:00Z",
          source: "manual",
          contentHash: "hash-media",
          createdAt: "2026-10-07T10:00:00Z",
        })
        .run();
      rebuildAccount(accountA);
      const [trade] = db.select().from(trades).where(eq(trades.accountId, accountA)).all();
      expect(trade).toBeDefined();
      if (!trade) throw new Error("Expected trade to be defined");

      db.insert(attachments)
        .values([
          {
            id: "img_png",
            ownerType: "trade",
            ownerId: trade.key,
            name: "entry.png",
            mime: "image/png",
            size: 150000,
            data: Buffer.from("png"),
            createdAt: "2026-10-07T10:00:00Z",
          },
          {
            id: "img_webp",
            ownerType: "trade",
            ownerId: trade.key,
            name: "exit.webp",
            mime: "image/webp",
            size: 80000,
            data: Buffer.from("webp"),
            createdAt: "2026-10-07T10:00:00Z",
          },
          {
            id: "doc_pdf",
            ownerType: "trade",
            ownerId: trade.key,
            name: "statement.pdf",
            mime: "application/pdf",
            size: 50000,
            data: Buffer.from("pdf"),
            createdAt: "2026-10-07T10:00:00Z",
          },
        ])
        .run();

      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear_screenshots" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.deletedAttachmentCount).toBe(2);
      expect(body.freedBytes).toBe(230000);

      // PDF was preserved
      const remainingAtts = db.select().from(attachments).all();
      expect(remainingAtts).toHaveLength(1);
      expect(remainingAtts[0]?.id).toBe("doc_pdf");

      // Trades and executions are untouched
      expect(db.select().from(trades).all()).toHaveLength(1);
      expect(db.select().from(executions).all()).toHaveLength(1);
    });
  });

  describe("Factory Reset (factoryResetAllData & action: 'factory_reset')", () => {
    it("rejects factory reset if confirmText !== 'RESET'", async () => {
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "factory_reset",
            confirmText: "reset", // lowercase should be rejected
          }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("RESET");
    });

    it("atomically purges all user data across all tables when confirmText === 'RESET'", async () => {
      // 1. Populate full spectrum of tables
      db.insert(executions)
        .values({
          id: "ex_fact",
          accountId: accountA,
          symbol: "ES",
          side: "buy",
          quantity: 1,
          price: 5000,
          fee: 1,
          executedAt: "2026-10-08T10:00:00Z",
          source: "manual",
          contentHash: "hash-fact",
          createdAt: "2026-10-08T10:00:00Z",
        })
        .run();
      rebuildAccount(accountA);
      const [trade] = db.select().from(trades).all();
      expect(trade).toBeDefined();
      if (!trade) throw new Error("Expected trade to be defined");

      db.insert(attachments)
        .values({
          id: "att_fact",
          ownerType: "trade",
          ownerId: trade.key,
          name: "fact.png",
          mime: "image/png",
          size: 1000,
          data: Buffer.from("data"),
          createdAt: "2026-10-08T10:00:00Z",
        })
        .run();

      db.insert(tradeRuleChecks)
        .values({
          id: "trc_fact",
          tradeKey: trade.key,
          playbookId: "pb_fact",
          rule: "Rule 1",
          followed: true,
        })
        .run();

      db.insert(notes)
        .values({
          id: "note_fact",
          folderId: defaultFolderId,
          tradeKey: trade.key,
          title: "Wipe note",
          content: "Wipe me",
          createdAt: "2026-10-08T10:00:00Z",
          updatedAt: "2026-10-08T10:00:00Z",
        })
        .run();

      db.insert(journalDays)
        .values({
          date: "2026-10-08",
          note: "Day notes",
          updatedAt: "2026-10-08T10:00:00Z",
        })
        .run();

      db.insert(playbooks)
        .values({
          id: "pb_fact",
          name: "Setup X",
          description: "Setup description",
          rulesJson: JSON.stringify([]),
          createdAt: "2026-10-08T10:00:00Z",
        })
        .run();

      db.insert(importSources)
        .values({
          id: "src_1",
          accountId: accountA,
          format: "tradovate",
          name: "Tradovate",
          createdAt: "2026-10-08T10:00:00Z",
        })
        .run();

      db.insert(importBatches)
        .values({
          id: "batch_1",
          accountId: accountA,
          format: "tradovate",
          fingerprint: "fp_1",
          rawHash: "hash_1",
          timeZone: "America/Chicago",
          sourceIdsJson: JSON.stringify(["src_1"]),
          fromTime: "2026-10-08T10:00:00Z",
          toTime: "2026-10-08T11:00:00Z",
          snapshotJson: "{}",
          createdAt: "2026-10-08T10:00:00Z",
        })
        .run();

      // 2. Perform factory reset
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "factory_reset",
            confirmText: "RESET",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.deletedAccountCount).toBe(2);
      expect(body.deletedTradeCount).toBe(1);
      expect(body.deletedExecutionCount).toBe(1);
      expect(body.deletedAttachmentCount).toBe(1);
      expect(body.deletedNoteCount).toBe(1);
      expect(body.deletedJournalDayCount).toBe(1);
      expect(body.deletedPlaybookCount).toBe(1);

      // 3. Confirm all tables are empty
      expect(db.select().from(accounts).all()).toHaveLength(0);
      expect(db.select().from(trades).all()).toHaveLength(0);
      expect(db.select().from(executions).all()).toHaveLength(0);
      expect(db.select().from(attachments).all()).toHaveLength(0);
      expect(db.select().from(notes).all()).toHaveLength(0);
      expect(db.select().from(journalDays).all()).toHaveLength(0);
      expect(db.select().from(playbooks).all()).toHaveLength(0);
      expect(db.select().from(importBatches).all()).toHaveLength(0);
      expect(db.select().from(importSources).all()).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("returns 400 on malformed JSON payload", async () => {
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid-json{",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 on unknown maintenance action", async () => {
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "destroy_world" }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when resetting non-existent account", async () => {
      const res = await postMaintenanceRoute(
        new Request("http://localhost/api/data-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reset_trades",
            accountId: "non_existent_account_xyz",
          }),
        }),
      );
      expect(res.status).toBe(404);
    });
  });
});
