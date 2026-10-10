import { describe, it, expect, vi } from "vitest";
import { syncVelaToolbarGutter } from "../src/components/trade-market-data";

describe("Vela Layout Synchronization (Fix 8px Overlap)", () => {
  it("synchronizes renderer toolbar gutter to 52px and recalculates size", () => {
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

  it("intercepts drawings.syncToolbarGutter to use 52px when open and 16px when collapsed", () => {
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

    // Initial establishment
    expect(setToolbarGutter).toHaveBeenCalledWith(52);

    // When toolbar is collapsed
    mockDrawings.toolbarCollapsed = true;
    mockDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(16);

    // When toolbar is uncollapsed
    mockDrawings.toolbarCollapsed = false;
    mockDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(52);

    // When mobile layout
    mockDrawings.mobileLayout = true;
    mockDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(0);

    // When hidden
    mockDrawings.mobileLayout = false;
    mockDrawings.toolbarVisible = false;
    mockDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(0);
  });

  it("intercepts userDrawings.syncToolbarGutter on the renderer directly", () => {
    const setToolbarGutter = vi.fn();
    const syncSize = vi.fn();

    const mockUserDrawings = {
      toolbarVisible: true,
      mobileLayout: false,
      toolbarCollapsed: false,
      syncToolbarGutter: vi.fn(),
    };

    const mockInstance = {
      renderer: {
        setToolbarGutter,
        syncSize,
        userDrawings: mockUserDrawings,
      },
    };

    syncVelaToolbarGutter(mockInstance);

    expect(setToolbarGutter).toHaveBeenCalledWith(52);

    mockUserDrawings.toolbarCollapsed = true;
    mockUserDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(16);

    mockUserDrawings.toolbarCollapsed = false;
    mockUserDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(52);
  });

  it("synchronizes wrapped renderer architecture (RendererControl wrapping NativeRenderer)", () => {
    const setToolbarGutter = vi.fn();
    const syncSize = vi.fn();
    const mockUserDrawings = {
      toolbarVisible: true,
      mobileLayout: false,
      toolbarCollapsed: false,
      syncToolbarGutter: vi.fn(),
    };

    const mockNativeRenderer = {
      setToolbarGutter,
      syncSize,
      userDrawings: mockUserDrawings,
    };

    const mockRendererControl = {
      renderer: mockNativeRenderer,
      syncSize: vi.fn(),
    };

    const mockInstance = {
      renderer: mockRendererControl,
    };

    syncVelaToolbarGutter(mockInstance);

    expect(setToolbarGutter).toHaveBeenCalledWith(52);
    expect(mockNativeRenderer.syncSize).toHaveBeenCalled();

    mockUserDrawings.toolbarCollapsed = true;
    mockUserDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(16);

    mockUserDrawings.toolbarCollapsed = false;
    mockUserDrawings.syncToolbarGutter();
    expect(setToolbarGutter).toHaveBeenLastCalledWith(52);
  });

  it("handles null and undefined safely without throwing", () => {
    expect(() => syncVelaToolbarGutter(null)).not.toThrow();
    expect(() => syncVelaToolbarGutter(undefined)).not.toThrow();
    expect(() => syncVelaToolbarGutter({})).not.toThrow();
    expect(() => syncVelaToolbarGutter({ renderer: {} })).not.toThrow();
  });
});
