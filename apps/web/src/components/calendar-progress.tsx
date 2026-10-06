"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn, fmtFullDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { progressScore, type Routine, type RoutineCheck } from "@/lib/progress";
import { DitherGradient, TOOLTIP_SURFACE_CLASSES, TooltipHeader, TooltipRow } from "./dither-kit";

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

interface DayInfo {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  score: {
    total: number;
    completed: number;
    score: number | null;
  };
}

interface WeekInfo {
  days: DayInfo[];
  weekTotal: number;
  weekCompleted: number;
  weekScore: number | null;
}

export function CalendarProgress({
  rules,
  checks,
  today,
  selectedDate,
  onSelectDate,
  className,
}: {
  rules: Routine[];
  checks: RoutineCheck[];
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  className?: string;
}) {
  const initialYear = Number(selectedDate?.slice(0, 4) || today?.slice(0, 4) || CURRENT_YEAR);
  const initialMonth = Number(
    selectedDate?.slice(5, 7) || today?.slice(5, 7) || new Date().getMonth() + 1,
  );

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>({
    year: initialYear,
    month: initialMonth,
  });

  // Calculate calendar weeks for the viewed month
  const weeks = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const startDayOfWeek = firstDay.getUTCDay(); // 0 is Sunday
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

    const days: DayInfo[] = [];

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(Date.UTC(year, month - 2, dayNum));
      const dateStr = prevDate.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        dayNumber: dayNum,
        inMonth: false,
        score: progressScore(rules, checks, dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(Date.UTC(year, month - 1, d));
      const dateStr = currDate.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        dayNumber: d,
        inMonth: true,
        score: progressScore(rules, checks, dateStr),
      });
    }

    // Next month padding days to complete full 7-day rows
    const remainder = days.length % 7;
    if (remainder > 0) {
      const needed = 7 - remainder;
      for (let d = 1; d <= needed; d++) {
        const nextDate = new Date(Date.UTC(year, month, d));
        const dateStr = nextDate.toISOString().slice(0, 10);
        days.push({
          date: dateStr,
          dayNumber: d,
          inMonth: false,
          score: progressScore(rules, checks, dateStr),
        });
      }
    }

    // Chunk into 7-day weeks
    const result: WeekInfo[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      let weekTotal = 0;
      let weekCompleted = 0;
      let hasElapsedDays = false;
      for (const d of weekDays) {
        if (d.inMonth) {
          const isPastOrToday = !today || d.date <= today;
          if (isPastOrToday) {
            hasElapsedDays = true;
            weekTotal += d.score.total;
            weekCompleted += d.score.completed;
          }
        }
      }
      result.push({
        days: weekDays,
        weekTotal,
        weekCompleted,
        weekScore: hasElapsedDays && weekTotal > 0 ? weekCompleted / weekTotal : null,
      });
    }

    return result;
  }, [viewMonth, rules, checks, today]);

  // Monthly summary metrics - bounded strictly to elapsed days (<= today)
  const monthMetrics = useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;
    let activeDays = 0;
    let perfectDays = 0;

    const daysInMonth = new Date(Date.UTC(viewMonth.year, viewMonth.month, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, d));
      const dateStr = currDate.toISOString().slice(0, 10);
      const isPastOrToday = !today || dateStr <= today;
      const score = progressScore(rules, checks, dateStr);
      if (score.total > 0 && isPastOrToday) {
        activeDays++;
        totalScheduled += score.total;
        totalCompleted += score.completed;
        if (score.score === 1) {
          perfectDays++;
        }
      }
    }

    const monthCompletionRate =
      totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : null;

    return {
      monthCompletionRate,
      perfectDays,
      activeDays,
      totalCompleted,
    };
  }, [viewMonth, rules, checks, today]);

  const isCurrentMonth =
    today &&
    Number(today.slice(0, 4)) === viewMonth.year &&
    Number(today.slice(5, 7)) === viewMonth.month;

  return (
    <div className={cn("journal-calendar min-w-0 w-full flex flex-col flex-1", className)}>
      {/* Month, Year Dropdowns & Nav Arrows Header - Centered with balanced actions */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 px-1 min-h-8">
        {/* Left balance spacer */}
        <div className="flex items-center justify-start min-w-0">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
            Routine Calendar
          </span>
        </div>

        {/* Center: Month & Year Nav */}
        <div className="flex items-center justify-center gap-1">
          {/* Previous Month Button < */}
          <button
            type="button"
            aria-label="Previous month"
            className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
            onClick={() => {
              const prev = new Date(Date.UTC(viewMonth.year, viewMonth.month - 2, 1));
              setViewMonth({ year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 });
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
                <span>{MONTH_NAMES[viewMonth.month - 1] ?? `Month ${viewMonth.month}`}</span>
                <ChevronDown className="size-3 text-muted-foreground opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-36">
              {MONTH_NAMES.map((name, idx) => (
                <DropdownMenuItem
                  key={name}
                  className={cn(
                    "text-xs font-medium cursor-pointer",
                    idx + 1 === viewMonth.month && "bg-accent font-bold text-accent-foreground",
                  )}
                  onSelect={() => setViewMonth({ year: viewMonth.year, month: idx + 1 })}
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
                <span>{viewMonth.year}</span>
                <ChevronDown className="size-3 text-muted-foreground opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-28">
              {YEARS.map((y) => (
                <DropdownMenuItem
                  key={y}
                  className={cn(
                    "text-xs font-medium cursor-pointer",
                    y === viewMonth.year && "bg-accent font-bold text-accent-foreground",
                  )}
                  onSelect={() => setViewMonth({ year: y, month: viewMonth.month })}
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
              const next = new Date(Date.UTC(viewMonth.year, viewMonth.month, 1));
              setViewMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
            }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Right side: Today Quick Jump */}
        <div className="flex justify-end items-center">
          {!isCurrentMonth && today && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 rounded-lg"
              onClick={() => {
                const yr = Number(today.slice(0, 4));
                const mo = Number(today.slice(5, 7));
                setViewMonth({ year: yr, month: mo });
                onSelectDate(today);
              }}
            >
              Today
            </Button>
          )}
        </div>
      </div>

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

        {weeks.map((week, weekIndex) => (
          <CalendarProgressWeekRow
            key={weekIndex}
            week={week}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>

      {/* Mobile-only Weekly Breakdown */}
      <div className="sm:hidden mb-3">
        <div className="flex h-6 items-center justify-center rounded-md bg-muted/30 text-[9px] font-medium text-muted-foreground uppercase mb-2">
          Weekly summary
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {weeks.map((week, weekIndex) => {
            const hasElapsed = week.weekScore !== null && week.weekTotal > 0;
            const isPerfect = hasElapsed && week.weekScore === 1;
            return (
              <div
                key={weekIndex}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg bg-muted/20 p-2 ring-1 ring-border/40 text-center gap-0.5",
                  isPerfect && "ring-profit/30 bg-profit/5",
                  weekIndex === 4 && weeks.length === 5 ? "col-span-2" : "",
                )}
              >
                <span className="text-[8px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  Week {weekIndex + 1}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    isPerfect ? "text-profit" : "text-foreground",
                  )}
                >
                  {hasElapsed ? `${Math.round(week.weekScore! * 100)}%` : "—"}
                </span>
                {hasElapsed && (
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                    {week.weekCompleted} of {week.weekTotal} done
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified 4 Metrics Cards - Anchored to bottom with mt-auto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-auto pt-3 border-t border-border/40">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Month Completion
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {monthMetrics.monthCompletionRate !== null
              ? `${monthMetrics.monthCompletionRate}%`
              : "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Perfect Days
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {monthMetrics.perfectDays}{" "}
            <span className="text-muted-foreground font-normal text-xs">
              {monthMetrics.perfectDays === 1 ? "day" : "days"} (100%)
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Active Days
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {monthMetrics.activeDays}{" "}
            <span className="text-muted-foreground font-normal text-xs">
              {monthMetrics.activeDays === 1 ? "day" : "days"}
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[8px] sm:text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            Routines Done
          </span>
          <span className="truncate font-mono text-xs sm:text-sm font-semibold tabular-nums text-foreground">
            {monthMetrics.totalCompleted}{" "}
            <span className="text-muted-foreground font-normal text-xs">completed</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CalendarProgressWeekRow({
  week,
  today,
  selectedDate,
  onSelectDate,
}: {
  week: WeekInfo;
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <>
      {week.days.map((day) => (
        <CalendarProgressDayCell
          key={day.date}
          day={day}
          today={today}
          isSelected={day.date === selectedDate}
          onSelectDate={onSelectDate}
        />
      ))}
      <CalendarProgressWeekTotalCell week={week} />
    </>
  );
}

function CalendarProgressDayCell({
  day,
  today,
  isSelected,
  onSelectDate,
}: {
  day: DayInfo;
  today: string;
  isSelected: boolean;
  onSelectDate: (date: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isToday = day.date === today;
  const isFuture = Boolean(today && day.date > today);
  const isPast = Boolean(today && day.date < today);
  const hasRoutines = day.score.total > 0;
  const total = day.score.total;
  const completed = day.score.completed;
  const score = day.score.score;

  const isPerfect = hasRoutines && !isFuture && score === 1;
  const isPartial = hasRoutines && !isFuture && score !== null && score > 0 && score < 1;
  const isMissed = isPast && hasRoutines && completed === 0;
  const isPendingToday = isToday && hasRoutines && completed === 0;

  const performance = isPerfect ? "profit" : isPartial ? "journal" : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelectDate(day.date)}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          aria-label={
            isFuture
              ? `${day.date}: ${total} routine${total === 1 ? "" : "s"} scheduled`
              : hasRoutines
                ? `${day.date}: ${completed}/${total} routines complete (${Math.round((score ?? 0) * 100)}%)`
                : `${day.date}: No routines scheduled`
          }
          data-performance={performance}
          data-today={isToday ? "true" : undefined}
          data-hovered={hovered ? "true" : undefined}
          className={cn(
            "journal-calendar-day journal-calendar-day-link relative overflow-hidden flex flex-col min-w-0 rounded-md border text-left cursor-pointer transition-all duration-150 active:scale-[0.98] !p-0",
            !day.inMonth && "opacity-30 hover:opacity-75",
            isSelected
              ? "ring-2 ring-foreground border-foreground shadow-xs font-medium"
              : isToday
                ? "ring-1 ring-brand border-brand/60"
                : isPerfect
                  ? "border-profit/40 bg-card"
                  : isPartial
                    ? "border-brand/40 bg-card"
                    : isFuture
                      ? "border-border/30 bg-card/40"
                      : "border-border/40 bg-card",
            hovered &&
              (isPerfect
                ? "border-profit ring-1 ring-profit/60 glow-profit"
                : isPartial
                  ? "border-brand ring-1 ring-brand/60 glow-brand"
                  : "border-foreground/50"),
          )}
          style={{
            padding: 0,
            ...(isPerfect
              ? {
                  background: `linear-gradient(to top, color-mix(in oklab, var(--profit-fill) ${hovered ? 32 : 18}%, var(--card)) 0%, var(--card) 90%)`,
                }
              : isPartial
                ? {
                    background: `linear-gradient(to top, color-mix(in oklab, var(--brand) ${hovered ? 24 : 12}%, var(--card)) 0%, var(--card) 90%)`,
                  }
                : undefined),
          }}
        >
          {isPerfect && (
            <DitherGradient
              from="green"
              to="transparent"
              direction="up"
              cell={2}
              opacity={hovered ? 0.3 : 0.18}
              bloom={hovered ? "low" : "off"}
              className="absolute -inset-1"
            />
          )}
          {isPartial && (
            <DitherGradient
              from="blue"
              to="transparent"
              direction="up"
              cell={2}
              opacity={hovered ? 0.22 : 0.12}
              bloom={hovered ? "low" : "off"}
              className="absolute -inset-1"
            />
          )}

          <div className="journal-calendar-day-content relative z-10 flex flex-col justify-between h-full w-full pointer-events-none select-none">
            {/* Day Number Header */}
            <div
              className={cn(
                "flex items-center justify-between w-full",
                isToday || isSelected ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "text-shadow-oled transition-colors",
                  hovered && "text-foreground font-semibold",
                  isFuture && "text-muted-foreground/60",
                )}
              >
                {day.dayNumber}
              </span>
              {isPerfect && (
                <Check
                  className="size-3 shrink-0 text-profit drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                  aria-label="100% completed"
                />
              )}
              {isFuture && hasRoutines && (
                <span
                  className="size-1 rounded-full bg-muted-foreground/40 shrink-0"
                  aria-label="Routines scheduled"
                />
              )}
            </div>

            {/* Bottom Content / Indicators */}
            {isPerfect && (
              <div className="flex flex-col mt-auto">
                <div className="journal-calendar-full tnum font-mono text-xs font-bold leading-none text-profit text-shadow-oled">
                  100%
                </div>
                <div className="journal-calendar-compact tnum font-mono text-xs font-bold leading-none text-profit text-shadow-oled">
                  100%
                </div>
                <div
                  className={cn(
                    "journal-calendar-trades font-medium mt-0.5 text-shadow-oled transition-colors",
                    hovered ? "text-foreground/95" : "text-muted-foreground/90",
                  )}
                >
                  {completed}/{total} done
                </div>
              </div>
            )}

            {isPartial && (
              <div className="flex flex-col mt-auto">
                <div className="journal-calendar-full tnum font-mono text-xs font-bold leading-none text-foreground text-shadow-oled">
                  {Math.round(score! * 100)}%
                </div>
                <div className="journal-calendar-compact tnum font-mono text-xs font-bold leading-none text-foreground text-shadow-oled">
                  {Math.round(score! * 100)}%
                </div>
                <div
                  className={cn(
                    "journal-calendar-trades font-medium mt-0.5 text-shadow-oled transition-colors",
                    hovered ? "text-foreground/95" : "text-muted-foreground/90",
                  )}
                >
                  {completed}/{total} done
                </div>
              </div>
            )}

            {isMissed && (
              <div className="flex flex-col mt-auto">
                <div className="journal-calendar-full tnum font-mono text-[10px] font-semibold leading-none text-muted-foreground/60 text-shadow-oled">
                  0%
                </div>
                <div className="journal-calendar-compact tnum font-mono text-[10px] font-semibold leading-none text-muted-foreground/60 text-shadow-oled">
                  0%
                </div>
                <div className="journal-calendar-trades font-normal mt-0.5 text-muted-foreground/50 text-[9px]">
                  0/{total}
                </div>
              </div>
            )}

            {isPendingToday && (
              <div className="flex flex-col mt-auto">
                <div className="journal-calendar-full tnum font-mono text-xs font-semibold leading-none text-primary/80 text-shadow-oled">
                  0%
                </div>
                <div className="journal-calendar-compact tnum font-mono text-xs font-semibold leading-none text-primary/80 text-shadow-oled">
                  0%
                </div>
                <div className="journal-calendar-trades font-medium mt-0.5 text-muted-foreground/80 text-[10px]">
                  {total} pending
                </div>
              </div>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className={cn(
          "journal-hover-card z-[80] min-w-44 whitespace-nowrap !p-2.5 !text-xs !max-w-none",
          TOOLTIP_SURFACE_CLASSES,
        )}
      >
        <TooltipHeader
          title={fmtFullDate(day.date)}
          badge={
            isToday ? (
              <span className="rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold text-primary uppercase">
                Today
              </span>
            ) : isPerfect ? (
              <span className="rounded bg-profit/20 px-1 py-0.5 text-[8px] font-bold text-profit uppercase">
                Completed
              </span>
            ) : isFuture && hasRoutines ? (
              <span className="rounded bg-muted px-1 py-0.5 text-[8px] font-semibold text-muted-foreground uppercase">
                Upcoming
              </span>
            ) : undefined
          }
        />
        {isFuture ? (
          hasRoutines ? (
            <TooltipRow
              swatchClassName="bg-muted-foreground/60 shadow-[0_0_6px_rgba(255,255,255,0.1)]"
              label="Scheduled"
              value={`${total} routine${total === 1 ? "" : "s"} planned`}
              valueClassName="font-medium text-foreground"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No routines scheduled</span>
          )
        ) : isPerfect ? (
          <div className="flex flex-col gap-1.5">
            <TooltipRow
              swatchClassName="bg-profit shadow-[0_0_6px_var(--profit)]"
              label="Completion"
              value="100%"
              valueClassName="font-semibold text-profit"
            />
            <TooltipRow
              swatchClassName="bg-brand shadow-[0_0_6px_var(--brand)]"
              label="Routines"
              value={`${completed} of ${total} done`}
              valueClassName="font-semibold text-foreground"
            />
          </div>
        ) : isPartial ? (
          <div className="flex flex-col gap-1.5">
            <TooltipRow
              swatchClassName="bg-brand shadow-[0_0_6px_var(--brand)]"
              label="Completion"
              value={`${Math.round(score! * 100)}%`}
              valueClassName="font-semibold text-foreground"
            />
            <TooltipRow
              swatchClassName="bg-brand/60"
              label="Routines"
              value={`${completed} of ${total} done`}
              valueClassName="font-medium text-muted-foreground"
            />
          </div>
        ) : isMissed ? (
          <div className="flex flex-col gap-1.5">
            <TooltipRow
              swatchClassName="bg-muted-foreground/50"
              label="Completion"
              value="0%"
              valueClassName="font-medium text-muted-foreground"
            />
            <TooltipRow
              swatchClassName="bg-muted-foreground/50"
              label="Routines"
              value={`0 of ${total} done`}
              valueClassName="font-normal text-muted-foreground"
            />
          </div>
        ) : isPendingToday ? (
          <div className="flex flex-col gap-1.5">
            <TooltipRow
              swatchClassName="bg-primary/80"
              label="Status"
              value={`${total} pending`}
              valueClassName="font-semibold text-primary"
            />
            <TooltipRow
              swatchClassName="bg-muted-foreground/50"
              label="Progress"
              value={`0 of ${total} done`}
              valueClassName="font-normal text-muted-foreground"
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No routines scheduled</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function CalendarProgressWeekTotalCell({ week }: { week: WeekInfo }) {
  const [hovered, setHovered] = useState(false);
  const hasElapsed = week.weekScore !== null && week.weekTotal > 0;
  const isPerfect = hasElapsed && week.weekScore === 1;

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "journal-calendar-week relative overflow-hidden flex flex-col rounded-md bg-card border border-border/40 !p-0 transition-all duration-150",
        hasElapsed &&
          (isPerfect
            ? "border-profit/40 hover:border-profit/90 hover:glow-profit"
            : "border-brand/40 hover:border-brand/90 hover:glow-brand"),
      )}
      style={{
        padding: 0,
        background: hasElapsed
          ? `linear-gradient(to top, color-mix(in oklab, ${isPerfect ? "var(--profit-fill)" : "var(--brand)"} ${hovered ? "20%" : "10%"}, var(--card)) 0%, var(--card) 90%)`
          : undefined,
      }}
    >
      {hasElapsed && (
        <DitherGradient
          from={isPerfect ? "green" : "blue"}
          to="transparent"
          direction="up"
          cell={2}
          opacity={hovered ? 0.36 : 0.18}
          bloom={hovered ? "low" : "off"}
          className="absolute -inset-1"
        />
      )}
      <div className="relative z-10 flex flex-col justify-between w-full h-full p-1.5 pointer-events-none select-none">
        <span className="journal-calendar-week-label text-muted-foreground text-shadow-oled">
          Week total
        </span>
        {hasElapsed ? (
          <div className="flex flex-col mt-auto">
            <span
              className={cn(
                "font-mono text-xs font-bold tabular-nums text-shadow-oled",
                isPerfect ? "text-profit" : "text-foreground",
              )}
            >
              {Math.round(week.weekScore! * 100)}%
            </span>
            <span
              className={cn(
                "text-[10px] font-medium mt-0.5 text-shadow-oled transition-colors",
                hovered ? "text-foreground/95" : "text-muted-foreground/90",
              )}
            >
              {week.weekCompleted}/{week.weekTotal} done
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground mt-auto">–</span>
        )}
      </div>
    </div>
  );
}
