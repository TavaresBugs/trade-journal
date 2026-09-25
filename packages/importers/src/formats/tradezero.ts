import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseDateAndTime } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { parseSide } from "./fills";

const FEE_COLUMNS = ["comm", "sec", "taf", "nscc", "nasdaq", "ecnremove", "ecnadd"];

export const tradezero: ImportFormat = {
  id: "tradezero",
  label: "TradeZero",
  detect: (headers) =>
    hasHeaders(headers, [
      ["t/d", "td", "tradedate"],
      ["exectime", "exec time", "time"],
      ["symbol"],
      ["qty", "quantity"],
      ["price"],
      ["sec", "taf", "grossproceeds", "gross proceeds"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    const occurrences = new Map<string, number>();
    let skippedRows = 0;

    for (const [index, row] of records.entries()) {
      const rawAccount = pick(row, ["account", "accountnumber", "account id"]);
      if (rawAccount) accounts.add(rawAccount.trim());

      const symbolRaw = pick(row, ["symbol"]);
      const sideRaw = pick(row, ["side"]);
      const qtyRaw = pick(row, ["qty", "quantity"]);
      const priceRaw = pick(row, ["price"]);
      const tdRaw = pick(row, ["t/d", "td", "tradedate", "date"]);
      const timeRaw = pick(row, ["exectime", "exec time", "time"]);

      if (!symbolRaw || !sideRaw || !qtyRaw || !priceRaw || !tdRaw || !timeRaw) {
        skippedRows++;
        continue;
      }

      const symbol = symbolRaw.trim().toUpperCase();
      let side = parseSide(sideRaw);
      // TradeZero specifics: SS (Short Sale) = sell, BC (Buy to Cover) = buy
      const sideUpper = sideRaw.trim().toUpperCase();
      if (sideUpper === "SS" || sideUpper === "SSHORT") side = "sell";
      if (sideUpper === "BC" || sideUpper === "COVER") side = "buy";

      const quantity = Math.abs(parseQuantity(qtyRaw));
      const price = parseMoney(priceRaw);
      const executedAt = parseDateAndTime(
        tdRaw,
        timeRaw,
        options.timeZone || "America/New_York",
        options.dateOrder || "MDY",
      );

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

      // Sum all fee components
      let fee = 0;
      for (const col of FEE_COLUMNS) {
        const val = parseMoney(pick(row, [col]));
        if (Number.isFinite(val)) fee += Math.abs(val);
      }

      const grossProceeds = parseMoney(pick(row, ["grossproceeds", "gross proceeds"]));
      const netProceeds = parseMoney(pick(row, ["netproceeds", "net proceeds"]));

      const accountPrefix = rawAccount ? `${rawAccount.trim()}:` : "";
      const occurrenceKey = `${accountPrefix}${executedAt}:${symbol}:${side}:${quantity}`;
      const occurrence = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const execId = `tradezero:${occurrenceKey}:${occurrence}`;

      executions.push({
        symbol,
        side,
        quantity,
        price,
        fee,
        executedAt,
        assetClass: "equity",
        importMetadata: {
          id: execId,
          order: index,
          reportedGrossPnl: Number.isFinite(grossProceeds) ? grossProceeds : undefined,
          preserveFee: fee > 0,
        },
      });
    }

    const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "tradezero",
      executions,
      skippedRows,
      warnings: [],
      account: detectedAccount,
      sourceAccounts: Array.from(accounts),
    };
  },
};
