"use client";
import { AiNotice } from "@/components/ai-notice";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { ReviewExport } from "@/components/review-export";

import Link from "next/link";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, Save, Sparkles, Star } from "lucide-react";
import type { IntradayPoint, TradeMetrics } from "@luxalgo/journal-core";
import { EquityArea } from "@/components/charts/equity-area";
import { FilterBar, useFilters } from "@/components/filter-bar";
import { Pnl } from "@/components/pnl";
import { MonetaryValue } from "@/components/privacy";
import { VoiceNote } from "@/components/voice-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeframeScreenshotGrid } from "@/components/screenshots/timeframe-screenshot-grid";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DirectionBadge } from "@/components/ui/direction-badge";
import { JournalHeaderAssetBadges } from "@/components/journal-header-asset-badges";
import { useAutosave } from "@/lib/use-autosave";
import { postJson, useApi } from "@/lib/use-api";
import { cn, fmtMoney, fmtNumber, fmtPercent } from "@/lib/utils";

interface TradeRowLite {
  key: string;
  symbol: string;
  direction: string;
  status: string;
  netPnl: number;
  quantity: number;
  avgEntry: number;
  avgExit: number | null;
  fees: number;
}

interface DayPayload {
  date: string;
  metrics: TradeMetrics;
  trades: TradeRowLite[];
  intraday: IntradayPoint[];
  note: string;
  rating: number | null;
  reviewedAt: string | null;
  tagsJson: string | null;
  mistakesJson: string | null;
}

export default function JournalDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  return (
    <Suspense>
      <JournalDay key={date} date={date} />
    </Suspense>
  );
}

function JournalDay({ date }: { date: string }) {
  const { query } = useFilters();
  const { data, error, refresh } = useApi<DayPayload>(`/api/journal/${date}?${query}`);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRecap, setAiRecap] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      await postJson(`/api/journal/${date}`, body, "PATCH");
      refresh();
    },
    [date, refresh],
  );

  const generateRecap = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await postJson<{ recap: string }>(`/api/ai/recap`, { date });
      setAiRecap(result.recap);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI recap failed");
    } finally {
      setAiBusy(false);
    }
  };

  const m = data?.metrics;

  return (
    <div>
      <FilterBar title={`Journal · ${date}`} />
      <div className="grid gap-3 p-4 xl:grid-cols-3">
        {/* Left Column: Stats (if trades exist), Screenshots, Trades */}
        <div className="min-w-0 space-y-3 xl:col-span-2">
          {m && m.closedTrades > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Day stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 2xl:grid-cols-5">
                <Stat label="Net P&L">
                  <Pnl value={m.netPnl} className="font-semibold" />
                </Stat>
                <Stat label="Trades">{m.closedTrades}</Stat>
                <Stat label="Winrate">{fmtPercent(m.winRate)}</Stat>
                <Stat label="Winners">{m.wins}</Stat>
                <Stat label="Losers">{m.losses}</Stat>
                <Stat label="Gross">
                  <MonetaryValue>{fmtMoney(m.grossPnl)}</MonetaryValue>
                </Stat>
                <Stat label="Fees">
                  <MonetaryValue>{fmtMoney(m.fees)}</MonetaryValue>
                </Stat>
                <Stat label="Volume">{fmtNumber(m.totalVolume, 0)}</Stat>
                <Stat label="Profit factor">
                  {m.profitFactorIsInfinite
                    ? "∞"
                    : m.profitFactor === null
                      ? "–"
                      : fmtNumber(m.profitFactor)}
                </Stat>
                <Stat label="Expectancy">
                  <MonetaryValue>
                    {m.expectancy === null ? "–" : fmtMoney(m.expectancy)}
                  </MonetaryValue>
                </Stat>
              </CardContent>
            </Card>
          )}

          {data && data.intraday.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Intraday cumulative net P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <EquityArea
                  data={data.intraday.map((p) => ({
                    t: p.t.slice(11, 16),
                    cumNetPnl: p.cumNetPnl,
                  }))}
                  height={200}
                />
              </CardContent>
            </Card>
          )}

          <TimeframeScreenshotGrid date={date} />

          {data && data.trades.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2.5">
                  <span>Trades</span>
                  <JournalHeaderAssetBadges trades={data.trades} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.trades.map((trade) => (
                  <Link
                    key={trade.key}
                    href={`/trades/${encodeURIComponent(trade.key)}?${query}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                  >
                    <span className="flex items-center gap-2.5">
                      <Badge
                        variant={
                          trade.status === "win"
                            ? "profit"
                            : trade.status === "loss"
                              ? "loss"
                              : "secondary"
                        }
                      >
                        {trade.status.toUpperCase()}
                      </Badge>
                      <AssetIcon symbol={trade.symbol} size="sm" />
                      <span className="font-semibold">{trade.symbol}</span>
                      <DirectionBadge direction={trade.direction} size="xs" />
                    </span>
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                      <span className="tnum text-xs text-muted-foreground">
                        {fmtNumber(trade.quantity, 4)} @{" "}
                        <MonetaryValue>{fmtNumber(trade.avgEntry)}</MonetaryValue>
                        {trade.avgExit !== null && (
                          <>
                            {" "}
                            → <MonetaryValue>{fmtNumber(trade.avgExit)}</MonetaryValue>
                          </>
                        )}
                      </span>
                      <Pnl value={trade.netPnl} />
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {!data && <Skeleton className="h-64" />}
        </div>

        {/* Right Column: Modern Day Review + AI Review Card */}
        <div className="min-w-0 space-y-3">
          {data ? (
            <DayReviewCard key={date} date={date} data={data} query={query} onPatch={patch} />
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-destructive" role="alert">
                {error}
              </CardContent>
            </Card>
          ) : (
            <Skeleton className="h-96" />
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400" />
                <span>AI session review</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={generateRecap}
                disabled={aiBusy || !data}
                className="gap-1.5 rounded-xl text-xs font-medium"
              >
                {aiBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 text-amber-400" />
                )}
                {aiBusy ? "Writing…" : "AI recap"}
              </Button>
            </CardHeader>
            {aiError && (
              <CardContent>
                <AiNotice
                  error={aiError}
                  onRetry={() => void generateRecap()}
                  onDismiss={() => setAiError(null)}
                />
              </CardContent>
            )}
            {aiRecap ? (
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {aiRecap}
                </p>
                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const baseNote = data?.note ?? "";
                      const merged = baseNote ? `${baseNote}\n\n---\n\n${aiRecap}` : aiRecap;
                      void patch({ note: merged });
                    }}
                    className="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span>+ Append recap to day notes</span>
                  </Button>
                </div>
              </CardContent>
            ) : (
              !aiBusy &&
              !aiError && (
                <CardContent className="py-5 text-center text-xs text-muted-foreground">
                  Generate an AI debrief of this trading session, execution discipline, and key
                  takeaways.
                </CardContent>
              )
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function DayReviewCard({
  date,
  data,
  query,
  onPatch,
}: {
  date: string;
  data: DayPayload;
  query: string;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(data.note ?? "");
  const [noteMode, setNoteMode] = useState<"preview" | "edit">(() =>
    Boolean(data.note?.trim()) ? "preview" : "edit",
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

  const [tags, setTags] = useState(safeParseArray(data.tagsJson).join(", "));
  const [mistakes, setMistakes] = useState(safeParseArray(data.mistakesJson).join(", "));

  // Keep notes in sync if changed from external (e.g. AI append)
  useEffect(() => {
    if (data.note !== undefined && data.note !== notes) {
      setNotes(data.note);
    }
  }, [data.note]);

  const {
    save: debounced,
    status: saveStatus,
    flush,
  } = useAutosave(`/api/journal/${date}`, "PATCH", () => void onPatch({}));

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

  const activeRating = hoverRating ?? data.rating ?? 0;
  const m = data.metrics;

  const reviewDoc = useMemo(() => {
    const subtitle = `Daily Review · ${date}${query ? ` · Filters: ${query}` : ""}`;
    const metaLines = [
      m
        ? `Trades: ${m.closedTrades} | Winrate: ${fmtPercent(m.winRate)} | Net P&L: ${fmtMoney(m.netPnl)}`
        : "",
      data.rating ? `Rating: ${data.rating}/5 stars` : "",
      data.reviewedAt ? `Reviewed: Yes (${data.reviewedAt.slice(0, 10)})` : "",
      tags ? `Tags: ${tags}` : "",
      mistakes ? `Mistakes: ${mistakes}` : "",
    ].filter(Boolean);

    return {
      title: `Daily Review · ${date}`,
      subtitle,
      lines: [...metaLines, "", "Notes:", notes || "(No notes)"],
    };
  }, [date, query, m, data.rating, data.reviewedAt, tags, mistakes, notes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Day review</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating Section */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Rating</span>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Day rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= activeRating;
              const isSelected = data.rating !== null && star <= data.rating;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
                  onClick={() => void onPatch({ rating: data.rating === star ? null : star })}
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
              checked={data.reviewedAt !== null}
              onCheckedChange={(checked) => void onPatch({ reviewed: checked })}
              aria-label="Reviewed"
            />
            <div className="min-w-0">
              <span className="block text-xs sm:text-sm font-semibold text-foreground">
                Reviewed
              </span>
              <p className="text-[11px] text-muted-foreground truncate">
                Mark this day as fully debriefed.
              </p>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label htmlFor="day-tags-input" className="text-xs font-medium text-muted-foreground">
            Tags
          </label>
          <Input
            id="day-tags-input"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              debounced({ tags: parseList(event.target.value) });
            }}
            placeholder="trend day, FOMC, high volatility"
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate tags with commas.</p>
        </div>

        {/* Mistakes */}
        <div className="space-y-1.5">
          <label htmlFor="day-mistakes-input" className="text-xs font-medium text-muted-foreground">
            Mistakes
          </label>
          <Input
            id="day-mistakes-input"
            value={mistakes}
            onChange={(event) => {
              setMistakes(event.target.value);
              debounced({ mistakes: parseList(event.target.value) });
            }}
            placeholder="chased entry, overtrading, sized too large"
            className="h-9 rounded-xl text-xs"
          />
          <p className="text-[11px] text-muted-foreground">Separate mistakes with commas.</p>
        </div>

        {/* Notes with Rich Formatting & Voice Dictation */}
        <div className="space-y-1.5">
          <label htmlFor="day-notes-editor" className="text-xs font-medium text-muted-foreground">
            Notes
          </label>
          <RichEditor
            editorRef={noteEditor}
            value={notes}
            onChange={(value) => {
              setNotes(value);
              debounced({ note: value });
            }}
            placeholder="What happened in this session, and what should change next time?"
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
                  debounced({ note: next });
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
                    : "Annotations stay with this day"}
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum">{children}</div>
    </div>
  );
}
