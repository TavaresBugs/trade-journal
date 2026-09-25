import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const tefs: ImportFormat = {
  id: "tefs",
  label: "TEFS Evolution (trades export)",
  detect: (headers, content) => {
    return (
      (headers.includes("Date/Time") && headers.includes("Trading exchange") && headers.includes("Gross P/L")) ||
      (content.includes("Date/Time;") && content.includes("Gross P/L;") && content.includes("Execution fee;"))
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const rows = parseCsv(content);
    if (rows.length < 2) {
      return { format: "tefs", executions: [], skippedRows: 0, warnings: [] };
    }

    const header = rows[0]!.map((c) => c.trim().toLowerCase());
    const dateIdx = header.findIndex((h) => h.includes("date/time") || h === "date");
    const symIdx = header.indexOf("symbol");
    const sideIdx = header.indexOf("side");
    const qtyIdx = header.indexOf("quantity");
    const priceIdx = header.indexOf("price");
    const grossPnlIdx = header.findIndex((h) => h.includes("gross p/l"));
    const feeIdx = header.findIndex((h) => h.includes("fee") || h.includes("commission"));

    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length < 5) {
        skippedRows++;
        continue;
      }

      const symbol = (symIdx !== -1 ? row[symIdx] : "")?.trim().toUpperCase();
      const sideRaw = (sideIdx !== -1 ? row[sideIdx] : "")?.trim().toLowerCase();
      const isBuy = sideRaw === "buy" || sideRaw === "b";
      const isSell = sideRaw === "sell" || sideRaw === "s";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(qtyIdx !== -1 ? row[qtyIdx] : ""));
      const price = parseMoney(priceIdx !== -1 ? row[priceIdx] : "");
      const timeRaw = (dateIdx !== -1 ? row[dateIdx] : "")?.trim();
      const executedAt = parseTimestamp(timeRaw, options.timeZone, options.dateOrder ?? "DMY");

      if (!symbol || !executedAt || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        skippedRows++;
        continue;
      }

      const fee = Math.abs(parseMoney(feeIdx !== -1 ? row[feeIdx] : "0"));
      const grossPnlRaw = parseMoney(grossPnlIdx !== -1 ? row[grossPnlIdx] : "0");
      const id = `tefs:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: Number.isFinite(fee) ? fee : 0,
        executedAt,
        assetClass: "equity",
        importMetadata: {
          id,
          order: executions.length,
          reportedGrossPnl: Number.isFinite(grossPnlRaw) && grossPnlRaw !== 0 ? grossPnlRaw : undefined,
          preserveFee: fee > 0,
        },
      });
    }

    return {
      format: "tefs",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
