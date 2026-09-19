/**
 * Asset icon normalization and dynamic blend engine.
 * Maps symbols to TradingView vector SVG icons with automatic currency pair blending.
 */

export interface AssetIconConfig {
  icons: string[];
  type: "single" | "pair";
  symbol: string;
  base?: string;
  quote?: string;
  color?: string;
}

const ICON_BASE = "/assets/icons";
const FALLBACK_ICON = `${ICON_BASE}/fallback.svg`;

/** Currency flag vectors (10 core currencies enabling 90+ dynamically blended pairs). */
export const CURRENCY_FLAGS: Record<string, string> = {
  USD: `${ICON_BASE}/flags/usd.svg`,
  EUR: `${ICON_BASE}/flags/eur.svg`,
  GBP: `${ICON_BASE}/flags/gbp.svg`,
  JPY: `${ICON_BASE}/flags/jpy.svg`,
  AUD: `${ICON_BASE}/flags/aud.svg`,
  CAD: `${ICON_BASE}/flags/cad.svg`,
  CHF: `${ICON_BASE}/flags/chf.svg`,
  NZD: `${ICON_BASE}/flags/nzd.svg`,
  BRL: `${ICON_BASE}/flags/brl.svg`,
  CNY: `${ICON_BASE}/flags/cny.svg`,
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
  GER40: { icon: `${ICON_BASE}/default/EU--big.svg`, color: "#0052B4" },
  DE40: { icon: `${ICON_BASE}/default/EU--big.svg`, color: "#0052B4" },
  DAX: { icon: `${ICON_BASE}/default/EU--big.svg`, color: "#0052B4" },
  EU50: { icon: `${ICON_BASE}/default/EU--big.svg`, color: "#0052B4" },
  UK100: { icon: `${ICON_BASE}/default/GB--big.svg`, color: "#C8102E" },
  FTSE: { icon: `${ICON_BASE}/default/GB--big.svg`, color: "#C8102E" },
  JP225: { icon: `${ICON_BASE}/default/JP--big.svg`, color: "#BC002D" },
  JPN225: { icon: `${ICON_BASE}/default/JP--big.svg`, color: "#BC002D" },
  NIKKEI: { icon: `${ICON_BASE}/default/JP--big.svg`, color: "#BC002D" },

  // --- Commodities ---
  GC: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  MGC: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  GOLD: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },
  XAUUSD: { icon: `${ICON_BASE}/commodities/gold.svg`, color: "#EAB308" },

  SI: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
  MSI: { icon: `${ICON_BASE}/commodities/silver.svg`, color: "#9CA3AF" },
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
  COPPER: { icon: `${ICON_BASE}/commodities/copper.svg`, color: "#B45309" },

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
const CRYPTO_BASES: Record<string, string> = {
  BTC: `${ICON_BASE}/crypto/bitcoin.svg`,
  ETH: `${ICON_BASE}/crypto/ethereum.svg`,
  SOL: `${ICON_BASE}/crypto/solana.svg`,
  ADA: `${ICON_BASE}/crypto/cardano.svg`,
  XRP: `${ICON_BASE}/crypto/ripple.svg`,
};

/**
 * Resolves a raw broker symbol into its clean canonical market asset.
 * Uses pattern recognition / containment to reliably identify the underlying
 * instrument across brokers (CFD spot, futures, forex, crypto) without destructive string deletion.
 *
 * Examples:
 * - "us100.cash", "US100_cash", "US100CASH" -> "US100"
 * - "us500.cash", "SPX500.pro", "ESU24" -> "US500" / "ES"
 * - "EURUSD.pro", "EUR/USD", "FX:EUR_USD" -> "EURUSD"
 * - "XAUUSD.raw", "GOLD_cash", "XAU/USD" -> "XAUUSD"
 */
export function normalizeSymbol(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().toUpperCase();

  // Guard standalone tickers (e.g. Horizons High Interest Savings ETF 'CASH')
  if (s === "CASH") return "CASH";

  // 1. Strip exchange prefix (e.g. CME:NQ -> NQ, FX:EURUSD -> EURUSD)
  if (s.includes(":")) {
    const parts = s.split(":");
    s = parts[parts.length - 1] ?? s;
  }

  // 2. Continuous futures contract patterns (e.g. NQM24, ESU24, MESZ24, GCQ24)
  const futuresMatch = s.match(
    /^(NQ|MNQ|ES|MES|YM|MYM|RTY|M2K|CL|MCL|GC|MGC|SI|MSI|NG|HG)[FGHJKMNQUVXZ]?\d{1,4}!*$/,
  );
  if (futuresMatch?.[1]) {
    return futuresMatch[1];
  }

  // Strip non-alphanumeric noise for pattern containment tests
  const clean = s.replace(/[^A-Z0-9]/g, "");

  // 3. Index Canonical Matching by Inclusion
  // Nasdaq-100 family
  if (
    clean.includes("US100") ||
    clean.includes("NAS100") ||
    clean.includes("USTEC") ||
    clean.includes("NDX") ||
    clean === "NQ" ||
    clean === "MNQ"
  ) {
    return clean === "MNQ" ? "MNQ" : clean === "NQ" ? "NQ" : "US100";
  }

  // S&P 500 family
  if (
    clean.includes("US500") ||
    clean.includes("SPX500") ||
    clean.includes("SP500") ||
    clean.includes("SPX") ||
    clean === "ES" ||
    clean === "MES"
  ) {
    return clean === "MES" ? "MES" : clean === "ES" ? "ES" : "US500";
  }

  // Dow Jones 30 family
  if (
    clean.includes("US30") ||
    clean.includes("DJ30") ||
    clean.includes("DJI") ||
    clean.includes("WALLSTREET") ||
    clean === "YM" ||
    clean === "MYM"
  ) {
    return clean === "MYM" ? "MYM" : clean === "YM" ? "YM" : "US30";
  }

  // Russell 2000 family
  if (clean.includes("US2000") || clean.includes("RUSSELL") || clean === "RTY" || clean === "M2K") {
    return clean === "M2K" ? "M2K" : clean === "RTY" ? "RTY" : "US2000";
  }

  // US Dollar Index
  if (clean.includes("DXY") || clean.includes("USDX")) {
    return "DXY";
  }

  // DAX / German 40
  if (clean.includes("GER40") || clean.includes("DE40") || clean.includes("DAX")) {
    return "GER40";
  }

  // FTSE 100
  if (clean.includes("UK100") || clean.includes("FTSE")) {
    return "UK100";
  }

  // Nikkei 225
  if (clean.includes("JP225") || clean.includes("JPN225") || clean.includes("NIKKEI")) {
    return "JP225";
  }

  // 4. Commodities Canonical Matching by Inclusion
  if (clean.includes("XAUUSD")) return "XAUUSD";
  if (clean.includes("GOLD")) return "GOLD";
  if (clean.includes("XAGUSD")) return "XAGUSD";
  if (clean.includes("SILVER")) return "SILVER";
  if (
    clean.includes("USOIL") ||
    clean.includes("UKOIL") ||
    clean.includes("CRUDE") ||
    clean.includes("WTI") ||
    clean.includes("BRENT")
  ) {
    return "USOIL";
  }
  if (clean.includes("NATGAS")) return "NATGAS";
  if (clean.includes("COPPER")) return "COPPER";

  // 5. Forex Pairs Canonical Matching (matches any base + quote from core currencies)
  for (const base of Object.keys(CURRENCY_FLAGS)) {
    if (clean.startsWith(base)) {
      const remainder = clean.slice(base.length);
      for (const quote of Object.keys(CURRENCY_FLAGS)) {
        if (remainder.startsWith(quote)) {
          return `${base}${quote}`;
        }
      }
    }
  }

  // 6. Crypto Pairs Canonical Matching
  for (const crypto of Object.keys(CRYPTO_BASES)) {
    if (clean.startsWith(crypto)) {
      const remainder = clean.slice(crypto.length);
      if (remainder.startsWith("USDT")) return `${crypto}USDT`;
      if (remainder.startsWith("USD")) return `${crypto}USD`;
      return crypto;
    }
  }

  // 7. Known single asset direct match
  if (SINGLE_ASSETS[clean]) {
    return clean;
  }

  return clean || s;
}

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

  // Tier 2B: Crypto / Stablecoin or Fiat blend (e.g. BTCUSDT, ETHUSD, SOLUSDT, XRPUSDT)
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

  // Fallback: graceful generic icon
  return {
    icons: [FALLBACK_ICON],
    type: "single",
    symbol,
  };
}
