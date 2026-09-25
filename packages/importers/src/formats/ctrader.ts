import { hasHeaders, parseCsv, pick, toRecords, type Row } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { ImportFormat, ImportOptions, ImportedExecution, ParsedImport } from "../types";
import { parseSide } from "./fills";

const stripTags = (s: string): string =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractHtmlRows = (html: string): Row[] => {
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const allRows = trMatches.map((m) =>
    [...m[1]!.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((c) => stripTags(c[1]!)),
  );

  const headerRow = allRows.find((r) => r.includes("Closing Direction") && r.includes("Symbol"));
  if (!headerRow) return [];

  const headers = headerRow.map((h) => h.toLowerCase().replace(/\s+/g, "").replace(/\([^)]*\)/g, ""));
  const dataRows = allRows.filter((r) => r.some((c) => c.startsWith("DID") || c.startsWith("OID")));

  return dataRows.map((r) => {
    const record: Row = {};
    for (let i = 0; i < headerRow.length; i++) {
      const key = headers[i];
      if (key && r[i] !== undefined) {
        record[key] = r[i]!;
      }
    }
    return record;
  });
};

/**
 * Spotware cTrader Deals / Statements export (.csv, .htm, .html).
 * Commonly used with prop firms like FTMO and multi-asset forex/CFD brokers.
 */
export const ctrader: ImportFormat = {
  id: "ctrader",
  label: "cTrader",
  detect: (headers, content) => {
    if (/<html/i.test(content) && (/(?:cTrader|cT\s*_)/i.test(content) || /Closing Direction/i.test(content))) {
      return true;
    }
    const hasDirections = hasHeaders(headers, [["closingdirection"], ["openingdirection"]]);
    const hasDealId = hasHeaders(headers, [["dealid", "deal", "dealno"]]);
    const hasPositionId = hasHeaders(headers, [["positionid", "position id"]]);
    const hasCtraderSpecifics = hasHeaders(headers, [
      [
        "closingdirection",
        "openingdirection",
        "channel",
        "swap",
      ],
    ]);

    if (hasDirections) return true;
    if (hasDealId && (hasPositionId || hasCtraderSpecifics)) return true;
    if (/cTrader/i.test(content) && (hasDealId || hasPositionId)) return true;
    return false;
  },
  parse: (content: string, options: ImportOptions): ParsedImport => {
    const isHtml = /<html/i.test(content);

    // Extract Account ID if present in header preamble or HTML title
    let account: string | undefined;
    const titleMatch = content.match(/<title>[\s\S]*?cT\s*_\s*([0-9A-Za-z_-]+)/i);
    const accountMatch =
      titleMatch ||
      content.slice(0, 3000).match(/Account\s*(?:Number|ID)?\s*[,:;]\s*"?([0-9A-Za-z_-]+)"?/i) ||
      content.slice(0, 3000).match(/Account\s*:\s*([0-9A-Za-z_-]+)/i);
    if (accountMatch) {
      account = accountMatch[1]?.trim();
    }

    const records: Row[] = isHtml ? extractHtmlRows(content) : toRecords(parseCsv(content));
    const executions: ImportedExecution[] = [];
    const accounts = new Set<string>();
    if (account) accounts.add(account);

    let skippedRows = 0;

    records.forEach((row, index) => {
      const rawDealId = pick(row, ["dealid", "deal id", "deal_id", "deal", "id"])?.trim();
      const rawPositionId = pick(row, ["positionid", "position id", "position_id", "position", "orderid"])?.trim();
      const rawAccount = pick(row, ["account", "accountnumber", "account id"])?.trim();
      if (rawAccount) accounts.add(rawAccount);

      const rawSymbol = pick(row, ["symbol", "instrument", "item"])?.trim();
      if (!rawSymbol) {
        skippedRows++;
        return;
      }
      const symbol = rawSymbol.replace(/_SB$/i, "").trim().toUpperCase();

      const rawVolume = pick(row, ["volume", "lots", "size", "quantity", "qty", "amount", "closingquantity"])?.trim();
      const numMatch = rawVolume?.match(/^[+-]?[\d.,]+/);
      const quantity = Math.abs(parseQuantity(numMatch ? numMatch[0] : rawVolume));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        skippedRows++;
        return;
      }

      // Check prices: closed deals report Entry Price + Closing Price; fills report Price
      const rawEntryPrice = pick(row, ["entryprice", "entry price", "openprice", "open price"])?.trim();
      const rawClosePrice = pick(row, ["closingprice", "closing price", "closeprice", "close price"])?.trim();
      const rawPrice = pick(row, ["price", "executionprice", "execution price"])?.trim();

      const entryPrice = rawEntryPrice ? parseMoney(rawEntryPrice) : NaN;
      const closePrice = rawClosePrice ? parseMoney(rawClosePrice) : NaN;
      const singlePrice = rawPrice ? parseMoney(rawPrice) : NaN;

      // Fees: Commission + Swap + Fee
      const comm = Math.abs(parseMoney(pick(row, ["commission", "comm"])?.trim()) || 0);
      const swap = Math.abs(parseMoney(pick(row, ["swap", "rollover"])?.trim()) || 0);
      const fee = Math.abs(parseMoney(pick(row, ["fee", "fees"])?.trim()) || 0);
      const totalFee = comm + swap + fee;

      // Profit
      const rawGrossPnl = pick(row, [
        "grosspl",
        "grossp&l",
        "gross p&l",
        "gross p/l",
        "gross",
        "grossgbp",
        "grossusd",
        "grosseur",
        "profit",
      ])?.trim();
      const rawNetPnl = pick(row, [
        "netpl",
        "netp&l",
        "net p&l",
        "net p/l",
        "net",
        "netgbp",
        "netusd",
        "netprofit",
        "net profit",
      ])?.trim();
      const grossPnl = rawGrossPnl ? parseMoney(rawGrossPnl) : NaN;
      const netPnl = rawNetPnl ? parseMoney(rawNetPnl) : NaN;
      const reportedGrossPnl = Number.isFinite(grossPnl)
        ? grossPnl
        : Number.isFinite(netPnl)
          ? netPnl + totalFee
          : undefined;

      // Timestamps
      const rawOpenTime = pick(row, [
        "opentime",
        "open time",
        "entrytime",
        "entry time",
        "createtime",
        "create time",
        "openingtime",
      ])?.trim();
      const rawCloseTime = pick(row, [
        "closingtime",
        "closing time",
        "closetime",
        "close time",
        "executiontime",
        "execution time",
        "time",
        "timestamp",
      ])?.trim();

      const closedAt = rawCloseTime
        ? parseTimestamp(rawCloseTime, options.timeZone, options.dateOrder)
        : null;
      const openedAt = rawOpenTime
        ? parseTimestamp(rawOpenTime, options.timeZone, options.dateOrder)
        : closedAt;

      // Direction / Sides
      const rawOpeningDir = pick(row, ["openingdirection", "opening direction"])?.trim();
      const rawClosingDir = pick(row, ["closingdirection", "closing direction"])?.trim();
      const rawDir = pick(row, ["direction", "side", "type", "action"])?.trim();

      const isTwoLegTrade = Number.isFinite(entryPrice) && entryPrice > 0 && Number.isFinite(closePrice) && closePrice > 0;

      if (isTwoLegTrade) {
        if (!closedAt || !openedAt) {
          skippedRows++;
          return;
        }

        // Determine if long or short
        let isLong = true;
        if (rawOpeningDir) {
          isLong = parseSide(rawOpeningDir) === "buy";
        } else if (rawClosingDir) {
          isLong = parseSide(rawClosingDir) === "sell";
        } else if (rawDir) {
          isLong = parseSide(rawDir) === "buy";
        }

        const idBase = rawDealId || rawPositionId || `deal-${index}`;

        // Entry execution
        executions.push({
          symbol,
          side: isLong ? "buy" : "sell",
          quantity,
          price: entryPrice,
          fee: 0,
          executedAt: openedAt,
          assetClass: "cfd",
          importMetadata: {
            id: `ctrader-${idBase}-entry`,
            order: index * 2,
            group: rawPositionId,
          },
        });

        // Exit execution
        executions.push({
          symbol,
          side: isLong ? "sell" : "buy",
          quantity,
          price: closePrice,
          fee: totalFee,
          executedAt: closedAt,
          assetClass: "cfd",
          importMetadata: {
            id: `ctrader-${idBase}-exit`,
            order: index * 2 + 1,
            group: rawPositionId,
            reportedGrossPnl,
            preserveFee: totalFee > 0,
          },
        });
      } else {
        // Single fill execution
        const price = Number.isFinite(closePrice) && closePrice > 0
          ? closePrice
          : Number.isFinite(entryPrice) && entryPrice > 0
            ? entryPrice
            : singlePrice;

        if (!Number.isFinite(price) || price <= 0) {
          skippedRows++;
          return;
        }

        const executedAt = closedAt || openedAt;
        if (!executedAt) {
          skippedRows++;
          return;
        }

        const sideStr = rawDir || rawOpeningDir || rawClosingDir || "";
        const side = parseSide(sideStr);
        if (!side) {
          skippedRows++;
          return;
        }

        const idBase = rawDealId || rawPositionId || `deal-${index}`;

        executions.push({
          symbol,
          side,
          quantity,
          price,
          fee: totalFee,
          executedAt,
          assetClass: "cfd",
          importMetadata: {
            id: `ctrader-${idBase}`,
            order: index,
            group: rawPositionId,
            reportedGrossPnl,
            preserveFee: totalFee > 0,
          },
        });
      }
    });

    return {
      format: "ctrader",
      executions,
      skippedRows,
      warnings: [],
      account: account || (accounts.size === 1 ? Array.from(accounts)[0] : undefined),
      sourceAccounts: Array.from(accounts),
    };
  },
};
