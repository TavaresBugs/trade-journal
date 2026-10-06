"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { DitherRowBar } from "@/components/dither-kit/dither-row-bar";
import { BarChart } from "@/components/dither-kit/bar-chart";
import { Bar } from "@/components/dither-kit/bar";
import { YAxis } from "@/components/dither-kit/y-axis";
import { XAxis } from "@/components/dither-kit/x-axis";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { type ChartConfig } from "@/components/dither-kit/chart-context";

export interface ScenarioItem {
  id: string | number;
  label: React.ReactNode;
  detail: React.ReactNode;
  barWidthPercent: number;
  barColor: string;
  dotColor: string;
  isSelected?: boolean;
  isDanger?: boolean;
  onClick?: () => void;
}

export interface ScenarioRulerProps {
  title: string;
  items: ScenarioItem[];
  className?: string;
  defaultView?: "list" | "chart";
}

import type { DitherColor } from "@/components/dither-kit/palette";

function colorOfDot(dotColor: string, isDanger?: boolean): DitherColor {
  if (isDanger || dotColor.includes("loss")) return "red";
  if (dotColor.includes("amber")) return "orange";
  return "green";
}

export function ScenarioRuler({
  title,
  items,
  className,
  defaultView = "list",
}: ScenarioRulerProps) {
  const [viewMode, setViewMode] = useState<"list" | "chart">(defaultView);

  const chartData = items.map((item, i) => {
    let name = String(item.id);
    if (typeof item.label === "string") {
      name = item.label.split("·")[0]?.trim() || name;
    }
    return {
      id: String(item.id),
      scenario: name,
      buffer: Number(item.barWidthPercent.toFixed(1)),
      index: i,
    };
  });

  const chartConfig: ChartConfig = {
    buffer: {
      label: "Buffer",
      color: "green",
    },
  };

  return (
    <div className={cn("mt-3 border-t border-border/40 pt-2.5", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider font-mono">{title}</span>
        <div className="flex items-center gap-1 rounded bg-muted/40 p-0.5 text-[10px] font-mono border border-border/50">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "px-2 py-0.5 rounded transition-all",
              viewMode === "list"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Rows
          </button>
          <button
            type="button"
            onClick={() => setViewMode("chart")}
            className={cn(
              "px-2 py-0.5 rounded transition-all",
              viewMode === "chart"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Chart
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <div className="mt-2 h-44 w-full">
          <BarChart
            layout="horizontal"
            data={chartData}
            config={chartConfig}
            className="h-full w-full"
            margins={{ top: 8, right: 24, bottom: 20, left: 105 }}
            interactive={true}
            bloom="low"
            onHoverChange={(idx) => {
              if (idx != null && items[idx]?.onClick) {
                // Keep chart hover active
              }
            }}
          >
            <Bar dataKey="buffer" />
            <YAxis dataKey="scenario" />
            <XAxis tickFormatter={(v) => `${v}%`} />
            <Tooltip valueFormatter={(v) => `${v}% survival buffer`} />
          </BarChart>
        </div>
      ) : (
        <div className="mt-2 space-y-1 text-xs font-mono tnum">
          {items.map((item) => {
            const barColor = colorOfDot(item.dotColor, item.isDanger);
            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "group relative flex items-center justify-between rounded px-2 py-1 overflow-hidden transition-colors hover:bg-muted/40 cursor-pointer min-h-[28px]",
                  item.isSelected && "ring-1 ring-border/80 bg-muted/30 font-semibold",
                )}
              >
                {/* Authentic Retro Dither Horizontal Bar */}
                <DitherRowBar
                  percent={item.barWidthPercent}
                  color={barColor}
                  isSelected={item.isSelected}
                />

                <div className="relative z-10 flex items-center gap-1.5 truncate">
                  <span className={cn("size-1.5 rounded-full shrink-0", item.dotColor)} />
                  <span
                    className={cn(
                      "truncate text-xs",
                      item.isDanger ? "text-muted-foreground" : "text-foreground font-medium",
                    )}
                  >
                    {item.label}
                  </span>
                </div>

                <div className="relative z-10 shrink-0 font-mono text-xs flex items-center gap-1.5">
                  {item.detail}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
