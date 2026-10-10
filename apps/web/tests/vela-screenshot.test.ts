import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Lightweight Mock DOM for headless test environment ─────────────────────────

class MockElement {
  tagName: string;
  className = "";
  id = "";
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  style: Record<string, any> = {
    setProperty(k: string, v: string) {
      this[k] = v;
    },
    getPropertyValue(k: string) {
      return this[k] ?? "";
    },
  };
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  width = 0;
  height = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  clientWidth = 0;
  listeners: Record<string, Function[]> = {};
  _textContent = "";
  _innerHTML = "";

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get textContent(): string {
    let text = this._textContent;
    for (const child of this.children) {
      text += child.textContent;
    }
    return text;
  }

  set textContent(v: string) {
    this._textContent = v;
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this._textContent = val.replace(/<[^>]*>/g, "");
    this.children = [];
    if (val.includes("<svg")) {
      const svg = new MockElement("svg");
      const pathRegex = /<path\s+([^>]+)>/g;
      let match: RegExpExecArray | null;
      while ((match = pathRegex.exec(val)) !== null) {
        const pathEl = new MockElement("path");
        const attrs = match[1] || "";
        const classMatch = /class="([^"]+)"/.exec(attrs);
        if (classMatch?.[1]) pathEl.className = classMatch[1];
        const dMatch = /d="([^"]+)"/.exec(attrs);
        if (dMatch?.[1]) pathEl.setAttribute("d", dMatch[1]);
        svg.appendChild(pathEl);
      }
      this.appendChild(svg);
    }
  }

  get ownerDocument(): any {
    return globalThis.document;
  }

  get classList() {
    return {
      add: (...cls: string[]) => {
        const parts = new Set(this.className.split(" ").filter(Boolean));
        cls.forEach((c) => parts.add(c));
        this.className = Array.from(parts).join(" ");
      },
      remove: (...cls: string[]) => {
        const parts = new Set(this.className.split(" ").filter(Boolean));
        cls.forEach((c) => parts.delete(c));
        this.className = Array.from(parts).join(" ");
      },
      contains: (c: string) => this.className.split(" ").includes(c),
    };
  }

  setAttribute(k: string, v: string) {
    this.attributes.set(k, v);
    if (k === "class") this.className = v;
    if (k === "id") this.id = v;
    if (k.startsWith("data-")) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = v;
    }
  }

  getAttribute(k: string): string | null {
    return this.attributes.get(k) ?? null;
  }

  removeAttribute(k: string) {
    this.attributes.delete(k);
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  prepend(...children: MockElement[]) {
    children.forEach((c) => {
      c.parentElement = this;
      this.children.unshift(c);
    });
  }

  append(...children: (MockElement | string)[]) {
    children.forEach((c) => {
      if (typeof c === "string") {
        this.textContent += c;
      } else {
        c.parentElement = this;
        this.children.push(c);
      }
    });
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
  }

  closest(selector: string): MockElement | null {
    let cur: MockElement | null = this;
    while (cur) {
      if (selector.startsWith(".") && cur.classList.contains(selector.slice(1))) return cur;
      if (selector.startsWith("#") && cur.id === selector.slice(1)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  contains(other: MockElement): boolean {
    if (this === other) return true;
    for (const child of this.children) {
      if (child.contains(other)) return true;
    }
    return false;
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event: string, fn: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
    }
  }

  dispatchEvent(evt: any) {
    const list = this.listeners[evt.type] || [];
    list.forEach((f) => f(evt));
    return true;
  }

  click() {
    this.dispatchEvent({
      type: "click",
      preventDefault: () => {},
      stopPropagation: () => {},
      target: this,
    });
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const selParts = selector.split(",").map((s) => s.trim());

    const matchesSingle = (el: MockElement, sel: string): boolean => {
      if (sel === "canvas" && el.tagName === "CANVAS") return true;
      if (sel === "svg" && el.tagName === "SVG") return true;
      if (sel.startsWith("#") && !sel.includes("[") && el.id === sel.slice(1)) return true;
      if (sel.startsWith(".") || sel.startsWith("[")) {
        const classMatches = Array.from(sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)).map((m) => m[1]!);
        for (const cls of classMatches) {
          if (!el.classList.contains(cls)) return false;
        }
        const attrMatches = Array.from(sel.matchAll(/\[([a-zA-Z0-9_-]+)(?:=['"]?([^'"\]]*)['"]?)?\]/g));
        for (const attr of attrMatches) {
          const attrName = attr[1]!;
          const attrVal = attr[2];
          const actual = el.getAttribute(attrName);
          if (attrVal !== undefined) {
            if (actual !== attrVal) return false;
          } else if (actual === null) {
            return false;
          }
        }
        return classMatches.length > 0 || attrMatches.length > 0;
      }
      return false;
    };

    const matches = (el: MockElement) => {
      for (const sel of selParts) {
        if (matchesSingle(el, sel)) return true;
      }
      return false;
    };

    const traverse = (el: MockElement) => {
      for (const child of el.children) {
        if (matches(child)) results.push(child);
        traverse(child);
      }
    };
    traverse(this);
    return results;
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  }

  getContext() {
    return {
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
  }

  toDataURL() {
    return "data:image/png;base64,mockpng";
  }

  toBlob(cb: Function) {
    cb(new Blob(["mock"], { type: "image/png" }));
  }

  setPointerCapture() {}
  releasePointerCapture() {}
}

class MockDocument extends MockElement {
  body: MockElement;
  head: MockElement;

  constructor() {
    super("#document");
    this.body = new MockElement("body");
    this.head = new MockElement("head");
    this.children = [this.head, this.body];
  }

  createElement(tag: string) {
    return new MockElement(tag);
  }

  createElementNS(_ns: string, tag: string) {
    return new MockElement(tag);
  }

  getElementById(id: string): MockElement | null {
    return this.querySelector(`#${id}`);
  }
}

// Set up global environment
const mockDoc = new MockDocument();
(globalThis as any).document = mockDoc;
(globalThis as any).window = {
  addEventListener: (e: string, fn: Function) => mockDoc.addEventListener(e, fn),
  removeEventListener: (e: string, fn: Function) => mockDoc.removeEventListener(e, fn),
  dispatchEvent: (e: any) => mockDoc.dispatchEvent(e),
};
(globalThis as any).HTMLElement = MockElement;
(globalThis as any).HTMLCanvasElement = MockElement;
(globalThis as any).HTMLAnchorElement = MockElement;
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
try {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        write: vi.fn().mockResolvedValue(undefined),
      },
    },
    configurable: true,
    writable: true,
  });
} catch {
  (globalThis.navigator as any).clipboard = {
    write: vi.fn().mockResolvedValue(undefined),
  };
}

import {
  attachVelaScreenshotMenu,
  computeScreenshotJoinGeometry,
  getChartScreenshotCanvas,
  downloadChartScreenshot,
  copyChartScreenshotToClipboard,
  armVelaPortionSelection,
  showVelaToast,
  VELA_SCREENSHOT_STYLES,
  CAMERA_ICON_SVG,
  DOWNLOAD_ICON_SVG,
  CLIPBOARD_ICON_SVG,
  CROP_ICON_SVG,
} from "../src/components/vela-screenshot-menu";

describe("Official Vela Screenshot & Export Tool", () => {
  let topbarContainer: any;
  let chartContainer: any;
  let mockChartInstance: any;

  beforeEach(() => {
    topbarContainer = mockDoc.createElement("div");
    chartContainer = mockDoc.createElement("div");
    mockDoc.body.appendChild(topbarContainer);
    mockDoc.body.appendChild(chartContainer);

    mockChartInstance = {
      renderer: {
        screenshotCanvas: vi.fn(),
      },
      screenshotCanvas: vi.fn(),
    };
  });

  afterEach(() => {
    topbarContainer.remove();
    chartContainer.remove();
    mockDoc.querySelectorAll(".vela-ui-layer, .vela-toast, .vela-portion-overlay").forEach((el: any) => el.remove());
    vi.restoreAllMocks();
  });

  describe("Canvas Composite & Rasterization", () => {
    it("calls chartInstance.renderer.screenshotCanvas() when available", () => {
      const mockCanvas = mockDoc.createElement("canvas");
      mockCanvas.width = 800;
      mockCanvas.height = 600;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(mockCanvas);

      const result = getChartScreenshotCanvas(chartContainer, mockChartInstance);
      expect(mockChartInstance.renderer.screenshotCanvas).toHaveBeenCalled();
      expect(result).toBe(mockCanvas);
    });

    it("falls back to chartInstance.screenshotCanvas() if renderer method is missing", () => {
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
  });

  describe("Toast Notification System", () => {
    it("displays vela-toast with data-open and auto-hides after timer", () => {
      vi.useFakeTimers();
      showVelaToast(chartContainer, "Screenshot downloaded", "success", 2000);

      const toast = mockDoc.querySelector(".vela-toast");
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toBe("Screenshot downloaded");
      expect(toast?.dataset.open).toBe("1");
      expect(toast?.dataset.type).toBe("success");
      expect(toast?.querySelector(".vela-toast-icon")).toBeTruthy();

      vi.advanceTimersByTime(2500);
      expect(toast?.dataset.open).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe("Download Screenshot", () => {
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
        toastSpy
      );

      expect(success).toBe(true);
      expect(toastSpy).toHaveBeenCalledWith("Screenshot downloaded", "success");
    });
  });

  describe("Copy to Clipboard", () => {
    it("writes PNG blob to navigator.clipboard and displays confirmation toast", async () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const writeClipboardMock = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).navigator.clipboard.write = writeClipboardMock;

      const toastSpy = vi.fn();
      const success = await copyChartScreenshotToClipboard(chartContainer, mockChartInstance, toastSpy);

      expect(success).toBe(true);
      expect(writeClipboardMock).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith("Chart image copied to clipboard", "success");
    });

    it("falls back to browser PNG download when navigator.clipboard.write throws", async () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 400;
      canvas.height = 300;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const writeClipboardMock = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
      (globalThis as any).navigator.clipboard.write = writeClipboardMock;

      const toastSpy = vi.fn();
      const success = await copyChartScreenshotToClipboard(
        chartContainer,
        mockChartInstance,
        toastSpy,
        "ETHUSDT",
        "5m"
      );

      expect(success).toBe(true);
      expect(toastSpy).toHaveBeenCalledWith("Screenshot downloaded", "success");
    });
  });

  describe("Interactive Marquee Portion Selection", () => {
    it("arms an overlay with crosshair cursor, draws selection box, and cancels on Escape", () => {
      const remove = armVelaPortionSelection(chartContainer, mockChartInstance, "ETHUSDT", "5m");

      const overlay = chartContainer.querySelector(".vela-portion-overlay");
      expect(overlay).toBeTruthy();
      expect(overlay?.querySelector(".vela-portion-hint")?.textContent).toContain("select portion");

      // Pointer down and drag
      const pDown = new (globalThis as any).PointerEvent("pointerdown", { clientX: 50, clientY: 50, button: 0 });
      overlay?.dispatchEvent(pDown);

      const box = overlay?.querySelector(".vela-portion-box");
      expect(box).toBeTruthy();

      const pMove = new (globalThis as any).PointerEvent("pointermove", { clientX: 150, clientY: 100 });
      overlay?.dispatchEvent(pMove);

      const dim = box?.querySelector(".vela-portion-dim");
      expect(dim?.textContent).toContain("px");

      // Press Escape to cancel
      mockDoc.dispatchEvent(new (globalThis as any).KeyboardEvent("keydown", { key: "Escape" }));
      expect(chartContainer.querySelector(".vela-portion-overlay")).toBeNull();
      remove();
    });

    it("crops portion when selection is dragged and released", () => {
      const canvas = mockDoc.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      mockChartInstance.renderer.screenshotCanvas.mockReturnValue(canvas);

      const writeClipboardMock = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).navigator.clipboard.write = writeClipboardMock;

      const toastSpy = vi.fn();
      armVelaPortionSelection(chartContainer, mockChartInstance, "SOLUSDT", "1h", toastSpy);

      const overlay = chartContainer.querySelector(".vela-portion-overlay")!;
      overlay.dispatchEvent(new (globalThis as any).PointerEvent("pointerdown", { clientX: 20, clientY: 20, button: 0 }));
      overlay.dispatchEvent(new (globalThis as any).PointerEvent("pointermove", { clientX: 120, clientY: 120 }));
      overlay.dispatchEvent(new (globalThis as any).PointerEvent("pointerup", { clientX: 120, clientY: 120 }));

      expect(chartContainer.querySelector(".vela-portion-overlay")).toBeNull();
    });
  });

  describe("Topbar Camera Button and Dropdown Menu Integration", () => {
    it("decorates existing camera button with official Vela attributes and toggles dropdown menu", () => {
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "vela-widget-screenshot";
      topbarContainer.appendChild(cameraBtn);

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      // Attributes check
      expect(cameraBtn.getAttribute("aria-label")).toBe("Screenshot");
      expect(cameraBtn.id).toBe("vela-action-screenshot");
      expect(cameraBtn.classList.contains("quant-chrome-hover-row")).toBe(true);

      // Trigger click opens menu
      cameraBtn.click();
      expect(controller.isOpen()).toBe(true);

      const menu = mockDoc.querySelector(".vela-menu");
      expect(menu).toBeTruthy();
      expect(menu?.getAttribute("role")).toBe("menu");
      expect(menu?.classList.contains("vela-screenshot-floating-menu")).toBe(true);

      const items = menu!.querySelectorAll(".vela-menu-item");
      expect(items).toHaveLength(3);
      expect(items[0]?.dataset.veiId).toBe("download");
      expect(items[0]?.textContent).toContain("Download screenshot");
      expect(items[1]?.dataset.veiId).toBe("copy");
      expect(items[1]?.textContent).toContain("Copy to clipboard");
      expect(items[2]?.dataset.veiId).toBe("portion");
      expect(items[2]?.textContent).toContain("Select portion");

      // Clicking again closes menu
      cameraBtn.click();
      expect(controller.isOpen()).toBe(false);
      expect(mockDoc.querySelector(".vela-menu")).toBeNull();

      controller.destroy();
    });

    it("closes menu on outside pointerdown", () => {
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "vela-widget-screenshot";
      topbarContainer.appendChild(cameraBtn);

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      controller.open();
      expect(controller.isOpen()).toBe(true);

      // Outside pointerdown
      mockDoc.dispatchEvent(new (globalThis as any).PointerEvent("pointerdown", { bubbles: true }));
      expect(controller.isOpen()).toBe(false);

      controller.destroy();
    });

    it("removes native title attribute from camera button on attachment", () => {
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "vela-widget-screenshot";
      cameraBtn.setAttribute("title", "Take a screenshot");
      topbarContainer.appendChild(cameraBtn);

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      expect(cameraBtn.getAttribute("title")).toBeNull();
      controller.destroy();
    });

    it("creates organic Bézier join (data-chrome-joined='below') with computeScreenshotJoinGeometry SVG path", () => {
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "vela-widget-screenshot";
      topbarContainer.appendChild(cameraBtn);

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      controller.open();

      const popup = mockDoc.querySelector(".vela-ui-layer[data-chrome-joined-layer='below']");
      expect(popup).toBeTruthy();

      const menu = mockDoc.querySelector(
        ".vela-screenshot-floating-menu[data-chrome-joined='below'][data-chrome-join-kind='bar']"
      );
      expect(menu).toBeTruthy();

      const join = popup?.querySelector(".quant-chrome-join[data-side='below']");
      expect(join).toBeTruthy();

      const unitGeom = computeScreenshotJoinGeometry(220, 124);
      expect(unitGeom.z).toBe(16);
      expect(unitGeom.M).toBe(252);
      expect(unitGeom.P).toBe(124);

      const menuRect = menu!.getBoundingClientRect();
      const expected = computeScreenshotJoinGeometry(menuRect.width, menuRect.height);
      const fillPath = join?.querySelector(".quant-chrome-join-fill");
      const edgePath = join?.querySelector(".quant-chrome-join-edge");
      expect(fillPath).toBeTruthy();
      expect(edgePath).toBeTruthy();
      expect(fillPath?.getAttribute("d")).toBe(`${expected.D} Z`);
      expect(edgePath?.getAttribute("d")).toBe(expected.D);
      expect(join?.style.left).toBe(`-${expected.z}px`);
      expect(join?.style.width).toBe(`${expected.M}px`);
      expect(join?.style.height).toBe(`${expected.P}px`);

      controller.destroy();
    });

    it("docks with 1px overlap (top: 38px when capRect.bottom = 39) and stays 100% invariant under page scroll", () => {
      const chromeRoot = mockDoc.createElement("div");
      chromeRoot.className = "quant-chart-chrome";
      chromeRoot.clientWidth = 900;
      mockDoc.body.appendChild(chromeRoot);
      chromeRoot.appendChild(topbarContainer);

      const sideRailCap = mockDoc.createElement("div");
      sideRailCap.className = "quant-side-rail-cap";
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "quant-side-rail-corner";
      cameraBtn.setAttribute("aria-label", "Screenshot");
      sideRailCap.appendChild(cameraBtn);
      chromeRoot.appendChild(sideRailCap);

      let scrollY = 0;
      chromeRoot.getBoundingClientRect = () => ({
        top: 100 + scrollY,
        left: 50,
        bottom: 700 + scrollY,
        right: 950,
        width: 900,
        height: 600,
        x: 50,
        y: 100 + scrollY,
        toJSON: () => {},
      });
      sideRailCap.getBoundingClientRect = () => ({
        top: 100 + scrollY,
        left: 898,
        bottom: 139 + scrollY,
        right: 950,
        width: 52,
        height: 39,
        x: 898,
        y: 100 + scrollY,
        toJSON: () => {},
      });
      cameraBtn.getBoundingClientRect = () => ({
        top: 103 + scrollY,
        left: 908,
        bottom: 135 + scrollY,
        right: 940,
        width: 32,
        height: 32,
        x: 908,
        y: 103 + scrollY,
        toJSON: () => {},
      });

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      controller.open();

      const popup = chromeRoot.querySelector(".vela-ui-layer[data-chrome-joined-layer='below']")!;
      expect(popup).toBeTruthy();
      expect(popup.style.top).toBe("38px");
      expect(popup.style.getPropertyValue("--chrome-layer-top")).toBe("38px");
      const initialLeft = popup.style.left;

      // Simulate scrolling page by -250px
      scrollY = -250;
      (globalThis as any).window.dispatchEvent({ type: "scroll" });

      expect(popup.style.top).toBe("38px");
      expect(popup.style.getPropertyValue("--chrome-layer-top")).toBe("38px");
      expect(popup.style.left).toBe(initialLeft);
      expect(popup.style.getPropertyValue("--chrome-layer-left")).toBe(initialLeft);

      controller.destroy();
      chromeRoot.remove();
    });

    it("renders menu item icons without inline box borders and includes borderless CSS override in VELA_SCREENSHOT_STYLES", () => {
      const cameraBtn = mockDoc.createElement("button");
      cameraBtn.className = "vela-widget-screenshot";
      topbarContainer.appendChild(cameraBtn);

      const controller = attachVelaScreenshotMenu({
        topbarContainer,
        chartContainer,
        getChartInstance: () => mockChartInstance,
        getSymbol: () => "BTCUSDT",
        getResolution: () => "1m",
      });

      controller.open();
      const menu = mockDoc.querySelector(".vela-screenshot-floating-menu")!;
      const icons = menu.querySelectorAll(".vela-icon");
      expect(icons.length).toBe(3);
      for (const icon of icons) {
        expect(icon.style.border).toBeFalsy();
        expect(icon.style.background).toBeFalsy();
      }

      expect(VELA_SCREENSHOT_STYLES).toContain(
        ".vela-screenshot-floating-menu .vela-menu-item > .vela-icon"
      );
      expect(VELA_SCREENSHOT_STYLES).toContain("border: none !important;");
      expect(VELA_SCREENSHOT_STYLES).toContain("background: transparent !important;");

      controller.destroy();
    });
  });

  describe("Official SVG Icons Fidelity", () => {
    it("exports all 4 canonical SVG icons", () => {
      expect(CAMERA_ICON_SVG).toContain("<svg");
      expect(CAMERA_ICON_SVG).toContain("circle cx=\"8\" cy=\"8.5\" r=\"2.6\"");
      expect(DOWNLOAD_ICON_SVG).toContain("<svg");
      expect(CLIPBOARD_ICON_SVG).toContain("<svg");
      expect(CROP_ICON_SVG).toContain("<svg");
    });
  });
});
