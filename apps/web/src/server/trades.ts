import { and, eq, inArray } from "drizzle-orm";
import { db, trades, attachments, tradeRuleChecks, notes, executions } from "@/db";
import { rebuildAccount } from "./rebuild";
import { RequestError } from "./api";

export interface DeleteTradesCleanupResult {
  deletedTradeCount: number;
  deletedAttachmentCount: number;
}

/**
 * Canonical deletion service for trades.
 * Cleans up associated attachments, rule checks, unlinks notes, removes executions,
 * and rebuilds accounts to remove materialized trades and cascade excursions.
 */
export const deleteTradesWithCleanup = (tradeKeys: string[]): DeleteTradesCleanupResult => {
  if (!tradeKeys || tradeKeys.length === 0) {
    return { deletedTradeCount: 0, deletedAttachmentCount: 0 };
  }

  // 1. Find trades matching tradeKeys (chunked to stay within SQLite parameter limits)
  const rows: (typeof trades.$inferSelect)[] = [];
  for (let i = 0; i < tradeKeys.length; i += 500) {
    const chunk = tradeKeys.slice(i, i + 500);
    const found = db.select().from(trades).where(inArray(trades.key, chunk)).all();
    rows.push(...found);
  }

  if (rows.length === 0) {
    return { deletedTradeCount: 0, deletedAttachmentCount: 0 };
  }

  const foundTradeKeys = rows.map((r) => r.key);
  const accountIds = Array.from(new Set(rows.map((r) => r.accountId)));

  // Extract execution IDs per account
  const executionsByAccount = new Map<string, string[]>();
  for (const row of rows) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(row.executionIdsJson) as string[];
    } catch {
      ids = [];
    }
    const current = executionsByAccount.get(row.accountId) ?? [];
    executionsByAccount.set(row.accountId, [...current, ...ids]);
  }

  let deletedAttachmentCount = 0;

  // In a single db.transaction:
  // 1. Delete attachments where owner_type = 'trade' and owner_id IN (tradeKeys) (chunks of 500). Count deleted attachments.
  // 2. Delete trade_rule_checks where trade_key IN (tradeKeys) (chunks of 500).
  // 3. Unlink notes: UPDATE notes SET trade_key = NULL WHERE trade_key IN (tradeKeys).
  // 4. Delete executions for those trades (chunks of 500 per account).
  db.transaction((tx) => {
    // 1. Attachments
    for (let i = 0; i < foundTradeKeys.length; i += 500) {
      const chunk = foundTradeKeys.slice(i, i + 500);
      const res = tx
        .delete(attachments)
        .where(and(eq(attachments.ownerType, "trade"), inArray(attachments.ownerId, chunk)))
        .run();
      deletedAttachmentCount += res.changes;
    }

    // 2. Trade rule checks
    for (let i = 0; i < foundTradeKeys.length; i += 500) {
      const chunk = foundTradeKeys.slice(i, i + 500);
      tx.delete(tradeRuleChecks)
        .where(inArray(tradeRuleChecks.tradeKey, chunk))
        .run();
    }

    // 3. Unlink notes
    for (let i = 0; i < foundTradeKeys.length; i += 500) {
      const chunk = foundTradeKeys.slice(i, i + 500);
      tx.update(notes)
        .set({ tradeKey: null })
        .where(inArray(notes.tradeKey, chunk))
        .run();
    }

    // 4. Delete executions
    for (const [accountId, executionIds] of executionsByAccount) {
      const uniqueExecutionIds = Array.from(new Set(executionIds));
      for (let i = 0; i < uniqueExecutionIds.length; i += 500) {
        const chunk = uniqueExecutionIds.slice(i, i + 500);
        tx.delete(executions)
          .where(and(eq(executions.accountId, accountId), inArray(executions.id, chunk)))
          .run();
      }
    }
  });

  // Outside the transaction, call rebuildAccount(accountId) for all affected accounts
  // (rebuild will delete the trade from trades table, and SQLite ON DELETE CASCADE will clean up trade_excursions)
  for (const accountId of accountIds) {
    rebuildAccount(accountId);
  }

  // Defensively ensure trades are removed if rebuild did not remove them
  for (let i = 0; i < foundTradeKeys.length; i += 500) {
    const chunk = foundTradeKeys.slice(i, i + 500);
    db.delete(trades).where(inArray(trades.key, chunk)).run();
  }

  return {
    deletedTradeCount: rows.length,
    deletedAttachmentCount,
  };
};

export const deleteTradeWithCleanup = (tradeKey: string): DeleteTradesCleanupResult => {
  const result = deleteTradesWithCleanup([tradeKey]);
  if (result.deletedTradeCount === 0) {
    throw new RequestError("Trade not found.", 404);
  }
  return result;
};
