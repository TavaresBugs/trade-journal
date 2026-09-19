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
 * Normalizes raw symbols:
 * - Strips exchange prefixes (`CME:NQ` -> `NQ`, `FX:EURUSD` -> `EURUSD`)
 * - Strips common delimiters (`/`, `-`, `_`, `.`)
 * - Strips futures month and expiration codes (`NQM4` -> `NQ`, `ES1!` -> `ES`)
 */
export function normalizeSymbol(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().toUpperCase();

  // Strip exchange prefix (e.g. CME:NQ -> NQ)
  if (s.includes(":")) {
    const parts = s.split(":");
    s = parts[parts.length - 1] ?? s;
  }

  // Strip delimiters: EUR/USD -> EURUSD, BTC-USDT -> BTCUSDT
  s = s.replace(/[/_\-.\s]/g, "");

  // Normalize futures root tickers (e.g., NQ1!, NQM24, ESU24, MESZ24)
  const futuresMatch = s.match(
    /^(NQ|MNQ|ES|MES|YM|MYM|RTY|M2K|CL|MCL|GC|MGC|SI|MSI|NG|HG)[FGHJKMNQUVXZ]?\d{1,4}!*$/,
  );
  if (futuresMatch?.[1]) {
    return futuresMatch[1];
  }

  return s;
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
