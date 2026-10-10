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
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("cache_size = -64000"); // 64MB RAM page cache
  sqlite.pragma("temp_store = MEMORY");
  sqlite.pragma("mmap_size = 268435456"); // 256MB memory-mapped IO
  sqlite.exec(BOOTSTRAP_SQL);
  // Additive upgrade: high-throughput indexes on executions and trades.
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS executions_account_executed ON executions (account_id, executed_at)",
  );
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS trades_account_symbol_opened ON trades (account_id, symbol, opened_at)",
  );
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
    if (!csvColumns.some((column) => column.name === "compatible_symbols_json")) {
      sqlite.exec("ALTER TABLE market_csv_datasets ADD COLUMN compatible_symbols_json TEXT");
    }
    sqlite.exec(`UPDATE market_csv_datasets SET
      bar_count = json_array_length(bars_json),
      first_time = json_extract(bars_json, '$[0].time'),
      last_time = json_extract(bars_json, '$[#-1].time') WHERE bar_count = 0`);
  })();

  // Additive upgrade: ensure time-series candle tables exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS market_candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      resolution TEXT NOT NULL,
      time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      price_basis TEXT NOT NULL DEFAULT 'raw',
      batch_id TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS market_candles_unique_bar ON market_candles(symbol, resolution, time);
    DROP INDEX IF EXISTS market_candles_lookup;
    CREATE INDEX IF NOT EXISTS market_candles_batch ON market_candles(batch_id);

    CREATE TABLE IF NOT EXISTS market_series_summary (
      symbol TEXT NOT NULL,
      resolution TEXT NOT NULL,
      bar_count INTEGER NOT NULL DEFAULT 0,
      first_time INTEGER NOT NULL,
      last_time INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      price_basis TEXT NOT NULL DEFAULT 'raw',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (symbol, resolution)
    );
    CREATE INDEX IF NOT EXISTS market_series_summary_resolution ON market_series_summary(resolution, symbol);

    CREATE TABLE IF NOT EXISTS market_candle_batches (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      resolution TEXT NOT NULL,
      name TEXT NOT NULL,
      bar_count INTEGER NOT NULL,
      new_bar_count INTEGER NOT NULL,
      duplicate_bar_count INTEGER NOT NULL,
      first_time INTEGER NOT NULL,
      last_time INTEGER NOT NULL,
      imported_at TEXT NOT NULL
    );
  `);

  // Migrate legacy market_csv_datasets if market_candles is empty
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  if (tables.some((t) => t.name === "market_csv_datasets")) {
    const candleCountRow = sqlite.prepare("SELECT COUNT(*) as count FROM market_candles").get() as { count: number };
    if (candleCountRow.count === 0) {
      const legacyRows = sqlite.prepare("SELECT * FROM market_csv_datasets").all() as Array<{
        id: string;
        name: string;
        symbol: string;
        resolution: string;
        currency: string;
        price_basis: string;
        bars_json: string;
        imported_at: string;
      }>;
      if (legacyRows.length > 0) {
        sqlite.transaction(() => {
          const insertCandle = sqlite.prepare(`
            INSERT INTO market_candles (symbol, resolution, time, open, high, low, close, volume, currency, price_basis, batch_id)
            VALUES (@symbol, @resolution, @time, @open, @high, @low, @close, @volume, @currency, @priceBasis, @batchId)
            ON CONFLICT(symbol, resolution, time) DO NOTHING
          `);
          const insertBatch = sqlite.prepare(`
            INSERT INTO market_candle_batches (id, symbol, resolution, name, bar_count, new_bar_count, duplicate_bar_count, first_time, last_time, imported_at)
            VALUES (@id, @symbol, @resolution, @name, @barCount, @newBarCount, @duplicateBarCount, @firstTime, @lastTime, @importedAt)
          `);
          const upsertSummary = sqlite.prepare(`
            INSERT INTO market_series_summary (symbol, resolution, bar_count, first_time, last_time, currency, price_basis, updated_at)
            VALUES (@symbol, @resolution, @barCount, @firstTime, @lastTime, @currency, @priceBasis, @updatedAt)
            ON CONFLICT(symbol, resolution) DO UPDATE SET
              bar_count = excluded.bar_count,
              first_time = excluded.first_time,
              last_time = excluded.last_time,
              currency = excluded.currency,
              price_basis = excluded.price_basis,
              updated_at = excluded.updated_at
          `);

          for (const row of legacyRows) {
            let bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }> = [];
            try {
              bars = JSON.parse(row.bars_json);
            } catch {
              continue;
            }
            if (!bars.length) continue;

            let inserted = 0;
            for (const b of bars) {
              const res = insertCandle.run({
                symbol: row.symbol,
                resolution: row.resolution,
                time: b.time,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: b.volume ?? null,
                currency: row.currency || "USD",
                priceBasis: row.price_basis || "raw",
                batchId: row.id,
              });
              if (res.changes > 0) inserted++;
            }

            insertBatch.run({
              id: row.id,
              symbol: row.symbol,
              resolution: row.resolution,
              name: row.name,
              barCount: bars.length,
              newBarCount: inserted,
              duplicateBarCount: bars.length - inserted,
              firstTime: bars[0]!.time,
              lastTime: bars.at(-1)!.time,
              importedAt: row.imported_at,
            });

            const stats = sqlite.prepare(`
              SELECT COUNT(*) as barCount, MIN(time) as firstTime, MAX(time) as lastTime
              FROM market_candles WHERE symbol = ? AND resolution = ?
            `).get(row.symbol, row.resolution) as { barCount: number; firstTime: number; lastTime: number };

            if (stats && stats.barCount > 0) {
              upsertSummary.run({
                symbol: row.symbol,
                resolution: row.resolution,
                barCount: stats.barCount,
                firstTime: stats.firstTime,
                lastTime: stats.lastTime,
                currency: row.currency || "USD",
                priceBasis: row.price_basis || "raw",
                updatedAt: new Date().toISOString(),
              });
            }
          }
        })();
      }
    }
  }

  // Additive upgrade: trades table gains drawings_json column for per-trade plotted drawings.
  const tradeColumns = sqlite.pragma("table_info(trades)") as { name: string }[];
  if (!tradeColumns.some((column) => column.name === "drawings_json")) {
    sqlite.exec("ALTER TABLE trades ADD COLUMN drawings_json TEXT");
  }

  return drizzle(sqlite, { schema });
};

/** Singleton across Next dev hot reloads. */
export const db = globalForDb.__journalDb ?? (globalForDb.__journalDb = createDb());

export const ensureTradesDrawingsColumn = (targetDb: any = db): void => {
  try {
    const sqlite = (targetDb as any)?.session?.client ?? (targetDb as any)?.$client;
    if (sqlite && typeof sqlite.pragma === "function") {
      const tradeColumns = sqlite.pragma("table_info(trades)") as { name: string }[];
      if (!tradeColumns.some((column) => column.name === "drawings_json")) {
        sqlite.exec("ALTER TABLE trades ADD COLUMN drawings_json TEXT");
      }
      return;
    }
  } catch {}
  try {
    const dir = dataDir();
    if (existsSync(join(dir, "journal.db"))) {
      const sqlite = new Database(join(dir, "journal.db"));
      try {
        const tradeColumns = sqlite.pragma("table_info(trades)") as { name: string }[];
        if (!tradeColumns.some((column) => column.name === "drawings_json")) {
          sqlite.exec("ALTER TABLE trades ADD COLUMN drawings_json TEXT");
        }
      } finally {
        sqlite.close();
      }
    }
  } catch {}
};

ensureTradesDrawingsColumn(db);

export * from "./schema";
