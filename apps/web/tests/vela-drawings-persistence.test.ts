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
  snapMode = "off";
  stayMode = false;

  drawings = {
    setFavorites: vi.fn((favs: string[]) => {
      this.favorites = [...favs];
    }),
    getFavorites: () => this.favorites,
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
}

describe("Vela Drawings & Preferences Persistence Bridge", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockLocalStorage();
    (globalThis as any).localStorage = mockStorage;
  });

  afterEach(() => {
    flushPendingTradeDrawingsSave();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("1. Hydration of favorites, tool modes, and drawings", () => {
    it("hydrates favorites, snap/stay modes, and trade drawings from localStorage without write-backs", () => {
      // Seed localStorage
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

      // Verify cached in localStorage
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
  });

  describe("2. Auto-persistence on mutations, undo/redo, and pure selection ignoring", () => {
    it("persists to localStorage synchronously and debounces remote PATCH on drawing:created", async () => {
      const chart = new MockVelaChart();
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      const cleanup = attachVelaDrawingsPersistence(chart, "trade-create-test", {
        fetchImpl: mockFetch as any,
        debounceMs: 350,
      });

      // Add a drawing
      chart.drawingsDoc.drawings.push({ id: "d-new-1", type: "Brush" });
      chart.emit("drawing:created", { drawing: { id: "d-new-1" } });

      // Synchronous localStorage write
      const savedRaw = localStorage.getItem(VELA_TRADE_DRAWINGS_PREFIX + "trade-create-test");
      expect(savedRaw).not.toBeNull();
      const savedDoc = JSON.parse(savedRaw!);
      expect(savedDoc.drawings).toEqual([{ id: "d-new-1", type: "Brush" }]);

      // Debounce verification: not called immediately
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance by 300ms: still not called
      vi.advanceTimersByTime(300);
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance by 60ms (total 360ms > 350ms): called once
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

      // User selects the drawing without modifying anything
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

      // Step 1: User adds a drawing
      chart.drawingsDoc.drawings.push({ id: "d-1", type: "Arrow" });
      chart.emit("drawing:created");

      vi.advanceTimersByTime(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Step 2: User triggers undo() in @luxalgo/vela:
      // The store reverts to 0 drawings and emits drawing:selected!
      chart.drawingsDoc.drawings = [];
      chart.emit("drawing:selected", { id: null });

      // Synchronously saved empty drawings to localStorage
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

      // Mutation via store
      chart.drawingsDoc.drawings.push({ id: "d-store-1", type: "Rectangle" });
      chart.triggerStoreChange();

      vi.advanceTimersByTime(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  describe("3. Isolation between trades and flushing pending saves on cleanup", () => {
    it("isolates drawings between two trades of the same symbol and flushes on cleanup", () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true })));

      // Trade A on MES
      const tradeKeyA = "acc-1:MES:2026-03-01:1";
      const chartA = new MockVelaChart();
      const cleanupA = attachVelaDrawingsPersistence(chartA, tradeKeyA, {
        fetchImpl: mockFetch as any,
        debounceMs: 500,
      });

      // User draws on Trade A
      chartA.drawingsDoc.drawings.push({ id: "a-draw-1", type: "Trend Line" });
      chartA.emit("drawing:created");

      // Before timer expires, switch to Trade B (cleanup Trade A)
      cleanupA();

      // Flush must immediately fire remote sync for Trade A
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

      // Now mount Trade B on same symbol MES
      const tradeKeyB = "acc-1:MES:2026-03-02:2";
      const chartB = new MockVelaChart();
      const cleanupB = attachVelaDrawingsPersistence(chartB, tradeKeyB, {
        fetchImpl: mockFetch as any,
      });

      // Trade B must NOT have Trade A's drawings!
      expect(chartB.drawings.fromJSON).toHaveBeenCalledWith({
        version: 1,
        drawings: [],
      });

      // Trade A's drawings in localStorage remain separate
      const storedA = loadTradeDrawings(tradeKeyA);
      expect(storedA?.drawings).toEqual([{ id: "a-draw-1", type: "Trend Line" }]);

      const storedB = loadTradeDrawings(tradeKeyB);
      expect(storedB).toBeNull();

      cleanupB();
    });
  });

  describe("4. Persistence of favorites, snap mode, and stay mode events", () => {
    it("persists drawing:favorites events to localStorage", () => {
      const chart = new MockVelaChart();
      const cleanup = attachVelaDrawingsPersistence(chart, "trade-favs");

      chart.emit("drawing:favorites", { favorites: ["Rectangle", "Callout", "Price Note"] });
      expect(loadDrawingFavorites()).toEqual(["Rectangle", "Callout", "Price Note"]);

      cleanup();
    });

    it("persists drawing:snap and drawing:stay events to localStorage", () => {
      const chart = new MockVelaChart();
      const cleanup = attachVelaDrawingsPersistence(chart, "trade-prefs");

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
});
