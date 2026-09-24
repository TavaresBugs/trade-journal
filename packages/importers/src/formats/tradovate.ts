import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { makeFillsFormat } from "./fills";

/**
 * Tradovate orders export (fill-level).
 * Format: orderId, Account, Date (M/D/YY), Fill Time, B/S, Contract, Product, Filled Qty, Avg Fill Price, Status.
 */
const tradovateOrders = makeFillsFormat({
  id: "tradovate",
  label: "Tradovate (orders export)",
  required: [["contract"], ["bs", "side"], ["filltime", "timestamp"]],
  columns: {
    symbol: ["product", "contract"],
    side: ["bs", "side"],
    quantity: ["filledqty", "fillqty", "qty"],
    price: ["avgfillprice", "avgprice", "price"],
    fees: [["commission"], ["fees"]],
    timestamp: ["filltime", "timestamp"],
    date: ["date"],
    time: ["filltime"],
  },
  rowFilter: (row) => !("status" in row) || /filled/i.test(row["status"] ?? ""),
  normalizeSymbol: (symbol) => symbol.trim().toUpperCase(),
});

/**
 * Tradovate positions / performance export (paired trades).
 * Real statement format:
 * Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,
 * Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,
 * Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp
 */
const isPositionsFormat = (headers: string[]): boolean =>
  hasHeaders(headers, [
    ["positionid", "position id"],
    ["boughttimestamp", "bought timestamp"],
    ["soldtimestamp", "sold timestamp"],
  ]) ||
  hasHeaders(headers, [
    ["positionid", "position id"],
    ["pairid", "pair id"],
    ["buyprice", "buy price"],
    ["sellprice", "sell price"],
  ]);

const parsePositions = (content: string, options: ImportOptions): ParsedImport => {
  const records = toRecords(parseCsv(content));
  const executions: ImportedExecution[] = [];
  const accounts = new Set<string>();
  let skippedRows = 0;

  for (const row of records) {
    const rawAccount = pick(row, ["account", "accountname", "conta"]);
    if (rawAccount) accounts.add(rawAccount.trim());

    const rawProduct = pick(row, ["product", "contract", "instrument", "symbol"]) ?? "";
    const symbol = rawProduct.trim().toUpperCase();

    const rawQty = pick(row, ["pairedqty", "paired qty", "bought", "sold", "quantity", "qty"]);
    const quantity = parseQuantity(rawQty);

    const rawBuyPrice = pick(row, ["buyprice", "buy price", "avg. buy", "avgbuy", "avg buy"]);
    const buyPrice = parseMoney(rawBuyPrice);

    const rawSellPrice = pick(row, ["sellprice", "sell price", "avg. sell", "avgsell", "avg sell"]);
    const sellPrice = parseMoney(rawSellPrice);

    const rawBoughtTime = pick(row, [
      "boughttimestamp",
      "bought timestamp",
      "boughttime",
      "bought time",
    ]);
    const rawSoldTime = pick(row, ["soldtimestamp", "sold timestamp", "soldtime", "sold time"]);

    const boughtTime = parseTimestamp(rawBoughtTime, options.timeZone, options.dateOrder);
    const soldTime = parseTimestamp(rawSoldTime, options.timeZone, options.dateOrder);

    const pnl = parseMoney(pick(row, ["pl", "pnl", "profit", "realizedpnl"]));
    const positionId = pick(row, ["positionid", "position id"]) ?? "";
    const pairId = pick(row, ["pairid", "pair id"]) ?? "";
    const buyFillId = pick(row, ["buyfillid", "buy fill id"]) ?? "";
    const sellFillId = pick(row, ["sellfillid", "sell fill id"]) ?? "";
    const netPos = pick(row, ["netpos", "net pos"]);

    if (
      !symbol ||
      !quantity ||
      Number.isNaN(quantity) ||
      quantity <= 0 ||
      Number.isNaN(buyPrice) ||
      Number.isNaN(sellPrice) ||
      !boughtTime ||
      !soldTime
    ) {
      skippedRows++;
      continue;
    }

    // Direction resolution by execution timestamps:
    // If boughtTime < soldTime: opened Long (Buy), closed Short (Sell).
    // If soldTime < boughtTime: opened Short (Sell), closed Long (Buy).
    // If timestamps match, fall back to netPos or Fill IDs.
    const isLong =
      boughtTime < soldTime
        ? true
        : soldTime < boughtTime
          ? false
          : netPos && Number(netPos) < 0
            ? false
            : buyFillId && sellFillId
              ? buyFillId <= sellFillId
              : true;

    const entryId = isLong
      ? buyFillId || (pairId ? `${pairId}_buy` : `${positionId}_0`)
      : sellFillId || (pairId ? `${pairId}_sell` : `${positionId}_0`);

    const exitId = isLong
      ? sellFillId || (pairId ? `${pairId}_sell` : `${positionId}_1`)
      : buyFillId || (pairId ? `${pairId}_buy` : `${positionId}_1`);

    const groupId = `tradovate:pos:${positionId || pairId || `${symbol}_${boughtTime}`}`;

    // Leg 1: Entry
    executions.push({
      symbol,
      side: isLong ? "buy" : "sell",
      quantity,
      price: isLong ? buyPrice : sellPrice,
      fee: 0,
      executedAt: isLong ? boughtTime : soldTime,
      assetClass: "futures",
      importMetadata: {
        id: `tradovate:fill:${entryId}`,
        group: groupId,
        order: 0,
        preserveFee: true,
      },
    });

    // Leg 2: Exit
    executions.push({
      symbol,
      side: isLong ? "sell" : "buy",
      quantity,
      price: isLong ? sellPrice : buyPrice,
      fee: 0,
      executedAt: isLong ? soldTime : boughtTime,
      assetClass: "futures",
      importMetadata: {
        id: `tradovate:fill:${exitId}`,
        group: groupId,
        order: 1,
        reportedGrossPnl: Number.isFinite(pnl) ? pnl : undefined,
        preserveFee: true,
      },
    });
  }

  const detectedAccount = accounts.size > 0 ? [...accounts][0] : undefined;

  return {
    format: "tradovate",
    executions,
    skippedRows,
    warnings: [],
    account: detectedAccount,
    sourceAccounts: [...accounts],
  };
};

export const tradovate: ImportFormat = {
  id: "tradovate",
  label: "Tradovate",
  detect: (headers) =>
    isPositionsFormat(headers) ||
    hasHeaders(headers, [["contract"], ["bs", "side"], ["filltime", "timestamp"]]),
  parse: (content, options) => {
    const headers = parseCsv(content)[0] ?? [];
    if (isPositionsFormat(headers)) {
      return parsePositions(content, options);
    }
    // Standard orders export
    const parsed = tradovateOrders.parse(content, options);
    // Extract account if present in rows
    const records = toRecords(parseCsv(content));
    const accounts = new Set<string>();
    for (const r of records) {
      const acct = pick(r, ["account", "accountname"]);
      if (acct) accounts.add(acct.trim());
    }
    if (accounts.size > 0) {
      parsed.account = [...accounts][0];
      parsed.sourceAccounts = [...accounts];
    }
    return parsed;
  },
};
