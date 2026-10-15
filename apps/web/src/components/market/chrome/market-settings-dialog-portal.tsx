"use client";

import React from "react";
import { VelaSettingsDialog } from "@/components/settings/vela-settings-dialog";
import {
  applyStoredSettingsToChart,
  loadStoredSettings,
  resolveSampleAnchor,
} from "@luxalgo/vela/workspace";
import { getSymbolSpec } from "@/lib/assets/symbol-specs";
import { getGlobalPaperEngine } from "@/lib/paper-trading";
import type { UseMarketTerminalRefsReturn } from "../hooks/use-market-terminal-refs";
import type { UseMarketWorkspacePersistenceReturn } from "../hooks/use-market-workspace-persistence";
import type { UseMarketDataAndFeedReturn } from "../hooks/use-market-data-and-feed";

export interface MarketSettingsDialogPortalProps {
  refs: UseMarketTerminalRefsReturn;
  persistence: UseMarketWorkspacePersistenceReturn;
  dataFeed: UseMarketDataAndFeedReturn;
  activeCellIndex: number;
}

export function MarketSettingsDialogPortal({
  refs,
  persistence,
  dataFeed,
  activeCellIndex,
}: MarketSettingsDialogPortalProps) {
  if (!persistence.settingsOpen) return null;

  const target = persistence.settingsTarget;
  const activeIdx = target?.cellIndex ?? activeCellIndex;
  const activeCellData = activeIdx === 0 ? null : refs.secondaryCellsData.current.get(activeIdx);
  const activeCellSymbol = target?.symbol ?? activeCellData?.symbol ?? refs.selectedSymbol;
  const activeCellResolution =
    target?.resolution ?? activeCellData?.resolution ?? refs.selectedResolution;
  const activeChartInst =
    target?.chartInstance ??
    (activeIdx === 0
      ? refs.chartRef.current
      : (refs.secondaryCharts.current.get(activeIdx) ?? refs.chartRef.current));
  const activeStatusline =
    target?.statusline ??
    (activeIdx === 0
      ? refs.statuslineRef.current
      : ((activeChartInst as any)?.__statusline ?? refs.statuslineRef.current));
  const activeWatermark =
    target?.watermark ??
    (activeIdx === 0
      ? refs.watermarkRef.current
      : ((activeChartInst as any)?.__watermark ?? refs.watermarkRef.current));
  const activeCellBars =
    activeIdx === 0
      ? refs.barsRef.current.length > 0
        ? refs.barsRef.current
        : refs.bars
      : activeCellData?.bars && activeCellData.bars.length > 0
        ? activeCellData.bars
        : [];
  const lastBarClose =
    (activeChartInst as any)?.__symbol?.toUpperCase() === activeCellSymbol.toUpperCase() &&
    typeof (activeChartInst as any)?.__lastBar?.close === "number"
      ? (activeChartInst as any).__lastBar.close
      : activeCellBars.length > 0
        ? activeCellBars[activeCellBars.length - 1]!.close
        : undefined;
  const enginePrice = getGlobalPaperEngine().getLastPrice(activeCellSymbol.toUpperCase());
  const rawCandidatePrice =
    target?.referencePrice ??
    (typeof lastBarClose === "number" && lastBarClose > 0
      ? lastBarClose
      : typeof enginePrice === "number" && enginePrice > 0
        ? enginePrice
        : undefined);
  const rawCandidateTick =
    target?.tickSize ?? getSymbolSpec(activeCellSymbol)?.tickSize ?? 0.25;
  const validatedAnchor = resolveSampleAnchor(
    activeCellSymbol,
    rawCandidatePrice,
    rawCandidateTick,
  );

  return (
    <VelaSettingsDialog
      key={`settings-${activeIdx}-${activeCellSymbol}-${validatedAnchor.price}`}
      isOpen={persistence.settingsOpen}
      onClose={() => persistence.setSettingsOpen(false)}
      initialTab={persistence.settingsInitialTab}
      chartInstance={activeChartInst}
      statusline={activeStatusline}
      watermark={activeWatermark}
      symbol={activeCellSymbol}
      resolution={activeCellResolution}
      candleCount={activeCellBars.length}
      referencePrice={validatedAnchor.price}
      tickSize={validatedAnchor.tickSize}
      currentTimezone={refs.chartTimezone}
      sessionMode={refs.sessionMode}
      onSessionChange={dataFeed.handleSessionChange}
      onTimezoneChange={persistence.persistAndApplyTimezone}
      onApplySetting={(path: string, value: any) => {
        if (path.includes("Chart style") || path.includes("style")) {
          refs.topbarRef.current?.setPriceStyle?.(value);
        }
        const stored = loadStoredSettings();
        if (refs.chartRef.current) {
          applyStoredSettingsToChart(
            refs.chartRef.current,
            refs.statuslineRef.current,
            refs.watermarkRef.current,
            stored,
          );
        }
        for (const secInst of refs.secondaryCharts.current.values()) {
          applyStoredSettingsToChart(
            secInst,
            (secInst as any)?.__statusline,
            (secInst as any)?.__watermark,
            stored,
          );
        }
      }}
    />
  );
}
