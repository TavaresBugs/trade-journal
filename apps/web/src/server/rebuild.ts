import { and, eq, inArray } from "drizzle-orm";
import { buildRoundTrips, type Execution, type ProfitCalcMethod } from "@luxalgo/journal-core";
import { db, executions, trades, accounts } from "@/db";
import { getMultipliers, getJournalDefaults } from "./settings";
import { defaultRisk } from "@/lib/journal-defaults";

const UPSERT_TRADE_SQL = `
  INSERT INTO trades (
    key, account_id, symbol, asset_class, direction, status,
    opened_at, closed_at, quantity, open_quantity, avg_entry, avg_exit,
    gross_pnl, fees, net_pnl, execution_count, execution_ids_json, exits_json, duration_ms,
    stop_loss, profit_target
  ) VALUES (
    @key, @accountId, @symbol, @assetClass, @direction, @status,
    @openedAt, @closedAt, @quantity, @openQuantity, @avgEntry, @avgExit,
    @grossPnl, @fees, @netPnl, @executionCount, @executionIdsJson, @exitsJson, @durationMs,
    @stopLoss, @profitTarget
  )
  ON CONFLICT(key) DO UPDATE SET
    account_id = excluded.account_id,
    symbol = excluded.symbol,
    asset_class = excluded.asset_class,
    direction = excluded.direction,
    status = excluded.status,
    opened_at = excluded.opened_at,
    closed_at = excluded.closed_at,
    quantity = excluded.quantity,
    open_quantity = excluded.open_quantity,
    avg_entry = excluded.avg_entry,
    avg_exit = excluded.avg_exit,
    gross_pnl = excluded.gross_pnl,
    fees = excluded.fees,
    net_pnl = excluded.net_pnl,
    execution_count = excluded.execution_count,
    execution_ids_json = excluded.execution_ids_json,
    exits_json = excluded.exits_json,
    duration_ms = excluded.duration_ms
`;

/**
 * Rebuild the materialized round trips for an account from its executions.
 * Computed columns are overwritten; annotation columns are untouched because
 * rows are upserted by their rebuild-stable key. Trades whose key no longer
 * exists (their executions were deleted) are removed.
 */
export const rebuildAccount = (accountId: string): void => {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) return;

  const rows = db.select().from(executions).where(eq(executions.accountId, accountId)).all();
  const executionInputs: Execution[] = rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    symbol: row.symbol,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    fee: row.fee,
    executedAt: row.executedAt,
    assetClass: (row.assetClass ?? undefined) as Execution["assetClass"],
    source: row.source,
    importMetadata: row.importMetadataJson ? JSON.parse(row.importMetadataJson) : undefined,
  }));

  const trips = buildRoundTrips(executionInputs, {
    method: account.profitCalcMethod as ProfitCalcMethod,
    multipliers: getMultipliers(),
  });
  const obsolete = new Set(
    db
      .select({ key: trades.key })
      .from(trades)
      .where(eq(trades.accountId, accountId))
      .all()
      .map((row) => row.key),
  );
  const defaults = getJournalDefaults();

  const client = (db as any).$client ?? (db as any).session?.client;
  const upsertTrade = client.prepare(UPSERT_TRADE_SQL);

  db.transaction((tx) => {
    for (const trip of trips) {
      obsolete.delete(trip.key);
      const risk = defaultRisk(trip.avgEntry, trip.direction, accountId, trip.symbol, defaults);
      upsertTrade.run({
        key: trip.key,
        accountId: trip.accountId,
        symbol: trip.symbol,
        assetClass: trip.assetClass ?? null,
        direction: trip.direction,
        status: trip.status,
        openedAt: trip.openedAt,
        closedAt: trip.closedAt ?? null,
        quantity: trip.quantity,
        openQuantity: trip.openQuantity,
        avgEntry: trip.avgEntry,
        avgExit: trip.avgExit ?? null,
        grossPnl: trip.grossPnl,
        fees: trip.fees,
        netPnl: trip.netPnl,
        executionCount: trip.executionCount,
        executionIdsJson: JSON.stringify(trip.executionIds),
        exitsJson: JSON.stringify(trip.exits),
        durationMs: trip.durationMs ?? null,
        stopLoss: risk.stopLoss ?? null,
        profitTarget: risk.profitTarget ?? null,
      });
    }
    const vanished = [...obsolete];
    // Keep each statement below SQLite's bind-parameter limit, even for long histories.
    for (let i = 0; i < vanished.length; i += 500) {
      tx.delete(trades)
        .where(
          and(eq(trades.accountId, accountId), inArray(trades.key, vanished.slice(i, i + 500))),
        )
        .run();
    }
  });
};
