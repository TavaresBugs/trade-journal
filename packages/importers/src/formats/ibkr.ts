import { headerKey, parseCsv } from "../csv";
import { parseTimestamp } from "../dates";
import { parseMoney, parseQuantity } from "../numbers";
import type { AssetClass } from "@luxalgo/journal-core";
import type { ImportFormat, ImportedExecution, ParsedImport } from "../types";

import { parseSide } from "./fills";

const ASSET_MAP: Record<string, AssetClass> = {
  stocks: "equity",
  equityandindexoptions: "option",
  futures: "futures",
  forex: "forex",
  cryptocurrency: "crypto",
  cfds: "cfd",
};

const FLEX_ASSET_MAP: Record<string, AssetClass> = {
  stk: "equity",
  opt: "option",
  fut: "futures",
  war: "equity",
  cash: "forex",
  crypto: "crypto",
  cfd: "cfd",
};

export const FEE_COLUMNS = [
  "commission",
  "brokerexecutioncommission",
  "brokerclearingcommission",
  "thirdpartyexecutioncommission",
  "thirdpartyclearingcommission",
  "thirdpartyregulatorycommission",
  "othercommission",
  "tax",
] as const;

function parseIbkrFlex(rows: string[][], options: any): ParsedImport {
  const firstRow = rows[0] ?? [];
  const keys = firstRow.map(headerKey);
  const col = (name: string) => keys.indexOf(name);

  const executions: ImportedExecution[] = [];
  let skippedRows = 0;
  const accounts = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 0 || (row.length === 1 && row[0]?.trim() === "")) continue;

    const symbol = (row[col("symbol")] ?? row[col("underlyingsymbol")] ?? "").trim().toUpperCase();
    const rawSide = row[col("buysell")] ?? row[col("side")];
    const rawQty = row[col("quantity")];
    const qtySigned = parseMoney(rawQty);
    const side = rawSide
      ? parseSide(rawSide)
      : Number.isFinite(qtySigned) && qtySigned !== 0
        ? qtySigned > 0 ? "buy" : "sell"
        : null;
    const quantity = parseQuantity(rawQty);
    const price = parseMoney(row[col("price")] ?? row[col("tradeprice")]);
    const executedAt = parseTimestamp(row[col("datetime")], options.timeZone);

    let fee = 0;
    for (const feeCol of FEE_COLUMNS) {
      const c = col(feeCol);
      if (c !== -1) {
        const val = Math.abs(parseMoney(row[c]) || 0);
        if (Number.isFinite(val)) {
          fee += val;
        }
      }
    }

    const assetClass = FLEX_ASSET_MAP[headerKey(row[col("assetclass")] ?? "")];
    const acct = (row[col("clientaccountid")] ?? row[col("account")] ?? "").trim();
    if (acct) accounts.add(acct);

    if (
      !symbol ||
      !side ||
      !executedAt ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(price)
    ) {
      skippedRows++;
      continue;
    }

    const account = acct || Array.from(accounts)[0];
    const acctPrefix = account ? `${account}:` : "";
    const execIndex = executions.length;
    executions.push({
      symbol,
      side,
      quantity,
      price,
      fee: Number.isFinite(fee) ? fee : 0,
      executedAt,
      assetClass,
      importMetadata: {
        id: `ibkr-flex:${acctPrefix}${executedAt}:${symbol}:${execIndex}`,
        order: execIndex,
        preserveFee: fee > 0,
      },
    });
  }

  const primaryAccount = Array.from(accounts)[0];
  return {
    format: "ibkr-flex",
    executions,
    skippedRows,
    warnings: [],
    ...(primaryAccount ? { account: primaryAccount, sourceAccounts: Array.from(accounts) } : {}),
  };
}

/**
 * Interactive Brokers activity statement CSV. Multi-section file where every
 * row is prefixed by its section name; fills live in rows shaped
 * `Trades,Data,Order,<Asset Category>,<Currency>,<Symbol>,<Date/Time>,<Quantity>,<T. Price>,...,<Comm/Fee>,...`
 * with a `Trades,Header,...` row defining the columns.
 */
export const ibkr: ImportFormat = {
  id: "ibkr",
  label: "Interactive Brokers (activity statement)",
  detect: (_headers, content) =>
    /^Trades,Header/m.test(content) || /"?Trades"?,"?Header"?/.test(content),
  parse: (content, options): ParsedImport => {
    const rows = parseCsv(content, ",");
    const headerRow = rows.find((row) => row[0] === "Trades" && row[1] === "Header");
    if (!headerRow) {
      const firstRow = rows[0] ?? [];
      const keys = firstRow.map(headerKey);
      const col = (name: string) => keys.indexOf(name);
      if (
        (col("symbol") !== -1 || col("underlyingsymbol") !== -1) &&
        (col("datetime") !== -1 || col("orderdate") !== -1 || col("tradedate") !== -1) &&
        (col("buysell") !== -1 || col("side") !== -1 || col("quantity") !== -1)
      ) {
        return parseIbkrFlex(rows, options);
      }

      return {
        format: "ibkr",
        executions: [],
        skippedRows: 0,
        warnings: ["No Trades section found."],
      };
    }
    const keys = headerRow.map(headerKey);
    const col = (name: string) => keys.indexOf(name);

    const executions: ImportedExecution[] = [];
    let skippedRows = 0;

    for (const row of rows) {
      if (row[0] !== "Trades" || row[1] !== "Data") continue;
      // DataDiscriminator "Order" rows are the fills; "ClosedLot"/"Total" rows are not.
      const discriminator = row[col("datadiscriminator")] ?? "";
      if (!/^order$/i.test(discriminator)) {
        skippedRows++;
        continue;
      }
      const symbol = (row[col("symbol")] ?? "").trim().toUpperCase();
      const quantitySigned = parseMoney(row[col("quantity")]);
      const price = parseMoney(row[col("tprice")] ?? row[col("price")]);
      const executedAt = parseTimestamp(row[col("datetime")], options.timeZone);
      // Older ISO-ish parsing stopped at the comma and stored local midnight.
      const legacyDate = row[col("datetime")]?.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}),/);
      const legacyExecutedAt = legacyDate ? parseTimestamp(legacyDate[1], options.timeZone) : null;

      let fee = 0;
      const commFeeIdx = col("commfee");
      if (commFeeIdx !== -1 && col("commission") === -1) {
        fee += Math.abs(parseMoney(row[commFeeIdx]) || 0);
      }
      for (const feeCol of FEE_COLUMNS) {
        const c = col(feeCol);
        if (c !== -1) {
          const val = Math.abs(parseMoney(row[c]) || 0);
          if (Number.isFinite(val)) {
            fee += val;
          }
        }
      }

      const assetClass = ASSET_MAP[headerKey(row[col("assetcategory")] ?? "")];

      if (
        !symbol ||
        !executedAt ||
        !Number.isFinite(quantitySigned) ||
        quantitySigned === 0 ||
        !Number.isFinite(price)
      ) {
        skippedRows++;
        continue;
      }
      executions.push({
        symbol,
        side: quantitySigned > 0 ? "buy" : "sell",
        quantity: parseQuantity(String(Math.abs(quantitySigned))),
        price,
        fee: Number.isFinite(fee) ? fee : 0,
        executedAt,
        ...(legacyExecutedAt && legacyExecutedAt !== executedAt ? { legacyExecutedAt } : {}),
        assetClass,
      });
    }

    return { format: "ibkr", executions, skippedRows, warnings: [] };
  },
};
