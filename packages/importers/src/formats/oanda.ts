import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const oanda: ImportFormat = {
  id: "oanda",
  label: "OANDA (transactions export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["ticket"],
      ["transaction date"],
      ["transaction type"],
      ["instrument"],
      ["units"],
      ["direction"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const transType = (pick(row, ["transaction type"]) ?? "").trim().toUpperCase();
      if (transType && transType !== "ORDER_FILL") {
        skippedRows++;
        continue;
      }

      const instrument = pick(row, ["instrument"])?.trim() ?? "";
      const symbol = instrument.replace("/", "").toUpperCase();

      const direction = (pick(row, ["direction"]) ?? "").trim().toLowerCase();
      const isBuy = direction === "buy";
      const isSell = direction === "sell";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(pick(row, ["units"])));
      const price = parseMoney(pick(row, ["price"]));
      const timeRaw = pick(row, ["transaction date", "date"]) ?? "";
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

      let fee = Math.abs(parseMoney(pick(row, ["commission"])));
      if (!Number.isFinite(fee)) fee = 0;
      for (const feeKey of ["spread cost", "conversion fee", "financing"]) {
        const val = Math.abs(parseMoney(pick(row, [feeKey])));
        if (Number.isFinite(val)) fee += val;
      }

      const plRaw = parseMoney(pick(row, ["pl", "amount"]));
      const ticket = pick(row, ["ticket"]) ?? "";
      const id = ticket ? `oanda:${ticket}` : `oanda:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee,
        executedAt,
        assetClass: "forex",
        importMetadata: {
          id,
          order: executions.length,
          reportedGrossPnl: Number.isFinite(plRaw) && plRaw !== 0 ? plRaw : undefined,
          preserveFee: fee > 0,
        },
      });
    }

    return {
      format: "oanda",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
