"use client";

import { useEffect, useState } from "react";
import {
  isFuturesOrEquitySymbol,
  filterCandlesBySession,
} from "@/lib/market-data";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";
import { useAlerts } from "@/lib/alerts/alerts-store";

// UI Chrome and Leaf Components
import { MarketSideRail } from "./chrome/market-side-rail";
import { MarketIndicatorPopovers } from "./indicators/market-indicator-popovers";
import { MarketReplayControlBar } from "./replay/market-replay-control-bar";
import { MarketWorkspaceGrid } from "./grid/market-workspace-grid";
import { MarketSettingsDialogPortal } from "./chrome/market-settings-dialog-portal";
import { ReplaySymbolModal } from "../replay/replay-symbol-modal";
import { VelaIndicatorsDialog } from "../replay/vela-indicators-dialog";
import { VelaPineEditorPanel } from "../replay/vela-pine-editor-panel";
import { VelaTradingDock } from "../replay/trading/vela-trading-dock";
import { VelaPaperTradingBottomPanel } from "../replay/trading/vela-paper-trading-bottom-panel";
import { VelaAlertsDockPanel } from "../alerts/vela-alerts-dock-panel";
import { VelaAlertDialog } from "../alerts/vela-alert-dialog";
import { VelaDeleteAlertModal } from "../alerts/vela-delete-alert-modal";

// Domain DAG Hooks (Camadas 0 -> 4)
import { useMarketTerminalRefs } from "./hooks/use-market-terminal-refs";
import { useMarketMultiChartSync } from "./hooks/use-market-multi-chart-sync";
import { useMarketTradingEngine } from "./hooks/use-market-trading-engine";
import { useMarketReplayPlayback } from "./hooks/use-market-replay-playback";
import { useMarketDataAndFeed } from "./hooks/use-market-data-and-feed";
import { useMarketIndicatorsEngine } from "./hooks/use-market-indicators-engine";
import { useMarketWorkspacePersistence } from "./hooks/use-market-workspace-persistence";
import { useMarketChartLifecycle } from "./hooks/use-market-chart-lifecycle";
import { useMarketKeyboardAndModals } from "./hooks/use-market-keyboard-and-modals";
import { resolveVenue, resolveAssetIcon } from "./utils/market-chart-utils";

export { isFuturesOrEquitySymbol, filterCandlesBySession, resolveVenue, resolveAssetIcon };

export function MarketTerminalChart() {
  const [isClientMounted, setIsClientMounted] = useState(false);
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Camada 0: Refs síncronas compartilhadas e tracker nativo 0ms
  const refs = useMarketTerminalRefs();

  // Camada 1: Sincronização multi-gráfico e motor de paper trading
  const multiChart = useMarketMultiChartSync({
    chartRef: refs.chartRef,
    topbarRef: refs.topbarRef,
    topbarHostRef: refs.topbarHostRef,
    drawingToolbarRef: refs.drawingToolbarRef,
    selectedSymbol: refs.selectedSymbol,
    selectedResolution: refs.selectedResolution,
    selectedSymbolRef: refs.selectedSymbolRef,
    selectedResolutionRef: refs.selectedResolutionRef,
    isSelectingCutPointRef: refs.isSelectingCutPointRef,
    isSwitchingResolutionOrSessionRef: refs.isSwitchingResolutionOrSessionRef,
    layout: refs.layout,
    setLayout: refs.setLayout,
    layoutRef: refs.layoutRef,
    syncOptions: refs.syncOptions,
    setSyncOptions: refs.setSyncOptions,
    syncOptionsRef: refs.syncOptionsRef,
    activeCellIndex: refs.activeCellIndex,
    setActiveCellIndex: refs.setActiveCellIndex,
    activeCellIndexRef: refs.activeCellIndexRef,
    gridContainerRef: refs.gridContainerRef,
    secondaryHosts: refs.secondaryHosts,
    secondaryCharts: refs.secondaryCharts,
    secondaryCellsData: refs.secondaryCellsData,
    secondaryCellsVersion: refs.secondaryCellsVersion,
    bumpSecondaryCells: refs.bumpSecondaryCells,
    layoutControllerRef: refs.layoutControllerRef,
    cellTrackerRef: refs.cellTrackerRef,
  });

  const tradingEngine = useMarketTradingEngine({
    chartRef: refs.chartRef,
    hostRef: refs.hostRef,
    secondaryChartsRef: refs.secondaryCharts,
    secondaryCellsDataRef: refs.secondaryCellsData,
    selectedSymbolRef: refs.selectedSymbolRef,
    barsRef: refs.barsRef,
    isReplayActiveRef: refs.isReplayActiveRef,
    replayCursorTimeRef: refs.replayCursorTimeRef,
    syncOptionsRef: refs.syncOptionsRef,
    syncChartRenderer: multiChart.syncChartRenderer,
    broadcastTimeClick: multiChart.broadcastTimeClick,
  });

  // Camada 2: Reprodução de Replay, Catálogo / WebSocket Feed e Indicadores Pine v6
  const replay = useMarketReplayPlayback({
    chartRef: refs.chartRef,
    secondaryChartsRef: refs.secondaryCharts,
    workspaceReplayRef: refs.workspaceReplayRef,
    statuslineRef: refs.statuslineRef,
    watermarkRef: refs.watermarkRef,
    hostRef: refs.hostRef,
    workspaceAreaRef: refs.workspaceAreaRef,
    topbarHostRef: refs.topbarHostRef,
    replayBtnRef: refs.replayBtnRef,
    bars: refs.bars,
    barsRef: refs.barsRef,
    activeCellIndexRef: refs.activeCellIndexRef,
    syncOptionsRef: refs.syncOptionsRef,
    lastCrosshairRef: refs.lastCrosshairRef,
    chartTimezone: refs.chartTimezone,
    isWorkspaceHydrated: refs.isWorkspaceHydrated,
    hasHydratedStorageRef: refs.hasHydratedStorageRef,
    triggerPaperTick: tradingEngine.triggerPaperTick,
    broadcastViewport: multiChart.broadcastViewport,
    clearAllExternalCrosshairs: multiChart.clearAllExternalCrosshairs,
    isReplayActive: refs.isReplayActive,
    setIsReplayActive: refs.setIsReplayActive,
    isReplayActiveRef: refs.isReplayActiveRef,
    isPlaying: refs.isPlaying,
    setIsPlaying: refs.setIsPlaying,
    isPlayingRef: refs.isPlayingRef,
    isSelectingCutPoint: refs.isSelectingCutPoint,
    setIsSelectingCutPoint: refs.setIsSelectingCutPoint,
    isSelectingCutPointRef: refs.isSelectingCutPointRef,
    replaySpeed: refs.replaySpeed,
    setReplaySpeed: refs.setReplaySpeed,
    replaySpeedRef: refs.replaySpeedRef,
    replayCursorTime: refs.replayCursorTime,
    setReplayCursorTime: refs.setReplayCursorTime,
    replayCursorTimeRef: refs.replayCursorTimeRef,
    replayRemaining: refs.replayRemaining,
    setReplayRemaining: refs.setReplayRemaining,
    docked: refs.docked,
    setDocked: refs.setDocked,
    barPosition: refs.barPosition,
    setBarPosition: refs.setBarPosition,
    replayBarRef: refs.replayBarRef,
  });

  const dataFeed = useMarketDataAndFeed({
    chartRef: refs.chartRef,
    hostRef: refs.hostRef,
    topbarRef: refs.topbarRef,
    bottombarRef: refs.bottombarRef,
    statuslineRef: refs.statuslineRef,
    watermarkRef: refs.watermarkRef,
    sidePanelsDockRef: refs.sidePanelsDockRef,
    layout: refs.layout,
    activeCellIndexRef: refs.activeCellIndexRef,
    syncOptionsRef: refs.syncOptionsRef,
    secondaryCharts: refs.secondaryCharts,
    secondaryCellsData: refs.secondaryCellsData,
    secondaryCellsVersion: refs.secondaryCellsVersion,
    bumpSecondaryCells: refs.bumpSecondaryCells,
    isReplayActive: refs.isReplayActive,
    isReplayActiveRef: refs.isReplayActiveRef,
    isPlayingRef: refs.isPlayingRef,
    replayCursorTimeRef: refs.replayCursorTimeRef,
    replaySpeedRef: refs.replaySpeedRef,
    setIsReplayActive: refs.setIsReplayActive,
    setIsPlaying: refs.setIsPlaying,
    setReplayCursorTime: refs.setReplayCursorTime,
    setReplayRemaining: refs.setReplayRemaining,
    triggerPaperTick: tradingEngine.triggerPaperTick,
    broadcastViewport: multiChart.broadcastViewport,
    selectedSymbol: refs.selectedSymbol,
    setSelectedSymbol: refs.setSelectedSymbol,
    selectedSymbolRef: refs.selectedSymbolRef,
    selectedResolution: refs.selectedResolution,
    setSelectedResolution: refs.setSelectedResolution,
    selectedResolutionRef: refs.selectedResolutionRef,
    renderedResolutionRef: refs.renderedResolutionRef,
    bars: refs.bars,
    setBars: refs.setBars,
    barsRef: refs.barsRef,
    rawBarsRef: refs.rawBarsRef,
    sessionMode: refs.sessionMode,
    setSessionMode: refs.setSessionMode,
    sessionModeRef: refs.sessionModeRef,
    isSwitchingResolutionOrSessionRef: refs.isSwitchingResolutionOrSessionRef,
    resolutionSwitchStateRef: refs.resolutionSwitchStateRef,
    isWorkspaceHydrated: refs.isWorkspaceHydrated,
  });

  const indicators = useMarketIndicatorsEngine({
    chartRef: refs.chartRef,
    hostRef: refs.hostRef,
    activeCellIndexRef: refs.activeCellIndexRef,
    secondaryCharts: refs.secondaryCharts,
    secondaryCellsData: refs.secondaryCellsData,
    bumpSecondaryCells: refs.bumpSecondaryCells,
    sidePanelsDockRef: refs.sidePanelsDockRef,
    initialIndicatorsToRestoreRef: refs.initialIndicatorsToRestoreRef,
    indicatorPresetsBySlugRef: refs.indicatorPresetsBySlugRef,
  });

  // Camada 3: Persistência de Workspace e Ciclo de Vida do Vela
  const persistence = useMarketWorkspacePersistence({
    chartRef: refs.chartRef,
    bottombarRef: refs.bottombarRef,
    statuslineRef: refs.statuslineRef,
    watermarkRef: refs.watermarkRef,
    selectedSymbol: refs.selectedSymbol,
    setSelectedSymbol: refs.setSelectedSymbol,
    selectedSymbolRef: refs.selectedSymbolRef,
    selectedResolution: refs.selectedResolution,
    setSelectedResolution: refs.setSelectedResolution,
    selectedResolutionRef: refs.selectedResolutionRef,
    bars: refs.bars,
    barsRef: refs.barsRef,
    layout: multiChart.layout,
    setLayout: multiChart.setLayout,
    layoutRef: multiChart.layoutRef,
    syncOptions: multiChart.syncOptions,
    setSyncOptions: multiChart.setSyncOptions,
    syncOptionsRef: multiChart.syncOptionsRef,
    activeCellIndex: multiChart.activeCellIndex,
    setActiveCellIndex: multiChart.setActiveCellIndex,
    activeCellIndexRef: multiChart.activeCellIndexRef,
    activeSymbolRef: multiChart.activeSymbolRef,
    activeResolutionRef: multiChart.activeResolutionRef,
    secondaryCharts: refs.secondaryCharts,
    secondaryCellsData: refs.secondaryCellsData,
    secondaryCellsVersion: refs.secondaryCellsVersion,
    bumpSecondaryCells: refs.bumpSecondaryCells,
    handleActivateCell: multiChart.handleActivateCell,
    activeIndicatorSlugs: indicators.activeIndicatorSlugs,
    setActiveIndicatorSlugs: indicators.setActiveIndicatorSlugs,
    activeIndicatorConfigs: indicators.activeIndicatorConfigs,
    setActiveIndicatorConfigs: indicators.setActiveIndicatorConfigs,
    initialIndicatorsToRestoreRef: refs.initialIndicatorsToRestoreRef,
    indicatorPresetsBySlugRef: refs.indicatorPresetsBySlugRef,
    indicatorPresetsVersion: indicators.indicatorPresetsVersion,
    setSavedTemplates: indicators.setSavedTemplates,
    setSessionMode: refs.setSessionMode,
    sessionModeRef: refs.sessionModeRef,
    isOrderTicketOpen: tradingEngine.isOrderTicketOpen,
    setIsOrderTicketOpen: tradingEngine.setIsOrderTicketOpen,
    isDomOpen: tradingEngine.isDomOpen,
    setIsDomOpen: tradingEngine.setIsDomOpen,
    isPaperBottomOpen: tradingEngine.isPaperBottomOpen,
    setIsPaperBottomOpen: tradingEngine.setIsPaperBottomOpen,
    paperBottomHeight: tradingEngine.paperBottomHeight,
    setPaperBottomHeight: tradingEngine.setPaperBottomHeight,
    setShowBuySellButtons: tradingEngine.setShowBuySellButtons,
    setIsReplayActive: refs.setIsReplayActive,
    isReplayActiveRef: refs.isReplayActiveRef,
    setReplayCursorTime: refs.setReplayCursorTime,
    replayCursorTimeRef: refs.replayCursorTimeRef,
    setBarPosition: replay.setBarPosition,
    setDocked: replay.setDocked,
    isWorkspaceHydrated: refs.isWorkspaceHydrated,
    setIsWorkspaceHydrated: refs.setIsWorkspaceHydrated,
    hasHydratedStorageRef: refs.hasHydratedStorageRef,
  });

  const [symbolDialogOpen, setSymbolDialogOpen] = useState(false);

  const lifecycle = useMarketChartLifecycle({
    refs,
    multiChart,
    dataFeed,
    replay,
    indicators,
    persistence,
    tradingEngine,
    onOpenSymbolSearch: () => setSymbolDialogOpen(true),
    onOpenIndicatorsDialog: () => indicators.setIndicatorsDialogOpen(true),
    onOpenSettingsModal: (cellIdx, section) => persistence.openSettingsModal(cellIdx, section),
    onActiveSidePanelChange: refs.setActiveSidePanel,
  });

  // Camada 4: Atalhos de teclado, hierarquia de Escape e foco
  const keyboard = useMarketKeyboardAndModals({
    symbolDialogOpen,
    setSymbolDialogOpen,
    indicatorsDialogOpen: indicators.indicatorsDialogOpen,
    setIndicatorsDialogOpen: indicators.setIndicatorsDialogOpen,
    settingsOpen: persistence.settingsOpen,
    setSettingsOpen: persistence.setSettingsOpen,
    favMenuOpen: indicators.favMenuOpen,
    setFavMenuOpen: indicators.setFavMenuOpen,
    templatesMenuOpen: indicators.templatesMenuOpen,
    setTemplatesMenuOpen: indicators.setTemplatesMenuOpen,
    setIsNamingTemplate: indicators.setIsNamingTemplate,
    scrubOpen: replay.scrubOpen,
    setScrubOpen: replay.setScrubOpen,
    speedMenuOpen: replay.speedMenuOpen,
    setSpeedMenuOpen: replay.setSpeedMenuOpen,
    datePickerOpen: replay.datePickerOpen,
    setDatePickerOpen: replay.setDatePickerOpen,
    isReplayActiveRef: refs.isReplayActiveRef,
    isSelectingCutPointRef: refs.isSelectingCutPointRef,
    setIsSelectingCutPoint: refs.setIsSelectingCutPoint,
    setIsOrderTicketOpen: tradingEngine.setIsOrderTicketOpen,
    setIsDomOpen: tradingEngine.setIsDomOpen,
    handleTogglePlay: replay.handleTogglePlay,
    handleStepForward: replay.handleStepForward,
    activeSidePanel: refs.activeSidePanel,
    setActiveSidePanel: refs.setActiveSidePanel,
  });

  const { logs: alertLogs } = useAlerts();

  return (
    <div className="vela-chart-chrome-replay vela-ui quant-chart-chrome flex flex-row h-full w-full min-h-0 min-w-0 bg-[var(--vela-bg)] text-foreground select-none overflow-hidden relative">
      <div className="flex flex-col min-w-0 flex-1 h-full">
        <div className="flex items-center border-b border-[var(--vela-border)] bg-[var(--vela-bg)] min-h-[39px]">
          <div ref={refs.topbarHostRef} className="w-full bg-[var(--vela-bg)]" />
        </div>

        <div
          ref={refs.workspaceAreaRef}
          className={`relative flex flex-row flex-1 h-full min-h-0 w-full bg-[var(--vela-bg)] overflow-hidden ${
            refs.isSelectingCutPoint ? "cursor-crosshair" : ""
          }`}
        >
          {/* Left Drawing Toolbar - goes all the way from Topbar to bottom of screen */}
          <div ref={refs.drawingToolbarHostRef} className="h-full shrink-0" />

          {/* Center Chart Column (strictly between Left Drawing Toolbar and Right Side Docks) */}
          <div
            className="vela-replay-center-col relative flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden"
            style={
              {
                "--vela-layout-rows": String(refs.layout.rows),
              } as React.CSSProperties
            }
          >
            {/* Chart Grid & Overlays Area */}
            <div className="relative flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden">
              <MarketWorkspaceGrid
                gridContainerRef={refs.gridContainerRef}
                primaryHostRef={refs.hostRef}
                primaryChartInstance={refs.chartRef.current}
                layout={refs.layout}
                activeCellIndex={refs.activeCellIndex}
                selectedSymbol={refs.selectedSymbol}
                isReplayActive={refs.isReplayActive}
                replayCursorTime={refs.replayCursorTime}
                primaryFallbackPrice={
                  refs.barsRef.current[refs.barsRef.current.length - 1]?.close ??
                  refs.bars[refs.bars.length - 1]?.close
                }
                showBuySellButtons={tradingEngine.showBuySellButtons}
                secondaryHosts={refs.secondaryHosts}
                secondaryCharts={refs.secondaryCharts}
                secondaryCellsData={refs.secondaryCellsData}
                onActivateCell={multiChart.handleActivateCell}
                onOpenOrderTicket={() => tradingEngine.setIsOrderTicketOpen(true)}
                onOpenDOM={() => tradingEngine.setIsDomOpen(true)}
              />

              {refs.isSelectingCutPoint && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
                  <div className="px-4 py-2 rounded-lg bg-[var(--vela-bg-floating,#1e222d)]/95 border border-[var(--vela-border,#2a2e39)] shadow-xl text-center backdrop-blur-sm">
                    <span className="text-xs font-medium text-[var(--vela-color,#d1d4dc)]">
                      Bar replay: click the bar to start from
                    </span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      Click any historical bar to set the starting point
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`absolute top-0 right-0 z-30 h-full border-l border-[var(--vela-border)] bg-[var(--vela-bg)] shadow-2xl transition-all duration-200 ease-in-out ${
                  tradingEngine.isOrderTicketOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
                }`}
              >
                <VelaTradingDock
                  isOpen={tradingEngine.isOrderTicketOpen}
                  onClose={() => tradingEngine.setIsOrderTicketOpen(false)}
                  symbol={multiChart.activeSymbol}
                />
              </div>

              <MarketReplayControlBar {...replay.controlBarProps} />
            </div>

            {/* Bottom Stack: 1º Bottombar (Data, Relógio, Timezone e RTH/ETH), 2º Replay Trading Panel (apenas se replay ativo) */}
            <div className="vela-replay-bottom-stack flex flex-col shrink-0">
              {/* Bottombar row: Native Vela Bottombar with Time Range, Clock, Timezone and RTH/ETH */}
              <div ref={refs.bottombarHostRef} className="w-full shrink-0 bg-[var(--vela-bg)] h-[39px]" />

              {/* Paper Trading Bottom Panel - SOMENTE quando replay for invocado */}
              {refs.isReplayActive && (
                <VelaPaperTradingBottomPanel
                  isOpen={tradingEngine.isPaperBottomOpen}
                  onToggle={() => tradingEngine.setIsPaperBottomOpen((v) => !v)}
                  onHeightChange={tradingEngine.setPaperBottomHeight}
                  onNavigateToTrade={tradingEngine.handleNavigateToTrade}
                  isReplayMode={refs.isReplayActive}
                  onExitReplay={() => {
                    tradingEngine.cleanupPaperTradingOnExitReplay();
                    replay.handleStopReplay();
                  }}
                />
              )}
            </div>
          </div>

          {/* Docks e painéis laterais à direita da coluna do gráfico */}
          <div ref={refs.panelDockHostRef} className="relative flex flex-row self-stretch shrink-0" />

          <VelaPineEditorPanel
            isOpen={indicators.pineEditorOpen}
            onClose={() => indicators.setPineEditorOpen(false)}
            onRunScript={indicators.handleRunPineScript}
          />

          {keyboard.activeSidePanel === "alerts" && (
            <VelaAlertsDockPanel
              currentSymbol={multiChart.activeSymbol}
              onClose={() => keyboard.setActiveSidePanel(null)}
            />
          )}
        </div>
      </div>

      <MarketSideRail
        sideRailHostRef={refs.sideRailHostRef}
        activePanel={keyboard.activeSidePanel}
        pineEditorOpen={indicators.pineEditorOpen}
        alertLogsCount={alertLogs.length}
        isClientMounted={isClientMounted}
        onScreenshotClick={() => refs.screenshotMenuControllerRef.current?.open?.()}
        onToggleAlerts={() => keyboard.setActiveSidePanel(keyboard.activeSidePanel === "alerts" ? null : "alerts")}
        onToggleObjectTree={() => lifecycle.handleToggleNativeSidePanel("objects")}
        onToggleDataWindow={() => {
          indicators.setPineEditorOpen(false);
          lifecycle.handleToggleNativeSidePanel("dataWindow");
        }}
        onTogglePineEditor={() => {
          indicators.setPineEditorOpen((prev) => {
            const next = !prev;
            if (next) refs.sidePanelsDockRef.current?.close();
            return next;
          });
        }}
        onOpenChartSettings={() => persistence.openSettingsModal(undefined, "symbol")}
      />

      <MarketIndicatorPopovers {...indicators.indicatorPopoversProps} />

      <ReplaySymbolModal
        isOpen={symbolDialogOpen}
        onClose={() => setSymbolDialogOpen(false)}
        selectedSymbol={multiChart.activeSymbol}
        catalog={dataFeed.catalog}
        onSelectSymbol={dataFeed.handleSelectSymbol}
      />

      <VelaIndicatorsDialog
        isOpen={indicators.indicatorsDialogOpen}
        onClose={() => indicators.setIndicatorsDialogOpen(false)}
        onApplyIndicator={indicators.handleApplyIndicator}
        onApplyNativeIndicator={indicators.handleApplyNativeIndicator}
        activeIndicatorSlugs={indicators.activeIndicatorSlugs}
      />

      <MarketSettingsDialogPortal
        refs={refs}
        persistence={persistence}
        dataFeed={dataFeed}
        activeCellIndex={multiChart.activeCellIndex}
      />

      <VelaAlertDialog />
      <VelaDeleteAlertModal />
    </div>
  );
}

export { MarketTerminalChart as ReplayMarketChart };
