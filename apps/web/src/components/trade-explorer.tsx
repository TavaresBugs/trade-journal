"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  History,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  clockLabel,
  plotTradePoints,
  type PlottedTrade,
  type TradeExplorerResponse,
  type TradeXAxis,
  type TradeYAxis,
} from "@/lib/trade-explorer";
import { useApi } from "@/lib/use-api";
import { ReportMarketEstimates } from "./report-market-estimates";
import { MonetaryValue } from "./privacy";
import { cn, fmtMoney } from "@/lib/utils";
import { normalizeSymbol } from "@/lib/assets/asset-icons";
import { Pnl } from "./pnl";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { OptionSelect } from "./ui/option-select";
import { Skeleton } from "./ui/skeleton";
import { AssetIcon } from "./ui/asset-icon";
import { DirectionBadge } from "./ui/direction-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const TradeScatter = dynamic(
  () => import("./charts/trade-scatter").then((module) => module.TradeScatter),
  {
    loading: () => (
      <div role="status" aria-label="Loading scatter plot">
        <Skeleton className="h-80" />
      </div>
    ),
  },
);

const PAGE_SIZE = 25;
const detailHref = (key: string) => `/trades/${encodeURIComponent(key)}`;

export function TradeExplorer({ query }: { query: string }) {
  const { data, error, loading, refresh } = useApi<TradeExplorerResponse>(
    `/api/trade-explorer?${query}`,
  );
  const [x, setX] = useState<TradeXAxis>("durationMinutes");
  const [y, setY] = useState<TradeYAxis>("netPnl");
  const [selected, setSelected] = useState<PlottedTrade | null>(null);
  const [page, setPage] = useState(0);
  const [tableOpen, setTableOpen] = useState(false);
  const points = useMemo(() => plotTradePoints(data?.points ?? [], x, y), [data, x, y]);
  const date = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        timeZone: data?.timeZone ?? "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [data?.timeZone],
  );

  if (loading && !data) {
    return (
      <div role="status" aria-label="Loading trade explorer">
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">
          {error ?? "Unable to load trade explorer."}
        </p>
        <Button onClick={refresh} variant="outline" size="sm" className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  const currency = data.currencies[0] ?? "USD";
  const excursion = x === "mae" || x === "mfe" || y === "mae" || y === "mfe";
  const blocked = (y !== "realizedR" || excursion) && data.currencies.length > 1;

  const xTitle =
    x === "durationMinutes"
      ? "Duration (minutes)"
      : x === "entryMinute"
        ? `Entry time (${data.timeZone})`
        : `Estimated ${x.toUpperCase()} (${currency})`;

  const yTitle =
    y === "netPnl"
      ? `Net P&L (${currency})`
      : y === "realizedR"
        ? "Realized R"
        : `Estimated ${y.toUpperCase()} (${currency})`;

  const value = (point: PlottedTrade) =>
    y === "mae" || y === "mfe" ? (
      <MonetaryValue>{fmtMoney(point.y, currency)}</MonetaryValue>
    ) : y === "netPnl" ? (
      <Pnl value={point.y} currency={currency} />
    ) : (
      <span className="font-mono tabular-nums">
        {point.y > 0 ? "+" : ""}
        {point.y.toFixed(2)}R
      </span>
    );

  const xValue = (point: PlottedTrade) =>
    x === "mae" || x === "mfe" ? (
      <MonetaryValue>{fmtMoney(point.x, currency)}</MonetaryValue>
    ) : x === "entryMinute" ? (
      clockLabel(point.x)
    ) : (
      `${point.x.toLocaleString(undefined, { maximumFractionDigits: 2 })} min`
    );

  const pages = Math.ceil(points.length / PAGE_SIZE);
  const shownPage = Math.min(page, Math.max(0, pages - 1));

  const table = (
    <div className="space-y-3 px-4 pb-4 pt-1">
      <p className="text-xs text-muted-foreground">
        All {points.length} comparable trades, newest close first. Dates use {data.timeZone}.
      </p>
      <div className="max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2.5">Trade / Closed</TableHead>
              <TableHead className="px-2 text-right">{xTitle}</TableHead>
              <TableHead className="pl-2 text-right">{yTitle}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE).map((point) => (
              <TableRow key={point.key} className="hover:bg-muted/50">
                <TableCell className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AssetIcon symbol={point.symbol} size="xs" />
                      <span
                        className="truncate text-xs font-semibold text-foreground"
                        title={
                          point.symbol !== normalizeSymbol(point.symbol) ? point.symbol : undefined
                        }
                      >
                        {normalizeSymbol(point.symbol)}
                      </span>
                      <DirectionBadge direction={point.direction} size="xs" />
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {date.format(new Date(point.closedAt))}
                      </span>
                    </div>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Link href={detailHref(point.key)} title="Open trade details">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="px-2 text-right font-mono text-xs tabular-nums">
                  {xValue(point)}
                </TableCell>
                <TableCell className="pl-2 text-right font-mono text-xs tabular-nums">
                  {value(point)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={shownPage === 0}
            onClick={() => setPage(shownPage - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </Button>
          <p aria-live="polite" className="font-mono text-xs text-muted-foreground">
            Page {shownPage + 1} of {pages}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={shownPage === pages - 1}
            onClick={() => setPage(shownPage + 1)}
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <section className="space-y-4" aria-labelledby="trade-explorer-title" data-trade-explorer>
      {/* Header Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 id="trade-explorer-title" className="text-lg font-semibold tracking-tight">
              Trade Explorer
            </h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Cross-sectional distribution and trade outcome analysis based on active account and
            filters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {data.points.length} {data.points.length === 1 ? "Closed Trade" : "Closed Trades"}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {data.timeZone}
          </Badge>
          {currency && (
            <Badge variant="outline" className="text-xs font-normal">
              {currency}
            </Badge>
          )}
        </div>
      </div>

      <ReportMarketEstimates
        points={data.points}
        currencies={data.currencies}
        onComplete={refresh}
      />

      {/* Presets Toolbar */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Scatter plot presets">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Presets:</span>
        </span>
        {(
          [
            ["durationMinutes", "netPnl", "Holding Time vs Net P&L"],
            ["mae", "netPnl", "MAE vs Net P&L"],
            ["mfe", "netPnl", "MFE vs Net P&L"],
            ["mae", "mfe", "MAE vs MFE"],
          ] as const
        ).map(([nextX, nextY, label]) => {
          const isActive = x === nextX && y === nextY;
          return (
            <Button
              key={label}
              size="sm"
              variant={isActive ? "default" : "outline"}
              className="h-7 text-xs font-medium"
              onClick={() => {
                setX(nextX);
                setY(nextY);
                setSelected(null);
                setPage(0);
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <Card className="min-w-0 overflow-hidden rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">
                {excursion
                  ? `${xTitle} vs ${yTitle}`
                  : `Trade Outcomes by ${x === "durationMinutes" ? "Holding Time" : "Entry Time"}`}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {blocked
                  ? `${data.points.length} closed trades`
                  : `${points.length} of ${data.points.length} closed trades comparable`}{" "}
                · One point per trade ·{" "}
                {excursion ? "Gross excursion estimates; net P&L after fees" : "After fees"}
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-x-axis"
                  className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>X Axis</span>
                </label>
                <OptionSelect
                  id="trade-x-axis"
                  value={x}
                  onValueChange={(value) => {
                    setX(value as TradeXAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="durationMinutes">Duration (minutes)</option>
                  <option value="entryMinute">Entry time</option>
                  <option value="mae">Estimated MAE</option>
                  <option value="mfe">Estimated MFE</option>
                </OptionSelect>
              </div>
              <div className="min-w-0 flex-1 sm:w-44">
                <label
                  htmlFor="trade-y-axis"
                  className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                >
                  <ArrowUp className="h-3 w-3" />
                  <span>Y Axis</span>
                </label>
                <OptionSelect
                  id="trade-y-axis"
                  value={y}
                  onValueChange={(value) => {
                    setY(value as TradeYAxis);
                    setSelected(null);
                    setPage(0);
                  }}
                >
                  <option value="netPnl">Net P&L</option>
                  <option value="realizedR">Realized R</option>
                  <option value="mae">Estimated MAE</option>
                  <option value="mfe">Estimated MFE</option>
                </OptionSelect>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.points.length === 0 ? (
            <div className="py-12 text-center">
              <h3 className="font-medium text-foreground">No closed trades in this selection</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Change the date range or filters to explore your history. Open positions are
                excluded.
              </p>
            </div>
          ) : blocked ? (
            <p
              role="note"
              className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"
            >
              These trades use different currencies ({data.currencies.join(", ")}). Select accounts
              with one currency for monetary axes, or use Duration and Realized R to compare
              risk-normalized outcomes. No currency conversion is applied.
            </p>
          ) : (
            <>
              {points.length < data.points.length && (
                <p role="note" className="text-xs leading-relaxed text-muted-foreground">
                  {data.points.length - points.length} trades excluded:{" "}
                  {y === "realizedR"
                    ? "realized R requires a valid planned stop-loss and any required contract multiplier; "
                    : ""}
                  {excursion ? "MAE/MFE require saved, current market-data estimates. " : ""}Both
                  axes require valid values and timestamps.
                </p>
              )}
              {y === "realizedR" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  R = net P&L ÷ planned risk from your stop-loss. Uses weighted entry and total
                  entry quantity; it does not measure maximum intratrade risk.
                </p>
              )}
              {points.length >= (excursion ? 1 : 8) ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{yTitle}</span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-profit" />
                        <span>Positive Net P&L</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-loss" />
                        <span>Negative Net P&L</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full bg-muted-foreground/60"
                        />
                        <span>Zero Net P&L</span>
                      </span>
                    </span>
                  </div>
                  <TradeScatter
                    points={points}
                    x={x}
                    y={y}
                    currency={currency}
                    timeZone={data.timeZone}
                    onSelect={setSelected}
                  />
                  <p className="text-center text-xs text-muted-foreground">{xTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    Select a point to inspect its trade. Overlapping points remain individually
                    accessible in the table.
                  </p>
                  <div aria-live="polite">
                    {selected && (
                      <div
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-all shadow-sm",
                          (selected.netPnl ?? 0) > 0
                            ? "border-profit/30 bg-profit/5"
                            : (selected.netPnl ?? 0) < 0
                              ? "border-loss/30 bg-loss/5"
                              : "border-muted bg-muted/20",
                        )}
                      >
                        <div className="space-y-1.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AssetIcon symbol={selected.symbol} size="sm" />
                            <span
                              className="truncate text-sm font-semibold text-foreground"
                              title={
                                selected.symbol !== normalizeSymbol(selected.symbol)
                                  ? selected.symbol
                                  : undefined
                              }
                            >
                              {normalizeSymbol(selected.symbol)}
                            </span>
                            <DirectionBadge direction={selected.direction} size="xs" />
                            <div className="ml-1 text-sm font-bold tracking-tight">
                              {value(selected)}
                            </div>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {xValue(selected)} · Closed {date.format(new Date(selected.closedAt))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs font-medium"
                          >
                            <Link href={detailHref(selected.key)}>
                              <span>Open Trade</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setSelected(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Dismiss</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-xs leading-relaxed text-muted-foreground">
                  {points.length === 0
                    ? "No trades have the data required for these axes. Try another axis or adjust your filters."
                    : "Fewer than 8 comparable trades. Review the exact values below, or widen your filters to reveal a useful scatter plot."}
                </p>
              )}
              {points.length > 0 && points.length < 20 && (
                <p className="text-xs text-muted-foreground">
                  Small sample: treat apparent patterns cautiously until more trades are available.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {!blocked &&
        points.length > 0 &&
        (points.length < 8 ? (
          <Card className="min-w-0 overflow-hidden rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Comparable Trades</CardTitle>
            </CardHeader>
            {table}
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setTableOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-muted/40"
              aria-expanded={tableOpen}
            >
              <div className="flex items-center gap-2.5">
                <History className="h-4 w-4 text-muted-foreground" />
                <span>Explore All Comparable Trades</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {points.length} {points.length === 1 ? "trade" : "trades"}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  tableOpen && "rotate-180",
                )}
              />
            </button>
            {tableOpen && <div className="border-t">{table}</div>}
          </div>
        ))}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Duration is elapsed time from first entry to final exit, including overnight hours. Entry
        time uses the journal timezone; midnight neighbors appear at opposite ends of that axis.
        Patterns describe this selection, not causation or a recommended holding time.
      </p>
    </section>
  );
}
