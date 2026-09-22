"use client";
import { AiNotice } from "@/components/ai-notice";
import { Switch } from "@/components/ui/switch";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { ReviewExport } from "@/components/review-export";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, Save, Sparkles, Star } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
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
import { cn, fmtDuration, fmtMoney, fmtNumber, fmtPercent } from "@/lib/utils";
import { tradeKeyFromSegment } from "@/lib/trade-links";
import { formatTimestamp } from "@/lib/timezone";
import { dayKeyOf } from "@luxalgo/journal-core";
import { TimeframeScreenshotGrid } from "@/components/screenshots/timeframe-screenshot-grid";

interface TradeDetail {
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
}

interface ExecutionRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  executedAt: string;
}

export default function TradePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const tradeKey = tradeKeyFromSegment(key);
  return <TradeView key={tradeKey} tradeKey={tradeKey} />;
}

function TradeView({ tradeKey }: { tradeKey: string }) {
  const { data, error, refresh } = useApi<{
    trade: TradeDetail;
    executions: ExecutionRow[];
    timeZone: string;
  }>(`/api/trades/${encodeURIComponent(tradeKey)}`);
  const [aiBusy, setAiBusy] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!data) {
    return (
      <div>
        <FilterBar title="Trade" />
        <div className="p-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </div>
    );
  }
  const { trade, executions, timeZone } = data;

  const patch = async (body: Record<string, unknown>) => {
    if (Object.keys(body).length)
      await postJson(`/api/trades/${encodeURIComponent(tradeKey)}`, body, "PATCH");
    refresh();
  };

  const runningPnl = (() => {
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
  })();

  const askCritique = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await postJson<{ critique: string }>("/api/ai/critique", { key: tradeKey });
      setCritique(result.critique);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI critique failed");
    } finally {
      setAiBusy(false);
    }
  };

  const riskAmount = trade.riskAmount;

  return (
    <div>
      <FilterBar
        title={
          <div className="flex items-center gap-3">
            <AssetIcon symbol={trade.symbol} size="md" />
            <div className="flex flex-col justify-center">
              <span className="text-xs text-muted-foreground leading-none">Instrument</span>
              <span className="text-base font-bold text-foreground tracking-tight leading-snug">
                {trade.symbol}
              </span>
            </div>
            <div className="flex items-center gap-1.5 self-center">
              <DirectionBadge direction={trade.direction} size="xs" />
              <Badge
                variant={
                  trade.status === "win" ? "profit" : trade.status === "loss" ? "loss" : "secondary"
                }
                className="text-[11px] font-semibold tracking-wider px-2 py-0.5 uppercase"
              >
                {trade.status}
              </Badge>
            </div>
          </div>
        }
      />
      <div className="grid gap-3 p-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <Card>
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-4 px-4 sm:px-5">
              {/* Hero Net P&L Column */}
              <div className="flex flex-col justify-center shrink-0 sm:pr-6 sm:border-r sm:border-border/70 min-w-[110px] sm:min-w-[120px]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Net P&L
                </div>
                <Pnl
                  value={trade.netPnl}
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                />
                {trade.avgEntry * trade.quantity > 0 &&
                  (trade.contractMultiplier !== null ||
                    !["futures", "option", "forex", "cfd"].includes(trade.assetClass ?? "")) && (
                    <div className="text-xs font-semibold font-mono text-profit mt-0.5">
                      {fmtPercent(
                        trade.netPnl /
                          (Math.abs(trade.avgEntry) *
                            trade.quantity *
                            (trade.contractMultiplier ?? 1)),
                        2,
                      )}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                        notional
                      </span>
                    </div>
                  )}
              </div>

              {/* 5 Logical Paired Columns across the remaining width */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3.5 lg:gap-x-5 gap-y-3 flex-1 min-w-0">
                {/* Col 1: Financials */}
                <Meta label="Gross" value={fmtMoney(trade.grossPnl)} monetary />
                {/* Col 2: Sizing & Timing */}
                <Meta label="Volume" value={fmtNumber(trade.quantity, 4)} />
                {/* Col 3: Price Entry */}
                <Meta label="Avg entry" value={fmtNumber(trade.avgEntry)} monetary />
                {/* Col 4: Planned Multiple */}
                <Meta
                  label="Planned R"
                  value={trade.plannedR === null ? "–" : `${fmtNumber(trade.plannedR)}R`}
                />
                {/* Col 5: Entry Time */}
                <Meta
                  label="Entry"
                  value={formatTimestamp(trade.openedAt, timeZone).slice(0, 16)}
                  className="text-xs sm:text-[13px]"
                />

                {/* Col 1 (bottom): Fees */}
                <Meta label="Fees" value={fmtMoney(trade.fees)} monetary />
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
                />
                {/* Col 5 (bottom): Exit Time */}
                <Meta
                  label="Exit"
                  value={
                    trade.closedAt ? formatTimestamp(trade.closedAt, timeZone).slice(0, 16) : "open"
                  }
                  className="text-xs sm:text-[13px]"
                />
              </div>
            </CardContent>
          </Card>

          <TimeframeScreenshotGrid date={dayKeyOf(trade.openedAt, timeZone)} />

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
        </div>

        <div className="min-w-0 space-y-3">
          <AnnotationsCard key={trade.key} trade={trade} timeZone={timeZone} onPatch={patch} />
          <RuleChecklist tradeKey={trade.key} playbookId={trade.playbookId} />
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>AI review</CardTitle>
              <Button variant="outline" size="sm" onClick={askCritique} disabled={aiBusy}>
                <Sparkles />
                {aiBusy ? "Thinking…" : "Critique this trade"}
              </Button>
            </CardHeader>
            {aiError && (
              <CardContent>
                <AiNotice
                  error={aiError}
                  onRetry={() => void askCritique()}
                  onDismiss={() => setAiError(null)}
                />
              </CardContent>
            )}
            {critique && (
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{critique}</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  monetary = false,
  className,
}: {
  label: string;
  value: string;
  monetary?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </div>
      <div
        className={cn(
          "tnum font-mono text-sm font-semibold text-foreground whitespace-nowrap",
          className,
        )}
      >
        {monetary ? <MonetaryValue>{value}</MonetaryValue> : value}
      </div>
    </div>
  );
}

function AnnotationsCard({
  trade,
  timeZone,
  onPatch,
}: {
  trade: TradeDetail;
  timeZone?: string;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(trade.notes ?? "");
  const [noteMode, setNoteMode] = useState<"preview" | "edit">(() =>
    Boolean(trade.notes?.trim()) ? "preview" : "edit",
  );
  const noteEditor = useRef<RichEditorHandle>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const safeParseArray = (raw: string | null | undefined): string[] => {
    try {
      return (JSON.parse(raw || "[]") as string[]) ?? [];
    } catch {
      return [];
    }
  };
  const [tags, setTags] = useState(safeParseArray(trade.tagsJson).join(", "));
  const [mistakes, setMistakes] = useState(safeParseArray(trade.mistakesJson).join(", "));
  const { data: playbookData } = useApi<{ playbooks: { id: string; name: string }[] }>(
    "/api/playbooks",
  );
  const {
    save: debounced,
    status: saveStatus,
    flush,
  } = useAutosave(`/api/trades/${encodeURIComponent(trade.key)}`, "PATCH", () => void onPatch({}));

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
      // Caught or reflected via saveStatus
    }
  };

  const isSaved = !isSaving && savedFeedback;

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const activeRating = hoverRating ?? trade.rating ?? 0;

  const reviewDoc = useMemo(() => {
    const subtitle = `${trade.direction.toUpperCase()} · ${trade.symbol} · ${trade.status.toUpperCase()}${timeZone ? ` (${timeZone})` : ""}`;
    const metaLines = [
      `Symbol: ${trade.symbol} | Direction: ${trade.direction.toUpperCase()} | Status: ${trade.status.toUpperCase()}`,
      `P&L: ${fmtMoney(trade.grossPnl, trade.currency)} (Net: ${fmtMoney(trade.netPnl, trade.currency)})`,
      trade.rating ? `Rating: ${trade.rating}/5 stars` : "",
      tags ? `Tags: ${tags}` : "",
      mistakes ? `Mistakes: ${mistakes}` : "",
    ].filter(Boolean);

    return {
      title: `Trade Review · ${trade.symbol}`,
      subtitle,
      lines: [...metaLines, "", "Notes:", notes || "(No notes)"],
    };
  }, [trade, timeZone, tags, mistakes, notes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Trade review</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating Section */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Rating</span>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Trade rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= activeRating;
              const isSelected = trade.rating !== null && star <= trade.rating;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                  onClick={() => void onPatch({ rating: trade.rating === star ? null : star })}
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
              checked={trade.reviewedAt !== null}
              onCheckedChange={(checked) => void onPatch({ reviewed: checked })}
              aria-label="Reviewed"
            />
            <div className="min-w-0">
              <span className="block text-xs sm:text-sm font-semibold text-foreground">
                Reviewed
              </span>
              <p className="text-[11px] text-muted-foreground truncate">
                Mark this trade as fully debriefed.
              </p>
            </div>
          </div>
        </div>

        {/* Playbook Selection */}
        <div className="space-y-1.5">
          <label
            htmlFor="trade-playbook-select"
            className="text-xs font-medium text-muted-foreground"
          >
            Playbook
          </label>
          <Select
            value={trade.playbookId ?? "none"}
            onValueChange={(value) => void onPatch({ playbookId: value === "none" ? null : value })}
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

        {/* Tags */}
        <div className="space-y-1.5">
          <label htmlFor="trade-tags-input" className="text-xs font-medium text-muted-foreground">
            Tags
          </label>
          <Input
            id="trade-tags-input"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              debounced({ tags: parseList(event.target.value) });
            }}
            placeholder="breakout, A+ setup"
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate tags with commas.</p>
        </div>

        {/* Mistakes */}
        <div className="space-y-1.5">
          <label
            htmlFor="trade-mistakes-input"
            className="text-xs font-medium text-muted-foreground"
          >
            Mistakes
          </label>
          <Input
            id="trade-mistakes-input"
            value={mistakes}
            onChange={(event) => {
              setMistakes(event.target.value);
              debounced({ mistakes: parseList(event.target.value) });
            }}
            placeholder="chased entry, moved stop"
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate mistakes with commas.</p>
        </div>

        {/* Notes with Rich Formatting (Title, Bold, Checklist, Templates, Preview) & Voice Dictation */}
        <div className="space-y-1.5">
          <label htmlFor="trade-notes-editor" className="text-xs font-medium text-muted-foreground">
            Notes
          </label>
          <RichEditor
            editorRef={noteEditor}
            value={notes}
            onChange={(value) => {
              setNotes(value);
              debounced({ notes: value });
            }}
            placeholder="What happened, and what should change next time?"
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
                  debounced({ notes: next });
                }}
              />
            }
          />

          {/* Footer with status caption on the left and actions (Export dropdown + Save/Edit button) on the right */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[11px] text-muted-foreground truncate">
              {isSaving
                ? "Saving note…"
                : isSaved
                  ? "Note is saved to local journal"
                  : isError
                    ? saveStatus
                    : "Annotations stay with this trade"}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <ReviewExport className="space-y-0" containsFinancialData document={reviewDoc} />

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
