import { headerKey, parseCsv } from "@luxalgo/journal-importers";
import {
  RESOLUTIONS,
  isResolution,
  parseResolutionMs,
  normalizeResolution,
  type Resolution,
  type MarketBar,
} from "./market-data";
import {
  normalizeSymbol,
  getAssetFamily,
  getDefaultCompatibleSymbols,
  type AssetFamily,
} from "./assets/symbol-utils";
import { SYMBOL_SPECS } from "./assets/symbol-specs";

export const MAX_CSV_BYTES = 30 * 1024 * 1024;
export const MAX_CSV_BARS = 100_000;

/**
 * Resilient candle timestamp parser.
 * Supports:
 * - 10-digit Unix seconds (e.g. "1789376700")
 * - 13-digit Unix milliseconds (e.g. "1789376700000")
 * - ISO-8601 with T and timezone (e.g. "2026-09-14T09:05:00Z")
 * - TradingView export format with space (e.g. "2026-09-14 09:05:00" assuming UTC)
 */
export function parseCandleTimestamp(raw: string): number {
  if (!raw) return NaN;
  const trimmed = raw.trim();
  if (/^\d{10}$/.test(trimmed)) return Number(trimmed) * 1000;
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);

  // Normalize separators in date part: convert YYYY.MM.DD or YYYY/MM/DD to YYYY-MM-DD
  const normalized = trimmed.replace(/^(\d{4})[./](\d{2})[./](\d{2})/, "$1-$2-$3");

  // Check date-only (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    if (!month || month > 12 || !day || day > new Date(Date.UTC(year!, month!, 0)).getUTCDate()) {
      return NaN;
    }
    return Date.UTC(year!, month! - 1, day!);
  }

  const isoLike = normalized.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/i.test(isoLike)) {
    const [year, month, day] = isoLike.slice(0, 10).split("-").map(Number);
    if (!month || month > 12 || !day || day > new Date(Date.UTC(year!, month!, 0)).getUTCDate()) {
      return NaN;
    }
    const withTz =
      isoLike.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
    return Date.parse(withTz);
  }
  return NaN;
}

export interface DetectedCsvMetadata {
  symbol?: string;
  resolution?: Resolution;
  currency?: string;
  priceBasis?: string;
  family?: AssetFamily | null;
  compatibleSymbols?: string[];
}

/**
 * Universal filename timeframe extractor.
 * Matches standard aliases (daily, weekly, monthly) and generic patterns:
 * e.g. MES1_30m_websocket, US500_5m, NQ_1h, AAPL_15min, BTC_2h, etc.
 */
export function extractResolutionFromFilename(cleanName: string): Resolution | undefined {
  if (/(?:^|[_ .-])daily(?:[_ .-]|$)/i.test(cleanName)) return "1d";
  if (/(?:^|[_ .-])weekly(?:[_ .-]|$)/i.test(cleanName)) return "1w";
  if (/(?:^|[_ .-])monthly(?:[_ .-]|$)/i.test(cleanName)) return "1mo";
  if (/(?:^|[_ .-])1?D(?:[_ .-]|$)/.test(cleanName)) return "1d";
  if (/(?:^|[_ .-])3D(?:[_ .-]|$)/.test(cleanName)) return "3d";
  if (/(?:^|[_ .-])1?W(?:[_ .-]|$)/.test(cleanName)) return "1w";
  if (/(?:^|[_ .-])1?M(?:[_ .-]|$)/.test(cleanName)) return "1mo";

  const regex =
    /(?:^|[_ .-])(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|wk|week|weeks|mo|month|months)(?=[_ .-]|$)/gi;
  const matches = Array.from(cleanName.matchAll(regex));

  for (const match of matches) {
    if (!match[1] || !match[2]) continue;
    const num = Number(match[1]);
    const rawUnit = match[2].toLowerCase();

    let unit = "m";
    if (rawUnit.startsWith("h")) unit = "h";
    else if (rawUnit.startsWith("d")) unit = "d";
    else if (rawUnit.startsWith("w")) unit = "w";
    else if (rawUnit.startsWith("mo")) unit = "mo";
    else if (rawUnit.startsWith("m")) unit = "m";

    const candidate = `${num}${unit}`;
    const normalized = normalizeResolution(candidate);
    return isResolution(normalized) ? normalized : undefined;
  }

  return undefined;
}

/**
 * Universal empirical timestamp delta inference.
 * Uses mode/frequency matching across standard candidate buckets with tolerances,
 * safely filtering non-positive differences and long holiday/weekend gaps.
 */
export function inferResolutionFromDeltas(deltas: number[]): Resolution | undefined {
  if (!deltas || !deltas.length) return undefined;

  const positive = deltas.filter((d) => typeof d === "number" && Number.isFinite(d) && d > 0);
  if (!positive.length) return undefined;

  // Filter out extreme gaps (> 35 days) when smaller intervals exist, preserving monthly deltas
  const withinMonth = positive.filter((d) => d <= 35 * 86400);
  const validDeltas = withinMonth.length > 0 ? withinMonth : positive;

  const CANDIDATES: Array<{ res: Resolution; sec: number; tol: number }> = [
    { res: "1m", sec: 60, tol: 2 },
    { res: "2m", sec: 120, tol: 3 },
    { res: "3m", sec: 180, tol: 4 },
    { res: "5m", sec: 300, tol: 6 },
    { res: "10m", sec: 600, tol: 10 },
    { res: "15m", sec: 900, tol: 15 },
    { res: "30m", sec: 1800, tol: 30 },
    { res: "45m", sec: 2700, tol: 45 },
    { res: "1h", sec: 3600, tol: 60 },
    { res: "2h", sec: 7200, tol: 120 },
    { res: "3h", sec: 10800, tol: 180 },
    { res: "4h", sec: 14400, tol: 240 },
    { res: "6h", sec: 21600, tol: 360 },
    { res: "8h", sec: 28800, tol: 480 },
    { res: "12h", sec: 43200, tol: 720 },
    { res: "1d", sec: 86400, tol: 14400 },
    { res: "3d", sec: 259200, tol: 43200 },
    { res: "1w", sec: 604800, tol: 86400 },
    { res: "1mo", sec: 2592000, tol: 432000 },
  ];

  let bestCandidate: Resolution | undefined;
  let maxMatches = 0;

  for (const cand of CANDIDATES) {
    const matches = validDeltas.filter((d) => Math.abs(d - cand.sec) <= cand.tol).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCandidate = cand.res;
    }
  }

  if (bestCandidate && maxMatches > 0) {
    return bestCandidate;
  }

  const minDiff = Math.min(...validDeltas);
  if (minDiff < 3600) {
    const minM = Math.round(minDiff / 60);
    const cand = `${minM}m`;
    if (isResolution(cand)) return cand;
  } else if (minDiff < 86400) {
    const minH = Math.round(minDiff / 3600);
    const cand = `${minH}h`;
    if (isResolution(cand)) return cand;
  } else if (minDiff <= 3 * 86400) {
    const minD = Math.round(minDiff / 86400);
    const cand = `${minD}d`;
    if (isResolution(cand)) return cand;
  } else if (minDiff <= 10 * 86400) {
    return "1w";
  } else if (minDiff <= 35 * 86400) {
    return "1mo";
  }

  return undefined;
}

/**
 * Hybrid CSV metadata detection engine.
 * Inspects both filename patterns and content deltas to extract:
 * 1. Normalized symbol (preserves exact ground truth: MES is MES, US500 is US500).
 * 2. Resolution (mathematically computed from timestamp delta t2 - t1 if available).
 * 3. Quote currency from symbol specifications.
 * 4. Default price basis ("raw").
 * 5. Asset family grouping.
 */
export function detectCsvMetadata(filename: string, content?: string): DetectedCsvMetadata {
  let symbol: string | undefined;
  let resolution: Resolution | undefined;

  // 1. Check content first for symbol column and timestamp delta
  if (content && content.trim().length > 0) {
    try {
      const [header, ...rows] = parseCsv(content);
      if (header && rows.length > 0) {
        // Look for symbol column
        const symbolIdx = header.findIndex((cell) =>
          ["symbol", "ticker"].includes(headerKey(cell)),
        );
        if (symbolIdx >= 0 && rows[0] && rows[0][symbolIdx]) {
          const rawSymbol = rows[0][symbolIdx]!.trim();
          if (rawSymbol) symbol = normalizeSymbol(rawSymbol);
        }

        // Calculate resolution delta from consecutive rows (sampling up to 30 rows to bypass weekend/session gaps)
        if (rows.length >= 2) {
          const timeIdx = header.findIndex((cell) =>
            ["time", "timestamp", "datetime", "datetimeutc", "date"].includes(headerKey(cell)),
          );
          if (timeIdx >= 0) {
            const deltas: number[] = [];
            const sampleLimit = Math.min(rows.length - 1, 30);
            for (let i = 0; i < sampleLimit; i++) {
              const t1 = parseCandleTimestamp(rows[i]![timeIdx] ?? "");
              const t2 = parseCandleTimestamp(rows[i + 1]![timeIdx] ?? "");
              if (Number.isFinite(t1) && Number.isFinite(t2)) {
                const diff = Math.abs(t2 - t1) / 1000;
                if (diff > 0) deltas.push(diff);
              }
            }
            if (deltas.length > 0) {
              resolution = inferResolutionFromDeltas(deltas);
            }
          }
        }
      }
    } catch {
      // Graceful fallback to filename
    }
  }

  // 2. Filename-based extraction for symbol and resolution
  const cleanName = filename.replace(/\.[a-z0-9]+$/i, "");

  if (!symbol) {
    // Matches prefix like MES1_5m, US500_5m, NQ1!_1m, ESU24_15m
    const match = cleanName.match(/^([A-Za-z0-9!.]+?)(?:[_ -]|$)/);
    if (match?.[1]) {
      const detected = normalizeSymbol(match[1]);
      if (detected) symbol = detected;
    }
  }

  if (!resolution) {
    resolution = extractResolutionFromFilename(cleanName);
  }

  // 3. Resolve currency & family
  const currency = symbol
    ? (SYMBOL_SPECS[symbol]?.currency ?? getAssetFamily(symbol)?.currency ?? "USD")
    : "USD";

  const family = symbol ? getAssetFamily(symbol) : null;
  const compatibleSymbols = symbol ? getDefaultCompatibleSymbols(symbol) : [];

  return {
    symbol,
    resolution,
    currency,
    priceBasis: "raw",
    family,
    compatibleSymbols,
  };
}

export function parseMarketCsv(
  content: string,
  symbol: string,
  resolution: Resolution,
): MarketBar[] {
  if (new TextEncoder().encode(content).byteLength > MAX_CSV_BYTES)
    throw new Error("Use a CSV smaller than 30 MB.");
  if ((content.match(/"/g)?.length ?? 0) % 2 !== 0)
    throw new Error("CSV contains an unterminated quoted field.");
  const [header, ...rows] = parseCsv(content);
  if (!header || !rows.length || rows.length > MAX_CSV_BARS)
    throw new Error("CSV must contain 1–100,000 candle rows.");
  const aliases: Record<string, string[]> = {
    time: ["time", "timestamp", "datetime", "date"],
    open: ["open", "o"],
    high: ["high", "h"],
    low: ["low", "l"],
    close: ["close", "c"],
    volume: ["volume", "v"],
    symbol: ["symbol", "ticker"],
  };
  const columns: Record<string, number> = {};
  for (const [name, keys] of Object.entries(aliases)) {
    const matches = header
      .map((cell, index) => (keys.includes(headerKey(cell)) ? index : -1))
      .filter((index) => index >= 0);
    if (matches.length > 1) throw new Error(`Ambiguous ${name} columns. Include only one.`);
    if (!matches.length && !["symbol", "volume"].includes(name))
      throw new Error(`Missing ${name} column.`);
    columns[name] = matches[0] ?? -1;
  }
  const bars = rows
    .map((row, index): MarketBar => {
      const fail = (message: string): never => {
        throw new Error(`Row ${index + 2}: ${message}`);
      };
      if (row.length !== header.length) fail("column count does not match the header.");
      if (columns.symbol! >= 0 && row[columns.symbol!]!.trim() !== symbol)
        fail("symbol does not match this dataset.");
      const rawTime = row[columns.time!]!.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(rawTime)) {
        const [year, month, day] = rawTime.slice(0, 10).split("-").map(Number);
        if (!month || month > 12 || !day || day > new Date(Date.UTC(year!, month!, 0)).getUTCDate())
          fail("invalid calendar date.");
      }
      const time = /^\d{10}$/.test(rawTime)
        ? Number(rawTime) * 1000
        : /^\d{13}$/.test(rawTime)
          ? Number(rawTime)
          : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i.test(
                rawTime,
              )
            ? Date.parse(rawTime)
            : /^\d{4}-\d{2}-\d{2}$/.test(rawTime)
              ? Date.parse(`${rawTime}T00:00:00Z`)
              : NaN;
      if (!Number.isSafeInteger(time) || time < 0)
        fail(
          "use ISO-8601 with a timezone, or Unix seconds (10 digits) / milliseconds (13 digits).",
        );
      const numeric = (name: string) => {
        if (name === "volume" && columns.volume === -1) return 0;
        const value = row[columns[name]!]!.trim();
        if (
          !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
          !Number.isFinite(Number(value))
        )
          fail(`invalid ${name}.`);
        return Number(value);
      };
      const bar = {
        time,
        open: numeric("open"),
        high: numeric("high"),
        low: numeric("low"),
        close: numeric("close"),
        volume: numeric("volume"),
      };
      if (
        bar.low > Math.min(bar.open, bar.close) ||
        bar.high < Math.max(bar.open, bar.close) ||
        bar.low > bar.high ||
        bar.volume < 0
      )
        fail("invalid OHLC range or negative volume.");
      if (bar.time > Date.now() + 300_000)
        fail("only historical candles can be imported (future timestamp detected).");
      return bar;
    })
    .sort((a, b) => a.time - b.time);

  const normRes = normalizeResolution(resolution);
  const step = parseResolutionMs(normRes);
  const isHighTf = ["2h", "3h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1mo"].includes(normRes);

  if (!isHighTf) {
    const phase = bars[0]!.time % step;
    bars.forEach((bar, index) => {
      if (bar.time % step !== phase)
        throw new Error("Candle timestamps do not align to the selected resolution.");
      if (index && bar.time === bars[index - 1]!.time)
        throw new Error("Duplicate candle timestamps. Remove duplicates before importing.");
    });
  } else {
    // High-timeframe resolutions (2h, 3h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1mo):
    // Real-world markets have session opening hours (e.g. CME at 18:00 ET = 22:00/23:00 UTC),
    // DST shifts, exchange holidays, and irregular calendar months (28-31 days).
    const minDeltas: Record<string, number> = {
      "2h": 1_800_000, // at least 30m between consecutive 2h bars
      "3h": 2_700_000,
      "4h": 3_600_000, // at least 1h between consecutive bars
      "6h": 7_200_000,
      "8h": 10_800_000,
      "12h": 14_400_000,
      "1d": 43_200_000, // at least 12h between daily bars (rejects intraday data)
      "3d": 129_600_000,
      "1w": 302_400_000, // at least 3.5 days between weekly bars
      "1mo": 1_296_000_000, // at least 15 days between monthly bars
    };
    const minAllowedDelta = minDeltas[normRes] ?? 1_800_000;

    bars.forEach((bar, index) => {
      // Must be aligned to clean minutes (no sub-minute jitter)
      if (bar.time % 60_000 !== 0) {
        throw new Error("Candle timestamps do not align to the selected resolution.");
      }
      if (index > 0) {
        const prevTime = bars[index - 1]!.time;
        if (bar.time === prevTime) {
          throw new Error("Duplicate candle timestamps. Remove duplicates before importing.");
        }
        const delta = bar.time - prevTime;
        if (delta < minAllowedDelta) {
          throw new Error(
            `Candle timestamps do not align to the selected resolution (${resolution}). Interval between candles is too small.`,
          );
        }
      }
    });
  }
  return bars;
}
export interface MarketCsvDataset {
  id: string;
  name: string;
  symbol: string;
  resolution: Resolution;
  currency: string;
  priceBasis: string;
  count: number;
  from: string;
  to: string;
  importedAt: string;
  compatibleSymbols?: string[];
}

export interface MarketSeriesSummary {
  symbol: string;
  resolution: Resolution;
  barCount: number;
  firstTime: number;
  lastTime: number;
  from?: string;
  to?: string;
  currency: string;
  priceBasis: string;
  updatedAt?: string;
  compatibleSymbols?: string[];
}

export interface MarketCandleBatch {
  id: string;
  symbol: string;
  resolution: Resolution;
  name: string;
  barCount: number;
  newBarCount: number;
  duplicateBarCount: number;
  firstTime: number;
  lastTime: number;
  importedAt: string;
}

export interface MarketCsvImportResponse {
  id?: string;
  batchId?: string;
  symbol?: string;
  resolution?: Resolution;
  newBarCount?: number;
  duplicateBarCount?: number;
  totalInDb?: number;
  result?: {
    batchId: string;
    symbol: string;
    resolution: Resolution;
    newBarCount: number;
    duplicateBarCount: number;
    totalInDb: number;
  };
  datasets?: MarketCsvDataset[];
  series?: MarketSeriesSummary[];
  batches?: MarketCandleBatch[];
}

export function formatDatasetDisplayName(dataset: {
  name?: string;
  symbol?: string;
  resolution?: string;
  count?: number;
  barCount?: number;
}): string {
  const count = dataset.count ?? dataset.barCount;
  const countStr = count && count > 0 ? ` (${count.toLocaleString()} bars)` : "";
  if (
    dataset.name &&
    !/\.(csv|txt|tsv|dat)$/i.test(dataset.name) &&
    !/_websocket/i.test(dataset.name) &&
    !/^MES\d+_/i.test(dataset.name)
  ) {
    return dataset.name;
  }
  const sym = dataset.symbol ? dataset.symbol.toUpperCase() : "SERIES";
  const res = dataset.resolution ? ` · ${dataset.resolution}` : "";
  return `${sym}${res}${countStr}`;
}
