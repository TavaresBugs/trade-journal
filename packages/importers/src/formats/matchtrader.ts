import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const matchtrader: ImportFormat = {
  id: "matchtrader",
  label: "Match-Trader (HTML export)",
  detect: (_headers, content) => {
    return (
      (content.includes("Closed positions") || content.includes("Export Statement")) &&
      content.includes("Open price") &&
      content.includes("Close Price") &&
      /<html/i.test(content)
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const accountMatch =
      content.match(/Account:\s*([A-Za-z0-9_-]+)/i) ||
      content.match(/Export Statement:\s*([A-Za-z0-9_-]+)/i);
    const account = accountMatch ? accountMatch[1] : undefined;

    const trRegex = /<tr\b[^>]*>(.*?)<\/tr>/gis;
    let match;
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    while ((match = trRegex.exec(content)) !== null) {
      const tdRegex = /<td\b[^>]*>(.*?)<\/td>/gis;
      const cols: string[] = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(match[1]!)) !== null) {
        cols.push(tdMatch[1]!.replace(/<[^>]+>/g, "").trim());
      }

      if (cols.length < 10 || cols[0]?.toUpperCase() === "ID") {
        continue;
      }

      // cols: [0: ID, 1: Symbol, 2: Open time, 3: Volume, 4: Side, 5: Close time, 6: Open price, 7: Close Price, 8: SL, 9: TP, 10: Swap, 11: Commission, 12: Profit, 13: Reason]
      const id = cols[0] ?? "";
      const symbol = (cols[1] ?? "").toUpperCase();
      const openTimeRaw = cols[2] ?? "";
      const volumeRaw = cols[3] ?? "";
      const sideRaw = (cols[4] ?? "").toLowerCase();
      const closeTimeRaw = cols[5] ?? "";
      const openPriceRaw = cols[6] ?? "";
      const closePriceRaw = cols[7] ?? "";
      const commRaw = cols[11] ?? "0";
      const profitRaw = cols[12] ?? "0";

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

      const isLong = sideRaw.includes("buy");
      const entrySide = isLong ? "buy" : "sell";
      const exitSide = isLong ? "sell" : "buy";

      const assetClass =
        /^(BTC|ETH|SOL|XRP|DOGE)/i.test(symbol)
          ? "crypto"
          : /^(US30|US100|US500|GER40|UK100|NAS100|SPX500|ES|NQ)/i.test(symbol)
            ? "futures"
            : "forex";

      const acctPrefix = account ? `${account}:` : "";
      const idPrefix = id ? `matchtrader:${acctPrefix}${id}` : `matchtrader:${acctPrefix}${executions.length}`;

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
      format: "matchtrader",
      executions,
      skippedRows,
      warnings: [],
      account,
      sourceAccounts: account ? [account] : undefined,
    };
  },
};
