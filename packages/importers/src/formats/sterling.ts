import { parseCsv } from "../csv";
import { parseDateAndTime } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";

export const sterling: ImportFormat = {
  id: "sterling",
  label: "Sterling Trader Pro (executions export)",
  detect: (_headers, content) => {
    const text = content.slice(0, 1000);
    return (
      (text.includes(",BOT,") || text.includes(",SLD,") || text.includes(",SLD SHRT,")) &&
      /\d{2}\/\d{2}\/\d{2,4},\d{2}:\d{2}:\d{2}/.test(text)
    );
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const rows = parseCsv(content);
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const [i, row] of rows.entries()) {
      if (row.length < 5) {
        skippedRows++;
        continue;
      }

      // cols: [0: date, 1: time, 2: symbol, 3: qty, 4: price, 5: action]
      const dateRaw = row[0]?.trim();
      const timeRaw = row[1]?.trim();
      const symbol = row[2]?.trim().toUpperCase() ?? "";
      const qtyRaw = row[3]?.trim() ?? "";
      const priceRaw = row[4]?.trim() ?? "";
      const action = row[5]?.trim().toUpperCase() ?? "";

      const isBuy = action === "BOT" || action === "BUY" || action === "B";
      const isSell =
        action === "SLD" || action === "SLD SHRT" || action === "SELL" || action === "S";
      if (!isBuy && !isSell) {
        skippedRows++;
        continue;
      }

      const quantity = Math.abs(parseQuantity(qtyRaw));
      const price = parseMoney(priceRaw);
      const executedAt = parseDateAndTime(dateRaw, timeRaw, options.timeZone, options.dateOrder);

      if (
        !symbol ||
        !executedAt ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        skippedRows++;
        continue;
      }

      const id = `sterling:${executedAt}:${symbol}:${i}`;

      executions.push({
        symbol,
        side: isBuy ? "buy" : "sell",
        quantity,
        price,
        fee: 0,
        executedAt,
        assetClass: "equity",
        importMetadata: {
          id,
          order: executions.length,
          preserveFee: false,
        },
      });
    }

    return {
      format: "sterling",
      executions,
      skippedRows,
      warnings: [],
    };
  },
};
