import { describe, expect, it } from "vitest";
import {
  detectCsvMetadata,
  parseCandleTimestamp,
  parseMarketCsv,
  extractResolutionFromFilename,
  inferResolutionFromDeltas,
} from "../src/lib/market-csv";
import {
  parseResolutionMs,
  formatResolutionDisplay,
  normalizeResolution,
} from "../src/lib/market-data";
import { getDefaultCompatibleSymbols } from "../src/lib/assets/symbol-utils";

describe("market-csv detection & timestamp parser", () => {
  describe("parseCandleTimestamp", () => {
    it("parses 10-digit Unix seconds", () => {
      expect(parseCandleTimestamp("1789376700")).toBe(1789376700000);
    });

    it("parses 13-digit Unix milliseconds", () => {
      expect(parseCandleTimestamp("1789376700000")).toBe(1789376700000);
    });

    it("parses ISO-8601 UTC with T and Z", () => {
      expect(parseCandleTimestamp("2026-09-14T09:05:00Z")).toBe(1789376700000);
    });

    it("parses TradingView standard format with space (assumes UTC)", () => {
      expect(parseCandleTimestamp("2026-09-14 09:05:00")).toBe(1789376700000);
    });

    it("returns NaN for invalid dates", () => {
      expect(Number.isNaN(parseCandleTimestamp("invalid"))).toBe(true);
      expect(Number.isNaN(parseCandleTimestamp("2026-02-31 09:05:00"))).toBe(true);
    });
  });

  describe("detectCsvMetadata", () => {
    it("detects symbol, resolution and currency from TradingView export filename (5m)", () => {
      const meta = detectCsvMetadata("MES1_5m_websocket.csv");
      expect(meta.symbol).toBe("MES");
      expect(meta.resolution).toBe("5m");
      expect(meta.currency).toBe("USD");
      expect(meta.priceBasis).toBe("raw");
      expect(meta.family?.id).toBe("sp500");
    });

    it("detects symbol MES and 30m resolution from MES1_30m_websocket.csv", () => {
      const meta = detectCsvMetadata("MES1_30m_websocket.csv");
      expect(meta.symbol).toBe("MES");
      expect(meta.resolution).toBe("30m");
      expect(meta.currency).toBe("USD");
      expect(meta.priceBasis).toBe("raw");
      expect(meta.family?.id).toBe("sp500");
    });

    it("preserves exact ground truth for US500 specific files", () => {
      const meta = detectCsvMetadata("US500_5m.csv");
      expect(meta.symbol).toBe("US500");
      expect(meta.resolution).toBe("5m");
      expect(meta.currency).toBe("USD");
      expect(meta.family?.id).toBe("sp500");
    });

    it("mathematically calculates 30m resolution from 1800s content delta", () => {
      const content = `timestamp,open,high,low,close
1789376400,7600,7605,7598,7602
1789378200,7602,7608,7601,7606`;
      const meta = detectCsvMetadata("MES_data.csv", content);
      expect(meta.resolution).toBe("30m");
    });

    it("mathematically calculates resolution from content delta when filename lacks timeframe", () => {
      const content = `timestamp,open,high,low,close
1789376700,7600,7605,7598,7602
1789377000,7602,7608,7601,7606`;
      // 1789377000 - 1789376700 = 300s = 5m
      const meta = detectCsvMetadata("candles_export.csv", content);
      expect(meta.resolution).toBe("5m");
    });

    it("calculates 1m resolution from 60s content delta", () => {
      const content = `time,open,high,low,close
2026-09-14T09:00:00Z,100,105,95,102
2026-09-14T09:01:00Z,102,106,101,104`;
      const meta = detectCsvMetadata("export.csv", content);
      expect(meta.resolution).toBe("1m");
    });

    it("extracts symbol from content column if present", () => {
      const content = `time,symbol,open,high,low,close
1789376700,MES,7600,7605,7598,7602
1789377000,MES,7602,7608,7601,7606`;
      const meta = detectCsvMetadata("generic_file.csv", content);
      expect(meta.symbol).toBe("MES");
      expect(meta.resolution).toBe("5m");
    });

    it("detects 15m resolution from NQ_2026_15m.csv without matching year 2026", () => {
      const meta = detectCsvMetadata("NQ_2026_15m.csv");
      expect(meta.symbol).toBe("NQ");
      expect(meta.resolution).toBe("15m");
    });

    it("calculates resolution correctly from descending CSV files (newest to oldest)", () => {
      const content = `timestamp,open,high,low,close
1789378200,7602,7608,7601,7606
1789376400,7600,7605,7598,7602`;
      const meta = detectCsvMetadata("descending_data.csv", content);
      expect(meta.resolution).toBe("30m");
    });

    it("calculates resolution correctly when timestamp column is labeled datetime_utc", () => {
      const content = `datetime_utc,open,high,low,close
2026-09-14 09:00:00,100,105,95,102
2026-09-14 09:15:00,102,106,101,104`;
      const meta = detectCsvMetadata("feed.csv", content);
      expect(meta.resolution).toBe("15m");
    });
  });

  describe("parseMarketCsv format resilience", () => {
    it("parses download_tv_ohlc websocket format with timestamp and datetime columns", () => {
      const content = `timestamp,datetime_utc,datetime_local,open,high,low,close,volume
1789376700,2026-09-14 09:05:00,2026-09-14 06:05:00,7606.75,7607.75,7605.5,7606.5,476.0
1789377000,2026-09-14 09:10:00,2026-09-14 06:10:00,7606.25,7607.25,7599.5,7601.25,1508.0`;
      const bars = parseMarketCsv(content, "MES", "5m");
      expect(bars).toHaveLength(2);
      expect(bars[0]!.time).toBe(1789376700000);
      expect(bars[0]!.open).toBe(7606.75);
    });

    it("parses ISO UTC datetime format", () => {
      const content = `time,open,high,low,close,volume
2026-10-06T18:15:00Z,7883.0,7883.5,7880.5,7880.5,3190.0
2026-10-06T18:20:00Z,7880.5,7881.25,7878.5,7880.25,5411.0`;
      const bars = parseMarketCsv(content, "MES", "5m");
      expect(bars).toHaveLength(2);
      expect(bars[0]!.open).toBe(7883.0);
      expect(bars[0]!.high).toBe(7883.5);
    });

    it("parses daily (1d) candles starting at 22:00/23:00 UTC (CME session open)", () => {
      const content = `timestamp,open,high,low,close,volume
1790546400,7795.75,7803.25,7726.0,7746.75,1207911
1790632800,7746.75,7767.75,7712.25,7732.0,1102389
1790719200,7739.0,7782.25,7705.5,7715.5,1166971`;
      const bars = parseMarketCsv(content, "MES", "1d");
      expect(bars).toHaveLength(3);
      expect(bars[0]!.time).toBe(1790546400000);
      expect(new Date(bars[0]!.time).toISOString()).toContain("22:00:00.000Z");
    });

    it("parses 4h candles spanning Daylight Saving Time shifts", () => {
      // Bar 1 in EDT (14:00 UTC), Bar 2 in EST (15:00 UTC)
      const content = `time,open,high,low,close,volume
2023-11-03T18:00:00Z,4450.0,4460.0,4445.0,4455.0,10000
2023-11-03T22:00:00Z,4455.0,4465.0,4450.0,4460.0,12000
2023-11-05T23:00:00Z,4460.0,4470.0,4455.0,4465.0,15000
2023-11-06T03:00:00Z,4465.0,4475.0,4460.0,4470.0,14000`;
      const bars = parseMarketCsv(content, "MES", "4h");
      expect(bars).toHaveLength(4);
      expect(bars[0]!.time).toBe(Date.parse("2023-11-03T18:00:00Z"));
      expect(bars[2]!.time).toBe(Date.parse("2023-11-05T23:00:00Z"));
    });

    it("parses weekly (1w) candles including holiday weeks starting on Tuesday", () => {
      const content = `time,open,high,low,close,volume
2026-01-05T00:00:00Z,100,105,95,102,1000
2026-01-12T00:00:00Z,102,108,101,107,1100
2026-01-20T00:00:00Z,107,112,105,110,1200
2026-01-26T00:00:00Z,110,115,108,114,1300`;
      const bars = parseMarketCsv(content, "AAPL", "1w");
      expect(bars).toHaveLength(4);
    });

    it("parses monthly (1mo) candles across irregular calendar months (28-31 days)", () => {
      const content = `Date,Open,High,Low,Close,Volume
2026-01-01,100,110,90,105,50000
2026-02-01,105,115,102,112,45000
2026-03-01,112,120,108,118,52000
2026-04-01,118,125,115,122,48000`;
      const bars = parseMarketCsv(content, "AAPL", "1mo");
      expect(bars).toHaveLength(4);
      expect(bars[0]!.time).toBe(Date.parse("2026-01-01T00:00:00Z"));
      expect(bars[1]!.time).toBe(Date.parse("2026-02-01T00:00:00Z"));
    });

    it("rejects intraday minute bars uploaded under daily (1d) resolution", () => {
      const content = `time,open,high,low,close,volume
2026-10-06T18:15:00Z,7883.0,7883.5,7880.5,7880.5,3190
2026-10-06T18:20:00Z,7880.5,7881.25,7878.5,7880.25,5411`;
      expect(() => parseMarketCsv(content, "MES", "1d")).toThrow(
        "Interval between candles is too small",
      );
    });

    it("rejects intraday minute bars uploaded under 4h resolution", () => {
      const content = `time,open,high,low,close,volume
2026-10-06T18:15:00Z,7883.0,7883.5,7880.5,7880.5,3190
2026-10-06T18:20:00Z,7880.5,7881.25,7878.5,7880.25,5411`;
      expect(() => parseMarketCsv(content, "MES", "4h")).toThrow(
        "Interval between candles is too small",
      );
    });
  });

  describe("extractResolutionFromFilename", () => {
    it("extracts exact standard and custom resolutions", () => {
      expect(extractResolutionFromFilename("MES1_30m_websocket")).toBe("30m");
      expect(extractResolutionFromFilename("MES_15m_review")).toBe("15m");
      expect(extractResolutionFromFilename("NQ_2m")).toBe("2m");
      expect(extractResolutionFromFilename("AAPL_10min")).toBe("10m");
      expect(extractResolutionFromFilename("BTC_2h_candles")).toBe("2h");
      expect(extractResolutionFromFilename("ETH_12h")).toBe("12h");
      expect(extractResolutionFromFilename("ES_daily")).toBe("1d");
      expect(extractResolutionFromFilename("SPY_weekly")).toBe("1w");
      expect(extractResolutionFromFilename("QQQ_monthly")).toBe("1mo");
    });

    it("does not match non-resolution symbol numbers like MES1", () => {
      expect(extractResolutionFromFilename("MES1_export")).toBeUndefined();
    });
  });

  describe("inferResolutionFromDeltas", () => {
    it("infers standard timeframe despite session/weekend gaps", () => {
      // 10 consecutive 30m bars (1800s) + 1 weekend gap (172800s)
      const deltas = [1800, 1800, 1800, 1800, 1800, 172800, 1800, 1800, 1800, 1800];
      expect(inferResolutionFromDeltas(deltas)).toBe("30m");
    });

    it("infers 2m and 10m resolutions accurately", () => {
      expect(inferResolutionFromDeltas([120, 120, 120, 120])).toBe("2m");
      expect(inferResolutionFromDeltas([600, 600, 600, 600])).toBe("10m");
    });

    it("infers extended timeframes: 2h, 12h, 1d, 1w, 1mo", () => {
      expect(inferResolutionFromDeltas([7200, 7200])).toBe("2h");
      expect(inferResolutionFromDeltas([43200, 43200])).toBe("12h");
      expect(inferResolutionFromDeltas([86400, 86400])).toBe("1d");
      expect(inferResolutionFromDeltas([604800, 604800])).toBe("1w");
      expect(inferResolutionFromDeltas([2592000, 2592000])).toBe("1mo");
    });

    it("filters out zero, negative, and extreme weekend/holiday gaps (> 7 days)", () => {
      expect(inferResolutionFromDeltas([0, -60, 1800, 1800, 900000])).toBe("30m");
      expect(inferResolutionFromDeltas([0, -10])).toBeUndefined();
      expect(inferResolutionFromDeltas([])).toBeUndefined();
    });
  });

  describe("parseResolutionMs", () => {
    it("calculates accurate millisecond durations for standard industry resolutions", () => {
      expect(parseResolutionMs("1m")).toBe(60_000);
      expect(parseResolutionMs("2m")).toBe(120_000);
      expect(parseResolutionMs("3m")).toBe(180_000);
      expect(parseResolutionMs("5m")).toBe(300_000);
      expect(parseResolutionMs("10m")).toBe(600_000);
      expect(parseResolutionMs("15m")).toBe(900_000);
      expect(parseResolutionMs("30m")).toBe(1_800_000);
      expect(parseResolutionMs("45m")).toBe(2_700_000);
      expect(parseResolutionMs("1h")).toBe(3_600_000);
      expect(parseResolutionMs("2h")).toBe(7_200_000);
      expect(parseResolutionMs("3h")).toBe(10_800_000);
      expect(parseResolutionMs("4h")).toBe(14_400_000);
      expect(parseResolutionMs("6h")).toBe(21_600_000);
      expect(parseResolutionMs("8h")).toBe(28_800_000);
      expect(parseResolutionMs("12h")).toBe(43_200_000);
      expect(parseResolutionMs("1d")).toBe(86_400_000);
      expect(parseResolutionMs("3d")).toBe(259_200_000);
      expect(parseResolutionMs("1w")).toBe(604_800_000);
      expect(parseResolutionMs("1mo")).toBe(2_592_000_000);
    });

    it("parses custom intervals with arbitrary units", () => {
      expect(parseResolutionMs("30s")).toBe(30_000);
      expect(parseResolutionMs("90m")).toBe(5_400_000);
      expect(parseResolutionMs("5h")).toBe(18_000_000);
      expect(parseResolutionMs("2d")).toBe(172_800_000);
      expect(parseResolutionMs("2w")).toBe(1_209_600_000);
      expect(parseResolutionMs("2mo")).toBe(5_184_000_000);
    });

    it("falls back to 60_000 for invalid or empty strings", () => {
      expect(parseResolutionMs("invalid")).toBe(60_000);
      expect(parseResolutionMs("")).toBe(60_000);
    });
  });

  describe("formatResolutionDisplay", () => {
    it("formats minute resolutions canonically", () => {
      expect(formatResolutionDisplay("1m")).toBe("1m");
      expect(formatResolutionDisplay("5m")).toBe("5m");
      expect(formatResolutionDisplay("15m")).toBe("15m");
      expect(formatResolutionDisplay("30m")).toBe("30m");
    });

    it("formats hour resolutions with capitalized H", () => {
      expect(formatResolutionDisplay("1h")).toBe("1H");
      expect(formatResolutionDisplay("2h")).toBe("2H");
      expect(formatResolutionDisplay("4h")).toBe("4H");
      expect(formatResolutionDisplay("12h")).toBe("12H");
    });

    it("formats day resolutions as D or xD", () => {
      expect(formatResolutionDisplay("1d")).toBe("D");
      expect(formatResolutionDisplay("3d")).toBe("3D");
    });

    it("formats week resolutions as W", () => {
      expect(formatResolutionDisplay("1w")).toBe("W");
    });

    it("formats month resolutions as M", () => {
      expect(formatResolutionDisplay("1mo")).toBe("M");
    });

    it("formats custom community resolutions cleanly", () => {
      expect(formatResolutionDisplay("7m")).toBe("7m");
      expect(formatResolutionDisplay("8h")).toBe("8H");
      expect(formatResolutionDisplay("2d")).toBe("2D");
    });
  });

  describe("normalizeResolution", () => {
    it("normalizes capitalized display notations to canonical database format", () => {
      expect(normalizeResolution("1H")).toBe("1h");
      expect(normalizeResolution("4H")).toBe("4h");
      expect(normalizeResolution("D")).toBe("1d");
      expect(normalizeResolution("3D")).toBe("3d");
      expect(normalizeResolution("W")).toBe("1w");
      expect(normalizeResolution("M")).toBe("1mo");
    });

    it("normalizes word aliases and multi-character units", () => {
      expect(normalizeResolution("30min")).toBe("30m");
      expect(normalizeResolution("2hr")).toBe("2h");
      expect(normalizeResolution("daily")).toBe("1d");
      expect(normalizeResolution("weekly")).toBe("1w");
      expect(normalizeResolution("monthly")).toBe("1mo");
    });

    it("normalizes uppercase M correctly for minutes vs month", () => {
      expect(normalizeResolution("15M")).toBe("15m");
      expect(normalizeResolution("30M")).toBe("30m");
      expect(normalizeResolution("1M")).toBe("1mo");
      expect(normalizeResolution("M")).toBe("1mo");
    });
  });

  describe("Asset Class Disambiguation (Futures vs CFD)", () => {
    it("detects US100.cash MT5 CSV as CFD family without mixing Futures (MNQ/NQ)", () => {
      const mt5Csv = `timestamp,datetime_utc,datetime_local,open,high,low,close,volume,spread
1759482000,2025-10-03 09:00:00+00:00,2025-10-03 06:00:00-03:00,24834.02,24851.92,24830.32,24844.52,2777,112
1759483800,2025-10-03 09:30:00+00:00,2025-10-03 06:30:00-03:00,24844.52,24860.00,24840.00,24855.00,2800,110`;

      const detected = detectCsvMetadata("US100.cash_30m_mt5.csv", mt5Csv);
      expect(detected.symbol).toBe("US100");
      expect(detected.resolution).toBe("30m");
      expect(detected.compatibleSymbols).toEqual([
        "US100",
        "US100.CASH",
        "NAS100",
        "USTEC",
        "NDX",
      ]);
      expect(detected.compatibleSymbols).not.toContain("MNQ");
      expect(detected.compatibleSymbols).not.toContain("NQ");
    });

    it("detects MNQ Futures CSV with only Futures family compatibleSymbols (MNQ, NQ)", () => {
      const mnqCsv = `time,open,high,low,close,volume
1759482000,24834.00,24852.00,24830.00,24844.50,1500
1759482900,24844.50,24860.00,24840.00,24855.00,1600`;

      const detected = detectCsvMetadata("MNQ1_15m_websocket.csv", mnqCsv);
      expect(detected.symbol).toBe("MNQ");
      expect(detected.resolution).toBe("15m");
      expect(detected.compatibleSymbols).toEqual(["MNQ", "NQ"]);
      expect(detected.compatibleSymbols).not.toContain("US100");
      expect(detected.compatibleSymbols).not.toContain("US100.CASH");
    });

    it("isolates commodities and forex spot/CFDs from CME futures in getDefaultCompatibleSymbols", () => {
      expect(getDefaultCompatibleSymbols("XAUUSD")).toEqual(["XAUUSD", "GOLD"]);
      expect(getDefaultCompatibleSymbols("GC")).toEqual(["GC", "MGC"]);
      expect(getDefaultCompatibleSymbols("USOIL")).toEqual(["USOIL", "WTI"]);
      expect(getDefaultCompatibleSymbols("CL")).toEqual(["CL", "MCL"]);
      expect(getDefaultCompatibleSymbols("EURUSD")).toEqual(["EURUSD"]);
      expect(getDefaultCompatibleSymbols("6E")).toEqual(["6E", "M6E"]);
    });
  });
});
