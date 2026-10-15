import { O as OHLCV, V as VisibleRangePreset, a as VisibleRange, b as VelaOptions, I as InputValue, c as VelaTheme, N as NativeBackend, d as MarketSession } from './options-CSXbjMM5.js';
import { S as SyncSetting, V as VelaStorage, C as CellState, W as WidgetHistory, R as ResolvedIndicator, a as StatuslinePart, b as RangePreset, T as TrackSizes, c as VelaShellOptions, d as SyncOptions, e as SyncKind, f as WorkspaceState } from './statusline-model-C9tYXuux.js';
export { g as ChartState, D as DrawingToolsState, P as PanelsState, h as decodeState, i as encodeState, s as sanitizeState } from './statusline-model-C9tYXuux.js';
import { K as KeymapManager } from './keymap-CGOz5F5f.js';
import { I as IndicatorHandle, S as ScriptingEngine, W as WidgetContext, V as Vela, E as ExternalIndicatorEntry, R as ReplayState, a as ReplayBounds, b as VelaEventMap, c as ScriptRun } from './contributions-BY3zSYiZ.js';
import { M as MarketDataFeed } from './DataProvider-Byo8pEv0.js';

/** The cells that follow `originId` under `setting` — PURE (never includes the origin). */
declare function syncTargets(originId: string, setting: SyncSetting | undefined, cellIds: readonly string[]): string[];
/** Whether two visible ranges agree within `epsMs` on both edges — the short-circuit
 *  that stops viewport echo (a followers' re-emission never re-propagates). */
declare function rangesWithin(a: {
    from: number;
    to: number;
}, b: {
    from: number;
    to: number;
}, epsMs: number): boolean;

/** @deprecated Use {@link VelaStorage} — one storage contract for both shells
 *  (`get`/`set`, each synchronous OR promise-returning, so localStorage-like and
 *  REST/IndexedDB-like backends both fit). */
type WorkspaceStorage = VelaStorage;
/** An in-memory, session-lived {@link VelaStorage} — the OPT-IN alternative to the
 *  localStorage default when persisted state must not outlive the page session. */
declare function memoryStorageAdapter(): VelaStorage;

/** The seed/mutable market state of one cell (all optional — an empty cell parks).
 *  The SAME vocabulary as the widget's chart options: the workspace's top-level chart
 *  options provide every cell's default ({@link seedDefaults}), `cells` overrides per
 *  cell. `data`/`visibleRange` are boot-only (they seed the first load, never persist). */
interface CellSeed {
    /** Bare ticker (provider resolved by declaration order) or `EXCHANGE:`-prefixed. */
    symbol?: string;
    timeframe?: string;
    priceStyle?: string;
    bars?: number;
    /** Trading session to show (markets that have one; `regular` is the default). */
    session?: string;
    /** Offline bars for this cell — replaces the provider (boot-only). */
    data?: OHLCV[];
    /** Initial visible window (boot-only). */
    visibleRange?: VisibleRangePreset | VisibleRange;
}
/** A destroyed cell's state, kept by the workspace pool so its slot restores later —
 *  the per-cell entry of the SHARED state document (`src/state/document.ts`). */
type PooledCellState = CellState;
/** What a cell BOOTS from: a pooled state (restored slot) or an options seed — plus
 *  the boot-only extras a pooled state never carries (offline bars, initial window). */
type CellBoot = PooledCellState & Pick<CellSeed, 'data' | 'visibleRange'>;
/** Chart options the workspace forwards VERBATIM to every cell's chart — the widget
 *  vocabulary minus what the grid manages itself: `height` (the grid sizes cells),
 *  `nativeBackend` (the WebGL budget policy, explicit value resolved upstream), the
 *  market/view seeds (those flow through {@link CellSeed}), and `drawings`' toolbar
 *  sub-key (see {@link cellDrawings}). */
type CellChartDefaults = Pick<VelaOptions, 'renderer' | 'defaultLanguage' | 'currentPriceLine' | 'logScale' | 'animations' | 'glow' | 'upColor' | 'downColor' | 'drawings' | 'settings' | 'priceAxis'>;
/** A cell's own look prefs as one bundle — the Status line tab's segment toggles (null
 *  when the shell runs without status lines) and indicator legend titles/values, plus
 *  the Symbol tab's watermark toggles. What the workspace's STYLE link mirrors across
 *  same-group cells, next to the renderer config. */
interface CellStatusPrefs {
    parts: Record<StatuslinePart, boolean> | null;
    indicatorTitles: boolean;
    indicatorValues: boolean;
    watermark: boolean;
    replayWatermark: boolean;
}
/** One entry of the shared indicator picker's native catalog, per cell. */
interface CellNativeInfo {
    type: string;
    title: string;
    supported: boolean;
    present: boolean;
    beta?: boolean;
}
/** What every cell shares from the workspace. */
interface CellDeps {
    /** THE shared market-data feed (one registry, one cache, for every cell). */
    feed: MarketDataFeed;
    /** Scripting-engine factories — instantiated PER CELL (a worker engine per cell). */
    engines: Record<string, () => ScriptingEngine>;
    /** The workspace's top-level chart options every cell's chart starts from. */
    chartDefaults: CellChartDefaults;
    theme: VelaTheme;
    live: boolean;
    volume: boolean;
    statusline: boolean;
    watermark: boolean;
    /** Geometry backend for cells under the current layout (the WebGL budget policy). */
    nativeBackend: NativeBackend;
    /** Where the renderer mounts its MODAL dialogs (chart/indicator settings) — the
     *  workspace root, so dialogs center over the whole grid instead of one cell. */
    dialogHost: HTMLElement;
    /** The workspace-global display-timezone CHOICE — an IANA zone, or the exchange
     *  rule, which each cell resolves to its own market's zone ({@link ChartCell.applyTimezone}). */
    timezone(): string;
    /** Switch the workspace-global display timezone (a cell's time-axis menu). */
    setTimezone(zone: string): void;
    /** The live widget-context builder (per-cell context menus project contributed actions). */
    context(): WidgetContext;
    /** The shared manifest can no longer change instance sets: it resolved, or the
     *  workspace has no `indicators` option so nothing will ever resolve. Gates the
     *  ledger's pending fallback in `dehydrate` — once settled, a live empty set means
     *  "the user removed everything" and persists so. */
    manifestSettled(): boolean;
    /** Report a pointer-down/focus in this cell (the workspace sets it active). */
    activate(id: string): void;
    /** Whether the grid holds more than one cell — gates the cluster's maximize
     *  button and its drag handle (a lone chart has neither use). */
    multiCell(): boolean;
    /** Is this cell the one the workspace currently maximizes over the grid? */
    isMaximized(id: string): boolean;
    /** Maximize this cell over the whole grid, or restore the grid when it already is. */
    toggleMaximize(id: string): void;
    /** Drag-handle hit-test: the OTHER live cell under a viewport point (never `id`). */
    cellDragTarget(id: string, x: number, y: number): string | null;
    /** Live drop-target highlight while a grip drag is underway (null clears). */
    previewDropTarget(id: string | null): void;
    /** Commit a grip drag: the two cells trade slots in the grid. */
    dropCell(id: string, targetId: string): void;
    /** The cell's market changed in place (chrome/retention refresh upstream). */
    onMarketChanged(id: string): void;
    /** The cell's price style changed in place (topbar icon/menu refresh upstream). */
    onPriceStyleChanged(id: string): void;
    /** The cell's indicator ledger changed (count/picker refresh upstream). */
    onIndicatorsChanged(id: string): void;
    /** A Status line tab or watermark pref changed on this cell (the style link mirrors upstream). */
    onStatusPrefsChanged(id: string): void;
    /** Persistable per-cell state changed outside the market/indicator channels
     *  (bars budget, watermark/titles toggles) — the workspace debounces a save. */
    onStateDirty(): void;
    /** The shell's toast surface (unresolved-symbol notices land there). */
    toast(message: string, kind: 'info' | 'success' | 'error', durationMs?: number): void;
}
/** One live manifest/external instance and, when it deviates from declaration
 *  defaults, the values it was restored with or dropped holding. */
interface CellInstance {
    entry: ResolvedIndicator;
    handle: IndicatorHandle | null;
    /** The id the indicator runs under on the chart — recorded on the first add (host-
     *  supplied or minted) so an undo/redo resurrection re-adds it under the SAME id:
     *  whatever a host keyed on it (a document, an editor tab) keeps pointing at it. */
    id?: string;
    external?: boolean;
    values?: {
        inputs?: Record<string, InputValue>;
        props?: Record<string, InputValue>;
    };
}
declare class ChartCell {
    readonly id: string;
    private readonly deps;
    /** The grid item this cell renders into (owned; removed on destroy). */
    readonly host: HTMLElement;
    /** This cell's unified app+drawings undo timeline (the shared Ctrl+Z routes here). */
    readonly history: WidgetHistory;
    /** Live manifest-indicator instances on this cell (the SAME entry may repeat).
     *  `external` marks instances added through the public seam (`ctx.addIndicator`)
     *  rather than the shell manifest — they share the undo/redo and picker plumbing
     *  but stay OUT of the persisted ledger (their names would never resolve against
     *  the manifest); persisting them is their plugin's job (`registerStatePersistence`). */
    readonly instances: CellInstance[];
    /** The native-indicator catalog with this cell's live supported/present flags. */
    nativeCatalog: CellNativeInfo[];
    /** Last crosshair position in this cell (the alt+H/alt+V shortcuts anchor here). */
    lastCrossTime: number | null;
    lastCrossPrice: number | null;
    /** The bottombar range chip this cell is framed on (null = none). */
    activeRangeId: string | null;
    /** Latched verdict of {@link sessionAvailable} (async metadata, sticky per symbol). */
    private sessionAvailableFlag;
    /** The symbol of the most recent metadata probe — an older one landing late is dropped. */
    private metadataProbeSymbol;
    /** Latched: the symbol's extended tape wraps midnight (an overnight roll market) —
     *  one extended-hours shading phase instead of the pre/post split. */
    private sessionOvernightFlag;
    /** Latched: the symbol's own trading zone (`SymbolInfo.timezone`) — what the exchange
     *  rule resolves to on this cell. Undefined until metadata lands or when none is declared. */
    private exchangeZone;
    private inner;
    /** The live app theme — seeded from deps, updated on `theme:changed` (the base the
     *  plot-overlay tokens re-derive from). */
    private appTheme;
    private readonly statusline;
    /** Keeps this cell's market badge on the symbol's real calendar (see {@link MarketStatusTracker}). */
    private readonly marketStatus;
    /** Keeps the session shading on the symbol's real calendar (see {@link SessionShadingTracker}). */
    private readonly sessionShading;
    private readonly watermark;
    /** Bottom-center hover cluster, pinned to the price plot: drag handle, zoom in/out, maximize/restore, reset view. */
    private readonly cellControls;
    private readonly contextMenu;
    private readonly offMarket;
    /** The cell's durable market state — the seed vocabulary plus the venue mirror the
     *  persisted document carries (`provider` = the symbol's parsed prefix). */
    private state;
    private manifest;
    /** A restored ledger's manifest entry NAMES, waiting for the manifest to resolve
     *  (a pool/persisted cell can be built before the shared manifest has loaded). */
    private pendingManifestNames;
    /** The volume auto-add rides the cell's first candles (`load:end`); until then the
     *  registry can't show it and the dehydrated ledger reports the INTENT instead. */
    private volumeMayBePending;
    /** Volume intent: the seed's ledger, else the workspace `volume` option — a
     *  rehydrated ledger overwrites it (see {@link applyIndicatorLedger}). */
    private volumeIntent;
    /** Sync mirror of the chart's native instances (id + type) — the removal handler
     *  looks the removed id up here to learn which type an undo must re-add. */
    private presentNatives;
    private rangeBars;
    private pendingRange;
    /** Last symbol we toasted "no provider serves this" for — once per symbol (the
     *  core re-reports on every provider-index settle). */
    private unresolvedToasted;
    /** The cell's third-party state bag (`ext` of the persisted per-chart state) —
     *  seeded from the boot/restored document, refreshed by handler `serialize` calls at
     *  dehydrate time. Entries with no registered handler this session ride along
     *  verbatim, so a document never loses a plugin's state in the plugin's absence. */
    private extState;
    private watermarkOn;
    private replayWatermarkOn;
    /** Indicator titles (this cell's in-chart legend rows) shown. */
    private indicatorTitlesOn;
    /** Plot values beside this cell's legend titles shown. */
    private indicatorValuesOn;
    private destroyed;
    constructor(id: string, gridHost: HTMLElement, seed: CellBoot, deps: CellDeps);
    /**
     * Project a market identity into the cell state and its display overlays (watermark,
     * statusline), WITHOUT the data-dependent bookkeeping. Runs twice per user pick: once
     * optimistically from the cell setters — the labels reflect the pick immediately, not
     * after the bars load — and again from `market:changed` (the committed pass, and the
     * only pass for host `chart.setMarket` calls). Idempotent, so the double run converges.
     */
    private projectMarket;
    /**
     * Does this cell's market HAVE sessions (RTH/ETH meaningful)? Derived from the
     * symbol's own metadata (`syminfo.session !== '24x7'`), asynchronously — the
     * workspace re-projects the shared bottombar when the verdict lands or changes.
     */
    get sessionAvailable(): boolean;
    /** This cell's shown session (`regular` when unset — the provider default). */
    get session(): MarketSession;
    /** Switch this cell's shown session in place (a reload — RTH and ETH are different bars). */
    setSession(session: MarketSession): void;
    /**
     * The symbol's own trading zone, once its metadata has landed — what the exchange
     * rule resolves to on this cell (the workspace labels the shared bottom bar with the
     * ACTIVE cell's). Undefined = unknown or undeclared (the rule then renders UTC).
     */
    get exchangeTimezone(): string | undefined;
    /** The IANA zone this cell's axis renders in: the workspace choice, resolved. */
    get displayTimezone(): string;
    /**
     * Push the resolved zone to the renderer — on the workspace choice changing, and on
     * this cell's market zone changing under the exchange rule. Skips the write when the
     * renderer already holds it (its config default is the bare `'UTC'` alias).
     */
    applyTimezone(): void;
    /** Re-read the symbol's metadata: session posture (RTH/ETH toggle, shading) and its
     *  trading zone (the exchange rule). Async — the workspace re-projects when a verdict lands. */
    private refreshSymbolMetadata;
    /** (Re)derive the pre/post-market shading bands for this cell's market. The bands
     *  expand locally from the symbol's session vocabulary, so they paint as soon as
     *  metadata is known and follow any pan depth without provider round trips. */
    private refreshSessionShading;
    /** The session-shade colors live in the renderer CONFIG (persisted with it, edited
     *  live by the dialog swatch) — the cell only proxies them into its settings rows. */
    private sessionShadeColor;
    private setSessionShadeColor;
    /**
     * (Re)contribute this cell's settings-dialog sections: status line parts, the
     * per-cell fetch depth, the watermark toggle, and — only while the cell's symbol
     * HAS sessions — the Trading session group (RTH/ETH switch + the session shading
     * colors: pre/post-market on day-split tapes, one extended-hours swatch on
     * overnight roll markets) inside the Symbol tab. Bars/watermark/titles are
     * persistable cell state; a depth-only reload is silent, so mark dirty here.
     * Re-run whenever a gate changes (the dialog reads the sections on open).
     */
    private pushSettingsSections;
    /** Show/hide this cell's symbol watermark (persisted per cell). */
    setWatermarkVisible(visible: boolean): void;
    /** Show/hide the "Replay" line under this cell's watermark while it replays (persisted per cell). */
    setReplayWatermarkVisible(visible: boolean): void;
    /** Show/hide this cell's indicator titles — the in-chart legend rows (persisted per cell). */
    setIndicatorTitlesVisible(visible: boolean): void;
    /** Show/hide the plot values beside this cell's legend titles (persisted per cell). */
    setIndicatorValuesVisible(visible: boolean): void;
    /** Show/hide one status-line segment (the settings dialog's Status line tab). */
    private setStatuslinePart;
    /** This cell's Status line tab and watermark prefs as one bundle (see {@link CellStatusPrefs}). */
    statusPrefs(): CellStatusPrefs;
    /** Converge this cell's Status line tab and watermark prefs to `prefs` — the
     *  follower half of the workspace's style link. Idempotent: matching values change
     *  nothing, so a propagated echo dies on its own. */
    applyStatusPrefs(prefs: CellStatusPrefs): void;
    /** The LIVE chart of this cell — never cache it across a layout change (the cell's
     *  identity is what endures; the chart dies with the cell). */
    get chart(): Vela;
    get symbol(): string;
    get timeframe(): string;
    get priceStyle(): string;
    /** Manifest instances + native instances — the topbar indicator count. */
    get indicatorCount(): number;
    /** Switch this cell's market in place (the chart instance survives). The projection
     *  is OPTIMISTIC — labels and chrome show the pick before the bars load; it follows
     *  the setMarket call so the statusline reads the already-blanked chart. */
    setSymbol(symbol: string): void;
    setTimeframe(timeframe: string): void;
    /** Applied live (renderer feature) — no reload. */
    setPriceStyle(style: string): void;
    /** OHLC/change ink in the status line follows the ACTIVE price style's configured
     *  colors and direction rule (candle bodies by close-vs-open, baseline by position
     *  against the live baseline price, …) instead of the fixed theme tokens. */
    private syncStatuslineColors;
    /** Multi-cell grids keep the status line on one row and hide what doesn't fit —
     *  the workspace flips this with the layout (see Statusline.setFitMode). */
    setStatuslineFit(on: boolean): void;
    /** The workspace shell keeps the app theme; the cell host's tokens re-derive from
     *  the LIVE plot surface for overlay ink (statusline, watermark). Menus portal to
     *  `.vela-ui` and keep the app-theme surface (see {@link applyPlotOverlayTokens}). */
    private syncPlotOverlayTokens;
    /**
     * Frame a bottombar range chip: switch to its timeframe, fetch the depth its window
     * needs, and keep it framed (re-asserted once the deeper history is painted).
     */
    applyRange(preset: RangePreset): void;
    /** Reset this cell's view: re-enable auto scale and frame the full history —
     *  the same action the chart context menu offers. */
    resetView(): void;
    /** Rebuild the view-controls cluster (the maximize gate or state changed). */
    refreshControls(): void;
    /** Mobile flips the per-cell cluster off (the shell's mobile bar replaces it). */
    setControlsSuspended(on: boolean): void;
    /** Make this cell the active one and put keyboard focus on its chart surface. */
    focus(): void;
    /** Raster of this cell's chart (same pixels as the PNG download), or null. */
    screenshotCanvas(): HTMLCanvasElement | null;
    /** Download this cell's chart as a PNG (named after its market). */
    downloadScreenshot(): void;
    /**
     * Hand the cell the workspace's resolved manifest. A RESTORED ledger (pool or
     * persisted state) re-adds its recorded entries by name — held until the manifest
     * actually carries them. Otherwise `seedEnabled` auto-adds the manifest's `enabled`
     * entries (fresh cells only).
     */
    setManifest(list: readonly ResolvedIndicator[], seedEnabled: boolean): void;
    /**
     * Replace the indicator ledger: natives converge to the listed set (volume
     * included — removing it sticks, the core's auto-add respects the opt-out), and
     * manifest instances are re-created by name, held until the shared manifest
     * resolves. Convergence is state application, not user edits — nothing enters the
     * undo timeline.
     */
    private applyIndicatorLedger;
    /** The supported natives in picker order: A→Z by title — registration order follows
     *  the catalog's families, which is meaningless to the reader. This is the library
     *  index space the picker hands back, so `libraryRows` and `addFromLibrary` MUST both
     *  read it — indexing the unsorted catalog on add would land on a different study. */
    private supportedNatives;
    /** The picker's library rows: supported natives first (see {@link supportedNatives}),
     *  then the manifest in the host's own order. */
    libraryRows(): Array<{
        name: string;
        language?: string;
        category?: string;
        native?: boolean;
        nativeType?: string;
        beta?: boolean;
    }>;
    /** The picker's on-chart rows: native instances first, then live script instances. */
    onChartRows(): Array<{
        name: string;
        language?: string;
        native?: boolean;
        nativeType?: string;
    }>;
    /** Add by picker LIBRARY index (natives precede the manifest — mirrors libraryRows). */
    addFromLibrary(index: number): void;
    /** Remove by picker ON-CHART index (native instances precede script instances — mirrors onChartRows). */
    removeFromChart(index: number): void;
    /**
     * Add a script indicator through the PUBLIC seam (`ctx.addIndicator`) — same undo/
     * redo and picker plumbing as a manifest entry, but flagged `external` so the
     * persisted ledger never records a name the manifest can't resolve (the plugin owns
     * persistence via `registerStatePersistence`). Recording follows the ambient mute:
     * a persistence handler's `restore` runs silently, a user-driven call records.
     */
    addExternalIndicator(entry: ExternalIndicatorEntry): void;
    /** Add ONE instance of a manifest entry (repeatable — duplicates are legitimate). */
    addManifestInstance(entry: ResolvedIndicator, opts?: {
        record?: boolean;
        external?: boolean;
        id?: string;
        inputs?: Record<string, InputValue>;
        props?: Record<string, InputValue>;
        hidden?: boolean;
    }): void;
    private removeInstance;
    private dropInstance;
    /** Add a native indicator. A multi-instance type gets a fresh instance every time; a
     *  single-instance type already on the chart hands back its existing one — nothing
     *  changed, so nothing enters the undo timeline. */
    /**
     * Converge one native handle to a restored ledger entry: every schema key gets the
     * entry's value or its declaration default (the DOCUMENT is the truth — a live
     * tweak must not survive a restore that says otherwise), and visibility follows
     * the `hidden` flag. Skips the input write when nothing differs — `setInputs`
     * re-runs the indicator, and a no-op restore must not flicker every native.
     */
    private applyNativeLedgerEntry;
    addNative(type: string): void;
    private removeNative;
    /** The chart's native instances, insertion order — the picker's on-chart rows and
     *  the removal index space (script instances follow them). */
    private nativeHandles;
    /** Sync mirror of the chart's native instances — the removal handler looks the
     *  removed id up here (the registry has already forgotten it) to record its type. */
    private syncPresentNatives;
    /** Refresh the native catalog (supported/present flags) for this cell's market. */
    refreshNativeCatalog(): void;
    private addToChart;
    /** The cell-bound surface persistence handlers work against (built per call — the
     *  widget-context rule; nothing here may be cached by a handler). Its add methods
     *  are ALWAYS muted — a `restore` that fetches before adding escapes the sync mute
     *  of {@link restorePersistedExt}, and a state application must never enter the
     *  undo timeline, however late its continuation lands. */
    private stateContext;
    /**
     * Run the registered cell-scope `restore` handlers against the cell's restored
     * `ext` bag — the workspace calls this AFTER the core state is in place (chart
     * alive and wired, indicator ledger converged). Muted: nothing a restore does
     * enters the undo timeline. Handlers only see keys the document carries; a failing
     * handler is contained (one broken plugin must not take the cell down).
     */
    restorePersistedExt(): void;
    /** Assemble the cell's `ext` bag: fresh handler snapshots merged OVER the preserved
     *  entries — a key with no handler this session rides along verbatim; a registered
     *  handler returning `undefined` withdraws its entry. */
    private dehydrateExt;
    /**
     * Apply a restored cell state IN PLACE — the chart instance survives (the market
     * switches via `setMarket`) while cosmetics, renderer config, drawings, and the
     * indicator ledger converge to the document. The workspace takes this path when a
     * state document lands on a grid of the same shape (async-storage boot, host
     * `applyState`), so chart references, indicator handles, event subscriptions, and
     * the cell host all stay valid.
     */
    rehydrate(cs: CellState): void;
    /** Snapshot everything the pool needs to restore this slot later. The market fields
     *  come from the LIVE config (`chart.market`) — the requested identity — so a switch
     *  still loading when the snapshot is taken (persist-on-close) is not lost. */
    dehydrate(): PooledCellState;
    destroy(): void;
}

/** The workspace replay's events — the chart `replay:*` events, reported for the ACTIVE cell. */
interface WorkspaceReplayEventMap extends Record<string, unknown> {
    'replay:start': VelaEventMap['replay:start'];
    'replay:step': VelaEventMap['replay:step'];
    'replay:tick': VelaEventMap['replay:tick'];
    'replay:play': VelaEventMap['replay:play'];
    'replay:pause': undefined;
    'replay:end': VelaEventMap['replay:end'];
}
/** Options for {@link WorkspaceReplay.start}. */
interface WorkspaceReplayStartOptions {
    /** Epoch ms, read on `cell`'s chart as `chart.replay.start({ from })` reads it: that chart
     *  keeps every bar opened at or before it. The close of its last kept bar becomes the
     *  shared replay time, and every other chart keeps the bars closed by then. */
    from: number;
    /** The cell `from` is read on (default: the active cell). */
    cell?: string;
}
/** What the controller reads from its workspace. */
interface WorkspaceReplayHost {
    cells(): ReadonlyArray<{
        readonly id: string;
        readonly chart: Vela;
    }>;
    activeId(): string | null;
    onCells(handler: (e: {
        kind: 'created' | 'destroyed' | 'active';
        id: string;
    }) => void): () => void;
}
/**
 * The workspace's bar-replay control surface (`workspace.replay`, `ctx.replay` for
 * contributions): the same verbs as `chart.replay`, applied to every cell on a shared
 * clock. A step moves the clock to the next bar close on ANY chart, and each chart reveals
 * the bars closed by then — so the finest timeframe sets the pace and a coarser chart
 * shows its bar when it completes. Cells added while replaying join at the shared time; a
 * cell switching symbol rejoins once its new bars load; a timeframe switch keeps the
 * cell's place. The replay ends on every chart together: `stop()`, or any chart reaching
 * its last bar. In a multi-chart layout bars are revealed whole (tick replay needs a
 * single-chart layout).
 */
declare class WorkspaceReplay {
    private readonly host;
    private readonly bus;
    /** The running session: the shared replay time (every chart shows the bars closed by it). */
    private session;
    private playing;
    private intervalMs;
    private timer;
    /** Cells whose replay a symbol switch ended — restarted at the shared time once their bars land. */
    private readonly rejoining;
    private readonly cellSubs;
    private readonly offHost;
    /** Inside a group step: chart events are the controller's own doing. */
    private stepping;
    /** Inside `finish`: the charts' `replay:end` events are the controller's own doing. */
    private stopping;
    /** Driving a chart's own timer: its play/pause events are not the user's. */
    private muted;
    /** A chart finished during a group step — the session ends right after it. */
    private finishedDuringStep;
    constructor(host: WorkspaceReplayHost);
    /**
     * Enter replay on every cell (or seek, when already replaying) — paused. Resolves once
     * every chart shows its rewound history (a chart whose history does not reach that far
     * loads older bars first). A chart with nothing to replay after the shared time stays
     * as it is.
     */
    start(opts: WorkspaceReplayStartOptions): Promise<void>;
    /** Reveal the next bar(s): the clock moves to the next bar close on any chart. Returns false when nothing is left. */
    step(): boolean;
    /** Reveal the next update — in a single-chart layout, the chart's `stepUpdate()` (tick replay); otherwise {@link step}. */
    stepUpdate(): boolean;
    /** Advance one update every `intervalMs` (default: the last pace, initially 1000). Calling it again while playing changes the pace. */
    play(intervalMs?: number): this;
    pause(): this;
    /** Leave replay on every chart: full history back, live updates resumed. */
    stop(): this;
    /** `active`/`playing`/`intervalMs` for the whole workspace; the cursor fields read the ACTIVE cell's chart. */
    get state(): ReplayState;
    /** The active cell's replayable history (`chart.replay.bounds`). */
    get bounds(): ReplayBounds | null;
    on<K extends keyof WorkspaceReplayEventMap>(event: K, handler: (payload: WorkspaceReplayEventMap[K]) => void): () => void;
    destroy(): void;
    /** The one chart of a single-chart layout — it replays on its own, tick replay included. */
    private solo;
    private activeChart;
    /** Rewind one chart to the shared time: every bar that closed by `clock`, none after. */
    private startCell;
    /** Move the clock to the next bar close on any chart; each chart reveals what closed by then. */
    private stepGroup;
    /** Put the timers in the state `playing` asks for: a single chart runs its own (it paces
     *  ticks), several run on the controller's clock. */
    private syncPlayback;
    private schedule;
    private clearTimer;
    /** End the session on every chart (idempotent). */
    private finish;
    private watch;
    private onCellCreated;
    private onCellDestroyed;
}
/** When a bar opened at `open` closes on `timeframe` — calendar months for month-based ones. */
declare function barClose(open: number, timeframe: string | undefined): number;
/** The latest open whose bar has closed by `time` on `timeframe` (the inverse of {@link barClose}). */
declare function lastOpenClosedBy(time: number, timeframe: string | undefined): number;

/** The extended context a workspace hands to contributed actions/attachments. */
interface WorkspaceWidgetContext extends WidgetContext {
    /** Every live cell (layout order) — id + LIVE chart + its market. A LIVE getter
     *  (fresh array per read): read it at the point of use, never keep the array. */
    cells: ReadonlyArray<{
        id: string;
        chart: Vela;
        symbol: string;
        timeframe: string;
    }>;
    /** LIVE getter — follows every active-cell switch. */
    activeCellId: string;
    setActiveCell(id: string): void;
    /** Bar replay across every cell on one clock (`workspace.replay`) — drive this rather
     *  than one cell's `chart.replay`, so every chart replays together. */
    replay: WorkspaceReplay;
}

/** One registered workspace layout. */
interface LayoutDefinition {
    /** Stable id (`'4'`, `'2h'`, a plugin's `'6-tall'`, …) — re-registering replaces. */
    id: string;
    /** Human-readable label for layout pickers. */
    label: string;
    /** Column track weights (`fr` units), left to right. */
    cols: number[];
    /** Row track weights, top to bottom. */
    rows: number[];
    /**
     * Optional `grid-template-areas` rows for ASYMMETRIC layouts — one string per row,
     * one area name per column (e.g. `['main a', 'main b']` = a tall left cell besides
     * two stacked ones). Omitted ⇒ cells auto-flow row-major in `cells` order.
     */
    areas?: string[];
    /** The layout's SLOTS, in order — pure geometry: `id` keys the slot's grid styles
     *  and `area` binds it to a named area. A slot id is NOT a cell identity: the cell
     *  living in slot i is decided by the workspace (its `cells` declaration order),
     *  so two layouts sharing slot geometry need no id coordination. Built-ins use
     *  `c1`…`cN`. */
    cells: Array<{
        id: string;
        area?: string;
    }>;
}

/** Register (or replace) a workspace layout. Pickers read the registry live. */
declare function registerLayout(def: LayoutDefinition): void;
declare function unregisterLayout(id: string): void;
/** The definition behind a layout id (undefined for unknown ids). */
declare function layoutDefinition(id: string): LayoutDefinition | undefined;
/** Every registered layout (registration order) — drives layout pickers. */
declare function layouts(): LayoutDefinition[];
/** Register the built-in presets (idempotent — called by the workspace entry point). */
declare function registerBuiltinLayouts(): void;
/** Picker canvas bound — dynamic layouts stay within a 4×4 grid (16 cells, the
 *  workspace's dormant-state pool capacity). */
declare const GRID_PICKER_MAX = 4;
/**
 * The layout for a UNIFORM rows×cols grid (Grid picker mode), clamped to the
 * picker canvas. Geometry matching a registered classic preset returns that preset
 * (id `'4'`, `'2h'`, …); anything else synthesizes a `g<rows>x<cols>` definition.
 */
declare function layoutForGrid(rows: number, cols: number): LayoutDefinition;
/**
 * Resolve a layout id to its definition, synthesizing the picker's dynamic ids
 * (`g<rows>x<cols>`) when they are not registered — the boot path for persisted
 * picks. Unknown ids stay undefined.
 */
declare function ensureLayout(id: string): LayoutDefinition | undefined;
/** A layout's shape on the picker canvas. */
type LayoutShape = {
    rows: number;
    cols: number;
};
/**
 * The picker-canvas shape of a layout: `{rows, cols}` for uniform grids, `null`
 * when the layout is not expressible on the canvas (bespoke plugin presets) —
 * pickers list those as labeled rows instead.
 */
declare function layoutShape(def: LayoutDefinition): LayoutShape | null;
/** Inline styles for the grid container + each cell — PURE (the workspace applies them). */
declare function gridStyles(def: LayoutDefinition, trackSizes?: TrackSizes): {
    container: Record<string, string>;
    perCell: Record<string, Record<string, string>>;
};
/**
 * The active cell after a layout change: keep it when its slot survives, else fall
 * back to the first slot (the reducer behind `setLayout`; pure for tests).
 */
declare function activeAfterLayout(current: string | null, cellIds: readonly string[]): string | null;

/**
 * The workspace options: the widget's chart vocabulary + the shared shell surface + the
 * grid's own options. Every chart option given TOP-LEVEL (symbol, timeframe, priceStyle,
 * upColor, glow, defaultLanguage, …) is the DEFAULT of each cell — `cells` overrides it
 * per cell with the same words. `height` is the one chart option a grid cannot honor
 * (the layout sizes cells), so it is omitted from the type.
 */
interface VelaWorkspaceOptions extends Omit<VelaOptions, 'height'>, VelaShellOptions {
    /** Initial layout — a registered id (`'1'`, `'2h'`, `'2v'`, `'4'`, `'8'`, or a
     *  plugin-registered one) or an inline definition. Default `'4'`.
     *
     *  `false` = SINGLE-CHART mode: the grid is pinned to the one-cell layout, the
     *  layout picker disappears from the topbar and the mobile drawer (the sync
     *  switches with it — meaningless with one cell), `setLayout` becomes a no-op,
     *  and a restored document keeps only its first chart live (the rest stays
     *  dormant in the pool). No `cells` entry is needed — the top-level chart
     *  options seed the single chart. */
    layout?: string | LayoutDefinition | false;
    /** Per-cell overrides of the top-level chart defaults, keyed by a FREE-FORM cell
     *  name — the name is the cell's durable IDENTITY (persistence, `sync` groups,
     *  `ws.cell(name)`), never its position: DECLARATION ORDER fills the layout's
     *  slots (first declared → first slot). Fewer entries than slots ⇒ the remaining
     *  slots boot on the defaults (auto identity); more ⇒ the extras wait in the pool
     *  and appear when a larger layout reveals them. Purely-numeric names are rejected
     *  (JS object keys would reorder them). Same vocabulary as the widget, reduced to
     *  the per-cell seeds ({@link CellSeed}). */
    cells?: Record<string, CellSeed>;
    /** The ONE shared drawing toolbar, docked left of the grid and acting on the active
     *  cell (per-cell in-chart bars stay hidden either way; a `drawings` object still
     *  configures tools/persistence per cell). Default true. */
    drawingToolbar?: boolean;
    /** Sync links between cells: per kind, `true` = all cells, or a `{cellId: group}`
     *  record (only same-group cells follow each other). `crosshair` mirrors the
     *  pointer time as ghost crosshairs on the followers (also toggleable from the
     *  layout dropdown); `style` mirrors Canvas, Scales-and-lines, and Status line
     *  settings (same dropdown); `drawings` copies each newly created drawing onto
     *  the followers and keeps the set linked — edits and removals follow (also
     *  toggleable from the shared drawing toolbar). Default: everything off.
     *  Change at runtime via `ws.sync.set(kind, setting)`. */
    sync?: SyncOptions;
    /** Above this many cells, EVERY cell uses the canvas2d backend (uniform look inside
     *  the browser's WebGL-context budget; glow is unavailable there). Default 8; an
     *  explicit `nativeBackend` other than `'auto'` wins over this policy. */
    maxWebglCells?: number;
    /** How many alerts the topbar bell keeps (the oldest drop beyond it). Default 50. */
    alertCap?: number;
}
/** A cell's {@link ScriptRun}, tagged with the cell it ran in. */
type WorkspaceScriptRun = ScriptRun & {
    cell: string;
};
interface WorkspaceEventMap extends Record<string, unknown> {
    /** The active cell changed (click/focus in a cell, or `setActiveCell`). */
    'cell:active': {
        id: string;
        prev: string | null;
    };
    /**
     * A script computed in ANY cell — the per-chart `script:run` relayed up with its cell
     * identity, so one subscription covers the whole grid, cells added by a later layout
     * change included.
     */
    'script:run': WorkspaceScriptRun;
    /**
     * One cell's price style is switching `from` → `to` — the per-chart
     * `priceStyle:change` relayed up with the cell's identity, so one subscription
     * covers the whole grid, cells added by a later layout change included. Only the
     * cell whose style changes emits. Same timing as the chart event: synchronous,
     * before that cell repaints, so `ws.cell(id).priceStyle` and the cell's canvas
     * still show `from` while the listener runs.
     */
    'cell:priceStyle': {
        id: string;
        from: string;
        to: string;
    };
    /** The grid switched layouts (cells created/destroyed/restored around it). */
    'layout:changed': {
        layout: string;
    };
    /** A cell was maximized over the whole grid, or the grid restored (`id: null`). */
    'cell:maximized': {
        id: string | null;
    };
    'cell:created': {
        id: string;
    };
    'cell:destroyed': {
        id: string;
    };
    /** The persistable state changed (debounced ~500ms) — re-pull `getState()` if you
     *  consume it. The signal custom persistence flows build on. */
    'state:changed': undefined;
}
declare class VelaWorkspace {
    readonly root: HTMLElement;
    /** The shortcut system — one manager for the whole workspace, routed to the active cell. */
    readonly keymap: KeymapManager;
    /** Bar replay across every cell on one clock (see {@link WorkspaceReplay}). */
    readonly replay: WorkspaceReplay;
    private readonly gridEl;
    private readonly stripsEl;
    private readonly events;
    private readonly feed;
    private readonly cellsById;
    /** The one second pulse behind every time display: the bottom-bar clock and each
     *  cell's countdown chip subscribe to it, so they can never read different seconds. */
    private readonly clock;
    private readonly pool;
    private readonly trackSizes;
    private readonly splitters;
    private readonly resizeObserver;
    private readonly opts;
    private def;
    /** Cell identities by SLOT POSITION — `order[i]` lives in the layout's i-th slot.
     *  Names come from the `cells` declaration order (then the persisted document);
     *  slots beyond the list get auto identities. Grows, never reorders. */
    private order;
    private activeId;
    /** The cell maximized over the whole grid (null = normal grid). TRANSIENT view
     *  state — never persisted; any structural change (layout, applyState) restores. */
    private maximizedId;
    private cellBackend;
    /** `layout: false` — the grid is pinned to the one-cell layout, the layout picker
     *  and sync switches never render, and `setLayout` no-ops. */
    private readonly monoLayout;
    /** `drawings: false` — the whole user-drawings surface is gone: no shared bar, no
     *  mobile drawings stop, no pill (the headless `chart.drawings` API stays). */
    private readonly drawingsEnabled;
    /** The shared bar's content — `drawings: { tools | groups }` picks it. */
    private readonly toolbarDef;
    private destroyed;
    private readonly topbar;
    private readonly bottombar;
    private readonly objectTree;
    private readonly dataWindow;
    /** The side-panel column, shared by the whole grid. */
    private readonly dock;
    private readonly symbolPicker;
    /** Null when the host disabled it (`indicatorPicker: false`). */
    private readonly indicatorPicker;
    private readonly tfQuick;
    private shortcutsHelp;
    private readonly toastHost;
    private readonly glider;
    private readonly drawToolbar;
    /** The GLOBAL armed tool/magnet/stay (workspace policy) — re-applied to whichever cell
     *  takes the focus; only the ACTIVE cell ever holds a non-null tool. Measure/eraser
     *  stay transient and per-cell: they exit when the focus leaves. */
    private globalTool;
    private globalSnap;
    private globalStay;
    /** Live subscription to the ACTIVE cell's unified history (rebound on every projection). */
    private historyUnsub;
    /** Favorite drawing tools — a WORKSPACE preference (one star set, every cell). */
    private favs;
    /** Every drawing tool's remembered settings — a SHARED pref, mirrored onto every cell. */
    private toolDefs;
    /** Every drawing tool's saved looks — a SHARED pref like the remembered settings. */
    private toolTemplates;
    /** Re-entrancy guard while one cell's remembered settings fan out to the others. */
    private toolDefsBusy;
    /** Favorite timeframes — the shared topbar's quick-switch chips, one set for the grid. */
    private tfFavs;
    /** Live sync configuration (mutable copy of the option). */
    private readonly syncOpts;
    private readonly persistKey;
    private readonly storage;
    private stateTimer;
    /** Re-entrance guard for {@link flushPendingState}: a `state:changed` subscriber that
     *  calls back into the workspace (`destroy()` on save is the obvious one) must not
     *  re-enter the flush and recurse. */
    private emitting;
    /** False until the constructor finishes. Boot is not an edit: seeding the sync
     *  settings marks state dirty, so without this a workspace mounted and torn down
     *  inside the debounce window would flush and tell the host the user had changed
     *  something — a save of the default document over whatever was stored. */
    private booted;
    /** A page unload gets the same flush as a teardown — the pending edit reaches the
     *  host, the timer is cleared, and a `destroy()` that follows adds no second write. */
    private readonly onUnload;
    /** Re-entrance guard around one propagation tick: followers' synchronous echoes
     *  (their setVisibleRange re-emits viewport:changed) must not re-propagate. */
    private syncBusy;
    /** Same guard for the drawings link: the propagated mutations' own `drawing:*`
     *  events fire synchronously inside the propagation loop and must not fan out again. */
    private drawingSyncBusy;
    /** Same guard for the style link: a follower's `applyConfig` re-fires its
     *  `onConfigChanged` in the same tick, and a state restore applies per-cell
     *  configs that legitimately differ — neither must propagate. */
    private styleSyncBusy;
    /** LINKED drawings (the drawings sync): one map per synced set (cellId → that
     *  cell's drawing id), reachable from every member under its `cellId\0drawingId`
     *  key — any member finds its peers to push edits/removals onto. Survives a
     *  toggle-off (propagation freezes while the setting is off; re-enabling resumes
     *  edit/delete for these pairs). Cleared on reload / `applyState`. */
    private readonly drawingLinks;
    private manifest;
    /** The shared manifest can no longer change instance sets — resolved, or no
     *  `indicators` option so nothing ever will. Gates the cells' ledger fallback. */
    private manifestSettled;
    private timezone;
    private openDialogs;
    private alerts;
    /** Bell retention — `alertCap` option, default {@link ALERT_CAP}. */
    private readonly alertCap;
    private alertsMenu;
    /** Writes `data-layout` on the root and pushes mode flips into every cell's renderer. */
    private layoutCtl;
    private readonly mobileBar;
    private readonly drawingPill;
    private tfDrawer;
    private drawingsDrawer;
    private moreDrawer;
    private timezoneDrawer;
    private priceScaleDrawer;
    /** Plot-local y of the last price-axis long-press (targets the pane under the finger). */
    private priceScalePressY;
    private readonly attachmentDisposers;
    /** The resolved topbar composition — one visibility truth for topbar, mobile, keys. */
    private topbarComp;
    /** Built-in slots taken over by a contributed action (resolved at construction —
     *  the register-at-import-time contribution rule). The override owns the slot's
     *  WHOLE surface: desktop button, mobile counterpart, keyboard chord. */
    private indicatorsOverride?;
    private screenshotOverride?;
    /** The document-level third-party state bag (`state.ext`) — seeded from the restored
     *  document, refreshed by global-scope handler `serialize` calls at snapshot time.
     *  Entries with no registered handler this session ride along verbatim. */
    private extState;
    /** The single grid-wide attribution mark — re-inked on a live theme swap. */
    private attributionMark;
    private readonly onRootKeydown;
    constructor(container: HTMLElement | string, opts?: VelaWorkspaceOptions);
    /** The cell with identity `id` (its declared name, or `c<N>` when undeclared), or
     *  undefined when no live cell holds it. */
    cell(id: string): ChartCell | undefined;
    /** Every live cell, in slot order. Enumerated over `order` — the IDENTITY space —
     *  never the layout's positional slot ids, which only coincide with it for a
     *  workspace whose cells are undeclared. Identities past the current layout size are
     *  pooled, not live, so they drop out here. */
    cells(): ChartCell[];
    /** The ACTIVE cell — the one the shared chrome reflects and acts on. */
    get active(): ChartCell;
    /** Shortcut for `active.chart` — the same habit as `widget.chart`. LIVE: read it at
     *  the point of use; the durable identity to hold is the cell (or its id). */
    get chart(): Vela;
    /**
     * PNG data URL of the visible layout: every live cell in its grid slot, or the
     * maximized cell alone. Same pixels the screenshot button downloads. A single
     * visible cell returns that cell's own chart export (the one-chart case).
     */
    screenshot(): string | null;
    /** Download {@link screenshot} as a PNG. A multi-cell layout is named
     *  `vela-layout.png`; one visible cell keeps `${symbol}-${timeframe}.png`. */
    downloadScreenshot(): void;
    /** Live cells the screenshot should include — maximized siblings are `hidden`. */
    private shotCells;
    /** Place every cell's raster onto one canvas the size of the grid. */
    private compositeLayoutShot;
    setActiveCell(id: string | null): void;
    on<K extends keyof WorkspaceEventMap>(event: K, handler: (payload: WorkspaceEventMap[K]) => void): () => void;
    /** The context handed to contributed actions/attachments (rebuilt per invocation). */
    context(): WorkspaceWidgetContext;
    /** Re-project contributed topbar actions + side panels, and mount late-registered attachments. */
    refreshActions(): void;
    /** The sync-link control surface: `set(kind, true | {cellId: group} | false)`,
     *  `get(kind)`, `state()`. Enabling a market/viewport link aligns the followers to
     *  the ACTIVE cell once, so the grid starts coherent; `crosshair` mirrors the
     *  pointer time as ghost crosshairs on the followers (also a toggle in the layout
     *  dropdown). */
    readonly sync: {
        set: (kind: SyncKind, setting: SyncSetting | false | undefined) => void;
        get: (kind: SyncKind) => SyncSetting | undefined;
        state: () => SyncOptions;
    };
    /**
     * Snapshot the COMPLETE workspace state as a versioned, serializable document:
     * layout + splitter sizes, active cell, sync links, timezone, and — per slot, live
     * AND dormant — the market, the renderer's cosmetic config, the user-drawings
     * document, and the indicator ledger. This is what `persist` writes; hosts build
     * custom flows on it (server snapshots, share links, templates).
     */
    getState(): WorkspaceState;
    /**
     * Restore a state document produced by {@link getState} (untrusted-safe: malformed
     * fields are dropped). When the document matches the live grid one-to-one — same
     * layout, same ordered slot identities — it is applied IN PLACE: every chart
     * instance survives (markets switch via `setMarket`), so chart references,
     * indicator handles, and event subscriptions stay valid. Any structural difference
     * (layout, slot count, renamed ids) falls back to the full rebuild: prefs, sync
     * links, layout, and every slot are replaced, current cells rebuilt from the
     * document. A layout id that is not registered keeps the current grid (register
     * custom layouts first).
     */
    applyState(state: unknown): void;
    /** Run the registered global-scope `restore` handlers against the document-level
     *  `ext` bag — keys present in the document only; a failing handler is contained.
     *  Handlers whose restore touches chart content should be `scope: 'cell'` instead
     *  (those run inside the cell's history-mute). */
    private restoreGlobalExt;
    /**
     * Set the workspace-global display timezone — applied to EVERY cell. An IANA zone,
     * or `'exchange'` (the exchange rule): each cell then renders in its OWN market's
     * zone (Chicago for a CME future, New York for a US equity, UTC for crypto), and the
     * bottom bar follows the active cell's.
     */
    setTimezone(zone: string): void;
    /** Bottom bar ⇐ the stored choice + the ACTIVE cell's market zone (labels the exchange row). */
    private projectTimezone;
    /**
     * Swap the workspace theme at runtime — `'dark'`, `'light'`, or a full custom theme,
     * applied to the shared chrome (topbar, panels, drawing toolbar) and EVERY cell.
     * Also reached from any cell's chart settings → Canvas → Theme. The choice sticks:
     * cells rebuilt by later layout switches reconstruct with it.
     */
    setTheme(theme: NonNullable<VelaWorkspaceOptions['theme']>): void;
    get layout(): LayoutDefinition;
    /**
     * Switch the grid. Cells are diffed BY IDENTITY (`order` head of the next size):
     * surviving cells keep their live charts untouched; cells past the new size
     * dehydrate into the pool; (re)appearing positions hydrate their identity from
     * the pool (or its seed). Crossing the WebGL budget rebuilds every cell through
     * the pool so the backend stays uniform.
     */
    setLayout(layout: string | LayoutDefinition): void;
    /** The identity of the cell maximized over the whole grid, or null. */
    get maximizedCell(): string | null;
    /**
     * Maximize one cell over the whole grid, or restore the layout with `null`. Pure
     * presentation: the other cells stay alive underneath — charts, subscriptions and
     * state untouched — so restoring is instant. The maximized cell becomes the active
     * one. Transient view state (also reachable from each cell's bottom-center view
     * cluster): switching layouts or applying a state document restores the grid.
     */
    maximizeCell(id: string | null): void;
    /** The mobile bar's maximize stop: one press isolates the ACTIVE chart over the
     *  grid; while something is already isolated — the chart, or a pane inside it
     *  (mobile's double-tap) — the press restores that instead. Every branch re-syncs
     *  the stop on its own (`maximizeCell` directly, `panes.maximize` via its
     *  synchronous `pane:changed`). */
    private toggleMobileMaximize;
    /** Keep the mobile bar's maximize stop truthful: lit (inverse chip, restore
     *  glyph) while the active chart covers the grid OR one of its panes is
     *  maximized — the state a double-tap toggles is otherwise invisible on mobile. */
    private syncMobileMaximize;
    /**
     * Trade the SLOTS of two live cells — the grid arrangement changes, the cells
     * themselves (charts, indicators, drawings, the active flag) stay untouched.
     * What each cell's drag handle commits; also callable directly by hosts.
     */
    swapCells(a: string, b: string): void;
    resize(): void;
    /** Show a toast over the grid — the same surface the shell's own notices use
     *  (alerts, script errors) and the one contributions reach via `ctx.toast`. */
    toast(message: string, kind?: 'info' | 'success' | 'error', durationMs?: number): void;
    destroy(): void;
    /** Re-project the shared chrome from the ACTIVE cell. The chrome holds no state of
     *  its own — this is a pure read of the cell, safe to call redundantly. */
    private projectActiveCell;
    /** Put keyboard focus back on the active cell's chart surface (after a toolbar press
     *  stole it) so chart/drawing shortcuts keep working. */
    private refocusActive;
    /** Take a document's drawing-tool prefs as the shared mirrors (cells pick them up as they
     *  are built, or from {@link pushToolDefaults} / the active-cell projection). */
    private adoptDrawingTools;
    /** Mirror the shared remembered settings onto every cell but `from` (the cell they came from).
     *  Receiving them is not an edit: the cells' `drawing:defaults` echoes are ignored. */
    private pushToolDefaults;
    /** The drawing-tool prefs worth saving; null when every one is at its default. */
    private drawingToolsState;
    /** Debounced dirty mark: one `state:changed` (+ one storage write in persist mode)
     *  per burst of edits, flushed hard on unload/destroy. */
    private markStateDirty;
    /**
     * Push a pending debounced change out NOW, for a teardown or a page unload — the
     * two moments the 500ms timer would otherwise never reach.
     *
     * Dropping it was a silent data loss: the timer carries BOTH halves of the dirty
     * signal — the `state:changed` event and the storage write — so a host that saves
     * from that event (a server-backed host, where `persistNow` is a no-op for want of
     * a `persistKey`) simply never heard about the user's last edit.
     *
     * Idempotent and re-entrancy safe, which the ordering here buys:
     *  - a no-op unless a timer is actually pending, so a teardown with nothing
     *    outstanding stays silent and never invents an edit;
     *  - the timer is cleared FIRST, so nothing survives this call and a second call
     *    does nothing — `destroy()` after an unload flush adds no second write;
     *  - the state is snapshotted BEFORE the handlers run, and that snapshot is what
     *    gets persisted, so storage and the host are told the same thing even if a
     *    handler mutates state while it runs;
     *  - `emitting` is held across the emit, so a handler calling back in (a host that
     *    tears down on save is the obvious one) cannot re-enter this and recurse.
     */
    private flushPendingState;
    /** Write the current state through the storage adapter now (fire-and-forget). */
    private persistNow;
    private resolveLayout;
    private backendFor;
    private currentTracks;
    private applyTracks;
    /** Apply the grid template (+ per-cell areas) and reposition the splitter strips.
     *  Geometry is keyed by SLOT (`perCell[slot.id]`); the cell living there is
     *  `order[i]` — the identity/position decoupling in one line. */
    private applyGrid;
    /** Overlay the maximize presentation on the freshly applied grid: EVERY cell spans
     *  the full track grid — the maximized one on top, the siblings invisible beneath
     *  it (their charts stay alive — restoring is instant). The siblings must span too:
     *  left in their slots they would auto-flow into implicit zero-height rows, whose
     *  gaps steal height from the maximized cell and collapse their renderers to 0.
     *  The splitter strips and the active ring hide via the `data-maximized` rules. */
    private applyMaximizePresentation;
    /** Rebuild every cell's view cluster (the maximize gate or state changed). */
    private refreshCellControls;
    /** Drop the transient maximize on a structural change (layout switch, state
     *  document) — WITH the event, so hosts tracking `cell:maximized` never drift
     *  from `maximizedCell`. The caller's own grid re-apply paints the restore. */
    private clearMaximized;
    /** The live cell under a viewport point, excluding `excludeId` and any host a
     *  maximize has hidden — the drag handle's hit-test. */
    private cellAtPoint;
    /** Mark one cell as the live drop target of a grip drag (null clears all) —
     *  the `data-drop-target` stylesheet rule paints the dashed preview ring. */
    private setDropTarget;
    /** The cell whose bottom-left corner the grid's attribution mark floats in — the
     *  maximized cell while one covers the grid, else the bottom-left slot's cell. */
    private bottomLeftCell;
    /** Keep the shared attribution mark inside the BOTTOM-LEFT visible cell: its
     *  offsets ride that cell's renderer-published `--vela-bottom-gutter` /
     *  `--vela-toolbar-gutter`, so collapsed pane strips push the mark up without any
     *  bookkeeping here. Re-run after anything that changes which host that is
     *  (layout switch, maximize, cell rebuild); a destroyed host drops the mark from
     *  the DOM, and this re-mount brings it back. */
    private mountAttributionMark;
    /** Create the cells the current layout wants but don't exist yet (pool-first).
     *  A slot's CELL IDENTITY is `order[i]` (declaration order — never the slot's own
     *  positional id); slots past the declared list mint an auto identity once. */
    private buildCells;
    /** Per-cell chart subscriptions (trigger ② — the chart instance is stable for the
     *  cell's whole life, so these live and die with the cell). */
    private wireCell;
    private applySyncSetting;
    /**
     * Align cells minted by a layout change to their style group: with the link on, a
     * NEW cell (fresh slot or one returning from the pool, which missed edits while
     * dormant) inherits the presentation of a pre-existing group peer — the active
     * cell when it is one — instead of sitting on its own state beside a styled
     * group. Propagation runs FROM the peer, so a newborn's defaults never overwrite
     * the group, and the equality short-circuits keep converged peers untouched.
     */
    private alignNewCellStyles;
    /**
     * Bring cells minted by a layout change into their drawings group: with the link
     * on, a NEW cell (fresh slot, or one returning from the pool that missed edits
     * while dormant) receives the drawings of a pre-existing group peer — the active
     * cell when it is one. A drawing the arriving cell already holds a linked copy of
     * is refreshed in place; any other is copied and linked like a freshly synced
     * drawing, so later edits and removals follow both ways. The arrival is the cell's
     * starting state, not an edit: it stays out of the cell's undo timeline, and the
     * busy guard keeps the copies' own events from fanning back out.
     */
    private alignNewCellDrawings;
    /**
     * Mirror an origin cell's presentation — the style-link slice of its renderer
     * config ({@link styleConfigPatch}) plus its Status line and watermark prefs —
     * onto its same-group followers (the style link). Loop-safe two ways: the busy
     * guard eats the followers' SYNCHRONOUS echoes (their `applyConfig` re-fires
     * `onConfigChanged` in the same tick), and the equality short-circuits leave
     * already-converged followers untouched, so nothing re-emits once the group agrees.
     */
    private propagateStylePrefs;
    /**
     * Mirror an origin cell's pointer time onto its same-group followers as GHOST
     * crosshairs (`renderer.setExternalCrosshair`). The horizontal price level rides
     * along ONLY to followers showing the same ticker — price scales are comparable
     * there, while an origin's price painted on another market's pane would be noise.
     * Leaving the origin propagates `null` (the event already carries it) and clears
     * every ghost. No busy guard needed: an external crosshair never re-emits
     * `onCrosshairMove` — the flow is one-way by port contract, so no echo loop can
     * exist.
     */
    private propagateCrosshair;
    /**
     * Push an origin cell's visible range onto its same-group followers. Loop-safe two
     * ways: the busy guard eats the followers' SYNCHRONOUS echoes (their setVisibleRange
     * re-emits `viewport:changed` in the same tick), and the half-bar epsilon
     * short-circuits any async residue — a follower already within half of ITS OWN bar
     * interval is left alone, so cross-timeframe groups settle instead of oscillating.
     */
    private propagateViewport;
    /**
     * Copy a freshly created drawing onto the origin's same-group followers (fresh ids
     * through `drawings.add` — anchors are time+price, so the copy lands at the same
     * spot whatever the follower shows) and register the whole set as LINKED: edits
     * and removals of any member follow while the link is on ({@link drawingLinks}).
     * The busy guard stops the copies' own `drawing:created` events from fanning out.
     */
    private propagateDrawing;
    /** Mirror an in-progress placement (its current ghost, `null` = placement ended)
     *  onto the origin's same-group followers — the live half of the drawings link;
     *  the created copy replaces the ghosts when the placement completes. One-way by
     *  contract (an external ghost never re-emits drafts), so no busy guard needed. */
    private propagateDraft;
    /** Push a linked drawing's edited CONTENT (anchors, style, text, per-type props)
     *  onto its same-group peers — any member propagates, not just the original. */
    private propagateDrawingEdit;
    /** Remove a linked drawing's peers with it. The removed member always leaves its
     *  link group (whatever the setting); peers are only deleted while the link is on.
     *  A propagated peer removal re-enters here under the busy guard and just cleans
     *  its own link key. */
    private propagateDrawingRemoval;
    /**
     * Push an origin cell's symbol/timeframe onto its same-group followers (fired from
     * `market:changed`). Convergence comes from IDEMPOTENCE, not the guard: a follower's
     * own (async) `market:changed` propagates back, but every peer already carries the
     * value, so the cell setters no-op and the wave dies.
     */
    private propagateMarket;
    /** Trigger ② — a cell's market changed: retention + sync always; chrome only if active. */
    private onCellMarketChanged;
    /** Trigger ② — a cell's price style changed: the topbar button/menu only if active.
     *  Reads the cell back (not the requested style) so the button reflects what the
     *  renderer actually applied. */
    private onCellPriceStyleChanged;
    /** Trigger ② — a cell's indicator ledger changed: count + picker only if active. */
    private onCellIndicatorsChanged;
    /** Timeframe changes routed from the topbar menu / quick entry (chip state follows). */
    private setActiveTimeframe;
    /** Star/unstar a timeframe — a WORKSPACE preference (one chip row, whatever the
     *  active cell); the topbar follows and the set persists with the document. */
    private setTimeframeFavorite;
    /** The mode flipped (container resized across the breakpoint, or a coarse-pointer
     *  change). Close the open surfaces — a desktop card must not linger over the
     *  mobile chrome (and vice versa) — and re-present every cell's own chrome. */
    private onLayoutModeChange;
    /** Push the layout-shape-dependent chrome onto every cell: multi-cell grids keep
     *  the status line on one row (segments that don't fit hide), and on MOBILE their
     *  legends' fold chip routes to the object tree instead of unfolding in place —
     *  per-indicator controls live there (the legend rows have no room in a grid cell). */
    private syncCellPresentation;
    private openTimeframeDrawer;
    private openDrawingsDrawer;
    private openMoreDrawer;
    /** The contributed topbar actions the mobile menu lists, from one cluster. */
    private drawerActions;
    private openTimezoneDrawer;
    private openPriceScaleDrawer;
    /** The aggregated alerts bell — entries carry their cell; selecting one activates it. */
    private openAlertsMenu;
    /** Mount registered attachments not yet mounted on this workspace (idempotent per id). */
    private mountAttachments;
    /** Invoke a slot override the way its button would: fresh context, `when` respected. */
    private runOverride;
    /** The default shortcut set — every binding acts on the ACTIVE cell. */
    private registerDefaultKeys;
    /** Bare-typing router: letters and `0` → symbol search (seeded), digits 1–9 → timeframe entry. */
    private routeTyping;
    private trackDialog;
    /** Pool a dehydrated slot state (bounded — oldest entries drop past the cap). */
    private poolSet;
    /**
     * Declare every live cell's symbol to the shared bar cache so one cell's load never
     * evicts the others' history (multi-symbol retention). Keys are CANONICAL tickers —
     * resolved through the registry when its indexes are ready, raw until then (refreshed
     * again on `feed.ready()`).
     */
    private refreshRetention;
}

/** Even weights for `n` tracks (the double-click reset). */
declare function evenTracks(n: number): number[];
/**
 * Resize the boundary between tracks `index` and `index+1` by a pixel delta — PURE.
 * The two neighbors trade weight (their sum, and every other track, is preserved);
 * both are clamped so neither drops under {@link MIN_TRACK_FRAC} of the total.
 * `sizePx` is the container's content size along the axis (gaps excluded).
 */
declare function resizeTracks(weights: readonly number[], index: number, deltaPx: number, sizePx: number): number[];
/**
 * Pixel centers of the INTERNAL track boundaries (`n-1` entries) — where the divider
 * strips sit. PURE: cumulative weights over the gap-corrected content size.
 */
declare function trackOffsets(weights: readonly number[], sizePx: number, gapPx: number): number[];

export { type CellBoot, type CellChartDefaults, type CellNativeInfo, type CellSeed, CellState, ChartCell, GRID_PICKER_MAX, type LayoutDefinition, type LayoutShape, type PooledCellState, SyncKind, SyncOptions, SyncSetting, TrackSizes, VelaWorkspace, type VelaWorkspaceOptions, type WorkspaceEventMap, WorkspaceReplay, type WorkspaceReplayEventMap, type WorkspaceReplayHost, type WorkspaceReplayStartOptions, type WorkspaceScriptRun, WorkspaceState, type WorkspaceStorage, type WorkspaceWidgetContext, activeAfterLayout, barClose, ensureLayout, evenTracks, gridStyles, lastOpenClosedBy, layoutDefinition, layoutForGrid, layoutShape, layouts, memoryStorageAdapter, rangesWithin, registerBuiltinLayouts, registerLayout, resizeTracks, syncTargets, trackOffsets, unregisterLayout };
