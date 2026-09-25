import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const tddirect: ImportFormat = {
  id: "td-direct",
  label: "TD Direct Investing (orders export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["ticker", "symbol"],
      ["action"],
      ["avg fill price", "price"],
      ["order date", "time"],
      ["status"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const status = (pick(row, ["status"]) ?? "").trim().toLowerCase();
      if (status && status !== "filled") {
        skippedRows++;
        continue;
      }

      const symbolRaw = pick(row, ["ticker", "symbol"]) ?? "";
      const symbol = symbolRaw.trim();

      const action = (pick(row, ["action", "side"]) ?? "").trim().toUpperCase();
      const isBuy = action === "BUY" || action === "B";
      const isSell = action === "SELL" || action === "S";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(pick(row, ["qty", "quantity"])));
      const price = parseMoney(pick(row, ["avg fill price", "price"]));
      const timeRaw = pick(row, ["order date", "date", "time"]) ?? "";
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (
        !symbol ||
        !executedAt ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        skippedRows++;
        continue;
      }

      const isOption = /\s+[CP]\s+/i.test(symbol) || /\d[CP]\d/.test(symbol);
      const id = `tddirect:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: 0,
        executedAt,
        assetClass: isOption ? "option" : "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: false,
        },
      });
    }

    return {
      format: "td-direct",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
