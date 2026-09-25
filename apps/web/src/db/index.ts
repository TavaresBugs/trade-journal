import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";
import { BOOTSTRAP_SQL } from "./bootstrap";

export const dataDir = (): string => {
  if (process.env.JOURNAL_DATA_DIR) return process.env.JOURNAL_DATA_DIR;
  const webData = join(process.cwd(), "apps/web/data");
  if (existsSync(join(webData, "journal.db"))) return webData;
  return join(process.cwd(), "data");
};


const globalForDb = globalThis as unknown as { __journalDb?: ReturnType<typeof createDb> };

const createDb = () => {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const sqlite = new Database(join(dir, "journal.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(BOOTSTRAP_SQL);
  // Additive upgrade: accounts table gains time_zone and platform columns.
  const accountColumns = sqlite.pragma("table_info(accounts)") as { name: string }[];
  if (!accountColumns.some((column) => column.name === "time_zone")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC'");
  }
  if (!accountColumns.some((column) => column.name === "platform")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN platform TEXT");
  }
  if (!accountColumns.some((column) => column.name === "account_number")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN account_number TEXT");
  }
  if (!accountColumns.some((column) => column.name === "max_drawdown")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN max_drawdown REAL");
  }
  // Additive upgrade: existing executions retain their fields and dedup hashes.
  const executionColumns = sqlite.pragma("table_info(executions)") as { name: string }[];
  if (!executionColumns.some((column) => column.name === "import_metadata_json")) {
    sqlite.exec("ALTER TABLE executions ADD COLUMN import_metadata_json TEXT");
  }
  // Additive upgrade: attachments table gains optional slot column for structured screenshots.
  const attachmentColumns = sqlite.pragma("table_info(attachments)") as { name: string }[];
  if (!attachmentColumns.some((column) => column.name === "slot")) {
    sqlite.exec("ALTER TABLE attachments ADD COLUMN slot TEXT");
  }
  // Additive upgrade: journal_days table gains review metadata columns.
  const journalDayColumns = sqlite.pragma("table_info(journal_days)") as { name: string }[];
  if (!journalDayColumns.some((column) => column.name === "symbol")) {
    sqlite.exec("ALTER TABLE journal_days ADD COLUMN symbol TEXT");
  }
  if (!journalDayColumns.some((column) => column.name === "rating")) {
    sqlite.exec("ALTER TABLE journal_days ADD COLUMN rating INTEGER");
  }
  if (!journalDayColumns.some((column) => column.name === "reviewed_at")) {
    sqlite.exec("ALTER TABLE journal_days ADD COLUMN reviewed_at TEXT");
  }
  if (!journalDayColumns.some((column) => column.name === "tags_json")) {
    sqlite.exec("ALTER TABLE journal_days ADD COLUMN tags_json TEXT");
  }
  if (!journalDayColumns.some((column) => column.name === "mistakes_json")) {
    sqlite.exec("ALTER TABLE journal_days ADD COLUMN mistakes_json TEXT");
  }
  // Materialize CSV bounds once so connection and range lookups never scan candle JSON.
  const csvColumns = sqlite.pragma("table_info(market_csv_datasets)") as { name: string }[];
  sqlite.transaction(() => {
    for (const name of ["bar_count", "first_time", "last_time"]) {
      if (!csvColumns.some((column) => column.name === name))
        sqlite.exec(
          `ALTER TABLE market_csv_datasets ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`,
        );
    }
    sqlite.exec(`UPDATE market_csv_datasets SET
      bar_count = json_array_length(bars_json),
      first_time = json_extract(bars_json, '$[0].time'),
      last_time = json_extract(bars_json, '$[#-1].time') WHERE bar_count = 0`);
  })();
  return drizzle(sqlite, { schema });
};

/** Singleton across Next dev hot reloads. */
export const db = globalForDb.__journalDb ?? (globalForDb.__journalDb = createDb());

export * from "./schema";
