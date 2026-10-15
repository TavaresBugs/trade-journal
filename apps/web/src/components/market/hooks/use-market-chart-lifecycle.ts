import { useCallback, useRef } from "react";
import type { UseMarketTerminalRefsReturn } from "./use-market-terminal-refs";
import type { UseMarketMultiChartSyncReturn } from "./use-market-multi-chart-sync";
import type { UseMarketDataAndFeedReturn } from "./use-market-data-and-feed";
import type { UseMarketReplayPlaybackReturn } from "./use-market-replay-playback";
import type { UseMarketIndicatorsEngineReturn } from "./use-market-indicators-engine";
import type { UseMarketWorkspacePersistenceReturn } from "./use-market-workspace-persistence";
import type { UseMarketTradingEngineReturn } from "./use-market-trading-engine";
import type { MarketSidePanelId } from "../chrome/market-side-rail";
import { attachVelaDrawingsPersistence } from "../drawings/market-drawings-persistence";
import { syncStatuslineAndWatermark, toVelaTf } from "../utils/market-chart-utils";
import { useMarketPrimaryChartMount } from "./lifecycle/use-market-primary-chart-mount";
import { useMarketSecondaryCellsMount } from "./lifecycle/use-market-secondary-cells-mount";

export interface UseMarketChartLifecycleParams {
  refs: UseMarketTerminalRefsReturn;
  multiChart: UseMarketMultiChartSyncReturn;
  dataFeed: UseMarketDataAndFeedReturn;
  replay: UseMarketReplayPlaybackReturn;
  indicators: UseMarketIndicatorsEngineReturn;
  persistence: UseMarketWorkspacePersistenceReturn;
  tradingEngine?: UseMarketTradingEngineReturn;

  onOpenSymbolSearch: (targetCellIndex?: number) => void;
  onOpenIndicatorsDialog: (targetCellIndex?: number) => void;
  onOpenSettingsModal: (targetCellIndex?: number, section?: string) => void;
  onActiveSidePanelChange: (panel: MarketSidePanelId) => void;
}

export interface UseMarketChartLifecycleReturn {
  rebindCellDrawingsPersistence: (cellIndex: number, symbol: string) => void;
  handleTriggerScreenshot: () => void;
  handleToggleNativeSidePanel: (panel: "objects" | "dataWindow") => void;
}

export function useMarketChartLifecycle({
  refs,
  multiChart,
  dataFeed,
  replay,
  indicators,
  persistence,
  tradingEngine,
  onOpenSymbolSearch,
  onOpenIndicatorsDialog,
  onOpenSettingsModal,
  onActiveSidePanelChange,
}: UseMarketChartLifecycleParams): UseMarketChartLifecycleReturn {
  const drawingsCleanups = useRef<Map<number, () => void>>(new Map());

  // Mount primary Vela chart and all chrome widgets
  useMarketPrimaryChartMount({
    refs,
    activeSymbolRef: multiChart.activeSymbolRef,
    activeResolutionRef: multiChart.activeResolutionRef,
    activeDrawingToolRef: multiChart.activeDrawingToolRef,
    cellListenersRef: multiChart.cellListenersRef,
    handleActivateCell: multiChart.handleActivateCell,
    handleSelectSymbol: dataFeed.handleSelectSymbol,
    handleSelectResolution: dataFeed.handleSelectResolution,
    handleSessionChange: dataFeed.handleSessionChange,
    syncChartRenderer: multiChart.syncChartRenderer,
    broadcastViewport: multiChart.broadcastViewport,
    broadcastCrosshair: multiChart.broadcastCrosshair,
    clearAllExternalCrosshairs: multiChart.clearAllExternalCrosshairs,
    broadcastTimeClick: multiChart.broadcastTimeClick,
    handleStartReplay: replay.handleStartReplay,
    triggerPaperTick: tradingEngine?.triggerPaperTick ?? (() => {}),
    syncAllCellsSymbol: dataFeed.syncAllCellsSymbol,
    syncAllCellsInterval: dataFeed.syncAllCellsInterval,
    syncAllCellsStyle: dataFeed.syncAllCellsStyle,
    extractCanonicalIndicatorSlugs: indicators.extractCanonicalIndicatorSlugs,
    extractChartIndicatorConfigs: indicators.extractChartIndicatorConfigs,
    hydrateChartIndicatorsSilently: indicators.hydrateChartIndicatorsSilently,
    openSettingsModal: onOpenSettingsModal,
    openSymbolSearch: () => onOpenSymbolSearch(),
    openIndicatorsDialog: () => onOpenIndicatorsDialog(),
    toggleFavMenu: indicators.toggleFavMenu,
    toggleTemplatesMenu: indicators.toggleTemplatesMenu,
    setActivePanel: onActiveSidePanelChange,
    persistAndApplyTimezone: persistence.persistAndApplyTimezone,
    setActiveIndicatorSlugs: indicators.setActiveIndicatorSlugs,
    setActiveIndicatorConfigs: indicators.setActiveIndicatorConfigs,
  });

  // Mount secondary cells for multi-chart layouts (1x2 to 4x4)
  useMarketSecondaryCellsMount({
    refs,
    layout: multiChart.layout,
    activeDrawingToolRef: multiChart.activeDrawingToolRef,
    cellListenersRef: multiChart.cellListenersRef,
    fetchCandlesForCell: dataFeed.fetchCandlesForCell,
    broadcastCrosshair: multiChart.broadcastCrosshair,
    broadcastTimeClick: multiChart.broadcastTimeClick,
    broadcastViewport: multiChart.broadcastViewport,
    handleStartReplay: replay.handleStartReplay,
    handleActivateCell: multiChart.handleActivateCell,
    extractCanonicalIndicatorSlugs: indicators.extractCanonicalIndicatorSlugs,
    extractChartIndicatorConfigs: indicators.extractChartIndicatorConfigs,
    hydrateChartIndicatorsSilently: indicators.hydrateChartIndicatorsSilently,
    openSettingsModal: onOpenSettingsModal,
    openSymbolSearch: () => onOpenSymbolSearch(),
    handleSelectSymbolForCell: async (sym, idx) => {
      const cData = refs.secondaryCellsData.current.get(idx);
      if (cData) {
        cData.symbol = sym;
        const b = await dataFeed.fetchCandlesForCell(sym, cData.resolution);
        cData.bars = b;
        cData.rawBars = b;
        const inst = refs.secondaryCharts.current.get(idx);
        if (inst) {
          (inst as any).__symbol = sym;
          await inst.setMarket({ timeframe: toVelaTf(cData.resolution), data: b });
          (inst as any).__rebindDrawingsPersistence?.(sym);
          syncStatuslineAndWatermark(
            (inst as any)?.__statusline,
            (inst as any)?.__watermark,
            sym,
            cData.resolution,
            "Replay",
            b,
          );
          refs.cellTrackerRef.current.updateCellMeta(String(idx), {
            symbol: sym,
            resolution: cData.resolution,
            lastClose: b.at(-1)?.close,
          });
        }
        refs.bumpSecondaryCells();
      }
    },
    handleSelectResolutionForCell: async (res, idx) => {
      const cData = refs.secondaryCellsData.current.get(idx);
      if (cData) {
        cData.resolution = res;
        const b = await dataFeed.fetchCandlesForCell(cData.symbol, res);
        cData.bars = b;
        cData.rawBars = b;
        const inst = refs.secondaryCharts.current.get(idx);
        if (inst) {
          (inst as any).__resolution = res;
          (inst as any).__renderedResolution = res;
          await inst.setMarket({ timeframe: toVelaTf(res), data: b });
          syncStatuslineAndWatermark(
            (inst as any)?.__statusline,
            (inst as any)?.__watermark,
            cData.symbol,
            res,
            "Replay",
            b,
          );
          refs.cellTrackerRef.current.updateCellMeta(String(idx), {
            symbol: cData.symbol,
            resolution: res,
            lastClose: b.at(-1)?.close,
          });
        }
        refs.bumpSecondaryCells();
      }
    },
    persistAndApplyTimezone: persistence.persistAndApplyTimezone,
  });

  const rebindCellDrawingsPersistence = useCallback(
    (cellIndex: number, symbol: string) => {
      const existingCleanup = drawingsCleanups.current.get(cellIndex);
      if (existingCleanup) {
        try {
          existingCleanup();
        } catch {}
        drawingsCleanups.current.delete(cellIndex);
      }

      const targetChart =
        cellIndex === 0
          ? refs.chartRef.current
          : refs.secondaryCharts.current.get(cellIndex);
      if (!targetChart || !symbol) return;

      if (typeof (targetChart as any).__rebindDrawingsPersistence === "function") {
        (targetChart as any).__rebindDrawingsPersistence(symbol);
        return;
      }

      const tradeKey = `replay-${symbol}`;
      try {
        const cleanup = attachVelaDrawingsPersistence(targetChart, tradeKey);
        if (typeof cleanup === "function") {
          drawingsCleanups.current.set(cellIndex, cleanup);
          (targetChart as any).__drawingsPersistenceCleanup = cleanup;
        }
      } catch (err) {
        console.warn(`[MarketLifecycle] Failed to bind drawings persistence for cell ${cellIndex}:`, err);
      }
    },
    [refs.chartRef, refs.secondaryCharts],
  );

  const handleTriggerScreenshot = useCallback(() => {
    try {
      if (refs.screenshotMenuControllerRef.current) {
        refs.screenshotMenuControllerRef.current.open();
        return;
      }
      const primary = refs.chartRef.current;
      if (primary && typeof (primary as any).takeScreenshot === "function") {
        (primary as any).takeScreenshot();
      }
    } catch (err) {
      console.warn("[MarketLifecycle] Screenshot trigger failed:", err);
    }
  }, [refs.chartRef, refs.screenshotMenuControllerRef]);

  const handleToggleNativeSidePanel = useCallback(
    (panel: "objects" | "dataWindow") => {
      try {
        const dock = refs.sidePanelsDockRef.current;
        if (dock && typeof dock.toggle === "function") {
          dock.toggle(panel);
        }
      } catch (err) {
        console.warn(`[MarketLifecycle] Failed to toggle side panel ${panel}:`, err);
      }
    },
    [refs.sidePanelsDockRef],
  );

  return {
    rebindCellDrawingsPersistence,
    handleTriggerScreenshot,
    handleToggleNativeSidePanel,
  };
}
