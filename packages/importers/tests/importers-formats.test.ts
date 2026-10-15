import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildRoundTrips, type Execution } from "@luxalgo/journal-core";
import { detectFormat, parseAuto } from "../src/detect";
import { ctrader } from "../src/formats/ctrader";
import { ibkr, FEE_COLUMNS } from "../src/formats/ibkr";
import { matchtrader } from "../src/formats/matchtrader";
import { quantower } from "../src/formats/quantower";
import { thinkorswim } from "../src/formats/thinkorswim";
import { topstepx } from "../src/formats/topstepx";
import { decodeImportFile } from "../../../apps/web/src/lib/decode-import";
import type { ImportedExecution } from "../src/types";
import {
  createExecution,
  createImportedExecution,
  createTradePair,
  createImportedTradePair,
} from "./helpers/trade-factory";

// Helper to convert ImportedExecution array to journal-core Execution array
const toExecutions = (imported: ReturnType<typeof parseAuto>["executions"]): Execution[] =>
  imported.map((e, i) => ({
    ...e,
    id: e.importMetadata?.id ?? `exec-${i}`,
    accountId: "dest-account",
    source: "import" as const,
  }));

// ============================================================================
// 1. cTrader
// ============================================================================
describe("cTrader — Format Specification & Business Rules", () => {
  const CTRADER_HTM = readFileSync(
    new URL("./fixtures/tradezella/ctrader.htm", import.meta.url),
    "utf8",
  );
  const CTRADER_DUPLICATE_HTM = readFileSync(
    new URL("./fixtures/tradezella/ctrader-ctrader.htm", import.meta.url),
    "utf8",
  );

  it("detects cTrader HTML statements and duplicate fixture identically", () => {
    const detected1 = detectFormat(CTRADER_HTM);
    const detected2 = detectFormat(CTRADER_DUPLICATE_HTM);
    expect(detected1?.id).toBe("ctrader");
    expect(detected2?.id).toBe("ctrader");
  });

  it("parses real cTrader statement extracting Pepperstone account and 10 executions across 5 closed deals", () => {
    const parsed = parseAuto(CTRADER_HTM, { timeZone: "UTC" });
    expect(parsed).not.toBeNull();
    expect(parsed?.format).toBe("ctrader");
    expect(parsed?.account).toBe("4142841");
    expect(parsed?.sourceAccounts).toEqual(["4142841"]);
    expect(parsed?.executions).toHaveLength(10);

    const [entry1, exit1] = parsed!.executions.slice(0, 2);
    expect(entry1?.symbol).toBe("CADJPY");
    expect(entry1?.side).toBe("buy");
    expect(entry1?.price).toBe(109.643);
    expect(entry1?.quantity).toBe(0.1);
    expect(entry1?.fee).toBe(0);

    expect(exit1?.symbol).toBe("CADJPY");
    expect(exit1?.side).toBe("sell");
    expect(exit1?.price).toBe(112.02);
    expect(exit1?.quantity).toBe(0.1);
    expect(exit1?.fee).toBe(3.52);
    expect(exit1?.importMetadata?.reportedGrossPnl).toBe(23.77);
  });

  it("extracts Account ID from machine-emitted HTML <title> tag with multiline formatting", () => {
    const htmlSnippet = `
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title>
            cT
            _
            8877665
            _
            2025-10-15
          </title>
        </head>
        <body></body>
      </html>
    `;
    const parsed = ctrader.parse(htmlSnippet, { timeZone: "UTC" });
    expect(parsed.account).toBe("8877665");
  });

  it("decodes and parses UTF-16LE encoded cTrader statement with BOM (0xFF, 0xFE)", () => {
    const utf16leBuf = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(CTRADER_HTM, "utf16le"),
    ]);
    const decodedText = decodeImportFile(
      utf16leBuf.buffer.slice(utf16leBuf.byteOffset, utf16leBuf.byteOffset + utf16leBuf.byteLength),
    );
    const parsed = parseAuto(decodedText, { timeZone: "UTC" });
    expect(parsed).not.toBeNull();
    expect(parsed?.format).toBe("ctrader");
    expect(parsed?.account).toBe("4142841");
    expect(parsed?.executions).toHaveLength(10);
  });

  it("normalizes volume from units to lots for forex contracts", () => {
    const csvSample = [
      "Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap",
      '98765432,1234567,EURUSD,Buy,Sell,"100,000 Units",1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,450.00,442.00,-6.00,-2.00',
      '98765433,1234568,GBPUSD,Sell,Buy,"50,000 Units",1.27500,1.27100,2026-01-11 09:00:00,2026-01-11 11:20:00,200.00,196.50,-3.50,0.00',
      "98765434,1234569,USDJPY,Buy,Sell,1.5 Lots,150.000,150.500,2026-01-12 08:00:00,2026-01-12 10:00:00,500.00,490.00,-8.00,-2.00",
    ].join("\n");

    const parsed = parseAuto(csvSample, { timeZone: "UTC" });
    expect(parsed?.executions).toHaveLength(6);
    expect(parsed?.executions[0]?.symbol).toBe("EURUSD");
    expect(parsed?.executions[0]?.quantity).toBe(1.0);
    expect(parsed?.executions[2]?.symbol).toBe("GBPUSD");
    expect(parsed?.executions[2]?.quantity).toBe(0.5);
    expect(parsed?.executions[4]?.symbol).toBe("USDJPY");
    expect(parsed?.executions[4]?.quantity).toBe(1.5);
  });

  it("enforces non-negative fee enforcement so negative commissions and swaps do not inflate net PnL", () => {
    const csv = [
      "Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap",
      "101,201,EURUSD,Buy,Sell,1.00 Lots,1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,,442.00,-6.00,-2.00",
    ].join("\n");

    const parsed = parseAuto(csv, { timeZone: "UTC" });
    const exitExec = parsed?.executions[1];
    expect(exitExec?.fee).toBe(8.0);
    expect(exitExec?.fee).toBeGreaterThanOrEqual(0);
    expect(exitExec?.importMetadata?.reportedGrossPnl).toBe(450.0);

    const trips = buildRoundTrips(toExecutions(parsed!.executions), {
      method: "fifo",
      multipliers: { EURUSD: 100000 },
    });
    expect(trips).toHaveLength(1);
    expect(trips[0]!.fees).toBe(8.0);
    expect(trips[0]!.grossPnl).toBe(450.0);
    expect(trips[0]!.netPnl).toBe(442.0);
  });
});

// ============================================================================
// 2. Interactive Brokers (IBKR)
// ============================================================================
describe("Interactive Brokers (IBKR) — Format Specification & Business Rules", () => {
  const IBKR_FLEX_FIXTURE = readFileSync(
    new URL("./fixtures/tradezella/ibkr.csv", import.meta.url),
    "utf8",
  );
  const IBKR_GUIDE_FIXTURE = readFileSync(
    new URL(
      "./fixtures/tradezella/interactive-broker-how-to-import-your-trades-from-interactive-broker-ibkr.csv",
      import.meta.url,
    ),
    "utf8",
  );
  const CLASSIC_ACTIVITY_CSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:31:00",100,185.50,187.0,-18550,-1.00,18551,0,150,O
Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:15:00",-100,187.25,187.0,18725,-1.25,-18551,173,-25,C
Trades,Data,ClosedLot,Stocks,USD,AAPL,"2026-01-05, 10:15:00",-100,187.25,187.0,18725,-1.25,-18551,173,-25,C
Trades,SubTotal,,Stocks,USD,AAPL,,0,,,175,-2.25,0,173,125,
Trades,Total,,Stocks,USD,,,,0,,,175,-2.25,0,173,125,`;

  it("detects and parses Flex Query fixture ibkr.csv into 675 executions with account U2102003", () => {
    const detected = detectFormat(IBKR_FLEX_FIXTURE);
    expect(detected?.id).toBe("ibkr-flex");

    const parsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
    expect(parsed?.format).toBe("ibkr-flex");
    expect(parsed?.account).toBe("U2102003");
    expect(parsed?.sourceAccounts).toEqual(["U2102003"]);
    expect(parsed?.executions).toHaveLength(675);
    expect(parsed?.skippedRows).toBe(0);
  });

  it("detects and parses interactive-broker-...-ibkr.csv identically to ibkr.csv", () => {
    const parsed1 = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
    const parsed2 = parseAuto(IBKR_GUIDE_FIXTURE, { timeZone: "UTC" });
    expect(parsed1).toEqual(parsed2);
    expect(parsed2?.executions).toHaveLength(675);
  });

  it("parses Flex Query directly through ibkr.parse fallback", () => {
    const parsed = ibkr.parse(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
    expect(parsed.format).toBe("ibkr-flex");
    expect(parsed.account).toBe("U2102003");
    expect(parsed.executions).toHaveLength(675);
  });

  it("parses real semicolon timestamps like 20210820;110555 accurately into UTC ISO strings", () => {
    const sample = [
      "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass",
      "U2102003,A,20210820;110555,BUY,0.5,168.71,0,STK",
      "U2102003,A,20210820;122916,BUY,0.5,168.56,0,STK",
    ].join("\n");

    const parsedUtc = parseAuto(sample, { timeZone: "UTC" });
    expect(parsedUtc?.executions[0]?.executedAt).toBe("2021-08-20T11:05:55.000Z");
    expect(parsedUtc?.executions[1]?.executedAt).toBe("2021-08-20T12:29:16.000Z");

    const parsedNy = parseAuto(sample, { timeZone: "America/New_York" });
    expect(parsedNy?.executions[0]?.executedAt).toBe("2021-08-20T15:05:55.000Z");
  });

  it("accurately parses fractional quantities from real executions in ibkr.csv (0.5 qty)", () => {
    const parsed = parseAuto(IBKR_FLEX_FIXTURE, { timeZone: "UTC" });
    const fractionalBuys = parsed!.executions.filter(
      (e) => e.symbol === "A" && e.quantity === 0.5 && e.side === "buy",
    );
    expect(fractionalBuys.length).toBeGreaterThan(0);
    expect(fractionalBuys[0]!.quantity).toBe(0.5);

    const fractionalSells = parsed!.executions.filter(
      (e) => e.symbol === "A" && e.quantity === 0.5 && e.side === "sell",
    );
    expect(fractionalSells.length).toBeGreaterThan(0);
    expect(fractionalSells[0]!.quantity).toBe(0.5);
  });

  it("preserves various fractional quantities without float rounding truncation", () => {
    const csv = [
      "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,Commission,AssetClass",
      "U1234567,AMZN,20260105;093000,BUY,0.125,200.00,-0.50,STK",
      "U1234567,GOOG,20260105;094500,BUY,0.005,180.00,-0.20,STK",
      "U1234567,MSFT,20260105;100000,SELL,-10.75,420.00,-1.00,STK",
    ].join("\n");

    const parsed = parseAuto(csv, { timeZone: "UTC" });
    expect(parsed?.executions[0]?.quantity).toBe(0.125);
    expect(parsed?.executions[1]?.quantity).toBe(0.005);
    expect(parsed?.executions[2]?.quantity).toBe(10.75);
  });

  it("sums all 8 fee breakdown columns in Classic Activity Statement", () => {
    const multiFeeActivityCsv = [
      "Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Commission,BrokerExecutionCommission,BrokerClearingCommission,ThirdPartyExecutionCommission,ThirdPartyClearingCommission,ThirdPartyRegulatoryCommission,OtherCommission,Tax",
      'Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 09:30:00",100,185.00,-1.00,-0.50,-0.25,-0.10,-0.05,-0.02,-0.08,-0.50',
      'Trades,Data,Order,Stocks,USD,AAPL,"2026-01-05, 10:00:00",-100,190.00,-1.00,0,0,0,0,0,0,-0.50',
    ].join("\n");

    const parsed = ibkr.parse(multiFeeActivityCsv, { timeZone: "UTC" });
    expect(parsed.executions[0]?.fee).toBeCloseTo(2.5, 4);
    expect(parsed.executions[1]?.fee).toBeCloseTo(1.5, 4);
  });

  it("sums all 8 fee breakdown columns in Flex Query format", () => {
    const multiFeeFlexCsv = [
      "ClientAccountID,Symbol,Date/Time,Buy/Sell,Quantity,Price,AssetClass," +
        "Commission,BrokerExecutionCommission,BrokerClearingCommission,ThirdPartyExecutionCommission,ThirdPartyClearingCommission,ThirdPartyRegulatoryCommission,OtherCommission,Tax",
      "U1234567,NVDA,20260105;093000,BUY,50,130.00,STK,-1.00,-0.40,-0.20,-0.15,-0.05,-0.03,-0.07,-0.60",
    ].join("\n");

    const parsed = ibkr.parse(multiFeeFlexCsv, { timeZone: "UTC" });
    expect(parsed?.executions[0]?.fee).toBeCloseTo(2.5, 4);
  });

  it("verifies FEE_COLUMNS constant covers all 8 documented columns", () => {
    expect(FEE_COLUMNS).toEqual([
      "commission",
      "brokerexecutioncommission",
      "brokerclearingcommission",
      "thirdpartyexecutioncommission",
      "thirdpartyclearingcommission",
      "thirdpartyregulatorycommission",
      "othercommission",
      "tax",
    ]);
  });

  it("filters DataDiscriminator === 'Order' and ignores ClosedLot, SubTotal, and Total rows", () => {
    const parsed = ibkr.parse(CLASSIC_ACTIVITY_CSV, { timeZone: "UTC" });
    expect(parsed.executions).toHaveLength(2);
    expect(parsed.skippedRows).toBe(1);

    expect(parsed.executions[0]?.symbol).toBe("AAPL");
    expect(parsed.executions[0]?.side).toBe("buy");
    expect(parsed.executions[0]?.quantity).toBe(100);
    expect(parsed.executions[0]?.price).toBe(185.5);
    expect(parsed.executions[0]?.fee).toBe(1.0);

    expect(parsed.executions[1]?.symbol).toBe("AAPL");
    expect(parsed.executions[1]?.side).toBe("sell");
    expect(parsed.executions[1]?.quantity).toBe(100);
    expect(parsed.executions[1]?.price).toBe(187.25);
    expect(parsed.executions[1]?.fee).toBe(1.25);
  });

  it("computes exact round-trip FIFO PnL on Classic Activity Statement fills", () => {
    const parsed = ibkr.parse(CLASSIC_ACTIVITY_CSV, { timeZone: "UTC" });
    const execs = toExecutions(parsed.executions);
    const trips = buildRoundTrips(execs, { method: "fifo" });

    expect(trips).toHaveLength(1);
    expect(trips[0]?.symbol).toBe("AAPL");
    expect(trips[0]?.direction).toBe("long");
    expect(trips[0]?.grossPnl).toBe(175);
    expect(trips[0]?.fees).toBe(2.25);
    expect(trips[0]?.netPnl).toBe(172.75);
    expect(trips[0]?.status).toBe("win");
  });
});

// ============================================================================
// 3. Match-Trader
// ============================================================================
describe("Match-Trader — Format Specification & Business Rules", () => {
  const REAL_MATCHTRADER_HTML = readFileSync(
    new URL("./fixtures/tradezella/matchtrader.html", import.meta.url),
    "utf8",
  );
  const DUPLICATE_MATCHTRADER_HTML = readFileSync(
    new URL("./fixtures/tradezella/match-trader-match-trader.html", import.meta.url),
    "utf8",
  );

  it("detects Match-Trader HTML export across identical fixtures", () => {
    expect(detectFormat(REAL_MATCHTRADER_HTML)?.id).toBe("matchtrader");
    expect(detectFormat(DUPLICATE_MATCHTRADER_HTML)?.id).toBe("matchtrader");
  });

  it("parses real Match-Trader HTML statement extracting account 19286 and 32 executions across 16 rows", () => {
    const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
    expect(parsed?.format).toBe("matchtrader");
    expect(parsed?.account).toBe("19286");
    expect(parsed?.sourceAccounts).toEqual(["19286"]);
    expect(parsed?.executions).toHaveLength(32);
    expect(parsed?.skippedRows).toBe(0);
  });

  it("ensures unique execution IDs for multiple partial closes sharing position ID (e.g. W250539060040427)", () => {
    const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
    const allIds = parsed!.executions.map((e) => e.importMetadata?.id);
    expect(new Set(allIds).size).toBe(32);

    const posTrades = parsed!.executions.filter(
      (e) => e.importMetadata?.group === "matchtrader:19286:W250539060040427",
    );
    expect(posTrades).toHaveLength(4);
    expect(posTrades[0]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:entry");
    expect(posTrades[1]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:exit");
    expect(posTrades[2]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:1:entry");
    expect(posTrades[3]?.importMetadata?.id).toBe("matchtrader:19286:W250539060040427:1:exit");
  });

  it("parses European dot dates (DD.MM.YYYY HH:mm:ss) accurately", () => {
    const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
    const [entry, exit] = parsed!.executions.slice(0, 2);
    expect(entry?.executedAt).toBe("2025-02-19T04:44:10.000Z");
    expect(exit?.executedAt).toBe("2025-02-19T05:56:35.000Z");

    const ambiguousHtml = REAL_MATCHTRADER_HTML.replace(
      /19\.02\.2025 04:44:10/g,
      "05.02.2025 04:44:10",
    );
    const parsedAmbiguous = parseAuto(ambiguousHtml, { timeZone: "UTC", dateOrder: "DMY" });
    expect(parsedAmbiguous?.executions[0]?.executedAt).toBe("2025-02-05T04:44:10.000Z");
  });

  it("correctly infers asset classes across forex, crypto, and indices", () => {
    const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" })!;
    expect(parsed.executions.find((e) => e.symbol === "USDJPY")?.assetClass).toBe("forex");
    expect(parsed.executions.find((e) => e.symbol === "BTCUSD")?.assetClass).toBe("crypto");
    expect(parsed.executions.find((e) => e.symbol === "US30")?.assetClass).toBe("futures");
    expect(parsed.executions.find((e) => e.symbol === "US100")?.assetClass).toBe("futures");
  });

  it("enforces non-negative commission fees so negative fees do not inflate net PnL", () => {
    const parsed = parseAuto(REAL_MATCHTRADER_HTML, { timeZone: "UTC" });
    const exitExec = parsed!.executions[1];
    expect(exitExec?.fee).toBe(18.0);
    expect(exitExec?.fee).toBeGreaterThanOrEqual(0);
    expect(exitExec?.importMetadata?.preserveFee).toBe(true);
  });
});

// ============================================================================
// 4. MetaTrader 4 & 5
// ============================================================================
describe("MetaTrader 4 & 5 — Format Specification & Business Rules", () => {
  const MT4_HTML = readFileSync(
    new URL("./fixtures/tradezella/mt4-metatrader4-mt4.htm", import.meta.url),
    "utf8",
  );
  const MT5_HTML = readFileSync(
    new URL("./fixtures/tradezella/mt5-metatrader5-mt5.html", import.meta.url),
    "utf8",
  );
  const REPORTS_DIR = "/home/jhontavares/Documents/Report MT5";

  it("handles UTF-16LE encoded MT4 HTML statement with BOM", () => {
    const utf16leBuf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(MT4_HTML, "utf16le")]);
    const decoded = decodeImportFile(
      utf16leBuf.buffer.slice(utf16leBuf.byteOffset, utf16leBuf.byteOffset + utf16leBuf.byteLength),
    );
    const parsed = parseAuto(decoded);
    expect(parsed?.format).toBe("metatrader");
    expect(parsed?.account).toBe("6059687");
    expect(parsed?.executions).toHaveLength(98);
  });

  it("handles UTF-16LE encoded MT5 HTML statement with BOM", () => {
    const utf16leBuf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(MT5_HTML, "utf16le")]);
    const decoded = decodeImportFile(
      utf16leBuf.buffer.slice(utf16leBuf.byteOffset, utf16leBuf.byteOffset + utf16leBuf.byteLength),
    );
    const parsed = parseAuto(decoded);
    expect(parsed?.format).toBe("history-metatrader");
    expect(parsed?.account).toBe("1091255053");
    expect(parsed?.executions).toHaveLength(36);
  });

  it("parses MT4/MT5 CSV account history under UTF-8 and UTF-16LE", () => {
    const csvContent = [
      "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit",
      "1001,2026.01.05 09:30,buy,1.00,EURUSD,1.09500,1.09000,1.10000,2026.01.05 14:30,1.09800,-7.00,0.00,-0.50,300.00",
      "1002,2026.01.06 10:00,sell,0.50,GBPUSD,1.27500,1.28000,1.26500,2026.01.06 15:00,1.27100,-3.50,0.00,-0.25,200.00",
    ].join("\n");

    const parsedUtf8 = parseAuto(csvContent);
    expect(parsedUtf8?.format).toBe("history-metatrader");
    expect(parsedUtf8?.executions).toHaveLength(4);

    const utf16Buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csvContent, "utf16le")]);
    const decodedCsv = decodeImportFile(
      utf16Buf.buffer.slice(utf16Buf.byteOffset, utf16Buf.byteOffset + utf16Buf.byteLength),
    );
    const parsedUtf16 = parseAuto(decodedCsv);
    expect(parsedUtf16?.executions).toHaveLength(4);
  });

  it("ensures MT4 statement preserves positive fees for negative commission/swap costs", () => {
    const parsed = parseAuto(MT4_HTML);
    expect(parsed?.executions.every((e) => e.fee >= 0)).toBe(true);

    const trips = buildRoundTrips(toExecutions(parsed!.executions));
    expect(trips).toHaveLength(43);

    const totalGross = trips.reduce((s, t) => s + t.grossPnl, 0);
    const totalFees = trips.reduce((s, t) => s + t.fees, 0);
    const totalNet = trips.reduce((s, t) => s + t.netPnl, 0);
    expect(totalFees).toBeGreaterThan(0);
    expect(totalNet).toBeCloseTo(totalGross - totalFees, 2);
  });

  it("verifies MT5 statement matches official statement totals without fee inversion", () => {
    const parsed = parseAuto(MT5_HTML);
    expect(parsed?.executions.every((e) => e.fee >= 0)).toBe(true);

    const trips = buildRoundTrips(toExecutions(parsed!.executions));
    expect(trips).toHaveLength(18);

    const totalGross = trips.reduce((s, t) => s + t.grossPnl, 0);
    const totalFees = trips.reduce((s, t) => s + t.fees, 0);
    const totalNet = trips.reduce((s, t) => s + t.netPnl, 0);

    expect(totalGross).toBeCloseTo(3702.84, 2);
    expect(totalFees).toBeCloseTo(1058.44, 2);
    expect(totalNet).toBeCloseTo(2644.4, 2);
    expect(totalNet).toBeCloseTo(totalGross - totalFees, 2);
  });

  it("folds swap rollover credits into gross PnL without generating negative fee", () => {
    const syntheticCsv = [
      "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit",
      "2001,2026.01.10 09:30,buy,1.00,EURUSD,1.08000,1.07500,1.09000,2026.01.12 14:30,1.08500,-5.00,0.00,12.50,500.00",
    ].join("\n");

    const parsed = parseAuto(syntheticCsv);
    expect(parsed?.executions).toHaveLength(2);
    const [, exit] = parsed!.executions;
    expect(exit!.fee).toBeGreaterThanOrEqual(0);
  });

  const multilingualFiles = [
    "ReportHistory-530319802-Arabic.html",
    "ReportHistory-530319802-Bengali.html",
    "ReportHistory-530319802-Bulgarian.html",
    "ReportHistory-530319802-PTBR.html",
    "ReportHistory-530319802-PTPT.html",
  ];

  describe.each(multilingualFiles)("Multilingual report: %s", (filename) => {
    const fullPath = join(REPORTS_DIR, filename);
    const isAvailable = existsSync(fullPath);

    it.runIf(isAvailable)(
      "parses 312 executions and extracts account 530319802 without errors",
      () => {
        const fileBuf = readFileSync(fullPath);
        const decoded = decodeImportFile(
          fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength),
        );
        const result = parseAuto(decoded);
        expect(result?.account).toBe("530319802");
        expect(result?.executions).toHaveLength(312);
        expect(result?.executions.every((e) => e.fee >= 0)).toBe(true);
      },
    );
  });
});

// ============================================================================
// 5. NinjaTrader
// ============================================================================
describe("NinjaTrader — Format Specification & Business Rules", () => {
  const COPY_TRADES_CSV = readFileSync(
    new URL("./fixtures/ninjatrader-copy-trades.csv", import.meta.url),
    "utf8",
  );
  const parseNt = (content: string) => parseAuto(content, { timeZone: "UTC" })!;
  const ntIdentity = (content: string) =>
    parseNt(content)
      .executions.map((e) => JSON.stringify([e.importMetadata?.group, e.importMetadata?.id]))
      .sort();
  const ntTrips = (content: string, multipliers = {}) =>
    buildRoundTrips(
      parseNt(content).executions.map((e, i) => ({
        ...e,
        id: String(i),
        accountId: "destination",
        source: "import" as const,
      })),
      { multipliers },
    );
  const ntCsv = (rows: string[]) =>
    [
      "Instrument,Action,Quantity,Price,Time,Account,Connection,Execution ID,Commission",
      ...rows,
    ].join("\n");

  it.each(["ID", "Execution ID"])("recognizes the %s execution identity column", (header) => {
    const content = ntCsv(["AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0"]).replace(
      "Execution ID",
      header,
    );
    expect(parseNt(content).executions[0]?.importMetadata?.id).toBe("execution:e1");
    expect(parseNt(content).warnings).toEqual([]);
  });

  it("preserves all 26 copy-traded fills, including same-account repetitions", () => {
    const result = parseNt(COPY_TRADES_CSV);
    expect(result.format).toBe("ninjatrader");
    expect(result.executions).toHaveLength(26);
    expect(result.skippedRows).toBe(0);
    expect(result.errors).toEqual([]);
    expect(new Set(ntIdentity(COPY_TRADES_CSV)).size).toBe(26);
    expect(new Set(result.executions.map((e) => e.importMetadata?.group)).size).toBe(5);

    const trades = ntTrips(COPY_TRADES_CSV, { MNQZ6: 2 });
    expect(trades).toHaveLength(5);
    expect(
      trades.every(
        (t) => t.status === "win" && t.openQuantity === 0 && t.quantity === 12 && t.netPnl === 1053,
      ),
    ).toBe(true);
    expect(trades.reduce((sum, t) => sum + t.netPnl, 0)).toBe(5265);
    expect(trades.reduce((sum, t) => sum + t.executionCount, 0)).toBe(26);
    expect(result.warnings.join(" ")).toContain("5 source accounts");
    expect(result.warnings.join(" ")).toContain("Overlapping exports");
  });

  it("keeps identities stable across reordering and insertion of unrelated records", () => {
    const [header, ...rows] = COPY_TRADES_CSV.trim().split(/\r?\n/);
    expect(ntIdentity([header, ...rows.toReversed()].join("\n"))).toEqual(
      ntIdentity(COPY_TRADES_CSV),
    );
    expect(ntIdentity(COPY_TRADES_CSV.replace(/\r?\n/g, "\r\n"))).toEqual(
      ntIdentity(COPY_TRADES_CSV),
    );

    const extra = "MNQZ6,Buy,9/16/2026 9:30,29400,Entry,TRADEIFY,1,ACCOUNT-1";
    const extended = ntIdentity([header, extra, ...rows].join("\n"));
    expect(extended).toHaveLength(27);
    expect(extended).toEqual(expect.arrayContaining(ntIdentity(COPY_TRADES_CSV)));
  });

  it("uses execution IDs, not shared order IDs, for identical partial fills", () => {
    const content = ntCsv([
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e2,0",
      "AAPL,Sell,2,101,2026-09-15 09:31,A,broker,e3,0",
    ]);
    expect(parseNt(content).executions.map((e) => e.importMetadata?.id)).toEqual([
      "execution:e1",
      "execution:e2",
      "execution:e3",
    ]);
    expect(ntTrips(content)[0]).toMatchObject({ quantity: 2, netPnl: 2, openQuantity: 0 });

    const orderOnly = content.replace("Execution ID", "Order ID").replaceAll("e2", "e1");
    expect(new Set(ntIdentity(orderOnly)).size).toBe(3);
    expect(parseNt(orderOnly).warnings.join(" ")).toContain("No execution ID");
  });

  it("namespaces reused execution IDs by account, connection and full contract", () => {
    const content = ntCsv([
      "ES 03-26,Buy,1,100,2026-09-15 09:30,A,broker1,e1,0",
      "ES 03-26,Sell,1,100,2026-09-15 09:30,B,broker1,e1,0",
      "ES 03-26,Sell,1,100,2026-09-15 09:30,A,broker2,e1,0",
      "ES 06-26,Sell,1,100,2026-09-15 09:30,A,broker1,e1,0",
    ]);
    expect(parseNt(content).errors).toEqual([]);
    expect(new Set(ntIdentity(content)).size).toBe(4);
    expect(ntTrips(content)).toHaveLength(4);
    expect(ntTrips(content).every((t) => t.openQuantity === 1)).toBe(true);
  });

  it("rejects contradictory rows with the same execution identity", () => {
    const content = ntCsv([
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Buy,1,101,2026-09-15 09:30,A,broker,e1,0",
    ]);
    expect(parseNt(content).errors?.join(" ")).toContain("execution ID describes different fills");
  });

  it("preserves repeated fills without account columns and reports limitation", () => {
    const content =
      "Instrument,Action,Quantity,Price,Time\nAAPL,Buy,1,100,2026-09-15 09:30\nAAPL,Buy,1,100,2026-09-15 09:30";
    expect(new Set(ntIdentity(content)).size).toBe(2);
    expect(parseNt(content).warnings.join(" ")).toContain("no source account");
  });

  it("skips malformed rows without shifting valid identities, preserves fees and flags futures", () => {
    const content = ntCsv([
      "AAPL,Buy,invalid,100,2026-09-15 09:30,A,broker,bad,0",
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Sell,1,101,2026-09-15 09:31,A,broker,e2,0.25",
    ]);
    const result = parseNt(content);
    expect(result.skippedRows).toBe(1);
    expect(result.executions.map((e) => e.fee)).toEqual([0, 0.25]);
    expect(result.executions.every((e) => e.importMetadata?.preserveFee)).toBe(true);
    expect(ntTrips(content)[0]?.netPnl).toBe(0.75);
    expect(parseNt(COPY_TRADES_CSV).executions.every((e) => e.assetClass === "futures")).toBe(true);
  });

  it("imports NinjaTrader Portuguese / Brazilian exports with localized headers and sides", () => {
    const ptbrCsv = [
      "Ativo,Pos. mercado,Quantidade,Preço,Data/Hora,Corretagem,Conta,ID",
      "WINV26,Compra,1,135000.00,25/01/2026 10:15:30,2.50,SIM101,exec_br_1",
      "WINV26,Venda,1,135250.00,25/01/2026 10:45:00,2.50,SIM101,exec_br_2",
    ].join("\n");
    const result = parseAuto(ptbrCsv, { timeZone: "America/Sao_Paulo", dateOrder: "DMY" })!;
    expect(result.format).toBe("ninjatrader");
    expect(result.executions).toHaveLength(2);
    expect(result.executions[0]?.symbol).toBe("WINV26");
    expect(result.executions[0]?.side).toBe("buy");
    expect(result.executions[1]?.side).toBe("sell");
    expect(result.executions[0]?.fee).toBe(2.5);
    expect(result.executions[0]?.importMetadata?.id).toBe("execution:exec_br_1");
  });
});

// ============================================================================
// 6. Quantower
// ============================================================================
describe("Quantower — Format Specification & Business Rules", () => {
  const QUANTOWER_CSV = readFileSync(
    new URL("./fixtures/tradezella/quantower.csv", import.meta.url),
    "utf8",
  );
  const DUPLICATE_CSV = readFileSync(
    new URL("./fixtures/tradezella/quantower-quantower.csv", import.meta.url),
    "utf8",
  );

  it("detects Quantower format across identical fixtures", () => {
    expect(detectFormat(QUANTOWER_CSV)?.id).toBe("quantower");
    expect(detectFormat(DUPLICATE_CSV)?.id).toBe("quantower");
  });

  it("parses real Quantower CSV with account auto-binding, Trade IDs and 15 executions", () => {
    const parsed = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" });
    expect(parsed?.format).toBe("quantower");
    expect(parsed?.account).toBe("Account (USD)");
    expect(parsed?.executions).toHaveLength(15);
    expect(parsed?.executions[0]?.importMetadata?.id).toBe("quantower:trade:1");
    expect(parsed?.executions[14]?.importMetadata?.id).toBe("quantower:trade:15");
    expect(parsed?.executions[0]?.assetClass).toBe("crypto");
  });

  it("normalizes negative quantity on Sell rows to positive execution quantity", () => {
    const parsed = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" });
    expect(parsed?.executions[1]?.side).toBe("sell");
    expect(parsed?.executions[1]?.quantity).toBe(1);
    expect(parsed?.executions[3]?.side).toBe("sell");
    expect(parsed?.executions[3]?.quantity).toBe(1);
  });

  it("preserves extreme decimal precision in crypto lots (e.g. 0.66578506 ETH)", () => {
    const parsed = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" });
    const partial1 = parsed?.executions[2];
    const partial2 = parsed?.executions[4];
    expect(partial1?.quantity).toBe(0.66578506);
    expect(partial2?.quantity).toBe(0.33421494);
    expect(partial1!.quantity + partial2!.quantity).toBeCloseTo(1.0, 8);
  });

  it("resists trailing commas in header lines without shifting data columns", () => {
    const cleanHeader = QUANTOWER_CSV.split(/\r?\n/)[0];
    expect(cleanHeader?.endsWith(",")).toBe(true);

    const parsed = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" });
    expect(parsed?.executions).toHaveLength(15);
    expect(parsed?.executions[0]?.symbol).toBe("ETH/USD");
    expect(parsed?.executions[0]?.price).toBe(1776.04);
  });

  it("correctly parses 12-hour AM/PM timestamps with UTC offsets into UTC ISO strings", () => {
    const parsed = parseAuto(QUANTOWER_CSV, { timeZone: "America/New_York" });
    expect(parsed?.executions[0]?.executedAt).toBe("2023-10-25T20:55:47.000Z");
    expect(parsed?.executions[14]?.executedAt).toBe("2023-10-25T20:55:54.000Z");

    const midnightCsv = [
      "Account,Date/Time,Symbol,Side,Quantity,Price,Trade ID,Exchange,",
      "TestAccount,12/31/2025 11:59:59 PM -05:00,BTC/USD,Buy,1,95000.00,101,KBE,",
      "TestAccount,01/01/2026 12:00:01 AM -05:00,BTC/USD,Sell,1,95100.00,102,KBE,",
    ].join("\n");
    const midnightParsed = parseAuto(midnightCsv, { timeZone: "America/New_York" });
    expect(midnightParsed?.executions[0]?.executedAt).toBe("2026-01-01T04:59:59.000Z");
    expect(midnightParsed?.executions[1]?.executedAt).toBe("2026-01-01T05:00:01.000Z");
  });
});

// ============================================================================
// 7. Rithmic (R | Trader)
// ============================================================================
describe("Rithmic (R | Trader) — Format Specification & Business Rules", () => {
  const RITHMIC_CSV = readFileSync(
    new URL("./fixtures/tradezella/rithmic.csv", import.meta.url),
    "utf8",
  );
  const RITHMIC_COPY_CSV = readFileSync(
    new URL("./fixtures/tradezella/rithmic-r-trader-rithmic-r-trader.csv", import.meta.url),
    "utf8",
  );
  const COMPLETED_ORDERS_HEADER_IDX = RITHMIC_CSV.indexOf('"Account","Status","Remarks"');
  const COMPLETED_ORDERS_CSV = RITHMIC_CSV.slice(COMPLETED_ORDERS_HEADER_IDX).trim();

  it("detects and navigates multi-section layout discarding Working Orders section", () => {
    expect(detectFormat(RITHMIC_CSV)?.id).toBe("rithmic");
    const parsed = parseAuto(RITHMIC_CSV);
    expect(parsed?.account).toBe("APEX-33521-11");
    expect(parsed?.executions).toHaveLength(7);
  });

  it("ignores working and cancelled orders inside Working Orders section", () => {
    const workingSectionWithOrders = [
      "Working Orders",
      '"Account","Status","Buy/Sell","Qty To Fill","Max Show Qty","Symbol","Price Type","Limit Price","Qty Filled","Qty Working","Order Number","Original Sequence Number","Current Sequence Number","User Id","Exchange Order Id","Update Time (EDT)","Expiration Month","Stop/Trigger Price","Duration","Avg Fill Price","Position Disposition","IB Id","FCM Id","Create Time (EDT)","Liquidity Indicator","Executing Venue"',
      '"APEX-33521-11","Working","B","2","","MNQM4","L","17650.00","0","2","999901","AAG999","AAG999","APEX-33521","","2024-04-24 10:20:00","","","DAY","","","","","2024-04-24 10:20:00","",""',
      "",
      "Completed Orders",
      RITHMIC_CSV.slice(COMPLETED_ORDERS_HEADER_IDX),
    ].join("\n");

    const parsed = parseAuto(workingSectionWithOrders);
    expect(parsed?.executions).toHaveLength(7);
    expect(parsed?.account).toBe("APEX-33521-11");
  });

  it("parses standalone Completed Orders export without section header", () => {
    const parsed = parseAuto(COMPLETED_ORDERS_CSV);
    expect(parsed?.executions).toHaveLength(7);
  });

  it("discards 5 cancelled orders with Qty Filled === 0 without crashing", () => {
    const parsed = parseAuto(RITHMIC_CSV);
    expect(parsed?.executions).toHaveLength(7);
    expect(parsed?.skippedRows).toBe(5);

    const parsedIds = parsed!.executions.map((e) => e.importMetadata?.id);
    for (const orderNum of ["1285638967", "1285638949", "1285604393", "1284801530", "1284801528"]) {
      expect(parsedIds).not.toContain(`rithmic:APEX-33521-11:${orderNum}`);
    }
  });

  it("calculates fee as Qty Filled * Commission Fill Rate ($0.51/contract) when Commission is blank", () => {
    const parsed = parseAuto(RITHMIC_CSV);
    expect(parsed?.executions[0]!.quantity).toBe(1);
    expect(parsed?.executions[0]!.fee).toBe(0.51);
    expect(parsed?.executions[2]!.quantity).toBe(2);
    expect(parsed?.executions[2]!.fee).toBe(1.02);
    expect(parsed?.executions[3]!.quantity).toBe(4);
    expect(parsed?.executions[3]!.fee).toBe(2.04);

    const totalFees = parsed!.executions.reduce((acc, e) => acc + e.fee, 0);
    expect(Math.round(totalFees * 100) / 100).toBe(7.14);
  });

  it("prefers explicit Commission column when populated instead of fill rate", () => {
    const customCommCsv = [
      "Completed Orders",
      '"Account","Status","Remarks","Buy/Sell","Qty To Fill","Max Show Qty","Symbol","Price Type","Avg Fill Price","Limit Price","Order Number","Original Sequence Number","Current Sequence Number","User Id","Update Time (EDT)","Qty Filled","Create Time (EDT)","Commission","Liquidity Indicator","Executing Venue","Commission Fill Rate"',
      '"APEX-33521-11","Filled","","B","2","","MNQM4","M","17730.0000","","1285662879","AAG2X5HQ","AAG2X5HQ","APEX-33521","2024-04-24 10:30:05","2","2024-04-24 10:30:05","3.50","","","0.51"',
    ].join("\n");

    const parsed = parseAuto(customCommCsv);
    expect(parsed?.executions[0]!.fee).toBe(3.5);
  });

  it("automatically detects timezone in header ((EDT) -> America/New_York, (CDT) -> America/Chicago)", () => {
    const parsedEdt = parseAuto(RITHMIC_CSV);
    expect(parsedEdt!.executions[0]!.executedAt).toBe("2024-04-24T14:30:05.000Z");

    const cdtCsv = RITHMIC_CSV.replace(/Update Time \(EDT\)/g, "Update Time (CDT)");
    const parsedCdt = parseAuto(cdtCsv);
    expect(parsedCdt!.executions[0]!.executedAt).toBe("2024-04-24T15:30:05.000Z");
  });

  it("reconciles all 7 executions into 2 round trips with exact penny parity", () => {
    const parsed = parseAuto(RITHMIC_CSV);
    const sorted = [...parsed!.executions].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );
    const roundTrips = buildRoundTrips(toExecutions(sorted), {
      method: "fifo",
      multipliers: { MNQM4: 2 },
    });

    expect(roundTrips).toHaveLength(2);
    expect(roundTrips[0]!.grossPnl).toBe(-17.0);
    expect(Math.round(roundTrips[0]!.fees * 100) / 100).toBe(3.06);
    expect(Math.round(roundTrips[0]!.netPnl * 100) / 100).toBe(-20.06);

    expect(roundTrips[1]!.grossPnl).toBe(217.5);
    expect(Math.round(roundTrips[1]!.fees * 100) / 100).toBe(4.08);
    expect(Math.round(roundTrips[1]!.netPnl * 100) / 100).toBe(213.42);
  });

  it("Parity check: rithmic.csv and duplicate fixture produce identical outputs", () => {
    const p1 = parseAuto(RITHMIC_CSV);
    const p2 = parseAuto(RITHMIC_COPY_CSV);
    expect(p1!.executions).toEqual(p2!.executions);
  });
});

// ============================================================================
// 8. ThinkorSwim (Charles Schwab)
// ============================================================================
describe("ThinkorSwim (Charles Schwab) — Format Specification & Business Rules", () => {
  const TOS_FIXTURE = readFileSync(
    new URL("./fixtures/tradezella/thinkorswim.csv", import.meta.url),
    "utf8",
  );
  const TOS_SECOND_FIXTURE = readFileSync(
    new URL("./fixtures/tradezella/thinkorswim-thinkorswim.csv", import.meta.url),
    "utf8",
  );
  const TOS_TRADE_HISTORY_SECTION = [
    "Account Trade History",
    ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
    ",3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
    ",3/20/24 09:18:01,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
    ",3/20/24 08:26:41,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,170.856,170.856,MKT",
    ",3/20/24 08:25:31,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,171.0102,171.0102,MKT",
    ",3/20/24 07:42:17,STOCK,BUY,+309,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+20,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+99,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+300,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+100,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:42:17,STOCK,BUY,+72,TO CLOSE,TSLA,,,STOCK,172.08,172.08,LMT",
    ",3/20/24 07:39:38,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,172.2599,172.2599,MKT",
    ",3/20/24 07:38:08,STOCK,SELL,-2000,TO OPEN,TSLA,,,STOCK,172.3629,172.3629,MKT",
  ].join("\n");

  it("detects and parses real ThinkorSwim export into 13 executions with account 92140825SCHW", () => {
    const parsed = parseAuto(TOS_FIXTURE, { timeZone: "America/Chicago" });
    expect(parsed?.format).toBe("thinkorswim");
    expect(parsed?.account).toBe("92140825SCHW");
    expect(parsed?.executions).toHaveLength(13);
  });

  it("parses thinkorswim-thinkorswim.csv identically to thinkorswim.csv", () => {
    const p1 = parseAuto(TOS_FIXTURE, { timeZone: "America/Chicago" });
    const p2 = parseAuto(TOS_SECOND_FIXTURE, { timeZone: "America/Chicago" });
    expect(p1).toEqual(p2);
  });

  it("parses standalone Account Trade History table directly through thinkorswim.parse", () => {
    const parsed = thinkorswim.parse(TOS_TRADE_HISTORY_SECTION, { timeZone: "America/Chicago" });
    expect(parsed.executions).toHaveLength(13);
    expect(parsed.executions[0]?.symbol).toBe("TSLA");
    expect(parsed.executions[0]?.price).toBe(173.268);
  });

  it("preserves column alignment when header has leading comma but data does not, and vice versa", () => {
    const leadingHeader = [
      "Account Trade History",
      ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
      "3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
    ].join("\n");
    const p1 = thinkorswim.parse(leadingHeader, { timeZone: "America/Chicago" });
    expect(p1.executions[0]?.symbol).toBe("TSLA");
    expect(p1.executions[0]?.quantity).toBe(1000);

    const leadingData = [
      "Account Trade History",
      "Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
      ",3/20/24 09:18:55,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
    ].join("\n");
    const p2 = thinkorswim.parse(leadingData, { timeZone: "America/Chicago" });
    expect(p2.executions[0]?.symbol).toBe("TSLA");
    expect(p2.executions[0]?.quantity).toBe(1000);
  });

  it("correctly converts signed quantities (-2000, +1000) and builds exact short round trip", () => {
    const twoLegs = [
      "Account Trade History",
      ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
      ",3/20/24 09:18:00,STOCK,SELL,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
      ",3/20/24 09:18:55,STOCK,BUY,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
    ].join("\n");

    const parsed = thinkorswim.parse(twoLegs, { timeZone: "America/Chicago" });
    expect(parsed.executions[0]?.quantity).toBe(1000);
    expect(parsed.executions[1]?.quantity).toBe(1000);

    const trips = buildRoundTrips(toExecutions(parsed.executions), { method: "fifo" });
    expect(trips).toHaveLength(1);
    expect(trips[0]?.direction).toBe("short");
    expect(trips[0]?.grossPnl).toBeCloseTo(182.1, 2);
  });

  it("infers side from signed quantity when Side column is blank", () => {
    const missingSideCsv = [
      "Account Trade History",
      ",Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type",
      ",3/20/24 09:18:55,STOCK,,-1000,TO OPEN,TSLA,,,STOCK,173.268,173.268,MKT",
      ",3/20/24 09:18:01,STOCK,,+1000,TO CLOSE,TSLA,,,STOCK,173.0859,173.0859,MKT",
    ].join("\n");

    const parsed = thinkorswim.parse(missingSideCsv, { timeZone: "America/Chicago" });
    expect(parsed.executions[0]?.side).toBe("sell");
    expect(parsed.executions[1]?.side).toBe("buy");
  });

  it("ignores Forex Statements, Futures, Orders, Equities and Options postambles", () => {
    const parsed = thinkorswim.parse(TOS_FIXTURE, { timeZone: "America/Chicago" });
    expect(parsed.executions).toHaveLength(13);
    const symbols = new Set(parsed.executions.map((e) => e.symbol));
    expect(symbols).toEqual(new Set(["TSLA"]));
  });
});

// ============================================================================
// 9. TopstepX
// ============================================================================
describe("TopstepX — Format Specification & Business Rules", () => {
  const TOPSTEPX_CSV = readFileSync(
    new URL("./fixtures/tradezella/topstepx.csv", import.meta.url),
    "utf8",
  );
  const DUPLICATE_CSV = readFileSync(
    new URL("./fixtures/tradezella/topstepx-topstepx.csv", import.meta.url),
    "utf8",
  );
  const LEGACY_FILLS_CSV = `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-101,/ESU6,5000.25,2026-08-20 09:31:05,Opening,Bid,2,Filled,Market
TSX-101,/ESU6,5010.50,2026-08-20 09:45:10,Closing,Ask,2,Filled,Market`;

  it("preserves reported gross P&L on execution legs for NQM4 futures", () => {
    const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
    expect(parsed?.executions).toHaveLength(76);

    const [entry1, exit1] = parsed!.executions.slice(0, 2);
    expect(entry1?.symbol).toBe("NQM4");
    expect(entry1?.side).toBe("sell");
    expect(exit1?.symbol).toBe("NQM4");
    expect(exit1?.side).toBe("buy");
    expect(exit1?.importMetadata?.reportedGrossPnl).toBe(90.0);
    expect(exit1?.fee).toBe(1.4);
  });

  it("reconciles all 38 trades with penny-perfect parity against reported statement", () => {
    const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
    const sorted = [...parsed!.executions].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );
    const roundTrips = buildRoundTrips(toExecutions(sorted), {
      method: "fifo",
      multipliers: { NQM4: 20 },
    });

    expect(roundTrips).toHaveLength(38);
    const totalGross = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
    const totalFees = roundTrips.reduce((acc, rt) => acc + rt.fees, 0);
    const totalNet = roundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);

    expect(totalGross).toBe(-315.0);
    expect(Math.round(totalFees * 100) / 100).toBe(70.0);
    expect(Math.round(totalNet * 100) / 100).toBe(-385.0);
  });

  it("detects and parses Fills tab format (legacy fills)", () => {
    const parsed = topstepx.parse(LEGACY_FILLS_CSV, { timeZone: "America/Chicago" });
    expect(parsed.account).toBe("TSX-101");
    expect(parsed.executions).toHaveLength(2);
    expect(parsed.executions[0]!.symbol).toBe("ESU6");
    expect(parsed.executions[0]!.side).toBe("buy");
    expect(parsed.executions[1]!.side).toBe("sell");
  });

  it("infers side via (entryPrice < exitPrice) === (pnl > 0) when Type is missing", () => {
    const testCases = [
      { entryPrice: 100, exitPrice: 110, pnl: 50, entrySide: "buy", exitSide: "sell" },
      { entryPrice: 110, exitPrice: 100, pnl: -50, entrySide: "buy", exitSide: "sell" },
      { entryPrice: 110, exitPrice: 100, pnl: 50, entrySide: "sell", exitSide: "buy" },
      { entryPrice: 100, exitPrice: 110, pnl: -50, entrySide: "sell", exitSide: "buy" },
    ];

    for (const tc of testCases) {
      const csv = [
        "Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,TradeDay",
        `99901,NQM4,05/07/2024 13:30:00 +00:00,05/07/2024 13:35:00 +00:00,${tc.entryPrice},${tc.exitPrice},1.40,${tc.pnl},1,05/07/2024 05:00:00 +00:00`,
      ].join("\n");
      const parsed = parseAuto(csv, { timeZone: "UTC" })!;
      expect(parsed.executions[0]!.side).toBe(tc.entrySide);
      expect(parsed.executions[1]!.side).toBe(tc.exitSide);
    }
  });

  it("reconstructs 100% of directions identically on real CSV when Type column is stripped", () => {
    const lines = TOPSTEPX_CSV.trim().split("\n");
    const headerParts = lines[0]!.split(",");
    const typeIndex = headerParts.indexOf("Type");
    const strippedCsv = lines
      .map((line) => {
        const parts = line.split(",");
        parts.splice(typeIndex, 1);
        return parts.join(",");
      })
      .join("\n");

    const pOriginal = parseAuto(TOPSTEPX_CSV, { timeZone: "UTC" })!;
    const pStripped = parseAuto(strippedCsv, { timeZone: "UTC" })!;
    expect(pStripped.executions).toHaveLength(pOriginal.executions.length);
    for (let i = 0; i < pOriginal.executions.length; i++) {
      expect(pStripped.executions[i]!.side).toBe(pOriginal.executions[i]!.side);
    }
  });

  it("consolidates $1.40 round-trip fee on the exit execution leg", () => {
    const parsed = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" })!;
    expect(parsed.executions[0]!.fee).toBe(0);
    expect(parsed.executions[1]!.fee).toBe(1.4);

    // 3-contract trade
    const size3Entry = parsed.executions[30]!;
    const size3Exit = parsed.executions[31]!;
    expect(size3Entry.quantity).toBe(3);
    expect(size3Entry.fee).toBe(0);
    expect(size3Exit.quantity).toBe(3);
    expect(size3Exit.fee).toBe(4.2);
  });

  it("Parity check: topstepx.csv and duplicate fixture produce identical outputs", () => {
    const p1 = parseAuto(TOPSTEPX_CSV, { timeZone: "America/Chicago" });
    const p2 = parseAuto(DUPLICATE_CSV, { timeZone: "America/Chicago" });
    expect(p1!.executions).toEqual(p2!.executions);
  });
});

// ============================================================================
// 10. TradeZella
// ============================================================================
describe("TradeZella — Format Specification & Business Rules", () => {
  it.each([
    { tzAbbr: "EST", zone: "America/New_York", expectedHourUtc: 14 },
    { tzAbbr: "EDT", zone: "America/New_York", expectedHourUtc: 14 },
    { tzAbbr: "CST", zone: "America/Chicago", expectedHourUtc: 15 },
    { tzAbbr: "CDT", zone: "America/Chicago", expectedHourUtc: 15 },
    { tzAbbr: "PST", zone: "America/Los_Angeles", expectedHourUtc: 17 },
    { tzAbbr: "UTC", zone: "UTC", expectedHourUtc: 9 },
    { tzAbbr: "GMT", zone: "UTC", expectedHourUtc: 9 },
  ])(
    "strips timezone suffix %s and parses naive timestamp in %s",
    ({ tzAbbr, zone, expectedHourUtc }) => {
      const csv = [
        "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
        `2026-01-05 09:30:00 ${tzAbbr},2026-01-05 10:30:00 ${tzAbbr},AAPL,LONG,100,185.00,187.00,195.00,5.00`,
      ].join("\n");
      const parsed = parseAuto(csv, { timeZone: zone });
      expect(new Date(parsed!.executions[0]!.executedAt).getUTCHours()).toBe(expectedHourUtc);
    },
  );

  it("interprets ambiguous slash dates differently according to dateOrder (MDY vs DMY)", () => {
    const ambiguousCsv = [
      "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
      "05/01/2026 09:30:00,05/01/2026 10:30:00,AAPL,LONG,10,100.00,105.00,50.00,0.00",
    ].join("\n");

    const parsedMdy = parseAuto(ambiguousCsv, { dateOrder: "MDY", timeZone: "UTC" });
    expect(parsedMdy?.executions[0]?.executedAt).toBe("2026-05-01T09:30:00.000Z");

    const parsedDmy = parseAuto(ambiguousCsv, { dateOrder: "DMY", timeZone: "UTC" });
    expect(parsedDmy?.executions[0]?.executedAt).toBe("2026-01-05T09:30:00.000Z");
  });

  it("reconciles implied fees when TradeZella stated Net P&L includes unstated fees", () => {
    // Long
    const longCsv = [
      "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
      "2026-01-05 09:31:00,2026-01-05 10:15:00,AAPL,LONG,100,185.00,187.00,192.50,2.00",
    ].join("\n");
    const parsedLong = parseAuto(longCsv)!;
    expect(parsedLong.executions[1]!.fee).toBeCloseTo(7.5, 4);

    // Short
    const shortCsv = [
      "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
      "2026-01-06 09:45:00,2026-01-06 09:52:00,TSLA,SHORT,50,240.00,242.00,-103.50,0.00",
    ].join("\n");
    const parsedShort = parseAuto(shortCsv)!;
    expect(parsedShort.executions[1]!.fee).toBeCloseTo(3.5, 4);
  });

  it("guards against absurd divergence when contract multipliers are present", () => {
    const csv = [
      "Open Date,Close Date,Symbol,Side,Volume,Entry Price,Exit Price,Net P&L,Commissions",
      "2026-01-10 09:30:00,2026-01-10 10:00:00,NQ,LONG,1,17000.00,17010.00,195.00,5.00",
    ].join("\n");
    const parsed = parseAuto(csv)!;
    expect(parsed.executions[1]!.fee).toBe(5.0);
  });

  it("trade factory object mothers infrastructure", () => {
    const imp = createImportedExecution({ symbol: "ES", price: 5000 });
    expect(imp.symbol).toBe("ES");
    const exec = createExecution({ symbol: "NQ", price: 18000 });
    expect(exec.symbol).toBe("NQ");

    const [lEntry, lExit] = createTradePair({ symbol: "AAPL", direction: "long" });
    const trips = buildRoundTrips([lEntry, lExit]);
    expect(trips).toHaveLength(1);
    expect(trips[0]!.direction).toBe("long");

    const [sEntry, sExit] = createImportedTradePair({ symbol: "TSLA", direction: "short" });
    expect(sEntry.side).toBe("sell");
    expect(sExit.side).toBe("buy");
  });
});

// ============================================================================
// 11. TradingView
// ============================================================================
describe("TradingView — Format Specification & Business Rules", () => {
  const REAL_TV_CSV = readFileSync(
    new URL("./fixtures/tradezella/tradingview-tradingview.csv", import.meta.url),
    "utf8",
  );
  const DEMO_TV_CSV_PATH = resolve(__dirname, "../../../docs/samples/demo-trades-tradingview.csv");
  const DEMO_TV_CSV = readFileSync(DEMO_TV_CSV_PATH, "utf8");

  it("detects TradingView format from headers and content", () => {
    expect(detectFormat(REAL_TV_CSV)?.id).toBe("tradingview");
    expect(detectFormat(DEMO_TV_CSV)?.id).toBe("tradingview");
  });

  it("parses real TradingView export extracting exactly 32 filled orders and skipping 47 non-filled rows", () => {
    const parsed = parseAuto(REAL_TV_CSV, { timeZone: "UTC" });
    expect(parsed?.executions).toHaveLength(32);
    expect(parsed?.skippedRows).toBe(47);
  });

  it("parses high-volume demo TradingView export with 2038 executions without skipped rows", () => {
    const parsed = parseAuto(DEMO_TV_CSV, { timeZone: "UTC" });
    expect(parsed?.executions).toHaveLength(2038);
    expect(parsed?.skippedRows).toBe(0);
  });

  it("filters Status === 'Filled' and discards Cancelled, Rejected, Expired orders", () => {
    const csvWithStatuses = [
      "Symbol,Side,Qty,Fill Price,Status,Placing Time,Closing Time",
      "AAPL,Buy,10,150.00,Filled,2025-02-01 10:00:00,2025-02-01 10:05:00",
      "AAPL,Sell,10,155.00,Cancelled,2025-02-01 10:10:00,2025-02-01 10:15:00",
      "TSLA,Buy,5,200.00,Rejected,2025-02-01 10:20:00,2025-02-01 10:25:00",
      "NVDA,Buy,20,120.00,Expired,2025-02-01 10:30:00,2025-02-01 10:35:00",
    ].join("\n");

    const parsed = parseAuto(csvWithStatuses, { timeZone: "UTC" });
    expect(parsed?.executions).toHaveLength(1);
    expect(parsed?.executions[0]?.symbol).toBe("AAPL");
    expect(parsed?.skippedRows).toBe(3);
  });

  it("strips exchange prefixes from symbol names", () => {
    const [firstExec] = parseAuto(REAL_TV_CSV, { timeZone: "UTC" })!.executions;
    expect(firstExec?.symbol).toBe("NQ1!");
  });

  it("prioritizes Closing Time over Placing Time for execution timestamp", () => {
    const parsed = parseAuto(REAL_TV_CSV, { timeZone: "UTC" });
    expect(parsed?.executions[0]?.executedAt).toBe("2025-02-03T11:49:28.000Z");
  });

  it("parses monetary values with formatted commas and currency symbols without corrupting values", () => {
    const csv = [
      "Symbol,Side,Qty,Fill Price,Commission,Status,Margin,Closing Time",
      `CME_MINI:NQ1!,Buy,3,"21,412.00","$5.1389",Filled,"64,236.75 USD",2025-02-03 11:49:28`,
    ].join("\n");
    const parsed = parseAuto(csv, { timeZone: "UTC" });
    expect(parsed?.executions[0]?.price).toBe(21412);
    expect(parsed?.executions[0]?.fee).toBeCloseTo(5.1389, 4);
  });
});

// ============================================================================
// 12. Tradovate / Lucid Trading
// ============================================================================
describe("Tradovate / Lucid Trading — Format Specification & Business Rules", () => {
  const FIXTURES_DIR = join(__dirname, "fixtures", "tradovate-lucid");
  const ORDER_FILES = [
    "Orders.csv",
    "Orders(1).csv",
    "Orders(2).csv",
    "Orders(3).csv",
    "Orders(4).csv",
  ];

  it("parses all 5 separate order batches and verifies account and fill counts", () => {
    let totalFilled = 0;
    const expectedPerFile: Record<string, number> = {
      "Orders.csv": 76,
      "Orders(1).csv": 22,
      "Orders(2).csv": 14,
      "Orders(3).csv": 36,
      "Orders(4).csv": 18,
    };

    for (const file of ORDER_FILES) {
      const content = readFileSync(join(FIXTURES_DIR, file), "utf-8");
      const parsed = parseAuto(content, { timeZone: "America/Chicago" });
      expect(parsed?.format).toBe("tradovate");
      expect(parsed?.account).toBe("LFE0506847043001");
      expect(parsed?.executions.length).toBe(expectedPerFile[file]);
      totalFilled += parsed?.executions.length ?? 0;
    }
    expect(totalFilled).toBe(166);
  });

  it("reconciles with Lucid Trading site down to the exact penny", () => {
    const allExecutions: ImportedExecution[] = [];
    for (const file of ORDER_FILES) {
      const parsed = parseAuto(readFileSync(join(FIXTURES_DIR, file), "utf-8"), {
        timeZone: "America/Chicago",
      });
      if (parsed) allExecutions.push(...parsed.executions);
    }
    allExecutions.sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    );

    const roundTrips = buildRoundTrips(allExecutions as Execution[], {
      method: "fifo",
      multipliers: { MES: 5, MNQ: 2 },
    });

    const grossPnl = roundTrips.reduce((acc, rt) => acc + rt.grossPnl, 0);
    const totalFees = roundTrips.reduce((acc, rt) => acc + rt.fees, 0);
    const netPnl = roundTrips.reduce((acc, rt) => acc + rt.netPnl, 0);
    const finalBalance = 50000.0 + netPnl;

    expect(grossPnl).toBe(-636.25);
    expect(totalFees).toBe(91.0);
    expect(netPnl).toBe(-727.25);
    expect(finalBalance).toBe(49272.75);
    expect(Math.round(finalBalance)).toBe(49273);
  });
});
