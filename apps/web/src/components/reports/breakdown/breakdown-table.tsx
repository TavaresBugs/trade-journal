"use client";

import { DIMENSIONS, type Dimension } from "@luxalgo/journal-core";
import { normalizeSymbol } from "@/lib/assets/asset-icons";
import { cn, fmtDuration } from "@/lib/utils";
import { MonetaryValue } from "@/components/privacy";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GroupLabel } from "../shared/group-label";
import { type Analysis, labels, number, percent, money } from "../types";

export function BreakdownTable({
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
  const currency = data.currencies[0] ?? "USD";

  if (data.groups.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          No closed trades match these filters.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Adjust your filters or date range to see breakdown statistics.
        </p>
      </div>
    );
  }

  return (
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
  );
}
