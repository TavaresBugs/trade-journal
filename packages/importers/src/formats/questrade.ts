import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const questrade: ImportFormat = {
  id: "questrade",
  label: "Questrade (orders export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["symbol"],
      ["status"],
      ["action"],
      ["fill qty", "fill price"],
      ["updated time", "time placed"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const status = (pick(row, ["status"]) ?? "").trim().toLowerCase();
      if (status !== "executed") {
        skippedRows++;
        continue;
      }

      const acctRaw = pick(row, ["account"])?.trim() ?? "";
      const acctMatch = acctRaw.match(/^(\d+)/);
      const acct = acctMatch ? acctMatch[1] : acctRaw;
      if (acct) accounts.add(acct);

      const action = (pick(row, ["action"]) ?? "").trim().toUpperCase();
      const isBuy = action === "BUY" || action === "BTO" || action === "BTC";
      const isSell = action === "SELL" || action === "STO" || action === "STC";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const symbolRaw = pick(row, ["symbol"]) ?? "";
      const symbol = symbolRaw.trim();
      const price = parseMoney(pick(row, ["fill price", "limit"]));
      const quantity = Math.abs(parseQuantity(pick(row, ["fill qty", "qty"])));

      const timeRaw = pick(row, ["updated time", "time placed"]) ?? "";
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const fee = Math.abs(parseMoney(pick(row, ["total fees", "commission"])));
      const optType = (pick(row, ["option type"]) ?? "").trim().toLowerCase();
      const isOption = optType === "call" || optType === "put" || /\d[CP]\d/.test(symbol);

      const orderId = pick(row, ["order id"])?.replace(/,/g, "").trim() ?? "";
      const acctPrefix = acct ? `${acct}:` : "";
      const id = orderId
        ? `questrade:${acctPrefix}${orderId}:${i}`
        : `questrade:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: Number.isFinite(fee) ? fee : 0,
        executedAt,
        assetClass: isOption ? "option" : "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: fee > 0,
        },
      });
    }

    const account = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "questrade",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
