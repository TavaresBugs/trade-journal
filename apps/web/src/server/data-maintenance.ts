import { and, count, eq, inArray, like, sql } from "drizzle-orm";
import {
  db,
  accounts,
  executions,
  trades,
  tradeExcursions,
  tradeRuleChecks,
  attachments,
  notes,
  journalDays,
  playbooks,
  importBatches,
  importSources,
  importSourceAliases,
} from "@/db";
import { rebuildAccount } from "./rebuild";
import { RequestError } from "./api";

export interface DataMaintenanceMetrics {
  tradesCount: number;
  executionsCount: number;
  attachmentsCount: number;
  attachmentsSizeBytes: number;
  imageAttachmentsCount: number;
  imageAttachmentsSizeBytes: number;
  notesCount: number;
  journalDaysCount: number;
  playbooksCount: number;
  accounts: {
    id: string;
    name: string;
    currency: string;
    tradeCount: number;
    executionCount: number;
  }[];
}

export interface ResetBrokerTradesOptions {
  /** If provided, resets only this specific account. If omitted or 'all', resets all accounts. */
  accountId?: string;
}

export interface ResetBrokerTradesResult {
  deletedTradeCount: number;
  deletedExecutionCount: number;
  preservedAttachmentCount: number;
  preservedRuleCheckCount: number;
  preservedNoteCount: number;
  preservedJournalDayCount: number;
  affectedAccounts: string[];
}

export interface ClearScreenshotsResult {
  deletedAttachmentCount: number;
  freedBytes: number;
}

export interface FactoryResetResult {
  deletedTradeCount: number;
  deletedExecutionCount: number;
  deletedAttachmentCount: number;
  deletedNoteCount: number;
  deletedJournalDayCount: number;
  deletedPlaybookCount: number;
  deletedAccountCount: number;
}

/**
 * Returns current metrics on stored user data and accounts.
 */
export const getDataMaintenanceMetrics = (): DataMaintenanceMetrics => {
  const tradesCount = db.select({ count: count() }).from(trades).get()?.count ?? 0;
  const executionsCount = db.select({ count: count() }).from(executions).get()?.count ?? 0;

  const attRow = db
    .select({
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${attachments.size}), 0)`,
    })
    .from(attachments)
    .get();
  const attachmentsCount = attRow?.count ?? 0;
  const attachmentsSizeBytes = attRow?.totalSize ?? 0;

  const imgRow = db
    .select({
      count: count(),
      totalSize: sql<number>`COALESCE(SUM(${attachments.size}), 0)`,
    })
    .from(attachments)
    .where(like(attachments.mime, "image/%"))
    .get();
  const imageAttachmentsCount = imgRow?.count ?? 0;
  const imageAttachmentsSizeBytes = imgRow?.totalSize ?? 0;

  const notesCount = db.select({ count: count() }).from(notes).get()?.count ?? 0;
  const journalDaysCount = db.select({ count: count() }).from(journalDays).get()?.count ?? 0;
  const playbooksCount = db.select({ count: count() }).from(playbooks).get()?.count ?? 0;

  const allAccounts = db.select().from(accounts).all();
  const accountMetrics = allAccounts.map((acc) => {
    const accTrades =
      db.select({ count: count() }).from(trades).where(eq(trades.accountId, acc.id)).get()?.count ??
      0;
    const accExecs =
      db.select({ count: count() }).from(executions).where(eq(executions.accountId, acc.id)).get()
        ?.count ?? 0;
    return {
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      tradeCount: accTrades,
      executionCount: accExecs,
    };
  });

  return {
    tradesCount,
    executionsCount,
    attachmentsCount,
    attachmentsSizeBytes,
    imageAttachmentsCount,
    imageAttachmentsSizeBytes,
    notesCount,
    journalDaysCount,
    playbooksCount,
    accounts: accountMetrics,
  };
};

/**
 * Safe Execution Reset:
 * Purges raw executions and materialized trades, then rebuilds the account(s).
 * Strictly PRESERVES all user-authored intellectual property:
 * attachments (screenshots), trade_rule_checks (playbook), notes, and journalDays.
 * When a fresh CSV is re-imported, deterministic natural keys automatically re-anchor everything.
 */
export const resetBrokerTrades = (
  options: ResetBrokerTradesOptions = {},
): ResetBrokerTradesResult => {
  const targetAccountId =
    options.accountId && options.accountId !== "all" ? options.accountId : null;

  if (targetAccountId) {
    const acc = db.select().from(accounts).where(eq(accounts.id, targetAccountId)).get();
    if (!acc) throw new RequestError("Account not found.", 404);
  }

  const allAccounts = targetAccountId
    ? [targetAccountId]
    : db
        .select({ id: accounts.id })
        .from(accounts)
        .all()
        .map((a) => a.id);

  let initialTradeCount = 0;
  let initialExecutionCount = 0;

  if (targetAccountId) {
    initialTradeCount =
      db.select({ count: count() }).from(trades).where(eq(trades.accountId, targetAccountId)).get()
        ?.count ?? 0;
    initialExecutionCount =
      db
        .select({ count: count() })
        .from(executions)
        .where(eq(executions.accountId, targetAccountId))
        .get()?.count ?? 0;
  } else {
    initialTradeCount = db.select({ count: count() }).from(trades).get()?.count ?? 0;
    initialExecutionCount = db.select({ count: count() }).from(executions).get()?.count ?? 0;
  }

  // 1. Delete executions, import batches, and source aliases inside transaction
  db.transaction((tx) => {
    if (targetAccountId) {
      tx.delete(executions).where(eq(executions.accountId, targetAccountId)).run();
      tx.delete(importBatches).where(eq(importBatches.accountId, targetAccountId)).run();
      tx.delete(importSourceAliases)
        .where(eq(importSourceAliases.accountId, targetAccountId))
        .run();
    } else {
      tx.delete(executions).run();
      tx.delete(importBatches).run();
      tx.delete(importSourceAliases).run();
    }
  });

  // 2. Rebuild each affected account (rebuild with 0 executions clears trades table and cascading excursions)
  for (const accId of allAccounts) {
    rebuildAccount(accId);
  }

  // Defensively ensure any trades are deleted if rebuild did not catch orphan keys
  if (targetAccountId) {
    db.delete(trades).where(eq(trades.accountId, targetAccountId)).run();
  } else {
    db.delete(trades).run();
  }

  // 3. Count preserved intellectual property
  const preservedAttachmentCount =
    db.select({ count: count() }).from(attachments).get()?.count ?? 0;
  const preservedRuleCheckCount =
    db.select({ count: count() }).from(tradeRuleChecks).get()?.count ?? 0;
  const preservedNoteCount = db.select({ count: count() }).from(notes).get()?.count ?? 0;
  const preservedJournalDayCount =
    db.select({ count: count() }).from(journalDays).get()?.count ?? 0;

  return {
    deletedTradeCount: initialTradeCount,
    deletedExecutionCount: initialExecutionCount,
    preservedAttachmentCount,
    preservedRuleCheckCount,
    preservedNoteCount,
    preservedJournalDayCount,
    affectedAccounts: allAccounts,
  };
};

/**
 * Clear Screenshots & Media:
 * Removes image blobs and attachments to free up SQLite disk space,
 * keeping trades, executions, and textual journal notes 100% intact.
 */
export const clearScreenshots = (): ClearScreenshotsResult => {
  const imageRows = db
    .select({
      id: attachments.id,
      size: attachments.size,
    })
    .from(attachments)
    .where(like(attachments.mime, "image/%"))
    .all();

  const totalBytes = imageRows.reduce((acc, row) => acc + (row.size ?? 0), 0);
  const ids = imageRows.map((r) => r.id);

  if (ids.length > 0) {
    db.transaction((tx) => {
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        tx.delete(attachments).where(inArray(attachments.id, chunk)).run();
      }
    });
  }

  return {
    deletedAttachmentCount: ids.length,
    freedBytes: totalBytes,
  };
};

/**
 * Nuclear Factory Reset:
 * Completely purges all user data (trades, executions, notes, screenshots, playbooks, accounts).
 * Requires explicit typed confirmation in API caller.
 */
export const factoryResetAllData = (): FactoryResetResult => {
  const initialTrades = db.select({ count: count() }).from(trades).get()?.count ?? 0;
  const initialExecs = db.select({ count: count() }).from(executions).get()?.count ?? 0;
  const initialAtts = db.select({ count: count() }).from(attachments).get()?.count ?? 0;
  const initialNotes = db.select({ count: count() }).from(notes).get()?.count ?? 0;
  const initialDays = db.select({ count: count() }).from(journalDays).get()?.count ?? 0;
  const initialPlaybooks = db.select({ count: count() }).from(playbooks).get()?.count ?? 0;
  const initialAccounts = db.select({ count: count() }).from(accounts).get()?.count ?? 0;

  db.transaction((tx) => {
    tx.delete(attachments).run();
    tx.delete(tradeRuleChecks).run();
    tx.delete(tradeExcursions).run();
    tx.delete(trades).run();
    tx.delete(executions).run();
    tx.delete(notes).run();
    tx.delete(journalDays).run();
    tx.delete(playbooks).run();
    tx.delete(importBatches).run();
    tx.delete(importSourceAliases).run();
    tx.delete(importSources).run();
    tx.delete(accounts).run();
  });

  return {
    deletedTradeCount: initialTrades,
    deletedExecutionCount: initialExecs,
    deletedAttachmentCount: initialAtts,
    deletedNoteCount: initialNotes,
    deletedJournalDayCount: initialDays,
    deletedPlaybookCount: initialPlaybooks,
    deletedAccountCount: initialAccounts,
  };
};
