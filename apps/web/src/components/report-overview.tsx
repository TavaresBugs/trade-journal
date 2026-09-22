"use client";

import type { AnalysisFilters, BucketStats } from "@luxalgo/journal-core";
import {
  ArrowUpDown,
  BookOpen,
  CalendarDays,
  Clock,
  Coins,
  LayoutDashboard,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { TimeHeatmap } from "./charts/time-heatmap";
import { ReviewExport } from "./review-export";
import { MonetaryValue } from "./privacy";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AssetIcon } from "./ui/asset-icon";
import { DirectionBadge } from "./ui/direction-badge";
import { useApi } from "@/lib/use-api";
import { cn, fmtMoney, fmtPercent, pnlClass } from "@/lib/utils";
import { describeFilters } from "@/lib/filter-description";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";

interface OverviewData {
  buckets: Record<
    "symbol" | "tag" | "mistake" | "playbook" | "weekday" | "hour" | "duration" | "direction",
    BucketStats[]
  >;
  currencies: string[];
  timeZone: string;
  accounts: { id: string; name: string }[];
  playbooks: { id: string; name: string }[];
}

// Keep the overview's aggregations and ordering with clean, standardized Title Case headers.
const SECTIONS = [
  { key: "symbol", title: "By Symbol" },
  { key: "direction", title: "Long vs. Short" },
  { key: "weekday", title: "By Weekday" },
  { key: "duration", title: "By Holding Time" },
  { key: "tag", title: "By Tag" },
  { key: "mistake", title: "By Mistake" },
  { key: "playbook", title: "By Playbook" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const COLUMN_HEADERS: Record<SectionKey, string> = {
  symbol: "Symbol",
  direction: "Direction",
  weekday: "Weekday",
  duration: "Holding Time",
  tag: "Tag",
  mistake: "Mistake",
  playbook: "Playbook",
};

const SECTION_ICONS: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  symbol: Coins,
  direction: ArrowUpDown,
  weekday: CalendarDays,
  duration: Clock,
  tag: Tag,
  mistake: ShieldAlert,
  playbook: BookOpen,
};

const WEEKDAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

const EMPTY_STATES: Record<string, { title: string; desc: string }> = {
  tag: {
    title: "No Tags Annotated",
    desc: "Tag your trades during journal reviews to unlock setup-specific edge breakdowns.",
  },
  mistake: {
    title: "No Mistakes Logged",
    desc: "Log execution and emotional leaks to track discipline and capital preservation.",
  },
  playbook: {
    title: "No Playbooks Linked",
    desc: "Assign strategies to your trades to measure systematic edge and expectancy.",
  },
};

function DimensionCell({
  sectionKey,
  rawKey,
  label,
}: {
  sectionKey: SectionKey;
  rawKey: string;
  label: string;
}) {
  if (sectionKey === "symbol") {
    const canonical = normalizeSymbol(rawKey);
    return (
      <div className="flex items-center gap-2">
        <AssetIcon symbol={rawKey} size="xs" />
        <span
          className="font-mono text-xs font-semibold tracking-tight text-foreground"
          title={rawKey !== canonical ? rawKey : undefined}
        >
          {canonical || rawKey}
        </span>
      </div>
    );
  }

  if (sectionKey === "direction") {
    return <DirectionBadge direction={rawKey} size="xs" />;
  }

  if (sectionKey === "weekday") {
    const fullName = WEEKDAY_NAMES[rawKey];
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
        <span className="text-xs font-medium text-foreground">
          {fullName ? (
            <>
              <span className="hidden sm:inline">{fullName}</span>
              <span className="sm:hidden">{rawKey}</span>
            </>
          ) : (
            rawKey
          )}
        </span>
      </div>
    );
  }

  if (sectionKey === "duration") {
    return <span className="font-mono text-xs font-medium text-foreground">{rawKey}</span>;
  }

  if (sectionKey === "tag") {
    return (
      <div className="flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-[160px] truncate rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs font-medium text-foreground ring-1 ring-border/50">
          {label}
        </span>
      </div>
    );
  }

  if (sectionKey === "mistake") {
    return (
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-loss" />
        <span className="max-w-[160px] truncate rounded-md bg-loss/10 px-2 py-0.5 text-xs font-medium text-loss ring-1 ring-loss/20">
          {label}
        </span>
      </div>
    );
  }

  if (sectionKey === "playbook") {
    return (
      <div className="flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="max-w-[160px] truncate rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20">
          {label}
        </span>
      </div>
    );
  }

  return <span className="text-xs font-medium text-foreground">{label}</span>;
}

function SectionSummaryBadge({
  sectionKey,
  buckets,
}: {
  sectionKey: SectionKey;
  buckets: BucketStats[];
}) {
  if (buckets.length === 0) return null;

  if (sectionKey === "symbol") {
    return (
      <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50">
        {buckets.length} {buckets.length === 1 ? "Asset" : "Assets"}
      </span>
    );
  }

  if (sectionKey === "direction") {
    const longCount = buckets.find((b) => b.key.toLowerCase() === "long")?.trades ?? 0;
    const shortCount = buckets.find((b) => b.key.toLowerCase() === "short")?.trades ?? 0;
    return (
      <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50">
        {longCount}L · {shortCount}S
      </span>
    );
  }

  if (sectionKey === "weekday") {
    const bestDay = [...buckets].sort((a, b) => b.netPnl - a.netPnl)[0];
    if (bestDay && bestDay.netPnl > 0) {
      return (
        <span className="rounded-md bg-profit/10 px-2 py-0.5 font-mono text-[11px] font-medium text-profit ring-1 ring-profit/20">
          Best: {bestDay.key}
        </span>
      );
    }
    return null;
  }

  if (sectionKey === "duration") {
    const mostTrades = [...buckets].sort((a, b) => b.trades - a.trades)[0];
    if (mostTrades) {
      return (
        <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50">
          Peak: {mostTrades.key}
        </span>
      );
    }
    return null;
  }

  return (
    <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50">
      {buckets.length} Active
    </span>
  );
}

function BreakdownEmptyState({
  sectionKey,
  Icon,
}: {
  sectionKey: SectionKey;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const info = EMPTY_STATES[sectionKey] ?? {
    title: "No Data Available",
    desc: "Execute trades matching your active filters to populate this breakdown.",
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/70 ring-1 ring-border/50">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mb-1 text-xs font-semibold text-foreground/80">{info.title}</p>
      <p className="max-w-[240px] text-balance text-[11px] leading-relaxed text-muted-foreground">
        {info.desc}
      </p>
    </div>
  );
}

export function ReportOverview({ query, filters }: { query: string; filters: AnalysisFilters }) {
  const { data, error, loading } = useApi<OverviewData>(`/api/stats?${query}`);
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (loading || !data) return <Skeleton className="h-72" />;
  if (data.currencies.length > 1)
    return (
      <p className="rounded-lg border p-4 text-sm">
        These accounts use different currencies ({data.currencies.join(", ")}). Select accounts with
        the same currency in Filters to compare monetary results.
      </p>
    );
  const totalTrades = data.buckets.direction.reduce((sum, b) => sum + b.trades, 0);
  const currency = data.currencies[0] ?? "USD";
  const label = (dimension: string, key: string) =>
    dimension === "playbook"
      ? (data.playbooks.find((book) => book.id === key)?.name ?? key)
      : dimension === "symbol"
        ? normalizeSymbol(key)
        : key;
  return (
    <div className="space-y-4" aria-labelledby="trading-overview-title">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h2 id="trading-overview-title" className="text-lg font-semibold tracking-tight">
              Trading Overview
            </h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Multi-dimensional performance breakdown and time distribution based on active account
            and filters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {totalTrades} {totalTrades === 1 ? "Closed Trade" : "Closed Trades"}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {data.timeZone}
          </Badge>
          {currency && (
            <Badge variant="outline" className="text-xs font-normal">
              {currency}
            </Badge>
          )}
          <ReviewExport
            containsFinancialData
            document={{
              title: "Trading overview",
              subtitle: `${data.timeZone} · ${currency}`,
              lines: [
                `Filters: ${describeFilters(filters, data.accounts, data.playbooks)}`,
                "",
                "Trade time performance (opening hour)",
                ...data.buckets.hour.map(
                  (b) =>
                    `${b.key}:00: ${b.trades} trades | Net P&L ${fmtMoney(b.netPnl, currency)}`,
                ),
                ...SECTIONS.flatMap((section) => [
                  "",
                  section.title,
                  ...data.buckets[section.key].map(
                    (b) =>
                      `${label(section.key, b.key)}: ${b.trades} trades | Win ${fmtPercent(b.winRate, 0)} | Net P&L ${fmtMoney(b.netPnl, currency)}`,
                  ),
                ]),
              ],
            }}
          />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CardTitle className="text-xs font-semibold normal-case tracking-tight text-foreground">
                Trade Time Performance
              </CardTitle>
            </div>
            <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ring-1 ring-border/50">
              Opening Hour (24h)
            </span>
          </CardHeader>
          <CardContent>
            <TimeHeatmap hours={data.buckets.hour} currency={currency} />
          </CardContent>
        </Card>
        {SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section.key];
          return (
            <Card key={section.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <CardTitle className="text-xs font-semibold normal-case tracking-tight text-foreground">
                    {section.title}
                  </CardTitle>
                </div>
                <SectionSummaryBadge sectionKey={section.key} buckets={data.buckets[section.key]} />
              </CardHeader>
              <CardContent className="pt-0">
                {data.buckets[section.key].length === 0 ? (
                  <BreakdownEmptyState sectionKey={section.key} Icon={Icon} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-left text-xs font-medium text-muted-foreground">
                          {COLUMN_HEADERS[section.key]}
                        </TableHead>
                        <TableHead className="text-center text-xs font-medium text-muted-foreground">
                          Trades
                        </TableHead>
                        <TableHead className="text-center text-xs font-medium text-muted-foreground">
                          Win %
                        </TableHead>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground">
                          Net P&L
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.buckets[section.key].map((bucket) => (
                        <TableRow key={bucket.key} className="transition-colors hover:bg-muted/40">
                          <TableCell className="text-left font-medium">
                            <DimensionCell
                              sectionKey={section.key}
                              rawKey={bucket.key}
                              label={label(section.key, bucket.key)}
                            />
                          </TableCell>
                          <TableCell className="tnum font-mono text-center text-xs text-muted-foreground">
                            {bucket.trades}
                          </TableCell>
                          <TableCell className="tnum text-center">
                            <div className="inline-flex items-center justify-center gap-2">
                              {bucket.winRate !== null ? (
                                <div
                                  className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-muted/60 sm:block"
                                  title={`Win rate: ${fmtPercent(bucket.winRate, 0)}`}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      bucket.winRate >= 0.5 ? "bg-profit" : "bg-loss/80",
                                    )}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, bucket.winRate * 100))}%`,
                                    }}
                                  />
                                </div>
                              ) : null}
                              <span
                                className={cn(
                                  "font-mono text-xs font-medium",
                                  bucket.winRate !== null && bucket.winRate >= 0.5
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                                )}
                              >
                                {fmtPercent(bucket.winRate, 0)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "tnum font-mono text-right text-xs font-semibold",
                              pnlClass(bucket.netPnl),
                            )}
                          >
                            <MonetaryValue>{fmtMoney(bucket.netPnl, currency)}</MonetaryValue>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Weekday and hour use trade opening times. Overview trade counts include open positions; win
        rates use closed trades. Holding time requires a closed trade. Tags and mistakes can
        overlap. By symbol shows the top 20 by net P&L; Breakdowns includes every symbol and
        additional metrics for closed trades.
      </p>
    </div>
  );
}
