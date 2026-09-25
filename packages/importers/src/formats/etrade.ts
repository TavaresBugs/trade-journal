import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const etrade: ImportFormat = {
  id: "etrade",
  label: "Power E*TRADE (orders export)",
  detect: (headers, content) => {
    return (
      (content.includes("Power E*TRADE") || content.includes("Orders, as of")) &&
      content.includes("Fill") &&
      content.includes("Description")
    ) || (
      headers.includes("Fill") && headers.includes("Description") && headers.includes("Market")
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const acctMatch = content.match(/Account\s+([A-Za-z0-9_-]+)/i);
    const account = acctMatch ? acctMatch[1] : undefined;

    const rows = parseCsv(content);
    if (rows.length < 2) {
      return { format: "etrade", executions: [], skippedRows: 0, warnings: [] };
    }

    // Find the header row with Symbol and Fill
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const r = rows[i]!.map((c) => c.trim().toLowerCase());
      if (r.includes("symbol") && r.includes("fill") && r.includes("description")) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return { format: "etrade", executions: [], skippedRows: rows.length, warnings: ["Header not found"] };
    }

    const header = rows[headerIdx]!.map((c) => c.trim().toLowerCase());
    const symIdx = header.indexOf("symbol");
    const statusIdx = header.indexOf("status");
    const fillIdx = header.indexOf("fill");
    const descIdx = header.indexOf("description");
    const timeIdx = header.indexOf("time");
    const idIdx = header.indexOf("id");
    const acctColIdx = header.indexOf("account");

    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    if (account) accounts.add(account);
    let skippedRows = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length < 4) {
        skippedRows++;
        continue;
      }

      const status = (statusIdx !== -1 ? row[statusIdx] : "")?.trim().toLowerCase();
      if (status && status !== "filled") {
        skippedRows++;
        continue;
      }

      const rowAcct = (acctColIdx !== -1 ? row[acctColIdx] : "")?.trim();
      if (rowAcct) accounts.add(rowAcct);

      const symbol = (symIdx !== -1 ? row[symIdx] : "")?.trim().toUpperCase();
      const fillStr = (fillIdx !== -1 ? row[fillIdx] : "")?.trim() ?? "";
      // Fill is "20 @ 0.72"
      const fillParts = fillStr.split("@");
      if (fillParts.length < 2) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(fillParts[0]));
      const price = parseMoney(fillParts[1]);

      const desc = (descIdx !== -1 ? row[descIdx] : "")?.trim().toLowerCase() ?? "";
      const isBuy = desc.startsWith("buy");
      const isSell = desc.startsWith("sell");
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const timeRaw = (timeIdx !== -1 ? row[timeIdx] : "")?.trim();
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder);

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const isOption = desc.includes("put") || desc.includes("call");
      const rawId = idIdx !== -1 ? row[idIdx]?.trim() : "";
      const effectiveAcct = rowAcct || account;
      const acctPrefix = effectiveAcct ? `${effectiveAcct}:` : "";
      const id = rawId ? `etrade:${acctPrefix}${rawId}` : `etrade:${acctPrefix}${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: 0,
        executedAt,
        assetClass: isOption ? "option" : "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: false,
        },
      });
    }

    const detectedAccount = accounts.size > 0 ? Array.from(accounts)[0] : undefined;

    return {
      format: "etrade",
      executions,
      skippedRows,
      warnings: [],
      account: detectedAccount,
      sourceAccounts: accounts.size > 0 ? Array.from(accounts) : undefined,
    };
  },
};
