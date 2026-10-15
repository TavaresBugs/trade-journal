/** Provider-neutral candles. Time is the UTC bar-open timestamp in milliseconds. */
export interface MarketBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const RESOLUTIONS = {
  "1m": 60_000,
  "2m": 120_000,
  "3m": 180_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "45m": 2_700_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "3h": 10_800_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "8h": 28_800_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "3d": 259_200_000,
  "1w": 604_800_000,
  "1mo": 2_592_000_000,
} as const;
export type StandardResolution = keyof typeof RESOLUTIONS;
export type Resolution = StandardResolution;
export const isResolution = (value: unknown): value is Resolution =>
  typeof value === "string" &&
  (Object.hasOwn(RESOLUTIONS, value) ||
    /^\d+\s*(s|m|h|d|w|mo)$/i.test(value) ||
    /^(D|3D|W|M|daily|weekly|monthly)$/i.test(value));

/**
 * Institutional TradingView-style aesthetic timeframe formatter:
 * - Minutes: 1m, 5m, 15m, 30m
 * - Hours: 1H, 2H, 4H, 12H (capitalized H)
 * - Days: D, 3D (capitalized D)
 * - Weeks: W (capitalized W)
 * - Months: M (capitalized M)
 */
export function formatResolutionDisplay(res: string): string {
  if (!res) return "";
  const trimmed = res.trim();
  if (trimmed === "1d" || trimmed === "1D" || trimmed.toLowerCase() === "daily") return "D";
  if (trimmed === "3d" || trimmed === "3D") return "3D";
  if (trimmed === "1w" || trimmed === "1W" || trimmed.toLowerCase() === "weekly") return "W";
  if (trimmed === "1mo" || trimmed === "1M" || trimmed.toLowerCase() === "monthly") return "M";

  const match = trimmed.match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (!match || !match[1] || !match[2]) return trimmed;
  const num = match[1];
  const unit = match[2].toLowerCase();
  if (unit === "h" || unit === "hr" || unit === "hour" || unit === "hours") return `${num}H`;
  if (unit === "d" || unit === "day" || unit === "days") return num === "1" ? "D" : `${num}D`;
  if (unit === "w" || unit === "wk" || unit === "week" || unit === "weeks")
    return num === "1" ? "W" : `${num}W`;
  if (unit === "mo" || unit === "month" || unit === "months") return num === "1" ? "M" : `${num}M`;
  if (unit === "m" || unit === "min" || unit === "minute" || unit === "minutes") return `${num}m`;
  return trimmed;
}

/**
 * Normalizes user/broker timeframe strings into canonical database storage keys:
 * - "1H", "4H" -> "1h", "4h"
 * - "D", "daily" -> "1d"
 * - "3D" -> "3d"
 * - "W", "weekly" -> "1w"
 * - "M", "monthly" -> "1mo"
 * - "30min", "30M" -> "30m"
 */
export function normalizeResolution(input: string): string {
  if (!input) return "1m";
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "D" || trimmed.toLowerCase() === "daily" || trimmed.toLowerCase() === "day")
    return "1d";
  if (upper === "3D") return "3d";
  if (upper === "W" || trimmed.toLowerCase() === "weekly" || trimmed.toLowerCase() === "week")
    return "1w";
  if (upper === "M" || trimmed.toLowerCase() === "monthly" || trimmed.toLowerCase() === "month")
    return "1mo";

  const match = trimmed.match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (!match || !match[1] || !match[2]) return trimmed.toLowerCase();
  const num = match[1];
  const unit = match[2].toLowerCase();
  if (unit.startsWith("h")) return `${num}h`;
  if (unit.startsWith("d")) return `${num}d`;
  if (unit.startsWith("mo") || (match[2] === "M" && (num === "1" || num === "3")))
    return `${num}mo`;
  if (unit.startsWith("m") || unit.startsWith("s") || match[2] === "M")
    return `${num}${unit.startsWith("s") ? "s" : "m"}`;
  return `${num}${unit}`;
}

/**
 * Returns resolution duration in milliseconds.
 * Returns known constant if present, or mathematically parses arbitrary string (e.g. "30m", "2h", "1d").
 */
export function parseResolutionMs(value: string): number {
  const norm = normalizeResolution(value);
  if (norm in RESOLUTIONS) return RESOLUTIONS[norm as StandardResolution];
  const lower = norm.toLowerCase();

  const match = lower.match(
    /^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?|w|wk|weeks?|mo|months?)?$/i,
  );
  if (!match || !match[1]) return 60_000;
  const num = Number(match[1]);
  const rawUnit = (match[2] ?? "m").toLowerCase();
  if (rawUnit.startsWith("s")) return num * 1_000;
  if (rawUnit.startsWith("h")) return num * 3_600_000;
  if (rawUnit.startsWith("d")) return num * 86_400_000;
  if (rawUnit.startsWith("w")) return num * 604_800_000;
  if (rawUnit.startsWith("mo")) return num * 2_592_000_000;
  return num * 60_000;
}

export interface MarketConnection {
  id: string;
  name: string;
  configured: boolean;
  source: "environment" | "saved" | "public" | "uploaded" | null;
}

export interface MarketHistory {
  quoteCurrency?: string;
  datasetId?: string;
  provider: string;
  symbol: string;
  resolution: Resolution;
  bars: MarketBar[];
  fetchedAt: string;
  truncated: boolean;
  warnings: string[];
}

export interface ExcursionEstimate {
  priceBasisMismatch?: boolean;
  mae: number | null;
  mfe: number | null;
  sampledBars: number;
  excludedBars: number;
  warnings: string[];
}

export interface TradeMarketResult extends MarketHistory {
  estimate: ExcursionEstimate;
}

/**
 * Snaps an exact execution timestamp (milliseconds) to the enclosing candle's open time
 * from a list of historical bars.
 *
 * In Vela and candlestick charting engines, markers with xloc: "bar_time" must align to
 * discrete bar open timestamps. Without snapping, fractional positions across multi-hour
 * or daily bars cause markers to float to the right (e.g. 12:45 inside a 10:00-14:00 4H
 * candle renders 68.75% across, appearing on or near the subsequent bar).
 */
export function snapTimeToCandle(timeMs: number, bars?: Array<{ time: number }>): number {
  if (!bars || bars.length === 0 || !Number.isFinite(timeMs)) return timeMs;
  if (timeMs < bars[0]!.time) return timeMs;
  if (timeMs >= bars[bars.length - 1]!.time) return bars[bars.length - 1]!.time;

  let lo = 0;
  let hi = bars.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.time <= timeMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return bars[lo]!.time;
}

/**
 * Checks if a symbol represents futures or equities where RTH/ETH sessions apply.
 * Crypto (BTCUSDT, ETHUSDT, etc.) trades 24x7 and does not have RTH/ETH sessions.
 */
export function isFuturesOrEquitySymbol(sym: string): boolean {
  if (!sym) return false;
  const upper = sym.toUpperCase().trim();
  if (
    upper.includes("USDT") ||
    upper.includes("USDC") ||
    upper.includes("BUSD") ||
    upper.startsWith("BTC") ||
    upper.startsWith("ETH") ||
    upper.startsWith("SOL") ||
    upper.startsWith("DOGE") ||
    upper.startsWith("XRP") ||
    upper.endsWith("PERP")
  ) {
    return false;
  }
  const root = upper.replace(/[0-9!]/g, "");
  const futures = [
    "MES", "ES", "NQ", "MNQ", "YM", "MYM", "RTY", "M2K",
    "CL", "MCL", "GC", "MGC", "SI", "HG", "ZB", "ZN", "ZF", "ZT",
    "6E", "6B", "6A", "6J", "FDAX", "FESX"
  ];
  return (
    futures.includes(root) ||
    futures.includes(upper) ||
    upper.startsWith("US") ||
    upper.endsWith(".CASH") ||
    !upper.includes("USDT")
  );
}

const nySessionFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/**
 * Filters candles by trading session:
 * - "regular" (RTH): 09:30 - 16:00 America/New_York (Mon-Fri)
 * - "extended" (ETH): all sessions (pre-market, regular, post-market, overnight)
 */
export function filterCandlesBySession(
  candles: MarketBar[],
  session: "regular" | "extended",
  symbol: string
): MarketBar[] {
  if (session === "extended" || !isFuturesOrEquitySymbol(symbol)) {
    return candles;
  }
  return candles.filter((bar) => {
    const ms = bar.time > 1e11 ? bar.time : bar.time * 1000;
    const date = new Date(ms);
    const parts = nySessionFormatter.formatToParts(date);

    const weekday = parts.find((p) => p.type === "weekday")?.value;
    if (weekday === "Sat" || weekday === "Sun") return false;

    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const minuteOfDay = hour * 60 + minute;

    // Regular US session: 09:30 (570m) to 16:00 (960m)
    return minuteOfDay >= 570 && minuteOfDay < 960;
  });
}
