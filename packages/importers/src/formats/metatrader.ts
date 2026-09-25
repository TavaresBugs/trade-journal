import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import { parseHistory } from "./history";
import {
  tradeToExecutions,
  type ImportFormat,
  type ImportedExecution,
  type ImportedTrade,
  type ParsedImport,
} from "../types";

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

const rowCells = (rowHtml: string): string[] =>
  [...rowHtml.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) => stripTags(m[1]!));

/**
 * MetaTrader 4/5 statement (.htm/.html).
 * - Multi-section statements with a Positions section are parsed by the specialized
 *   history engine, preserving position tickets, S/L, T/P, profit, and gross/net fees.
 * - Single-table statements are reconstructed as entry + exit execution pairs.
 */
export const metatrader: ImportFormat = {
  id: "metatrader",
  label: "MetaTrader 4/5 (HTML statement)",
  detect: (_headers, content) =>
    /<html/i.test(content) &&
    /(MetaTrader|MetaQuotes|Closed Transactions|Strategy Tester|Trade History Report)/i.test(
      content,
    ),
  parse: (content, options): ParsedImport => {
    // Extract Account ID if present in header (e.g. "Account: 6059687" or "Statement: 6059687")
    const accMatch =
      content.match(/Account:\s*([0-9A-Za-z_-]+)/i) ||
      content.match(/Statement:\s*([0-9A-Za-z_-]+)/i) ||
      content.match(/<title>\s*([0-9A-Za-z_-]+):/i);
    const account = accMatch ? accMatch[1] : undefined;

    // If this statement contains a Positions section, let the specialized history adapter
    // parse it into clean position round-trips with S/L, T/P, profit and official tickets.
    const hasPositions = /Positions|Posições/i.test(content);
    if (hasPositions) {
      const historyParsed = parseHistory(content, options);
      if (historyParsed && historyParsed.executions.length > 0) {
        return {
          ...historyParsed,
          account: historyParsed.account ?? account,
          sourceAccounts: historyParsed.sourceAccounts ?? (account ? [account] : []),
        };
      }
    }

    const rows = [...content.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => rowCells(m[1]!));
    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    // Check if this is an MT5 report with a Deals section
    let currentSection = "";
    const dealsRows: string[][] = [];

    for (const cells of rows) {
      const rowText = cells.join(" ");
      if (
        cells.length <= 3 &&
        cells.some(
          (c) =>
            c === "Positions" || c === "Deals" || c === "Orders" || c === "Trade History Report",
        )
      ) {
        if (rowText.includes("Positions")) currentSection = "positions";
        else if (rowText.includes("Orders")) currentSection = "orders";
        else if (rowText.includes("Deals")) currentSection = "deals";
        continue;
      }
      if (currentSection === "deals" && cells.length >= 10) {
        dealsRows.push(cells);
      }
    }

    if (dealsRows.length > 0) {
      // Parse MT5 Deals table
      for (const cells of dealsRows) {
        // Headers: Time, Deal, Symbol, Type, Direction, Volume, Price, Order, Cost, Commission, Fee, Swap, Profit, Balance, Comment
        if (cells[0] === "Time" || cells[1] === "Deal") continue;
        const type = (cells[3] ?? "").toLowerCase();
        if (type !== "buy" && type !== "sell") {
          // Skip balance, credit, bonus deposits
          continue;
        }

        const executedAt = parseTimestamp(cells[0], options.timeZone, options.dateOrder);
        const symbol = (cells[2] ?? "").trim().toUpperCase();
        const quantity = parseQuantity(cells[5]);
        const price = parseMoney(cells[6]);

        if (
          !executedAt ||
          !symbol ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          skippedRows++;
          continue;
        }

        const commission = Math.abs(parseMoney(cells[9]) || 0);
        const fee = Math.abs(parseMoney(cells[10]) || 0);
        const swap = Math.abs(parseMoney(cells[11]) || 0);
        const profit = parseMoney(cells[12]);
        const direction = (cells[4] ?? "").toLowerCase();

        executions.push({
          symbol,
          side: type as "buy" | "sell",
          quantity,
          price,
          fee: commission + fee + swap,
          executedAt,
          assetClass:
            symbol.includes("USD") || symbol.includes("EUR") || symbol.includes("GBP")
              ? "forex"
              : "cfd",
          importMetadata: {
            id: cells[1] || `mt5-${executions.length}`,
            order: executions.length,
            reportedGrossPnl: direction === "out" && Number.isFinite(profit) ? profit : undefined,
          },
        });
      }

      if (executions.length > 0) {
        return {
          format: "metatrader",
          executions,
          skippedRows,
          warnings: [],
          account,
          sourceAccounts: account ? [account] : [],
        };
      }
    }

    // Fallback: MT4 closed-transaction shape (or MT5 Positions when no Deals section)
    for (const cells of rows) {
      if (cells.length < 10) continue;
      const type = (cells[2] ?? "").toLowerCase();
      if (type !== "buy" && type !== "sell") continue;

      const openedAt = parseTimestamp(cells[1], options.timeZone, options.dateOrder);
      const quantity = parseQuantity(cells[3]);
      const symbol = (cells[4] ?? "").trim().toUpperCase();
      const entryPrice = parseMoney(cells[5]);

      let closeIndex = -1;
      for (let i = 6; i < cells.length; i++) {
        if (parseTimestamp(cells[i], options.timeZone, options.dateOrder)) {
          closeIndex = i;
          break;
        }
      }
      if (
        !openedAt ||
        closeIndex === -1 ||
        !symbol ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(entryPrice)
      ) {
        skippedRows++;
        continue;
      }
      const closedAt = parseTimestamp(cells[closeIndex], options.timeZone, options.dateOrder)!;
      const exitPrice = parseMoney(cells[closeIndex + 1]);
      if (!Number.isFinite(exitPrice)) {
        skippedRows++;
        continue;
      }
      const commission = Math.abs(parseMoney(cells[closeIndex + 2]) || 0);
      const swap = Math.abs(parseMoney(cells[closeIndex + 4] ?? cells[closeIndex + 3]) || 0);

      const trade: ImportedTrade = {
        symbol,
        direction: type === "buy" ? "long" : "short",
        quantity,
        entryPrice,
        exitPrice,
        openedAt,
        closedAt,
        fees: (Number.isFinite(commission) ? commission : 0) + (Number.isFinite(swap) ? swap : 0),
        assetClass: "forex",
      };
      executions.push(...tradeToExecutions(trade));
    }

    return {
      format: "metatrader",
      executions,
      skippedRows,
      warnings:
        executions.length > 0
          ? [
              "MetaTrader statements are trade-level; entry/exit executions were reconstructed at the reported prices. Swap was folded into fees.",
            ]
          : [],
      account,
      sourceAccounts: account ? [account] : [],
    };
  },
};
