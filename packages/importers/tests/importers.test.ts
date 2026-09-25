import { describe, expect, it } from "vitest";
import { buildRoundTrips } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { parseWithMapping, readHeaders } from "../src/formats/generic";
import { parseMoney } from "../src/numbers";
import { parseTimestamp } from "../src/dates";

// NOTE: fixtures are synthetic, shaped after each platform's documented export.
// Validating against real exports is a launch-checklist item; every parser is
// alias-driven so a header fix is a one-line change.

const TRADEZELLA_CSV = `Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions
2026-01-05 09:31:00,2026-01-05 10:15:00,AAPL,LONG,100,185.50,187.25,171.00,4.00
2026-01-06 09:45:00,2026-01-06 09:52:00,TSLA,SHORT,50,240.00,242.00,-102.50,2.50`;

const TRADERVUE_CSV = `Date,Time,Symbol,Quantity,Price,Side,Commission,TransFee,ECNFee
2026-01-05,09:31:00,AAPL,100,185.50,Buy,1.00,0.10,0.25
2026-01-05,10:15:00,AAPL,100,187.25,Sell,1.00,0.10,0.25`;

const TRADINGVIEW_CSV = `Symbol,Side,Type,Qty,Fill Price,Status,Commission,Closing Time
NASDAQ:AAPL,Buy,Market,10,185.50,Filled,0,2026-01-05 09:31:00
NASDAQ:AAPL,Sell,Market,10,187.25,Filled,0,2026-01-05 10:15:00
NASDAQ:MSFT,Buy,Limit,5,400.00,Cancelled,0,2026-01-05 11:00:00`;

const IBKR_CSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:31:00",100,185.50,187.0,-18550,-1.00,18551,0,150,O
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:15:00",-100,187.25,187.0,18725,-1.00,-18551,173,-25,C
Trades,SubTotal,,Stocks,USD,AAPL,,0,,,175,-2,0,173,125,`;

const NINJA_CSV = `Instrument,Action,Quantity,Price,Time,Commission
ES 03-26,Buy,2,5000.25,2026-01-05 09:31:05,4.10
ES 03-26,Sell,2,5010.50,2026-01-05 09:45:10,4.10`;

const MT4_HTML = `<html><head><title>Statement</title></head><body>
<div>MetaTrader 4 - Closed Transactions:</div>
<table>
<tr><td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td><td>Price</td><td>S / L</td><td>T / P</td><td>Close Time</td><td>Price</td><td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td></tr>
<tr><td>12345</td><td>2026.01.05 09:31</td><td>buy</td><td>1.00</td><td>eurusd</td><td>1.09500</td><td>0.00000</td><td>0.00000</td><td>2026.01.05 14:20</td><td>1.09850</td><td>-7.00</td><td>0.00</td><td>-0.50</td><td>350.00</td></tr>
</table></body></html>`;

describe("importers turn any platform's export into normalized executions", () => {
  it("a TradeZella export migrates with net P&L preserved to the cent", () => {
    const result = parseAuto(TRADEZELLA_CSV)!;
    expect(result.format).toBe("tradezella");
    expect(result.executions).toHaveLength(4);

    const trades = buildRoundTrips(
      result.executions.map((e, i) => ({
        ...e,
        id: `e${i}`,
        accountId: "a",
        source: "import" as const,
      })),
    );
    expect(trades).toHaveLength(2);
    const aapl = trades.find((t) => t.symbol === "AAPL")!;
    const tsla = trades.find((t) => t.symbol === "TSLA")!;
    expect(aapl.netPnl).toBeCloseTo(171, 2);
    expect(tsla.netPnl).toBeCloseTo(-102.5, 2);
    expect(tsla.direction).toBe("short");
  });

  it("a Tradervue executions export imports fills with all three fee columns summed", () => {
    const result = parseAuto(TRADERVUE_CSV)!;
    expect(result.format).toBe("tradervue");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.fee).toBeCloseTo(1.35, 6);
    expect(result.executions[0]!.side).toBe("buy");
  });

  it("a TradingView history import keeps filled orders and drops cancelled ones", () => {
    const result = parseAuto(TRADINGVIEW_CSV)!;
    expect(result.format).toBe("tradingview");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.symbol).toBe("AAPL"); // exchange prefix stripped
    expect(result.skippedRows).toBe(1);
  });

  it("an IBKR activity statement imports only fill rows, with signed quantity as the side", () => {
    const result = parseAuto(IBKR_CSV)!;
    expect(result.format).toBe("ibkr");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[1]!.side).toBe("sell");
    expect(result.executions[0]!.assetClass).toBe("equity");
    expect(result.executions[0]!.fee).toBe(1);
  });

  it("a NinjaTrader export strips the contract month from the instrument", () => {
    const result = parseAuto(NINJA_CSV)!;
    expect(result.format).toBe("ninjatrader");
    expect(result.executions[0]!.symbol).toBe("ES");
  });

  it("a MetaTrader HTML statement reconstructs each closed trade with swap folded into fees", () => {
    const result = parseAuto(MT4_HTML)!;
    expect(result.format).toBe("metatrader");
    expect(result.executions).toHaveLength(2);
    const trades = buildRoundTrips(
      result.executions.map((e, i) => ({
        ...e,
        id: `e${i}`,
        accountId: "a",
        source: "import" as const,
      })),
    );
    expect(trades[0]!.symbol).toBe("EURUSD");
    expect(trades[0]!.fees).toBeCloseTo(7.5, 6);
  });

  it("an unknown file is not guessed at — it goes to the column mapper instead", () => {
    const weird = `When,Ticker,Way,Amount,Cost
2026-01-05 09:31:00,AAPL,bought,100,185.50`;
    expect(detectFormat(weird)).toBeNull();
    expect(readHeaders(weird)).toEqual(["When", "Ticker", "Way", "Amount", "Cost"]);
    const mapped = parseWithMapping(weird, {
      symbol: "Ticker",
      side: "Way",
      quantity: "Amount",
      price: "Cost",
      timestamp: "When",
    });
    expect(mapped.executions).toHaveLength(1);
    expect(mapped.executions[0]!.side).toBe("buy");
  });
});

describe("parsing primitives survive the mess real exports contain", () => {
  it("money values with symbols, parens, and thousands separators parse correctly", () => {
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("(45.20)")).toBe(-45.2);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("-12.5")).toBe(-12.5);
  });

  it("naive timestamps are interpreted in the trader's timezone, not the server's", () => {
    // 09:31 New York in January is 14:31 UTC.
    expect(parseTimestamp("2026-01-05 09:31:00", "America/New_York")).toBe(
      "2026-01-05T14:31:00.000Z",
    );
    // US-style with meridiem.
    expect(parseTimestamp("01/05/2026 2:30:00 PM", "UTC")).toBe("2026-01-05T14:30:00.000Z");
    // Offsets are honored as-is.
    expect(parseTimestamp("2026-01-05T09:31:00-05:00")).toBe("2026-01-05T14:31:00.000Z");
  });
});

// Fixtures below are shaped from FIELD SOURCES: TradeNote's community broker
// parsers (github.com/Eleven-Trading/TradeNote) and a real-user TradeZella
// converter (github.com/drasticstatic/TradeZella_STB). See docs/importers.md.
describe("formats cross-checked against real-world parsers import correctly", () => {
  it("a Tradovate orders export keeps only Filled rows and reads Product as the symbol", () => {
    const csv = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
1001,APEX123,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,2,5000.25,Filled
1002,APEX123,08/20/2026,,Buy,ESU6,ES,0,,Cancelled
1003,APEX123,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,2,5010.50,Filled`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("tradovate");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.symbol).toBe("ES");
    expect(result.skippedRows).toBe(1);
  });

  it("a TopstepX export maps Bid/Ask to buy/sell", () => {
    const csv = `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-1,/ESU6,5000.25,2026-08-20 09:31:05,Opening,Bid,2,Filled,Market
TSX-1,/ESU6,5010.50,2026-08-20 09:45:10,Closing,Ask,2,Filled,Market`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("topstepx");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[1]!.side).toBe("sell");
  });

  it("an IBKR Flex Query export parses its YYYYMMDD;HHmmss timestamps", () => {
    const csv = `ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass,Code
U1234567,AAPL,20260105;093100,BUY,100,185.50,-1.00,STK,O
U1234567,AAPL,20260105;101500,SELL,-100,187.25,-1.00,STK,C`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("ibkr-flex");
    expect(result.account).toBe("U1234567");
    expect(result.sourceAccounts).toEqual(["U1234567"]);
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.executedAt).toBe("2026-01-05T09:31:00.000Z");
    expect(result.executions[0]!.fee).toBe(1);
    expect(result.executions[0]!.assetClass).toBe("equity");
  });

  it("TradeZella time fields with a timezone abbreviation still parse", () => {
    expect(parseTimestamp("08/18/2026 09:31:00 EST", "America/New_York")).toBe(
      "2026-08-18T13:31:00.000Z",
    );
  });

  it("Webull's combined Filled/Total and Price/Avg Price columns split correctly", () => {
    const csv = `Symbol,Side,Status,Filled/Total Qty,Price/Avg Price,Filled Time
AAPL,Buy,Filled,5/10,185.00/185.50,08/20/2026 09:31:05
AAPL,Sell,Cancelled,0/10,0/0,`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("webull");
    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]!.quantity).toBe(5); // filled, not total
    expect(result.executions[0]!.price).toBe(185.5); // avg fill price
  });

  it("a TradeZero / TradeNote template export parses buys, short sells, and sums all fee columns", () => {
    const csv = `Account,T/D,S/D,Currency,Type,Side,Symbol,Qty,Price,Exec Time,Comm,SEC,TAF,NSCC,Nasdaq,ECN Remove,ECN Add,Gross Proceeds,Net Proceeds,Clr Broker,Liq,Note
12345,09/18/2023,09/20/2023,USD,CASH,B,AAPL,100,175.50,09:35:10,0.99,0.02,0.01,0.01,0.00,0.00,0.00,-17550.00,-17551.03,APEX,,
12345,09/18/2023,09/20/2023,USD,CASH,SS,TSLA,50,240.00,10:15:00,0.99,0.00,0.01,0.00,0.00,0.05,0.00,12000.00,11998.95,APEX,,`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("tradezero");
    expect(result.account).toBe("12345");
    expect(result.sourceAccounts).toEqual(["12345"]);
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.symbol).toBe("AAPL");
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[0]!.quantity).toBe(100);
    expect(result.executions[0]!.price).toBe(175.5);
    expect(result.executions[0]!.fee).toBeCloseTo(1.03, 2);

    expect(result.executions[1]!.symbol).toBe("TSLA");
    expect(result.executions[1]!.side).toBe("sell"); // SS (short sale) maps to sell
    expect(result.executions[1]!.quantity).toBe(50);
    expect(result.executions[1]!.price).toBe(240);
    expect(result.executions[1]!.fee).toBeCloseTo(1.05, 2);
  });

  it("a Robinhood activity export imports equity buys/sells and skips options and dividends", () => {
    const csv = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
9/18/2023,9/18/2023,9/19/2023,AAPL,Apple Inc.,Buy,10,$175.00,($1750.00)
9/20/2023,9/20/2023,9/21/2023,AAPL,Apple Inc.,Sell,10,$180.00,$1800.00
9/30/2023,9/30/2023,9/30/2023,AAPL,Apple Inc.,CDIV,,,$2.40
9/15/2023,9/15/2023,9/18/2023,AAPL,Call $180,BTO,1,$2.50,($250.00)`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("robinhood");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.symbol).toBe("AAPL");
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[0]!.quantity).toBe(10);
    expect(result.executions[0]!.price).toBe(175);
    expect(result.executions[1]!.symbol).toBe("AAPL");
    expect(result.executions[1]!.side).toBe("sell");
    expect(result.executions[1]!.quantity).toBe(10);
    expect(result.executions[1]!.price).toBe(180);
    expect(result.skippedRows).toBe(2);
  });

  it("a Moomoo order history export parses filled orders and skips continuation and cancelled rows", () => {
    const csv = `"Side","Symbol","Name","Order Price","Order Qty","Order Amount","Status","Filled@Avg Price","Order Time","Order Type","Time-in-Force","Allow Pre-Market","Session","Trigger price","Position Opening","Markets","Currency","Order Source","Fill Qty","Fill Price","Fill Amount","Fill Time","Markets","Currency","Counterparty","Remarks","Platform Fees","Settlement Fees","Consolidated Audit Trail Fees","SEC Fees","Trading Activity Fees","Total"
"Buy","SUNE","SUNation Energy","2.47","172","424.84","Filled","172@2.47","Jun 8, 2026 06:51:04 ET","Limit","Day","","RTH + Pre/Post-Mkt","","","US","USD","","172","2.47","424.84","Jun 8, 2026 06:51:05 ET","US","USD","","","0.99","0.52","0","","","1.51"
"Buy","SKYQ","Sky Quarry","2.43","183","444.69","Filled","183@2.36454","Jun 8, 2026 04:57:06 ET","Limit","Day","","RTH + Pre/Post-Mkt","","","US","USD","","83","2.37","196.71","Jun 8, 2026 04:57:06 ET","US","USD","","","0.99","0.55","0","","","1.54"
"","","","","","","","","","","","","","","","","","","100","2.36","236.00","Jun 8, 2026 04:57:06 ET","US","USD","","","","","","","",""
"Buy","LXEH","Lixiang Education","3.06","139","425.34","Failed","0@0.00","Jun 8, 2026 06:20:23 ET","Limit","Day","","RTH + Pre/Post-Mkt","","","US","USD","","","","","","","","","","","","","","",""`;
    const result = parseAuto(csv)!;
    expect(result.format).toBe("moomoo");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]!.symbol).toBe("SUNE");
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[0]!.quantity).toBe(172);
    expect(result.executions[0]!.price).toBe(2.47);
    expect(result.executions[0]!.fee).toBeCloseTo(1.51, 2);

    expect(result.executions[1]!.symbol).toBe("SKYQ");
    expect(result.executions[1]!.quantity).toBe(183);
    expect(result.executions[1]!.price).toBeCloseTo(2.36454, 5);
    expect(result.executions[1]!.fee).toBeCloseTo(1.54, 2);
    expect(result.skippedRows).toBe(1); // LXEH (0@0.00 failed) is skipped
  });

  it("a WealthCharts orders export parses executions with Apex account and prefix stripping", () => {
    const csv = `name,order_id,symbol,mov_time,mov_type,exec_qty,price_done,points,profit,created_on
PA-APEX-408453-01,7ZZM15C2LMUD03J0L,CM.MNQZ6,Tue Sep 22 2026 15:21:45 GMT-0300 (Brasilia Standard Time),2,-1,30994.75,,-1.04,2026-09-22T18:21:38.000Z
PA-APEX-408453-01,7ZZTQGXVQMUD03DTA,CM.MNQZ6,Tue Sep 22 2026 15:21:38 GMT-0300 (Brasilia Standard Time),1,1,30994.75,,,2026-09-22T18:21:38.000Z
PA-APEX-408453-01,7ZZDU8AI1MS347ZTS,CM.ESU6,Mon Jul 27 2026 08:00:06 GMT-0300 (Brasilia Standard Time),4,1,7521.5,0.5,21.9,2026-07-27T11:00:01.000Z
PA-APEX-408453-01,7ZZ6G5WNSMS347WLV,CM.ESU6,Mon Jul 27 2026 08:00:02 GMT-0300 (Brasilia Standard Time),3,-1,7522,,,2026-07-27T11:00:01.000Z`;
    const result = parseAuto(csv)!;
    expect(result).not.toBeNull();
    expect(result.format).toBe("wealthcharts");
    expect(result.account).toBe("PA-APEX-408453-01");
    expect(result.executions).toHaveLength(4);

    // MNQ Sell exit
    expect(result.executions[0]!.symbol).toBe("MNQZ6");
    expect(result.executions[0]!.side).toBe("sell");
    expect(result.executions[0]!.quantity).toBe(1);
    expect(result.executions[0]!.price).toBe(30994.75);
    expect(result.executions[0]!.importMetadata?.id).toBe("7ZZM15C2LMUD03J0L");
    expect(result.executions[0]!.importMetadata?.reportedGrossPnl).toBe(-1.04);
    expect(result.executions[0]!.assetClass).toBe("futures");

    // MNQ Buy entry
    expect(result.executions[1]!.symbol).toBe("MNQZ6");
    expect(result.executions[1]!.side).toBe("buy");
    expect(result.executions[1]!.quantity).toBe(1);
    expect(result.executions[1]!.price).toBe(30994.75);
    expect(result.executions[1]!.importMetadata?.id).toBe("7ZZTQGXVQMUD03DTA");

    // ES Buy cover exit
    expect(result.executions[2]!.symbol).toBe("ESU6");
    expect(result.executions[2]!.side).toBe("buy");
    expect(result.executions[2]!.quantity).toBe(1);
    expect(result.executions[2]!.price).toBe(7521.5);
    expect(result.executions[2]!.importMetadata?.reportedGrossPnl).toBe(21.9);

    // ES Sell short entry
    expect(result.executions[3]!.symbol).toBe("ESU6");
    expect(result.executions[3]!.side).toBe("sell");
    expect(result.executions[3]!.quantity).toBe(1);
    expect(result.executions[3]!.price).toBe(7522);
  });

  it("a MetaTrader 5 statement with Deals section parses executions, tickets, P&L, and detects FTMO account", () => {
    const html = `<!DOCTYPE html><html><head><title>530319802: $10k FTMO Challenge - Trade History Report</title></head><body>
<table>
<tr><th>Trade History Report</th></tr>
<tr><th>Name:</th><th>$10k FTMO Challenge</th></tr>
<tr><th>Account:</th><th><b>530319802&nbsp;(USD,&nbsp;FTMO-Server3,&nbsp;real,&nbsp;Hedge)</b></th></tr>
<tr><th>Company:</th><th>FTMO Global Markets Ltd</th></tr>
<tr><th>Deals</th></tr>
<tr><th>Time</th><th>Deal</th><th>Symbol</th><th>Type</th><th>Direction</th><th>Volume</th><th>Price</th><th>Order</th><th>Cost</th><th>Commission</th><th>Fee</th><th>Swap</th><th>Profit</th><th>Balance</th><th>Comment</th></tr>
<tr><td>2025.09.01 15:01:13</td><td>71414906</td><td></td><td>balance</td><td></td><td></td><td></td><td></td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>10 000.00</td><td>10 000.00</td><td>Initial account balance</td></tr>
<tr><td>2025.09.23 20:58:41</td><td>74094794</td><td>US100.cash</td><td>buy</td><td>in</td><td>0.1</td><td>24597.95</td><td>78698762</td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td><td>10 000.00</td><td></td></tr>
<tr><td>2025.09.23 21:19:42</td><td>74096712</td><td>US100.cash</td><td>sell</td><td>out</td><td>0.1</td><td>24552.65</td><td>78701470</td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>-4.53</td><td>9 995.47</td><td>[sl 24552.88]</td></tr>
<tr><td>2025.09.24 14:03:10</td><td>74184915</td><td>US100.cash</td><td>buy</td><td>in</td><td>0.1</td><td>24666.05</td><td>78796559</td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>0.00</td><td>9 995.47</td><td></td></tr>
<tr><td>2025.09.24 14:41:08</td><td>74190459</td><td>US100.cash</td><td>sell</td><td>out</td><td>0.1</td><td>24645.55</td><td>78802517</td><td></td><td>0.00</td><td>0.00</td><td>0.00</td><td>-2.05</td><td>9 993.42</td><td>[sl 24645.67]</td></tr>
</table></body></html>`;
    const result = parseAuto(html)!;
    expect(result).not.toBeNull();
    expect(result.format).toBe("metatrader");
    expect(result.account).toBe("530319802");
    expect(result.executions).toHaveLength(4);

    // Deal 1: Buy Entry
    expect(result.executions[0]!.symbol).toBe("US100.CASH");
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[0]!.quantity).toBe(0.1);
    expect(result.executions[0]!.price).toBe(24597.95);
    expect(result.executions[0]!.importMetadata?.id).toBe("74094794");

    // Deal 2: Sell Exit
    expect(result.executions[1]!.symbol).toBe("US100.CASH");
    expect(result.executions[1]!.side).toBe("sell");
    expect(result.executions[1]!.quantity).toBe(0.1);
    expect(result.executions[1]!.price).toBe(24552.65);
    expect(result.executions[1]!.importMetadata?.id).toBe("74096712");
    expect(result.executions[1]!.importMetadata?.reportedGrossPnl).toBe(-4.53);
  });

  it("a cTrader Deals statement parses entry and exit executions with P&L and fees", () => {
    const CTRADER_CSV = `Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap
98765432,1234567,EURUSD,Buy,Sell,100000,1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,450.00,442.00,-6.00,-2.00
98765433,1234568,XAUUSD,Sell,Buy,10,2050.50,2045.00,2026-01-11 09:00:00,2026-01-11 11:20:00,55.00,51.50,-3.50,0.00`;

    const result = parseAuto(CTRADER_CSV)!;
    expect(result).not.toBeNull();
    expect(result.format).toBe("ctrader");
    expect(result.executions).toHaveLength(4);

    // Trade 1 Entry: Buy EURUSD
    expect(result.executions[0]!.symbol).toBe("EURUSD");
    expect(result.executions[0]!.side).toBe("buy");
    expect(result.executions[0]!.quantity).toBe(100000);
    expect(result.executions[0]!.price).toBe(1.085);
    expect(result.executions[0]!.fee).toBe(0);

    // Trade 1 Exit: Sell EURUSD
    expect(result.executions[1]!.symbol).toBe("EURUSD");
    expect(result.executions[1]!.side).toBe("sell");
    expect(result.executions[1]!.quantity).toBe(100000);
    expect(result.executions[1]!.price).toBe(1.0895);
    expect(result.executions[1]!.fee).toBe(8); // 6 commission + 2 swap
    expect(result.executions[1]!.importMetadata?.reportedGrossPnl).toBe(450);

    // Trade 2 Entry: Sell XAUUSD (short)
    expect(result.executions[2]!.symbol).toBe("XAUUSD");
    expect(result.executions[2]!.side).toBe("sell");
    expect(result.executions[2]!.quantity).toBe(10);
    expect(result.executions[2]!.price).toBe(2050.5);

    // Trade 2 Exit: Buy XAUUSD
    expect(result.executions[3]!.symbol).toBe("XAUUSD");
    expect(result.executions[3]!.side).toBe("buy");
    expect(result.executions[3]!.quantity).toBe(10);
    expect(result.executions[3]!.price).toBe(2045);
    expect(result.executions[3]!.fee).toBe(3.5);
    expect(result.executions[3]!.importMetadata?.reportedGrossPnl).toBe(55);
  });
});
