import { useRef, useState, useCallback } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import { NativeWorkspaceCellTracker } from "@luxalgo/vela";
import type {
  LayoutShape,
  SyncOptions,
  LayoutPickerController,
  ScreenshotMenuController,
  VelaSidePanelsController,
} from "@luxalgo/vela/widget";
import type { MarketBar, Resolution } from "@/lib/market-data";
import type { AugmentedVelaInstance } from "@luxalgo/vela/workspace";
import type {
  PersistedIndicatorInstance,
  PersistedIndicatorPreset,
} from "@/lib/replay/workspace-persistence";
import type { ReplayBarPosition } from "../replay/market-replay-control-bar";
import type { MarketSidePanelId } from "../chrome/market-side-rail";

export interface SecondaryCellMarketData {
  symbol: string;
  resolution: Resolution;
  bars: MarketBar[];
  rawBars: MarketBar[];
  indicators?: string[];
  indicatorConfigs?: PersistedIndicatorInstance[];
}

export interface CrosshairPointerSnapshot {
  price: number | null;
  decimals: number;
  time: number | null;
}

export interface ResolutionSwitchState {
  status: "idle" | "switching";
  targetResolution: Resolution | null;
  targetSymbol: string | null;
  cellIndex: number;
  startedAt: number;
}

export interface UseMarketTerminalRefsReturn {
  // DOM Hosts
  hostRef: React.RefObject<HTMLDivElement | null>;
  workspaceAreaRef: React.RefObject<HTMLDivElement | null>;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  topbarHostRef: React.RefObject<HTMLDivElement | null>;
  bottombarHostRef: React.RefObject<HTMLDivElement | null>;
  panelDockHostRef: React.RefObject<HTMLDivElement | null>;
  sideRailHostRef: React.RefObject<HTMLElement | null>;
  drawingToolbarHostRef: React.RefObject<HTMLDivElement | null>;
  replayBarRef: React.RefObject<HTMLDivElement | null>;
  replayBtnRef: React.MutableRefObject<HTMLButtonElement | null>;

  // Instâncias Imperativas do Vela (Célula 0 + Widgets)
  chartRef: React.MutableRefObject<AugmentedVelaInstance | null>;
  chartReadyInstance: AugmentedVelaInstance | null;
  setChartReadyInstance: React.Dispatch<React.SetStateAction<AugmentedVelaInstance | null>>;
  activeSidePanel: MarketSidePanelId | null;
  setActiveSidePanel: React.Dispatch<React.SetStateAction<MarketSidePanelId | null>>;
  topbarRef: React.MutableRefObject<any>;
  bottombarRef: React.MutableRefObject<any>;
  statuslineRef: React.MutableRefObject<any>;
  watermarkRef: React.MutableRefObject<any>;
  drawingToolbarRef: React.MutableRefObject<any>;
  workspaceReplayRef: React.MutableRefObject<any>;
  sidePanelsDockRef: React.MutableRefObject<VelaSidePanelsController | null>;
  screenshotMenuControllerRef: React.MutableRefObject<ScreenshotMenuController | null>;
  layoutControllerRef: React.MutableRefObject<LayoutPickerController | null>;

  // Rastreador Síncrono 0ms de Células (Pacote @luxalgo/vela)
  cellTrackerRef: React.MutableRefObject<NativeWorkspaceCellTracker>;
  secondaryHosts: React.MutableRefObject<Map<number, HTMLDivElement>>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  secondaryCellsVersion: number;
  bumpSecondaryCells: () => void;

  // Estados & Refs Compartilhados de Mercado (Símbolo, Timeframe, Barras, Sessão)
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

  // Estados & Refs Compartilhados de Layout e Foco
  layout: LayoutShape;
  setLayout: React.Dispatch<React.SetStateAction<LayoutShape>>;
  layoutRef: React.MutableRefObject<LayoutShape>;
  syncOptions: SyncOptions;
  setSyncOptions: React.Dispatch<React.SetStateAction<SyncOptions>>;
  syncOptionsRef: React.MutableRefObject<SyncOptions>;
  activeCellIndex: number;
  setActiveCellIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCellIndexRef: React.MutableRefObject<number>;

  // Estados & Refs Compartilhados de Replay
  isReplayActive: boolean;
  setIsReplayActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReplayActiveRef: React.MutableRefObject<boolean>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isPlayingRef: React.MutableRefObject<boolean>;
  isSelectingCutPoint: boolean;
  setIsSelectingCutPoint: React.Dispatch<React.SetStateAction<boolean>>;
  isSelectingCutPointRef: React.MutableRefObject<boolean>;
  replaySpeed: number;
  setReplaySpeed: React.Dispatch<React.SetStateAction<number>>;
  replaySpeedRef: React.MutableRefObject<number>;
  replayCursorTime: number | null;
  setReplayCursorTime: React.Dispatch<React.SetStateAction<number | null>>;
  replayCursorTimeRef: React.MutableRefObject<number | null>;
  replayRemaining: number;
  setReplayRemaining: React.Dispatch<React.SetStateAction<number>>;
  docked: boolean;
  setDocked: React.Dispatch<React.SetStateAction<boolean>>;
  barPosition: ReplayBarPosition | null;
  setBarPosition: React.Dispatch<React.SetStateAction<ReplayBarPosition | null>>;

  // Refs de Coordenação de Transição, Hidratação e Indicadores
  isWorkspaceHydrated: boolean;
  setIsWorkspaceHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  hasHydratedStorageRef: React.MutableRefObject<boolean>;
  chartTimezone: string;
  setChartTimezone: React.Dispatch<React.SetStateAction<string>>;
  isSwitchingResolutionOrSessionRef: React.MutableRefObject<boolean>;
  resolutionSwitchStateRef: React.MutableRefObject<ResolutionSwitchState>;
  lastCrosshairRef: React.MutableRefObject<CrosshairPointerSnapshot>;
  initialIndicatorsToRestoreRef: React.MutableRefObject<
    Array<string | PersistedIndicatorInstance>
  >;
  indicatorPresetsBySlugRef: React.MutableRefObject<
    Record<string, PersistedIndicatorPreset>
  >;
  openIndicatorsRef: React.MutableRefObject<() => void>;
}

export function useMarketTerminalRefs(options?: {
  initialSymbol?: string;
  initialResolution?: Resolution;
}): UseMarketTerminalRefsReturn {
  const initialSymbol = options?.initialSymbol ?? "MES";
  const initialResolution = options?.initialResolution ?? "5m";

  // DOM Hosts
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceAreaRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const topbarHostRef = useRef<HTMLDivElement | null>(null);
  const bottombarHostRef = useRef<HTMLDivElement | null>(null);
  const panelDockHostRef = useRef<HTMLDivElement | null>(null);
  const sideRailHostRef = useRef<HTMLElement | null>(null);
  const drawingToolbarHostRef = useRef<HTMLDivElement | null>(null);
  const replayBarRef = useRef<HTMLDivElement | null>(null);
  const replayBtnRef = useRef<HTMLButtonElement | null>(null);

  // Instâncias Imperativas Vela
  const chartRef = useRef<AugmentedVelaInstance | null>(null);
  const [chartReadyInstance, setChartReadyInstance] = useState<AugmentedVelaInstance | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<MarketSidePanelId | null>(null);
  const topbarRef = useRef<any>(null);
  const bottombarRef = useRef<any>(null);
  const statuslineRef = useRef<any>(null);
  const watermarkRef = useRef<any>(null);
  const drawingToolbarRef = useRef<any>(null);
  const workspaceReplayRef = useRef<any>(null);
  const sidePanelsDockRef = useRef<VelaSidePanelsController | null>(null);
  const screenshotMenuControllerRef = useRef<ScreenshotMenuController | null>(null);
  const layoutControllerRef = useRef<LayoutPickerController | null>(null);

  // Cell Tracker síncrono 0ms
  const cellTrackerRef = useRef<NativeWorkspaceCellTracker>(new NativeWorkspaceCellTracker());

  const secondaryHosts = useRef<Map<number, HTMLDivElement>>(new Map());
  const secondaryCharts = useRef<Map<number, any>>(new Map());
  const secondaryCellsData = useRef<Map<number, SecondaryCellMarketData>>(new Map());
  const [secondaryCellsVersion, setSecondaryCellsVersion] = useState(0);
  const bumpSecondaryCells = useCallback(() => {
    setSecondaryCellsVersion((v) => v + 1);
  }, []);

  // Mercado
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const selectedSymbolRef = useRef(initialSymbol);
  selectedSymbolRef.current = selectedSymbol;

  const [selectedResolution, setSelectedResolution] = useState<Resolution>(initialResolution);
  const selectedResolutionRef = useRef<Resolution>(initialResolution);
  selectedResolutionRef.current = selectedResolution;

  const renderedResolutionRef = useRef<Resolution>(initialResolution);

  const [bars, setBars] = useState<MarketBar[]>([]);
  const barsRef = useRef<MarketBar[]>([]);
  barsRef.current = bars;
  const rawBarsRef = useRef<MarketBar[]>([]);

  const [sessionMode, setSessionMode] = useState<"regular" | "extended">("extended");
  const sessionModeRef = useRef<"regular" | "extended">("extended");
  sessionModeRef.current = sessionMode;

  // Layout & Foco
  const [layout, setLayout] = useState<LayoutShape>({ rows: 1, cols: 1 });
  const layoutRef = useRef<LayoutShape>({ rows: 1, cols: 1 });
  layoutRef.current = layout;

  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    symbol: false,
    interval: false,
    crosshair: true,
    time: false,
    dateRange: false,
  });
  const syncOptionsRef = useRef<SyncOptions>(syncOptions);
  syncOptionsRef.current = syncOptions;

  const [activeCellIndex, setActiveCellIndex] = useState(0);
  const activeCellIndexRef = useRef(0);
  activeCellIndexRef.current = activeCellIndex;

  // Replay
  const [isReplayActive, setIsReplayActive] = useState(false);
  const isReplayActiveRef = useRef(false);
  isReplayActiveRef.current = isReplayActive;

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const [isSelectingCutPoint, setIsSelectingCutPoint] = useState(false);
  const isSelectingCutPointRef = useRef(false);
  isSelectingCutPointRef.current = isSelectingCutPoint;

  const [replaySpeed, setReplaySpeed] = useState(1000);
  const replaySpeedRef = useRef(1000);
  replaySpeedRef.current = replaySpeed;

  const [replayCursorTime, setReplayCursorTime] = useState<number | null>(null);
  const replayCursorTimeRef = useRef<number | null>(null);
  replayCursorTimeRef.current = replayCursorTime;

  const [replayRemaining, setReplayRemaining] = useState(0);
  const [docked, setDocked] = useState(false);
  const [barPosition, setBarPosition] = useState<ReplayBarPosition | null>(null);

  // Coordenação & Hidratação
  const [isWorkspaceHydrated, setIsWorkspaceHydrated] = useState(false);
  const hasHydratedStorageRef = useRef(false);
  const [chartTimezone, setChartTimezone] = useState("Etc/UTC");

  const isSwitchingResolutionOrSessionRef = useRef(false);
  const resolutionSwitchStateRef = useRef<ResolutionSwitchState>({
    status: "idle",
    targetResolution: null,
    targetSymbol: null,
    cellIndex: 0,
    startedAt: 0,
  });

  const lastCrosshairRef = useRef<CrosshairPointerSnapshot>({
    price: null,
    decimals: 2,
    time: null,
  });

  const initialIndicatorsToRestoreRef = useRef<Array<string | PersistedIndicatorInstance>>([]);
  const indicatorPresetsBySlugRef = useRef<Record<string, PersistedIndicatorPreset>>({});
  const openIndicatorsRef = useRef<() => void>(() => {});

  return {
    hostRef,
    workspaceAreaRef,
    gridContainerRef,
    topbarHostRef,
    bottombarHostRef,
    panelDockHostRef,
    sideRailHostRef,
    drawingToolbarHostRef,
    replayBarRef,
    replayBtnRef,

    chartRef,
    chartReadyInstance,
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

    cellTrackerRef,
    secondaryHosts,
    secondaryCharts,
    secondaryCellsData,
    secondaryCellsVersion,
    bumpSecondaryCells,

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

    layout,
    setLayout,
    layoutRef,
    syncOptions,
    setSyncOptions,
    syncOptionsRef,
    activeCellIndex,
    setActiveCellIndex,
    activeCellIndexRef,

    isReplayActive,
    setIsReplayActive,
    isReplayActiveRef,
    isPlaying,
    setIsPlaying,
    isPlayingRef,
    isSelectingCutPoint,
    setIsSelectingCutPoint,
    isSelectingCutPointRef,
    replaySpeed,
    setReplaySpeed,
    replaySpeedRef,
    replayCursorTime,
    setReplayCursorTime,
    replayCursorTimeRef,
    replayRemaining,
    setReplayRemaining,
    docked,
    setDocked,
    barPosition,
    setBarPosition,

    isWorkspaceHydrated,
    setIsWorkspaceHydrated,
    hasHydratedStorageRef,
    chartTimezone,
    setChartTimezone,
    isSwitchingResolutionOrSessionRef,
    resolutionSwitchStateRef,
    lastCrosshairRef,
    initialIndicatorsToRestoreRef,
    indicatorPresetsBySlugRef,
    openIndicatorsRef,
    activeSidePanel,
    setActiveSidePanel,
  };
}
