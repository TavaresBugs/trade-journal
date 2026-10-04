"use client";

import type { ComponentType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, HelpHint } from "@/components/ui/tooltip";
import { DitherGauge } from "@/components/dither-kit";
import { cn } from "@/lib/utils";

export interface StatGaugeDetailItem {
  label: string;
  value: ReactNode;
  color?: "profit" | "loss" | "brand" | "muted" | "default";
}

export interface StatGaugeCardProps {
  title: string;
  hint: string;
  icon?: ComponentType<{ className?: string }>;
  value: number | null; // 0 to 1 ratio or rate
  gaugeSize?: number; // default 92
  details?: StatGaugeDetailItem[];
  className?: string;
}

/**
 * Standardized KPI gauge card powered by retro Dither Kit.
 * Used for consistency rates (Trade win %, Day win %, Day consistency).
 */
export function StatGaugeCard({
  title,
  hint,
  icon: Icon,
  value,
  gaugeSize = 92,
  details,
  className,
}: StatGaugeCardProps) {
  return (
    <Card className={cn("dashboard-visual-card h-full", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle>{title}</CardTitle>
        {Icon ? (
          <Tooltip>
            <TooltipTrigger className="cursor-help" aria-label={`About ${title}`}>
              <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="mb-1 font-semibold">{title}</div>
              <div className="text-muted-foreground">{hint}</div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <HelpHint heading={title}>{hint}</HelpHint>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-1">
        <DitherGauge size={gaugeSize} value={value} label={title} />
        {details && details.length > 0 && (
          <div className="space-y-0.5 text-xs text-muted-foreground text-right sm:text-left tabular-nums">
            {details.map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  item.color === "profit" && "text-profit",
                  item.color === "loss" && "text-loss",
                  item.color === "brand" && "text-brand",
                  item.color === "muted" && "text-muted-foreground",
                )}
              >
                <span className="font-medium text-foreground">{item.value}</span>{" "}
                {item.label}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
