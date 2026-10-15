import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { resolveSampleAnchor, type Vela } from "@luxalgo/vela";
import type { Resolution, MarketBar } from "@/lib/market-data";
import type { LayoutShape, SyncOptions } from "@luxalgo/vela/widget";
import {
  applyStoredSettingsToChart,
  loadStoredSettings,
  saveStoredSettings,
  mapSettingsSectionToTab,
  hydrateVelaSettingsFromRemote,
} from "@luxalgo/vela/workspace";
import { getSymbolSpec } from "@/lib/assets/symbol-specs";
import { getGlobalPaperEngine } from "@/lib/paper-trading";
import {
  loadReplayWorkspace,
  saveReplayWorkspace,
  loadIndicatorTemplates,
  hydrateWorkspaceFromRemoteSettings,
  type PersistedReplayWorkspace,
  type PersistedIndicatorInstance,
  type PersistedIndicatorPreset,
  type SavedIndicatorTemplate,
} from "@/lib/replay/workspace-persistence";
import type { SecondaryCellMarketData } from "./use-market-trading-engine";
import type { ReplayBarPosition } from "../replay/market-replay-control-bar";
import { normalizeChartTimezone } from "../utils/market-chart-utils";
import { flushPendingTradeDrawingsSave } from "../drawings/market-drawings-persistence";
import { ensureTradeJournalVelaSettingsAdapter } from "../lib/vela-settings-adapter";

export interface MarketSettingsModalTarget {
  cellIndex: number;
  symbol: string;
  resolution: Resolution;
  candleCount: number;
  referencePrice?: number;
  tickSize: number;
  chartInstance?: any;
  statusline?: any;
  watermark?: any;
}

export interface UseMarketWorkspacePersistenceParams {
  chartRef: React.RefObject<Vela | null>;
  bottombarRef: React.RefObject<any>;
  statuslineRef: React.RefObject<any>;
  watermarkRef: React.RefObject<any>;

  selectedSymbol: string;
  setSelectedSymbol: React.Dispatch<React.SetStateAction<string>>;
  selectedSymbolRef: React.MutableRefObject<string>;
  selectedResolution: Resolution;
  setSelectedResolution: React.Dispatch<React.SetStateAction<Resolution>>;
  selectedResolutionRef: React.MutableRefObject<Resolution>;
  bars: MarketBar[];
  barsRef: React.RefObject<MarketBar[]>;

  layout: LayoutShape;
  setLayout: React.Dispatch<React.SetStateAction<LayoutShape>>;
  layoutRef: React.MutableRefObject<LayoutShape>;
  syncOptions: SyncOptions;
  setSyncOptions: React.Dispatch<React.SetStateAction<SyncOptions>>;
  syncOptionsRef: React.MutableRefObject<SyncOptions>;
  activeCellIndex: number;
  setActiveCellIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCellIndexRef: React.MutableRefObject<number>;
  activeSymbolRef: React.MutableRefObject<string>;
  activeResolutionRef: React.MutableRefObject<Resolution>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  secondaryCellsVersion: number;
  bumpSecondaryCells: () => void;
  handleActivateCell: (cellIndex: number) => void;

  activeIndicatorSlugs: string[];
  setActiveIndicatorSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  activeIndicatorConfigs: PersistedIndicatorInstance[];
  setActiveIndicatorConfigs: React.Dispatch<
    React.SetStateAction<PersistedIndicatorInstance[]>
  >;
  initialIndicatorsToRestoreRef: React.MutableRefObject<
    Array<string | PersistedIndicatorInstance>
  >;
  indicatorPresetsBySlugRef: React.MutableRefObject<
    Record<string, PersistedIndicatorPreset>
  >;
  indicatorPresetsVersion: number;
  setSavedTemplates: React.Dispatch<React.SetStateAction<SavedIndicatorTemplate[]>>;

  setSessionMode: React.Dispatch<React.SetStateAction<"regular" | "extended">>;
  sessionModeRef: React.MutableRefObject<"regular" | "extended">;

  isOrderTicketOpen: boolean;
  setIsOrderTicketOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDomOpen: boolean;
  setIsDomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPaperBottomOpen: boolean;
  setIsPaperBottomOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paperBottomHeight: number;
  setPaperBottomHeight: React.Dispatch<React.SetStateAction<number>>;
  setShowBuySellButtons: React.Dispatch<React.SetStateAction<boolean>>;

  setIsReplayActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReplayActiveRef: React.MutableRefObject<boolean>;
  setReplayCursorTime: React.Dispatch<React.SetStateAction<number | null>>;
  replayCursorTimeRef: React.MutableRefObject<number | null>;
  setBarPosition: React.Dispatch<React.SetStateAction<ReplayBarPosition | null>>;
  setDocked: React.Dispatch<React.SetStateAction<boolean>>;
  isWorkspaceHydrated?: boolean;
  setIsWorkspaceHydrated?: React.Dispatch<React.SetStateAction<boolean>>;
  hasHydratedStorageRef?: React.MutableRefObject<boolean>;
}

export interface UseMarketWorkspacePersistenceReturn {
  isWorkspaceHydrated: boolean;
  hasHydratedStorageRef: React.MutableRefObject<boolean>;
  chartTimezone: string;
  setChartTimezone: React.Dispatch<React.SetStateAction<string>>;
  persistAndApplyTimezone: (zone: string, targetInstance?: any) => void;

  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsInitialTab: string;
  setSettingsInitialTab: React.Dispatch<React.SetStateAction<string>>;
  settingsTarget: MarketSettingsModalTarget | null;
  openSettingsModal: (targetCellIndex?: number, section?: string) => void;
  openSettingsModalRef: React.MutableRefObject<
    (targetCellIndex?: number, section?: string) => void
  >;
}

export function useMarketWorkspacePersistence({
  chartRef,
  bottombarRef,
  statuslineRef,
  watermarkRef,
  selectedSymbol,
  setSelectedSymbol,
  selectedSymbolRef,
  selectedResolution,
  setSelectedResolution,
  selectedResolutionRef,
  bars,
  barsRef,
  layout,
  setLayout,
  layoutRef,
  syncOptions,
  setSyncOptions,
  syncOptionsRef,
  activeCellIndex,
  setActiveCellIndex,
  activeCellIndexRef,
  secondaryCharts,
  secondaryCellsData,
  secondaryCellsVersion,
  bumpSecondaryCells,
  handleActivateCell,
  activeIndicatorSlugs,
  setActiveIndicatorSlugs,
  activeIndicatorConfigs,
  setActiveIndicatorConfigs,
  initialIndicatorsToRestoreRef,
  indicatorPresetsBySlugRef,
  indicatorPresetsVersion,
  setSavedTemplates,
  setSessionMode,
  sessionModeRef,
  isOrderTicketOpen,
  setIsOrderTicketOpen,
  isDomOpen,
  setIsDomOpen,
  isPaperBottomOpen,
  setIsPaperBottomOpen,
  paperBottomHeight,
  setShowBuySellButtons,
  setIsReplayActive,
  isReplayActiveRef,
  setReplayCursorTime,
  replayCursorTimeRef,
  setBarPosition,
  setDocked,
  isWorkspaceHydrated: incomingIsWorkspaceHydrated,
  setIsWorkspaceHydrated: incomingSetIsWorkspaceHydrated,
  hasHydratedStorageRef: incomingHasHydratedStorageRef,
}: UseMarketWorkspacePersistenceParams): UseMarketWorkspacePersistenceReturn {
  const internalHasHydratedStorageRef = useRef(false);
  const [internalIsWorkspaceHydrated, setInternalIsWorkspaceHydrated] = useState(false);
  const hasHydratedStorageRef = incomingHasHydratedStorageRef ?? internalHasHydratedStorageRef;
  const isWorkspaceHydrated = incomingIsWorkspaceHydrated ?? internalIsWorkspaceHydrated;

  const setIsWorkspaceHydrated = useCallback(
    (val: boolean) => {
      setInternalIsWorkspaceHydrated(val);
      incomingSetIsWorkspaceHydrated?.(val);
    },
    [incomingSetIsWorkspaceHydrated]
  );

  useEffect(() => {
    ensureTradeJournalVelaSettingsAdapter();
  }, []);
  const [chartTimezone, setChartTimezone] = useState<string>("Etc/UTC");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("symbol");
  const [settingsTarget, setSettingsTarget] = useState<MarketSettingsModalTarget | null>(null);

  const persistAndApplyTimezone = useCallback(
    (zone: string, targetInstance?: any) => {
      const normalizedZone = normalizeChartTimezone(zone);
      const inst = targetInstance ?? chartRef.current;
      try {
        inst?.renderer?.set?.("timezone", normalizedZone);
        inst?.renderer?.applyConfig?.({ timeScale: { timezone: normalizedZone } });
      } catch {}
      try {
        bottombarRef.current?.setTimezone?.(normalizedZone);
      } catch {}
      try {
        const s = loadStoredSettings();
        saveStoredSettings({
          ...s,
          symbol: {
            ...s.symbol,
            timezone: normalizedZone,
          },
        });
      } catch {}
      setChartTimezone(normalizedZone);
    },
    [bottombarRef, chartRef],
  );

  const openSettingsModal = useCallback(
    (targetCellIndex?: number, section?: string) => {
      const targetIdx =
        typeof targetCellIndex === "number" ? targetCellIndex : activeCellIndexRef.current;
      handleActivateCell(targetIdx);

      const cellData =
        targetIdx === 0 ? null : secondaryCellsData.current.get(targetIdx);
      const targetSymbol = cellData?.symbol ?? selectedSymbolRef.current;
      const targetResolution = cellData?.resolution ?? selectedResolutionRef.current;
      const targetChartInst =
        targetIdx === 0
          ? chartRef.current
          : (secondaryCharts.current.get(targetIdx) ?? chartRef.current);
      const targetStatusline =
        targetIdx === 0
          ? statuslineRef.current
          : ((targetChartInst as any)?.__statusline ?? statuslineRef.current);
      const targetWatermark =
        targetIdx === 0
          ? watermarkRef.current
          : ((targetChartInst as any)?.__watermark ?? watermarkRef.current);

      const targetBars =
        targetIdx === 0
          ? (barsRef.current.length > 0 ? barsRef.current : bars)
          : (cellData?.bars && cellData.bars.length > 0 ? cellData.bars : []);

      const instMatchesSymbol =
        !(targetChartInst as any)?.__symbol ||
        (targetChartInst as any).__symbol.toUpperCase() === targetSymbol.toUpperCase();

      const lastBarClose =
        targetBars.length > 0
          ? targetBars[targetBars.length - 1]!.close
          : instMatchesSymbol && typeof (targetChartInst as any)?.__lastBar?.close === "number"
            ? (targetChartInst as any).__lastBar.close
            : instMatchesSymbol && typeof targetStatusline?.lastBar?.close === "number"
              ? targetStatusline.lastBar.close
              : undefined;

      const enginePrice = getGlobalPaperEngine().getLastPrice(targetSymbol.toUpperCase());
      const targetPrice =
        typeof lastBarClose === "number" && lastBarClose > 0
          ? lastBarClose
          : typeof enginePrice === "number" && enginePrice > 0
            ? enginePrice
            : undefined;

      const targetTick = getSymbolSpec(targetSymbol)?.tickSize ?? 0.25;
      const anchor = resolveSampleAnchor(targetSymbol, targetPrice, targetTick);

      setSettingsTarget({
        cellIndex: targetIdx,
        symbol: targetSymbol,
        resolution: targetResolution,
        candleCount: targetBars.length,
        referencePrice: anchor.price,
        tickSize: anchor.tickSize,
        chartInstance: targetChartInst,
        statusline: targetStatusline,
        watermark: targetWatermark,
      });

      const targetTab = mapSettingsSectionToTab(section);
      setSettingsInitialTab(targetTab);
      setSettingsOpen(true);
    },
    [
      activeCellIndexRef,
      bars,
      barsRef,
      chartRef,
      handleActivateCell,
      secondaryCellsData,
      secondaryCharts,
      selectedResolutionRef,
      selectedSymbolRef,
      statuslineRef,
      watermarkRef,
    ],
  );

  const openSettingsModalRef = useRef(openSettingsModal);
  openSettingsModalRef.current = openSettingsModal;

  // Hydrate client-side storage after initial mount
  useEffect(() => {
    const applyWorkspaceToState = (ws: PersistedReplayWorkspace) => {
      const cell0Sym = ws.cells[0]?.symbol ?? "MES";
      const cell0Res = (ws.cells[0]?.resolution as Resolution) ?? "1m";
      selectedSymbolRef.current = cell0Sym;
      selectedResolutionRef.current = cell0Res;
      setSelectedSymbol(cell0Sym);
      setSelectedResolution(cell0Res);

      if (ws.indicatorPresetsBySlug) {
        indicatorPresetsBySlugRef.current = {
          ...indicatorPresetsBySlugRef.current,
          ...ws.indicatorPresetsBySlug,
        };
      }

      for (const [key, cell] of Object.entries(ws.cells)) {
        const idx = Number(key);
        if (Number.isInteger(idx) && idx >= 1 && cell) {
          secondaryCellsData.current.set(idx, {
            symbol: cell.symbol || cell0Sym,
            resolution: (cell.resolution as Resolution) || cell0Res,
            bars: [],
            rawBars: [],
            indicators: cell.indicators ? [...cell.indicators] : undefined,
            indicatorConfigs: cell.indicatorConfigs ? [...cell.indicatorConfigs] : undefined,
          });
        }
      }

      setLayout(ws.layout);
      layoutRef.current = ws.layout;
      setSyncOptions(ws.syncOptions);
      syncOptionsRef.current = ws.syncOptions;
      const maxIdx = Math.max(0, ws.layout.rows * ws.layout.cols - 1);
      const validActive = Math.min(ws.activeCellIndex, maxIdx);
      setActiveCellIndex(validActive);
      activeCellIndexRef.current = validActive;

      if (ws.activeIndicatorConfigs) {
        setActiveIndicatorConfigs(ws.activeIndicatorConfigs);
        if (initialIndicatorsToRestoreRef) {
          initialIndicatorsToRestoreRef.current = ws.activeIndicatorConfigs;
        }
      }
      if (ws.activeIndicatorSlugs) {
        setActiveIndicatorSlugs(ws.activeIndicatorSlugs);
        if (initialIndicatorsToRestoreRef && (!ws.activeIndicatorConfigs || ws.activeIndicatorConfigs.length === 0)) {
          initialIndicatorsToRestoreRef.current = ws.activeIndicatorSlugs;
        }
      }
      if (typeof ws.isPaperBottomOpen === "boolean") {
        setIsPaperBottomOpen(ws.isPaperBottomOpen);
      }
      if (typeof ws.isOrderTicketOpen === "boolean") {
        setIsOrderTicketOpen(ws.isOrderTicketOpen);
      }
      if (typeof ws.isDomOpen === "boolean") {
        setIsDomOpen(ws.isDomOpen);
      }
      bumpSecondaryCells();
    };

    try {
      const ws = loadReplayWorkspace();
      applyWorkspaceToState(ws);
      setSavedTemplates(loadIndicatorTemplates());
    } catch {}

    try {
      const storedSettings = loadStoredSettings();
      const savedSessionMode = storedSettings.symbol?.sessions?.mode;
      if (savedSessionMode === "regular" || savedSessionMode === "extended") {
        sessionModeRef.current = savedSessionMode;
        setSessionMode(savedSessionMode);
      }
    } catch {}

    try {
      const primaryBuySell = localStorage.getItem("tradejournal_show_buysell_buttons");
      const legacyBuySell = localStorage.getItem("vela_show_buy_sell_buttons");
      if (primaryBuySell !== null) {
        setShowBuySellButtons(primaryBuySell !== "false" && primaryBuySell !== "0");
      } else if (legacyBuySell !== null) {
        setShowBuySellButtons(legacyBuySell !== "0" && legacyBuySell !== "false");
      }
    } catch {}

    try {
      sessionStorage.removeItem("vela-pro.replay.active");
      sessionStorage.removeItem("vela-pro.replay.cursor-time");
      isReplayActiveRef.current = false;
      setIsReplayActive(false);
      replayCursorTimeRef.current = null;
      setReplayCursorTime(null);
    } catch {}

    try {
      const storedPos = localStorage.getItem("vela-pro.replay.bar-position");
      if (storedPos) {
        const parsed = JSON.parse(storedPos);
        if (
          parsed &&
          typeof parsed.x === "number" &&
          typeof parsed.y === "number" &&
          parsed.x >= 0 &&
          parsed.y >= 0 &&
          parsed.y < window.innerHeight - 100
        ) {
          setBarPosition(parsed);
        }
      }
    } catch {}

    try {
      setDocked(localStorage.getItem("vela-pro.replay.docked") === "1");
    } catch {}

    hasHydratedStorageRef.current = true;
    setIsWorkspaceHydrated(true);

    // L2 Remote SQLite fallback/sync hydration
    void hydrateWorkspaceFromRemoteSettings((changed) => {
      if (!changed) return;
      try {
        const remoteWs = loadReplayWorkspace();
        applyWorkspaceToState(remoteWs);
        setSavedTemplates(loadIndicatorTemplates());
      } catch {}
    });

    void hydrateVelaSettingsFromRemote((remoteSettings) => {
      if (!remoteSettings) return;
      try {
        const savedSessionMode = remoteSettings.symbol?.sessions?.mode;
        if (savedSessionMode === "regular" || savedSessionMode === "extended") {
          sessionModeRef.current = savedSessionMode;
          setSessionMode(savedSessionMode);
        }
        if (chartRef.current) {
          const hydratedTz = normalizeChartTimezone(remoteSettings.symbol?.timezone);
          applyStoredSettingsToChart(
            chartRef.current,
            statuslineRef.current,
            watermarkRef.current,
            {
              ...remoteSettings,
              symbol: { ...remoteSettings.symbol, timezone: hydratedTz },
            },
          );
          bottombarRef.current?.setTimezone?.(hydratedTz);
          setChartTimezone(hydratedTz);
        }
      } catch {}
    });
  }, [
    activeCellIndexRef,
    bottombarRef,
    bumpSecondaryCells,
    chartRef,
    indicatorPresetsBySlugRef,
    isReplayActiveRef,
    layoutRef,
    replayCursorTimeRef,
    secondaryCellsData,
    selectedResolutionRef,
    selectedSymbolRef,
    setActiveCellIndex,
    setActiveIndicatorConfigs,
    setActiveIndicatorSlugs,
    setBarPosition,
    setDocked,
    setIsDomOpen,
    setIsOrderTicketOpen,
    setIsPaperBottomOpen,
    setIsReplayActive,
    setLayout,
    setReplayCursorTime,
    setSavedTemplates,
    setSelectedResolution,
    setSelectedSymbol,
    setSessionMode,
    setShowBuySellButtons,
    setSyncOptions,
    sessionModeRef,
    statuslineRef,
    syncOptionsRef,
    watermarkRef,
  ]);

  // Automatically persist multi-chart workspace state whenever configuration changes
  useEffect(() => {
    if (!isWorkspaceHydrated || !hasHydratedStorageRef.current) return;
    const cellsPayload: Record<
      number,
      {
        symbol: string;
        resolution: string;
        indicators?: string[];
        indicatorConfigs?: PersistedIndicatorInstance[];
      }
    > = {
      0: {
        symbol: selectedSymbol,
        resolution: selectedResolution,
        indicators: activeIndicatorSlugs,
        ...(activeIndicatorConfigs.length > 0 ? { indicatorConfigs: activeIndicatorConfigs } : {}),
      },
    };
    for (const [idx, cellData] of secondaryCellsData.current.entries()) {
      cellsPayload[idx] = {
        symbol: cellData.symbol,
        resolution: cellData.resolution,
        ...(cellData.indicators ? { indicators: cellData.indicators } : {}),
        ...(cellData.indicatorConfigs ? { indicatorConfigs: cellData.indicatorConfigs } : {}),
      };
    }
    saveReplayWorkspace({
      layout,
      syncOptions: {
        ...syncOptions,
        style: Boolean(syncOptions.style),
      },
      activeCellIndex,
      cells: cellsPayload,
      activeIndicatorSlugs,
      activeIndicatorConfigs,
      indicatorPresetsBySlug: indicatorPresetsBySlugRef.current,
      isPaperBottomOpen,
      paperBottomHeight,
      isOrderTicketOpen,
      isDomOpen,
    });
  }, [
    isWorkspaceHydrated,
    selectedSymbol,
    selectedResolution,
    layout,
    syncOptions,
    activeCellIndex,
    secondaryCellsVersion,
    activeIndicatorSlugs,
    activeIndicatorConfigs,
    indicatorPresetsVersion,
    isPaperBottomOpen,
    paperBottomHeight,
    isOrderTicketOpen,
    isDomOpen,
    indicatorPresetsBySlugRef,
    secondaryCellsData,
  ]);

  useEffect(() => {
    return () => {
      flushPendingTradeDrawingsSave();
    };
  }, []);

  return {
    isWorkspaceHydrated,
    hasHydratedStorageRef,
    chartTimezone,
    setChartTimezone,
    persistAndApplyTimezone,
    settingsOpen,
    setSettingsOpen,
    settingsInitialTab,
    setSettingsInitialTab,
    settingsTarget,
    openSettingsModal,
    openSettingsModalRef,
  };
}
