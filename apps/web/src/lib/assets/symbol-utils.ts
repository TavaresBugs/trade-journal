/**
 * Lightweight, zero-dependency symbol normalization utility.
 * Eliminates bundle bloat by decoupling pure string resolution from SVG icon assets and the 240KB TV manifest.
 */

/** Major fiat currency codes (ISO 4217) for Forex pair decomposition. */
export const MAJOR_CURRENCY_CODES: readonly string[] = [
  "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "BRL", "CNY",
  "HKD", "SGD", "SEK", "NOK", "MXN", "ZAR", "TRY", "INR", "KRW", "PLN",
  "DKK", "CZK", "HUF", "ILS", "CLP", "PHP", "IDR", "MYR", "THB", "AED",
  "SAR", "RUB", "COP", "PEN", "TWD", "VND",
];

/** Popular crypto base tickers for crypto pair decomposition. */
export const POPULAR_CRYPTO_BASES: readonly string[] = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "LINK", "DOT",
  "MATIC", "LTC", "NEAR", "UNI", "ATOM", "SUI", "PEPE", "SHIB", "TIA", "INJ",
  "APT", "RENDER", "FET", "ICP", "ARB", "OP", "KAS", "TON", "FIL", "STX",
  "RUNE", "FTM", "ALGO", "HBAR", "USDT", "USDC",
];

/** Canonical single futures / commodity / index roots that should not be split into currency pairs. */
const KNOWN_SINGLE_ROOTS = new Set([
  "NQ", "MNQ", "ES", "MES", "YM", "MYM", "RTY", "M2K", "DXY", "USDX",
  "GER40", "DE40", "DAX", "EU50", "UK100", "FTSE", "JP225", "JPN225", "NIKKEI",
  "WIN", "IND", "WDO", "DOL",
  "ZN", "ZB", "ZF", "ZT", "TN", "UB",
  "6E", "M6E", "6B", "M6B", "6A", "6C", "6J",
  "GC", "MGC", "GOLD", "XAUUSD",
  "SI", "MSI", "SIL", "SILVER", "XAGUSD",
  "CL", "MCL", "QM", "USOIL", "WTI", "UKOIL", "BRENT", "CRUDE",
  "NG", "NATGAS", "HG", "MHG", "COPPER", "PL", "RB", "HO",
  "BTC", "MBT", "ETH", "MET", "SOL", "ADA", "XRP", "USDT",
]);

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

  // 1.5 Strip common broker account suffixes (.pro, .cash, .raw, .std, .ecn, _sb, etc.)
  if (s !== "CASH") {
    s = s.replace(/[\._]?(CASH|PRO|RAW|STD|ECN|MINI|MICRO|SB)$/i, "");
  }

  // 2. Continuous futures contract patterns (e.g. NQM24, ESU24, MESZ24, GCQ24, WINV24, WDOZ24)
  const futuresMatch = s.match(
    /^(NQ|MNQ|ES|MES|YM|MYM|RTY|M2K|CL|MCL|GC|MGC|SI|MSI|SIL|NG|HG|MHG|PL|RB|HO|ZB|ZN|ZF|ZT|TN|UB|WIN|WDO|IND|DOL|6E|M6E|6B|M6B|6A|6C|6J|BTC|MBT|ETH|MET)[FGHJKMNQUVXZ]?\d{1,4}!*$/i,
  );
  if (futuresMatch?.[1]) {
    return futuresMatch[1].toUpperCase();
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

  // Exact match for known single roots (GC, SI, CL, NQ, ES, YM, RTY, BTC, ETH, etc.)
  if (KNOWN_SINGLE_ROOTS.has(clean)) {
    return clean;
  }

  // 5. Forex Pairs Canonical Matching (matches any 3-letter currency pair)
  for (const base of MAJOR_CURRENCY_CODES) {
    if (clean.startsWith(base)) {
      const remainder = clean.slice(base.length);
      for (const quote of MAJOR_CURRENCY_CODES) {
        if (remainder === quote) {
          return `${base}${quote}`;
        }
      }
    }
  }

  // 6. Crypto Pairs Canonical Matching (sort longest first, only match valid quote suffixes)
  const sortedCryptoBases = [...POPULAR_CRYPTO_BASES].sort((a, b) => b.length - a.length);
  for (const crypto of sortedCryptoBases) {
    if (clean === crypto) return crypto;
    if (clean.startsWith(crypto)) {
      const remainder = clean.slice(crypto.length);
      if (
        remainder === "USDT" ||
        remainder === "USD" ||
        remainder === "BUSD" ||
        remainder === "USDC"
      ) {
        return `${crypto}${remainder}`;
      }
      if (MAJOR_CURRENCY_CODES.includes(remainder)) {
        return `${crypto}${remainder}`;
      }
    }
  }

  return clean || s;
}
