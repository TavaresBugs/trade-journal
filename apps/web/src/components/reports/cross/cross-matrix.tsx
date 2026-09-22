"use client";

import { DIMENSIONS, type Dimension } from "@luxalgo/journal-core";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { MonetaryValue } from "@/components/privacy";
import { HoverHint } from "@/components/ui/tooltip";
import { GroupLabel } from "../shared/group-label";
import { type Analysis, labels, number, percent } from "../types";

export function CrossMatrix({
  data,
  primary,
  secondary,
}: {
  data: Analysis;
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

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No cross-dimensional trades match these filters.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th className="p-3 text-left font-semibold text-foreground">
                <span className="text-muted-foreground">{DIMENSIONS[primary]}</span>
                <span className="mx-1.5 text-muted-foreground/50">/</span>
                <span>{DIMENSIONS[secondary]}</span>
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="min-w-24 p-2.5 text-center font-medium text-muted-foreground"
                >
                  <GroupLabel dimension={secondary}>{colLabel(c)}</GroupLabel>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-t border-border/40 hover:bg-muted/20">
                <th className="p-3 text-left font-medium text-foreground">
                  <GroupLabel dimension={primary}>{rowLabel(r)}</GroupLabel>
                </th>
                {columns.map((c) => {
                  const g = cells.get(JSON.stringify([r, c]));
                  return (
                    <HoverHint
                      key={c}
                      content={
                        g ? `${g.trades} trades · Win rate ${percent(g.winRate)}` : "No trades"
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
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Cell values indicate net P&L in {currency}. Hover cells to inspect trades & win rate.
        </span>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-xs bg-loss/70" />
            <span>Loss</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-xs bg-profit/70" />
            <span>Profit</span>
          </span>
        </div>
      </div>
    </div>
  );
}
