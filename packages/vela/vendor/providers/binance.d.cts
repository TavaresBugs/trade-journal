import { O as OHLCV, U as Unsubscribe } from '../options-CSXbjMM5.cjs';
import { D as DataProvider, P as ProviderInfo, B as BarRange, S as SymbolInfo, a as SymbolDescriptor } from '../DataProvider-Bw58CjYy.cjs';

/**
 * Binance market-data provider, built from scratch on the public REST + WebSocket
 * APIs — no third-party market-data SDK. Serves spot and USDT-margined perpetual futures (`SYMBOL.P`),
 * paginates past the 1000-kline cap, falls back `api.binance.com → api.binance.us`,
 * and aggregates timeframes Binance doesn't serve natively (e.g. `45`, `180`). No API
 * key; live ticks stream from a native kline WebSocket (`subscribe`), with a poll
 * fallback for aggregated timeframes.
 *
 *   import { BinanceProvider } from 'vela/providers/binance';
 *   chart.data.registerProvider('binance', new BinanceProvider());
 */
declare class BinanceProvider implements DataProvider {
    /** The spot endpoint confirmed reachable (cached after the first probe). */
    private spotBaseUrl;
    /** The in-flight endpoint probe, shared so concurrent first calls don't each ping. */
    private spotBaseProbe;
    /** Cached symbol enumeration (exchangeInfo is large; fetch once). */
    private symbolsPromise;
    info(): ProviderInfo;
    getBars(ticker: string, timeframe: string, range: BarRange): Promise<OHLCV[]>;
    getSymbolInfo(ticker: string): Promise<SymbolInfo | undefined>;
    listSymbols(): Promise<SymbolDescriptor[]>;
    /** Predefined icon source for a crypto venue: the Ledger crypto-icon CDN, keyed by
     *  the BASE asset (the description's first segment, else the de-suffixed ticker). */
    resolveSymbolIcon(symbol: SymbolDescriptor): string | undefined;
    subscribe(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void): Unsubscribe;
    /**
     * Open a Binance kline WebSocket (single-stream URL form — the stream is in the
     * path, so no subscribe frame is sent). Perpetuals use `fstream`; spot uses the
     * host matching the resolved REST endpoint (`.com`/`.us`). Reconnects on an
     * unexpected close until unsubscribed; the browser auto-answers Binance's
     * protocol-level pings, so no manual keepalive is needed.
     *
     * A stall watchdog falls the subscription back to polling if the socket opens but
     * never delivers a candle — so a blocked/silent stream (e.g. geo-restricted
     * futures) still yields live updates instead of a silently-dead feed.
     */
    private streamKlines;
    /** WebSocket host matching the resolved REST spot endpoint (`.com` default, else `.us`). */
    private spotWsBase;
    /** Poll the forming candle (for aggregated timeframes Binance has no native kline stream for). */
    private pollBars;
    private listSpot;
    private listFutures;
    /** Fetch klines, paginating past Binance's 1000-row cap. */
    private fetchKlines;
    /** Forward pagination from `from` to `to` (used by ranged/tail fetches). */
    private paginateForward;
    /** Backward pagination to assemble the most-recent `limit` bars. */
    private paginateBackward;
    private klinesChunk;
    /**
     * Resolve the reachable spot endpoint (default, else the US mirror). The in-flight
     * probe is shared, so a burst of concurrent first calls issues ONE ping pair, not one
     * per call. A confirmed endpoint is cached permanently; a total failure clears the
     * probe so a later call can retry.
     */
    private spotBase;
    private json;
}

export { BinanceProvider, DataProvider, ProviderInfo, SymbolDescriptor };
