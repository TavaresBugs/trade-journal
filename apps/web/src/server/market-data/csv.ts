import { randomUUID } from "node:crypto";
import { db, marketCsvDatasets, trades } from "@/db";
import {
  RESOLUTIONS,
  parseResolutionMs,
  normalizeResolution,
  type MarketBar,
  type Resolution,
} from "@/lib/market-data";
import { parseMarketCsv, formatDatasetDisplayName, type MarketCsvDataset } from "@/lib/market-csv";
import {
  normalizeSymbol,
  getAssetFamily,
  getAssetClass,
  getDefaultCompatibleSymbols,
} from "@/lib/assets/symbol-utils";
import { getSetting, setSetting } from "@/server/settings";
import { MarketDataError, type MarketDataProvider } from "./provider";
import { result } from "./http";

export function getCustomSymbolLinks(symbol: string): string[] | null {
  const norm = (normalizeSymbol(symbol) || symbol.trim()).toUpperCase();
  const val = getSetting(`market_symbol_links:${norm}`);
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCustomSymbolLinks(symbol: string, allowedSymbols: string[]): void {
  const norm = (normalizeSymbol(symbol) || symbol.trim()).toUpperCase();
  const cleanList = Array.from(
    new Set(allowedSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  );
  setSetting(`market_symbol_links:${norm}`, JSON.stringify(cleanList));

  // Synchronize market_csv_datasets rows for this symbol so backward compat works
  const sqlite = db.$client;
  sqlite
    .prepare("UPDATE market_csv_datasets SET compatible_symbols_json = ? WHERE symbol = ?")
    .run(JSON.stringify(cleanList), norm);
}

export function getActiveCompatibleSymbols(symbol: string): string[] {
  const custom = getCustomSymbolLinks(symbol);
  if (custom !== null) return custom;
  return getDefaultCompatibleSymbols(symbol);
}

export function csvDatasets(): MarketCsvDataset[] {
  return db
    .select({
      id: marketCsvDatasets.id,
      name: marketCsvDatasets.name,
      symbol: marketCsvDatasets.symbol,
      resolution: marketCsvDatasets.resolution,
      currency: marketCsvDatasets.currency,
      priceBasis: marketCsvDatasets.priceBasis,
      importedAt: marketCsvDatasets.importedAt,
      count: marketCsvDatasets.barCount,
      firstTime: marketCsvDatasets.firstTime,
      lastTime: marketCsvDatasets.lastTime,
      compatibleSymbolsJson: marketCsvDatasets.compatibleSymbolsJson,
    })
    .from(marketCsvDatasets)
    .all()
    .map(({ firstTime, lastTime, compatibleSymbolsJson, ...row }) => {
      let compatibleSymbols: string[] | undefined;
      if (compatibleSymbolsJson) {
        try {
          compatibleSymbols = JSON.parse(compatibleSymbolsJson) as string[];
        } catch {}
      }
      return {
        ...row,
        name: formatDatasetDisplayName(row),
        resolution: row.resolution as Resolution,
        from: new Date(firstTime).toISOString(),
        to: new Date(lastTime + parseResolutionMs(row.resolution)).toISOString(),
        compatibleSymbols,
      };
    });
}

/**
 * Returns distinct symbols actually traded in the journal, preserving raw tickers
 * and adding their normalized forms for quick selection.
 */
export function distinctTradedSymbols(): string[] {
  const rows = db.selectDistinct({ symbol: trades.symbol }).from(trades).all();
  const set = new Set<string>();
  for (const row of rows) {
    if (row.symbol && row.symbol.trim()) {
      set.add(row.symbol.trim());
      const norm = normalizeSymbol(row.symbol);
      if (norm) set.add(norm);
    }
  }
  return [...set].sort();
}
export interface IngestCandlesInput {
  name: string;
  symbol: string;
  resolution: Resolution;
  currency: string;
  priceBasis: string;
  content: string;
  compatibleSymbols?: string[];
}

export interface IngestCandlesResult {
  batchId: string;
  symbol: string;
  resolution: Resolution;
  newBarCount: number;
  duplicateBarCount: number;
  totalInDb: number;
}

export interface CandleBatchItem {
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

export interface CandleSeriesSummaryItem {
  symbol: string;
  resolution: Resolution;
  barCount: number;
  firstTime: number;
  lastTime: number;
  currency: string;
  priceBasis: string;
  updatedAt: string;
  from: string;
  to: string;
  batches: CandleBatchItem[];
  compatibleSymbols?: string[];
}

export function ingestCandles(input: IngestCandlesInput): IngestCandlesResult {
  const normResolution = (normalizeResolution(input.resolution) ||
    input.resolution.toLowerCase()) as Resolution;
  const bars = parseMarketCsv(input.content, input.symbol, normResolution);
  if (bars.length === 0) {
    throw new MarketDataError("No candles found in CSV file.");
  }
  const sqlite = db.$client;
  const batchId = randomUUID();

  return sqlite.transaction(() => {
    const insertCandle = sqlite.prepare(`
      INSERT INTO market_candles (symbol, resolution, time, open, high, low, close, volume, currency, price_basis, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, resolution, time) DO NOTHING
    `);

    let newBarCount = 0;
    for (const bar of bars) {
      const res = insertCandle.run(
        input.symbol,
        normResolution,
        bar.time,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume ?? null,
        input.currency || "USD",
        input.priceBasis || "raw",
        batchId,
      );
      if (res.changes > 0) {
        newBarCount++;
      }
    }

    const duplicateBarCount = bars.length - newBarCount;
    const firstTime = bars[0]!.time;
    const lastTime = bars.at(-1)!.time;
    const importedAt = new Date().toISOString();

    sqlite
      .prepare(
        `
      INSERT INTO market_candle_batches (id, symbol, resolution, name, bar_count, new_bar_count, duplicate_bar_count, first_time, last_time, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        batchId,
        input.symbol,
        normResolution,
        input.name,
        bars.length,
        newBarCount,
        duplicateBarCount,
        firstTime,
        lastTime,
        importedAt,
      );

    const stats = sqlite
      .prepare(
        `
      SELECT COUNT(*) as barCount, MIN(time) as firstTime, MAX(time) as lastTime
      FROM market_candles
      WHERE symbol = ? AND resolution = ?
    `,
      )
      .get(input.symbol, normResolution) as {
      barCount: number;
      firstTime: number;
      lastTime: number;
    };

    if (stats && stats.barCount > 0) {
      sqlite
        .prepare(
          `
        INSERT INTO market_series_summary (symbol, resolution, bar_count, first_time, last_time, currency, price_basis, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol, resolution) DO UPDATE SET
          bar_count = excluded.bar_count,
          first_time = excluded.first_time,
          last_time = excluded.last_time,
          currency = excluded.currency,
          price_basis = excluded.price_basis,
          updated_at = excluded.updated_at
      `,
        )
        .run(
          input.symbol,
          normResolution,
          stats.barCount,
          stats.firstTime,
          stats.lastTime,
          input.currency || "USD",
          input.priceBasis || "raw",
          importedAt,
        );
    }

    // Keep marketCsvDatasets metadata synced for legacy tests / compatibility
    sqlite
      .prepare(
        `
      INSERT INTO market_csv_datasets (id, name, symbol, resolution, currency, price_basis, bars_json, imported_at, bar_count, first_time, last_time, compatible_symbols_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        batchId,
        formatDatasetDisplayName({
          name: input.name,
          symbol: input.symbol,
          resolution: normResolution,
        }),
        input.symbol,
        normResolution,
        input.currency || "USD",
        input.priceBasis || "raw",
        "[]",
        importedAt,
        bars.length,
        firstTime,
        lastTime,
        input.compatibleSymbols && input.compatibleSymbols.length > 0
          ? JSON.stringify(input.compatibleSymbols)
          : null,
      );

    if (input.compatibleSymbols && input.compatibleSymbols.length > 0) {
      setCustomSymbolLinks(input.symbol, input.compatibleSymbols);
    }

    return {
      batchId,
      symbol: input.symbol,
      resolution: normResolution,
      newBarCount,
      duplicateBarCount,
      totalInDb: stats?.barCount ?? newBarCount,
    };
  })();
}

export function revertCandleBatch(batchId: string) {
  const sqlite = db.$client;
  return sqlite.transaction(() => {
    const batch = sqlite
      .prepare("SELECT symbol, resolution FROM market_candle_batches WHERE id = ?")
      .get(batchId) as { symbol: string; resolution: string } | undefined;

    const legacy = !batch
      ? (sqlite
          .prepare("SELECT symbol, resolution FROM market_csv_datasets WHERE id = ?")
          .get(batchId) as { symbol: string; resolution: string } | undefined)
      : undefined;

    const targetSymbol = batch?.symbol ?? legacy?.symbol;
    const targetResolution = (batch?.resolution ?? legacy?.resolution) as Resolution | undefined;

    if (targetSymbol && targetResolution) {
      const remaining = sqlite
        .prepare(
          "SELECT id, first_time, last_time FROM market_candle_batches WHERE symbol = ? AND resolution = ? AND id != ?",
        )
        .all(targetSymbol, targetResolution, batchId) as Array<{
        id: string;
        first_time: number;
        last_time: number;
      }>;

      if (remaining.length > 0) {
        for (const rem of remaining) {
          sqlite
            .prepare(
              "UPDATE market_candles SET batch_id = ? WHERE batch_id = ? AND time >= ? AND time <= ?",
            )
            .run(rem.id, batchId, rem.first_time, rem.last_time);
        }
      }
    }

    sqlite.prepare("DELETE FROM market_candles WHERE batch_id = ?").run(batchId);
    sqlite.prepare("DELETE FROM market_candle_batches WHERE id = ?").run(batchId);

    sqlite
      .prepare("DELETE FROM trade_excursions WHERE json_extract(estimate_json, '$.datasetId') = ?")
      .run(batchId);
    sqlite.prepare("DELETE FROM market_csv_datasets WHERE id = ?").run(batchId);

    let remainingInDb = 0;
    if (targetSymbol && targetResolution) {
      const stats = sqlite
        .prepare(
          "SELECT COUNT(*) as barCount, MIN(time) as firstTime, MAX(time) as lastTime FROM market_candles WHERE symbol = ? AND resolution = ?",
        )
        .get(targetSymbol, targetResolution) as {
        barCount: number;
        firstTime: number;
        lastTime: number;
      };

      remainingInDb = stats?.barCount ?? 0;
      if (stats && stats.barCount > 0) {
        sqlite
          .prepare(
            `UPDATE market_series_summary
             SET bar_count = ?, first_time = ?, last_time = ?, updated_at = ?
             WHERE symbol = ? AND resolution = ?`,
          )
          .run(
            stats.barCount,
            stats.firstTime,
            stats.lastTime,
            new Date().toISOString(),
            targetSymbol,
            targetResolution,
          );
      } else {
        sqlite
          .prepare("DELETE FROM market_series_summary WHERE symbol = ? AND resolution = ?")
          .run(targetSymbol, targetResolution);
      }
    }

    return {
      batchId,
      symbol: targetSymbol,
      resolution: targetResolution,
      remainingInDb,
    };
  })();
}

export function purgeCandlesBySymbol(symbol: string, resolution?: string): void {
  const sqlite = db.$client;
  sqlite.transaction(() => {
    if (resolution) {
      sqlite
        .prepare("DELETE FROM market_candles WHERE symbol = ? AND resolution = ?")
        .run(symbol, resolution);
      sqlite
        .prepare("DELETE FROM market_series_summary WHERE symbol = ? AND resolution = ?")
        .run(symbol, resolution);
      sqlite
        .prepare("DELETE FROM market_candle_batches WHERE symbol = ? AND resolution = ?")
        .run(symbol, resolution);
      sqlite
        .prepare("DELETE FROM market_csv_datasets WHERE symbol = ? AND resolution = ?")
        .run(symbol, resolution);
    } else {
      sqlite.prepare("DELETE FROM market_candles WHERE symbol = ?").run(symbol);
      sqlite.prepare("DELETE FROM market_series_summary WHERE symbol = ?").run(symbol);
      sqlite.prepare("DELETE FROM market_candle_batches WHERE symbol = ?").run(symbol);
      sqlite.prepare("DELETE FROM market_csv_datasets WHERE symbol = ?").run(symbol);
    }
  })();
}

export function candleSeriesSummary(): CandleSeriesSummaryItem[] {
  const sqlite = db.$client;
  const summaries = sqlite
    .prepare(
      `SELECT symbol, resolution, bar_count as barCount, first_time as firstTime,
              last_time as lastTime, currency, price_basis as priceBasis, updated_at as updatedAt
       FROM market_series_summary
       ORDER BY symbol ASC, resolution ASC`,
    )
    .all() as Array<{
    symbol: string;
    resolution: string;
    barCount: number;
    firstTime: number;
    lastTime: number;
    currency: string;
    priceBasis: string;
    updatedAt: string;
  }>;

  const allBatches = sqlite
    .prepare(
      `SELECT id, symbol, resolution, name, bar_count as barCount,
              new_bar_count as newBarCount, duplicate_bar_count as duplicateBarCount,
              first_time as firstTime, last_time as lastTime, imported_at as importedAt
       FROM market_candle_batches
       ORDER BY imported_at DESC`,
    )
    .all() as Array<{
    id: string;
    symbol: string;
    resolution: string;
    name: string;
    barCount: number;
    newBarCount: number;
    duplicateBarCount: number;
    firstTime: number;
    lastTime: number;
    importedAt: string;
  }>;

  return summaries.map((s) => {
    const res = s.resolution as Resolution;
    const dur = parseResolutionMs(s.resolution);
    return {
      ...s,
      resolution: res,
      from: new Date(s.firstTime).toISOString(),
      to: new Date(s.lastTime + dur).toISOString(),
      batches: allBatches
        .filter((b) => b.symbol === s.symbol && b.resolution === s.resolution)
        .map((b) => ({ ...b, resolution: b.resolution as Resolution })),
      compatibleSymbols: getActiveCompatibleSymbols(s.symbol),
    };
  });
}

export function candleBatches(limit = 50): CandleBatchItem[] {
  const sqlite = db.$client;
  const batches = sqlite
    .prepare(
      `SELECT id, symbol, resolution, name, bar_count as barCount,
              new_bar_count as newBarCount, duplicate_bar_count as duplicateBarCount,
              first_time as firstTime, last_time as lastTime, imported_at as importedAt
       FROM market_candle_batches
       ORDER BY imported_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    symbol: string;
    resolution: string;
    name: string;
    barCount: number;
    newBarCount: number;
    duplicateBarCount: number;
    firstTime: number;
    lastTime: number;
    importedAt: string;
  }>;

  return batches.map((b) => ({
    ...b,
    resolution: b.resolution as Resolution,
  }));
}

export function importCsvDataset(input: {
  name: string;
  symbol: string;
  resolution: Resolution;
  currency: string;
  priceBasis: string;
  content: string;
  compatibleSymbols?: string[];
}) {
  const res = ingestCandles(input);
  return res.batchId;
}

export function removeCsvDataset(id: string) {
  revertCandleBatch(id);
}

export const marketCsv: MarketDataProvider = {
  id: "market-csv",
  name: "Market data CSV",
  environmentKey: "",
  async test() {
    if (!csvDatasets().length && !candleSeriesSummary().length)
      throw new MarketDataError("Upload market candles in Settings first.");
  },
  async history(request, _apiKey = "") {
    const sqlite = db.$client;
    let targetSymbol: string | undefined;
    let targetResolution: Resolution = request.resolution;
    let datasetName: string | undefined;
    let datasetCurrency = "USD";
    let datasetPriceBasis = "raw";
    let targetBatchId: string | undefined;

    if (request.dataset) {
      const batch = sqlite
        .prepare("SELECT id, symbol, resolution, name FROM market_candle_batches WHERE id = ?")
        .get(request.dataset) as
        { id: string; symbol: string; resolution: string; name: string } | undefined;

      if (batch) {
        targetSymbol = batch.symbol;
        targetResolution = batch.resolution as Resolution;
        datasetName = batch.name;
        targetBatchId = batch.id;
      } else {
        const ds = sqlite
          .prepare(
            "SELECT id, symbol, resolution, name, currency, price_basis as priceBasis FROM market_csv_datasets WHERE id = ?",
          )
          .get(request.dataset) as
          | {
              id: string;
              symbol: string;
              resolution: string;
              name: string;
              currency: string;
              priceBasis: string;
            }
          | undefined;

        if (ds) {
          targetSymbol = ds.symbol;
          targetResolution = ds.resolution as Resolution;
          datasetName = ds.name;
          datasetCurrency = ds.currency;
          datasetPriceBasis = ds.priceBasis;
          targetBatchId = ds.id;
        } else {
          throw new MarketDataError(
            "No CSV dataset matches this symbol and resolution. Upload candles in Settings.",
          );
        }
      }
    } else {
      const resolutionMs = parseResolutionMs(request.resolution);
      const isOverlapping = (firstTime: number, lastTime: number) =>
        firstTime < request.to && lastTime + resolutionMs > request.from;

      const normRequest = normalizeSymbol(request.symbol);

      // Direct indexed seek for requested symbol
      let exact = sqlite
        .prepare(
          `SELECT symbol, currency, price_basis as priceBasis, bar_count as barCount, first_time as firstTime, last_time as lastTime
           FROM market_series_summary
           WHERE symbol = ? AND resolution = ? AND bar_count > 0`,
        )
        .get(request.symbol, request.resolution) as
        | {
            symbol: string;
            currency: string;
            priceBasis: string;
            barCount: number;
            firstTime: number;
            lastTime: number;
          }
        | undefined;

      if (exact && !isOverlapping(exact.firstTime, exact.lastTime)) {
        exact = undefined;
      }

      const matchesAllowedList = (allowed: string[], reqSym: string, normReq: string): boolean => {
        const upperReq = reqSym.trim().toUpperCase();
        if (allowed.includes(upperReq) || allowed.includes(reqSym)) return true;
        // Allow futures contract month / continuous suffixes (e.g. MES1!, ESU24) when root symbol is in allowed
        if (
          normReq &&
          upperReq.startsWith(normReq) &&
          !upperReq.includes(".") &&
          allowed.includes(normReq)
        ) {
          return true;
        }
        return false;
      };

      const isAllowedBySymbolConfig = (seriesSymbol: string, reqSym: string): boolean => {
        const upperReq = reqSym.trim().toUpperCase();
        const upperSeries = seriesSymbol.trim().toUpperCase();
        if (upperReq === upperSeries) return true;
        // Allow continuous futures contract variations of the series symbol itself (e.g. MES1!, MESZ24 for MES)
        if (
          normRequest === normalizeSymbol(seriesSymbol) &&
          upperReq.startsWith(upperSeries) &&
          !upperReq.includes(".")
        ) {
          return true;
        }
        const activeAllowed = getActiveCompatibleSymbols(seriesSymbol);
        return matchesAllowedList(activeAllowed, reqSym, normRequest);
      };

      if (!exact && normRequest && normRequest !== request.symbol.trim().toUpperCase()) {
        const normSummary = sqlite
          .prepare(
            `SELECT symbol, currency, price_basis as priceBasis, bar_count as barCount, first_time as firstTime, last_time as lastTime
             FROM market_series_summary
             WHERE symbol = ? AND resolution = ? AND bar_count > 0`,
          )
          .get(normRequest, request.resolution) as
          | {
              symbol: string;
              currency: string;
              priceBasis: string;
              barCount: number;
              firstTime: number;
              lastTime: number;
            }
          | undefined;
        if (
          normSummary &&
          isOverlapping(normSummary.firstTime, normSummary.lastTime) &&
          isAllowedBySymbolConfig(normSummary.symbol, request.symbol)
        ) {
          exact = normSummary;
        }
      }

      if (exact) {
        targetSymbol = exact.symbol;
        datasetCurrency = exact.currency;
        datasetPriceBasis = exact.priceBasis;
      } else {
        const datasets = (
          sqlite
            .prepare(
              `SELECT id, name, symbol, currency, price_basis as priceBasis, first_time as firstTime, last_time as lastTime, compatible_symbols_json as compatibleSymbolsJson
               FROM market_csv_datasets
               WHERE resolution = ?`,
            )
            .all(request.resolution) as Array<{
            id: string;
            name: string;
            symbol: string;
            currency: string;
            priceBasis: string;
            firstTime: number;
            lastTime: number;
            compatibleSymbolsJson: string | null;
          }>
        ).filter((d) => isOverlapping(d.firstTime, d.lastTime));

        const exactDataset = datasets.find(
          (d) =>
            d.symbol === request.symbol ||
            (normRequest &&
              (d.symbol === normRequest || normalizeSymbol(d.symbol) === normRequest) &&
              isAllowedBySymbolConfig(d.symbol, request.symbol)),
        );
        if (exactDataset) {
          targetSymbol = exactDataset.symbol;
          datasetCurrency = exactDataset.currency;
          datasetPriceBasis = exactDataset.priceBasis;
          targetBatchId = exactDataset.id;
          datasetName = exactDataset.name;
        } else {
          const summaries = (
            sqlite
              .prepare(
                `SELECT symbol, currency, price_basis as priceBasis, bar_count as barCount, first_time as firstTime, last_time as lastTime
                 FROM market_series_summary
                 WHERE resolution = ? AND bar_count > 0`,
              )
              .all(request.resolution) as Array<{
              symbol: string;
              currency: string;
              priceBasis: string;
              barCount: number;
              firstTime: number;
              lastTime: number;
            }>
          ).filter((s) => isOverlapping(s.firstTime, s.lastTime));

          // Priority 2A: Check custom symbol links on active summaries (allows custom tickers outside families)
          for (const s of summaries) {
            const customAllowed = getCustomSymbolLinks(s.symbol);
            if (customAllowed && matchesAllowedList(customAllowed, request.symbol, normRequest)) {
              targetSymbol = s.symbol;
              datasetCurrency = s.currency;
              datasetPriceBasis = s.priceBasis;
              break;
            }
          }

          // Priority 2B: Check declared compatibleSymbolsJson on datasets (if not overridden by custom links)
          if (!targetSymbol) {
            for (const d of datasets) {
              const customAllowed = getCustomSymbolLinks(d.symbol);
              if (customAllowed !== null) {
                if (matchesAllowedList(customAllowed, request.symbol, normRequest)) {
                  targetSymbol = d.symbol;
                  datasetCurrency = d.currency;
                  datasetPriceBasis = d.priceBasis;
                  targetBatchId = d.id;
                  datasetName = d.name;
                  break;
                }
                continue;
              }
              if (d.compatibleSymbolsJson) {
                try {
                  const allowed = JSON.parse(d.compatibleSymbolsJson) as string[];
                  if (
                    Array.isArray(allowed) &&
                    matchesAllowedList(allowed, request.symbol, normRequest)
                  ) {
                    targetSymbol = d.symbol;
                    datasetCurrency = d.currency;
                    datasetPriceBasis = d.priceBasis;
                    targetBatchId = d.id;
                    datasetName = d.name;
                    break;
                  }
                } catch {}
              }
            }
          }

          // Priority 3: Same-class Asset Family fallback
          if (!targetSymbol) {
            const family = getAssetFamily(request.symbol);
            if (family) {
              const familySummary = summaries.find((s) => {
                const sFam = getAssetFamily(s.symbol);
                if (!sFam || sFam.id !== family.id) return false;

                const allowed = getActiveCompatibleSymbols(s.symbol);
                return matchesAllowedList(allowed, request.symbol, normRequest);
              });

              if (familySummary) {
                targetSymbol = familySummary.symbol;
                datasetCurrency = familySummary.currency;
                datasetPriceBasis = familySummary.priceBasis;
              } else {
                const familyDataset = datasets.find((d) => {
                  const dFam = getAssetFamily(d.symbol);
                  if (!dFam || dFam.id !== family.id) return false;

                  const allowed = getActiveCompatibleSymbols(d.symbol);
                  return matchesAllowedList(allowed, request.symbol, normRequest);
                });
                if (familyDataset) {
                  targetSymbol = familyDataset.symbol;
                  datasetCurrency = familyDataset.currency;
                  datasetPriceBasis = familyDataset.priceBasis;
                  targetBatchId = familyDataset.id;
                  datasetName = familyDataset.name;
                }
              }
            }
          }
        }
      }

      if (!targetSymbol) {
        throw new MarketDataError(
          "No CSV dataset matches this symbol and resolution. Upload candles in Settings.",
        );
      }
    }

    if (!datasetName || !targetBatchId) {
      const batch = sqlite
        .prepare(
          `SELECT id, name FROM market_candle_batches
           WHERE symbol = ? AND resolution = ?
           ORDER BY imported_at DESC LIMIT 1`,
        )
        .get(targetSymbol, targetResolution) as { id: string; name: string } | undefined;

      if (batch) {
        if (!targetBatchId) targetBatchId = batch.id;
        if (!datasetName) datasetName = batch.name;
      } else {
        const ds = sqlite
          .prepare(
            `SELECT id, name FROM market_csv_datasets
             WHERE symbol = ? AND resolution = ?
             ORDER BY imported_at DESC LIMIT 1`,
          )
          .get(targetSymbol, targetResolution) as { id: string; name: string } | undefined;
        if (ds) {
          if (!targetBatchId) targetBatchId = ds.id;
          if (!datasetName) datasetName = ds.name;
        }
      }
    }

    const resolutionMs = parseResolutionMs(targetResolution);
    const fromTime = request.from - resolutionMs + 1;
    const toTime = request.to - 1;

    const rows = sqlite
      .prepare(
        `SELECT time, open, high, low, close, volume, currency, price_basis as priceBasis
         FROM market_candles
         WHERE symbol = ? AND resolution = ? AND time >= ? AND time <= ?
         ORDER BY time ASC`,
      )
      .all(targetSymbol, targetResolution, fromTime, toTime) as Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
      currency: string;
      priceBasis: string;
    }>;

    let bars: MarketBar[];
    if (rows.length > 0) {
      bars = rows.map((r) => ({
        time: r.time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume ?? 0,
      }));
      if (rows[0]) {
        datasetCurrency = rows[0].currency;
        datasetPriceBasis = rows[0].priceBasis;
      }
    } else {
      bars = [];
    }

    const isFamilyFallback =
      targetSymbol !== request.symbol &&
      normalizeSymbol(targetSymbol) !== normalizeSymbol(request.symbol);
    const familyNotice = isFamilyFallback
      ? ` (Candles from brother instrument ${targetSymbol})`
      : "";
    const fileName = datasetName || targetSymbol;

    return {
      ...result(
        this.name,
        request,
        bars,
        false,
        [
          `Local file: ${fileName}${familyNotice}. Price basis: ${datasetPriceBasis}. Volume may be omitted; only supplied candles are used.`,
        ],
        datasetCurrency,
      ),
      datasetId: targetBatchId,
    };
  },
};
