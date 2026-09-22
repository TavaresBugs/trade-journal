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
import { normalizeSymbol } from "@/lib/assets/asset-icons";
import { cn } from "@/lib/utils";

export interface AssetMeta {
  symbol: string;
  name: string;
  category: "indices" | "commodities" | "forex" | "crypto" | "stocks";
  aliases?: string[];
}

export const ASSET_CATALOG: AssetMeta[] = [
  // --- Global Indices (Futures & CFDs) ---
  {
    symbol: "NQ",
    name: "Nasdaq 100 (Futures)",
    category: "indices",
    aliases: ["NAS100", "USTEC", "NASDAQ"],
  },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq 100", category: "indices" },
  {
    symbol: "US100",
    name: "Nasdaq 100 (CFD Spot)",
    category: "indices",
    aliases: ["NAS100", "USTEC"],
  },
  { symbol: "ES", name: "S&P 500 (Futures)", category: "indices", aliases: ["SPX", "SP500"] },
  { symbol: "MES", name: "Micro E-mini S&P 500", category: "indices" },
  {
    symbol: "US500",
    name: "S&P 500 (CFD Spot)",
    category: "indices",
    aliases: ["SPX500", "SP500"],
  },
  { symbol: "YM", name: "Dow Jones 30 (Futures)", category: "indices", aliases: ["DJ30", "DOW"] },
  { symbol: "MYM", name: "Micro E-mini Dow Jones", category: "indices" },
  {
    symbol: "US30",
    name: "Dow Jones 30 (CFD Spot)",
    category: "indices",
    aliases: ["DJ30", "WALLSTREET"],
  },
  {
    symbol: "RTY",
    name: "Russell 2000 (Futures)",
    category: "indices",
    aliases: ["M2K", "RUSSELL"],
  },
  {
    symbol: "US2000",
    name: "Russell 2000 (CFD Spot)",
    category: "indices",
    aliases: ["M2K", "RUSSELL"],
  },
  { symbol: "DXY", name: "US Dollar Index", category: "indices", aliases: ["USDX", "DOLAR"] },
  { symbol: "GER40", name: "DAX 40 (Germany)", category: "indices", aliases: ["DAX", "DE40"] },
  { symbol: "UK100", name: "FTSE 100 (United Kingdom)", category: "indices", aliases: ["FTSE"] },
  {
    symbol: "JP225",
    name: "Nikkei 225 (Japan)",
    category: "indices",
    aliases: ["NIKKEI", "JPN225"],
  },
  { symbol: "EU50", name: "Euro Stoxx 50", category: "indices" },

  // --- Commodities & Metals ---
  {
    symbol: "XAUUSD",
    name: "Gold Spot",
    category: "commodities",
    aliases: ["GOLD", "GC", "MGC", "OURO"],
  },
  {
    symbol: "XAGUSD",
    name: "Silver Spot",
    category: "commodities",
    aliases: ["SILVER", "SI", "MSI", "PRATA"],
  },
  {
    symbol: "CL",
    name: "Crude Oil (WTI)",
    category: "commodities",
    aliases: ["USOIL", "WTI", "MCL", "PETROLEO", "OIL"],
  },
  { symbol: "NG", name: "Natural Gas", category: "commodities", aliases: ["NATGAS", "GAS"] },
  { symbol: "HG", name: "Copper", category: "commodities", aliases: ["COPPER", "COBRE"] },

  // --- Forex (Currencies) ---
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex", aliases: ["EUR/USD"] },
  {
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    category: "forex",
    aliases: ["GBP/USD", "CABLE"],
  },
  {
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    category: "forex",
    aliases: ["USD/JPY", "YEN"],
  },
  {
    symbol: "AUDUSD",
    name: "Australian Dollar / US Dollar",
    category: "forex",
    aliases: ["AUD/USD", "AUSSIE"],
  },
  {
    symbol: "USDCAD",
    name: "US Dollar / Canadian Dollar",
    category: "forex",
    aliases: ["USD/CAD", "LOONIE"],
  },
  {
    symbol: "USDCHF",
    name: "US Dollar / Swiss Franc",
    category: "forex",
    aliases: ["USD/CHF", "SWISSIE"],
  },
  {
    symbol: "NZDUSD",
    name: "New Zealand Dollar / US Dollar",
    category: "forex",
    aliases: ["NZD/USD", "KIWI"],
  },
  { symbol: "EURGBP", name: "Euro / British Pound", category: "forex", aliases: ["EUR/GBP"] },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", category: "forex", aliases: ["EUR/JPY"] },
  {
    symbol: "GBPJPY",
    name: "British Pound / Japanese Yen",
    category: "forex",
    aliases: ["GBP/JPY", "GUFFY"],
  },

  // --- Crypto ---
  {
    symbol: "BTCUSD",
    name: "Bitcoin / USD",
    category: "crypto",
    aliases: ["BTC", "BTCUSDT", "BITCOIN"],
  },
  {
    symbol: "ETHUSD",
    name: "Ethereum / USD",
    category: "crypto",
    aliases: ["ETH", "ETHUSDT", "ETHEREUM"],
  },
  {
    symbol: "SOLUSD",
    name: "Solana / USD",
    category: "crypto",
    aliases: ["SOL", "SOLUSDT", "SOLANA"],
  },
  { symbol: "XRPUSD", name: "Ripple / USD", category: "crypto", aliases: ["XRP", "RIPPLE"] },
  { symbol: "ADAUSD", name: "Cardano / USD", category: "crypto", aliases: ["ADA", "CARDANO"] },

  // --- Equities & ETFs ---
  { symbol: "AAPL", name: "Apple Inc.", category: "stocks", aliases: ["APPLE"] },
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "stocks", aliases: ["NVIDIA"] },
  { symbol: "TSLA", name: "Tesla Inc.", category: "stocks", aliases: ["TESLA"] },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "stocks", aliases: ["MICROSOFT"] },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "stocks", aliases: ["AMAZON"] },
  {
    symbol: "META",
    name: "Meta Platforms",
    category: "stocks",
    aliases: ["FACEBOOK", "INSTAGRAM"],
  },
  { symbol: "GOOGL", name: "Alphabet (Google)", category: "stocks", aliases: ["GOOGLE"] },
  { symbol: "AMD", name: "Advanced Micro Devices", category: "stocks" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "stocks" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "stocks" },
];

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "user", label: "My Assets" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Commodities" },
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
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

  // Smart filter by search query and category tab
  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normQ = q ? normalizeSymbol(q).toLowerCase() : "";

    return ASSET_CATALOG.filter((item) => {
      // Tab / category filter
      if (activeTab === "today") {
        if (!todaySymbols.includes(item.symbol)) return false;
      } else if (activeTab === "user") {
        if (!userHistorySymbols.includes(item.symbol)) return false;
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
  }, [search, activeTab, todaySymbols, userHistorySymbols]);

  // Traded symbols from user history not found in standard catalog
  const extraUserSymbols = useMemo(() => {
    const q = search.trim().toLowerCase();
    const catalogSymbols = new Set(ASSET_CATALOG.map((a) => a.symbol.toUpperCase()));

    const list =
      activeTab === "today"
        ? todaySymbols.filter((s) => !catalogSymbols.has(s))
        : activeTab === "user" || activeTab === "all"
          ? userHistorySymbols.filter((s) => !catalogSymbols.has(s))
          : [];

    if (!q) return list;
    return list.filter((s) => s.toLowerCase().includes(q));
  }, [activeTab, todaySymbols, userHistorySymbols, search]);

  const hasExactMatch = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return false;
    const normQ = normalizeSymbol(q);
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
  }, [search, userHistorySymbols, todaySymbols]);

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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {triggerVariant === "form" ? (
          <button
            type="button"
            className={cn(
              "journal-filter-trigger flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left cursor-pointer",
              className,
            )}
            title="Click to select or enter trade symbol"
            aria-label="Select symbol"
          >
            {currentAsset ? (
              <div className="flex items-center gap-2 truncate">
                <AssetIcon symbol={currentAsset} size="xs" />
                <span className="font-mono font-bold text-foreground">{currentAsset}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {placeholder ?? emptyLabel ?? "Select or enter symbol…"}
              </span>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {currentAsset && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsset(null);
                  }}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
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
        align="start"
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
              if (tab.id === "user" && userHistorySymbols.length === 0) return false;
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
          {/* Custom Symbol Option if no exact match exists */}
          {search.trim() && !hasExactMatch && (
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

          {/* User History Symbols (if any) */}
          {extraUserSymbols.length > 0 && (
            <>
              {((search.trim() && !hasExactMatch) || !hideGeneralJournal) && (
                <DropdownMenuSeparator className="my-1" />
              )}
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-0.5">
                Your Traded Assets
              </DropdownMenuLabel>
              {extraUserSymbols.map((sym) => {
                const isSelected = currentAsset === sym;
                return (
                  <DropdownMenuItem
                    key={sym}
                    onClick={() => handleSelect(sym)}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                      isSelected
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AssetIcon symbol={sym} size="xs" />
                      <span className="font-mono font-semibold">{sym}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-sky-400 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          {/* Catalog Assets List */}
          {filteredCatalog.length > 0 ? (
            <>
              {((search.trim() && !hasExactMatch) ||
                !hideGeneralJournal ||
                extraUserSymbols.length > 0) && <DropdownMenuSeparator className="my-1" />}
              {filteredCatalog.map((item) => {
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
                    {isSelected && <Check className="size-3.5 text-sky-400 shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </>
          ) : (
            !search.trim() && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No assets found in this category.
              </div>
            )
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
