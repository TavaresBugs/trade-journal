import { useEffect } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import type { LayoutShape } from "@luxalgo/vela/widget";
import {
  showVelaToast,
  enhanceVelaContextMenu,
  registerCopyPriceAction,
} from "@luxalgo/vela/widget";
import {
  getInnerRenderer,
  applyStoredSettingsToChart,
  loadStoredSettings,
  attachVelaReplayFutureShading,
  patchRendererWhitespaceCrosshair,
} from "@luxalgo/vela/workspace";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";
import { getPaperInstrumentSpec, formatPrice as formatPaperPrice } from "@/lib/paper-trading/symbol-specs";
import { alertsStore } from "@/lib/alerts/alerts-store";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";
import type { MarketBar, Resolution } from "@/lib/market-data";
import type { PersistedIndicatorInstance } from "@/lib/replay/workspace-persistence";
import {
  attachVelaDrawingsPersistence,
  loadLocalDrawings,
} from "../../drawings/market-drawings-persistence";
import {
  fromVelaTf,
  normalizeChartTimezone,
  syncStatuslineAndWatermark,
  toVelaTf,
} from "../../utils/market-chart-utils";
import type { UseMarketTerminalRefsReturn } from "../use-market-terminal-refs";

export interface UseMarketSecondaryCellsMountParams {
  refs: UseMarketTerminalRefsReturn;
  layout: LayoutShape;
  activeDrawingToolRef: React.MutableRefObject<string | null>;
  cellListenersRef: React.MutableRefObject<Set<(e: any) => void>>;

  fetchCandlesForCell: (sym: string, res: Resolution) => Promise<MarketBar[]>;
  broadcastCrosshair: (sourceId: number, time: number | null, price?: number | null) => void;
  broadcastTimeClick: (sourceId: number, clickTime: number) => void;
  broadcastViewport: (sourceId: number, range?: any) => void;
  handleStartReplay: (cutTime: number, sourceCellId?: number) => Promise<void>;
  handleActivateCell: (cellIndex: number) => void;
  extractCanonicalIndicatorSlugs: (chart: any) => string[];
  extractChartIndicatorConfigs: (chart: any) => PersistedIndicatorInstance[];
  hydrateChartIndicatorsSilently: (chart: any, items: any[]) => Promise<void>;
  openSettingsModal: (cellIndex?: number, section?: string) => void;
  openSymbolSearch: () => void;
  handleSelectSymbolForCell: (sym: string, cellIndex: number) => Promise<void>;
  handleSelectResolutionForCell: (res: Resolution, cellIndex: number) => Promise<void>;
  persistAndApplyTimezone: (zone: string, inst?: any) => void;
}

export function useMarketSecondaryCellsMount({
  refs,
  layout,
  activeDrawingToolRef,
  cellListenersRef,
  fetchCandlesForCell,
  broadcastCrosshair,
  broadcastTimeClick,
  broadcastViewport,
  handleStartReplay,
  handleActivateCell,
  extractCanonicalIndicatorSlugs,
  extractChartIndicatorConfigs,
  hydrateChartIndicatorsSilently,
  openSettingsModal,
  openSymbolSearch,
  handleSelectSymbolForCell,
  handleSelectResolutionForCell,
  persistAndApplyTimezone,
}: UseMarketSecondaryCellsMountParams) {
  const {
    secondaryHosts,
    secondaryCharts,
    secondaryCellsData,
    bumpSecondaryCells,
    chartRef,
    selectedSymbolRef,
    selectedResolutionRef,
    barsRef,
    rawBarsRef,
    syncOptionsRef,
    isSelectingCutPointRef,
    isReplayActiveRef,
    replayCursorTimeRef,
    cellTrackerRef,
  } = refs;

  // Unmount cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [idx, secInst] of secondaryCharts.current.entries()) {
        try {
          (secInst as any).__cleanupListeners?.();
          (secInst as any).__statusline?.destroy?.();
          (secInst as any).__watermark?.destroy?.();
          secInst.destroy?.();
        } catch {}
        secondaryCharts.current.delete(idx);
        cellListenersRef.current.forEach((h) => h({ kind: "destroyed", id: `cell-${idx}` }));
      }
    };
  }, []);

  // Multi-chart layout instantiation & sync
  useEffect(() => {
    const totalCells = layout.rows * layout.cols;
    if (totalCells <= 1) {
      let changed = false;
      for (const [idx, secInst] of secondaryCharts.current.entries()) {
        try {
          (secInst as any).__cleanupListeners?.();
          (secInst as any).__statusline?.destroy?.();
          (secInst as any).__watermark?.destroy?.();
          secInst.destroy?.();
        } catch {}
        secondaryCharts.current.delete(idx);
        cellListenersRef.current.forEach((h) => h({ kind: "destroyed", id: `cell-${idx}` }));
        changed = true;
      }
      if (changed) bumpSecondaryCells();
      return;
    }

    let disposed = false;

    void (async () => {
      const [
        { Vela, DARK_THEME, LIGHT_THEME },
        { Statusline, Watermark, ChartContextMenu },
      ] = await Promise.all([import("@luxalgo/vela"), import("@luxalgo/vela/widget")]);

      if (disposed) return;
      const dark = () => document.documentElement.classList.contains("dark");
      const currentStored = loadStoredSettings();
      const initialPriceStyle = currentStored.symbol?.priceStyle || "candles";
      const initialTz = normalizeChartTimezone(currentStored.symbol?.timezone);

      // Clean up charts beyond totalCells
      let removedAny = false;
      for (const [idx, secInst] of secondaryCharts.current.entries()) {
        if (idx >= totalCells) {
          try {
            (secInst as any).__cleanupListeners?.();
            (secInst as any).__statusline?.destroy?.();
            (secInst as any).__watermark?.destroy?.();
            secInst.destroy?.();
          } catch {}
          secondaryCharts.current.delete(idx);
          cellListenersRef.current.forEach((h) => h({ kind: "destroyed", id: `cell-${idx}` }));
          removedAny = true;
        }
      }
      if (removedAny) bumpSecondaryCells();

      for (let cellIndex = 1; cellIndex < totalCells; cellIndex++) {
        const hostEl = secondaryHosts.current.get(cellIndex);
        if (!hostEl || secondaryCharts.current.has(cellIndex)) continue;

        let cellData = secondaryCellsData.current.get(cellIndex);
        if (!cellData) {
          cellData = {
            symbol: selectedSymbolRef.current,
            resolution: selectedResolutionRef.current,
            bars: [...barsRef.current],
            rawBars: [...rawBarsRef.current],
          };
          secondaryCellsData.current.set(cellIndex, cellData);
        } else if (
          cellData.bars.length === 0 &&
          cellData.symbol.toUpperCase() === selectedSymbolRef.current.toUpperCase() &&
          cellData.resolution === selectedResolutionRef.current &&
          barsRef.current.length > 0
        ) {
          cellData.bars = [...barsRef.current];
          cellData.rawBars = [...rawBarsRef.current];
        }

        if (cellData.bars.length === 0) {
          try {
            const fetchedBars = await fetchCandlesForCell(cellData.symbol, cellData.resolution);
            if (!disposed && fetchedBars.length > 0) {
              cellData.bars = fetchedBars;
              cellData.rawBars = fetchedBars;
            }
          } catch (err) {
            console.warn(`[Replay] Failed to fetch initial candles for secondary cell ${cellIndex}:`, err);
          }
        }

        const secInst = new (Vela as any)(
          hostEl,
          {
            symbol: cellData.symbol,
            timeframe: toVelaTf(cellData.resolution),
            data: cellData.bars,
            live: false,
            theme: dark() ? DARK_THEME : LIGHT_THEME,
            priceStyle: initialPriceStyle,
            volume: true,
            drawings: { toolbar: false },
          },
          {
            dataFeed: {
              load: async (m: any) =>
                m?.data?.length ? m.data : secondaryCellsData.current.get(cellIndex)?.bars || [],
            },
          },
        ) as Vela;

        try {
          await (secInst as any).ready?.();
        } catch {}

        if (disposed) {
          try { secInst.destroy?.(); } catch {}
          return;
        }

        const unregSecCellTracker = cellTrackerRef.current.registerCell({
          id: String(cellIndex),
          host: hostEl,
          symbol: cellData.symbol,
          resolution: cellData.resolution,
          chart: secInst,
        });

        try {
          secInst.addNativeIndicator("volume");
        } catch {}

        try {
          const { PineWorkerEngine, PineEngine } = await import("@luxalgo/vela-pinets");
          try {
            secInst.registerEngine("pine", new PineWorkerEngine());
          } catch {
            secInst.registerEngine("pine", new PineEngine());
          }
        } catch (err) {
          console.warn("[vela] failed to register pine engine on secInst:", err);
        }

        let isHydratingSecIndicators = false;
        const syncSecIndicators = () => {
          if (isHydratingSecIndicators) return;
          try {
            const cData = secondaryCellsData.current.get(cellIndex);
            if (cData) {
              cData.indicators = extractCanonicalIndicatorSlugs(secInst);
              cData.indicatorConfigs = extractChartIndicatorConfigs(secInst);
              bumpSecondaryCells();
            }
          } catch {}
        };
        try {
          secInst.on("indicator:added", syncSecIndicators);
          secInst.on("indicator:removed", syncSecIndicators);
          secInst.on("indicator:inputs", syncSecIndicators);
          secInst.on("indicator:visibility", syncSecIndicators);
          secInst.on("indicator:moved", syncSecIndicators);
        } catch {}

        const itemsToRestore =
          cellData.indicatorConfigs && cellData.indicatorConfigs.length > 0
            ? cellData.indicatorConfigs
            : cellData.indicators;
        if (itemsToRestore && itemsToRestore.length > 0) {
          isHydratingSecIndicators = true;
          try {
            await hydrateChartIndicatorsSilently(secInst, itemsToRestore);
          } finally {
            isHydratingSecIndicators = false;
          }
          syncSecIndicators();
        }

        const secDrawingsKey = `replay-cell${cellIndex}-${cellData.symbol}`;
        let secDrawingsCleanup = attachVelaDrawingsPersistence(
          secInst,
          secDrawingsKey,
          {
            syncRemote: true,
            initialDrawingsJson:
              loadLocalDrawings(secDrawingsKey) ??
              localStorage.getItem(`tradejournal_replay_drawings_cell${cellIndex}_${cellData.symbol}`),
          },
        );
        (secInst as any).__rebindDrawingsPersistence = (newSym: string) => {
          try {
            secDrawingsCleanup();
          } catch {}
          try {
            (secInst as any).drawings?.clear?.();
          } catch {}
          const nextSecKey = `replay-cell${cellIndex}-${newSym}`;
          secDrawingsCleanup = attachVelaDrawingsPersistence(secInst, nextSecKey, {
            syncRemote: true,
            initialDrawingsJson:
              loadLocalDrawings(nextSecKey) ??
              localStorage.getItem(`tradejournal_replay_drawings_cell${cellIndex}_${newSym}`),
          });
        };

        try {
          secInst.renderer?.set?.("timezone", initialTz);
          secInst.renderer?.applyConfig?.({ timeScale: { timezone: initialTz } });
          secInst.renderer?.set?.("priceStyle", initialPriceStyle);
          applyStoredSettingsToChart(secInst, null, null, currentStored);
        } catch {}

        if (cellData.bars.length > 0) {
          try {
            await secInst.setMarket({
              timeframe: toVelaTf(cellData.resolution),
              data: cellData.bars,
            });
            secInst.renderer?.set?.("autoScale", true);
            applyStoredSettingsToChart(secInst, null, null, currentStored);
          } catch {}
        }

        const cleanupSecFutureShading = attachVelaReplayFutureShading(secInst.renderer);

        try {
          if ((secInst as any).drawings) {
            if (activeDrawingToolRef.current) {
              (secInst as any).drawings.setTool?.(activeDrawingToolRef.current);
            }
            if (chartRef.current?.drawings) {
              const snap = chartRef.current.drawings.getSnapMode?.();
              if (snap) (secInst as any).drawings.setSnapMode?.(snap);
              const stay = chartRef.current.drawings.getStayMode?.();
              if (typeof stay === "boolean") (secInst as any).drawings.setStayMode?.(stay);
              const mode = chartRef.current.drawings.getMode?.();
              if (mode) (secInst as any).drawings.setMode?.(mode);
            }
          }
        } catch {}

        let isSecSyncingTool = false;
        const offSecDrawingTool = (secInst as any).on?.("drawing:tool", ({ type }: { type: string | null }) => {
          if (isSecSyncingTool) return;
          isSecSyncingTool = true;
          try {
            activeDrawingToolRef.current = type;
            if (chartRef.current?.drawings && chartRef.current.drawings.getTool?.() !== type) {
              (chartRef.current.drawings as any).setTool?.(type);
            }
            for (const [otherIdx, otherSec] of secondaryCharts.current.entries()) {
              if (otherIdx !== cellIndex && otherSec?.drawings && otherSec.drawings.getTool?.() !== type) {
                otherSec.drawings.setTool?.(type);
              }
            }
          } finally {
            isSecSyncingTool = false;
          }
        });

        const offSecDrawingSnap = (secInst as any).on?.("drawing:snap", ({ mode }: { mode: string }) => {
          if (chartRef.current?.drawings && chartRef.current.drawings.getSnapMode?.() !== mode) {
            (chartRef.current.drawings as any).setSnapMode?.(mode);
          }
        });

        const offSecDrawingStay = (secInst as any).on?.("drawing:stay", ({ on }: { on: boolean }) => {
          if (chartRef.current?.drawings && chartRef.current.drawings.getStayMode?.() !== on) {
            (chartRef.current.drawings as any).setStayMode?.(on);
          }
        });

        const resolveIcon = (sym: string): string | undefined => {
          try {
            return getAssetIconConfig(sym).icons[0];
          } catch {
            return undefined;
          }
        };

        const secStatusline = new Statusline(hostEl, cellData.symbol, resolveIcon);
        secStatusline.setMeta(toVelaTf(cellData.resolution), "Replay");
        secStatusline.setMarketStatus("closed");
        secStatusline.onChart(secInst);
        if (isReplayActiveRef.current) {
          secStatusline.setReplaying(true);
        }

        const secWatermark = new Watermark(hostEl, cellData.symbol, toVelaTf(cellData.resolution));
        secWatermark.setLoading(false);
        if (isReplayActiveRef.current) {
          secWatermark.setReplaying(true);
        }

        syncStatuslineAndWatermark(
          secStatusline,
          secWatermark,
          cellData.symbol,
          cellData.resolution,
          "Replay",
          cellData.bars,
        );

        (secInst as any).__statusline = secStatusline;
        (secInst as any).__watermark = secWatermark;
        (secInst as any).__symbol = cellData.symbol;
        (secInst as any).__resolution = cellData.resolution;

        let secLastCrosshair: { price: number | null; decimals: number; time: number | null } = {
          price: null,
          decimals: 2,
          time: null,
        };

        const offCrosshairSec = (secInst.renderer as any).onCrosshairMove?.((e: any) => {
          let resolvedTime: number | null =
            typeof e?.ohlc?.time === "number"
              ? e.ohlc.time
              : typeof e?.time === "number"
                ? e.time
                : null;
          if (resolvedTime === null && e) {
            const inner = getInnerRenderer(secInst);
            const pt =
              inner?.lastPointer ??
              inner?.scene?.crosshair ??
              (typeof inner?.input?.cursorX === "number" && !Number.isNaN(inner.input.cursorX)
                ? { x: inner.input.cursorX, y: inner.input.cursorY }
                : null);
            if (pt && typeof pt.x === "number" && inner?.coords?.barCount > 0) {
              const canvasX = pt.x;
              const rawLogical = inner.coords.xToLogical(canvasX);
              if (Number.isFinite(rawLogical)) {
                const logical = Math.floor(rawLogical + 1e-6);
                const extrapolated = inner.coords.logicalToTime(logical);
                if (Number.isFinite(extrapolated)) {
                  resolvedTime = extrapolated;
                }
              }
            }
          }
          if (e && typeof e.price === "number") {
            let decimals = 2;
            if (e.ohlc) {
              let maxDec = 0;
              for (const val of [e.ohlc.open, e.ohlc.high, e.ohlc.low, e.ohlc.close]) {
                if (typeof val === "number") {
                  const s = String(Number(val.toPrecision(12)));
                  if (!s.includes("e")) {
                    const dot = s.indexOf(".");
                    if (dot >= 0) maxDec = Math.max(maxDec, s.length - dot - 1);
                  }
                }
              }
              decimals = Math.min(maxDec, 8);
            }
            secLastCrosshair = { price: e.price, decimals, time: resolvedTime };
            if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
              const price = e.paneKind === "price" ? e.price : null;
              broadcastCrosshair(cellIndex, resolvedTime, price);
            }
          } else if (resolvedTime !== null) {
            secLastCrosshair = { price: null, decimals: secLastCrosshair.decimals, time: resolvedTime };
            if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
              broadcastCrosshair(cellIndex, resolvedTime, null);
            }
          } else if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
            broadcastCrosshair(cellIndex, null, null);
          }
        });

        (secInst.renderer as any).onClick?.((e: any) => {
          const clickTime = typeof e?.time === "number" ? e.time : secLastCrosshair.time;
          if (isSelectingCutPointRef.current) {
            if (typeof clickTime === "number") {
              const cellBars = secondaryCellsData.current.get(cellIndex)?.bars || [];
              if (cellBars.length > 0 && clickTime >= cellBars[cellBars.length - 1]!.time) {
                showVelaToast("Select an earlier candle to begin replay.", "info", hostEl);
                return;
              }
              void handleStartReplay(clickTime, cellIndex);
            }
            return;
          }
          if (typeof clickTime === "number" && syncOptionsRef.current.time) {
            broadcastTimeClick(cellIndex, clickTime);
          }
        });

        const onSecPointerCapture = () => {
          handleActivateCell(cellIndex);
        };
        hostEl.addEventListener("pointerdown", onSecPointerCapture, true);
        hostEl.addEventListener("mousedown", onSecPointerCapture, true);
        hostEl.addEventListener("contextmenu", onSecPointerCapture, true);

        const onSecMouseLeave = () => {
          if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
            broadcastCrosshair(cellIndex, null, null);
          }
        };
        hostEl.addEventListener("mouseleave", onSecMouseLeave);

        const getSecActivePointer = () => {
          if (secLastCrosshair.price !== null) return secLastCrosshair;
          const cellBars = secondaryCellsData.current.get(cellIndex)?.bars || [];
          if (cellBars.length > 0) {
            const last = cellBars[cellBars.length - 1]!;
            return { price: last.close, decimals: 2, time: last.time };
          }
          return null;
        };

        const unregCopyPrice = registerCopyPriceAction(getSecActivePointer);

        const secContextMenu = new ChartContextMenu(hostEl, {
          getContext: () => {
            const cData = secondaryCellsData.current.get(cellIndex);
            const currentSym = cData?.symbol ?? selectedSymbolRef.current;
            const currentRes = cData?.resolution ?? selectedResolutionRef.current;
            return {
              chart: secInst,
              symbol: currentSym,
              timeframe: toVelaTf(currentRes),
              priceStyle: initialPriceStyle,
              setSymbol: (sym: string) => void handleSelectSymbolForCell(sym, cellIndex),
              setTimeframe: (tf: string) => {
                const res = fromVelaTf(tf);
                if (res) void handleSelectResolutionForCell(res, cellIndex);
              },
              setPriceStyle: (style: string) => secInst.renderer.set("priceStyle", style),
              openSymbolSearch: () => {
                handleActivateCell(cellIndex);
                openSymbolSearch();
              },
              togglePanel: () => {},
              dockStrip: () => () => {},
              host: hostEl,
              toast: (msg: string, kind?: "info" | "success" | "error") => {
                showVelaToast(msg, kind, hostEl);
              },
              addIndicator: () => {},
              addNativeIndicator: () => {},
              stateChanged: () => {},
              pointer: {
                price: getSecActivePointer()?.price ?? null,
                decimals: getSecActivePointer()?.decimals ?? 2,
                time: getSecActivePointer()?.time ?? null,
                paneKind: "price",
              },
            } as any;
          },
          resetView: () => {
            secInst.renderer.set("autoScale", true);
            const inner = getInnerRenderer(secInst);
            if (typeof inner?.resetView === "function") {
              inner.resetView();
            } else if (typeof (secInst.renderer as any).resetView === "function") {
              (secInst.renderer as any).resetView();
            } else {
              secInst.setVisibleRangePreset("ALL");
            }
          },
          timezone: () => String(secInst.renderer.get("timezone") ?? "Etc/UTC"),
          setTimezone: (zone: string) => {
            persistAndApplyTimezone(zone, secInst);
          },
        });
        secContextMenu.onChart(secInst);

        const cleanupSecContext = enhanceVelaContextMenu(
          hostEl,
          secContextMenu,
          () => {
            if (secLastCrosshair.price && secLastCrosshair.price > 0) return secLastCrosshair;
            const cBars = secondaryCellsData.current.get(cellIndex)?.bars || [];
            if (cBars.length > 0) {
              const last = cBars[cBars.length - 1]!;
              return { price: last.close, decimals: 2, time: last.time };
            }
            return null;
          },
          {
            getSymbol: () => secondaryCellsData.current.get(cellIndex)?.symbol ?? selectedSymbolRef.current,
            getCurrentPrice: () => {
              const cBars = secondaryCellsData.current.get(cellIndex)?.bars || [];
              return cBars.at(-1)?.close ?? 0;
            },
            onCreateAlert: (sym, price) => alertsStore.openCreateDialog(sym, price),
            onPlaceOrder: (side, type, price, sym) => {
              preOrderStore.open(sym ?? secondaryCellsData.current.get(cellIndex)?.symbol ?? selectedSymbolRef.current, side, type, price);
            },
            getTickSize: (sym) => getPaperInstrumentSpec(sym)?.tickSize ?? 0.25,
            formatPrice: (sym, p) => formatPaperPrice(sym, p),
          },
        );

        patchRendererWhitespaceCrosshair(secInst, (section) => openSettingsModal(cellIndex, section));

        const offVpSec = (secInst as any).on?.("viewport:changed", (range: any) => {
          broadcastViewport(cellIndex, range);
        });

        const cleanupSecListeners = () => {
          unregSecCellTracker?.();
          try {
            secDrawingsCleanup?.();
          } catch {}
          offVpSec?.();
          offSecDrawingTool?.();
          offSecDrawingSnap?.();
          offSecDrawingStay?.();
          cleanupSecFutureShading?.();
          cleanupSecContext();
          unregCopyPrice();
          hostEl.removeEventListener("pointerdown", onSecPointerCapture, true);
          hostEl.removeEventListener("mousedown", onSecPointerCapture, true);
          hostEl.removeEventListener("contextmenu", onSecPointerCapture, true);
          hostEl.removeEventListener("mouseleave", onSecMouseLeave);
          offCrosshairSec?.();
        };

        (secInst as any).__cleanupListeners = cleanupSecListeners;
        if (disposed) {
          cleanupSecListeners();
          try { secInst.destroy?.(); } catch {}
          return;
        }
        secondaryCharts.current.set(cellIndex, secInst);
        cellListenersRef.current.forEach((h) => h({ kind: "created", id: `cell-${cellIndex}` }));
        bumpSecondaryCells();
      }
    })();

    return () => {
      disposed = true;
    };
  }, [layout]);
}
