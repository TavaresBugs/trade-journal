import { describe, it, expect, vi } from "vitest";
import {
  mapSettingsSectionToTab,
  toHexColor,
  applyStoredSettingsToChart,
  DEFAULT_VELA_SETTINGS,
} from "../src/components/settings/vela-settings-bridge";

describe("Vela Settings Bridge (ADR-001)", () => {
  describe("mapSettingsSectionToTab", () => {
    it("maps Canvas correctly", () => {
      expect(mapSettingsSectionToTab("Canvas")).toBe("canvas");
      expect(mapSettingsSectionToTab("canvas")).toBe("canvas");
    });

    it("maps Scales and lines correctly", () => {
      expect(mapSettingsSectionToTab("Scales and lines")).toBe("scales-and-lines");
      expect(mapSettingsSectionToTab("scales")).toBe("scales-and-lines");
    });

    it("maps Status line correctly", () => {
      expect(mapSettingsSectionToTab("Status line")).toBe("status-line");
      expect(mapSettingsSectionToTab("status")).toBe("status-line");
    });

    it("maps Symbol correctly", () => {
      expect(mapSettingsSectionToTab("Symbol")).toBe("symbol");
      expect(mapSettingsSectionToTab("symbol")).toBe("symbol");
    });

    it("maps Fonte de Dados and data correctly", () => {
      expect(mapSettingsSectionToTab("Fonte de Dados")).toBe("data");
      expect(mapSettingsSectionToTab("data")).toBe("data");
      expect(mapSettingsSectionToTab("data-source")).toBe("data");
      expect(mapSettingsSectionToTab("advanced")).toBe("data");
    });

    it("falls back to symbol for empty or unknown section", () => {
      expect(mapSettingsSectionToTab(undefined)).toBe("symbol");
      expect(mapSettingsSectionToTab("")).toBe("symbol");
      expect(mapSettingsSectionToTab("unknown_section")).toBe("symbol");
    });
  });

  describe("toHexColor", () => {
    it("converts rgb() to hex correctly", () => {
      expect(toHexColor("rgb(8, 153, 129)")).toBe("#089981");
      expect(toHexColor("rgb(242, 54, 69)")).toBe("#f23645");
      expect(toHexColor("rgb(0, 0, 0)")).toBe("#000000");
      expect(toHexColor("rgb(255, 255, 255)")).toBe("#ffffff");
    });

    it("converts 3-digit shorthand hex to 6-digit hex", () => {
      expect(toHexColor("#fff")).toBe("#ffffff");
      expect(toHexColor("#000")).toBe("#000000");
    });

    it("preserves standard 6-digit hex", () => {
      expect(toHexColor("#151619")).toBe("#151619");
      expect(toHexColor("#2962ff")).toBe("#2962ff");
    });

    it("falls back to default for null/empty", () => {
      expect(toHexColor(null)).toBe("#089981");
      expect(toHexColor(undefined)).toBe("#089981");
      expect(toHexColor("", "#123456")).toBe("#123456");
    });
  });

  describe("applyStoredSettingsToChart", () => {
    it("calls applyConfig, set, statusline and watermark with active settings", () => {
      const applyConfigMock = vi.fn();
      const setMock = vi.fn();
      const chartMock = {
        renderer: {
          applyConfig: applyConfigMock,
          set: setMock,
        },
      };

      const setPartVisibleMock = vi.fn();
      const statuslineMock = {
        setPartVisible: setPartVisibleMock,
        metaEl: { style: { display: "" } },
      };

      const setVisibleMock = vi.fn();
      const setReplayVisibleMock = vi.fn();
      const watermarkMock = {
        setVisible: setVisibleMock,
        setReplayVisible: setReplayVisibleMock,
      };

      const customSettings = {
        ...DEFAULT_VELA_SETTINGS,
        symbol: {
          ...DEFAULT_VELA_SETTINGS.symbol,
          priceStyle: "bars",
          symbolWatermark: true,
          candles: {
            ...DEFAULT_VELA_SETTINGS.symbol.candles,
            upColor: "#00ff00",
            downColor: "#ff0000",
          },
        },
        scalesAndLines: {
          ...DEFAULT_VELA_SETTINGS.scalesAndLines,
          autoScale: false,
          invertScale: true,
        },
      };

      applyStoredSettingsToChart(chartMock, statuslineMock, watermarkMock, customSettings);

      expect(applyConfigMock).toHaveBeenCalled();
      const passedConfig = applyConfigMock.mock.calls[0]?.[0];
      expect(passedConfig?.candles?.upColor).toBe("#00ff00");
      expect(passedConfig?.candles?.downColor).toBe("#ff0000");
      expect(passedConfig?.series?.style).toBe("bars");

      expect(setMock).toHaveBeenCalledWith("priceStyle", "bars");
      expect(setMock).toHaveBeenCalledWith("autoScale", false);
      expect(setMock).toHaveBeenCalledWith("invertScale", true);

      expect(setPartVisibleMock).toHaveBeenCalledWith("name", true);
      expect(setPartVisibleMock).toHaveBeenCalledWith("symbol", true);
      expect(setPartVisibleMock).toHaveBeenCalledWith("market", true);

      expect(setVisibleMock).toHaveBeenCalledWith(true);
      expect(setReplayVisibleMock).toHaveBeenCalledWith(false);
    });
  });
});
