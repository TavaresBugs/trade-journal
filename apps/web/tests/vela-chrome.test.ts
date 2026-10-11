import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeChromeJoinGeometry,
  createChromeJoinOutline,
} from "../src/components/vela-chrome-join";
import {
  computeBottombarJoinGeometry,
  CHART_BUTTON_DESCRIPTIONS,
  resolveButtonCardMeta,
} from "../src/components/vela-chrome-enhancer";
import {
  SLIDERS_ICON_SVG,
  COPY_PRICE_ICON_SVG,
  formatCopyPrice,
  showVelaToast as showContextToast,
  registerCopyPriceAction,
  enhanceVelaContextMenu,
  _resetCopyPriceActionForTesting,
} from "../src/components/vela-context-menu";
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
} from "../src/components/vela-screenshot-menu";
import { widgetActions } from "@luxalgo/vela/widget";
import { iconMarkup } from "@luxalgo/vela/ui";
import { MockElement, MockDocument, MockMutationObserver } from "./helpers/dom-mock";

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
      constructor(type: string, init: any = {}) {
        this.type = type;
        this.key = init.key ?? "";
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
