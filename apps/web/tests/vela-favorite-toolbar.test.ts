import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  attachVelaFavoriteToolbar,
  enhanceVelaDrawingToolbar,
  enhanceVelaFloatingToolbarGrip,
  FAV_TOOLBAR_POS_STORAGE_KEY,
  GRIP_SIX_DOTS_SVG,
  DEFAULT_TOOL_META,
  resolveToolMeta,
} from "../src/components/vela-drawing-enhancer";

class MockStyle {
  private props = new Map<string, string>();
  left = "";
  top = "";
  position = "";
  width = "";
  height = "";

  setProperty(name: string, value: string) {
    this.props.set(name, value);
    if (name === "left") this.left = value;
    if (name === "top") this.top = value;
    if (name === "position") this.position = value;
    if (name === "width") this.width = value;
    if (name === "height") this.height = value;
  }

  getPropertyValue(name: string): string {
    return this.props.get(name) ?? "";
  }

  removeProperty(name: string) {
    this.props.delete(name);
    if (name === "left") this.left = "";
    if (name === "top") this.top = "";
    if (name === "position") this.position = "";
  }
}

class MockElement {
  tagName: string;
  className = "";
  id = "";
  type = "";
  hidden = false;
  innerHTML = "";
  textContent = "";
  style = new MockStyle();
  attributes = new Map<string, string>();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  ownerDocument: MockDocument | null = null;
  listeners = new Map<string, Set<Function>>();
  offsetWidth = 120;
  offsetHeight = 38;

  private rectFn: () => { left: number; top: number; width: number; height: number } = () => ({
    left: 0,
    top: 0,
    width: this.offsetWidth,
    height: this.offsetHeight,
  });

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    if (this.tagName === "BUTTON") {
      this.offsetWidth = 30;
      this.offsetHeight = 30;
    }
  }

  setRectFn(fn: () => { left: number; top: number; width: number; height: number }) {
    this.rectFn = fn;
  }

  getBoundingClientRect() {
    const r = this.rectFn();
    return {
      x: r.left,
      y: r.top,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
      toJSON: () => ({}),
    };
  }

  get isConnected(): boolean {
    let cur: MockElement | null = this;
    while (cur) {
      if (cur.tagName === "BODY" || cur.parentElement) {
        if (cur.tagName === "BODY") return true;
        cur = cur.parentElement;
      } else {
        return false;
      }
    }
    return false;
  }

  get classList() {
    return {
      contains: (c: string) => this.className.split(/\s+/).includes(c),
      add: (...cls: string[]) => {
        const s = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => s.add(c));
        this.className = Array.from(s).join(" ");
      },
      remove: (...cls: string[]) => {
        const s = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => s.delete(c));
        this.className = Array.from(s).join(" ");
      },
    };
  }

  get dataset(): Record<string, string> {
    const ds: Record<string, string> = {};
    for (const [k, v] of this.attributes.entries()) {
      if (k.startsWith("data-")) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        ds[camel] = v;
      }
    }
    return new Proxy(ds, {
      set: (_target, prop: string, val: any) => {
        const kebab = "data-" + prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        this.setAttribute(kebab, String(val));
        return true;
      },
      get: (_target, prop: string) => {
        const kebab = "data-" + prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        return this.getAttribute(kebab) ?? undefined;
      },
    });
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val));
    if (name === "id") this.id = String(val);
    if (name === "class") this.className = String(val);
    if (name === "type") this.type = String(val);
  }

  getAttribute(name: string): string | null {
    if (name === "id" && this.id) return this.id;
    if (name === "class" && this.className) return this.className;
    if (name === "type" && this.type) return this.type;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  matchesToken(token: string): boolean {
    if (!token) return false;
    const attrMatch = token.match(/^\[([a-zA-Z0-9_-]+)(?:=['"]?([^'"]*)['"]?)?\]$/);
    if (attrMatch) {
      const attrName = attrMatch[1]!;
      const expectedVal = attrMatch[2];
      if (expectedVal === undefined) {
        return this.hasAttribute(attrName);
      }
      return this.getAttribute(attrName) === expectedVal;
    }
    if (token.startsWith(".")) return this.classList.contains(token.slice(1));
    if (token.startsWith("#")) return this.id === token.slice(1);
    return this.tagName === token.toUpperCase();
  }

  matches(sel: string): boolean {
    return sel.split(",").some((part) => this.matchesToken(part.trim()));
  }

  closest(sel: string): MockElement | null {
    let cur: MockElement | null = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  append(...children: MockElement[]) {
    for (const c of children) {
      this.appendChild(c);
    }
  }

  replaceChildren(...newChildren: MockElement[]) {
    this.children.forEach((c) => (c.parentElement = null));
    this.children = [];
    this.append(...newChildren);
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
  }

  removeChild(child: MockElement) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
    return child;
  }

  querySelector(sel: string): MockElement | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const results: MockElement[] = [];
    const testMatch = (el: MockElement): boolean => {
      const parts = sel.trim().split(/\s+/).filter(Boolean);
      const targetToken = parts[parts.length - 1] ?? "";
      return el.matchesToken(targetToken);
    };

    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (testMatch(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(ev: { type: string; [k: string]: any }) {
    const eventWithTarget = { target: this, preventDefault: () => {}, stopPropagation: () => {}, ...ev };
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) fn(eventWithTarget);
    }
  }

  setPointerCapture(_id: number) {}
  releasePointerCapture(_id: number) {}
}

class MockWindow {
  listeners = new Map<string, Set<Function>>();

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(ev: { type: string; [k: string]: any }) {
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) fn(ev);
    }
  }
}

class MockDocument {
  body: MockElement;
  head: MockElement;
  defaultView: MockWindow;

  constructor() {
    this.defaultView = new MockWindow();
    this.body = new MockElement("body");
    this.head = new MockElement("head");
    this.body.ownerDocument = this;
    this.head.ownerDocument = this;
  }

  createElement(tag: string): MockElement {
    const el = new MockElement(tag);
    el.ownerDocument = this;
    return el;
  }

  getElementById(_id: string): MockElement | null {
    return null;
  }
}

function createMockChartInstance(initialFavorites: string[] = []) {
  let favs = [...initialFavorites];
  let activeTool: string | null = null;
  const listeners = new Map<string, Set<Function>>();

  return {
    drawings: {
      favorites: vi.fn(() => favs),
      getTool: vi.fn(() => activeTool),
      setTool: vi.fn((tool: string | null) => {
        activeTool = tool;
        const set = listeners.get("drawing:tool");
        if (set) {
          for (const fn of Array.from(set)) fn({ type: activeTool });
        }
      }),
      setFavorites: vi.fn((newFavs: string[]) => {
        favs = [...newFavs];
        const set = listeners.get("drawing:favorites");
        if (set) {
          for (const fn of Array.from(set)) fn({ favorites: favs });
        }
      }),
    },
    on: vi.fn((evt: string, fn: Function) => {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt)!.add(fn);
      return () => {
        listeners.get(evt)?.delete(fn);
      };
    }),
    emit: (evt: string, data: any) => {
      const set = listeners.get(evt);
      if (set) {
        for (const fn of Array.from(set)) fn(data);
      }
    },
    listenerCount: (evt: string) => listeners.get(evt)?.size ?? 0,
  };
}

describe("Floating Favorite Drawing Tools Toolbar", () => {
  let doc: MockDocument;
  let hostEl: MockElement;
  const storageMap = new Map<string, string>();
  const origLocalStorage = (globalThis as any).localStorage;
  const origHTMLElement = (globalThis as any).HTMLElement;
  const origResizeObserver = (globalThis as any).ResizeObserver;
  const origMutationObserver = (globalThis as any).MutationObserver;

  beforeEach(() => {
    storageMap.clear();
    const mockStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, String(v)),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

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
      takeRecords() { return []; }
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
    Object.defineProperty(globalThis, "localStorage", {
      value: origLocalStorage,
      writable: true,
      configurable: true,
    });
    (globalThis as any).HTMLElement = origHTMLElement;
    (globalThis as any).ResizeObserver = origResizeObserver;
    (globalThis as any).MutationObserver = origMutationObserver;
  });

  it("1. Toolbar stays hidden (hidden = true, data-empty='1') when favorites() is empty, and immediately appears when drawing:favorites emits ['trendline', 'box', 'fibretracement']", () => {
    const chart = createMockChartInstance([]);
    const cleanup = attachVelaFavoriteToolbar(chart, hostEl as any);

    const toolbar = hostEl.querySelector(".vela-fav-toolbar");
    expect(toolbar).not.toBeNull();
    expect(toolbar!.hidden).toBe(true);
    expect(toolbar!.getAttribute("data-empty")).toBe("1");
    expect(toolbar!.querySelectorAll(".vela-fav-toolbar-btn").length).toBe(0);

    // External favorites event fires with 3 tools
    chart.emit("drawing:favorites", { favorites: ["trendline", "box", "fibretracement"] });

    expect(toolbar!.hidden).toBe(false);
    expect(toolbar!.hasAttribute("data-empty")).toBe(false);

    const buttons = toolbar!.querySelectorAll(".vela-fav-toolbar-btn");
    expect(buttons.length).toBe(3);
    expect(buttons[0]!.getAttribute("data-tool")).toBe("trendline");
    expect(buttons[0]!.getAttribute("aria-label")).toBe("Trend Line");
    expect(buttons[1]!.getAttribute("data-tool")).toBe("box");
    expect(buttons[1]!.getAttribute("aria-label")).toBe("Rectangle");
    expect(buttons[2]!.getAttribute("data-tool")).toBe("fibretracement");
    expect(buttons[2]!.getAttribute("aria-label")).toBe("Fib Retracement");

    // Star grip contains the 6-dot svg
    const grip = toolbar!.querySelector(".vela-fav-toolbar-grip");
    expect(grip).not.toBeNull();
    expect(grip!.innerHTML).toBe(GRIP_SIX_DOTS_SVG);

    cleanup();
  });

  it("2. Clicking a tool button calls instance.drawings.setTool('trendline'), sets data-active='1', and clicking it again when already active toggles back to setTool(null)", () => {
    const chart = createMockChartInstance(["trendline", "box"]);
    const cleanup = attachVelaFavoriteToolbar(chart, hostEl as any);

    const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
    expect(toolbar).not.toBeNull();
    expect(toolbar.hidden).toBe(false);

    const trendBtn = toolbar.querySelector("[data-tool='trendline']")!;
    expect(trendBtn).not.toBeNull();
    expect(trendBtn.getAttribute("data-active")).toBe("0");
    expect(trendBtn.getAttribute("aria-pressed")).toBe("false");

    // Click to activate trendline
    trendBtn.dispatchEvent({ type: "click" });

    expect(chart.drawings.setTool).toHaveBeenCalledWith("trendline");
    expect(trendBtn.getAttribute("data-active")).toBe("1");
    expect(trendBtn.getAttribute("aria-pressed")).toBe("true");

    // Click again to deactivate (toggle to null)
    trendBtn.dispatchEvent({ type: "click" });

    expect(chart.drawings.setTool).toHaveBeenCalledWith(null);
    expect(trendBtn.getAttribute("data-active")).toBe("0");
    expect(trendBtn.getAttribute("aria-pressed")).toBe("false");

    cleanup();
  });

  it("3. External drawing:tool events update data-active='1' and aria-pressed='true' on the matching button", () => {
    const chart = createMockChartInstance(["trendline", "box", "fibretracement"]);
    const cleanup = attachVelaFavoriteToolbar(chart, hostEl as any);

    const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
    const trendBtn = toolbar.querySelector("[data-tool='trendline']")!;
    const boxBtn = toolbar.querySelector("[data-tool='box']")!;
    const fibBtn = toolbar.querySelector("[data-tool='fibretracement']")!;

    expect(trendBtn.getAttribute("data-active")).toBe("0");
    expect(boxBtn.getAttribute("data-active")).toBe("0");
    expect(fibBtn.getAttribute("data-active")).toBe("0");

    // External tool activation
    chart.emit("drawing:tool", { type: "box" });

    expect(boxBtn.getAttribute("data-active")).toBe("1");
    expect(boxBtn.getAttribute("aria-pressed")).toBe("true");
    expect(trendBtn.getAttribute("data-active")).toBe("0");
    expect(trendBtn.getAttribute("aria-pressed")).toBe("false");
    expect(fibBtn.getAttribute("data-active")).toBe("0");
    expect(fibBtn.getAttribute("aria-pressed")).toBe("false");

    // Switch tool externally
    chart.emit("drawing:tool", { type: "fibretracement" });

    expect(fibBtn.getAttribute("data-active")).toBe("1");
    expect(fibBtn.getAttribute("aria-pressed")).toBe("true");
    expect(boxBtn.getAttribute("data-active")).toBe("0");
    expect(boxBtn.getAttribute("aria-pressed")).toBe("false");

    // Clear tool externally
    chart.emit("drawing:tool", { type: null });

    expect(fibBtn.getAttribute("data-active")).toBe("0");
    expect(fibBtn.getAttribute("aria-pressed")).toBe("false");

    cleanup();
  });

  it("4. Dragging .vela-fav-toolbar-grip via pointerdown -> pointermove -> pointerup updates toolbar.style.left/top (clamped to host bounds) and persists { x, y } in localStorage under FAV_TOOLBAR_POS_STORAGE_KEY, which is restored on next mount", () => {
    const chart = createMockChartInstance(["trendline"]);
    const cleanup1 = attachVelaFavoriteToolbar(chart, hostEl as any);

    const toolbar1 = hostEl.querySelector(".vela-fav-toolbar")!;
    const grip = toolbar1.querySelector(".vela-fav-toolbar-grip")!;

    // Initial default position is 68px, 12px
    expect(toolbar1.style.left).toBe("68px");
    expect(toolbar1.style.top).toBe("12px");

    // Start drag at (68, 12)
    grip.dispatchEvent({ type: "pointerdown", button: 0, clientX: 68, clientY: 12, pointerId: 1 });
    expect(toolbar1.getAttribute("data-dragging")).toBe("1");

    // Drag move to (+150, +90) -> (218, 102)
    doc.defaultView.dispatchEvent({ type: "pointermove", clientX: 218, clientY: 102, pointerId: 1 });
    expect(toolbar1.style.left).toBe("218px");
    expect(toolbar1.style.top).toBe("102px");

    // Drag move with clamp test: try to drag beyond left/top limits (-200, -200)
    doc.defaultView.dispatchEvent({ type: "pointermove", clientX: -200, clientY: -200, pointerId: 1 });
    // Clamped to minX = 58, minY = 8
    expect(toolbar1.style.left).toBe("58px");
    expect(toolbar1.style.top).toBe("8px");

    // Move to desirable coordinate (250, 80) and release pointer
    doc.defaultView.dispatchEvent({ type: "pointermove", clientX: 250, clientY: 80, pointerId: 1 });
    doc.defaultView.dispatchEvent({ type: "pointerup", pointerId: 1 });

    expect(toolbar1.hasAttribute("data-dragging")).toBe(false);
    expect(storageMap.get(FAV_TOOLBAR_POS_STORAGE_KEY)).toBe(JSON.stringify({ x: 250, y: 80 }));

    // Unmount toolbar
    cleanup1();
    expect(hostEl.querySelector(".vela-fav-toolbar")).toBeNull();

    // Mount fresh instance and verify restored position
    const cleanup2 = attachVelaFavoriteToolbar(chart, hostEl as any);
    const toolbar2 = hostEl.querySelector(".vela-fav-toolbar")!;
    expect(toolbar2.style.left).toBe("250px");
    expect(toolbar2.style.top).toBe("80px");

    cleanup2();
  });

  it("5. Cleanup function removes the toolbar DOM and unsubscribes all listeners", () => {
    const chart = createMockChartInstance(["trendline", "box"]);
    const cleanup = attachVelaFavoriteToolbar(chart, hostEl as any);

    expect(hostEl.querySelector(".vela-fav-toolbar")).not.toBeNull();
    expect(chart.listenerCount("drawing:favorites")).toBe(1);
    expect(chart.listenerCount("drawing:tool")).toBe(1);

    cleanup();

    expect(hostEl.querySelector(".vela-fav-toolbar")).toBeNull();
    expect(chart.listenerCount("drawing:favorites")).toBe(0);
    expect(chart.listenerCount("drawing:tool")).toBe(0);
  });

  it("6. Custom resolveToolMeta and onFavoritesChange callbacks are respected", () => {
    const onFavChange = vi.fn();
    const customResolver = vi.fn((type: string) => {
      if (type === "custom_fib") {
        return { label: "Custom Fib", icon: "<svg class='custom-icon'></svg>" };
      }
      return undefined;
    });

    const chart = createMockChartInstance([]);
    const cleanup = attachVelaFavoriteToolbar(chart, hostEl as any, {
      resolveToolMeta: customResolver,
      onFavoritesChange: onFavChange,
    });

    chart.emit("drawing:favorites", { favorites: ["custom_fib"] });

    expect(onFavChange).toHaveBeenCalledWith(["custom_fib"]);
    expect(customResolver).toHaveBeenCalledWith("custom_fib");

    const toolbar = hostEl.querySelector(".vela-fav-toolbar")!;
    const btn = toolbar.querySelector("[data-tool='custom_fib']")!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Custom Fib");
    expect(btn.innerHTML).toBe("<svg class='custom-icon'></svg>");

    cleanup();
  });

  describe("Native Floating Toolbar (.vela-dpop) Grip & Aesthetic Upgrade", () => {
    it("7. enhanceVelaFloatingToolbarGrip replaces native grip innerHTML with GRIP_SIX_DOTS_SVG (containing 6 circle elements) and sets data-grip-enhanced='1' idempotently", () => {
      const nativeToolbar = doc.createElement("div");
      nativeToolbar.className = "vela-dpop";

      const nativeGrip = doc.createElement("button");
      nativeGrip.className = "vela-dpop-grip";
      nativeGrip.innerHTML = '<span class="old-native-dots">::</span>';
      nativeToolbar.appendChild(nativeGrip);
      hostEl.appendChild(nativeToolbar);

      expect(nativeGrip.getAttribute("data-grip-enhanced")).toBeNull();
      expect(nativeGrip.innerHTML).toContain("old-native-dots");

      // 1. First enhance call
      enhanceVelaFloatingToolbarGrip(hostEl as any);

      expect(nativeGrip.getAttribute("data-grip-enhanced")).toBe("1");
      expect(nativeGrip.dataset.gripEnhanced).toBe("1");
      expect(nativeGrip.innerHTML).toBe(GRIP_SIX_DOTS_SVG);

      // Verify 6 circle elements
      const circles = nativeGrip.innerHTML.match(/<circle\b/g);
      expect(circles).not.toBeNull();
      expect(circles!.length).toBe(6);

      // 2. Idempotency: second enhance call does not alter or re-replace
      nativeGrip.innerHTML = "<svg>modified-to-test-idempotency</svg>";
      enhanceVelaFloatingToolbarGrip(hostEl as any);
      expect(nativeGrip.innerHTML).toBe("<svg>modified-to-test-idempotency</svg>");
      expect(nativeGrip.getAttribute("data-grip-enhanced")).toBe("1");
    });

    it("8. Preserves existing pointerdown event listeners on native grip button without removing or cloning the node", () => {
      const nativeToolbar = doc.createElement("div");
      nativeToolbar.className = "vela-dpop";

      const nativeGrip = doc.createElement("button");
      nativeGrip.className = "vela-dpop-grip";
      nativeGrip.innerHTML = '<span class="old-grip">...</span>';
      nativeToolbar.appendChild(nativeGrip);
      hostEl.appendChild(nativeToolbar);

      const nativePointerDownHandler = vi.fn();
      nativeGrip.addEventListener("pointerdown", nativePointerDownHandler);

      enhanceVelaFloatingToolbarGrip(hostEl as any);

      // Dispatch pointerdown event
      nativeGrip.dispatchEvent({
        type: "pointerdown",
        button: 0,
        clientX: 150,
        clientY: 250,
        pointerId: 1,
      });

      expect(nativePointerDownHandler).toHaveBeenCalledTimes(1);
      expect(nativeGrip.innerHTML).toBe(GRIP_SIX_DOTS_SVG);
    });

    it("9. Verifies globals.css defines rules for .vela-dpop:not(.vela-fav-toolbar) and .vela-dpop-grip", () => {
      const cssPath = path.resolve(__dirname, "../src/app/globals.css");
      const css = fs.readFileSync(cssPath, "utf-8");

      // Verify container "push" / pill aesthetic rule
      expect(css).toContain(".vela-dpop:not(.vela-fav-toolbar)");
      expect(css).toMatch(
        /\.vela-dpop:not\(\.vela-fav-toolbar\)\s*\{[^}]*background:\s*var\(--vela-bg,\s*#151619\)\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop:not\(\.vela-fav-toolbar\)\s*\{[^}]*border:\s*1px solid var\(--vela-border,\s*#2a2b30\)\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop:not\(\.vela-fav-toolbar\)\s*\{[^}]*border-radius:\s*var\(--vela-radius-lg,\s*10px\)\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop:not\(\.vela-fav-toolbar\)\s*\{[^}]*box-shadow:\s*var\(--vela-shadow,\s*0 8px 30px rgba\(0,\s*0,\s*0,\s*0\.5\)\)\s*!important/,
      );

      // Verify grip rules
      expect(css).toContain(".vela-dpop-grip");
      expect(css).toMatch(/\.vela-dpop-grip\s*\{[^}]*width:\s*26px\s*!important/);
      expect(css).toMatch(/\.vela-dpop-grip\s*\{[^}]*cursor:\s*grab\s*!important/);
      expect(css).toMatch(/\.vela-dpop-grip\s*\{[^}]*touch-action:\s*none\s*!important/);
      expect(css).toMatch(
        /\.vela-dpop-grip:hover\s*\{[^}]*color:\s*var\(--vela-fg-bright,\s*#ffffff\)\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop-grip:active\s*\{[^}]*cursor:\s*grabbing\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop-grip svg\s*\{[^}]*width:\s*18px\s*!important/,
      );
      expect(css).toMatch(
        /\.vela-dpop-grip svg\s*\{[^}]*pointer-events:\s*none\s*!important/,
      );
    });

    it("10. enhanceVelaFloatingToolbarGrip works when root element is the grip itself", () => {
      const grip = doc.createElement("button");
      grip.className = "vela-dpop-grip";
      grip.innerHTML = "<svg>native</svg>";

      enhanceVelaFloatingToolbarGrip(grip as any);

      expect(grip.getAttribute("data-grip-enhanced")).toBe("1");
      expect(grip.innerHTML).toBe(GRIP_SIX_DOTS_SVG);
    });

    it("11. enhanceVelaDrawingToolbar automatically enhances grips in container and doc.body on mount", () => {
      const nativeToolbar = doc.createElement("div");
      nativeToolbar.className = "vela-dpop";
      const nativeGrip = doc.createElement("button");
      nativeGrip.className = "vela-dpop-grip";
      nativeGrip.innerHTML = "<svg>old-body-grip</svg>";
      nativeToolbar.appendChild(nativeGrip);
      doc.body.appendChild(nativeToolbar);

      const cleanup = enhanceVelaDrawingToolbar(hostEl as any);

      expect(nativeGrip.getAttribute("data-grip-enhanced")).toBe("1");
      expect(nativeGrip.innerHTML).toBe(GRIP_SIX_DOTS_SVG);

      cleanup();
    });
  });
});
