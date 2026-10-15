import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  PERSONAL_SCRIPTS_STORAGE_KEY,
  DEFAULT_REPLAY_WORKSPACE,
  loadReplayWorkspace,
  saveReplayWorkspace,
  loadIndicatorTemplates,
  saveIndicatorTemplate,
  deleteIndicatorTemplate,
  loadFavoriteIndicatorIds,
  loadPersonalPineScripts,
  resolveFavoriteIndicatorItems,
} from "../../src/lib/replay/workspace-persistence";
import { GET, POST, PATCH, DELETE } from "../../src/app/api/workspace/[resource]/route";

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

describe("Replay Workspace & Favorites Persistence Engine", () => {
  let mockStorage: MockLocalStorage;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  describe("loadReplayWorkspace & saveReplayWorkspace", () => {
    it("returns safe default workspace when localStorage is empty", () => {
      const ws = loadReplayWorkspace();
      expect(ws).toEqual(DEFAULT_REPLAY_WORKSPACE);
      expect(ws.cells[0]).toEqual({ symbol: "MES", resolution: "1m", indicators: [] });
      expect(ws.layout).toEqual({ rows: 1, cols: 1 });
      expect(ws.syncOptions.crosshair).toBe(true);
    });

    it("recovers gracefully from corrupted JSON or invalid payloads in localStorage", () => {
      mockStorage.setItem(STORAGE_KEY, "{not-valid-json");
      expect(loadReplayWorkspace()).toEqual(DEFAULT_REPLAY_WORKSPACE);

      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          layout: { rows: -5, cols: 99 },
          activeCellIndex: 42,
          cells: { 0: { symbol: "  mnq ", resolution: "invalid_tf" } },
          paperBottomHeight: -10,
        }),
      );
      const sanitized = loadReplayWorkspace();
      expect(sanitized.layout).toEqual({ rows: 1, cols: 4 });
      expect(sanitized.activeCellIndex).toBe(0);
      expect(sanitized.cells[0]).toEqual({ symbol: "MNQ", resolution: "1m" });
      expect(sanitized.paperBottomHeight).toBe(39);
    });

    it("persists and restores multi-chart workspace state (MNQ in Pane 1 + MES in Pane 2, layout, syncOptions, panels)", () => {
      const saved = saveReplayWorkspace({
        layout: { rows: 1, cols: 2 },
        syncOptions: {
          symbol: false,
          interval: true,
          crosshair: true,
          time: true,
          dateRange: false,
          style: true,
        },
        activeCellIndex: 1,
        cells: {
          0: { symbol: "MNQ", resolution: "1m", indicators: ["native:volume", "native:ema"] },
          1: { symbol: "MES", resolution: "5m", indicators: ["native:sma"] },
        },
        activeIndicatorSlugs: ["native:volume", "native:ema"],
        isPaperBottomOpen: true,
        paperBottomHeight: 240,
        isOrderTicketOpen: true,
        isDomOpen: false,
      });

      expect(saved.layout).toEqual({ rows: 1, cols: 2 });
      expect(saved.activeCellIndex).toBe(1);
      expect(saved.cells[0]).toEqual({
        symbol: "MNQ",
        resolution: "1m",
        indicators: ["native:volume", "native:ema"],
      });
      expect(saved.cells[1]).toEqual({
        symbol: "MES",
        resolution: "5m",
        indicators: ["native:sma"],
      });

      // Reload from localStorage and verify full fidelity
      const reloaded = loadReplayWorkspace();
      expect(reloaded).toEqual(saved);

      // Partial update preserves existing cells and settings
      const afterPartial = saveReplayWorkspace({
        isDomOpen: true,
      });
      expect(afterPartial.isDomOpen).toBe(true);
      expect(afterPartial.cells[0]?.symbol).toBe("MNQ");
      expect(afterPartial.cells[1]?.symbol).toBe("MES");
      expect(afterPartial.layout).toEqual({ rows: 1, cols: 2 });
    });

    it("clamps activeCellIndex when layout shrinks to fewer cells", () => {
      saveReplayWorkspace({
        layout: { rows: 2, cols: 2 },
        activeCellIndex: 3,
        cells: {
          0: { symbol: "MNQ", resolution: "1m" },
          1: { symbol: "MES", resolution: "5m" },
          2: { symbol: "NQ", resolution: "15m" },
          3: { symbol: "ES", resolution: "1h" },
        },
      });
      expect(loadReplayWorkspace().activeCellIndex).toBe(3);

      const shrunk = saveReplayWorkspace({
        layout: { rows: 1, cols: 1 },
      });
      expect(shrunk.activeCellIndex).toBe(0);
      // Secondary cells remain stored so re-expanding layout remembers symbols
      expect(shrunk.cells[1]?.symbol).toBe("MES");
    });
  });

  describe("Indicator Templates Persistence", () => {
    it("loads default template when uninitialized and allows saving, updating, and deleting templates", () => {
      const initial = loadIndicatorTemplates();
      expect(initial.length).toBeGreaterThanOrEqual(1);
      expect(initial[0]?.name).toBe("Volume + EMA Cross");

      const afterAdd = saveIndicatorTemplate("ICT Scalping Setup", [
        "native:volume",
        "native:vwap",
        "builtin:fvg-detector",
        "native:vwap", // duplicate should be stripped
      ]);
      expect(afterAdd).toHaveLength(2);
      const added = afterAdd.find((t) => t.name === "ICT Scalping Setup");
      expect(added).toBeDefined();
      expect(added?.indicators).toEqual([
        "native:volume",
        "native:vwap",
        "builtin:fvg-detector",
      ]);

      // Updating existing template by case-insensitive name updates in place
      const afterUpdate = saveIndicatorTemplate("ict scalping setup", ["native:ema"]);
      expect(afterUpdate).toHaveLength(2);
      expect(afterUpdate.find((t) => t.id === added!.id)?.indicators).toEqual(["native:ema"]);

      // Delete all templates and verify empty array is respected
      for (const tpl of afterUpdate) {
        deleteIndicatorTemplate(tpl.id);
      }
      expect(loadIndicatorTemplates()).toEqual([]);
    });
  });

  describe("Favorite Indicators & Personal Scripts Resolution", () => {
    it("resolves native, builtin, slug-prefixed, and personal favorite indicator IDs accurately", () => {
      const builtinCatalog = [
        { id: "native:ema", type: "ema", name: "Exponential Moving Average" },
        { slug: "sma-001", name: "Simple Moving Average" },
        {
          id: "builtin:trend-regularity-adaptive-moving-average",
          slug: "trend-regularity-adaptive-moving-average",
          name: "TRAMA",
        },
      ];
      const personalScripts = [
        {
          id: "script-42",
          name: "Custom Session VWAP",
          code: "//@version=6\nindicator('Custom Session VWAP', overlay=true)",
        },
      ];

      const resolved = resolveFavoriteIndicatorItems(
        [
          "native:volume",
          "slug:native:ema",
          "builtin:sma-001",
          "slug:trend-regularity-adaptive-moving-average",
          "personal:script-42",
          "slug:personal:script-42", // duplicate should be ignored
          "slug:bollinger-bands-pro", // uncataloged fallback humanization
        ],
        builtinCatalog,
        personalScripts,
      );

      expect(resolved).toEqual([
        {
          id: "native:volume",
          kind: "native",
          targetId: "volume",
          label: "Volume",
        },
        {
          id: "native:ema",
          kind: "native",
          targetId: "ema",
          label: "Exponential Moving Average",
        },
        {
          id: "builtin:sma-001",
          kind: "builtin",
          targetId: "sma-001",
          label: "Simple Moving Average",
        },
        {
          id: "slug:trend-regularity-adaptive-moving-average",
          kind: "builtin",
          targetId: "trend-regularity-adaptive-moving-average",
          label: "TRAMA",
        },
        {
          id: "personal:script-42",
          kind: "personal",
          targetId: "script-42",
          label: "Custom Session VWAP",
          code: "//@version=6\nindicator('Custom Session VWAP', overlay=true)",
        },
        {
          id: "slug:bollinger-bands-pro",
          kind: "builtin",
          targetId: "bollinger-bands-pro",
          label: "Bollinger Bands Pro",
        },
      ]);
    });

    it("loads stored favorite indicator IDs and personal Pine scripts from localStorage", () => {
      mockStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(["native:volume", "builtin:sma-001"]),
      );
      mockStorage.setItem(
        PERSONAL_SCRIPTS_STORAGE_KEY,
        JSON.stringify([{ id: "p1", title: "My Alpha Script", code: "plot(close)" }]),
      );

      expect(loadFavoriteIndicatorIds()).toEqual(["native:volume", "builtin:sma-001"]);
      expect(loadPersonalPineScripts()).toEqual([
        { id: "p1", name: "My Alpha Script", code: "plot(close)" },
      ]);
    });
  });

  describe("Clean Live Mode & Replay Gate Contracts", () => {
    it("guarantees default workspace initializes in clean Live mode without forced replay active", () => {
      const ws = loadReplayWorkspace();
      expect(ws.isPaperBottomOpen).toBe(false);
      expect(ws.isOrderTicketOpen).toBe(false);
      expect(ws.isDomOpen).toBe(false);
    });

    it("preserves multi-chart layout cells in clean live posture", () => {
      saveReplayWorkspace({
        layout: { rows: 1, cols: 2 },
        cells: {
          0: { symbol: "MNQ", resolution: "1m" },
          1: { symbol: "MES", resolution: "5m" },
        },
        isPaperBottomOpen: false,
        isOrderTicketOpen: false,
      });

      const restored = loadReplayWorkspace();
      expect(restored.layout).toEqual({ rows: 1, cols: 2 });
      expect(restored.cells[0]?.symbol).toBe("MNQ");
      expect(restored.cells[1]?.symbol).toBe("MES");
      expect(restored.isPaperBottomOpen).toBe(false);
      expect(restored.isOrderTicketOpen).toBe(false);
    });
  });
});

describe("workspace templates CRUD", () => {
  const context = { params: Promise.resolve({ resource: "templates" }) };

  it("creates, updates, lists, and deletes note templates", async () => {
    // 1. Create
    const createReq = new Request("http://localhost/api/workspace/templates", {
      method: "POST",
      body: JSON.stringify({ name: "Test Template", content: "## Heading\n\nContent" }),
    });
    const createRes = await POST(createReq, context);
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.id).toBeDefined();
    const templateId = createData.id;

    // 2. List
    const getRes = await GET(new Request("http://localhost/api/workspace/templates"), context);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const found = getData.templates.find((t: { id: string }) => t.id === templateId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Template");

    // 3. Patch (Rename & Update Content)
    const patchReq = new Request("http://localhost/api/workspace/templates", {
      method: "PATCH",
      body: JSON.stringify({
        id: templateId,
        name: "Renamed Template",
        content: "## Updated Heading",
      }),
    });
    const patchRes = await PATCH(patchReq, context);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.updated).toBe(true);

    // Verify update
    const getRes2 = await GET(new Request("http://localhost/api/workspace/templates"), context);
    const getData2 = await getRes2.json();
    const updated = getData2.templates.find((t: { id: string }) => t.id === templateId);
    expect(updated.name).toBe("Renamed Template");
    expect(updated.content).toBe("## Updated Heading");

    // 4. Delete
    const deleteReq = new Request("http://localhost/api/workspace/templates", {
      method: "DELETE",
      body: JSON.stringify({ id: templateId }),
    });
    const deleteRes = await DELETE(deleteReq, context);
    expect(deleteRes.status).toBe(200);

    // Verify deletion
    const getRes3 = await GET(new Request("http://localhost/api/workspace/templates"), context);
    const getData3 = await getRes3.json();
    const afterDelete = getData3.templates.find((t: { id: string }) => t.id === templateId);
    expect(afterDelete).toBeUndefined();
  });
});
