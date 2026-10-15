import { V as Vela, W as WidgetContext, a1 as SidePanelButton } from './contributions-BY3zSYiZ.js';
export { C as CellStateContext, i as ContextMenuPointer, aJ as DEFAULT_PANEL_ORDER, E as ExternalIndicatorEntry, O as OVERRIDABLE_TOPBAR_IDS, a2 as SidePanelDescriptor, a3 as SidePanelHandle, a5 as StatePersistenceHandler, a9 as SymbolRankingHook, ad as WidgetActionDescriptor, ae as WidgetActionTarget, af as WidgetAttachment, ap as registerSidePanel, aq as registerStatePersistence, ar as registerSymbolRanking, as as registerWidgetAction, at as registerWidgetAttachment, av as sidePanels, aw as statePersistenceHandlers, ax as symbolRanking, ay as topbarActionOverride, aD as unregisterSidePanel, aE as unregisterStatePersistence, aF as unregisterWidgetAction, aG as unregisterWidgetAttachment, aH as widgetActions, aI as widgetAttachments } from './contributions-BY3zSYiZ.js';
import { b as VelaOptions, d as MarketSession, T as ThemeName, c as VelaTheme, v as DataWindowReadout } from './options-CSXbjMM5.js';
import { c as VelaShellOptions, W as WidgetHistory, b as RangePreset, f as WorkspaceState, j as TopbarComposition, a as StatuslinePart, P as PanelsState } from './statusline-model-C9tYXuux.js';
export { B as Bottombar, k as BottombarOptions, C as CellState, g as ChartState, D as DrawingToolsState, I as IndicatorLoader, l as IndicatorManifest, m as IndicatorManifestEntry, n as RANGE_PRESETS, R as ResolvedIndicator, o as ResolvedTopbarComposition, p as TOPBAR_BUILTIN_IDS, q as TOPBAR_DEFAULT_LEFT, r as TOPBAR_DEFAULT_RIGHT, V as VelaStorage, t as WidgetStorage, h as decodeState, i as encodeState, u as localStorageAdapter, v as pinnedTopbarActionIds, w as resolveIndicators, x as resolveTopbarComposition, s as sanitizeState, y as topbarHas } from './statusline-model-C9tYXuux.js';
import { K as KeymapManager } from './keymap-CGOz5F5f.js';
import { a as SymbolDescriptor } from './DataProvider-Byo8pEv0.js';
import { d as SidePanel } from './side-panel-_2UK1gSm.js';
export { C as CONTEXT_MENU_BUILTIN_ORDER, D as DEFAULT_PANEL_MAX_WIDTH, a as DEFAULT_PANEL_MIN_WIDTH, b as DEFAULT_PANEL_WIDTH, S as SidePanelOptions, c as clampPanelWidth } from './side-panel-_2UK1gSm.js';

interface VelaWidgetOptions extends VelaOptions, VelaShellOptions {
    /** @deprecated No longer supported — the option is ignored (a console warning
     *  says so). Mirror `getState()` into your own URL scheme if you need links. */
    urlState?: boolean;
}
/**
 * @deprecated Use {@link VelaWorkspace} with `layout: false` — the same chart, the
 * same options, the same persisted state (pass `persist: 'vela-widget'` to keep
 * reading this class's storage key). This wrapper delegates everything and will be
 * removed in a future release.
 */
declare class VelaWidget {
    private readonly ws;
    constructor(container: HTMLElement | string, opts: VelaWidgetOptions);
    /** The shell root element (the workspace root; carries `vela-widget` as an alias). */
    get root(): HTMLElement;
    get keymap(): KeymapManager;
    /** The chart's unified undo timeline — resolve it fresh, never cache it. */
    get history(): WidgetHistory;
    /** The inner headless chart. */
    get chart(): Vela;
    /** A fresh contribution context (the workspace's is a superset of the widget's). */
    context(): WidgetContext;
    refreshActions(): void;
    setSymbol(symbol: string): void;
    setTimeframe(timeframe: string): void;
    setSession(session: MarketSession): void;
    setPriceStyle(style: string): void;
    setWatermarkVisible(visible: boolean): void;
    setIndicatorTitlesVisible(visible: boolean): void;
    setIndicatorValuesVisible(visible: boolean): void;
    setTheme(theme: ThemeName | VelaTheme): void;
    setTimezone(zone: string): void;
    applyRange(preset: RangePreset): void;
    /** The unified state document (`layout: '1'`, one cell). */
    getState(): WorkspaceState;
    /** Restore a state document IN PLACE — the chart instance survives. */
    applyState(state: unknown): void;
    /** Subscribe to `state:changed` (the only widget event — unknown names no-op). */
    on(event: 'state:changed', handler: () => void): () => void;
    destroy(): void;
}

/** The current layout's footprint on the canvas (mirrors the workspace's LayoutShape). */
type LayoutPickerShape = {
    rows: number;
    cols: number;
};

declare function priceStyleLabel(id: string): string;
interface TopbarOptions {
    symbol: string;
    onSymbolClick?: () => void;
    timeframe: string;
    timeframes: readonly string[];
    /** Favorite timeframes — duration-sorted quick-switch chips, stars in the
     *  dropdown rows. Push later changes with {@link Topbar.setTimeframeFavorites}. */
    timeframeFavorites?: readonly string[];
    priceStyle: string;
    onTimeframe: (tf: string) => void;
    /** A dropdown star was toggled. Omitted, the dropdown carries no stars and the
     *  chips never render — the host owns (and persists) the favorite set. */
    onTimeframeFavorite?: (tf: string, on: boolean) => void;
    onPriceStyle: (style: string) => void;
    /** Optional workspace LAYOUT dropdown (rendered after the style dropdown when
     *  given) — the grid-canvas picker composing uniform grids, with the workspace
     *  SYNC switches beside it. Everything is read live, so plugin-registered
     *  layouts and setting flips appear automatically. */
    layout?: {
        current: string;
        /** Current layout's picker-canvas shape (null = not canvas-expressible). */
        shape: () => LayoutPickerShape | null;
        /** Registered layouts the canvas cannot express — rendered as labeled rows. */
        presets: () => Array<{
            id: string;
            label: string;
        }>;
        onSelectGrid: (rows: number, cols: number) => void;
        onSelectPreset: (id: string) => void;
        /** SYNC switch rows (re-read on every open and after each toggle). */
        syncs: () => Array<{
            id: string;
            label: string;
            checked: boolean;
        }>;
        onToggleSync: (id: string) => void;
        /** The current layout's 16px glyph (`<svg>` markup) for the button, re-read on
         *  every {@link Topbar.setLayout}. Omitted ⇒ the registered `'layout'` icon. */
        glyph?: () => string;
    };
    onIndicatorsClick?: () => void;
    /** Unified undo/redo (same stack as Ctrl+Z / Ctrl+Y). Enabled state is pushed with
     *  {@link Topbar.setHistoryState}. */
    onUndoClick?: () => void;
    onRedoClick?: () => void;
    onScreenshotClick?: () => void;
    onAlertsClick?: (anchor: HTMLElement) => void;
    /** Live widget context for contributed actions (topbar target). */
    getContext?: () => WidgetContext;
    /** The host's declarative composition (see {@link TopbarComposition}) — which
     *  entries render, per side, in list order. An undeclared side keeps its default.
     *  The shell that owns this bar also gates the matching mobile entries and
     *  keyboard chords on the same composition — the bar only handles its own DOM. */
    composition?: TopbarComposition;
}
declare class Topbar {
    readonly el: HTMLElement;
    private readonly symbolEl;
    /** Duration-sorted favorite chips (plus an unstarred current, when needed). */
    private readonly tfChipsHost;
    private readonly tfCaret;
    private tfFavs;
    private readonly styleButton;
    private layoutButton;
    private layoutPicker;
    private layoutId;
    private readonly tfMenu;
    private readonly styleMenu;
    private readonly tooltips;
    private readonly actionsHost;
    /** Left-aligned contributed actions (`align: 'left'`) — right after the dropdowns. */
    private readonly leftActionsHost;
    /** The hairline after the left cluster — hidden while the cluster is empty. */
    private readonly leftActionsSep;
    /** The side-panel toggle group — filled by the dock through {@link setPanelButtons}. */
    private readonly panelsHost;
    private undoBtn;
    private redoBtn;
    private alertsBtn;
    private panelBtns;
    private panelTooltips;
    private readonly host;
    private alertsBadge;
    /** The resolved composition (defaults applied) — what renders, where, in order. */
    private readonly comp;
    /** Pinned contributed-action slots, by action id (composition entries that name one,
     *  plus built-in slots taken over by an override). */
    private readonly pinned;
    /** Overrides that LEFT their native slot (default side + a declared `order`) — they
     *  render through the flow cluster like ordinary actions. */
    private readonly flowingOverrides;
    /** Tooltips of the CURRENT icon-only action buttons — rebuilt with every
     *  renderActions pass (contributed buttons are replaceChildren'd away). */
    private actionTooltips;
    /** `iconOnly` misuse warned once per action id (renderActions re-runs freely). */
    private readonly warnedIconless;
    private readonly opts;
    private timeframe;
    private priceStyle;
    private readonly onHairlineSync;
    private hairlineRo;
    private hairlineRaf;
    constructor(host: HTMLElement, opts: TopbarOptions);
    setSymbol(symbol: string): void;
    setTimeframe(tf: string): void;
    /** Reflect the favorite-timeframe set — the quick-switch chips and the dropdown stars. */
    setTimeframeFavorites(favs: readonly string[]): void;
    /** Rebuild the quick-switch chips (current value changed, or the favorite set did). */
    private renderTfChips;
    setPriceStyle(style: string): void;
    /** Reflect the current workspace layout (no-op without the layout dropdown). */
    setLayout(id: string): void;
    private renderLayoutButton;
    private renderStyleButton;
    /** Re-project the contributed topbar actions (call after registrations change).
     *  An action PINNED by the composition renders into its named slot (list position
     *  wins over `align`/`order`); the rest flow into the side's `actions` slot — or
     *  not at all when an explicit list omits it (the list is the side's contract). */
    renderActions(): void;
    setIndicatorCount(_n: number): void;
    /** Enable/disable the undo and redo tools from the host's unified history. */
    setHistoryState(canUndo: boolean, canRedo: boolean): void;
    setAlertCount(n: number): void;
    /**
     * Replace the side-panel toggle group — one icon button per docked panel, in the dock's own
     * order. The dock calls this whenever its panel set changes (built-ins at construction,
     * contributed panels on every `refreshActions()`), then pushes each pressed state.
     */
    setPanelButtons(buttons: readonly SidePanelButton[], onClick: (id: string) => void): void;
    /** Reflect a docked side panel's open state on its button — the panels toggle each other,
     *  so the dock pushes the state rather than the button assuming it. */
    setPanelActive(id: string, open: boolean): void;
    destroy(): void;
    /** One icon-only tool button with its kit tooltip, parked in `sink` for disposal. */
    private toolButton;
    /** Paint each `.vela-sep` as exactly one device pixel, snapped to the pixel grid. */
    private syncHairlines;
    private tfItems;
    private styleItems;
}

/** How the status line reads a bar out: the four O/H/L/C values (bar-shaped styles),
 *  or the single plotted value — the close — for one-line styles (line/area/baseline). */
type StatuslineReadout = 'ohlc' | 'value';
/** The market session states the status badge can wear. Crypto venues trade
 *  continuously and stay 'open'; the full vocabulary is ready for providers that
 *  carry a session model (equities RTH/ETH, exchange holidays). Overnight roll
 *  tapes wear the single 'extended' state — they have no pre/post split. */
type MarketStatus = 'open' | 'pre' | 'post' | 'extended' | 'closed' | 'holiday';
/** Host hooks behind the right-click action menu. Part toggles route through the host
 *  (never straight into {@link Statusline.setPartVisible}) so its persistence and
 *  style-link mirroring follow; the chart toggle reaches the renderer the host owns. */
interface StatuslineMenuHooks {
    setPart: (part: StatuslinePart, visible: boolean) => void;
    /** Whether the main price series is currently painted (the renderer's `candleVisible`). */
    chartVisible: () => boolean;
    setChartVisible: (visible: boolean) => void;
}
declare class Statusline {
    private readonly host;
    /** The avatar's icon URL for a raw symbol — the shell routes it to the owning
     *  provider's `resolveSymbolIcon`. Absent ⇒ the initials badge. */
    private readonly iconFor?;
    readonly el: HTMLElement;
    private readonly ohlcEl;
    private readonly changeEl;
    private readonly symbolEl;
    /** The badge slot — the market bubble, or the replay badge while replaying. */
    private readonly marketEl;
    /** The market status face — a kit callout bubble. */
    private readonly marketBubble;
    /** The replay face — see {@link REPLAY_BADGE_SVG}. */
    private readonly replayBadge;
    private marketTip;
    /** The show-chart eye — visible only while the chart is hidden. */
    private readonly eyeEl;
    private eyeTip;
    private avatarEl;
    private metaEl;
    private readonly parts;
    private marketStatus;
    /** The chart replays past bars — the badge shows the replay mode (see {@link setReplaying}). */
    private replaying;
    /** The right-click action menu — present once a host wires it via {@link attachMenu}. */
    private menu;
    private menuHooks;
    /** Mirror of the renderer's `candleVisible` — see {@link setChartHidden}. */
    private chartHidden;
    private lastBar;
    private hoverBar;
    private unsubs;
    /** Up/down ink for the OHLC + change values — the ACTIVE price style's configured
     *  colors (candle bodies, bar ticks, the line color, …); null falls back to the theme
     *  tokens. `isUp` overrides the close-vs-open direction rule where the style paints by
     *  something else (baseline: position against the baseline price). */
    private upColor;
    private downColor;
    private isUp;
    /** 'ohlc' for bar-shaped styles; 'value' (the single plotted close) for line styles. */
    private readout;
    /** Fit mode (multi-chart cells): one row, overflowing segments hidden — see {@link setFitMode}. */
    private fitMode;
    private fitRO;
    /** The identity row (avatar / symbol / meta / market) and the values row (readout /
     *  eye) — one line side by side, or a two-line column once the ladder stacks them. */
    private readonly identityRow;
    private readonly valuesRow;
    /** The ladder rung currently applied — see {@link fit}. */
    private layout;
    /** The readout {@link widthKey} the applied rung was fitted to. */
    private fitKey;
    /** Web fonts landing after the last fit change every width without a resize. */
    private readonly onFontsLoaded;
    constructor(host: HTMLElement, symbol: string, 
    /** The avatar's icon URL for a raw symbol — the shell routes it to the owning
     *  provider's `resolveSymbolIcon`. Absent ⇒ the initials badge. */
    iconFor?: ((symbol: string) => string | undefined) | undefined);
    setSymbol(symbol: string): void;
    /**
     * Multi-chart cells: the same width ladder as a single chart, plus a last resort for
     * cells too narrow for even its bottom rung — whatever still overflows is hidden
     * outright rather than clipped mid-glyph, least important first: the values, the
     * venue/timeframe meta, then the market badge; the logo + ticker always stay.
     */
    setFitMode(on: boolean): void;
    /** Project the parts config onto the segments (the baseline fit() prunes from). */
    private syncParts;
    /** Apply one ladder rung: the stacked/inline shape and the readout's level. */
    private applyLayout;
    /**
     * Walk the width ladder (see {@link STATUSLINE_LADDER}) until the chip fits its
     * max-width: the full one-line readout, then the values stacked under the symbol
     * line, then O/H/L shed, then the absolute change. In fit mode, when the last rung
     * still overflows, whole segments hide, least important first. Without layout
     * (detached host, node tests) nothing overflows, so the widest rung stays.
     */
    private fit;
    /** Shape + color the value readout after the active price style: its own up/down
     *  colors (candle bodies, bar ticks, the line color, …), the direction rule that
     *  picks between them (`isUp` replaces close-vs-open where the style paints by
     *  something else — baseline by position), and whether the readout is the four
     *  O/H/L/C values or the single plotted value (one-line styles). Null colors fall
     *  back to the theme's up/down tokens. See {@link statuslineInkOf}, which derives
     *  all of it from the live renderer. */
    setDirectionColors(up: string | null, down: string | null, isUp?: ((bar: {
        open: number;
        close: number;
    }) => boolean) | null, readout?: StatuslineReadout): void;
    /** The "· BINANCE · 1h" segment after the symbol — venue first, then resolution. */
    setMeta(timeframe: string, provider: string): void;
    /** Dress the market badge for a session state: its icon, tinted circle, and the
     *  hover label. Callers with no session model leave the constructor's 'open'. */
    setMarketStatus(status: MarketStatus): void;
    /** The chart entered or left a bar replay: the badge shows the replay mode meanwhile
     *  (the session state of a past bar says nothing about the market now). */
    setReplaying(replaying: boolean): void;
    private dressBadge;
    /** Show/hide one part — the settings dialog's Status line tab and the right-click
     *  menu both drive these. 'name' owns the venue/timeframe meta too (see
     *  {@link segmentVisibility}). */
    setPartVisible(part: StatuslinePart, visible: boolean): void;
    partVisible(part: StatuslinePart): boolean;
    /** Mirror the chart's (price series') visibility: dim the whole line like a hidden
     *  indicator's legend row, drop the value readout (OHLC + bar change — values of a
     *  series that isn't painted), and put the show-chart eye out in its place. The
     *  parts config is untouched, so showing the chart restores the readout exactly as
     *  configured. Idempotent; {@link render} re-syncs it from the live renderer, so
     *  toggles made elsewhere (the object tree's eye) converge too. */
    setChartHidden(hidden: boolean): void;
    /** Wire the right-click action menu: one checkable toggle per part plus hide/show
     *  for the chart itself. The menu is built once; later calls just swap the hooks. */
    attachMenu(hooks: StatuslineMenuHooks): void;
    private readonly onContextMenu;
    private runMenuItem;
    /** (Re)bind to a chart instance — called after every widget rebuild. */
    onChart(chart: Vela): void;
    destroy(): void;
    private detach;
    private render;
    /** Everything the readout's width depends on, at every rung: its shape, and each
     *  value's sign, digit count and decimals (the digits themselves are tabular — see
     *  the CSS; the grouping commas follow from the digit count). `toFixed` carries all
     *  three at a fraction of the locale formatter's cost — this runs per pointer move.
     *  The parts, the host's size and the fonts re-fit through their own paths. */
    private widthKey;
    /** Write the value readout for the current bar at the current ladder level. */
    private renderValues;
}

declare class Watermark {
    readonly el: HTMLElement;
    private readonly text;
    private readonly replayLine;
    private readonly resizeObserver;
    /** The host's visibility preference (the persisted watermark toggle). */
    private shown;
    /** The host's preference for the replay line (its own persisted toggle). */
    private replayShown;
    /** The chart is replaying past bars. */
    private replaying;
    /** A bar load is in flight with nothing painted — the loading affordance owns the
     *  canvas, so the mark stays out of its way. Starts true: the FIRST `load:start`
     *  fires during chart construction, before any subscriber can see it. */
    private loading;
    constructor(host: HTMLElement, symbol: string, timeframe: string);
    setVisible(visible: boolean): void;
    /** Show/hide the replay line (the host's toggle); it only ever shows while replaying. */
    setReplayVisible(visible: boolean): void;
    /** The chart entered or left a bar replay. */
    setReplaying(replaying: boolean): void;
    /** Loading and the watermark never share the canvas — hidden while a load is up. */
    setLoading(loading: boolean): void;
    private sync;
    update(symbol: string, timeframe: string): void;
    /** Measure the text at the cap and shrink it to the price pane's width. */
    private fit;
    destroy(): void;
}

declare function filterSymbols(list: readonly SymbolDescriptor[], query: string, limit?: number, top?: readonly string[] | false): SymbolDescriptor[];
interface SymbolPickerOptions {
    /** `provider` is the venue of the chosen row — absent only for a source that has none. */
    /** Called with the CHOSEN symbol — `EXCHANGE:`-prefixed when the row named a venue,
     *  so the selection pins the venue the user actually pointed at. */
    onSelect: (symbol: string) => void;
    onOpenChange?: (open: boolean) => void;
    host?: HTMLElement;
    /** The row's icon URL — routed to the descriptor's OWNING provider
     *  (`resolveSymbolIcon`). Absent or `undefined` per row ⇒ the initials badge. */
    iconFor?: (d: SymbolDescriptor) => string | undefined;
}
declare class SymbolPicker {
    private readonly opts;
    private readonly dialog;
    private readonly input;
    private readonly list;
    private source;
    private rows;
    private highlighted;
    private seed;
    private activeTab;
    private tabs;
    private visible;
    /** The last filter pass returned fewer raw rows than asked — the pool is drained
     *  (checked BEFORE folding: folding shortens pages without meaning exhaustion). */
    private exhausted;
    /** Group rows currently expanded (venue-scoped keys) — members shown inline. */
    private readonly expanded;
    /** The ranked pool cache — `key` fingerprints the raw pool the ranking ran on. */
    private ranked;
    private ranking;
    constructor(opts: SymbolPickerOptions);
    /** Wire where symbols come from (re-called on every widget rebuild). */
    setSource(source: () => readonly SymbolDescriptor[]): void;
    open(initialQuery?: string): void;
    get isOpen(): boolean;
    /** Text typed at the picker that never reached its field: closed, it opens seeded
     *  with the text; open (the field takes focus a tick after the dialog does, and a
     *  fast typist's next key lands in that tick), it extends the query. */
    type(text: string): void;
    close(): void;
    destroy(): void;
    /** Route a row activation: a GROUP row loads its default member (the root itself is
     *  listed, never loadable), any other row loads itself. */
    private pick;
    /** Expand/collapse a group row IN PLACE — same query, same page, same scroll; only
     *  the member rows under the group appear or go. */
    private toggleExpand;
    private select;
    private moveHighlight;
    private renderHighlight;
    /** The picker's pool: the source, shaped by the registered symbol ranking. Cached —
     *  the hook runs when the pool CHANGES (an index lands or refreshes), never per
     *  keystroke; an async hook resolves onto the next repaint (stale-while-revalidate
     *  in between, the raw pool before the first resolve). */
    private pool;
    private computeRows;
    private refresh;
    /** Append the page the grown `visible` just uncovered — rows already on screen stay put. */
    private grow;
    private rowEl;
}

interface IndicatorRow {
    name: string;
    language?: string;
    category?: string;
    /** Core-computed (native) indicator — accent styling + 'native' routing. */
    native?: boolean;
    /** Native type id (routing key for add/remove). */
    nativeType?: string;
    /** Beta badge (native catalog flag). */
    beta?: boolean;
}
interface IndicatorPickerOptions {
    /** The manifest library — clicking a row ADDS an instance (repeatable). */
    library: () => readonly IndicatorRow[];
    /** The live instances on the chart — the trash removes one. */
    onChart: () => readonly IndicatorRow[];
    onAdd: (libraryIndex: number) => void;
    onRemove: (instanceIndex: number) => void;
    onOpenChange?: (open: boolean) => void;
    host?: HTMLElement;
}
declare class IndicatorPicker {
    private readonly dialog;
    private readonly list;
    private readonly search;
    private readonly opts;
    private isOpen;
    constructor(opts: IndicatorPickerOptions);
    open(): void;
    /** Re-render the lists if the dialog is open (async catalog updates land late). */
    sync(): void;
    close(): void;
    destroy(): void;
    private refresh;
}

interface TimeframeQuickOptions {
    onApply: (canonical: string) => void;
    onOpenChange?: (open: boolean) => void;
    host?: HTMLElement;
}
declare class TimeframeQuick {
    private readonly dialog;
    private readonly input;
    private readonly hint;
    constructor(opts: TimeframeQuickOptions);
    open(seed?: string): void;
    get isOpen(): boolean;
    /** Text typed at the entry that never reached its field: closed, it opens seeded
     *  with the text; open (the field takes focus a tick after the dialog does, and a
     *  fast typist's next key lands in that tick), it extends the entry. */
    type(text: string): void;
    close(): void;
    destroy(): void;
    private renderHint;
}

/** What the dock needs from whatever chrome shows its toggles. */
interface PanelChrome {
    /** Replace the panel toggle group (dock order). `onClick` receives the panel id. */
    setPanelButtons(buttons: readonly SidePanelButton[], onClick: (id: string) => void): void;
    /** Reflect one panel's open state on its button. */
    setPanelActive(id: string, open: boolean): void;
}
interface PanelDockDeps {
    chrome: PanelChrome;
    /** Live widget context, handed to contributed panels' `mount`. */
    context(): WidgetContext;
    /** The dock's persistable state changed (open panel, or a width). */
    changed?(): void;
}
/** A panel the SHELL owns and destroys — the dock only docks it. */
interface BuiltInPanel {
    id: string;
    title: string;
    icon: string;
    order: number;
    panel: SidePanel;
    /** Rebind hook, called by {@link PanelDock.onChart}. */
    onChart?(chart: Vela): void;
}
declare class PanelDock {
    private readonly host;
    private readonly deps;
    private readonly entries;
    /** Widths the USER settled, by panel id — the only ones worth persisting. */
    private readonly widths;
    /** Floating panels the USER pinned as columns, by id — remembered for late registrations too. */
    private pinned;
    /** A restored `open` naming a panel that has not registered yet: honored when it docks. */
    private pendingOpen;
    private chart;
    constructor(host: HTMLElement, deps: PanelDockDeps);
    /** Dock a panel the shell owns (created and destroyed by it). */
    addBuiltIn(entry: BuiltInPanel): void;
    /**
     * (Re)build the CONTRIBUTED panels from the registry — call once after the built-ins, and
     * again on `refreshActions()` so a late registration appears. Contributed panels that are
     * gone from the registry are dropped and a REPLACED descriptor is rebuilt; a panel whose
     * descriptor is unchanged stays mounted as it is, so its content and state survive.
     */
    refresh(): void;
    /** Bind (or rebind) every docked panel to a chart instance. */
    onChart(chart: Vela): void;
    /** Open/close one panel by id — a bare call flips it. Unknown ids are ignored. */
    toggle(id: string, open?: boolean): void;
    /** The open panel's id, or null when the column is closed. */
    get openId(): string | null;
    /** The docked panels in dock order — what a non-topbar chrome (the mobile
     *  three-dots drawer) lists so every panel stays reachable there too. */
    list(): ReadonlyArray<SidePanelButton>;
    /** The dock's persistable state, or null when there is nothing worth saving. */
    getState(): PanelsState | null;
    /**
     * Restore a persisted dock state. Widths apply to any panel present, and are remembered for
     * panels that register later; `open` opens that panel, and its absence closes the column —
     * a document that predates the dock has no `panels` field at all, so the shell never calls
     * this and the default (everything closed) stands. An `open` naming a panel that has not
     * registered yet is held until it docks (a plugin loaded after the restore), unless the user
     * opens something in the meantime. `pinned` is the whole list of floating panels the user
     * docked — its absence means none is, so every floatable panel floats again.
     */
    applyState(state: PanelsState | undefined): void;
    /** Drop the contributed panels (the shell destroys its own). */
    destroy(): void;
    private add;
    private drop;
    /** Push the current toggle group to the chrome, pressed states included. */
    private publish;
}

declare class ObjectTree extends SidePanel {
    /** The price row's avatar icon URL for a raw symbol — routed by the shell to the
     *  owning provider's `resolveSymbolIcon`. Absent ⇒ the initials badge. */
    private readonly iconFor?;
    private chart;
    /** What the CHART has selected — every member of a multi-selection, mirrored as rows. */
    private selectedDrawings;
    private symbolName;
    /** The raw (possibly venue-prefixed) symbol — what icon resolution routes on. */
    private symbolRaw;
    /** Drawing bundles — a view-side grouping, held for the panel's lifetime and never persisted.
     *  Kept per chart because a workspace points this one panel at whichever chart is active, and
     *  each chart's bundles have to survive the switch. */
    private readonly groupsPerChart;
    /** Group ids currently folded shut. Ids are never reused, so entries left behind by a group
     *  that is gone are inert and can outlive it. */
    private collapsed;
    /** Drawings picked IN THE PANEL — what the selection bar and "group selection" act on. */
    private picked;
    /** The group showing its rename field, if any. */
    private renaming;
    /** Set while the panel pushes its pick to the chart, so the `drawing:selected` that comes
     *  back is recognised as our own echo instead of a fresh chart-side selection. */
    private syncingSelection;
    private groupSeq;
    private unsubs;
    private get groups();
    private set groups(value);
    /** The last render's model, kept so a right-click reads the same state the rows show. */
    private pass;
    private menu;
    private menuActions;
    private drag;
    constructor(host: HTMLElement, 
    /** The price row's avatar icon URL for a raw symbol — routed by the shell to the
     *  owning provider's `resolveSymbolIcon`. Absent ⇒ the initials badge. */
    iconFor?: ((symbol: string) => string | undefined) | undefined);
    toggle(open?: boolean, instant?: boolean): void;
    setSymbol(symbol: string): void;
    /** (Re)bind to a chart instance — called after every widget rebuild. */
    onChart(chart: Vela): void;
    destroy(): void;
    private detach;
    /** Read the chart into the layout's input. Every chart query happens here, once a pass. */
    private snapshot;
    /**
     * Repaint because something changed — unless the panel is mid-interaction. A live drag
     * resolves drops against the rows as currently rendered, and a rename lives in an input
     * that a repaint would destroy mid-word. Both end by painting themselves.
     */
    private refresh;
    private render;
    /** What the panel itself can do to the selected drawings: bundle them into a group, or
     *  duplicate all of them. Always in place, dim until there is a selection to act on. */
    private selectionBar;
    /** The band between two pane blocks. With re-paning available it is a drop zone that opens
     *  a fresh pane there; otherwise it is just the separator. `before`/`after` name the panes
     *  it sits between (either end is open at the edges of the list). */
    private gapEl;
    /**
     * A pane, read top to bottom as front to back: ONE column holding its drawings, its
     * indicators and (in the main pane) the candles, in draw order. Every child of the stack
     * element is one slot, so a drop position is read straight off the rendered geometry.
     */
    private paneBlock;
    /** One top-level drawing entry: a lone drawing's row, or a group block — its header plus,
     *  unfolded, a member row for each drawing it holds. */
    private unitEl;
    /** The pane's name plus its ops: a study pane can move in the stack and collapse; every
     *  pane can be maximized. */
    private paneHead;
    private rowEl;
    /** A group's header: fold arrow, its name (or the rename field), then actions that apply to
     *  every member at once. Reports "all hidden"/"all locked" rather than a mixed state.
     *
     * The state comes from the whole bundle, not from the members listed under this pane: should
     * a member end up on another pane, the header still speaks for the group its actions affect.
     */
    private groupRow;
    private drawRow;
    /** Clicking a drawing picks it; holding the platform's modifier extends the pick, and
     *  clicking the only picked row clears it. The chart mirrors whatever comes out. */
    private onDrawClick;
    /** Push the panel's pick onto the chart, muting the `drawing:selected` echo it causes. */
    private selectOnChart;
    /** The shared row shell: icon, name, optional tag, then the action buttons. */
    private row;
    private btn;
    /** Bundle drawings into a fresh group, which takes over the pick. */
    private makeGroup;
    private commitRename;
    /** Dissolve a group. `withMembers` also deletes the drawings it held. */
    private removeGroup;
    /** Apply one patch to every member of a group as a single undo step. */
    private setMembers;
    /** Duplicate a drawing, keeping the copy in the same group as its original — the chart has
     *  no notion of our groups, so the new id has to be spotted and filed here. */
    private cloneInto;
    private onPointerDown;
    private onDragMove;
    private beginDrag;
    /** The rendered row a session started from — scanned rather than selected, so an id
     *  carrying CSS-special characters needs no escaping. */
    private sourceRow;
    /** What a drop at this point would do. Measured off the live geometry, which is why a
     *  refresh is suspended for the duration of the drag. */
    private resolveDrop;
    private paintDropHint;
    /** Close the session out: `apply` false abandons the move (a cancelled pointer, a teardown). */
    private endDrag;
    private applyDrop;
    /**
     * Land a drop in a pane's stack: place the dragged tokens (the candles, an indicator, a
     * drawing, or a group's whole run of drawings) at the measured position, then renormalize
     * the pane's z keys in one sweep — `candleZOrder`/`seriesOrder` for the series, a single
     * `updateMany` (one undo step) for the drawings, re-paning the ones that crossed panes.
     */
    private applySlotDrop;
    /** Renormalize one pane's z keys from a placed token stack: the series through the
     *  renderer's order settings, the drawings as ONE `updateMany` (a single undo step),
     *  re-paning the dragged ones that arrived from another pane. */
    private writeStack;
    /** Move a group's whole run to an end of its pane's stack — the menu twin of dragging it
     *  to the top or the bottom of the column. */
    private restackGroup;
    /** The drawings a session moves: a group carries every member, front-most first, so the
     *  bundle keeps its own stacking wherever it lands. */
    private draggedDrawings;
    private onContextMenu;
    private itemsForRow;
    /** The nearest kit host, which is where anything floating has to mount: outside it the
     *  theme's custom properties don't resolve and the surface renders unstyled. */
    private uiHost;
    /** The menu, built on first use — by then the panel is mounted, so the theme host resolves. */
    private ensureMenu;
    private findIndicatorRow;
    private priceMenu;
    /** The pane's stacking extremes as of now — what a front/back command has to beat. The z
     *  keys are plain numbers, not commands, so the writer beats the extremes itself; with a
     *  shared draw-order space the drawings' keys count too. */
    private stackBounds;
    private indicatorMenu;
    /** "Move to …" entries for an indicator — only the moves that would change something. */
    private moveItems;
    private drawingMenu;
    /** The grouping half of a drawing's menu: what it can do about the bundle it is (or isn't)
     *  part of. Only the moves that mean something for this row are offered. */
    private groupingItems;
    private groupMenu;
    /** Forget everything that refers to a drawing or group the chart no longer has — otherwise a
     *  deleted drawing would keep a group alive, or stay counted in the selection bar. */
    private prune;
}

/** One readout line. `color` empty ⇒ the value inherits the panel's text color. */
interface DataWindowLine {
    label: string;
    value: string;
    color: string;
}
/** A titled block of readout lines. */
interface DataWindowSection {
    title: string;
    lines: DataWindowLine[];
}
/**
 * Lay a readout out as sections: the bar's Time, its Price block (tinted with the bar's
 * direction), then one section per indicator with a line per plot in the plot's own color.
 * Empty when the chart holds no bar to read.
 */
declare function dataWindowSections(readout: DataWindowReadout): DataWindowSection[];
declare class DataWindow extends SidePanel {
    private chart;
    private unsubs;
    constructor(host: HTMLElement);
    toggle(open?: boolean, instant?: boolean): void;
    /** (Re)bind to a chart instance — called after every widget rebuild. */
    onChart(chart: Vela): void;
    destroy(): void;
    private detach;
    private refresh;
}

declare class ShortcutsHelp {
    private readonly dialog;
    private readonly list;
    private readonly keymap;
    constructor(keymap: KeymapManager, host?: HTMLElement, onOpenChange?: (open: boolean) => void);
    open(): void;
    close(): void;
    destroy(): void;
    private refresh;
}

interface ContextMenuCallbacks {
    /** Reset the view (all history, autoscale back on). */
    resetView: () => void;
    /** The display-timezone choice the host holds — a zone or the exchange rule (the time-axis menu checks it). */
    timezone?: () => string;
    /** Switch the display timezone through the host, so its own chrome follows. */
    setTimezone?: (zone: string) => void;
    /** Live widget context for contributed `context:*` actions. */
    getContext?: () => WidgetContext;
}
declare class ChartContextMenu {
    private readonly cbs;
    private readonly menu;
    private readonly host;
    private chart;
    private offCrosshair;
    /** The bound chart's latest crosshair report — a right-click always follows a pointer
     *  move to its spot, so this is where it landed. */
    private crosshair;
    /** {@link crosshair} as it stood when the menu opened: the pointer moves on through the
     *  menu before a row is picked, and `run` must see the right-clicked spot. */
    private pointer;
    private lastZone;
    /** The pane whose scale the open price-axis menu targets (null ⇒ the main scale). */
    private lastPane;
    private readonly onContextMenu;
    constructor(host: HTMLElement, cbs: ContextMenuCallbacks);
    /** (Re)bind to a chart instance — called after every widget rebuild. */
    onChart(chart: Vela): void;
    destroy(): void;
    private zoneOf;
    /** The pane under the pointer, so every pane's price scale has its own menu. */
    private paneAt;
    private flag;
    /** A fresh widget context carrying the pointer captured at open. Copied by property
     *  descriptor: the context's getters must stay LIVE, and a spread would freeze them. */
    private context;
    private contributed;
    private itemsFor;
    private builtinItems;
    private run;
}

interface ParsedTimeframe {
    valid: boolean;
    count?: number;
    unit?: string;
    ms?: number;
    /** What the chart consumes ("180" for 3h). */
    canonical?: string;
    /** Human line ("3 months"). */
    label?: string;
    /** Compact chip ("3M"). */
    short?: string;
}
/** Parse a typed timeframe string. `valid` is false for empty/garbage input (count ≥ 1). */
declare function parseTimeframe(text: string): ParsedTimeframe;
/** Duration in ms of an existing timeframe value (`1`, `60`, `4h`, `D`, `W`, …), NaN if unknown. */
declare function timeframeMs(value: string): number;
/** Compact display label for any timeframe value ("60" → "1h", "D" → "1D"). */
declare function timeframeLabel(value: string): string;

interface TimezoneEntry {
    value: string;
    label: string;
}
declare const TIMEZONES: readonly TimezoneEntry[];
/** The renderer's config default is the bare `'UTC'` alias — fold it (and any other
 *  UTC spelling) onto the catalog's `'Etc/UTC'` so selection checks land on one entry. */
declare function normalizeTimezone(zone: string): string;
/** Current UTC offset of an IANA zone as `"UTC"`, `"UTC+2"` or `"UTC-9:30"`. */
declare function tzOffset(zone: string, date?: Date): string;
/** Dropdown row label — UTC omits the offset prefix. */
declare function tzMenuLabel(zone: string, location: string): string;
/** Compact label for the bottom-bar button — just the offset ("UTC", "UTC+2", "UTC-9:30"). */
declare function tzButtonLabel(zone: string): string;

/** Sensible decimal count for a price magnitude (crypto-friendly). */
declare function decimalsFor(ref: number): number;
/** Locale-formatted price; `'—'` for null/non-finite. */
declare function fmtPrice(n: number | null | undefined, dp?: number): string;
/** Signed change + percent ("+123.45 (+1.23%)") from open→close; `''` when unavailable. */
declare function fmtChange(open: number | null | undefined, close: number | null | undefined): string;

export { type BuiltInPanel, ChartContextMenu, type ContextMenuCallbacks, DataWindow, type DataWindowLine, type DataWindowSection, IndicatorPicker, type IndicatorPickerOptions, type IndicatorRow, ObjectTree, type PanelChrome, PanelDock, type PanelDockDeps, PanelsState, type ParsedTimeframe, RangePreset, ShortcutsHelp, SidePanel, SidePanelButton, Statusline, type StatuslineMenuHooks, StatuslinePart, SymbolPicker, type SymbolPickerOptions, TIMEZONES, TimeframeQuick, type TimeframeQuickOptions, type TimezoneEntry, Topbar, TopbarComposition, type TopbarOptions, VelaShellOptions, VelaWidget, type VelaWidgetOptions, Watermark, WidgetContext, WorkspaceState, dataWindowSections, decimalsFor, filterSymbols, fmtChange, fmtPrice, normalizeTimezone, parseTimeframe, priceStyleLabel, timeframeLabel, timeframeMs, tzButtonLabel, tzMenuLabel, tzOffset };
