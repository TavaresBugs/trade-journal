import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { parseSide } from "./fills";

/**
 * Moomoo (Futu) orders history export.
 * Headers: "Side","Symbol","Name","Order Price","Order Qty","Order Amount","Status",
 *          "Filled@Avg Price","Order Time",...,"Fill Qty","Fill Price","Fill Amount","Fill Time",...,"Total"
 *
 * Moomoo files group fills under a parent order row with aggregated `Filled@Avg Price` (e.g. "172@2.47"),
 * followed by continuation rows (with empty `Side`) for multi-fill executions.
 * We parse the parent order row's filled quantity and average price, skipping continuation rows.
 */
export const moomoo: ImportFormat = {
  id: "moomoo",
  label: "Moomoo (orders history export)",
  detect: (headers, content) =>
    hasHeaders(headers, [["filledavgprice"]]) ||
    /Filled@Avg Price/i.test(content.slice(0, 2000)),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const row of records) {
      const rawSide = pick(row, ["side"])?.trim();
      // Continuation rows have empty Side (their fills are included in the parent order average)
      if (!rawSide) {
        continue;
      }

      const filledAvg = pick(row, ["filledavgprice"])?.trim();
      if (!filledAvg || /^0(@0(\.0+)?|\.0+)?$/.test(filledAvg)) {
        skippedRows++;
        continue;
      }

      const atIndex = filledAvg.indexOf("@");
      if (atIndex === -1) {
        skippedRows++;
        continue;
      }

      const qtyStr = filledAvg.slice(0, atIndex);
      const priceStr = filledAvg.slice(atIndex + 1);
      const quantity = parseQuantity(qtyStr);
      const price = parseMoney(priceStr);

      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const side = parseSide(rawSide);
      const rawSymbol = pick(row, ["symbol"])?.trim();

      if (!side || !rawSymbol) {
        skippedRows++;
        continue;
      }

      // Check fill time first, then order time. Timestamps often carry trailing " ET".
      const fillTime = pick(row, ["filltime"])?.trim();
      const orderTime = pick(row, ["ordertime"])?.trim();
      const timeStr = fillTime && fillTime !== "" ? fillTime : orderTime;

      const executedAt = timeStr
        ? parseTimestamp(timeStr, options.timeZone || "America/New_York", options.dateOrder)
        : null;

      if (!executedAt) {
        skippedRows++;
        continue;
      }

      const rawTotal = pick(row, ["total"]);
      let fee = 0;
      if (rawTotal && rawTotal.trim() !== "") {
        const parsedTotal = parseMoney(rawTotal);
        if (Number.isFinite(parsedTotal)) {
          fee = Math.abs(parsedTotal);
        }
      } else {
        const feeCols = [
          "platformfees",
          "settlementfees",
          "consolidatedaudittrailfees",
          "secfees",
          "tradingactivityfees",
        ];
        for (const col of feeCols) {
          const val = parseMoney(pick(row, [col]));
          if (Number.isFinite(val)) {
            fee += Math.abs(val);
          }
        }
      }

      const symbol = rawSymbol.toUpperCase();
      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee,
        executedAt,
      });
    }

    return {
      format: "moomoo",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
