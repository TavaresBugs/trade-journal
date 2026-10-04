"use client";

import { useMemo } from "react";
import { fmtMoney, fmtPercent } from "@/lib/utils";
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
  type ChartConfig,
} from "@/components/dither-kit";

export interface EquityPointDatum {
  t: string;
  cumNetPnl: number;
}

/** Cumulative P&L area — single series, crosshair tooltip, zero baseline, dither texture with bloom. */
export function EquityArea({
  data,
  height = 240,
  valueFormat = "money",
  valueLabel = "Cumulative P&L",
  currency = "USD",
}: {
  data: EquityPointDatum[];
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

  if (!data || data.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <ChartFrame height={height}>
      <AreaChart
        data={data}
        config={config}
        bloom="low"
        bloomOnHover
        margins={{ top: 12, right: 12, bottom: 24, left: 56 }}
        className="h-full w-full"
      >
        <Grid />
        <XAxis
          dataKey="t"
          tickFormatter={(value) => String(value ?? "").slice(0, 10)}
          maxTicks={6}
        />
        <YAxis
          tickFormatter={(value) =>
            privateMode ? "••••" : formatValue(value).replace(".00", "")
          }
        />
        <ReferenceLine y={0} />
        <Area dataKey="cumNetPnl" variant="gradient" />
        <Tooltip
          labelKey="t"
          valueFormatter={(value) =>
            privateMode ? "Hidden" : formatValue(value)
          }
        />
      </AreaChart>
    </ChartFrame>
  );
}
