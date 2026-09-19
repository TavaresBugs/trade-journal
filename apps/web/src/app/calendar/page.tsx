"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  NotebookPen,
} from "lucide-react";
import { dayKeyOf, type DayStats } from "@luxalgo/journal-core";
import { CalendarPnl } from "@/components/calendar-pnl";
import { CalendarPerformance } from "@/components/calendar-insights";
import type { CalendarResponse } from "@/lib/calendar-insights";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Loading from "@/app/loading";
import { useApi } from "@/lib/use-api";
import { cn, fmtNumber, fmtPercent } from "@/lib/utils";

interface JournalDay {
  date: string;
  stats: DayStats | null;
  hasNote: boolean;
  notePreview: string;
}

const PAGE_SIZE = 50;
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC",
});

export default function CalendarPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CalendarView />
    </Suspense>
  );
}

function CalendarView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { query, timeZone } = useFilters();

  const initialView = searchParams.get("view") === "list" ? "list" : "grid";
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialView);

  // Synchronize view mode if query param changes externally
  useEffect(() => {
    const urlView = searchParams.get("view") === "list" ? "list" : "grid";
    setViewMode(urlView);
  }, [searchParams]);

  const handleViewChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "list") {
      params.set("view", "list");
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    router.replace(`/calendar${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const [selection, setMonth] = useState<{ year: number; month: number } | null>(null);
  const { data, error, refresh } = useApi<CalendarResponse>(
    `/api/calendar?${query}${selection ? `&calYear=${selection.year}&calMonth=${selection.month}` : ""}`,
  );
  const today = dayKeyOf(new Date().toISOString(), timeZone);
  const month = selection ??
    data?.calendar ?? { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };

  const shift = (delta: number) => {
    const next = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };

  return (
    <div>
      <FilterBar
        title="Calendar"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "grid" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 active:scale-[0.97]"
                  onClick={() => shift(-1)}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-32 text-center text-xs font-semibold select-none sm:w-36 sm:text-sm tnum">
                  {new Date(Date.UTC(month.year, month.month - 1)).toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 active:scale-[0.97]"
                  onClick={() => shift(1)}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* View Mode Toggle: Grid vs List */}
            <div
              role="group"
              aria-label="Layout view mode"
              className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => handleViewChange("grid")}
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-[color,background-color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("list")}
                aria-pressed={viewMode === "list"}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-[color,background-color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <List className="h-3.5 w-3.5 shrink-0" />
                <span>List</span>
              </button>
            </div>

            <Button asChild size="sm">
              <Link href={`/journal/${today}?${query}`}>View today</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        {viewMode === "grid" ? (
          <>
            <Card>
              <CardContent className="pt-4">
                {error ? (
                  <div role="alert" className="space-y-3 py-6 text-sm">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={refresh}>
                      Try again
                    </Button>
                  </div>
                ) : data ? (
                  <CalendarPnl
                    calendar={data.calendar}
                    currency={data.currencies[0] ?? "USD"}
                    monetary={data.currencies.length <= 1}
                    today={today}
                    journalDays={data.journalDays}
                  />
                ) : (
                  <div role="status" aria-label="Loading calendar">
                    <Skeleton className="h-96" />
                  </div>
                )}
              </CardContent>
            </Card>
            {data && (
              <CalendarPerformance
                key={`${data.calendar.year}-${data.calendar.month}-${query}`}
                data={data}
                query={query}
              />
            )}
            {!data && !error && (
              <div
                role="status"
                aria-label="Loading performance insights"
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              >
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-28" />
                ))}
              </div>
            )}
          </>
        ) : (
          <CalendarListView query={query} />
        )}
      </div>
    </div>
  );
}

function CalendarListView({ query }: { query: string }) {
  const { data, error, refresh } = useApi<{ days: JournalDay[] }>(`/api/journal?${query}`);
  const [visibleWindow, setVisibleWindow] = useState({ query, limit: PAGE_SIZE });
  const limit = visibleWindow.query === query ? visibleWindow.limit : PAGE_SIZE;
  useEffect(() => setVisibleWindow({ query, limit: PAGE_SIZE }), [query]);

  return (
    <div className="space-y-2.5">
      {error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div role="status" aria-label="Loading journal feed" className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : null}

      {data?.days.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No trading days yet — import trades or write your first day note.
        </p>
      )}

      {data?.days.slice(0, limit).map((day) => (
        <Link
          key={day.date}
          href={`/journal/${day.date}?${query}`}
          className="group block rounded-lg transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="rounded-lg border border-border/60 bg-card transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-border/90 hover:bg-muted/20 hover:shadow-xs">
            <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-3.5">
              {/* Date & Weekday */}
              <div className="w-full shrink-0 sm:w-32">
                <div className="text-sm font-semibold text-foreground tracking-tight tnum">
                  {day.date}
                </div>
                <div className="text-xs text-muted-foreground">
                  {weekdayFormatter.format(new Date(`${day.date}T00:00:00Z`))}
                </div>
              </div>

              {/* Day Quantitative Stats */}
              {day.stats ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <Pnl value={day.stats.netPnl} className="font-semibold text-base tnum" />
                  <span className="text-xs text-muted-foreground tnum font-medium">
                    {day.stats.trades} trade{day.stats.trades === 1 ? "" : "s"}
                  </span>
                  <Badge
                    variant={
                      day.stats.netPnl > 0 ? "profit" : day.stats.netPnl < 0 ? "loss" : "secondary"
                    }
                    className="text-[11px] tnum font-medium"
                  >
                    {fmtPercent(day.stats.trades > 0 ? day.stats.wins / day.stats.trades : null, 0)}{" "}
                    win ({day.stats.wins}W / {day.stats.losses}L)
                  </Badge>
                  <span className="text-xs text-muted-foreground tnum">
                    {fmtNumber(day.stats.volume, 2)} vol
                  </span>
                </div>
              ) : (
                <div className="flex-1 text-xs text-muted-foreground italic">No closed trades</div>
              )}

              {/* Day Note & Action Indicator */}
              <div className="flex items-center gap-3 ml-auto">
                {day.hasNote && (
                  <Badge
                    variant="secondary"
                    className="gap-1 px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    <NotebookPen className="h-3.5 w-3.5 text-brand shrink-0" />
                    <span>Note</span>
                  </Badge>
                )}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-50 transition-[opacity,transform,color] group-hover:opacity-100 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      {data && data.days.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <span role="status" className="tnum">
            Showing {Math.min(limit, data.days.length)} of {data.days.length} days
          </span>
          {limit < data.days.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleWindow({ query, limit: limit + PAGE_SIZE })}
            >
              Show older days
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
