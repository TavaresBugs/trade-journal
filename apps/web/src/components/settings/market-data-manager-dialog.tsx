"use client";

import React, { useState, useMemo } from "react";
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
  ChevronRight,
  Search,
  Plus,
  ShieldCheck,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import type { MarketSeriesSummary, MarketCandleBatch } from "@/lib/market-csv";
import { formatResolutionDisplay, parseResolutionMs } from "@/lib/market-data";
import { SYMBOL_SPECS } from "@/lib/assets/symbol-specs";
import {
  getAssetFamily,
  getAssetClass,
  getDefaultCompatibleSymbols,
  type AssetClass,
} from "@/lib/assets/symbol-utils";
import { AssetIcon } from "@/components/ui/asset-icon";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const CANONICAL_COVERAGE_TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "1d",
  "1w",
  "1mo",
] as const;

function getCategoryMarketLabel(assetClass: AssetClass): string {
  switch (assetClass) {
    case "futures":
      return "CME";
    case "cfd":
      return "CFD";
    case "commodities":
      return "CFD · Commodity";
    case "forex":
      return "Forex";
    case "crypto":
      return "Crypto";
    default:
      return "Market";
  }
}

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
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [expandedSettings, setExpandedSettings] = useState<Set<string>>(() => new Set());
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);
  const [revertingSessionKey, setRevertingSessionKey] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
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

  // Filtered & session-grouped ingestion history batches
  const groupedHistorySessions = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    const filtered = !q
      ? batches
      : batches.filter((b) => {
          const matchSym = b.symbol.toLowerCase().includes(q);
          const matchTf = formatResolutionDisplay(b.resolution).toLowerCase().includes(q);
          const matchName = (b.name ?? "").toLowerCase().includes(q);
          return matchSym || matchTf || matchName;
        });

    const groupsMap = new Map<
      string,
      {
        sessionKey: string;
        sessionLabel: string;
        batches: MarketCandleBatch[];
        totalNewBars: number;
        totalBars: number;
      }
    >();

    for (const b of filtered) {
      const rawDate = formatBatchImportDate(b.importedAt);
      const sessionLabel = rawDate === "—" ? "Unknown session" : rawDate.replace(", ", " · ");
      if (!groupsMap.has(sessionLabel)) {
        groupsMap.set(sessionLabel, {
          sessionKey: sessionLabel,
          sessionLabel,
          batches: [],
          totalNewBars: 0,
          totalBars: 0,
        });
      }
      const g = groupsMap.get(sessionLabel)!;
      g.batches.push(b);
      g.totalNewBars += b.newBarCount ?? 0;
      g.totalBars += b.barCount ?? 0;
    }

    return Array.from(groupsMap.values());
  }, [batches, historySearchQuery]);

  // Asset Accordion expansion state (collapsed by default for clean overview)
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(() => new Set());

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

  const toggleSettingsExpanded = (sym: string) => {
    setExpandedSettings((prev) => {
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

  const handleConfirmRevertSession = async (sessionBatches: MarketCandleBatch[]) => {
    setBusy(true);
    setFeedback(null);
    try {
      for (const b of sessionBatches) {
        await onRevertBatch(b.id, b.name);
      }
      setRevertingSessionKey(null);
      setFeedback(
        `Reverted import session (${sessionBatches.length} ${sessionBatches.length === 1 ? "file" : "files"} removed).`,
      );
    } catch {
      setFeedback("Failed to revert import session.");
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
        {/* TOP HEADER (Only Icon + Manage Market Data + Close Button) */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#2a2b30] bg-[#121316] shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#089981]" />
            <h3 className="text-sm font-semibold text-[#d1d4dc] tracking-tight">
              Manage Market Data
            </h3>
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
                  {/* Segmented Control — hides 0-count categories */}
                  <div
                    className="inline-flex items-center p-0.5 rounded-lg bg-[#121316] border border-[#25272e] text-xs"
                    role="tablist"
                    aria-label="Filter assets by market category"
                  >
                    {(
                      [
                        { id: "all", label: "All", count: classCounts.all },
                        { id: "futures", label: "Futures", count: classCounts.futures },
                        { id: "cfd", label: "CFD & Spot", count: classCounts.cfd },
                        { id: "forex", label: "Forex", count: classCounts.forex },
                        { id: "crypto", label: "Crypto", count: classCounts.crypto },
                      ] as const
                    )
                      .filter((cat) => cat.id === "all" || cat.count > 0)
                      .map((cat) => {
                        const isActive = classFilter === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setClassFilter(cat.id)}
                            className={cn(
                              "h-7 px-2.5 rounded-md font-medium text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer",
                              isActive
                                ? "bg-[#202228] text-[#d1d4dc] shadow-xs"
                                : "text-[#868a96] hover:text-[#d1d4dc]",
                            )}
                          >
                            <span>{cat.label}</span>
                            <span className="font-mono tabular-nums text-[10px] text-[#868a96]">
                              {cat.count}
                            </span>
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
                      aria-label="Search asset"
                      className="h-8 w-44 sm:w-52 pl-8 pr-6 rounded-lg bg-[#121316] border border-[#25272e] text-xs text-[#d1d4dc] placeholder:text-[#868a96] focus:outline-none focus:border-[#089981]"
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
                    const isSettingsOpen = expandedSettings.has(asset.symbol);
                    const isMenuOpen = openMenuFor === asset.symbol;
                    const activeCompatible = customLinks[asset.symbol] ?? asset.compatibleSymbols;
                    const assetClass = getAssetClass(asset.symbol);
                    const marketLabel = getCategoryMarketLabel(assetClass);

                    // Build canonical + custom timeframe coverage list
                    const availableSet = new Set(
                      asset.timeframes.map((tf) => tf.resolution.toLowerCase()),
                    );
                    const extraTimeframes = asset.timeframes
                      .map((tf) => tf.resolution.toLowerCase())
                      .filter(
                        (r) =>
                          !(CANONICAL_COVERAGE_TIMEFRAMES as readonly string[]).includes(r),
                      );
                    const coverageResolutions = [
                      ...CANONICAL_COVERAGE_TIMEFRAMES,
                      ...extraTimeframes,
                    ];

                    return (
                      <div
                        key={asset.symbol}
                        className="border border-[#25272e] rounded-xl bg-[#121316] overflow-hidden transition-all duration-150"
                      >
                        {/* ASSET ACCORDION HEADER */}
                        <div
                          onClick={() => {
                            setOpenMenuFor(null);
                            toggleAssetExpanded(asset.symbol);
                          }}
                          className="px-4 py-3 bg-[#15161a] flex items-center justify-between gap-3 cursor-pointer hover:bg-[#181a20] transition-colors"
                        >
                          {/* Left: Real Asset Icon + 2-line hierarchy + compact TF coverage */}
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="pt-0.5 shrink-0">
                              <AssetIcon symbol={asset.symbol} size="sm" />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              {/* Line 1: Ticker (semibold) + Asset Name (medium gray) */}
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[#d1d4dc] tracking-tight">
                                  {asset.symbol}
                                </span>
                                <span className="text-xs text-[#868a96] truncate">
                                  {asset.displayName}
                                </span>
                              </div>

                              {/* Line 2: Metadata (CME · USD · raw) + Compact borderless Timeframe strip */}
                              <div className="flex items-center gap-2 flex-wrap text-[11px] leading-none">
                                <span className="text-[#868a96]">
                                  {marketLabel} · {asset.currency} · {asset.priceBasis}
                                </span>
                                <span className="text-[#2a2b30]" aria-hidden="true">
                                  │
                                </span>
                                <div
                                  className="flex items-center gap-1 font-mono text-[10px] flex-wrap"
                                  aria-label="Timeframe coverage"
                                >
                                  {coverageResolutions.map((res, idx) => {
                                    const hasData = availableSet.has(res);
                                    return (
                                      <React.Fragment key={res}>
                                        {idx > 0 && (
                                          <span
                                            className="text-[#868a96]/25 select-none"
                                            aria-hidden="true"
                                          >
                                            ·
                                          </span>
                                        )}
                                        <span
                                          className={cn(
                                            "transition-colors",
                                            hasData
                                              ? "text-[#d1d4dc] font-medium"
                                              : "text-[#868a96]/30",
                                          )}
                                          title={
                                            hasData
                                              ? `${formatResolutionDisplay(res)}: Available`
                                              : `${formatResolutionDisplay(res)}: No data`
                                          }
                                        >
                                          {formatResolutionDisplay(res)}
                                        </span>
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: Total Bars (mono) + ⋯ Menu (Purge with confirmation) + Expand Chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            {purgingKey === asset.symbol ? (
                              <div
                                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#1a1416] border border-[#f23645]/30"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[11px] text-[#d1d4dc] font-mono tabular-nums">
                                  Remove{" "}
                                  <strong className="text-[#f23645]">
                                    {asset.totalBars.toLocaleString()}
                                  </strong>{" "}
                                  bars?
                                </span>
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
                                  className="px-1.5 py-0.5 text-[11px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-mono tabular-nums text-[#d1d4dc]">
                                  {asset.totalBars.toLocaleString()}{" "}
                                  <span className="text-[#868a96] font-sans text-[11px]">
                                    bars
                                  </span>
                                </span>

                                {/* ⋯ Action Menu */}
                                <div
                                  className="relative"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenMenuFor(isMenuOpen ? null : asset.symbol)
                                    }
                                    className="w-7 h-7 rounded-md flex items-center justify-center text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#202228] transition-colors cursor-pointer"
                                    aria-label={`More actions for ${asset.symbol}`}
                                    aria-expanded={isMenuOpen}
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>

                                  {isMenuOpen && (
                                    <div
                                      role="menu"
                                      className="absolute right-0 top-8 z-20 min-w-[210px] rounded-lg border border-[#2a2b30] bg-[#18191e] p-1 shadow-xl"
                                    >
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                          setOpenMenuFor(null);
                                          setPurgingKey(asset.symbol);
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-md text-left text-xs text-[#f23645] hover:bg-[#f23645]/10 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                      >
                                        <span className="flex items-center gap-1.5 font-medium">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Purge asset</span>
                                        </span>
                                        <span className="font-mono tabular-nums text-[10px] text-[#868a96]">
                                          {asset.totalBars.toLocaleString()} bars
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAssetExpanded(asset.symbol);
                              }}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#202228] transition-colors cursor-pointer"
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
                          <div className="border-t border-[#202228]">
                            {/* COLLAPSIBLE ASSET SETTINGS (Separates config from candle data) */}
                            <div className="border-b border-[#202228] bg-[#131418]">
                              <button
                                type="button"
                                onClick={() => toggleSettingsExpanded(asset.symbol)}
                                className="w-full px-4 py-2 flex items-center justify-between gap-2 text-[11px] text-[#868a96] hover:text-[#d1d4dc] transition-colors cursor-pointer"
                                aria-expanded={isSettingsOpen}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <SlidersHorizontal className="w-3 h-3 text-[#868a96] shrink-0" />
                                  <span className="font-medium">Asset settings</span>
                                  <span className="text-[#868a96]/40">·</span>
                                  <span className="font-mono text-[10px] text-[#868a96] truncate">
                                    {activeCompatible.length > 0
                                      ? `Compatible: ${activeCompatible.join(", ")}`
                                      : "Isolated (no linked tickers)"}
                                  </span>
                                </div>
                                {isSettingsOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                )}
                              </button>

                              {isSettingsOpen && (
                                <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-2 text-[11px] text-[#868a96] flex-wrap border-t border-[#1c1e24]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[#868a96]">Compatible with:</span>
                                    {activeCompatible.length === 0 ? (
                                      <span className="italic text-[#868a96]/70">
                                        Strictly isolated (no other tickers linked)
                                      </span>
                                    ) : (
                                      activeCompatible.map((item) => (
                                        <span
                                          key={item}
                                          className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a1b20] border border-[#25272e] text-[#d1d4dc] font-mono text-[10px]"
                                        >
                                          <span>{item}</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRemoveCompatibleSymbol(
                                                asset.symbol,
                                                item,
                                              );
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
                                          onChange={(e) =>
                                            setNewTickerInput(e.target.value.toUpperCase())
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              void handleAddCompatibleSymbol(
                                                asset.symbol,
                                                newTickerInput,
                                              );
                                            } else if (e.key === "Escape") {
                                              setAddingSymbolFor(null);
                                              setNewTickerInput("");
                                            }
                                          }}
                                          placeholder="TICKER"
                                          autoFocus
                                          className="h-5 w-16 px-1.5 rounded bg-[#17181c] border border-[#089981] text-[10px] font-mono text-[#d1d4dc] focus:outline-none uppercase"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAddCompatibleSymbol(
                                              asset.symbol,
                                              newTickerInput,
                                            )
                                          }
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
                                      <span>
                                        Isolate{" "}
                                        {assetClass === "futures" ? "from CFDs" : "from Futures"}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ALIGNED TIMEFRAME TABLE (TF | Bars | Period | Source | Hover Purge) */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-[#1c1e24] text-[10px] font-medium uppercase tracking-wider text-[#868a96]/80">
                                    <th className="pl-4 pr-2 py-2 w-16">TF</th>
                                    <th className="px-3 py-2 w-28 text-right">Bars</th>
                                    <th className="px-3 py-2">Period</th>
                                    <th className="px-3 py-2">Source</th>
                                    <th className="pl-2 pr-4 py-2 w-44 text-right">
                                      <span className="sr-only">Actions</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1c22] text-xs">
                                  {asset.timeframes.map((tf) => {
                                    const tfKey = `${asset.symbol}__${tf.resolution}`;
                                    const isPurgingTf = purgingKey === tfKey;
                                    const tfBatches = batches.filter(
                                      (b) =>
                                        b.symbol.toUpperCase() === asset.symbol.toUpperCase() &&
                                        b.resolution.toLowerCase() ===
                                          tf.resolution.toLowerCase(),
                                    );
                                    const sourceNames = Array.from(
                                      new Set(
                                        tfBatches
                                          .map((b) => b.name)
                                          .filter((n): n is string => Boolean(n)),
                                      ),
                                    );
                                    const primarySource =
                                      sourceNames.length === 0
                                        ? "—"
                                        : sourceNames.length === 1
                                          ? sourceNames[0]!
                                          : `${sourceNames[0]} (+${sourceNames.length - 1})`;
                                    const hasNewBars = tfBatches.some(
                                      (b) => (b.newBarCount ?? 0) > 0,
                                    );

                                    return (
                                      <tr
                                        key={tf.resolution}
                                        className="group hover:bg-[#16181d] transition-colors"
                                      >
                                        <td className="pl-4 pr-2 py-2.5 font-mono font-semibold text-[#d1d4dc] whitespace-nowrap">
                                          {formatResolutionDisplay(tf.resolution)}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono tabular-nums text-[#d1d4dc] text-right whitespace-nowrap">
                                          {tf.barCount.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono tabular-nums text-[11px] text-[#868a96] whitespace-nowrap">
                                          {formatSeriesRange(tf.firstTime, tf.lastTime)}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-[11px] text-[#868a96] max-w-[220px] truncate">
                                          <div className="flex items-center gap-1.5 truncate">
                                            {hasNewBars && (
                                              <span
                                                className="w-1.5 h-1.5 rounded-full bg-[#089981] shrink-0"
                                                title="Recently imported bars"
                                              />
                                            )}
                                            <span
                                              className="truncate"
                                              title={sourceNames.join(", ")}
                                            >
                                              {primarySource}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="pl-2 pr-4 py-2 text-right whitespace-nowrap">
                                          {isPurgingTf ? (
                                            <div className="inline-flex items-center justify-end gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleConfirmPurge(
                                                    asset.symbol,
                                                    tf.resolution,
                                                  )
                                                }
                                                disabled={busy}
                                                className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[10px] font-medium cursor-pointer"
                                              >
                                                Confirm ({tf.barCount.toLocaleString()})
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setPurgingKey(null)}
                                                className="px-1.5 py-0.5 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setPurgingKey(tfKey)}
                                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-all inline-flex items-center justify-center cursor-pointer"
                                              title={`Purge ${formatResolutionDisplay(tf.resolution)} (${tf.barCount.toLocaleString()} bars)`}
                                              aria-label={`Purge ${formatResolutionDisplay(tf.resolution)}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
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
            <div className="space-y-4">
              {/* TOP SEARCH BAR FOR INGESTION HISTORY */}
              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#868a96]" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search by asset, timeframe, or file..."
                    aria-label="Search ingestion history by asset or file"
                    className="h-8 w-full pl-8 pr-6 rounded-lg bg-[#121316] border border-[#25272e] text-xs text-[#d1d4dc] placeholder:text-[#868a96] focus:outline-none focus:border-[#089981]"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                      aria-label="Clear history search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {groupedHistorySessions.length === 0 ? (
                <div className="py-8 text-center space-y-1 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
                  <p className="text-xs font-medium text-[#d1d4dc]">
                    No ingestion chunks match your search query.
                  </p>
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery("")}
                    className="text-[11px] text-[#089981] hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedHistorySessions.map((session) => {
                    const isRevertingSession = revertingSessionKey === session.sessionKey;
                    const fileLabel = session.batches.length === 1 ? "file" : "files";

                    return (
                      <div key={session.sessionKey} className="space-y-1">
                        {/* DISCRETE SESSION HEADER */}
                        <div className="px-2 py-1.5 flex items-center justify-between gap-2 border-b border-[#25272e] text-[11px]">
                          <span className="font-medium text-[#868a96]">
                            {session.sessionLabel}
                          </span>

                          <div className="flex items-center gap-3">
                            <span className="font-mono tabular-nums text-[#868a96]">
                              {session.batches.length} {fileLabel} ·{" "}
                              {session.totalNewBars.toLocaleString()} bars
                            </span>

                            {isRevertingSession ? (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[11px] text-[#d1d4dc] font-mono tabular-nums">
                                  Remove{" "}
                                  <strong className="text-[#f23645]">
                                    {session.totalNewBars.toLocaleString()}
                                  </strong>{" "}
                                  bars?
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleConfirmRevertSession(session.batches)
                                  }
                                  disabled={busy}
                                  className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[10px] font-medium cursor-pointer transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRevertingSessionKey(null)}
                                  className="px-1.5 py-0.5 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setRevertingSessionKey(session.sessionKey)
                                }
                                disabled={busy}
                                className="text-[11px] text-[#868a96]/80 hover:text-[#f23645] transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title={`Revert all ${session.batches.length} ${fileLabel} in this session (${session.totalNewBars.toLocaleString()} bars)`}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Revert import</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* BORDERLESS SESSION TABLE */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#1c1e24] text-[10px] font-medium uppercase tracking-wider text-[#868a96]/70">
                                <th className="pl-2 pr-3 py-1.5 w-28">Asset</th>
                                <th className="px-2 py-1.5 w-14">TF</th>
                                <th className="px-3 py-1.5">Period</th>
                                <th className="px-3 py-1.5 text-right w-36">Bars</th>
                                <th className="px-3 py-1.5">File</th>
                                <th className="pl-2 pr-2 py-1.5 w-44 text-right">
                                  <span className="sr-only">Actions</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1c22] text-xs">
                              {session.batches.map((batch) => {
                                const isReverting = revertingBatchId === batch.id;
                                const hasDiffTotal =
                                  batch.newBarCount !== batch.barCount;
                                const barsTooltip = hasDiffTotal
                                  ? `${batch.newBarCount.toLocaleString()} new of ${batch.barCount.toLocaleString()} total bars in file`
                                  : `${batch.newBarCount.toLocaleString()} bars imported`;

                                return (
                                  <tr
                                    key={batch.id}
                                    className="group hover:bg-[#16181d] transition-colors"
                                  >
                                    {/* Asset */}
                                    <td className="pl-2 pr-3 py-2 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <AssetIcon
                                          symbol={batch.symbol}
                                          size="xs"
                                        />
                                        <span className="font-semibold text-[#d1d4dc]">
                                          {batch.symbol}
                                        </span>
                                      </div>
                                    </td>

                                    {/* TF */}
                                    <td className="px-2 py-2 font-mono text-[#868a96] whitespace-nowrap">
                                      {formatResolutionDisplay(batch.resolution)}
                                    </td>

                                    {/* Period */}
                                    <td className="px-3 py-2 font-mono tabular-nums text-[11px] text-[#868a96] whitespace-nowrap">
                                      {formatSeriesRange(
                                        batch.firstTime,
                                        batch.lastTime,
                                      )}
                                    </td>

                                    {/* Bars (+ discrete amber duplicates if > 0) */}
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center justify-end gap-1.5 font-mono tabular-nums">
                                        <span
                                          className={cn(
                                            batch.newBarCount > 0
                                              ? "text-[#089981]"
                                              : "text-[#868a96]",
                                            hasDiffTotal &&
                                              "underline decoration-dotted decoration-[#868a96]/50 underline-offset-2 cursor-help",
                                          )}
                                          title={barsTooltip}
                                        >
                                          +{batch.newBarCount.toLocaleString()}
                                        </span>
                                        {batch.duplicateBarCount > 0 && (
                                          <span
                                            className="text-[10px] text-amber-400/90"
                                            title={`${batch.duplicateBarCount.toLocaleString()} duplicate bars skipped`}
                                          >
                                            ·{" "}
                                            {batch.duplicateBarCount.toLocaleString()}{" "}
                                            dup
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* File (truncated with tooltip) */}
                                    <td className="px-3 py-2 font-mono text-[11px] text-[#868a96]/60 max-w-[190px] truncate">
                                      <span
                                        className="truncate block"
                                        title={batch.name || undefined}
                                      >
                                        {batch.name || "—"}
                                      </span>
                                    </td>

                                    {/* Action (Hover-only undo icon with confirmation) */}
                                    <td className="pl-2 pr-2 py-1.5 text-right whitespace-nowrap">
                                      {isReverting ? (
                                        <div className="inline-flex items-center justify-end gap-1.5">
                                          <span className="text-[10px] text-[#d1d4dc] font-mono tabular-nums">
                                            Remove{" "}
                                            <strong className="text-[#f23645]">
                                              {batch.newBarCount.toLocaleString()}
                                            </strong>{" "}
                                            bars?
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleConfirmRevertBatch(
                                                batch.id,
                                                batch.name,
                                              )
                                            }
                                            disabled={busy}
                                            className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[10px] font-medium cursor-pointer transition-colors"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRevertingBatchId(null)
                                            }
                                            className="px-1.5 py-0.5 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setRevertingBatchId(batch.id)
                                          }
                                          disabled={busy}
                                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-all inline-flex items-center justify-center cursor-pointer"
                                          title={`Revert chunk (${batch.newBarCount.toLocaleString()} bars)`}
                                          aria-label={`Revert ${batch.symbol} ${formatResolutionDisplay(batch.resolution)} chunk`}
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
