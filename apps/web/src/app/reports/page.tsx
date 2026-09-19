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
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Clock,
  DollarSign,
  Hash,
  Scale,
  SlidersHorizontal,
  Trophy,
  Zap,
} from "lucide-react";
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
function HalfDonutGauge({
  winRate,
  trades,
}: {
  winRate: number | null;
  trades: number;
}) {
  const safeRate =
    winRate !== null && Number.isFinite(winRate) ? Math.max(0, Math.min(1, winRate)) : 0;
  const wins = Math.round(safeRate * trades);
  const losses = Math.max(0, trades - wins);
  const winPct = (safeRate * 100).toFixed(1);
  const lossPct = ((1 - safeRate) * 100).toFixed(1);

  // Semicircle parameters
  // Center: (70, 68), Radius: 54
  // Start: (16, 68), End: (124, 68)
  // Arc length = PI * 54 ≈ 169.65
  const arcLength = 169.65;
  const filledLength = trades > 0 && winRate !== null ? safeRate * arcLength : 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-24 w-40 sm:h-28 sm:w-44">
        <svg viewBox="0 0 140 82" className="h-full w-full overflow-visible">
          {/* Base Track */}
          <path
            d="M 16 68 A 54 54 0 0 1 124 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-muted/20"
          />
          {/* Loss Arc (underneath full span when trades > 0) */}
          {trades > 0 && (
            <path
              d="M 16 68 A 54 54 0 0 1 124 68"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              className="text-loss/35"
            />
          )}
          {/* Win Arc (drawn from left to right) */}
          {trades > 0 && filledLength > 0 && (
            <path
              d="M 16 68 A 54 54 0 0 1 124 68"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} 300`}
              className="text-profit transition-all duration-700 ease-out"
            />
          )}
          {/* Centered Percentage */}
          <text
            x="70"
            y="56"
            textAnchor="middle"
            className="fill-foreground font-mono text-2xl font-bold tracking-tight"
          >
            {trades > 0 && winRate !== null ? `${winPct}%` : "–"}
          </text>
          <text
            x="70"
            y="70"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
          >
            Win Rate
          </text>
        </svg>
      </div>
      {/* Footer Pill: W/L distribution */}
      <div className="mt-1 flex items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-profit">
          <span className="h-1.5 w-1.5 rounded-full bg-profit" />
          {wins}W ({winPct}%)
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-loss">
          <span className="h-1.5 w-1.5 rounded-full bg-loss" />
          {losses}L ({lossPct}%)
        </span>
      </div>
    </div>
  );
}

function CohortSummary({ data }: { data: Analysis }) {
  const s = data.summary;
  const currency = data.currencies[0] ?? "USD";

  return (
    <div className="space-y-3.5">
      {/* Top Hero: Meia Pizza + Primary Edge Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        {/* Meia Pizza Gauge Card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-card/60 p-4 shadow-xs sm:col-span-5">
          <HalfDonutGauge winRate={s.winRate} trades={s.trades} />
        </div>

        {/* Primary Edge Spotlight (Net P&L, Profit Factor, Realized R) */}
        <div className="grid grid-cols-1 gap-2.5 sm:col-span-7">
          {/* Net P&L Card */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Net P&L</p>
                <p
                  className={cn(
                    "font-mono text-lg font-bold tabular-nums tracking-tight sm:text-xl",
                    s.netPnl > 0
                      ? "text-profit"
                      : s.netPnl < 0
                        ? "text-loss"
                        : "text-foreground",
                  )}
                >
                  <MonetaryValue>{money(s.netPnl, currency)}</MonetaryValue>
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-xs font-medium",
                s.netPnl > 0
                  ? "border-profit/30 bg-profit/10 text-profit"
                  : s.netPnl < 0
                    ? "border-loss/30 bg-loss/10 text-loss"
                    : "text-muted-foreground",
              )}
            >
              {s.netPnl > 0 ? "Profitable" : s.netPnl < 0 ? "Drawdown" : "Neutral"}
            </Badge>
          </div>

          {/* Profit Factor & Realized R Twin Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Scale className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Profit Factor</span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-base font-bold tabular-nums tracking-tight",
                  s.profitFactor !== null && s.profitFactor >= 1.5
                    ? "text-profit"
                    : s.profitFactor !== null && s.profitFactor < 1
                      ? "text-loss"
                      : "text-foreground",
                )}
              >
                {s.noLosses ? "∞" : number(s.profitFactor)}
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium">Avg Realized R</span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-base font-bold tabular-nums tracking-tight",
                  s.avgRealizedR !== null && s.avgRealizedR > 0
                    ? "text-profit"
                    : s.avgRealizedR !== null && s.avgRealizedR < 0
                      ? "text-loss"
                      : "text-foreground",
                )}
              >
                {s.avgRealizedR !== null
                  ? `${s.avgRealizedR > 0 ? "+" : ""}${number(s.avgRealizedR)}R`
                  : "–"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Closed Trades</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {s.trades}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-medium">Entry Volume</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {number(s.volume)}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-teal-400" />
            <span className="font-medium">Avg Holding</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {fmtDuration(s.avgDurationMs)}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">Avg Planned R</span>
          </div>
          <p className="mt-1 font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {s.avgPlannedR !== null ? `${number(s.avgPlannedR)}R` : "–"}
          </p>
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
  const sharedCurrency = [...currencies][0] ?? "USD";
  const sharedTimeZone = aa.data?.timeZone ?? bb.data?.timeZone ?? "UTC";

  const metricLines = (name: string, d: Analysis) => [
    name,
    `Trades: ${d.summary.trades} | P&L: ${number(d.summary.netPnl)} ${d.currencies[0] ?? ""}`,
    `Win rate: ${percent(d.summary.winRate)} | Planned R: ${number(d.summary.avgPlannedR)} | Realized R: ${number(d.summary.avgRealizedR)}`,
  ];

  // Head-to-head comparison rows
  const sumA = aa.data?.summary;
  const sumB = bb.data?.summary;
  const hasBothData = sumA && sumB && !aa.loading && !bb.loading && !multi;

  const diffPnl = hasBothData ? sumB.netPnl - sumA.netPnl : 0;
  const diffWin = hasBothData ? (sumB.winRate ?? 0) - (sumA.winRate ?? 0) : 0;

  const outperformingGroup = hasBothData
    ? diffPnl > 0
      ? {
          name: nameB,
          key: "b",
          pnlAdvantage: diffPnl,
          winRateAdvantage: diffWin,
          color: "text-purple-400",
          badgeBg: "border-purple-500/25 bg-purple-500/10 text-purple-400",
        }
      : diffPnl < 0
        ? {
            name: nameA,
            key: "a",
            pnlAdvantage: Math.abs(diffPnl),
            winRateAdvantage: -diffWin,
            color: "text-primary",
            badgeBg: "border-primary/25 bg-primary/10 text-primary",
          }
        : null
    : null;

  const comparisonRows = hasBothData
    ? (() => {
        const diffPf =
          sumB.profitFactor !== null && sumA.profitFactor !== null
            ? sumB.profitFactor - sumA.profitFactor
            : null;
        const diffR =
          sumB.avgRealizedR !== null && sumA.avgRealizedR !== null
            ? sumB.avgRealizedR - sumA.avgRealizedR
            : null;
        const diffTrades = sumB.trades - sumA.trades;
        const diffVol = sumB.volume - sumA.volume;

        return [
          {
            metric: "Net P&L",
            icon: DollarSign,
            iconColor: "text-emerald-500",
            iconBg: "border-emerald-500/20 bg-emerald-500/10",
            valA: (
              <span
                className={
                  sumA.netPnl > 0
                    ? "text-profit"
                    : sumA.netPnl < 0
                      ? "text-loss"
                      : "text-muted-foreground"
                }
              >
                <MonetaryValue>{money(sumA.netPnl, sharedCurrency)}</MonetaryValue>
              </span>
            ),
            valB: (
              <span
                className={
                  sumB.netPnl > 0
                    ? "text-profit"
                    : sumB.netPnl < 0
                      ? "text-loss"
                      : "text-muted-foreground"
                }
              >
                <MonetaryValue>{money(sumB.netPnl, sharedCurrency)}</MonetaryValue>
              </span>
            ),
            deltaNode: (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                  diffPnl > 0
                    ? "border border-profit/30 bg-profit/10 text-profit"
                    : diffPnl < 0
                      ? "border border-loss/30 bg-loss/10 text-loss"
                      : "border border-border/40 bg-muted/40 text-muted-foreground",
                )}
              >
                {diffPnl > 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : diffPnl < 0 ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                <MonetaryValue>
                  {diffPnl > 0 ? "+" : ""}
                  {money(diffPnl, sharedCurrency)}
                </MonetaryValue>
              </span>
            ),
          },
          {
            metric: "Win Rate",
            icon: Trophy,
            iconColor: "text-amber-500",
            iconBg: "border-amber-500/20 bg-amber-500/10",
            valA: percent(sumA.winRate),
            valB: percent(sumB.winRate),
            deltaNode: (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                  diffWin > 0
                    ? "border border-profit/30 bg-profit/10 text-profit"
                    : diffWin < 0
                      ? "border border-loss/30 bg-loss/10 text-loss"
                      : "border border-border/40 bg-muted/40 text-muted-foreground",
                )}
              >
                {diffWin > 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : diffWin < 0 ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {diffWin > 0 ? "+" : ""}
                {(diffWin * 100).toFixed(1)}%
              </span>
            ),
          },
          {
            metric: "Profit Factor",
            icon: Scale,
            iconColor: "text-primary",
            iconBg: "border-primary/20 bg-primary/10",
            valA: sumA.noLosses ? "∞" : number(sumA.profitFactor),
            valB: sumB.noLosses ? "∞" : number(sumB.profitFactor),
            deltaNode:
              diffPf !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                    diffPf > 0
                      ? "border border-profit/30 bg-profit/10 text-profit"
                      : diffPf < 0
                        ? "border border-loss/30 bg-loss/10 text-loss"
                        : "border border-border/40 bg-muted/40 text-muted-foreground",
                  )}
                >
                  {diffPf > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : diffPf < 0 ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : null}
                  {diffPf > 0 ? "+" : ""}
                  {number(diffPf)}
                </span>
              ) : (
                "–"
              ),
          },
          {
            metric: "Avg Realized R",
            icon: Zap,
            iconColor: "text-blue-500",
            iconBg: "border-blue-500/20 bg-blue-500/10",
            valA:
              sumA.avgRealizedR !== null
                ? `${sumA.avgRealizedR > 0 ? "+" : ""}${number(sumA.avgRealizedR)}R`
                : "–",
            valB:
              sumB.avgRealizedR !== null
                ? `${sumB.avgRealizedR > 0 ? "+" : ""}${number(sumB.avgRealizedR)}R`
                : "–",
            deltaNode:
              diffR !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                    diffR > 0
                      ? "border border-profit/30 bg-profit/10 text-profit"
                      : diffR < 0
                        ? "border border-loss/30 bg-loss/10 text-loss"
                        : "border border-border/40 bg-muted/40 text-muted-foreground",
                  )}
                >
                  {diffR > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : diffR < 0 ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : null}
                  {diffR > 0 ? "+" : ""}
                  {number(diffR)}R
                </span>
              ) : (
                "–"
              ),
          },
          {
            metric: "Closed Trades",
            icon: Hash,
            iconColor: "text-muted-foreground",
            iconBg: "border-border/40 bg-muted/40",
            valA: String(sumA.trades),
            valB: String(sumB.trades),
            deltaNode: (
              <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {diffTrades > 0 ? "+" : ""}
                {diffTrades}
              </span>
            ),
          },
          {
            metric: "Entry Volume",
            icon: BarChart2,
            iconColor: "text-purple-400",
            iconBg: "border-purple-500/20 bg-purple-500/10",
            valA: number(sumA.volume),
            valB: number(sumB.volume),
            deltaNode: (
              <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {diffVol > 0 ? "+" : ""}
                {number(diffVol)}
              </span>
            ),
          },
          {
            metric: "Avg Holding Time",
            icon: Clock,
            iconColor: "text-teal-400",
            iconBg: "border-teal-500/20 bg-teal-500/10",
            valA: fmtDuration(sumA.avgDurationMs),
            valB: fmtDuration(sumB.avgDurationMs),
            deltaNode:
              sumB.avgDurationMs !== null && sumA.avgDurationMs !== null ? (
                <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                  {sumB.avgDurationMs >= sumA.avgDurationMs ? "+" : "-"}
                  {fmtDuration(Math.abs(sumB.avgDurationMs - sumA.avgDurationMs))}
                </span>
              ) : (
                "–"
              ),
          },
        ];
      })()
    : [];

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
                <CohortSummary data={group.result.data} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Head-to-Head Comparative Delta Panel */}
      {hasBothData && (
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
                    ...metricLines(nameA, aa.data!),
                    "",
                    ...metricLines(nameB, bb.data!),
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
                    <span className="font-semibold text-foreground">{outperformingGroup.name}</span> is
                    leading by{" "}
                    <span className="font-mono font-bold text-profit">
                      <MonetaryValue>+{money(outperformingGroup.pnlAdvantage, sharedCurrency)}</MonetaryValue>
                    </span>
                    {outperformingGroup.winRateAdvantage !== 0 && (
                      <>
                        {" "}with a{" "}
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
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-bold uppercase tracking-wider", outperformingGroup.badgeBg)}
                >
                  Group {outperformingGroup.key.toUpperCase()} Edge
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2.5">Metric</TableHead>
                  <TableHead className="py-2.5 text-right font-mono">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {nameA}
                    </span>
                  </TableHead>
                  <TableHead className="py-2.5 text-right font-mono">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-purple-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                      {nameB}
                    </span>
                  </TableHead>
                  <TableHead className="px-4 text-right font-mono font-semibold">
                    Delta ({nameB} − {nameA})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => (
                  <TableRow key={row.metric} className="transition-colors hover:bg-muted/40">
                    <TableCell className="py-2.5 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                            row.iconBg,
                          )}
                        >
                          <row.icon className={cn("h-3.5 w-3.5", row.iconColor)} />
                        </div>
                        <span className="text-xs font-semibold text-foreground sm:text-sm">
                          {row.metric}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                      {row.valA}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                      {row.valB}
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono text-xs tabular-nums">
                      {row.deltaNode}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filter Configuration Dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span>Configure Group {editing?.toUpperCase()} Filters</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <FilterFields value={draft} onChange={setDraft} />
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              Clear all
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (editing === "a") setA(draft);
                  else setB(draft);
                  setEditing(null);
                }}
              >
                Apply to group
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
