"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Database,
  Layers,
  Calendar,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { MarketSeriesSummary, MarketCandleBatch } from "@/lib/market-csv";
import { formatResolutionDisplay, parseResolutionMs } from "@/lib/market-data";
import { SYMBOL_SPECS } from "@/lib/assets/symbol-specs";
import {
  getAssetFamily,
  getAssetClass,
  getDefaultCompatibleSymbols,
} from "@/lib/assets/symbol-utils";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface MarketDataManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  series: MarketSeriesSummary[];
  batches?: MarketCandleBatch[];
  onPurgeSeries: (symbol: string, resolution?: string) => Promise<void>;
  onRevertBatch: (batchId: string, batchName?: string) => Promise<void>;
  onUpdateCompatibleSymbols?: (symbol: string, compatibleSymbols: string[]) => Promise<void>;
}

export interface GroupedAssetSeries {
  symbol: string;
  displayName: string;
  currency: string;
  priceBasis: string;
  compatibleSymbols: string[];
  totalBars: number;
  timeframes: MarketSeriesSummary[];
}

export function formatDateHuman(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

export function formatSeriesRange(firstTime?: number, lastTime?: number): string {
  if (!firstTime || !lastTime || !Number.isFinite(firstTime) || !Number.isFinite(lastTime)) {
    return "—";
  }
  return `${formatDateHuman(firstTime)} → ${formatDateHuman(lastTime)}`;
}

export function formatChunkCanonical(batch: {
  firstTime?: number;
  lastTime?: number;
  barCount?: number;
}): string {
  const range = formatSeriesRange(batch.firstTime, batch.lastTime);
  const bars =
    typeof batch.barCount === "number" ? ` (${batch.barCount.toLocaleString()} bars)` : "";
  return `Chunk · ${range}${bars}`;
}

export function formatBatchTitle(batch: {
  symbol: string;
  resolution: string;
  firstTime?: number;
  lastTime?: number;
}): string {
  const displayRes = formatResolutionDisplay(batch.resolution);
  return `${batch.symbol} · ${displayRes} │ ${formatSeriesRange(batch.firstTime, batch.lastTime)}`;
}

export function formatBatchMetrics(batch: {
  newBarCount?: number;
  duplicateBarCount?: number;
  barCount?: number;
}): string {
  const newCount = (batch.newBarCount ?? 0).toLocaleString();
  const dupCount = (batch.duplicateBarCount ?? 0).toLocaleString();
  const totalCount = (batch.barCount ?? 0).toLocaleString();
  return `+${newCount} new · ${dupCount} duplicates · ${totalCount} total`;
}

export function formatBatchImportDate(importedAt?: string | number | Date | null): string {
  if (!importedAt) return "—";
  const d = new Date(importedAt);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export const RESOLUTION_ORDER: Record<string, number> = {
  "1m": 1,
  "2m": 2,
  "3m": 3,
  "5m": 4,
  "10m": 5,
  "15m": 6,
  "30m": 7,
  "45m": 8,
  "1h": 9,
  "2h": 10,
  "3h": 11,
  "4h": 12,
  "6h": 13,
  "8h": 14,
  "12h": 15,
  "1d": 16,
  "3d": 17,
  "1w": 18,
  "1mo": 19,
};

export function groupAssetSeries(series: MarketSeriesSummary[]): GroupedAssetSeries[] {
  const map = new Map<string, GroupedAssetSeries>();

  for (const s of series) {
    const sym = s.symbol.toUpperCase();
    const spec = SYMBOL_SPECS[sym];
    const fam = getAssetFamily(sym);

    if (!map.has(sym)) {
      const compatibleSymbols = Array.isArray(s.compatibleSymbols)
        ? s.compatibleSymbols
        : getDefaultCompatibleSymbols(sym);

      map.set(sym, {
        symbol: sym,
        displayName: spec?.name ?? fam?.name ?? sym,
        currency: s.currency || "USD",
        priceBasis: s.priceBasis || "raw",
        compatibleSymbols: compatibleSymbols.filter((x) => x !== sym),
        totalBars: 0,
        timeframes: [],
      });
    }

    const entry = map.get(sym)!;
    entry.totalBars += s.barCount;
    entry.timeframes.push(s);
  }

  for (const asset of map.values()) {
    asset.timeframes.sort((a, b) => {
      const msA = parseResolutionMs(a.resolution);
      const msB = parseResolutionMs(b.resolution);
      if (msA !== msB) return msA - msB;
      const orderA = RESOLUTION_ORDER[a.resolution.toLowerCase()] ?? 999;
      const orderB = RESOLUTION_ORDER[b.resolution.toLowerCase()] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.resolution.localeCompare(b.resolution);
    });
  }

  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function MarketDataManagerDialog({
  isOpen,
  onClose,
  series = [],
  batches = [],
  onPurgeSeries,
  onRevertBatch,
  onUpdateCompatibleSymbols,
}: MarketDataManagerDialogProps) {
  const [activeTab, setActiveTab] = useState<"assets" | "batches">("assets");
  const [purgingKey, setPurgingKey] = useState<string | null>(null);
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Custom links override map per symbol (for optimistic local updates)
  const [customLinks, setCustomLinks] = useState<Record<string, string[]>>({});
  const [addingSymbolFor, setAddingSymbolFor] = useState<string | null>(null);
  const [newTickerInput, setNewTickerInput] = useState("");
  const [classFilter, setClassFilter] = useState<"all" | "futures" | "cfd" | "forex" | "crypto">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const groupedAssets: GroupedAssetSeries[] = useMemo(() => {
    return groupAssetSeries(series);
  }, [series]);

  // Asset class counts
  const classCounts = useMemo(() => {
    const counts = { all: groupedAssets.length, futures: 0, cfd: 0, forex: 0, crypto: 0 };
    for (const a of groupedAssets) {
      const cls = getAssetClass(a.symbol);
      if (cls === "futures") counts.futures++;
      else if (cls === "cfd" || cls === "commodities") counts.cfd++;
      else if (cls === "forex") counts.forex++;
      else if (cls === "crypto") counts.crypto++;
    }
    return counts;
  }, [groupedAssets]);

  // Filtered assets by class and search query
  const filteredAssets = useMemo(() => {
    return groupedAssets.filter((asset) => {
      if (classFilter !== "all") {
        const cls = getAssetClass(asset.symbol);
        if (classFilter === "futures" && cls !== "futures") return false;
        if (classFilter === "cfd" && cls !== "cfd" && cls !== "commodities") return false;
        if (classFilter === "forex" && cls !== "forex") return false;
        if (classFilter === "crypto" && cls !== "crypto") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const activeComp = customLinks[asset.symbol] ?? asset.compatibleSymbols;
        const matchSymbol = asset.symbol.toLowerCase().includes(q);
        const matchName = asset.displayName.toLowerCase().includes(q);
        const matchComp = activeComp.some((c) => c.toLowerCase().includes(q));
        if (!matchSymbol && !matchName && !matchComp) return false;
      }
      return true;
    });
  }, [groupedAssets, classFilter, searchQuery, customLinks]);

  // Asset Accordion expansion state
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(() => new Set());
  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);

  useEffect(() => {
    if (!hasInitializedExpansion && groupedAssets.length > 0) {
      setExpandedAssets(new Set(groupedAssets.map((a) => a.symbol)));
      setHasInitializedExpansion(true);
    }
  }, [groupedAssets, hasInitializedExpansion]);

  const toggleAssetExpanded = (sym: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) {
        next.delete(sym);
      } else {
        next.add(sym);
      }
      return next;
    });
  };

  const handleRemoveCompatibleSymbol = async (sym: string, tickerToRemove: string) => {
    const current = customLinks[sym] ?? groupedAssets.find((a) => a.symbol === sym)?.compatibleSymbols ?? [];
    const updated = current.filter((t) => t !== tickerToRemove);
    const persisted = [sym, ...updated];
    setCustomLinks((prev) => ({ ...prev, [sym]: updated }));
    setFeedback(`Unlinked [${tickerToRemove}] from ${sym}.`);
    try {
      if (onUpdateCompatibleSymbols) {
        await onUpdateCompatibleSymbols(sym, persisted);
      } else {
        await postJson("/api/market-data/csv", {
          action: "update_compatible_symbols",
          symbol: sym,
          compatibleSymbols: persisted,
        });
      }
    } catch {
      setCustomLinks((prev) => ({ ...prev, [sym]: current }));
      setFeedback("Failed to update compatible symbols.");
    }
  };

  const handleAddCompatibleSymbol = async (sym: string, tickerToAdd: string) => {
    const clean = tickerToAdd.trim().toUpperCase();
    if (!clean) return;
    const current = customLinks[sym] ?? groupedAssets.find((a) => a.symbol === sym)?.compatibleSymbols ?? [];
    if (current.includes(clean) || clean === sym) {
      setNewTickerInput("");
      setAddingSymbolFor(null);
      return;
    }
    const updated = [...current, clean];
    const persisted = [sym, ...updated];
    setCustomLinks((prev) => ({ ...prev, [sym]: updated }));
    setNewTickerInput("");
    setAddingSymbolFor(null);
    setFeedback(`Linked [${clean}] to ${sym}.`);
    try {
      if (onUpdateCompatibleSymbols) {
        await onUpdateCompatibleSymbols(sym, persisted);
      } else {
        await postJson("/api/market-data/csv", {
          action: "update_compatible_symbols",
          symbol: sym,
          compatibleSymbols: persisted,
        });
      }
    } catch {
      setCustomLinks((prev) => ({ ...prev, [sym]: current }));
      setFeedback("Failed to update compatible symbols.");
    }
  };

  const handleIsolateAssetClass = async (sym: string) => {
    const cls = getAssetClass(sym);
    const current = customLinks[sym] ?? groupedAssets.find((a) => a.symbol === sym)?.compatibleSymbols ?? [];
    const updated =
      cls === "futures"
        ? current.filter((t) => getAssetClass(t) === "futures")
        : current.filter((t) => getAssetClass(t) !== "futures");
    const persisted = [sym, ...updated];

    setCustomLinks((prev) => ({ ...prev, [sym]: updated }));
    setFeedback(`Isolated ${sym} strictly from ${cls === "futures" ? "CFDs / Spot" : "Futures"}.`);
    try {
      if (onUpdateCompatibleSymbols) {
        await onUpdateCompatibleSymbols(sym, persisted);
      } else {
        await postJson("/api/market-data/csv", {
          action: "update_compatible_symbols",
          symbol: sym,
          compatibleSymbols: persisted,
        });
      }
    } catch {
      setCustomLinks((prev) => ({ ...prev, [sym]: current }));
      setFeedback("Failed to update compatible symbols.");
    }
  };

  const handleConfirmPurge = async (symbol: string, resolution?: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onPurgeSeries(symbol, resolution);
      setPurgingKey(null);
      setFeedback(
        resolution
          ? `All bars for ${symbol} (${resolution}) were purged successfully.`
          : `All bars for ${symbol} were purged successfully.`,
      );
    } catch {
      setFeedback("Failed to purge series bars from database.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevertBatch = async (batchId: string, batchName?: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onRevertBatch(batchId, batchName);
      setRevertingBatchId(null);
      setFeedback("Batch reverted and removed from database successfully.");
    } catch {
      setFeedback("Failed to revert batch.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#151619] border border-[#2a2b30] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* TOP HEADER */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#2a2b30] bg-[#121316] shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#089981]" />
            <h3 className="text-sm font-semibold text-[#d1d4dc] tracking-tight">
              Manage Market Data
            </h3>
            <span className="text-[11px] font-mono text-[#868a96] px-2 py-0.5 rounded-full bg-[#1c1d22] border border-[#2a2b30]">
              market_candles
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#202228] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NAVIGATION RAIL */}
        <div className="h-10 px-4 flex items-center gap-1 border-b border-[#2a2b30] bg-[#151619] text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={cn(
              "h-8 px-3 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === "assets"
                ? "bg-[#202228] text-[#d1d4dc] shadow-xs"
                : "text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#1a1b20]",
            )}
          >
            <Layers className="w-3.5 h-3.5 text-[#089981]" />
            <span>Assets & Coverage ({groupedAssets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            className={cn(
              "h-8 px-3 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === "batches"
                ? "bg-[#202228] text-[#d1d4dc] shadow-xs"
                : "text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#1a1b20]",
            )}
          >
            <Calendar className="w-3.5 h-3.5 text-[#868a96]" />
            <span>Ingestion History ({batches.length})</span>
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className="px-4 py-2 bg-[#089981]/10 border-b border-[#089981]/20 flex items-center justify-between text-xs text-[#089981]">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="hover:opacity-75 cursor-pointer"
              aria-label="Dismiss feedback"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "assets" ? (
            groupedAssets.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
                <Database className="w-8 h-8 text-[#868a96]/40 mx-auto" />
                <p className="text-xs font-medium text-[#d1d4dc]">
                  No market assets indexed yet. Upload a CSV file in settings to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* FILTER & SEARCH TOOLBAR */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    {(
                      [
                        { id: "all", label: "All", count: classCounts.all },
                        { id: "futures", label: "Futures (CME)", count: classCounts.futures },
                        { id: "cfd", label: "CFD & Spot", count: classCounts.cfd },
                        { id: "forex", label: "Forex", count: classCounts.forex },
                        { id: "crypto", label: "Crypto", count: classCounts.crypto },
                      ] as const
                    ).map((cat) => {
                      const isActive = classFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setClassFilter(cat.id)}
                          className={cn(
                            "h-7 px-2.5 rounded-md font-medium text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer",
                            isActive
                              ? "bg-[#202228] text-[#d1d4dc] border border-[#2a2b30] shadow-xs"
                              : "text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#1a1b20]",
                          )}
                        >
                          <span>{cat.label}</span>
                          <span className="font-mono text-[10px] text-[#868a96]">({cat.count})</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#868a96]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search asset..."
                      className="h-7 w-40 sm:w-48 pl-8 pr-6 rounded-md bg-[#17181c] border border-[#2a2b30] text-xs text-[#d1d4dc] placeholder:text-[#868a96] focus:outline-none focus:border-[#089981]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {filteredAssets.length === 0 ? (
                  <div className="py-8 text-center space-y-1 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
                    <p className="text-xs font-medium text-[#d1d4dc]">
                      No assets match the selected filter or search query.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setClassFilter("all");
                        setSearchQuery("");
                      }}
                      className="text-[11px] text-[#089981] hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filteredAssets.map((asset) => {
                    const isExpanded = expandedAssets.has(asset.symbol);
                    const activeCompatible = customLinks[asset.symbol] ?? asset.compatibleSymbols;
                    const assetClass = getAssetClass(asset.symbol);

                    return (
                      <div
                        key={asset.symbol}
                        className="border border-[#2a2b30] rounded-xl bg-[#121316] overflow-hidden transition-all duration-150"
                      >
                        {/* ASSET ACCORDION HEADER */}
                        <div
                          onClick={() => toggleAssetExpanded(asset.symbol)}
                          className="px-4 py-3 bg-[#17181c] border-b border-[#2a2b30] flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-[#1c1d22]/80 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-[#089981]/15 border border-[#089981]/30 text-xs font-mono font-bold text-[#089981]">
                              {asset.symbol}
                            </span>
                            {/* Asset Class Badge */}
                            {assetClass === "futures" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 font-mono font-medium">
                                Futures · CME
                              </span>
                            ) : assetClass === "cfd" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/25 text-blue-400 font-mono font-medium">
                                CFD Spot · Index
                              </span>
                            ) : assetClass === "commodities" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/25 text-blue-400 font-mono font-medium">
                                CFD Spot · Commodity
                              </span>
                            ) : assetClass === "forex" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-400 font-mono font-medium">
                                Forex FX
                              </span>
                            ) : assetClass === "crypto" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono font-medium">
                                Crypto
                              </span>
                            ) : null}
                            <span className="text-xs font-semibold text-[#d1d4dc]">
                              {asset.displayName}
                            </span>
                            <span className="text-[11px] font-mono text-[#868a96]">
                              {asset.currency} · {asset.priceBasis}
                            </span>
                            {/* Quick timeframe badges */}
                            <div className="flex items-center gap-1 ml-1 flex-wrap">
                              {asset.timeframes.map((tf) => (
                                <span
                                  key={tf.resolution}
                                  className="bg-[#1c1d22] text-[#d1d4dc] text-[10px] px-1.5 py-0.5 rounded border border-[#2a2b30] font-mono font-medium"
                                >
                                  {formatResolutionDisplay(tf.resolution)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-mono text-[#868a96]">
                              Total:{" "}
                              <strong className="text-[#d1d4dc] font-semibold">
                                {asset.totalBars.toLocaleString()}
                              </strong>{" "}
                              bars
                            </span>

                            {purgingKey === asset.symbol ? (
                              <div
                                className="flex items-center gap-1.5 ml-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleConfirmPurge(asset.symbol)}
                                  disabled={busy}
                                  className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[11px] font-medium cursor-pointer transition-colors"
                                >
                                  Confirm Purge
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPurgingKey(null)}
                                  className="px-2 py-0.5 text-[11px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPurgingKey(asset.symbol);
                                }}
                                className="p-1 rounded text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-colors cursor-pointer"
                                title={`Purge all bars for ${asset.symbol}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAssetExpanded(asset.symbol);
                              }}
                              className="p-1 rounded text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#202228] transition-colors cursor-pointer"
                              aria-label={isExpanded ? "Collapse asset" : "Expand asset"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* EXPANDED CONTENT */}
                        {isExpanded && (
                          <div>
                            {/* COMPATIBILITY NOTICE CHIPS */}
                            <div className="px-4 py-2.5 bg-[#141518] border-b border-[#202228] flex items-center justify-between gap-2 text-[10px] text-[#868a96] flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-[#868a96]">Compatible with:</span>
                                {activeCompatible.length === 0 ? (
                                  <span className="italic text-[#868a96]/70">Strictly isolated (no other tickers linked)</span>
                                ) : (
                                  activeCompatible.map((item) => (
                                    <span
                                      key={item}
                                      className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1c1d22] border border-[#2a2b30] text-[#d1d4dc] font-mono text-[10px]"
                                    >
                                      <span>[{item}]</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleRemoveCompatibleSymbol(asset.symbol, item);
                                        }}
                                        disabled={busy}
                                        className="text-[#868a96] hover:text-[#f23645] transition-colors cursor-pointer"
                                        title={`Unlink ${item} from ${asset.symbol}`}
                                        aria-label={`Unlink ${item}`}
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  ))
                                )}

                                {/* Mini Add Ticker Inline Input */}
                                {addingSymbolFor === asset.symbol ? (
                                  <div
                                    className="inline-flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="text"
                                      value={newTickerInput}
                                      onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          void handleAddCompatibleSymbol(asset.symbol, newTickerInput);
                                        } else if (e.key === "Escape") {
                                          setAddingSymbolFor(null);
                                          setNewTickerInput("");
                                        }
                                      }}
                                      placeholder="TICKER"
                                      autoFocus
                                      className="h-5 w-16 px-1 rounded bg-[#17181c] border border-[#089981] text-[10px] font-mono text-[#d1d4dc] focus:outline-none uppercase"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddCompatibleSymbol(asset.symbol, newTickerInput)}
                                      disabled={busy || !newTickerInput.trim()}
                                      className="h-5 px-1.5 rounded bg-[#089981]/20 hover:bg-[#089981]/30 text-[#089981] text-[10px] font-medium cursor-pointer"
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingSymbolFor(null);
                                        setNewTickerInput("");
                                      }}
                                      className="h-5 px-1 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddingSymbolFor(asset.symbol);
                                      setNewTickerInput("");
                                    }}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-dashed border-[#2a2b30] hover:border-[#089981]/40 text-[#868a96] hover:text-[#089981] text-[10px] cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>Add Ticker</span>
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleIsolateAssetClass(asset.symbol);
                                  }}
                                  disabled={busy}
                                  className="text-[10px] text-[#868a96] hover:text-[#089981] transition-colors cursor-pointer flex items-center gap-1"
                                  title={`Isolate ${asset.symbol} from cross-asset class fallback`}
                                >
                                  <ShieldCheck className="w-3 h-3 text-[#089981]" />
                                  <span>Isolate {assetClass === "futures" ? "from CFDs" : "from Futures"}</span>
                                </button>
                              </div>
                            </div>

                          {/* TIMEFRAME ROWS */}
                          <div className="divide-y divide-[#202228]">
                            {asset.timeframes.map((tf) => {
                              const tfKey = `${asset.symbol}__${tf.resolution}`;
                              const isPurgingTf = purgingKey === tfKey;
                              const tfBatches = batches.filter(
                                (b) =>
                                  b.symbol.toUpperCase() === asset.symbol.toUpperCase() &&
                                  b.resolution.toLowerCase() === tf.resolution.toLowerCase(),
                              );

                              return (
                                <div
                                  key={tf.resolution}
                                  className="px-4 py-3 hover:bg-[#151619] transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className="w-10 text-center font-mono font-bold text-[#d1d4dc] bg-[#1c1d22] py-0.5 rounded border border-[#2a2b30] text-[11px]">
                                        {formatResolutionDisplay(tf.resolution)}
                                      </span>
                                      <span className="font-mono text-[#d1d4dc] text-[12px]">
                                        {tf.barCount.toLocaleString()} bars
                                      </span>
                                      <span className="text-[11px] text-[#868a96] font-mono">
                                        │ {formatSeriesRange(tf.firstTime, tf.lastTime)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isPurgingTf ? (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleConfirmPurge(asset.symbol, tf.resolution)
                                            }
                                            disabled={busy}
                                            className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[10px] font-medium cursor-pointer"
                                          >
                                            Confirm Purge
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPurgingKey(null)}
                                            className="px-2 py-0.5 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setPurgingKey(tfKey)}
                                          className="px-2 py-1 rounded text-[11px] text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-colors flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>
                                            Purge {formatResolutionDisplay(tf.resolution)}
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Ingestion Chunks associated with this timeframe */}
                                  {tfBatches.length > 0 && (
                                    <div className="mt-2 pl-4 border-l-2 border-[#202228] space-y-1">
                                      {tfBatches.map((b) => (
                                        <div
                                          key={b.id}
                                          className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#868a96] bg-[#17181c]/60 rounded px-2.5 py-1 border border-[#202228]"
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className="text-[#d1d4dc]">
                                              {formatChunkCanonical(b)}
                                            </span>
                                            {b.name && (
                                              <span className="text-[10px] text-[#868a96] truncate">
                                                (source: {b.name})
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-[#089981] shrink-0 font-sans">
                                            +{b.newBarCount.toLocaleString()} new
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }))}
              </div>
            )
          ) : batches.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
              <Calendar className="w-8 h-8 text-[#868a96]/40 mx-auto" />
              <p className="text-xs font-medium text-[#d1d4dc]">
                No ingestion chunks recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => {
                const isReverting = revertingBatchId === batch.id;

                return (
                  <div
                    key={batch.id}
                    className="p-3 border border-[#2a2b30] rounded-xl bg-[#121316] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-[#1c1d22] border border-[#2a2b30] font-mono font-bold text-[#d1d4dc] text-[11px]">
                          {batch.symbol} · {formatResolutionDisplay(batch.resolution)}
                        </span>
                        <span className="font-mono text-[#d1d4dc] font-medium text-xs">
                          Chunk: {formatSeriesRange(batch.firstTime, batch.lastTime)}
                        </span>
                        {batch.name && (
                          <span className="text-[11px] text-[#868a96] font-mono">
                            (source: {batch.name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#868a96] font-mono flex-wrap">
                        <span>{formatBatchImportDate(batch.importedAt)}</span>
                        <span>│</span>
                        <span className="text-[#089981]">
                          +{batch.newBarCount.toLocaleString()} new
                        </span>
                        <span>│</span>
                        <span>{batch.duplicateBarCount.toLocaleString()} duplicates</span>
                        <span>│</span>
                        <span>{batch.barCount.toLocaleString()} total</span>
                      </div>
                    </div>

                    <div>
                      {isReverting ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmRevertBatch(batch.id, batch.name)}
                            disabled={busy}
                            className="px-2.5 py-1 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-xs font-medium cursor-pointer"
                          >
                            Confirm Revert
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevertingBatchId(null)}
                            className="px-2.5 py-1 text-xs text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevertingBatchId(batch.id)}
                          className="px-2.5 py-1 rounded border border-[#2a2b30] bg-[#17181c] hover:bg-[#202228] text-[#868a96] hover:text-[#f23645] text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Revert Chunk</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM FOOTER */}
        <div className="h-12 px-4 border-t border-[#2a2b30] bg-[#121316] flex items-center justify-between text-xs text-[#868a96] shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#089981]" />
            <span>Continuous SQLite storage with UTC deduplication</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md bg-[#202228] hover:bg-[#2a2e39] text-[#d1d4dc] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
