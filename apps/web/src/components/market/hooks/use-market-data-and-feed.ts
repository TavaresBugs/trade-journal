import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import type { MarketBar, Resolution } from "@/lib/market-data";
import { isFuturesOrEquitySymbol, filterCandlesBySession } from "@/lib/market-data";
import type { LayoutShape, SyncOptions } from "@luxalgo/vela/widget";
import { showVelaToast } from "@luxalgo/vela/widget";
import {
  getInnerRenderer,
  applyHealthyResolutionViewport,
  injectLiveBarIntoVela,
  loadStoredSettings,
  saveStoredSettings,
} from "@luxalgo/vela/workspace";
import type { ReplayMarketDataResponse, ReplaySymbolCatalogItem } from "@/app/api/market-data/replay/route";
import {
  useLiveMarketFeed,
  type LiveFeedSubscriptionItem,
  type LiveFeedTick,
} from "@/lib/market-feed/use-live-market-feed";
import type { SecondaryCellMarketData } from "./use-market-trading-engine";
import {
  matchResolution,
  mergeBars,
  resolutionToStepMs,
  syncStatuslineAndWatermark,
  toVelaTf,
} from "../utils/market-chart-utils";
import { SYMBOL_SPECS } from "@/lib/assets/symbol-specs";
import { getAssetClass } from "@/lib/assets/symbol-utils";

const SEED_DATA_SYMBOLS: Record<string, number> = {
  US100: 187765,
  US500: 185986,
  MES: 53816,
  MNQ: 51460,
};

function buildDefaultCatalog(): ReplaySymbolCatalogItem[] {
  const defaultSupportedResolutions: Resolution[] = [
    "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1mo",
  ];
  return Object.entries(SYMBOL_SPECS)
    .map(([key, spec]) => {
      const sym = (spec.symbol || key).toUpperCase();
      const seedBars = SEED_DATA_SYMBOLS[sym] ?? 0;
      return {
        symbol: spec.symbol || key,
        currency: spec.currency || "USD",
        priceBasis: "raw",
        totalBars: seedBars,
        firstTime: 0,
        lastTime: 0,
        resolutions: defaultSupportedResolutions,
        assetName: spec.name || spec.description || sym,
        category: spec.category || getAssetClass(sym),
      };
    })
    .sort((a, b) => (b.totalBars || 0) - (a.totalBars || 0));
}

export interface ResolutionSwitchState {
  status: "idle" | "switching";
  targetResolution: Resolution | null;
  targetSymbol: string | null;
  cellIndex: number;
  startedAt: number;
}

export interface UseMarketDataAndFeedParams {
  chartRef: React.RefObject<Vela | null>;
  hostRef: React.RefObject<HTMLDivElement | null>;
  topbarRef: React.RefObject<any>;
  bottombarRef: React.RefObject<any>;
  statuslineRef: React.RefObject<any>;
  watermarkRef: React.RefObject<any>;
  sidePanelsDockRef: React.RefObject<any>;

  layout: LayoutShape;
  activeCellIndexRef: React.RefObject<number>;
  syncOptionsRef: React.RefObject<SyncOptions>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  secondaryCellsVersion: number;
  bumpSecondaryCells: () => void;

  isReplayActive: boolean;
  isReplayActiveRef: React.RefObject<boolean>;
  isPlayingRef: React.RefObject<boolean>;
  replayCursorTimeRef: React.RefObject<number | null>;
  replaySpeedRef: React.RefObject<number>;
  setIsReplayActive: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setReplayCursorTime: React.Dispatch<React.SetStateAction<number | null>>;
  setReplayRemaining: React.Dispatch<React.SetStateAction<number>>;

  triggerPaperTick: (time?: number, targetSymbol?: string) => void;
  broadcastViewport: (sourceId: number, range?: any) => void;

  // Layer 0 Shared Single Source of Truth
  selectedSymbol: string;
  setSelectedSymbol: React.Dispatch<React.SetStateAction<string>>;
  selectedSymbolRef: React.MutableRefObject<string>;
  selectedResolution: Resolution;
  setSelectedResolution: React.Dispatch<React.SetStateAction<Resolution>>;
  selectedResolutionRef: React.MutableRefObject<Resolution>;
  renderedResolutionRef: React.MutableRefObject<Resolution>;
  bars: MarketBar[];
  setBars: React.Dispatch<React.SetStateAction<MarketBar[]>>;
  barsRef: React.MutableRefObject<MarketBar[]>;
  rawBarsRef: React.MutableRefObject<MarketBar[]>;
  sessionMode: "regular" | "extended";
  setSessionMode: React.Dispatch<React.SetStateAction<"regular" | "extended">>;
  sessionModeRef: React.MutableRefObject<"regular" | "extended">;
  isSwitchingResolutionOrSessionRef: React.MutableRefObject<boolean>;
  resolutionSwitchStateRef: React.MutableRefObject<ResolutionSwitchState>;
  isWorkspaceHydrated?: boolean;
}

export interface UseMarketDataAndFeedReturn {
  // Catalog & Symbol / Resolution states
  catalog: ReplaySymbolCatalogItem[];
  selectedSymbol: string;
  setSelectedSymbol: React.Dispatch<React.SetStateAction<string>>;
  selectedSymbolRef: React.MutableRefObject<string>;
  selectedResolution: Resolution;
  setSelectedResolution: React.Dispatch<React.SetStateAction<Resolution>>;
  selectedResolutionRef: React.MutableRefObject<Resolution>;
  renderedResolutionRef: React.MutableRefObject<Resolution>;

  bars: MarketBar[];
  setBars: React.Dispatch<React.SetStateAction<MarketBar[]>>;
  barsRef: React.MutableRefObject<MarketBar[]>;
  rawBarsRef: React.MutableRefObject<MarketBar[]>;

  sessionMode: "regular" | "extended";
  setSessionMode: React.Dispatch<React.SetStateAction<"regular" | "extended">>;
  sessionModeRef: React.MutableRefObject<"regular" | "extended">;

  loading: boolean;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;

  // Timeframe watchdog & State machine
  isSwitchingResolutionOrSessionRef: React.MutableRefObject<boolean>;
  resolutionSwitchStateRef: React.MutableRefObject<ResolutionSwitchState>;
  clearResolutionWatchdog: () => void;

  // Real-time live feed subscriptions
  liveSubscriptions: LiveFeedSubscriptionItem[];
  liveSymbols: string[];
  upstreamConnected: boolean;

  // Handlers
  fetchCandles: (sym: string, res: Resolution) => Promise<void>;
  fetchCandlesForCell: (sym: string, res: Resolution) => Promise<MarketBar[]>;
  handleSessionChange: (newSession: "regular" | "extended") => Promise<void>;
  handleSelectResolution: (res: Resolution) => Promise<void>;
  handleSelectSymbol: (sym: string) => Promise<void>;
  syncAllCellsSymbol: (sym: string) => Promise<void>;
  syncAllCellsInterval: (res: Resolution) => Promise<void>;
  syncAllCellsStyle: (style?: string) => void;

  // WebSocket Live Feed Handlers
  handleLiveCandle: (sym: string, candle: MarketBar, candleRes?: string) => void;
  handleLiveTick: (sym: string, tick: LiveFeedTick) => void;
  handleLiveHistory: (
    sym: string,
    incomingBars: MarketBar[],
    historyRes?: string,
  ) => void;
}

export function useMarketDataAndFeed({
  chartRef,
  hostRef,
  topbarRef,
  bottombarRef,
  statuslineRef,
  watermarkRef,
  sidePanelsDockRef,
  layout,
  activeCellIndexRef,
  syncOptionsRef,
  secondaryCharts,
  secondaryCellsData,
  secondaryCellsVersion,
  bumpSecondaryCells,
  isReplayActive,
  isReplayActiveRef,
  isPlayingRef,
  replayCursorTimeRef,
  replaySpeedRef,
  setIsReplayActive,
  setIsPlaying,
  setReplayCursorTime,
  setReplayRemaining,
  triggerPaperTick,
  broadcastViewport,
  selectedSymbol,
  setSelectedSymbol,
  selectedSymbolRef,
  selectedResolution,
  setSelectedResolution,
  selectedResolutionRef,
  renderedResolutionRef,
  bars,
  setBars,
  barsRef,
  rawBarsRef,
  sessionMode,
  setSessionMode,
  sessionModeRef,
  isSwitchingResolutionOrSessionRef,
  resolutionSwitchStateRef,
  isWorkspaceHydrated,
}: UseMarketDataAndFeedParams): UseMarketDataAndFeedReturn {
  const [catalog, setCatalog] = useState<ReplaySymbolCatalogItem[]>(() => buildDefaultCatalog());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resolutionWatchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearResolutionWatchdog = useCallback(() => {
    if (resolutionWatchdogTimerRef.current) {
      clearTimeout(resolutionWatchdogTimerRef.current);
      resolutionWatchdogTimerRef.current = null;
    }
  }, []);

  const hasAppliedLiveHistoryRef = useRef<Set<string>>(new Set());

  // Real-time subscriptions derived from multi-chart layout
  const liveSubscriptions = useMemo<LiveFeedSubscriptionItem[]>(() => {
    const list: LiveFeedSubscriptionItem[] = [
      { symbol: selectedSymbol.toUpperCase(), resolution: selectedResolution },
    ];
    if (layout.rows * layout.cols > 1) {
      for (let i = 1; i < layout.rows * layout.cols; i++) {
        const secCell = secondaryCellsData.current.get(i);
        if (secCell && secCell.symbol) {
          const sym = secCell.symbol.toUpperCase();
          const res = secCell.resolution || "1m";
          if (!list.some((item) => item.symbol === sym && item.resolution === res)) {
            list.push({ symbol: sym, resolution: res });
          }
        }
      }
    }
    return list;
  }, [layout.cols, layout.rows, secondaryCellsData, secondaryCellsVersion, selectedResolution, selectedSymbol]);

  const liveSymbols = useMemo(() => {
    return Array.from(new Set(liveSubscriptions.map((s) => s.symbol)));
  }, [liveSubscriptions]);

  // Load historical candles
  const fetchRequestSeqRef = useRef<number>(0);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchCandles = useCallback(
    async (sym: string, res: Resolution) => {
      const requestId = ++fetchRequestSeqRef.current;
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      fetchAbortControllerRef.current = abortController;

      hasAppliedLiveHistoryRef.current.clear();
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          symbol: sym,
          resolution: res,
          limit: "2500",
        });

        const resHttp = await fetch(`/api/market-data/replay?${params}`, {
          signal: abortController.signal,
        });
        if (!resHttp.ok) {
          throw new Error("Failed to load historical candles for replay.");
        }
        const data: ReplayMarketDataResponse = await resHttp.json();
        if (requestId !== fetchRequestSeqRef.current) return;

        rawBarsRef.current = data.bars;
        const effective = filterCandlesBySession(data.bars, sessionModeRef.current, data.symbol);
        barsRef.current = effective;
        selectedSymbolRef.current = data.symbol;
        selectedResolutionRef.current = data.resolution;
        setBars(effective);
        if (effective.length) {
          const targetTime =
            isReplayActiveRef.current && typeof replayCursorTimeRef.current === "number"
              ? replayCursorTimeRef.current
              : effective[effective.length - 1]?.time;
          if (targetTime !== undefined) triggerPaperTick(targetTime, data.symbol);
        }
        setCatalog(data.symbols);
        setSelectedSymbol(data.symbol);
        setSelectedResolution(data.resolution);

        // Update session posture on bottombar
        bottombarRef.current?.setSession({
          enabled: isFuturesOrEquitySymbol(data.symbol),
          session: sessionModeRef.current,
        });

        // Push new market data to active Vela instance
        if (chartRef.current) {
          const isResSwitch = renderedResolutionRef.current !== data.resolution;
          const inner = getInnerRenderer(chartRef.current);
          const prevVp = inner?.coords?.getViewport?.();

          await chartRef.current.setMarket({
            timeframe: toVelaTf(data.resolution),
            data: effective,
          });
          renderedResolutionRef.current = data.resolution;

          chartRef.current.renderer?.set?.("autoScale", true);
          if (isResSwitch) {
            applyHealthyResolutionViewport(inner, data.resolution);
          } else if (prevVp && typeof inner?.applyViewport === "function") {
            inner.applyViewport({
              barSpacing: Math.max(4, Math.min(50, prevVp.barSpacing)),
              rightOffset: Math.max(-1000, Math.min(50, prevVp.rightOffset)),
            });
          } else {
            if (typeof inner?.resetView === "function") inner.resetView();
            else if (typeof (chartRef.current?.renderer as any)?.resetView === "function") {
              (chartRef.current.renderer as any).resetView();
            }
          }
          (chartRef.current as any).__rebindDrawingsPersistence?.(data.symbol);
          const isReplay = isReplayActiveRef.current;
          syncStatuslineAndWatermark(
            statuslineRef.current,
            watermarkRef.current,
            data.symbol,
            data.resolution,
            isReplay ? "Replay" : "Market Live",
            effective,
            isReplay ? "closed" : "open",
          );
          sidePanelsDockRef.current?.setSymbol?.(data.symbol);
          topbarRef.current?.setTimeframe?.(toVelaTf(data.resolution));
        }

        // Populate secondary cells sharing the same symbol & resolution
        let updatedSec = false;
        for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
          const cellData = secondaryCellsData.current.get(cellIndex);
          if (
            cellData &&
            cellData.bars.length === 0 &&
            cellData.symbol === data.symbol &&
            cellData.resolution === data.resolution
          ) {
            cellData.bars = effective;
            cellData.rawBars = data.bars;
            try {
              await secInst.setMarket({
                timeframe: toVelaTf(cellData.resolution),
                data: effective,
              });
              secInst.renderer?.set?.("autoScale", true);
              const isReplay = isReplayActiveRef.current;
              syncStatuslineAndWatermark(
                (secInst as any).__statusline,
                (secInst as any).__watermark,
                cellData.symbol,
                cellData.resolution,
                isReplay ? "Replay" : "Market Live",
                effective,
                isReplay ? "closed" : "open",
              );
              updatedSec = true;
            } catch {}
          }
        }
        if (updatedSec) bumpSecondaryCells();
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(err.message || "Error loading candles.");
      } finally {
        if (requestId === fetchRequestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [
      barsRef,
      bottombarRef,
      bumpSecondaryCells,
      chartRef,
      isReplayActiveRef,
      replayCursorTimeRef,
      secondaryCellsData,
      secondaryCharts,
      sidePanelsDockRef,
      statuslineRef,
      topbarRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const fetchCandlesForCell = useCallback(
    async (sym: string, res: Resolution): Promise<MarketBar[]> => {
      if (
        sym === selectedSymbolRef.current &&
        res === selectedResolutionRef.current &&
        barsRef.current.length > 0
      ) {
        return barsRef.current;
      }
      const params = new URLSearchParams({
        symbol: sym,
        resolution: res,
        limit: "2500",
      });
      const resHttp = await fetch(`/api/market-data/replay?${params}`);
      if (!resHttp.ok) {
        throw new Error(`Failed to load historical candles for ${sym} (${res})`);
      }
      const data: ReplayMarketDataResponse = await resHttp.json();
      return filterCandlesBySession(data.bars, sessionModeRef.current, data.symbol);
    },
    [barsRef],
  );

  const handleSessionChange = useCallback(
    async (newSession: "regular" | "extended") => {
      setSessionMode(newSession);
      sessionModeRef.current = newSession;
      try {
        const s = loadStoredSettings();
        saveStoredSettings({
          ...s,
          symbol: {
            ...s.symbol,
            sessions: {
              mode: newSession,
              premarketColor: s.symbol?.sessions?.premarketColor ?? "#ff980040",
              postmarketColor: s.symbol?.sessions?.postmarketColor ?? "#2962ff40",
            },
          },
        });
      } catch {}
      const curSym = selectedSymbolRef.current;
      const priorReplayActive = isReplayActiveRef.current;
      const priorCursorTime = replayCursorTimeRef.current;
      const priorIsPlaying = isPlayingRef.current;

      if (priorReplayActive) {
        isSwitchingResolutionOrSessionRef.current = true;
      }

      try {
        const effective = filterCandlesBySession(rawBarsRef.current, newSession, curSym);
        barsRef.current = effective;
        setBars(effective);
        if (chartRef.current) {
          await chartRef.current.setMarket({
            timeframe: toVelaTf(selectedResolutionRef.current),
            data: effective,
          });
          syncStatuslineAndWatermark(
            statuslineRef.current,
            watermarkRef.current,
            curSym,
            selectedResolutionRef.current,
            "Replay",
            effective,
          );
        }
        bottombarRef.current?.setSession({
          enabled: isFuturesOrEquitySymbol(curSym),
          session: newSession,
        });
        for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
          const cellData = secondaryCellsData.current.get(cellIndex);
          if (cellData && cellData.rawBars.length > 0) {
            const secEffective = filterCandlesBySession(cellData.rawBars, newSession, cellData.symbol);
            cellData.bars = secEffective;
            await secInst.setMarket({
              timeframe: toVelaTf(cellData.resolution),
              data: secEffective,
            });
          }
        }
        bumpSecondaryCells();

        if (priorReplayActive && priorCursorTime && chartRef.current) {
          try {
            await chartRef.current.replay.start({ from: priorCursorTime });
            setIsReplayActive(true);
            setReplayCursorTime(priorCursorTime);
            triggerPaperTick(priorCursorTime);
            setReplayRemaining(chartRef.current.replay.state?.remaining ?? 0);
            statuslineRef.current?.setReplaying?.(true);
            watermarkRef.current?.setReplaying?.(true);

            for (const secInst of secondaryCharts.current.values()) {
              try {
                await secInst.replay.start({ from: priorCursorTime });
                (secInst as any).__statusline?.setReplaying?.(true);
                (secInst as any).__watermark?.setReplaying?.(true);
              } catch {}
            }

            if (priorIsPlaying) {
              chartRef.current.replay.play(replaySpeedRef.current);
              for (const secInst of secondaryCharts.current.values()) {
                try {
                  secInst.replay.play(replaySpeedRef.current);
                } catch {}
              }
              setIsPlaying(true);
            }
          } catch (err) {
            console.error("[Replay] Failed to resume on session change:", err);
          }
        } else {
          triggerPaperTick();
        }
        if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
          requestAnimationFrame(() => {
            const activeId = activeCellIndexRef.current;
            const activeInst = activeId === 0 ? chartRef.current : secondaryCharts.current.get(activeId);
            broadcastViewport(activeId, activeInst?.getVisibleRange?.());
          });
        }
      } finally {
        isSwitchingResolutionOrSessionRef.current = false;
      }
    },
    [
      activeCellIndexRef,
      barsRef,
      bottombarRef,
      broadcastViewport,
      bumpSecondaryCells,
      chartRef,
      isPlayingRef,
      isReplayActiveRef,
      replayCursorTimeRef,
      replaySpeedRef,
      secondaryCellsData,
      secondaryCharts,
      setIsPlaying,
      setIsReplayActive,
      setReplayCursorTime,
      setReplayRemaining,
      statuslineRef,
      syncOptionsRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const syncAllCellsSymbol = useCallback(
    async (sym: string) => {
      hasAppliedLiveHistoryRef.current.clear();
      const priorReplayActive = isReplayActiveRef.current;
      const priorCursorTime = replayCursorTimeRef.current;
      const priorIsPlaying = isPlayingRef.current;
      if (activeCellIndexRef.current !== 0) {
        selectedSymbolRef.current = sym;
        setSelectedSymbol(sym);
        await fetchCandles(sym, selectedResolutionRef.current);
      }
      for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
        const cellData = secondaryCellsData.current.get(cellIndex);
        const cellRes = cellData?.resolution ?? selectedResolutionRef.current;
        try {
          const newBars = await fetchCandlesForCell(sym, cellRes);
          secondaryCellsData.current.set(cellIndex, {
            symbol: sym,
            resolution: cellRes,
            bars: newBars,
            rawBars: newBars,
            indicators: cellData?.indicators,
          });
          await secInst.setMarket({ data: newBars, timeframe: toVelaTf(cellRes) });
          (secInst as any).__symbol = sym;
          (secInst as any).__rebindDrawingsPersistence?.(sym);
          syncStatuslineAndWatermark(
            (secInst as any).__statusline,
            (secInst as any).__watermark,
            sym,
            cellRes,
            "Replay",
            newBars,
          );
          if (priorReplayActive && priorCursorTime) {
            try {
              await secInst.replay.start({ from: priorCursorTime });
              (secInst as any).__statusline?.setReplaying?.(true);
              (secInst as any).__watermark?.setReplaying?.(true);
              if (priorIsPlaying) secInst.replay.play(replaySpeedRef.current);
            } catch {}
          }
        } catch (e) {
          console.error(`Failed to sync symbol for pane ${cellIndex}:`, e);
        }
      }
      bumpSecondaryCells();
      triggerPaperTick(priorReplayActive ? (priorCursorTime ?? undefined) : undefined, sym);
      if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
        requestAnimationFrame(() => {
          const activeId = activeCellIndexRef.current;
          const activeInst = activeId === 0 ? chartRef.current : secondaryCharts.current.get(activeId);
          broadcastViewport(activeId, activeInst?.getVisibleRange?.());
        });
      }
    },
    [
      activeCellIndexRef,
      broadcastViewport,
      bumpSecondaryCells,
      chartRef,
      fetchCandles,
      fetchCandlesForCell,
      isPlayingRef,
      isReplayActiveRef,
      replayCursorTimeRef,
      replaySpeedRef,
      secondaryCellsData,
      secondaryCharts,
      syncOptionsRef,
      triggerPaperTick,
    ],
  );

  const syncAllCellsInterval = useCallback(
    async (res: Resolution) => {
      hasAppliedLiveHistoryRef.current.clear();
      const priorReplayActive = isReplayActiveRef.current;
      const priorCursorTime = replayCursorTimeRef.current;
      const priorIsPlaying = isPlayingRef.current;
      if (activeCellIndexRef.current !== 0) {
        selectedResolutionRef.current = res;
        setSelectedResolution(res);
        await fetchCandles(selectedSymbolRef.current, res);
      }
      for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
        const cellData = secondaryCellsData.current.get(cellIndex);
        const cellSym = cellData?.symbol ?? selectedSymbolRef.current;
        try {
          const newBars = await fetchCandlesForCell(cellSym, res);
          secondaryCellsData.current.set(cellIndex, {
            symbol: cellSym,
            resolution: res,
            bars: newBars,
            rawBars: newBars,
            indicators: cellData?.indicators,
          });
          await secInst.setMarket({ data: newBars, timeframe: toVelaTf(res) });
          (secInst as any).__renderedResolution = res;
          (secInst as any).__resolution = res;
          secInst.renderer?.set?.("autoScale", true);
          const secInner = getInnerRenderer(secInst);
          applyHealthyResolutionViewport(secInner, res);
          syncStatuslineAndWatermark(
            (secInst as any).__statusline,
            (secInst as any).__watermark,
            cellSym,
            res,
            "Replay",
            newBars,
          );
          if (priorReplayActive && priorCursorTime) {
            try {
              await secInst.replay.start({ from: priorCursorTime });
              (secInst as any).__statusline?.setReplaying?.(true);
              (secInst as any).__watermark?.setReplaying?.(true);
              if (priorIsPlaying) secInst.replay.play(replaySpeedRef.current);
            } catch {}
          }
        } catch (e) {
          console.error(`Failed to sync resolution for pane ${cellIndex}:`, e);
        }
      }
      bumpSecondaryCells();
      triggerPaperTick(priorReplayActive ? (priorCursorTime ?? undefined) : undefined);
      if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
        requestAnimationFrame(() => {
          const activeId = activeCellIndexRef.current;
          const activeInst = activeId === 0 ? chartRef.current : secondaryCharts.current.get(activeId);
          broadcastViewport(activeId, activeInst?.getVisibleRange?.());
        });
      }
    },
    [
      activeCellIndexRef,
      broadcastViewport,
      bumpSecondaryCells,
      chartRef,
      fetchCandles,
      fetchCandlesForCell,
      isPlayingRef,
      isReplayActiveRef,
      replayCursorTimeRef,
      replaySpeedRef,
      secondaryCellsData,
      secondaryCharts,
      syncOptionsRef,
      triggerPaperTick,
    ],
  );

  const syncAllCellsStyle = useCallback(
    (style?: string) => {
      const currentStored = loadStoredSettings();
      const targetStyle = style || currentStored.symbol?.priceStyle || "candles";
      for (const secInst of secondaryCharts.current.values()) {
        try {
          secInst.renderer?.set?.("priceStyle", targetStyle);
        } catch {}
      }
    },
    [secondaryCharts],
  );

  // Initial load: fetch candles and SQLite metadata for the active symbol & resolution
  // Waits until workspace storage is hydrated (if provided) to prevent racing and overwriting restored symbols.
  useEffect(() => {
    if (isWorkspaceHydrated === false) return;
    void fetchCandles(selectedSymbolRef.current, selectedResolutionRef.current);
  }, [isWorkspaceHydrated, fetchCandles, selectedSymbolRef, selectedResolutionRef]);

  // Live WebSocket Feed handlers
  const handleLiveCandle = useCallback(
    (sym: string, candle: MarketBar, candleRes?: string) => {
      if (isReplayActiveRef.current || isSwitchingResolutionOrSessionRef.current) return;
      const upperSym = sym.toUpperCase();

      // 1. Primary cell (0)
      const primaryRes = selectedResolutionRef.current;
      if (
        upperSym === selectedSymbolRef.current.toUpperCase() &&
        chartRef.current &&
        (!candleRes || matchResolution(candleRes, primaryRes))
      ) {
        const curBars = barsRef.current;
        const last = curBars[curBars.length - 1];
        if (last && candle.time === last.time) {
          const updated: MarketBar = {
            ...candle,
            open: candle.open !== undefined && !isNaN(candle.open) ? candle.open : last.open,
            high: Math.max(last.high, candle.high),
            low: Math.min(last.low, candle.low),
          };
          curBars[curBars.length - 1] = updated;
          injectLiveBarIntoVela(chartRef.current, updated);
          triggerPaperTick(updated.time, upperSym);
        } else if (!last || candle.time > last.time) {
          curBars.push(candle);
          if (rawBarsRef.current && rawBarsRef.current !== curBars) {
            rawBarsRef.current.push(candle);
          }
          injectLiveBarIntoVela(chartRef.current, candle);
          triggerPaperTick(candle.time, upperSym);
        } else if (last && candle.time < last.time) {
          const idx = curBars.findIndex((b) => b.time === candle.time);
          if (idx !== -1) curBars[idx] = candle;
        }
        syncStatuslineAndWatermark(
          statuslineRef.current,
          watermarkRef.current,
          upperSym,
          primaryRes,
          "Market Live",
          curBars,
          "open",
        );
      }

      // 2. Secondary cells (1..N)
      for (const [cellIdx, cellData] of secondaryCellsData.current.entries()) {
        const secRes = cellData.resolution;
        if (
          cellData.symbol?.toUpperCase() === upperSym &&
          (!candleRes || matchResolution(candleRes, secRes))
        ) {
          const secInst = secondaryCharts.current.get(cellIdx);
          if (secInst) {
            const curBars = cellData.bars;
            const last = curBars[curBars.length - 1];
            if (last && candle.time === last.time) {
              const updated: MarketBar = {
                ...candle,
                open: candle.open !== undefined && !isNaN(candle.open) ? candle.open : last.open,
                high: Math.max(last.high, candle.high),
                low: Math.min(last.low, candle.low),
              };
              curBars[curBars.length - 1] = updated;
              injectLiveBarIntoVela(secInst, updated);
              triggerPaperTick(updated.time, upperSym);
            } else if (!last || candle.time > last.time) {
              curBars.push(candle);
              if (cellData.rawBars && cellData.rawBars !== curBars) {
                cellData.rawBars.push(candle);
              }
              injectLiveBarIntoVela(secInst, candle);
              triggerPaperTick(candle.time, upperSym);
            } else if (last && candle.time < last.time) {
              const idx = curBars.findIndex((b) => b.time === candle.time);
              if (idx !== -1) curBars[idx] = candle;
            }
          }
        }
      }
    },
    [
      barsRef,
      chartRef,
      isReplayActiveRef,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      statuslineRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const handleLiveTick = useCallback(
    (sym: string, tick: LiveFeedTick) => {
      if (isReplayActiveRef.current || isSwitchingResolutionOrSessionRef.current) return;
      if (typeof tick.price !== "number") return;

      const upperSym = sym.toUpperCase();
      const tickTime = tick.time || Date.now();

      // 1. Primary cell (0)
      if (upperSym === selectedSymbolRef.current.toUpperCase() && chartRef.current) {
        const curBars = barsRef.current;
        const last = curBars[curBars.length - 1];
        const stepMs = resolutionToStepMs(selectedResolutionRef.current);
        if (last && tickTime < last.time + stepMs) {
          const updated: MarketBar = {
            ...last,
            high: Math.max(last.high, tick.price),
            low: Math.min(last.low, tick.price),
            close: tick.price,
          };
          curBars[curBars.length - 1] = updated;
          injectLiveBarIntoVela(chartRef.current, updated);
          triggerPaperTick(updated.time, upperSym);
          syncStatuslineAndWatermark(
            statuslineRef.current,
            watermarkRef.current,
            upperSym,
            selectedResolutionRef.current,
            "Market Live",
            curBars,
            "open",
          );
        } else if (last && tickTime >= last.time + stepMs) {
          const bucketTime =
            last.time + stepMs * Math.floor((tickTime - last.time) / stepMs);
          const newBar: MarketBar = {
            time: bucketTime,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: 1,
          };
          curBars.push(newBar);
          if (rawBarsRef.current && rawBarsRef.current !== curBars) {
            rawBarsRef.current.push(newBar);
          }
          injectLiveBarIntoVela(chartRef.current, newBar);
          triggerPaperTick(newBar.time, upperSym);
          syncStatuslineAndWatermark(
            statuslineRef.current,
            watermarkRef.current,
            upperSym,
            selectedResolutionRef.current,
            "Market Live",
            curBars,
            "open",
          );
        } else {
          triggerPaperTick(tickTime, upperSym);
        }
      }

      // 2. Secondary cells (1..N)
      for (const [cellIdx, cellData] of secondaryCellsData.current.entries()) {
        if (cellData.symbol?.toUpperCase() === upperSym) {
          const secInst = secondaryCharts.current.get(cellIdx);
          if (secInst) {
            const curBars = cellData.bars;
            const last = curBars[curBars.length - 1];
            const secStepMs = resolutionToStepMs(cellData.resolution);
            if (last && tickTime < last.time + secStepMs) {
              const updated: MarketBar = {
                ...last,
                high: Math.max(last.high, tick.price),
                low: Math.min(last.low, tick.price),
                close: tick.price,
              };
              curBars[curBars.length - 1] = updated;
              injectLiveBarIntoVela(secInst, updated);
              triggerPaperTick(updated.time, upperSym);
            } else if (last && tickTime >= last.time + secStepMs) {
              const bucketTime =
                last.time + secStepMs * Math.floor((tickTime - last.time) / secStepMs);
              const newBar: MarketBar = {
                time: bucketTime,
                open: tick.price,
                high: tick.price,
                low: tick.price,
                close: tick.price,
                volume: 1,
              };
              curBars.push(newBar);
              if (cellData.rawBars && cellData.rawBars !== curBars) {
                cellData.rawBars.push(newBar);
              }
              injectLiveBarIntoVela(secInst, newBar);
              triggerPaperTick(newBar.time, upperSym);
            } else {
              triggerPaperTick(tickTime, upperSym);
            }
          }
        }
      }
    },
    [
      barsRef,
      chartRef,
      isReplayActiveRef,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      statuslineRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const handleLiveHistory = useCallback(
    (sym: string, incomingBars: MarketBar[], historyRes?: string) => {
      if (
        isReplayActiveRef.current ||
        isSwitchingResolutionOrSessionRef.current
      ) {
        return;
      }
      if (!incomingBars || incomingBars.length === 0) return;

      const upperSym = sym.toUpperCase();

      // 1. Primary cell (0)
      if (
        upperSym === selectedSymbolRef.current.toUpperCase() &&
        chartRef.current &&
        (!historyRes || matchResolution(historyRes, selectedResolutionRef.current))
      ) {
        const histKey = `${upperSym}@${selectedResolutionRef.current}`;
        const alreadyApplied = hasAppliedLiveHistoryRef.current.has(histKey);

        if (!alreadyApplied || barsRef.current.length === 0) {
          hasAppliedLiveHistoryRef.current.add(histKey);
          rawBarsRef.current = [...incomingBars];
          const finalBars = filterCandlesBySession(
            incomingBars,
            sessionModeRef.current,
            upperSym
          );
          barsRef.current = finalBars;
          setBars(finalBars);

          const isResSwitch =
            renderedResolutionRef.current !== selectedResolutionRef.current;
          const innerBefore = getInnerRenderer(chartRef.current);
          const prevVp = innerBefore?.coords?.getViewport?.();

          void chartRef.current
            .setMarket({
              timeframe: toVelaTf(selectedResolutionRef.current),
              data: finalBars,
            })
            .then(() => {
              renderedResolutionRef.current = selectedResolutionRef.current;
              chartRef.current?.renderer?.set?.("autoScale", true);
              const inner = getInnerRenderer(chartRef.current);
              if (isResSwitch) {
                applyHealthyResolutionViewport(inner, selectedResolutionRef.current);
              } else if (prevVp && typeof inner?.applyViewport === "function") {
                inner.applyViewport({
                  barSpacing: Math.max(4, Math.min(50, prevVp.barSpacing)),
                  rightOffset: Math.max(-1000, Math.min(50, prevVp.rightOffset)),
                });
              } else if (typeof inner?.resetView === "function") {
                inner.resetView();
              } else if (typeof (chartRef.current?.renderer as any)?.resetView === "function") {
                (chartRef.current?.renderer as any)?.resetView?.();
              }
              isSwitchingResolutionOrSessionRef.current = false;
              resolutionSwitchStateRef.current.status = "idle";
              clearResolutionWatchdog();
              watermarkRef.current?.setLoading?.(false);
            });

          const lastBar = finalBars[finalBars.length - 1];
          if (lastBar) triggerPaperTick(lastBar.time, upperSym);
          syncStatuslineAndWatermark(
            statuslineRef.current,
            watermarkRef.current,
            upperSym,
            selectedResolutionRef.current,
            "Market Live",
            finalBars,
            "open",
          );
        } else {
          const curRaw = rawBarsRef.current.length > 0 ? rawBarsRef.current : barsRef.current;
          const mergedRaw = mergeBars(curRaw, incomingBars);
          rawBarsRef.current = mergedRaw;
          const merged = filterCandlesBySession(
            mergedRaw,
            sessionModeRef.current,
            upperSym
          );
          barsRef.current = merged;

          const latestBar = merged[merged.length - 1];
          if (latestBar) {
            injectLiveBarIntoVela(chartRef.current, latestBar);
            triggerPaperTick(latestBar.time, upperSym);
          }
        }
      }

      // 2. Secondary cells (1..N)
      for (const [cellIdx, cellData] of secondaryCellsData.current.entries()) {
        if (
          cellData.symbol?.toUpperCase() === upperSym &&
          (!historyRes || matchResolution(historyRes, cellData.resolution))
        ) {
          const secKey = `sec-${cellIdx}-${upperSym}@${cellData.resolution}`;
          const secApplied = hasAppliedLiveHistoryRef.current.has(secKey);
          const secInst = secondaryCharts.current.get(cellIdx);

          if (!secApplied || cellData.bars.length === 0) {
            cellData.rawBars = [...incomingBars];
            const finalBars = filterCandlesBySession(
              incomingBars,
              sessionModeRef.current,
              upperSym
            );
            cellData.bars = finalBars;

            if (secInst) {
              hasAppliedLiveHistoryRef.current.add(secKey);
              (secInst as any).__symbol = upperSym;
              (secInst as any).__lastBar = finalBars[finalBars.length - 1];
              const isSecResSwitch =
                (secInst as any).__renderedResolution !== cellData.resolution;
              const secInnerBefore = getInnerRenderer(secInst);
              const secPrevVp = secInnerBefore?.coords?.getViewport?.();

              void secInst
                .setMarket({
                  timeframe: toVelaTf(cellData.resolution),
                  data: finalBars,
                })
                .then(() => {
                  (secInst as any).__renderedResolution = cellData.resolution;
                  secInst.renderer?.set?.("autoScale", true);
                  const secInner = getInnerRenderer(secInst);
                  if (isSecResSwitch) {
                    applyHealthyResolutionViewport(secInner, cellData.resolution);
                  } else if (secPrevVp && typeof secInner?.applyViewport === "function") {
                    secInner.applyViewport({
                      barSpacing: Math.max(4, Math.min(50, secPrevVp.barSpacing)),
                      rightOffset: Math.max(-1000, Math.min(50, secPrevVp.rightOffset)),
                    });
                  } else if (typeof secInner?.resetView === "function") {
                    secInner.resetView();
                  } else if (typeof (secInst?.renderer as any)?.resetView === "function") {
                    (secInst?.renderer as any).resetView();
                  }
                  if (activeCellIndexRef.current === cellIdx) {
                    isSwitchingResolutionOrSessionRef.current = false;
                    resolutionSwitchStateRef.current.status = "idle";
                    clearResolutionWatchdog();
                  }
                  (secInst as any).__watermark?.setLoading?.(false);
                });
              const lastBar = finalBars[finalBars.length - 1];
              if (lastBar) triggerPaperTick(lastBar.time, upperSym);
              syncStatuslineAndWatermark(
                (secInst as any).__statusline,
                (secInst as any).__watermark,
                upperSym,
                cellData.resolution,
                "Market Live",
                finalBars,
                "open",
                secInst,
              );
            }
          } else {
            const curRaw = cellData.rawBars.length > 0 ? cellData.rawBars : cellData.bars;
            const mergedRaw = mergeBars(curRaw, incomingBars);
            cellData.rawBars = mergedRaw;
            const merged = filterCandlesBySession(
              mergedRaw,
              sessionModeRef.current,
              upperSym
            );
            cellData.bars = merged;

            const latestBar = merged[merged.length - 1];
            if (latestBar && secInst) {
              injectLiveBarIntoVela(secInst, latestBar);
              triggerPaperTick(latestBar.time, upperSym);
            }
          }
        }
      }
    },
    [
      activeCellIndexRef,
      barsRef,
      rawBarsRef,
      chartRef,
      clearResolutionWatchdog,
      isReplayActiveRef,
      isSwitchingResolutionOrSessionRef,
      sessionModeRef,
      setBars,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      statuslineRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const handleLiveStatusChange = useCallback(
    (connected: boolean) => {
      if (connected && !isReplayActiveRef.current) {
        statuslineRef.current?.setMarketStatus?.("open");
      }
    },
    [isReplayActiveRef, statuslineRef],
  );

  const liveFeed = useLiveMarketFeed({
    enabled: !isReplayActive,
    symbols: liveSymbols,
    subscriptions: liveSubscriptions,
    resolution: selectedResolution,
    onCandle: handleLiveCandle,
    onHistory: handleLiveHistory,
    onTick: handleLiveTick,
    onStatusChange: handleLiveStatusChange,
  });

  const handleSelectResolution = useCallback(
    async (res: Resolution) => {
      const currentActive = activeCellIndexRef.current;
      const curSym =
        currentActive === 0
          ? selectedSymbolRef.current
          : (secondaryCellsData.current.get(currentActive)?.symbol ?? selectedSymbolRef.current);
      const curRes =
        currentActive === 0
          ? selectedResolutionRef.current
          : (secondaryCellsData.current.get(currentActive)?.resolution ?? selectedResolutionRef.current);
      const priorReplayActive = isReplayActiveRef.current;
      const priorCursorTime = replayCursorTimeRef.current;
      const priorIsPlaying = isPlayingRef.current;

      if (!syncOptionsRef.current.interval && res === curRes && barsRef.current.length > 0) {
        return;
      }
      if (
        resolutionSwitchStateRef.current.status === "switching" &&
        resolutionSwitchStateRef.current.targetResolution === res &&
        resolutionSwitchStateRef.current.cellIndex === currentActive
      ) {
        return;
      }

      clearResolutionWatchdog();
      resolutionSwitchStateRef.current = {
        status: "switching",
        targetResolution: res,
        targetSymbol: curSym,
        cellIndex: currentActive,
        startedAt: Date.now(),
      };
      isSwitchingResolutionOrSessionRef.current = true;
      topbarRef.current?.setTimeframe?.(toVelaTf(res));

      try {
        if (!priorReplayActive && liveFeed.isConnected) {
          resolutionWatchdogTimerRef.current = setTimeout(async () => {
            resolutionWatchdogTimerRef.current = null;
            try {
              if (currentActive === 0 || syncOptionsRef.current.interval) {
                await fetchCandles(curSym, res);
              } else {
                const secInst = secondaryCharts.current.get(currentActive);
                if (secInst) {
                  const cellData = secondaryCellsData.current.get(currentActive);
                  const cellSym = cellData?.symbol ?? curSym;
                  const newBars = await fetchCandlesForCell(cellSym, res);
                  if (cellData) {
                    cellData.resolution = res;
                    cellData.bars = newBars;
                    cellData.rawBars = newBars;
                  }
                  await secInst.setMarket({ data: newBars, timeframe: toVelaTf(res) });
                  (secInst as any).__renderedResolution = res;
                  (secInst as any).__resolution = res;
                  secInst.renderer?.set?.("autoScale", true);
                  const secInner = getInnerRenderer(secInst);
                  applyHealthyResolutionViewport(secInner, res);
                }
              }
            } catch (fallbackErr) {
              console.error("[ResolutionSwitch] Live Watchdog fallback failed:", fallbackErr);
            } finally {
              isSwitchingResolutionOrSessionRef.current = false;
              resolutionSwitchStateRef.current.status = "idle";
              watermarkRef.current?.setLoading?.(false);
              for (const secInst of secondaryCharts.current.values()) {
                (secInst as any).__watermark?.setLoading?.(false);
              }
            }
          }, 3000);

          if (syncOptionsRef.current.interval) {
            if (res !== curRes || barsRef.current.length === 0) {
              selectedResolutionRef.current = res;
              setSelectedResolution(res);
              hasAppliedLiveHistoryRef.current.delete(`${curSym}@${res}`);
              liveFeed.subscribe(curSym, res);
              watermarkRef.current?.setLoading?.(true);
            }
            for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
              const cellData = secondaryCellsData.current.get(cellIndex);
              const cellSym = cellData?.symbol ?? curSym;
              if (cellData) cellData.resolution = res;
              (secInst as any).__resolution = res;
              (secInst as any).__watermark?.setLoading?.(true);
              hasAppliedLiveHistoryRef.current.delete(`sec-${cellIndex}-${cellSym}@${res}`);
              liveFeed.subscribe(cellSym, res);
            }
            bumpSecondaryCells();
          } else {
            if (currentActive === 0) {
              if (res !== curRes || barsRef.current.length === 0) {
                selectedResolutionRef.current = res;
                setSelectedResolution(res);
                hasAppliedLiveHistoryRef.current.delete(`${curSym}@${res}`);
                liveFeed.subscribe(curSym, res);
                watermarkRef.current?.setLoading?.(true);
              }
            } else {
              const secInst = secondaryCharts.current.get(currentActive);
              if (secInst) {
                const cellData = secondaryCellsData.current.get(currentActive);
                const cellSym = cellData?.symbol ?? curSym;
                if (cellData) cellData.resolution = res;
                (secInst as any).__resolution = res;
                (secInst as any).__watermark?.setLoading?.(true);
                hasAppliedLiveHistoryRef.current.delete(`sec-${currentActive}-${cellSym}@${res}`);
                liveFeed.subscribe(cellSym, res);
                bumpSecondaryCells();
              }
            }
          }
          triggerPaperTick();
        } else {
          // Replay Mode or Offline
          resolutionWatchdogTimerRef.current = setTimeout(() => {
            isSwitchingResolutionOrSessionRef.current = false;
            resolutionSwitchStateRef.current.status = "idle";
            watermarkRef.current?.setLoading?.(false);
          }, 3000);

          if (syncOptionsRef.current.interval) {
            if (res !== curRes || barsRef.current.length === 0) {
              selectedResolutionRef.current = res;
              setSelectedResolution(res);
              await fetchCandles(curSym, res);
            }
            for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
              const cellData = secondaryCellsData.current.get(cellIndex);
              const cellSym = cellData?.symbol ?? curSym;
              try {
                const newBars = await fetchCandlesForCell(cellSym, res);
                secondaryCellsData.current.set(cellIndex, {
                  symbol: cellSym,
                  resolution: res,
                  bars: newBars,
                  rawBars: newBars,
                  indicators: cellData?.indicators,
                });
                await secInst.setMarket({ data: newBars, timeframe: toVelaTf(res) });
                (secInst as any).__renderedResolution = res;
                (secInst as any).__resolution = res;
                secInst.renderer?.set?.("autoScale", true);
                const secInner = getInnerRenderer(secInst);
                applyHealthyResolutionViewport(secInner, res);
                syncStatuslineAndWatermark(
                  (secInst as any).__statusline,
                  (secInst as any).__watermark,
                  cellSym,
                  res,
                  priorReplayActive ? "Replay" : "Market Live",
                  newBars,
                  priorReplayActive ? "closed" : "open",
                );
              } catch (e) {
                console.error(`Failed to update resolution for pane ${cellIndex}:`, e);
              }
            }
            bumpSecondaryCells();
          } else {
            if (currentActive === 0) {
              if (res !== curRes || barsRef.current.length === 0) {
                selectedResolutionRef.current = res;
                setSelectedResolution(res);
                await fetchCandles(curSym, res);
              }
            } else {
              const secInst = secondaryCharts.current.get(currentActive);
              if (secInst) {
                const cellData = secondaryCellsData.current.get(currentActive);
                const cellSym = cellData?.symbol ?? curSym;
                try {
                  const newBars = await fetchCandlesForCell(cellSym, res);
                  secondaryCellsData.current.set(currentActive, {
                    symbol: cellSym,
                    resolution: res,
                    bars: newBars,
                    rawBars: newBars,
                    indicators: cellData?.indicators,
                  });
                  await secInst.setMarket({ data: newBars, timeframe: toVelaTf(res) });
                  (secInst as any).__renderedResolution = res;
                  (secInst as any).__resolution = res;
                  secInst.renderer?.set?.("autoScale", true);
                  const secInner = getInnerRenderer(secInst);
                  applyHealthyResolutionViewport(secInner, res);
                  syncStatuslineAndWatermark(
                    (secInst as any).__statusline,
                    (secInst as any).__watermark,
                    cellSym,
                    res,
                    priorReplayActive ? "Replay" : "Market Live",
                    newBars,
                    priorReplayActive ? "closed" : "open",
                  );
                  bumpSecondaryCells();
                } catch (e) {
                  console.error(`Failed to update resolution for pane ${currentActive}:`, e);
                }
              }
            }
          }

          if (priorReplayActive && priorCursorTime && chartRef.current) {
            try {
              await chartRef.current.replay.start({ from: priorCursorTime });
              setIsReplayActive(true);
              setReplayCursorTime(priorCursorTime);
              triggerPaperTick(priorCursorTime);
              setReplayRemaining(chartRef.current.replay.state?.remaining ?? 0);
              statuslineRef.current?.setReplaying?.(true);
              watermarkRef.current?.setReplaying?.(true);

              if (syncOptionsRef.current.interval) {
                for (const secInst of secondaryCharts.current.values()) {
                  try {
                    await secInst.replay.start({ from: priorCursorTime });
                    (secInst as any).__statusline?.setReplaying?.(true);
                    (secInst as any).__watermark?.setReplaying?.(true);
                  } catch {}
                }
              } else if (currentActive !== 0) {
                const secInst = secondaryCharts.current.get(currentActive);
                if (secInst) {
                  try {
                    await secInst.replay.start({ from: priorCursorTime });
                    (secInst as any).__statusline?.setReplaying?.(true);
                    (secInst as any).__watermark?.setReplaying?.(true);
                  } catch {}
                }
              }

              if (priorIsPlaying) {
                chartRef.current.replay.play(replaySpeedRef.current);
                if (syncOptionsRef.current.interval) {
                  for (const secInst of secondaryCharts.current.values()) {
                    try {
                      secInst.replay.play(replaySpeedRef.current);
                    } catch {}
                  }
                } else if (currentActive !== 0) {
                  const secInst = secondaryCharts.current.get(currentActive);
                  if (secInst) {
                    try {
                      secInst.replay.play(replaySpeedRef.current);
                    } catch {}
                  }
                }
                setIsPlaying(true);
              }
            } catch (err) {
              console.error("[Replay] Failed to resume on new timeframe:", err);
            }
          } else {
            triggerPaperTick();
          }
        }

        if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
          requestAnimationFrame(() => {
            if (isSwitchingResolutionOrSessionRef.current) return;
            const activeInst = currentActive === 0 ? chartRef.current : secondaryCharts.current.get(currentActive);
            broadcastViewport(currentActive, activeInst?.getVisibleRange?.());
          });
        }
      } catch (err: any) {
        console.error("[ResolutionSwitch] Error during resolution switch:", err);
        setError(err?.message || "Failed to switch timeframe.");
      } finally {
        if (priorReplayActive || !liveFeed.isConnected) {
          clearResolutionWatchdog();
          isSwitchingResolutionOrSessionRef.current = false;
          resolutionSwitchStateRef.current.status = "idle";
          watermarkRef.current?.setLoading?.(false);
        }
      }
    },
    [
      activeCellIndexRef,
      barsRef,
      broadcastViewport,
      bumpSecondaryCells,
      chartRef,
      clearResolutionWatchdog,
      fetchCandles,
      fetchCandlesForCell,
      isPlayingRef,
      isReplayActiveRef,
      liveFeed,
      replayCursorTimeRef,
      replaySpeedRef,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      setIsPlaying,
      setIsReplayActive,
      setReplayCursorTime,
      setReplayRemaining,
      statuslineRef,
      syncOptionsRef,
      topbarRef,
      triggerPaperTick,
      watermarkRef,
    ],
  );

  const handleSelectSymbol = useCallback(
    async (sym: string) => {
      const currentActive = activeCellIndexRef.current;
      const curSym = selectedSymbolRef.current;
      const curRes = selectedResolutionRef.current;
      const priorReplayActive = isReplayActiveRef.current;

      if (priorReplayActive) {
        isSwitchingResolutionOrSessionRef.current = true;
      }

      try {
        if (syncOptionsRef.current.symbol) {
          if (sym !== curSym) {
            try {
              selectedSymbolRef.current = sym;
              setSelectedSymbol(sym);
              await fetchCandles(sym, curRes);
            } catch (err) {
              console.error(`Failed to fetch candles for ${sym}:`, err);
              if (hostRef.current) {
                showVelaToast(`Could not load market data for ${sym}.`, "error", hostRef.current);
              }
            }
          }
          for (const [cellIndex, secInst] of secondaryCharts.current.entries()) {
            const cellData = secondaryCellsData.current.get(cellIndex);
            const cellRes = cellData?.resolution ?? curRes;
            try {
              const newBars = await fetchCandlesForCell(sym, cellRes);
              secondaryCellsData.current.set(cellIndex, {
                symbol: sym,
                resolution: cellRes,
                bars: newBars,
                rawBars: newBars,
                indicators: cellData?.indicators,
              });
              await secInst.setMarket({ data: newBars, timeframe: toVelaTf(cellRes) });
              (secInst as any).__symbol = sym;
              (secInst as any).__rebindDrawingsPersistence?.(sym);
              syncStatuslineAndWatermark(
                (secInst as any).__statusline,
                (secInst as any).__watermark,
                sym,
                cellRes,
                priorReplayActive ? "Replay" : "Market Live",
                newBars,
              );
              if (!priorReplayActive && liveFeed.isConnected) {
                liveFeed.subscribe(sym, cellRes);
              }
            } catch (e) {
              console.error(`Failed to update symbol for pane ${cellIndex}:`, e);
            }
          }
          bumpSecondaryCells();
        } else {
          if (currentActive === 0) {
            if (sym !== curSym) {
              try {
                selectedSymbolRef.current = sym;
                setSelectedSymbol(sym);
                await fetchCandles(sym, curRes);
                if (!priorReplayActive && liveFeed.isConnected) {
                  liveFeed.subscribe(sym, curRes);
                }
              } catch (err) {
                console.error(`Failed to fetch candles for ${sym}:`, err);
                if (hostRef.current) {
                  showVelaToast(`Could not load market data for ${sym}.`, "error", hostRef.current);
                }
              }
            }
          } else {
            const secInst = secondaryCharts.current.get(currentActive);
            if (secInst) {
              const cellData = secondaryCellsData.current.get(currentActive);
              const cellRes = cellData?.resolution ?? curRes;
              try {
                const newBars = await fetchCandlesForCell(sym, cellRes);
                secondaryCellsData.current.set(currentActive, {
                  symbol: sym,
                  resolution: cellRes,
                  bars: newBars,
                  rawBars: newBars,
                  indicators: cellData?.indicators,
                });
                await secInst.setMarket({ data: newBars, timeframe: toVelaTf(cellRes) });
                (secInst as any).__symbol = sym;
                (secInst as any).__rebindDrawingsPersistence?.(sym);
                syncStatuslineAndWatermark(
                  (secInst as any).__statusline,
                  (secInst as any).__watermark,
                  sym,
                  cellRes,
                  priorReplayActive ? "Replay" : "Market Live",
                  newBars,
                );
                if (!priorReplayActive && liveFeed.isConnected) {
                  liveFeed.subscribe(sym, cellRes);
                }
                bumpSecondaryCells();
              } catch (e) {
                console.error(`Failed to update symbol for pane ${currentActive}:`, e);
              }
            }
          }
        }
      } finally {
        isSwitchingResolutionOrSessionRef.current = false;
      }
    },
    [
      activeCellIndexRef,
      bumpSecondaryCells,
      fetchCandles,
      fetchCandlesForCell,
      hostRef,
      isReplayActiveRef,
      liveFeed,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      syncOptionsRef,
    ],
  );

  return {
    catalog,
    selectedSymbol,
    setSelectedSymbol,
    selectedSymbolRef,
    selectedResolution,
    setSelectedResolution,
    selectedResolutionRef,
    renderedResolutionRef,
    bars,
    setBars,
    barsRef,
    rawBarsRef,
    sessionMode,
    setSessionMode,
    sessionModeRef,
    loading,
    error,
    setError,
    isSwitchingResolutionOrSessionRef,
    resolutionSwitchStateRef,
    clearResolutionWatchdog,
    liveSubscriptions,
    liveSymbols,
    upstreamConnected: liveFeed.upstreamConnected,
    fetchCandles,
    fetchCandlesForCell,
    handleSessionChange,
    handleSelectResolution,
    handleSelectSymbol,
    syncAllCellsSymbol,
    syncAllCellsInterval,
    syncAllCellsStyle,
    handleLiveCandle,
    handleLiveTick,
    handleLiveHistory,
  };
}
