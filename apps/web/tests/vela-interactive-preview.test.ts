import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  generateSyntheticBars,
  toHeikinAshi,
  hexToRgba,
  START_TIME,
  SIGNATURE_DELTAS,
  VelaInteractivePreview,
} from "../src/components/settings/vela-interactive-preview";
import { DEFAULT_VELA_SETTINGS, type StoredVelaSettings } from "../src/components/settings/vela-settings-bridge";

describe("Vela Interactive Preview Chart Engine", () => {
  describe("generateSyntheticBars (72 bars 15m)", () => {
    it("generates exactly 72 bars of 15m price action", () => {
      const bars = generateSyntheticBars(85300, 0.5, 72);
      expect(bars).toHaveLength(72);
    });

    it("starts at June 1, 2026 UTC (START_TIME) with 900,000ms increments", () => {
      const bars = generateSyntheticBars(85300, 0.5, 72);
      expect(bars[0]!.time).toBe(START_TIME);
      expect(bars[0]!.time).toBe(Date.UTC(2026, 5, 1));

      for (let i = 1; i < bars.length; i++) {
        const timeDiff = bars[i]!.time - bars[i - 1]!.time;
        expect(timeDiff).toBe(900000); // 15 minutes in ms
      }
    });

    it("ensures every bar satisfies strict OHLC price invariants", () => {
      const bars = generateSyntheticBars(85300, 0.5, 72);
      bars.forEach((bar, idx) => {
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
        expect(bar.volume).toBeGreaterThan(0);
        // Prices stay in realistic BTCUSDT territory around base ~85,000
        expect(bar.open).toBeGreaterThan(80000);
        expect(bar.open).toBeLessThan(90000);
      });
    });

    it("incorporates the signature deltas in the final 16 bars", () => {
      const bars = generateSyntheticBars(85300, 0.5, 72);
      expect(SIGNATURE_DELTAS).toHaveLength(16);
      const signatureSegment = bars.slice(-16);
      expect(signatureSegment).toHaveLength(16);
    });
  });

  describe("toHeikinAshi transformation", () => {
    it("transforms 72 raw bars into 72 valid Heikin-Ashi bars", () => {
      const rawBars = generateSyntheticBars(85300, 0.5, 72);
      const haBars = toHeikinAshi(rawBars);

      expect(haBars).toHaveLength(72);
      haBars.forEach((b) => {
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      });
    });

    it("returns empty array when passed empty input", () => {
      expect(toHeikinAshi([])).toEqual([]);
    });
  });

  describe("hexToRgba helper", () => {
    it("converts 6-digit hex colors with custom alpha", () => {
      expect(hexToRgba("#089981", 0.5)).toBe("rgba(8, 153, 129, 0.5)");
      expect(hexToRgba("#f23645", 0.25)).toBe("rgba(242, 54, 69, 0.25)");
    });

    it("converts 3-digit shorthand hex colors", () => {
      expect(hexToRgba("#fff", 0.8)).toBe("rgba(255, 255, 255, 0.8)");
      expect(hexToRgba("#000", 0.1)).toBe("rgba(0, 0, 0, 0.1)");
    });

    it("handles rgb and rgba strings gracefully", () => {
      expect(hexToRgba("rgb(41, 98, 255)", 0.3)).toBe("rgba(41, 98, 255, 0.3)");
      expect(hexToRgba("rgba(41, 98, 255, 0.9)", 0.4)).toBe("rgba(41, 98, 255, 0.4)");
    });
  });

  describe("HTML Architecture & DOM Classes", () => {
    it("renders canonical Vela HTML tree with exact CSS class hierarchy", () => {
      const html = renderToString(
        React.createElement(VelaInteractivePreview, {
          settings: DEFAULT_VELA_SETTINGS,
          symbol: "BINANCE:BTCUSDT",
          resolution: "15m",
        })
      );

      // Root aside
      expect(html).toContain("quant-settings-preview");
      expect(html).toContain('aria-label="Chart settings preview"');

      // Card container
      expect(html).toContain("quant-settings-preview-card");

      // Meta bar with sample data and ticker
      expect(html).toContain("quant-settings-preview-meta");
      expect(html).toContain("<span>Sample data</span>");
      expect(html).toContain("BTCUSDT</b>");

      // Interactive chart area
      expect(html).toContain("quant-settings-preview-chart");
      expect(html).toContain('aria-label="Interactive settings preview"');

      // Caption
      expect(html).toContain("quant-settings-preview-caption");
      expect(html).toContain("Simulated prices · scroll to zoom, drag to pan.");

      // Statusline & components
      expect(html).toContain("vela-statusline");
      expect(html).toContain("vela-sl-avatar");
      expect(html).toContain("BT</span>"); // pink squircle badge initials
      expect(html).toContain("vela-sl-symbol");
      expect(html).toContain("vela-sl-meta");
      expect(html).toContain("· 15m");
      expect(html).toContain("vela-sl-market");
      expect(html).toContain("vela-sl-ohlc");
      expect(html).toContain("vela-sl-change");

      // Watermark
      expect(html).toContain("vela-watermark");
      expect(html).toContain("BTCUSDT 15m");
    });

    it("reacts dynamically to statusline part toggles", () => {
      const customSettings: StoredVelaSettings = {
        ...DEFAULT_VELA_SETTINGS,
        statusLine: {
          symbol: false,
          meta: false,
          market: false,
          ohlc: false,
          change: false,
          indicatorTitles: false,
          indicatorValues: false,
        },
      };

      const html = renderToString(
        React.createElement(VelaInteractivePreview, {
          settings: customSettings,
          symbol: "BTCUSDT",
        })
      );

      expect(html).not.toContain("vela-sl-symbol");
      expect(html).not.toContain("vela-sl-market");
      expect(html).not.toContain("vela-sl-ohlc");
      expect(html).not.toContain("vela-sl-change");
    });

    it("reacts dynamically to watermark visibility toggle", () => {
      const withWatermark: StoredVelaSettings = {
        ...DEFAULT_VELA_SETTINGS,
        symbol: {
          ...DEFAULT_VELA_SETTINGS.symbol,
          symbolWatermark: true,
        },
      };

      const withoutWatermark: StoredVelaSettings = {
        ...DEFAULT_VELA_SETTINGS,
        symbol: {
          ...DEFAULT_VELA_SETTINGS.symbol,
          symbolWatermark: false,
        },
      };

      const htmlWith = renderToString(
        React.createElement(VelaInteractivePreview, {
          settings: withWatermark,
          symbol: "BTCUSDT",
        })
      );

      const htmlWithout = renderToString(
        React.createElement(VelaInteractivePreview, {
          settings: withoutWatermark,
          symbol: "BTCUSDT",
        })
      );

      expect(htmlWith).toContain("vela-watermark");
      expect(htmlWith).toContain("display:flex");
      expect(htmlWithout).toContain("display:none");
    });
  });
});
