import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
} from "../src/components/vela-drawings-bridge";
import {
  attachVelaFavoriteToolbar,
  enhanceVelaFloatingToolbarGrip,
  FAV_TOOLBAR_POS_STORAGE_KEY,
  GRIP_SIX_DOTS_SVG,
  DEFAULT_TOOL_META,
  resolveToolMeta,
} from "../src/components/vela-drawing-enhancer";
import { syncVelaToolbarGutter } from "../src/components/trade-market-data";
import { MockElement, MockDocument } from "./helpers/dom-mock";

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
});
