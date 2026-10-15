import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

export interface TestDbHarness {
  scratchDir: string;
  db: typeof import("../../src/db").db;
  cleanTables: () => void;
  teardown: () => void;
}

/**
 * Creates an isolated SQLite database harness in a temporary directory.
 * Resets globalThis.__journalDb, mocks next/headers cookies, and provides cleanTables/teardown.
 */
export async function createTestDbHarness(prefix = "journal-test-"): Promise<TestDbHarness> {
  const originalDir = process.env.JOURNAL_DATA_DIR;
  const scratch = mkdtempSync(join(tmpdir(), prefix));
  process.env.JOURNAL_DATA_DIR = scratch;
  process.env.JOURNAL_PASSWORD = "";

  // Reset cached database instance in globalThis
  const globalForDb = globalThis as unknown as { __journalDb?: unknown };
  delete globalForDb.__journalDb;

  vi.mock("next/headers", () => ({
    cookies: async () => ({
      get: () => undefined,
      set: () => undefined,
      delete: () => undefined,
    }),
  }));

  const dbModule = await import("../../src/db");
  const { db } = dbModule;

  const cleanTables = () => {
    try {
      db.$client.pragma("foreign_keys = OFF");
      const tables = [
        "trade_rule_checks",
        "attachments",
        "notes",
        "trades",
        "executions",
        "journal_days",
        "market_candles",
        "settings",
        "folders",
        "accounts",
        "import_sources",
      ];
      for (const table of tables) {
        db.$client.exec(`DELETE FROM ${table};`);
      }
    } finally {
      db.$client.pragma("foreign_keys = ON");
    }
  };

  const teardown = () => {
    try {
      db.$client.close();
    } catch {}
    delete globalForDb.__journalDb;
    if (originalDir === undefined) {
      delete process.env.JOURNAL_DATA_DIR;
    } else {
      process.env.JOURNAL_DATA_DIR = originalDir;
    }
    rmSync(scratch, { recursive: true, force: true });
  };

  return {
    scratchDir: scratch,
    db,
    cleanTables,
    teardown,
  };
}
