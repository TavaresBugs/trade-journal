import { bad, handler, ok, requireValue } from "@/server/api";
import {
  csvDatasets,
  candleSeriesSummary,
  candleBatches,
  distinctTradedSymbols,
  ingestCandles,
  revertCandleBatch,
  purgeCandlesBySymbol,
  setCustomSymbolLinks,
} from "@/server/market-data/csv";
import { MAX_CSV_BYTES, parseMarketCsv } from "@/lib/market-csv";
import {
  isResolution,
  RESOLUTIONS,
  normalizeResolution,
  parseResolutionMs,
  type Resolution,
} from "@/lib/market-data";

export const GET = handler(() =>
  ok({
    series: candleSeriesSummary(),
    batches: candleBatches(),
    datasets: csvDatasets(),
    tradedSymbols: distinctTradedSymbols(),
  }),
);

export const POST = handler(async (request: Request) => {
  const reader = request.body?.getReader();
  requireValue(reader, "Provide a market CSV request.");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_CSV_BYTES * 2) {
      await reader.cancel();
      return bad("Use a CSV smaller than 30 MB.", 413);
    }
    parts.push(value);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    return bad("Invalid CSV request.");
  }
  requireValue(
    body &&
      [
        "preview",
        "import",
        "revert_batch",
        "purge_symbol",
        "update_compatible_symbols",
      ].includes(body.action),
    "Choose a CSV action.",
  );

  if (body.action === "update_compatible_symbols") {
    requireValue(
      typeof body.symbol === "string" && body.symbol.length <= 100,
      "Choose a symbol to update.",
    );
    requireValue(
      Array.isArray(body.compatibleSymbols) &&
        body.compatibleSymbols.every((s: unknown) => typeof s === "string"),
      "Provide compatible symbols array.",
    );
    setCustomSymbolLinks(body.symbol, body.compatibleSymbols);
    return ok({
      symbol: body.symbol,
      compatibleSymbols: body.compatibleSymbols,
      series: candleSeriesSummary(),
      batches: candleBatches(),
      datasets: csvDatasets(),
    });
  }

  if (body.action === "revert_batch") {
    requireValue(
      typeof body.batchId === "string" && body.batchId.length <= 80,
      "Choose a batch to revert.",
    );
    const reverted = revertCandleBatch(body.batchId);
    return ok({
      reverted,
      series: candleSeriesSummary(),
      batches: candleBatches(),
      datasets: csvDatasets(),
    });
  }

  if (body.action === "purge_symbol") {
    requireValue(
      typeof body.symbol === "string" && body.symbol.length <= 100,
      "Choose a symbol to purge.",
    );
    const resolution = isResolution(body.resolution) ? body.resolution : undefined;
    purgeCandlesBySymbol(body.symbol, resolution);
    return ok({
      purged: { symbol: body.symbol, resolution },
      series: candleSeriesSummary(),
      batches: candleBatches(),
      datasets: csvDatasets(),
    });
  }

  requireValue(typeof body.content === "string", "Choose a CSV file.");
  requireValue(
    typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 200,
    "Enter a file name.",
  );
  requireValue(
    typeof body.symbol === "string" && /^[A-Za-z0-9._:/-]{1,100}$/.test(body.symbol),
    "Enter the exact instrument symbol.",
  );
  requireValue(isResolution(body.resolution), "Choose a candle resolution.");
  requireValue(
    typeof body.currency === "string" && /^[A-Z0-9]{2,12}$/.test(body.currency),
    "Enter the quote currency, such as USD or USDT.",
  );
  requireValue(
    ["raw", "split", "adjusted", "midpoint", "bid", "ask"].includes(body.priceBasis),
    "Choose the file's price basis.",
  );

  try {
    const normResolution = (normalizeResolution(body.resolution) ||
      body.resolution.toLowerCase()) as Resolution;

    if (body.action === "import") {
      const compatibleSymbols =
        Array.isArray(body.compatibleSymbols) &&
        body.compatibleSymbols.every((s: unknown) => typeof s === "string")
          ? (body.compatibleSymbols as string[])
          : undefined;
      const ingestResult = ingestCandles({
        name: body.name,
        symbol: body.symbol,
        resolution: normResolution,
        currency: body.currency,
        priceBasis: body.priceBasis,
        content: body.content,
        compatibleSymbols,
      });
      return ok({
        id: ingestResult.batchId,
        batchId: ingestResult.batchId,
        symbol: ingestResult.symbol,
        resolution: ingestResult.resolution,
        newBarCount: ingestResult.newBarCount,
        duplicateBarCount: ingestResult.duplicateBarCount,
        totalInDb: ingestResult.totalInDb,
        result: ingestResult,
        series: candleSeriesSummary(),
        batches: candleBatches(),
        datasets: csvDatasets(),
      });
    }
    const bars = parseMarketCsv(body.content, body.symbol, normResolution);
    return ok({
      count: bars.length,
      from: new Date(bars[0]!.time).toISOString(),
      to: new Date(bars.at(-1)!.time + parseResolutionMs(normResolution)).toISOString(),
      sample: bars.slice(0, 3),
    });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Invalid candle CSV.");
  }
});
