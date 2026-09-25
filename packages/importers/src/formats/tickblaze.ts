import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const tickblaze: ImportFormat = {
  id: "tickblaze",
  label: "Tickblaze (orders export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["symbol"],
      ["instrument"],
      ["action type"],
      ["qty. filled", "qty filled"],
      ["price"],
      ["update date/time (e)", "update date/time"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const symbolRaw = pick(row, ["symbol"]) ?? "";
      const symbol = symbolRaw.trim().toUpperCase();

      const action = (pick(row, ["action type", "action", "side"]) ?? "").trim().toLowerCase();
      const isBuy = action === "buy" || action === "b";
      const isSell = action === "sell" || action === "s";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(
        parseQuantity(pick(row, ["qty. filled", "qty filled", "quantity"])),
      );
      const price = parseMoney(pick(row, ["price"]));
      const timeRaw =
        pick(row, ["update date/time (e)", "update date/time (l)", "update date/time", "time"]) ??
        "";
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

      const comm = Math.abs(parseMoney(pick(row, ["commission", "fee"])));
      const instrument = (pick(row, ["instrument"]) ?? "").trim().toLowerCase();
      const assetClass = instrument.includes("crypto")
        ? "crypto"
        : instrument.includes("future")
          ? "futures"
          : instrument.includes("option")
            ? "option"
            : "equity";

      const id = `tickblaze:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: Number.isFinite(comm) ? comm : 0,
        executedAt,
        assetClass,
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: comm > 0,
        },
      });
    }

    return {
      format: "tickblaze",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
