import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const tastytrade: ImportFormat = {
  id: "tastytrade",
  label: "Tastytrade (transactions export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["date"],
      ["action"],
      ["symbol", "root symbol"],
      ["instrument type", "description"],
      ["average price", "value"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const type = (pick(row, ["type"]) ?? "").trim().toLowerCase();
      // Skip money movements, interest, dividends
      if (type && type !== "trade") {
        skippedRows++;
        continue;
      }

      const action = (pick(row, ["action"]) ?? "").trim().toUpperCase();
      const isBuy = action.includes("BUY");
      const isSell = action.includes("SELL");
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const symbolRaw = pick(row, ["symbol", "root symbol", "underlying symbol"]) ?? "";
      const symbol = symbolRaw.trim();
      const rawDate = pick(row, ["date"]) ?? "";
      const executedAt = parseTimestamp(rawDate, options.timeZone, options.dateOrder);

      const quantity = Math.abs(parseQuantity(pick(row, ["quantity"])));
      const multiplierRaw = parseQuantity(pick(row, ["multiplier"]));
      const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 1;

      // In Tastytrade options, Average Price is often reported as total contract amount (e.g. 30.00 for $0.30 option with mult 100)
      const avgPriceRaw = parseMoney(pick(row, ["average price"]));
      const valueRaw = parseMoney(pick(row, ["value"]));
      let price = 0;

      if (Number.isFinite(avgPriceRaw) && avgPriceRaw !== 0) {
        price = Math.abs(avgPriceRaw) / multiplier;
      } else if (Number.isFinite(valueRaw) && quantity > 0) {
        price = Math.abs(valueRaw) / (quantity * multiplier);
      }

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price)) {
        skippedRows++;
        continue;
      }

      const comm = Math.abs(parseMoney(pick(row, ["commissions"])));
      const fees = Math.abs(parseMoney(pick(row, ["fees"])));
      const totalFee = (Number.isFinite(comm) ? comm : 0) + (Number.isFinite(fees) ? fees : 0);

      const instType = (pick(row, ["instrument type"]) ?? "").toLowerCase();
      let assetClass: ImportedExecution["assetClass"] = "equity";
      if (instType.includes("option")) assetClass = "option";
      else if (instType.includes("future")) assetClass = "futures";
      else if (instType.includes("crypto")) assetClass = "crypto";

      const orderNum = pick(row, ["order #", "order id", "orderid"]) ?? "";
      const id = orderNum ? `tastytrade:${orderNum}:${i}` : `tastytrade:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: totalFee,
        executedAt,
        assetClass,
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: totalFee > 0,
        },
      });
    }

    return {
      format: "tastytrade",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
