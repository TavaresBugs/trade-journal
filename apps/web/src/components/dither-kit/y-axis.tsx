"use client"

import { useChartPart } from "./chart-context"

export function YAxis({
  dataKey,
  tickFormatter,
  tickCount = 4,
  tickMargin = 8,
}: {
  dataKey?: string;
  tickFormatter?: (value: any, index?: number) => string;
  tickCount?: number;
  tickMargin?: number;
}) {
  const ctx = useChartPart("YAxis");
  if (!ctx.ready) return null;

  if (ctx.layout === "horizontal") {
    return (
      <g className="fill-current font-mono text-[10px] text-muted-foreground select-none">
        {Array.from({ length: ctx.dataLength }, (_, i) => {
          const row = ctx.data[i];
          const raw = dataKey && row ? (row as any)[dataKey] : i;
          const label = tickFormatter ? tickFormatter(raw, i) : String(raw ?? "");
          return (
            <text
              key={i}
              x={-tickMargin}
              y={ctx.yCenter(i)}
              textAnchor="end"
              dominantBaseline="central"
              fill="currentColor"
            >
              {label}
            </text>
          );
        })}
      </g>
    );
  }

  return (
    <g className="fill-current font-mono text-[10px] text-muted-foreground select-none">
      {ctx.y.ticks(tickCount).map((t) => (
        <text
          key={t}
          x={-tickMargin}
          y={ctx.y(t)}
          textAnchor="end"
          dominantBaseline="central"
          fill="currentColor"
        >
          {tickFormatter ? tickFormatter(t, 0) : t}
        </text>
      ))}
    </g>
  );
}
