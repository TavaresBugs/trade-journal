"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { HoverHint } from "@/components/ui/tooltip";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import {
  DIMENSIONS,
  type Dimension,
  type AnalysisFilters,
  type GroupSummary,
} from "@luxalgo/journal-core";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { FilterFields, Field, fieldClass } from "@/components/filter-fields";
import { ReviewExport } from "@/components/review-export";
import { AskJournal } from "@/components/ask-journal";
import { ReportOverview } from "@/components/report-overview";
import { MonetaryValue, usePrivacy } from "@/components/privacy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DirectionBadge } from "@/components/ui/direction-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { describeFilters } from "@/lib/filter-description";
import { cn, fmtDuration } from "@/lib/utils";
import { AssetIcon } from "@/components/ui/asset-icon";
import { normalizeSymbol } from "@/lib/assets/asset-icons";
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
interface Group extends GroupSummary {
  row: string;
  column: string;
}
interface Analysis {
  accounts: { id: string; name: string }[];
  summary: GroupSummary;
  groups: Group[];
  playbooks: { id: string; name: string }[];
  currencies: string[];
  timeZone: string;
}
const number = (n: number | null) =>
  n === null ? "-" : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const percent = (n: number | null) => (n === null ? "-" : `${(n * 100).toFixed(1)}%`);
const money = (n: number, currency: string) => `${number(n)} ${currency}`;
function Summary({ data }: { data: Analysis }) {
  const s = data.summary;
  const currency = data.currencies[0] ?? "USD";
  const items = [
    {
      label: "Closed Trades",
      value: String(s.trades),
    },
    {
      label: "Net P&L",
      value: money(s.netPnl, currency),
      isPnl: true,
      rawPnl: s.netPnl,
    },
    {
      label: "Win Rate",
      value: percent(s.winRate),
      winRate: s.winRate,
    },
    {
      label: "Profit Factor",
      value: s.noLosses ? "∞" : number(s.profitFactor),
      isProfitFactor: true,
      rawPf: s.profitFactor,
    },
    {
      label: "Entry Volume",
      value: number(s.volume),
    },
    {
      label: "Avg Holding Time",
      value: fmtDuration(s.avgDurationMs),
    },
    {
      label: "Avg Planned R",
      value: s.avgPlannedR !== null ? `${number(s.avgPlannedR)}R` : "–",
    },
    {
      label: "Avg Realized R",
      value:
        s.avgRealizedR !== null
          ? `${s.avgRealizedR > 0 ? "+" : ""}${number(s.avgRealizedR)}R`
          : "–",
      isR: true,
      rawR: s.avgRealizedR,
    },
  ];

  return (
    <div className="report-summary">
      <div className="report-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border bg-card/60 p-3.5 shadow-xs transition-all hover:border-border/80"
          >
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "mt-1.5 font-mono text-base font-bold tabular-nums tracking-tight sm:text-lg",
                item.isPnl &&
                  (item.rawPnl > 0
                    ? "text-profit"
                    : item.rawPnl < 0
                      ? "text-loss"
                      : "text-foreground"),
                item.isR &&
                  (item.rawR !== null && item.rawR > 0
                    ? "text-profit"
                    : item.rawR !== null && item.rawR < 0
                      ? "text-loss"
                      : "text-foreground"),
                item.isProfitFactor &&
                  (item.rawPf !== null && item.rawPf >= 1.5
                    ? "text-profit"
                    : item.rawPf !== null && item.rawPf < 1
                      ? "text-loss"
                      : "text-foreground"),
              )}
            >
              {item.isPnl ? <MonetaryValue>{item.value}</MonetaryValue> : item.value}
            </p>
            {item.winRate !== undefined && item.winRate !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    item.winRate >= 0.5 ? "bg-profit" : "bg-loss/80",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, item.winRate * 100))}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function DimensionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Dimension;
  onChange: (d: Dimension) => void;
}) {
  return (
    <Field label={label}>
      <OptionSelect
        className={fieldClass}
        value={value}
        onValueChange={(next) => onChange(next as Dimension)}
      >
        {Object.entries(DIMENSIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </OptionSelect>
    </Field>
  );
}
const labels = (data: Analysis, key: string, dimension?: Dimension) =>
  data.playbooks.find((p) => p.id === key)?.name ??
  (dimension === "symbol" ? normalizeSymbol(key) : key);
function GroupLabel({ dimension, children }: { dimension: Dimension; children: string }) {
  if (dimension === "symbol") {
    const canonical = normalizeSymbol(children);
    return (
      <span
        className="inline-flex items-center gap-2 font-medium"
        title={children !== canonical ? `Contract: ${children}` : undefined}
      >
        <AssetIcon symbol={children} size="xs" />
        <span className="font-semibold text-foreground">{canonical || children}</span>
      </span>
    );
  }
  if (dimension === "direction") {
    return <DirectionBadge direction={children} size="xs" />;
  }
  if (dimension === "outcome") {
    const isWin = children.toLowerCase() === "win";
    const isLoss = children.toLowerCase() === "loss";
    return (
      <Badge
        variant={isWin ? "profit" : isLoss ? "loss" : "outline"}
        className="text-[11px] font-semibold uppercase tracking-wider"
      >
        {children}
      </Badge>
    );
  }
  return dimension === "entryPrice" || dimension === "exitPrice" ? (
    <MonetaryValue>{children}</MonetaryValue>
  ) : (
    children
  );
}
function Breakdown({
  data,
  cross,
  primary,
  secondary,
}: {
  data: Analysis;
  cross: boolean;
  primary: Dimension;
  secondary: Dimension;
}) {
  const rowLabel = (k: string) =>
      primary === "playbook"
        ? labels(data, k, primary)
        : primary === "symbol"
          ? normalizeSymbol(k)
          : k,
    colLabel = (k: string) =>
      secondary === "playbook"
        ? labels(data, k, secondary)
        : secondary === "symbol"
          ? normalizeSymbol(k)
          : k;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rows = [...new Set(data.groups.map((g) => g.row))],
    columns = [...new Set(data.groups.map((g) => g.column))].sort((a, b) =>
      secondary === "weekday"
        ? weekdays.indexOf(a) - weekdays.indexOf(b)
        : a.localeCompare(b, undefined, { numeric: true }),
    );
  if (primary === "weekday") rows.sort((a, b) => weekdays.indexOf(a) - weekdays.indexOf(b));
  const max = data.groups.reduce((max, g) => Math.max(max, Math.abs(g.netPnl)), 1);
  const cells = new Map(data.groups.map((g) => [JSON.stringify([g.row, g.column]), g]));
  const currency = data.currencies[0] ?? "USD";

  return (
    <div className="space-y-4">
      {cross && rows.length > 0 && (
        <div className="border-b p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-3 text-left font-semibold text-foreground">
                    {DIMENSIONS[primary]} / {DIMENSIONS[secondary]}
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="min-w-24 p-2 text-center font-medium text-muted-foreground"
                    >
                      <GroupLabel dimension={secondary}>{colLabel(c)}</GroupLabel>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r} className="border-t border-border/40">
                    <th className="p-3 text-left font-medium text-foreground">
                      <GroupLabel dimension={primary}>{rowLabel(r)}</GroupLabel>
                    </th>
                    {columns.map((c) => {
                      const g = cells.get(JSON.stringify([r, c]));
                      return (
                        <HoverHint
                          key={c}
                          content={
                            g
                              ? `${g.trades} trades · Win rate ${percent(g.winRate)}`
                              : "No trades"
                          }
                        >
                          <td
                            className="border border-background/60 p-2.5 text-center font-mono text-xs tabular-nums transition-colors hover:ring-1 hover:ring-primary/50"
                            style={{
                              background: g
                                ? `color-mix(in srgb, ${g.netPnl >= 0 ? "var(--profit-fill)" : "var(--loss)"} ${8 + (Math.abs(g.netPnl) / max) * 35}%, transparent)`
                                : undefined,
                            }}
                            tabIndex={0}
                          >
                            {g ? <MonetaryValue>{number(g.netPnl)}</MonetaryValue> : "–"}
                          </td>
                        </HoverHint>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Cell values are net P&L in {currency}.
            </p>
          </div>
        </div>
      )}
      {data.groups.length > 0 ? (
        <div className="p-4">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-2.5">{DIMENSIONS[primary]}</TableHead>
                {cross && <TableHead className="py-2.5">{DIMENSIONS[secondary]}</TableHead>}
                <TableHead className="py-2.5 text-center">Trades</TableHead>
                <TableHead className="py-2.5 text-center">Win Rate</TableHead>
                <TableHead className="px-3 text-right">Net P&L</TableHead>
                <TableHead className="px-3 text-right">Volume</TableHead>
                <TableHead className="px-3 text-right">Avg Planned R</TableHead>
                <TableHead className="px-3 text-right">Avg Realized R</TableHead>
                <TableHead className="px-3 text-right">Avg Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.groups.map((g) => (
                <TableRow
                  key={JSON.stringify([g.row, g.column])}
                  className="transition-colors hover:bg-muted/40"
                >
                  <TableCell className="py-2.5 font-medium">
                    <GroupLabel dimension={primary}>{rowLabel(g.row)}</GroupLabel>
                  </TableCell>
                  {cross && (
                    <TableCell className="py-2.5">
                      <GroupLabel dimension={secondary}>{colLabel(g.column)}</GroupLabel>
                    </TableCell>
                  )}
                  <TableCell className="py-2.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {g.trades}
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      {g.winRate !== null ? (
                        <div
                          className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-muted/60 sm:block"
                          title={`Win rate: ${percent(g.winRate)}`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              g.winRate >= 0.5 ? "bg-profit" : "bg-loss/80",
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, g.winRate * 100))}%`,
                            }}
                          />
                        </div>
                      ) : null}
                      <span
                        className={cn(
                          "font-mono text-xs font-medium tabular-nums",
                          g.winRate !== null && g.winRate >= 0.5
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {percent(g.winRate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 text-right font-mono text-xs tabular-nums font-semibold">
                    <span
                      className={
                        g.netPnl > 0
                          ? "text-profit"
                          : g.netPnl < 0
                            ? "text-loss"
                            : "text-muted-foreground"
                      }
                    >
                      <MonetaryValue>{money(g.netPnl, currency)}</MonetaryValue>
                    </span>
                  </TableCell>
                  <TableCell className="px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {number(g.volume)}
                  </TableCell>
                  <TableCell className="px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {g.avgPlannedR !== null ? `${number(g.avgPlannedR)}R` : "–"}
                  </TableCell>
                  <TableCell className="px-3 text-right font-mono text-xs tabular-nums font-medium">
                    {g.avgRealizedR !== null ? (
                      <span
                        className={
                          g.avgRealizedR > 0
                            ? "text-profit"
                            : g.avgRealizedR < 0
                              ? "text-loss"
                              : "text-muted-foreground"
                        }
                      >
                        {g.avgRealizedR > 0 ? "+" : ""}
                        {number(g.avgRealizedR)}R
                      </span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtDuration(g.avgDurationMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No closed trades match these filters.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust your filters or date range to see breakdown statistics.
          </p>
        </div>
      )}
    </div>
  );
}
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
    >("overview"),
    [primary, setPrimary] = useState<Dimension>("symbol"),
    [secondary, setSecondary] = useState<Dimension>("weekday");
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
            <Comparison key={query} initial={values} />
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

              {/* Controls & Summary Card */}
              <Card className="overflow-hidden rounded-xl border">
                <CardHeader className="border-b bg-muted/10 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <DimensionSelect label="Group by" value={primary} onChange={setPrimary} />
                      {mode === "cross" && (
                        <DimensionSelect
                          label="Then by"
                          value={secondary}
                          onChange={setSecondary}
                        />
                      )}
                    </div>
                    {data && !multi && (
                      <ReviewExport
                        containsFinancialData
                        document={{
                          title:
                            mode === "cross"
                              ? `${DIMENSIONS[primary]} by ${DIMENSIONS[secondary]}`
                              : `${DIMENSIONS[primary]} Performance`,
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
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  ) : loading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                      ))}
                    </div>
                  ) : multi ? (
                    <p className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                      These accounts use different currencies ({data?.currencies.join(", ")}).
                      Select accounts with the same currency in Filters to compare monetary results.
                    </p>
                  ) : data ? (
                    <Summary data={data} />
                  ) : null}
                </CardContent>
              </Card>

              {/* Table Card */}
              {data && !multi && !loading && (
                <Card className="overflow-hidden rounded-xl border">
                  <CardHeader className="border-b bg-muted/10 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {mode === "cross"
                          ? `${DIMENSIONS[primary]} × ${DIMENSIONS[secondary]}`
                          : `Performance by ${DIMENSIONS[primary]}`}
                      </CardTitle>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {data.groups.length} {data.groups.length === 1 ? "group" : "groups"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Breakdown
                      data={data}
                      cross={mode === "cross"}
                      primary={primary}
                      secondary={secondary}
                    />
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
function Comparison({ initial }: { initial: AnalysisFilters }) {
  const privateMode = usePrivacy();
  const [a, setA] = useState<AnalysisFilters>({ ...initial, direction: "long" }),
    [b, setB] = useState<AnalysisFilters>({ ...initial, direction: "short" }),
    [nameA, setNameA] = useState("Long trades"),
    [nameB, setNameB] = useState("Short trades"),
    [editing, setEditing] = useState<"a" | "b" | null>(null),
    [draft, setDraft] = useState<AnalysisFilters>({});
  const aa = useApi<Analysis>(`/api/analysis?${new URLSearchParams(a).toString()}`),
    bb = useApi<Analysis>(`/api/analysis?${new URLSearchParams(b).toString()}`);
  const currencies = new Set([...(aa.data?.currencies ?? []), ...(bb.data?.currencies ?? [])]),
    multi = currencies.size > 1;
  const metricLines = (name: string, d: Analysis) => [
    name,
    `Trades: ${d.summary.trades} | P&L: ${number(d.summary.netPnl)} ${d.currencies[0] ?? ""}`,
    `Win rate: ${percent(d.summary.winRate)} | Planned R: ${number(d.summary.avgPlannedR)} | Realized R: ${number(d.summary.avgRealizedR)}`,
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Each group has its own filters. Compare strategies, accounts, periods, or trade
        characteristics. Groups may overlap.
      </p>
      {multi && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          Select accounts with the same currency in both groups. Currency conversion is not applied.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            { key: "a", name: nameA, setName: setNameA, filters: a, result: aa },
            { key: "b", name: nameB, setName: setNameB, filters: b, result: bb },
          ] as const
        ).map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  aria-label={`Group ${group.key.toUpperCase()} name`}
                  className={`${fieldClass} min-w-32 flex-1 font-semibold`}
                  value={group.name}
                  onChange={(e) => group.setName(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft({ ...group.filters });
                    setEditing(group.key);
                  }}
                >
                  Edit filters
                </Button>
              </div>
              <p className="text-xs text-muted-foreground break-words">
                {describeFilters(
                  group.filters,
                  group.result.data?.accounts,
                  group.result.data?.playbooks,
                  privateMode,
                )}
              </p>
            </CardHeader>
            <CardContent>
              {group.result.error ? (
                <p role="alert" className="text-destructive">
                  {group.result.error}
                </p>
              ) : group.result.loading ? (
                <p>Loading…</p>
              ) : group.result.data && !multi ? (
                <Summary data={group.result.data} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {aa.data && bb.data && !aa.loading && !bb.loading && !multi && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <p className="text-sm">
              {nameB} minus {nameA}:{" "}
              <strong>
                <MonetaryValue>
                  {money(
                    bb.data.summary.netPnl - aa.data.summary.netPnl,
                    [...currencies][0] ?? "USD",
                  )}
                </MonetaryValue>
              </strong>{" "}
              net P&L · {number(bb.data.summary.trades - aa.data.summary.trades)} trades
            </p>
            <ReviewExport
              containsFinancialData
              document={{
                title: `${nameA} vs ${nameB}`,
                lines: [
                  `Group A: ${describeFilters(a, aa.data.accounts, aa.data.playbooks)}`,
                  `Group B: ${describeFilters(b, bb.data.accounts, bb.data.playbooks)}`,
                  "",
                  ...metricLines(nameA, aa.data),
                  "",
                  ...metricLines(nameB, bb.data),
                ],
              }}
            />
          </CardContent>
        </Card>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Group {editing?.toUpperCase()} filters</DialogTitle>
          </DialogHeader>
          <FilterFields value={draft} onChange={setDraft} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setDraft({})}>
              Clear
            </Button>
            <Button
              onClick={() => {
                if (editing === "a") setA(draft);
                else setB(draft);
                setEditing(null);
              }}
            >
              Apply to group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
