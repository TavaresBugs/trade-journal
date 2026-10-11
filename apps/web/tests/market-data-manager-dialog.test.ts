import { describe, expect, it } from "vitest";
import {
  formatDateHuman,
  formatSeriesRange,
  formatChunkCanonical,
  formatBatchTitle,
  formatBatchMetrics,
  formatBatchImportDate,
  groupAssetSeries,
  RESOLUTION_ORDER,
} from "../src/components/settings/market-data-manager-dialog";
import type { MarketSeriesSummary } from "../src/lib/market-csv";
import type { Resolution } from "../src/lib/market-data";

describe("MarketDataManagerDialog helpers", () => {
  describe("Date formatting helpers", () => {
    it("formatDateHuman formats UTC timestamps to institutional UK format (DD MMM YYYY)", () => {
      const t1 = Date.UTC(2026, 9, 5); // 05 Oct 2026
      expect(formatDateHuman(t1)).toBe("05 Oct 2026");

      const t2 = Date.UTC(2026, 9, 8); // 08 Oct 2026
      expect(formatDateHuman(t2)).toBe("08 Oct 2026");

      const t3 = Date.UTC(2026, 0, 1); // 01 Jan 2026
      expect(formatDateHuman(t3)).toBe("01 Jan 2026");
    });

    it("formatDateHuman returns fallback dash for missing, zero, or invalid timestamps", () => {
      expect(formatDateHuman(0)).toBe("—");
      expect(formatDateHuman(NaN)).toBe("—");
      expect(formatDateHuman(null)).toBe("—");
      expect(formatDateHuman(undefined)).toBe("—");
      expect(formatDateHuman(-1)).toBe("—");
    });

    it("formatSeriesRange correctly combines firstTime and lastTime into canonical arrow format", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(formatSeriesRange(first, last)).toBe("05 Oct 2026 → 08 Oct 2026");
    });

    it("formatSeriesRange returns fallback dash if either timestamp is missing or invalid", () => {
      const valid = Date.UTC(2026, 9, 5);
      expect(formatSeriesRange(valid, undefined)).toBe("—");
      expect(formatSeriesRange(undefined, valid)).toBe("—");
      expect(formatSeriesRange(0, valid)).toBe("—");
      expect(formatSeriesRange(valid, NaN)).toBe("—");
      expect(formatSeriesRange(undefined, undefined)).toBe("—");
    });

    it("formatBatchImportDate formats UTC import timestamps into readable English format", () => {
      expect(formatBatchImportDate("2026-10-10T17:35:00Z")).toBe("10 Oct 2026, 17:35");
      expect(formatBatchImportDate(Date.UTC(2026, 9, 10, 17, 35))).toBe("10 Oct 2026, 17:35");
      expect(formatBatchImportDate("invalid-date")).toBe("—");
      expect(formatBatchImportDate(null)).toBe("—");
      expect(formatBatchImportDate(undefined)).toBe("—");
    });
  });

  describe("Chunk display name & metrics formatting", () => {
    it("formatChunkCanonical formats canonical chunk string with date range and bar count", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
          barCount: 5000,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026 (5,000 bars)");
    });

    it("formatChunkCanonical handles missing or zero bar counts gracefully", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
          barCount: 0,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026 (0 bars)");

      expect(
        formatChunkCanonical({
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("Chunk · 05 Oct 2026 → 08 Oct 2026");
    });

    it("formatBatchTitle creates standardized title with TradingView aesthetic resolution notation", () => {
      const first = Date.UTC(2026, 9, 5);
      const last = Date.UTC(2026, 9, 8);
      expect(
        formatBatchTitle({
          symbol: "MES",
          resolution: "1m",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("MES · 1m │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "NQ",
          resolution: "1h",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("NQ · 1H │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "ES",
          resolution: "1d",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("ES · D │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "BTC",
          resolution: "1w",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("BTC · W │ 05 Oct 2026 → 08 Oct 2026");

      expect(
        formatBatchTitle({
          symbol: "ETH",
          resolution: "1mo",
          firstTime: first,
          lastTime: last,
        }),
      ).toBe("ETH · M │ 05 Oct 2026 → 08 Oct 2026");
    });

    it("formatBatchMetrics formats new, duplicate, and total counts with thousands separator", () => {
      expect(
        formatBatchMetrics({
          newBarCount: 5000,
          duplicateBarCount: 120,
          barCount: 5120,
        }),
      ).toBe("+5,000 new · 120 duplicates · 5,120 total");

      expect(formatBatchMetrics({})).toBe("+0 new · 0 duplicates · 0 total");
    });
  });

  describe("Asset grouping and sorting", () => {
    const mockSeries: MarketSeriesSummary[] = [
      {
        symbol: "MES",
        resolution: "5m",
        barCount: 10000,
        firstTime: Date.UTC(2026, 9, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "mes",
        resolution: "1m",
        barCount: 5000,
        firstTime: Date.UTC(2026, 9, 5),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "MES",
        resolution: "1h",
        barCount: 800,
        firstTime: Date.UTC(2026, 8, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "NQ",
        resolution: "15m",
        barCount: 3000,
        firstTime: Date.UTC(2026, 9, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
      {
        symbol: "ES",
        resolution: "1d",
        barCount: 250,
        firstTime: Date.UTC(2025, 0, 1),
        lastTime: Date.UTC(2026, 9, 8),
        currency: "USD",
        priceBasis: "raw",
      },
    ];

    it("groups timeframes under the correct symbol and aggregates total bars", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES");

      expect(mesAsset).toBeDefined();
      expect(mesAsset!.totalBars).toBe(15800); // 10000 + 5000 + 800
      expect(mesAsset!.timeframes.length).toBe(3);
    });

    it("sorts grouped assets alphabetically by symbol", () => {
      const grouped = groupAssetSeries(mockSeries);
      const symbols = grouped.map((a) => a.symbol);
      expect(symbols).toEqual(["ES", "MES", "NQ"]);
    });

    it("sorts timeframes within each asset according to canonical resolution hierarchy", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES")!;

      const resolutions = mesAsset.timeframes.map((tf) => tf.resolution);
      expect(resolutions).toEqual(["1m", "5m", "1h"]);
    });

    it("populates display names and class-isolated compatible symbols from symbol specs and family", () => {
      const grouped = groupAssetSeries(mockSeries);
      const mesAsset = grouped.find((a) => a.symbol === "MES")!;

      // MES has spec name or family name
      expect(mesAsset.displayName).toContain("Micro E-mini");
      // Compatible symbols exclude the asset itself and isolate Futures (MES/ES) from CFDs (US500/SPX500)
      expect(mesAsset.compatibleSymbols).not.toContain("MES");
      expect(mesAsset.compatibleSymbols).toEqual(["ES"]);
      expect(mesAsset.compatibleSymbols).not.toContain("US500");

      // CFD series isolates CFD family members from Futures
      const cfdGrouped = groupAssetSeries([
        {
          symbol: "US100",
          resolution: "5m",
          barCount: 1000,
          firstTime: Date.UTC(2026, 9, 1),
          lastTime: Date.UTC(2026, 9, 2),
          currency: "USD",
          priceBasis: "raw",
        },
      ]);
      expect(cfdGrouped[0]!.compatibleSymbols).toEqual(
        expect.arrayContaining(["US100.CASH", "NAS100", "USTEC", "NDX"]),
      );
      expect(cfdGrouped[0]!.compatibleSymbols).not.toContain("MNQ");
      expect(cfdGrouped[0]!.compatibleSymbols).not.toContain("NQ");
    });

    it("handles assets with no specs gracefully", () => {
      const customSeries: MarketSeriesSummary[] = [
        {
          symbol: "CUSTOM_COIN",
          resolution: "1m",
          barCount: 100,
          firstTime: Date.UTC(2026, 9, 1),
          lastTime: Date.UTC(2026, 9, 2),
          currency: "USD",
          priceBasis: "raw",
        },
      ];

      const grouped = groupAssetSeries(customSeries);
      expect(grouped.length).toBe(1);
      expect(grouped[0]!.symbol).toBe("CUSTOM_COIN");
      expect(grouped[0]!.displayName).toBe("CUSTOM_COIN");
      expect(grouped[0]!.compatibleSymbols).toEqual([]);
    });

    it("sorts arbitrary custom and community resolutions chronologically via parseResolutionMs", () => {
      const customCommunitySeries: MarketSeriesSummary[] = [
        {
          symbol: "XYZ",
          resolution: "4h",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "7m" as Resolution,
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "1m",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "1d",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "20m" as Resolution,
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
        {
          symbol: "XYZ",
          resolution: "8h",
          barCount: 10,
          firstTime: 1000,
          lastTime: 2000,
          currency: "USD",
          priceBasis: "raw",
        },
      ];
      const grouped = groupAssetSeries(customCommunitySeries);
      expect(grouped[0]!.timeframes.map((tf) => tf.resolution)).toEqual([
        "1m",
        "7m",
        "20m",
        "4h",
        "8h",
        "1d",
      ]);
    });

    it("respects RESOLUTION_ORDER ranking", () => {
      expect(RESOLUTION_ORDER["1m"]).toBeLessThan(RESOLUTION_ORDER["3m"]!);
      expect(RESOLUTION_ORDER["3m"]).toBeLessThan(RESOLUTION_ORDER["5m"]!);
      expect(RESOLUTION_ORDER["5m"]).toBeLessThan(RESOLUTION_ORDER["15m"]!);
      expect(RESOLUTION_ORDER["15m"]).toBeLessThan(RESOLUTION_ORDER["30m"]!);
      expect(RESOLUTION_ORDER["30m"]).toBeLessThan(RESOLUTION_ORDER["1h"]!);
      expect(RESOLUTION_ORDER["1h"]).toBeLessThan(RESOLUTION_ORDER["4h"]!);
      expect(RESOLUTION_ORDER["4h"]).toBeLessThan(RESOLUTION_ORDER["1d"]!);
      expect(RESOLUTION_ORDER["1d"]).toBeLessThan(RESOLUTION_ORDER["1w"]!);
      expect(RESOLUTION_ORDER["1w"]).toBeLessThan(RESOLUTION_ORDER["1mo"]!);
    });
  });
});
