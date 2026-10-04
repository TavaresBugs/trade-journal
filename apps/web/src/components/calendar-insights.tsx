"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { DayStats } from "@luxalgo/journal-core";
import { DailyBreakdownList, BestWorstDayRow } from "./calendar-daily-breakdown";
import { calendarTradeHref, type CalendarResponse } from "@/lib/calendar-insights";
import { cn, fmtMoney, fmtPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { HelpHint, HoverHint } from "./ui/tooltip";
import { Pnl } from "./pnl";
import { usePrivacy } from "./privacy";
import { StatGaugeCard, StatRatioCard } from "./widgets";
import { DitherDivergingBar } from "./dither-kit";
// Keep the calendar and summaries usable before the plotting bundle loads.
const CalendarDailyChart = dynamic(
  () => import("./charts/calendar-daily-chart").then((module) => module.CalendarDailyChart),
  {
    loading: () => (
      <div
        role="status"
        aria-label="Loading daily performance chart"
        className="h-60 rounded-lg bg-muted/20"
      />
    ),
  },
);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateLabel = (date: string) => dateFormatter.format(new Date(`${date}T12:00:00Z`));

function Metric({
  title,
  value,
  detail,
  hint,
  className,
}: {
  title: string;
  value: ReactNode;
  detail: ReactNode;
  hint: string;
  className?: string;
}) {
  return (
    <Card className={cn("dashboard-visual-card", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <HelpHint heading={title}>{hint}</HelpHint>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

export function CalendarPerformance({ data, query }: { data: CalendarResponse; query: string }) {
  const { insights: i, scope, timeZone, currencies } = data;
  const currency = currencies[0] ?? "USD";
  const mixed = currencies.length > 1;
  const privateMode = usePrivacy();
  const router = useRouter();
  const [weekday, setWeekday] = useState<number | null>(null);
  const tradeHref = (date?: string) => calendarTradeHref(query, scope, date);
  const reviewHref = (date: string) => `/journal/${date}${query ? `?${query}` : ""}`;
  const money = (value: number | null) =>
    value === null || mixed ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <Pnl value={value} currency={currency} />
    );
  const selected = weekday === null ? null : i.weekdays[weekday]!;
  const peak = Math.max(1, ...i.weekdays.map((day) => Math.abs(day.netPnl)));
  return (
    <section
      aria-labelledby="calendar-insights-heading"
      className="space-y-3"
      data-calendar-insights
    >
      <div className="flex flex-wrap items-end justify-between gap-2 pt-3">
        <div>
          <h2 id="calendar-insights-heading" className="text-base font-semibold tracking-tight">
            Performance insights
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Visible month × active filters · Closed trades, after fees · {timeZone}
          </p>
        </div>
        {i.trades > 0 && (
          <Link
            href={tradeHref()}
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            View matching trades <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </div>
      {!i.tradingDays ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays aria-hidden="true" className="mb-1 size-6 text-muted-foreground" />
            <h3 className="text-sm font-medium">No closed trades in this view</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Choose another month or adjust your account and filters. Open positions and days
              without trades aren’t included in performance insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {mixed && (
            <p
              role="status"
              className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            >
              These trades use {currencies.join(", ")}. Select accounts with one currency to compare
              monetary performance; no exchange-rate conversion is applied.
            </p>
          )}
          <div className="grid gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Net P&L"
              value={money(i.netPnl)}
              detail={`${i.tradingDays} trading day${i.tradingDays === 1 ? "" : "s"}${mixed ? "" : ` · ${currency}`}`}
              hint="Sum of net P&L for closed trades in this month and filter selection. Includes fees. No currency conversion."
            />
            <Metric
              title="Average daily P&L"
              value={money(i.avgDailyPnl)}
              detail="Per day with closed trades"
              hint="Net P&L divided by trading days. Days without closed trades are excluded; break-even trading days are included."
            />
            <StatGaugeCard
              title="Trade win rate"
              hint="Winning closed trades divided by all closed trades, including break-even trades. Uses your journal's configured break-even rule."
              value={i.winRate}
              details={[
                { label: "W", value: i.wins },
                { label: "BE", value: i.breakevens },
                { label: "L", value: i.losses },
              ]}
            />
            <Metric
              title="Total closed trades"
              value={
                <Link
                  className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  href={tradeHref()}
                >
                  {i.trades}
                </Link>
              }
              detail="Round-trip trades, not executions"
              hint="Counts completed trades whose closing day falls in the visible month and selected date range, with all other filters applied."
            />
          </div>
          {!mixed && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="dashboard-visual-card">
                  <CardHeader>
                    <CardTitle>Best & worst day</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <BestWorstDayRow
                      label="Best day"
                      day={i.bestDay}
                      type="best"
                      mixed={mixed}
                      currency={currency}
                      href={reviewHref}
                      dateLabel={dateLabel}
                    />
                    <BestWorstDayRow
                      label="Worst day"
                      day={i.worstDay}
                      type="worst"
                      mixed={mixed}
                      currency={currency}
                      href={reviewHref}
                      dateLabel={dateLabel}
                    />
                    <p className="pt-1 text-xs text-muted-foreground">
                      {i.tradingDays === 1
                        ? "One trading day; both extrema are the same."
                        : "Highest and lowest daily net P&L."}
                    </p>
                  </CardContent>
                </Card>
                <StatRatioCard
                  title="Average green & red day"
                  hint="Average daily net P&L on green days vs red days. Each average uses only its own group."
                  win={{
                    value: i.avgGreenDay,
                    label: "profitable days",
                    count: i.greenDays,
                  }}
                  loss={{
                    value: i.avgRedDay,
                    label: "losing days",
                    count: i.redDays,
                  }}
                  currency={currency}
                  detailText="Each average uses only its own group."
                />
                <StatGaugeCard
                  title="Day consistency"
                  hint="Share of trading days with strictly positive net P&L. This is a profitable-day rate, not a risk-adjusted score or a prediction. Flat days stay in the denominator."
                  value={i.profitableDayRate}
                  details={[
                    { label: "positive", value: i.greenDays, color: "profit" },
                    { label: "negative", value: i.redDays, color: "loss" },
                    ...(i.flatDays > 0 ? [{ label: "flat", value: i.flatDays }] : []),
                  ]}
                />
              </div>
              <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <Card className="dashboard-visual-card">
                  <CardHeader>
                    <h3 className="text-sm font-medium">Daily performance</h3>
                    <p className="text-xs text-muted-foreground">
                      Net P&L by closing day · {currency}
                      {i.tradingDays >= 8 ? " · Dashed line: 5-trading-day average" : ""}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {i.tradingDays >= 2 ? (
                      <CalendarDailyChart
                        data={i.trend}
                        currency={currency}
                        onInspect={(date) => router.push(reviewHref(date))}
                      />
                    ) : (
                      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-muted/30 p-5 text-center">
                        <span className="text-sm font-medium">A trend needs more than one day</span>
                        <span className="text-xs text-muted-foreground">
                          {dateLabel(i.days[0]!.date)} · {money(i.netPnl)} · {i.trades} closed
                          trades
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Explore an earlier month with more trading history.
                        </span>
                      </div>
                    )}
                    <DailyBreakdownList
                      days={i.days}
                      currency={currency}
                      reviewHref={reviewHref}
                      allTradesHref={tradeHref()}
                      dateLabel={dateLabel}
                    />
                  </CardContent>
                </Card>
                <Card className="dashboard-visual-card">
                  <CardHeader>
                    <h3 className="text-sm font-medium">Performance by weekday</h3>
                    <p className="text-xs text-muted-foreground">
                      Closing-day net P&L · {currency} · Select a row
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">
                        Most profitable weekday
                      </div>
                      <div className="mt-0.5 flex flex-wrap justify-between gap-1 text-sm font-medium">
                        {i.mostProfitableWeekday ? (
                          <>
                            <span>{i.mostProfitableWeekday.label}</span>
                            {money(i.mostProfitableWeekday.netPnl)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">No profitable weekday yet</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {i.weekdays.map((day) => (
                        <HoverHint
                          key={day.index}
                          heading={day.label}
                          content={`${day.days.length} trading days · ${day.trades} closed trades · ${privateMode ? "P&L hidden" : fmtMoney(day.netPnl, currency)}`}
                        >
                          <button
                            type="button"
                            disabled={!day.trades}
                            onClick={() => setWeekday(weekday === day.index ? null : day.index)}
                            aria-pressed={weekday === day.index}
                            aria-label={`${day.label}: ${day.trades} trades${privateMode ? "" : `, ${fmtMoney(day.netPnl, currency)}`}. Inspect closing days.`}
                            className={cn(
                              "grid w-full grid-cols-[2rem_minmax(0,1fr)_5.75rem] items-center gap-2 rounded-md px-2 py-2 text-left text-xs outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent",
                              weekday === day.index && "bg-accent",
                            )}
                          >
                            <span>{day.label.slice(0, 3)}</span>
                            <span aria-hidden="true" className="flex items-center w-full">
                              <DitherDivergingBar
                                value={day.trades ? day.netPnl : 0}
                                maxAbs={peak}
                                height={8}
                                bloom="low"
                              />
                            </span>
                            <span className="text-right">
                              {day.trades ? money(day.netPnl) : "—"}
                            </span>
                          </button>
                        </HoverHint>
                      ))}
                    </div>
                    {selected && (
                      <div className="mt-3 border-t pt-3" aria-live="polite">
                        <p className="mb-2 text-xs font-medium">
                          {selected.label} · {selected.trades} trades across {selected.days.length}{" "}
                          days
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selected.days.map((day) => (
                            <Link
                              key={day.date}
                              href={reviewHref(day.date)}
                              className="rounded-md border px-2 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {dateLabel(day.date)}{" "}
                              <span className="text-muted-foreground">· {day.trades} trades</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              {i.tradingDays < 5 && (
                <p className="px-1 text-xs text-muted-foreground">
                  Small sample: {i.tradingDays} trading day{i.tradingDays === 1 ? "" : "s"}. Weekday
                  results and consistency describe this selection only.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
