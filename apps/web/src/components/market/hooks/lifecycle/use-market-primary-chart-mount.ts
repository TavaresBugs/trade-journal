import { useEffect, useRef } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import type { LayoutShape, SyncOptions } from "@luxalgo/vela/widget";
import {
  attachVelaTimeframePicker,
  attachVelaStylePicker,
  attachVelaLayoutPicker,
  attachVelaScreenshotMenu,
  showVelaToast,
  registerCopyPriceAction,
  enhanceVelaContextMenu,
  setupVelaSidePanels,
  enhanceVelaDrawingToolbar,
  attachVelaFavoriteToolbar,
} from "@luxalgo/vela/widget";
import {
  enhanceVelaChromeHover,
  enhanceVelaSideRail,
  ensureSymbolSearchIcon,
  VELA_SEARCH_ICON_SVG,
} from "@luxalgo/vela/ui";
import {
  getInnerRenderer,
  patchRendererWhitespaceCrosshair,
  attachVelaReplayFutureShading,
  applyStoredSettingsToChart,
  loadStoredSettings,
  applyColorThemeToSettings,
} from "@luxalgo/vela/workspace";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";
import { getPaperInstrumentSpec, formatPrice as formatPaperPrice } from "@/lib/paper-trading/symbol-specs";
import { alertsStore } from "@/lib/alerts/alerts-store";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";
import type { MarketBar, Resolution } from "@/lib/market-data";
import { isFuturesOrEquitySymbol } from "@/lib/market-data";
import type { PersistedIndicatorInstance } from "@/lib/replay/workspace-persistence";
import {
  attachVelaDrawingsPersistence,
  loadLocalDrawings,
} from "../../drawings/market-drawings-persistence";
import {
  fromVelaTf,
  loadReplayFavs,
  normalizeChartTimezone,
  saveReplayFavs,
  syncStatuslineAndWatermark,
  toVelaTf,
} from "../../utils/market-chart-utils";
import type { MarketSidePanelId } from "../../chrome/market-side-rail";
import type { UseMarketTerminalRefsReturn } from "../use-market-terminal-refs";

export interface UseMarketPrimaryChartMountParams {
  refs: UseMarketTerminalRefsReturn;

  activeSymbolRef: React.RefObject<string>;
  activeResolutionRef: React.RefObject<Resolution>;
  activeDrawingToolRef: React.MutableRefObject<string | null>;
  cellListenersRef: React.MutableRefObject<Set<(e: any) => void>>;

  handleActivateCell: (cellIndex: number) => void;
  handleSelectSymbol: (sym: string) => Promise<void>;
  handleSelectResolution: (res: Resolution) => Promise<void>;
  handleSessionChange: (mode: "regular" | "extended") => Promise<void>;
  syncChartRenderer: () => void;
  broadcastViewport: (sourceId: number, range?: any) => void;
  broadcastCrosshair: (sourceId: number, time: number | null, price?: number | null) => void;
  clearAllExternalCrosshairs: () => void;
  broadcastTimeClick: (sourceId: number, clickTime: number) => void;
  handleStartReplay: (cutTime: number, sourceCellId?: number) => Promise<void>;
  triggerPaperTick: (time?: number, targetSymbol?: string) => void;
  syncAllCellsSymbol: (sym: string) => Promise<void>;
  syncAllCellsInterval: (res: Resolution) => Promise<void>;
  syncAllCellsStyle: (style?: string) => void;

  extractCanonicalIndicatorSlugs: (chart: any) => string[];
  extractChartIndicatorConfigs: (chart: any) => PersistedIndicatorInstance[];
  hydrateChartIndicatorsSilently: (chart: any, items: any[]) => Promise<void>;

  openSettingsModal: (cellIndex?: number, section?: string) => void;
  openSymbolSearch: () => void;
  openIndicatorsDialog: () => void;
  toggleFavMenu: (btnEl: HTMLElement) => void;
  toggleTemplatesMenu: (btnEl: HTMLElement) => void;
  setActivePanel: (panel: MarketSidePanelId) => void;
  persistAndApplyTimezone: (zone: string, inst?: any) => void;

  setActiveIndicatorSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveIndicatorConfigs: React.Dispatch<React.SetStateAction<PersistedIndicatorInstance[]>>;
}

export function useMarketPrimaryChartMount({
  refs,
  activeSymbolRef,
  activeResolutionRef,
  activeDrawingToolRef,
  cellListenersRef,
  handleActivateCell,
  handleSelectSymbol,
  handleSelectResolution,
  handleSessionChange,
  syncChartRenderer,
  broadcastViewport,
  broadcastCrosshair,
  clearAllExternalCrosshairs,
  broadcastTimeClick,
  handleStartReplay,
  triggerPaperTick,
  syncAllCellsSymbol,
  syncAllCellsInterval,
  syncAllCellsStyle,
  extractCanonicalIndicatorSlugs,
  extractChartIndicatorConfigs,
  hydrateChartIndicatorsSilently,
  openSettingsModal,
  openSymbolSearch,
  openIndicatorsDialog,
  toggleFavMenu,
  toggleTemplatesMenu,
  setActivePanel,
  persistAndApplyTimezone,
  setActiveIndicatorSlugs,
  setActiveIndicatorConfigs,
}: UseMarketPrimaryChartMountParams) {
  const {
    hostRef,
    workspaceAreaRef,
    gridContainerRef,
    topbarHostRef,
    bottombarHostRef,
    panelDockHostRef,
    sideRailHostRef,
    drawingToolbarHostRef,
    chartRef,
    setChartReadyInstance,
    topbarRef,
    bottombarRef,
    statuslineRef,
    watermarkRef,
    drawingToolbarRef,
    workspaceReplayRef,
    sidePanelsDockRef,
    screenshotMenuControllerRef,
    layoutControllerRef,
    secondaryHosts,
    secondaryCharts,
    secondaryCellsData,
    barsRef,
    selectedSymbolRef,
    selectedResolutionRef,
    sessionModeRef,
    layoutRef,
    syncOptionsRef,
    activeCellIndexRef,
    isReplayActiveRef,
    isPlayingRef,
    isSelectingCutPointRef,
    replayCursorTimeRef,
    replayBtnRef,
    setReplayRemaining,
    setChartTimezone,
    isSwitchingResolutionOrSessionRef,
    lastCrosshairRef,
    initialIndicatorsToRestoreRef,
    setIsReplayActive,
    setIsPlaying,
    setIsSelectingCutPoint,
    setReplayCursorTime,
    setLayout,
    setSyncOptions,
    setActiveCellIndex,
    cellTrackerRef,
  } = refs;

  const isHydratingIndicatorsRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const [
        {
          Vela,
          DARK_THEME,
          LIGHT_THEME,
          getDrawingType,
          DrawingToolbar,
          buildToolbar,
        },
        { Statusline, Watermark, ChartContextMenu, Topbar, Bottombar, ObjectTree, DataWindow },
      ] = await Promise.all([import("@luxalgo/vela"), import("@luxalgo/vela/widget")]);

      if (disposed || !hostRef.current) return;

      const dark = () => document.documentElement.classList.contains("dark");
      const currentStored = loadStoredSettings();
      const initialPriceStyle = currentStored.symbol?.priceStyle || "candles";
      const initialTz = normalizeChartTimezone(currentStored.symbol?.timezone);
      const initialRes = selectedResolutionRef.current;
      const initialBars = barsRef.current;

      const instance = new (Vela as any)(
        hostRef.current,
        {
          symbol: selectedSymbolRef.current,
          timeframe: toVelaTf(initialRes),
          data: initialBars,
          live: false,
          theme: dark() ? DARK_THEME : LIGHT_THEME,
          priceStyle: initialPriceStyle,
          volume: true,
          drawings: { toolbar: false },
        },
        {
          dataFeed: {
            load: async (m: any) => (m?.data?.length ? m.data : barsRef.current),
          },
        },
      ) as Vela;

      chartRef.current = instance;
      setChartReadyInstance(instance);

      try {
        instance.addNativeIndicator("volume");
      } catch {}

      try {
        const { PineWorkerEngine, PineEngine } = await import("@luxalgo/vela-pinets");
        if (disposed) {
          try { instance.destroy?.(); } catch {}
          if (chartRef.current === instance) {
            chartRef.current = null;
            setChartReadyInstance(null);
          }
          return;
        }
        try {
          instance.registerEngine("pine", new PineWorkerEngine());
        } catch {
          instance.registerEngine("pine", new PineEngine());
        }
      } catch (err) {
        console.warn("[vela] failed to register pine engine on primary chart:", err);
      }

      const syncActiveIndicators = () => {
        if (isHydratingIndicatorsRef.current) return;
        try {
          setActiveIndicatorSlugs(extractCanonicalIndicatorSlugs(instance));
          setActiveIndicatorConfigs(extractChartIndicatorConfigs(instance));
        } catch {}
      };
      try {
        instance.on("indicator:added", syncActiveIndicators);
        instance.on("indicator:removed", syncActiveIndicators);
        instance.on("indicator:inputs", syncActiveIndicators);
        instance.on("indicator:visibility", syncActiveIndicators);
        instance.on("indicator:moved", syncActiveIndicators);
      } catch {}

      if (initialIndicatorsToRestoreRef.current.length > 0) {
        isHydratingIndicatorsRef.current = true;
        try {
          await hydrateChartIndicatorsSilently(instance, initialIndicatorsToRestoreRef.current);
          if (disposed) {
            try { instance.destroy?.(); } catch {}
            if (chartRef.current === instance) {
              chartRef.current = null;
              setChartReadyInstance(null);
            }
            return;
          }
        } finally {
          isHydratingIndicatorsRef.current = false;
        }
        syncActiveIndicators();
      }

      try {
        instance.renderer.set("timezone", initialTz);
        instance.renderer.applyConfig?.({ timeScale: { timezone: initialTz } });
        instance.renderer.set("priceStyle", initialPriceStyle);
      } catch {}
      setChartTimezone(initialTz);

      patchRendererWhitespaceCrosshair(instance, (section) => openSettingsModal(0, section));
      const cleanupFutureShading = attachVelaReplayFutureShading(instance.renderer);

      if (barsRef.current.length) {
        await instance.setMarket({
          timeframe: toVelaTf(selectedResolutionRef.current),
          data: barsRef.current,
        });
      }

      // 1. Topbar
      let topbar: any = null;
      let cleanupTfp: (() => void) | null = null;
      let cleanupTfObserver: (() => void) | null = null;
      let cleanupStylePicker: (() => void) | null = null;
      let cleanupLayoutPicker: (() => void) | null = null;
      let cleanupChromeHoverTop: (() => void) | null = null;
      let cleanupScreenshotMenu: (() => void) | null = null;
      let cleanupReplayBtn: (() => void) | null = null;
      let currentFavs = loadReplayFavs();

      if (topbarHostRef.current) {
        topbar = new Topbar(topbarHostRef.current, {
          symbol: activeSymbolRef.current || selectedSymbolRef.current,
          timeframe: toVelaTf(selectedResolutionRef.current),
          timeframes: ["1", "3", "5", "15", "30", "60", "240", "D", "W", "M"],
          timeframeFavorites: currentFavs,
          priceStyle: initialPriceStyle,
          composition: {
            left: ["symbol", "timeframes", "style", "undo-redo"],
            right: [],
          },
          onSymbolClick: () => {
            openSymbolSearch();
          },
          onTimeframe: (tf: string) => {
            const res = fromVelaTf(tf);
            if (res) void handleSelectResolution(res);
          },
          onTimeframeFavorite: (tf: string, on: boolean) => {
            if (on) {
              if (!currentFavs.includes(tf)) currentFavs = [...currentFavs, tf];
            } else {
              currentFavs = currentFavs.filter((f) => f !== tf);
            }
            saveReplayFavs(currentFavs);
            topbar?.setTimeframeFavorites(currentFavs);
          },
          onPriceStyle: (style: string) => {
            instance.renderer.set("priceStyle", style);
            topbar?.setPriceStyle(style);
          },
          onIndicatorsClick: () => {
            openSettingsModal(undefined, "status-line");
          },
          onUndoClick: () => {
            instance.drawings.undo();
          },
          onRedoClick: () => {
            instance.drawings.redo();
          },
        });

        cleanupTfp = attachVelaTimeframePicker({
          container: topbarHostRef.current,
          currentTimeframe: toVelaTf(selectedResolutionRef.current),
          getCurrentTimeframe: () => toVelaTf(activeResolutionRef.current),
          timeframeFavorites: currentFavs,
          availableTimeframes: new Set(["1", "3", "5", "15", "30", "60", "240", "D", "W", "M"]),
          onSelectTimeframe: (tf: string) => {
            const res = fromVelaTf(tf);
            if (res) void handleSelectResolution(res);
          },
          onFavoritesChange: (favs: string[]) => {
            currentFavs = favs;
            saveReplayFavs(favs);
            topbar?.setTimeframeFavorites(favs);
          },
        });

        if (topbar?.styleMenu) {
          try {
            topbar.styleMenu.destroy();
          } catch {}
        }

        cleanupStylePicker = attachVelaStylePicker({
          container: topbarHostRef.current,
          currentStyle: initialPriceStyle,
          onSelectStyle: (style: string) => {
            instance.renderer.set("priceStyle", style);
            topbar?.setPriceStyle(style);
            if (syncOptionsRef.current.style) {
              syncAllCellsStyle(style);
            }
          },
        });

        const layoutController = attachVelaLayoutPicker({
          topbarContainer: topbarHostRef.current,
          chartContainer: hostRef.current,
          currentLayout: layoutRef.current,
          currentSync: syncOptionsRef.current,
          onSelectLayout: (newLayout: LayoutShape) => {
            setLayout(newLayout);
            if (activeCellIndexRef.current >= newLayout.rows * newLayout.cols) {
              setActiveCellIndex(0);
            }
            syncChartRenderer();
          },
          onToggleSync: (kind: keyof SyncOptions, enabled: boolean) => {
            const nextSync = { ...syncOptionsRef.current, [kind]: enabled };
            syncOptionsRef.current = nextSync;
            setSyncOptions((prev) => {
              const updated = { ...prev, [kind]: enabled };
              layoutControllerRef.current?.update(layoutRef.current, updated);
              return updated;
            });
            if (enabled) {
              if (kind === "symbol") {
                void syncAllCellsSymbol(activeSymbolRef.current);
              } else if (kind === "interval") {
                void syncAllCellsInterval(activeResolutionRef.current);
              } else if (kind === "style") {
                syncAllCellsStyle();
              } else if (kind === "time" || kind === "dateRange") {
                try {
                  const activeId = activeCellIndexRef.current;
                  const activeInst =
                    activeId === 0 ? chartRef.current : secondaryCharts.current.get(activeId);
                  const vp = activeInst?.getVisibleRange?.();
                  broadcastViewport(activeId, vp);
                } catch {}
              }
            } else {
              if (kind === "crosshair") {
                clearAllExternalCrosshairs();
              }
            }
          },
        });
        layoutControllerRef.current = layoutController;
        cleanupLayoutPicker = () => {
          layoutController?.destroy();
          layoutControllerRef.current = null;
        };

        cleanupChromeHoverTop = enhanceVelaChromeHover(topbarHostRef.current);

        const screenshotMenuController = attachVelaScreenshotMenu({
          topbarContainer: topbarHostRef.current,
          chartContainer: gridContainerRef.current ?? hostRef.current,
          getChartContainer: () => gridContainerRef.current ?? hostRef.current,
          getChartInstance: () => chartRef.current,
          getSymbol: () => activeSymbolRef.current,
          getResolution: () => activeResolutionRef.current,
          getChartCells: () => {
            const total = layoutRef.current.rows * layoutRef.current.cols;
            const cells: Array<{
              id: number;
              host: HTMLElement | null;
              chart: any;
              symbol: string;
              resolution: string;
            }> = [
              {
                id: 0,
                host: hostRef.current,
                chart: chartRef.current,
                symbol: selectedSymbolRef.current,
                resolution: selectedResolutionRef.current,
              },
            ];
            for (let idx = 1; idx < total; idx++) {
              const secHost = secondaryHosts.current.get(idx) ?? null;
              const secChart = secondaryCharts.current.get(idx) ?? null;
              const cData = secondaryCellsData.current.get(idx);
              cells.push({
                id: idx,
                host: secHost,
                chart: secChart,
                symbol: cData?.symbol ?? selectedSymbolRef.current,
                resolution: cData?.resolution ?? selectedResolutionRef.current,
              });
            }
            return cells;
          },
        });
        screenshotMenuControllerRef.current = screenshotMenuController;
        cleanupScreenshotMenu = () => {
          screenshotMenuController?.destroy();
          screenshotMenuControllerRef.current = null;
        };

        const doc = topbarHostRef.current.ownerDocument;
        const sepAfterLayout = doc.createElement("span");
        sepAfterLayout.className = "vela-sep";

        const indicatorsGroup = doc.createElement("span");
        indicatorsGroup.className = "vela-widget-action-pin";
        indicatorsGroup.innerHTML = `
          <button class="vela-widget-action-left quant-chrome-hover-row" data-quant-collapse="indicators" type="button" aria-label="Indicators" title="Indicators & Strategies">
            <span class="vela-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1.5 12.5 5 7l2.5 3.5L11 4l3.5 5"></path>
                <circle cx="11" cy="4" r="1.4" fill="currentColor" stroke="none"></circle>
              </svg>
            </span>
            <span>Indicators</span>
          </button>
          <button class="vlx-il-fav-caret quant-chrome-hover-row" type="button" aria-label="Favorite indicators" aria-haspopup="menu" aria-expanded="false" title="Favorite indicators">
            <span class="vela-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" data-quant-chevron="down">
                <path d="M3.5 6 8 10.5 12.5 6"></path>
              </svg>
            </span>
          </button>
        `;

        const indMainBtn = indicatorsGroup.querySelector<HTMLButtonElement>('[data-quant-collapse="indicators"]');
        indMainBtn?.addEventListener("click", () => {
          openIndicatorsDialog();
        });

        const indCaretBtn = indicatorsGroup.querySelector<HTMLButtonElement>(".vlx-il-fav-caret");
        indCaretBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (indCaretBtn) toggleFavMenu(indCaretBtn);
        });

        const templatesBtn = doc.createElement("button");
        templatesBtn.type = "button";
        templatesBtn.className = "vela-widget-action-left quant-chrome-hover-row";
        templatesBtn.id = "vela-action-quant:indicator-templates.open";
        templatesBtn.setAttribute("aria-label", "Indicator Templates");
        templatesBtn.title = "Indicator Templates";
        templatesBtn.innerHTML = `
          <span class="vela-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3">
              <path d="M3.6 1.8h8.8v12.4L8 11.1l-4.4 3.1Z" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
        `;
        templatesBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleTemplatesMenu(templatesBtn);
        });

        const sepBeforeReplay = doc.createElement("span");
        sepBeforeReplay.className = "vela-sep";

        const replayBtn = doc.createElement("button");
        replayBtn.type = "button";
        replayBtn.className = "vela-widget-action-left vela-replay-topbar-btn quant-chrome-hover-row";
        replayBtn.setAttribute("data-quant-collapse", "replay");
        replayBtn.setAttribute("aria-label", "Bar Replay");
        replayBtn.title = "Bar Replay (Rewind and simulate candles)";
        replayBtn.innerHTML = `
          <span class="vela-icon" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;line-height:1;">
            <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
              <path d="M14 4.2v7.6L8.6 8z"></path>
              <path d="M7.4 4.2v7.6L2 8z"></path>
            </svg>
          </span>
          <span class="vela-replay-label" style="line-height:1;">Replay</span>
        `;
        if (isReplayActiveRef.current || isSelectingCutPointRef.current) {
          replayBtn.setAttribute("data-vela-pro-replay-active", "");
        }

        replayBtn.addEventListener("click", () => {
          setIsSelectingCutPoint((prev) => {
            const next = !prev;
            isSelectingCutPointRef.current = next;
            return next;
          });
        });
        replayBtnRef.current = replayBtn;

        const layoutBtn = topbarHostRef.current.querySelector("#vela-topbar-layout");
        if (layoutBtn && layoutBtn.parentElement) {
          layoutBtn.after(sepAfterLayout, indicatorsGroup, templatesBtn, sepBeforeReplay, replayBtn);
        } else {
          const redoBtn = topbarHostRef.current.querySelector(".vela-widget-redo");
          if (redoBtn && redoBtn.parentElement) {
            redoBtn.after(sepAfterLayout, indicatorsGroup, templatesBtn, sepBeforeReplay, replayBtn);
          } else {
            const topbarEl = topbarHostRef.current.querySelector(".vela-widget-topbar");
            topbarEl?.append(sepAfterLayout, indicatorsGroup, templatesBtn, sepBeforeReplay, replayBtn);
          }
        }

        cleanupReplayBtn = () => {
          sepAfterLayout.remove();
          indicatorsGroup.remove();
          templatesBtn.remove();
          sepBeforeReplay.remove();
          replayBtn.remove();
          replayBtnRef.current = null;
        };

        const formatTopbarWidgets = () => {
          const chips = topbarHostRef.current?.querySelectorAll<HTMLButtonElement>(".vela-widget-tf");
          chips?.forEach((btn) => {
            const txt = btn.textContent || "";
            const formatted = txt.replace(/(\d+)h\b/g, "$1H");
            if (formatted !== txt) {
              btn.textContent = formatted;
            }
          });

          const currentSym = activeSymbolRef.current || selectedSymbolRef.current;
          const symBtn = topbarHostRef.current?.querySelector<HTMLButtonElement>(".vela-widget-symbol");
          if (symBtn) {
            ensureSymbolSearchIcon(symBtn, VELA_SEARCH_ICON_SVG, currentSym);
          }
        };
        formatTopbarWidgets();
        const obs = new MutationObserver(formatTopbarWidgets);
        obs.observe(topbarHostRef.current, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        cleanupTfObserver = () => obs.disconnect();
      }

      topbarRef.current = topbar;

      // 2. Bottombar
      let bottombar: any = null;
      let cleanupChromeHoverBottom: (() => void) | null = null;
      if (bottombarHostRef.current) {
        bottombar = new Bottombar(bottombarHostRef.current, {
          timezone: initialTz,
          onTimezone: (zone: string) => {
            persistAndApplyTimezone(zone, instance);
          },
          onRange: (preset: { id: string; preset: any }) => {
            instance.setVisibleRangePreset(preset.preset);
          },
          onSession: (mode: "regular" | "extended") => {
            void handleSessionChange(mode);
          },
          onSettingsClick: () => {
            openSettingsModal(undefined, "symbol");
          },
        });

        bottombar.setSession({
          enabled: isFuturesOrEquitySymbol(selectedSymbolRef.current),
          session: sessionModeRef.current,
        });

        const tzPositioning = (bottombar as any)?.tzMenu?.root?.ctrl?.props?.positioning;
        if (tzPositioning && typeof tzPositioning === "object") {
          tzPositioning.listeners = false;
          tzPositioning.flip = false;
          tzPositioning.slide = false;
          delete tzPositioning.getAnchorRect;
        }

        cleanupChromeHoverBottom = enhanceVelaChromeHover(bottombarHostRef.current);
      }
      bottombarRef.current = bottombar;

      // 3. Statusline
      const resolveIcon = (sym: string): string | undefined => {
        try {
          return getAssetIconConfig(sym).icons[0];
        } catch {
          return undefined;
        }
      };
      const statusline = new Statusline(hostRef.current, selectedSymbolRef.current, resolveIcon);
      statusline.setMeta(toVelaTf(selectedResolutionRef.current), "Replay");
      statusline.setMarketStatus("closed");
      statusline.onChart(instance);
      statusline.attachMenu({
        setPart: (part: any, visible: boolean) => statusline.setPartVisible(part, visible),
        chartVisible: () => instance.renderer.get("candleVisible") !== false,
        setChartVisible: (visible: boolean) => instance.renderer.set("candleVisible", visible),
      });
      statuslineRef.current = statusline;

      // 4. Watermark
      const watermark = new Watermark(
        hostRef.current,
        selectedSymbolRef.current,
        toVelaTf(selectedResolutionRef.current),
      );
      watermark.setLoading(false);
      watermarkRef.current = watermark;

      syncStatuslineAndWatermark(
        statusline,
        watermark,
        selectedSymbolRef.current,
        selectedResolutionRef.current,
        "Replay",
        barsRef.current,
      );

      // Register Primary Cell in 0ms Native Cell Tracker
      const unregCellTracker = hostRef.current
        ? cellTrackerRef.current.registerCell({
            id: "0",
            host: hostRef.current,
            symbol: selectedSymbolRef.current,
            resolution: selectedResolutionRef.current,
            chart: instance,
            statusline,
            watermark,
          })
        : null;

      // 5. Context Menu & Pointer Tracking
      let lastCrosshair: { price: number | null; decimals: number; time: number | null } = {
        price: null,
        decimals: 2,
        time: null,
      };

      const offCrosshairPrimary = (instance.renderer as any).onCrosshairMove?.((e: any) => {
        let resolvedTime: number | null =
          typeof e?.ohlc?.time === "number"
            ? e.ohlc.time
            : typeof e?.time === "number"
              ? e.time
              : null;
        if (resolvedTime === null && e) {
          const inner = getInnerRenderer(instance);
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
          lastCrosshair = { price: e.price, decimals, time: resolvedTime };
          lastCrosshairRef.current = lastCrosshair;
          if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
            const price = e.paneKind === "price" ? e.price : null;
            broadcastCrosshair(0, resolvedTime, price);
          }
        } else if (resolvedTime !== null) {
          lastCrosshair = { price: null, decimals: lastCrosshair.decimals, time: resolvedTime };
          lastCrosshairRef.current = lastCrosshair;
          if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
            broadcastCrosshair(0, resolvedTime, null);
          }
        } else if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
          broadcastCrosshair(0, null, null);
        }
      });

      const onPrimaryHostMouseLeave = () => {
        if (syncOptionsRef.current.crosshair || isSelectingCutPointRef.current) {
          clearAllExternalCrosshairs();
        }
      };
      hostRef.current?.addEventListener("mouseleave", onPrimaryHostMouseLeave);

      const onPrimaryPointerCapture = () => {
        handleActivateCell(0);
      };
      hostRef.current?.addEventListener("pointerdown", onPrimaryPointerCapture, true);
      hostRef.current?.addEventListener("mousedown", onPrimaryPointerCapture, true);
      hostRef.current?.addEventListener("contextmenu", onPrimaryPointerCapture, true);

      (instance.renderer as any).onClick?.((e: any) => {
        const clickTime = typeof e?.time === "number" ? e.time : lastCrosshair.time;
        if (isSelectingCutPointRef.current) {
          if (typeof clickTime === "number") {
            const currentBars = barsRef.current;
            if (currentBars.length > 0 && clickTime >= currentBars[currentBars.length - 1]!.time) {
              if (hostRef.current) {
                showVelaToast("Select an earlier candle to begin replay.", "info", hostRef.current);
              }
              return;
            }
            void handleStartReplay(clickTime);
          }
          return;
        }
        if (typeof clickTime === "number" && syncOptionsRef.current.time) {
          broadcastTimeClick(0, clickTime);
        }
      });

      const getActivePointer = () => {
        if (lastCrosshair.price !== null) return lastCrosshair;
        const allBars = barsRef.current;
        let activeBar: MarketBar | undefined;
        if (isReplayActiveRef.current && typeof replayCursorTimeRef.current === "number" && allBars.length) {
          for (let i = allBars.length - 1; i >= 0; i--) {
            const b = allBars[i];
            if (b && b.time <= replayCursorTimeRef.current) {
              activeBar = b;
              break;
            }
          }
        }
        if (!activeBar) {
          activeBar = allBars.at(-1);
        }
        if (activeBar && typeof activeBar.close === "number") {
          return { price: activeBar.close, decimals: 2, time: activeBar.time };
        }
        return null;
      };
      const unregisterCopyPrice = registerCopyPriceAction(getActivePointer);

      const contextMenu = new ChartContextMenu(hostRef.current, {
        getContext: () =>
          ({
            chart: instance,
            symbol: selectedSymbolRef.current,
            timeframe: toVelaTf(selectedResolutionRef.current),
            priceStyle: initialPriceStyle,
            setSymbol: (sym: string) => void handleSelectSymbol(sym),
            setTimeframe: (tf: string) => {
              const res = fromVelaTf(tf);
              if (res) void handleSelectResolution(res);
            },
            setPriceStyle: (style: string) => instance.renderer.set("priceStyle", style),
            openSymbolSearch: () => {
              openSymbolSearch();
            },
            togglePanel: () => {},
            dockStrip: () => () => {},
            host: hostRef.current!,
            toast: (msg: string, kind?: "info" | "success" | "error") => {
              showVelaToast(msg, kind, hostRef.current);
            },
            addIndicator: () => {},
            addNativeIndicator: () => {},
            stateChanged: () => {},
            pointer: {
              price: getActivePointer()?.price ?? null,
              decimals: getActivePointer()?.decimals ?? 2,
              time: getActivePointer()?.time ?? null,
              paneKind: "price",
            },
          }) as any,
        resetView: () => {
          instance.renderer.set("autoScale", true);
          const inner = getInnerRenderer(instance);
          if (typeof inner?.resetView === "function") {
            inner.resetView();
          } else if (typeof (instance.renderer as any).resetView === "function") {
            (instance.renderer as any).resetView();
          } else {
            instance.setVisibleRangePreset("ALL");
          }
        },
        timezone: () => String(instance.renderer.get("timezone") ?? "Etc/UTC"),
        setTimezone: (zone: string) => {
          persistAndApplyTimezone(zone, instance);
        },
      });
      contextMenu.onChart(instance);

      const cleanupContextMenu = enhanceVelaContextMenu(
        hostRef.current,
        contextMenu,
        () => {
          if (lastCrosshair.price && lastCrosshair.price > 0) {
            return lastCrosshair;
          }
          const allBars = barsRef.current;
          const lastBar = allBars.at(-1);
          if (lastBar && typeof lastBar.close === "number") {
            return { price: lastBar.close, decimals: 2, time: lastBar.time };
          }
          return null;
        },
        {
          getSymbol: () => selectedSymbolRef.current,
          getCurrentPrice: () => {
            const allBars = barsRef.current;
            if (isReplayActiveRef.current && typeof replayCursorTimeRef.current === "number" && allBars.length) {
              for (let i = allBars.length - 1; i >= 0; i--) {
                const b = allBars[i];
                if (b && b.time <= replayCursorTimeRef.current) {
                  return b.close;
                }
              }
            }
            return allBars.at(-1)?.close ?? 0;
          },
          onCreateAlert: (sym, price) => {
            alertsStore.openCreateDialog(sym, price);
          },
          onPlaceOrder: (side, type, price, sym) => {
            preOrderStore.open(sym ?? selectedSymbolRef.current, side, type, price);
          },
          getTickSize: (sym) => getPaperInstrumentSpec(sym)?.tickSize ?? 0.25,
          formatPrice: (sym, p) => formatPaperPrice(sym, p),
        },
      );

      // 6. Drawing Toolbar
      let cleanupDrawingEnhancer: (() => void) | null = null;
      if (drawingToolbarHostRef.current) {
        try {
          drawingToolbarHostRef.current.innerHTML = "";
          const getTargetChart = () => {
            const idx = activeCellIndexRef.current;
            return idx === 0 ? instance : secondaryCharts.current.get(idx) ?? instance;
          };

          const drawToolbar = new (DrawingToolbar as any)(
            drawingToolbarHostRef.current,
            dark() ? DARK_THEME : LIGHT_THEME,
            (type: any) => {
              activeDrawingToolRef.current = type;
              const c = getTargetChart();
              c?.drawings?.setTool?.(type);
            },
            (mode: any) => {
              const c = getTargetChart();
              c?.drawings?.setSnapMode?.(mode);
            },
            () => {
              const c = getTargetChart();
              const d = c?.drawings;
              if (d) d.setMode?.(d.getMode?.() === "measure" ? null : "measure");
            },
            () => {
              const c = getTargetChart();
              const d = c?.drawings;
              if (d) d.setMode?.(d.getMode?.() === "eraser" ? null : "eraser");
            },
            (type: any, on: boolean) => {
              const c = getTargetChart();
              c?.drawings?.setFavorite?.(type, on);
            },
            (on: boolean) => {
              const c = getTargetChart();
              c?.drawings?.setStayMode?.(on);
            },
            {
              dock: "static",
              width: 52,
              onCollapse: (collapsed: boolean) => {
                if (drawingToolbarHostRef.current) {
                  drawingToolbarHostRef.current.dataset.collapsed = collapsed ? "1" : "";
                }
              },
              onDrawingsSync: () => {},
            }
          );
          drawToolbar.setDefinition(buildToolbar(true).definition);
          drawToolbar.setVisible(true);
          drawingToolbarRef.current = drawToolbar;

          cleanupDrawingEnhancer = enhanceVelaDrawingToolbar(drawingToolbarHostRef.current);
        } catch (err) {
          console.warn("[replay] failed to initialize shared drawing toolbar:", err);
        }
      }

      // 7. Side Panels Dock
      if (panelDockHostRef.current) {
        const sidePanels = setupVelaSidePanels({
          panelContainer: panelDockHostRef.current,
          chartInstance: instance,
          symbol: selectedSymbolRef.current,
          resolveIcon,
          onOpenChange: (openId) => setActivePanel(openId),
          ObjectTreeClass: ObjectTree,
          DataWindowClass: DataWindow,
        });
        sidePanelsDockRef.current = sidePanels;
      }

      // 8. Drawings Persistence
      const primaryDrawingsKey = `replay-${selectedSymbolRef.current}`;
      let drawingsPersistenceCleanup = attachVelaDrawingsPersistence(
        instance,
        primaryDrawingsKey,
        {
          syncRemote: true,
          initialDrawingsJson:
            loadLocalDrawings(primaryDrawingsKey) ??
            localStorage.getItem(`tradejournal_replay_drawings_${selectedSymbolRef.current}`),
          onDrawingsRestored: () => {
            sidePanelsDockRef.current?.refresh?.();
          },
        },
      );
      (instance as any).__rebindDrawingsPersistence = (newSym: string) => {
        try {
          drawingsPersistenceCleanup();
        } catch {}
        try {
          (instance as any).drawings?.clear?.();
        } catch {}
        const nextDrawingsKey = `replay-${newSym}`;
        drawingsPersistenceCleanup = attachVelaDrawingsPersistence(instance, nextDrawingsKey, {
          syncRemote: true,
          initialDrawingsJson:
            loadLocalDrawings(nextDrawingsKey) ??
            localStorage.getItem(`tradejournal_replay_drawings_${newSym}`),
          onDrawingsRestored: () => {
            sidePanelsDockRef.current?.refresh?.();
          },
        });
      };

      let cleanupFavToolbar: (() => void) | null = null;
      if (typeof attachVelaFavoriteToolbar === "function") {
        try {
          const favToolbarContainer = workspaceAreaRef.current || hostRef.current?.parentElement || hostRef.current;
          cleanupFavToolbar = attachVelaFavoriteToolbar(instance, favToolbarContainer, {
            resolveToolMeta: (t: string) => getDrawingType?.(t),
          });
        } catch {}
      }

      let sideRailCleanup: (() => void) | null = null;
      if (sideRailHostRef.current) {
        sideRailCleanup = enhanceVelaSideRail(sideRailHostRef.current);
      }

      try {
        const stored = loadStoredSettings();
        const hydratedTz = normalizeChartTimezone(stored.symbol?.timezone);
        applyStoredSettingsToChart(instance, statusline, watermark, {
          ...stored,
          symbol: { ...stored.symbol, timezone: hydratedTz },
        });
        bottombar?.setTimezone?.(hydratedTz);
        setChartTimezone(hydratedTz);
      } catch {}

      if (barsRef.current.length > 0) {
        await instance.setMarket({
          timeframe: toVelaTf(selectedResolutionRef.current),
          data: barsRef.current,
        });
        instance.renderer?.set?.("autoScale", true);
        topbar?.setTimeframe?.(toVelaTf(selectedResolutionRef.current));
        syncStatuslineAndWatermark(
          statusline,
          watermark,
          selectedSymbolRef.current,
          selectedResolutionRef.current,
          "Replay",
          barsRef.current,
        );
      }

      const handleThemeUpdate = () => {
        const isDark = dark();
        const stored = loadStoredSettings();
        const updated = applyColorThemeToSettings(stored, isDark ? "dark" : "light");
        applyStoredSettingsToChart(instance, statusline, watermark, updated);
        for (const secInst of secondaryCharts.current.values()) {
          applyStoredSettingsToChart(
            secInst,
            (secInst as any).__statusline,
            (secInst as any).__watermark,
            updated
          );
        }
        if (drawingToolbarRef.current) {
          try {
            drawingToolbarRef.current.theme = isDark ? DARK_THEME : LIGHT_THEME;
            drawingToolbarRef.current.styleRoot?.();
          } catch {}
        }
      };

      const observer = new MutationObserver(handleThemeUpdate);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      window.addEventListener("vela-theme-change", handleThemeUpdate);

      const resizeObserver = new ResizeObserver(() => {
        try {
          (instance.renderer as any)?.syncSize?.();
        } catch {}
      });
      if (hostRef.current) resizeObserver.observe(hostRef.current);

      const offVpPrimary = (instance as any).on?.("viewport:changed", (range: any) => {
        broadcastViewport(0, range);
      });

      let isSyncingTool = false;
      const offDrawingToolPrimary = (instance as any).on?.("drawing:tool", ({ type }: { type: string | null }) => {
        if (isSyncingTool) return;
        isSyncingTool = true;
        try {
          activeDrawingToolRef.current = type;
          for (const sec of secondaryCharts.current.values()) {
            try {
              if (sec?.drawings && sec.drawings.getTool?.() !== type) {
                sec.drawings.setTool?.(type);
              }
            } catch {}
          }
        } finally {
          isSyncingTool = false;
        }
      });

      const offDrawingSnapPrimary = (instance as any).on?.("drawing:snap", ({ mode }: { mode: string }) => {
        for (const sec of secondaryCharts.current.values()) {
          try {
            if (sec?.drawings && sec.drawings.getSnapMode?.() !== mode) {
              sec.drawings.setSnapMode?.(mode);
            }
          } catch {}
        }
      });

      const offDrawingStayPrimary = (instance as any).on?.("drawing:stay", ({ on }: { on: boolean }) => {
        for (const sec of secondaryCharts.current.values()) {
          try {
            if (sec?.drawings && sec.drawings.getStayMode?.() !== on) {
              sec.drawings.setStayMode?.(on);
            }
          } catch {}
        }
      });

      const offDrawingModePrimary = (instance as any).on?.("drawing:mode", ({ mode }: { mode: string }) => {
        for (const sec of secondaryCharts.current.values()) {
          try {
            if (sec?.drawings && sec.drawings.getMode?.() !== mode) {
              sec.drawings.setMode?.(mode);
            }
          } catch {}
        }
      });

      // 9. WorkspaceReplay Listeners
      let offWsReplayStart: (() => void) | undefined;
      let offWsReplayStep: (() => void) | undefined;
      let offWsReplayPlay: (() => void) | undefined;
      let offWsReplayPause: (() => void) | undefined;
      let offWsReplayEnd: (() => void) | undefined;
      let wsReplayInstance: any = null;

      try {
        const { WorkspaceReplay } = await import("@luxalgo/vela/workspace");
        if (!disposed) {
          const wsHost = {
            cells: () => {
              const list: Array<{ id: string; chart: any }> = [];
              if (chartRef.current) list.push({ id: "cell-0", chart: chartRef.current });
              for (const [id, inst] of secondaryCharts.current.entries()) {
                if (inst) list.push({ id: `cell-${id}`, chart: inst });
              }
              return list;
            },
            activeId: () => `cell-${activeCellIndexRef.current}`,
            onCells: (handler: (e: any) => void) => {
              cellListenersRef.current.add(handler);
              return () => {
                cellListenersRef.current.delete(handler);
              };
            },
          };

          wsReplayInstance = new (WorkspaceReplay as any)(wsHost);
          workspaceReplayRef.current = wsReplayInstance;

          offWsReplayStart = wsReplayInstance.on("replay:start", (payload: any) => {
            setIsReplayActive(true);
            isReplayActiveRef.current = true;
            setIsSelectingCutPoint(false);
            isSelectingCutPointRef.current = false;
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (payload?.cursorTime) {
              setReplayCursorTime(payload.cursorTime);
              replayCursorTimeRef.current = payload.cursorTime;
              triggerPaperTick(payload.cursorTime);
            }
            if (typeof payload?.remaining === "number") setReplayRemaining(payload.remaining);
            statusline.setReplaying?.(true);
            watermark.setReplaying?.(true);
            for (const secInst of secondaryCharts.current.values()) {
              try {
                (secInst as any).__statusline?.setReplaying?.(true);
                (secInst as any).__watermark?.setReplaying?.(true);
              } catch {}
            }
          });

          offWsReplayStep = wsReplayInstance.on("replay:step", (payload: any) => {
            const stepTime = payload?.cursorTime ?? payload?.time;
            if (payload?.cursorTime) setReplayCursorTime(payload.cursorTime);
            else if (payload?.time) setReplayCursorTime(payload.time);
            if (typeof payload?.remaining === "number") setReplayRemaining(payload.remaining);
            if (typeof stepTime === "number") triggerPaperTick(stepTime);
          });

          offWsReplayPlay = wsReplayInstance.on("replay:play", () => {
            setIsPlaying(true);
          });

          offWsReplayPause = wsReplayInstance.on("replay:pause", () => {
            setIsPlaying(false);
          });

          offWsReplayEnd = wsReplayInstance.on("replay:end", (payload: any) => {
            if (disposed || isSwitchingResolutionOrSessionRef.current) return;
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (payload?.reason === "finished") {
              showVelaToast("Replay reached the end of available history.", "info", hostRef.current);
            }
          });
        }
      } catch (err) {
        console.warn("[Replay] Failed to load WorkspaceReplay:", err);
      }

      cleanup = () => {
        unregCellTracker?.();
        cleanupTfObserver?.();
        try {
          drawingsPersistenceCleanup?.();
        } catch {}
        observer.disconnect();
        window.removeEventListener("vela-theme-change", handleThemeUpdate);
        resizeObserver.disconnect();
        offVpPrimary?.();
        offDrawingToolPrimary?.();
        offDrawingSnapPrimary?.();
        offDrawingStayPrimary?.();
        offDrawingModePrimary?.();
        offWsReplayStart?.();
        offWsReplayStep?.();
        offWsReplayPlay?.();
        offWsReplayPause?.();
        offWsReplayEnd?.();
        try {
          wsReplayInstance?.destroy?.();
        } catch {}
        if (workspaceReplayRef.current === wsReplayInstance) {
          workspaceReplayRef.current = null;
        }
        cleanupReplayBtn?.();
        try {
          cleanupDrawingEnhancer?.();
        } catch {}
        if (drawingToolbarRef.current) {
          try {
            drawingToolbarRef.current.closeFlyout?.();
            drawingToolbarRef.current.root?.remove?.();
          } catch {}
          drawingToolbarRef.current = null;
        }
        cleanupFavToolbar?.();
        cleanupContextMenu();
        unregisterCopyPrice();
        sideRailCleanup?.();
        cleanupTfp?.();
        cleanupStylePicker?.();
        cleanupLayoutPicker?.();
        cleanupChromeHoverTop?.();
        cleanupChromeHoverBottom?.();
        cleanupScreenshotMenu?.();
        cleanupFutureShading?.();
        topbar?.destroy?.();
        bottombar?.destroy?.();
        statusline?.destroy?.();
        watermark?.destroy?.();
        sidePanelsDockRef.current?.destroy?.();
        offCrosshairPrimary?.();
        hostRef.current?.removeEventListener("pointerdown", onPrimaryPointerCapture, true);
        hostRef.current?.removeEventListener("mousedown", onPrimaryPointerCapture, true);
        hostRef.current?.removeEventListener("contextmenu", onPrimaryPointerCapture, true);
        hostRef.current?.removeEventListener("mouseleave", onPrimaryHostMouseLeave);
        instance.destroy?.();
        if (chartRef.current === instance) {
          chartRef.current = null;
          setChartReadyInstance(null);
        }
        topbarRef.current = null;
        bottombarRef.current = null;
        statuslineRef.current = null;
        watermarkRef.current = null;
      };

      if (disposed) {
        cleanup();
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
}
