"use client";

import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardCardHeader } from "@/components/dashboard-card-header";
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
      <DashboardCardHeader
        title={title}
        hint={hint}
        icon={Icon}
      />
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
