import { eq } from "drizzle-orm";
import type { ImportedExecution } from "@luxalgo/journal-importers";
import { db, executions, accounts } from "@/db";
import { executionHash } from "./ids";

export interface AccountReconciliation {
  accountId: string;
  accountName: string;
  totalFills: number;
  existingFills: number;
  newFills: number;
  totalTrades: number;
  existingTrades: number;
  newTrades: number;
  isFullyImported: boolean;
}

const makeNaturalKey = (
  symbol: string,
  side: string,
  quantity: number,
  price: number,
  executedAt: string,
): string =>
  `${symbol.toUpperCase()}|${side.toLowerCase()}|${quantity.toPrecision(10)}|${price.toPrecision(10)}|${executedAt}`;

export function countTradesFromExecutions(rows: ImportedExecution[]): number {
  const groups = new Set<string>();
  let orphanCount = 0;
  for (const r of rows) {
    if (r.importMetadata?.group) {
      groups.add(r.importMetadata.group);
    } else {
      orphanCount++;
    }
  }
  if (groups.size > 0) {
    return groups.size + Math.ceil(orphanCount / 2);
  }
  return Math.ceil(rows.length / 2);
}

/**
 * Service Layer: Batch reconciliation of incoming fills against target account.
 * Executes exactly 1 SQL query and indexes existing records in-memory (O(1)).
 */
export function reconcileImport(
  accountId: string,
  incomingExecutions: ImportedExecution[],
): AccountReconciliation {
  const account = db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();

  const accountName = account?.name ?? "Account";

  // 1 single batch fetch: Zero N+1 queries
  const existingRows = db
    .select({
      contentHash: executions.contentHash,
      symbol: executions.symbol,
      side: executions.side,
      quantity: executions.quantity,
      price: executions.price,
      executedAt: executions.executedAt,
      importMetadataJson: executions.importMetadataJson,
    })
    .from(executions)
    .where(eq(executions.accountId, accountId))
    .all();

  const existingHashes = new Set<string>();
  const existingNaturalKeys = new Set<string>();
  const existingTickets = new Set<string>();

  for (const row of existingRows) {
    existingHashes.add(row.contentHash);
    existingNaturalKeys.add(
      makeNaturalKey(row.symbol, row.side, row.quantity, row.price, row.executedAt),
    );
    if (row.importMetadataJson) {
      try {
        const meta = JSON.parse(row.importMetadataJson);
        if (meta.id && meta.id !== "entry" && meta.id !== "exit") {
          existingTickets.add(String(meta.id));
        }
        if (meta.group && typeof meta.group === "string" && meta.group.startsWith("[")) {
          const parsedGroup = JSON.parse(meta.group);
          if (Array.isArray(parsedGroup) && parsedGroup[1]) {
            existingTickets.add(String(parsedGroup[1]));
          }
        }
      } catch {
        // Ignore unparseable metadata
      }
    }
  }

  const isRowExisting = (exec: ImportedExecution): boolean => {
    // 1. Content Hash match
    const hash = executionHash(exec);
    if (existingHashes.has(hash)) return true;

    // 2. Natural Key match (symbol, side, quantity, price, executedAt)
    const naturalKey = makeNaturalKey(
      exec.symbol,
      exec.side,
      exec.quantity,
      exec.price,
      exec.executedAt,
    );
    if (existingNaturalKeys.has(naturalKey)) return true;

    // 3. Broker Ticket match
    if (
      exec.importMetadata?.id &&
      exec.importMetadata.id !== "entry" &&
      exec.importMetadata.id !== "exit"
    ) {
      if (existingTickets.has(String(exec.importMetadata.id))) return true;
    }
    if (
      exec.importMetadata?.group &&
      typeof exec.importMetadata.group === "string" &&
      exec.importMetadata.group.startsWith("[")
    ) {
      try {
        const parsedGroup = JSON.parse(exec.importMetadata.group);
        if (Array.isArray(parsedGroup) && parsedGroup[1]) {
          if (existingTickets.has(String(parsedGroup[1]))) return true;
        }
      } catch {}
    }

    return false;
  };

  let existingFills = 0;
  let newFills = 0;

  // Group incoming executions by trade to evaluate trades accurately
  const tradeGroups = new Map<string, ImportedExecution[]>();
  let unassignedIndex = 0;

  for (const exec of incomingExecutions) {
    if (isRowExisting(exec)) {
      existingFills++;
    } else {
      newFills++;
    }

    const tradeKey =
      exec.importMetadata?.group ?? `unassigned-${Math.floor(unassignedIndex++ / 2)}`;
    const groupList = tradeGroups.get(tradeKey) ?? [];
    groupList.push(exec);
    tradeGroups.set(tradeKey, groupList);
  }

  let existingTrades = 0;
  let newTrades = 0;

  for (const [, fills] of tradeGroups) {
    const allExisting = fills.every(isRowExisting);
    if (allExisting) {
      existingTrades++;
    } else {
      newTrades++;
    }
  }

  const totalFills = incomingExecutions.length;
  const totalTrades = tradeGroups.size;
  const isFullyImported = totalFills > 0 && newFills === 0;

  return {
    accountId,
    accountName,
    totalFills,
    existingFills,
    newFills,
    totalTrades,
    existingTrades,
    newTrades,
    isFullyImported,
  };
}
