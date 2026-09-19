"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Coins,
  ExternalLink,
  History,
  LineChart,
  Minus,
  Percent,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { MIN_TREND_POINTS, type PerformanceTrendsResponse } from "@/lib/performance-trends";
import { useApi } from "@/lib/use-api";
import { cn, fmtPercent } from "@/lib/utils";
import { normalizeSymbol } from "@/lib/assets/asset-icons";
import { Pnl } from "./pnl";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { AssetIcon } from "./ui/asset-icon";
import { DirectionBadge } from "./ui/direction-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const RollingTradeChart = dynamic(
  () => import("./charts/rolling-trade-chart").then((module) => module.RollingTradeChart),
  {
    loading: () => (
      <div role="status" aria-label="Loading trend chart">
        <Skeleton className="h-60" />
      </div>
    ),
  },
);

const tradeHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function PerformanceTrendsReport({ query }: { query: string }) {
  const { data, loading, error, refresh } = useApi<PerformanceTrendsResponse>(
    `/api/performance-trends?${query}`,
  );
  const [tableOpen, setTableOpen] = useState(false);

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        timeZone: data?.timeZone ?? "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [data?.timeZone],
  );

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading performance trends"
        className="grid gap-4 md:grid-cols-2"
      >
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">
          {error ?? "Unable to load performance trends."}
        </p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  const { trends, timeZone, currencies } = data;
  const currency = currencies[0] ?? "USD";
  const monetary = currencies.length <= 1;
  const latest = trends.points.at(-1);
  const chartReady = trends.points.length >= MIN_TREND_POINTS;

  return (
    <section
      className="space-y-4"
      aria-labelledby="performance-trends-title"
      data-performance-trends
    >
      {/* Header Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            <h2 id="performance-trends-title" className="text-lg font-semibold tracking-tight">
              Performance Trends
            </h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Sequential rolling analysis (20-trade window) based on active account and filters in
            closing order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {trends.count} {trends.count === 1 ? "Closed Trade" : "Closed Trades"}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {timeZone}
          </Badge>
          {monetary && trends.count > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              {currency}
            </Badge>
          )}
        </div>
      </div>

      {trends.count === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="font-medium text-foreground">No closed trades in this selection</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Change the date range or filters to explore your trading history. Open positions are
              excluded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!monetary && (
            <div
              role="note"
              className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"
            >
              These trades use different currencies ({currencies.join(", ")}). Win rate is
              available; select accounts with one currency to compare P&L and largest trades. No
              currency conversion is applied.
            </div>
          )}

          {/* Rolling Trend Cards */}
          <div className={`grid items-start gap-4 ${monetary ? "lg:grid-cols-2" : ""}`}>
            {(["winRate", ...(monetary ? (["avgNetPnl"] as const) : [])] as const).map((metric) => {
              const rate = metric === "winRate";
              const reference = rate
                ? (trends.overallWinRate ?? 0)
                : (trends.overallAvgNetPnl ?? 0);
              const deltaRate = latest ? latest.winRate - reference : null;
              const deltaPnl = latest ? latest.avgNetPnl - reference : null;

              return (
                <Card key={metric} className="min-w-0 overflow-hidden rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {rate ? (
                        <Percent className="h-4 w-4 text-primary" />
                      ) : (
                        <Coins className="h-4 w-4 text-primary" />
                      )}
                      <CardTitle className="text-base font-semibold">
                        {rate
                          ? "Win-Rate Trend (Rolling 20)"
                          : "Average Trade P&L Trend (Rolling 20)"}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last 20 closed trades at each point ·{" "}
                      {rate ? "Breakevens included" : "Net after fees"}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Primary KPI & Period Benchmark */}
                    <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border bg-muted/20 p-3.5">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Latest Full Window
                        </p>
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <div className="text-2xl font-bold tracking-tight tabular-nums">
                            {latest ? (
                              rate ? (
                                fmtPercent(latest.winRate, 1)
                              ) : (
                                <Pnl value={latest.avgNetPnl} currency={currency} />
                              )
                            ) : (
                              "—"
                            )}
                          </div>

                          {/* Dynamic Benchmark Delta Badge */}
                          {latest &&
                            (rate
                              ? deltaRate != null &&
                                (deltaRate > 0.0005 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-profit/20 bg-profit/10 px-2 py-0.5 text-xs font-medium text-profit">
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                    <span>+{fmtPercent(Math.abs(deltaRate), 1)}</span>
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                ) : deltaRate < -0.0005 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-loss/20 bg-loss/10 px-2 py-0.5 text-xs font-medium text-loss">
                                    <ArrowDownRight className="h-3.5 w-3.5" />
                                    <span>-{fmtPercent(Math.abs(deltaRate), 1)}</span>
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/20 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    <Minus className="h-3.5 w-3.5" />
                                    <span>0.0%</span>
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                ))
                              : deltaPnl != null &&
                                (deltaPnl > 0.005 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-profit/20 bg-profit/10 px-2 py-0.5 text-xs font-medium">
                                    <ArrowUpRight className="h-3.5 w-3.5 text-profit" />
                                    <Pnl value={deltaPnl} currency={currency} />
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                ) : deltaPnl < -0.005 ? (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-loss/20 bg-loss/10 px-2 py-0.5 text-xs font-medium">
                                    <ArrowDownRight className="h-3.5 w-3.5 text-loss" />
                                    <Pnl value={deltaPnl} currency={currency} />
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/20 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    <Minus className="h-3.5 w-3.5" />
                                    <Pnl value={0} currency={currency} />
                                    <span className="font-normal text-muted-foreground">
                                      vs avg
                                    </span>
                                  </span>
                                )))}
                        </div>
                      </div>

                      <div className="space-y-1 text-right">
                        <p className="text-xs font-medium text-muted-foreground">
                          Selected-Period {rate ? "Win Rate" : "Average"}
                        </p>
                        <div className="text-sm font-semibold tabular-nums">
                          {rate ? (
                            fmtPercent(reference, 1)
                          ) : (
                            <Pnl value={reference} currency={currency} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Chart or Informative Progress Card */}
                    {chartReady ? (
                      <div className="space-y-2">
                        <RollingTradeChart
                          data={trends.points}
                          metric={metric}
                          reference={reference}
                          currency={currency}
                          timeZone={timeZone}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-0.5 w-4 rounded-full bg-primary" />
                              <span>20-Trade Rolling Window</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-0.5 w-4 rounded-full border-t border-dashed border-muted-foreground" />
                              <span>Selected-Period Average</span>
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/80">
                            Closed-Trade Sequence · {timeZone}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-dashed bg-muted/20 p-5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-foreground">
                            {!latest
                              ? "Progress to First Rolling Window"
                              : "Progress to Trend Line Chart"}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {!latest
                              ? `${trends.count} / 20 trades`
                              : `${trends.count} / 27 trades`}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((trends.count / (!latest ? 20 : 27)) * 100),
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {!latest
                            ? `${20 - trends.count} more closed ${20 - trends.count === 1 ? "trade is" : "trades are"} needed for the first full 20-trade window.`
                            : `Latest window available (${trends.count - 19} window${trends.count - 19 > 1 ? "s" : ""}). A line chart activates at 27 closed trades, providing 8 full windows to compare trend momentum.`}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Largest Winning and Losing Trade Section */}
          {monetary && (
            <Card className="min-w-0 rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Largest Winning & Losing Trade
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Individual closed executions after net fees · Uses your journal’s win/loss
                  classification
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {/* Largest Winner */}
                <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-profit/30 bg-profit/5 p-4 transition-all hover:border-profit/50 hover:shadow-sm">
                  <div className="flex items-center justify-between border-b border-profit/15 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-profit" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-profit">
                        Largest Winner
                      </span>
                    </div>
                    {trends.largestWin && (
                      <DirectionBadge direction={trends.largestWin.direction} size="xs" />
                    )}
                  </div>
                  {trends.largestWin ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Net P&L</p>
                        <div className="mt-0.5 text-2xl font-bold tracking-tight">
                          <Pnl value={trends.largestWin.netPnl} currency={currency} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-profit/15 pt-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <AssetIcon symbol={trends.largestWin.symbol} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            <span
                              className="truncate text-sm font-semibold text-foreground"
                              title={
                                trends.largestWin.symbol !==
                                normalizeSymbol(trends.largestWin.symbol)
                                  ? trends.largestWin.symbol
                                  : undefined
                              }
                            >
                              {normalizeSymbol(trends.largestWin.symbol)}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {dateFormat.format(new Date(trends.largestWin.closedAt))}
                            </span>
                          </div>
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 border-profit/30 text-xs font-medium hover:border-profit/50 hover:bg-profit/10"
                        >
                          <Link href={tradeHref(trends.largestWin.key)}>
                            <span>View Trade</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No winning trades in this selection.
                    </div>
                  )}
                </div>

                {/* Largest Loser */}
                <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-loss/30 bg-loss/5 p-4 transition-all hover:border-loss/50 hover:shadow-sm">
                  <div className="flex items-center justify-between border-b border-loss/15 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-loss" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-loss">
                        Largest Loser
                      </span>
                    </div>
                    {trends.largestLoss && (
                      <DirectionBadge direction={trends.largestLoss.direction} size="xs" />
                    )}
                  </div>
                  {trends.largestLoss ? (
                    <div className="mt-3 space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Net Drawdown</p>
                        <div className="mt-0.5 text-2xl font-bold tracking-tight">
                          <Pnl value={trends.largestLoss.netPnl} currency={currency} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-loss/15 pt-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <AssetIcon symbol={trends.largestLoss.symbol} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            <span
                              className="truncate text-sm font-semibold text-foreground"
                              title={
                                trends.largestLoss.symbol !==
                                normalizeSymbol(trends.largestLoss.symbol)
                                  ? trends.largestLoss.symbol
                                  : undefined
                              }
                            >
                              {normalizeSymbol(trends.largestLoss.symbol)}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {dateFormat.format(new Date(trends.largestLoss.closedAt))}
                            </span>
                          </div>
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5 border-loss/30 text-xs font-medium hover:border-loss/50 hover:bg-loss/10"
                        >
                          <Link href={tradeHref(trends.largestLoss.key)}>
                            <span>View Trade</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No losing trades in this selection.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expandable Windows Table Accordion */}
          {latest && (
            <div className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                onClick={() => setTableOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/40"
                aria-expanded={tableOpen}
              >
                <div className="flex items-center gap-2.5">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>Explore Window Values and Trades</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    {trends.points.length} {trends.points.length === 1 ? "window" : "windows"}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    tableOpen && "rotate-180",
                  )}
                />
              </button>
              {tableOpen && (
                <div className="border-t px-4 pb-4 pt-2">
                  <p className="pb-3 text-xs text-muted-foreground">
                    Each row covers 20 trades ending at the linked trade. Dates use {timeZone}.
                  </p>
                  <div className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2.5">Window / Closing Trade</TableHead>
                          <TableHead className="text-right">Win Rate</TableHead>
                          {monetary && <TableHead className="text-right">Avg Net P&L</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trends.points.map((point) => (
                          <TableRow key={point.key} className="hover:bg-muted/50">
                            <TableCell className="py-2.5">
                              <Link
                                href={tradeHref(point.key)}
                                className="group inline-flex items-center gap-2 text-xs font-medium underline-offset-4 hover:underline"
                              >
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                                  #{point.sequence - 19}–{point.sequence}
                                </span>
                                <span className="text-muted-foreground group-hover:text-foreground">
                                  {dateFormat.format(new Date(point.closedAt))}
                                </span>
                                <ExternalLink className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-100" />
                              </Link>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {fmtPercent(point.winRate, 1)}
                            </TableCell>
                            {monetary && (
                              <TableCell className="text-right font-mono text-xs tabular-nums">
                                <Pnl value={point.avgNetPnl} currency={currency} />
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footnote */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Only trades within your selection are used; earlier trades are not borrowed to fill a
            window. Rolling windows overlap and describe recent results—not a forecast. Small
            samples can change sharply.
          </p>
        </>
      )}
    </section>
  );
}
