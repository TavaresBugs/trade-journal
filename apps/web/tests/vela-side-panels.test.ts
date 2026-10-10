import { describe, it, expect, vi } from "vitest";
import {
  setupVelaSidePanels,
  type VelaSidePanelsController,
} from "../src/components/trade-market-data";

describe("Vela Side Panels Dock & Right Rail (ObjectTree & DataWindow)", () => {
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
      toggle: vi.fn(function (this: any, nextOpen?: boolean, instant?: boolean) {
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
        onCrosshairMove: vi.fn((cb: () => void) => () => {}),
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
      constructor(host: HTMLElement, iconFor?: any) {
        createdOT = createMockPanel("Object tree");
        return createdOT;
      }
    }

    class MockDW {
      constructor(host: HTMLElement) {
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

    // 3. Toggle DataWindow off (bare toggle)
    controller.toggle("dataWindow");
    expect(createdDW.toggle).toHaveBeenCalledWith(false);
    expect(controller.openId()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(null);
  });

  it("handles header 'X' close button callback gracefully", () => {
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
      symbol: "ETHUSDT",
      onOpenChange,
      ObjectTreeClass: MockOT as any,
      DataWindowClass: MockDW as any,
    });

    // Open ObjectTree
    controller.toggle("objects", true);
    expect(controller.openId()).toBe("objects");

    // Simulate clicking panel header 'X' button inside ObjectTree
    createdOT.onOpenChange?.(false);
    expect(controller.openId()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(null);
    expect(mockChart.renderer.syncSize).toHaveBeenCalled();
  });

  it("updates symbol on hot-swap", () => {
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

    controller.setSymbol("SOLUSDT");
    expect(createdOT.setSymbol).toHaveBeenCalledWith("SOLUSDT");
    expect(createdOT.refresh).toHaveBeenCalled();
  });

  it("rebinds onChart when chart instance rebuilds", () => {
    const mockContainer = {} as HTMLElement;
    const mockChart1 = createMockChart();
    const mockChart2 = createMockChart();

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
      chartInstance: mockChart1,
      symbol: "BTCUSDT",
      ObjectTreeClass: MockOT as any,
      DataWindowClass: MockDW as any,
    });

    controller.onChart(mockChart2);
    expect(createdOT.onChart).toHaveBeenCalledWith(mockChart2);
    expect(createdDW.onChart).toHaveBeenCalledWith(mockChart2);
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

    const onOpenChange = vi.fn();
    const controller = setupVelaSidePanels({
      panelContainer: mockContainer,
      chartInstance: mockChart,
      symbol: "BTCUSDT",
      onOpenChange,
      ObjectTreeClass: MockOT as any,
      DataWindowClass: MockDW as any,
    });

    controller.destroy();
    expect(createdOT.destroy).toHaveBeenCalled();
    expect(createdDW.destroy).toHaveBeenCalled();
    expect(controller.openId()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(null);
  });

  it("supports close() to close any active panel", () => {
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

    controller.toggle("objects", true);
    expect(controller.openId()).toBe("objects");

    controller.close();
    expect(createdOT.toggle).toHaveBeenCalledWith(false, true);
    expect(controller.openId()).toBeNull();
    expect(mockChart.renderer.syncSize).toHaveBeenCalled();
  });
});
