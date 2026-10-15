/**
 * Native VelaWorkspace Active-Cell & Settings Synchronizer
 * Guarantees 0ms synchronous cell resolution on pointerdown capture before
 * any Settings dialog or Topbar action reads the active chart state.
 */

import { cleanRootSymbol } from "../widget/symbol-icon";
import { SAMPLE_BASE_PRICES, resolveSampleAnchor } from "./sample-anchors";

export interface WorkspaceCellDescriptor {
  id: string;
  host: HTMLElement;
  chart: any;
  statusline?: any;
  watermark?: any;
  symbol: string;
  resolution: string;
  lastClose?: number;
  tickSize?: number;
}

export interface ActiveCellSettingsSnapshot {
  cellId: string;
  symbol: string;
  displaySymbol: string;
  resolution: string;
  referencePrice: number;
  tickSize: number;
  chart: any;
  statusline?: any;
  watermark?: any;
}

export class NativeWorkspaceCellTracker {
  private cells = new Map<string, WorkspaceCellDescriptor>();
  private activeCellId: string = "0";
  private cleanups = new Map<string, () => void>();
  private listeners = new Set<(snapshot: ActiveCellSettingsSnapshot) => void>();

  public registerCell(cell: WorkspaceCellDescriptor): () => void {
    this.cleanups.get(cell.id)?.();
    this.cells.set(cell.id, cell);

    if (this.cells.size === 1) {
      this.activeCellId = cell.id;
    }

    // Capture phase listener: runs BEFORE canvas double-click, contextmenu, or React bubble events!
    const onPointerDownCapture = () => {
      if (this.activeCellId !== cell.id) {
        this.activeCellId = cell.id;
        this.emitActiveCellChange();
      } else {
        // Still refresh snapshot in case bars updated
        this.emitActiveCellChange();
      }
    };

    cell.host.addEventListener("pointerdown", onPointerDownCapture, { capture: true, passive: true });

    const cleanup = () => {
      cell.host.removeEventListener("pointerdown", onPointerDownCapture, { capture: true } as any);
      this.cells.delete(cell.id);
      this.cleanups.delete(cell.id);
    };

    this.cleanups.set(cell.id, cleanup);
    return cleanup;
  }

  public updateCellMeta(
    cellId: string,
    patch: Partial<Pick<WorkspaceCellDescriptor, "symbol" | "resolution" | "lastClose" | "tickSize" | "chart" | "statusline" | "watermark">>,
  ): void {
    const existing = this.cells.get(cellId);
    if (!existing) return;
    Object.assign(existing, patch);
    if (this.activeCellId === cellId) {
      this.emitActiveCellChange();
    }
  }

  public setActiveCellId(cellId: string): ActiveCellSettingsSnapshot | null {
    if (this.cells.has(cellId)) {
      this.activeCellId = cellId;
      const snap = this.getActiveCellSnapshot();
      this.emitActiveCellChange();
      return snap;
    }
    return this.getActiveCellSnapshot();
  }

  /**
   * Reads the live close price directly from the cell's own Vela instance / BarStore
   * and validates that it belongs to the cell's symbol price range.
   */
  public getCellSnapshot(cellId: string): ActiveCellSettingsSnapshot | null {
    const cell = this.cells.get(cellId) ?? this.cells.values().next().value;
    if (!cell) return null;

    const displaySymbol = cleanRootSymbol(cell.symbol || "MES");

    // Extract last bar close directly from this cell's chart instance
    let extractedClose: number | undefined = cell.lastClose;
    try {
      const storeBars =
        cell.chart?.barStore?.bars ??
        cell.chart?.renderer?.bars ??
        cell.chart?.bars;
      if (Array.isArray(storeBars) && storeBars.length > 0) {
        const lastBar = storeBars[storeBars.length - 1];
        if (typeof lastBar?.close === "number" && Number.isFinite(lastBar.close) && lastBar.close > 0) {
          extractedClose = lastBar.close;
        }
      } else if (typeof cell.statusline?.lastBar?.close === "number") {
        extractedClose = cell.statusline.lastBar.close;
      }
    } catch {}

    const anchor = resolveSampleAnchor(displaySymbol, extractedClose, cell.tickSize);

    return {
      cellId: cell.id,
      symbol: cell.symbol,
      displaySymbol,
      resolution: cell.resolution || "15m",
      referencePrice: anchor.price,
      tickSize: anchor.tickSize,
      chart: cell.chart,
      statusline: cell.statusline,
      watermark: cell.watermark,
    };
  }

  public getActiveCellSnapshot(): ActiveCellSettingsSnapshot | null {
    return this.getCellSnapshot(this.activeCellId);
  }

  public onActiveCellChange(cb: (snapshot: ActiveCellSettingsSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emitActiveCellChange(): void {
    const snap = this.getActiveCellSnapshot();
    if (!snap) return;
    for (const cb of this.listeners) {
      try {
        cb(snap);
      } catch {}
    }
  }

  public destroy(): void {
    for (const cleanup of this.cleanups.values()) {
      cleanup();
    }
    this.cleanups.clear();
    this.cells.clear();
    this.listeners.clear();
  }
}
