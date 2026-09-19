"use client";

import type { GroupSummary } from "@luxalgo/journal-core";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Clock,
  DollarSign,
  Hash,
  Scale,
  Trophy,
  Zap,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonetaryValue } from "@/components/privacy";
import { cn, fmtDuration } from "@/lib/utils";
import { type ComparisonDeltas } from "@/lib/report-comparison";
import { money, number, percent } from "../types";

interface ComparisonDeltaTableProps {
  sumA: GroupSummary;
  sumB: GroupSummary;
  nameA: string;
  nameB: string;
  sharedCurrency: string;
  deltas: ComparisonDeltas;
}

export function ComparisonDeltaTable({
  sumA,
  sumB,
  nameA,
  nameB,
  sharedCurrency,
  deltas,
}: ComparisonDeltaTableProps) {
  const { diffPnl, diffWin, diffPf, diffR, diffTrades, diffVol } = deltas;

  const comparisonRows = [
    {
      metric: "Net P&L",
      icon: DollarSign,
      iconColor: "text-profit",
      iconBg: "bg-profit/10",
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
            "inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold tabular-nums",
            diffPnl > 0 ? "text-profit" : diffPnl < 0 ? "text-loss" : "text-muted-foreground",
          )}
        >
          {diffPnl > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : diffPnl < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
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
      iconBg: "bg-amber-500/10",
      valA: percent(sumA.winRate),
      valB: percent(sumB.winRate),
      deltaNode: (
        <span
          className={cn(
            "inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold tabular-nums",
            diffWin > 0 ? "text-profit" : diffWin < 0 ? "text-loss" : "text-muted-foreground",
          )}
        >
          {diffWin > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : diffWin < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
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
      iconBg: "bg-primary/10",
      valA: sumA.noLosses ? "∞" : number(sumA.profitFactor),
      valB: sumB.noLosses ? "∞" : number(sumB.profitFactor),
      deltaNode:
        diffPf !== null ? (
          <span
            className={cn(
              "inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold tabular-nums",
              diffPf > 0 ? "text-profit" : diffPf < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {diffPf > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : diffPf < 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
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
      iconBg: "bg-blue-500/10",
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
              "inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold tabular-nums",
              diffR > 0 ? "text-profit" : diffR < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {diffR > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : diffR < 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
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
      iconBg: "bg-muted/40",
      valA: String(sumA.trades),
      valB: String(sumB.trades),
      deltaNode: (
        <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {diffTrades > 0 ? "+" : ""}
          {diffTrades}
        </span>
      ),
    },
    {
      metric: "Entry Volume",
      icon: BarChart2,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-500/10",
      valA: number(sumA.volume),
      valB: number(sumB.volume),
      deltaNode: (
        <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {diffVol > 0 ? "+" : ""}
          {number(diffVol)}
        </span>
      ),
    },
    {
      metric: "Avg Holding Time",
      icon: Clock,
      iconColor: "text-teal-400",
      iconBg: "bg-teal-500/10",
      valA: fmtDuration(sumA.avgDurationMs),
      valB: fmtDuration(sumB.avgDurationMs),
      deltaNode:
        sumB.avgDurationMs !== null && sumA.avgDurationMs !== null ? (
          <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
            {sumB.avgDurationMs >= sumA.avgDurationMs ? "+" : "-"}
            {fmtDuration(Math.abs(sumB.avgDurationMs - sumA.avgDurationMs))}
          </span>
        ) : (
          "–"
        ),
    },
  ];

  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[28%] py-3 pl-4">Metric</TableHead>
          <TableHead className="w-[24%] py-3 text-center font-mono">
            <span className="inline-flex items-center justify-center gap-1.5 font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {nameA}
            </span>
          </TableHead>
          <TableHead className="w-[24%] py-3 text-center font-mono">
            <span className="inline-flex items-center justify-center gap-1.5 font-semibold text-purple-400">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              {nameB}
            </span>
          </TableHead>
          <TableHead className="w-[24%] py-3 pr-4 text-center font-mono font-semibold">
            Delta ({nameB} − {nameA})
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {comparisonRows.map((row) => (
          <TableRow key={row.metric} className="transition-colors hover:bg-muted/40">
            <TableCell className="py-3 pl-4 font-medium">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
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
            <TableCell className="py-3 text-center font-mono text-xs tabular-nums text-foreground">
              {row.valA}
            </TableCell>
            <TableCell className="py-3 text-center font-mono text-xs tabular-nums text-foreground">
              {row.valB}
            </TableCell>
            <TableCell className="py-3 pr-4 text-center font-mono text-xs tabular-nums">
              {row.deltaNode}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
