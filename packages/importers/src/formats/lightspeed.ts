import { hasHeaders, parseCsv, pick, toRecords } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const lightspeed: ImportFormat = {
  id: "lightspeed",
  label: "Lightspeed (trades export)",
  detect: (headers) =>
    hasHeaders(headers, [
      ["account number"],
      ["symbol"],
      ["price"],
      ["qty", "quantity"],
      ["buy/sell", "side"],
      ["trade date", "raw exec. time"],
    ]),
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const records = toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (const [i, row] of records.entries()) {
      const transType = (pick(row, ["transtype"]) ?? "").trim().toLowerCase();
      if (transType && transType !== "trade") {
        skippedRows++;
        continue;
      }

      const acct = pick(row, ["account number", "account"])?.trim();
      if (acct) accounts.add(acct);

      const symbolRaw = pick(row, ["symbol"]) ?? "";
      const symbol = symbolRaw.trim().toUpperCase();

      const sideRaw = (pick(row, ["buy/sell", "side"]) ?? "").trim().toLowerCase();
      const isBuy = sideRaw.includes("buy") || sideRaw === "b";
      const isSell = sideRaw.includes("sell") || sideRaw.includes("short") || sideRaw === "s";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const qtyRaw = Math.abs(parseQuantity(pick(row, ["qty", "quantity"])));
      const price = parseMoney(pick(row, ["price"]));

      const rawTime = pick(row, ["raw exec. time", "execution time", "trade date"]) ?? "";
      const executedAt = parseTimestamp(rawTime, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(qtyRaw) || qtyRaw <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      // Sum all fees: Commission Amount + FeeSEC + FeeTAF + Fee1 + Fee2 + Fee3 + Fee4
      let totalFee = Math.abs(parseMoney(pick(row, ["commission amount"])));
      if (!Number.isFinite(totalFee)) totalFee = 0;
      for (const feeKey of ["feesec", "feetaf", "fee1", "fee2", "fee3", "fee4", "feestamp"]) {
        const val = Math.abs(parseMoney(pick(row, [feeKey])));
        if (Number.isFinite(val)) totalFee += val;
      }

      const tradeNum = pick(row, ["trade number", "original tradenumber"])?.trim() ?? "";
      const acctPrefix = acct ? `${acct}:` : "";
      const id = tradeNum
        ? `lightspeed:${acctPrefix}${tradeNum}:${i}`
        : `lightspeed:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity: qtyRaw,
        price,
        fee: totalFee,
        executedAt,
        assetClass: "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: totalFee > 0,
        },
      });
    }

    const account = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "lightspeed",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
