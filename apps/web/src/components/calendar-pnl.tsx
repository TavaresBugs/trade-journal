"use client";
import { useMemo, useState } from "react";
import { HoverHint, Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { dayKeyOf, type CalendarMonth } from "@luxalgo/journal-core";
import { cn, compactMoney, fmtMoney, pnlClass } from "@/lib/utils";
import { Pnl } from "./pnl";
import { MonetaryValue, usePrivacy } from "./privacy";
import { useFilters } from "./filter-bar";
import { DayJournalsDialog } from "./day-journals-dialog";
import { DitherGradient } from "./dither-kit";
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
                    onClick={() => {
                      onMonthChange({ year: calendar.year, month: idx + 1 });
                    }}
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
              <DropdownMenuContent className="min-w-24 max-h-60 overflow-y-auto">
                {YEARS.map((yr) => (
                  <DropdownMenuItem
                    key={yr}
                    className={cn(
                      "text-xs font-medium cursor-pointer",
                      yr === calendar.year && "bg-accent font-bold text-accent-foreground",
                    )}
                    onClick={() => {
                      onMonthChange({ year: yr, month: calendar.month });
                    }}
                  >
                    {yr}
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
            className="flex h-6 items-center justify-center rounded-md bg-muted/30 text-[9px] font-medium text-muted-foreground uppercase"
          >
            {weekday}
          </div>
        ))}
        <div className="journal-calendar-week-heading h-6 items-center justify-center rounded-md bg-muted/30 text-[9px] font-medium text-muted-foreground uppercase">
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
            onSelectDay={setSelectedDay}
          />
        ))}
      </div>

      {/* Mobile-only Weekly Breakdown */}
      <div className="sm:hidden mb-3">
        <div className="flex h-6 items-center justify-center rounded-md bg-muted/30 text-[9px] font-medium text-muted-foreground uppercase mb-2">
          Weekly summary
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {calendar.weeks.map((week, weekIndex) => (
            <MobileWeekCard
              key={weekIndex}
              week={week}
              weekIndex={weekIndex}
              isLastFullSpan={weekIndex === 4 && calendar.weeks.length === 5}
              monetary={monetary}
              currency={currency}
            />
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
      {/* Day Journals subwindow modal (media_1790076754434.png) */}
      <DayJournalsDialog
        date={selectedDay}
        open={Boolean(selectedDay)}
        onOpenChange={(open) => !open && setSelectedDay(null)}
        currency={currency}
      />
    </div>
  );
}

function MobileWeekCard({
  week,
  weekIndex,
  isLastFullSpan,
  monetary,
  currency,
}: {
  week: CalendarMonth["weeks"][number];
  weekIndex: number;
  isLastFullSpan: boolean;
  monetary: boolean;
  currency: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isProfit = week.weekNetPnl >= 0;

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "relative overflow-hidden flex flex-col items-center justify-center rounded-lg bg-card border border-border/40 text-center gap-0.5 !p-0 transition-all duration-150",
        isLastFullSpan ? "col-span-2" : "",
        week.weekTrades > 0 && (
          isProfit
            ? "border-profit/40 hover:border-profit/90 hover:glow-profit"
            : "border-loss/40 hover:border-loss/90 hover:glow-loss"
        ),
      )}
      style={{
        padding: 0,
        background:
          week.weekTrades > 0 && monetary
            ? `linear-gradient(to top, color-mix(in oklab, ${isProfit ? "var(--profit-fill)" : "var(--loss)"} ${hovered ? "20%" : "10%"}, var(--card)) 0%, var(--card) 90%)`
            : undefined,
      }}
    >
      {week.weekTrades > 0 && monetary && (
        <DitherGradient
          from={isProfit ? "green" : "red"}
          to="transparent"
          direction="up"
          cell={2}
          opacity={hovered ? 0.44 : 0.22}
          bloom={hovered ? "low" : "off"}
          className="absolute -inset-1"
        />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center p-2 w-full h-full pointer-events-none select-none gap-0.5">
        <span className="text-[8px] font-semibold tracking-[0.1em] text-muted-foreground uppercase text-shadow-oled">
          Week {weekIndex + 1}
        </span>
        <span className={cn("font-mono text-xs font-bold tabular-nums text-shadow-oled", week.weekTrades > 0 && monetary && pnlClass(week.weekNetPnl))}>
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
          <span className={cn("text-[8px] font-medium uppercase tracking-wider text-shadow-oled transition-colors", hovered ? "text-foreground/95" : "text-muted-foreground/90")}>
            {week.weekTrades} {week.weekTrades === 1 ? "trade" : "trades"}
          </span>
        )}
      </div>
    </div>
  );
}

function CalendarDayCell({
  day,
  isToday,
  traded,
  hasJournal,
  performance,
  maxAbs,
  currency,
  monetary,
  ariaLabel,
  onSelectDay,
}: {
  day: NonNullable<CalendarMonth["weeks"][number]["days"][number]>;
  isToday: boolean;
  traded: boolean;
  hasJournal: boolean;
  performance: "profit" | "loss" | "journal" | "neutral";
  maxAbs: number;
  currency: string;
  monetary: boolean;
  ariaLabel: string;
  onSelectDay: (date: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const privacy = usePrivacy();
  const norm = Math.min(1, Math.abs(day.netPnl) / (maxAbs || 1));
  const baseOpacity = 0.08 + 0.24 * norm;
  const hoverOpacity = 0.18 + 0.24 * norm;
  const baseGrad = Math.round((0.06 + 0.26 * norm) * 100);
  const hoverGrad = Math.round((0.14 + 0.26 * norm) * 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelectDay(day.date)}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          aria-label={ariaLabel}
          data-today={isToday ? "true" : undefined}
          data-hovered={hovered ? "true" : undefined}
          className={cn(
            "journal-calendar-day journal-calendar-day-link relative overflow-hidden flex flex-col min-w-0 rounded-md border text-left cursor-pointer transition-all duration-150 active:scale-[0.98] !p-0",
            !traded
              ? hasJournal
                ? "border-brand/40 bg-card"
                : "border-border/20 bg-muted/20 hover:bg-muted/30"
              : performance === "profit"
                ? norm >= 0.6
                  ? "border-profit/50 bg-card"
                  : "border-profit/30 bg-card"
                : performance === "loss"
                  ? norm >= 0.6
                    ? "border-loss/50 bg-card"
                    : "border-loss/30 bg-card"
                  : "border-border/60 bg-card",
            isToday && "ring-1 ring-primary",
            hovered && (
              performance === "profit"
                ? "border-profit ring-1 ring-profit/60 glow-profit"
                : performance === "loss"
                  ? "border-loss ring-1 ring-loss/60 glow-loss"
                  : hasJournal
                    ? "border-brand ring-1 ring-brand/60 glow-brand"
                    : "border-foreground/50"
            ),
          )}
          data-performance={performance}
          style={{
            padding: 0,
            ...(traded && monetary
              ? {
                  background: `linear-gradient(to top, color-mix(in oklab, ${
                    performance === "profit"
                      ? "var(--profit-fill)"
                      : performance === "loss"
                        ? "var(--loss)"
                        : "var(--neutral-mid)"
                  } ${hovered ? hoverGrad : baseGrad}%, var(--card)) 0%, var(--card) 90%)`,
                }
              : !traded && hasJournal
                ? {
                    background: `linear-gradient(to top, color-mix(in oklab, var(--brand) ${hovered ? "12%" : "6%"}, var(--card)) 0%, var(--card) 90%)`,
                  }
                : undefined),
          }}
        >
          {traded && monetary && (
            <DitherGradient
              from={performance === "profit" ? "green" : performance === "loss" ? "red" : "grey"}
              to="transparent"
              direction="up"
              cell={2}
              opacity={hovered ? hoverOpacity : baseOpacity}
              bloom={hovered ? "low" : "off"}
              className="absolute -inset-1"
            />
          )}
          {!traded && hasJournal && (
            <DitherGradient
              from="blue"
              to="transparent"
              direction="up"
              cell={2}
              opacity={hovered ? 0.18 : 0.08}
              bloom="off"
              className="absolute -inset-1"
            />
          )}
          <div className="journal-calendar-day-content relative z-10 flex flex-col justify-between h-full w-full pointer-events-none select-none">
            <div
              className={cn(
                "flex w-full",
                traded && hasJournal ? "items-center justify-between" : "",
                isToday ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("text-shadow-oled transition-colors", hovered && "text-foreground font-semibold")}>
                {Number(day.date.slice(8))}
              </span>
              {traded && hasJournal && (
                <NotebookPen
                  className="h-3 w-3 shrink-0 text-muted-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                  aria-label="Journal note recorded"
                />
              )}
            </div>
            {traded && (
              <div className="flex flex-col mt-auto">
                <div
                  className={cn(
                    "journal-calendar-full tnum text-xs font-bold leading-none text-shadow-oled",
                    monetary && pnlClass(day.netPnl),
                  )}
                >
                  {monetary ? (
                    <MonetaryValue>{fmtMoney(day.netPnl, currency)}</MonetaryValue>
                  ) : (
                    "—"
                  )}
                </div>
                <div
                  className={cn(
                    "journal-calendar-compact tnum text-xs font-bold leading-none text-shadow-oled",
                    monetary && pnlClass(day.netPnl),
                  )}
                >
                  {monetary ? (
                    <MonetaryValue>{compactMoney(day.netPnl, currency)}</MonetaryValue>
                  ) : (
                    "—"
                  )}
                </div>
                <div className={cn("journal-calendar-trades font-medium mt-0.5 text-shadow-oled transition-colors", hovered ? "text-foreground/95" : "text-muted-foreground/90")}>
                  {day.trades} trade{day.trades === 1 ? "" : "s"}
                </div>
              </div>
            )}
            {!traded && hasJournal && (
              <div className="journal-calendar-trades mt-auto flex items-center gap-1.5 font-semibold text-foreground text-xs text-shadow-oled">
                <NotebookPen className="size-3.5 shrink-0 text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                <span className="truncate">Journaled</span>
              </div>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className={cn(
          "journal-hover-card z-[80] min-w-44 whitespace-nowrap rounded-lg border bg-popover/95 p-2.5 shadow-xl backdrop-blur-md",
          performance === "profit" && "border-profit/40 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
          performance === "loss" && "border-loss/40 shadow-[0_0_12px_rgba(248,113,113,0.15)]",
          performance === "journal" && "border-brand/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
        )}
      >
        <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1 font-mono text-[10px] tracking-wide text-muted-foreground">
          <span>{day.date}</span>
          {isToday && (
            <span className="rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold text-primary uppercase">
              Today
            </span>
          )}
        </div>
        {traded ? (
          <div className="flex flex-col gap-1.5 font-mono text-xs tabular-nums">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                <span
                  className={cn(
                    "inline-block size-2 shrink-0 rounded-[1px]",
                    performance === "profit"
                      ? "bg-profit shadow-[0_0_6px_var(--profit)]"
                      : performance === "loss"
                        ? "bg-loss shadow-[0_0_6px_var(--loss)]"
                        : "bg-muted-foreground",
                  )}
                />
                <span>Net P&L</span>
              </div>
              <span className={cn("font-bold leading-none text-xs", pnlClass(day.netPnl))}>
                {!monetary ? (
                  "Multiple currencies"
                ) : privacy ? (
                  "P&L hidden"
                ) : (
                  fmtMoney(day.netPnl, currency)
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-muted-foreground text-[11px]">
              <span>Trades</span>
              <span className="font-semibold text-foreground leading-none">
                {day.trades} {day.trades === 1 ? "trade" : "trades"}
              </span>
            </div>
            {hasJournal && (
              <div className="flex items-center gap-1.5 pt-1 mt-0.5 border-t border-border/30 text-[10px] text-brand font-medium">
                <NotebookPen className="size-3 shrink-0" />
                <span>Journal note recorded</span>
              </div>
            )}
          </div>
        ) : hasJournal ? (
          <div className="flex items-center gap-1.5 text-xs text-brand font-medium">
            <NotebookPen className="size-3.5 shrink-0" />
            <span>Journal note recorded</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No trades</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function CalendarWeekTotalCell({
  week,
  monetary,
  currency,
}: {
  week: CalendarMonth["weeks"][number];
  monetary: boolean;
  currency: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isProfit = week.weekNetPnl >= 0;

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "journal-calendar-week relative overflow-hidden flex flex-col rounded-md bg-card border border-border/40 !p-0 transition-all duration-150",
        week.weekTrades > 0 && (
          isProfit
            ? "border-profit/40 hover:border-profit/90 hover:glow-profit"
            : "border-loss/40 hover:border-loss/90 hover:glow-loss"
        ),
      )}
      style={{
        padding: 0,
        background:
          week.weekTrades > 0 && monetary
            ? `linear-gradient(to top, color-mix(in oklab, ${isProfit ? "var(--profit-fill)" : "var(--loss)"} ${hovered ? "20%" : "10%"}, var(--card)) 0%, var(--card) 90%)`
            : undefined,
      }}
    >
      {week.weekTrades > 0 && monetary && (
        <DitherGradient
          from={isProfit ? "green" : "red"}
          to="transparent"
          direction="up"
          cell={2}
          opacity={hovered ? 0.44 : 0.22}
          bloom={hovered ? "low" : "off"}
          className="absolute -inset-1"
        />
      )}
      <div className="relative z-10 flex flex-col justify-between w-full h-full p-1.5 pointer-events-none select-none">
        <span className="journal-calendar-week-label text-muted-foreground text-shadow-oled">
          Week total
        </span>
        {week.weekTrades > 0 ? (
          <div className="flex flex-col mt-auto">
            {monetary && (
              <Pnl value={week.weekNetPnl} currency={currency} className="font-bold text-shadow-oled" />
            )}
            <span className={cn("font-medium mt-0.5 text-shadow-oled transition-colors", hovered ? "text-foreground/95" : "text-muted-foreground/90")}>
              {week.weekTrades} trades
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
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
  onSelectDay,
}: {
  week: CalendarMonth["weeks"][number];
  maxAbs: number;
  currency: string;
  monetary: boolean;
  today: string;
  journalDays?: string[];
  onSelectDay: (date: string) => void;
}) {
  const privacy = usePrivacy();
  const journalSet = useMemo(() => new Set(journalDays ?? []), [journalDays]);

  return (
    <>
      {week.days.map((day, dayIndex) => {
        if (!day) return <div key={dayIndex} className="journal-calendar-day rounded-md" />;
        const isToday = day.date === today;
        const traded = day.trades > 0;
        const hasJournal = journalSet.has(day.date);
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

        const ariaLabel = traded
          ? `${day.date}${isToday ? " (Today)" : ""}, ${tooltipPnl}, ${day.trades} trade${day.trades === 1 ? "" : "s"}${hasJournal ? ", journal note recorded" : ""}`
          : hasJournal
            ? `${day.date}${isToday ? " (Today)" : ""}, journal note recorded`
            : `${day.date}${isToday ? " (Today)" : ""}, no trades`;

        return (
          <CalendarDayCell
            key={day.date}
            day={day}
            isToday={isToday}
            traded={traded}
            hasJournal={hasJournal}
            performance={performance}
            maxAbs={maxAbs}
            currency={currency}
            monetary={monetary}
            ariaLabel={ariaLabel}
            onSelectDay={onSelectDay}
          />
        );
      })}
      <CalendarWeekTotalCell
        week={week}
        monetary={monetary}
        currency={currency}
      />
    </>
  );
}
