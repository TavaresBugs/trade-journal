import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const silexx: ImportFormat = {
  id: "silexx",
  label: "Silexx (trades export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["trade date"],
      ["market symbol"],
      ["buy/sell"],
      ["qty"],
      ["price"],
      ["gross amount"],
      ["net amount"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const symbolRaw = pick(row, ["market symbol", "symbol"]) ?? "";
      const symbol = symbolRaw.trim();

      const sideRaw = (pick(row, ["buy/sell", "side"]) ?? "").trim().toUpperCase();
      const isBuy = sideRaw === "B" || sideRaw === "BUY";
      const isSell = sideRaw === "S" || sideRaw === "SELL";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(pick(row, ["qty", "quantity"])));
      const price = parseMoney(pick(row, ["price"]));
      const timeRaw = pick(row, ["trade date", "date"]) ?? "";
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const comm = Math.abs(parseMoney(pick(row, ["comm", "commission"])));
      const regFee = Math.abs(parseMoney(pick(row, ["reg fee", "fee"])));
      const totalFee = (Number.isFinite(comm) ? comm : 0) + (Number.isFinite(regFee) ? regFee : 0);

      const type = (pick(row, ["type"]) ?? "").trim().toLowerCase();
      const isOption = type === "option" || /\s+\d{8}[CP]\s+/.test(symbol);

      const id = `silexx:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: totalFee,
        executedAt,
        assetClass: isOption ? "option" : "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: totalFee > 0,
        },
      });
    }

    return {
      format: "silexx",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
