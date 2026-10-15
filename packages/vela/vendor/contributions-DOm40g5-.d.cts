import { x as Millis, ao as InputSchema, am as IndicatorMeta, P as PriceStyle, O as OHLCV, I as InputValue, l as IndicatorModel, k as MoveTarget, aH as PaneAxis, a_ as SeriesSpec, ak as Fill, H as Background, aQ as PriceLine, a7 as DrawingLine, a3 as DrawingBox, a6 as DrawingLabel, ab as DrawingPolyline, a8 as DrawingLinefill, ag as DrawingTable, h as IndicatorStatus, a as VisibleRange, c as VelaTheme, S as SerializedDrawing, z as DrawingTypeKey, y as SnapMode, a9 as DrawingMode, u as MarkClickEvent, e as IChartRenderer, R as RendererCapabilities, o as LegendActionView, p as LegendCalloutView, U as Unsubscribe, C as CrosshairEvent, r as ClickEvent, A as AxisLongPressEvent, v as DataWindowReadout, n as SymbolPickerFn, W as WallClock, bg as PaneInfo, aj as DrawingsOption, ad as DrawingSeriesGateway, bh as DrawingToolDefaults, bi as DrawingToolTemplate, D as Drawing, s as TimelineMark, t as MarkGroup, b as VelaOptions, F as AddIndicatorOptions, aG as MarketSwitch, E as MarketSnapshot, V as VisibleRangePreset, T as ThemeName } from './options-CSXbjMM5.cjs';
import { S as SymbolInfo, B as BarRange, M as MarketDataFeed, D as DataProvider, P as ProviderInfo, a as SymbolDescriptor, b as ProviderCapabilities } from './DataProvider-Bw58CjYy.cjs';

/**
 * A strategy's broker state at ONE bar — the flat summary a host reads while a script
 * runs. Distinct from {@link TradeExecution}, which is a single order FILL the renderer
 * paints: this is the account, not the drawing.
 *
 * Neutral by design: an engine translates its own vocabulary into these names, so host
 * code reads the same fields whatever language the strategy was written in.
 */
interface StrategyState {
    /** Signed contracts held (positive = long, negative = short, 0 = flat). */
    position: number;
    /** Average entry price of the open position (0 when flat). */
    avgPrice: number;
    /** Account value: capital + realized + unrealized. */
    equity: number;
    /** Unrealized P&L of the open position. */
    openPnl: number;
    /** Realized P&L, gross profit minus gross loss. */
    netPnl: number;
    grossProfit: number;
    grossLoss: number;
    /** Closed-trade outcome counts. */
    wins: number;
    losses: number;
    even: number;
    /** Largest peak-to-trough equity drop / trough-to-peak rise, in account currency. */
    maxDrawdown: number;
    maxRunup: number;
    initialCapital: number;
}
/**
 * One ROUND TRIP of a strategy: an entry, and the exit that closed it when there is one.
 * Coarser than {@link TradeExecution} (a fill) on purpose — this is what a host tabulates,
 * exports, or reconciles against a broker.
 */
interface StrategyTrade {
    /** Stable within a run; shared with the fills' `tradeId`. */
    id: string;
    side: 'long' | 'short';
    /** Contracts (magnitude — `side` carries the direction). */
    qty: number;
    entry: StrategyFill;
    /** Absent while the trade is still open. */
    exit?: StrategyFill;
    /** Still open at the last computed bar. */
    open: boolean;
    /**
     * Realized P&L of this round trip in account currency, net of commission. Absent
     * while the trade is open, and for an engine that reports no per-trade ledger.
     */
    pnl?: number;
    /** Commission charged on this trade, in account currency. */
    commission?: number;
    /**
     * Worst / best unrealized excursion of THIS trade from its entry, in account
     * currency (positive magnitudes). Read `maxDrawdown` as the adverse excursion and
     * `maxRunup` as the favorable one — the per-trade counterparts of the account-level
     * {@link StrategyState.maxDrawdown} / {@link StrategyState.maxRunup}. An engine
     * defines the exact convention (intrabar extremes, commission handling); absent when
     * it does not track them.
     */
    maxDrawdown?: number;
    maxRunup?: number;
}
/** One side of a {@link StrategyTrade}. */
interface StrategyFill {
    /** The order id the script used (Pine's `strategy.entry("Long", …)`). */
    id: string;
    time: Millis;
    price: number;
    comment?: string;
}

/**
 * A cache-backed data gateway the engine uses to fetch ANY `(symbol, timeframe)`
 * series it needs — the main series stays in-memory, but secondary series
 * (Pine `request.security` HTF/LTF/cross-symbol) are fetched + cached through
 * this so they get real, correctly-resolved data (no aggregation; timeframes
 * kept separate). Provided by the orchestrator, backed by `MarketDataFeed`.
 */
type FetchSeries = (symbol: string, timeframe: string, range: BarRange) => Promise<OHLCV[]>;
/** The chart's visible bar-time window (epoch ms of the left/right edges). */
interface VisibleBarRange {
    left: number;
    right: number;
}
interface EngineAlert {
    id: string;
    message: string;
    title?: string;
    time: number;
    barIndex: number;
    freq?: string;
}
interface EngineWarning {
    message: string;
    method?: string;
    bar: number;
}
/**
 * A source script that has been parsed (inputs + declaration metadata extracted)
 * and is ready to execute. `token` is engine-internal and opaque to core — the
 * engine reads it back in `execute()`.
 */
interface PreparedScript {
    /** The language that produced this (the engine's `language`). */
    language: string;
    inputs: InputSchema[];
    /**
     * Declaration-property schema (a strategy's `initial_capital`, an indicator's
     * `precision`, …) — the settings dialog renders these on a "Properties" tab.
     * `defval` is the EFFECTIVE default: the value the script declares, else the
     * engine's configured default, else the language's own. Absent ≡ the language
     * has no declaration properties (`capabilities.props` false).
     */
    props?: InputSchema[];
    meta: IndicatorMeta;
    /**
     * Whether the script references a viewport built-in (e.g. Pine
     * `chart.left_visible_bar_time`). Detected statically at prepare; an engine
     * may refine it in place after the first run.
     */
    reactsToViewport: boolean;
    readonly token: unknown;
}
/** What an engine can do — lets the orchestrator route without engine-specific checks. */
interface EngineCapabilities {
    /** Can maintain a persistent incremental context for live ticks (vs a full re-run). */
    streaming: boolean;
    /** Understands viewport-dependent execution (`chart.*_visible_bar_time`-style). */
    visibleRange: boolean;
    /** Exposes an inputs schema (drives the renderer's settings dialog). */
    inputs: boolean;
    /** Exposes a declaration-props schema (`PreparedScript.props`) and honors prop
     *  overrides on `execute`/`update`. Absent ≡ false. */
    props?: boolean;
}
/** Market context an execution needs. Vela owns the bars; this is the metadata. */
interface ExecutionMarket {
    symbol: string;
    timeframe: string;
    /** Provider symbol metadata (Pine `syminfo.*`). May be absent or partial: the feed
     *  fetches it asynchronously (the `MarketDataFeed.symbolInfo` port is synchronous), so
     *  the first run can see a synthesized fallback and later runs the real values. */
    symbolInfo?: SymbolInfo;
    /** The chart's active price style. An engine adapter encodes a bar-transforming style
     *  into the chart's ticker identity (the extended ticker `"SYM;heikinashi"` — see
     *  `chartTickerOf`), from which chart-type builtins derive. The BARS an execution
     *  receives are already the style's view — this is metadata, not a request to
     *  transform. Optional; engines may ignore it. */
    chartStyle?: PriceStyle;
}
/**
 * One execution request. Vela owns the bars and passes them in — the engine
 * never fetches market data. `mode: 'static'` runs on demand (and re-runs when
 * the session is poked); `mode: 'live'` keeps a streaming context that emits per
 * tick (only requested when `capabilities.streaming`).
 */
interface ExecutionRequest {
    prepared: PreparedScript;
    market: ExecutionMarket;
    /** The initial bar snapshot. */
    bars: OHLCV[];
    /** Live accessor to Vela's canonical array (read on each re-run / tick). */
    getBars?: () => OHLCV[];
    /**
     * Fetch a secondary `(symbol, timeframe)` series (Pine `request.security`
     * HTF/LTF/cross-symbol). Cache-backed by Vela's data feed. Absent ≡ no
     * gateway (secondary fetches degrade to empty).
     */
    fetchSeries?: FetchSeries;
    inputs?: Record<string, InputValue>;
    /** Declaration-prop overrides, keyed like `PreparedScript.props`. Only meaningful
     *  when `capabilities.props`; other engines ignore it. */
    props?: Record<string, InputValue>;
    visibleRange?: VisibleBarRange;
    mode: 'static' | 'live';
    /**
     * Where the chart's history load stands at session start. `'backfill'` = older
     * chunks are still streaming in (the bars snapshot is a PARTIAL history); the
     * engine decides run policy — the bundled engines defer their first run until
     * the `'complete'` notification, a progressive engine may run immediately.
     * Absent ≡ `'complete'` (history fully loaded — today's behavior).
     */
    historyState?: 'backfill' | 'complete';
}
/** The event sink. `onModel` fires on the first run and on every re-run / live tick. */
interface ExecutionHandlers {
    onModel(model: IndicatorModel): void;
    onAlert?(alert: EngineAlert): void;
    onWarning?(warning: EngineWarning): void;
    onError?(error: Error): void;
    /** A `static` run finished; not fired for an open live stream. */
    onDone?(): void;
}
/**
 * Why the chart's bars changed, carried on {@link ExecutionSession.notifyBars}.
 * `'backfill'` = older history chunks prepended (the load is still in progress);
 * `'complete'` = the history backfill just finished (fires once). `undefined` =
 * a live tick / new bar at the tail — today's meaning. Run policy is the
 * ENGINE's: the bundled engines skip `'backfill'` and run on `'complete'`/ticks;
 * a progressive engine may re-run on every reason.
 */
type BarsChangeReason = 'backfill' | 'complete';
/** A running execution — the control surface the orchestrator drives. */
/** A read-only, serializable snapshot of a running script's execution context. */
interface EngineContextSnapshot {
    language: string;
    /** 'computing' while a static run is in flight, 'streaming' on a live session, 'idle' after done/stop. */
    phase: 'idle' | 'computing' | 'streaming';
    /** Index of the last computed bar. */
    barIndex: number;
    meta: {
        title: string;
        overlay: boolean;
        precision?: number;
        shorttitle?: string;
    };
    /** Named plot outputs, per key: index-aligned `{time, value}` points. */
    plots: Record<string, ReadonlyArray<{
        time: number;
        value: unknown;
    }>>;
    /**
     * The script's variables at the last computed bar, keyed by the names WRITTEN in the
     * source. An engine that mangles names internally un-mangles them here: a transpiler's
     * scoping scheme is its own business and must not reach host code. Values are the
     * serializable subset (never live references, never per-bar series buffers).
     */
    variables: Record<string, unknown>;
    /**
     * A STRATEGY's broker state at the last computed bar — absent for a plain indicator,
     * and for an engine whose language has no strategy concept. Neutral by contract: the
     * engine translates its own vocabulary into these fields.
     */
    strategy?: StrategyState;
    /** The strategy's round trips, closed then open. Absent when there are none. Select it
     *  explicitly — a deep backtest's ledger is large. */
    trades?: StrategyTrade[];
    warnings: EngineWarning[];
}
/** Keys a caller may restrict a context snapshot to (limits worker structured-clone cost). */
type ContextSelect = ReadonlyArray<keyof EngineContextSnapshot>;
interface ExecutionSession {
    /**
     * OPTIONAL capability — resolve a read-only context snapshot (null when the run
     * hasn't produced one yet). Always a COPY: mutating it never touches the engine.
     */
    getContext?(select?: ContextSelect): Promise<EngineContextSnapshot | null>;
    /** Tear down (stops any streaming / incremental re-execution). */
    stop(): void;
    /** Re-run / re-stream with merged input overrides. `props` (when given) merges
     *  declaration-prop overrides the same way — a props-capable engine re-runs with
     *  both applied; others may ignore the second argument. */
    update(inputs: Record<string, InputValue>, props?: Record<string, InputValue>): void;
    /** Update the viewport window (re-runs viewport-dependent scripts; no-op otherwise). */
    setVisibleRange(range: VisibleBarRange): void;
    /** Signal that Vela's bars changed. No reason = live tick; see {@link BarsChangeReason}. */
    notifyBars(reason?: BarsChangeReason): void;
}
/**
 * The scripting-engine abstraction. The orchestrator talks only to this, so every
 * concrete engine is swappable and Vela itself SHIPS none — engines are separate
 * packages (Pine Script: `@luxalgo/vela-pinets`) or host code written against this
 * port (see docs/contributing/adding-an-engine.md). Engines are registered by `language` and selected per
 * `addIndicator({ language })`; market data is owned by Vela's
 * `MarketDataFeed` and passed into `execute`.
 */
interface ScriptingEngine {
    /** Language id this engine handles, e.g. `'pine'`. The registry key. */
    readonly language: string;
    readonly capabilities: EngineCapabilities;
    /** Parse a script: extract its inputs schema + declaration metadata. No market data. */
    prepare(source: string, instanceId: string): Promise<PreparedScript>;
    /** Execute (static or live). Returns a session control handle. */
    execute(req: ExecutionRequest, handlers: ExecutionHandlers): ExecutionSession;
}

/** Per-indicator events emitted on `handle.on(...)`. */
interface IndicatorEventMap extends Record<string, unknown> {
    ready: undefined;
    error: {
        error: Error;
    };
    alert: {
        id: string;
        message: string;
        title?: string;
        time: number;
    };
}
/** How a {@link IndicatorHandle.updateCode} call ended. Never a rejection. */
interface CodeUpdateResult {
    /** The new code is the one running (or, hidden, the one that will run when shown). */
    ok: boolean;
    /** Why the update did not land — the previous code is running again. Null on success. */
    error: Error | null;
}
/**
 * What `chart.addIndicator(...)` returns to the developer. The handle is usable
 * synchronously; data renders when execution resolves (see `on('ready')`).
 */
interface IndicatorHandle {
    readonly id: string;
    readonly title: string;
    /** The script source this indicator currently runs (the one it was added with,
     *  until {@link updateCode} replaces it). `undefined` for a NATIVE (core-computed)
     *  indicator — there is no script to show. What a host editor opens when a legend
     *  action asks for "the code behind this row". */
    readonly source?: string;
    /** The registered type of a NATIVE (core-computed) indicator — `undefined` for a
     *  script indicator. The two are exclusive: a handle has a `source` or a `nativeType`. */
    readonly nativeType?: string;
    /** Inputs parsed from the Pine source (populated once the script is prepared). */
    readonly inputs: readonly InputSchema[];
    /** Declaration-props schema (a strategy's `initial_capital`, an indicator's
     *  `precision`, …; populated once the script is prepared). Empty when the
     *  engine exposes none. */
    readonly props: readonly InputSchema[];
    /** Whether the indicator is currently shown (vs hidden). Hidden indicators stop computing. */
    readonly visible: boolean;
    /** The CURRENT stored input values (declaration defaults merged with every edit so
     *  far) — what state persistence diffs against the schema's `defval`s. */
    inputValues(): Record<string, InputValue>;
    /** The CURRENT stored declaration-prop values (overrides only — props keep no
     *  merged defaults; absent keys mean the declaration value). */
    propValues(): Record<string, InputValue>;
    setInput(key: string, value: InputValue): void;
    setInputs(values: Record<string, InputValue>): void;
    /** Override one declaration prop and re-run (a prop change replays the whole script). */
    setProp(key: string, value: InputValue): void;
    /** Override several declaration props at once and re-run. */
    setProps(values: Record<string, InputValue>): void;
    /**
     * Replace the script and re-run it **in place** — same `id`, same legend row, same
     * pane placement, same handle; the seam for a host editor's "run my edit" and for a
     * library's "update to the new version". The new source is prepared first: only once
     * it compiles is the running script stopped and the new one started. Until the new
     * code's first run has landed, a failure — at compile time or at run time — puts the
     * previous code back, with its input and prop values, and reports through `error`; the
     * visuals on the chart are never dropped in between.
     *
     * An edited input or prop value survives where the new script still declares its key;
     * a value still at its old declared default takes the NEW default, and anything else
     * takes the new declaration default — all before the first run, so the new code
     * computes once, with its final values.
     *
     * Resolves once the new code's first run has landed (`{ ok: true }`), or with
     * `{ ok: false, error }` after a failure. A HIDDEN indicator resolves as soon as the
     * source has compiled — it computes nothing until shown. An unchanged source resolves
     * at once; a call superseded by a later one resolves with that later call's outcome.
     * Never rejects; a native indicator resolves `ok: false`.
     */
    updateCode(source: string): Promise<CodeUpdateResult>;
    /**
     * Hide or show the indicator. Hiding **suspends** it — its visuals are dropped (the legend
     * row stays, marked hidden) and its computation stops (the engine session is torn down), so a
     * hidden indicator consumes no resources. Showing re-runs it over the current bars.
     */
    setVisible(visible: boolean): void;
    /**
     * Move (or merge) this indicator to another pane: the main price pane (`'price'`),
     * an existing pane (`{ pane: id }`), or a fresh pane (`{ newPane: {...} }`, optionally
     * placed relative to an existing pane). Merging into a pane it doesn't own gives it its
     * own scale column. No-op (with a warning) on a renderer without pane management.
     */
    moveTo(target: MoveTarget): void;
    on<K extends keyof IndicatorEventMap>(event: K, handler: (payload: IndicatorEventMap[K]) => void): () => void;
    /**
     * Read-only snapshot of the engine's execution context (variables, plots, the
     * script's return value…). Resolves null when the engine lacks the capability or
     * nothing has run yet. Always a copy — never a live reference. `select` limits the
     * extracted keys (keeps worker transfers small). Re-pull on `'context:changed'`.
     */
    context(select?: ContextSelect): Promise<EngineContextSnapshot | null>;
    remove(): void;
}

/** A symbol resolved to a registered provider. */
interface Resolved {
    /** Registered provider name (normalized — lower-case). */
    provider: string;
    /** Ticker the provider expects (any `provider:` prefix stripped, any `.ext` kept). */
    ticker: string;
}
/** The parts of a raw symbol string. */
interface ParsedSymbol {
    /** Lower-cased provider segment, or null when the symbol is bare. */
    provider: string | null;
    /** Everything after the `provider:` prefix (includes any `.ext`). */
    ticker: string;
    /** Best-effort trailing `.ext` token (provider-defined, never used for routing). */
    ext?: string;
}

/**
 * The chart's data control surface (`chart.data`) — the sibling of `chart.renderer`.
 * Registers market-data providers and queries the registry (resolve a symbol, list
 * providers/symbols, fetch per-symbol metadata).
 *
 * It operates on the default {@link MultiProviderFeed}. If a fully custom feed was
 * injected via `deps.dataFeed`, that feed manages its own data and the
 * registration/query methods warn + no-op (mirroring `chart.renderer.set` on an
 * unsupported feature).
 */
declare class DataControl {
    private readonly registry;
    constructor(feed: MarketDataFeed);
    /**
     * Register (or replace) a data provider under `name`. Any symbol prefixed `name:`
     * (case-insensitive), or a bare symbol the provider's index contains, routes to it.
     * Returns synchronously and is chainable: it kicks a background symbol-index build,
     * and if the chart symbol resolves through this provider the parked initial load
     * fires. Await `chart.ready()` for that load, or `chart.data.ready()` for the index.
     */
    registerProvider(name: string, provider: DataProvider): this;
    /** Remove a registered provider. */
    unregisterProvider(name: string): this;
    /** Metadata for every registered provider. */
    providers(): ProviderInfo[];
    /** Resolve a symbol string to `{ provider, ticker }`, or null if nothing serves it. */
    resolve(symbol: string): Resolved | null;
    /**
     * The DISPLAY prefix for `symbol` — the listing venue its descriptor declares
     * (`NASDAQ` for AAPL) or the resolved provider name. Null while unresolvable.
     */
    displayPrefix(symbol: string): string | null;
    /** The canonical `PREFIX:TICKER` form of `symbol`, or null while unresolvable. */
    canonicalSymbol(symbol: string): string | null;
    /**
     * The registered provider INSTANCE under `name` — the seam for EXTENDED provider
     * surfaces: a provider may implement interfaces beyond the `DataProvider` port
     * (extra data kinds, venue-specific APIs); consumers retrieve the instance and
     * narrow it with their own type guard. Returns undefined if the name is unknown
     * (or a custom `deps.dataFeed` bypasses the registry).
     */
    providerInstance(name: string): DataProvider | undefined;
    /** Indexed symbols for one provider (or all) — for autocomplete. */
    symbols(provider?: string): SymbolDescriptor[];
    /** The icon URL for `symbol` — its owning provider's `resolveSymbolIcon`, routed
     *  through resolution. Undefined while unresolvable, when the provider declares no
     *  resolver, or on a custom `deps.dataFeed` — the shells then show initials. */
    symbolIcon(symbol: string): string | undefined;
    /** Per-symbol metadata (Pine `syminfo.*`), resolved through the owning provider. */
    symbolInfo(symbol: string): Promise<SymbolInfo | undefined>;
    /**
     * The full resolved capabilities for `symbol` — per-instrument when the provider refines
     * them (`capabilitiesFor`), else its provider-wide declaration. Null while nothing
     * resolves the symbol (a provider may still be registering), so callers that can act
     * later should re-read rather than latch the first answer.
     */
    capabilities(symbol: string): ProviderCapabilities | null;
    /** Resolves when every registered provider's eager index has settled. */
    ready(): Promise<void>;
}

/**
 * The renderer-neutral visual parts a native indicator emits each compute — a subset of
 * {@link import('../model/indicator').IndicatorModel}. The orchestrator wraps this into a full
 * model (stamping id / pane / native tag), so the native path reuses the entire mount → legend →
 * settings → patch pipeline. (A native indicator with a *bespoke* renderer layer — e.g. the volume
 * columns — instead pushes its payload through the dedicated renderer seam, `pushData`.)
 */
interface NativeIndicatorOutput {
    /**
     * Value-axis override for the pane this native OWNS (see `IndicatorModel.paneAxis`):
     * `'none'` for content that is not value-mapped, or band labels for a categorical
     * axis. Emitted per compute, so it can follow the inputs (e.g. row toggles relabel
     * the axis). Absent ⇒ the pane derives a scale from its content as usual.
     */
    paneAxis?: PaneAxis;
    series?: SeriesSpec[];
    fills?: Fill[];
    backgrounds?: Background[];
    priceLines?: PriceLine[];
    lines?: DrawingLine[];
    boxes?: DrawingBox[];
    labels?: DrawingLabel[];
    polylines?: DrawingPolyline[];
    linefills?: DrawingLinefill[];
    tables?: DrawingTable[];
}
/** Services the host gives a running native indicator. */
interface NativeIndicatorContext {
    /** This instance's indicator id — the same id its `IndicatorHandle`, `inspect()` and
     *  the pane listing report. Lets an instance name itself to host code (a picker, a
     *  hit-test) and tell itself apart from siblings of a `multiInstance` type. */
    readonly id: string;
    readonly symbol: string;
    readonly timeframe: string;
    /** Whether the chart streams live data. False during a bar replay — entering and
     *  leaving replay RESTARTS the indicator, so this never changes within one context. */
    readonly live: boolean;
    /** The chart's trading session (`'regular'` | `'extended'`); undefined = regular /
     *  no session model. A session switch reloads the market and RESTARTS the
     *  indicator, so this never changes within one context's lifetime. */
    readonly session?: string;
    /** The canonical bar array (a live accessor — always current). */
    bars(): readonly OHLCV[];
    /** Market-data access (trades / capabilities) for data-driven natives. */
    readonly data: DataControl;
    /** Push a fresh render output; the chart mounts it (first call) or patches it (subsequent). */
    emit(out: NativeIndicatorOutput): void;
    /**
     * Push a BESPOKE render payload to the renderer's native layer for this indicator's type (for a
     * native whose visuals aren't ordinary series/fills — e.g. volume/VPVR push their layer config).
     */
    pushData(data: unknown): void;
    /** Set the indicator's legend status: `'loading'` (fetching), `'live'` (live-updating), `'idle'`. */
    setStatus(status: IndicatorStatus): void;
}
/**
 * A core-computed (non-Pine) indicator instance — the compute + lifecycle behind one on-chart
 * native indicator. The orchestrator owns one per instance and drives it through these hooks; the
 * instance pushes its visuals via {@link NativeIndicatorContext.emit}. Implementations live in this
 * folder (one file per type) and self-register a {@link NativeIndicatorDescriptor}.
 */
interface NativeIndicator {
    /** Begin: compute + emit the first output. */
    start(ctx: NativeIndicatorContext, inputs: Record<string, InputValue>): void;
    /** A live tick arrived (bars changed) — recompute + emit. */
    onBars(): void;
    /** The viewport changed (scroll/zoom) — for range-aware natives (see `reactsToViewport`). */
    onViewport(range: VisibleRange): void;
    /** Settings changed — recompute + emit. */
    setInputs(inputs: Record<string, InputValue>): void;
    /** Hidden — stop timers/fetches (free resources); the instance + its state are kept for resume.
     *  Only ever called after `start` (an instance added hidden is not suspended — it is
     *  started when first shown). */
    suspend(): void;
    /** Shown again — resume + re-emit. */
    resume(): void;
    /** Removed — full teardown (clear caches, stop timers). Only ever called after `start`. */
    stop(): void;
}
/**
 * Static description + factory for a native-indicator TYPE, registered once via
 * {@link registerNativeIndicator}. The descriptor is the type (metadata + capability); `create()`
 * mints a per-instance {@link NativeIndicator}.
 */
interface NativeIndicatorDescriptor {
    readonly type: string;
    /** Full display name (picker, settings header, handle title). */
    readonly title: string;
    /**
     * Compact name for the on-chart legend chip, the settings-dialog header and the
     * object tree's indicator rows.
     * Absent ⇒ {@link title}. The picker keeps the full title either way.
     */
    readonly shortTitle?: string;
    readonly paneHint: 'price' | 'new';
    readonly overlay: boolean;
    /** Whether instances react to viewport changes (drives the orchestrator's viewport poke). */
    readonly reactsToViewport?: boolean;
    /** Marks the type as beta — surfaced in the catalog so a host "add indicator" UI can badge it. */
    readonly beta?: boolean;
    /**
     * Whether instances get in-chart chrome. Absent ⇒ a legend row like any indicator.
     * `false` ⇒ the output paints, but there is NO legend row (no title chip, no eye/gear/✕,
     * uncounted by the fold chip) and `panes.list()` does not report it — for host-owned
     * overlays (trade markers, event flags) whose on/off lives in the host's own UI. Distinct
     * from hidden: a legend-less indicator still computes and paints; the host controls it
     * through its handle.
     */
    readonly legend?: boolean;
    /**
     * Allow several instances of this type on one chart — every add creates a new one (a study
     * like a moving average is typically stacked at different lengths). Absent ⇒ SINGLE instance
     * per type: a second add returns the existing handle. A type that paints through a renderer
     * layer (`pushData`) gets ONE layer instance per indicator instance, each fed by that
     * instance's own channel and painting on that instance's pane — so instances never
     * overwrite each other (see `IndicatorModel.native.channel`).
     */
    readonly multiInstance?: boolean;
    inputsSchema(): InputSchema[];
    defaultInputs(): Record<string, InputValue>;
    create(): NativeIndicator;
    /**
     * Whether this native indicator applies to `symbol` (a type may need a provider capability).
     * Absent ⇒ always supported. Used to gate auto-add + an "add native indicator" menu.
     */
    isSupported?(symbol: string, data: DataControl): boolean | Promise<boolean>;
}
/**
 * One entry in the "add native indicator" catalog: the type's static metadata plus its live state
 * on a specific chart — whether it applies to the current symbol (`supported`) and whether at
 * least one instance is already present (`present`). Produced by
 * `chart.availableNativeIndicators()`.
 */
interface NativeIndicatorInfo {
    readonly type: string;
    readonly title: string;
    /** Applies to the current symbol (a type may need data the provider lacks). */
    readonly supported: boolean;
    /** At least one instance is on the chart. For a single-instance type a second add is a no-op;
     *  a `multiInstance` type adds another instance regardless. */
    readonly present: boolean;
    /** The type allows several instances per chart (see `NativeIndicatorDescriptor.multiInstance`). */
    readonly multiInstance?: boolean;
    /** The type is flagged beta (for a badge in the picker). */
    readonly beta?: boolean;
}
/** Register a native-indicator type so `chart.addNativeIndicator(type)` can create it. */
declare function registerNativeIndicator(descriptor: NativeIndicatorDescriptor): void;
/** Remove a registered native-indicator type (mainly for tests). */
declare function unregisterNativeIndicator(type: string): void;
/** Look up a registered native-indicator descriptor (undefined if the type isn't registered). */
declare function getNativeIndicator(type: string): NativeIndicatorDescriptor | undefined;
/** All registered native-indicator types (for a host "add native indicator" menu). */
declare function nativeIndicatorTypes(): string[];
/** All registered native-indicator descriptors (for building a catalog with metadata + capability). */
declare function nativeIndicatorDescriptors(): NativeIndicatorDescriptor[];

/**
 * Why a script computed. The distinction that matters most is `'tick'` vs `'bar'`: a tick
 * refines the bar that is still open, so its values can still move, while `'bar'` means a
 * new bar opened and everything before it is now settled. Anything that records, alerts,
 * or exports should key off `'bar'`.
 */
type ScriptRunCause = 
/** The first computation over the loaded history (also every re-computation an engine
 *  makes while a deep backfill is still landing — see {@link ScriptRun.complete}). */
'history'
/** The forming bar changed (a live tick). */
 | 'tick'
/** A new bar opened — the previous one is final. */
 | 'bar'
/** An input was edited. */
 | 'inputs'
/** The script's source was replaced in place (`handle.updateCode`). */
 | 'code'
/** The visible range moved (viewport-aware scripts only). */
 | 'viewport'
/** The chart's market changed and the script re-executed over the new bars. */
 | 'market';
/**
 * One computation of one script, as host code observes it — the payload of `script:run`
 * and what `runScript()` resolves to.
 *
 * The split is deliberate: everything FLAT and at the current bar rides the run itself,
 * while anything historical and unbounded (the trade ledger, a plot's full history) is a
 * call you make only when you need it, so a per-tick listener never ships a 5 000-row
 * ledger it will not read.
 */
interface ScriptRun {
    /** The indicator id — the same one `chart.indicators()` and the lifecycle events carry. */
    readonly id: string;
    /** The title the script DECLARED (`strategy("SMA cross")`), not a placeholder. */
    readonly title: string;
    readonly kind: 'indicator' | 'strategy';
    readonly cause: ScriptRunCause;
    /** This script's first computed run. */
    readonly first: boolean;
    /** Index of the last computed bar. */
    readonly bar: number;
    /** Open time of that bar. */
    readonly time: Millis;
    /** That bar is still open, so these values are provisional. False on a static chart
     *  and on any run computed over settled history. */
    readonly forming: boolean;
    /** The run saw the FULL requested history. False only while an engine that computes
     *  progressively is still being fed a deep backfill — a deeper run will follow. */
    readonly complete: boolean;
    /** Each named plot's value at {@link bar}; `null` marks a gap. */
    readonly plots: Readonly<Record<string, number | null>>;
    /** The script's own variables at {@link bar}, keyed by the names WRITTEN in the source.
     *  Empty for an engine that exposes none. */
    readonly vars: Readonly<Record<string, unknown>>;
    /** Broker state at {@link bar} — present iff `kind === 'strategy'` and the engine
     *  reports it. */
    readonly strategy?: StrategyState;
    /** Warnings this script has raised so far. */
    readonly warnings: readonly EngineWarning[];
    /** The strategy's round trips, closed then open. Async because the ledger is unbounded:
     *  it never rides the run. Empty for an indicator. */
    trades(): Promise<readonly StrategyTrade[]>;
    /** One plot's full history. Async for the same reason. Empty for an unknown key. */
    series(key: string): Promise<ReadonlyArray<{
        time: Millis;
        value: number | null;
    }>>;
}
/**
 * What `chart.runScript()` resolves to: the script's first run, plus the controls for the
 * indicator it put on the chart. Never rejects — a compile or runtime failure resolves
 * with `ok: false` and the indicator is removed again (no dead legend row).
 */
interface ScriptRunResult {
    ok: boolean;
    /** The first computed run on success; null on failure. */
    run: ScriptRun | null;
    /** The failure, or null. */
    error: Error | null;
    /** Follow this script's later runs. Returns an unsubscriber. No-op after a failure. */
    onUpdate(handler: (run: ScriptRun) => void): () => void;
    /** Take the script off the chart. No-op after a failure. */
    remove(): void;
}

/** Where a bar replay stands (`chart.replay.state`). */
interface ReplayState {
    /** Replay mode is on: the chart shows history up to the cursor, live updates are paused.
     *  Stays on through a timeframe/session switch while the new bars load (`cursorTime`
     *  is null until the replay resumes on them). */
    active: boolean;
    /** Bars are being revealed on a timer (`play`), as opposed to paused / stepped by hand. */
    playing: boolean;
    /** Open time (epoch ms) of the newest bar on screen; null when replay is off. */
    cursorTime: number | null;
    /** Bars still hidden to the right of the cursor. */
    remaining: number;
    /** Open time (epoch ms) of the next bar a step completes — the one forming tick by tick,
     *  else the next hidden one; null when nothing is left or replay is off. Lets a host
     *  keep several charts on one clock (see `VelaWorkspace.replay`). */
    nextTime: number | null;
    /** Delay between two updates while playing (ms) — two bars, or two ticks with {@link ReplayControl.setTicks}. */
    intervalMs: number;
}
/** Options for {@link ReplayControl.start}. */
interface ReplayStartOptions {
    /**
     * Epoch ms. The chart keeps every bar that opened at or before it and hides the rest.
     * Older than the loaded history ⇒ the history is deepened first (clamped to the
     * oldest bar the source serves).
     */
    from: number;
}
/** Why a replay ended (`replay:end`). */
type ReplayEndReason = 'stopped' | 'finished' | 'market';
/** One intrabar update of a replayed bar ({@link ReplayControl.setTicks}). */
interface ReplayTick {
    /** The price the forming candle closes at after this update. */
    price: number;
    /** The extremes traded since the previous update (default: `price`) — lets one update
     *  stand for a whole span, e.g. a lower-timeframe bar. */
    high?: number;
    low?: number;
    /** Where the candle opens — read on a bar's first update only (default: `price`). */
    open?: number;
    /** Volume traded by this update. When no tick of a bar carries one, the bar's volume
     *  is spread evenly across its ticks. */
    volume?: number;
}
/**
 * Where a replay gets the intrabar prices of a bar it is about to reveal: `bar` is the
 * stored bar, `end` the open time of the bar after it (the span the ticks cover is
 * `[bar.time, end)`), `signal` aborts when the replay moves on (seek, stop, new source).
 * Prices come oldest first. An empty list — or a failure — reveals the bar whole.
 */
type ReplayTickSource = (bar: OHLCV, opts: {
    end: number;
    signal: AbortSignal;
}) => readonly ReplayTick[] | Promise<readonly ReplayTick[]>;
/** What the chart implements behind {@link ReplayControl}. */
interface ReplayController {
    replayStart(opts: ReplayStartOptions): Promise<void>;
    replayStep(): boolean;
    replayStepUpdate(): boolean;
    replayPlay(intervalMs?: number): void;
    replayPause(): void;
    replayStop(): void;
    replayState(): ReplayState;
    replayBounds(): ReplayBounds | null;
    replaySetTicks(source: ReplayTickSource | null): void;
}
/** The open times of the oldest and newest bar a replay can start from (`chart.replay.bounds`). */
interface ReplayBounds {
    first: number;
    last: number;
}
/**
 * The chart's bar-replay control surface (`chart.replay`) — sibling of `chart.data` /
 * `chart.marks`. Rewinds the chart to a past bar and reveals the following bars one at a
 * time, by hand or on a timer, from the history already in memory (nothing is refetched).
 * Revealed bars travel the exact path of a live bar: indicators, chart-type engines and
 * the `bar` event see them as new bars — but script alerts stay quiet (a replayed bar is
 * history, not a live signal). Live updates pause for the duration; `stop()` (or
 * revealing the last bar) restores the full history and resumes them. A timeframe or
 * session switch carries the replay over to the new bars at the same point in time; a
 * symbol switch ends it.
 */
declare class ReplayControl {
    private readonly ctrl;
    constructor(ctrl: ReplayController);
    /**
     * Enter replay (or seek, when already replaying) at `opts.from`. Resolves once the
     * chart shows the rewound history — after any in-flight history load has finished.
     * Starts paused; call {@link play} or {@link step}.
     */
    start(opts: ReplayStartOptions): Promise<void>;
    /** Reveal the next bar — or, mid-way through a bar played tick by tick, complete it.
     *  Returns false when replay is off or nothing is left. */
    step(): boolean;
    /** Reveal the next UPDATE: with {@link setTicks}, the next tick of the forming bar — or
     *  the next bar opened at its first tick (once its ticks are in, if still loading);
     *  otherwise the next whole bar, like {@link step}. Returns false when nothing is left. */
    stepUpdate(): boolean;
    /** Reveal one bar (one tick, with {@link setTicks}) every `intervalMs` (default: the last
     *  interval used, else 1000). Calling it again while playing changes the pace. */
    play(intervalMs?: number): this;
    pause(): this;
    /** Leave replay: the full history comes back and live updates resume. Also cancels a
     *  `start()` still loading older history (the chart returns to its previous depth). */
    stop(): this;
    get state(): ReplayState;
    /** The loaded history a replay can walk — hidden bars included while replaying. Null
     *  before any bar loaded. A start older than `first` deepens the history first. */
    get bounds(): ReplayBounds | null;
    /**
     * Play each revealed bar as a series of intrabar updates instead of whole: while
     * playing, the forming candle opens at the first tick, then every tick moves its close
     * and stretches its high and low, exactly like a live tick — indicators, chart types
     * and the `bar` event follow — and the last one settles it on the stored bar. The play
     * interval is then the time between two TICKS: a bar lasts as many intervals as it
     * has ticks (below ~16 ms, ticks are batched per frame). The next bar's ticks are
     * requested while the current one plays; playback waits for them. `null` goes back to
     * whole bars. Takes effect from the next bar; a bar forming when the source changes
     * completes at once.
     */
    setTicks(source: ReplayTickSource | null): this;
}

/** Chart-level events emitted on `chart.on(...)`. */
interface VelaEventMap extends Record<string, unknown> {
    ready: undefined;
    /**
     * The chart's market switched IN PLACE via `setMarket` — symbol, provider, timeframe,
     * or offline data changed (a depth-only reload does not fire). Fires after the new
     * market's history is painted and every consumer restarted. `prev` carries the
     * previous identity so hosts can re-key per-symbol state (e.g. swap user-drawing
     * documents between symbols).
     */
    "market:changed": {
        symbol: string;
        timeframe: string;
        prev: {
            symbol: string;
            timeframe: string;
        };
    };
    /**
     * A bar load began with nothing painted: the FIRST load (fires during construction —
     * subscribers attached later see only its `load:end`), or an identity switch
     * (symbol/provider/timeframe), which blanks the old series in the same breath. Fires
     * before the first fetch — plugins, extensions and custom indicators hide or reset
     * their own visuals here. Exactly one `load:end` follows. A depth-only reload
     * (`bars`) keeps the chart painted and fires neither.
     */
    "load:start": {
        symbol: string;
        timeframe: string;
        firstLoad: boolean;
    };
    /**
     * The load ended: its first bars painted (`bars` > 0 — on deep histories the quick
     * preview, before the full depth), or it ended with none (`bars` = 0 — a failed
     * fetch, an empty market, or a parked symbol nothing serves). Counterpart of
     * `load:start`; plugins restore or rebuild their visuals here.
     */
    "load:end": {
        symbol: string;
        timeframe: string;
        bars: number;
    };
    "indicator:added": {
        id: string;
    };
    "indicator:removed": {
        id: string;
    };
    /** An indicator's stored input/prop VALUES changed (settings dialog, `setInputs`) — what state persistence listens to. */
    "indicator:inputs": {
        id: string;
    };
    "indicator:error": {
        id: string;
        error: Error;
    };
    /** No registered provider can serve the chart symbol — the load is PARKED, not failed:
     *  it resumes by itself if a capable provider registers later. */
    "data:unresolved": {
        symbol: string;
        providers: string[];
    };
    /** An indicator was moved/merged to another pane (`chart.panes` / legend / object tree). */
    "indicator:moved": {
        id: string;
        paneId: string;
    };
    /** An indicator was shown/hidden (legend eye, `handle.setVisible`, or object tree). */
    "indicator:visibility": {
        id: string;
        visible: boolean;
    };
    /** A pane's layout changed: order, collapse/maximize, creation or removal. */
    "pane:changed": undefined;
    /**
     * The app theme changed — `chart.setTheme(...)` or the in-chart settings dialog's
     * Canvas → Theme row. Payload is the RESOLVED theme; host chrome around the chart
     * (toolbars, panels, page shells) re-skins from it. Not fired for plot-only
     * cosmetic edits (`layout.background` through the config), which deliberately
     * leave the app theme alone.
     */
    "theme:changed": VelaTheme;
    /**
     * The base price style is switching `from` → `to` (candles, line, area, a chart-type
     * id, …). Fires synchronously BEFORE the chart repaints in the new style, whatever
     * the path: the topbar style menu, `ctx.setPriceStyle`,
     * `chart.renderer.set('priceStyle', …)`, the settings dialog, `applyConfig` and
     * config templates, or a state restore. Never fires for the style the chart was
     * created with, nor for a set to the style already shown. While it runs the chart
     * still shows `from`, so a listener can capture the outgoing frame
     * (`chart.renderer.screenshotCanvas()`) to animate the switch. Listeners must not
     * change the price style again from inside it.
     */
    "priceStyle:change": {
        from: string;
        to: string;
    };
    /** A study pane was reordered one slot (`dir`) — carries enough to invert for undo/redo. */
    "pane:moved": {
        paneId: string;
        dir: "up" | "down";
    };
    /** A user drawing was created (interactively or via `chart.drawings.add`). */
    "drawing:created": {
        id: string;
    };
    /** An interactive placement is in progress — the ghost's current shape after each
     *  anchor click / cursor move, `null` when placement ends (finalized or
     *  cancelled). Transient: nothing is in the store yet. Multi-chart hosts mirror
     *  it on linked charts via `drawings.setExternalGhost`. */
    "drawing:draft": {
        doc: SerializedDrawing | null;
    };
    /** A user drawing's anchors/style/text changed. */
    "drawing:edited": {
        id: string;
    };
    /** Selection changed. `ids` is every selected drawing in selection order; `id` is the
     *  primary (`ids[0]`, the one a settings popup edits), null when nothing is selected. */
    "drawing:selected": {
        id: string | null;
        ids: string[];
    };
    /** The favorite-tool set changed (star toggles or a bulk restore). */
    "drawing:favorites": {
        favorites: string[];
    };
    /** A tool's remembered settings changed — the ones its next drawing starts from (the last
     *  drawing of that type the user styled, a bulk restore, or a reset). Read them back with
     *  `drawings.toolDefaults()`. */
    "drawing:defaults": {
        type: DrawingTypeKey;
    };
    /** A tool's saved looks changed (saved, deleted, or a bulk restore) — read them back with
     *  `drawings.toolTemplates()`. */
    "drawing:templates": {
        type: DrawingTypeKey;
    };
    /** The armed drawing tool changed — toolbar click, one-shot tool finishing (back to
     *  the pointer, `null`), or a programmatic `drawings.setTool`. */
    "drawing:tool": {
        type: DrawingTypeKey | null;
    };
    /** The magnet snap mode changed (in-chart toolbar or `drawings.setSnapMode`). */
    "drawing:snap": {
        mode: SnapMode;
    };
    /** Stay-in-drawing-mode changed (in-chart toolbar or `drawings.setStayMode`) — when
     *  on, finishing a drawing leaves the tool armed. */
    "drawing:stay": {
        on: boolean;
    };
    /** The renderer-local mode changed: measure ruler, eraser, or none — including the
     *  mutual-exclusion exits (arming a tool leaves measure/eraser). */
    "drawing:mode": {
        mode: DrawingMode;
    };
    /** A user drawing was removed. */
    "drawing:removed": {
        id: string;
    };
    /** The user requested a drawing's settings popup. */
    "drawing:settings": {
        id: string;
    };
    /** A timeline-mark glyph was clicked — `ids` lists every mark under it (a cluster). Fires
     *  before the popup opens; a mark without content opens none, so this is the host's hook. */
    "mark:click": MarkClickEvent;
    /**
     * A SCRIPT computed — the first run over the history, a live tick, a new bar, an input
     * edit, a viewport move, a market switch. The payload carries the run itself (title,
     * cause, the plots/variables/broker state at the computed bar), so a listener reads it
     * directly instead of resolving a handle and pulling a snapshot. Throttled to ~1/s per
     * indicator while streaming, and only emitted for engines that expose an execution
     * context. Native (core-computed) indicators never fire it — they run no script.
     */
    "script:run": ScriptRun;
    /** An indicator's execution context advanced (run finished, or throttled during
     *  streaming) — re-pull `handle.context()` if you consume it. Prefer `script:run`,
     *  which delivers the data rather than a signal to go fetch it. */
    "context:changed": {
        id: string;
    };
    /** A live tick: the forming bar was updated or a new bar appended (a bar revealed by replay included). */
    bar: OHLCV;
    /**
     * The visible time range moved (pan/zoom/fit — fires per applied change, NOT
     * debounced; the engine re-run debounce is separate). Payload = `{from, to}` in
     * epoch-ms. The seam viewport-sync links between charts build on.
     */
    "viewport:changed": {
        from: number;
        to: number;
    };
    /** A deep-history backfill chunk landed (`loaded` of `target` bars are on the chart). */
    "history:progress": {
        loaded: number;
        target: number;
    };
    /**
     * The history load finished: `'depth'` = the requested bar count is loaded, `'genesis'` =
     * the source has nothing older (full available history), `'aborted'` = a fetch failed or
     * the data was non-monotonic — the chart keeps what loaded. Fires exactly once, including
     * for small/offline charts (immediately after their single load).
     */
    "history:complete": {
        reason: "depth" | "genesis" | "aborted";
        oldestTime: number;
        barsLoaded: number;
    };
    /** Replay mode began (or seeked): the chart shows history up to `cursorTime`, `remaining` bars are hidden. */
    "replay:start": {
        cursorTime: number;
        remaining: number;
    };
    /** One hidden bar was revealed (it also fires `bar`, like a live bar). A bar played tick
     *  by tick steps once, when its last tick settles it. */
    "replay:step": {
        cursorTime: number;
        remaining: number;
    };
    /** An intrabar update of the bar forming at `cursorTime` (`chart.replay.setTicks`):
     *  tick `index` of `count` is applied (batched updates report the last one). */
    "replay:tick": {
        cursorTime: number;
        index: number;
        count: number;
    };
    /** Timed reveal started, or its pace changed. */
    "replay:play": {
        intervalMs: number;
    };
    /** Timed reveal paused — `pause()`, or a seek (`start()` while playing). */
    "replay:pause": undefined;
    /**
     * Replay mode ended: `'stopped'` = `chart.replay.stop()`, `'finished'` = the last hidden
     * bar was revealed, `'market'` = a symbol switch replaced the history (a timeframe or
     * session switch carries the replay over instead). The full history
     * is back and live updates resumed.
     */
    "replay:end": {
        reason: ReplayEndReason;
    };
    /** An indicator's script raised an alert. `indicator` names the source — the
     *  indicator's display title (what its legend row shows). Never fires for bars a
     *  replay reveals (`chart.replay`). */
    alert: EngineAlert & {
        indicator?: string;
    };
    warning: EngineWarning;
}

/**
 * A renderer-agnostic count of the graphic elements one indicator generated — the
 * deterministic oracle signal. It confirms the core *produced* the elements (engine +
 * model mapping), independent of any renderer. Whether a renderer actually *drew* them
 * is a separate (visual) check.
 */
interface IndicatorSummary {
    id: string;
    title: string;
    overlay: boolean;
    paneId?: string;
    /** A native (core-computed) indicator, and its type — absent/false for a Pine indicator. */
    native: boolean;
    nativeType?: string;
    /** Value-series counts keyed by kind (line/area/step/histogram/columns/circles/cross/candle/bar/markers). */
    series: Record<string, number>;
    fills: number;
    backgrounds: number;
    priceLines: number;
    lines: number;
    boxes: number;
    labels: number;
    polylines: number;
    linefills: number;
    tables: number;
    barColors: number;
    trades: number;
    inputs: number;
    /** Elements flagged `force_overlay` (routed to the price pane), across every kind. */
    forcedOverlay: number;
}
/** A snapshot of everything the Vela core has generated for the mounted indicators. */
interface SceneInspection {
    indicators: IndicatorSummary[];
    /** Sums across all indicators, for convenient whole-scene assertions. */
    totals: {
        panes: number;
        series: number;
        fills: number;
        backgrounds: number;
        priceLines: number;
        lines: number;
        boxes: number;
        labels: number;
        polylines: number;
        linefills: number;
        tables: number;
        barColors: number;
        trades: number;
        forcedOverlay: number;
    };
}

/**
 * The public control surface for the active renderer — `chart.renderer`. A thin
 * facade over the renderer port: get/set/inspect render features without exposing
 * the internal orchestration methods (`setBars`, `mountIndicator`, …). A key the
 * active renderer doesn't support warns in the console and is ignored — the chart
 * is never touched.
 */
declare class RendererControl {
    private readonly renderer;
    constructor(renderer: IChartRenderer);
    /** The active renderer's identity, e.g. `'native'` or `'lwc'`. */
    get name(): string;
    /** What the active renderer can draw (drives graceful degradation). */
    get capabilities(): RendererCapabilities;
    /** Whether the active renderer supports a feature — use to show/hide a UI control. */
    supports(feature: string): boolean;
    /** Read a feature's current value (`undefined` if unsupported). */
    get(feature: string): unknown;
    /**
     * Set one feature (`set('glow', 0.6)`) or several at once
     * (`set({ logScale: true, upColor: '#fff' })`). A key the active renderer does
     * not support emits a console warning and is ignored, with no effect on the UI.
     */
    set(feature: string | Record<string, unknown>, value?: unknown): this;
    /**
     * Wire the legend rows' HOST-CONTRIBUTED actions (the shells route the plugin
     * registry through this; see `registerLegendAction`). Silent on a renderer without
     * the seam — contributed legend actions simply never show there, same graceful
     * degradation as the sync ghost crosshair.
     */
    setLegendActions(provider: ((indicatorId: string) => LegendActionView[]) | null): void;
    /**
     * Wire the legend rows' HOST-CONTRIBUTED callout bubbles (the shells route the
     * plugin registry through this; see `registerLegendCallout`). Silent on a renderer
     * without the seam — contributed callouts simply never show there, same graceful
     * degradation as {@link setLegendActions}.
     */
    setLegendCallouts(provider: ((indicatorId: string) => LegendCalloutView[]) | null): void;
    /**
     * Replace the indicator legend's fold toggle with a host action (or restore it with
     * `null`) — multi-chart shells point the chip at their indicator overview instead of
     * unfolding rows in place. Silent no-op on a renderer without a foldable legend.
     */
    setLegendOverviewAction(action: (() => void) | null): this;
    /** Whether the active renderer can open a per-indicator settings dialog. */
    get supportsIndicatorSettings(): boolean;
    /**
     * Open one indicator's settings dialog — the programmatic twin of the legend gear
     * (see {@link supportsIndicatorSettings}). Silent no-op without the seam or for an
     * unknown id.
     */
    openIndicatorSettings(indicatorId: string): this;
    /**
     * Export the current chart as a PNG data URL, or null if the active renderer
     * doesn't support it (warns). DOM overlays (tables, legend) are not included.
     */
    screenshot(): string | null;
    /**
     * Raster of the current chart onto a canvas (same pixels as {@link screenshot}),
     * or null if the renderer has no canvas export. Silent — a host compositing
     * several charts skips a renderer that cannot contribute.
     */
    screenshotCanvas(): HTMLCanvasElement | null;
    /**
     * The active renderer's full cosmetic config as a serializable, versioned JSON
     * document — persist it (templates, saved settings) and feed it back to
     * `applyConfig`. Returns null if the renderer has no rich config (warns).
     */
    getConfig(): unknown;
    /**
     * Apply a (possibly partial) config document from `getConfig()` — load a template
     * or restore saved settings. Malformed/unknown fields are ignored; no indicator
     * re-run. No-ops with a warning if the renderer has no rich config.
     */
    applyConfig(config: unknown): this;
    /**
     * Subscribe to cosmetic-config changes (`applyConfig` — the in-chart settings dialog
     * commits through it). Host chrome that mirrors a config value (a bottom-bar timezone)
     * re-pulls {@link get}/{@link getConfig} here. Silent no-op unsubscribe on a renderer
     * without a rich config.
     */
    onConfigChanged(cb: () => void): Unsubscribe;
    /**
     * Subscribe to crosshair movement — `time`/`price` under the cursor, per-series values,
     * and the hovered bar's OHLC (null fields when the cursor leaves the chart). This is the
     * public seam host chrome (status lines, data windows) builds on.
     */
    onCrosshairMove(cb: (e: CrosshairEvent) => void): Unsubscribe;
    /** A click — or a touch tap — on the plot, never the end of a pan: the open time of
     *  the bar under it (`null` off the bars). On touch, where a tap moves no crosshair,
     *  this is how an interaction learns which bar was chosen. */
    onClick(cb: (e: ClickEvent) => void): Unsubscribe;
    /** Touch long-press on a price or time axis strip — silent no-op without the seam. */
    onAxisLongPress(cb: (e: AxisLongPressEvent) => void): Unsubscribe;
    /**
     * The current data-window readout — the hovered bar's date/time and OHLCV plus every
     * indicator's value there, each already formatted on its pane's scale (the latest bar when
     * the cursor is off the plot). Pair it with {@link onCrosshairMove} to drive a data-window
     * panel. Null on a renderer that doesn't provide the readout.
     */
    dataWindowReadout(): DataWindowReadout | null;
    /**
     * Wire (or clear with `null`) the host's symbol picker for the settings dialog's `input.symbol`
     * control — the host opens its own ticker-selection UI and reports the chosen symbol back.
     * No-ops with a warning if the active renderer doesn't support it (only the native renderer does).
     */
    setSymbolPicker(picker: SymbolPickerFn | null): this;
    /**
     * Move keyboard focus back onto the chart's interactive surface — call after a host
     * control (a shared toolbar button) stole focus, so chart/drawing shortcuts keep
     * working. Silent no-op on a renderer without a focusable surface.
     */
    focus(): this;
    /** Whether the active renderer can display an EXTERNAL (synced) crosshair. */
    get supportsExternalCrosshair(): boolean;
    /**
     * Show (or clear, with `null`) a data-space ghost crosshair driven from OUTSIDE
     * this chart — the multi-chart crosshair-sync seam. Silent no-op on a renderer
     * without the capability (see {@link supportsExternalCrosshair}).
     */
    setExternalCrosshair(time: number | null, price?: number | null): this;
    /**
     * Close any in-chart dialogs the active renderer owns (indicator settings, chart-settings
     * gear) — for keeping host dialogs mutually exclusive with the renderer's. Silent no-op if
     * the renderer has no such dialogs; safe to call speculatively.
     */
    closeDialogs(): this;
    /**
     * Open (or toggle) the renderer's in-chart settings dialog — silent no-op without one.
     * Pass a section title (e.g. `'Canvas'`) to land on that tab; an unknown one opens the
     * dialog on its first tab, and with a section an open dialog switches tab instead of closing.
     */
    openSettings(section?: string): this;
    /** Contribute host settings tabs (callback rows) to the renderer's settings dialog —
     *  e.g. the widget's Status line toggles. Silent no-op without a dialog. */
    setSettingsSections(sections: ReadonlyArray<{
        title: string;
        rows: readonly unknown[];
        id?: string;
    }>): this;
    /**
     * Set the settings-dialog visibility policy: `hidden` lists setting ids to hide —
     * a tab (`'canvas'`), a group (`'canvas.grid'`), or a single row
     * (`'canvas.grid.vertical'`); an id hides its whole subtree, and a tab with nothing
     * left disappears from the rail. Presentation-only: hidden values keep being stored
     * and applied (e.g. hide `'advanced'` while forcing the widget's `bars` option).
     * Seeded from `VelaOptions.settings`; silent no-op without a settings dialog.
     */
    setSettingsVisibility(policy: {
        hidden?: readonly string[];
    }): this;
    /** Every addressable setting id of this chart (built-in tabs/groups/rows, chart-type
     *  sections, host sections) — enumerate these to build a `hidden` list instead of
     *  reading contributor source. Empty on a renderer without a settings dialog. */
    listSettingsIds(): string[];
    /** Tell the renderer's own chrome which size class the host shell is in —
     *  `'mobile'` switches its dialogs/toolbars to the touch-first presentation.
     *  Silent no-op on a renderer without adaptive chrome. */
    setLayoutMode(mode: 'mobile' | 'desktop'): this;
    /**
     * Drive the renderer's time-of-day chrome (the countdown-to-bar-close chip) from the
     * host's own second pulse, so it ticks in step with a host clock display instead of
     * on a separate timer that can read a different second. `null` hands the pulse back
     * to the renderer. Silent no-op on a renderer without time-of-day chrome.
     */
    setWallClock(clock: WallClock | null): this;
}

/** Callback surface `PanesControl` uses to drive the orchestrator. */
interface PaneController {
    /** Whether the active renderer supports pane management (move/merge/reorder/collapse). */
    paneManagementSupported(): boolean;
    listPanes(): PaneInfo[];
    movePane(paneId: string, dir: 'up' | 'down'): void;
    removePaneAndIndicators(paneId: string): void;
    collapsePane(paneId: string, collapsed: boolean): void;
    maximizePane(paneId: string | null): void;
    moveIndicator(id: string, target: MoveTarget): void;
}
/**
 * The public pane control surface — `chart.panes`. Lists panes with their indicators
 * and moves/merges/reorders/collapses/maximizes them. On a renderer without pane
 * management every mutation warns and no-ops (and `list()` still reports the panes).
 */
declare class PanesControl {
    private readonly controller;
    constructor(controller: PaneController);
    /** Whether the active renderer supports pane management (use to show/hide host UI). */
    get supported(): boolean;
    /** The current panes (top-to-bottom by `order`) with the indicators each holds. */
    list(): PaneInfo[];
    /** Move a pane one slot up or down in the stack (the price pane stays pinned on top). */
    move(paneId: string, dir: 'up' | 'down'): this;
    /** Remove a pane and every indicator in it (the price pane can't be removed). */
    remove(paneId: string): this;
    /** Collapse a pane to a thin strip, or restore it. */
    collapse(paneId: string, collapsed?: boolean): this;
    /** Maximize one pane to fill the plot, or restore the split (`null`). */
    maximize(paneId: string | null): this;
    /** Move/merge an indicator to a pane — sugar for `handle.moveTo(...)` by id. */
    moveIndicator(id: string, target: MoveTarget): this;
    private guard;
}

type EventHandler<T> = (payload: T) => void;
/** Minimal typed pub/sub. Handler errors are isolated (logged, never thrown). */
declare class TypedEventBus<Events extends Record<string, unknown>> {
    private readonly handlers;
    on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void;
    off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void;
    /** Whether anyone is listening — lets an emitter skip building an expensive payload. */
    hasListeners<K extends keyof Events>(event: K): boolean;
    emit<K extends keyof Events>(event: K, payload: Events[K]): void;
    clear(): void;
}

/** Versioned persistence envelope for a chart's user drawings. */
interface DrawingsDocument {
    version: 1;
    drawings: SerializedDrawing[];
}

/** Optional seed for a programmatic {@link DrawingController.add}. */
interface AddInit {
    paneId?: string;
    anchors?: SerializedDrawing['anchors'];
    style?: Partial<SerializedDrawing['style']>;
    text?: SerializedDrawing['text'];
    /** Per-type extras (e.g. a glyph stamp's `glyph`, a fib tool's `levels`). */
    props?: SerializedDrawing['props'];
    /** Draw-order key. Defaults to just under the pane's price on a renderer with
     *  `drawingDepth` — the candles read on top of a fresh drawing; pass an explicit key
     *  for any other slot in the stack. */
    zIndex?: number;
}
/**
 * Renderer-agnostic owner of the user-drawing model + tool/selection state. Holds
 * the {@link DrawingStore} (source of truth), pushes snapshots to the renderer
 * through {@link IDrawingsRendererPort}, and turns renderer intents into store
 * mutations + `drawing:*` events. Inert (but persistence still works) when the
 * active renderer lacks `userDrawings` — that's the LwC path.
 */
declare class DrawingController {
    private readonly events;
    private readonly store;
    private readonly history;
    private readonly port;
    private readonly enabled;
    private activeTool;
    /** Mirror of the renderer's sticky magnet mode (the renderer default is 'off'). */
    private snapMode;
    /** When on, finishing a drawing leaves the tool armed (instead of one-shot disarm). */
    private stayInDrawingMode;
    /** Mirror of the renderer-local mode (measure/eraser/none). */
    private mode;
    /** FAVORITE tool types (insertion-ordered) — user prefs, not document data. */
    private favs;
    private selectedIds;
    private clipboard;
    /** Per-tool remembered settings — the last drawing of each type the user styled seeds the next. */
    private readonly defaults;
    /** Per-tool saved looks ("styles"), in the order they were saved. */
    private templates;
    private readonly subs;
    constructor(renderer: IChartRenderer, events: TypedEventBus<VelaEventMap>, option: DrawingsOption | undefined, seriesGateway?: DrawingSeriesGateway);
    /** Whether the active renderer supports interactive drawings. */
    get supported(): boolean;
    setTool(type: DrawingTypeKey | null): void;
    getTool(): DrawingTypeKey | null;
    getSnapMode(): SnapMode;
    setSnapMode(mode: SnapMode): void;
    getStayMode(): boolean;
    setStayMode(on: boolean): void;
    getMode(): DrawingMode;
    setMode(mode: DrawingMode): void;
    showToolbar(visible: boolean): void;
    /** The favorite tool types, in the order they were starred. */
    favorites(): DrawingTypeKey[];
    isFavorite(type: DrawingTypeKey): boolean;
    /** Star/unstar one tool. Unknown types are ignored; no-ops don't emit. */
    setFavorite(type: DrawingTypeKey, on: boolean): void;
    /** Replace the whole favorite set (bulk restore) — unknown types are dropped. */
    setFavorites(types: readonly DrawingTypeKey[]): void;
    private pushFavorites;
    /** Every tool's remembered settings, by type (plain JSON — persist it as-is). */
    toolDefaults(): Partial<Record<DrawingTypeKey, DrawingToolDefaults>>;
    /** Replace every tool's remembered settings (restoring persisted prefs). Unknown types and
     *  malformed entries are dropped; an unchanged set is a no-op and emits nothing. */
    setToolDefaults(map: Readonly<Record<string, unknown>> | null | undefined): void;
    /** Forget a tool's remembered settings (every tool's when `type` is omitted) — new drawings
     *  start from the factory defaults again. */
    resetToolDefaults(type?: DrawingTypeKey): void;
    /** Every tool's saved looks, by type (plain JSON — persist it as-is). */
    toolTemplates(): Partial<Record<DrawingTypeKey, DrawingToolTemplate[]>>;
    /** Replace every tool's saved looks (restoring persisted prefs). Unknown types and
     *  malformed entries are dropped; an unchanged set is a no-op and emits nothing. */
    setToolTemplates(map: Readonly<Record<string, unknown>> | null | undefined): void;
    /** Save the given settings as a named look for a tool (a same-named one is replaced). */
    saveToolTemplate(type: DrawingTypeKey, name: string, settings: DrawingToolDefaults): void;
    /** Delete a tool's saved look by name. */
    removeToolTemplate(type: DrawingTypeKey, name: string): void;
    private pushTemplates;
    setToolbar(option: DrawingsOption): void;
    /** Display (or clear) another chart's in-progress placement as a ghost — silently
     *  inert on a renderer without the optional `setExternalGhost` seam. */
    setExternalGhost(doc: SerializedDrawing | null): void;
    /** Push per-tool shortcut hints (pre-formatted display strings) to the toolbar flyouts. */
    setToolShortcuts(map: Readonly<Partial<Record<DrawingTypeKey, string>>>): void;
    add(type: DrawingTypeKey, init?: AddInit): Drawing | null;
    remove(id: string): void;
    /** Apply a partial record to a drawing (headless write-back from a custom UI). */
    update(id: string, patch: Partial<SerializedDrawing>): void;
    /** Apply several partial records as ONE undo step (e.g. hiding/locking/reordering a group). */
    updateMany(patches: ReadonlyArray<{
        id: string;
        patch: Partial<SerializedDrawing>;
    }>): void;
    /** Delete several drawings as ONE undo step (the public face of {@link deleteMany}). */
    removeMany(ids: readonly string[]): void;
    setLocked(id: string, v: boolean): void;
    setVisible(id: string, v: boolean): void;
    bringToFront(id: string): void;
    sendToBack(id: string): void;
    /** The top of the pane's series stack — what a front drawing has to clear. 0 when the
     *  renderer keeps drawings on their own layer (no shared z space). */
    private seriesTopZ;
    /** The bottom of the pane's series stack — what a backmost drawing has to undercut. */
    private seriesBottomZ;
    /** Where a NEW drawing starts: just under the pane's price so the candles read on top of it
     *  (falling back to just under the pane's top series where there is no price — a study
     *  pane). Half a key down never ties a series; drawings tying each other paint in insertion
     *  order, so consecutive new drawings still stack newest-in-front. Undefined without a
     *  shared z space — the store then places it over the other drawings, its own layer's top.
     *  A type that COVERS the series (an opaque inset, `coversSeries`) instead starts just
     *  above the whole stack — under the candles its content would be buried. */
    private startZ;
    /** Programmatically select drawings (host UI → chart): shows the on-chart handles + toolbar.
     *  `additive` toggles membership (matching shift-click) instead of replacing. */
    select(ids: readonly string[], additive?: boolean): void;
    /** Open a drawing's on-chart settings popup (and select it) — a click on it, driven from a host UI. */
    openSettings(id: string): void;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Duplicate drawings in place (clones land on the source, auto-selected → "duplicate then drag"). */
    duplicate(ids: readonly string[]): Drawing[];
    clone(id: string): Drawing | null;
    /** Copy drawings into the in-memory clipboard (no model change, no event). */
    copy(ids: readonly string[]): void;
    paste(): Drawing[];
    all(): SerializedDrawing[];
    toJSON(): DrawingsDocument;
    fromJSON(doc: unknown): void;
    destroy(): void;
    /** Set/extend the selection. `additive` toggles membership (shift-click) vs replacing it. */
    private setSelection;
    /** Push the selection to the renderer and announce it (primary + the full list). */
    private announceSelection;
    /** Restore a history snapshot, reconciling selection against what survived. */
    private restoreSnapshot;
    /** Delete drawings as one undo step; prune them from the selection. */
    private deleteMany;
    /** Add clones (fresh ids, fresh mount-order z) as one undo step + select them. */
    private insertClones;
    private resolve;
    /** `store.update` that remembers the drawing's settings only when the patch changed them:
     *  moving an older drawing must not hand its look back to the tool. */
    private updateDrawing;
    /** Remember a drawing's settings as its tool's defaults (they seed the next one), and
     *  announce a real change so a host can save it. */
    private captureDefaults;
    private sync;
    /** Renderer gesture → authoritative store mutation + event. */
    private onIntent;
}

/**
 * The chart's drawing control surface (`chart.drawings`) — sibling of
 * `chart.data` / `chart.renderer`. Activate tools, create/mutate drawings
 * programmatically, and persist them. Always present; on a renderer without the
 * `userDrawings` capability the interactive methods warn + no-op (the
 * {@link DataControl} pattern), while `toJSON`/`fromJSON`/`all` still round-trip
 * because the model is core-owned.
 */
declare class DrawingsControl {
    private readonly ctrl;
    constructor(ctrl: DrawingController);
    /** Whether the active renderer supports interactive drawings. */
    get supported(): boolean;
    /** Arm a tool — the next click(s) place it. `null` returns to select/idle. */
    setTool(type: DrawingTypeKey | null): this;
    /** The currently armed tool (`null` = select/idle). Mirrors in-chart toolbar clicks
     *  and one-shot tools disarming — listen on `drawing:tool` to follow changes. */
    getTool(): DrawingTypeKey | null;
    /** Set the sticky magnet snap mode (`'off' | 'weak' | 'strong'`). */
    setSnapMode(mode: SnapMode): this;
    /** The current magnet snap mode — follow changes on `drawing:snap`. */
    getSnapMode(): SnapMode;
    /** Keep the armed tool after each placement (`true`) or one-shot disarm (`false`). */
    setStayMode(on: boolean): this;
    /** Whether tools stay armed after placement — follow changes on `drawing:stay`. */
    getStayMode(): boolean;
    /** Enter/exit a renderer-local mode: `'measure'` (transient ruler), `'eraser'`, or
     *  `null` (none). Mutually exclusive with each other and with any armed tool — the
     *  renderer enforces the exclusion and the outcome lands on `drawing:mode`. */
    setMode(mode: DrawingMode): this;
    /** The current renderer-local mode — follow changes on `drawing:mode`. */
    getMode(): DrawingMode;
    /** Show or hide the on-chart drawing toolbar. */
    showToolbar(visible?: boolean): this;
    /** Reconfigure the toolbar groups/tools live. */
    setToolbar(option: DrawingsOption): this;
    /** Show per-tool shortcut hints in the toolbar flyouts. Values are PRE-FORMATTED
     *  display strings (e.g. `'Alt+T'`, `'⌥T'`) — the host owns the keymap and the
     *  platform formatting, so hints always match the host's actual bindings. */
    setToolShortcuts(map: Readonly<Partial<Record<DrawingTypeKey, string>>>): this;
    /** Display another chart's in-progress placement as a GHOST at reduced opacity
     *  (`null` clears it) — how a multi-chart host mirrors `drawing:draft` onto linked
     *  charts. Never a real drawing: no store entry, no selection, no persistence.
     *  Silently inert on a renderer without the optional seam. */
    setExternalGhost(doc: SerializedDrawing | null): this;
    /** Create a drawing programmatically (no clicking). Returns it, or null if unsupported. */
    add(type: DrawingTypeKey, init?: AddInit): Drawing | null;
    remove(id: string): this;
    /** Apply a partial record to a drawing — for a custom (headless) settings UI. */
    update(id: string, patch: Partial<SerializedDrawing>): this;
    /** Apply several partial records as one undo step (group hide/lock/reorder from a host UI). */
    updateMany(patches: ReadonlyArray<{
        id: string;
        patch: Partial<SerializedDrawing>;
    }>): this;
    /** Remove several drawings as one undo step. */
    removeMany(ids: readonly string[]): this;
    lock(id: string, v?: boolean): this;
    show(id: string, v?: boolean): this;
    /** Select drawings on the chart (highlight + open their toolbar) — for a host-side tree/list.
     *  Pass `null` or `[]` to clear the selection. */
    select(ids: string | readonly string[] | null): this;
    /** Open a drawing's settings popup on the chart (selecting it) — the twin of clicking it. */
    openSettings(id: string): this;
    bringToFront(id: string): this;
    sendToBack(id: string): this;
    /** Revert the last edit. No-op when there is nothing to undo. */
    undo(): this;
    /** Re-apply the last undone edit. No-op when there is nothing to redo. */
    redo(): this;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Duplicate a drawing in place; the clone is selected. Returns this (chainable). */
    clone(id: string): this;
    /** Duplicate several drawings in place; the clones become the selection. */
    duplicate(ids: string[]): this;
    /** Copy drawings into the in-memory clipboard for a later {@link paste}. */
    copyToClipboard(ids: string[]): this;
    /** Paste the clipboard as new drawings (fresh ids), selecting them. */
    paste(): this;
    /** Every drawing as plain JSON, in paint order. */
    all(): SerializedDrawing[];
    /** Snapshot all drawings as a versioned document (persistence). */
    toJSON(): DrawingsDocument;
    /** Restore drawings from a document produced by {@link toJSON} (untrusted-safe). */
    fromJSON(doc: unknown): this;
    /** The favorite tool types (starred in the toolbar flyouts), insertion-ordered. */
    favorites(): DrawingTypeKey[];
    isFavorite(type: DrawingTypeKey): boolean;
    /** Star/unstar one tool type. */
    setFavorite(type: DrawingTypeKey, on: boolean): this;
    /** Replace the whole favorite set (e.g. restoring persisted prefs). */
    setFavorites(types: readonly DrawingTypeKey[]): this;
    /** Every tool's remembered settings, by type — what the next drawing of each type starts
     *  from (its style, text styling and per-type settings such as fib levels). Plain JSON:
     *  persist it and hand it back to {@link setToolDefaults} on the next load. */
    toolDefaults(): Partial<Record<DrawingTypeKey, DrawingToolDefaults>>;
    /** Replace every tool's remembered settings (e.g. restoring persisted prefs). Malformed
     *  entries and unknown types are dropped. Follow changes on `drawing:defaults`. */
    setToolDefaults(map: Readonly<Record<string, unknown>>): this;
    /** Forget one tool's remembered settings (every tool's without an argument). */
    resetToolDefaults(type?: DrawingTypeKey): this;
    /** Every tool's saved looks ("styles" in the settings panel), by type. Plain JSON —
     *  persist it and hand it back to {@link setToolTemplates}. */
    toolTemplates(): Partial<Record<DrawingTypeKey, DrawingToolTemplate[]>>;
    /** Replace every tool's saved looks (e.g. restoring persisted prefs). Follow changes on
     *  `drawing:templates`. */
    setToolTemplates(map: Readonly<Record<string, unknown>>): this;
    /** Aliases mirroring `renderer.getConfig()/applyConfig()` for symmetry. */
    getConfig(): DrawingsDocument;
    applyConfig(doc: unknown): this;
    private ok;
}

/**
 * Renderer-agnostic owner of the timeline-mark model (backs `chart.marks`). Holds the
 * marks + group definitions (the source of truth), pushes snapshots to the renderer
 * through its optional `setTimelineMarks` seam, and re-emits the renderer's glyph
 * clicks as `mark:click`. Inert on a renderer without the `timelineMarks` capability —
 * the model still fills, so `all()` and a later host UI see it.
 */
declare class MarksController {
    private readonly renderer;
    /** Insertion-ordered — the order a cluster falls back to for equal times. */
    private readonly marks;
    private readonly groups;
    private readonly enabled;
    private readonly subs;
    constructor(renderer: IChartRenderer, events: TypedEventBus<VelaEventMap>);
    /** Whether the active renderer paints timeline marks. */
    get supported(): boolean;
    /** Add (or replace, by id) one mark. */
    add(mark: TimelineMark): void;
    /** Replace the whole set — a market switch. */
    set(marks: readonly TimelineMark[]): void;
    remove(id: string): boolean;
    clear(): void;
    /** Every mark, in insertion order (shallow copies — mutating one changes nothing). */
    all(): TimelineMark[];
    /** Define (or replace) a group's presentation — its settings label and default visibility. */
    defineGroup(group: MarkGroup): void;
    /** The defined groups, in definition order. */
    groupDefinitions(): MarkGroup[];
    /**
     * Show or hide one group's marks. The choice lives in the renderer's cosmetic config
     * (the `marks` feature) — what the settings dialog's Events checkboxes edit and what
     * a persisted chart restores — so it warns + no-ops on a renderer without it.
     */
    setGroupVisible(id: string, visible: boolean): void;
    /**
     * A group's effective visibility: its own switch — the user's (persisted) choice, else
     * the declared default, else visible — AND every ancestor's, so a child under a
     * switched-off parent reads hidden whatever its own choice says.
     */
    isGroupVisible(id: string): boolean;
    destroy(): void;
    private sync;
}

/**
 * The chart's timeline-marks control surface (`chart.marks`) — sibling of
 * `chart.drawings` / `chart.panes`. Marks are DATA, not user state: the chart never
 * persists them; re-supply them when the market changes (`market:changed`). The model
 * is core-owned, so every method works on any renderer; on one without the
 * `timelineMarks` capability nothing paints (`supported` reports it) and the group
 * visibility setter warns + no-ops.
 */
declare class MarksControl {
    private readonly ctrl;
    constructor(ctrl: MarksController);
    /** Whether the active renderer paints timeline marks. */
    get supported(): boolean;
    /** Add one mark; an existing id is replaced in place. */
    add(mark: TimelineMark): this;
    /** Replace the whole set (a market switch). */
    set(marks: readonly TimelineMark[]): this;
    remove(id: string): this;
    clear(): this;
    /** Every mark, in insertion order. */
    all(): TimelineMark[];
    /**
     * Define a visibility group's presentation: the label of its checkbox in chart
     * settings (the Events tab) and its default visibility. Marks may name a group
     * that was never defined — it then shows its capitalized id.
     */
    defineGroup(group: MarkGroup): this;
    /** The defined groups, in definition order. */
    groups(): MarkGroup[];
    /** Show or hide one group's marks — the same switch as the settings checkbox, persisted with the chart's config. */
    setGroupVisible(id: string, visible?: boolean): this;
    /** A group's effective visibility (the user's choice, else the group's declared default). */
    isGroupVisible(id: string): boolean;
}

/** Outcome of {@link Vela.runIndicator}: success carries the live handle, failure the error. */
interface RunIndicatorResult {
    ok: boolean;
    /** The mounted indicator on success; null on failure (it was removed again). */
    handle: IndicatorHandle | null;
    /** The compile/runtime error on failure; null on success. */
    error: Error | null;
    /** Post-mortem context snapshot on failure, when the engine had produced one (else null). */
    context: EngineContextSnapshot | null;
}
/** Optional dependency overrides — inject a different renderer, engines, or data feed (tests, swaps). */
interface VelaDeps {
    renderer?: IChartRenderer;
    /** Scripting engines to register at construction (bulk form of `registerEngine`); default none. */
    engines?: ScriptingEngine[];
    /** Market-data source; default `new MultiProviderFeed()` (a provider registry; offline `data` needs no provider).
     *  A custom feed injected here is used bare — `chart.data` registration is then a no-op. */
    dataFeed?: MarketDataFeed;
}
/**
 * The public, imperative chart. Composition root: wires the built-in native
 * renderer (the default) + provider data feed and delegates orchestration.
 * Optional renderers (e.g. lightweight-charts) are passed in as a class via
 * `options.renderer` and instantiated here, so this module imports only the
 * built-in native renderer. Scripting engines are opt-in — register one with
 * `registerEngine` (no engine ⇒ candles only).
 */
declare class Vela {
    private readonly orchestrator;
    private readonly rendererControl;
    private readonly panesControl;
    private readonly dataControl;
    private readonly drawingsControl;
    private readonly marksControl;
    private readonly replayControl;
    constructor(container: HTMLElement | string, options?: VelaOptions, deps?: VelaDeps);
    /**
     * Register a scripting engine so `addIndicator({ language })` can run that
     * language. Vela ships NO engine — install the one you need (Pine Script:
     * `@luxalgo/vela-pinets`) and register it, e.g.
     * `chart.registerEngine('pine', new PineEngine())`; without one the chart
     * displays candles, drawings and native indicators only. Re-registering a
     * language replaces it.
     */
    registerEngine(language: string, engine: ScriptingEngine): this;
    /** Run an indicator script on the chart's market data and render it. */
    addIndicator(source: string, options?: AddIndicatorOptions): IndicatorHandle;
    /**
     * Add a built-in NATIVE indicator (core-computed, no scripting engine) by registered `type` —
     * e.g. `'vpvr'` or `'sma'`. It becomes a first-class indicator (legend row, settings, hide,
     * remove, events). Layer-backed types (`'volume'`, `'vpvr'`) are single-instance — a second
     * call returns the existing handle; the classic studies allow several instances, so each call
     * adds one more. Returns a fail-soft handle for an unregistered type. Native renderer only.
     */
    addNativeIndicator(type: string, options?: {
        inputs?: Record<string, InputValue>;
    }): IndicatorHandle;
    /**
     * The catalog of built-in native indicators with their live state on this chart — each entry's
     * `type`, `title`, whether it `supported`s the current symbol, whether it's already `present`,
     * and whether it allows several instances (`multiInstance`; otherwise a second
     * `addNativeIndicator` is a no-op). Lets a host "add indicator" UI list them, gate unsupported
     * ones, and de-duplicate the single-instance ones. Async because support may probe the
     * provider (a type may need data the symbol lacks).
     */
    availableNativeIndicators(): Promise<NativeIndicatorInfo[]>;
    /**
     * The native-indicator types PRESENT on the chart right now, one entry per instance (a
     * multi-instance type repeats) — the synchronous slice of
     * {@link availableNativeIndicators} (only support probing is async; presence never is).
     * Persistence snapshots read this: an unload-time flush must see an add/remove that
     * happened microseconds ago, which an async catalog mirror cannot guarantee.
     */
    presentNativeIndicators(): string[];
    /** Live handles of every indicator currently on the chart (script + native) — drive
     *  host panels (object trees, indicator lists) with per-id visibility/removal. */
    indicators(): IndicatorHandle[];
    /**
     * Execute an indicator script and INJECT it only if the run succeeds — the seam for
     * host editors and consoles. Resolves `{ ok: true, handle }` after the first
     * successful evaluation, or `{ ok: false, error }` after a compile/runtime failure —
     * in which case the failed indicator is removed again (no dead legend row).
     * Never rejects.
     */
    /**
     * Execute a script and resolve its FIRST computed run — the data-out door for host
     * editors, consoles and dashboards. The script is injected only if it runs (a failure
     * removes it again, leaving no dead legend row), and the result carries the run itself
     * plus the controls for what it put on the chart: `onUpdate` to follow later runs,
     * `remove` to take it off. Never rejects.
     *
     * `runScript` is `runIndicator` with the run as its payload rather than a handle to go
     * fetch from — the same relationship `script:run` has to `context:changed`.
     */
    runScript(source: string, options?: AddIndicatorOptions): Promise<ScriptRunResult>;
    runIndicator(source: string, options?: AddIndicatorOptions): Promise<RunIndicatorResult>;
    /**
     * Switch the chart's market IN PLACE — symbol, provider, timeframe, depth, or offline
     * data — WITHOUT destroying the chart: indicators re-execute over the new bars, native
     * indicators restart, and panes, user drawings, renderer config and event
     * subscriptions all survive. Resolves once the new market's history is painted (a
     * deep backfill continues behind it — await {@link historyComplete}); a call
     * superseded by a newer `setMarket` resolves silently. Emits `market:changed`
     * (with the previous identity) when the market identity changed.
     */
    setMarket(next: MarketSwitch): Promise<void>;
    /** The current market identity — the read counterpart of {@link setMarket}. A snapshot
     *  of the REQUESTED market: it reflects an in-flight switch immediately (before the
     *  new bars land). Listen to `market:changed` for committed identity changes. */
    get market(): MarketSnapshot;
    /** Resolves once the chart is painted and interactive. For a symbol-backed chart this
     *  awaits a provider being registered that resolves the symbol (the parked load). On a
     *  ranged feed the first paint is a small recent head (~200 bars) and the rest of the
     *  history keeps backfilling BEHIND this — await {@link historyComplete} for the full
     *  depth. Distinct from `chart.data.ready()`, which awaits only the provider symbol
     *  indexes. */
    ready(): Promise<void>;
    /** Resolves once the FULL requested history has loaded (immediately for small/offline
     *  charts; after the backward backfill for deep ones — see the `history:progress` /
     *  `history:complete` events). Never rejects: on destroy or a failed backfill it
     *  resolves with whatever depth loaded. */
    historyComplete(): Promise<void>;
    /**
     * A renderer-agnostic snapshot of the graphic elements the core has generated
     * (series, fills, drawings, tables, …) — a deterministic check that a feature was
     * produced, independent of which renderer drew it.
     */
    inspect(): SceneInspection;
    /**
     * The active renderer's control surface. Set/read render features at runtime —
     * common ones (candle colors, `logScale`, `currentPriceLine`) and renderer-specific
     * ones (native `glow`) — with **no indicator re-run**. Unsupported keys warn and no-op:
     * `chart.renderer.set('glow', 0.6)`, `chart.renderer.set({ logScale: true })`.
     */
    get renderer(): RendererControl;
    /**
     * The chart's pane control surface. List panes with the indicators each holds and
     * move/merge/reorder/collapse/maximize them: `chart.panes.list()`,
     * `chart.panes.moveIndicator(id, { newPane: true })`, `chart.panes.collapse(id)`.
     * On a renderer without pane management the mutators warn and no-op.
     */
    get panes(): PanesControl;
    /**
     * The chart's data control surface. Register market-data providers and query the
     * registry: `chart.data.registerProvider('binance', new BinanceProvider())`,
     * `chart.data.resolve('BTCUSDT')`, `chart.data.symbols('binance')`, and
     * `chart.data.ready()` (provider indexes settled). No provider is bundled —
     * registering the one that resolves the chart symbol fires the parked initial load
     * (await it with `chart.ready()`).
     */
    get data(): DataControl;
    /**
     * The chart's user-drawings control surface. Activate tools, create/mutate
     * drawings programmatically, and persist them:
     * `chart.drawings.setTool('trendline')`, `chart.drawings.add('hline', { … })`,
     * `chart.drawings.toJSON()/fromJSON(doc)`. Always present; on a renderer without
     * the `userDrawings` capability the interactive methods warn + no-op while
     * persistence still round-trips. Enable the on-chart toolbar with
     * `new Vela(el, { drawings: true })` or `chart.drawings.showToolbar()`.
     */
    get drawings(): DrawingsControl;
    /**
     * The chart's timeline-marks control surface: host events pinned to a bar and shown
     * as glyphs on a lane above the time axis, each opening a popup on click —
     * `chart.marks.add({ id, time, glyph, title, content })`, `chart.marks.set(list)`,
     * `chart.marks.defineGroup({ id, label })`. Marks are data, not user state: re-supply
     * them on `market:changed`. On a renderer without the `timelineMarks` capability the
     * model still fills but nothing paints (`chart.marks.supported`).
     */
    get marks(): MarksControl;
    /**
     * The chart's bar-replay control surface: rewind to a past bar and reveal the
     * following ones by hand or on a timer, from the history already loaded —
     * `await chart.replay.start({ from })`, `chart.replay.play(2000)`, `chart.replay.step()`,
     * `chart.replay.stop()`. Revealed bars behave like live bars for indicators; live
     * updates pause meanwhile. Follow it with the `replay:*` events.
     */
    get replay(): ReplayControl;
    on<K extends keyof VelaEventMap>(event: K, handler: (payload: VelaEventMap[K]) => void): () => void;
    /** The current visible time range (`from`/`to` in epoch-ms), or null before data loads. */
    getVisibleRange(): VisibleRange | null;
    /** Set the visible time range explicitly (epoch-ms). Use for a custom date range. */
    setVisibleRange(range: VisibleRange): this;
    /**
     * Pan the view by a fraction of the visible width — positive ⇒ toward the latest
     * bars, negative ⇒ into history. Behaves exactly like dragging the chart: constant
     * zoom, the same pan limits (forward stops at the newest candle plus the bounded
     * empty space), and eased on renderers that animate pans. Repeated calls stack into
     * one continuous scroll.
     */
    panBy(fraction: number): this;
    /**
     * Frame a named date-range preset over the loaded bars: `'1D'`, `'1W'`, `'1M'`,
     * `'3M'`, `'6M'`, `'1Y'`, `'YTD'`, or `'ALL'`. A preset deeper than the loaded
     * history simply frames everything (it doesn't fetch more bars).
     */
    setVisibleRangePreset(preset: VisibleRangePreset): this;
    resize(): void;
    /**
     * Swap the app theme at runtime — `'dark'`, `'light'`, or a full custom
     * {@link VelaTheme}. Re-skins the chart surface, axes, legends and in-chart chrome
     * live (no indicator re-run, no rebuild) and emits `theme:changed` with the resolved
     * theme so host chrome around the chart can follow. Explicitly customized plot
     * cosmetics (a config-set background or series color) are re-based only when they
     * were inherited from the previous theme.
     */
    setTheme(theme: ThemeName | VelaTheme): this;
    destroy(): void;
}

/** The runtime surface an action's `when`/`run` receives. */
interface WidgetContext {
    /** The CURRENT inner chart. Read it through this getter rather than capturing it:
     *  a shell may replace its chart instance, and a captured one would be destroyed.
     *  (Symbol and timeframe switches are applied IN PLACE — the instance survives them.) */
    chart: Vela;
    /** LIVE getters, like `chart` — they resolve the ACTIVE cell's market at every
     *  read, so an attachment that holds its mount context keeps reading the truth
     *  after a symbol/timeframe switch. Read them at the point of use; never copy
     *  them into long-lived state. */
    symbol: string;
    timeframe: string;
    priceStyle: string;
    setSymbol(symbol: string): void;
    setTimeframe(tf: string): void;
    setPriceStyle(style: string): void;
    openSymbolSearch(query?: string): void;
    /** Open/close a docked side panel by id (built-in or contributed) — a bare call flips
     *  it. The dock stays exclusive: opening one closes whichever was showing. Unknown ids
     *  are ignored. The seam a plugin uses to open ITS OWN panel programmatically. */
    togglePanel(id: string, open?: boolean): void;
    /** Dock `el` as a full-width strip in the shell's layout, between the chart area and
     *  the bottom bar — the charts shrink to make room. Strips stack in docking order.
     *  Returns the undock (removes `el`; a no-op once it has left the strip area). The
     *  caller owns `el`, its content and styling. */
    dockStrip(el: HTMLElement): () => void;
    /** The widget's root element — pass it as `host` when mounting kit components
     *  (Dialog/Menu/Tooltip) from an action; without an explicit host they portal to
     *  the body, OUTSIDE the theme variables. A multi-chart shell hands its own root. */
    host: HTMLElement;
    /** The widget's feedback pill (bottom-center, auto-hides). */
    toast(message: string, kind?: 'info' | 'success' | 'error'): void;
    /** Add a SCRIPT indicator to the active chart THROUGH THE SHELL — unlike the raw
     *  `chart.addIndicator`, the addition enters the unified undo/redo timeline, the
     *  topbar indicator count, and the shell's bookkeeping. The entry's source rides the
     *  recorded action, so redo re-adds it even after the original handle died. The
     *  shell does NOT persist these across reloads (they are not manifest entries) —
     *  a plugin that wants them back owns that via {@link registerStatePersistence}. */
    addIndicator(entry: ExternalIndicatorEntry): void;
    /** Add a native (core-computed) indicator to the active chart through the shell —
     *  recorded in the undo/redo timeline, unlike the raw `chart.addNativeIndicator`. */
    addNativeIndicator(type: string): void;
    /** Tell the shell some PERSISTABLE third-party state changed (a debounced
     *  `state:changed` + storage write follows). Only needed for state with no shell
     *  event of its own — indicator adds/removals already trigger the save cycle. */
    stateChanged(): void;
    /** Where the right-click that opened a context menu landed. Set on the context handed
     *  to `context:*` actions (`when` and `run`); absent everywhere else. */
    pointer?: ContextMenuPointer;
}
/**
 * What the chart's crosshair reported when a context menu opened ({@link WidgetContext.pointer}),
 * on the chart that received the right-click — in a workspace, the cell under the pointer.
 * Captured once at open: moving through the menu before picking a row does not change it.
 * The axis menus get what the crosshair reports over the axis: off the plot, `price` and
 * `paneKind` are null, while `time` still names the bar column under the pointer (on the
 * time axis, the bar above the click; null past the last bar).
 */
interface ContextMenuPointer {
    /** The value under the pointer on the pane it landed on: a price on the price pane, an
     *  indicator value on a study pane (see `paneKind`). Null off the plot. */
    price: number | null;
    /** Open time of the bar under the pointer; null off the bars. */
    time: number | null;
    /** The kind of pane the pointer is on; null off the plot. */
    paneKind: 'price' | 'study' | null;
}
/** What {@link WidgetContext.addIndicator} takes: a named script, ready to run. */
interface ExternalIndicatorEntry {
    name: string;
    /** The script source (the recorded undo/redo action re-adds from it). */
    script: string;
    /** The indicator's id on the chart (see `AddIndicatorOptions.id`) — what a persistence
     *  handler stores and hands back on restore so the indicator comes back under the id
     *  its document knows. Omitted: the chart mints one. Either way undo/redo re-add the
     *  indicator under the id it first ran with. An id already live on the cell's chart
     *  is rejected (a warning; nothing is added). */
    id?: string;
    /** Engine language (default: the chart's default engine). */
    language?: string;
    /** Input-value overrides applied at add time (what a persistence handler restores). */
    inputs?: Record<string, InputValue>;
    /** Declaration-prop overrides applied at add time. */
    props?: Record<string, InputValue>;
    /** Restore hidden: the indicator is suspended right after the add (legend row
     *  stays, marked hidden) — a persistence handler carrying a hidden flag applies
     *  it here so the engine never spends anything on a tucked-away indicator. */
    hidden?: boolean;
}
/** Where an action is projected. */
type WidgetActionTarget = 'topbar' | 'context:body' | 'context:price-axis' | 'context:time-axis';
interface WidgetActionDescriptor {
    /** Stable id — re-registering an id replaces it. */
    id: string;
    target: WidgetActionTarget;
    /** Always required, even icon-only: it is the button's aria-label and tooltip, the
     *  mobile drawer row's text, and the context-menu item's label. */
    label: string;
    /** Icon id from the `vela/ui` icon registry (register yours with `registerIcon`). */
    icon?: string;
    /** Topbar only: render the DESKTOP button icon-only, like the built-in tools — the
     *  `label` moves to the aria-label and a kit tooltip instead of button text (mobile
     *  surfaces keep their text). The right cluster gets the native 32px tool look; the
     *  left cluster keeps the primary chrome, minus the text. Requires `icon` — without
     *  one the flag is ignored (with a console warning) and the label renders. The piece
     *  that makes a `'screenshot'` slot override pixel-faithful to the native button. */
    iconOnly?: boolean;
    /** Sort key (ascending; default 0; ties keep registration order). On the topbar it orders
     *  the contributed group. In a context menu (`context:*`) contributed rows sort TOGETHER
     *  with the menu's built-in rows, which sit at the ranks of `CONTEXT_MENU_BUILTIN_ORDER`:
     *  the built-in actions below 0 and the settings row at 1000. So an action without
     *  `order` lands after the built-in actions and before the settings row, `order: -100`
     *  leads the menu, and on a tie the built-in row comes first. */
    order?: number;
    /** Topbar only: which cluster the button joins. `'right'` (default) is the
     *  right-hand tools cluster; `'left'` puts it with the PRIMARY chrome buttons —
     *  right after the style/layout dropdowns, styled like them (the spot and look of
     *  the built-in Indicators button, for actions that replace it). */
    align?: 'left' | 'right';
    /** Topbar only: where the action goes on the MOBILE layout (the topbar is hidden
     *  there). `'bar'` is an icon stop on the bottom bar; `'menu'` is a row in the
     *  three-dots menu — a left (primary) action right after Layout, a right one at the
     *  end. Default: `'bar'` for `align: 'left'`, `'menu'` otherwise. */
    mobile?: 'bar' | 'menu';
    /** Runtime gate — omitted ⇒ always shown. */
    when?: (ctx: WidgetContext) => boolean;
    run: (ctx: WidgetContext) => void;
}
/**
 * A widget ATTACHMENT — a contributed unit of per-widget behavior/UI beyond a single
 * button: overlays, gesture handlers, custom key handling. `mount` runs once per
 * widget (at construction, or on `refreshActions()` for late registrations) with the
 * widget's {@link WidgetContext}; the returned disposer runs at widget destroy.
 * Everything the attachment touches must come from `ctx` (never module globals).
 */
interface WidgetAttachment {
    /** Stable id — re-registering an id replaces it (mounted widgets keep the old one until destroy). */
    id: string;
    mount(ctx: WidgetContext): () => void;
}
/**
 * A contributed side panel's runtime handle — what `mount` hands back. Every member is
 * optional: a panel that only paints its body once needs none of them.
 */
interface SidePanelHandle {
    /** (Re)bind to a chart instance: on mount, after every widget rebuild, and — in a
     *  workspace — whenever the active cell changes. */
    onChart?(chart: Vela): void;
    /** The panel just became visible. Panels that render lazily do it here. */
    onOpen?(): void;
    /** Released when the panel is dropped (widget destroy, or a re-registration). */
    destroy?(): void;
}
/**
 * The header surface a contributed panel may use: a SLOT between the title and the close
 * button for compact controls (a document name, action icons), and the title text itself.
 * Everything else in the header (the close button, the row) stays the shell's.
 */
interface SidePanelHeader {
    /** Lay out inline controls here; the close button stays pinned right of it. */
    slot: HTMLElement;
    /** Replace the header title (an empty string hides it). The topbar toggle keeps the
     *  DECLARED `title` as its tooltip. */
    setTitle(title: string): void;
    /** Whether the panel covers every chart right now (see `maximizable`). */
    readonly maximized: boolean;
    /** Maximize the panel over the shell's charts, or restore it — what its header button
     *  does. A no-op unless the descriptor is `maximizable`. Closing restores it too. */
    setMaximized(maximized: boolean): void;
}
/**
 * A contributed SIDE PANEL — a docked column in the shell's panel dock, alongside the object
 * tree and the data window, with a toggle button in the topbar's panel group.
 *
 * The shell owns the chrome (header, close button, dock exclusivity, the button and its pressed
 * state) and hands `mount` the panel's BODY element to fill — plus a {@link SidePanelHeader}
 * for panels that dock controls in their header; the contribution never reaches into
 * the shell's DOM. Register at import time, before widgets are constructed (`refreshActions()`
 * picks up later registrations on an already-built widget).
 */
interface SidePanelDescriptor {
    /** Stable id — re-registering an id replaces it. Also the key its width persists under. */
    id: string;
    /** Header title, and the tooltip of its topbar button. */
    title: string;
    /** Icon id from the `vela/ui` icon registry (register yours with `registerIcon`). */
    icon: string;
    /** Sort key among the panel buttons (ascending; default 100 — after the built-ins). */
    order?: number;
    /** Declared width in px (default 280). */
    width?: number;
    /** Let the user drag the panel's inner edge (default false — a fixed column). */
    resizable?: boolean;
    minWidth?: number;
    maxWidth?: number;
    /** Float over the chart's right edge instead of docking beside it: the chart keeps its
     *  width and layout, and the panel covers its right-hand part (default false — a docked
     *  column that shrinks the chart). For panels wide enough that a column would crush
     *  the plot. The dock stays exclusive either way. */
    overlay?: boolean;
    /** A header button that maximizes the panel over every chart of the shell, and restores
     *  it (default false). For panels that are sometimes the main work surface, like an
     *  editor; the contribution can drive it too ({@link SidePanelHeader.setMaximized}). */
    maximizable?: boolean;
    mount(ctx: WidgetContext, body: HTMLElement, header: SidePanelHeader): SidePanelHandle | void;
}
/** One panel toggle, as the shell's chrome consumes it (data, never DOM). */
interface SidePanelButton {
    id: string;
    title: string;
    icon: string;
}
/** Register (or replace) a widget attachment. Returns an unregister disposer. */
declare function registerWidgetAttachment(att: WidgetAttachment): () => void;
declare function unregisterWidgetAttachment(id: string): void;
/** Every registered attachment (registration order). */
declare function widgetAttachments(): WidgetAttachment[];
/** Sort key of a panel that declares none — after the shell's own panels. */
declare const DEFAULT_PANEL_ORDER = 100;
/** Register (or replace) a side panel. Returns an unregister disposer. */
declare function registerSidePanel(desc: SidePanelDescriptor): () => void;
declare function unregisterSidePanel(id: string): void;
/** Every registered side panel, `order`-sorted (registration order breaks ties). */
declare function sidePanels(): SidePanelDescriptor[];
/** The built-in topbar slots a contributed action may TAKE OVER by registering under
 *  their id — the "simple button" slots. The composites (symbol, timeframes, style,
 *  layout, undo-redo, alerts, panels) are stateful controls the shell pushes state
 *  into; a plain `{label, icon, run}` descriptor cannot stand in for them. */
declare const OVERRIDABLE_TOPBAR_IDS: readonly ["indicators", "screenshot"];
/**
 * The action OVERRIDING a built-in topbar slot, if one is registered — an action whose
 * `id` IS the built-in id. An override takes the slot's WHOLE surface: the desktop
 * button (at the slot's position), the mobile counterpart, and the keyboard chord all
 * route to `run`, and the native machinery behind the slot (the built-in indicator
 * picker) is not constructed. Shells resolve this at construction — register at import
 * time, like every contribution.
 */
declare function topbarActionOverride(id: string): WidgetActionDescriptor | undefined;
/** Register (or replace) a widget action. Widgets read the registry live.
 *  Registering under a RESERVED built-in topbar id (`'indicators'`, `'screenshot'`)
 *  OVERRIDES that slot — see {@link topbarActionOverride}. Built-in ids that are
 *  stateful composites cannot be overridden and the registration is refused. */
declare function registerWidgetAction(desc: WidgetActionDescriptor): () => void;
declare function unregisterWidgetAction(id: string): void;
/** Actions for one target, `order`-sorted, `when`-filtered when a context is given. */
declare function widgetActions(target: WidgetActionTarget, ctx?: WidgetContext): WidgetActionDescriptor[];
/** What a legend action sees about the indicator whose row it sits on. */
interface LegendIndicatorInfo {
    id: string;
    title: string;
    /** The script source the indicator runs NOW (read at click time, so an in-place code
     *  update shows through); undefined for a NATIVE (core-computed) indicator. The usual
     *  `when` gate for source-centric actions. */
    source?: string;
}
/**
 * A contributed LEGEND-ROW action: an icon button on every indicator's legend row,
 * revealed with the built-in controls (hover/selection), between them and the ✕.
 * `when` gates per indicator (e.g. `(ind) => ind.source !== undefined` for actions
 * that need the script). `run` receives the shell's {@link WidgetContext} and the row's
 * {@link LegendIndicatorInfo}.
 */
interface LegendActionDescriptor {
    /** Stable id — re-registering an id replaces it. */
    id: string;
    /** Icon id from the `vela/ui` icon registry (register yours with `registerIcon`). */
    icon: string;
    tooltip: string;
    /** Sort key within the contributed group (ascending; default 0). */
    order?: number;
    /** Per-indicator gate — omitted ⇒ shown on every row. */
    when?: (indicator: LegendIndicatorInfo) => boolean;
    run(ctx: WidgetContext, indicator: LegendIndicatorInfo): void;
}
/** Register (or replace) a legend action. Returns an unregister disposer. */
declare function registerLegendAction(desc: LegendActionDescriptor): () => void;
declare function unregisterLegendAction(id: string): void;
/** Every registered legend action, `order`-sorted (registration order breaks ties). */
declare function legendActions(): LegendActionDescriptor[];
/** One block of a legend callout's deployed panel, descriptor-side: plain text, or a
 *  button whose `run` receives the shell's {@link WidgetContext} and the row's
 *  indicator — the same signature as a legend action's `run`. */
type LegendCalloutItem = {
    type: 'text';
    text: string;
} | {
    type: 'button';
    label: string;
    /** Emphasized (selection-colored) button — the panel's main action. */
    primary?: boolean;
    /** Close the panel after `run` (default true). */
    close?: boolean;
    run(ctx: WidgetContext, indicator: LegendIndicatorInfo): void;
};
/** The panel a clickable callout deploys: an optional heading over ordered blocks. */
interface LegendCalloutContent {
    title?: string;
    items: LegendCalloutItem[];
}
/** A callout's resolved presentation for one row — what {@link LegendCalloutDescriptor.callout} returns. */
interface LegendCalloutSpec {
    /** Icon id from the `vela/ui` icon registry (register yours with `registerIcon`). */
    icon: string;
    /** Bubble fill — any CSS color (`color-mix` token washes match the built-in badges). */
    background: string;
    /** Icon ink (default: the legend row's text color). */
    color?: string;
    /** Hover text; also the bubble's accessible name. */
    tooltip: string;
    /** Deployed panel — presence makes the bubble clickable. */
    content?: LegendCalloutContent;
}
/**
 * A contributed LEGEND CALLOUT: a small tinted bubble with a centered icon, visible
 * right of the indicator's legend title while the row is idle (hidden while its
 * hover/selection controls are out). When the spec carries `content`, clicking the
 * bubble deploys that panel — below it, flipping above near the bottom screen edge.
 *
 * Unlike a legend action's static icon, a callout's whole presentation is resolved
 * per row through `callout` — return `null` to show none (the per-indicator gate),
 * or a spec whose icon/tint/panel follow your own state (a market-status bubble
 * changes dress as sessions roll). Late state changes re-project through the shells'
 * `refreshActions()`, like every contribution.
 */
interface LegendCalloutDescriptor {
    /** Stable id — re-registering an id replaces it. */
    id: string;
    /** Sort key within the contributed group (ascending; default 0). */
    order?: number;
    /** Resolve the row's bubble — `null`/`undefined` shows none. */
    callout(indicator: LegendIndicatorInfo): LegendCalloutSpec | null | undefined;
}
/** Register (or replace) a legend callout. Returns an unregister disposer. */
declare function registerLegendCallout(desc: LegendCalloutDescriptor): () => void;
declare function unregisterLegendCallout(id: string): void;
/** Every registered legend callout, `order`-sorted (registration order breaks ties). */
declare function legendCallouts(): LegendCalloutDescriptor[];
/**
 * The surface a `scope: 'cell'` persistence handler works against — bound to ONE cell
 * (never the active one by proxy), because serialize/restore run per cell, including
 * cells that are not active. `addIndicator`/`addNativeIndicator` target THIS cell and
 * are ALWAYS muted — unlike their {@link WidgetContext} namesakes they never enter the
 * undo timeline, even from an async `restore` continuation (fetch, then add): applying
 * a document is state application, not a user edit.
 */
interface CellStateContext {
    /** The cell's durable identity (`'c1'`, a declared name). */
    cellId: string;
    /** The cell's LIVE chart. */
    chart: Vela;
    /** Add a script indicator to THIS cell through the shell (see {@link WidgetContext.addIndicator}). */
    addIndicator(entry: ExternalIndicatorEntry): void;
    /** Add a native indicator to THIS cell through the shell. */
    addNativeIndicator(type: string): void;
}
/**
 * A third-party STATE PERSISTENCE handler — how a plugin puts its own state into the
 * shell's persisted document (the `ext` bag of `WorkspaceState` / per-chart state)
 * instead of running a parallel store. `key` is namespaced (`'vendor.feature'`) and
 * flat — one entry per handler. `serialize` runs on every shell snapshot (`getState`,
 * the persist write) and returns a JSON-serializable payload, or `undefined` for "no
 * entry". `restore` runs when a document carrying the key is applied (boot restore,
 * `applyState`) — AFTER the core state (chart alive, engines registered, indicator
 * ledger converged) and, for cell scope, inside the cell's history-mute, so nothing it
 * does enters undo/redo. The payload is UNTRUSTED (the codec passes `ext` through
 * opaquely): validate it. `restore` is only called for keys present in the document.
 *
 * Register at import time, before shells are constructed — the rule every contribution
 * registry shares. A key with no registered handler still round-trips verbatim, so a
 * session without the plugin never loses its state.
 */
type StatePersistenceHandler = {
    /** Namespaced entry key (`'velapro.indicators'`) — re-registering a key replaces it. */
    key: string;
    /** Where the entry lives: per chart (`charts[i].ext`) — follows the cell through pool/layout moves. */
    scope: 'cell';
    serialize(ctx: CellStateContext): unknown;
    restore(payload: unknown, ctx: CellStateContext): void;
} | {
    key: string;
    /** Document root (`state.ext`) — one entry per document, whatever the grid. */
    scope: 'global';
    serialize(ctx: WidgetContext): unknown;
    restore(payload: unknown, ctx: WidgetContext): void;
};
/** Register (or replace) a state-persistence handler. Returns an unregister disposer. */
declare function registerStatePersistence(handler: StatePersistenceHandler): () => void;
declare function unregisterStatePersistence(key: string): void;
/** The registered handlers of one scope (registration order). */
declare function statePersistenceHandlers<S extends StatePersistenceHandler['scope']>(scope: S): Array<Extract<StatePersistenceHandler, {
    scope: S;
}>>;
/**
 * Reorder the symbol picker's AGGREGATED pool — every source combined, exactly what
 * the search dialog displays. Called when the pool changes (a provider's index lands
 * or refreshes), NOT per keystroke: the picker caches the result. May be async (a
 * server-fetched top list) — the picker shows the current order and refreshes when
 * the promise resolves.
 *
 * The returned list may INJECT descriptors absent from the pool (they must carry
 * their `provider` and be genuinely servable, or selecting them parks the load) and
 * may OMIT entries (hiding them). The picker dedupes by venue+ticker, FIRST
 * occurrence winning — injecting at the head fixes both position and display data.
 *
 * While a ranking is registered, the picker's built-in empty-query pin (the hardcoded
 * majors) stands down: the head of YOUR list is the dialog's opening screen. Under a
 * typed query the relevance tiers still lead — the ranking orders within each tier.
 */
type SymbolRankingHook = (pool: SymbolDescriptor[]) => SymbolDescriptor[] | Promise<SymbolDescriptor[]>;
/** Register (or replace — ONE ranking at a time, last wins) the symbol ranking.
 *  Returns an unregister disposer. Register at import time, like every contribution. */
declare function registerSymbolRanking(hook: SymbolRankingHook): () => void;
/** The registered ranking, if any — what the shells' symbol picker consults. */
declare function symbolRanking(): SymbolRankingHook | undefined;
/** Makes ONE engine instance for ONE chart — engines hold per-chart sessions (and
 *  possibly a worker), so the shell calls the factory per chart build, never shares. */
type EngineFactory = () => ScriptingEngine;
/**
 * Register (or replace) a DEFAULT scripting engine for a language: every widget and
 * workspace cell built afterwards registers `make()` on its chart automatically — the
 * app-level wiring for hosts that pair Vela with an engine package, same shape as the
 * other contribution registries. A per-instance `engines` option still wins for the
 * same language, and the bare `Vela` chart is untouched: with nothing registered here,
 * nothing changes anywhere (there is still no bundled default engine).
 */
declare function registerDefaultEngine(language: string, make: EngineFactory): () => void;
declare function unregisterDefaultEngine(language: string): void;
/** The registered defaults merged UNDER `overrides` — per-instance factories win per
 *  language. The shell layers (widget, workspace cell) register exactly this result. */
declare function resolveEngines(overrides?: Record<string, EngineFactory>): Record<string, EngineFactory>;

export { type ScriptRunCause as $, type LegendIndicatorInfo as A, type BarsChangeReason as B, type CellStateContext as C, type DrawingsDocument as D, type ExternalIndicatorEntry as E, type FetchSeries as F, type NativeIndicatorContext as G, type NativeIndicatorDescriptor as H, type IndicatorHandle as I, type NativeIndicatorInfo as J, type NativeIndicatorOutput as K, type LegendActionDescriptor as L, MarksControl as M, type NativeIndicator as N, OVERRIDABLE_TOPBAR_IDS as O, type ParsedSymbol as P, type PreparedScript as Q, type ReplayState as R, type ScriptingEngine as S, RendererControl as T, ReplayControl as U, Vela as V, type WidgetContext as W, type ReplayEndReason as X, type ReplayStartOptions as Y, type RunIndicatorResult as Z, type SceneInspection as _, type ReplayBounds as a, type ScriptRunResult as a0, type SidePanelButton as a1, type SidePanelDescriptor as a2, type SidePanelHandle as a3, type SidePanelHeader as a4, type StatePersistenceHandler as a5, type StrategyFill as a6, type StrategyState as a7, type StrategyTrade as a8, type SymbolRankingHook as a9, unregisterLegendAction as aA, unregisterLegendCallout as aB, unregisterNativeIndicator as aC, unregisterSidePanel as aD, unregisterStatePersistence as aE, unregisterWidgetAction as aF, unregisterWidgetAttachment as aG, widgetActions as aH, widgetAttachments as aI, DEFAULT_PANEL_ORDER as aJ, TypedEventBus as aa, type VelaDeps as ab, type VisibleBarRange as ac, type WidgetActionDescriptor as ad, type WidgetActionTarget as ae, type WidgetAttachment as af, getNativeIndicator as ag, legendActions as ah, legendCallouts as ai, nativeIndicatorDescriptors as aj, nativeIndicatorTypes as ak, registerDefaultEngine as al, registerLegendAction as am, registerLegendCallout as an, registerNativeIndicator as ao, registerSidePanel as ap, registerStatePersistence as aq, registerSymbolRanking as ar, registerWidgetAction as as, registerWidgetAttachment as at, resolveEngines as au, sidePanels as av, statePersistenceHandlers as aw, symbolRanking as ax, topbarActionOverride as ay, unregisterDefaultEngine as az, type VelaEventMap as b, type ScriptRun as c, type Resolved as d, type ReplayTick as e, DataControl as f, type ReplayTickSource as g, type CodeUpdateResult as h, type ContextMenuPointer as i, type ContextSelect as j, DrawingsControl as k, type EngineAlert as l, type EngineCapabilities as m, type EngineContextSnapshot as n, type EngineFactory as o, type EngineWarning as p, type ExecutionHandlers as q, type ExecutionMarket as r, type ExecutionRequest as s, type ExecutionSession as t, type IndicatorEventMap as u, type IndicatorSummary as v, type LegendCalloutContent as w, type LegendCalloutDescriptor as x, type LegendCalloutItem as y, type LegendCalloutSpec as z };
