import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import type { MarketBar, Resolution } from "@/lib/market-data";
import { snapTimeToCandle } from "@/lib/market-data";
import type { SyncOptions } from "@luxalgo/vela/widget";
import { showVelaToast } from "@luxalgo/vela/widget";
import { getInnerRenderer } from "@luxalgo/vela/workspace";
import type { PersistedIndicatorInstance } from "@/lib/replay/workspace-persistence";
import { getGlobalPaperEngine } from "@/lib/paper-trading";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";
import { alertEvaluationEngine } from "@/lib/alerts/alert-evaluator";

export interface SecondaryCellMarketData {
  symbol: string;
  resolution: Resolution;
  bars: MarketBar[];
  rawBars: MarketBar[];
  indicators?: string[];
  indicatorConfigs?: PersistedIndicatorInstance[];
}

export interface UseMarketTradingEngineParams {
  chartRef: React.RefObject<Vela | null>;
  hostRef: React.RefObject<HTMLDivElement | null>;
  secondaryChartsRef: React.RefObject<Map<number, any>>;
  secondaryCellsDataRef: React.RefObject<Map<number, SecondaryCellMarketData>>;

  selectedSymbolRef: React.RefObject<string>;
  barsRef: React.RefObject<MarketBar[]>;
  isReplayActiveRef: React.RefObject<boolean>;
  replayCursorTimeRef: React.RefObject<number | null>;
  syncOptionsRef: React.RefObject<SyncOptions>;

  syncChartRenderer: () => void;
  broadcastTimeClick: (sourceId: number, clickTime: number) => void;
}

export interface UseMarketTradingEngineReturn {
  // Panel and Boleta visibility states
  isOrderTicketOpen: boolean;
  setIsOrderTicketOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDomOpen: boolean;
  setIsDomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPaperBottomOpen: boolean;
  setIsPaperBottomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paperBottomHeight: number;
  setPaperBottomHeight: React.Dispatch<React.SetStateAction<number>>;
  showBuySellButtons: boolean;
  setShowBuySellButtons: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions and Tick Feed / Navigation handlers
  toggleBuySellButtons: () => void;
  triggerPaperTick: (time?: number, targetSymbol?: string) => void;
  handleNavigateToTrade: (
    timestamp: number,
    type: "entry" | "exit",
    price?: number,
  ) => void;
  cleanupPaperTradingOnExitReplay: () => void;
  syncPaperTradingOnReplayJump: (targetCutTime: number) => void;
}

export function useMarketTradingEngine({
  chartRef,
  hostRef,
  secondaryChartsRef,
  secondaryCellsDataRef,
  selectedSymbolRef,
  barsRef,
  isReplayActiveRef,
  replayCursorTimeRef,
  syncOptionsRef,
  syncChartRenderer,
  broadcastTimeClick,
}: UseMarketTradingEngineParams): UseMarketTradingEngineReturn {
  const [isOrderTicketOpen, setIsOrderTicketOpen] = useState<boolean>(false);
  const [isDomOpen, setIsDomOpen] = useState<boolean>(false);
  const [isPaperBottomOpen, setIsPaperBottomOpen] = useState<boolean>(false);
  const [paperBottomHeight, setPaperBottomHeight] = useState<number>(360);
  const [showBuySellButtons, setShowBuySellButtons] = useState(true);

  // Auto-open lateral order panel in edit position / modify order mode
  const wasOrderPanelOpenBeforeEditRef = useRef(false);
  const prevPreOrderModeRef = useRef(preOrderStore.getState().mode);

  useEffect(() => {
    return preOrderStore.subscribe((state) => {
      const prevMode = prevPreOrderModeRef.current;
      const isNowEdit = state.mode === "modify_order" || state.mode === "edit_position";
      const wasEdit = prevMode === "modify_order" || prevMode === "edit_position";
      prevPreOrderModeRef.current = state.mode;

      if (isNowEdit && !wasEdit) {
        setIsOrderTicketOpen((prev) => {
          wasOrderPanelOpenBeforeEditRef.current = prev;
          return true;
        });
      } else if (!isNowEdit && wasEdit) {
        if (!wasOrderPanelOpenBeforeEditRef.current) {
          setIsOrderTicketOpen(false);
        }
      }
    });
  }, []);

  const toggleBuySellButtons = useCallback(() => {
    setShowBuySellButtons((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tradejournal_show_buysell_buttons", next ? "true" : "false");
      } catch {}
      return next;
    });
  }, []);

  const triggerPaperTick = useCallback(
    (time?: number, targetSymbol?: string) => {
      const tickBarsForSymbol = (sym: string, cellBars: MarketBar[]) => {
        if (!sym || !cellBars || !cellBars.length) return;
        const normalizedSym = sym.toUpperCase();
        let targetTime = time;
        if (
          typeof targetTime !== "number" &&
          isReplayActiveRef.current &&
          typeof replayCursorTimeRef.current === "number"
        ) {
          targetTime = replayCursorTimeRef.current;
        }

        let bar: MarketBar | undefined;
        if (typeof targetTime === "number") {
          bar = cellBars.find((b) => b.time === targetTime);
          if (!bar) {
            for (let i = cellBars.length - 1; i >= 0; i--) {
              const b = cellBars[i];
              if (b && b.time <= targetTime) {
                bar = b;
                break;
              }
            }
          }
        }

        if (!bar && cellBars.length) {
          if (isReplayActiveRef.current && typeof replayCursorTimeRef.current === "number") {
            for (let i = cellBars.length - 1; i >= 0; i--) {
              const b = cellBars[i];
              if (b && b.time <= replayCursorTimeRef.current) {
                bar = b;
                break;
              }
            }
          }
          if (!bar) {
            bar = cellBars[cellBars.length - 1];
          }
        }

        if (bar) {
          getGlobalPaperEngine().onTick(normalizedSym, bar.close, bar.high, bar.low, bar.time);
          alertEvaluationEngine.evaluateBar(normalizedSym, bar);
        }
      };

      const filterSym = targetSymbol ? targetSymbol.toUpperCase() : null;
      const ticked = new Set<string>();

      const primarySym = selectedSymbolRef.current.toUpperCase();
      if (!filterSym || filterSym === primarySym) {
        tickBarsForSymbol(primarySym, barsRef.current);
        ticked.add(primarySym);
      }

      for (const cellData of secondaryCellsDataRef.current.values()) {
        const cellSym = cellData.symbol?.toUpperCase();
        if (!cellSym || ticked.has(cellSym)) continue;
        if (!filterSym || filterSym === cellSym) {
          tickBarsForSymbol(cellSym, cellData.bars);
          ticked.add(cellSym);
        }
      }
    },
    [
      barsRef,
      isReplayActiveRef,
      replayCursorTimeRef,
      secondaryCellsDataRef,
      selectedSymbolRef,
    ],
  );

  const handleNavigateToTrade = useCallback(
    (timestamp: number, type: "entry" | "exit", price?: number) => {
      const chartInst = chartRef.current;
      if (!chartInst || !timestamp) return;

      const allBars = barsRef.current;
      if (!allBars || allBars.length === 0) {
        if (hostRef.current) {
          showVelaToast("No chart data available to navigate.", "info", hostRef.current);
        }
        return;
      }

      // Handle both seconds and milliseconds timestamps
      const isBarsMs = allBars[0]!.time > 1e11;
      const isInputMs = timestamp > 1e11;

      let targetTime = timestamp;
      if (isBarsMs && !isInputMs) {
        targetTime = timestamp * 1000;
      } else if (!isBarsMs && isInputMs) {
        targetTime = Math.round(timestamp / 1000);
      }

      const firstTime = allBars[0]!.time;
      const lastTime = allBars[allBars.length - 1]!.time;

      if (targetTime < firstTime || targetTime > lastTime) {
        const dateStr = new Date(isInputMs ? timestamp : timestamp * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        if (hostRef.current) {
          showVelaToast(
            `Trade ${type} date (${dateStr}) is outside loaded history.`,
            "info",
            hostRef.current,
          );
        }
        return;
      }

      const snappedTime = snapTimeToCandle(targetTime, allBars);
      let centered = false;

      try {
        const inner = getInnerRenderer(chartInst);
        const coords = inner?.coords;
        if (coords && typeof inner?.applyViewport === "function") {
          const vp = coords.getViewport();
          const logical = coords.timeToLogical(snappedTime);
          if (Number.isFinite(logical)) {
            const visibleBars =
              coords.width / Math.max(1e-6, vp.barSpacing * (coords.spacingScale || 1));
            const rightOffset = logical - (coords.barCount - 1) + visibleBars / 2;
            inner.applyViewport({
              barSpacing: vp.barSpacing,
              rightOffset: Math.round(rightOffset * 100) / 100,
            });
            centered = true;
          }
        }

        if (!centered) {
          const curRange = chartInst.getVisibleRange?.();
          if (curRange && Number.isFinite(curRange.from) && Number.isFinite(curRange.to)) {
            const span = curRange.to - curRange.from;
            chartInst.setVisibleRange?.({
              from: Math.round(snappedTime - span / 2),
              to: Math.round(snappedTime + span / 2),
            });
            centered = true;
          }
        }

        if (!centered && typeof (chartInst as any).timeScale === "function") {
          const ts = (chartInst as any).timeScale();
          const curRange = ts.getVisibleRange?.();
          if (curRange && Number.isFinite(curRange.from) && Number.isFinite(curRange.to)) {
            const span = curRange.to - curRange.from;
            ts.setVisibleRange?.({
              from: Math.round(snappedTime - span / 2),
              to: Math.round(snappedTime + span / 2),
            });
            centered = true;
          }
        }
      } catch (err) {
        console.warn("[ChartNavigation] Error navigating to trade bar:", err);
      }

      // Highlight target bar / price with crosshair temporarily
      try {
        (chartInst as any).renderer?.setExternalCrosshair?.(snappedTime, price ?? null);
        (chartInst as any)?.setExternalCrosshair?.(snappedTime, price ?? null);
        setTimeout(() => {
          try {
            (chartInst as any).renderer?.setExternalCrosshair?.(null);
            (chartInst as any)?.setExternalCrosshair?.(null);
          } catch {}
        }, 2500);
      } catch {}

      if (syncOptionsRef.current.time && secondaryChartsRef.current.size > 0) {
        broadcastTimeClick(0, snappedTime);
      }
    },
    [barsRef, broadcastTimeClick, chartRef, hostRef, secondaryChartsRef, syncOptionsRef],
  );

  const cleanupPaperTradingOnExitReplay = useCallback(() => {
    try {
      const engine = getGlobalPaperEngine();
      if (typeof (engine as any).cancelAllOnExitReplay === "function") {
        (engine as any).cancelAllOnExitReplay();
      }
      preOrderStore.close();
    } catch (err) {
      console.warn("[MarketTradingEngine] Failed to clean up paper trading on replay exit:", err);
    }
  }, []);

  const syncPaperTradingOnReplayJump = useCallback((targetCutTime: number) => {
    try {
      const engine = getGlobalPaperEngine();
      if (typeof (engine as any).checkRewindPositions === "function") {
        (engine as any).checkRewindPositions(targetCutTime);
      }
    } catch (err) {
      console.warn("[MarketTradingEngine] Failed to sync paper trading on replay jump:", err);
    }
  }, []);

  return {
    isOrderTicketOpen,
    setIsOrderTicketOpen,
    isDomOpen,
    setIsDomOpen,
    isPaperBottomOpen,
    setIsPaperBottomOpen,
    paperBottomHeight,
    setPaperBottomHeight,
    showBuySellButtons,
    setShowBuySellButtons,
    toggleBuySellButtons,
    triggerPaperTick,
    handleNavigateToTrade,
    cleanupPaperTradingOnExitReplay,
    syncPaperTradingOnReplayJump,
  };
}
