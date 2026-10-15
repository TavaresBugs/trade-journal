import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeChromeJoinGeometry,
  createChromeJoinOutline,
} from "../../src/components/vela-chrome-join";
import {
  computeBottombarJoinGeometry,
  CHART_BUTTON_DESCRIPTIONS,
  resolveButtonCardMeta,
} from "../../src/components/vela-chrome-enhancer";
import {
  SLIDERS_ICON_SVG,
  COPY_PRICE_ICON_SVG,
  formatCopyPrice,
  showVelaToast as showContextToast,
  registerCopyPriceAction,
  enhanceVelaContextMenu,
  _resetCopyPriceActionForTesting,
} from "../../src/components/vela-context-menu";
import {
  computeScreenshotJoinGeometry,
  getChartScreenshotCanvas,
  downloadChartScreenshot,
  copyChartScreenshotToClipboard,
  armVelaPortionSelection,
  CAMERA_ICON_SVG,
  DOWNLOAD_ICON_SVG,
  CLIPBOARD_ICON_SVG,
  CROP_ICON_SVG,
} from "../../src/components/vela-screenshot-menu";
import {
  VELA_DRAWING_FAVORITES_KEY,
  VELA_DRAWING_PREFS_KEY,
  VELA_TRADE_DRAWINGS_PREFIX,
  loadDrawingFavorites,
  saveDrawingFavorites,
  loadDrawingToolPrefs,
  saveDrawingToolPrefs,
  loadTradeDrawings,
  saveTradeDrawings,
  flushPendingTradeDrawingsSave,
  attachVelaDrawingsPersistence,
  extractControllerToolStyles,
  applyControllerToolStyles,
} from "../../src/components/vela-drawings-bridge";
import {
  attachVelaFavoriteToolbar,
  enhanceVelaFloatingToolbarGrip,
  FAV_TOOLBAR_POS_STORAGE_KEY,
  GRIP_SIX_DOTS_SVG,
  DEFAULT_TOOL_META,
  resolveToolMeta,
} from "../../src/components/vela-drawing-enhancer";
import { syncVelaToolbarGutter, setupVelaSidePanels } from "../../src/components/trade-market-data";
import {
  mapSettingsSectionToTab,
  toHexColor,
  applyStoredSettingsToChart,
  DEFAULT_VELA_SETTINGS,
  type StoredVelaSettings,
} from "../../src/components/settings/vela-settings-bridge";
import {
  buildPalette,
  splitColor,
  combineColor,
  hslHex,
  transparencyChecker,
} from "../../src/components/settings/vela-color-picker";
import { VELA_TOOLTIPS_CATALOG } from "../../src/components/settings/vela-info-tooltip";
import { VELA_CHART_STYLE_OPTIONS, STYLES } from "../../src/components/vela-style-picker";
import { VELA_TIMEZONE_CATALOG } from "../../src/lib/vela-timezones";
import {
  generateSyntheticBars,
  toHeikinAshi,
  hexToRgba,
  START_TIME,
  SIGNATURE_DELTAS,
  resolveSampleAnchor,
  SAMPLE_BASE_PRICES,
} from "../../src/components/settings/vela-interactive-preview";
import { widgetActions } from "@luxalgo/vela/widget";
import { iconMarkup } from "@luxalgo/vela/ui";
import { MockElement, MockDocument, MockMutationObserver } from "../helpers/dom-mock";

// In-memory localStorage mock for node environment
class MockLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

class MockVelaChart {
  eventHandlers = new Map<string, Set<Function>>();
  storeListeners = new Set<() => void>();
  drawingsDoc = { version: 1, drawings: [] as any[] };
  favorites: string[] = [];
  activeTool: string | null = null;
  snapMode = "off";
  stayMode = false;

  drawings = {
    favorites: vi.fn(() => this.favorites),
    setFavorites: vi.fn((favs: string[]) => {
      this.favorites = [...favs];
      this.emit("drawing:favorites", { favorites: this.favorites });
    }),
    getFavorites: () => this.favorites,
    getTool: vi.fn(() => this.activeTool),
    setTool: vi.fn((tool: string | null) => {
      this.activeTool = tool;
      this.emit("drawing:tool", { type: this.activeTool });
    }),
    setSnapMode: vi.fn((mode: "off" | "weak" | "strong") => {
      this.snapMode = mode;
    }),
    getSnapMode: () => this.snapMode,
    setStayMode: vi.fn((mode: boolean) => {
      this.stayMode = mode;
    }),
    getStayMode: () => this.stayMode,
    fromJSON: vi.fn((doc: { version: 1; drawings: any[] }) => {
      this.drawingsDoc = JSON.parse(JSON.stringify(doc));
    }),
    toJSON: vi.fn(() => {
      return JSON.parse(JSON.stringify(this.drawingsDoc));
    }),
    ctrl: {
      store: {
        onChange: (cb: () => void) => {
          this.storeListeners.add(cb);
          return () => this.storeListeners.delete(cb);
        },
      },
    },
  };

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  off(event: string, handler: Function) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  emit(event: string, payload?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const h of Array.from(handlers)) {
        h(payload);
      }
    }
  }

  triggerStoreChange() {
    for (const l of Array.from(this.storeListeners)) {
      l();
    }
  }

  listenerCount(event: string) {
    return this.eventHandlers.get(event)?.size ?? 0;
  }
}

describe("Vela Chrome Suite (Geometry, Context Menu & Export)", () => {
  let mockDoc: MockDocument;
  const origDocument = (globalThis as any).document;
  const origWindow = (globalThis as any).window;
  const origElement = (globalThis as any).Element;
  const origHTMLElement = (globalThis as any).HTMLElement;
  const origHTMLCanvasElement = (globalThis as any).HTMLCanvasElement;
  const origMutationObserver = (globalThis as any).MutationObserver;

  beforeEach(() => {
    mockDoc = new MockDocument();
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: (e: string, fn: Function) => mockDoc.addEventListener(e, fn),
      removeEventListener: (e: string, fn: Function) => mockDoc.removeEventListener(e, fn),
      dispatchEvent: (e: any) => mockDoc.dispatchEvent(e),
    };
    (globalThis as any).Element = MockElement;
    (globalThis as any).HTMLElement = MockElement;
    (globalThis as any).HTMLCanvasElement = MockElement;
    (globalThis as any).HTMLAnchorElement = MockElement;
    (globalThis as any).MutationObserver = MockMutationObserver;
    (globalThis as any).PointerEvent = class {
      type: string;
      clientX: number;
      clientY: number;
      button: number;
      pointerId: number;
      constructor(type: string, init: any = {}) {
        this.type = type;
        this.clientX = init.clientX ?? 0;
        this.clientY = init.clientY ?? 0;
        this.button = init.button ?? 0;
        this.pointerId = init.pointerId ?? 1;
      }
      preventDefault() {}
      stopPropagation() {}
    };
    (globalThis as any).KeyboardEvent = class {
      type: string;
      key: string;
      altKey: boolean;
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      constructor(type: string, init: any = {}) {
        this.type = type;
        this.key = init.key ?? "";
        this.altKey = Boolean(init.altKey);
        this.shiftKey = Boolean(init.shiftKey);
        this.ctrlKey = Boolean(init.ctrlKey);
        this.metaKey = Boolean(init.metaKey);
      }
      preventDefault() {}
      stopPropagation() {}
    };
    (globalThis as any).Blob = class {
      parts: any[];
      options: any;
      constructor(parts: any[] = [], options: any = {}) {
        this.parts = parts;
        this.options = options;
      }
    };
    (globalThis as any).ClipboardItem = class {
      data: any;
      constructor(data: any) {
        this.data = data;
      }
    };

    _resetCopyPriceActionForTesting();
  });

  afterEach(() => {
    (globalThis as any).document = origDocument;
    (globalThis as any).window = origWindow;
    (globalThis as any).Element = origElement;
    (globalThis as any).HTMLElement = origHTMLElement;
    (globalThis as any).HTMLCanvasElement = origHTMLCanvasElement;
    (globalThis as any).MutationObserver = origMutationObserver;
    vi.restoreAllMocks();
  });

  describe("1. Bézier Geometric Curve Calculation Algorithms", () => {
    it("preserves unconstrained topbar join geometry (Formula 2.3) when clampToBounds is false", () => {
      const geo = computeChromeJoinGeometry(180, 220, {
        shoulder: 16,
        radius: 10,
        clampToBounds: false,
      });

      expect(geo.totalW).toBe(180 + 2 * 16);
      expect(geo.viewBox).toBe("0 -2 212 222");
      expect(geo.svgStyle.left).toBe("-16px");
      expect(geo.svgStyle.width).toBe("calc(100% + 32px)");
      expect(geo.dEdge).toContain("M 0 0.5");
      expect(geo.dEdge).toContain("Q 196 0.5 212 0.5");
      expect(geo.dFill).toContain("L 212 -2 L 0 -2 Z");
    });

    it("computes unified enclosing envelope (Formula 2.2 Symmetric) when triggerWidth === totalW", () => {
      const geo = computeChromeJoinGeometry(170, 240, {
        shoulder: 8,
        radius: 6,
        clampToBounds: true,
        triggerOffsetLeft: 0,
        triggerWidth: 170,
        triggerHeight: 29,
      });

      expect(geo.totalW).toBe(170);
      expect(geo.totalH).toBe(240);
      expect(geo.viewBox).toBe("0 0 170 240");
      expect(geo.svgStyle.left).toBe("0px");
      expect(geo.svgStyle.top).toBe("0px");
      expect(geo.svgStyle.width).toBe("100%");
      expect(geo.svgStyle.height).toBe("100%");
      expect(geo.dEdge).toBe(
        "M 0.5 0 V 233.5 Q 0.5 239.5 6.5 239.5 H 163.5 Q 169.5 239.5 169.5 233.5 V 0",
      );
      expect(geo.dFill).toBe(`${geo.dEdge} Z`);
    });

    it("computes unified enclosing envelope when trigger is narrower than popup", () => {
      const geo = computeChromeJoinGeometry(265, 240, {
        shoulder: 8,
        radius: 6,
        clampToBounds: true,
        triggerOffsetLeft: 0,
        triggerWidth: 90,
        triggerHeight: 29,
      });

      expect(geo.totalW).toBe(265);
      expect(geo.svgStyle.left).toBe("0px");
      expect(geo.svgStyle.width).toBe("100%");
      expect(geo.dEdge).toContain("M 0.5 0 V 233.5");
      expect(geo.dEdge).toContain("H 90");
      expect(geo.dFill).toBe(`${geo.dEdge} Z`);
    });

    it("never generates negative X coordinates or coordinates exceeding totalW when clamped", () => {
      const widths = [100, 140, 150, 170, 180, 240, 265];
      for (const w of widths) {
        const geo = computeChromeJoinGeometry(w, 200, {
          shoulder: 8,
          radius: 6,
          clampToBounds: true,
          triggerOffsetLeft: 0,
          triggerWidth: Math.min(90, w),
          triggerHeight: 29,
        });

        expect(geo.totalW).toBe(w);
        expect(geo.svgStyle.left).toBe("0px");
        const matches = geo.dEdge.matchAll(/([MLQC])\s*([-\d.]+)\s+([-\d.]+)/g);
        for (const match of matches) {
          const x = Number.parseFloat(match[2]!);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(w);
        }
      }
    });

    it("computes bottombar join geometry with exact dimensions and Bézier SVG curve", () => {
      const { z, M, P, D } = computeBottombarJoinGeometry(250, 543);
      expect(z).toBe(16);
      expect(M).toBe(282); // 250 + 2 * 16
      expect(P).toBe(543);
      expect(D).toContain("M 0 0 Q 16 0 16 16");
      expect(D).toContain("Q 266 0 282 0");
    });

    it("computes screenshot dropdown join geometry with exact dimensions and SVG curve", () => {
      const { z, M, P, D } = computeScreenshotJoinGeometry(220, 124);
      expect(z).toBe(16);
      expect(M).toBe(252); // 220 + 2 * 16
      expect(P).toBe(124);
      expect(D).toContain("M 0 0 Q 16 0 16 16");
      expect(D).toContain("Q 236 0 252 0");
    });

    it("createChromeJoinOutline mounts SVG outline and verified cleanup", () => {
      const popup = mockDoc.createElement("div");
      popup.offsetWidth = 170;
      popup.offsetHeight = 240;
      popup.setRectFn(() => ({ left: 0, top: 0, width: 170, height: 240 }));

      const trigger = mockDoc.createElement("button");
      trigger.offsetWidth = 90;
      trigger.offsetHeight = 29;

      const instance = createChromeJoinOutline(popup as any, {
        shoulder: 8,
        radius: 6,
        fillColor: "#151619",
        strokeColor: "#34353b",
        triggerElement: trigger as any,
        clampToBounds: true,
        triggerHeight: 29,
      });

      expect(instance.svg).toBeDefined();
      expect(instance.pathFill.style.fill).toBe("#151619");
      expect(instance.pathEdge.style.stroke).toBe("#34353b");

      instance.destroy();
    });
  });

  describe("2. Context Menu Actions & Price Copying", () => {
    it("provides and registers canonical SVG icons in Vela icon registry", () => {
      expect(SLIDERS_ICON_SVG).toContain('viewBox="0 0 20 20"');
      expect(SLIDERS_ICON_SVG).toContain('stroke-width="1.25"');
      expect(COPY_PRICE_ICON_SVG).toContain('viewBox="0 0 16 16"');
      expect(COPY_PRICE_ICON_SVG).toContain('<rect x="5.5" y="5.5"');

      registerCopyPriceAction();
      expect(iconMarkup("copy")).toBe(COPY_PRICE_ICON_SVG);
      expect(iconMarkup("copy-price")).toBe(COPY_PRICE_ICON_SVG);
      expect(iconMarkup("sliders")).toBe(SLIDERS_ICON_SVG);
    });

    it("formats standard and precision prices correctly, handling invalid inputs", () => {
      expect(formatCopyPrice(1234.5)).toBe("1234.50");
      expect(formatCopyPrice(82896.02)).toBe("82896.02");
      expect(formatCopyPrice(100)).toBe("100.00");

      expect(formatCopyPrice(1.08456, 4)).toBe("1.0846");
      expect(formatCopyPrice(0.00001234, 8)).toBe("0.00001234");
      expect(formatCopyPrice(500, 0)).toBe("500");

      expect(formatCopyPrice(null)).toBe("");
      expect(formatCopyPrice(undefined)).toBe("");
      expect(formatCopyPrice(Number.NaN)).toBe("");
      expect(formatCopyPrice(Infinity)).toBe("");
      expect(formatCopyPrice(-Infinity)).toBe("");
    });

    it("registers 'copy-price' widget action and copies price to clipboard", async () => {
      vi.useFakeTimers();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      registerCopyPriceAction();

      const actions = widgetActions("context:body");
      const copyAction = actions.find((a) => a.id === "copy-price");

      expect(copyAction).toBeDefined();
      expect(copyAction?.label).toBe("Copy price");
      expect(copyAction?.target).toBe("context:body");
      expect(copyAction?.icon).toBe("copy");
      expect(copyAction?.order).toBe(-100);

      const toastMock = vi.fn();
      const fakeCtx = {
        pointer: { price: 82896.0234 },
        toast: toastMock,
        chart: {},
      };

      copyAction?.run(fakeCtx as any);

      expect(writeTextMock).toHaveBeenCalledWith("82896.02");
      await vi.runAllTimersAsync();
      expect(toastMock).toHaveBeenCalledWith("Copied 82896.02", "success");
      vi.useRealTimers();
    });

    it("falls back to fallbackResolver when pointer price is missing", async () => {
      vi.useFakeTimers();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const fallbackSpy = vi.fn(() => ({ price: 42000.5, decimals: 2 }));
      registerCopyPriceAction(fallbackSpy);

      const copyAction = widgetActions("context:body").find((a) => a.id === "copy-price");
      const toastMock = vi.fn();

      copyAction?.run({ pointer: { price: null }, toast: toastMock } as any);

      expect(fallbackSpy).toHaveBeenCalled();
      expect(writeTextMock).toHaveBeenCalledWith("42000.50");
      await vi.runAllTimersAsync();
      expect(toastMock).toHaveBeenCalledWith("Copied 42000.50", "success");
      vi.useRealTimers();
    });

    it("patches contextMenu.itemsFor to assign Sliders icon to settings items", () => {
      const mockItems = [
        { id: "settings:Canvas", label: "Settings…", icon: "gear" },
        { id: "unrelated", label: "Delete", icon: "trash" },
      ];

      const mockContextMenu = {
        itemsFor: vi.fn((_target?: string) => [...mockItems]),
      };

      const container = mockDoc.createElement("div");
      mockDoc.body.appendChild(container);

      const cleanup = enhanceVelaContextMenu(container as any, mockContextMenu);

      const modifiedItems = mockContextMenu.itemsFor("context:body");
      const settingsItem = modifiedItems.find((i: any) => i.id === "settings:Canvas");
      expect(settingsItem?.icon).toBe("sliders");

      cleanup();
    });

    it("isolates global keyboard shortcuts to active cell and prioritizes live cursor fallback price", () => {
      const mockContextMenu = {
        pointer: { price: 20000 },
        itemsFor: vi.fn(() => []),
      };

      const container = mockDoc.createElement("div");
      mockDoc.body.appendChild(container);

      const onCreateAlert = vi.fn();
      const onPlaceOrder = vi.fn();

      const fallbackResolver = vi.fn(() => ({ price: 25000, decimals: 2 }));

      const cleanup = enhanceVelaContextMenu(container as any, mockContextMenu, fallbackResolver, {
        getSymbol: () => "MNQ",
        getCurrentPrice: () => 24000,
        onCreateAlert,
        onPlaceOrder,
      });

      // 1. Inactive container: Alt+A should NOT trigger
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true }));
      expect(onCreateAlert).not.toHaveBeenCalled();

      // 2. Active cell container (dataset.active = "1"): Alt+A triggers with resolvedFallbackPrice (25000) instead of old pointer.price (20000)
      container.dataset.active = "1";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true }));
      expect(onCreateAlert).toHaveBeenCalledWith("MNQ", 25000);

      // 3. Alt+Shift+B triggers buy limit order with live cursor price
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", altKey: true, shiftKey: true }));
      expect(onPlaceOrder).toHaveBeenCalledWith("buy", "limit", 25000, "MNQ");

      cleanup();
    });
  });

  describe("3. Screenshot Export & Canvas Capture Contracts", () => {
    let chartContainer: any;
    let mockChartInstance: any;

    beforeEach(() => {
      chartContainer = mockDoc.createElement("div");
      mockDoc.body.appendChild(chartContainer);

      mockChartInstance = {
        renderer: {
          screenshotCanvas: vi.fn(),
        },
        screenshotCanvas: vi.fn(),
      };
    });

    it("calls chartInstance.renderer.screenshotCanvas() when available", () => {
      const mockCanvas = mockDoc.createElement("canvas");
      mockCanvas.width = 800;
      mockCanvas.height = 600;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(mockCanvas);

      const result = getChartScreenshotCanvas(chartContainer, mockChartInstance);
      expect(mockChartInstance.renderer.screenshotCanvas).toHaveBeenCalled();
      expect(result).toBe(mockCanvas);
    });

    it("falls back to chartInstance.screenshotCanvas() when renderer is absent", () => {
      const mockCanvas = mockDoc.createElement("canvas");
      mockCanvas.width = 640;
      mockCanvas.height = 480;
      delete mockChartInstance.renderer;
      mockChartInstance.screenshotCanvas.mockReturnValue(mockCanvas);

      const result = getChartScreenshotCanvas(chartContainer, mockChartInstance);
      expect(mockChartInstance.screenshotCanvas).toHaveBeenCalled();
      expect(result).toBe(mockCanvas);
    });

    it("falls back to compositing DOM canvas pile when instance methods return null", () => {
      const c1 = mockDoc.createElement("canvas");
      c1.width = 500;
      c1.height = 300;
      const c2 = mockDoc.createElement("canvas");
      c2.width = 500;
      c2.height = 300;
      chartContainer.appendChild(c1);
      chartContainer.appendChild(c2);

      const result = getChartScreenshotCanvas(chartContainer, null);
      expect(result).toBeTruthy();
      expect(result?.width).toBe(500);
      expect(result?.height).toBe(300);
    });

    it("triggers a browser PNG download with symbol and resolution naming", async () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const toastSpy = vi.fn();
      const success = await downloadChartScreenshot(
        chartContainer,
        mockChartInstance,
        "BTCUSDT",
        "15m",
        toastSpy,
      );

      expect(success).toBe(true);
      expect(toastSpy).toHaveBeenCalledWith("Screenshot downloaded", "success");
    });

    it("copies PNG blob to clipboard and falls back to download on clipboard failure", async () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const writeClipboardMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { write: writeClipboardMock } });

      const toastSpy = vi.fn();
      const success = await copyChartScreenshotToClipboard(
        chartContainer,
        mockChartInstance,
        toastSpy,
      );

      expect(success).toBe(true);
      expect(writeClipboardMock).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith("Chart image copied to clipboard", "success");

      // Failure fallback test
      writeClipboardMock.mockRejectedValue(new Error("NotAllowedError"));
      const fallbackSuccess = await copyChartScreenshotToClipboard(
        chartContainer,
        mockChartInstance,
        toastSpy,
        "ETHUSDT",
        "5m",
      );

      expect(fallbackSuccess).toBe(true);
      expect(toastSpy).toHaveBeenCalledWith("Screenshot downloaded", "success");
    });

    it("crops portion when selection is dragged and released in armVelaPortionSelection", () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const writeClipboardMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { write: writeClipboardMock } });

      const toastSpy = vi.fn();
      armVelaPortionSelection(chartContainer, mockChartInstance, "SOLUSDT", "1h", toastSpy);

      const overlay = chartContainer.querySelector(".vela-portion-overlay")!;
      expect(overlay).toBeTruthy();

      // Drag and release
      overlay.dispatchEvent(
        new (globalThis as any).PointerEvent("pointerdown", {
          clientX: 20,
          clientY: 20,
          button: 0,
        }),
      );
      overlay.dispatchEvent(
        new (globalThis as any).PointerEvent("pointermove", { clientX: 120, clientY: 120 }),
      );
      overlay.dispatchEvent(
        new (globalThis as any).PointerEvent("pointerup", { clientX: 120, clientY: 120 }),
      );

      // Overlay should be cleaned up after capture
      expect(chartContainer.querySelector(".vela-portion-overlay")).toBeNull();
    });

    it("exports all 4 canonical screenshot SVG icons", () => {
      expect(CAMERA_ICON_SVG).toContain("<svg");
      expect(CAMERA_ICON_SVG).toContain('circle cx="8" cy="8.5" r="2.6"');
      expect(DOWNLOAD_ICON_SVG).toContain("<svg");
      expect(CLIPBOARD_ICON_SVG).toContain("<svg");
      expect(CROP_ICON_SVG).toContain("<svg");
    });
  });

  describe("4. Chrome Tool Card & Button Metadata", () => {
    it("contains canonical definitions for all standard chart control buttons", () => {
      expect(CHART_BUTTON_DESCRIPTIONS["Chart style"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Indicators"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Undo"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Redo"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Time zone"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Chart settings"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Object tree"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Data window"]).toBeDefined();
      expect(CHART_BUTTON_DESCRIPTIONS["Screenshot"]).toBeDefined();
    });

    it("resolves button card meta with title, description, and shortcut hints", () => {
      const undoBtn = mockDoc.createElement("button");
      undoBtn.setAttribute("aria-label", "Undo");
      const undoMeta = resolveButtonCardMeta(undoBtn as any);
      expect(undoMeta?.title).toBe("Undo");
      expect(undoMeta?.description).toBe("Reverse the last chart edit.");

      const otBtn = mockDoc.createElement("button");
      otBtn.setAttribute("aria-label", "Object tree");
      const otMeta = resolveButtonCardMeta(otBtn as any);
      expect(otMeta?.title).toBe("Object tree");
      expect(otMeta?.description).toContain("drawing on this chart");
    });
  });
});

describe("Vela Drawings Suite (Unified Functional Engine)", () => {
  let mockStorage: MockLocalStorage;
  const origLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockLocalStorage();
    (globalThis as any).localStorage = mockStorage;
  });

  afterEach(() => {
    flushPendingTradeDrawingsSave();
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as any).localStorage = origLocalStorage;
  });

  describe("1. Dual-tier localStorage + API Persistence Bridge", () => {
    it("manages localStorage primitives for favorites, tool prefs, and trade drawings", () => {
      expect(loadDrawingFavorites()).toEqual([]);
      saveDrawingFavorites(["trendline", "box"]);
      expect(loadDrawingFavorites()).toEqual(["trendline", "box"]);

      expect(loadDrawingToolPrefs()).toEqual({});
      saveDrawingToolPrefs({ snapMode: "strong", stayMode: true });
      expect(loadDrawingToolPrefs()).toEqual({ snapMode: "strong", stayMode: true });

      expect(loadTradeDrawings("trade-xyz")).toBeNull();
      saveTradeDrawings("trade-xyz", { version: 1, drawings: [{ id: "1", type: "line" }] });
      expect(loadTradeDrawings("trade-xyz")).toEqual({
        version: 1,
        drawings: [{ id: "1", type: "line" }],
      });
    });

    it("hydrates favorites, snap/stay modes, and trade drawings from localStorage without write-backs", () => {
      localStorage.setItem(
        VELA_DRAWING_FAVORITES_KEY,
        JSON.stringify(["Trend Line", "Horizontal Ray"]),
      );
      localStorage.setItem(
        VELA_DRAWING_PREFS_KEY,
        JSON.stringify({ snapMode: "weak", stayMode: true }),
      );
      localStorage.setItem(
        VELA_TRADE_DRAWINGS_PREFIX + "trade-1",
        JSON.stringify({ version: 1, drawings: [{ id: "d-101", type: "Trend Line" }] }),
      );

      const chart = new MockVelaChart();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));
      const onDrawingsRestored = vi.fn();

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-1", {
        fetchImpl: mockFetch as any,
        onDrawingsRestored,
      });

      expect(chart.drawings.setFavorites).toHaveBeenCalledWith(["Trend Line", "Horizontal Ray"]);
      expect(chart.drawings.setSnapMode).toHaveBeenCalledWith("weak");
      expect(chart.drawings.setStayMode).toHaveBeenCalledWith(true);
      expect(chart.drawings.fromJSON).toHaveBeenCalledWith({
        version: 1,
        drawings: [{ id: "d-101", type: "Trend Line" }],
      });
      expect(onDrawingsRestored).toHaveBeenCalledTimes(1);

      // Verify no remote API calls were triggered by hydration
      vi.advanceTimersByTime(1000);
      expect(mockFetch).not.toHaveBeenCalled();

      cleanup();
    });

    it("hydrates from initialDrawingsJson (SQLite) when localStorage is empty and caches it", () => {
      const chart = new MockVelaChart();
      const initialJson = JSON.stringify({
        version: 1,
        drawings: [{ id: "d-sqlite-1", type: "Fib Retracement" }],
      });
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-from-db", {
        initialDrawingsJson: initialJson,
        fetchImpl: mockFetch as any,
      });

      expect(chart.drawings.fromJSON).toHaveBeenCalledWith({
        version: 1,
        drawings: [{ id: "d-sqlite-1", type: "Fib Retracement" }],
      });

      const cached = localStorage.getItem(VELA_TRADE_DRAWINGS_PREFIX + "trade-from-db");
      expect(cached).toBe(initialJson);

      vi.advanceTimersByTime(1000);
      expect(mockFetch).not.toHaveBeenCalled();

      cleanup();
    });

    it("hydrates empty drawings structure when neither localStorage nor SQLite has drawings", () => {
      const chart = new MockVelaChart();
      const cleanup = attachVelaDrawingsPersistence(chart, "trade-empty");

      expect(chart.drawings.fromJSON).toHaveBeenCalledWith({
        version: 1,
        drawings: [],
      });

      cleanup();
    });

    it("persists to localStorage synchronously and debounces remote PATCH on drawing:created", async () => {
      const chart = new MockVelaChart();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-create-test", {
        fetchImpl: mockFetch as any,
        debounceMs: 350,
      });

      chart.drawingsDoc.drawings.push({ id: "d-new-1", type: "Brush" });
      chart.emit("drawing:created", { drawing: { id: "d-new-1" } });

      const savedRaw = localStorage.getItem(VELA_TRADE_DRAWINGS_PREFIX + "trade-create-test");
      expect(savedRaw).not.toBeNull();
      const savedDoc = JSON.parse(savedRaw!);
      expect(savedDoc.drawings).toEqual([{ id: "d-new-1", type: "Brush" }]);

      expect(mockFetch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(mockFetch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(60);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trades/trade-create-test",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drawingsJson: JSON.stringify({
              version: 1,
              drawings: [{ id: "d-new-1", type: "Brush" }],
            }),
          }),
        }),
      );

      cleanup();
    });

    it("ignores pure drawing:selected events where the drawings document did not change", () => {
      const chart = new MockVelaChart();
      chart.drawingsDoc.drawings = [{ id: "d-existing", type: "Ray" }];

      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));
      const cleanup = attachVelaDrawingsPersistence(chart, "trade-select-test", {
        initialDrawingsJson: JSON.stringify({
          version: 1,
          drawings: [{ id: "d-existing", type: "Ray" }],
        }),
        fetchImpl: mockFetch as any,
      });

      chart.emit("drawing:selected", { id: "d-existing" });

      vi.advanceTimersByTime(1000);
      expect(mockFetch).not.toHaveBeenCalled();

      cleanup();
    });

    it("persists undo/redo which emits drawing:selected when document changes", () => {
      const chart = new MockVelaChart();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-undo-test", {
        fetchImpl: mockFetch as any,
        debounceMs: 350,
      });

      chart.drawingsDoc.drawings.push({ id: "d-1", type: "Arrow" });
      chart.emit("drawing:created");

      vi.advanceTimersByTime(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Store reverts on undo and emits drawing:selected with empty drawings
      chart.drawingsDoc.drawings = [];
      chart.emit("drawing:selected", { id: null });

      const savedRaw = localStorage.getItem(VELA_TRADE_DRAWINGS_PREFIX + "trade-undo-test");
      expect(JSON.parse(savedRaw!).drawings).toEqual([]);

      vi.advanceTimersByTime(400);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/trades/trade-undo-test",
        expect.objectContaining({
          body: JSON.stringify({
            drawingsJson: JSON.stringify({ version: 1, drawings: [] }),
          }),
        }),
      );

      cleanup();
    });

    it("persists on store.onChange mutations", () => {
      const chart = new MockVelaChart();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-store-test", {
        fetchImpl: mockFetch as any,
        debounceMs: 350,
      });

      chart.drawingsDoc.drawings.push({ id: "d-store-1", type: "Rectangle" });
      chart.triggerStoreChange();

      vi.advanceTimersByTime(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it("isolates drawings between two trades of the same symbol and flushes on cleanup", () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const tradeKeyA = "acc-1:MES:2026-03-01:1";
      const chartA = new MockVelaChart();
      const cleanupA = attachVelaDrawingsPersistence(chartA, tradeKeyA, {
        fetchImpl: mockFetch as any,
        debounceMs: 500,
      });

      chartA.drawingsDoc.drawings.push({ id: "a-draw-1", type: "Trend Line" });
      chartA.emit("drawing:created");

      // Cleanup A must immediately flush remote sync for Trade A
      cleanupA();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/trades/${encodeURIComponent(tradeKeyA)}`,
        expect.objectContaining({
          body: JSON.stringify({
            drawingsJson: JSON.stringify({
              version: 1,
              drawings: [{ id: "a-draw-1", type: "Trend Line" }],
            }),
          }),
        }),
      );

      const tradeKeyB = "acc-1:MES:2026-03-02:2";
      const chartB = new MockVelaChart();
      const cleanupB = attachVelaDrawingsPersistence(chartB, tradeKeyB, {
        fetchImpl: mockFetch as any,
      });

      expect(chartB.drawings.fromJSON).toHaveBeenCalledWith({
        version: 1,
        drawings: [],
      });

      expect(loadTradeDrawings(tradeKeyA)?.drawings).toEqual([
        { id: "a-draw-1", type: "Trend Line" },
      ]);
      expect(loadTradeDrawings(tradeKeyB)).toBeNull();

      cleanupB();
    });

    it("persists drawing:favorites, drawing:snap, and drawing:stay events", () => {
      const chart = new MockVelaChart();
      const cleanup = attachVelaDrawingsPersistence(chart, "trade-favs");

      chart.emit("drawing:favorites", { favorites: ["Rectangle", "Callout"] });
      expect(loadDrawingFavorites()).toEqual(["Rectangle", "Callout"]);

      chart.emit("drawing:snap", { mode: "strong" });
      expect(loadDrawingToolPrefs().snapMode).toBe("strong");

      chart.emit("drawing:stay", { on: true });
      expect(loadDrawingToolPrefs().stayMode).toBe(true);

      chart.emit("drawing:snap", { mode: "off" });
      expect(loadDrawingToolPrefs().snapMode).toBe("off");
      expect(loadDrawingToolPrefs().stayMode).toBe(true);

      chart.emit("drawing:stay", { on: false });
      expect(loadDrawingToolPrefs().stayMode).toBe(false);

      cleanup();
    });
  });

  describe("2. Favorite Drawing Tools Toolbar & Grip", () => {
    let doc: MockDocument;
    let hostEl: MockElement;
    const origHTMLElement = (globalThis as any).HTMLElement;
    const origResizeObserver = (globalThis as any).ResizeObserver;
    const origMutationObserver = (globalThis as any).MutationObserver;

    beforeEach(() => {
      (globalThis as any).HTMLElement = MockElement as any;
      (globalThis as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      (globalThis as any).MutationObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      };

      doc = new MockDocument();
      hostEl = doc.createElement("div");
      hostEl.className = "vela-chart-container";
      hostEl.offsetWidth = 1000;
      hostEl.offsetHeight = 700;
      hostEl.setRectFn(() => ({ left: 0, top: 0, width: 1000, height: 700 }));
      doc.body.appendChild(hostEl);
    });

    afterEach(() => {
      (globalThis as any).HTMLElement = origHTMLElement;
      (globalThis as any).ResizeObserver = origResizeObserver;
      (globalThis as any).MutationObserver = origMutationObserver;
    });

    it("resolves drawing tool metadata and provides canonical icons", () => {
      expect(DEFAULT_TOOL_META["trendline"]?.label).toBe("Trend Line");
      expect(DEFAULT_TOOL_META["box"]?.label).toBe("Rectangle");
      expect(DEFAULT_TOOL_META["fibretracement"]?.label).toBe("Fib Retracement");

      const trendMeta = resolveToolMeta("trendline");
      expect(trendMeta.label).toBe("Trend Line");
      expect(trendMeta.icon).toContain("<svg");

      const customMeta = resolveToolMeta("unknown_tool", undefined, {
        resolveToolMeta: (type) => ({
          label: `Custom ${type}`,
          icon: "<svg></svg>",
        }),
      });
      expect(customMeta.label).toBe("Custom unknown_tool");
    });

    it("toggles favorite toolbar visibility when favorites are added or emptied", () => {
      const chart = new MockVelaChart();
      const cleanup = attachVelaFavoriteToolbar(chart as any, hostEl as any);

      const toolbar = hostEl.querySelector(".vela-fav-toolbar");
      expect(toolbar).not.toBeNull();
      expect(toolbar!.hidden).toBe(true);
      expect(toolbar!.getAttribute("data-empty")).toBe("1");

      chart.drawings.setFavorites(["trendline", "box"]);

      expect(toolbar!.hidden).toBe(false);
      expect(toolbar!.hasAttribute("data-empty")).toBe(false);
      const buttons = toolbar!.querySelectorAll(".vela-fav-toolbar-btn");
      expect(buttons.length).toBe(2);
      expect(buttons[0]!.getAttribute("data-tool")).toBe("trendline");
      expect(buttons[1]!.getAttribute("data-tool")).toBe("box");

      cleanup();
    });

    it("clicking a tool button activates it and clicking again deactivates it (toggles null)", () => {
      const chart = new MockVelaChart();
      chart.favorites = ["trendline", "box"];
      const cleanup = attachVelaFavoriteToolbar(chart as any, hostEl as any);

      const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
      const trendBtn = toolbar.querySelector("[data-tool='trendline']")!;

      expect(trendBtn.getAttribute("data-active")).toBe("0");

      trendBtn.dispatchEvent({ type: "click" });
      expect(chart.drawings.setTool).toHaveBeenCalledWith("trendline");
      expect(trendBtn.getAttribute("data-active")).toBe("1");
      expect(trendBtn.getAttribute("aria-pressed")).toBe("true");

      trendBtn.dispatchEvent({ type: "click" });
      expect(chart.drawings.setTool).toHaveBeenCalledWith(null);
      expect(trendBtn.getAttribute("data-active")).toBe("0");
      expect(trendBtn.getAttribute("aria-pressed")).toBe("false");

      cleanup();
    });

    it("synchronizes button states with external drawing:tool events", () => {
      const chart = new MockVelaChart();
      chart.favorites = ["trendline", "box"];
      const cleanup = attachVelaFavoriteToolbar(chart as any, hostEl as any);

      const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
      const trendBtn = toolbar.querySelector("[data-tool='trendline']")!;
      const boxBtn = toolbar.querySelector("[data-tool='box']")!;

      chart.emit("drawing:tool", { type: "box" });
      expect(boxBtn.getAttribute("data-active")).toBe("1");
      expect(trendBtn.getAttribute("data-active")).toBe("0");

      chart.emit("drawing:tool", { type: null });
      expect(boxBtn.getAttribute("data-active")).toBe("0");

      cleanup();
    });

    it("restores toolbar position from localStorage and cleans up on unmount", () => {
      localStorage.setItem(FAV_TOOLBAR_POS_STORAGE_KEY, JSON.stringify({ x: 220, y: 45 }));

      const chart = new MockVelaChart();
      chart.favorites = ["trendline"];
      const cleanup = attachVelaFavoriteToolbar(chart as any, hostEl as any);

      const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
      expect(toolbar.style.left).toBe("220px");
      expect(toolbar.style.top).toBe("45px");

      expect(chart.listenerCount("drawing:favorites")).toBe(1);
      expect(chart.listenerCount("drawing:tool")).toBe(1);

      cleanup();

      expect(hostEl.querySelector(".vela-fav-toolbar")).toBeNull();
      expect(chart.listenerCount("drawing:favorites")).toBe(0);
      expect(chart.listenerCount("drawing:tool")).toBe(0);
    });

    it("enhances toolbar grip button with GRIP_SIX_DOTS_SVG idempotently", () => {
      const gripBtn = doc.createElement("button");
      gripBtn.className = "vela-dpop-grip";
      gripBtn.innerHTML = "<span>old</span>";

      enhanceVelaFloatingToolbarGrip(gripBtn as any);
      expect(gripBtn.innerHTML).toBe(GRIP_SIX_DOTS_SVG);
      expect(gripBtn.getAttribute("data-grip-enhanced")).toBe("1");

      // Calling again is idempotent
      enhanceVelaFloatingToolbarGrip(gripBtn as any);
      expect(gripBtn.innerHTML).toBe(GRIP_SIX_DOTS_SVG);
    });
  });

  describe("3. Toolbar Gutter Synchronization", () => {
    it("synchronizes renderer toolbar gutter to 52px and triggers size recalculation", () => {
      const setToolbarGutter = vi.fn();
      const syncSize = vi.fn();
      const mockContainer = {
        style: {
          setProperty: vi.fn(),
        },
      } as unknown as HTMLElement;

      const mockInstance = {
        renderer: {
          setToolbarGutter,
          syncSize,
        },
        drawings: {},
      };

      syncVelaToolbarGutter(mockInstance, mockContainer);

      expect(setToolbarGutter).toHaveBeenCalledWith(52);
      expect(mockContainer.style.setProperty).toHaveBeenCalledWith("--vela-toolbar-gutter", "52px");
      expect(syncSize).toHaveBeenCalled();
    });

    it("intercepts drawings.syncToolbarGutter for open, collapsed, and mobile layouts", () => {
      const setToolbarGutter = vi.fn();
      const syncSize = vi.fn();

      const mockDrawings = {
        toolbarVisible: true,
        mobileLayout: false,
        toolbarCollapsed: false,
        syncToolbarGutter: vi.fn(),
      };

      const mockInstance = {
        renderer: {
          setToolbarGutter,
          syncSize,
        },
        drawings: mockDrawings,
      };

      syncVelaToolbarGutter(mockInstance);
      expect(setToolbarGutter).toHaveBeenCalledWith(52);

      // Collapsed toolbar -> 16px
      mockDrawings.toolbarCollapsed = true;
      mockDrawings.syncToolbarGutter();
      expect(setToolbarGutter).toHaveBeenLastCalledWith(16);

      // Restored toolbar -> 52px
      mockDrawings.toolbarCollapsed = false;
      mockDrawings.syncToolbarGutter();
      expect(setToolbarGutter).toHaveBeenLastCalledWith(52);

      // Mobile layout -> 0px
      mockDrawings.mobileLayout = true;
      mockDrawings.syncToolbarGutter();
      expect(setToolbarGutter).toHaveBeenLastCalledWith(0);

      // Hidden toolbar -> 0px
      mockDrawings.mobileLayout = false;
      mockDrawings.toolbarVisible = false;
      mockDrawings.syncToolbarGutter();
      expect(setToolbarGutter).toHaveBeenLastCalledWith(0);
    });

    it("handles null, undefined, and nested renderer wrappers safely", () => {
      expect(() => syncVelaToolbarGutter(null)).not.toThrow();
      expect(() => syncVelaToolbarGutter(undefined)).not.toThrow();
      expect(() => syncVelaToolbarGutter({})).not.toThrow();

      const setToolbarGutter = vi.fn();
      const syncSize = vi.fn();
      const mockRenderer = { setToolbarGutter, syncSize };
      const wrappedInstance = { renderer: { renderer: mockRenderer, syncSize: vi.fn() } };

      syncVelaToolbarGutter(wrappedInstance);
      expect(setToolbarGutter).toHaveBeenCalledWith(52);
    });
  });

  describe("Vela 0.8.4 Tool Defaults & Styles Contract", () => {
    it("extracts tool defaults using official Vela 0.8.4 toolDefaults() API", () => {
      const mockChart = {
        drawings: {
          toolDefaults: vi.fn(() => ({
            trendline: { lineColor: "#ff0000", lineWidth: 2 },
            fibonacci: { levels: [0, 0.5, 1], lineColor: "#00ff00" },
          })),
        },
      };

      const styles = extractControllerToolStyles(mockChart);
      expect(styles).toEqual({
        trendline: { lineColor: "#ff0000", lineWidth: 2 },
        fibonacci: { levels: [0, 0.5, 1], lineColor: "#00ff00" },
      });
      expect(mockChart.drawings.toolDefaults).toHaveBeenCalled();
    });

    it("falls back to legacy ctrl.lastStyle Map if toolDefaults() is not present", () => {
      const lastStyleMap = new Map();
      lastStyleMap.set("trendline", { lineColor: "#3b82f6", lineWidth: 1 });
      const mockLegacyChart = {
        drawings: {
          ctrl: {
            lastStyle: lastStyleMap,
          },
        },
      };

      const styles = extractControllerToolStyles(mockLegacyChart);
      expect(styles).toEqual({
        trendline: { lineColor: "#3b82f6", lineWidth: 1 },
      });
    });

    it("applies tool defaults using official Vela 0.8.4 setToolDefaults() API", () => {
      const setToolDefaults = vi.fn();
      const mockChart = {
        drawings: {
          setToolDefaults,
        },
      };

      applyControllerToolStyles(mockChart, {
        trendline: { lineColor: "#10b981", lineWidth: 3 },
      });

      expect(setToolDefaults).toHaveBeenCalledWith({
        trendline: { lineColor: "#10b981", lineWidth: 3 },
      });
    });

    it("falls back to legacy ctrl.lastStyle.set() when setToolDefaults() is not present", () => {
      const lastStyleMap = new Map();
      const mockLegacyChart = {
        drawings: {
          ctrl: {
            lastStyle: lastStyleMap,
          },
        },
      };

      applyControllerToolStyles(mockLegacyChart, {
        trendline: { lineColor: "#f59e0b", lineWidth: 2 },
      });

      expect(lastStyleMap.get("trendline")).toEqual({
        lineColor: "#f59e0b",
        lineWidth: 2,
      });
    });
  });
});

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

  describe("6. Cross-Asset Sample Anchor & Price Isolation", () => {
    it("provides canonical sample presets for CME futures and crypto", () => {
      expect(SAMPLE_BASE_PRICES.MES).toBeDefined();
      expect(SAMPLE_BASE_PRICES.MES?.price).toBe(7_825.25);
      expect(SAMPLE_BASE_PRICES.MNQ).toBeDefined();
      expect(SAMPLE_BASE_PRICES.MNQ?.price).toBe(30_575.75);
      expect(SAMPLE_BASE_PRICES.MYM).toBeDefined();
      expect(SAMPLE_BASE_PRICES.CL).toBeDefined();
      expect(SAMPLE_BASE_PRICES.BTCUSDT).toBeDefined();
    });

    it("resolves default preset price when reference price is omitted", () => {
      const mes = resolveSampleAnchor("MES");
      expect(mes.price).toBe(7_825.25);
      expect(mes.tickSize).toBe(0.25);

      const mnq = resolveSampleAnchor("MNQ");
      expect(mnq.price).toBe(30_575.75);
      expect(mnq.tickSize).toBe(0.25);
    });

    it("accepts valid live prices within realistic asset bounds", () => {
      const mesLive = resolveSampleAnchor("MES", 7_810.5, 0.25);
      expect(mesLive.price).toBe(7_810.5);
      expect(mesLive.tickSize).toBe(0.25);

      const mnqLive = resolveSampleAnchor("MNQ", 30_620.75, 0.25);
      expect(mnqLive.price).toBe(30_620.75);
      expect(mnqLive.tickSize).toBe(0.25);
    });

    it("strictly isolates cross-asset contaminated prices (e.g. 30k MNQ passed to MES)", () => {
      const contaminatedMes = resolveSampleAnchor("MES", 30_569.0, 0.25);
      expect(contaminatedMes.price).toBe(7_825.25);
      expect(contaminatedMes.tickSize).toBe(0.25);

      const contaminatedMnq = resolveSampleAnchor("MNQ", 7_825.25, 0.25);
      expect(contaminatedMnq.price).toBe(30_575.75);

      const contaminatedCl = resolveSampleAnchor("CL", 7_800.0, 0.01);
      expect(contaminatedCl.price).toBe(72.5);
    });

    it("cleans exchange prefix and contract month suffixes cleanly", () => {
      const complexMes = resolveSampleAnchor("CME_MINI:MESZ26", 7_830.0, 0.25);
      expect(complexMes.price).toBe(7_830.0);

      const continuousMnq = resolveSampleAnchor("MNQ1!", 30_590.0, 0.25);
      expect(continuousMnq.price).toBe(30_590.0);
    });
  });
});
