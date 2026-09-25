import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const rithmic: ImportFormat = {
  id: "rithmic",
  label: "Rithmic (R | Trader orders export)",
  detect: (headers, content) => {
    return (
      content.includes("Completed Orders") ||
      (content.includes("Working Orders") && content.includes("Qty Filled")) ||
      (headers.includes("Account") &&
        headers.includes("Qty Filled") &&
        headers.includes("Order Number"))
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    // If multi-section, extract Completed Orders section
    let targetText = content;
    const completedIdx = content.indexOf("Completed Orders");
    if (completedIdx !== -1) {
      targetText = content.slice(completedIdx + "Completed Orders".length);
    }

    const rows = parseCsv(targetText);
    if (rows.length < 2) {
      return {
        format: "rithmic",
        executions: [],
        skippedRows: 0,
        warnings: ["No data rows found"],
      };
    }

    // Find the header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i]!.map((c) => c.trim().toLowerCase());
      if (
        r.includes("account") &&
        (r.includes("buy/sell") || r.includes("side")) &&
        r.includes("status")
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return {
        format: "rithmic",
        executions: [],
        skippedRows: rows.length,
        warnings: ["Headers not recognized"],
      };
    }

    const header = rows[headerIdx]!.map((c) => c.trim().toLowerCase());
    const accountIdx = header.indexOf("account");
    const statusIdx = header.indexOf("status");
    const sideIdx = header.findIndex((h) => h === "buy/sell" || h === "side" || h === "b/s");
    const symbolIdx = header.indexOf("symbol");
    const priceIdx = header.findIndex((h) => h.includes("avg fill price") || h === "price");
    const qtyIdx = header.findIndex((h) => h === "qty filled" || h === "quantity" || h === "qty");
    const orderIdx = header.findIndex(
      (h) => h === "order number" || h === "order id" || h === "orderid",
    );
    const timeIdx = header.findIndex((h) => h.includes("update time") || h.includes("time"));
    const commIdx = header.findIndex(
      (h) => h.includes("commission fill rate") || h === "commission",
    );

    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    let skippedRows = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length < 5) {
        skippedRows++;
        continue;
      }

      const status = (statusIdx !== -1 ? row[statusIdx] : "")?.trim().toLowerCase();
      // Only process filled orders
      if (status && status !== "filled") {
        skippedRows++;
        continue;
      }

      const acct = (accountIdx !== -1 ? row[accountIdx] : "")?.trim();
      if (acct) accounts.add(acct);

      const sideRaw = (sideIdx !== -1 ? row[sideIdx] : "")?.trim().toLowerCase();
      const isBuy = sideRaw === "b" || sideRaw === "buy";
      const isSell = sideRaw === "s" || sideRaw === "sell";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const symbol = (symbolIdx !== -1 ? row[symbolIdx] : "")?.trim().toUpperCase();
      const price = parseMoney(priceIdx !== -1 ? row[priceIdx] : "");
      const quantity = parseQuantity(qtyIdx !== -1 ? row[qtyIdx] : "");
      const timeRaw = (timeIdx !== -1 ? row[timeIdx] : "")?.trim();
      const executedAt = parseTimestamp(
        timeRaw,
        options.timeZone ?? "America/New_York",
        options.dateOrder,
      );

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

      const fee = Math.abs(parseMoney(commIdx !== -1 ? row[commIdx] : "0"));
      const orderNum = orderIdx !== -1 ? row[orderIdx]?.trim() : "";
      const acctPrefix = acct ? `${acct}:` : "";
      const id = orderNum
        ? `rithmic:${acctPrefix}${orderNum}`
        : `rithmic:${acctPrefix}${executedAt}:${symbol}:${executions.length}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: Number.isFinite(fee) ? fee : 0,
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
      format: "rithmic",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
