/**
 * Asset icon normalization and dynamic blend engine.
 * Maps symbols to TradingView vector SVG icons with automatic currency pair blending.
 */

import tvManifestRaw from "./tv-icons-manifest.json";
import { normalizeSymbol } from "./symbol-utils";

export { normalizeSymbol };

export interface AssetIconConfig {
  icons: string[];
  type: "single" | "pair";
  symbol: string;
  base?: string;
  quote?: string;
  color?: string;
}

interface TvManifestEntry {
  icon: string;
  name?: string;
  logoid?: string;
}

interface TvManifest {
  flags: Record<string, TvManifestEntry>;
  indices: Record<string, TvManifestEntry>;
  commodities: Record<string, TvManifestEntry>;
  crypto: Record<string, TvManifestEntry>;
  stocks: Record<string, TvManifestEntry>;
  b3?: Record<string, TvManifestEntry>;
  funds: Record<string, TvManifestEntry>;
  brokers?: Record<string, TvManifestEntry>;
  exchanges?: Record<string, TvManifestEntry>;
}

export const tvManifest = tvManifestRaw as unknown as TvManifest;

const ICON_BASE = "/assets/icons";
const FALLBACK_ICON = `${ICON_BASE}/fallback.svg`;

/** Currency flag vectors (35+ currencies enabling hundreds of dynamically blended pairs). */
export const CURRENCY_FLAGS: Record<string, string> = {
  USD: `${ICON_BASE}/flags/us.svg`,
  EUR: `${ICON_BASE}/flags/eu.svg`,
  GBP: `${ICON_BASE}/flags/gb.svg`,
  JPY: `${ICON_BASE}/flags/jp.svg`,
  AUD: `${ICON_BASE}/flags/au.svg`,
  CAD: `${ICON_BASE}/flags/ca.svg`,
  CHF: `${ICON_BASE}/flags/ch.svg`,
  NZD: `${ICON_BASE}/flags/nz.svg`,
  BRL: `${ICON_BASE}/flags/br.svg`,
  CNY: `${ICON_BASE}/flags/cn.svg`,
  ...Object.fromEntries(
    Object.entries(tvManifest.flags || {}).map(([currency, data]) => [currency, data.icon]),
  ),
};

/** Dedicated branded vector SVGs for indices, commodities, and crypto assets. */
export const SINGLE_ASSETS: Record<string, { icon: string; color: string }> = {
  // --- US Indices ---
  NQ: { icon: `${ICON_BASE}/indices/nasdaq-100.svg`, color: "#195594" },
  MNQ: { icon: `${ICON_BASE}/indices/nasdaq-100.svg`, color: "#195594" },
  US100: { icon: `${ICON_BASE}/indices/nasdaq-100.svg`, color: "#195594" },
  NAS100: { icon: `${ICON_BASE}/indices/nasdaq-100.svg`, color: "#195594" },
  USTEC: { icon: `${ICON_BASE}/indices/nasdaq-100.svg`, color: "#195594" },

  ES: { icon: `${ICON_BASE}/indices/sp500.svg`, color: "#C4162E" },
  MES: { icon: `${ICON_BASE}/indices/sp500.svg`, color: "#C4162E" },
  US500: { icon: `${ICON_BASE}/indices/sp500.svg`, color: "#C4162E" },
  SPX: { icon: `${ICON_BASE}/indices/sp500.svg`, color: "#C4162E" },
  SPX500: { icon: `${ICON_BASE}/indices/sp500.svg`, color: "#C4162E" },

  YM: { icon: `${ICON_BASE}/indices/dow-jones.svg`, color: "#3B82F6" },
  MYM: { icon: `${ICON_BASE}/indices/dow-jones.svg`, color: "#3B82F6" },
  US30: { icon: `${ICON_BASE}/indices/dow-jones.svg`, color: "#3B82F6" },
  DJ30: { icon: `${ICON_BASE}/indices/dow-jones.svg`, color: "#3B82F6" },

  RTY: { icon: `${ICON_BASE}/indices/russell-2000.svg`, color: "#8B5CF6" },
  M2K: { icon: `${ICON_BASE}/indices/russell-2000.svg`, color: "#8B5CF6" },
  US2000: { icon: `${ICON_BASE}/indices/russell-2000.svg`, color: "#8B5CF6" },

  DXY: { icon: `${ICON_BASE}/indices/us-dollar-index.svg`, color: "#059669" },
  USDX: { icon: `${ICON_BASE}/indices/us-dollar-index.svg`, color: "#059669" },

  // --- European & Asian Indices (CFD Popular) ---
  GER40: { icon: `${ICON_BASE}/flags/eu.svg`, color: "#0052B4" },
  DE40: { icon: `${ICON_BASE}/flags/eu.svg`, color: "#0052B4" },
  DAX: { icon: `${ICON_BASE}/flags/eu.svg`, color: "#0052B4" },
  EU50: { icon: `${ICON_BASE}/flags/eu.svg`, color: "#0052B4" },
  UK100: { icon: `${ICON_BASE}/flags/gb.svg`, color: "#C8102E" },
  FTSE: { icon: `${ICON_BASE}/flags/gb.svg`, color: "#C8102E" },
  JP225: { icon: `${ICON_BASE}/flags/jp.svg`, color: "#BC002D" },
  JPN225: { icon: `${ICON_BASE}/flags/jp.svg`, color: "#BC002D" },
  NIKKEI: { icon: `${ICON_BASE}/flags/jp.svg`, color: "#BC002D" },

  // --- Brazilian B3 Futures ---
  WIN: { icon: `${ICON_BASE}/flags/br.svg`, color: "#009C3B" },
  IND: { icon: `${ICON_BASE}/flags/br.svg`, color: "#009C3B" },
  WDO: { icon: `${ICON_BASE}/flags/br.svg`, color: "#002776" },
  DOL: { icon: `${ICON_BASE}/flags/br.svg`, color: "#002776" },

  // --- Bonds & Rates ---
  ZN: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },
  ZB: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },
  ZF: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },
  ZT: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },
  TN: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },
  UB: { icon: `${ICON_BASE}/flags/us.svg`, color: "#1E3A8A" },

  // --- CME Currency Futures ---
  "6E": { icon: `${ICON_BASE}/flags/eu.svg`, color: "#003399" },
  M6E: { icon: `${ICON_BASE}/flags/eu.svg`, color: "#003399" },
  "6B": { icon: `${ICON_BASE}/flags/gb.svg`, color: "#C8102E" },
  M6B: { icon: `${ICON_BASE}/flags/gb.svg`, color: "#C8102E" },
  "6A": { icon: `${ICON_BASE}/flags/au.svg`, color: "#00008B" },
  "6C": { icon: `${ICON_BASE}/flags/ca.svg`, color: "#FF0000" },
  "6J": { icon: `${ICON_BASE}/flags/jp.svg`, color: "#BC002D" },

  // --- Commodities ---
  GC: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  MGC: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  GOLD: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  XAUUSD: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },

  SI: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
  MSI: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
  SIL: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
  SILVER: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
  XAGUSD: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },

  CL: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#1F2937" },
  MCL: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#1F2937" },
  QM: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#1F2937" },
  USOIL: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#1F2937" },
  WTI: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#1F2937" },

  NG: { icon: `${ICON_BASE}/commodities/natural-gas.svg`, color: "#3B82F6" },
  NATGAS: { icon: `${ICON_BASE}/commodities/natural-gas.svg`, color: "#3B82F6" },

  HG: { icon: `${ICON_BASE}/commodities/copper.svg`, color: "#B45309" },
  MHG: { icon: `${ICON_BASE}/commodities/copper.svg`, color: "#B45309" },
  COPPER: { icon: `${ICON_BASE}/commodities/copper.svg`, color: "#B45309" },

  PL: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#E5E7EB" },
  RB: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#EF4444" },
  HO: { icon: `${ICON_BASE}/commodities/crude-oil.svg`, color: "#F97316" },

  // --- Crypto ---
  BTC: { icon: `${ICON_BASE}/crypto/bitcoin.svg`, color: "#F97316" },
  BITCOIN: { icon: `${ICON_BASE}/crypto/bitcoin.svg`, color: "#F97316" },
  MBT: { icon: `${ICON_BASE}/crypto/bitcoin.svg`, color: "#F97316" },

  ETH: { icon: `${ICON_BASE}/crypto/ethereum.svg`, color: "#6366F1" },
  ETHEREUM: { icon: `${ICON_BASE}/crypto/ethereum.svg`, color: "#6366F1" },
  MET: { icon: `${ICON_BASE}/crypto/ethereum.svg`, color: "#6366F1" },

  SOL: { icon: `${ICON_BASE}/crypto/solana.svg`, color: "#8B5CF6" },
  SOLANA: { icon: `${ICON_BASE}/crypto/solana.svg`, color: "#8B5CF6" },

  ADA: { icon: `${ICON_BASE}/crypto/cardano.svg`, color: "#3B82F6" },
  CARDANO: { icon: `${ICON_BASE}/crypto/cardano.svg`, color: "#3B82F6" },

  XRP: { icon: `${ICON_BASE}/crypto/ripple.svg`, color: "#6366F1" },
  RIPPLE: { icon: `${ICON_BASE}/crypto/ripple.svg`, color: "#6366F1" },

  USDT: { icon: `${ICON_BASE}/crypto/tether.svg`, color: "#10B981" },
  TETHER: { icon: `${ICON_BASE}/crypto/tether.svg`, color: "#10B981" },
};

/** Crypto base assets that can pair with fiat or stablecoin quotes. */
export const CRYPTO_BASES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(tvManifest.crypto || {}).map(([coin, data]) => [coin, data.icon]),
  ),
  BTC: `${ICON_BASE}/crypto/bitcoin.svg`,
  ETH: `${ICON_BASE}/crypto/ethereum.svg`,
  SOL: `${ICON_BASE}/crypto/solana.svg`,
  ADA: `${ICON_BASE}/crypto/cardano.svg`,
  XRP: `${ICON_BASE}/crypto/ripple.svg`,
};

/**
 * Resolves an asset symbol into an icon configuration.
 * Dynamically resolves forex pairs, crypto pairs, and single index/commodity assets.
 */
export function getAssetIconConfig(rawSymbol: string): AssetIconConfig {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return { icons: [FALLBACK_ICON], type: "single", symbol: "" };
  }

  // Tier 1: Exact single asset match (indices, commodities, standalone crypto)
  if (SINGLE_ASSETS[symbol]) {
    return {
      icons: [SINGLE_ASSETS[symbol].icon],
      type: "single",
      symbol,
      color: SINGLE_ASSETS[symbol].color,
    };
  }

  // Tier 1B: TradingView ingested catalog match (funds, stocks, b3, commodities, indices)
  const manifestMatch =
    tvManifest.funds?.[symbol] ||
    tvManifest.stocks?.[symbol] ||
    tvManifest.b3?.[symbol] ||
    tvManifest.indices?.[symbol] ||
    tvManifest.commodities?.[symbol];

  if (manifestMatch) {
    return {
      icons: [manifestMatch.icon],
      type: "single",
      symbol,
    };
  }

  // Tier 2A: Dynamic Forex pair blend (6-character major & cross pairs)
  if (symbol.length === 6) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    if (CURRENCY_FLAGS[base] && CURRENCY_FLAGS[quote]) {
      return {
        icons: [CURRENCY_FLAGS[base], CURRENCY_FLAGS[quote]],
        type: "pair",
        symbol,
        base,
        quote,
      };
    }
  }

  // Tier 2B: Crypto / Stablecoin or Fiat blend (e.g. BTCUSDT, ETHUSD, SOLUSDT, XRPUSDT, SUIUSDT)
  for (const [crypto, icon] of Object.entries(CRYPTO_BASES)) {
    if (symbol.startsWith(crypto)) {
      const quote = symbol.slice(crypto.length);
      if (quote === "USDT") {
        return {
          icons: [icon, `${ICON_BASE}/crypto/tether.svg`],
          type: "pair",
          symbol,
          base: crypto,
          quote: "USDT",
        };
      }
      if (CURRENCY_FLAGS[quote]) {
        return {
          icons: [icon, CURRENCY_FLAGS[quote]],
          type: "pair",
          symbol,
          base: crypto,
          quote,
        };
      }
    }
  }

  // Tier 2C: Standalone crypto in manifest
  if (tvManifest.crypto?.[symbol]) {
    return {
      icons: [tvManifest.crypto[symbol].icon],
      type: "single",
      symbol,
    };
  }

  // Fallback: graceful generic icon
  return {
    icons: [FALLBACK_ICON],
    type: "single",
    symbol,
  };
}

/**
 * Resolves a broker or prop firm name / slug to its official vector SVG icon.
 */
export function getBrokerIcon(nameOrSlug: string): string | null {
  if (!nameOrSlug) return null;
  const clean = nameOrSlug.trim();
  const upper = clean.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const lower = clean.toLowerCase();
  return (
    tvManifest.brokers?.[clean]?.icon ||
    tvManifest.brokers?.[upper]?.icon ||
    tvManifest.brokers?.[lower]?.icon ||
    null
  );
}

/**
 * Resolves an exchange or execution venue code to its official vector SVG icon.
 */
export function getExchangeIcon(exchangeCode: string): string | null {
  if (!exchangeCode) return null;
  const clean = exchangeCode.trim().toUpperCase();
  return tvManifest.exchanges?.[clean]?.icon || null;
}
