"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { DitherRowBar } from "@/components/dither-kit/dither-row-bar";
import type { DitherColor } from "@/components/dither-kit/palette";

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

function colorOfDot(dotColor: string, isDanger?: boolean): DitherColor {
  if (isDanger || dotColor.includes("loss")) return "red";
  if (dotColor.includes("amber")) return "orange";
  return "green";
}

export function ScenarioRuler({ title, items, className }: ScenarioRulerProps) {
  return (
    <div className={cn("mt-3 border-t border-border/40 pt-2.5", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider font-mono">{title}</span>
      </div>

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
    </div>
  );
}
