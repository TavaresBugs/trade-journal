import { attachmentExportRecord, EXPORT_ATTACHMENTS_NOTE } from "../../src/lib/export-format";
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
} = await import("../../src/db");
const { rebuildAccount } = await import("../../src/server/rebuild");
const { getDataMaintenanceMetrics, resetBrokerTrades, clearScreenshots, factoryResetAllData } =
  await import("../../src/server/data-maintenance");
const { GET: getMaintenanceRoute, POST: postMaintenanceRoute } =
  await import("../../src/app/api/data-maintenance/route");


const { marketCandles, settings } = await import("../../src/db");
const { deleteTradeWithCleanup, deleteTradesWithCleanup } = await import("../../src/server/trades");
const { DELETE: deleteTradeRoute } = await import("../../src/app/api/trades/[key]/route");
const { POST: bulkTradeRoute } = await import("../../src/app/api/trades/bulk/route");
const { DELETE: deleteAccountRoute } = await import("../../src/app/api/accounts/[id]/route");
const { GET: getSettingsRoute, PATCH: patchSettingsRoute } = await import("../../src/app/api/settings/route");
const {
  saveDrawingFavorites,
  saveDrawingToolPrefs,
  loadDrawingFavorites,
  loadDrawingToolPrefs,
  flushPendingPreferencesSave,
  VELA_DRAWING_FAVORITES_KEY,
  VELA_DRAWING_PREFS_KEY,
} = await import("../../src/components/vela-drawings-bridge");

class MockLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}


describe("the JSON export stays small enough to build in memory", () => {
  it("lists attachment metadata without embedding the file contents", () => {
    const row = {
      id: "a1",
      ownerType: "trade",
      ownerId: "t1",
      name: "chart.png",
      mime: "image/png",
      size: 8 * 1024 * 1024,
      createdAt: "2026-09-01T00:00:00Z",
      data: Buffer.alloc(16, 1),
    };
    const exported: unknown = attachmentExportRecord(row);
    expect(exported).toEqual({
      id: "a1",
      ownerType: "trade",
      ownerId: "t1",
      name: "chart.png",
      mime: "image/png",
      size: 8 * 1024 * 1024,
      createdAt: "2026-09-01T00:00:00Z",
    });
    expect(exported).not.toHaveProperty("data");
    expect(exported).not.toHaveProperty("dataBase64");
  });

  it("tells the reader that attachment binaries live in the data directory", () => {
    expect(EXPORT_ATTACHMENTS_NOTE).toMatch(/data directory/);
    expect(EXPORT_ATTACHMENTS_NOTE).toMatch(/metadata/);
  });
});


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


describe("Trade Deletion Lifecycle, Cascade Cleanup & Dual-Tier Preferences", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MockLocalStorage();
    // Clean all related tables before each test
    db.delete(attachments).run();
    db.delete(tradeRuleChecks).run();
    db.delete(notes).run();
    db.delete(folders).run();
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(accounts).run();
    db.delete(journalDays).run();
    db.delete(marketCandles).run();
    db.delete(settings).run();

    // Default folder for notes
    db.insert(folders)
      .values({
        id: "folder-default",
        name: "General",
        kind: "user",
        createdAt: new Date().toISOString(),
      })
      .run();
  });

  afterEach(() => {
    flushPendingPreferencesSave();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("1. DELETE /api/trades/[key] - Cascade and Data Preservation", () => {
    it("deletes trade, executions, attachments, and rule checks while preserving thesis notes and candles", async () => {
      // 1. Arrange: Account & Executions
      const accountId = "acc-test-1";
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Trading Account 1",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
        })
        .run();

      db.insert(executions)
        .values([
          {
            id: "exec-101",
            accountId,
            symbol: "AAPL",
            side: "buy",
            quantity: 10,
            price: 150,
            fee: 1,
            executedAt: "2026-01-01T10:00:00Z",
            source: "manual",
            contentHash: "hash-exec-101",
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "exec-102",
            accountId,
            symbol: "AAPL",
            side: "sell",
            quantity: 10,
            price: 155,
            fee: 1,
            executedAt: "2026-01-01T10:15:00Z",
            source: "manual",
            contentHash: "hash-exec-102",
            createdAt: "2026-01-01T10:15:00Z",
          },
        ])
        .run();

      // Rebuild account to materialize round-trip trade
      rebuildAccount(accountId);
      const tradeList = db.select().from(trades).where(eq(trades.accountId, accountId)).all();
      expect(tradeList).toHaveLength(1);
      const tradeKey = tradeList[0]!.key;

      // 2. Link trade to journal_days entry
      const sessionDate = "2026-01-01";
      db.insert(journalDays)
        .values({
          date: sessionDate,
          note: "Market opened gap-up, thesis is to trade pullbacks into 150 key support.",
          updatedAt: "2026-01-01T12:00:00Z",
        })
        .run();

      db.update(trades)
        .set({ linkedJournalDate: sessionDate })
        .where(eq(trades.key, tradeKey))
        .run();

      // 3. Attachments belonging to the trade (ownerType: 'trade')
      db.insert(attachments)
        .values([
          {
            id: "att-1",
            ownerType: "trade",
            ownerId: tradeKey,
            slot: "pre_tfH1",
            name: "setup_h1.png",
            mime: "image/png",
            size: 1024,
            data: Buffer.from("png-bytes-1"),
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "att-2",
            ownerType: "trade",
            ownerId: tradeKey,
            slot: "post_tfM5",
            name: "exit_m5.png",
            mime: "image/png",
            size: 2048,
            data: Buffer.from("png-bytes-2"),
            createdAt: "2026-01-01T10:20:00Z",
          },
        ])
        .run();

      // 4. Trade rule checks
      db.insert(tradeRuleChecks)
        .values({
          id: "rule-chk-1",
          tradeKey,
          playbookId: "pb-scalp",
          rule: "Waited for candle close above EMA20",
          followed: true,
        })
        .run();

      // 5. Linked note (should be unlinked, not deleted)
      db.insert(notes)
        .values({
          id: "note-1",
          folderId: "folder-default",
          title: "Execution Review",
          content: "Solid execution at support.",
          tradeKey,
          createdAt: "2026-01-01T10:30:00Z",
          updatedAt: "2026-01-01T10:30:00Z",
        })
        .run();

      // 6. Market candle records
      db.insert(marketCandles)
        .values([
          {
            symbol: "AAPL",
            resolution: "1m",
            time: 1704103200,
            open: 150,
            high: 156,
            low: 149.5,
            close: 155,
            volume: 5000,
            currency: "USD",
            priceBasis: "raw",
          },
        ])
        .run();

      // Verify arrange state
      expect(
        db.select().from(attachments).where(eq(attachments.ownerId, tradeKey)).all(),
      ).toHaveLength(2);
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeKey, tradeKey)).all(),
      ).toHaveLength(1);
      expect(db.select().from(notes).where(eq(notes.id, "note-1")).get()?.tradeKey).toBe(tradeKey);

      // Act 1: Safe Execution Reset via DELETE /api/trades/[key] (default: purgeAttachments=false)
      const request = new Request(`http://localhost/api/trades/${encodeURIComponent(tradeKey)}`, {
        method: "DELETE",
      });
      const response = await deleteTradeRoute(request, {
        params: Promise.resolve({ key: tradeKey }),
      });
      expect(response.status).toBe(200);
      const json = (await response.json()) as {
        deleted: boolean;
        deletedTradeCount: number;
        deletedAttachmentCount: number;
        preservedAttachmentCount: number;
        preservedRuleCheckCount: number;
        preservedNoteCount: number;
      };
      expect(json.deleted).toBe(true);
      expect(json.deletedTradeCount).toBe(1);
      expect(json.deletedAttachmentCount).toBe(0);
      expect(json.preservedAttachmentCount).toBe(2);
      expect(json.preservedRuleCheckCount).toBe(1);
      expect(json.preservedNoteCount).toBe(1);

      // Assert Safe Reset state:
      // 1. Trade is deleted from trades table
      const remainingTrade = db.select().from(trades).where(eq(trades.key, tradeKey)).get();
      expect(remainingTrade).toBeUndefined();

      // 2. Executions are deleted from executions table
      const remainingExecs = db
        .select()
        .from(executions)
        .where(eq(executions.accountId, accountId))
        .all();
      expect(remainingExecs).toHaveLength(0);

      // 3. Attachments are PRESERVED in attachments table for re-import
      const preservedAttachments = db
        .select()
        .from(attachments)
        .where(eq(attachments.ownerId, tradeKey))
        .all();
      expect(preservedAttachments).toHaveLength(2);

      // 4. Rule checks are PRESERVED in trade_rule_checks for re-import
      const preservedRuleChecks = db
        .select()
        .from(tradeRuleChecks)
        .where(eq(tradeRuleChecks.tradeKey, tradeKey))
        .all();
      expect(preservedRuleChecks).toHaveLength(1);

      // 5. Note still exists and still points to tradeKey for automatic re-anchoring
      const noteRow = db.select().from(notes).where(eq(notes.id, "note-1")).get();
      expect(noteRow).toBeDefined();
      expect(noteRow?.tradeKey).toBe(tradeKey);

      // 6. Journal day session record STILL EXISTS (thesis is preserved)
      const sessionDay = db
        .select()
        .from(journalDays)
        .where(eq(journalDays.date, sessionDate))
        .get();
      expect(sessionDay).toBeDefined();
      expect(sessionDay?.note).toBe(
        "Market opened gap-up, thesis is to trade pullbacks into 150 key support.",
      );

      // 7. Market candles STILL EXIST
      const candles = db.select().from(marketCandles).where(eq(marketCandles.symbol, "AAPL")).all();
      expect(candles).toHaveLength(1);
      expect(candles[0]?.close).toBe(155);

      // 8. RE-IMPORT RECOVERY VERIFICATION:
      // Re-insert corrected executions for the same trade
      db.insert(executions)
        .values([
          {
            id: "exec-101-corrected",
            accountId,
            symbol: "AAPL",
            side: "buy",
            quantity: 10,
            price: 150,
            fee: 1.25, // Updated fee
            executedAt: "2026-01-01T10:00:00Z",
            source: "manual",
            contentHash: "hash-exec-101-corrected",
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "exec-102-corrected",
            accountId,
            symbol: "AAPL",
            side: "sell",
            quantity: 10,
            price: 155,
            fee: 1.25,
            executedAt: "2026-01-01T10:15:00Z",
            source: "manual",
            contentHash: "hash-exec-102-corrected",
            createdAt: "2026-01-01T10:15:00Z",
          },
        ])
        .run();

      rebuildAccount(accountId);
      const restoredTrades = db.select().from(trades).where(eq(trades.accountId, accountId)).all();
      expect(restoredTrades).toHaveLength(1);
      expect(restoredTrades[0]!.key).toBe(tradeKey); // Rebuild-stable key matches!

      // Attachments, rule checks, and note immediately re-bind to the restored trade!
      const reattachedAttachments = db
        .select()
        .from(attachments)
        .where(eq(attachments.ownerId, restoredTrades[0]!.key))
        .all();
      expect(reattachedAttachments).toHaveLength(2);

      // Act 2: Nuclear Hard Purge with ?purgeAttachments=true
      const purgeRequest = new Request(
        `http://localhost/api/trades/${encodeURIComponent(tradeKey)}?purgeAttachments=true`,
        { method: "DELETE" },
      );
      const purgeResponse = await deleteTradeRoute(purgeRequest, {
        params: Promise.resolve({ key: tradeKey }),
      });
      expect(purgeResponse.status).toBe(200);
      const purgeJson = (await purgeResponse.json()) as {
        deleted: boolean;
        deletedTradeCount: number;
        deletedAttachmentCount: number;
      };
      expect(purgeJson.deleted).toBe(true);
      expect(purgeJson.deletedTradeCount).toBe(1);
      expect(purgeJson.deletedAttachmentCount).toBe(2);

      // Assert: Attachments and rule checks are permanently deleted
      expect(
        db.select().from(attachments).where(eq(attachments.ownerId, tradeKey)).all(),
      ).toHaveLength(0);
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeKey, tradeKey)).all(),
      ).toHaveLength(0);

      // Note is unlinked on hard purge
      const unlinkedNote = db.select().from(notes).where(eq(notes.id, "note-1")).get();
      expect(unlinkedNote?.tradeKey).toBeNull();
    });

    it("supports JSON body { purgeAttachments: true } in DELETE /api/trades/[key]", async () => {
      const accountId = "acc-json-purge";
      db.insert(accounts)
        .values({
          id: accountId,
          name: "JSON Purge Account",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
        })
        .run();

      db.insert(executions)
        .values([
          {
            id: "exec-jp-1",
            accountId,
            symbol: "NVDA",
            side: "buy",
            quantity: 10,
            price: 100,
            fee: 1,
            executedAt: "2026-01-01T10:00:00Z",
            source: "manual",
            contentHash: "h-jp-1",
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "exec-jp-2",
            accountId,
            symbol: "NVDA",
            side: "sell",
            quantity: 10,
            price: 110,
            fee: 1,
            executedAt: "2026-01-01T10:05:00Z",
            source: "manual",
            contentHash: "h-jp-2",
            createdAt: "2026-01-01T10:05:00Z",
          },
        ])
        .run();

      rebuildAccount(accountId);
      const tradeList = db.select().from(trades).where(eq(trades.accountId, accountId)).all();
      expect(tradeList).toHaveLength(1);
      const tradeKey = tradeList[0]!.key;

      db.insert(attachments)
        .values({
          id: "att-jp-1",
          ownerType: "trade",
          ownerId: tradeKey,
          name: "chart.png",
          mime: "image/png",
          size: 512,
          data: Buffer.from("png"),
          createdAt: "2026-01-01T10:00:00Z",
        })
        .run();

      const request = new Request(`http://localhost/api/trades/${encodeURIComponent(tradeKey)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purgeAttachments: true }),
      });
      const response = await deleteTradeRoute(request, {
        params: Promise.resolve({ key: tradeKey }),
      });
      expect(response.status).toBe(200);
      const json = (await response.json()) as { deleted: boolean; deletedAttachmentCount: number };
      expect(json.deleted).toBe(true);
      expect(json.deletedAttachmentCount).toBe(1);

      expect(
        db.select().from(attachments).where(eq(attachments.ownerId, tradeKey)).all(),
      ).toHaveLength(0);
    });

    it("allows nuclear purge on a trade that was reset and only has rule checks or unlinked notes remaining without throwing 404", async () => {
      const phantomTradeKey = "acc-reset|SPY|long|1704100000000";

      // Trade has NO row in trades table and NO attachments, but has preserved rule check and note
      db.insert(tradeRuleChecks)
        .values({
          id: "rule-phantom-1",
          tradeKey: phantomTradeKey,
          playbookId: "pb-phantom",
          rule: "Waited for retest",
          followed: true,
        })
        .run();

      db.insert(notes)
        .values({
          id: "note-phantom-1",
          folderId: "folder-default",
          title: "Phantom Note",
          content: "Residual review note",
          tradeKey: phantomTradeKey,
          createdAt: "2026-01-01T10:00:00Z",
          updatedAt: "2026-01-01T10:00:00Z",
        })
        .run();

      const request = new Request(
        `http://localhost/api/trades/${encodeURIComponent(phantomTradeKey)}?purgeAttachments=true`,
        { method: "DELETE" },
      );
      const response = await deleteTradeRoute(request, {
        params: Promise.resolve({ key: phantomTradeKey }),
      });
      expect(response.status).toBe(200);
      const json = (await response.json()) as {
        deleted: boolean;
        deletedTradeCount: number;
        deletedRuleCheckCount: number;
        unlinkedNoteCount: number;
      };
      expect(json.deleted).toBe(true);
      expect(json.deletedTradeCount).toBe(0);
      expect(json.deletedRuleCheckCount).toBe(1);
      expect(json.unlinkedNoteCount).toBe(1);

      // Rule check deleted, note unlinked
      expect(
        db
          .select()
          .from(tradeRuleChecks)
          .where(eq(tradeRuleChecks.tradeKey, phantomTradeKey))
          .all(),
      ).toHaveLength(0);
      const noteRow = db.select().from(notes).where(eq(notes.id, "note-phantom-1")).get();
      expect(noteRow?.tradeKey).toBeNull();
    });

    it("returns 404 when trade does not exist", async () => {
      const request = new Request("http://localhost/api/trades/non-existent-trade", {
        method: "DELETE",
      });
      const response = await deleteTradeRoute(request, {
        params: Promise.resolve({ key: "non-existent-trade" }),
      });
      expect(response.status).toBe(404);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe("Trade not found.");
    });
  });

  describe("2. DELETE /api/accounts/[id] - Cascade Trade Attachments & Orphan Prevention", () => {
    it("cleans up all attachments belonging to trades of the deleted account without leaving orphans", async () => {
      const accountId = "acc-to-delete";
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Account to Purge",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
        })
        .run();

      // Create executions for 2 trades
      db.insert(executions)
        .values([
          {
            id: "e-del-1",
            accountId,
            symbol: "NQ",
            side: "buy",
            quantity: 1,
            price: 20000,
            fee: 2,
            executedAt: "2026-01-02T10:00:00Z",
            source: "manual",
            contentHash: "h-del-1",
            createdAt: "2026-01-02T10:00:00Z",
          },
          {
            id: "e-del-2",
            accountId,
            symbol: "NQ",
            side: "sell",
            quantity: 1,
            price: 20050,
            fee: 2,
            executedAt: "2026-01-02T10:10:00Z",
            source: "manual",
            contentHash: "h-del-2",
            createdAt: "2026-01-02T10:10:00Z",
          },
          {
            id: "e-del-3",
            accountId,
            symbol: "ES",
            side: "buy",
            quantity: 1,
            price: 5500,
            fee: 2,
            executedAt: "2026-01-02T11:00:00Z",
            source: "manual",
            contentHash: "h-del-3",
            createdAt: "2026-01-02T11:00:00Z",
          },
          {
            id: "e-del-4",
            accountId,
            symbol: "ES",
            side: "sell",
            quantity: 1,
            price: 5520,
            fee: 2,
            executedAt: "2026-01-02T11:20:00Z",
            source: "manual",
            contentHash: "h-del-4",
            createdAt: "2026-01-02T11:20:00Z",
          },
        ])
        .run();

      rebuildAccount(accountId);
      const accountTrades = db.select().from(trades).where(eq(trades.accountId, accountId)).all();
      expect(accountTrades).toHaveLength(2);

      const [trade1, trade2] = accountTrades;

      // Add attachments to both trades
      db.insert(attachments)
        .values([
          {
            id: "att-trade1-1",
            ownerType: "trade",
            ownerId: trade1!.key,
            name: "t1.png",
            mime: "image/png",
            size: 500,
            data: Buffer.from("t1"),
            createdAt: "2026-01-02T10:00:00Z",
          },
          {
            id: "att-trade1-2",
            ownerType: "trade",
            ownerId: trade1!.key,
            name: "t1_2.png",
            mime: "image/png",
            size: 500,
            data: Buffer.from("t1_2"),
            createdAt: "2026-01-02T10:05:00Z",
          },
          {
            id: "att-trade2-1",
            ownerType: "trade",
            ownerId: trade2!.key,
            name: "t2.png",
            mime: "image/png",
            size: 500,
            data: Buffer.from("t2"),
            createdAt: "2026-01-02T11:00:00Z",
          },
          // Independent journal day attachment that must survive
          {
            id: "att-day-preserve",
            ownerType: "day",
            ownerId: "2026-01-02",
            name: "daily_prep.png",
            mime: "image/png",
            size: 800,
            data: Buffer.from("prep"),
            createdAt: "2026-01-02T08:00:00Z",
          },
        ])
        .run();

      // Add trade rule checks & note
      db.insert(tradeRuleChecks)
        .values({
          id: "chk-del-1",
          tradeKey: trade1!.key,
          playbookId: "pb-1",
          rule: "Rule 1",
          followed: true,
        })
        .run();

      db.insert(notes)
        .values({
          id: "note-del-1",
          folderId: "folder-default",
          title: "Account Note",
          content: "Review of trade 1",
          tradeKey: trade1!.key,
          createdAt: "2026-01-02T12:00:00Z",
          updatedAt: "2026-01-02T12:00:00Z",
        })
        .run();

      // Act: Delete account
      const delReq = new Request(`http://localhost/api/accounts/${accountId}`, {
        method: "DELETE",
      });
      const delRes = await deleteAccountRoute(delReq, {
        params: Promise.resolve({ id: accountId }),
      });
      expect(delRes.status).toBe(200);

      // Assert:
      // Account, trades, executions deleted
      expect(db.select().from(accounts).where(eq(accounts.id, accountId)).get()).toBeUndefined();
      expect(db.select().from(trades).where(eq(trades.accountId, accountId)).all()).toHaveLength(0);
      expect(
        db.select().from(executions).where(eq(executions.accountId, accountId)).all(),
      ).toHaveLength(0);

      // Trade attachments deleted, day attachment preserved
      const remainingTradeAttachments = db
        .select()
        .from(attachments)
        .where(eq(attachments.ownerType, "trade"))
        .all();
      expect(remainingTradeAttachments).toHaveLength(0);

      const preservedDayAttachment = db
        .select()
        .from(attachments)
        .where(eq(attachments.id, "att-day-preserve"))
        .get();
      expect(preservedDayAttachment).toBeDefined();

      // Rule checks deleted
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeKey, trade1!.key)).all(),
      ).toHaveLength(0);

      // Note preserved with null tradeKey
      const preservedNote = db.select().from(notes).where(eq(notes.id, "note-del-1")).get();
      expect(preservedNote).toBeDefined();
      expect(preservedNote?.tradeKey).toBeNull();
    });

    it("cleans up preserved trade attachments and rule checks matching account prefix even when trade rows were already reset", async () => {
      const accountId = "acc-prefix-clean";
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Prefix Clean Account",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
        })
        .run();

      // Notice: NO trades or executions exist for this account in the database (they were reset).
      // But preserved attachments and rule checks exist referencing this account's trade key pattern:
      const resetTradeKey = `${accountId}|ES|long|1704100000000`;
      db.insert(attachments)
        .values({
          id: "att-orphan-prevent",
          ownerType: "trade",
          ownerId: resetTradeKey,
          name: "preserved_chart.png",
          mime: "image/png",
          size: 1024,
          data: Buffer.from("chart"),
          createdAt: "2026-01-01T10:00:00Z",
        })
        .run();

      db.insert(tradeRuleChecks)
        .values({
          id: "rule-orphan-prevent",
          tradeKey: resetTradeKey,
          playbookId: "pb-1",
          rule: "Rule 1",
          followed: true,
        })
        .run();

      db.insert(notes)
        .values({
          id: "note-orphan-prevent",
          folderId: "folder-default",
          title: "Preserved Note",
          content: "Residual review note",
          tradeKey: resetTradeKey,
          createdAt: "2026-01-01T10:00:00Z",
          updatedAt: "2026-01-01T10:00:00Z",
        })
        .run();

      // Act: Delete account
      const delReq = new Request(`http://localhost/api/accounts/${accountId}`, {
        method: "DELETE",
      });
      const delRes = await deleteAccountRoute(delReq, {
        params: Promise.resolve({ id: accountId }),
      });
      expect(delRes.status).toBe(200);

      // Assert:
      // Preserved attachments and rule checks for this account are cleaned up
      expect(
        db.select().from(attachments).where(eq(attachments.ownerId, resetTradeKey)).all(),
      ).toHaveLength(0);
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.tradeKey, resetTradeKey)).all(),
      ).toHaveLength(0);
      const noteRow = db.select().from(notes).where(eq(notes.id, "note-orphan-prevent")).get();
      expect(noteRow?.tradeKey).toBeNull();
    });

    it("does NOT wipe sibling account data when deleting an account whose ID contains an underscore (no SQLite LIKE wildcard injection)", async () => {
      // Setup: Target account with underscore, and sibling accounts that would match unescaped LIKE 'acc_1|%'
      const targetAccountId = "acc_1";
      const siblingAccountDash = "acc-1";
      const siblingAccountAlpha = "acc21";

      for (const id of [targetAccountId, siblingAccountDash, siblingAccountAlpha]) {
        db.insert(accounts)
          .values({
            id,
            name: `Account ${id}`,
            kind: "manual",
            currency: "USD",
            createdAt: "2026-01-01T00:00:00Z",
          })
          .run();
      }

      // Attachments for each account
      const targetTradeKey = `${targetAccountId}|ES|long|1704100000000`;
      const siblingDashTradeKey = `${siblingAccountDash}|ES|long|1704100000000`;
      const siblingAlphaTradeKey = `${siblingAccountAlpha}|ES|long|1704100000000`;

      db.insert(attachments)
        .values([
          {
            id: "att-target",
            ownerType: "trade",
            ownerId: targetTradeKey,
            name: "target.png",
            mime: "image/png",
            size: 100,
            data: Buffer.from("t"),
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "att-sibling-dash",
            ownerType: "trade",
            ownerId: siblingDashTradeKey,
            name: "dash.png",
            mime: "image/png",
            size: 100,
            data: Buffer.from("d"),
            createdAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "att-sibling-alpha",
            ownerType: "trade",
            ownerId: siblingAlphaTradeKey,
            name: "alpha.png",
            mime: "image/png",
            size: 100,
            data: Buffer.from("a"),
            createdAt: "2026-01-01T10:00:00Z",
          },
        ])
        .run();

      db.insert(tradeRuleChecks)
        .values([
          {
            id: "chk-target",
            tradeKey: targetTradeKey,
            playbookId: "p1",
            rule: "r1",
            followed: true,
          },
          {
            id: "chk-sibling-dash",
            tradeKey: siblingDashTradeKey,
            playbookId: "p1",
            rule: "r1",
            followed: true,
          },
        ])
        .run();

      db.insert(notes)
        .values([
          {
            id: "note-target",
            folderId: "folder-default",
            title: "Target Note",
            content: "Target",
            tradeKey: targetTradeKey,
            createdAt: "2026-01-01T10:00:00Z",
            updatedAt: "2026-01-01T10:00:00Z",
          },
          {
            id: "note-sibling-dash",
            folderId: "folder-default",
            title: "Sibling Dash Note",
            content: "Sibling Dash",
            tradeKey: siblingDashTradeKey,
            createdAt: "2026-01-01T10:00:00Z",
            updatedAt: "2026-01-01T10:00:00Z",
          },
        ])
        .run();

      // Act: Delete ONLY the target account with underscore
      const delReq = new Request(`http://localhost/api/accounts/${targetAccountId}`, {
        method: "DELETE",
      });
      const delRes = await deleteAccountRoute(delReq, {
        params: Promise.resolve({ id: targetAccountId }),
      });
      expect(delRes.status).toBe(200);

      // Assert: Target account data is deleted
      expect(
        db.select().from(accounts).where(eq(accounts.id, targetAccountId)).get(),
      ).toBeUndefined();
      expect(
        db.select().from(attachments).where(eq(attachments.id, "att-target")).get(),
      ).toBeUndefined();
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.id, "chk-target")).get(),
      ).toBeUndefined();
      expect(db.select().from(notes).where(eq(notes.id, "note-target")).get()?.tradeKey).toBeNull();

      // SIBLINGS MUST REMAIN 100% INTACT:
      // Sibling dash
      expect(
        db.select().from(accounts).where(eq(accounts.id, siblingAccountDash)).get(),
      ).toBeDefined();
      expect(
        db.select().from(attachments).where(eq(attachments.id, "att-sibling-dash")).get(),
      ).toBeDefined();
      expect(
        db.select().from(tradeRuleChecks).where(eq(tradeRuleChecks.id, "chk-sibling-dash")).get(),
      ).toBeDefined();
      expect(db.select().from(notes).where(eq(notes.id, "note-sibling-dash")).get()?.tradeKey).toBe(
        siblingDashTradeKey,
      );

      // Sibling alpha
      expect(
        db.select().from(accounts).where(eq(accounts.id, siblingAccountAlpha)).get(),
      ).toBeDefined();
      expect(
        db.select().from(attachments).where(eq(attachments.id, "att-sibling-alpha")).get(),
      ).toBeDefined();
    });
  });

  describe("3. Bulk Trade Deletion (`POST /api/trades/bulk` with `action: 'delete'`)", () => {
    it("deletes multiple trades and their cascading attachments atomically", async () => {
      const accountId = "acc-bulk";
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Bulk Account",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
        })
        .run();

      db.insert(executions)
        .values([
          {
            id: "b-e1",
            accountId,
            symbol: "TSLA",
            side: "buy",
            quantity: 5,
            price: 250,
            fee: 1,
            executedAt: "2026-01-03T10:00:00Z",
            source: "manual",
            contentHash: "b-h1",
            createdAt: "2026-01-03T10:00:00Z",
          },
          {
            id: "b-e2",
            accountId,
            symbol: "TSLA",
            side: "sell",
            quantity: 5,
            price: 255,
            fee: 1,
            executedAt: "2026-01-03T10:10:00Z",
            source: "manual",
            contentHash: "b-h2",
            createdAt: "2026-01-03T10:10:00Z",
          },
          {
            id: "b-e3",
            accountId,
            symbol: "MSFT",
            side: "buy",
            quantity: 5,
            price: 400,
            fee: 1,
            executedAt: "2026-01-03T11:00:00Z",
            source: "manual",
            contentHash: "b-h3",
            createdAt: "2026-01-03T11:00:00Z",
          },
          {
            id: "b-e4",
            accountId,
            symbol: "MSFT",
            side: "sell",
            quantity: 5,
            price: 405,
            fee: 1,
            executedAt: "2026-01-03T11:10:00Z",
            source: "manual",
            contentHash: "b-h4",
            createdAt: "2026-01-03T11:10:00Z",
          },
        ])
        .run();

      rebuildAccount(accountId);
      const bulkTrades = db.select().from(trades).where(eq(trades.accountId, accountId)).all();
      expect(bulkTrades).toHaveLength(2);

      const keys = bulkTrades.map((t) => t.key);

      // Attachments for each trade
      db.insert(attachments)
        .values([
          {
            id: "att-b1",
            ownerType: "trade",
            ownerId: keys[0]!,
            name: "b1.png",
            mime: "image/png",
            size: 300,
            data: Buffer.from("b1"),
            createdAt: "2026-01-03T10:00:00Z",
          },
          {
            id: "att-b2",
            ownerType: "trade",
            ownerId: keys[1]!,
            name: "b2.png",
            mime: "image/png",
            size: 300,
            data: Buffer.from("b2"),
            createdAt: "2026-01-03T11:00:00Z",
          },
        ])
        .run();

      // Test 1: Safe reset by default (purgeAttachments: false)
      const safeBulkReq = new Request("http://localhost/api/trades/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", keys, purgeAttachments: false }),
      });
      const safeBulkRes = await bulkTradeRoute(safeBulkReq);
      expect(safeBulkRes.status).toBe(200);
      const safeBulkJson = (await safeBulkRes.json()) as {
        deleted: number;
        deletedAttachmentCount: number;
        preservedAttachmentCount: number;
      };
      expect(safeBulkJson.deleted).toBe(2);
      expect(safeBulkJson.deletedAttachmentCount).toBe(0);
      expect(safeBulkJson.preservedAttachmentCount).toBe(2);

      // Verify trades and executions deleted, but attachments preserved for re-import
      expect(db.select().from(trades).where(eq(trades.accountId, accountId)).all()).toHaveLength(0);
      expect(
        db.select().from(executions).where(eq(executions.accountId, accountId)).all(),
      ).toHaveLength(0);
      expect(
        db.select().from(attachments).where(eq(attachments.ownerType, "trade")).all(),
      ).toHaveLength(2);

      // Test 2: Nuclear Hard Purge (purgeAttachments: true)
      const purgeBulkReq = new Request("http://localhost/api/trades/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", keys, purgeAttachments: true }),
      });
      const purgeBulkRes = await bulkTradeRoute(purgeBulkReq);
      expect(purgeBulkRes.status).toBe(200);
      const purgeBulkJson = (await purgeBulkRes.json()) as {
        deleted: number;
        deletedAttachmentCount: number;
      };
      expect(purgeBulkJson.deletedAttachmentCount).toBe(2);

      // Verify attachments are now completely deleted
      expect(
        db.select().from(attachments).where(eq(attachments.ownerType, "trade")).all(),
      ).toHaveLength(0);
    });
  });

  describe("4. Dual-Tier Preferences Persistence (GET/PATCH /api/settings & Bridge)", () => {
    it("persists and returns velaDrawingFavorites and velaDrawingPrefs via /api/settings", async () => {
      // 1. Initial GET returns defaults
      const getRes1 = await getSettingsRoute();
      expect(getRes1.status).toBe(200);
      const initialSettings = (await getRes1.json()) as {
        velaDrawingFavorites: string[];
        velaDrawingPrefs: Record<string, unknown>;
      };
      expect(initialSettings.velaDrawingFavorites).toEqual([]);
      expect(initialSettings.velaDrawingPrefs).toEqual({});

      // 2. PATCH settings with new favorites and preferences
      const patchReq = new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          velaDrawingFavorites: ["Trend Line", "Horizontal Ray", "Fib Retracement"],
          velaDrawingPrefs: { snapMode: "weak", stayMode: true },
        }),
      });
      const patchRes = await patchSettingsRoute(patchReq);
      expect(patchRes.status).toBe(200);

      // 3. Second GET confirms persistence in SQLite
      const getRes2 = await getSettingsRoute();
      expect(getRes2.status).toBe(200);
      const updatedSettings = (await getRes2.json()) as {
        velaDrawingFavorites: string[];
        velaDrawingPrefs: Record<string, unknown>;
      };
      expect(updatedSettings.velaDrawingFavorites).toEqual([
        "Trend Line",
        "Horizontal Ray",
        "Fib Retracement",
      ]);
      expect(updatedSettings.velaDrawingPrefs).toEqual({ snapMode: "weak", stayMode: true });
    });

    it("rejects invalid vela preferences payloads", async () => {
      // Invalid favorites (not array)
      const badFavsReq = new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ velaDrawingFavorites: "invalid" }),
      });
      const badFavsRes = await patchSettingsRoute(badFavsReq);
      expect(badFavsRes.status).toBe(400);

      // Invalid prefs (not object)
      const badPrefsReq = new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ velaDrawingPrefs: "invalid" }),
      });
      const badPrefsRes = await patchSettingsRoute(badPrefsReq);
      expect(badPrefsRes.status).toBe(400);
    });

    it("bridges localStorage and debounced sync for favorites and tool preferences", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ saved: true })));

      // Test saveDrawingFavorites
      saveDrawingFavorites(["Brush", "Arrow"], { fetchImpl: mockFetch as any, debounceMs: 300 });

      // Synchronous localStorage check
      expect(loadDrawingFavorites()).toEqual(["Brush", "Arrow"]);
      // Fetch not called immediately
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance debounce timer
      vi.advanceTimersByTime(300);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ velaDrawingFavorites: ["Brush", "Arrow"] }),
      });

      // Test saveDrawingToolPrefs
      mockFetch.mockClear();
      saveDrawingToolPrefs(
        { snapMode: "strong" },
        { fetchImpl: mockFetch as any, debounceMs: 300 },
      );

      // Synchronous localStorage check
      expect(loadDrawingToolPrefs().snapMode).toBe("strong");
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance debounce timer
      vi.advanceTimersByTime(300);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ velaDrawingPrefs: { snapMode: "strong" } }),
      });

      vi.useRealTimers();
    });
  });
});

afterAll(() => {
  try {
    (db as any)?.$client?.close?.();
  } catch {}
  vi.unstubAllEnvs();
  try {
    rmSync(scratch, { recursive: true, force: true });
  } catch {}
});
