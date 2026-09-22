"use client";
import { useMemo } from "react";
import { HoverHint } from "./ui/tooltip";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { dayKeyOf, type CalendarMonth } from "@luxalgo/journal-core";
import { cn, fmtMoney } from "@/lib/utils";
import { Pnl } from "./pnl";
import { MonetaryValue, usePrivacy } from "./privacy";
import { useFilters } from "./filter-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

const compactFormatters = new Map<string, Intl.NumberFormat>();
const compactMoney = (value: number, currency: string) => {
  let formatter = compactFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    });
    compactFormatters.set(currency, formatter);
  }
  return formatter.format(value);
};

/**
 * The P&L calendar — an HTML grid, not a chart. Each traded day prints its
 * signed P&L and trade count; the background tint scales with magnitude
 * (lightness carries magnitude, which survives CVD; the number carries sign).
 */
export function CalendarPnl({
  calendar,
  currency = "USD",
  monetary = true,
  today: propToday,
  journalDays,
  onMonthChange,
  headerAction,
  headerRight,
  headerLeft,
  className,
}: {
  calendar: CalendarMonth;
  currency?: string;
  monetary?: boolean;
  today?: string;
  journalDays?: string[];
  onMonthChange?: (next: { year: number; month: number }) => void;
  headerAction?: React.ReactNode;
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;
  className?: string;
}) {
  const { timeZone } = useFilters();
  const today = propToday ?? dayKeyOf(new Date().toISOString(), timeZone);
  const allTradedDays = useMemo(() => {
    return calendar.weeks
      .flatMap((week) => week.days)
      .filter((day): day is NonNullable<typeof day> => day !== null && day.trades > 0);
  }, [calendar]);

  const bestDay = useMemo(() => {
    const first = allTradedDays[0];
    if (!first) return null;
    return allTradedDays.reduce((best, curr) => (curr.netPnl > best.netPnl ? curr : best), first);
  }, [allTradedDays]);

  const worstDay = useMemo(() => {
    const first = allTradedDays[0];
    if (!first) return null;
    return allTradedDays.reduce(
      (worst, curr) => (curr.netPnl < worst.netPnl ? curr : worst),
      first,
    );
  }, [allTradedDays]);

  const maxAbs = Math.max(
    1,
    ...calendar.weeks.flatMap((week) => week.days.map((day) => Math.abs(day?.netPnl ?? 0))),
  );

  return (
    <div className={cn("journal-calendar min-w-0 w-full flex flex-col flex-1", className)}>
      {/* Month, Year Dropdowns & Nav Arrows Header - Centered with balanced actions */}
      {onMonthChange && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 px-1 min-h-8">
          {/* Left balance spacer */}
          <div className="flex items-center justify-start min-w-0">{headerLeft}</div>

          {/* Center: Month & Year Nav */}
          <div className="flex items-center justify-center gap-1">
            {/* Previous Month Button < */}
            <button
              type="button"
              aria-label="Previous month"
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
              onClick={() => {
                const prev = new Date(Date.UTC(calendar.year, calendar.month - 2, 1));
                onMonthChange({ year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 });
              }}
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Month Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <span>{MONTH_NAMES[calendar.month - 1] ?? `Month ${calendar.month}`}</span>
                  <ChevronDown className="size-3 text-muted-foreground opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-36">
                {MONTH_NAMES.map((name, idx) => (
                  <DropdownMenuItem
                    key={name}
                    className={cn(
                      "text-xs font-medium cursor-pointer",
                      idx + 1 === calendar.month && "bg-accent font-bold text-accent-foreground",
                    )}
                    onSelect={() => onMonthChange({ year: calendar.year, month: idx + 1 })}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Year Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <span>{calendar.year}</span>
                  <ChevronDown className="size-3 text-muted-foreground opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-28">
                {YEARS.map((y) => (
                  <DropdownMenuItem
                    key={y}
                    className={cn(
                      "text-xs font-medium cursor-pointer",
                      y === calendar.year && "bg-accent font-bold text-accent-foreground",
                    )}
                    onSelect={() => onMonthChange({ year: y, month: calendar.month })}
                  >
                    {y}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Next Month Button > */}
            <button
              type="button"
              aria-label="Next month"
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
              onClick={() => {
                const next = new Date(Date.UTC(calendar.year, calendar.month, 1));
                onMonthChange({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
              }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Right side: Filters on mobile */}
          <div className="flex justify-end items-center">{headerRight ?? headerAction}</div>
        </div>
      )}

      {/* Calendar Grid: 7 days on mobile, 8 columns on desktop (7 days + Week total) */}
      <div className="journal-calendar-grid grid gap-1 text-xs mb-3 sm:mb-4">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div
            key={weekday}
            className="px-1 pb-1 text-muted-foreground font-mono text-[10px] sm:text-xs"
          >
            {weekday}
          </div>
        ))}
        <div className="journal-calendar-week-heading px-1 pb-1 text-right text-muted-foreground font-mono text-[10px] sm:text-xs">
          Week
        </div>
        {calendar.weeks.map((week, weekIndex) => (
          <CalendarWeekRow
            key={weekIndex}
            week={week}
            maxAbs={maxAbs}
            currency={currency}
            monetary={monetary}
            today={today}
            journalDays={journalDays}
          />
        ))}
      </div>

      {/* Mobile-only Weekly Breakdown */}
      <div className="sm:hidden mb-3">
        <div className="text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase mb-2 px-0.5">
          Weekly summary
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {calendar.weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg bg-muted/20 p-2 ring-1 ring-border/40 text-center gap-0.5",
                weekIndex === 4 && calendar.weeks.length === 5 ? "col-span-2" : "",
              )}
            >
              <span className="text-[8px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Week {weekIndex + 1}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {week.weekTrades > 0 ? (
                  monetary ? (
                    <Pnl value={week.weekNetPnl} currency={currency} />
                  ) : (
                    <span className="text-foreground font-medium">{week.weekTrades} trades</span>
                  )
                ) : (
                  "—"
                )}
              </span>
              {week.weekTrades > 0 && (
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                  {week.weekTrades} {week.weekTrades === 1 ? "trade" : "trades"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Unified 4 Metrics Cards - Available on both PC and Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-auto pt-3 border-t border-border/40">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Month Net P&L
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {monetary ? (
              <Pnl value={calendar.monthNetPnl} currency={currency} />
            ) : (
              <span className="text-muted-foreground">Multiple</span>
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Best day
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {bestDay ? (
              monetary ? (
                <>
                  <span className="text-muted-foreground mr-1">{bestDay.date.slice(5)}</span>
                  <Pnl value={bestDay.netPnl} currency={currency} />
                </>
              ) : (
                `${bestDay.date.slice(5)} · ${bestDay.trades} trades`
              )
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Worst day
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {worstDay ? (
              monetary ? (
                <>
                  <span className="text-muted-foreground mr-1">{worstDay.date.slice(5)}</span>
                  <Pnl value={worstDay.netPnl} currency={currency} />
                </>
              ) : (
                `${worstDay.date.slice(5)} · ${worstDay.trades} trades`
              )
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Activity
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {calendar.tradingDays > 0
              ? `${calendar.tradingDays} days · ${calendar.monthTrades} trades`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CalendarWeekRow({
  week,
  maxAbs,
  currency,
  monetary,
  today,
  journalDays,
}: {
  week: CalendarMonth["weeks"][number];
  maxAbs: number;
  currency: string;
  monetary: boolean;
  today: string;
  journalDays?: string[];
}) {
  const search = useSearchParams();
  const privacy = usePrivacy();
  const journalSet = useMemo(() => new Set(journalDays ?? []), [journalDays]);

  return (
    <>
      {week.days.map((day, dayIndex) => {
        if (!day) return <div key={dayIndex} className="journal-calendar-day rounded-md" />;
        const isToday = day.date === today;
        const traded = day.trades > 0;
        const hasJournal = journalSet.has(day.date);
        const intensity = traded ? 0.1 + 0.38 * (Math.abs(day.netPnl) / maxAbs) : 0;
        const performance = !monetary
          ? hasJournal
            ? "journal"
            : "neutral"
          : day.netPnl > 0
            ? "profit"
            : day.netPnl < 0
              ? "loss"
              : hasJournal
                ? "journal"
                : "neutral";

        const tooltipPnl = !monetary
          ? "Multiple currencies"
          : privacy
            ? "P&L hidden"
            : fmtMoney(day.netPnl, currency);

        const tooltipContent = traded
          ? `${tooltipPnl} · ${day.trades} trade${day.trades === 1 ? "" : "s"}${hasJournal ? " · Journaled" : ""}`
          : hasJournal
            ? "Journal entry recorded"
            : "No trades";

        const ariaLabel = traded
          ? `${day.date}${isToday ? " (Today)" : ""}, ${tooltipPnl}, ${day.trades} trade${day.trades === 1 ? "" : "s"}${hasJournal ? ", journal note recorded" : ""}`
          : hasJournal
            ? `${day.date}${isToday ? " (Today)" : ""}, journal note recorded`
            : `${day.date}${isToday ? " (Today)" : ""}, no trades`;

        return (
          <HoverHint
            key={day.date}
            heading={isToday ? `${day.date} (Today)` : day.date}
            content={tooltipContent}
          >
            <Link
              key={day.date}
              href={`/journal/${day.date}?${search}`}
              aria-label={ariaLabel}
              data-today={isToday ? "true" : undefined}
              className={cn(
                "journal-calendar-day journal-calendar-day-link flex flex-col min-w-0 rounded-md border",
                !traded
                  ? hasJournal
                    ? "border-brand/40 hover:border-brand/70"
                    : "border-transparent bg-muted/30"
                  : "border-border/60",
              )}
              data-performance={performance}
              style={
                traded && monetary
                  ? {
                      backgroundColor: `color-mix(in oklab, ${
                        performance === "profit"
                          ? "var(--profit-fill)"
                          : performance === "loss"
                            ? "var(--loss)"
                            : "var(--neutral-mid)"
                      } ${Math.round(intensity * 100)}%, var(--card))`,
                    }
                  : !traded && hasJournal
                    ? {
                        backgroundColor: "color-mix(in oklab, var(--brand) 18%, var(--card))",
                      }
                    : undefined
              }
            >
              <div
                className={cn(
                  traded && hasJournal ? "flex items-center justify-between" : "",
                  isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{Number(day.date.slice(8))}</span>
                {traded && hasJournal && (
                  <NotebookPen
                    className="h-3 w-3 shrink-0 text-muted-foreground"
                    aria-label="Journal note recorded"
                  />
                )}
              </div>
              {traded && (
                <>
                  <div className="journal-calendar-full tnum font-medium">
                    {monetary ? (
                      <MonetaryValue>{fmtMoney(day.netPnl, currency)}</MonetaryValue>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="journal-calendar-compact tnum font-medium">
                    {monetary ? (
                      <MonetaryValue>{compactMoney(day.netPnl, currency)}</MonetaryValue>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="journal-calendar-trades text-muted-foreground">
                    {day.trades} trade{day.trades === 1 ? "" : "s"}
                  </div>
                </>
              )}
              {!traded && hasJournal && (
                <div className="journal-calendar-trades mt-auto flex items-center gap-1 font-medium text-brand">
                  <NotebookPen className="h-3 w-3 shrink-0" />
                  <span className="truncate">Journaled</span>
                </div>
              )}
            </Link>
          </HoverHint>
        );
      })}
      <div className="journal-calendar-week flex rounded-md bg-muted/40 p-1.5">
        <span className="journal-calendar-week-label text-muted-foreground">Week total</span>
        {week.weekTrades > 0 ? (
          <>
            {monetary && (
              <Pnl value={week.weekNetPnl} currency={currency} className="font-medium" />
            )}
            <span className="text-muted-foreground">{week.weekTrades} trades</span>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </div>
    </>
  );
}
