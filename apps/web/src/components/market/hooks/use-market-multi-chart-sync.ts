import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Vela, NativeWorkspaceCellTracker } from "@luxalgo/vela";
import type { Resolution } from "@/lib/market-data";
import type {
  LayoutShape,
  SyncOptions,
  LayoutPickerController,
} from "@luxalgo/vela/widget";
import { updateSymbolButtonLabel } from "@luxalgo/vela/ui";
import { getInnerRenderer } from "@luxalgo/vela/workspace";
import type { SecondaryCellMarketData } from "./use-market-trading-engine";
import { toVelaTf } from "../utils/market-chart-utils";

export interface UseMarketMultiChartSyncParams {
  chartRef: React.RefObject<Vela | null>;
  topbarRef: React.RefObject<any>;
  topbarHostRef: React.RefObject<HTMLDivElement | null>;
  drawingToolbarRef: React.RefObject<any>;
  selectedSymbol: string;
  selectedResolution: Resolution;
  selectedSymbolRef: React.RefObject<string>;
  selectedResolutionRef: React.RefObject<Resolution>;
  isSelectingCutPointRef: React.RefObject<boolean>;
  isSwitchingResolutionOrSessionRef: React.RefObject<boolean>;

  // Layer 0 Shared Single Source of Truth
  layout: LayoutShape;
  setLayout: React.Dispatch<React.SetStateAction<LayoutShape>>;
  layoutRef: React.MutableRefObject<LayoutShape>;
  syncOptions: SyncOptions;
  setSyncOptions: React.Dispatch<React.SetStateAction<SyncOptions>>;
  syncOptionsRef: React.MutableRefObject<SyncOptions>;
  activeCellIndex: number;
  setActiveCellIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCellIndexRef: React.MutableRefObject<number>;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  secondaryHosts: React.MutableRefObject<Map<number, HTMLDivElement>>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  secondaryCellsVersion: number;
  bumpSecondaryCells: () => void;
  layoutControllerRef: React.MutableRefObject<LayoutPickerController | null>;
  cellTrackerRef?: React.MutableRefObject<NativeWorkspaceCellTracker>;
}

export interface UseMarketMultiChartSyncReturn {
  // Grid Layout & Sync options
  layout: LayoutShape;
  setLayout: React.Dispatch<React.SetStateAction<LayoutShape>>;
  layoutRef: React.MutableRefObject<LayoutShape>;
  syncOptions: SyncOptions;
  setSyncOptions: React.Dispatch<React.SetStateAction<SyncOptions>>;
  syncOptionsRef: React.MutableRefObject<SyncOptions>;

  // Active cell focus
  activeCellIndex: number;
  setActiveCellIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCellIndexRef: React.MutableRefObject<number>;
  activeSymbol: string;
  activeSymbolRef: React.MutableRefObject<string>;
  activeResolution: Resolution;
  activeResolutionRef: React.MutableRefObject<Resolution>;

  // Secondary cells (1..N)
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  secondaryHosts: React.MutableRefObject<Map<number, HTMLDivElement>>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  secondaryCellsVersion: number;
  bumpSecondaryCells: () => void;
  layoutControllerRef: React.MutableRefObject<LayoutPickerController | null>;
  cellListenersRef: React.MutableRefObject<Set<(e: any) => void>>;
  activeDrawingToolRef: React.MutableRefObject<string | null>;

  // Focus & Broadcast actions
  handleActivateCell: (cellIndex: number) => void;
  syncChartRenderer: () => void;
  broadcastCrosshair: (
    sourceId: number,
    time: number | null,
    price?: number | null,
  ) => void;
  clearAllExternalCrosshairs: () => void;
  broadcastViewport: (sourceId: number, range?: any) => void;
  broadcastTimeClick: (sourceId: number, clickTime: number) => void;
}

export function useMarketMultiChartSync({
  chartRef,
  topbarRef,
  topbarHostRef,
  drawingToolbarRef,
  selectedSymbol,
  selectedResolution,
  selectedSymbolRef,
  selectedResolutionRef,
  isSelectingCutPointRef,
  isSwitchingResolutionOrSessionRef,
  layout,
  setLayout,
  layoutRef,
  syncOptions,
  setSyncOptions,
  syncOptionsRef,
  activeCellIndex,
  setActiveCellIndex,
  activeCellIndexRef,
  gridContainerRef,
  secondaryHosts,
  secondaryCharts,
  secondaryCellsData,
  secondaryCellsVersion,
  bumpSecondaryCells,
  layoutControllerRef,
  cellTrackerRef,
}: UseMarketMultiChartSyncParams): UseMarketMultiChartSyncReturn {
  const cellListenersRef = useRef<Set<(e: any) => void>>(new Set());
  const activeDrawingToolRef = useRef<string | null>(null);
  const isSyncingViewportRef = useRef<boolean>(false);
  const timeSyncAnchorURef = useRef<number>(0.5);

  const activeSymbol = useMemo(() => {
    if (activeCellIndex === 0) return selectedSymbol;
    return secondaryCellsData.current.get(activeCellIndex)?.symbol ?? selectedSymbol;
  }, [activeCellIndex, selectedSymbol, secondaryCellsVersion]);

  const activeResolution = useMemo(() => {
    if (activeCellIndex === 0) return selectedResolution;
    return secondaryCellsData.current.get(activeCellIndex)?.resolution ?? selectedResolution;
  }, [activeCellIndex, selectedResolution, secondaryCellsVersion]);

  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;
  const activeResolutionRef = useRef(activeResolution);
  activeResolutionRef.current = activeResolution;

  // Keep activeCellIndex valid if layout cell count decreases
  useEffect(() => {
    const totalCells = layout.rows * layout.cols;
    if (activeCellIndex >= totalCells) {
      setActiveCellIndex(0);
    }
  }, [layout, activeCellIndex]);

  const handleActivateCell = useCallback(
    (cellIndex: number) => {
      setActiveCellIndex(cellIndex);
      activeCellIndexRef.current = cellIndex;
      cellTrackerRef?.current.setActiveCellId(String(cellIndex));
      cellListenersRef.current.forEach((h) => h({ kind: "active", id: `cell-${cellIndex}` }));

      // Sync Topbar symbol and timeframe to newly focused cell
      try {
        const cellSym =
          cellIndex === 0
            ? selectedSymbolRef.current
            : (secondaryCellsData.current.get(cellIndex)?.symbol ?? selectedSymbolRef.current);
        const cellRes =
          cellIndex === 0
            ? selectedResolutionRef.current
            : (secondaryCellsData.current.get(cellIndex)?.resolution ?? selectedResolutionRef.current);
        topbarRef.current?.setSymbol?.(cellSym);
        topbarRef.current?.setTimeframe?.(toVelaTf(cellRes));

        if (topbarHostRef.current) {
          const symBtn = topbarHostRef.current.querySelector<HTMLButtonElement>(".vela-widget-symbol");
          if (symBtn) {
            updateSymbolButtonLabel(symBtn, cellSym);
          }
        }
      } catch {}

      // Active Cell Drawing Proxy: arm the currently active tool on the newly focused chart
      try {
        const activeTool = activeDrawingToolRef.current;
        const targetChart = cellIndex === 0 ? chartRef.current : secondaryCharts.current.get(cellIndex);
        if (targetChart?.drawings) {
          if (targetChart.drawings.getTool?.() !== activeTool) {
            targetChart.drawings.setTool?.(activeTool);
          }
          if (chartRef.current?.drawings) {
            const snap = chartRef.current.drawings.getSnapMode?.();
            if (snap) targetChart.drawings.setSnapMode?.(snap);
            const stay = chartRef.current.drawings.getStayMode?.();
            if (typeof stay === "boolean") targetChart.drawings.setStayMode?.(stay);
            const mode = chartRef.current.drawings.getMode?.();
            if (mode) targetChart.drawings.setMode?.(mode);
          }
        }
        if (drawingToolbarRef.current && targetChart?.drawings) {
          const tb = drawingToolbarRef.current;
          tb.setActiveTool?.(activeTool);
          const snap = targetChart.drawings.getSnapMode?.();
          if (snap) tb.setMagnetMode?.(snap);
          const stay = targetChart.drawings.getStayMode?.();
          if (typeof stay === "boolean") tb.setStayMode?.(stay);
          const mode = targetChart.drawings.getMode?.();
          tb.setMeasureActive?.(mode === "measure");
          tb.setEraserActive?.(mode === "eraser");
          const favs = targetChart.drawings.favorites?.();
          if (favs) tb.setFavorites?.(favs);
        }
      } catch {}
    },
    [chartRef, drawingToolbarRef, selectedResolutionRef, selectedSymbolRef, topbarHostRef, topbarRef],
  );

  const syncChartRenderer = useCallback(() => {
    const doSync = () => {
      try {
        getInnerRenderer(chartRef.current)?.syncSize?.();
      } catch {}
      try {
        (chartRef.current?.renderer as any)?.syncSize?.();
      } catch {}
      try {
        (chartRef.current as any)?.syncSize?.();
      } catch {}
      try {
        (chartRef.current as any)?.resize?.();
      } catch {}

      for (const inst of secondaryCharts.current.values()) {
        try {
          getInnerRenderer(inst)?.syncSize?.();
        } catch {}
        try {
          (inst?.renderer as any)?.syncSize?.();
        } catch {}
        try {
          (inst as any)?.syncSize?.();
        } catch {}
        try {
          (inst as any)?.resize?.();
        } catch {}
      }
    };
    doSync();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        doSync();
        setTimeout(doSync, 60);
      });
    }
  }, [chartRef]);

  const broadcastCrosshair = useCallback(
    (sourceId: number, time: number | null, price: number | null = null) => {
      if (!syncOptionsRef.current.crosshair && !isSelectingCutPointRef.current) return;

      const getCellSym = (id: number): string => {
        if (id === 0) return selectedSymbolRef.current;
        return secondaryCellsData.current.get(id)?.symbol ?? selectedSymbolRef.current;
      };

      const sourceSym = getCellSym(sourceId);

      const targets: Array<{ id: number; chart: any }> = [];
      if (sourceId !== 0 && chartRef.current) {
        targets.push({ id: 0, chart: chartRef.current });
      }
      for (const [id, inst] of secondaryCharts.current.entries()) {
        if (id !== sourceId && inst) {
          targets.push({ id, chart: inst });
        }
      }

      // Ensure active source chart does not render a stale external ghost on top of its own active crosshair
      if (sourceId === 0) {
        chartRef.current?.renderer?.setExternalCrosshair?.(null);
        (chartRef.current as any)?.setExternalCrosshair?.(null);
      } else {
        const srcSec = secondaryCharts.current.get(sourceId);
        srcSec?.renderer?.setExternalCrosshair?.(null);
        (srcSec as any)?.setExternalCrosshair?.(null);
      }

      for (const { id, chart: targetInst } of targets) {
        if (!targetInst) continue;
        const targetSym = getCellSym(id);
        const comparable = sourceSym.toUpperCase() === targetSym.toUpperCase();
        const effectivePrice = comparable ? price : null;

        try {
          if (time === null) {
            targetInst.renderer?.setExternalCrosshair?.(null);
            targetInst.setExternalCrosshair?.(null);
          } else {
            targetInst.renderer?.setExternalCrosshair?.(time, effectivePrice);
            targetInst.setExternalCrosshair?.(time, effectivePrice);
          }
        } catch {}
      }
    },
    [chartRef, isSelectingCutPointRef, selectedSymbolRef, syncOptionsRef],
  );

  const clearAllExternalCrosshairs = useCallback(() => {
    try {
      chartRef.current?.renderer?.setExternalCrosshair?.(null);
      (chartRef.current as any)?.setExternalCrosshair?.(null);
    } catch {}
    for (const inst of secondaryCharts.current.values()) {
      try {
        inst?.renderer?.setExternalCrosshair?.(null);
        inst?.setExternalCrosshair?.(null);
      } catch {}
    }
  }, [chartRef]);

  const broadcastViewport = useCallback(
    (sourceId: number, range?: any) => {
      if (!syncOptionsRef.current.time && !syncOptionsRef.current.dateRange) return;
      if (isSyncingViewportRef.current) return;
      if (isSwitchingResolutionOrSessionRef.current) return;
      isSyncingViewportRef.current = true;
      try {
        const sourceInst = sourceId === 0 ? chartRef.current : secondaryCharts.current.get(sourceId);
        const sourceInner = getInnerRenderer(sourceInst);
        const sourceCoords = sourceInner?.coords;
        const sourceVp = sourceCoords?.getViewport?.();

        const targets: Array<{ id: number; chart: any }> = [];
        if (sourceId !== 0 && chartRef.current) {
          targets.push({ id: 0, chart: chartRef.current });
        }
        for (const [id, inst] of secondaryCharts.current.entries()) {
          if (id !== sourceId && inst) {
            targets.push({ id, chart: inst });
          }
        }

        const syncDateRange = syncOptionsRef.current.dateRange;
        const syncTime = syncOptionsRef.current.time;
        const u = timeSyncAnchorURef.current;

        for (const { chart: targetInst } of targets) {
          try {
            const targetInner = getInnerRenderer(targetInst);
            const targetCoords = targetInner?.coords;
            const targetVp = targetCoords?.getViewport?.();

            if (
              sourceCoords &&
              targetCoords &&
              sourceVp &&
              targetVp &&
              sourceCoords.barCount > 0 &&
              targetCoords.barCount > 0 &&
              typeof targetInner?.applyViewport === "function"
            ) {
              const sameTimeline =
                sourceCoords.barCount === targetCoords.barCount &&
                sourceCoords.barInterval === targetCoords.barInterval &&
                sourceCoords.times?.[sourceCoords.barCount - 1] ===
                  targetCoords.times?.[targetCoords.barCount - 1];
              const sameInterval = sourceCoords.barInterval === targetCoords.barInterval;
              const targetVisBars =
                targetCoords.width / Math.max(1e-6, targetCoords.pxPerBar());
              const maxAllowedWhitespace = Math.min(50, Math.max(10, targetVisBars * 0.5));

              if (syncDateRange) {
                let nextBarSpacing: number;
                let nextRightOffset: number;

                if (sameTimeline) {
                  const widthRatio =
                    sourceCoords.width > 0 && targetCoords.width > 0
                      ? targetCoords.width / sourceCoords.width
                      : 1;
                  const scaleRatio =
                    (sourceCoords.spacingScale || 1) / (targetCoords.spacingScale || 1);
                  nextBarSpacing = sourceVp.barSpacing * widthRatio * scaleRatio;
                  nextRightOffset = sourceVp.rightOffset;
                } else if (sameInterval) {
                  const trueTimeRange = sourceCoords.visibleTimeRange?.();
                  if (!trueTimeRange) continue;
                  const fromL = targetCoords.timeToLogical(trueTimeRange.from);
                  const toL = targetCoords.timeToLogical(trueTimeRange.to);
                  const span = Math.max(1e-6, toL - fromL);
                  nextBarSpacing =
                    targetCoords.width / (span * (targetCoords.spacingScale || 1));
                  nextRightOffset = toL - (targetCoords.barCount - 1);
                } else {
                  nextBarSpacing = targetVp.barSpacing;
                  const sourceVR = sourceCoords.visibleLogicalRange?.();
                  if (!sourceVR) continue;
                  const sourceAnchorLogical = sourceVR.from + u * (sourceVR.to - sourceVR.from);
                  const sourceAnchorTime = sourceCoords.logicalToTime(sourceAnchorLogical);
                  const targetAnchorLogical = targetCoords.timeToLogical(sourceAnchorTime);
                  nextRightOffset =
                    targetAnchorLogical - (targetCoords.barCount - 1) + (1 - u) * targetVisBars;
                }

                nextBarSpacing = Math.max(2, Math.min(60, nextBarSpacing));
                nextRightOffset = Math.max(
                  -targetCoords.barCount + 5,
                  Math.min(maxAllowedWhitespace, nextRightOffset),
                );

                if (
                  Math.abs(targetVp.rightOffset - nextRightOffset) < 1e-4 &&
                  Math.abs(targetVp.barSpacing - nextBarSpacing) < 1e-4
                ) {
                  continue;
                }
                targetInner.applyViewport({
                  barSpacing: nextBarSpacing,
                  rightOffset: nextRightOffset,
                });
                continue;
              } else if (syncTime) {
                let nextRightOffset: number;

                if (sameTimeline) {
                  const sourceVisBars =
                    sourceCoords.width / Math.max(1e-6, sourceCoords.pxPerBar());
                  const sourceAnchorLogical =
                    sourceCoords.barCount - 1 + sourceVp.rightOffset - (1 - u) * sourceVisBars;
                  nextRightOffset =
                    sourceAnchorLogical - (targetCoords.barCount - 1) + (1 - u) * targetVisBars;
                } else {
                  const sourceVR = sourceCoords.visibleLogicalRange?.();
                  if (!sourceVR) continue;
                  const sourceAnchorLogical = sourceVR.from + u * (sourceVR.to - sourceVR.from);
                  const sourceAnchorTime = sourceCoords.logicalToTime(sourceAnchorLogical);
                  const targetAnchorLogical = targetCoords.timeToLogical(sourceAnchorTime);
                  nextRightOffset =
                    targetAnchorLogical - (targetCoords.barCount - 1) + (1 - u) * targetVisBars;
                }

                nextRightOffset = Math.max(
                  -targetCoords.barCount + 5,
                  Math.min(maxAllowedWhitespace, nextRightOffset),
                );

                if (Math.abs(targetVp.rightOffset - nextRightOffset) < 1e-4) {
                  continue;
                }
                targetInner.applyViewport({
                  barSpacing: targetVp.barSpacing,
                  rightOffset: nextRightOffset,
                });
                continue;
              }
            }

            if (!range || typeof range.from !== "number" || typeof range.to !== "number") continue;
            const sourceAnchor = range.from + u * (range.to - range.from);
            if (syncDateRange) {
              targetInst.setVisibleRange?.(range);
            } else if (syncTime) {
              const curRange = targetInst.getVisibleRange?.();
              if (curRange) {
                const span = curRange.to - curRange.from;
                targetInst.setVisibleRange?.({
                  from: Math.round(sourceAnchor - u * span),
                  to: Math.round(sourceAnchor + (1 - u) * span),
                });
              }
            }
          } catch {}
        }
      } finally {
        isSyncingViewportRef.current = false;
      }
    },
    [chartRef, isSwitchingResolutionOrSessionRef, syncOptionsRef],
  );

  const broadcastTimeClick = useCallback(
    (sourceId: number, clickTime: number) => {
      if (!syncOptionsRef.current.time) return;
      if (!clickTime || isSyncingViewportRef.current) return;
      if (syncOptionsRef.current.dateRange) {
        broadcastViewport(sourceId);
        return;
      }
      isSyncingViewportRef.current = true;
      try {
        const sourceInst = sourceId === 0 ? chartRef.current : secondaryCharts.current.get(sourceId);
        const sourceInner = getInnerRenderer(sourceInst);
        const sourceCoords = sourceInner?.coords;

        let u = 0.5;
        if (sourceCoords && sourceCoords.width > 0 && sourceCoords.barCount > 0) {
          const sourceLogical = sourceCoords.timeToLogical(clickTime);
          const sourceX = sourceCoords.logicalToX(sourceLogical);
          if (Number.isFinite(sourceX)) {
            u = Math.max(0, Math.min(1, sourceX / sourceCoords.width));
          }
        }
        timeSyncAnchorURef.current = u;

        const targets: Array<{ id: number; chart: any }> = [];
        if (sourceId !== 0 && chartRef.current) {
          targets.push({ id: 0, chart: chartRef.current });
        }
        for (const [id, inst] of secondaryCharts.current.entries()) {
          if (id !== sourceId && inst) {
            targets.push({ id, chart: inst });
          }
        }
        for (const { chart: targetInst } of targets) {
          try {
            const targetInner = getInnerRenderer(targetInst);
            const targetCoords = targetInner?.coords;
            if (
              targetCoords &&
              targetCoords.barCount > 0 &&
              typeof targetInner?.applyViewport === "function"
            ) {
              const targetVp = targetCoords.getViewport();
              const targetLogical = targetCoords.timeToLogical(clickTime);
              if (Number.isFinite(targetLogical)) {
                const visibleBars =
                  targetCoords.width /
                  Math.max(1e-6, targetVp.barSpacing * (targetCoords.spacingScale || 1));
                const rightOffset =
                  targetLogical - (targetCoords.barCount - 1) + (1 - u) * visibleBars;
                const maxAllowedWhitespace = Math.min(50, Math.max(10, visibleBars * 0.5));
                const clampedRightOffset = Math.max(
                  -targetCoords.barCount + 5,
                  Math.min(maxAllowedWhitespace, rightOffset),
                );
                targetInner.applyViewport({
                  barSpacing: targetVp.barSpacing,
                  rightOffset: clampedRightOffset,
                });
                continue;
              }
            }
          } catch {}
        }
      } finally {
        isSyncingViewportRef.current = false;
      }
    },
    [broadcastViewport, chartRef, syncOptionsRef],
  );

  return {
    layout,
    setLayout,
    layoutRef,
    syncOptions,
    setSyncOptions,
    syncOptionsRef,
    activeCellIndex,
    setActiveCellIndex,
    activeCellIndexRef,
    activeSymbol,
    activeSymbolRef,
    activeResolution,
    activeResolutionRef,
    gridContainerRef,
    secondaryHosts,
    secondaryCharts,
    secondaryCellsData,
    secondaryCellsVersion,
    bumpSecondaryCells,
    layoutControllerRef,
    cellListenersRef,
    activeDrawingToolRef,
    handleActivateCell,
    syncChartRenderer,
    broadcastCrosshair,
    clearAllExternalCrosshairs,
    broadcastViewport,
    broadcastTimeClick,
  };
}
