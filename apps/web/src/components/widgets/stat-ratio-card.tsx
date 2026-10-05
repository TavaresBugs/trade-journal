"use client";

import type { ComponentType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, HelpHint } from "@/components/ui/tooltip";
import { DitherRatioBar } from "@/components/dither-kit";
import { MonetaryValue } from "@/components/privacy";
import { cn, fmtMoney, fmtNumber } from "@/lib/utils";

export interface StatRatioSide {
  value: number | null;
  label: string;
  count?: number;
  countLabel?: string;
}

export interface StatRatioCardProps {
  title: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  ratio?: number | null; // e.g. 1.85 (Win/Loss ratio)
  win: StatRatioSide;
  loss: StatRatioSide;
  barHeight?: number; // default 8
  detailText?: string;
  currency?: string;
  variant?: "summary" | "split";
  className?: string;
}

/**
 * Standardized dual-ratio card powered by retro Dither Kit.
 * Used for Win/Loss comparisons (Avg win / loss, Average green & red day).
 */
export function StatRatioCard({
  title,
  hint,
  icon: Icon,
  ratio,
  win,
  loss,
  barHeight = 10,
  detailText,
  currency = "USD",
  variant = ratio !== undefined ? "summary" : "split",
  className,
}: StatRatioCardProps) {
  const winVal = win.value !== null && Number.isFinite(win.value) ? Math.abs(win.value) : 0;
  const lossVal = loss.value !== null && Number.isFinite(loss.value) ? Math.abs(loss.value) : 0;
  const hasBarData = winVal > 0 || lossVal > 0;

  const renderMoney = (val: number | null, isLoss = false) => {
    if (val === null || !Number.isFinite(val)) return "–";
    const signedVal = isLoss ? -Math.abs(val) : Math.abs(val);
    return <MonetaryValue>{fmtMoney(signedVal, currency)}</MonetaryValue>;
  };

  return (
    <Card className={cn("dashboard-visual-card h-full", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle>{title}</CardTitle>
        {hint && (
          Icon ? (
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
          )
        )}
      </CardHeader>
      <CardContent className="pt-1">
        {variant === "summary" ? (
          <div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              {ratio === null || ratio === undefined ? "–" : fmtNumber(ratio)}
            </div>
            {hasBarData && (
              <div className="mt-2.5">
                <DitherRatioBar
                  winValue={winVal}
                  lossValue={lossVal}
                  height={barHeight}
                  bloom="low"
                />
              </div>
            )}
            <div className="mt-1.5 text-xs text-muted-foreground">
              <span className="text-profit">
                {renderMoney(win.value)}
              </span>
              {" "}
              {win.label}
              {" · "}
              <span className="text-loss">
                {renderMoney(loss.value, true)}
              </span>
              {" "}
              {loss.label}
            </div>
            {detailText && (
              <p className="mt-1 text-xs text-muted-foreground">{detailText}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {win.count !== undefined ? `${win.count} ${win.countLabel || win.label}` : win.label}
              </span>
              <span className="font-medium text-profit">
                {renderMoney(win.value)}
              </span>
            </div>
            {hasBarData && (
              <div className="py-0.5">
                <DitherRatioBar
                  winValue={winVal}
                  lossValue={lossVal}
                  height={barHeight}
                  bloom="low"
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {loss.count !== undefined ? `${loss.count} ${loss.countLabel || loss.label}` : loss.label}
              </span>
              <span className="font-medium text-loss">
                {renderMoney(loss.value, true)}
              </span>
            </div>
            {detailText && (
              <p className="text-xs text-muted-foreground">{detailText}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
