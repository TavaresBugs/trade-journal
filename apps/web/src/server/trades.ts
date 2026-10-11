import { and, eq, inArray, count } from "drizzle-orm";
import { db, trades, attachments, tradeRuleChecks, notes, executions } from "@/db";
import { rebuildAccount } from "./rebuild";
import { RequestError } from "./api";

export interface DeleteTradesOptions {
  /**
   * If true, permanently deletes physical image blobs and rows from attachments table.
   * If false (default), preserves attachments so re-importing the trade will re-link them.
   */
  purgeAttachments?: boolean;
  /**
   * If true, permanently deletes playbook checklist results from trade_rule_checks table.
   * Defaults to the same value as purgeAttachments.
   */
  purgeRuleChecks?: boolean;
}

export interface DeleteTradesCleanupResult {
  deletedTradeCount: number;
  deletedAttachmentCount: number;
  preservedAttachmentCount: number;
  deletedRuleCheckCount: number;
  preservedRuleCheckCount: number;
  unlinkedNoteCount: number;
  preservedNoteCount: number;
}

/**
 * Canonical deletion service for trades.
 * Cleans up executions, rebuilds accounts to remove materialized trades, and manages attachments
 * according to the chosen strategy (safe execution reset vs. hard nuclear purge).
 */
export const deleteTradesWithCleanup = (
  tradeKeys: string[],
  options: DeleteTradesOptions = {},
): DeleteTradesCleanupResult => {
  const purgeAttachments = options.purgeAttachments ?? false;
  const purgeRuleChecks = options.purgeRuleChecks ?? purgeAttachments;

  if (!tradeKeys || tradeKeys.length === 0) {
    return {
      deletedTradeCount: 0,
      deletedAttachmentCount: 0,
      preservedAttachmentCount: 0,
      deletedRuleCheckCount: 0,
      preservedRuleCheckCount: 0,
      unlinkedNoteCount: 0,
      preservedNoteCount: 0,
    };
  }

  // Deduplicate input tradeKeys
  const uniqueTradeKeys = Array.from(new Set(tradeKeys));

  // 1. Find trades matching uniqueTradeKeys (chunked to stay within SQLite parameter limits)
  const rows: (typeof trades.$inferSelect)[] = [];
  for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
    const chunk = uniqueTradeKeys.slice(i, i + 500);
    const found = db.select().from(trades).where(inArray(trades.key, chunk)).all();
    rows.push(...found);
  }

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
  let preservedAttachmentCount = 0;
  let deletedRuleCheckCount = 0;
  let preservedRuleCheckCount = 0;
  let unlinkedNoteCount = 0;
  let preservedNoteCount = 0;

  db.transaction((tx) => {
    // 1. Attachments
    for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
      const chunk = uniqueTradeKeys.slice(i, i + 500);
      if (purgeAttachments) {
        const res = tx
          .delete(attachments)
          .where(and(eq(attachments.ownerType, "trade"), inArray(attachments.ownerId, chunk)))
          .run();
        deletedAttachmentCount += res.changes;
      } else {
        const foundCount =
          tx
            .select({ count: count() })
            .from(attachments)
            .where(and(eq(attachments.ownerType, "trade"), inArray(attachments.ownerId, chunk)))
            .get()?.count ?? 0;
        preservedAttachmentCount += foundCount;
      }
    }

    // 2. Trade rule checks
    for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
      const chunk = uniqueTradeKeys.slice(i, i + 500);
      if (purgeRuleChecks) {
        const res = tx
          .delete(tradeRuleChecks)
          .where(inArray(tradeRuleChecks.tradeKey, chunk))
          .run();
        deletedRuleCheckCount += res.changes;
      } else {
        const foundCount =
          tx
            .select({ count: count() })
            .from(tradeRuleChecks)
            .where(inArray(tradeRuleChecks.tradeKey, chunk))
            .get()?.count ?? 0;
        preservedRuleCheckCount += foundCount;
      }
    }

    // 3. Unlink notes (only on hard purge, so notes remain anchored if trade is re-imported)
    if (purgeAttachments) {
      for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
        const chunk = uniqueTradeKeys.slice(i, i + 500);
        const res = tx
          .update(notes)
          .set({ tradeKey: null })
          .where(inArray(notes.tradeKey, chunk))
          .run();
        unlinkedNoteCount += res.changes;
      }
    } else {
      for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
        const chunk = uniqueTradeKeys.slice(i, i + 500);
        const foundCount =
          tx.select({ count: count() }).from(notes).where(inArray(notes.tradeKey, chunk)).get()
            ?.count ?? 0;
        preservedNoteCount += foundCount;
      }
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

  // Rebuild affected accounts
  for (const accountId of accountIds) {
    rebuildAccount(accountId);
  }

  // Defensively ensure trades are removed if rebuild did not remove them
  for (let i = 0; i < uniqueTradeKeys.length; i += 500) {
    const chunk = uniqueTradeKeys.slice(i, i + 500);
    db.delete(trades).where(inArray(trades.key, chunk)).run();
  }

  return {
    deletedTradeCount: rows.length,
    deletedAttachmentCount,
    preservedAttachmentCount,
    deletedRuleCheckCount,
    preservedRuleCheckCount,
    unlinkedNoteCount,
    preservedNoteCount,
  };
};

export const deleteTradeWithCleanup = (
  tradeKey: string,
  options?: DeleteTradesOptions,
): DeleteTradesCleanupResult => {
  const result = deleteTradesWithCleanup([tradeKey], options);
  const totalAffected =
    result.deletedTradeCount +
    result.deletedAttachmentCount +
    result.preservedAttachmentCount +
    result.deletedRuleCheckCount +
    result.preservedRuleCheckCount +
    result.unlinkedNoteCount +
    result.preservedNoteCount;

  if (totalAffected === 0) {
    throw new RequestError("Trade not found.", 404);
  }
  return result;
};
