"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { DIMENSIONS, type Dimension } from "@luxalgo/journal-core";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { ReviewExport } from "@/components/review-export";
import { AskJournal } from "@/components/ask-journal";
import { ReportOverview } from "@/components/report-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, LayoutGrid, TableProperties } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { describeFilters } from "@/lib/filter-description";
import { fmtDuration } from "@/lib/utils";
import {
  type Analysis,
  number,
  percent,
  labels,
  DimensionSelect,
  BreakdownTable,
  CrossMatrix,
  ComparisonView,
} from "@/components/reports";

const TradeExplorer = dynamic(
  () => import("@/components/trade-explorer").then((module) => module.TradeExplorer),
  {
    loading: () => (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Loading trade explorer…
      </p>
    ),
  },
);

const PerformanceTrendsReport = dynamic(
  () => import("@/components/performance-trends").then((module) => module.PerformanceTrendsReport),
  {
    loading: () => (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Loading performance trends…
      </p>
    ),
  },
);

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const { query, values } = useFilters();
  const [mode, setMode] = useState<
    "overview" | "trends" | "explorer" | "breakdown" | "cross" | "compare"
  >("overview");
  const [primary, setPrimary] = useState<Dimension>("symbol");
  const [secondary, setSecondary] = useState<Dimension>("weekday");

  const { data, error, loading } = useApi<Analysis>(
    mode === "breakdown" || mode === "cross"
      ? `/api/analysis?${query}&primary=${primary}${mode === "cross" ? `&secondary=${secondary}` : ""}`
      : null,
  );
  const multi = (data?.currencies.length ?? 0) > 1;

  return (
    <div>
      <FilterBar title="Reports" />
      <div className="space-y-4 p-4">
        <AskJournal />
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["overview", "Overview"],
              ["trends", "Performance trends"],
              ["explorer", "Trade explorer"],
              ["breakdown", "Breakdowns"],
              ["cross", "Cross-analysis"],
              ["compare", "Compare groups"],
            ] as const
          ).map(([key, name]) => (
            <Button
              key={key}
              size="sm"
              variant={mode === key ? "default" : "outline"}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {name}
            </Button>
          ))}
        </div>

        <div key={mode} className="journal-report-section space-y-4" data-report-section={mode}>
          {mode === "overview" ? (
            <ReportOverview query={query} filters={values} />
          ) : mode === "trends" ? (
            <PerformanceTrendsReport key={query} query={query} />
          ) : mode === "explorer" ? (
            <TradeExplorer key={query} query={query} />
          ) : mode === "compare" ? (
            <ComparisonView key={query} initial={values} />
          ) : (
            <>
              {/* Header Section */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold tracking-tight">
                      {mode === "cross" ? "Cross-Analysis Matrix" : "Performance Breakdowns"}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {mode === "cross"
                      ? "Two-dimensional matrix cross-referencing performance distributions across primary and secondary attributes."
                      : "Multi-dimensional performance segmentation and statistical breakdown based on active account and filters."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {data?.summary && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {data.summary.trades}{" "}
                      {data.summary.trades === 1 ? "Closed Trade" : "Closed Trades"}
                    </Badge>
                  )}
                  {data?.timeZone && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {data.timeZone}
                    </Badge>
                  )}
                  {data?.currencies[0] && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {data.currencies[0]}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Table / Cross Section */}
              {mode === "cross" ? (
                <div className="space-y-6">
                  {/* Card 1: 2D Distribution Heatmap Matrix */}
                  <Card className="overflow-hidden rounded-xl border">
                    <CardHeader className="border-b bg-muted/10 pb-3.5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
                          <CardTitle className="text-base font-semibold">
                            {DIMENSIONS[primary]} × {DIMENSIONS[secondary]} Matrix
                          </CardTitle>
                          {data && !multi && !loading && (
                            <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                              {data.groups.length} {data.groups.length === 1 ? "group" : "groups"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-36 sm:w-44">
                            <DimensionSelect
                              label="Group by"
                              value={primary}
                              onChange={setPrimary}
                            />
                          </div>
                          <div className="w-36 sm:w-44">
                            <DimensionSelect
                              label="Then by"
                              value={secondary}
                              onChange={setSecondary}
                            />
                          </div>
                          {data && !multi && !loading && (
                            <div className="pb-0.5">
                              <ReviewExport
                                containsFinancialData
                                document={{
                                  title: `${DIMENSIONS[primary]} by ${DIMENSIONS[secondary]}`,
                                  subtitle: `${data.timeZone} · ${data.currencies[0] ?? "Account currency"}`,
                                  lines: [
                                    `Filters: ${describeFilters(values, data.accounts, data.playbooks)}`,
                                    `Closed trades: ${data.summary.trades} | Net P&L: ${number(data.summary.netPnl)} | Win rate: ${percent(data.summary.winRate)}`,
                                    "",
                                    ...data.groups.map(
                                      (g) =>
                                        `${labels(data, g.row, primary)}${g.column ? ` / ${labels(data, g.column, secondary)}` : ""}: ${g.trades} trades | P&L ${number(g.netPnl)} | Win ${percent(g.winRate)} | Planned ${number(g.avgPlannedR)}R | Realized ${number(g.avgRealizedR)}R | Volume ${number(g.volume)} | Holding time ${fmtDuration(g.avgDurationMs)}`,
                                    ),
                                  ],
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {error ? (
                        <div className="p-6">
                          <div
                            role="alert"
                            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                          >
                            {error}
                          </div>
                        </div>
                      ) : loading ? (
                        <div className="space-y-3 p-6">
                          <div className="flex items-center justify-between pb-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-5 w-24" />
                          </div>
                          <Skeleton className="h-10 w-full rounded-lg" />
                          <Skeleton className="h-12 w-full rounded-lg" />
                          <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                      ) : multi ? (
                        <div className="p-6">
                          <p className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                            These accounts use different currencies ({data?.currencies.join(", ")}).
                            Select accounts with the same currency in Filters to compare monetary results.
                          </p>
                        </div>
                      ) : data ? (
                        <CrossMatrix
                          data={data}
                          primary={primary}
                          secondary={secondary}
                        />
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Card 2: Detailed Combination Breakdown Table */}
                  {data && !multi && !loading && data.groups.length > 0 && (
                    <Card className="overflow-hidden rounded-xl border">
                      <CardHeader className="border-b bg-muted/10 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TableProperties className="h-4 w-4 text-muted-foreground shrink-0" />
                            <CardTitle className="text-base font-semibold">
                              Detailed Metrics by Combination
                            </CardTitle>
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {data.groups.length} {data.groups.length === 1 ? "combination" : "combinations"}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <BreakdownTable
                          data={data}
                          cross={true}
                          primary={primary}
                          secondary={secondary}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                /* Breakdown mode: single card */
                <Card className="overflow-hidden rounded-xl border">
                  <CardHeader className="border-b bg-muted/10 pb-3.5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <CardTitle className="text-base font-semibold">
                          Performance by {DIMENSIONS[primary]}
                        </CardTitle>
                        {data && !multi && !loading && (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {data.groups.length} {data.groups.length === 1 ? "group" : "groups"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-36 sm:w-44">
                          <DimensionSelect label="Group by" value={primary} onChange={setPrimary} />
                        </div>
                        {data && !multi && !loading && (
                          <div className="pb-0.5">
                            <ReviewExport
                              containsFinancialData
                              document={{
                                title: `${DIMENSIONS[primary]} Performance`,
                                subtitle: `${data.timeZone} · ${data.currencies[0] ?? "Account currency"}`,
                                lines: [
                                  `Filters: ${describeFilters(values, data.accounts, data.playbooks)}`,
                                  `Closed trades: ${data.summary.trades} | Net P&L: ${number(data.summary.netPnl)} | Win rate: ${percent(data.summary.winRate)}`,
                                  "",
                                  ...data.groups.map(
                                    (g) =>
                                      `${labels(data, g.row, primary)}: ${g.trades} trades | P&L ${number(g.netPnl)} | Win ${percent(g.winRate)} | Planned ${number(g.avgPlannedR)}R | Realized ${number(g.avgRealizedR)}R | Volume ${number(g.volume)} | Holding time ${fmtDuration(g.avgDurationMs)}`,
                                  ),
                                ],
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {error ? (
                      <div className="p-6">
                        <div
                          role="alert"
                          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                        >
                          {error}
                        </div>
                      </div>
                    ) : loading ? (
                      <div className="space-y-3 p-6">
                        <div className="flex items-center justify-between pb-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                      </div>
                    ) : multi ? (
                      <div className="p-6">
                        <p className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                          These accounts use different currencies ({data?.currencies.join(", ")}).
                          Select accounts with the same currency in Filters to compare monetary results.
                        </p>
                      </div>
                    ) : data ? (
                      <BreakdownTable
                        data={data}
                        cross={false}
                        primary={primary}
                        secondary={secondary}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Closed trades only. Dates use the closing day; weekday and entry time use the
                opening time in {data?.timeZone ?? "your journal timezone"}. Volume is total entry
                quantity. R uses weighted entry and total entry quantity; missing or invalid risk
                inputs are excluded from R averages. Derivatives require a configured multiplier for
                realized R. Multiple tags or mistakes can place a trade in more than one group, so
                those group totals can overlap.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
