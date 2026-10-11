import { describe, it, expect, vi } from "vitest";
import {
  mapSettingsSectionToTab,
  toHexColor,
  applyStoredSettingsToChart,
  DEFAULT_VELA_SETTINGS,
  type StoredVelaSettings,
} from "../src/components/settings/vela-settings-bridge";
import {
  buildPalette,
  splitColor,
  combineColor,
  hslHex,
  transparencyChecker,
} from "../src/components/settings/vela-color-picker";
import { VELA_TOOLTIPS_CATALOG } from "../src/components/settings/vela-info-tooltip";
import { VELA_CHART_STYLE_OPTIONS, STYLES } from "../src/components/vela-style-picker";
import { VELA_TIMEZONE_CATALOG } from "../src/lib/vela-timezones";
import {
  generateSyntheticBars,
  toHeikinAshi,
  hexToRgba,
  START_TIME,
  SIGNATURE_DELTAS,
} from "../src/components/settings/vela-interactive-preview";
import { setupVelaSidePanels } from "../src/components/trade-market-data";

describe("Vela Settings Suite (Bridge, Palettes, Catalogs & Panels)", () => {
  describe("1. Settings Bridge & Schema Synchronization", () => {
    it("provides complete and valid DEFAULT_VELA_SETTINGS schema structure", () => {
      expect(DEFAULT_VELA_SETTINGS.symbol).toBeDefined();
      expect(DEFAULT_VELA_SETTINGS.symbol.candles).toBeDefined();
      expect(DEFAULT_VELA_SETTINGS.symbol.candles.upColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DEFAULT_VELA_SETTINGS.symbol.candles.downColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DEFAULT_VELA_SETTINGS.statusLine).toBeDefined();
      expect(DEFAULT_VELA_SETTINGS.scalesAndLines).toBeDefined();
      expect(DEFAULT_VELA_SETTINGS.canvas).toBeDefined();
    });

    it("maps section titles to canonical tab identifiers with safe fallback", () => {
      expect(mapSettingsSectionToTab("Canvas")).toBe("canvas");
      expect(mapSettingsSectionToTab("canvas")).toBe("canvas");
      expect(mapSettingsSectionToTab("Scales and lines")).toBe("scales-and-lines");
      expect(mapSettingsSectionToTab("scales")).toBe("scales-and-lines");
      expect(mapSettingsSectionToTab("Status line")).toBe("status-line");
      expect(mapSettingsSectionToTab("status")).toBe("status-line");
      expect(mapSettingsSectionToTab("Symbol")).toBe("symbol");
      expect(mapSettingsSectionToTab("symbol")).toBe("symbol");
      expect(mapSettingsSectionToTab("Fonte de Dados")).toBe("data");
      expect(mapSettingsSectionToTab("data")).toBe("data");
      expect(mapSettingsSectionToTab("data-source")).toBe("data");
      expect(mapSettingsSectionToTab("advanced")).toBe("data");

      // Fallback for nullish or unknown
      expect(mapSettingsSectionToTab(undefined)).toBe("symbol");
      expect(mapSettingsSectionToTab("")).toBe("symbol");
      expect(mapSettingsSectionToTab("unknown_section")).toBe("symbol");
    });

    it("converts diverse color representations to normalized hex", () => {
      expect(toHexColor("rgb(8, 153, 129)")).toBe("#089981");
      expect(toHexColor("rgb(242, 54, 69)")).toBe("#f23645");
      expect(toHexColor("rgb(0, 0, 0)")).toBe("#000000");
      expect(toHexColor("rgb(255, 255, 255)")).toBe("#ffffff");

      expect(toHexColor("#fff")).toBe("#ffffff");
      expect(toHexColor("#000")).toBe("#000000");

      expect(toHexColor("#151619")).toBe("#151619");
      expect(toHexColor("#2962ff")).toBe("#2962ff");

      expect(toHexColor(null)).toBe("#089981");
      expect(toHexColor(undefined)).toBe("#089981");
      expect(toHexColor("", "#123456")).toBe("#123456");
    });

    it("applies stored settings to Vela chart renderer and UI components", () => {
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

      const customSettings: StoredVelaSettings = {
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

  describe("2. Color Picker Calculations & Palette Engine", () => {
    it("generates 8 rows of 10 swatches totaling 80 unique hex colors with grayscale first row", () => {
      const palette = buildPalette();
      expect(palette).toHaveLength(8);

      palette.forEach((row) => {
        expect(row).toHaveLength(10);
        row.forEach((color) => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      const allSwatches = palette.flat();
      expect(allSwatches).toHaveLength(80);

      // Verify grayscale top row
      const grays = palette[0]!;
      expect(grays[0]).toBe("#ffffff");
      expect(grays[9]).toBe("#000000");
    });

    it("converts HSL tuples to hex correctly with hslHex", () => {
      expect(hslHex(0, 0, 100)).toBe("#ffffff");
      expect(hslHex(0, 0, 0)).toBe("#000000");
      expect(hslHex(0, 100, 50)).toBe("#ff0000");
      expect(hslHex(120, 100, 50)).toBe("#00ff00");
      expect(hslHex(240, 100, 50)).toBe("#0000ff");
    });

    it("splits color strings into hex6 and alpha channel", () => {
      expect(splitColor("#089981")).toEqual({ hex6: "#089981", alpha: 1 });
      expect(splitColor("#fff")).toEqual({ hex6: "#ffffff", alpha: 1 });
      expect(splitColor("#123")).toEqual({ hex6: "#112233", alpha: 1 });
      expect(splitColor("")).toEqual({ hex6: "#089981", alpha: 1 });

      const res8 = splitColor("#08998180");
      expect(res8.hex6).toBe("#089981");
      expect(res8.alpha).toBeCloseTo(128 / 255, 3);

      expect(splitColor("rgba(41, 98, 255, 0.5)")).toEqual({ hex6: "#2962ff", alpha: 0.5 });
      expect(splitColor("rgb(8, 153, 129)")).toEqual({ hex6: "#089981", alpha: 1 });
    });

    it("combines hex6 and alpha back into formatted hex color, clamping alpha", () => {
      expect(combineColor("#2962ff", 1)).toBe("#2962ff");
      expect(combineColor("#2962ff", 0.9995)).toBe("#2962ff");
      expect(combineColor("#2962ff", 0.5)).toBe("#2962ff80");
      expect(combineColor("#2962ff", 0)).toBe("#2962ff00");
      expect(combineColor("#2962ff", -0.5)).toBe("#2962ff00");
      expect(combineColor("#2962ff", 1.5)).toBe("#2962ff");
      expect(combineColor("#AABBCC", 0.5)).toBe("#aabbcc80");
    });

    it("roundtrips between splitColor and combineColor with 100% fidelity", () => {
      const original = "#2962ff80";
      const { hex6, alpha } = splitColor(original);
      const combined = combineColor(hex6, alpha);
      expect(combined).toBe(original);
    });

    it("generates repeating-conic-gradient pattern with transparencyChecker", () => {
      expect(transparencyChecker()).toContain("repeating-conic-gradient");
      expect(transparencyChecker()).toContain("8px");
      expect(transparencyChecker(12)).toContain("12px");
    });
  });

  describe("3. Catalogs & Chart Styles", () => {
    it("contains exactly 53 canonical financial timezones without duplicate values", () => {
      expect(VELA_TIMEZONE_CATALOG).toHaveLength(53);

      const seen = new Set<string>();
      for (const entry of VELA_TIMEZONE_CATALOG) {
        expect(entry.value).toBeTruthy();
        expect(entry.label).toBeTruthy();
        expect(seen.has(entry.value)).toBe(false);
        seen.add(entry.value);
      }
    });

    it("provides 6 canonical chart styles with valid icons in VELA_CHART_STYLE_OPTIONS", () => {
      expect(VELA_CHART_STYLE_OPTIONS).toHaveLength(6);
      expect(STYLES).toHaveLength(6);

      const expectedIds = ["candles", "bars", "line", "area", "baseline", "heikinashi"];
      expect(STYLES.map((s) => s.id)).toEqual(expectedIds);
      expect(VELA_CHART_STYLE_OPTIONS.map((o) => o.value)).toEqual(expectedIds);

      const candleOption = VELA_CHART_STYLE_OPTIONS.find((o) => o.value === "candles");
      expect(candleOption?.label).toBe("Candles");
      expect(candleOption?.iconSvg).toContain("<svg");
    });

    it("contains complete tooltips catalog with titles and descriptions", () => {
      expect(Object.keys(VELA_TOOLTIPS_CATALOG).length).toBeGreaterThan(0);
      for (const [key, meta] of Object.entries(VELA_TOOLTIPS_CATALOG)) {
        expect(key).toBeTruthy();
        expect(meta.title).toBeTruthy();
        expect(meta.description).toBeTruthy();
      }
    });
  });

  describe("4. Synthetic Price Generation & Transformations", () => {
    it("generates exactly 72 bars of 15m price action with strict OHLC invariants", () => {
      const bars = generateSyntheticBars(85300, 0.5, 72);
      expect(bars).toHaveLength(72);
      expect(bars[0]!.time).toBe(START_TIME);
      expect(bars[0]!.time).toBe(Date.UTC(2026, 5, 1));

      for (let i = 1; i < bars.length; i++) {
        expect(bars[i]!.time - bars[i - 1]!.time).toBe(900000); // 15m in ms
      }

      bars.forEach((bar) => {
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
        expect(bar.volume).toBeGreaterThan(0);
        expect(bar.open).toBeGreaterThan(80000);
        expect(bar.open).toBeLessThan(90000);
      });

      expect(SIGNATURE_DELTAS).toHaveLength(16);
    });

    it("transforms raw bars into valid Heikin-Ashi bars preserving OHLC invariants", () => {
      const rawBars = generateSyntheticBars(85300, 0.5, 72);
      const haBars = toHeikinAshi(rawBars);

      expect(haBars).toHaveLength(72);
      haBars.forEach((b) => {
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      });

      expect(toHeikinAshi([])).toEqual([]);
    });

    it("converts hex colors to rgba with custom alpha using hexToRgba", () => {
      expect(hexToRgba("#089981", 0.5)).toBe("rgba(8, 153, 129, 0.5)");
      expect(hexToRgba("#f23645", 0.25)).toBe("rgba(242, 54, 69, 0.25)");
      expect(hexToRgba("#fff", 0.8)).toBe("rgba(255, 255, 255, 0.8)");
      expect(hexToRgba("#000", 0.1)).toBe("rgba(0, 0, 0, 0.1)");
      expect(hexToRgba("rgb(41, 98, 255)", 0.3)).toBe("rgba(41, 98, 255, 0.3)");
    });
  });

  describe("5. Side Panels Controller (ObjectTree & DataWindow)", () => {
    function createMockPanel(title: string) {
      let isOpen = false;
      return {
        title,
        isOpen,
        open: isOpen,
        el: { hidden: true, remove: vi.fn() },
        setSymbol: vi.fn(),
        refresh: vi.fn(),
        onChart: vi.fn(),
        toggle: vi.fn(function (this: any, nextOpen?: boolean, _instant?: boolean) {
          this.isOpen = nextOpen !== undefined ? nextOpen : !this.isOpen;
          this.open = this.isOpen;
          this.el.hidden = !this.isOpen;
          this.onOpenChange?.(this.isOpen);
        }),
        destroy: vi.fn(function (this: any) {
          this.el.remove();
        }),
        onOpenChange: null as ((open: boolean) => void) | null,
      };
    }

    function createMockChart() {
      return {
        renderer: {
          syncSize: vi.fn(),
          dataWindowReadout: vi.fn(() => ({
            time: 1728554400000,
            open: 82896.03,
            high: 82896.03,
            low: 82876.0,
            close: 82878.02,
            volume: 1420.5,
          })),
          onCrosshairMove: vi.fn(() => () => {}),
        },
        on: vi.fn(() => () => {}),
      };
    }

    it("instantiates ObjectTree and DataWindow, sets symbol and binds onChart", () => {
      const mockContainer = {} as HTMLElement;
      const mockChart = createMockChart();

      let createdOT: any = null;
      let createdDW: any = null;

      class MockOT {
        constructor() {
          createdOT = createMockPanel("Object tree");
          return createdOT;
        }
      }

      class MockDW {
        constructor() {
          createdDW = createMockPanel("Data window");
          return createdDW;
        }
      }

      const controller = setupVelaSidePanels({
        panelContainer: mockContainer,
        chartInstance: mockChart,
        symbol: "BTCUSDT",
        ObjectTreeClass: MockOT as any,
        DataWindowClass: MockDW as any,
      });

      expect(createdOT).not.toBeNull();
      expect(createdDW).not.toBeNull();
      expect(createdOT.setSymbol).toHaveBeenCalledWith("BTCUSDT");
      expect(createdOT.onChart).toHaveBeenCalledWith(mockChart);
      expect(createdDW.onChart).toHaveBeenCalledWith(mockChart);
      expect(controller.openId()).toBeNull();
    });

    it("toggles ObjectTree open and closes DataWindow mutually", () => {
      const mockContainer = {} as HTMLElement;
      const mockChart = createMockChart();
      const onOpenChange = vi.fn();

      let createdOT: any = null;
      let createdDW: any = null;

      class MockOT {
        constructor() {
          createdOT = createMockPanel("Object tree");
          return createdOT;
        }
      }
      class MockDW {
        constructor() {
          createdDW = createMockPanel("Data window");
          return createdDW;
        }
      }

      const controller = setupVelaSidePanels({
        panelContainer: mockContainer,
        chartInstance: mockChart,
        symbol: "BTCUSDT",
        onOpenChange,
        ObjectTreeClass: MockOT as any,
        DataWindowClass: MockDW as any,
      });

      // 1. Open ObjectTree
      controller.toggle("objects", true);
      expect(createdOT.toggle).toHaveBeenCalledWith(true);
      expect(controller.openId()).toBe("objects");
      expect(onOpenChange).toHaveBeenCalledWith("objects");
      expect(mockChart.renderer.syncSize).toHaveBeenCalled();

      // 2. Open DataWindow -> ObjectTree must close
      controller.toggle("dataWindow", true);
      expect(createdOT.toggle).toHaveBeenCalledWith(false, true);
      expect(createdDW.toggle).toHaveBeenCalledWith(true);
      expect(controller.openId()).toBe("dataWindow");
      expect(onOpenChange).toHaveBeenCalledWith("dataWindow");

      // 3. Toggle DataWindow off
      controller.toggle("dataWindow");
      expect(createdDW.toggle).toHaveBeenCalledWith(false);
      expect(controller.openId()).toBeNull();
      expect(onOpenChange).toHaveBeenCalledWith(null);
    });

    it("cleans up resources and removes panels on destroy", () => {
      const mockContainer = {} as HTMLElement;
      const mockChart = createMockChart();

      let createdOT: any = null;
      let createdDW: any = null;

      class MockOT {
        constructor() {
          createdOT = createMockPanel("Object tree");
          return createdOT;
        }
      }
      class MockDW {
        constructor() {
          createdDW = createMockPanel("Data window");
          return createdDW;
        }
      }

      const controller = setupVelaSidePanels({
        panelContainer: mockContainer,
        chartInstance: mockChart,
        symbol: "BTCUSDT",
        ObjectTreeClass: MockOT as any,
        DataWindowClass: MockDW as any,
      });

      controller.destroy();

      expect(createdOT.destroy).toHaveBeenCalled();
      expect(createdDW.destroy).toHaveBeenCalled();
      expect(controller.openId()).toBeNull();
    });
  });
});
