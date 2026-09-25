import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { parseSide } from "./fills";
import type { AssetClass } from "@luxalgo/journal-core";

export const tradestation: ImportFormat = {
  id: "tradestation",
  label: "TradeStation",
  detect: (headers) =>
    hasHeaders(headers, [
      ["accountnumber", "account number"],
      ["transaction", "side"],
      ["quantity", "qty"],
      ["price"],
      ["orderid", "order id"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [index, row] of records.entries()) {
      const rawAccount = pick(row, ["accountnumber", "account number", "account"]);
      if (rawAccount && rawAccount.trim()) accounts.add(rawAccount.trim());

      const symbolRaw = pick(row, ["symbol"]);
      const transRaw = pick(row, ["transaction", "side", "type"]);
      const qtyRaw = pick(row, ["quantity", "qty"]);
      const priceRaw = pick(row, ["price"]);
      const timeRaw = pick(row, ["activitytime", "activity time", "time", "date"]);

      if (!symbolRaw || !transRaw || !qtyRaw || !priceRaw || !timeRaw) {
        skippedRows++;
        continue;
      }

      const symbol = symbolRaw.trim().toUpperCase();
      const side = parseSide(transRaw);
      const quantity = Math.abs(parseQuantity(qtyRaw));
      const price = parseMoney(priceRaw);

      // TradeStation timestamps can have millisecond colons, e.g. "11/4/2022 10:37:28:443"
      const cleanedTime = timeRaw.replace(/:(\d{3})$/, ".$1");
      const executedAt = parseTimestamp(cleanedTime, options.timeZone, options.dateOrder || "MDY");

      if (
        !side ||
        !executedAt ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        skippedRows++;
        continue;
      }

      const rawFee = pick(row, ["commission", "comm"]);
      const fee = Math.abs(parseMoney(rawFee) || 0);

      const orderId = pick(row, ["orderid", "order id"])?.trim();
      const execId = orderId
        ? `tradestation:order:${orderId}`
        : `tradestation:${executedAt}:${symbol}:${index}`;

      const callPut = (pick(row, ["callput", "call/put"]) ?? "").trim().toUpperCase();
      const assetClass: AssetClass = callPut === "CALL" || callPut === "PUT" ? "option" : "equity";

      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee,
        executedAt,
        assetClass,
        importMetadata: {
          id: execId,
          order: index,
          preserveFee: fee > 0,
        },
      });
    }

    const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "tradestation",
      executions,
      skippedRows,
      warnings: [],
      account: detectedAccount,
      sourceAccounts: Array.from(accounts),
    };
  },
};
