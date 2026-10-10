import type { Execution, AssetClass, TradeDirection } from "@luxalgo/journal-core";
import type { ImportedExecution } from "../../src/types";

let importedExecutionSeq = 0;
let executionSeq = 0;

/**
 * Resets sequence counters used to generate unique IDs and timestamps in factories.
 */
export function resetFactoryCounters(): void {
  importedExecutionSeq = 0;
  executionSeq = 0;
}

/**
 * Object Mother factory for creating `ImportedExecution` instances with sensible defaults.
 */
export function createImportedExecution(
  overrides: Partial<ImportedExecution> = {},
): ImportedExecution {
  const seq = ++importedExecutionSeq;
  const second = String(seq % 60).padStart(2, "0");
  const minute = String(Math.floor(seq / 60) % 60).padStart(2, "0");

  return {
    symbol: "MES",
    side: "buy",
    quantity: 1,
    price: 5000.0,
    fee: 0.5,
    executedAt: `2026-01-05T14:${minute}:${second}.000Z`,
    assetClass: "futures",
    importMetadata: {
      id: `imported-${seq}`,
      order: seq,
      preserveFee: true,
    },
    ...overrides,
  };
}

/**
 * Object Mother factory for creating canonical `@luxalgo/journal-core` `Execution` instances.
 */
export function createExecution(
  overrides: Partial<Execution> = {},
): Execution {
  const seq = ++executionSeq;
  const second = String(seq % 60).padStart(2, "0");
  const minute = String(Math.floor(seq / 60) % 60).padStart(2, "0");

  return {
    id: `exec-${seq}`,
    accountId: "acc-default",
    symbol: "MES",
    side: "buy",
    quantity: 1,
    price: 5000.0,
    fee: 0.5,
    executedAt: `2026-01-05T14:${minute}:${second}.000Z`,
    assetClass: "futures",
    source: "import",
    importMetadata: {
      id: `meta-${seq}`,
      order: seq,
      preserveFee: true,
    },
    ...overrides,
  };
}

export interface TradePairFactoryOptions {
  symbol?: string;
  direction?: TradeDirection;
  quantity?: number;
  entryPrice?: number;
  exitPrice?: number;
  entryTime?: string;
  exitTime?: string;
  entryFee?: number;
  exitFee?: number;
  accountId?: string;
  assetClass?: AssetClass;
}

/**
 * Creates an entry and exit pair of `Execution` records that complete a round trip.
 */
export function createTradePair(
  options: TradePairFactoryOptions = {},
): [Execution, Execution] {
  const symbol = options.symbol ?? "MES";
  const direction = options.direction ?? "long";
  const quantity = options.quantity ?? 1;
  const entryPrice = options.entryPrice ?? 5000.0;
  const exitPrice = options.exitPrice ?? (direction === "long" ? 5010.0 : 4990.0);
  const entryTime = options.entryTime ?? "2026-01-05T14:30:00.000Z";
  const exitTime = options.exitTime ?? "2026-01-05T15:30:00.000Z";
  const entryFee = options.entryFee ?? 0.5;
  const exitFee = options.exitFee ?? 0.5;
  const accountId = options.accountId ?? "acc-default";
  const assetClass = options.assetClass ?? "futures";

  const entry = createExecution({
    accountId,
    symbol,
    side: direction === "long" ? "buy" : "sell",
    quantity,
    price: entryPrice,
    fee: entryFee,
    executedAt: entryTime,
    assetClass,
  });

  const exit = createExecution({
    accountId,
    symbol,
    side: direction === "long" ? "sell" : "buy",
    quantity,
    price: exitPrice,
    fee: exitFee,
    executedAt: exitTime,
    assetClass,
  });

  return [entry, exit];
}

/**
 * Creates an entry and exit pair of `ImportedExecution` records.
 */
export function createImportedTradePair(
  options: TradePairFactoryOptions = {},
): [ImportedExecution, ImportedExecution] {
  const symbol = options.symbol ?? "MES";
  const direction = options.direction ?? "long";
  const quantity = options.quantity ?? 1;
  const entryPrice = options.entryPrice ?? 5000.0;
  const exitPrice = options.exitPrice ?? (direction === "long" ? 5010.0 : 4990.0);
  const entryTime = options.entryTime ?? "2026-01-05T14:30:00.000Z";
  const exitTime = options.exitTime ?? "2026-01-05T15:30:00.000Z";
  const entryFee = options.entryFee ?? 0.5;
  const exitFee = options.exitFee ?? 0.5;
  const assetClass = options.assetClass ?? "futures";

  const entry = createImportedExecution({
    symbol,
    side: direction === "long" ? "buy" : "sell",
    quantity,
    price: entryPrice,
    fee: entryFee,
    executedAt: entryTime,
    assetClass,
  });

  const exit = createImportedExecution({
    symbol,
    side: direction === "long" ? "sell" : "buy",
    quantity,
    price: exitPrice,
    fee: exitFee,
    executedAt: exitTime,
    assetClass,
  });

  return [entry, exit];
}
