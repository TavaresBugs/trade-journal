"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Link2, Loader2, Plus, Unlink } from "lucide-react";
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
  notes?: string | null;
  linkedJournalDate?: string | null;
}

interface DayJournalEntry {
  id: string;
  date: string;
  note: string;
  symbol: string | null;
  attachmentsCount: number;
  linkedTradesCount: number;
}

interface DayJournalData {
  date: string;
  journals?: DayJournalEntry[];
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
  const [linkingKey, setLinkingKey] = useState<string | null>(null);

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
  const journalsList: DayJournalEntry[] =
    data?.journals && data.journals.length > 0
      ? data.journals
      : hasDayJournal
        ? [
            {
              id: date,
              date,
              note: data?.note ?? "",
              symbol: data?.symbol ?? null,
              attachmentsCount,
              linkedTradesCount: trades.filter((t) => t.linkedJournalDate === date).length,
            },
          ]
        : [];
  const hasItems = journalsList.length > 0 || trades.length > 0;

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

  const handleOpenDayJournalEntry = (journalId: string) => {
    onOpenChange(false);
    if (journalId === date) {
      router.push(`/journal/${date}?t=day`);
    } else {
      const subId = journalId.slice(date.length + 1);
      router.push(`/journal/${date}?t=${encodeURIComponent(`day:${subId}`)}`);
    }
  };

  const handleCreateDraft = () => {
    onOpenChange(false);
    if (journalsList.length === 0) {
      router.push(`/journal/${date}?t=day&new=true`);
    } else {
      const subId = `j_${Math.random().toString(36).slice(2, 7)}`;
      router.push(`/journal/${date}?t=${encodeURIComponent(`day:${subId}`)}&new=true`);
    }
  };

  const handleToggleTradeLink = async (e: React.MouseEvent, trade: DayTradeItem) => {
    e.stopPropagation();
    if (!date || linkingKey) return;
    const isCurrentlyLinked = Boolean(
      trade.linkedJournalDate &&
        (trade.linkedJournalDate === date || trade.linkedJournalDate.startsWith(`${date}#`)),
    );
    const matchingSymbolJournal = journalsList.find(
      (j) => j.symbol && trade.symbol.toUpperCase().includes(j.symbol.toUpperCase()),
    );
    const targetJournalId = matchingSymbolJournal?.id ?? journalsList[0]?.id ?? date;
    const siblingWithNote = trades.find(
      (t) => t.key !== trade.key && Boolean(t.notes && t.notes.trim().length > 0),
    );
    setLinkingKey(trade.key);
    try {
      await fetch(`/api/trades/${encodeURIComponent(trade.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedJournalDate: isCurrentlyLinked ? null : targetJournalId,
          ...(!isCurrentlyLinked && !trade.notes?.trim() && siblingWithNote
            ? { sourceTradeKey: siblingWithNote.key }
            : {}),
        }),
      });
      await fetchDayData(date);
      onJournalCreated?.();
    } finally {
      setLinkingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full min-w-0 max-w-2xl p-0 sm:p-0 gap-0 sm:gap-0 bg-card border-border/80 shadow-2xl overflow-hidden rounded-xl [&>button]:top-3 [&>button]:right-3">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 h-14 pl-6 pr-13 border-b border-border/40 text-left">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="size-4 text-muted-foreground shrink-0" />
            <DialogTitle className="text-sm font-semibold tracking-tight text-foreground pr-0 capitalize truncate">
              {formattedDate}
            </DialogTitle>
          </div>

          <Button
            size="sm"
            onClick={handleCreateDraft}
            className="h-7 gap-1.5 px-2.5 text-xs bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs transition-transform active:scale-[0.98] rounded-md shrink-0 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Journal</span>
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground bg-black/40">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs">Loading journals...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400 bg-black/40">{error}</div>
        ) : !hasItems ? (
          <div className="py-10 px-6 flex flex-col items-center justify-center text-center bg-black/40">
            <FileText className="size-7 text-muted-foreground/50 mb-2.5 stroke-[1.5]" />
            <h4 className="text-xs font-semibold text-foreground tracking-tight">
              No journals recorded on this day
            </h4>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-xs text-balance">
              Use the New Journal button above to start your session notes or log a trade.
            </p>
          </div>
        ) : (
          <div>
            {/* Full-bleed Header Row matching Show Credentials */}
            <div className="grid grid-cols-[1.8fr_0.9fr_1fr_0.6fr_0.6fr] items-center gap-x-4 px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/30 border-b border-border/40">
              <span>Trade</span>
              <span className="text-center">Side</span>
              <span className="text-center">P&amp;L</span>
              <span className="text-center">R</span>
              <span className="text-right">Hold</span>
            </div>

            {/* Full-bleed Rows List (Zero bottom footer, directly bounds dialog) */}
            <div className="divide-y divide-border/40 bg-black/40 max-h-[60vh] overflow-y-auto">
              {/* All Day Journals / Session notes rows */}
              {journalsList.map((journal, jIdx) => {
                const jHasNote = Boolean(journal.note && journal.note.trim().length > 0);
                const jAttCount = journal.attachmentsCount ?? 0;
                const jTitle = journal.symbol
                  ? `${journal.symbol} Journal`
                  : journalsList.length > 1
                    ? `Session Journal #${jIdx + 1}`
                    : "Session Journal";

                return (
                  <div
                    key={journal.id}
                    onClick={() => handleOpenDayJournalEntry(journal.id)}
                    className="grid grid-cols-[1.8fr_0.9fr_1fr_0.6fr_0.6fr] items-center gap-x-4 px-6 py-3.5 hover:bg-muted/15 transition-colors cursor-pointer group"
                  >
                    {/* TRADE (Blue indicator + Icon + Title) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-0.5 h-7 rounded-full bg-sky-500/80 transition-colors shrink-0" />
                      {journal.symbol ? (
                        <AssetIcon symbol={journal.symbol} size="sm" />
                      ) : (
                        <span
                          className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none bg-muted/40 ring-1 ring-black/5 dark:ring-white/10 text-muted-foreground"
                          style={{ width: 24, height: 24 }}
                        >
                          <BookOpen className="size-3 text-muted-foreground" />
                        </span>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-xs text-foreground truncate group-hover:text-white">
                          {jTitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {jAttCount > 0
                            ? `${jAttCount} screenshot${jAttCount === 1 ? "" : "s"}${jHasNote ? " · Note" : ""}`
                            : jHasNote
                              ? "Session note"
                              : "Day Journal"}
                        </span>
                      </div>
                    </div>

                    {/* SIDE */}
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center justify-center gap-1 font-medium tracking-wide rounded-md border border-transparent select-none px-1.5 py-0.5 text-[10px] bg-sky-500/15 text-sky-400">
                        <BookOpen className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                        <span>{jHasNote ? "NOTE" : "DAY"}</span>
                      </span>
                    </div>

                    {/* P&L */}
                    <div className="text-center font-mono text-muted-foreground text-xs">–</div>

                    {/* R */}
                    <div className="text-center font-mono text-muted-foreground text-xs">–</div>

                    {/* HOLD */}
                    <div className="text-right font-mono text-muted-foreground text-xs">–</div>
                  </div>
                );
              })}

              {/* Individual trades */}
              {trades.map((trade, idx) => {
                const isOpen = trade.status === "open" || !trade.closedAt;
                const isWin = trade.status === "win" || trade.netPnl > 0;
                const isLoss = trade.status === "loss" || trade.netPnl < 0;

                const timeRaw = trade.openedAt || trade.closedAt;
                const timeStr = timeRaw
                  ? new Date(timeRaw).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : "";

                let holdStr = "—";
                if (trade.durationMs != null && trade.durationMs > 0) {
                  holdStr = fmtDuration(trade.durationMs);
                } else if (trade.openedAt && trade.closedAt) {
                  const ms =
                    new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime();
                  if (ms > 0) holdStr = fmtDuration(ms);
                }

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

                const isLinked = Boolean(
                  trade.linkedJournalDate && trade.linkedJournalDate === date,
                );
                const hasTradeNote = Boolean(trade.notes && trade.notes.trim().length > 0);

                return (
                  <div
                    key={trade.key || idx}
                    onClick={() => handleOpenJournal(idx)}
                    className="grid grid-cols-[1.8fr_0.9fr_1fr_0.6fr_0.6fr] items-center gap-x-4 px-6 py-3.5 hover:bg-muted/15 transition-colors cursor-pointer group"
                  >
                    {/* TRADE (Indicator + Icon + Asset + Time + Note badge + Quick Link) */}
                    <div className={cn("flex items-center gap-2.5 min-w-0", isLinked && "pl-3")}>
                      {isLinked && (
                        <span
                          className="text-sky-400/80 font-mono text-xs select-none shrink-0"
                          title="Linked to Session Journal"
                        >
                          ↳
                        </span>
                      )}
                      <div
                        className={cn(
                          "w-0.5 h-7 rounded-full transition-colors shrink-0",
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
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-xs text-foreground truncate group-hover:text-white">
                            {trade.symbol}
                          </span>
                          {hasTradeNote && !isLinked && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-medium bg-sky-500/15 text-sky-400 shrink-0"
                              title="Trade has a journal note"
                            >
                              <BookOpen className="size-2.5" />
                              <span>NOTE</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          {timeStr || `Trade ${idx + 1}`}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={linkingKey === trade.key}
                        onClick={(e) => void handleToggleTradeLink(e, trade)}
                        className={cn(
                          "size-6 shrink-0 cursor-pointer transition-opacity",
                          isLinked
                            ? "text-sky-400 hover:text-sky-300 opacity-90"
                            : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100",
                        )}
                        title={
                          isLinked
                            ? "Unlink from Session Journal"
                            : hasTradeNote && !hasDayJournal
                              ? "Promote note & share as Session Journal"
                              : "Link to Session Journal"
                        }
                      >
                        {linkingKey === trade.key ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : isLinked ? (
                          <Unlink className="size-3" />
                        ) : (
                          <Link2 className="size-3" />
                        )}
                      </Button>
                    </div>

                    {/* SIDE */}
                    <div className="flex items-center justify-center">
                      <DirectionBadge direction={trade.direction} size="xs" />
                    </div>

                    {/* P&L */}
                    <div className="flex items-center justify-center font-mono">
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
                    </div>

                    {/* R */}
                    <div className="text-center font-mono tabular-nums text-muted-foreground text-xs">
                      {rStr}
                    </div>

                    {/* HOLD */}
                    <div className="text-right font-mono tabular-nums text-muted-foreground text-xs">
                      {holdStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

