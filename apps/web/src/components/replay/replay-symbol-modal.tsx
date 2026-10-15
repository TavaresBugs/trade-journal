"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, X, Database } from "lucide-react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { VelaBezierSelect } from "@/components/settings/vela-bezier-select";
import type { ReplaySymbolCatalogItem } from "@/app/api/market-data/replay/route";

export const CATEGORIES = [
  "All",
  "With Data",
  "Futures",
  "Stocks",
  "Crypto",
  "ETFs",
  "Forex",
  "Commodities",
] as const;
export type SymbolCategory = (typeof CATEGORIES)[number];

export const VENUES = ["All venues", "CME", "Binance", "NASDAQ", "NYSE"] as const;
export type SymbolVenue = (typeof VENUES)[number];

export function resolveVenue(sym: string): string {
  if (!sym) return "INDEX";
  const upper = sym.toUpperCase().trim();
  if (
    upper.includes("USDT") ||
    upper.startsWith("BTC") ||
    upper.startsWith("ETH") ||
    upper.startsWith("SOL") ||
    upper.startsWith("BNB")
  ) {
    return "BINANCE";
  }
  const root = upper.replace(/[0-9!]/g, "");
  const cmeFutures = [
    "MES", "ES", "NQ", "MNQ", "YM", "MYM", "RTY", "M2K",
    "CL", "MCL", "GC", "MGC", "SI", "HG", "ZB", "ZN", "ZF", "ZT",
    "6E", "6B", "6A", "6J", "FDAX", "FESX"
  ];
  if (cmeFutures.includes(root) || cmeFutures.includes(upper)) return "CME";
  if (["AAPL", "TSLA", "MSFT", "NVDA", "AMZN", "META", "GOOGL"].includes(upper)) return "NASDAQ";
  if (["SPY", "QQQ", "IWM", "DIA"].includes(upper)) return "NYSE";
  return "INDEX";
}

export function getVenueBadgeStyle(venue: string): string {
  switch (venue.toUpperCase()) {
    case "BINANCE":
      return "bg-[#f0b90b]/10 text-[#f0b90b] border-[#f0b90b]/30";
    case "CME":
      return "bg-[#00a3e0]/10 text-[#38bdf8] border-[#00a3e0]/30";
    case "NASDAQ":
      return "bg-[#0078d4]/10 text-[#60a5fa] border-[#0078d4]/30";
    case "NYSE":
      return "bg-[#1d4ed8]/10 text-[#93c5fd] border-[#1d4ed8]/30";
    default:
      return "bg-[#202228] text-[#868a96] border-[#2a2b30]";
  }
}

function matchesCategory(item: ReplaySymbolCatalogItem, category: SymbolCategory): boolean {
  if (category === "All") return true;
  if (category === "With Data") return (item.totalBars || 0) > 0;
  const sym = item.symbol.toUpperCase();
  const cat = (item.category || "").toLowerCase();
  const venue = resolveVenue(sym);

  switch (category) {
    case "Stocks":
      return (
        cat.includes("stock") ||
        venue === "NASDAQ" ||
        (venue === "NYSE" && !["SPY", "QQQ", "IWM", "DIA"].includes(sym)) ||
        ["AAPL", "TSLA", "MSFT", "NVDA", "AMZN", "META", "GOOGL"].includes(sym)
      );
    case "ETFs":
      return (
        cat.includes("etf") ||
        ["SPY", "QQQ", "IWM", "DIA"].includes(sym)
      );
    case "Crypto":
      return (
        cat === "crypto" ||
        venue === "BINANCE" ||
        sym.includes("USDT") ||
        ["BTC", "ETH", "SOL", "BNB", "XRP"].some((c) => sym.startsWith(c))
      );
    case "Futures": {
      const root = sym.replace(/[0-9!]/g, "");
      const cmeRoots = [
        "MES", "ES", "NQ", "MNQ", "YM", "MYM", "RTY", "M2K",
        "CL", "MCL", "GC", "MGC", "SI", "HG", "ZB", "ZN", "ZF", "ZT",
        "6E", "6B", "6A", "6J", "FDAX", "FESX"
      ];
      return (
        cat === "futures" ||
        venue === "CME" ||
        cmeRoots.includes(root) ||
        cmeRoots.includes(sym)
      );
    }
    case "Forex":
      return (
        cat === "forex" ||
        (sym.length === 6 &&
          ["EUR", "USD", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"].some((cur) =>
            sym.startsWith(cur)
          ))
      );
    case "Commodities":
      return (
        cat === "commodities" ||
        [
          "XAUUSD", "GOLD", "XAGUSD", "SILVER", "CL", "MCL",
          "USOIL", "WTI", "NATGAS", "COPPER", "GC", "MGC", "SI", "HG"
        ].includes(sym)
      );
    default:
      return true;
  }
}

function matchesVenue(item: ReplaySymbolCatalogItem, venue: SymbolVenue): boolean {
  if (venue === "All venues") return true;
  const v = resolveVenue(item.symbol);
  return v.toUpperCase() === venue.toUpperCase();
}

export interface ReplaySymbolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: string;
  catalog: ReplaySymbolCatalogItem[];
  onSelectSymbol: (symbol: string) => void;
}

/**
 * Institutional Symbol Search Modal 1:1 with Official Vela platform (`data-quant-dialog="symbols"`).
 * Features 2-column layout with results list, real-time keyboard navigation, category tabs,
 * venue filter and detailed inspector preview with SQLite dataset stats.
 */
export function ReplaySymbolModal({
  isOpen,
  onClose,
  selectedSymbol,
  catalog,
  onSelectSymbol,
}: ReplaySymbolModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SymbolCategory>("All");
  const [activeVenue, setActiveVenue] = useState<SymbolVenue>("All venues");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveCategory("All");
      setActiveVenue("All venues");
      // Find initial highlighted index corresponding to selectedSymbol
      const initialIdx = catalog.findIndex(
        (c) => c.symbol.toUpperCase() === selectedSymbol.toUpperCase()
      );
      setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, catalog, selectedSymbol]);

  // Filtered & ranked instruments
  const filteredItems = useMemo(() => {
    let list = catalog;

    // Filter by Category
    if (activeCategory !== "All") {
      list = list.filter((item) => matchesCategory(item, activeCategory));
    }

    // Filter by Venue
    if (activeVenue !== "All venues") {
      list = list.filter((item) => matchesVenue(item, activeVenue));
    }

    // Filter by Search Query & rank
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.assetName.toLowerCase().includes(q) ||
          resolveVenue(item.symbol).toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
      );

      list = [...list].sort((a, b) => {
        const aSym = a.symbol.toLowerCase();
        const bSym = b.symbol.toLowerCase();
        if (aSym === q && bSym !== q) return -1;
        if (bSym === q && aSym !== q) return 1;
        if (aSym.startsWith(q) && !bSym.startsWith(q)) return -1;
        if (bSym.startsWith(q) && !aSym.startsWith(q)) return 1;
        return (b.totalBars || 0) - (a.totalBars || 0);
      });
    } else {
      // Default: symbols with stored SQLite data appear first, sorted by total bars descending
      list = [...list].sort((a, b) => (b.totalBars || 0) - (a.totalBars || 0));
    }

    return list;
  }, [catalog, activeCategory, activeVenue, searchQuery]);

  // Ensure highlighted index stays within bounds
  useEffect(() => {
    if (filteredItems.length === 0) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredItems.length) {
      setHighlightedIndex(0);
    }
  }, [filteredItems, highlightedIndex]);

  const inspectedItem = filteredItems[highlightedIndex] || filteredItems[0] || null;

  const isSelectingRef = useRef(false);
  const handleSelect = useCallback(
    (sym: string) => {
      if (isSelectingRef.current) return;
      isSelectingRef.current = true;
      try {
        onSelectSymbol(sym);
        onClose();
      } finally {
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 300);
      }
    },
    [onSelectSymbol, onClose]
  );

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        setHighlightedIndex((prev) => {
          const next = prev < filteredItems.length - 1 ? prev + 1 : 0;
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredItems.length - 1;
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (inspectedItem) {
          handleSelect(inspectedItem.symbol);
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const currentIndex = CATEGORIES.indexOf(activeCategory);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length
          : (currentIndex + 1) % CATEGORIES.length;
        setActiveCategory(CATEGORIES[nextIndex]!);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, inspectedItem, activeCategory, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="vela-symbol-dialog fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Symbol Search"
        data-quant-dialog="symbols"
        className="relative flex flex-col w-[min(94vw,860px)] h-[min(76vh,640px)] bg-[var(--vela-surface)] border border-[var(--vela-border)] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.5)] overflow-hidden font-sans text-[var(--vela-fg)] select-none"
      >
        {/* HEADER: Search Bar + Categories Strip + Venue Dropdown */}
        <div className="p-4 pb-0 border-b border-[var(--vela-border)] space-y-3 bg-[var(--vela-surface)] shrink-0">
          {/* Search Row (44px) */}
          <div className="relative flex items-center h-[44px] bg-[var(--vela-surface-elev)] border border-[var(--vela-border)] focus-within:border-[#38bdf8] rounded-[8px] px-3.5 transition-colors">
            <Search className="w-4 h-4 text-[var(--vela-fg-muted)] shrink-0 mr-2.5" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g. MES, ES, BTCUSDT)..."
              spellCheck={false}
              className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--vela-fg-bright)] placeholder:text-[var(--vela-fg-muted)] uppercase font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-[#868a96] hover:text-white transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categories Strip + Venues Selector */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2.5 scrollbar-none">
            {/* Category tabs with .qsp-tab-pill indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                const withDataCount = catalog.filter((c) => (c.totalBars || 0) > 0).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap select-none flex items-center gap-1.5 ${
                      isActive
                        ? "qsp-tab-pill bg-[#f0f3fa] text-[#151619] shadow-xs"
                        : "text-[#868a96] hover:text-[#f0f3fa] hover:bg-[#202228]"
                    }`}
                  >
                    {cat === "With Data" && (
                      <span className={`w-1.5 h-1.5 rounded-full ${withDataCount > 0 ? "bg-[#22c55e]" : "bg-[#868a96]"}`} />
                    )}
                    <span>{cat}</span>
                    {cat === "With Data" && withDataCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? "bg-black/15 text-black font-bold"
                            : "bg-emerald-500/20 text-emerald-400 font-semibold"
                        }`}
                      >
                        {withDataCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Venue Dropdown using Vela Bézier Select */}
            <div className="shrink-0 flex items-center">
              <VelaBezierSelect
                value={activeVenue}
                options={VENUES.map((v) => ({ value: v, label: v }))}
                onChange={(v) => setActiveVenue(v as SymbolVenue)}
                minWidth={115}
                popupMinWidth={130}
              />
            </div>
          </div>
        </div>

        {/* BODY: 2-COLUMN LAYOUT (Results List + Inspector Preview) */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT COLUMN: Results List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 overscroll-contain">
            {filteredItems.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isCurrent =
                selectedSymbol.toUpperCase() === item.symbol.toUpperCase();
              const venue = resolveVenue(item.symbol);

              return (
                <div
                  key={item.symbol}
                  ref={(el) => {
                    rowRefs.current[idx] = el;
                  }}
                  onClick={() => setHighlightedIndex(idx)}
                  onDoubleClick={() => handleSelect(item.symbol)}
                  className={`quant-chrome-hover-row group flex items-center justify-between px-3.5 py-2.5 rounded-[8px] cursor-pointer transition-colors select-none ${
                    isHighlighted
                      ? "bg-[rgba(255,255,255,0.08)] text-[#f0f3fa]"
                      : "hover:bg-[rgba(255,255,255,0.04)] text-[#d1d4dc]"
                  }`}
                >
                  {/* Left: Avatar (28px) + Ticker + Description */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center w-[28px] h-[28px]">
                      <AssetIcon symbol={item.symbol} size="sm" />
                      {/* Blue indicator dot for active symbol */}
                      {isCurrent && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#2962ff] shadow-[0_0_6px_#2962ff] ring-1 ring-[#151619]"
                          title="Currently open in chart"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[14px] text-white tracking-tight">
                          {item.symbol}
                        </span>
                      </div>
                      <span className="text-[12px] text-[#868a96] truncate font-medium">
                        {item.assetName}
                      </span>
                    </div>
                  </div>

                  {/* Right: Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(item.totalBars || 0) > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Database className="w-2.5 h-2.5" />
                        <span>{item.totalBars.toLocaleString()} bars</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-white/[0.03] text-[#868a96] border border-white/[0.06]">
                        Feed Ready
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-wider border ${getVenueBadgeStyle(
                        venue
                      )}`}
                    >
                      {venue}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#202228] border border-[#2a2b30] text-[#868a96] uppercase">
                      {item.category}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="py-16 text-center text-sm text-[#868a96]">
                No matching symbols found.
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Inspector Preview (280px) */}
          <div className="w-[280px] shrink-0 border-l border-[var(--vela-border)] bg-[var(--vela-surface-elev)] p-5 flex flex-col justify-between overflow-y-auto">
            {inspectedItem ? (
              <div className="space-y-5">
                {/* Large Avatar (48px) + Ticker + Full Name */}
                <div className="flex flex-col items-center text-center pt-2">
                  <div className="relative mb-3 flex items-center justify-center w-[48px] h-[48px]">
                    <AssetIcon symbol={inspectedItem.symbol} size="xl" />
                  </div>
                  <h3 className="text-[20px] font-bold text-[var(--vela-fg-bright)] tracking-tight leading-tight">
                    {inspectedItem.symbol}
                  </h3>
                  <p className="text-[13px] text-[var(--vela-fg-muted)] font-medium mt-1 leading-snug px-2">
                    {inspectedItem.assetName}
                  </p>

                  {/* Badges of Venue & Category */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-[4px] uppercase tracking-wider border ${getVenueBadgeStyle(
                        resolveVenue(inspectedItem.symbol)
                      )}`}
                    >
                      {resolveVenue(inspectedItem.symbol)}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[var(--vela-hover)] border border-[var(--vela-border)] text-[var(--vela-fg-muted)] uppercase">
                      {inspectedItem.category}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-[var(--vela-border)] w-full" />

                {/* Database Stats Card */}
                {(inspectedItem.totalBars || 0) > 0 ? (
                  <div className="bg-[var(--vela-surface)] border border-[var(--vela-border)] rounded-[8px] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[var(--vela-fg-muted)] font-medium">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>Historical Series</span>
                      </span>
                      <span className="text-[#38bdf8] font-mono font-bold">SQLite</span>
                    </div>
                    <div className="text-[15px] font-bold text-[var(--vela-fg-bright)] font-mono">
                      {inspectedItem.totalBars.toLocaleString()}{" "}
                      <span className="text-[12px] font-sans font-normal text-[var(--vela-fg-muted)]">
                        bars
                      </span>
                    </div>
                    <div className="text-[11px] text-[#22c55e] flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                      <span>Ready for Instant Replay</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--vela-surface)] border border-[var(--vela-border)] rounded-[8px] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[var(--vela-fg-muted)] font-medium">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#868a96]" />
                        <span>Historical Series</span>
                      </span>
                      <span className="text-[#868a96] font-mono">0 bars stored</span>
                    </div>
                    <div className="text-[11px] text-[#38bdf8] flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                      <span>Ready to populate via Feed / CSV</span>
                    </div>
                  </div>
                )}

                {/* Available Resolutions Badges */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-[var(--vela-fg-muted)] uppercase tracking-wider">
                    {(inspectedItem.totalBars || 0) > 0 ? "Available Resolutions" : "Supported Resolutions"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectedItem.resolutions.map((res) => (
                      <span
                        key={res}
                        className="px-2 py-1 rounded-[4px] bg-[var(--vela-hover)] border border-[var(--vela-border)] text-[11px] font-mono font-semibold text-[var(--vela-fg)]"
                      >
                        {res}
                      </span>
                    ))}
                    {inspectedItem.resolutions.length === 0 && (
                      <span className="text-[12px] text-[var(--vela-fg-muted)]">
                        All timeframes (1m base)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-[var(--vela-fg-muted)] text-xs">
                No symbol selected
              </div>
            )}

            {/* Action Button: Open chart [↵] */}
            {inspectedItem && (
              <div className="pt-4 border-t border-[var(--vela-border)]">
                <button
                  type="button"
                  onClick={() => handleSelect(inspectedItem.symbol)}
                  className="w-full h-[40px] rounded-[8px] bg-[var(--vela-selected-bg)] hover:opacity-90 text-[var(--vela-selected-fg)] font-bold text-[13px] flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all cursor-pointer select-none active:scale-[0.99]"
                >
                  <span>Open chart</span>
                  <kbd className="px-1.5 py-0.5 rounded-[4px] bg-black/15 text-[var(--vela-selected-fg)] font-mono text-[11px] font-bold">
                    ↵
                  </kbd>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER: Official Vela .qsp-foot & .qsp-key Keyboard Chips */}
        <div className="quant-tfp-foot qsp-foot justify-between bg-[var(--vela-surface)] border-t border-[var(--vela-border)]">
          <div className="flex items-center gap-1.5">
            <span className="qsp-key" data-pair="">
              <kbd>↑</kbd>
              <kbd>↓</kbd> Navigate
            </span>
            <span className="qsp-key">
              <kbd>↵</kbd> Open chart
            </span>
            <span className="qsp-key">
              <kbd>Tab</kbd> Switch market
            </span>
            <span className="qsp-key">
              <kbd>Esc</kbd> Close
            </span>
          </div>
          <div className="text-[11px] text-[#868a96] pr-2">
            {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "instrument" : "instruments"}
          </div>
        </div>
      </div>
    </div>
  );
}
