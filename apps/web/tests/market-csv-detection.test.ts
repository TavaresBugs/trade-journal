import { describe, expect, it } from "vitest";
import { detectCsvMetadata, parseCandleTimestamp, parseMarketCsv } from "../src/lib/market-csv";

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
    it("detects symbol, resolution and currency from TradingView export filename", () => {
      const meta = detectCsvMetadata("MES1_5m_websocket.csv");
      expect(meta.symbol).toBe("MES");
      expect(meta.resolution).toBe("5m");
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
});
