"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { AssetIcon } from "./ui/asset-icon";
import { DirectionBadge } from "./ui/direction-badge";
import { Pnl } from "./pnl";
import { cn, fmtDuration } from "@/lib/utils";

interface DayTradeItem {
  key: string;
  symbol: string;
  direction: "long" | "short";
  status: "open" | "win" | "loss" | "breakeven";
  openedAt: string;
  closedAt: string | null;
  netPnl: number;
  grossPnl: number;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  durationMs?: number | null;
  stopLoss?: number | null;
  profitTarget?: number | null;
}

interface DayJournalData {
  date: string;
  trades: DayTradeItem[];
  note: string;
  symbol?: string | null;
  attachmentsCount?: number;
  hasDayJournal?: boolean;
}

export function DayJournalsDialog({
  date,
  open,
  onOpenChange,
  currency = "USD",
  onJournalCreated,
}: {
  date: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  onJournalCreated?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<DayJournalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDayData = useCallback(async (dayDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/journal/${dayDate}`);
      if (!res.ok) throw new Error("Could not load journals for this day");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && date) {
      fetchDayData(date);
    } else {
      setData(null);
    }
  }, [open, date, fetchDayData]);

  if (!date) return null;

  const trades = data?.trades ?? [];
  const hasNote = Boolean(data?.note && data.note.trim().length > 0);
  const attachmentsCount = data?.attachmentsCount ?? 0;
  const hasDayJournal = Boolean(
    data?.hasDayJournal ?? (hasNote || Boolean(data?.symbol) || attachmentsCount > 0),
  );
  const hasItems = hasDayJournal || trades.length > 0;

  const formattedDate = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const handleOpenJournal = (index: number) => {
    onOpenChange(false);
    router.push(`/journal/${date}?t=${index + 1}`);
  };

  const handleDayOverview = () => {
    onOpenChange(false);
    router.push(`/journal/${date}?t=day`);
  };

  const handleCreateDraft = () => {
    onOpenChange(false);
    const targetIndex = trades.length > 0 ? trades.length + 1 : 1;
    router.push(`/journal/${date}?t=${targetIndex}&new=true`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-[#111216] border-[#202229] p-5 sm:p-6 text-zinc-100 shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Journals for {formattedDate}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header without duplicate counters (counts live in footer only) */}
          <div className="flex items-start justify-between pb-3 pr-10 border-b border-[#202229]">
            <div>
              <h3 className="text-base font-semibold text-zinc-100 tracking-tight capitalize">
                {formattedDate}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Trade history and notes recorded on this date
              </p>
            </div>
          </div>

          {/* Loading, Error, Empty State or Minimal Table */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
              <div className="size-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
              <span>Loading journals...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-rose-400">{error}</div>
          ) : !hasItems ? (
            /* Clean background empty state */
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <FileText className="size-8 text-zinc-600 mb-3 stroke-[1.5]" />
              <h4 className="text-sm font-semibold text-zinc-200 tracking-tight">
                No journals recorded on this day
              </h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm text-balance">
                Start your session notes or log a new trade.
              </p>
              <Button
                size="sm"
                onClick={handleDayOverview}
                className="mt-5 gap-1.5 px-4 h-9 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs transition-transform active:scale-[0.98]"
              >
                <Plus className="size-4" />
                <span>Create Day Journal</span>
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed text-xs border-collapse">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead>
                  <tr className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase border-b border-[#202229]/60">
                    <th className="pb-2.5 pl-1 font-medium text-left">TRADE</th>
                    <th className="pb-2.5 font-medium text-center">SIDE</th>
                    <th className="pb-2.5 font-medium text-center">P&L</th>
                    <th className="pb-2.5 font-medium text-center">R</th>
                    <th className="pb-2.5 font-medium text-right pr-2">HOLD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202229]/30">
                  {/* Day Journal / Session note integrated as a row in the table when present */}
                  {hasDayJournal && (
                    <tr
                      onClick={handleDayOverview}
                      className="group hover:bg-white/[0.025] transition-colors cursor-pointer"
                    >
                      {/* TRADE (Blue indicator + Icon + Title) */}
                      <td className="py-2.5 pl-1">
                        <div className="flex items-center gap-2.5">
                          <div className="w-0.5 h-7 rounded-full bg-sky-500/80 transition-colors" />
                          {data?.symbol ? (
                            <AssetIcon symbol={data.symbol} size="sm" />
                          ) : (
                            <span
                              className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none bg-muted/40 ring-1 ring-black/5 dark:ring-white/10 text-muted-foreground"
                              style={{ width: 24, height: 24 }}
                            >
                              <BookOpen className="size-3 text-muted-foreground" />
                            </span>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-xs text-zinc-100 tracking-tight group-hover:text-zinc-50">
                              {data?.symbol ? `${data.symbol} Journal` : "Session Journal"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {attachmentsCount > 0
                                ? `${attachmentsCount} screenshot${attachmentsCount === 1 ? "" : "s"}${hasNote ? " · Note" : ""}`
                                : hasNote
                                  ? "Session note"
                                  : "Day Journal"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SIDE (DirectionBadge matching style) */}
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center justify-center gap-1 font-medium tracking-wide rounded-md border border-transparent select-none px-1.5 py-0.5 text-[10px] bg-sky-500/15 text-sky-400">
                          <BookOpen className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                          <span>{hasNote ? "NOTE" : "DAY"}</span>
                        </span>
                      </td>

                      {/* P&L */}
                      <td className="py-2.5 text-center font-mono text-zinc-500 text-xs">–</td>

                      {/* R */}
                      <td className="py-2.5 text-center font-mono text-zinc-500 text-xs">–</td>

                      {/* HOLD */}
                      <td className="py-2.5 text-right pr-2 font-mono text-zinc-500 text-xs">–</td>
                    </tr>
                  )}

                  {/* Individual trades */}
                  {trades.map((trade, idx) => {
                    const isOpen = trade.status === "open" || !trade.closedAt;
                    const isWin = trade.status === "win" || trade.netPnl > 0;
                    const isLoss = trade.status === "loss" || trade.netPnl < 0;

                    // Time formatting
                    const timeRaw = trade.openedAt || trade.closedAt;
                    const timeStr = timeRaw
                      ? new Date(timeRaw).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";

                    // Duration / Hold time
                    let holdStr = "—";
                    if (trade.durationMs != null && trade.durationMs > 0) {
                      holdStr = fmtDuration(trade.durationMs);
                    } else if (trade.openedAt && trade.closedAt) {
                      const ms =
                        new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime();
                      if (ms > 0) holdStr = fmtDuration(ms);
                    }

                    // R-multiple calculation
                    let rStr = "—";
                    if (trade.stopLoss && trade.avgEntry && trade.avgExit) {
                      const risk = Math.abs(trade.avgEntry - trade.stopLoss);
                      if (risk > 0) {
                        const gain =
                          trade.direction === "long"
                            ? trade.avgExit - trade.avgEntry
                            : trade.avgEntry - trade.avgExit;
                        const rVal = gain / risk;
                        rStr = `${rVal >= 0 ? "+" : ""}${rVal.toFixed(1)}R`;
                      }
                    }

                    return (
                      <tr
                        key={trade.key || idx}
                        onClick={() => handleOpenJournal(idx)}
                        className="group hover:bg-white/[0.025] transition-colors cursor-pointer"
                      >
                        {/* TRADE (Indicator + Icon + Asset + Time) */}
                        <td className="py-2.5 pl-1">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "w-0.5 h-7 rounded-full transition-colors",
                                isOpen
                                  ? "bg-zinc-600"
                                  : isWin
                                    ? "bg-profit"
                                    : isLoss
                                      ? "bg-loss"
                                      : "bg-zinc-500",
                              )}
                            />
                            <AssetIcon symbol={trade.symbol} size="sm" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-xs text-zinc-100 tracking-tight group-hover:text-zinc-50">
                                {trade.symbol}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                                {timeStr || `Trade ${idx + 1}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* SIDE */}
                        <td className="py-2.5 text-center">
                          <DirectionBadge direction={trade.direction} size="xs" />
                        </td>

                        {/* P&L */}
                        <td className="py-2.5 text-center font-mono">
                          {isOpen ? (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground select-none">
                              OPEN
                            </span>
                          ) : (
                            <Pnl
                              value={trade.netPnl}
                              currency={currency}
                              className="font-semibold text-xs"
                            />
                          )}
                        </td>

                        {/* R */}
                        <td className="py-2.5 text-center font-mono tabular-nums text-zinc-400 text-xs">
                          {rStr}
                        </td>

                        {/* HOLD */}
                        <td className="py-2.5 text-right pr-2 font-mono tabular-nums text-zinc-400 text-xs">
                          {holdStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer when items exist: count on left, New Journal button on right */}
          {hasItems && (
            <div className="flex items-center justify-between pt-3 border-t border-[#202229] mt-3">
              <span className="text-xs text-zinc-500 font-mono">
                {hasDayJournal && trades.length > 0
                  ? `1 journal · ${trades.length} ${trades.length === 1 ? "trade" : "trades"}`
                  : trades.length > 0
                    ? `${trades.length} ${trades.length === 1 ? "recorded trade" : "recorded trades"}`
                    : "1 recorded journal"}
              </span>

              <Button
                size="sm"
                onClick={handleCreateDraft}
                className="h-8 gap-1.5 px-3 text-xs bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs transition-transform active:scale-[0.98] rounded-lg"
              >
                <Plus className="size-3.5" />
                <span>New Journal</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
