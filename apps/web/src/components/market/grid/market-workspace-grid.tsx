import React from "react";
import type { LayoutShape } from "@luxalgo/vela/widget";
import type { MarketBar } from "@/lib/market-data";
import type { SecondaryCellMarketData } from "../hooks/use-market-trading-engine";
import {
  VelaVisualTradingOverlay,
  VelaDesktopTradingButtons,
} from "../../replay/trading";

/**
 * Busca binária O(log N) sem alocação de memória para localizar o fechamento
 * da última barra com `time <= cursorTime` durante ticks rápidos do Replay.
 */
function findLastBarCloseAtOrBefore(
  bars: MarketBar[] | undefined,
  cursorTime: number | null | undefined,
): number | undefined {
  if (!bars || bars.length === 0) return undefined;
  if (typeof cursorTime !== "number") {
    return bars[bars.length - 1]?.close;
  }

  let low = 0;
  let high = bars.length - 1;
  let bestIdx = -1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const bar = bars[mid];
    if (bar && bar.time <= cursorTime) {
      bestIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestIdx >= 0 ? bars[bestIdx]?.close : bars[bars.length - 1]?.close;
}

export interface MarketWorkspaceGridProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  primaryHostRef: React.RefObject<HTMLDivElement | null>;
  primaryChartInstance: any;

  layout: LayoutShape;
  activeCellIndex: number;
  selectedSymbol: string;
  isReplayActive: boolean;
  replayCursorTime: number | null;
  primaryFallbackPrice?: number;
  showBuySellButtons: boolean;

  secondaryHosts: React.MutableRefObject<Map<number, HTMLDivElement>>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;

  onActivateCell: (cellIndex: number) => void;
  onOpenOrderTicket: () => void;
  onOpenDOM?: () => void;
}

export function MarketWorkspaceGrid({
  gridContainerRef,
  primaryHostRef,
  primaryChartInstance,
  layout,
  activeCellIndex,
  selectedSymbol,
  isReplayActive,
  replayCursorTime,
  primaryFallbackPrice,
  showBuySellButtons,
  secondaryHosts,
  secondaryCharts,
  secondaryCellsData,
  onActivateCell,
  onOpenOrderTicket,
  onOpenDOM,
}: MarketWorkspaceGridProps) {
  return (
    <div
      ref={gridContainerRef}
      className="vela-ws-grid relative h-full flex-1 min-w-0"
      data-multi={layout.rows * layout.cols > 1 ? "1" : undefined}
      style={{
        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
      }}
    >
      {/* Primary Cell (Index 0) */}
      <div
        ref={primaryHostRef}
        className="vela-cell relative h-full w-full min-w-0 min-h-0 bg-[var(--vela-bg)]"
        data-active={activeCellIndex === 0 ? "1" : undefined}
        onClick={() => onActivateCell(0)}
        onPointerDown={() => onActivateCell(0)}
      >
        {primaryChartInstance && (
          <>
            <VelaVisualTradingOverlay
              chartInstance={primaryChartInstance}
              symbol={selectedSymbol}
              showTrading={isReplayActive}
              onOpenOrderTicket={onOpenOrderTicket}
            />
            {isReplayActive && (
              <VelaDesktopTradingButtons
                symbol={selectedSymbol}
                isActive={activeCellIndex === 0}
                fallbackPrice={primaryFallbackPrice}
                visible={showBuySellButtons}
                onOpenOrderTicket={onOpenOrderTicket}
                onOpenDOM={onOpenDOM}
              />
            )}
          </>
        )}
      </div>

      {/* Secondary Cells (Index 1..N) */}
      {Array.from({ length: Math.max(0, layout.rows * layout.cols - 1) }, (_, idx) => {
        const cellIndex = idx + 1;
        const secInst = secondaryCharts.current.get(cellIndex);
        const cellSym = secondaryCellsData.current.get(cellIndex)?.symbol ?? selectedSymbol;
        const cellBars = secondaryCellsData.current.get(cellIndex)?.bars;
        const secFallbackPrice = isReplayActive
          ? findLastBarCloseAtOrBefore(cellBars, replayCursorTime)
          : cellBars?.[cellBars.length - 1]?.close;

        return (
          <div
            key={cellIndex}
            ref={(el) => {
              if (el) secondaryHosts.current.set(cellIndex, el);
              else secondaryHosts.current.delete(cellIndex);
            }}
            className="vela-cell relative h-full w-full min-w-0 min-h-0 bg-[var(--vela-bg)]"
            data-active={activeCellIndex === cellIndex ? "1" : undefined}
            onClick={() => onActivateCell(cellIndex)}
            onPointerDown={() => onActivateCell(cellIndex)}
          >
            {secInst && (
              <>
                <VelaVisualTradingOverlay
                  chartInstance={secInst}
                  symbol={cellSym}
                  showTrading={isReplayActive}
                  onOpenOrderTicket={onOpenOrderTicket}
                />
                {isReplayActive && (
                  <VelaDesktopTradingButtons
                    symbol={cellSym}
                    isActive={activeCellIndex === cellIndex}
                    fallbackPrice={secFallbackPrice}
                    visible={showBuySellButtons}
                    onOpenOrderTicket={onOpenOrderTicket}
                    onOpenDOM={onOpenDOM}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
