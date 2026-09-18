"use client";
import { useMemo } from "react";
import { HoverHint } from "./ui/tooltip";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { dayKeyOf, type CalendarMonth } from "@luxalgo/journal-core";
import { cn, fmtMoney } from "@/lib/utils";
import { Pnl } from "./pnl";
import { MonetaryValue, usePrivacy } from "./privacy";
import { useFilters } from "./filter-bar";

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
}: {
  calendar: CalendarMonth;
  currency?: string;
  monetary?: boolean;
  today?: string;
  journalDays?: string[];
}) {
  const { timeZone } = useFilters();
  const today = propToday ?? dayKeyOf(new Date().toISOString(), timeZone);
  const maxAbs = Math.max(
    1,
    ...calendar.weeks.flatMap((week) => week.days.map((day) => Math.abs(day?.netPnl ?? 0))),
  );
  return (
    <div className="journal-calendar min-w-0 w-full">
      <div className="journal-calendar-grid grid gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div key={weekday} className="px-1 pb-1 text-muted-foreground">
            {weekday}
          </div>
        ))}
        <div className="journal-calendar-week-heading px-1 pb-1 text-right text-muted-foreground">
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
        <span className="text-muted-foreground">
          {calendar.tradingDays} trading days {monetary && <>· {calendar.winningDays} green</>}
        </span>
        <span>
          Month:{" "}
          {monetary ? (
            <Pnl value={calendar.monthNetPnl} currency={currency} className="font-semibold" />
          ) : (
            <span className="text-muted-foreground">Multiple currencies</span>
          )}
        </span>
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
