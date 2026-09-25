import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { parseSide } from "./fills";
import type { AssetClass } from "@luxalgo/journal-core";

const mapAssetClass = (type: string | undefined): AssetClass | undefined => {
  if (!type) return undefined;
  const t = type.trim().toLowerCase();
  if (t.includes("crypto")) return "crypto";
  if (t.includes("future")) return "futures";
  if (t.includes("stock") || t.includes("equity")) return "equity";
  if (t.includes("forex") || t.includes("fx")) return "forex";
  if (t.includes("option")) return "option";
  if (t.includes("cfd")) return "cfd";
  return undefined;
};

export const quantower: ImportFormat = {
  id: "quantower",
  label: "Quantower",
  detect: (headers) =>
    hasHeaders(headers, [
      ["date/time", "datetime", "time"],
      ["symbol"],
      ["side"],
      ["quantity", "qty"],
      ["price"],
      ["tradeid", "trade id", "orderid", "order id"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [index, row] of records.entries()) {
      const rawAccount = pick(row, ["account", "accountname", "account id"]);
      if (rawAccount && rawAccount.trim()) accounts.add(rawAccount.trim());

      const symbolRaw = pick(row, ["symbol", "instrument"]);
      const sideRaw = pick(row, ["side"]);
      const qtyRaw = pick(row, ["quantity", "qty"]);
      const priceRaw = pick(row, ["price", "tradeprice"]);
      const timeRaw = pick(row, ["date/time", "datetime", "time"]);

      if (!symbolRaw || !sideRaw || !qtyRaw || !priceRaw || !timeRaw) {
        skippedRows++;
        continue;
      }

      const symbol = symbolRaw.trim().toUpperCase();
      const side = parseSide(sideRaw);
      const quantity = Math.abs(parseQuantity(qtyRaw));
      const price = parseMoney(priceRaw);
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!side || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const rawFee = pick(row, ["fee", "fees", "commission"]);
      const fee = Math.abs(parseMoney(rawFee) || 0);

      const rawGrossPnl = pick(row, ["grossp/l", "gross p/l", "grosspl", "gross p&l"]);
      const grossPnl = parseMoney(rawGrossPnl);

      const tradeId = pick(row, ["tradeid", "trade id"])?.trim();
      const orderId = pick(row, ["orderid", "order id"])?.trim();
      const positionId = pick(row, ["positionid", "position id"])?.trim();

      const execId = tradeId
        ? `quantower:trade:${tradeId}`
        : orderId
          ? `quantower:order:${orderId}:${index}`
          : `quantower:${executedAt}:${symbol}:${index}`;

      const assetType = pick(row, ["symboltype", "symbol type", "type"]);
      const assetClass = mapAssetClass(assetType);

      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee,
        executedAt,
        assetClass,
        importMetadata: {
          id: execId,
          group: positionId ? `quantower:pos:${positionId}` : undefined,
          order: index,
          reportedGrossPnl: Number.isFinite(grossPnl) ? grossPnl : undefined,
          preserveFee: fee > 0,
        },
      });
    }

    const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "quantower",
      executions,
      skippedRows,
      warnings: [],
      account: detectedAccount,
      sourceAccounts: Array.from(accounts),
    };
  },
};
