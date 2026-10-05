"use client";

import { useMemo } from "react";
import { fmtChartDate, fmtFullDate, fmtMoney } from "@/lib/utils";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import {
  BarChart,
  Bar,
  Grid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  STACKED_CHART_MARGINS,
  type ChartConfig,
} from "@/components/dither-kit";

export interface DailyBarDatum {
  date: string;
  netPnl: number;
}

/**
 * Net daily P&L. Polarity is geometry first (bars grow from the zero baseline);
 * green/red retro dither with bloom texture.
 */
export function DailyBars({
  data,
  height = 240,
}: {
  data: DailyBarDatum[];
  height?: number | `${number}%`;
}) {
  const privateMode = usePrivacy();

  const config: ChartConfig = useMemo(
    () => ({
      netPnl: {
        label: "Net P&L",
        color: "green",
        negativeColor: "red",
      },
    }),
    [],
  );

  if (!data || data.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        config={config}
        symmetric
        bloom="low"
        bloomOnHover
        margins={STACKED_CHART_MARGINS}
        className="h-full w-full"
      >
        <Grid />
        <XAxis dataKey="date" tickFormatter={fmtChartDate} minTickGap={48} />
        <YAxis
          tickFormatter={(value) => (privateMode ? "••••" : fmtMoney(value).replace(".00", ""))}
        />
        <ReferenceLine y={0} />
        <Bar dataKey="netPnl" variant="gradient" />
        <Tooltip
          labelKey="date"
          labelFormatter={fmtFullDate}
          valueFormatter={(value) => (privateMode ? "Hidden" : fmtMoney(value))}
        />
      </BarChart>
    </ChartFrame>
  );
}
