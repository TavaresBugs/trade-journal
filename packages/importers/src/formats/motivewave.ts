import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const motivewave: ImportFormat = {
  id: "motivewave",
  label: "MotiveWave (trades export)",
  detect: (headers) =>
    hasHeaders(headers, [["account"], ["ticket"], ["symbol"], ["action"], ["quantity"], ["price"]]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const acct = pick(row, ["account"]);
      if (acct && acct.trim()) accounts.add(acct.trim());

      const symbolRaw = pick(row, ["symbol"]) ?? "";
      let symbol = symbolRaw.trim().toUpperCase();
      if (symbol.startsWith("/")) symbol = symbol.slice(1);

      const action = (pick(row, ["action"]) ?? "").trim().toUpperCase();
      const isBuy = action === "BOT" || action === "BUY" || action === "B";
      const isSell = action === "SLD" || action === "SELL" || action === "S";

      const price = parseMoney(pick(row, ["price"]));
      const quantity = parseQuantity(pick(row, ["quantity"]));
      const timeRaw = pick(row, ["time", "date"]) ?? "";
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

      const commRaw = Math.abs(parseMoney(pick(row, ["commission", "fee"])));
      const fee = Number.isFinite(commRaw) ? commRaw : 0;
      const ticket = pick(row, ["ticket"]) ?? "";
      const acctPrefix = acct ? `${acct}:` : "";
      const id = ticket
        ? `motivewave:${acctPrefix}${ticket}`
        : `motivewave:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee,
        executedAt,
        assetClass: "futures",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: fee > 0,
        },
      });
    }

    const account = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "motivewave",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
