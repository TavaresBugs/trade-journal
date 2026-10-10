import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

// 1. Isolate test database in temporary directory
const scratch = mkdtempSync(join(tmpdir(), "journal-trade-deletion-cleanup-"));
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
  journalDays,
  marketCandles,
  settings,
  folders,
} = await import("../src/db");
const { rebuildAccount } = await import("../src/server/rebuild");
const { deleteTradeWithCleanup, deleteTradesWithCleanup } = await import("../src/server/trades");
const { DELETE: deleteTradeRoute } = await import("../src/app/api/trades/[key]/route");
const { POST: bulkTradeRoute } = await import("../src/app/api/trades/bulk/route");
const { DELETE: deleteAccountRoute } = await import("../src/app/api/accounts/[id]/route");
const { GET: getSettingsRoute, PATCH: patchSettingsRoute } = await import(
  "../src/app/api/settings/route"
);
const {
  saveDrawingFavorites,
  saveDrawingToolPrefs,
  loadDrawingFavorites,
  loadDrawingToolPrefs,
  flushPendingPreferencesSave,
  VELA_DRAWING_FAVORITES_KEY,
  VELA_DRAWING_PREFS_KEY,
} = await import("../src/components/vela-drawings-bridge");

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

  afterAll(() => {
    try {
      (db as any)?.$client?.close?.();
    } catch {}
    vi.unstubAllEnvs();
    try {
      rmSync(scratch, { recursive: true, force: true });
    } catch {}
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

      // Act: Delete trade via DELETE /api/trades/[key]
      const request = new Request(`http://localhost/api/trades/${encodeURIComponent(tradeKey)}`, {
        method: "DELETE",
      });
      const response = await deleteTradeRoute(request, { params: Promise.resolve({ key: tradeKey }) });
      expect(response.status).toBe(200);
      const json = (await response.json()) as { deleted: boolean; deletedTradeCount: number; deletedAttachmentCount: number };
      expect(json.deleted).toBe(true);
      expect(json.deletedTradeCount).toBe(1);
      expect(json.deletedAttachmentCount).toBe(2);

      // Assert:
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

      // 3. Attachments are deleted from attachments table
      const remainingAttachments = db
        .select()
        .from(attachments)
        .where(eq(attachments.ownerId, tradeKey))
        .all();
      expect(remainingAttachments).toHaveLength(0);

      // 4. Rule checks are deleted from trade_rule_checks
      const remainingRuleChecks = db
        .select()
        .from(tradeRuleChecks)
        .where(eq(tradeRuleChecks.tradeKey, tradeKey))
        .all();
      expect(remainingRuleChecks).toHaveLength(0);

      // 5. Note still exists but note.tradeKey is null
      const noteRow = db.select().from(notes).where(eq(notes.id, "note-1")).get();
      expect(noteRow).toBeDefined();
      expect(noteRow?.tradeKey).toBeNull();
      expect(noteRow?.content).toBe("Solid execution at support.");

      // 6. Journal day session record STILL EXISTS (thesis is preserved)
      const sessionDay = db.select().from(journalDays).where(eq(journalDays.date, sessionDate)).get();
      expect(sessionDay).toBeDefined();
      expect(sessionDay?.note).toBe(
        "Market opened gap-up, thesis is to trade pullbacks into 150 key support.",
      );

      // 7. Market candles STILL EXIST
      const candles = db.select().from(marketCandles).where(eq(marketCandles.symbol, "AAPL")).all();
      expect(candles).toHaveLength(1);
      expect(candles[0]?.close).toBe(155);
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
      const delReq = new Request(`http://localhost/api/accounts/${accountId}`, { method: "DELETE" });
      const delRes = await deleteAccountRoute(delReq, { params: Promise.resolve({ id: accountId }) });
      expect(delRes.status).toBe(200);

      // Assert:
      // Account, trades, executions deleted
      expect(db.select().from(accounts).where(eq(accounts.id, accountId)).get()).toBeUndefined();
      expect(db.select().from(trades).where(eq(trades.accountId, accountId)).all()).toHaveLength(0);
      expect(db.select().from(executions).where(eq(executions.accountId, accountId)).all()).toHaveLength(0);

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

      const bulkReq = new Request("http://localhost/api/trades/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", keys }),
      });
      const bulkRes = await bulkTradeRoute(bulkReq);
      expect(bulkRes.status).toBe(200);
      const bulkJson = (await bulkRes.json()) as { deleted: number; deletedAttachmentCount: number };
      expect(bulkJson.deleted).toBe(2);
      expect(bulkJson.deletedAttachmentCount).toBe(2);

      // Verify trades and attachments deleted
      expect(db.select().from(trades).where(eq(trades.accountId, accountId)).all()).toHaveLength(0);
      expect(db.select().from(executions).where(eq(executions.accountId, accountId)).all()).toHaveLength(0);
      expect(db.select().from(attachments).where(eq(attachments.ownerType, "trade")).all()).toHaveLength(0);
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
      saveDrawingToolPrefs({ snapMode: "strong" }, { fetchImpl: mockFetch as any, debounceMs: 300 });

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
