"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssetIcon } from "@/components/ui/asset-icon";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { tvManifest } from "@/lib/assets/asset-icons";
import {
  SYMBOL_SPECS,
  formatSpecBadge,
  getSymbolSpec,
  isCalculableSymbol,
} from "@/lib/assets/symbol-specs";
import { cn } from "@/lib/utils";

export type AssetCategory = "futures" | "stocks" | "forex" | "crypto";

export interface AssetMeta {
  symbol: string;
  name: string;
  category: AssetCategory;
  aliases?: string[];
  specBadge?: string | null;
}

function getAssetCategory(rawCat: string, symbol: string): AssetCategory {
  if (rawCat === "forex") return "forex";
  if (rawCat === "crypto") return "crypto";
  if (rawCat === "stocks" || rawCat === "funds") return "stocks";
  if (rawCat === "b3") {
    // WIN, WDO, IND, DOL are Brazilian Futures contracts
    if (["WIN", "WDO", "IND", "DOL"].includes(symbol)) return "futures";
    return "stocks";
  }
  // indices, commodities, bonds, currencies, futures
  return "futures";
}

function buildAssetCatalog(): AssetMeta[] {
  const list: AssetMeta[] = [];
  const seen = new Set<string>();

  // 1. Curated symbols with official names and specifications
  for (const spec of Object.values(SYMBOL_SPECS)) {
    const sym = spec.symbol.toUpperCase();
    seen.add(sym);
    list.push({
      symbol: sym,
      name: spec.name,
      category: getAssetCategory(spec.category, sym),
      aliases: spec.aliases,
      specBadge: formatSpecBadge(spec),
    });
  }

  // 2. Ingest B3 stocks/ETFs from TV manifest (Stocks category)
  for (const [sym, data] of Object.entries(tvManifest.b3 || {})) {
    const s = sym.toUpperCase();
    if (!seen.has(s)) {
      seen.add(s);
      list.push({
        symbol: s,
        name: data.name || s,
        category: getAssetCategory("b3", s),
        specBadge: "R$1/share",
      });
    }
  }

  // 3. Ingest US Stocks & ETFs from TV manifest (Stocks category)
  for (const [sym, data] of Object.entries(tvManifest.stocks || {})) {
    const s = sym.toUpperCase();
    if (!seen.has(s)) {
      seen.add(s);
      list.push({
        symbol: s,
        name: data.name || s,
        category: "stocks",
        specBadge: "$1/share",
      });
    }
  }

  // 4. Ingest Crypto from TV manifest (Crypto category)
  for (const [sym, data] of Object.entries(tvManifest.crypto || {})) {
    const s = sym.toUpperCase();
    if (!seen.has(s)) {
      seen.add(s);
      list.push({
        symbol: s,
        name: data.name || s,
        category: "crypto",
        specBadge: "Spot $1",
      });
    }
  }

  // 5. Ingest Funds / ETFs from TV manifest (Stocks category)
  for (const [sym, data] of Object.entries(tvManifest.funds || {})) {
    const s = sym.toUpperCase();
    if (!seen.has(s)) {
      seen.add(s);
      list.push({
        symbol: s,
        name: data.name || s,
        category: "stocks",
        specBadge: "$1/share",
      });
    }
  }

  // 6. Major Forex pairs (Forex category)
  const majorForex = [
    { symbol: "EURUSD", name: "Euro / US Dollar" },
    { symbol: "GBPUSD", name: "British Pound / US Dollar" },
    { symbol: "USDJPY", name: "US Dollar / Japanese Yen" },
    { symbol: "USDCHF", name: "US Dollar / Swiss Franc" },
    { symbol: "AUDUSD", name: "Australian Dollar / US Dollar" },
    { symbol: "USDCAD", name: "US Dollar / Canadian Dollar" },
    { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar" },
    { symbol: "EURGBP", name: "Euro / British Pound" },
    { symbol: "EURJPY", name: "Euro / Japanese Yen" },
    { symbol: "GBPJPY", name: "British Pound / Japanese Yen" },
    { symbol: "AUDJPY", name: "Australian Dollar / Japanese Yen" },
    { symbol: "EURAUD", name: "Euro / Australian Dollar" },
    { symbol: "USDBRL", name: "US Dollar / Brazilian Real" },
    { symbol: "EURBRL", name: "Euro / Brazilian Real" },
  ];
  for (const fx of majorForex) {
    if (!seen.has(fx.symbol)) {
      seen.add(fx.symbol);
      list.push({
        symbol: fx.symbol,
        name: fx.name,
        category: "forex",
        specBadge: null,
      });
    }
  }

  return list;
}

let _cachedCatalog: AssetMeta[] | null = null;

export function getAssetCatalog(): AssetMeta[] {
  if (!_cachedCatalog) {
    _cachedCatalog = buildAssetCatalog();
  }
  return _cachedCatalog;
}

export const ASSET_CATALOG: AssetMeta[] = new Proxy([] as AssetMeta[], {
  get(target, prop, receiver) {
    const catalog = getAssetCatalog();
    return Reflect.get(catalog, prop, receiver);
  },
});

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "futures", label: "Futures" },
  { id: "stocks", label: "Stocks" },
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
] as const;

export interface JournalAssetDropdownProps {
  currentAsset: string | null;
  onSelectAsset: (symbol: string | null) => void;
  todayTrades?: { symbol: string }[];
  allTradedSymbols?: string[];
  triggerVariant?: "icon" | "form";
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  hideGeneralJournal?: boolean;
  showValues?: boolean;
  allowClear?: boolean;
  align?: "start" | "end" | "center";
  alignCenter?: boolean;
  onlyCalculable?: boolean;
}

export function JournalAssetDropdown({
  currentAsset,
  onSelectAsset,
  todayTrades = [],
  allTradedSymbols = [],
  triggerVariant = "icon",
  placeholder,
  emptyLabel,
  className,
  hideGeneralJournal = false,
  showValues = false,
  allowClear = !hideGeneralJournal,
  align = "start",
  alignCenter = false,
  onlyCalculable = false,
}: JournalAssetDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const todaySymbols = useMemo(() => {
    return Array.from(new Set(todayTrades.map((t) => normalizeSymbol(t.symbol)).filter(Boolean)));
  }, [todayTrades]);

  const userHistorySymbols = useMemo(() => {
    return Array.from(new Set(allTradedSymbols.map((s) => normalizeSymbol(s)).filter(Boolean)));
  }, [allTradedSymbols]);

  // Traded assets from user history to display at the top of the "All" tab
  const userAssetItems = useMemo(() => {
    if (activeTab !== "all" || userHistorySymbols.length === 0) return [];
    const q = search.trim().toLowerCase();
    const normQ = q ? normalizeSymbol(q).toLowerCase() : "";

    const catalogMap = new Map<string, AssetMeta>();
    for (const item of ASSET_CATALOG) {
      catalogMap.set(item.symbol.toUpperCase(), item);
    }

    const list: AssetMeta[] = [];
    for (const sym of userHistorySymbols) {
      if (onlyCalculable && !isCalculableSymbol(sym)) {
        continue;
      }
      const s = sym.toUpperCase();
      const existing = catalogMap.get(s);
      const meta: AssetMeta = existing || {
        symbol: s,
        name: getSymbolSpec(s)?.name || s,
        category: (getSymbolSpec(s)?.category as AssetCategory) || "futures",
        specBadge: getSymbolSpec(s) ? formatSpecBadge(getSymbolSpec(s)!) : null,
      };

      if (!q) {
        list.push(meta);
      } else {
        const match =
          meta.symbol.toLowerCase().includes(q) ||
          meta.symbol.toLowerCase().includes(normQ) ||
          meta.name.toLowerCase().includes(q) ||
          meta.aliases?.some((a) => a.toLowerCase().includes(q) || a.toLowerCase().includes(normQ));
        if (match) {
          list.push(meta);
        }
      }
    }
    return list;
  }, [activeTab, userHistorySymbols, search, onlyCalculable]);

  // Today trades items (when on Today tab)
  const todayAssetItems = useMemo(() => {
    if (activeTab !== "today" || todaySymbols.length === 0) return [];
    const q = search.trim().toLowerCase();
    const normQ = q ? normalizeSymbol(q).toLowerCase() : "";

    const catalogMap = new Map<string, AssetMeta>();
    for (const item of ASSET_CATALOG) {
      catalogMap.set(item.symbol.toUpperCase(), item);
    }

    const list: AssetMeta[] = [];
    for (const sym of todaySymbols) {
      if (onlyCalculable && !isCalculableSymbol(sym)) {
        continue;
      }
      const s = sym.toUpperCase();
      const existing = catalogMap.get(s);
      const meta: AssetMeta = existing || {
        symbol: s,
        name: getSymbolSpec(s)?.name || s,
        category: (getSymbolSpec(s)?.category as AssetCategory) || "futures",
        specBadge: getSymbolSpec(s) ? formatSpecBadge(getSymbolSpec(s)!) : null,
      };

      if (!q) {
        list.push(meta);
      } else {
        const match =
          meta.symbol.toLowerCase().includes(q) ||
          meta.symbol.toLowerCase().includes(normQ) ||
          meta.name.toLowerCase().includes(q) ||
          meta.aliases?.some((a) => a.toLowerCase().includes(q) || a.toLowerCase().includes(normQ));
        if (match) {
          list.push(meta);
        }
      }
    }
    return list;
  }, [activeTab, todaySymbols, search, onlyCalculable]);

  // Filtered catalog assets (excluding user traded items in "All" to avoid duplicates)
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normQ = q ? normalizeSymbol(q).toLowerCase() : "";
    const userSymbolsSet = new Set(userHistorySymbols.map((s) => s.toUpperCase()));

    const matched = ASSET_CATALOG.filter((item) => {
      // In onlyCalculable mode (e.g. Points Calculator), only allow assets with quantified futures specs
      if (onlyCalculable && !isCalculableSymbol(item.symbol)) {
        return false;
      }

      // In "All", user's traded assets are already featured prominently at the top
      if (activeTab === "all" && userSymbolsSet.has(item.symbol.toUpperCase())) {
        return false;
      }

      // Tab / category filter
      if (activeTab === "today") {
        return false; // Handled separately by todayAssetItems
      } else if (activeTab !== "all") {
        if (item.category !== activeTab) return false;
      }

      // Textual search query filter
      if (!q) return true;
      if (item.symbol.toLowerCase().includes(q) || item.symbol.toLowerCase().includes(normQ))
        return true;
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.aliases?.some((a) => a.toLowerCase().includes(q) || a.toLowerCase().includes(normQ)))
        return true;
      return false;
    });

    // When browsing "All" without search and not in onlyCalculable mode, display top 60
    if (!q && activeTab === "all" && !onlyCalculable) {
      return matched.slice(0, 60);
    }
    return matched;
  }, [search, activeTab, userHistorySymbols, onlyCalculable]);

  const hasExactMatch = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return false;
    const normQ = normalizeSymbol(q);
    if (onlyCalculable) {
      return isCalculableSymbol(q) || isCalculableSymbol(normQ);
    }
    return (
      ASSET_CATALOG.some(
        (a) =>
          a.symbol.toUpperCase() === q ||
          a.symbol.toUpperCase() === normQ ||
          a.aliases?.some((al) => al.toUpperCase() === q || al.toUpperCase() === normQ),
      ) ||
      userHistorySymbols.includes(normQ) ||
      todaySymbols.includes(normQ)
    );
  }, [search, userHistorySymbols, todaySymbols, onlyCalculable]);

  const handleSelect = (sym: string | null) => {
    const normalized = sym ? normalizeSymbol(sym) : null;
    onSelectAsset(normalized);
    setOpen(false);
    setSearch("");
  };

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) {
      handleSelect(normalizeSymbol(trimmed));
    }
  };

  const renderAssetItem = (item: AssetMeta) => {
    const isSelected = currentAsset === item.symbol;
    return (
      <DropdownMenuItem
        key={item.symbol}
        onClick={() => handleSelect(item.symbol)}
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors group",
          isSelected
            ? "bg-accent font-semibold text-accent-foreground"
            : "hover:bg-accent/50",
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AssetIcon symbol={item.symbol} size="xs" />
          <div className="flex flex-col min-w-0">
            <span className="font-mono font-semibold text-foreground text-xs leading-none mb-0.5">
              {item.symbol}
            </span>
            <span className="text-[10px] text-muted-foreground truncate leading-none">
              {item.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showValues && item.specBadge && (
            <span className="text-[10px] font-mono tnum px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground/90 border border-border/40 select-none">
              {item.specBadge}
            </span>
          )}
          {isSelected && <Check className="size-3.5 text-sky-400 shrink-0" />}
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {triggerVariant === "form" ? (
          <button
            type="button"
            className={cn(
              "journal-filter-trigger flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
              alignCenter
                ? "relative justify-center px-6 text-center"
                : "justify-between text-left",
              className,
            )}
            title="Click to select or enter trade symbol"
            aria-label="Select symbol"
          >
            {currentAsset ? (
              <div className={cn("flex items-center gap-2 truncate", alignCenter && "justify-center")}>
                <AssetIcon symbol={currentAsset} size="xs" />
                <span className="font-mono font-bold text-foreground">{currentAsset}</span>
              </div>
            ) : (
              <span className="text-muted-foreground truncate">
                {placeholder ?? emptyLabel ?? "Select or enter symbol…"}
              </span>
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 shrink-0",
                alignCenter ? "absolute right-2.5 top-1/2 -translate-y-1/2" : "",
              )}
            >
              {currentAsset && allowClear && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsset(null);
                  }}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer pointer-events-auto"
                  title="Clear symbol filter"
                >
                  <X className="size-3" />
                </span>
              )}
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0 opacity-60" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "relative shrink-0 rounded-full cursor-pointer transition-transform hover:opacity-90 active:scale-95 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 p-0 border-0 bg-transparent flex items-center justify-center select-none",
              className,
            )}
            title="Click to link or change journal asset"
            aria-label="Journal asset selector"
          >
            {currentAsset ? (
              <AssetIcon symbol={currentAsset} size="md" />
            ) : (
              <span
                className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none bg-muted/40 ring-1 ring-black/5 dark:ring-white/10 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                style={{ width: 32, height: 32 }}
              >
                <BookOpen className="size-4" />
              </span>
            )}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-80 p-0 shadow-2xl rounded-xl border border-border/60 bg-popover text-popover-foreground overflow-hidden"
      >
        {/* Header with Search */}
        <div className="p-2.5 pb-2 border-b border-border/40 bg-muted/20">
          <div className="mb-2 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {triggerVariant === "form" ? "Select Symbol" : "Journal Asset"}
            </span>
          </div>

          <form onSubmit={handleCustomSubmit} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search asset or enter symbol..."
              aria-label="Search asset or enter symbol"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-7 text-xs bg-background rounded-lg border border-border/60 placeholder:text-muted-foreground/60 text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-colors"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </form>

          {/* Categories / Tabs */}
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-mini text-[11px]"
          >
            {CATEGORY_TABS.filter((tab) => {
              if (tab.id === "today" && todaySymbols.length === 0) return false;
              if (onlyCalculable && (tab.id === "forex" || tab.id === "stocks")) return false;
              return true;
            }).map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-2 py-0.5 rounded-md shrink-0 transition-colors cursor-pointer select-none font-medium",
                    isSelected
                      ? "bg-accent font-semibold text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                  )}
                >
                  {tab.label}
                  {tab.id === "today" && todaySymbols.length > 0 && ` (${todaySymbols.length})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Asset List */}
        <div className="max-h-72 overflow-y-auto scrollbar-mini p-1.5 pt-1 space-y-0.5">
          {/* Custom Symbol Option if no exact match exists (disabled in onlyCalculable mode) */}
          {!onlyCalculable && search.trim() && !hasExactMatch && (
            <DropdownMenuItem
              onClick={() => handleSelect(normalizeSymbol(search.trim()))}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 font-medium mb-1"
            >
              <AssetIcon symbol={normalizeSymbol(search.trim())} size="xs" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold">Use &quot;{normalizeSymbol(search.trim())}&quot;</span>
                <span className="text-[10px] opacity-80">Normalized symbol</span>
              </div>
            </DropdownMenuItem>
          )}

          {/* Reset / General Journal Option */}
          {!hideGeneralJournal && (
            <DropdownMenuItem
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                !currentAsset
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <BookOpen className="size-3" />
                </span>
                <span>{emptyLabel ?? "No linked asset (General Journal)"}</span>
              </div>
              {!currentAsset && <Check className="size-3.5 text-sky-400 shrink-0" />}
            </DropdownMenuItem>
          )}

          {/* User's Traded Assets Section (My Assets) at the top of All */}
          {activeTab === "all" && userAssetItems.length > 0 && (
            <>
              {(!hideGeneralJournal || (search.trim() && !hasExactMatch)) && (
                <DropdownMenuSeparator className="my-1" />
              )}
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>My Assets</span>
                <span className="text-muted-foreground/60 font-mono text-[9px]">
                  {userAssetItems.length}
                </span>
              </div>
              {userAssetItems.map(renderAssetItem)}
            </>
          )}

          {/* Today Trades Section (when on Today tab) */}
          {activeTab === "today" && (
            <>
              {(!hideGeneralJournal || (search.trim() && !hasExactMatch)) && (
                <DropdownMenuSeparator className="my-1" />
              )}
              {todayAssetItems.length > 0 ? (
                todayAssetItems.map(renderAssetItem)
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No trades recorded for today.
                </div>
              )}
            </>
          )}

          {/* General Catalog Assets (when not on today tab) */}
          {activeTab !== "today" && (
            <>
              {filteredCatalog.length > 0 && (
                <>
                  {((activeTab === "all" && userAssetItems.length > 0) ||
                    !hideGeneralJournal ||
                    (search.trim() && !hasExactMatch)) && (
                    <DropdownMenuSeparator className="my-1" />
                  )}
                  {activeTab === "all" && userAssetItems.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {search.trim() ? "Other Assets" : "All Assets"}
                    </div>
                  )}
                  {filteredCatalog.map(renderAssetItem)}
                </>
              )}

              {userAssetItems.length === 0 && filteredCatalog.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {search.trim() ? "No matching assets found." : "No assets found in this category."}
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
