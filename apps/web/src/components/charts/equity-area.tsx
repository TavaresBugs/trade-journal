"use client";

import { useMemo } from "react";
import { fmtChartDate, fmtFullDate, fmtMoney, fmtPercent } from "@/lib/utils";
import { usePrivacy } from "../privacy";
import { ChartFrame } from "./chart-frame";
import {
  AreaChart,
  Area,
  Grid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  STACKED_CHART_MARGINS,
  type ChartConfig,
} from "@/components/dither-kit";

export interface EquityPointDatum {
  t: string;
  cumNetPnl: number;
}

/**
 * Normalizes cumulative equity points to firmly anchor the beginning and ending
 * bounds of a date range (e.g. YTD, 90D, 30D, 7D, or All).
 *
 * Guarantees:
 * 1. The curve starts exactly at $0.00 on `from` (e.g. Jan 1 for YTD).
 * 2. Flatlines at $0.00 until the day before the first trade closes ("nasce na linha zero").
 * 3. Carries the final cumulative equity flat until `to` (e.g. today).
 * 4. Empty datasets with bounds produce a 2-point flatline at $0.00.
 */
export function normalizeCumulativePoints(
  data: EquityPointDatum[] | null | undefined,
  from?: string | null,
  to?: string | null,
): EquityPointDatum[] {
  if (!data || data.length === 0) {
    if (from && to && from <= to) {
      return [
        { t: from, cumNetPnl: 0 },
        { t: to, cumNetPnl: 0 },
      ];
    }
    return [];
  }

  let points = data.map((p) => ({ t: p.t, cumNetPnl: p.cumNetPnl }));
  const first = points[0];
  if (!first) return points;

  if (from) {
    if (from < first.t) {
      const parts = first ? first.t.split("-").map(Number) : [];
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      let dayBeforeFirst: string | null = null;
      if (y != null && m != null && d != null && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const prev = new Date(Date.UTC(y, m - 1, d - 1));
        dayBeforeFirst = prev.toISOString().slice(0, 10);
      }
      if (dayBeforeFirst && dayBeforeFirst > from) {
        points = [
          { t: from, cumNetPnl: 0 },
          { t: dayBeforeFirst, cumNetPnl: 0 },
          ...points,
        ];
      } else {
        points = [{ t: from, cumNetPnl: 0 }, ...points];
      }
    } else if (from === first.t && first.cumNetPnl !== 0) {
      points = [{ t: from, cumNetPnl: 0 }, ...points];
    }
  } else if (first && first.cumNetPnl !== 0) {
    // If no explicit from (e.g. 'all'), anchor 1 day prior to first trade at $0
    const parts = first.t.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    let originDate = first.t;
    if (y != null && m != null && d != null && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const date = new Date(Date.UTC(y, m - 1, d - 1));
      originDate = date.toISOString().slice(0, 10);
    }
    points = [{ t: originDate, cumNetPnl: 0 }, ...points];
  }

  // Anchor at range end if 'to' is ahead of the last point
  const last = points[points.length - 1];
  if (to && last && to > last.t) {
    points = [...points, { t: to, cumNetPnl: last.cumNetPnl }];
  }

  return points;
}

export function EquityArea({
  data,
  from,
  to,
  height = 240,
  valueFormat = "money",
  valueLabel = "Cumulative P&L",
  currency = "USD",
}: {
  data: EquityPointDatum[];
  from?: string | null;
  to?: string | null;
  height?: number;
  valueFormat?: "money" | "percent";
  valueLabel?: string;
  currency?: string;
  curve?: "monotone" | "stepAfter";
}) {
  const privacy = usePrivacy();
  const privateMode = privacy && valueFormat === "money";

  const formatValue = (value: number) =>
    valueFormat === "percent" ? fmtPercent(value, 2) : fmtMoney(value, currency);

  const config: ChartConfig = useMemo(
    () => ({
      cumNetPnl: {
        label: valueLabel,
        color: "green",
        negativeColor: "red",
      },
    }),
    [valueLabel],
  );

  const chartData = useMemo(() => normalizeCumulativePoints(data, from, to), [data, from, to]);

  if (!chartData || chartData.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <ChartFrame height={height}>
      <AreaChart
        data={chartData}
        config={config}
        bloom="low"
        bloomOnHover
        margins={STACKED_CHART_MARGINS}
        className="h-full w-full"
      >
        <Grid />
        <XAxis dataKey="t" tickFormatter={fmtChartDate} minTickGap={48} />
        <YAxis
          tickFormatter={(value) => (privateMode ? "••••" : formatValue(value).replace(".00", ""))}
        />
        <ReferenceLine y={0} />
        <Area dataKey="cumNetPnl" variant="gradient" />
        <Tooltip
          labelKey="t"
          labelFormatter={fmtFullDate}
          valueFormatter={(value) => (privateMode ? "Hidden" : formatValue(value))}
        />
      </AreaChart>
    </ChartFrame>
  );
}
