import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const tc2000: ImportFormat = {
  id: "tc2000",
  label: "TC2000 (trades export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["sym", "symbol"],
      ["bot/sld", "action", "side"],
      ["price"],
      ["quantity", "qty"],
      ["commision", "commission"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const occurrences = new Map<string, number>();
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const symbolRaw = pick(row, ["sym", "symbol"]) ?? "";
      const symbol = symbolRaw.trim().toUpperCase();

      const action = (pick(row, ["bot/sld", "side", "action"]) ?? "").trim().toLowerCase();
      const isBuy = action === "bot" || action === "buy" || action === "b";
      const isSell = action === "sld" || action === "sell" || action === "s";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const price = parseMoney(pick(row, ["price"]));
      const quantity = Math.abs(parseQuantity(pick(row, ["quantity", "qty"])));
      const timeRaw = pick(row, ["time", "date"]) ?? "";
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const comm = Math.abs(parseMoney(pick(row, ["commision", "commission", "fee"])));
      const pnlRaw = parseMoney(pick(row, ["p&l", "pnl"]));

      const side = isBuy ? "buy" : "sell";
      const occurrenceKey = `${executedAt}:${symbol}:${side}:${quantity}`;
      const occurrence = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const id = `tc2000:${occurrenceKey}:${occurrence}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: Number.isFinite(comm) ? comm : 0,
        executedAt,
        assetClass: "equity",
        importMetadata: {
          id,
          order: executions.length,
          reportedGrossPnl: Number.isFinite(pnlRaw) && pnlRaw !== 0 ? pnlRaw : undefined,
          preserveFee: comm > 0,
        },
      });
    }

    return {
      format: "tc2000",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
