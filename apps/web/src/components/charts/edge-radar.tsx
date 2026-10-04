"use client";

import { useMemo } from "react";
import type { EdgeScoreComponents } from "@luxalgo/journal-core";
import { ChartFrame } from "./chart-frame";
import {
  RadarChart,
  Radar,
  Tooltip,
  type ChartConfig,
} from "@/components/dither-kit";

const LABELS: Record<keyof EdgeScoreComponents, string> = {
  winRate: "Win %",
  profitFactor: "Profit factor",
  avgWinLoss: "Avg win/loss",
  drawdown: "Drawdown",
  recovery: "Recovery",
  consistency: "Consistency",
};

const config: ChartConfig = {
  value: {
    label: "Score",
    color: "blue",
  },
};

/** The open Edge Score, drawn from its six 0-100 components. Retro ordered-dither with bloom. */
export function EdgeRadar({
  components,
  height = 220,
}: {
  components: EdgeScoreComponents;
  height?: number | `${number}%`;
}) {
  const data = useMemo(() => {
    if (!components) return [];
    return (Object.keys(LABELS) as (keyof EdgeScoreComponents)[]).map((key) => ({
      metric: LABELS[key],
      value: Math.round(components[key] ?? 0),
    }));
  }, [components]);

  if (!components || data.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <ChartFrame height={height}>
      <RadarChart
        data={data}
        config={config}
        nameKey="metric"
        domainMax={100}
        bloom="high"
        bloomOnHover
        margins={{ top: 20, right: 36, bottom: 20, left: 36 }}
        className="h-full w-full"
      >
        <Radar dataKey="value" variant="gradient" />
        <Tooltip
          valueFormatter={(value) => `${value}/100`}
        />
      </RadarChart>
    </ChartFrame>
  );
}
