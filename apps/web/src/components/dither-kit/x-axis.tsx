"use client";

import { useChartPart } from "./chart-context";

interface TickItem {
  index: number;
  x: number;
  label: string;
  anchor: "start" | "middle" | "end";
  left: number;
  right: number;
}

export function XAxis({
  dataKey,
  tickFormatter,
  tickMargin = 8,
  minTickGap = 48,
  axisLine = true,
}: {
  dataKey?: string;
  tickFormatter?: (value: any, index: number) => string;
  tickMargin?: number;
  minTickGap?: number;
  axisLine?: boolean;
}) {
  const ctx = useChartPart("XAxis");
  if (!ctx.ready || ctx.dataLength === 0) return null;

  const y = ctx.plot.height + tickMargin;
  const plotWidth = ctx.plot.width;

  if (ctx.layout === "horizontal") {
    const ticks = ctx.x.ticks ? ctx.x.ticks(4) : [];
    return (
      <g className="fill-current font-mono text-[11px] text-muted-foreground select-none">
        {axisLine && (
          <line
            x1={0}
            y1={ctx.plot.height}
            x2={plotWidth}
            y2={ctx.plot.height}
            stroke="var(--border)"
            strokeWidth={1}
          />
        )}
        {ticks.map((val) => (
          <text
            key={val}
            x={ctx.x(val)}
            y={y}
            textAnchor="middle"
            dominantBaseline="hanging"
            fill="currentColor"
          >
            {tickFormatter ? tickFormatter(val, 0) : val}
          </text>
        ))}
      </g>
    );
  }

  const getTickBounds = (xCenter: number, label: string) => {
    // 11px monospace character width is ~7px
    const width = Math.max(16, label.length * 7);
    let anchor: "start" | "middle" | "end" = "middle";
    let renderX = xCenter;
    let left = xCenter - width / 2;
    let right = xCenter + width / 2;

    if (left < 0) {
      anchor = "start";
      renderX = 0;
      left = 0;
      right = width;
    } else if (right > plotWidth) {
      anchor = "end";
      renderX = plotWidth;
      left = plotWidth - width;
      right = plotWidth;
    }

    return { renderX, anchor, left, right };
  };

  const getLabel = (index: number) => {
    const row = ctx.data[index];
    const raw = dataKey && row ? row[dataKey] : index;
    return tickFormatter ? tickFormatter(raw, index) : String(raw ?? "");
  };

  // Recharts minTickGap algorithm:
  // Requires gap between adjacent label bounding boxes to be at least minTickGap pixels
  const ticks: TickItem[] = [];
  let lastRightEdge = -Infinity;

  for (let i = 0; i < ctx.dataLength; i++) {
    const xCenter = ctx.xCenter(i) ?? 0;
    const label = getLabel(i);
    const bounds = getTickBounds(xCenter, label);

    if (bounds.left - lastRightEdge >= minTickGap) {
      ticks.push({
        index: i,
        x: bounds.renderX,
        label,
        anchor: bounds.anchor,
        left: bounds.left,
        right: bounds.right,
      });
      lastRightEdge = bounds.right;
    }
  }

  // Ensure last tick is included if space allows (or replace penultimate if too close)
  const lastRendered = ticks[ticks.length - 1];
  if (lastRendered && ctx.dataLength > 1) {
    const lastIdx = ctx.dataLength - 1;

    if (lastRendered.index !== lastIdx) {
      const lastXCenter = ctx.xCenter(lastIdx) ?? plotWidth;
      const lastLabel = getLabel(lastIdx);
      const lastBounds = getTickBounds(lastXCenter, lastLabel);

      if (lastBounds.left - lastRendered.right < minTickGap && ticks.length > 1) {
        const prevRendered = ticks[ticks.length - 2];
        if (prevRendered && lastBounds.left - prevRendered.right >= minTickGap) {
          ticks.pop();
          ticks.push({
            index: lastIdx,
            x: lastBounds.renderX,
            label: lastLabel,
            anchor: lastBounds.anchor,
            left: lastBounds.left,
            right: lastBounds.right,
          });
        }
      } else if (lastBounds.left - lastRendered.right >= minTickGap) {
        ticks.push({
          index: lastIdx,
          x: lastBounds.renderX,
          label: lastLabel,
          anchor: lastBounds.anchor,
          left: lastBounds.left,
          right: lastBounds.right,
        });
      }
    }
  }

  return (
    <g className="fill-current font-mono text-[11px] text-muted-foreground select-none">
      {axisLine && (
        <line
          x1={0}
          y1={ctx.plot.height}
          x2={plotWidth}
          y2={ctx.plot.height}
          stroke="var(--border)"
          strokeWidth={1}
        />
      )}
      {ticks.map(({ index: i, x, label, anchor }) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor={anchor}
          dominantBaseline="hanging"
          fill="currentColor"
        >
          {label}
        </text>
      ))}
    </g>
  );
}
