import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { makeFillsFormat } from "./fills";

/**
 * TopstepX fills export (legacy / raw fills).
 * Format: AccountName, ContractName, ExecutePrice, FilledAt, PositionDisposition, Side, Size, Status.
 */
const topstepxFills = makeFillsFormat({
  id: "topstepx",
  label: "TopstepX (fills export)",
  required: [["contractname"], ["executeprice"], ["filledat"]],
  columns: {
    symbol: ["contractname"],
    side: ["side"], // "Bid" = buy, "Ask" = sell (handled by parseSide)
    quantity: ["size", "qty"],
    price: ["executeprice"],
    timestamp: ["filledat"],
  },
  rowFilter: (row) => !("status" in row) || /filled/i.test(row["status"] ?? ""),
  normalizeSymbol: (symbol) => symbol.replace(/^\//, "").trim().toUpperCase(),
});

const isTradesFormat = (headers: string[]): boolean =>
  hasHeaders(headers, [
    ["id"],
    ["contractname", "contract", "symbol"],
    ["enteredat", "entered at", "entrytime"],
    ["exitedat", "exited at", "exittime"],
  ]);

const parseTrades = (content: string, options: ImportOptions): ParsedImport => {
  const records = toRecords(parseCsv(content));
  const executions: ImportedExecution[] = [];
  const accounts = new Set<string>();
  let skippedRows = 0;

  for (const [index, row] of records.entries()) {
    const rawAccount = pick(row, ["accountname", "account", "account id"]);
    if (rawAccount) accounts.add(rawAccount.trim());

    const tradeId = pick(row, ["id", "tradeid", "trade id"]) ?? `trade-${index}`;
    const rawContract = pick(row, ["contractname", "contract", "symbol"]) ?? "";
    const symbol = rawContract.replace(/^\//, "").trim().toUpperCase();

    const rawQty = pick(row, ["size", "quantity", "qty"]);
    const quantity = Math.abs(parseQuantity(rawQty));

    const rawEntryPrice = pick(row, ["entryprice", "entry price", "openprice"]);
    const entryPrice = parseMoney(rawEntryPrice);

    const rawExitPrice = pick(row, ["exitprice", "exit price", "closeprice"]);
    const exitPrice = parseMoney(rawExitPrice);

    const rawEnteredAt = pick(row, ["enteredat", "entered at", "entrytime"]);
    const rawExitedAt = pick(row, ["exitedat", "exited at", "exittime"]);

    const enteredAt = parseTimestamp(rawEnteredAt, options.timeZone, options.dateOrder);
    const exitedAt = parseTimestamp(rawExitedAt, options.timeZone, options.dateOrder);

    const rawFee = pick(row, ["fees", "fee", "commission"]);
    const fee = Math.abs(parseMoney(rawFee) || 0);

    const rawPnl = pick(row, ["pnl", "profit", "netpnl", "realizedpnl"]);
    const pnl = parseMoney(rawPnl);

    const typeText = (pick(row, ["type", "direction", "side"]) ?? "").trim().toLowerCase();
    const isLong = /long|buy/i.test(typeText) || (!/short|sell/i.test(typeText) && entryPrice < exitPrice === (pnl > 0));

    if (
      !symbol ||
      !quantity ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(exitPrice) ||
      !enteredAt ||
      !exitedAt
    ) {
      skippedRows++;
      continue;
    }

    const groupId = `topstepx:trade:${tradeId}`;

    // Leg 1: Entry
    executions.push({
      symbol,
      side: isLong ? "buy" : "sell",
      quantity,
      price: entryPrice,
      fee: 0,
      executedAt: enteredAt,
      assetClass: "futures",
      importMetadata: {
        id: `topstepx:trade:${tradeId}:entry`,
        group: groupId,
        order: index * 2,
        preserveFee: true,
      },
    });

    // Leg 2: Exit
    executions.push({
      symbol,
      side: isLong ? "sell" : "buy",
      quantity,
      price: exitPrice,
      fee,
      executedAt: exitedAt,
      assetClass: "futures",
      importMetadata: {
        id: `topstepx:trade:${tradeId}:exit`,
        group: groupId,
        order: index * 2 + 1,
        reportedGrossPnl: Number.isFinite(pnl) ? pnl : undefined,
        preserveFee: fee > 0,
      },
    });
  }

  const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

  return {
    format: "topstepx",
    executions,
    skippedRows,
    warnings: [],
    account: detectedAccount,
    sourceAccounts: Array.from(accounts),
  };
};

export const topstepx: ImportFormat = {
  id: "topstepx",
  label: "TopstepX",
  detect: (headers) =>
    isTradesFormat(headers) ||
    hasHeaders(headers, [["contractname"], ["executeprice"], ["filledat"]]),
  parse: (content, options) => {
    const headers = parseCsv(content)[0] ?? [];
    if (isTradesFormat(headers)) {
      return parseTrades(content, options);
    }
    // Fills format
    const parsed = topstepxFills.parse(content, options);
    const records = toRecords(parseCsv(content));
    const accounts = new Set<string>();
    for (const r of records) {
      const acct = pick(r, ["accountname", "account"]);
      if (acct) accounts.add(acct.trim());
    }
    if (accounts.size > 0) {
      parsed.account = Array.from(accounts)[0];
      parsed.sourceAccounts = Array.from(accounts);
    }
    // Tag assetClass as futures
    for (const exec of parsed.executions) {
      exec.assetClass = "futures";
    }
    return parsed;
  },
};
