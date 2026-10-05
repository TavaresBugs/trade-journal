"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn, fmtMoney, fmtNumber } from "@/lib/utils";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Dot,
  Grid,
  ReferenceLine,
  XAxis,
  YAxis,
  TOOLTIP_SURFACE_CLASSES,
  TooltipHeader,
  TooltipRow,
  type ChartConfig,
} from "@/components/dither-kit";

export interface HourBucket {
  key: string; // "09"
  netPnl: number;
  trades: number;
}

/**
 * Time-of-day performance rendered with the retro Dither Kit:
 * - Upper pane: Net P&L per opening hour as diverging dithered bars (green/red with bloom glow).
 * - Lower pane: Trade volume as a dithered line chart with dots on category band centers.
 * - Synchronized hover crosshairs and tooltips across both panes.
 *
 * Keeps 100% of underlying calculations and business rules intact.
 */
export function TimeHeatmap({
  hours,
  height = 300,
  currency = "USD",
}: {
  hours: HourBucket[];
  height?: number;
  currency?: string;
}) {
  const privateMode = usePrivacy();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(
    () =>
      hours.map((h) => ({
        key: h.key,
        hourLabel: `${h.key}:00`,
        hourRange: `${h.key}:00 - ${h.key}:59`,
        netPnl: h.netPnl,
        trades: h.trades,
      })),
    [hours],
  );

  const pnlConfig: ChartConfig = useMemo(
    () => ({
      netPnl: {
        label: "Net P&L",
        color: "green",
        negativeColor: "red",
      },
    }),
    [],
  );

  const tradesConfig: ChartConfig = useMemo(
    () => ({
      trades: {
        label: "Trades",
        color: "blue",
      },
    }),
    [],
  );

  const topHeight = Math.max(120, Math.round(height * 0.58));
  const bottomHeight = Math.max(90, height - topHeight - 32);

  const tooltipFormatter = (value: number, name: string) => {
    if (name === "netPnl") {
      // fmtMoney already provides the sign (+ or -), no duplicate ++
      return privateMode ? "••••" : fmtMoney(value, currency);
    }
    return `${fmtNumber(value, 0)} ${value === 1 ? "trade" : "trades"}`;
  };

  if (!hours || hours.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        No trade data available for this period.
      </div>
    );
  }

  const hoveredDatum = hoveredIndex != null ? chartData[hoveredIndex] : null;

  return (
    <div className="relative flex flex-col w-full" style={{ minHeight: height }}>
      {/* Pane 1: Net P&L per Opening Hour (Dither Bars with Bloom) */}
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>Net P&L</span>
        <span>{privateMode ? "••••" : currency}</span>
      </div>
      <ChartFrame height={topHeight}>
        <BarChart
          data={chartData}
          config={pnlConfig}
          symmetric
          bloom="low"
          bloomOnHover
          margins={{ top: 10, right: 16, bottom: 10, left: 64 }}
          markerIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
          className="h-full w-full"
        >
          <Grid />
          <ReferenceLine y={0} />
          <YAxis
            tickFormatter={(val: number) =>
              privateMode ? "••••" : fmtMoney(val, currency).replace(".00", "")
            }
          />
          <Bar dataKey="netPnl" variant="gradient" />
        </BarChart>
      </ChartFrame>

      {/* Pane 2: Trades Volume per Opening Hour (Dither Line with Dots) */}
      <div className="mt-2 border-t pt-2 flex items-center justify-between px-1 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>Trade Volume</span>
        <span>Count</span>
      </div>
      <ChartFrame height={bottomHeight}>
        <LineChart
          data={chartData}
          config={tradesConfig}
          scaleType="band"
          bloom="low"
          bloomOnHover
          margins={{ top: 8, right: 16, bottom: 24, left: 64 }}
          markerIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
          className="h-full w-full"
        >
          <Grid />
          <Line dataKey="trades" variant="gradient">
            <Dot variant="colored-border" r={3} />
          </Line>
          <XAxis dataKey="hourLabel" />
          <YAxis tickCount={3} tickFormatter={(val: number) => fmtNumber(Number(val), 0)} />
        </LineChart>
      </ChartFrame>

      {/* Single Unified Tooltip across both panes */}
      <AnimatePresence>
        {hoveredDatum && (
          <motion.div
            key="time-heatmap-unified-tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              left: `calc(64px + (100% - 80px) * ${(hoveredIndex! + 0.5) / chartData.length})`,
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 520,
              damping: 38,
              mass: 0.5,
            }}
            className={cn(
              "pointer-events-none absolute z-50 whitespace-nowrap px-3 py-2.5",
              TOOLTIP_SURFACE_CLASSES,
              hoveredIndex! <= 1
                ? "translate-x-0"
                : hoveredIndex! >= chartData.length - 2
                  ? "-translate-x-full"
                  : "-translate-x-1/2",
            )}
            style={{
              top: `${Math.round(topHeight * 0.42)}px`,
            }}
          >
            <TooltipHeader title={hoveredDatum.hourRange} />
            <div className="flex flex-col gap-1.5">
              <TooltipRow
                swatchClassName={
                  hoveredDatum.netPnl > 0
                    ? "bg-profit shadow-[0_0_6px_var(--profit)]"
                    : hoveredDatum.netPnl < 0
                      ? "bg-loss shadow-[0_0_6px_var(--loss)]"
                      : "bg-muted-foreground/60"
                }
                label="Net P&L"
                value={privateMode ? "••••" : fmtMoney(hoveredDatum.netPnl, currency)}
                valueClassName={
                  hoveredDatum.netPnl > 0
                    ? "text-profit"
                    : hoveredDatum.netPnl < 0
                      ? "text-loss"
                      : "text-foreground"
                }
              />
              <TooltipRow
                swatchClassName="bg-brand shadow-[0_0_6px_var(--brand)]"
                label="Trades"
                value={`${hoveredDatum.trades} ${hoveredDatum.trades === 1 ? "trade" : "trades"}`}
                valueClassName="font-semibold text-foreground"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
