"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { HoverHint } from "./ui/tooltip";
import { Button } from "./ui/button";
import { progressScore, type Routine, type RoutineCheck } from "@/lib/progress";

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
      for (const d of weekDays) {
        if (d.inMonth) {
          weekTotal += d.score.total;
          weekCompleted += d.score.completed;
        }
      }
      result.push({
        days: weekDays,
        weekTotal,
        weekCompleted,
        weekScore: weekTotal > 0 ? weekCompleted / weekTotal : null,
      });
    }

    return result;
  }, [viewMonth, rules, checks]);

  // Monthly summary metrics
  const monthMetrics = useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;
    let activeDays = 0;
    let perfectDays = 0;

    const daysInMonth = new Date(Date.UTC(viewMonth.year, viewMonth.month, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, d));
      const dateStr = currDate.toISOString().slice(0, 10);
      const score = progressScore(rules, checks, dateStr);
      if (score.total > 0) {
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
  }, [viewMonth, rules, checks]);

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
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg bg-muted/20 p-2 ring-1 ring-border/40 text-center gap-0.5",
                weekIndex === 4 && weeks.length === 5 ? "col-span-2" : "",
              )}
            >
              <span className="text-[8px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                Week {weekIndex + 1}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {week.weekTotal > 0 ? `${Math.round(week.weekScore! * 100)}%` : "—"}
              </span>
              {week.weekTotal > 0 && (
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
                  {week.weekCompleted} of {week.weekTotal} done
                </span>
              )}
            </div>
          ))}
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
      {week.days.map((day) => {
        const isToday = day.date === today;
        const isSelected = day.date === selectedDate;
        const hasRoutines = day.score.total > 0;
        const isPerfect = hasRoutines && day.score.score === 1;
        const isPartial = hasRoutines && day.score.score! > 0 && day.score.score! < 1;

        const tooltipContent = hasRoutines
          ? `${day.score.completed} of ${day.score.total} routines completed (${Math.round(day.score.score! * 100)}%)`
          : "No routines scheduled";

        return (
          <HoverHint
            key={day.date}
            heading={isToday ? `${day.date} (Today)` : day.date}
            content={tooltipContent}
          >
            <button
              type="button"
              aria-label={`${day.date}: ${day.score.completed}/${day.score.total} routines complete`}
              data-today={isToday ? "true" : undefined}
              onClick={() => onSelectDate(day.date)}
              className={cn(
                "journal-calendar-day journal-calendar-day-link flex flex-col min-w-0 rounded-md border text-left cursor-pointer transition-all",
                !day.inMonth && "opacity-35 hover:opacity-75",
                isSelected
                  ? "ring-2 ring-foreground border-foreground shadow-xs font-medium"
                  : isToday
                    ? "ring-1 ring-brand border-brand/60"
                    : "border-border/60 hover:border-foreground/50",
                isPerfect && "border-brand/40",
              )}
              style={
                hasRoutines
                  ? {
                      backgroundColor: isPerfect
                        ? "color-mix(in srgb, var(--brand) 22%, var(--card))"
                        : isPartial
                          ? `color-mix(in srgb, var(--brand) ${10 + Math.round(day.score.score! * 30)}%, var(--card))`
                          : "var(--muted)/20",
                    }
                  : {
                      backgroundColor: "var(--muted)/15",
                    }
              }
            >
              {/* Day Number Header */}
              <div
                className={cn(
                  "flex items-center justify-between",
                  isToday || isSelected ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{day.dayNumber}</span>
                {isPerfect && (
                  <Check className="h-3 w-3 shrink-0 text-brand" aria-label="100% completed" />
                )}
              </div>

              {/* Completion Indicators */}
              {hasRoutines ? (
                <>
                  <div className="journal-calendar-full tnum font-medium">
                    <span
                      className={cn(
                        isPerfect
                          ? "text-brand font-semibold"
                          : isPartial
                            ? "text-foreground font-medium"
                            : "text-muted-foreground",
                      )}
                    >
                      {Math.round(day.score.score! * 100)}%
                    </span>
                  </div>
                  <div className="journal-calendar-compact tnum font-medium">
                    <span
                      className={cn(
                        isPerfect ? "text-brand font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {Math.round(day.score.score! * 100)}%
                    </span>
                  </div>
                  <div className="journal-calendar-trades text-muted-foreground">
                    {day.score.completed} of {day.score.total}
                  </div>
                </>
              ) : (
                <div className="journal-calendar-full text-muted-foreground text-[10px] mt-auto">
                  —
                </div>
              )}
            </button>
          </HoverHint>
        );
      })}

      {/* Week Total Desktop Column */}
      <div className="journal-calendar-week flex rounded-md bg-muted/40 p-1.5 text-right">
        <span className="journal-calendar-week-label text-muted-foreground">Week total</span>
        {week.weekTotal > 0 ? (
          <>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {Math.round(week.weekScore! * 100)}%
            </span>
            <span className="text-muted-foreground text-[10px]">
              {week.weekCompleted}/{week.weekTotal} done
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </div>
    </>
  );
}
