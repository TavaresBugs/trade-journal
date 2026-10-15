import { D as DataProvider } from './DataProvider-Bw58CjYy.cjs';
import { S as ScriptingEngine, V as Vela } from './contributions-DOm40g5-.cjs';
import { W as WallClock, V as VisibleRangePreset } from './options-CSXbjMM5.cjs';

/** The linkable dimensions. `crosshair` mirrors the pointer time onto same-group
 *  cells as GHOST crosshairs (renderers without the optional `setExternalCrosshair`
 *  seam simply never display one). `drawings` copies each NEWLY CREATED drawing onto
 *  same-group cells and keeps the set linked: edits and removals of any member
 *  follow. Link membership is session-scoped and survives a toggle-off (re-enabling
 *  resumes edit/delete for drawings paired earlier; drawings created while off stay
 *  independent). After a reload, every drawing is unpaired again. `style` mirrors
 *  the chart's presentation settings — the Canvas and Scales-and-lines slice of the
 *  renderer config plus the status-line display prefs — onto same-group cells. */
type SyncKind = 'viewport' | 'symbol' | 'timeframe' | 'crosshair' | 'drawings' | 'style';
/**
 * One link's configuration: `false`/absent = off; `true` = ALL cells linked (one
 * implicit group); a record maps cell id → group name, and only cells sharing a group
 * follow each other (a cell absent from the record is unlinked).
 */
type SyncSetting = boolean | Readonly<Record<string, string>>;
interface SyncOptions {
    viewport?: SyncSetting;
    symbol?: SyncSetting;
    timeframe?: SyncSetting;
    crosshair?: SyncSetting;
    drawings?: SyncSetting;
    style?: SyncSetting;
}
/** Splitter track weights along each grid axis. */
interface TrackSizes {
    cols?: number[];
    rows?: number[];
}
/**
 * The docked side panels — a SHELL-level pref (one dock serves every cell of a workspace).
 * `open` is the single panel showing (the dock is exclusive); `widths` holds only the columns
 * the user actually resized, by panel id, so a panel's declared width stays in charge until
 * then; `pinned` lists the floating (overlay) panels the user pinned as columns. Absent
 * altogether in documents written before the dock existed.
 */
interface PanelsState {
    open?: string;
    widths?: Record<string, number>;
    pinned?: string[];
}
/**
 * The drawing tools' shared preferences — one set per shell, like the favorite stars:
 * each tool's remembered settings (what its next drawing starts from), the magnet, and
 * stay-in-drawing-mode. `defaults` maps a tool type to its settings and passes through
 * opaquely; `drawings.setToolDefaults` validates each entry at restore time.
 */
interface DrawingToolsState {
    defaults?: Record<string, unknown>;
    /** Each tool's saved looks — a list of `{ name, settings }`, by tool type. */
    templates?: Record<string, unknown[]>;
    magnet?: 'off' | 'weak' | 'strong';
    stay?: boolean;
}
/** Per-chart (per-cell) state: the market, the display prefs, the content documents,
 *  and the indicator ledger. The widget's whole chart state is ONE of these. */
interface CellState {
    symbol?: string;
    /** The symbol's venue. Mirrors the symbol's own `EXCHANGE:` prefix on new saves;
     *  pre-prefix documents stored it beside a BARE symbol — {@link prefixedSymbol}
     *  welds the two back into the one canonical form at restore time. */
    provider?: string;
    timeframe?: string;
    priceStyle?: string;
    bars?: number;
    /** Trading session shown (`'extended'` persisted; absent = regular, the default). */
    session?: string;
    /** Symbol watermark visibility — a per-chart display pref. */
    watermark?: boolean;
    /** The "Replay" line under the watermark while replaying — a per-chart display pref. */
    replayWatermark?: boolean;
    /** Indicator titles (the in-chart legend rows) visibility — a per-chart display pref. */
    indicatorTitles?: boolean;
    /** Plot values beside the legend titles visibility — a per-chart display pref. */
    indicatorValues?: boolean;
    /** The renderer's cosmetic config document (`renderer.getConfig()`). */
    rendererConfig?: unknown;
    /** The user-drawings document (`drawings.toJSON()`). */
    drawings?: unknown;
    /** The indicator ledger: manifest entries + native entries. Either side persists
     *  the bare NAME/TYPE when every value sits on its declaration default and the
     *  indicator is visible, else the name/type plus the input(/prop) DELTAS and a
     *  `hidden` flag (defaults are never frozen into documents). */
    indicators?: {
        manifest: PersistedManifestEntry[];
        natives: PersistedNativeEntry[];
    };
    /** Third-party per-chart state, by namespaced key (`'vendor.feature'`) — written and
     *  read by registered state-persistence handlers (`registerStatePersistence`, scope
     *  `'cell'`). Values are OPAQUE here: the codec preserves entries verbatim — a key
     *  whose handler is absent this session still round-trips — and each handler
     *  validates its own payload at restore. JSON-serializable values only. */
    ext?: Record<string, unknown>;
}
/** One persisted manifest-instance entry (see `CellState.indicators`). */
type PersistedManifestEntry = string | {
    name: string;
    inputs?: Record<string, unknown>;
    props?: Record<string, unknown>;
    hidden?: boolean;
};
/** One persisted native-indicator entry (see `CellState.indicators`). The bare TYPE is
 *  the historical shape and still the common case; the object form carries the input
 *  DELTAS and/or the hidden flag so native settings and visibility survive a reload. */
type PersistedNativeEntry = string | {
    type: string;
    inputs?: Record<string, unknown>;
    hidden?: boolean;
};
/** One entry of the document's `charts` array: a chart's state plus its cell IDENTITY. */
interface ChartState extends CellState {
    /** The cell's durable identity — its declared name (`btc`), or `c<N>` for a slot no
     *  entry declared. Unique within the document; array position restores slot order. */
    id: string;
}
/** The versioned shell-state document — everything `applyState` restores. */
interface WorkspaceState {
    version: 1;
    /** The layout id — always `'1'` for a widget. Restoring an id that is not
     *  registered keeps the current layout — register custom layouts
     *  (`registerLayout`) before applying a saved state. */
    layout: string;
    /** Splitter track weights, per layout id (workspace only). */
    trackSizes?: Record<string, TrackSizes>;
    activeCellId?: string;
    /** Sync links (workspace only). */
    sync?: SyncOptions;
    /** Shared display timezone. */
    timezone?: string;
    /** Favorite drawing-tool types — a SHARED preference (one star set per shell). */
    favorites?: string[];
    /** Favorite timeframes (the topbar's quick-switch chips) — a SHARED preference. */
    timeframeFavorites?: string[];
    /** The drawing tools' remembered settings, magnet and stay mode — a SHARED preference. */
    drawingTools?: DrawingToolsState;
    /** The docked side panels: which one is open, and the widths the user dragged. */
    panels?: PanelsState;
    /** Per-chart state, one entry per SLOT (a single `c1` entry for the widget).
     *  Ids are unique — the codec drops id-less entries and keeps the LAST duplicate. */
    charts: ChartState[];
    /** Third-party document-level state, by namespaced key (`'vendor.feature'`) — the
     *  `scope: 'global'` counterpart of {@link CellState.ext}, same opacity contract. */
    ext?: Record<string, unknown>;
}
declare function encodeState(state: WorkspaceState): string;
/** Parse + sanitize a persisted payload. Null on anything unusable (wrong version,
 *  not JSON, not an object) — malformed FIELDS are dropped, never thrown on. */
declare function decodeState(raw: string): WorkspaceState | null;
/**
 * Validate an untrusted state document field by field (the `applyState` gate). Unknown
 * or malformed fields are dropped; nested renderer-config / drawings documents pass
 * through OPAQUELY — their own consumers (`applyConfig`, `fromJSON`) validate them.
 */
declare function sanitizeState(doc: unknown): WorkspaceState | null;

interface IndicatorManifestEntry {
    name: string;
    /** Inline script source (one of script/url required). */
    script?: string;
    /** Fetch the source from here instead (resolved relative to the manifest URL). */
    url?: string;
    /** Engine language (default: the chart's default engine). */
    language?: string;
    /** Add to the chart at startup (default true). Disabled entries only appear in pickers. */
    enabled?: boolean;
    /** Picker grouping (default 'Indicators'). */
    category?: string;
}
type IndicatorManifest = IndicatorManifestEntry[] | {
    indicators: IndicatorManifestEntry[];
};
/** A manifest entry with its source resolved and ready for `chart.addIndicator`. */
interface ResolvedIndicator {
    name: string;
    script: string;
    language?: string;
    enabled: boolean;
    category?: string;
}
/** An async manifest source — called once at resolution time. The escape hatch for
 *  manifests that a URL can't express: a filesystem read, an authenticated API, a
 *  bundler dynamic import. A rejection behaves like a failing manifest URL. */
type IndicatorLoader = () => Promise<IndicatorManifest>;
/** Load the indicator list: a manifest object, a URL string returning the manifest JSON,
 *  or an async loader function returning the manifest. Entries with `url` sources are
 *  fetched here too (relative to the manifest URL when there is one). Entries that fail
 *  to resolve are dropped with a console warning — one broken script must not take the
 *  chart down. */
declare function resolveIndicators(config: string | IndicatorManifest | IndicatorLoader, fetchImpl?: typeof fetch): Promise<ResolvedIndicator[]>;

/** The storage contract BOTH shells persist through (the widget wrapper and the
 *  workspace — one name, one shape). Methods may be synchronous or return promises. */
interface VelaStorage {
    get(key: string): string | null | Promise<string | null>;
    set(key: string, value: string): void | Promise<void>;
    remove?(key: string): void | Promise<void>;
}
/** @deprecated Use {@link VelaStorage} — same contract, shell-neutral name. */
type WidgetStorage = VelaStorage;
/**
 * The default adapter — window.localStorage, silent on quota/privacy failures.
 *
 * `storageKey` pins the PHYSICAL localStorage entry: every read/write lands on that
 * one name, whatever logical key the shell passes — the way to choose where the state
 * lives without touching the `persist` option (one shell instance per adapter then;
 * two shells sharing a pinned adapter would overwrite each other). Omitted, the
 * shell's own key is used as-is (the historical behavior).
 */
declare function localStorageAdapter(storageKey?: string): WidgetStorage;

/** The host-facing option: visible entries per side, in render order. An undeclared
 *  side falls back to its default list. */
interface TopbarComposition {
    left?: readonly string[];
    right?: readonly string[];
}
/** The built-in entry vocabulary (everything else in a list is a contributed-action id).
 *  `'layout'` renders only on multi-chart shells and `'indicators'` only while an
 *  indicator surface exists — the built-in picker (the deprecated `indicatorPicker:
 *  false` still removes it) or a slot OVERRIDE replacing it — so listing them is
 *  necessary but not sufficient. */
declare const TOPBAR_BUILTIN_IDS: readonly ["symbol", "timeframes", "style", "layout", "indicators", "actions", "undo-redo", "alerts", "panels", "screenshot"];
/** The default left side — the current shell composition, verbatim. */
declare const TOPBAR_DEFAULT_LEFT: readonly string[];
/** The default right side (the `margin-left: auto` cluster). */
declare const TOPBAR_DEFAULT_RIGHT: readonly string[];
/** A composition with both sides resolved (defaults applied, duplicates dropped). */
interface ResolvedTopbarComposition {
    left: string[];
    right: string[];
}
/** Resolve the host option: absent side ⇒ its default list; a duplicated id keeps its
 *  FIRST occurrence (left before right) so an entry never renders twice. `'actions'`
 *  is the exception — it is a flow SLOT each side legitimately owns (the defaults
 *  carry one on both), so it dedupes per side only. */
declare function resolveTopbarComposition(opt?: TopbarComposition): ResolvedTopbarComposition;
/** Whether an entry id is visible anywhere in the resolved composition. */
declare function topbarHas(comp: ResolvedTopbarComposition, id: string): boolean;
/** The non-built-in entries — contributed-action ids PINNED to a list position. */
declare function pinnedTopbarActionIds(comp: ResolvedTopbarComposition): string[];

/** What a shell (widget or workspace) accepts BEYOND the chart options themselves. */
interface VelaShellOptions {
    /** Provider factories, keyed by provider name. The shell owns the call cycle: the
     *  widget re-instantiates on each chart rebuild; the workspace instantiates once
     *  onto its single shared feed. */
    providers?: Record<string, () => DataProvider>;
    /** Scripting-engine factories, keyed by language — ONE instance per chart (the
     *  widget's chart, each workspace cell), so a worker engine gets its own thread and
     *  dies with its chart. Return a shared instance from the factory to opt into one
     *  engine for everything. Merged OVER the app-level `registerDefaultEngine`
     *  registry — an instance factory wins for its language. */
    engines?: Record<string, () => ScriptingEngine>;
    /** Indicator manifest: inline, a URL returning it, or an ASYNC LOADER function
     *  (`() => Promise<manifest>` — filesystem reads, authenticated APIs, dynamic
     *  imports). Resolved ONCE; entries with `enabled: true` auto-add to every FRESH
     *  chart (restored cells re-add their own recorded set instead). */
    indicators?: string | IndicatorManifest | IndicatorLoader;
    /** Topbar timeframe presets (chart timeframe values). */
    timeframes?: string[];
    /** Display timezone — one choice for the whole shell: an IANA zone (default
     *  'Etc/UTC'), or `'exchange'` to render every chart in its own market's zone. */
    timezone?: string;
    /** Chrome toggles (all default true). */
    statusline?: boolean;
    watermark?: boolean;
    bottombar?: boolean;
    /** Declarative topbar composition: `{ left, right }` lists of the VISIBLE entries,
     *  in render order — built-in ids (`'symbol'`, `'timeframes'`, `'style'`,
     *  `'layout'`, `'indicators'`, `'actions'`, `'undo-redo'`, `'alerts'`, `'panels'`,
     *  `'screenshot'`) and/or contributed-action ids (naming one PINS it there,
     *  overriding its `align`/`order`; `'actions'` is where the unlisted ones flow).
     *  An undeclared side keeps its default. An explicit list is that side's complete
     *  contract — it also FREEZES it: chrome a future release adds will not appear.
     *  Hiding a built-in removes its mobile entry and keyboard chord too (`mod+alt+S`
     *  for `'screenshot'`); Ctrl+Z / Ctrl+Y stay — they belong to editing, not to the
     *  `'undo-redo'` buttons. */
    topbar?: TopbarComposition;
    /** The built-in indicator picker's entry points — the topbar button, the mobile-bar
     *  item, and the `/` shortcut. `false` removes them. The `indicators` manifest
     *  still resolves and auto-adds.
     *  @deprecated Removed in 0.7.0. To HIDE the built-in surface, omit `'indicators'`
     *  from `topbar.left` (same effect: no button, no mobile stop, no `/`, no dialog).
     *  To REPLACE it, a plugin registers its action under the id `'indicators'`
     *  (`registerWidgetAction`) — the override takes the slot's whole surface and
     *  needs no shell option at all. */
    indicatorPicker?: boolean;
    /** Chrome size class. `'auto'` (default) follows the CONTAINER width plus a
     *  coarse-pointer heuristic; `'mobile'` / `'desktop'` pin it. Mobile swaps the
     *  topbar + desktop bottombar for one touch-first bottom bar, presents pickers
     *  fullscreen and menus as bottom drawers, and enables the touch chart gestures. */
    layoutMode?: 'auto' | 'mobile' | 'desktop';
    /** Focus the chart when the shell mounts so keyboard shortcuts work from the first
     *  keystroke — no initial click needed. Default false: an embedded shell must never
     *  steal the page's focus from the host's own controls. */
    autofocus?: boolean;
    /** Bring the shell back AS YOU LEFT IT: persist the full state document
     *  (`getState()`) and restore it at construction. `true` uses the shell's default
     *  key ('vela-widget' / 'vela-workspace'); a string is the storage key. */
    persist?: boolean | string;
    /** Storage backend for `persist` — defaults to localStorage in BOTH shells. Inject
     *  any {@link VelaStorage} (sync or async) for custom backends (REST, IndexedDB, …)
     *  or the exported in-memory adapter for session-lived state. */
    storage?: VelaStorage;
}

interface HistoryAction {
    undo(): void;
    redo(): void;
}
declare class WidgetHistory {
    private readonly getChart;
    private readonly undoStack;
    private readonly redoStack;
    private readonly listeners;
    private unsubs;
    private muted;
    /** `getChart` late-resolves the CURRENT chart: drawing steps recorded before a chart
     *  rebuild must undo on the chart that exists when the user presses Ctrl+Z, not on a
     *  destroyed instance captured at record time. */
    constructor(getChart?: () => Vela | null);
    /** Record a reversible action (a fresh edit forks history: redo branch clears). */
    push(action: HistoryAction): void;
    undo(): void;
    redo(): void;
    /** Run `fn` without recording — for programmatic state application (setState,
     *  ledger restore), whose indicator/drawing events are not user edits. */
    silently(fn: () => void): void;
    get canUndo(): boolean;
    get canRedo(): boolean;
    onChange(cb: () => void): () => void;
    /** (Re)bind to a chart: drawing edits enter the unified stack as delegate steps. */
    onChart(chart: Vela): void;
    destroy(): void;
    private pushDrawingStep;
    /** Replaying an action must not re-record the drawing events it triggers. */
    private mutedRun;
    private notify;
}

interface RangePreset {
    /** Button label. */
    id: string;
    /** Timeframe to switch to for this range. */
    tf: string;
    /** The core visible-range preset framed once the chart is ready. */
    preset: VisibleRangePreset;
    /**
     * Bars the window needs AT `tf` — the fetch budget for the rebuild. Without it the
     * chart loads its default depth and the framed window is clipped to whatever
     * history happens to be loaded (a "1D" that only shows 16 hours). Includes a small
     * margin; `ALL` asks for as much history as the provider will serve.
     */
    bars: number;
}
/**
 * Range chips — each pairs a timeframe, a visible window, and the fetch depth that
 * window needs. Resolutions follow the reference: the shorter the range, the finer the
 * bars (1 day of 1-minute bars … 5 years of weekly bars).
 */
declare const RANGE_PRESETS: readonly RangePreset[];
interface BottombarOptions {
    /** The stored display-timezone choice — an IANA zone or the exchange rule. */
    timezone: string;
    /** The active chart's market zone, resolving the exchange rule (see {@link Bottombar.setTimezone}). */
    exchangeTimezone?: string;
    /** The second pulse the clock ticks on. Share one with the charts' countdown chips
     *  (`renderer.setWallClock`) so every time display reads the same second; omitted,
     *  the bar runs its own second-aligned clock. */
    clock?: WallClock;
    onRange: (preset: RangePreset) => void;
    onTimezone: (zone: string) => void;
    /** RTH/ETH toggled by the user. Fires only while the toggle is ENABLED (see {@link Bottombar.setSession}). */
    onSession?: (session: 'regular' | 'extended') => void;
    onSettingsClick?: () => void;
}
declare class Bottombar {
    readonly el: HTMLElement;
    private readonly clockEl;
    private readonly tzLabelEl;
    private readonly tzButton;
    private readonly tzMenu;
    private readonly settingsTip;
    private readonly rangeButtons;
    private readonly sessionButtons;
    private sessionEl;
    private timezone;
    private exchangeTimezone;
    private readonly unsubClock;
    constructor(host: HTMLElement, opts: BottombarOptions);
    /**
     * Reflect the stored choice AND the active chart's market zone. The clock and the
     * offset label read the RESOLVED zone, so a workspace on the exchange rule re-labels
     * when the active cell (or its symbol) changes market — the host re-projects on
     * both. Idempotent: unchanged inputs leave the menu alone.
     */
    setTimezone(zone: string, exchangeTimezone?: string): void;
    /** The zone the bar's clock and label render in. */
    private get displayZone();
    /** Highlight (or clear with null) the active range chip — cleared on manual tf changes. */
    setActiveRange(id: string | null): void;
    /**
     * Reflect the ACTIVE chart's session posture. `enabled: false` (a continuous
     * market, or metadata not landed yet) HIDES the toggle entirely — RTH/ETH is
     * meaningless there. Enabled, the chips appear and the active one tracks the
     * chart's current session.
     */
    setSession(state: {
        session: 'regular' | 'extended';
        enabled: boolean;
    }): void;
    destroy(): void;
    private tzItems;
    private tick;
}

/** The status line's toggleable segments — the settings dialog's Status line tab and
 *  the status line's own right-click menu drive these. */
type StatuslinePart = 'logo' | 'name' | 'market' | 'ohlc' | 'change';

export { Bottombar as B, type CellState as C, type DrawingToolsState as D, type IndicatorLoader as I, type PanelsState as P, type ResolvedIndicator as R, type SyncSetting as S, type TrackSizes as T, type VelaStorage as V, WidgetHistory as W, type StatuslinePart as a, type RangePreset as b, type VelaShellOptions as c, type SyncOptions as d, type SyncKind as e, type WorkspaceState as f, type ChartState as g, decodeState as h, encodeState as i, type TopbarComposition as j, type BottombarOptions as k, type IndicatorManifest as l, type IndicatorManifestEntry as m, RANGE_PRESETS as n, type ResolvedTopbarComposition as o, TOPBAR_BUILTIN_IDS as p, TOPBAR_DEFAULT_LEFT as q, TOPBAR_DEFAULT_RIGHT as r, sanitizeState as s, type WidgetStorage as t, localStorageAdapter as u, pinnedTopbarActionIds as v, resolveIndicators as w, resolveTopbarComposition as x, topbarHas as y };
