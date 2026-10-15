// packages/vela/src/widget/side-panels.ts
// @ts-ignore - vendor bundle exports
import { ObjectTree as VendorObjectTree, DataWindow as VendorDataWindow } from "../../vendor/widget.js";
import { resolveNativeSymbolIcon } from "./symbol-icon";

export interface VelaSidePanelsOptions {
  panelContainer: HTMLElement;
  chartInstance?: any;
  symbol: string;
  resolveIcon?: (sym: string) => string | undefined;
  onOpenChange?: (activeId: "objects" | "dataWindow" | null) => void;
  ObjectTreeClass?: any;
  DataWindowClass?: any;
}

export interface VelaSidePanelsController {
  objectTree: any;
  dataWindow: any;
  openId: () => "objects" | "dataWindow" | null;
  toggle: (id: "objects" | "dataWindow", open?: boolean) => void;
  close: () => void;
  open?: (id: "objects" | "dataWindow") => void;
  getActivePanel?: () => "objects" | "dataWindow" | null;
  setSymbol: (symbol: string) => void;
  refresh?: () => void;
  onChart: (instance: any) => void;
  destroy: () => void;
}

/**
 * Synchronizes Vela's left toolbar gutter to 52px to prevent canvas overlap and left-clipping.
 * In @luxalgo/vela, TOOLBAR_WIDTH defaults to 44px, whereas TradeJournal styles the toolbar to 52px.
 * Sets renderer toolbar gutter to 52px, intercepts syncToolbarGutter on drawing controllers,
 * sets --vela-toolbar-gutter: 52px on container, and triggers syncSize().
 */
export function syncVelaToolbarGutter(instance: any, container?: HTMLElement | null): () => void {
  if (!instance) return () => {};

  const renderer = (instance.renderer as any)?.renderer || instance.renderer;

  if (renderer?.setToolbarGutter) {
    renderer.setToolbarGutter(52);
  }

  const drawings = instance.drawings;
  if (drawings && typeof drawings.syncToolbarGutter === "function") {
    drawings.syncToolbarGutter = () => {
      const shown = drawings.toolbarVisible && !drawings.mobileLayout;
      const gutter = shown ? (drawings.toolbarCollapsed ? 16 : 52) : 0;
      renderer?.setToolbarGutter?.(gutter);
    };
    drawings.syncToolbarGutter();
  }

  const userDrawings = renderer?.userDrawings || (instance.renderer as any)?.userDrawings;
  if (userDrawings && typeof userDrawings.syncToolbarGutter === "function") {
    userDrawings.syncToolbarGutter = () => {
      const shown = userDrawings.toolbarVisible && !userDrawings.mobileLayout;
      const gutter = shown ? (userDrawings.toolbarCollapsed ? 16 : 52) : 0;
      renderer?.setToolbarGutter?.(gutter);
    };
    userDrawings.syncToolbarGutter();
  }

  if (container) {
    container.style?.setProperty?.("--vela-toolbar-gutter", "52px");
  }

  if (renderer?.plot?.style) {
    renderer.plot.style.left = "52px";
  }

  renderer?.syncSize?.();
  (instance.renderer as any)?.syncSize?.();

  return () => {};
}

export function setupVelaSidePanels({
  panelContainer,
  chartInstance,
  symbol,
  resolveIcon,
  onOpenChange,
  ObjectTreeClass,
  DataWindowClass,
}: VelaSidePanelsOptions): VelaSidePanelsController {
  let activeId: "objects" | "dataWindow" | null = null;
  let currentChart = chartInstance ?? null;

  const OT = ObjectTreeClass ?? VendorObjectTree;
  const DW = DataWindowClass ?? VendorDataWindow;
  const iconResolver = (sym: string) =>
    resolveIcon?.(sym) ?? resolveNativeSymbolIcon(sym);

  const objectTree = new OT(panelContainer, iconResolver);
  objectTree.setSymbol?.(symbol);
  if (currentChart) objectTree.onChart?.(currentChart);

  const dataWindow = new DW(panelContainer);
  if (currentChart) dataWindow.onChart?.(currentChart);

  let syncRaf: number | null = null;
  const sync = () => {
    currentChart?.renderer?.syncSize?.();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      if (syncRaf !== null) {
        window.cancelAnimationFrame(syncRaf);
      }
      syncRaf = window.requestAnimationFrame(() => {
        syncRaf = null;
        currentChart?.renderer?.syncSize?.();
      });
    }
  };

  objectTree.onOpenChange = (open: boolean) => {
    if (open) {
      dataWindow?.toggle?.(false, true);
      activeId = "objects";
    } else if (activeId === "objects") {
      activeId = null;
    }
    onOpenChange?.(activeId);
    sync();
  };

  dataWindow.onOpenChange = (open: boolean) => {
    if (open) {
      objectTree?.toggle?.(false, true);
      activeId = "dataWindow";
    } else if (activeId === "dataWindow") {
      activeId = null;
    }
    onOpenChange?.(activeId);
    sync();
  };

  const close = () => {
    objectTree?.toggle?.(false, true);
    dataWindow?.toggle?.(false, true);
    activeId = null;
    onOpenChange?.(null);
    sync();
  };

  const toggle = (id: "objects" | "dataWindow", open?: boolean) => {
    const willOpen = open !== undefined ? open : activeId !== id;
    if (id === "objects") {
      if (willOpen) {
        dataWindow?.toggle?.(false, true);
        objectTree?.toggle?.(true);
      } else {
        objectTree?.toggle?.(false);
      }
    } else {
      if (willOpen) {
        objectTree?.toggle?.(false, true);
        dataWindow?.toggle?.(true);
      } else {
        dataWindow?.toggle?.(false);
      }
    }
  };

  const open = (id: "objects" | "dataWindow") => {
    toggle(id, true);
  };

  return {
    objectTree,
    dataWindow,
    openId: () => activeId,
    getActivePanel: () => activeId,
    open,
    close,
    toggle,
    setSymbol: (newSymbol: string) => {
      objectTree?.setSymbol?.(newSymbol);
      objectTree?.refresh?.();
    },
    refresh: () => {
      objectTree?.refresh?.();
    },
    onChart: (inst: any) => {
      currentChart = inst;
      objectTree?.onChart?.(inst);
      dataWindow?.onChart?.(inst);
    },
    destroy: () => {
      if (syncRaf !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(syncRaf);
        syncRaf = null;
      }
      try {
        objectTree?.destroy?.();
      } catch {}
      try {
        dataWindow?.destroy?.();
      } catch {}
      activeId = null;
      onOpenChange?.(null);
      currentChart = null;
    },
  };
}
