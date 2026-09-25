import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

/**
 * WealthCharts orders export (commonly used with prop firms like Apex Trader Funding).
 *
 * Headers: name,order_id,symbol,mov_time,mov_type,exec_qty,price_done,points,profit,created_on
 *
 * mov_type mapping:
 * - 1: Buy Entry (Long Open)
 * - 2: Sell Exit (Long Close)
 * - 3: Sell Entry (Short Open)
 * - 4: Buy Exit (Short Cover)
 */
export const wealthcharts: ImportFormat = {
  id: "wealthcharts",
  label: "WealthCharts (orders export)",
  detect: (headers, content) =>
    hasHeaders(headers, [["orderid"], ["movtype"], ["pricedone"]]) ||
    /name.*order_id.*symbol.*mov_time.*mov_type/i.test(content.slice(0, 1000)),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    records.forEach((row, index) => {
      const rawSymbol = pick(row, ["symbol", "contract"])?.trim();
      const rawOrder = pick(row, ["orderid"])?.trim();
      const rawAccount = pick(row, ["name", "account"])?.trim();
      const movType = pick(row, ["movtype"])?.trim();
      const rawQty = pick(row, ["execqty", "qty", "quantity"])?.trim();
      const rawPrice = pick(row, ["pricedone", "price", "avgprice"])?.trim();
      const rawProfit = pick(row, ["profit", "pnl", "realizedpnl"])?.trim();
      const movTime = pick(row, ["movtime"])?.trim();
      const createdOn = pick(row, ["createdon", "createdat"])?.trim();

      if (rawAccount) accounts.add(rawAccount);

      if (!rawSymbol || !rawPrice) {
        skippedRows++;
        return;
      }

      // Remove gateway prefix like "CM.MNQZ6" -> "MNQZ6"
      const symbol = rawSymbol.replace(/^CM\./i, "").trim().toUpperCase();

      const parsedQty = parseQuantity(rawQty);
      if (!Number.isFinite(parsedQty) || parsedQty === 0) {
        skippedRows++;
        return;
      }
      const quantity = Math.abs(parsedQty);

      const price = parseMoney(rawPrice);
      if (!Number.isFinite(price) || price <= 0) {
        skippedRows++;
        return;
      }

      // Determine side based on mov_type or quantity sign
      let side: "buy" | "sell";
      if (movType === "1" || movType === "4") {
        side = "buy";
      } else if (movType === "2" || movType === "3") {
        side = "sell";
      } else if (parsedQty > 0) {
        side = "buy";
      } else {
        side = "sell";
      }

      // Timestamp resolution: mov_time has local time with GMT offset; created_on is ISO UTC
      let executedAt: string | null = null;
      if (movTime) {
        const parsedDate = Date.parse(movTime);
        if (!isNaN(parsedDate)) {
          executedAt = new Date(parsedDate).toISOString();
        } else {
          executedAt = parseTimestamp(movTime, options.timeZone, options.dateOrder);
        }
      }
      if (!executedAt && createdOn) {
        const parsedCreated = Date.parse(createdOn);
        if (!isNaN(parsedCreated)) {
          executedAt = new Date(parsedCreated).toISOString();
        } else {
          executedAt = parseTimestamp(createdOn, options.timeZone, options.dateOrder);
        }
      }

      if (!executedAt) {
        skippedRows++;
        return;
      }

      const parsedProfit = rawProfit ? parseMoney(rawProfit) : NaN;
      const reportedGrossPnl = Number.isFinite(parsedProfit) ? parsedProfit : undefined;

      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee: 0,
        executedAt,
        assetClass: "futures",
        importMetadata: {
          id: rawOrder || `wc-${index}`,
          order: index,
          reportedGrossPnl,
        },
      });
    });

    const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "wealthcharts",
      executions,
      skippedRows,
      warnings: [],
      account: detectedAccount,
      sourceAccounts: Array.from(accounts),
    };
  },
};
