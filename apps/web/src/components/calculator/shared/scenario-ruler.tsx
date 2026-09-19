"use client";

import React from "react";
import { cn } from "@/lib/utils";

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
}

export function ScenarioRuler({ title, items, className }: ScenarioRulerProps) {
  return (
    <div className={cn("mt-3 border-t border-border/40 pt-2.5", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider">{title}</span>
      </div>

      <div className="mt-2 space-y-1 text-xs font-mono tnum">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "group relative flex items-center justify-between rounded px-2 py-1 overflow-hidden transition-colors hover:bg-muted/40 cursor-pointer",
              item.isSelected && "ring-1 ring-border/80 bg-muted/30 font-semibold",
            )}
          >
            {/* Translucent Data Bar */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none rounded",
                item.barColor,
              )}
              style={{ width: `${Math.max(3, Math.min(100, item.barWidthPercent))}%` }}
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
        ))}
      </div>
    </div>
  );
}
