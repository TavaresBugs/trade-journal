import { makeFillsFormat } from "./fills";
import { parseCsv, pick, toRecords } from "../csv";
import type { ImportFormat } from "../types";

/** Tradervue executions export: Date,Time,Symbol,Quantity,Price,Side,Commission,TransFee,ECNFee */
export const tradervue = makeFillsFormat({
  id: "tradervue",
  label: "Tradervue (executions export)",
  required: [["date"], ["time"], ["symbol"], ["quantity"], ["price"], ["side"]],
  columns: {
    symbol: ["symbol"],
    side: ["side"],
    quantity: ["quantity"],
    price: ["price"],
    fees: [["commission"], ["transfee"], ["ecnfee"], ["secfee"]],
    date: ["date"],
    time: ["time"],
  },
});

/** TradingView paper-trading history export. */
export const tradingview = makeFillsFormat({
  id: "tradingview",
  label: "TradingView (paper trading history)",
  required: [["symbol"], ["side"], ["fillprice"], ["closingtime", "placingtime"]],
  columns: {
    symbol: ["symbol"],
    side: ["side"],
    quantity: ["qty", "quantity", "filledqty"],
    price: ["fillprice", "avgfillprice"],
    fees: [["commission"]],
    timestamp: ["closingtime", "time", "placingtime"],
  },
  rowFilter: (row) =>
    !("status" in row) || /filled/i.test(row["status"] ?? "") || row["status"] === "",
  // "NASDAQ:AAPL" → "AAPL"
  normalizeSymbol: (symbol) => symbol.split(":").pop()!.trim().toUpperCase(),
});

export { ninjatrader } from "./ninjatrader";

export { tradovate } from "./tradovate";

export { topstepx } from "./topstepx";

export { tradezero } from "./tradezero";

const rawIbkrFlex = makeFillsFormat({
  id: "ibkr-flex",
  label: "Interactive Brokers (Flex Query)",
  required: [["clientaccountid"], ["datetime"], ["buysell"]],
  columns: {
    symbol: ["symbol"],
    side: ["buysell"],
    quantity: ["quantity"],
    price: ["price", "tradeprice"],
    fees: [["commission", "ibcommission"]],
    timestamp: ["datetime"],
  },
});

/**
 * Interactive Brokers Flex Query export:
 * Extracts ClientAccountID for auto-binding and maps AssetClass (STK, FUT, OPT).
 */
export const ibkrFlex: ImportFormat = {
  id: "ibkr-flex",
  label: "Interactive Brokers (Flex Query)",
  detect: (headers, content) => rawIbkrFlex.detect(headers, content),
  parse: (content, options) => {
    const parsed = rawIbkrFlex.parse(content, options);
    const records = toRecords(parseCsv(content));
    const accounts = new Set<string>();

    for (const r of records) {
      const acct = pick(r, ["clientaccountid", "account"]);
      if (acct && acct.trim()) accounts.add(acct.trim());
    }

    if (accounts.size > 0) {
      parsed.account = Array.from(accounts)[0];
      parsed.sourceAccounts = Array.from(accounts);
    }

    for (const [i, exec] of parsed.executions.entries()) {
      const r = records[i] ?? {};
      const assetClassRaw = pick(r, ["assetclass"])?.toUpperCase();
      if (assetClassRaw === "STK") exec.assetClass = "equity";
      else if (assetClassRaw === "FUT") exec.assetClass = "futures";
      else if (assetClassRaw === "OPT") exec.assetClass = "option";

      const acct = parsed.account ? `${parsed.account}:` : "";
      exec.importMetadata = {
        id: `ibkr-flex:${acct}${exec.executedAt}:${exec.symbol}:${i}`,
        order: i,
        preserveFee: exec.fee > 0,
      };
    }

    return parsed;
  },
};

/**
 * Webull orders export (only filled orders become executions).
 */
export const webull = makeFillsFormat({
  id: "webull",
  label: "Webull (orders export)",
  required: [["symbol"], ["side"], ["status"], ["filled", "filledtotalqty"]],
  columns: {
    symbol: ["symbol"],
    side: ["side"],
    quantity: ["filled", "filledqty", "filledtotalqty"],
    price: ["avgprice", "averagefillprice", "priceavgprice", "price"],
    fees: [["commission"], ["fee"]],
    timestamp: ["filledtime", "timefilled", "placedtime", "time"],
  },
  rowFilter: (row) => /filled/i.test(row["status"] ?? ""),
});

const rawDasTrader = makeFillsFormat({
  id: "das-trader",
  label: "DAS Trader Pro (executions export)",
  required: [["symb", "symbol"], ["bs", "side"], ["price"], ["time"]],
  columns: {
    symbol: ["symb", "symbol"],
    side: ["bs", "side"],
    quantity: ["qty", "shares"],
    price: ["price"],
    fees: [["commission"], ["ecnfee"], ["fee"]],
    date: ["date"],
    time: ["time"],
  },
});

/** DAS Trader Pro executions export with Account and Cloid extraction. */
export const dastrader: ImportFormat = {
  id: "das-trader",
  label: "DAS Trader Pro (executions export)",
  detect: (headers, content) => rawDasTrader.detect(headers, content),
  parse: (content, options) => {
    const parsed = rawDasTrader.parse(content, options);
    const records = toRecords(parseCsv(content));
    const accounts = new Set<string>();

    for (const r of records) {
      const acct = pick(r, ["account", "accountname"]);
      if (acct && acct.trim()) accounts.add(acct.trim());
    }

    if (accounts.size > 0) {
      parsed.account = Array.from(accounts)[0];
      parsed.sourceAccounts = Array.from(accounts);
    }

    for (const [i, exec] of parsed.executions.entries()) {
      const r = records[i] ?? {};
      const cloid = pick(r, ["cloid", "orderid"]);
      const acct = parsed.account ? `${parsed.account}:` : "";
      exec.importMetadata = {
        id: cloid ? `das:${cloid}:${i}` : `das:${acct}${exec.executedAt}:${exec.symbol}:${i}`,
        order: i,
        preserveFee: exec.fee > 0,
      };
      exec.assetClass = "equity";
    }

    return parsed;
  },
};

/**
 * Robinhood account activity export:
 * Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
 */
export const robinhood = makeFillsFormat({
  id: "robinhood",
  label: "Robinhood (account activity export)",
  required: [["trans code", "transcode"], ["instrument"], ["activity date", "activitydate"], ["quantity"]],
  columns: {
    symbol: ["instrument"],
    side: ["trans code", "transcode"],
    quantity: ["quantity"],
    price: ["price"],
    date: ["activity date", "activitydate"],
  },
  rowFilter: (row) => {
    const code = (row["trans code"] ?? row["transcode"] ?? "").trim().toUpperCase();
    return code === "BUY" || code === "SELL";
  },
});
