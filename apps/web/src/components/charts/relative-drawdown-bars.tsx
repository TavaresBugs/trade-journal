"use client";

import { useMemo } from "react";
import type { RelativeDrawdownPoint } from "@luxalgo/journal-core";
import { fmtFullDate, fmtPercent } from "@/lib/utils";
import { ChartFrame } from "./chart-frame";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Grid,
  ReferenceLine,
  Tooltip,
  YAxis,
  COMPACT_CHART_MARGINS,
  type ChartConfig,
} from "@/components/dither-kit";

const config: ChartConfig = {
  drawdownPct: {
    label: "Relative DD",
    color: "red",
    negativeColor: "red",
  },
};

/**
 * Relative drawdown — density-adaptive retro ordered dither with bloom texture.
 * When data is sparse (<= 31 days, e.g. 7D/30D presets), renders discrete bars with individual daily hover.
 * When data is dense (> 31 days, e.g. 90D/YTD/All presets), smoothly transitions to a continuous
 * underwater dither area, eliminating 1px needle collapse and aligning with EquityArea.
 * Margins strictly match EquityArea (left: 56, right: 12) for perfect vertical alignment.
 */
export function RelativeDrawdownBars({ data }: { data: RelativeDrawdownPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((point) => ({
        t: point.t,
        drawdownPct: point.drawdownPct === null ? 0 : -Math.abs(point.drawdownPct),
      })),
    [data],
  );

  const available = useMemo(() => data.filter((p) => p.drawdownPct !== null), [data]);

  const maxDrawdown = useMemo(
    () => Math.max(0, ...available.map((p) => Math.abs(p.drawdownPct ?? 0))),
    [available],
  );

  const yAxisDigits = maxDrawdown < 0.01 ? (maxDrawdown < 0.002 ? 2 : 1) : 0;
  const isDense = chartData.length > 31;

  return (
    <div className="mt-2 border-t pt-3">
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>Relative drawdown</span>
        <span className="tnum text-loss">
          {available.length === 0
            ? "Initial balance required"
            : `Max −${fmtPercent(maxDrawdown, maxDrawdown < 0.01 ? 2 : 1)}`}
        </span>
      </div>
      {available.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
          Set an initial balance to chart relative drawdown.
        </div>
      ) : (
        <ChartFrame height={96}>
          {isDense ? (
            <AreaChart
              data={chartData}
              config={config}
              bloom="low"
              bloomOnHover
              margins={COMPACT_CHART_MARGINS}
              className="h-full w-full"
            >
              <Grid />
              <YAxis
                tickCount={3}
                tickFormatter={(value: number) => fmtPercent(Math.abs(value), yAxisDigits)}
              />
              <ReferenceLine y={0} />
              <Area dataKey="drawdownPct" variant="gradient" />
              <Tooltip
                labelKey="t"
                labelFormatter={fmtFullDate}
                valueFormatter={(value) => `-${fmtPercent(Math.abs(value), 2)}`}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={chartData}
              config={config}
              bloom="low"
              bloomOnHover
              margins={COMPACT_CHART_MARGINS}
              className="h-full w-full"
            >
              <Grid />
              <YAxis
                tickCount={3}
                tickFormatter={(value: number) => fmtPercent(Math.abs(value), yAxisDigits)}
              />
              <ReferenceLine y={0} />
              <Bar dataKey="drawdownPct" variant="gradient" />
              <Tooltip
                labelKey="t"
                labelFormatter={fmtFullDate}
                valueFormatter={(value) => `-${fmtPercent(Math.abs(value), 2)}`}
              />
            </BarChart>
          )}
        </ChartFrame>
      )}
    </div>
  );
}
