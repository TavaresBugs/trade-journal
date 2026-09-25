import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const sierrachart: ImportFormat = {
  id: "sierrachart",
  label: "Sierra Chart (Activity/Fills export)",
  detect: (headers, content) => {
    return (
      (headers.includes("ActivityType") &&
        headers.includes("Symbol") &&
        headers.includes("BuySell")) ||
      (content.slice(0, 500).includes("InternalOrderID") &&
        content.slice(0, 500).includes("FillPrice"))
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const rows = parseCsv(content);
    if (rows.length < 2) {
      return { format: "sierrachart", executions: [], skippedRows: 0, warnings: ["No rows found"] };
    }

    const header = rows[0]!.map((c) => c.trim().toLowerCase());
    const actIdx = header.indexOf("activitytype");
    const dateIdx = header.findIndex((h) => h === "datetime" || h === "transdatetime");
    const symIdx = header.indexOf("symbol");
    const sideIdx = header.findIndex((h) => h === "buysell" || h === "side");
    const fillPriceIdx = header.indexOf("fillprice");
    const priceIdx = fillPriceIdx !== -1 ? fillPriceIdx : header.indexOf("price");
    const filledQtyIdx = header.indexOf("filledquantity");
    const qtyIdx = filledQtyIdx !== -1 ? filledQtyIdx : header.indexOf("quantity");
    const acctIdx = header.indexOf("tradeaccount");
    const idIdx = header.findIndex(
      (h) => h === "fillexecutionserviceid" || h === "internalorderid" || h === "serviceorderid",
    );

    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length < 5) {
        skippedRows++;
        continue;
      }

      const act = actIdx !== -1 ? row[actIdx]?.trim().toLowerCase() : "";
      if (act && act !== "fills" && act !== "fill") {
        skippedRows++;
        continue;
      }

      const acct = acctIdx !== -1 ? row[acctIdx]?.trim() : "";
      if (acct) accounts.add(acct);

      const symRaw = (symIdx !== -1 ? row[symIdx] : "")?.trim();
      const symbol = symRaw ? symRaw.split(".")[0]!.toUpperCase() : "";
      const sideRaw = (sideIdx !== -1 ? row[sideIdx] : "")?.trim().toLowerCase();
      const isBuy = sideRaw === "buy" || sideRaw === "b";
      const isSell = sideRaw === "sell" || sideRaw === "s";

      const price = parseMoney(priceIdx !== -1 ? row[priceIdx] : "");
      const quantity = parseQuantity(qtyIdx !== -1 ? row[qtyIdx] : "");
      const timeRaw = (dateIdx !== -1 ? row[dateIdx] : "")?.trim();
      const normalizedTime = timeRaw
        ? timeRaw.replace(/\s+/g, " ").replace(/\.(\d{3})\d+/, ".$1")
        : "";
      const executedAt = parseTimestamp(normalizedTime, options.timeZone, options.dateOrder);

      if (
        !symbol ||
        !executedAt ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price)
      ) {
        skippedRows++;
        continue;
      }

      const rawId = idIdx !== -1 ? row[idIdx]?.trim() : "";
      const acctPrefix = acct ? `${acct}:` : "";
      const id = rawId
        ? `sierrachart:${acctPrefix}${rawId}`
        : `sierrachart:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: 0,
        executedAt,
        assetClass: "futures",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: false,
        },
      });
    }

    const account = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "sierrachart",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
