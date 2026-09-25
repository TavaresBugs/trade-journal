import { describe, expect, it } from "vitest";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import { ctrader } from "../src/formats/ctrader";
import { quantower } from "../src/formats/quantower";
import { thinkorswim } from "../src/formats/thinkorswim";
import { topstepx } from "../src/formats/topstepx";
import { tradestation } from "../src/formats/tradestation";
import { tradezero } from "../src/formats/tradezero";
import { tradovate } from "../src/formats/tradovate";
import { detectFormat, parseAuto } from "../src/detect";

// ============================================================================
// FIXTURES
// ============================================================================

const REAL_CTRADER_HTM = readFileSync(
  new URL("./fixtures/tradezella/ctrader.htm", import.meta.url),
  "utf8",
);

const CTRADER_CSV = `Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap
98765432,1234567,EURUSD,Buy,Sell,100000,1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,450.00,442.00,-6.00,-2.00
98765433,1234568,XAUUSD,Sell,Buy,10,2050.50,2045.00,2026-01-11 09:00:00,2026-01-11 11:20:00,55.00,51.50,-3.50,0.00`;

const REAL_QUANTOWER_CSV = readFileSync(
  new URL("./fixtures/tradezella/quantower.csv", import.meta.url),
  "utf8",
);

const REAL_TOS_CSV = readFileSync(
  new URL("./fixtures/tradezella/thinkorswim.csv", import.meta.url),
  "utf8",
);

const REAL_TRADES_CSV = readFileSync(
  new URL("./fixtures/tradezella/topstepx.csv", import.meta.url),
  "utf8",
);

const LEGACY_FILLS_CSV = `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-101,/ESU6,5000.25,2026-08-20 09:31:05,Opening,Bid,2,Filled,Market
TSX-101,/ESU6,5010.50,2026-08-20 09:45:10,Closing,Ask,2,Filled,Market`;

const REAL_TRADESTATION_CSV = readFileSync(
  new URL("./fixtures/tradezella/tradestation.csv", import.meta.url),
  "utf8",
);

const REAL_TRADEZERO_CSV = readFileSync(
  new URL("./fixtures/tradezella/tradezero.csv", import.meta.url),
  "utf8",
);

const REAL_TRADOVATE_CSV = `Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp
419496653330,08/04/2026 10:20:44,2026-08-04,0,,1,29219.25,1,29248.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653348,419496653327,419496653346,1,29219.25,29248.50,58.50,USD,08/04/2026 10:05:09,08/04/2026 10:20:44
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653373,419496653371,419496653362,1,29899.75,29843.50,-112.50,USD,08/05/2026 11:49:40,08/05/2026 11:38:15
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653402,419496653400,419496653382,1,29814.00,29794.00,-40.00,USD,08/05/2026 11:54:39,08/05/2026 11:53:50
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653426,419496653416,419496653424,1,29958.00,29955.75,-4.50,USD,08/10/2026 07:04:14,08/10/2026 07:04:29
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653458,419496653437,419496653456,1,29864.00,29805.50,-117.00,USD,08/10/2026 11:18:21,08/10/2026 11:25:22
419496653476,08/12/2026 16:45:03,2026-08-12,0,,2,7773.75,2,7774.00,LFE0506847043001,MESU6,MES,Micro E-mini S&P 500,-2,0,0.25,419496653508,419496653506,419496653473,2,7773.75,7774.00,2.50,USD,08/12/2026 16:45:03,08/12/2026 16:27:26
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653553,419496653531,419496653551,1,29877.25,29853.75,-47.00,USD,08/13/2026 08:50:37,08/13/2026 09:01:01
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653593,419496653563,419496653591,1,30059.50,30081.50,44.00,USD,08/13/2026 10:45:46,08/13/2026 10:46:09
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653630,419496653600,419496653628,1,30217.50,30219.50,4.00,USD,08/13/2026 15:33:50,08/13/2026 15:37:50
419496653648,08/19/2026 10:29:03,2026-08-19,0,,2,29739.00,2,29712.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653685,419496653645,419496653683,1,29734.75,29712.75,-44.00,USD,08/19/2026 10:12:34,08/19/2026 10:17:03
419496653648,08/19/2026 10:29:03,2026-08-19,0,,2,29739.00,2,29712.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653721,419496653692,419496653719,1,29743.25,29712.25,-62.00,USD,08/19/2026 10:23:01,08/19/2026 10:29:03
419496653742,08/25/2026 08:32:29,2026-08-25,0,,1,29344.00,1,29344.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653802,419496653739,419496653800,1,29344.00,29344.50,1.00,USD,08/25/2026 08:15:31,08/25/2026 08:32:29
419496653808,08/26/2026 17:05:04,2026-08-26,0,,1,29342.75,1,29344.00,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653836,419496653817,419496653834,1,29342.75,29344.00,2.50,USD,08/26/2026 17:04:03,08/26/2026 17:05:04
419496653850,08/27/2026 10:49:14,2026-08-27,0,,1,7722.25,1,7710.75,LFE0506847043001,MESU6,MES,Micro E-mini S&P 500,-2,0,0.25,419496653882,419496653848,419496653880,1,7722.25,7710.75,-57.50,USD,08/27/2026 10:44:07,08/27/2026 10:49:14`;

const ORDERS_TRADOVATE_CSV = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
101,LFE0506847043001,8/4/26,10:05:09,Buy,MNQU6,MNQ,1,29219.25,Filled
102,LFE0506847043001,8/4/26,10:20:44,Sell,MNQU6,MNQ,1,29248.50,Filled`;

// ============================================================================
// SUÍTE SETORIAL: CATÁLOGO DE CORRETORAS
// ============================================================================

describe("Broker Importers Catalog Sector Battery", () => {
  // --------------------------------------------------------------------------
  // 1. CTRADER
  // --------------------------------------------------------------------------
  describe("cTrader Parser", () => {
    it("detects real cTrader HTML statement export", () => {
      const detected = detectFormat(REAL_CTRADER_HTM);
      expect(detected?.id).toBe("ctrader");
    });

    it("parses real cTrader HTML statement with Pepperstone account and closed deals", () => {
      const parsed = ctrader.parse(REAL_CTRADER_HTM, { timeZone: "UTC" });

      expect(parsed.format).toBe("ctrader");
      expect(parsed.account).toBe("4142841");
      expect(parsed.sourceAccounts).toEqual(["4142841"]);
      expect(parsed.executions.length).toBe(10); // 5 closed trades * 2 legs

      // Trade 1: CADJPY
      const [entry1, exit1] = parsed.executions.slice(0, 2);
      expect(entry1!.symbol).toBe("CADJPY");
      expect(entry1!.side).toBe("buy"); // Opening Direction = Buy
      expect(entry1!.price).toBe(109.643);

      expect(exit1!.symbol).toBe("CADJPY");
      expect(exit1!.side).toBe("sell"); // Closing Direction = Sell
      expect(exit1!.price).toBe(112.02);
      expect(exit1!.importMetadata?.reportedGrossPnl).toBe(23.77);
    });

    it("parses cTrader CSV deals statement with accurate sides, P&L and fees", () => {
      const parsed = ctrader.parse(CTRADER_CSV, { timeZone: "UTC" });

      expect(parsed.format).toBe("ctrader");
      expect(parsed.executions).toHaveLength(4);

      // Trade 1 Entry: Buy EURUSD
      expect(parsed.executions[0]!.symbol).toBe("EURUSD");
      expect(parsed.executions[0]!.side).toBe("buy");
      expect(parsed.executions[0]!.price).toBe(1.085);

      // Trade 1 Exit: Sell EURUSD
      expect(parsed.executions[1]!.symbol).toBe("EURUSD");
      expect(parsed.executions[1]!.side).toBe("sell");
      expect(parsed.executions[1]!.price).toBe(1.0895);
      expect(parsed.executions[1]!.fee).toBe(8); // 6 + 2
      expect(parsed.executions[1]!.importMetadata?.reportedGrossPnl).toBe(450);
    });
  });

  // --------------------------------------------------------------------------
  // 2. QUANTOWER
  // --------------------------------------------------------------------------
  describe("Quantower Parser", () => {
    it("detects real Quantower CSV export", () => {
      const detected = detectFormat(REAL_QUANTOWER_CSV);
      expect(detected?.id).toBe("quantower");
    });

    it("parses executions with account auto-binding, crypto assetClass and Trade IDs", () => {
      const parsed = quantower.parse(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });

      expect(parsed.format).toBe("quantower");
      expect(parsed.account).toBe("Account (USD)");
      expect(parsed.sourceAccounts).toEqual(["Account (USD)"]);
      expect(parsed.executions.length).toBeGreaterThan(0);

      // Row 1: Buy 1 ETH/USD @ 1776.04
      const e1 = parsed.executions[0]!;
      expect(e1.symbol).toBe("ETH/USD");
      expect(e1.side).toBe("buy");
      expect(e1.quantity).toBe(1);
      expect(e1.price).toBe(1776.04);
      expect(e1.assetClass).toBe("crypto");
      expect(e1.importMetadata?.id).toBe("quantower:trade:1");

      // Row 2: Sell 1 ETH/USD @ 1776.03
      const e2 = parsed.executions[1]!;
      expect(e2.symbol).toBe("ETH/USD");
      expect(e2.side).toBe("sell");
      expect(e2.quantity).toBe(1);
      expect(e2.price).toBe(1776.03);
      expect(e2.assetClass).toBe("crypto");
      expect(e2.importMetadata?.id).toBe("quantower:trade:2");
    });
  });

  // --------------------------------------------------------------------------
  // 3. THINKORSWIM
  // --------------------------------------------------------------------------
  describe("ThinkorSwim Parser", () => {
    it("detects real ThinkorSwim statement export", () => {
      const detected = detectFormat(REAL_TOS_CSV);
      expect(detected?.id).toBe("thinkorswim");
    });

    it("extracts Account ID from preamble and parses Account Trade History fills", () => {
      const parsed = thinkorswim.parse(REAL_TOS_CSV, { timeZone: "America/Chicago" });

      expect(parsed.format).toBe("thinkorswim");
      expect(parsed.account).toBe("92140825SCHW");
      expect(parsed.sourceAccounts).toEqual(["92140825SCHW"]);
      expect(parsed.executions.length).toBeGreaterThan(0);

      // Row 1: Sell 1000 TSLA @ 173.268
      const e1 = parsed.executions[0]!;
      expect(e1.symbol).toBe("TSLA");
      expect(e1.side).toBe("sell");
      expect(e1.quantity).toBe(1000);
      expect(e1.price).toBe(173.268);
      expect(e1.assetClass).toBe("equity");
      expect(e1.importMetadata?.id).toContain("thinkorswim:92140825SCHW:");
    });
  });

  // --------------------------------------------------------------------------
  // 4. TOPSTEPX
  // --------------------------------------------------------------------------
  describe("TopstepX Parser", () => {
    it("detects real TopstepX Trades tab export", () => {
      const detected = detectFormat(REAL_TRADES_CSV);
      expect(detected?.id).toBe("topstepx");
    });

    it("parses 38 real trades into 76 executions with exact IDs and reported PnL", () => {
      const parsed = topstepx.parse(REAL_TRADES_CSV, { timeZone: "UTC" });

      expect(parsed.format).toBe("topstepx");
      expect(parsed.skippedRows).toBe(0);
      expect(parsed.executions).toHaveLength(76); // 38 trades * 2 legs

      // Trade 1: Short on NQM4
      // Entry: sell 1 NQM4 @ 18228.25
      const entry1 = parsed.executions[0]!;
      expect(entry1.symbol).toBe("NQM4");
      expect(entry1.side).toBe("sell");
      expect(entry1.quantity).toBe(1);
      expect(entry1.price).toBe(18228.25);
      expect(entry1.assetClass).toBe("futures");
      expect(entry1.importMetadata?.id).toBe("topstepx:trade:37199170:entry");
      expect(entry1.importMetadata?.group).toBe("topstepx:trade:37199170");

      // Exit: buy 1 NQM4 @ 18223.75, fee 1.40, reported PnL 90.00
      const exit1 = parsed.executions[1]!;
      expect(exit1.symbol).toBe("NQM4");
      expect(exit1.side).toBe("buy");
      expect(exit1.quantity).toBe(1);
      expect(exit1.price).toBe(18223.75);
      expect(exit1.fee).toBe(1.4);
      expect(exit1.assetClass).toBe("futures");
      expect(exit1.importMetadata?.id).toBe("topstepx:trade:37199170:exit");
      expect(exit1.importMetadata?.reportedGrossPnl).toBe(90);

      // Trade 2: Long on NQM4
      // Entry: buy 1 @ 18227.50
      const entry2 = parsed.executions[2]!;
      expect(entry2.symbol).toBe("NQM4");
      expect(entry2.side).toBe("buy");
      expect(entry2.price).toBe(18227.5);

      // Exit: sell 1 @ 18231.50, fee 1.40, PnL 80.00
      const exit2 = parsed.executions[3]!;
      expect(exit2.symbol).toBe("NQM4");
      expect(exit2.side).toBe("sell");
      expect(exit2.price).toBe(18231.5);
      expect(exit2.importMetadata?.reportedGrossPnl).toBe(80);
    });

    it("still supports legacy Fills export format and extracts AccountName", () => {
      const parsed = topstepx.parse(LEGACY_FILLS_CSV, { timeZone: "America/Chicago" });

      expect(parsed.format).toBe("topstepx");
      expect(parsed.account).toBe("TSX-101");
      expect(parsed.sourceAccounts).toEqual(["TSX-101"]);
      expect(parsed.executions).toHaveLength(2);
      expect(parsed.executions[0]!.symbol).toBe("ESU6"); // leading / stripped
      expect(parsed.executions[0]!.side).toBe("buy"); // Bid
      expect(parsed.executions[1]!.side).toBe("sell"); // Ask
      expect(parsed.executions[0]!.assetClass).toBe("futures");
    });
  });

  // --------------------------------------------------------------------------
  // 5. TRADESTATION
  // --------------------------------------------------------------------------
  describe("TradeStation Parser", () => {
    it("detects real TradeStation CSV export", () => {
      const detected = detectFormat(REAL_TRADESTATION_CSV);
      expect(detected?.id).toBe("tradestation");
    });

    it("parses executions with account auto-binding, options/equities and Order IDs", () => {
      const parsed = tradestation.parse(REAL_TRADESTATION_CSV, { timeZone: "America/New_York" });

      expect(parsed.format).toBe("tradestation");
      expect(parsed.account).toBe("11434173");
      expect(parsed.sourceAccounts).toEqual(["11434173"]);
      expect(parsed.executions.length).toBeGreaterThan(0);

      // Row 1: Option Call Buy NIO221104C12 @ 0.01
      const e1 = parsed.executions[0]!;
      expect(e1.symbol).toBe("NIO221104C12");
      expect(e1.side).toBe("buy");
      expect(e1.quantity).toBe(100);
      expect(e1.price).toBe(0.01);
      expect(e1.assetClass).toBe("option");
      expect(e1.importMetadata?.id).toBe("tradestation:order:912837182LEG1");

      // Row 4: Equity Sell NIO @ 9.8401
      const e4 = parsed.executions[3]!;
      expect(e4.symbol).toBe("NIO");
      expect(e4.side).toBe("sell");
      expect(e4.quantity).toBe(1);
      expect(e4.price).toBe(9.8401);
      expect(e4.assetClass).toBe("equity");
      expect(e4.importMetadata?.id).toBe("tradestation:order:912591960");
    });
  });

  // --------------------------------------------------------------------------
  // 6. TRADEZERO
  // --------------------------------------------------------------------------
  describe("TradeZero Parser", () => {
    it("detects real TradeZero CSV export", () => {
      const detected = detectFormat(REAL_TRADEZERO_CSV);
      expect(detected?.id).toBe("tradezero");
    });

    it("parses executions with account auto-binding, SS/BC sides and fee summing", () => {
      const parsed = tradezero.parse(REAL_TRADEZERO_CSV, { timeZone: "America/New_York" });

      expect(parsed.format).toBe("tradezero");
      expect(parsed.account).toBe("2TZ23795");
      expect(parsed.sourceAccounts).toEqual(["2TZ23795"]);
      expect(parsed.skippedRows).toBe(0);
      expect(parsed.executions).toHaveLength(6);

      // Row 1: Short sale 806 TIVC @ 2.48
      const e1 = parsed.executions[0]!;
      expect(e1.symbol).toBe("TIVC");
      expect(e1.side).toBe("sell"); // SS -> sell
      expect(e1.quantity).toBe(806);
      expect(e1.price).toBe(2.48);
      expect(e1.fee).toBeCloseTo(0.14, 2); // 0.02 SEC + 0.12 TAF
      expect(e1.assetClass).toBe("equity");
      expect(e1.importMetadata?.id).toContain(
        "tradezero:2TZ23795:2023-11-13T13:18:08.000Z:TIVC:sell:806:0",
      );

      // Row 6: Buy to Cover 3300 TIVC @ 2.39225758
      const e6 = parsed.executions[5]!;
      expect(e6.symbol).toBe("TIVC");
      expect(e6.side).toBe("buy"); // BC -> buy
      expect(e6.quantity).toBe(3300);
      expect(e6.price).toBeCloseTo(2.39225758, 6);
      expect(e6.fee).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 7. TRADOVATE
  // --------------------------------------------------------------------------
  describe("Tradovate Parser", () => {
    it("detects real Tradovate positions/performance CSV export", () => {
      const detected = detectFormat(REAL_TRADOVATE_CSV);
      expect(detected?.id).toBe("tradovate");
    });

    it("parses paired positions with accurate Long and Short direction and metadata", () => {
      const parsed = tradovate.parse(REAL_TRADOVATE_CSV, { timeZone: "America/Chicago" });

      expect(parsed.format).toBe("tradovate");
      expect(parsed.account).toBe("LFE0506847043001");
      expect(parsed.sourceAccounts).toEqual(["LFE0506847043001"]);
      expect(parsed.skippedRows).toBe(0);
      expect(parsed.executions).toHaveLength(28); // 14 trades * 2 executions

      // Trade 1: Long (Bought 10:05:09, Sold 10:20:44)
      const [t1Entry, t1Exit] = parsed.executions.slice(0, 2);
      expect(t1Entry).toMatchObject({
        symbol: "MNQ",
        side: "buy",
        quantity: 1,
        price: 29219.25,
        assetClass: "futures",
      });
      expect(t1Entry?.importMetadata).toMatchObject({
        id: "tradovate:fill:419496653327",
        group: "tradovate:pos:419496653330",
        order: 0,
        preserveFee: true,
      });
      expect(t1Exit).toMatchObject({
        symbol: "MNQ",
        side: "sell",
        quantity: 1,
        price: 29248.5,
        assetClass: "futures",
      });
      expect(t1Exit?.importMetadata).toMatchObject({
        id: "tradovate:fill:419496653346",
        group: "tradovate:pos:419496653330",
        order: 1,
        reportedGrossPnl: 58.5,
      });

      // Trade 2: Short (Sold 11:38:15, Bought 11:49:40)
      const [t2Entry, t2Exit] = parsed.executions.slice(2, 4);
      expect(t2Entry).toMatchObject({
        symbol: "MNQ",
        side: "sell",
        quantity: 1,
        price: 29843.5,
      });
      expect(t2Exit).toMatchObject({
        symbol: "MNQ",
        side: "buy",
        quantity: 1,
        price: 29899.75,
      });
      expect(t2Exit?.importMetadata?.reportedGrossPnl).toBe(-112.5);

      // Trade 6: Short on MES (Sold 16:27:26, Bought 16:45:03, Qty 2)
      const [t3Entry, t3Exit] = parsed.executions.slice(10, 12);
      expect(t3Entry).toMatchObject({
        symbol: "MES",
        side: "sell",
        quantity: 2,
        price: 7774,
      });
      expect(t3Exit).toMatchObject({
        symbol: "MES",
        side: "buy",
        quantity: 2,
        price: 7773.75,
      });
      expect(t3Exit?.importMetadata?.reportedGrossPnl).toBe(2.5);
    });

    it("still supports Tradovate orders export without regressions", () => {
      const detected = detectFormat(ORDERS_TRADOVATE_CSV);
      expect(detected?.id).toBe("tradovate");

      const parsed = tradovate.parse(ORDERS_TRADOVATE_CSV, { timeZone: "America/Chicago" });
      expect(parsed.executions).toHaveLength(2);
      expect(parsed.account).toBe("LFE0506847043001");
    });
  });

  // --------------------------------------------------------------------------
  // 8. TRADEZELLA FIXTURES AUDIT
  // --------------------------------------------------------------------------
  describe("TradeZella Fixtures Audit", () => {
    const fixturesDir = path.resolve(__dirname, "fixtures/tradezella");
    const files = fs
      .readdirSync(fixturesDir)
      .filter((f) => !fs.statSync(path.join(fixturesDir, f)).isDirectory() && !f.endsWith(".xlsx"))
      .sort();

    it("evaluates all fixtures and logs support status", () => {
      const results: Array<{
        file: string;
        detectedFormat: string | null;
        executions: number;
        account?: string;
        error?: string;
      }> = [];

      for (const file of files) {
        const filePath = path.join(fixturesDir, file);
        const buf = fs.readFileSync(filePath);
        const content =
          buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");

        try {
          const fmt = detectFormat(content);
          const parsed = parseAuto(content);
          results.push({
            file,
            detectedFormat: fmt?.id ?? null,
            executions: parsed?.executions.length ?? 0,
            account: parsed?.account,
          });
        } catch (err: any) {
          results.push({
            file,
            detectedFormat: null,
            executions: 0,
            error: err.message,
          });
        }
      }

      console.table(results);
    });
  });
});
