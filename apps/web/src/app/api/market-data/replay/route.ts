import { bad, handler, ok } from "@/server/api";
import { db } from "@/db";
import {
  isResolution,
  RESOLUTIONS,
  parseResolutionMs,
  type MarketBar,
  type Resolution,
} from "@/lib/market-data";
import { normalizeSymbol, getAssetFamily, getAssetClass } from "@/lib/assets/symbol-utils";
import { SYMBOL_SPECS } from "@/lib/assets/symbol-specs";

export interface ReplaySymbolCatalogItem {
  symbol: string;
  currency: string;
  priceBasis: string;
  totalBars: number;
  firstTime: number;
  lastTime: number;
  resolutions: Resolution[];
  assetName: string;
  category: string;
}

export interface ReplayMarketDataResponse {
  symbol: string;
  requestedSymbol: string;
  resolution: Resolution;
  currency: string;
  priceBasis: string;
  bars: MarketBar[];
  availableResolutions: Resolution[];
  firstTime?: number;
  lastTime?: number;
  totalBars?: number;
  symbols: ReplaySymbolCatalogItem[];
  defaultSymbol: string;
}

export function queryReplayCatalog(): ReplaySymbolCatalogItem[] {
  const sqlite = db.$client;
  let rows: Array<{
    symbol: string;
    currency: string;
    priceBasis: string;
    totalBars: number;
    firstTime: number;
    lastTime: number;
    resolutions: string | null;
  }> = [];

  try {
    rows = sqlite
      .prepare(
        `SELECT
          symbol,
          currency,
          price_basis as priceBasis,
          SUM(bar_count) as totalBars,
          MIN(first_time) as firstTime,
          MAX(last_time) as lastTime,
          GROUP_CONCAT(resolution, ',') as resolutions
        FROM market_series_summary
        WHERE bar_count > 0
        GROUP BY symbol
        ORDER BY totalBars DESC`,
      )
      .all() as any[];
  } catch (err) {
    console.warn("[replay-api] Failed to query market_series_summary:", err);
  }

  const existingSymbols = new Set<string>();

  // 1. First: Database-backed symbols that already have historical candle series
  const dbItems: ReplaySymbolCatalogItem[] = rows.map((row) => {
    existingSymbols.add(row.symbol.toUpperCase());
    const family = getAssetFamily(row.symbol);
    const category = getAssetClass(row.symbol);
    const rawResList = (row.resolutions ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(isResolution);

    // Sort resolutions from lowest ms to highest ms
    const sortedResolutions = Array.from(new Set(rawResList)).sort(
      (a, b) => (RESOLUTIONS[a] ?? parseResolutionMs(a)) - (RESOLUTIONS[b] ?? parseResolutionMs(b)),
    );

    return {
      symbol: row.symbol,
      currency: row.currency || "USD",
      priceBasis: row.priceBasis || "raw",
      totalBars: Number(row.totalBars) || 0,
      firstTime: Number(row.firstTime) || 0,
      lastTime: Number(row.lastTime) || 0,
      resolutions: sortedResolutions,
      assetName: family?.name || row.symbol,
      category,
    };
  });

  // 2. Second: Supported institutional instruments from master SYMBOL_SPECS catalog
  const specItems: ReplaySymbolCatalogItem[] = [];
  const defaultSupportedResolutions: Resolution[] = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1mo"];

  for (const [key, spec] of Object.entries(SYMBOL_SPECS)) {
    const sym = (spec.symbol || key).toUpperCase();
    if (existingSymbols.has(sym)) continue;
    existingSymbols.add(sym);

    specItems.push({
      symbol: spec.symbol || key,
      currency: spec.currency || "USD",
      priceBasis: "raw",
      totalBars: 0,
      firstTime: 0,
      lastTime: 0,
      resolutions: defaultSupportedResolutions,
      assetName: spec.name || spec.description || sym,
      category: spec.category || getAssetClass(sym),
    });
  }

  return [...dbItems, ...specItems];
}

export const GET = handler((request: Request) => {
  const url = new URL(request.url);
  const catalog = queryReplayCatalog();

  const defaultSymbol =
    catalog.find((c) => c.symbol === "MES")?.symbol ||
    catalog.find((c) => c.symbol === "US500")?.symbol ||
    catalog[0]?.symbol ||
    "MES";

  const reqSymbol = url.searchParams.get("symbol")?.trim();
  const reqResolution = url.searchParams.get("resolution")?.trim();
  const reqLimit = url.searchParams.get("limit");
  const reqTo = url.searchParams.get("to");
  const reqFrom = url.searchParams.get("from");

  // If no specific symbol requested, return catalog along with default symbol's data
  const targetSymbol = reqSymbol || defaultSymbol;

  const catalogEntry =
    catalog.find((c) => c.symbol.toUpperCase() === targetSymbol.toUpperCase()) ||
    catalog.find((c) => normalizeSymbol(c.symbol) === normalizeSymbol(targetSymbol)) ||
    catalog[0];

  const effectiveSymbol = catalogEntry?.symbol || targetSymbol;
  const availableResolutions = catalogEntry?.resolutions || (["1m", "5m", "15m", "1h", "1d"] as Resolution[]);

  let effectiveResolution: Resolution = "1m";
  if (reqResolution && isResolution(reqResolution) && availableResolutions.includes(reqResolution)) {
    effectiveResolution = reqResolution;
  } else if (availableResolutions.length > 0) {
    effectiveResolution = availableResolutions[0]!;
  }

  const limit = Math.max(10, Math.min(10000, Number(reqLimit) || 2500));
  const toMs = reqTo ? Number(reqTo) : NaN;
  const fromMs = reqFrom ? Number(reqFrom) : NaN;

  const sqlite = db.$client;
  let rows: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    currency: string;
    priceBasis: string;
  }> = [];

  const conditions: string[] = ["symbol = ?", "resolution = ?"];
  const params: any[] = [effectiveSymbol, effectiveResolution];

  if (Number.isFinite(toMs)) {
    conditions.push("time <= ?");
    params.push(toMs);
  }
  if (Number.isFinite(fromMs)) {
    conditions.push("time >= ?");
    params.push(fromMs);
  }

  params.push(limit);

  const querySql = `
    SELECT time, open, high, low, close, volume, currency, price_basis as priceBasis
    FROM (
      SELECT time, open, high, low, close, volume, currency, price_basis
      FROM market_candles
      WHERE ${conditions.join(" AND ")}
      ORDER BY time DESC
      LIMIT ?
    )
    ORDER BY time ASC
  `;

  rows = sqlite.prepare(querySql).all(...params) as typeof rows;

  const bars: MarketBar[] = rows.map((r) => ({
    time: r.time,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume ?? 0,
  }));

  const currency = rows[0]?.currency || catalogEntry?.currency || "USD";
  const priceBasis = rows[0]?.priceBasis || catalogEntry?.priceBasis || "raw";

  return ok({
    symbol: effectiveSymbol,
    requestedSymbol: targetSymbol,
    resolution: effectiveResolution,
    currency,
    priceBasis,
    bars,
    availableResolutions,
    firstTime: catalogEntry?.firstTime,
    lastTime: catalogEntry?.lastTime,
    totalBars: catalogEntry?.totalBars,
    symbols: catalog,
    defaultSymbol,
  } satisfies ReplayMarketDataResponse);
});
