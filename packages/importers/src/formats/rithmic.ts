import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const rithmic: ImportFormat = {
  id: "rithmic",
  label: "Rithmic (R | Trader orders export)",
  detect: (headers, content) => {
    const lowerContent = content.toLowerCase();
    const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
    return (
      lowerContent.includes("completed orders") ||
      (lowerContent.includes("working orders") && lowerContent.includes("qty filled")) ||
      (lowerHeaders.includes("account") &&
        lowerHeaders.includes("qty filled") &&
        (lowerHeaders.includes("order number") || lowerHeaders.includes("order id")))
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    // If multi-section, extract Completed Orders section
    let targetText = content;
    const completedMatch = content.match(/completed orders/i);
    if (completedMatch && completedMatch.index !== undefined) {
      targetText = content.slice(completedMatch.index + completedMatch[0].length);
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
        (r.includes("buy/sell") || r.includes("side") || r.includes("b/s")) &&
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
    const commTotalIdx = header.findIndex(
      (h) => h === "commission" || h === "comm" || h === "total commission",
    );
    const commRateIdx = header.findIndex(
      (h) => h.includes("commission fill rate") || h.includes("fill rate"),
    );

    let detectedTz: string | undefined;
    for (const col of header) {
      const match = col.match(/\((edt|est|cdt|cst|mdt|mst|pdt|pst|utc|gmt)\)/i);
      if (match) {
        const abbr = match[1]!.toLowerCase();
        if (abbr === "edt" || abbr === "est") detectedTz = "America/New_York";
        else if (abbr === "cdt" || abbr === "cst") detectedTz = "America/Chicago";
        else if (abbr === "mdt" || abbr === "mst") detectedTz = "America/Denver";
        else if (abbr === "pdt" || abbr === "pst") detectedTz = "America/Los_Angeles";
        else if (abbr === "utc" || abbr === "gmt") detectedTz = "UTC";
        break;
      }
    }
    const defaultZone = options.timeZone ?? detectedTz ?? "America/New_York";

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
      const qtyRaw = qtyIdx !== -1 ? row[qtyIdx] : "";
      const rawQtyParsed = parseMoney(qtyRaw);
      const quantity =
        Number.isFinite(rawQtyParsed) && rawQtyParsed > 0 ? parseQuantity(qtyRaw) : 0;

      // Discard non-filled orders, cancelled orders, and orders with zero filled quantity
      if (
        status !== "filled" ||
        /cancel/i.test(status) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
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
      const timeRaw = (timeIdx !== -1 ? row[timeIdx] : "")?.trim();
      const executedAt = parseTimestamp(timeRaw, defaultZone, options.dateOrder);

      if (
        !symbol ||
        !executedAt ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        skippedRows++;
        continue;
      }

      // Calculate fee: if dedicated Commission column has value, use it;
      // otherwise calculate fee as quantity * commission fill rate
      let fee = 0;
      const rawComm = commTotalIdx !== -1 ? row[commTotalIdx]?.trim() : "";
      const parsedComm = parseMoney(rawComm);
      if (rawComm && Number.isFinite(parsedComm) && Math.abs(parsedComm) > 0) {
        fee = Math.abs(parsedComm);
      } else if (commRateIdx !== -1) {
        const rawRate = row[commRateIdx]?.trim();
        const rate = parseMoney(rawRate);
        if (Number.isFinite(rate) && rate > 0) {
          fee = Number((quantity * rate).toFixed(2));
        }
      }

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
