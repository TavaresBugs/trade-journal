import { M as MarketConfig, O as OHLCV, U as Unsubscribe } from './options-CSXbjMM5.cjs';

/**
 * Symbol metadata an engine may need (e.g. Pine `syminfo.*`). Free-form beyond
 * `ticker` — engines read the keys they understand and synthesize a fallback for
 * the rest.
 */
interface SymbolInfo {
    ticker: string;
    [key: string]: unknown;
}
/**
 * The market-data abstraction. Vela OWNS the candles: it loads history and
 * streams live ticks through this port, holds the one canonical bar array, and
 * hands it to whichever engine executes. Decoupled from scripting so every
 * registered engine shares the same dataset (no per-engine re-fetch).
 *
 * Swappable: the default is `MultiProviderFeed` (a registry of `DataProvider`s); tests
 * inject a fake; a host app can supply its own backend.
 */
/** A bounded fetch window (epoch ms). `from`/`to` inclusive-ish; `limit` caps the count. */
interface BarRange {
    /** Oldest bar open-time to fetch from (inclusive). */
    from?: number;
    /** Newest bar open-time to fetch to (defaults to "now" when omitted). */
    to?: number;
    /** Max bars. */
    limit?: number;
    /**
     * Trading session to serve (`'regular'` | `'extended'`) — rides every request on
     * markets that have sessions; absent = the provider's default. A provider without
     * a session concept ignores it.
     */
    session?: string;
}
interface MarketDataFeed {
    /** Load the initial history (from a provider or the offline `data` array). */
    load(cfg: MarketConfig): Promise<OHLCV[]>;
    /**
     * Progressive load: emit growing snapshots while the source heals a cold symbol,
     * resolve with the final answer — `DataProvider.getBarsProgressive` semantics
     * (cumulative, confirmed-from-the-newest-bar snapshots; each extends the last).
     * Resolves NULL when the resolved source lacks the capability — the caller then
     * runs its non-progressive paths (single load, deep head + backfill) untouched.
     */
    loadProgressive?(cfg: MarketConfig, onBatch: (bars: OHLCV[]) => void, opts?: {
        signal?: AbortSignal;
    }): Promise<OHLCV[] | null>;
    /** Subscribe to live forming-candle ticks. Returns an unsubscribe fn. */
    subscribe(cfg: MarketConfig, onBar: (bar: OHLCV) => void): Unsubscribe;
    /** Optional symbol metadata for engines that need it; absent/undefined ≡ engine synthesizes. */
    symbolInfo?(cfg: MarketConfig): SymbolInfo | undefined;
    /**
     * Fetch a bounded range. Used by the cache to pull ONLY the uncached tail
     * (newly-closed + forming bars) instead of re-downloading the whole window.
     * Absent ≡ no ranged support; the cache falls back to a full `load`.
     */
    loadRange?(cfg: MarketConfig, range: BarRange): Promise<OHLCV[]>;
    /**
     * Report that a symbol cannot be served by anything registered — the load is PARKED
     * (it resumes if a capable provider registers later). Hosts surface this instead of
     * leaving a silently blank chart. Absent ≡ the feed never parks.
     */
    onUnresolved?(cb: (info: {
        symbol: string;
        providers: string[];
    }) => void): Unsubscribe;
    /** Release feed-owned resources (parked waits, timers). Absent ≡ nothing to release. */
    destroy?(): void;
}

/**
 * A descriptor for one symbol a provider serves. Powers the eager index built at
 * registration (for bare-symbol resolution) and symbol autocomplete.
 */
interface SymbolDescriptor {
    /** The ticker exactly as the provider expects it (e.g. `BTCUSDT`, `BTCUSDT.P`). */
    ticker: string;
    /** Human-readable label (e.g. `Bitcoin / TetherUS`). */
    description?: string;
    /** Instrument class, free-form (e.g. `crypto`, `futures`, `stock`). */
    type?: string;
    /**
     * The GROUP this row belongs to (futures: the product root — `ES1!` and `ES2!`
     * carry `group: "ES"`). The group's own row repeats the value in `ticker` with a
     * distinguishing `type` and is NOT directly loadable — pickers fold members under
     * it and load the member marked {@link default} when the group itself is picked.
     */
    group?: string;
    /**
     * The member a picker loads when its whole GROUP is picked. At most one per group;
     * the agreed fallback for zero-or-many is the group's FIRST listed member, so
     * providers emit members in deliberate order.
     */
    default?: boolean;
    /**
     * The provider-side market (product class) serving this symbol, on providers whose
     * markets differ in session shape (futures: index, grains, energy… hours differ on
     * one source). Consumers resolving per-market vocabulary (session template,
     * calendar windows) key on it; absent where the market is unambiguous.
     */
    market?: string;
    /**
     * The instrument's LISTING-venue prefix (`NASDAQ`, `NYSE`, `AMEX`) — a property of the
     * SYMBOL, not of the provider: AAPL is Nasdaq-listed and IBM NYSE-listed even when one
     * provider supplies both tapes. When declared, it is what pickers/legends display, what
     * `PREFIX:TICKER` strings resolve against (TradingView parity: `NYSE:AAPL` is NOT
     * found), and what the canonical committed/persisted form carries. Absent on venues
     * where the provider IS the identity (crypto, fx) — the provider name prefixes those.
     */
    prefix?: string;
    /** Owning provider name — annotated by the registry aggregation (badges in pickers). */
    provider?: string;
}
/** What a provider can do — lets the registry/UI reason without provider-specific checks. */
interface ProviderCapabilities {
    /** Implements `listSymbols()` (enumeration → eager index + autocomplete). */
    enumerate: boolean;
    /** Implements `subscribe()` (true streaming; otherwise the feed polls `getBars`). */
    stream: boolean;
    /** Implements `getSymbolInfo()` (per-symbol metadata for engine `syminfo.*`). */
    symbolInfo: boolean;
}
/** Provider metadata, surfaced via `chart.data.providers()`. */
interface ProviderInfo {
    /** Stable id (the registration name, lower-cased). */
    name: string;
    /** Display label (e.g. `Binance`). */
    displayName?: string;
    /** Whether the provider needs `configure()` before use. */
    requiresApiKey?: boolean;
    /** Timeframes the provider serves (canonical strings); informational. */
    supportedTimeframes?: readonly string[];
    capabilities: ProviderCapabilities;
}
/**
 * A market-data source for ONE venue, neutral to Vela (no scripting-engine types). Register
 * one with `chart.data.registerProvider(name, provider)`; the registry routes any
 * `name:SYMBOL` (or bare `SYMBOL` it indexes) to it.
 *
 * Only `getBars` is required. Everything else is a progressive capability the
 * registry uses when present and degrades around when absent — the same
 * philosophy as the {@link MarketDataFeed} port.
 */
interface DataProvider {
    /**
     * Fetch bars for `ticker`/`timeframe`. `ticker` is exactly what the user typed
     * minus any `provider:` prefix; any `.ext` suffix is KEPT (the provider owns its
     * meaning — e.g. Binance `.P` = perpetual). The newest bar is treated as the
     * forming candle. Bars: `{ time (open, epoch ms), open, high, low, close, volume? }`,
     * sorted + de-duplicated by open-time.
     */
    getBars(ticker: string, timeframe: string, range: BarRange): Promise<OHLCV[]>;
    /**
     * Progressive variant of {@link getBars}, for sources that HEAL a cold symbol while
     * answering: instead of holding the load until the whole depth converged, the
     * provider emits growing snapshots as history lands and the chart paints each one.
     * Every `onBatch` list (and the resolved final list) is the WHOLE answer so far —
     * ascending, and CONFIRMED from its newest bar backward: a snapshot is cut at the
     * newest stretch the SOURCE still owes (its own accounting of unanswered work,
     * oldest-last), NEVER inferred from bar-time gaps — markets hold real empty
     * stretches (holidays, quiet sessions) that must flow through immediately. Bars
     * never move or vanish between snapshots; each extends the previous one. The
     * resolved value is the final answer. `opts.signal` aborts the stream — the chart
     * switched away: stop polling PROMPTLY and resolve with whatever is confirmed
     * (an abandoned load left polling starves the browser's per-host connection pool
     * and the next symbol with it). Absent ≡ single-answer `getBars` semantics.
     */
    getBarsProgressive?(ticker: string, timeframe: string, range: BarRange, onBatch: (bars: OHLCV[]) => void, opts?: {
        signal?: AbortSignal;
    }): Promise<OHLCV[]>;
    /** Provider metadata. Absent ⇒ the registry synthesizes a record from the methods present. */
    info?(): ProviderInfo;
    /**
     * Enumerate the symbols this provider serves — drives the eager index built when
     * the provider registers. Absent ⇒ no index: the provider can only be reached by
     * an explicit `name:SYMBOL` prefix, never by resolving a bare symbol.
     */
    listSymbols?(): Promise<SymbolDescriptor[]>;
    /** Per-symbol metadata for engine `syminfo.*`. Absent ⇒ the engine synthesizes a fallback. */
    getSymbolInfo?(ticker: string): Promise<SymbolInfo | undefined>;
    /**
     * The icon URL for one of THIS provider's symbols — the provider owns the knowledge
     * of where its asset class's icons live (a crypto CDN, a self-hosted store), the
     * shells own the rendering (round badge, colored-initials fallback). Called lazily,
     * per RENDERED row — never per index build — so it must be cheap and synchronous.
     * `undefined` ⇒ no icon (the initials badge shows). Absent ⇒ same. The URL must be
     * CORS-clean (`Access-Control-Allow-Origin`) or drawing it taints the canvas and
     * breaks the PNG export — a load error falls back to initials either way.
     */
    resolveSymbolIcon?(symbol: SymbolDescriptor): string | undefined;
    /**
     * Open a true live stream for `ticker`/`timeframe`. Each call to `onBar` delivers
     * the forming candle (or a freshly-closed one). Returns an unsubscribe fn. Absent
     * ⇒ the feed polls `getBars` for ticks instead. `opts.session` names the trading
     * session the chart is showing (see {@link BarRange.session}) — a provider whose
     * live source cannot filter by session may fall back to polling internally.
     */
    subscribe?(ticker: string, timeframe: string, onBar: (bar: OHLCV) => void, opts?: {
        session?: string;
    }): Unsubscribe;
    /**
     * Resolved market-calendar windows over `[range.from, range.to)`: ascending epoch-ms
     * `[start, end)` pairs of OPEN market time, holidays and DST already applied by the
     * source — the single market-time truth for session-anchored consumers (market-status
     * badges, session profiles), which must never recompute a holiday themselves.
     * `range.session` selects the window set (`'regular'` default; `'extended'` = the
     * full tape). Absent ⇒ the venue offers no calendar (continuous markets) and
     * consumers fall back to their own anchoring (e.g. UTC days).
     */
    getCalendar?(ticker: string, range: {
        from: number;
        to: number;
        session?: string;
    }): Promise<ReadonlyArray<readonly [number, number]>>;
    /** Apply runtime config (e.g. API keys). Absent ⇒ no configuration needed. */
    configure?(config: unknown): void;
    /**
     * Capabilities for ONE ticker, when they vary by instrument class within the venue.
     * Absent ⇒ {@link ProviderInfo.capabilities} applies uniformly to every symbol.
     */
    capabilitiesFor?(ticker: string): ProviderCapabilities;
}

export type { BarRange as B, DataProvider as D, MarketDataFeed as M, ProviderInfo as P, SymbolInfo as S, SymbolDescriptor as a, ProviderCapabilities as b };
