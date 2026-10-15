"use client";

import { AiNotice } from "@/components/ai-notice";
import { Switch } from "@/components/ui/switch";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { ReviewExport } from "@/components/review-export";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  List,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Unlink,
} from "lucide-react";
import { DayJournalsDialog } from "./day-journals-dialog";
import { JournalAssetDropdown } from "./journal-asset-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { MonetaryValue } from "@/components/privacy";
import { TradeMarketData } from "@/components/trade-market-data";
import { EquityArea } from "@/components/charts/equity-area";
import { VoiceNote } from "@/components/voice-note";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DirectionBadge } from "@/components/ui/direction-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RuleChecklist } from "@/components/rule-checklist";
import { useAutosave } from "@/lib/use-autosave";
import { postJson, useApi } from "@/lib/use-api";
import { cn, fmtAmount, fmtDuration, fmtMoney, fmtNumber, fmtPercent } from "@/lib/utils";
import { formatTimestamp } from "@/lib/timezone";
import { dayKeyOf, type IntradayPoint, type TradeMetrics } from "@luxalgo/journal-core";
import { TimeframeScreenshotGrid } from "@/components/screenshots/timeframe-screenshot-grid";
import { TradePlanningModal, formatFeeDisplay } from "@/components/trade-planning-modal";

export interface TradeDetail {
  riskAmount: number | null;
  realizedR: number | null;
  plannedR: number | null;
  contractMultiplier: number | null;
  currency: string;
  key: string;
  accountId: string;
  symbol: string;
  assetClass: string | null;
  direction: "long" | "short";
  status: string;
  openedAt: string;
  closedAt: string | null;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  durationMs: number | null;
  exitsJson: string;
  notes: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
  playbookId: string | null;
  rating: number | null;
  stopLoss: number | null;
  profitTarget: number | null;
  reviewedAt: string | null;
  executionCount?: number;
  linkedJournalDate?: string | null;
}

export interface ExecutionRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  executedAt: string;
}

export interface TradeRowLite {
  key: string;
  symbol: string;
  direction: string;
  status: string;
  openedAt?: string;
  closedAt?: string | null;
  netPnl: number;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  fees: number;
  notes?: string | null;
  linkedJournalDate?: string | null;
}

export interface DayJournalItem {
  id: string;
  date: string;
  symbol: string | null;
  note: string;
  rating: number | null;
  reviewedAt: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
  attachmentsCount: number;
  linkedTradesCount: number;
}

export interface DayPayload {
  date: string;
  activeJournalId?: string;
  journals?: DayJournalItem[];
  metrics: TradeMetrics;
  trades: TradeRowLite[];
  intraday: IntradayPoint[];
  note: string;
  symbol?: string | null;
  allTradedSymbols?: string[];
  rating: number | null;
  reviewedAt: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
  attachmentsCount?: number;
  hasDayJournal?: boolean;
}

export interface JournalViewProps {
  date?: string;
  tradeKey?: string | null;
}

/**
 * JournalView: Unified component handling both trading journal presentations:
 * 1. Face A (Trade-Linked Journal): Rendered when an individual trade is selected.
 * 2. Face B (Clean Day Journal): Minimalist mode for daily session notes when viewing macro date or no trade is selected.
 */
export function JournalView({ date: initialDate, tradeKey: initialTradeKey }: JournalViewProps) {
  const router = useRouter();
  const { query, values: filters, timeZone: filterTimeZone } = useFilters();

  const activeJournalSubId = useMemo(() => {
    if (initialTradeKey?.startsWith("day:")) {
      return initialTradeKey.slice(4).trim() || null;
    }
    return null;
  }, [initialTradeKey]);

  // If an initial tradeKey is provided, use it directly. Otherwise query day data to detect trades.
  const dayApiUrl = useMemo(() => {
    if (!initialDate) return null;
    const base = `/api/journal/${initialDate}?${query}`;
    if (activeJournalSubId) {
      return `${base}&journalId=${encodeURIComponent(`${initialDate}#${activeJournalSubId}`)}`;
    }
    return base;
  }, [initialDate, query, activeJournalSubId]);

  const {
    data: dayData,
    error: dayError,
    refresh: refreshDay,
  } = useApi<DayPayload>(dayApiUrl ?? "");

  // Determine active trade key
  const activeTradeKey = useMemo(() => {
    // Macro day overview / standalone journal explicitly requested
    if (
      initialTradeKey === "day" ||
      initialTradeKey === "macro" ||
      initialTradeKey === "new" ||
      initialTradeKey?.startsWith("day:")
    ) {
      return null;
    }

    // Trade index number (e.g. "1", "2", "3") — never pass raw numbers as trade keys
    if (initialTradeKey && /^\d+$/.test(initialTradeKey)) {
      if (!dayData?.trades) return null;
      const idx = parseInt(initialTradeKey, 10) - 1;
      if (idx >= 0 && idx < dayData.trades.length) {
        return dayData.trades[idx]?.key ?? null;
      }
      return null;
    }

    // Non-numeric trade key match
    if (initialTradeKey) {
      if (dayData?.trades) {
        const found = dayData.trades.find(
          (t) => t.key === initialTradeKey || t.key.includes(initialTradeKey),
        );
        if (found) return found.key;
      }
      return initialTradeKey;
    }

    // Default to first trade if date has trades and no explicit day journal exists alone
    if (dayData && dayData.trades && dayData.trades.length > 0) {
      return dayData.trades[0]?.key ?? null;
    }

    return null;
  }, [initialTradeKey, dayData]);

  // Fetch full trade detail superset when activeTradeKey is present
  const tradeApiUrl = activeTradeKey ? `/api/trades/${encodeURIComponent(activeTradeKey)}` : null;
  const {
    data: tradeApiData,
    error: tradeError,
    refresh: refreshTrade,
  } = useApi<{
    trade: TradeDetail;
    executions: ExecutionRow[];
    timeZone: string;
  }>(tradeApiUrl ?? "");

  const hasTrade = Boolean(activeTradeKey && tradeApiData?.trade);
  const trade = tradeApiData?.trade;
  const executions = tradeApiData?.executions ?? [];
  const timeZone = tradeApiData?.timeZone ?? filterTimeZone ?? "UTC";

  // Effective date for calendar / API route
  const effectiveDate = useMemo(() => {
    if (initialDate) return initialDate;
    if (trade?.openedAt) return dayKeyOf(trade.openedAt, timeZone);
    if (dayData?.date) return dayData.date;
    return new Date().toISOString().slice(0, 10);
  }, [initialDate, trade?.openedAt, timeZone, dayData?.date]);

  // Active composite Journal ID ("YYYY-MM-DD" or "YYYY-MM-DD#<subId>")
  const activeJournalId = useMemo(() => {
    if (hasTrade && trade?.linkedJournalDate) {
      return trade.linkedJournalDate;
    }
    if (activeJournalSubId) {
      return `${effectiveDate}#${activeJournalSubId}`;
    }
    return effectiveDate;
  }, [hasTrade, trade?.linkedJournalDate, activeJournalSubId, effectiveDate]);

  const linkedJournalEntry = useMemo(() => {
    if (!hasTrade || !trade?.linkedJournalDate) return null;
    return dayData?.journals?.find((j) => j.id === trade.linkedJournalDate) ?? null;
  }, [hasTrade, trade?.linkedJournalDate, dayData?.journals]);

  // Linked asset for day journal (Face B)
  const [customAsset, setCustomAsset] = useState<string | null>(null);
  useEffect(() => {
    setCustomAsset(null);
  }, [activeJournalId]);
  const currentJournalAsset = customAsset !== null ? customAsset : (dayData?.symbol ?? null);

  const handleSelectJournalAsset = async (newSymbol: string | null) => {
    const formatted = newSymbol ? newSymbol.trim().toUpperCase() : null;
    setCustomAsset(formatted);
    try {
      await postJson(
        `/api/journal/${effectiveDate}`,
        { journalId: activeJournalId, symbol: formatted },
        "PATCH",
      );
      refreshDay();
    } catch (err) {
      console.error("Failed to update journal asset:", err);
    }
  };

  const handleCreateNewJournal = useCallback(() => {
    const hasExistingJournals =
      Boolean(dayData?.hasDayJournal) ||
      (dayData?.journals?.length ?? 0) > 0 ||
      Boolean(!hasTrade && (currentJournalAsset || dayData?.note?.trim()));

    if (!hasExistingJournals) {
      router.push(`/journal/${effectiveDate}?t=day&new=true`);
      return;
    }
    const shortId = `j_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
    router.push(`/journal/${effectiveDate}?t=day:${shortId}&new=true`);
  }, [dayData?.hasDayJournal, dayData?.journals?.length, dayData?.note, hasTrade, currentJournalAsset, effectiveDate, router]);

  // AI State (Critique or Recap)
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiAction = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      if (hasTrade && activeTradeKey) {
        const res = await postJson<{ critique: string }>("/api/ai/critique", {
          key: activeTradeKey,
        });
        setAiOutput(res.critique);
      } else if (effectiveDate) {
        const res = await postJson<{ recap: string; scope: { label: string } }>("/api/ai/recap", {
          date: effectiveDate,
          filters,
          timeZone: filterTimeZone,
        });
        setAiOutput(res.recap);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI operation failed");
    } finally {
      setAiBusy(false);
    }
  };

  // Patch mutation handlers
  const patchTrade = useCallback(
    async (body: Record<string, unknown>) => {
      if (activeTradeKey && Object.keys(body).length > 0) {
        await postJson(`/api/trades/${encodeURIComponent(activeTradeKey)}`, body, "PATCH");
        refreshTrade();
        if (dayApiUrl) refreshDay();
      }
    },
    [activeTradeKey, refreshTrade, dayApiUrl, refreshDay],
  );

  const patchDay = useCallback(
    async (body: Record<string, unknown>) => {
      if (effectiveDate && Object.keys(body).length > 0) {
        await postJson(
          `/api/journal/${effectiveDate}`,
          { ...body, journalId: activeJournalId },
          "PATCH",
        );
        refreshDay();
      }
    },
    [effectiveDate, activeJournalId, refreshDay],
  );

  // Cumulative trade P&L curve
  const runningPnl = useMemo(() => {
    if (!trade) return [];
    let exits: { executionId: string; grossPnl: number; quantity: number }[] = [];
    try {
      exits =
        (JSON.parse(trade.exitsJson || "[]") as {
          executionId: string;
          grossPnl: number;
          quantity: number;
        }[]) ?? [];
    } catch {
      exits = [];
    }
    const times = new Map(executions.map((e) => [e.id, e.executedAt]));
    const totalExitQty = exits.reduce((total, exit) => total + exit.quantity, 0);
    let cum = 0;
    return exits
      .map((exit) => ({
        t: times.get(exit.executionId) ?? trade.openedAt,
        pnl: exit.grossPnl - (totalExitQty > 0 ? trade.fees * (exit.quantity / totalExitQty) : 0),
      }))
      .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
      .map((event) => ({
        t: formatTimestamp(event.t, timeZone).slice(11, 16),
        cumNetPnl: (cum += event.pnl),
      }));
  }, [trade, executions, timeZone]);

  // Loading / Error states
  const totalTrades = dayData?.trades?.length ?? 0;
  const [journalsDialogOpen, setJournalsDialogOpen] = useState(false);
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const tradeIndex = useMemo(() => {
    if (!dayData?.trades || !activeTradeKey) return 0;
    const idx = dayData.trades.findIndex((t) => t.key === activeTradeKey);
    return idx >= 0 ? idx : 0;
  }, [dayData?.trades, activeTradeKey]);

  const isLoading = Boolean(
    (initialDate && !dayData && !dayError) || (activeTradeKey && !tradeApiData && !tradeError),
  );

  const errorMessage = tradeError || dayError;

  if (isLoading) {
    return (
      <div>
        <FilterBar title="Journal" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="space-y-3 xl:col-span-2">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage && !hasTrade && !dayData) {
    return (
      <div>
        <FilterBar title="Journal" />
        <div className="p-4">
          <Card>
            <CardContent className="py-8 text-center text-sm text-destructive" role="alert">
              {errorMessage}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Header:
          - Face A (Trade-Linked): AssetIcon + Instrument: {SYMBOL} + Direction + Status (No date in title, no tabs!)
            If multiple trades exist in the day, displays discrete stepper ‹ 1 of 3 ›.
          - Face B (Clean Journal): Journal · {YYYY-MM-DD} + Filters
            If trades exist in the day, displays discrete shortcut "View trades (N)".
      */}
      <FilterBar
        title={
          hasTrade && trade ? (
            <div className="flex items-center gap-3">
              <AssetIcon symbol={trade.symbol} size="md" />
              <div className="flex flex-col justify-center">
                <span className="text-xs text-muted-foreground leading-none">Instrument</span>
                <span className="text-base font-bold text-foreground tracking-tight leading-snug">
                  {trade.symbol}
                </span>
              </div>
              <div className="flex items-center gap-1.5 self-center">
                <DirectionBadge
                  direction={trade.direction}
                  size="xs"
                  className="h-5 px-2 text-[10px] leading-none"
                />
                <Badge
                  variant={
                    trade.status === "win"
                      ? "profit"
                      : trade.status === "loss"
                        ? "loss"
                        : "secondary"
                  }
                  className="h-5 px-2 text-[10px] font-semibold tracking-wider uppercase leading-none inline-flex items-center justify-center rounded-md border-transparent"
                >
                  {trade.status}
                </Badge>

                {/* Discrete stepper ‹ 1 of 3 › ONLY when there is more than 1 trade on the day */}
                {totalTrades > 1 && (
                  <div className="flex items-center ml-2 rounded-lg border border-border/60 bg-muted/30 p-0.5 shadow-xs">
                    <Link
                      href={`/journal/${effectiveDate}?t=${tradeIndex}`}
                      aria-label="Previous trade"
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        tradeIndex === 0 && "pointer-events-none opacity-30",
                      )}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 px-2 py-0.5 font-medium text-foreground hover:bg-muted/80 rounded-md transition-colors text-[11px] font-mono select-none"
                        >
                          <span>
                            {tradeIndex + 1} of {totalTrades}
                          </span>
                          <ChevronDown className="size-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 p-1">
                        <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1">
                          Trades on {effectiveDate} ({totalTrades})
                        </DropdownMenuLabel>
                        {dayData?.trades.map((t, idx) => {
                          const isActive = idx === tradeIndex;
                          return (
                            <DropdownMenuItem key={t.key} asChild>
                              <Link
                                href={`/journal/${effectiveDate}?t=${idx + 1}`}
                                className={cn(
                                  "flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer",
                                  isActive && "bg-accent font-semibold",
                                )}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-muted-foreground font-mono text-[10px]">
                                    #{idx + 1}
                                  </span>
                                  <AssetIcon symbol={t.symbol} size="xs" />
                                  <span className="truncate">{t.symbol}</span>
                                  <DirectionBadge direction={t.direction} size="xs" />
                                </div>
                                <Pnl value={t.netPnl} className="text-[11px]" />
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setJournalsDialogOpen(true)}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <List className="size-3.5 text-zinc-400" />
                          <span>View all journals ({totalTrades})</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/journal/${effectiveDate}?t=day`}
                            className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Calendar className="size-3.5 text-brand" />
                            <span>Day overview (Session notes)</span>
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Link
                      href={`/journal/${effectiveDate}?t=${tradeIndex + 2}`}
                      aria-label="Next trade"
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        tradeIndex === totalTrades - 1 && "pointer-events-none opacity-30",
                      )}
                    >
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {/* Asset / Journal Icon with Dropdown to select or change asset */}
              <JournalAssetDropdown
                currentAsset={currentJournalAsset}
                onSelectAsset={handleSelectJournalAsset}
                todayTrades={dayData?.trades}
                allTradedSymbols={dayData?.allTradedSymbols}
              />

              {/* Text labels: 'Journal' as subtitle and instrument (or date) as primary title */}
              <div className="flex flex-col justify-center">
                <span className="text-xs text-muted-foreground leading-none">Journal</span>
                <span className="text-base font-bold text-foreground tracking-tight leading-snug">
                  {currentJournalAsset || effectiveDate}
                </span>
              </div>

              {/* When an asset is linked, displays the date instead of WIN/LONG using an institutional blue badge */}
              {currentJournalAsset && (
                <div className="flex items-center gap-1.5 self-center">
                  <span className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky-500/15 text-sky-400 px-2 py-0.5 text-xs font-mono font-medium tracking-wide select-none">
                    {effectiveDate}
                  </span>
                </div>
              )}
            </div>
          )
        }
        actions={
          <div className="flex items-center gap-2">
            {(totalTrades > 0 || dayData?.hasDayJournal) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setJournalsDialogOpen(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <List className="size-3.5" />
                <span>
                  {hasTrade ? `Journals (${totalTrades})` : `Trades (${totalTrades})`}
                </span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleCreateNewJournal}
              className="h-8 gap-1.5 px-3 text-xs bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-semibold shadow-xs transition-transform active:scale-[0.98] cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Journal</span>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 p-4 xl:grid-cols-3">
        {/* Left Column:
            - Face A: Hero Card ➔ Screenshots ➔ Market Data Replay (+ Running P&L)
            - Face B (Clean Journal): Hero and Market Data are OMITTED! Screenshots move to the top.
        */}
        <div className="min-w-0 space-y-3 xl:col-span-2">
          {hasTrade && trade && (
            <TradeHeroCard
              trade={trade}
              timeZone={timeZone}
              onOpenPlanning={() => setIsPlanningModalOpen(true)}
            />
          )}

          {/* Timeframe Screenshots (isolated per activeTradeKey vs activeJournalId) */}
          {hasTrade && trade ? (
            <TimeframeScreenshotGrid
              key={`trade-${trade.key}`}
              ownerType="trade"
              ownerId={trade.key}
              title="Visual context & screenshots"
              subtitle={`Trade execution, entry & timeframe context for ${trade.symbol}`}
              linkedJournalId={trade.linkedJournalDate}
              linkedJournalTitle={
                linkedJournalEntry?.symbol
                  ? `${linkedJournalEntry.symbol} Session Journal`
                  : trade.linkedJournalDate
                    ? "Session Journal"
                    : undefined
              }
            />
          ) : (
            <TimeframeScreenshotGrid
              key={`day-${activeJournalId}`}
              ownerType="day"
              ownerId={activeJournalId}
              title="Visual context & screenshots"
              subtitle="Macro context and market structure prior to session open"
            />
          )}

          {/* Market Data & Replay (omitted in Clean Journal) */}
          {hasTrade && trade && executions && (
            <>
              <TradeMarketData trade={trade} executions={executions} />

              {runningPnl.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trade running P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EquityArea data={runningPnl} height={180} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right Column:
            - Review Card (Unified review with stars, reviewed switch, tags, mistakes, notes with voice/templates)
            - Strategy Rule Review (omitted in Clean Journal)
            - AI Block (Critique for trade, Recap for clean journal)
        */}
        <div className="min-w-0 space-y-3">
          <UnifiedReviewCard
            key={hasTrade && trade ? `trade-${trade.key}` : `day-${activeJournalId}`}
            hasTrade={hasTrade}
            trade={trade}
            dayData={dayData}
            date={effectiveDate}
            activeJournalId={activeJournalId}
            timeZone={timeZone}
            onPatch={hasTrade ? patchTrade : patchDay}
          />

          {/* Strategy Rule Review (Playbook Rules): Omitted in Clean Journal */}
          {hasTrade && trade && (
            <RuleChecklist tradeKey={trade.key} playbookId={trade.playbookId} />
          )}

          {/* AI Review / Recap Card */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand" />
                <span>{hasTrade ? "AI review" : "AI session review"}</span>
              </CardTitle>
              <Button
                size="sm"
                onClick={handleAiAction}
                disabled={aiBusy}
                className="gap-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {aiBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                <span>{aiBusy ? "Thinking…" : hasTrade ? "Critique this trade" : "AI recap"}</span>
              </Button>
            </CardHeader>
            {aiError && (
              <CardContent>
                <AiNotice
                  error={aiError}
                  onRetry={() => void handleAiAction()}
                  onDismiss={() => setAiError(null)}
                />
              </CardContent>
            )}
            {aiOutput && (
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiOutput}</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <DayJournalsDialog
        date={effectiveDate}
        open={journalsDialogOpen}
        onOpenChange={setJournalsDialogOpen}
        onJournalCreated={refreshDay}
      />

      {hasTrade && trade && (
        <TradePlanningModal
          isOpen={isPlanningModalOpen}
          onClose={() => setIsPlanningModalOpen(false)}
          trade={trade}
          dayJournalTitle={
            currentJournalAsset ? `${currentJournalAsset} Journal` : "Session Journal"
          }
          dayDate={effectiveDate}
          hasDayJournal={Boolean(
            dayData?.note || dayData?.symbol || (dayData?.attachmentsCount ?? 0) > 0,
          )}
          onSave={async (patches) => {
            await patchTrade(patches);
          }}
        />
      )}
    </div>
  );
}

/**
 * TradeHeroCard: Renders hero card featuring Net P&L (+% notional) and 10 financial metrics.
 * Omitted in Clean Journal mode.
 */
export interface TradeHeroCardProps {
  trade: TradeDetail;
  timeZone: string;
  mae?: number | null;
  mfe?: number | null;
  onOpenPlanning?: () => void;
}

export function TradeHeroCard({
  trade,
  timeZone,
  mae: propMae,
  mfe: propMfe,
  onOpenPlanning,
}: TradeHeroCardProps) {
  // Connect to saved excursion estimates if not provided directly
  const { data: marketData } = useApi<{
    saved: {
      estimate: { mae: number | null; mfe: number | null };
    } | null;
  }>(
    propMae === undefined && propMfe === undefined
      ? `/api/trades/${encodeURIComponent(trade.key)}/market-data`
      : null,
  );

  const effectiveMae = propMae !== undefined ? propMae : (marketData?.saved?.estimate?.mae ?? null);
  const effectiveMfe = propMfe !== undefined ? propMfe : (marketData?.saved?.estimate?.mfe ?? null);

  return (
    <Card className="relative">
      {onOpenPlanning && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenPlanning}
          className="absolute top-2.5 right-2.5 size-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
          title="Edit trade details & planning"
        >
          <Pencil className="size-3.5" />
          <span className="sr-only">Edit trade details</span>
        </Button>
      )}

      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-4 px-4 sm:px-5">
        {/* Hero Net P&L Column */}
        <div className="flex flex-col justify-center shrink-0 sm:pr-6 sm:border-r sm:border-border/70 min-w-[110px] sm:min-w-[120px]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Net P&L
          </div>
          <Pnl value={trade.netPnl} className="text-2xl sm:text-3xl font-bold tracking-tight" />
          {trade.avgEntry * trade.quantity > 0 &&
            (trade.contractMultiplier !== null ||
              !["futures", "option", "forex", "cfd"].includes(trade.assetClass ?? "")) && (
              <div className="text-xs font-semibold font-mono text-profit mt-0.5">
                {fmtPercent(
                  trade.netPnl /
                    (Math.abs(trade.avgEntry) * trade.quantity * (trade.contractMultiplier ?? 1)),
                  2,
                )}{" "}
                <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                  notional
                </span>
              </div>
            )}
        </div>

        {/* 6 Logical Paired Columns across the remaining width */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3.5 lg:gap-x-4 gap-y-3 flex-1 min-w-0 pr-8 sm:pr-0">
          {/* Col 1 (top): Financials (Gross P&L with semantic profit/loss coloring) */}
          <Meta label="Gross">
            <Pnl
              value={trade.grossPnl}
              currency={trade.currency}
              className="font-mono text-sm font-semibold whitespace-nowrap"
            />
          </Meta>
          {/* Col 2 (top): Sizing & Timing */}
          <Meta label="Volume" value={fmtNumber(trade.quantity, 4)} />
          {/* Col 3 (top): Price Entry */}
          <Meta label="Avg entry" value={fmtNumber(trade.avgEntry)} monetary />
          {/* Col 4 (top): Planned Multiple */}
          <Meta
            label="Planned R"
            value={trade.plannedR === null ? "–" : `${fmtNumber(trade.plannedR)}R`}
          />
          {/* Col 5 (top): MFE (Maximum Favorable Excursion) */}
          <Meta label="MFE">
            <span
              className={cn(
                "tnum font-mono text-sm font-semibold whitespace-nowrap",
                effectiveMfe !== null && effectiveMfe > 0 ? "text-profit" : "text-muted-foreground",
              )}
            >
              {effectiveMfe !== null ? (
                <MonetaryValue>
                  {effectiveMfe > 0
                    ? fmtMoney(effectiveMfe, trade.currency).replace(/^\+?/, "+")
                    : fmtAmount(0, trade.currency)}
                </MonetaryValue>
              ) : (
                "–"
              )}
            </span>
          </Meta>
          {/* Col 6 (top): Entry Time */}
          <Meta
            label="Entry"
            value={formatTimestamp(trade.openedAt, timeZone).slice(0, 16)}
            className="text-xs sm:text-[13px]"
          />

          {/* Col 1 (bottom): Fees (always negative deduction or zero, never positive sign) */}
          <Meta label="Fees">
            <span
              className={cn(
                "tnum font-mono text-sm font-semibold whitespace-nowrap",
                trade.fees > 0 ? "text-loss/80" : "text-muted-foreground",
              )}
            >
              <MonetaryValue>{formatFeeDisplay(trade.fees, trade.currency)}</MonetaryValue>
            </span>
          </Meta>
          {/* Col 2 (bottom): Duration */}
          <Meta label="Duration" value={fmtDuration(trade.durationMs)} />
          {/* Col 3 (bottom): Price Exit */}
          <Meta
            label="Avg exit"
            monetary
            value={trade.avgExit === null ? "open" : fmtNumber(trade.avgExit)}
          />
          {/* Col 4 (bottom): Realized Multiple */}
          <Meta
            label="Realized R"
            value={trade.realizedR === null ? "–" : `${fmtNumber(trade.realizedR)}R`}
            className={cn(
              trade.realizedR !== null &&
                (trade.realizedR > 0
                  ? "text-profit"
                  : trade.realizedR < 0
                    ? "text-loss"
                    : "text-muted-foreground"),
            )}
          />
          {/* Col 5 (bottom): MAE (Maximum Adverse Excursion) */}
          <Meta label="MAE">
            <span
              className={cn(
                "tnum font-mono text-sm font-semibold whitespace-nowrap",
                effectiveMae !== null && effectiveMae > 0 ? "text-loss" : "text-muted-foreground",
              )}
            >
              {effectiveMae !== null ? (
                <MonetaryValue>
                  {effectiveMae > 0
                    ? fmtAmount(-Math.abs(effectiveMae), trade.currency)
                    : fmtAmount(0, trade.currency)}
                </MonetaryValue>
              ) : (
                "–"
              )}
            </span>
          </Meta>
          {/* Col 6 (bottom): Exit Time */}
          <Meta
            label="Exit"
            value={trade.closedAt ? formatTimestamp(trade.closedAt, timeZone).slice(0, 16) : "open"}
            className="text-xs sm:text-[13px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({
  label,
  value,
  monetary = false,
  className,
  valueClassName,
  children,
}: {
  label: string;
  value?: string | number | null;
  monetary?: boolean;
  className?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </div>
      <div
        className={cn(
          "tnum font-mono text-sm font-semibold text-foreground whitespace-nowrap",
          valueClassName,
        )}
      >
        {children ??
          (monetary && typeof value === "string" ? <MonetaryValue>{value}</MonetaryValue> : value)}
      </div>
    </div>
  );
}

/**
 * UnifiedReviewCard: Single unified review component managing:
 * - Trade Review (when hasTrade = true, with Playbook selector)
 * - Day Review (when hasTrade = false, without Playbook selector)
 * Preserves 100% parity across star rating, reviewed switch, tags, mistakes,
 * RichEditor with voice dictation & templates, export, and auto-saving.
 */
function UnifiedReviewCard({
  hasTrade,
  trade,
  dayData,
  date,
  activeJournalId,
  timeZone,
  onPatch,
}: {
  hasTrade: boolean;
  trade?: TradeDetail;
  dayData?: DayPayload | null;
  date: string;
  activeJournalId: string;
  timeZone: string;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const safeParseArray = (raw: string | null | undefined): string[] => {
    try {
      return (JSON.parse(raw || "[]") as string[]) ?? [];
    } catch {
      return [];
    }
  };

  const isLinkedToJournal = Boolean(hasTrade && trade?.linkedJournalDate);
  const linkedJournalEntry = useMemo(() => {
    if (!hasTrade || !trade?.linkedJournalDate) return null;
    return (
      dayData?.journals?.find((j) => j.id === trade.linkedJournalDate) ?? null
    );
  }, [hasTrade, trade?.linkedJournalDate, dayData?.journals]);

  const initialNotes = isLinkedToJournal
    ? linkedJournalEntry?.note || trade?.notes || dayData?.note || ""
    : hasTrade
      ? (trade?.notes ?? "")
      : (dayData?.note ?? "");
  const initialRating = hasTrade ? (trade?.rating ?? null) : (dayData?.rating ?? null);
  const initialReviewedAt = hasTrade ? (trade?.reviewedAt ?? null) : (dayData?.reviewedAt ?? null);
  const initialTags = safeParseArray(hasTrade ? trade?.tagsJson : dayData?.tagsJson).join(", ");
  const initialMistakes = safeParseArray(
    hasTrade ? trade?.mistakesJson : dayData?.mistakesJson,
  ).join(", ");

  const [notes, setNotes] = useState(initialNotes);
  const [noteMode, setNoteMode] = useState<"preview" | "edit">(() =>
    Boolean(initialNotes.trim()) ? "preview" : "edit",
  );
  const noteEditor = useRef<RichEditorHandle>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [tags, setTags] = useState(initialTags);
  const [mistakes, setMistakes] = useState(initialMistakes);

  // Sync editor notes when linking to a journal or pulling from a sibling trade
  useEffect(() => {
    setNotes((prev) => (prev === initialNotes ? prev : initialNotes));
    if (initialNotes.trim()) {
      setNoteMode("preview");
    }
  }, [isLinkedToJournal, initialNotes]);

  const siblingTradesWithNotes = useMemo(() => {
    if (!hasTrade || !trade || !dayData?.trades) return [];
    return dayData.trades
      .map((t, index) => ({ trade: t, index }))
      .filter(
        ({ trade: t }) =>
          t.key !== trade.key && Boolean(t.notes && t.notes.trim().length > 0),
      );
  }, [hasTrade, trade, dayData?.trades]);

  const sameSymbolTrades = useMemo(() => {
    if (!hasTrade || !trade || !dayData?.trades) return [];
    return dayData.trades.filter((t) => t.symbol === trade.symbol);
  }, [hasTrade, trade, dayData?.trades]);

  const linkedTradesCount = useMemo(() => {
    if (!dayData?.trades) return 0;
    const targetJournalId =
      hasTrade && trade?.linkedJournalDate ? trade.linkedJournalDate : activeJournalId;
    return dayData.trades.filter((t) => t.linkedJournalDate === targetJournalId).length;
  }, [dayData?.trades, hasTrade, trade?.linkedJournalDate, activeJournalId]);

  const linkedJournalHref = useMemo(() => {
    const targetId = trade?.linkedJournalDate;
    if (!targetId) return `/journal/${date}?t=day`;
    const hashIdx = targetId.indexOf("#");
    if (hashIdx === -1) return `/journal/${date}?t=day`;
    return `/journal/${date}?t=day:${encodeURIComponent(targetId.slice(hashIdx + 1))}`;
  }, [date, trade?.linkedJournalDate]);

  const { data: playbookData } = useApi<{ playbooks: { id: string; name: string }[] }>(
    hasTrade ? "/api/playbooks" : "",
  );

  const autosaveEndpoint =
    hasTrade && trade
      ? `/api/trades/${encodeURIComponent(trade.key)}`
      : `/api/journal/${date}?journalId=${encodeURIComponent(activeJournalId)}`;

  const {
    save: debounced,
    status: saveStatus,
    flush,
  } = useAutosave(autosaveEndpoint, "PATCH", () => void onPatch({}));

  const isSaving = saveStatus === "Saving…";
  const isError = Boolean(saveStatus && saveStatus.startsWith("Not saved"));
  const [savedFeedback, setSavedFeedback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSavedFeedback = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSavedFeedback(true);
    timerRef.current = setTimeout(() => {
      setSavedFeedback(false);
    }, 2500);
  }, []);

  useEffect(() => {
    if (saveStatus === "Saved") {
      triggerSavedFeedback();
    } else if (saveStatus === "Saving…") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSavedFeedback(false);
    }
  }, [saveStatus, triggerSavedFeedback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleManualSave = async () => {
    if (isSaving) return;
    try {
      await flush();
      triggerSavedFeedback();
      if (notes.trim()) {
        setTimeout(() => {
          setNoteMode("preview");
        }, 600);
      }
    } catch {
      // Handled via saveStatus
    }
  };

  const isSaved = !isSaving && savedFeedback;

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const activeRating = hoverRating ?? initialRating ?? 0;
  const isReviewed = initialReviewedAt !== null;

  const reviewDoc = useMemo(() => {
    if (hasTrade && trade) {
      const subtitle = `${trade.direction.toUpperCase()} · ${trade.symbol} · ${trade.status.toUpperCase()}${timeZone ? ` (${timeZone})` : ""}`;
      const metaLines = [
        `Symbol: ${trade.symbol} | Direction: ${trade.direction.toUpperCase()} | Status: ${trade.status.toUpperCase()}`,
        `P&L: ${fmtMoney(trade.grossPnl, trade.currency)} (Net: ${fmtMoney(trade.netPnl, trade.currency)})`,
        initialRating ? `Rating: ${initialRating}/5 stars` : "",
        tags ? `Tags: ${tags}` : "",
        mistakes ? `Mistakes: ${mistakes}` : "",
      ].filter(Boolean);

      return {
        title: `Trade Review · ${trade.symbol}`,
        subtitle,
        lines: [...metaLines, "", "Notes:", notes || "(No notes)"],
      };
    }

    const m = dayData?.metrics;
    const subtitle = `Daily Review · ${date}`;
    const metaLines = [
      m
        ? `Trades: ${m.closedTrades} | Winrate: ${fmtPercent(m.winRate)} | Net P&L: ${fmtMoney(m.netPnl)}`
        : "",
      initialRating ? `Rating: ${initialRating}/5 stars` : "",
      isReviewed ? `Reviewed: Yes` : "",
      tags ? `Tags: ${tags}` : "",
      mistakes ? `Mistakes: ${mistakes}` : "",
    ].filter(Boolean);

    return {
      title: `Daily Review · ${date}`,
      subtitle,
      lines: [...metaLines, "", "Notes:", notes || "(No notes)"],
    };
  }, [hasTrade, trade, dayData, date, timeZone, initialRating, isReviewed, tags, mistakes, notes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="size-4 text-muted-foreground shrink-0" />
              <span>{hasTrade ? "Trade review" : "Day review"}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {hasTrade
                ? "Execution rating, tags, mistakes, and trade reflection"
                : "Daily session rating, tags, mistakes, and reflection"}
            </p>
          </div>

          {hasTrade && trade && (
            <div className="shrink-0">
              {isLinkedToJournal ? (
                <div className="flex items-center gap-1.5">
                  <Link
                    href={linkedJournalHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-400 hover:bg-sky-500/20 transition-colors"
                    title="Open shared Session Journal"
                  >
                    <BookOpen className="size-3" />
                    <span>
                      {linkedJournalEntry?.symbol
                        ? `${linkedJournalEntry.symbol} Journal`
                        : "Shared Journal"}
                      {linkedTradesCount > 1 ? ` (${linkedTradesCount})` : ""}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void onPatch({ linkedJournalDate: null })}
                    className="size-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                    title="Unlink from shared Session Journal (keep individual note)"
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-2.5 text-xs border-border/70 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                    >
                      <Link2 className="size-3 text-sky-400" />
                      <span>Link Journal</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-1">
                    <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1">
                      Share / Link Journal on {date}
                    </DropdownMenuLabel>

                    {siblingTradesWithNotes.map(({ trade: sibling, index }) => {
                      const timeStr = sibling.openedAt
                        ? formatTimestamp(sibling.openedAt, timeZone).slice(11, 16)
                        : `#${index + 1}`;
                      const targetJournalId =
                        sibling.linkedJournalDate ||
                        dayData?.journals?.find((j) => j.symbol === sibling.symbol)?.id ||
                        date;
                      return (
                        <DropdownMenuItem
                          key={sibling.key}
                          onClick={() =>
                            void onPatch({
                              linkedJournalDate: targetJournalId,
                              sourceTradeKey: sibling.key,
                            })
                          }
                          className="flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-md text-xs cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <BookOpen className="size-3.5 text-sky-400 shrink-0" />
                            <span>
                              Pull &amp; Share from {sibling.symbol} ({timeStr})
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground line-clamp-1 pl-5">
                            {sibling.notes?.replace(/[#*_`>-]/g, "").trim().slice(0, 60)}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}

                    {sameSymbolTrades.length > 1 && (
                      <DropdownMenuItem
                        onClick={() => {
                          const matchingJournal = dayData?.journals?.find(
                            (j) => j.symbol === trade.symbol,
                          );
                          const targetJournalId =
                            matchingJournal?.id ||
                            ((dayData?.journals?.length ?? 0) === 0
                              ? date
                              : `${date}#j_${Date.now().toString(36).slice(-4)}`);
                          void onPatch({
                            linkedJournalDate: targetJournalId,
                            linkSiblingKeys: sameSymbolTrades.map((t) => t.key),
                            ...(siblingTradesWithNotes[0]
                              ? { sourceTradeKey: siblingTradesWithNotes[0].trade.key }
                              : {}),
                          });
                        }}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer"
                      >
                        <Link2 className="size-3.5 text-sky-400 shrink-0" />
                        <span>
                          Share across all {trade.symbol} trades today ({sameSymbolTrades.length})
                        </span>
                      </DropdownMenuItem>
                    )}

                    {(dayData?.journals ?? []).map((j) => (
                      <DropdownMenuItem
                        key={j.id}
                        onClick={() => void onPatch({ linkedJournalDate: j.id })}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer"
                      >
                        <Calendar className="size-3.5 text-sky-400 shrink-0" />
                        <span>
                          Link to {j.symbol ? `${j.symbol} Journal` : "Session Journal"}
                        </span>
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuItem
                      onClick={() => {
                        const hasExisting = (dayData?.journals?.length ?? 0) > 0;
                        const newJournalId = hasExisting
                          ? `${date}#j_${Date.now().toString(36).slice(-4)}`
                          : date;
                        void onPatch({ linkedJournalDate: newJournalId });
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer"
                    >
                      <Plus className="size-3.5 text-muted-foreground shrink-0" />
                      <span>
                        {(dayData?.journals?.length ?? 0) > 0
                          ? `Create & Link New ${trade.symbol} Journal`
                          : `Link to ${trade.symbol} Session Journal (${date})`}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating Section */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Rating</span>
          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label={hasTrade ? "Trade rating" : "Day rating"}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= activeRating;
              const isSelected = initialRating !== null && star <= initialRating;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                  onClick={() => void onPatch({ rating: initialRating === star ? null : star })}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="group relative flex size-8 items-center justify-center rounded-lg transition-transform duration-150 ease-out hover:scale-125 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      "size-5 transition-[color,fill,transform] duration-150 ease-out",
                      isFilled
                        ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                        : "text-muted-foreground/50 hover:text-foreground",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviewed Switch Card */}
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3.5 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Switch
              checked={isReviewed}
              onCheckedChange={(checked) => void onPatch({ reviewed: checked })}
              aria-label="Reviewed"
            />
            <div className="min-w-0">
              <span className="block text-xs sm:text-sm font-semibold text-foreground">
                Reviewed
              </span>
              <p className="text-[11px] text-muted-foreground truncate">
                {hasTrade
                  ? "Mark this trade as fully debriefed."
                  : "Mark this day as fully debriefed."}
              </p>
            </div>
          </div>
        </div>

        {/* Playbook Selection: Omitted in Clean Journal */}
        {hasTrade && trade && (
          <div className="space-y-1.5">
            <label
              htmlFor="trade-playbook-select"
              className="text-xs font-medium text-muted-foreground"
            >
              Playbook
            </label>
            <Select
              value={trade.playbookId ?? "none"}
              onValueChange={(value) =>
                void onPatch({ playbookId: value === "none" ? null : value })
              }
            >
              <SelectTrigger id="trade-playbook-select" className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="No playbook" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No playbook</SelectItem>
                {playbookData?.playbooks.map((playbook) => (
                  <SelectItem key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tags */}
        <div className="space-y-1.5">
          <label htmlFor="unified-tags-input" className="text-xs font-medium text-muted-foreground">
            Tags
          </label>
          <Input
            id="unified-tags-input"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              debounced({ tags: parseList(event.target.value) });
            }}
            placeholder={hasTrade ? "breakout, A+ setup" : "trend day, FOMC, high volatility"}
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate tags with commas.</p>
        </div>

        {/* Mistakes */}
        <div className="space-y-1.5">
          <label
            htmlFor="unified-mistakes-input"
            className="text-xs font-medium text-muted-foreground"
          >
            Mistakes
          </label>
          <Input
            id="unified-mistakes-input"
            value={mistakes}
            onChange={(event) => {
              setMistakes(event.target.value);
              debounced({ mistakes: parseList(event.target.value) });
            }}
            placeholder={
              hasTrade ? "chased entry, moved stop" : "chased entry, overtrading, sized too large"
            }
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate mistakes with commas.</p>
        </div>

        {/* Notes with Rich Formatting & Voice Dictation */}
        <div className="space-y-1.5">
          <label
            htmlFor="unified-notes-editor"
            className="text-xs font-medium text-muted-foreground"
          >
            Notes
          </label>
          <RichEditor
            editorRef={noteEditor}
            value={notes}
            onChange={(value) => {
              setNotes(value);
              debounced({ notes: value, note: value });
            }}
            placeholder={
              hasTrade
                ? "What happened, and what should change next time?"
                : "Market context, presented setups, and session reflection…"
            }
            mode={noteMode}
            onModeChange={setNoteMode}
            showModeToggle={false}
            extraActions={
              <VoiceNote
                iconOnly
                onPrepare={() => {
                  noteEditor.current?.focus();
                }}
                onText={(text) => {
                  const next = notes ? `${notes} ${text}` : text;
                  setNotes(next);
                  debounced({ notes: next, note: next });
                }}
              />
            }
          />

          {/* Footer with status caption on left and actions on right */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[11px] text-muted-foreground truncate">
              {isSaving
                ? "Saving note…"
                : isSaved
                  ? "Note is saved to local journal"
                  : isError
                    ? saveStatus
                    : isLinkedToJournal
                      ? "Session notes · Shared across trades linked to this journal"
                      : hasTrade
                        ? "Annotations stay with this trade"
                        : "Annotations stay with this day"}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <ReviewExport
                className="space-y-0"
                containsFinancialData={hasTrade}
                document={reviewDoc}
              />

              {noteMode === "preview" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNoteMode("edit");
                    requestAnimationFrame(() => {
                      noteEditor.current?.focus();
                    });
                  }}
                  className="gap-1.5 rounded-xl px-4 py-2 text-xs font-medium border-border/70 hover:bg-muted/80 active:scale-[0.98] shadow-xs transition-all duration-200 shrink-0"
                  title="Edit note"
                >
                  <Pencil className="size-3.5" />
                  <span>Edit note</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={handleManualSave}
                  className="gap-1.5 rounded-xl px-4 py-2 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] shadow-xs transition-all duration-200 shrink-0"
                  title={
                    isSaved
                      ? "Note is saved to local journal"
                      : isSaving
                        ? "Saving note…"
                        : isError
                          ? "Click to retry saving"
                          : "Save note (auto-saves while typing)"
                  }
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : isSaved ? (
                    <Check className="size-3.5 animate-in zoom-in-50 duration-200" />
                  ) : isError ? (
                    <AlertCircle className="size-3.5" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  <span>
                    {isSaving
                      ? "Saving…"
                      : isSaved
                        ? "Saved"
                        : isError
                          ? "Retry save"
                          : "Save note"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
