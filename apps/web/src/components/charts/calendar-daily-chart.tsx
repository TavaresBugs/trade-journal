"use client";

import { useMemo } from "react";
import type { CalendarInsights } from "@/lib/calendar-insights";
import { fmtChartDate, fmtFullDate, fmtMoney } from "@/lib/utils";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import {
  BarChart,
  Bar,
  Line,
  Grid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  STACKED_CHART_MARGINS,
  type ChartConfig,
} from "@/components/dither-kit";

export function CalendarDailyChart({
  data,
  currency,
  onInspect,
}: {
  data: CalendarInsights["trend"];
  currency: string;
  onInspect: (date: string) => void;
}) {
  const privateMode = usePrivacy();

  const config: ChartConfig = useMemo(
    () => ({
      netPnl: {
        label: "Daily net P&L",
        color: "green",
        negativeColor: "red",
      },
      average: {
        label: "5-day average",
        color: "grey",
      },
    }),
    [],
  );

  if (!data || data.length === 0) {
    return <div className="h-60" />;
  }

  return (
    <ChartFrame height={240}>
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
        <XAxis dataKey="date" tickFormatter={fmtChartDate} minTickGap={24} />
        <YAxis
          tickFormatter={(value) =>
            privateMode ? "••••" : fmtMoney(value, currency).replace(/\.00$/, "")
          }
        />
        <ReferenceLine y={0} />
        <Bar dataKey="netPnl" variant="gradient" />
        {data.length >= 8 && <Line dataKey="average" strokeVariant="dashed" />}
        <Tooltip
          labelKey="date"
          labelFormatter={fmtFullDate}
          valueFormatter={(value) => (privateMode ? "Hidden" : fmtMoney(value, currency))}
        />
      </BarChart>
    </ChartFrame>
  );
}
