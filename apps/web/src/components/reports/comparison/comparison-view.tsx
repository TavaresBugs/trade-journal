"use client";

import { useState } from "react";
import type { AnalysisFilters } from "@luxalgo/journal-core";
import { Scale, SlidersHorizontal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonetaryValue, usePrivacy } from "@/components/privacy";
import { ReviewExport } from "@/components/review-export";
import { useApi } from "@/lib/use-api";
import { describeFilters } from "@/lib/filter-description";
import { cn } from "@/lib/utils";
import {
  calculateComparisonDeltas,
  calculateOutperformingGroup,
  formatCohortMetricLines,
} from "@/lib/report-comparison";
import { type Analysis, money } from "../types";
import { CohortSummaryCard } from "./cohort-summary-card";
import { ComparisonDeltaTable } from "./comparison-delta-table";
import { CohortFilterDialog } from "./cohort-filter-dialog";

interface ComparisonViewProps {
  initial: AnalysisFilters;
}

export function ComparisonView({ initial }: ComparisonViewProps) {
  const privateMode = usePrivacy();
  const [a, setA] = useState<AnalysisFilters>({ ...initial, direction: "long" });
  const [b, setB] = useState<AnalysisFilters>({ ...initial, direction: "short" });
  const [nameA, setNameA] = useState("Long trades");
  const [nameB, setNameB] = useState("Short trades");
  const [editing, setEditing] = useState<"a" | "b" | null>(null);
  const [draft, setDraft] = useState<AnalysisFilters>({});

  const aa = useApi<Analysis>(`/api/analysis?${new URLSearchParams(a).toString()}`);
  const bb = useApi<Analysis>(`/api/analysis?${new URLSearchParams(b).toString()}`);

  const currencies = new Set([...(aa.data?.currencies ?? []), ...(bb.data?.currencies ?? [])]);
  const multi = currencies.size > 1;
  const sharedCurrency = [...currencies][0] ?? "USD";
  const sharedTimeZone = aa.data?.timeZone ?? bb.data?.timeZone ?? "UTC";

  // Head-to-head comparison calculations
  const sumA = aa.data?.summary;
  const sumB = bb.data?.summary;
  const hasBothData = sumA && sumB && !aa.loading && !bb.loading && !multi;

  const outperformingGroup = hasBothData
    ? calculateOutperformingGroup(sumA, sumB, nameA, nameB)
    : null;

  const deltas = hasBothData ? calculateComparisonDeltas(sumA, sumB) : null;

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Compare Groups</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Side-by-side performance contrast between custom filter sets, trading cohorts, or
            operational regimes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!multi && sharedCurrency && (
            <Badge variant="outline" className="text-xs font-normal">
              {sharedCurrency}
            </Badge>
          )}
          {sharedTimeZone && (
            <Badge variant="outline" className="text-xs font-normal">
              {sharedTimeZone}
            </Badge>
          )}
        </div>
      </div>

      {multi && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs leading-relaxed text-destructive"
        >
          Select accounts with the same currency in both groups. Currency conversion is not applied
          across differing currencies ({[...currencies].join(", ")}).
        </div>
      )}

      {/* Cohorts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            { key: "a", name: nameA, setName: setNameA, filters: a, result: aa },
            { key: "b", name: nameB, setName: setNameB, filters: b, result: bb },
          ] as const
        ).map((group) => (
          <Card key={group.key} className="overflow-hidden rounded-xl border">
            <CardHeader className="border-b bg-muted/10 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center rounded-lg px-3 font-mono text-xs font-bold tracking-wide uppercase shadow-xs",
                      group.key === "a"
                        ? "border border-primary/25 bg-primary/10 text-primary"
                        : "border border-purple-500/25 bg-purple-500/10 text-purple-400",
                    )}
                  >
                    Group {group.key.toUpperCase()}
                  </span>
                  <input
                    aria-label={`Group ${group.key.toUpperCase()} name`}
                    className="h-8 min-w-36 rounded-lg border bg-background px-3 text-sm font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={group.name}
                    onChange={(e) => group.setName(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-lg text-xs font-medium"
                  onClick={() => {
                    setDraft({ ...group.filters });
                    setEditing(group.key);
                  }}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Edit Filters</span>
                </Button>
              </div>
              <p className="mt-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground break-words">
                <span className="font-semibold text-foreground/80">Active filters: </span>
                {describeFilters(
                  group.filters,
                  group.result.data?.accounts,
                  group.result.data?.playbooks,
                  privateMode,
                )}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {group.result.error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  {group.result.error}
                </div>
              ) : group.result.loading ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <Skeleton className="h-32 rounded-xl sm:col-span-5" />
                    <Skeleton className="h-32 rounded-xl sm:col-span-7" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : group.result.data && !multi ? (
                <CohortSummaryCard data={group.result.data} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Head-to-Head Comparative Delta Panel */}
      {hasBothData && deltas && (
        <Card className="overflow-hidden rounded-xl border">
          <CardHeader className="border-b bg-muted/10 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Head-to-Head Delta ({nameB} vs {nameA})
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Statistical differential: positive values indicate {nameB} outperforms {nameA}.
                </p>
              </div>
              <ReviewExport
                containsFinancialData
                document={{
                  title: `${nameA} vs ${nameB}`,
                  subtitle: `${sharedTimeZone} · ${sharedCurrency}`,
                  lines: [
                    `Group A (${nameA}): ${describeFilters(a, aa.data!.accounts, aa.data!.playbooks)}`,
                    `Group B (${nameB}): ${describeFilters(b, bb.data!.accounts, bb.data!.playbooks)}`,
                    "",
                    ...formatCohortMetricLines(nameA, aa.data!),
                    "",
                    ...formatCohortMetricLines(nameB, bb.data!),
                  ],
                }}
              />
            </div>

            {/* Executive Edge Summary Banner */}
            {outperformingGroup && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Trophy className={cn("h-4 w-4 shrink-0", outperformingGroup.color)} />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{outperformingGroup.name}</span>{" "}
                    is leading by{" "}
                    <span className="font-mono font-bold text-profit">
                      <MonetaryValue>
                        +{money(outperformingGroup.pnlAdvantage, sharedCurrency)}
                      </MonetaryValue>
                    </span>
                    {outperformingGroup.winRateAdvantage !== 0 && (
                      <>
                        {" "}
                        with a{" "}
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            outperformingGroup.winRateAdvantage > 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {outperformingGroup.winRateAdvantage > 0 ? "+" : ""}
                          {(outperformingGroup.winRateAdvantage * 100).toFixed(1)}%
                        </span>{" "}
                        win rate delta
                      </>
                    )}
                    .
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider",
                    outperformingGroup.badgeBg,
                  )}
                >
                  Group {outperformingGroup.key.toUpperCase()} Edge
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ComparisonDeltaTable
              sumA={sumA}
              sumB={sumB}
              nameA={nameA}
              nameB={nameB}
              sharedCurrency={sharedCurrency}
              deltas={deltas}
            />
          </CardContent>
        </Card>
      )}

      {/* Filter Configuration Dialog */}
      <CohortFilterDialog
        open={editing !== null}
        editingGroup={editing}
        draft={draft}
        onDraftChange={setDraft}
        onClose={() => setEditing(null)}
        onApply={() => {
          if (editing === "a") setA(draft);
          else if (editing === "b") setB(draft);
          setEditing(null);
        }}
      />
    </div>
  );
}
