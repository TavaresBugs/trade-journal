"use client";

import {
  BarChart2,
  Clock,
  DollarSign,
  Hash,
  Scale,
  Trophy,
  Zap,
} from "lucide-react";
import { cn, fmtDuration } from "@/lib/utils";
import { MonetaryValue } from "@/components/privacy";
import { HalfDonutGauge } from "../shared/half-donut-gauge";
import { type Analysis, number, money } from "../types";

export function CohortSummaryCard({ data }: { data: Analysis }) {
  const s = data.summary;
  const currency = data.currencies[0] ?? "USD";

  return (
    <div className="space-y-3.5">
      {/* Top Hero: HalfDonutGauge + Primary Edge Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        {/* Half Donut Gauge Card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/60 p-4 shadow-xs sm:col-span-5">
          <HalfDonutGauge winRate={s.winRate} trades={s.trades} />
        </div>

        {/* Primary Edge Spotlight (Net P&L, Profit Factor, Realized R) */}
        <div className="grid grid-cols-1 gap-2.5 sm:col-span-7">
          {/* Net P&L Card */}
          <div className="flex items-center rounded-xl border border-border/50 bg-card/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  s.netPnl > 0
                    ? "bg-profit/10 text-profit"
                    : s.netPnl < 0
                      ? "bg-loss/10 text-loss"
                      : "bg-muted/40 text-muted-foreground",
                )}
              >
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Net P&L</p>
                <p
                  className={cn(
                    "font-mono text-lg font-bold tabular-nums tracking-tight sm:text-xl",
                    s.netPnl > 0
                      ? "text-profit"
                      : s.netPnl < 0
                        ? "text-loss"
                        : "text-foreground",
                  )}
                >
                  <MonetaryValue>{money(s.netPnl, currency)}</MonetaryValue>
                </p>
              </div>
            </div>
          </div>

          {/* Profit Factor & Realized R Twin Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Scale className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Profit Factor</span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-base font-bold tabular-nums tracking-tight",
                  s.profitFactor !== null && s.profitFactor >= 1.5
                    ? "text-profit"
                    : s.profitFactor !== null && s.profitFactor < 1
                      ? "text-loss"
                      : "text-foreground",
                )}
              >
                {s.noLosses ? "∞" : number(s.profitFactor)}
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium">Avg Realized R</span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-base font-bold tabular-nums tracking-tight",
                  s.avgRealizedR !== null && s.avgRealizedR > 0
                    ? "text-profit"
                    : s.avgRealizedR !== null && s.avgRealizedR < 0
                      ? "text-loss"
                      : "text-foreground",
                )}
              >
                {s.avgRealizedR !== null
                  ? `${s.avgRealizedR > 0 ? "+" : ""}${number(s.avgRealizedR)}R`
                  : "–"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Closed Trades</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {s.trades}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-medium">Entry Volume</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {number(s.volume)}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-teal-400" />
            <span className="font-medium">Avg Holding</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {fmtDuration(s.avgDurationMs)}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">Avg Planned R</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {s.avgPlannedR !== null ? `${number(s.avgPlannedR)}R` : "–"}
          </p>
        </div>
      </div>
    </div>
  );
}
