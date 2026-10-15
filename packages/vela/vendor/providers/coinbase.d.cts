import { O as OHLCV, U as Unsubscribe } from '../options-CSXbjMM5.cjs';
import { D as DataProvider, P as ProviderInfo, B as BarRange, S as SymbolInfo, a as SymbolDescriptor } from '../DataProvider-Bw58CjYy.cjs';

/**
 * Coinbase market-data provider, built from scratch on the public Exchange REST + WebSocket APIs
 * — no third-party SDK, no API key. Serves spot products (`BTC-USD`, `ETH-EUR`, …), paginates past the
 * 300-candle cap, aggregates timeframes Coinbase doesn't serve natively (e.g. `30`, `4h`) and
 * folds `W`/`M` from daily. Live ticks build a forming candle from the `ticker` stream (Coinbase
 * has no native kline stream), with a poll fallback.
 *
 * Trades: Coinbase trades cursor-walk back from the live tip (the `cb-after` header) with no
 * time-seek, so trade-derived depth is `'recent'` — live and recent windows reconstruct; older bars
 * are served empty rather than walked unbounded.
 *
 *   import { CoinbaseProvider } from 'vela/providers/coinbase';
 *   chart.data.registerProvider('coinbase', new CoinbaseProvider());
 */
declare class CoinbaseProvider implements DataProvider {
    /** Cached symbol enumeration (the products list is large; fetch once). */
    private symbolsPromise;
    /** Shared request gate: caps concurrency, spaces request starts, honors 429 backoff. */
    private readonly gate;
    info(): ProviderInfo;
    getBars(ticker: string, timeframe: string, range: BarRange): Promise<OHLCV[]>;
    getSymbolInfo(ticker: string): Promise<SymbolInfo | undefined>;
    listSymbols(): Promise<SymbolDescriptor[]>;
    /** Predefined icon source for a crypto venue: the Ledger crypto-icon CDN, keyed by
     *  the BASE asset (the description's first segment, else the de-suffixed ticker). */
    resolveSymbolIcon(symbol: SymbolDescriptor): string | undefined;
    subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): Unsubscribe;
    private fetchProducts;
    /**
     * Fetch candles for a count (most-recent `limit`) or a `[from, to]` range, paginating past the
     * 300-bucket cap. Returns ascending OHLCV (newest-first rows from the API are sorted on the way out).
     */
    private fetchCandles;
    /** Assemble the most-recent `limit` bars, walking backward in ≤300-bucket windows. */
    private paginateBackward;
    /** Walk `[from, to]` forward in ≤300-bucket windows (ranged/tail fetches). */
    private paginateForward;
    /** One candles request over `[startMs, endMs]` → ascending OHLCV (the API returns newest-first). */
    private candlesChunk;
    /**
     * Build a forming candle from the Coinbase `ticker` channel (Coinbase has no native kline stream):
     * the stream supplies a smooth live price/high/low, while a periodic REST re-seed fixes the
     * authoritative open + volume and corrects any drift. A stall watchdog falls back to polling if the
     * socket opens but never delivers a price; reconnects on an unexpected close until unsubscribed.
     */
    private streamTicker;
    /** Poll the forming candle (aggregated/W/M timeframes, or environments without WebSocket). */
    private pollBars;
    /** GET → parsed JSON, through the rate gate with 429 backoff. */
    private json;
    /**
     * Issue one GET through the shared {@link gate} (concurrency + spacing), retrying after a 429
     * (honoring `Retry-After`, else exponential backoff + jitter). Returns the `Response` so callers
     * can read pagination headers (`cb-after`) before consuming the body.
     */
    private request;
}

export { CoinbaseProvider, DataProvider, ProviderInfo, SymbolDescriptor };
