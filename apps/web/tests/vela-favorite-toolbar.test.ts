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

import { MockElement, MockDocument, MockWindow, MockStyle } from "./helpers/dom-mock";

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
