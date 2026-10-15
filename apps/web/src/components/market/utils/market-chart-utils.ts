import type { Resolution, MarketBar } from "@/lib/market-data";
import { getAssetIconConfig, tvManifest } from "@/lib/assets/asset-icons";
import { getSymbolSpec } from "@/lib/assets/symbol-specs";
import type { ZonedDateParts } from "../replay/market-replay-date-picker";

export const REPLAY_FAVORITE_TIMEFRAMES_KEY = "tradejournal_replay_tf_favorites_v1";

/**
 * Resolves the exchange or venue identifier dynamically from symbol specifications
 * and ingested manifests, avoiding hardcoded symbol lists.
 */
export function resolveVenue(sym: string): string {
  if (!sym) return "INDEX";
  const upper = sym.toUpperCase().trim();

  // 1. Direct lookup in canonical SymbolSpec dictionary (Futures, B3, FX, Crypto)
  const spec = getSymbolSpec(sym);
  if (spec?.exchange) {
    return spec.exchange;
  }
  if (spec?.category === "crypto") {
    return "BINANCE";
  }
  if (spec?.category === "b3") {
    return "BMFBOVESPA";
  }

  // 2. Contract Root Resolution for futures with month/year codes (e.g. NQM2024, ESU4, WDOZ24)
  const root = upper.replace(/[0-9!]/g, "");
  if (root && root !== upper) {
    const rootSpec = getSymbolSpec(root);
    if (rootSpec?.exchange) return rootSpec.exchange;
    if (rootSpec?.category === "b3") return "BMFBOVESPA";
    if (rootSpec?.category === "crypto") return "BINANCE";
  }

  // 3. Ingested TradingView Manifest Lookups
  if (tvManifest.b3?.[upper]) return "BMFBOVESPA";
  if (tvManifest.crypto?.[upper]) return "BINANCE";
  if (tvManifest.funds?.[upper] || tvManifest.stocks?.[upper]) {
    // US Equities standard: 1-3 characters are listed on NYSE, 4+ characters on NASDAQ
    return upper.length <= 3 ? "NYSE" : "NASDAQ";
  }

  // 4. Dynamic Crypto Patterns
  if (
    upper.includes("USDT") ||
    upper.includes("BUSD") ||
    upper.includes("USDC") ||
    upper.endsWith("PERP") ||
    upper.startsWith("BTC") ||
    upper.startsWith("ETH") ||
    upper.startsWith("SOL")
  ) {
    return "BINANCE";
  }

  return "INDEX";
}

/**
 * Resolves a dynamic live status label (e.g. "CME Live", "BINANCE Live", "NASDAQ Live", "Offline", "Replay").
 */
export function resolveProviderStatusText(
  sym: string,
  isReplay: boolean,
  isLiveConnected: boolean,
): string {
  if (isReplay) return "Replay";
  if (!isLiveConnected) return "Offline";
  const venue = resolveVenue(sym);
  return `${venue} Live`;
}

/**
 * Resolves an icon URL or URI for an asset symbol.
 */
export function resolveAssetIcon(sym: string): string | undefined {
  try {
    return getAssetIconConfig(sym).icons[0];
  } catch {
    return undefined;
  }
}

export {
  toVelaTf,
  fromVelaTf,
  toDisplayTf,
  resolutionToStepMs,
  matchResolution,
  syncStatuslineAndWatermark,
  normalizeChartTimezone,
} from "@luxalgo/vela/workspace";


/**
 * Safely merges existing and incoming market bars, guarding against interval mismatches.
 */
export function mergeBars(existing: MarketBar[], incoming: MarketBar[]): MarketBar[] {
  if (!existing || existing.length === 0) return incoming;
  if (!incoming || incoming.length === 0) return existing;

  // Protect against merging bars of different timeframe resolutions (e.g. 1m with 5m)
  if (existing.length >= 2 && incoming.length >= 2) {
    const existingInterval = Math.abs(existing[1]!.time - existing[0]!.time);
    const incomingInterval = Math.abs(incoming[1]!.time - incoming[0]!.time);
    if (Math.abs(existingInterval - incomingInterval) > 0.3 * Math.min(existingInterval, incomingInterval)) {
      return incoming;
    }
  }

  const map = new Map<number, MarketBar>();
  for (const b of existing) {
    map.set(b.time, b);
  }
  for (const b of incoming) {
    map.set(b.time, b);
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

/**
 * Loads favorite timeframes from local storage.
 */
export function loadReplayFavs(): string[] {
  try {
    const raw = localStorage.getItem(REPLAY_FAVORITE_TIMEFRAMES_KEY);
    if (!raw) return ["1", "5", "15", "60", "240", "D"];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : ["1", "5", "15", "60", "240", "D"];
  } catch {
    return ["1", "5", "15", "60", "240", "D"];
  }
}

/**
 * Saves favorite timeframes to local storage.
 */
export function saveReplayFavs(favs: string[]): void {
  try {
    localStorage.setItem(REPLAY_FAVORITE_TIMEFRAMES_KEY, JSON.stringify(favs));
  } catch {}
}


/**
 * Extracts zoned date components using an Intl.DateTimeFormat or UTC fallback.
 */
export function extractZonedDateParts(
  ms: number,
  formatter?: Intl.DateTimeFormat | null,
): ZonedDateParts {
  try {
    if (!formatter) throw new Error("No formatter");
    const parts = formatter.formatToParts(new Date(ms));
    const getNum = (type: string, fallback: number) => {
      const val = Number(parts.find((p) => p.type === type)?.value);
      return Number.isFinite(val) ? val : fallback;
    };
    const d = new Date(ms);
    return {
      year: getNum("year", d.getUTCFullYear()),
      month: getNum("month", d.getUTCMonth() + 1) - 1,
      day: getNum("day", d.getUTCDate()),
      hour: getNum("hour", d.getUTCHours()) % 24,
      minute: getNum("minute", d.getUTCMinutes()),
    };
  } catch {
    const d = new Date(ms);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
}

/**
 * Formats a timestamp into a short readable date string.
 */
export function formatReplayShortDate(
  ms: number,
  formatter?: Intl.DateTimeFormat | null,
): string {
  try {
    if (formatter) return formatter.format(new Date(ms));
  } catch {}
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
