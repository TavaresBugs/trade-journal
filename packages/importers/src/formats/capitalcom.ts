import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const capitalcom: ImportFormat = {
  id: "capitalcom",
  label: "Capital.com (trades export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["trade id"],
      ["account id"],
      ["instrument symbol"],
      ["execution type", "order id"],
      ["price"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const acct = pick(row, ["account id", "account"]);
      if (acct && acct.trim()) accounts.add(acct.trim());

      const symbolRaw = pick(row, ["instrument symbol", "symbol"]) ?? "";
      const symbol = symbolRaw.trim().toUpperCase();

      const qtyRaw = parseQuantity(pick(row, ["quantity", "size"]));
      if (!Number.isFinite(qtyRaw) || qtyRaw === 0) {
        skippedRows++;
        continue;
      }
      const side: "buy" | "sell" = qtyRaw > 0 ? "buy" : "sell";
      const quantity = Math.abs(qtyRaw);

      const price = parseMoney(pick(row, ["price"]));
      const timeRaw = pick(row, ["timestamp", "time", "date"]) ?? "";
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const feeRaw = Math.abs(parseMoney(pick(row, ["fee"])));
      const swapRaw = Math.abs(parseMoney(pick(row, ["swap", "swap converted"])));
      const totalFee = (Number.isFinite(feeRaw) ? feeRaw : 0) + (Number.isFinite(swapRaw) ? swapRaw : 0);

      const rplRaw = parseMoney(pick(row, ["rpl converted", "rpl"]));
      const execId = pick(row, ["exec id", "trade id", "order id"]);
      const acctPrefix = acct ? `${acct}:` : "";
      const id = execId ? `capitalcom:${acctPrefix}${execId}` : `capitalcom:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee: totalFee,
        executedAt,
        assetClass: /^(BTC|ETH|SOL|XRP|DOGE)/i.test(symbol) ? "crypto" : "equity",
        importMetadata: {
          id,
          order: executions.length,
          reportedGrossPnl: Number.isFinite(rplRaw) && rplRaw !== 0 ? rplRaw : undefined,
          preserveFee: totalFee > 0,
        },
      });
    }

    const account = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "capitalcom",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
