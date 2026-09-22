import { normalizeSymbol } from "./symbol-utils";
import {
  SYMBOL_SPECS,
  formatSpecBadge,
  type SymbolSpec,
} from "./symbol-specs";

export type AssetCategory = "futures" | "stocks" | "forex" | "crypto";

export interface AssetMeta {
  symbol: string;
  name: string;
  category: AssetCategory;
  aliases?: string[];
  specBadge?: string | null;
}

export function getAssetCategory(rawCat: string, symbol: string): AssetCategory {
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

export const MAJOR_FOREX_PAIRS = [
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

/**
 * Builds the lightweight base catalog synchronously.
 * Contains curated futures, stocks, crypto, and major forex pairs (~70 assets)
 * with zero manifest dependency or bundle overhead on initial page render.
 */
export function getBaseAssetCatalog(): AssetMeta[] {
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

  // 2. Major Forex pairs
  for (const fx of MAJOR_FOREX_PAIRS) {
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

let _cachedFullCatalog: AssetMeta[] | null = null;
let _loadExtendedPromise: Promise<AssetMeta[]> | null = null;

/**
 * Dynamically loads the extended 1,500+ asset manifest (global stocks, B3 equities, ETFs, crypto).
 * Invoked on demand when the user interacts with the asset picker.
 */
export async function loadExtendedCatalog(): Promise<AssetMeta[]> {
  if (_cachedFullCatalog) return _cachedFullCatalog;
  if (_loadExtendedPromise) return _loadExtendedPromise;

  _loadExtendedPromise = import("./tv-icons-manifest.json")
    .then((mod) => {
      const manifest = (mod.default || mod) as any;
      const baseList = getBaseAssetCatalog();
      const list = [...baseList];
      const seen = new Set<string>(baseList.map((item) => item.symbol.toUpperCase()));

      // 1. Ingest B3 stocks/ETFs from TV manifest (Stocks category)
      for (const [sym, data] of Object.entries<any>(manifest.b3 || {})) {
        const s = sym.toUpperCase();
        if (!seen.has(s)) {
          seen.add(s);
          list.push({
            symbol: s,
            name: data?.name || s,
            category: getAssetCategory("b3", s),
            specBadge: "R$1/share",
          });
        }
      }

      // 2. Ingest US Stocks & ETFs from TV manifest (Stocks category)
      for (const [sym, data] of Object.entries<any>(manifest.stocks || {})) {
        const s = sym.toUpperCase();
        if (!seen.has(s)) {
          seen.add(s);
          list.push({
            symbol: s,
            name: data?.name || s,
            category: "stocks",
            specBadge: "$1/share",
          });
        }
      }

      // 3. Ingest Crypto from TV manifest (Crypto category)
      for (const [sym, data] of Object.entries<any>(manifest.crypto || {})) {
        const s = sym.toUpperCase();
        if (!seen.has(s)) {
          seen.add(s);
          list.push({
            symbol: s,
            name: data?.name || s,
            category: "crypto",
            specBadge: "Spot $1",
          });
        }
      }

      // 4. Ingest Funds / ETFs from TV manifest (Stocks category)
      for (const [sym, data] of Object.entries<any>(manifest.funds || {})) {
        const s = sym.toUpperCase();
        if (!seen.has(s)) {
          seen.add(s);
          list.push({
            symbol: s,
            name: data?.name || s,
            category: "stocks",
            specBadge: "$1/share",
          });
        }
      }

      _cachedFullCatalog = list;
      return list;
    })
    .catch((err) => {
      console.warn("Failed to dynamically load extended asset catalog:", err);
      return getBaseAssetCatalog();
    });

  return _loadExtendedPromise;
}

/**
 * Returns current catalog (full if loaded, otherwise base).
 */
export function getAssetCatalog(): AssetMeta[] {
  return _cachedFullCatalog || getBaseAssetCatalog();
}

/**
 * Reactive proxy for catalog access.
 */
export const ASSET_CATALOG: AssetMeta[] = new Proxy([] as AssetMeta[], {
  get(target, prop, receiver) {
    const catalog = getAssetCatalog();
    return Reflect.get(catalog, prop, receiver);
  },
});
