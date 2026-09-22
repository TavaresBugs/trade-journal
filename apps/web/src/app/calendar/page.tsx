"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, LayoutGrid, List, NotebookPen } from "lucide-react";
import { dayKeyOf, type DayStats } from "@luxalgo/journal-core";
import { CalendarPnl } from "@/components/calendar-pnl";
import { CalendarPerformance } from "@/components/calendar-insights";
import type { CalendarResponse } from "@/lib/calendar-insights";
import { FilterBar, FilterDialogButton, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Loading from "@/app/loading";
import { useApi } from "@/lib/use-api";
import { AssetIcon } from "@/components/ui/asset-icon";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { cn, fmtMoney, fmtNumber, fmtPercent } from "@/lib/utils";

interface JournalDay {
  date: string;
  stats: DayStats | null;
  symbols?: string[];
  hasNote: boolean;
  notePreview: string;
}

function cleanExcerpt(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/#+\s+/g, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
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
  const { data, error, loading, refresh } = useApi<CalendarResponse>(
    `/api/calendar?${query}${selection ? `&calYear=${selection.year}&calMonth=${selection.month}` : ""}`,
  );
  const [cachedData, setCachedData] = useState<CalendarResponse | null>(null);

  useEffect(() => {
    if (data) {
      setCachedData(data);
    }
  }, [data]);

  const activeData = data ?? cachedData;
  const today = dayKeyOf(new Date().toISOString(), timeZone);

  return (
    <div>
      <FilterBar
        title="Calendar"
        hideFilterButton={true}
        hideRangeButtons={true}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Grid vs List */}
            <div
              role="group"
              aria-label="Layout view mode"
              className="flex h-8 items-center rounded-lg border border-input bg-muted/30 p-0.5 text-xs shadow-xs"
            >
              <button
                type="button"
                onClick={() => handleViewChange("grid")}
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
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
                  "flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <List className="h-3.5 w-3.5 shrink-0" />
                <span>List</span>
              </button>
            </div>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        {viewMode === "grid" ? (
          <>
            <Card>
              <CardContent className="p-3 sm:p-5">
                {error && !activeData ? (
                  <div role="alert" className="space-y-3 py-6 text-sm">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={refresh}>
                      Try again
                    </Button>
                  </div>
                ) : activeData ? (
                  <div
                    className={cn(
                      "transition-opacity duration-150",
                      loading && "opacity-50 pointer-events-none",
                    )}
                  >
                    <CalendarPnl
                      calendar={activeData.calendar}
                      currency={activeData.currencies[0] ?? "USD"}
                      monetary={activeData.currencies.length <= 1}
                      today={today}
                      journalDays={activeData.journalDays}
                      onMonthChange={setMonth}
                      headerRight={<FilterDialogButton asSeamless />}
                    />
                  </div>
                ) : (
                  <div role="status" aria-label="Loading calendar">
                    <Skeleton className="h-96" />
                  </div>
                )}
              </CardContent>
            </Card>
            {activeData && (
              <div
                className={cn(
                  "transition-opacity duration-150",
                  loading && "opacity-50 pointer-events-none",
                )}
              >
                <CalendarPerformance
                  key={`${activeData.calendar.year}-${activeData.calendar.month}-${query}`}
                  data={activeData}
                  query={query}
                />
              </div>
            )}
            {!activeData && !error && (
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

      {data?.days.slice(0, limit).map((day) => {
        const noteSnippet = cleanExcerpt(day.notePreview);
        const symbols = day.symbols ?? [];

        return (
          <Link
            key={day.date}
            href={`/journal/${day.date}?${query}`}
            className="group block rounded-lg transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            <Card className="rounded-lg border border-border/60 bg-card transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-border/90 hover:bg-muted/20 hover:shadow-xs">
              <CardContent className="p-3.5 sm:p-4">
                {/* Main Row: 12-column grid on desktop, clean responsive layout on mobile */}
                <div className="grid grid-cols-12 items-center gap-3 sm:gap-4">
                  {/* Column 1: Date & Weekday */}
                  <div className="col-span-12 sm:col-span-3 md:col-span-2">
                    <div className="text-sm font-semibold text-foreground tracking-tight tnum">
                      {day.date}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {weekdayFormatter.format(new Date(`${day.date}T00:00:00Z`))}
                    </div>
                  </div>

                  {/* Column 2: Traded Assets */}
                  <div className="col-span-12 sm:col-span-4 md:col-span-3">
                    {symbols.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {symbols.slice(0, 3).map((sym) => {
                          const canonical = normalizeSymbol(sym);
                          return (
                            <span
                              key={sym}
                              className="inline-flex items-center gap-2 font-medium select-none"
                              title={sym !== canonical ? `Contract: ${sym}` : undefined}
                            >
                              <AssetIcon symbol={sym} size="sm" />
                              <span className="font-semibold text-sm tracking-tight text-foreground">
                                {canonical}
                              </span>
                            </span>
                          );
                        })}
                        {symbols.length > 3 && (
                          <span
                            className="text-xs font-medium text-muted-foreground"
                            title={symbols.slice(3).join(", ")}
                          >
                            +{symbols.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 italic">
                        No closed trades
                      </span>
                    )}
                  </div>

                  {/* Column 3: Outcome / Winrate */}
                  <div className="col-span-6 sm:col-span-2 md:col-span-2 flex items-center sm:justify-center">
                    {day.stats ? (
                      <Badge
                        variant={
                          day.stats.netPnl > 0
                            ? "profit"
                            : day.stats.netPnl < 0
                              ? "loss"
                              : "secondary"
                        }
                        className="tracking-wide text-[11px] tnum font-semibold"
                      >
                        {day.stats.trades > 0
                          ? `${fmtPercent(day.stats.wins / day.stats.trades, 0)} WIN`
                          : "0% WIN"}
                        <span className="ml-1 opacity-70 font-normal">
                          ({day.stats.wins}W/{day.stats.losses}L)
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </div>

                  {/* Column 4: Activity (Volume & Trades) */}
                  <div className="col-span-6 sm:col-span-3 md:col-span-2 flex flex-col items-end sm:items-center">
                    {day.stats ? (
                      <>
                        <span className="text-xs font-semibold text-foreground tnum">
                          {day.stats.trades} trade{day.stats.trades === 1 ? "" : "s"}
                        </span>
                        <span className="text-[11px] text-muted-foreground tnum">
                          {fmtNumber(day.stats.volume, 2)} vol
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </div>

                  {/* Column 5: Net P&L */}
                  <div className="col-span-6 sm:col-span-6 md:col-span-2 flex flex-col items-start md:items-end">
                    {day.stats ? (
                      <>
                        <Pnl
                          value={day.stats.netPnl}
                          className="font-semibold text-sm sm:text-base tnum"
                        />
                        {day.stats.fees > 0 && (
                          <span className="text-[10px] text-muted-foreground tnum">
                            fees: {fmtMoney(day.stats.fees)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Journal only</span>
                    )}
                  </div>

                  {/* Column 6: Note Indicator & Action Arrow */}
                  <div className="col-span-6 sm:col-span-6 md:col-span-1 flex items-center justify-end gap-2.5 ml-auto">
                    {day.hasNote && (
                      <Badge
                        variant="secondary"
                        className="gap-1 px-2 py-0.5 text-xs font-medium text-foreground shrink-0"
                        title={noteSnippet ? noteSnippet : undefined}
                      >
                        <NotebookPen className="h-3 w-3 text-brand shrink-0" />
                        <span className="hidden xl:inline">Note</span>
                      </Badge>
                    )}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-40 transition-[opacity,transform,color] duration-150 group-hover:opacity-100 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                  </div>
                </div>

                {/* Optional Note Excerpt */}
                {day.hasNote && noteSnippet && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground/85">
                    <NotebookPen className="h-3.5 w-3.5 text-brand shrink-0 opacity-80" />
                    <span className="truncate italic font-normal tracking-tight">
                      "{noteSnippet.slice(0, 140)}"
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}

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
