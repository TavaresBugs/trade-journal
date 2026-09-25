import { parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const ftmo: ImportFormat = {
  id: "ftmo",
  label: "FTMO (Challenge / Account CSV)",
  detect: (headers, content) => {
    const firstLine = content.slice(0, 500).toLowerCase();
    return (
      (firstLine.includes("ticket") &&
        firstLine.includes("open") &&
        firstLine.includes("close") &&
        firstLine.includes("profit") &&
        firstLine.includes("commissions")) ||
      (headers.includes("Ticket") && headers.includes("Volume") && headers.includes("Profit"))
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const rows = parseCsv(content);
    if (rows.length < 2) {
      return { format: "ftmo", executions: [], skippedRows: 0, warnings: ["File contains no data rows"] };
    }

    const headerRow = rows[0]!.map((h) => h.trim().toLowerCase());
    const ticketIdx = headerRow.indexOf("ticket");
    const openIdx = headerRow.indexOf("open");
    const typeIdx = headerRow.indexOf("type");
    const volumeIdx = headerRow.indexOf("volume");
    const symbolIdx = headerRow.indexOf("symbol");
    const priceIndices = headerRow
      .map((h, i) => (h === "price" ? i : -1))
      .filter((i) => i !== -1);
    const openPriceIdx = priceIndices[0] ?? -1;
    const closePriceIdx = priceIndices[1] ?? priceIndices[0] ?? -1;
    const closeIdx = headerRow.indexOf("close");
    const commIdx = headerRow.findIndex((h) => h.includes("commission"));
    const profitIdx = headerRow.indexOf("profit");

    const executions: ImportedExecution[] = [];
    const occurrences = new Map<string, number>();
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.length < 5) {
        skippedRows++;
        continue;
      }

      const ticket = ticketIdx !== -1 ? row[ticketIdx]?.trim() : "";
      const openTimeRaw = openIdx !== -1 ? row[openIdx]?.trim() : "";
      const closeTimeRaw = closeIdx !== -1 ? row[closeIdx]?.trim() : "";
      const typeRaw = (typeIdx !== -1 ? row[typeIdx]?.trim().toLowerCase() : "") ?? "";
      const volumeRaw = volumeIdx !== -1 ? row[volumeIdx]?.trim() : "";
      const symbolRaw = (symbolIdx !== -1 ? row[symbolIdx]?.trim() : "") ?? "";
      const openPriceRaw = openPriceIdx !== -1 ? row[openPriceIdx]?.trim() : "";
      const closePriceRaw = closePriceIdx !== -1 ? row[closePriceIdx]?.trim() : "";
      const commRaw = commIdx !== -1 ? row[commIdx]?.trim() : "0";
      const profitRaw = profitIdx !== -1 ? row[profitIdx]?.trim() : "0";

      const symbol = symbolRaw.toUpperCase();
      const quantity = parseQuantity(volumeRaw);
      const entryPrice = parseMoney(openPriceRaw);
      const exitPrice = parseMoney(closePriceRaw);
      const fee = Math.abs(parseMoney(commRaw));
      const profit = parseMoney(profitRaw);

      const openedAt = parseTimestamp(openTimeRaw, options.timeZone, options.dateOrder ?? "DMY");
      const closedAt = parseTimestamp(closeTimeRaw, options.timeZone, options.dateOrder ?? "DMY");

      if (
        !symbol ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(entryPrice) ||
        !Number.isFinite(exitPrice) ||
        !openedAt ||
        !closedAt
      ) {
        skippedRows++;
        continue;
      }

      const isLong = typeRaw.includes("buy");
      const entrySide = isLong ? "buy" : "sell";
      const exitSide = isLong ? "sell" : "buy";

      const assetClass =
        /^(BTC|ETH|SOL|XRP|DOGE)/i.test(symbol)
          ? "crypto"
          : /^(US30|US100|US500|GER40|UK100|NAS100|SPX500|ES|NQ)/i.test(symbol)
            ? "futures"
            : "forex";

      const occurrenceKey = `${openedAt}:${symbol}:${entrySide}:${quantity}:${entryPrice}`;
      const occ = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occ + 1);
      const idPrefix = ticket ? `ftmo:trade:${ticket}` : `ftmo:trade:${occurrenceKey}:${occ}`;

      executions.push({
        symbol,
        side: entrySide,
        quantity,
        price: entryPrice,
        fee: 0,
        executedAt: openedAt,
        assetClass,
        importMetadata: {
          id: `${idPrefix}:entry`,
          order: executions.length,
          preserveFee: false,
        },
      });

      executions.push({
        symbol,
        side: exitSide,
        quantity,
        price: exitPrice,
        fee,
        executedAt: closedAt,
        assetClass,
        importMetadata: {
          id: `${idPrefix}:exit`,
          order: executions.length,
          reportedGrossPnl: profit,
          preserveFee: fee > 0,
        },
      });
    }

    return {
      format: "ftmo",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
