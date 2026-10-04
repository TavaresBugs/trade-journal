"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, TableProperties } from "lucide-react";
import type { DayStats } from "@luxalgo/journal-core";
import { cn } from "@/lib/utils";
import { HoverHint } from "./ui/tooltip";
import { Pnl } from "./pnl";
import { usePrivacy } from "./privacy";

export function DailyBreakdownList({
  days,
  currency,
  reviewHref,
  allTradesHref,
  dateLabel,
}: {
  days: DayStats[];
  currency: string;
  reviewHref: (date: string) => string;
  allTradesHref: string;
  dateLabel: (date: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const privateMode = usePrivacy();

  if (!days.length) return null;

  return (
    <div className="mt-4 border-t border-border/40 pt-3">
      {/* Header trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
              open && "rotate-90 text-foreground",
            )}
          />
          <span className="font-semibold text-foreground">Daily breakdown</span>
          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground border border-border/30">
            {days.length} {days.length === 1 ? "day" : "days"}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? "Collapse" : "View daily trades"}
        </span>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="mt-2.5 rounded-lg border border-border/50 bg-card/60 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_16px] items-center gap-3 border-b border-border/40 bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Trading Day</span>
            <span className="text-right">Trades</span>
            <span className="text-right pr-2">Net P&L</span>
            <div className="flex justify-end">
              <HoverHint heading="Trade Explorer" content="View all month trades in table view">
                <Link
                  href={allTradesHref}
                  className="inline-flex size-4 items-center justify-center rounded text-muted-foreground/60 transition-all duration-150 hover:bg-muted/80 hover:text-foreground hover:scale-110 active:scale-95"
                  aria-label="View all month trades in Trade Explorer"
                >
                  <TableProperties className="size-3.5" />
                </Link>
              </HoverHint>
            </div>
          </div>

          {/* Scrollable list with scrollbar-gutter stable and custom scrollbar */}
          <div className="max-h-60 overflow-y-auto divide-y divide-border/20 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
            {days.map((day) => {
              const isProfit = day.netPnl > 0;
              const isLoss = day.netPnl < 0;

              return (
                <Link
                  key={day.date}
                  href={reviewHref(day.date)}
                  className="group grid grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_16px] items-center gap-3 px-3 py-2 text-xs transition-colors hover:bg-muted/50 active:scale-[0.998] focus-visible:outline-none focus-visible:bg-muted/60"
                >
                  {/* Left: Indicator dot + Date */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isProfit
                          ? "bg-profit shadow-[0_0_6px_var(--profit)]"
                          : isLoss
                            ? "bg-loss shadow-[0_0_6px_var(--loss)]"
                            : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                      {dateLabel(day.date)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60 hidden sm:inline">
                      {day.date.slice(5)}
                    </span>
                  </div>

                  {/* Center: Trades count */}
                  <div className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {day.trades} {day.trades === 1 ? "trade" : "trades"}
                  </div>

                  {/* Right: Net P&L (protected from scrollbar) */}
                  <div className="text-right font-mono text-xs font-bold tabular-nums pr-2">
                    {privateMode ? (
                      <span className="text-muted-foreground">P&L hidden</span>
                    ) : (
                      <Pnl value={day.netPnl} currency={currency} />
                    )}
                  </div>

                  {/* Far right: Link arrow */}
                  <div className="flex justify-end">
                    <ArrowUpRight className="size-3.5 text-muted-foreground/50 transition-all duration-150 group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function BestWorstDayRow({
  label,
  day,
  type,
  mixed,
  currency,
  href,
  dateLabel,
}: {
  label: string;
  day: DayStats | null;
  type: "best" | "worst";
  mixed: boolean;
  currency: string;
  href: (date: string) => string;
  dateLabel: (date: string) => string;
}) {
  if (!day || mixed) {
    return (
      <div className="flex items-center justify-between py-1 text-xs text-muted-foreground">
        <span>{label}</span>
        <span>—</span>
      </div>
    );
  }

  const isProfit = day.netPnl > 0;
  const isLoss = day.netPnl < 0;

  return (
    <Link
      href={href(day.date)}
      className="group flex items-center justify-between gap-2 -mx-2 rounded-lg px-2 py-1.5 text-xs transition-all duration-150 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            type === "best"
              ? isProfit
                ? "bg-profit shadow-[0_0_6px_var(--profit)]"
                : "bg-muted-foreground/40"
              : isLoss
                ? "bg-loss shadow-[0_0_6px_var(--loss)]"
                : "bg-muted-foreground/40",
          )}
        />
        <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono font-bold tabular-nums">
          <Pnl value={day.netPnl} currency={currency} />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/80 group-hover:text-foreground/90 transition-colors">
          {dateLabel(day.date)}
        </span>
        <ArrowUpRight className="size-3.5 text-muted-foreground/50 transition-all duration-150 group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
