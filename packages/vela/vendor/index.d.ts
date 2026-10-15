import { D as DrawingsDocument, d as Resolved, e as ReplayTick, f as DataControl, g as ReplayTickSource } from './contributions-BY3zSYiZ.js';
export { B as BarsChangeReason, C as CellStateContext, h as CodeUpdateResult, i as ContextMenuPointer, j as ContextSelect, k as DrawingsControl, l as EngineAlert, m as EngineCapabilities, n as EngineContextSnapshot, o as EngineFactory, p as EngineWarning, q as ExecutionHandlers, r as ExecutionMarket, s as ExecutionRequest, t as ExecutionSession, E as ExternalIndicatorEntry, F as FetchSeries, u as IndicatorEventMap, I as IndicatorHandle, v as IndicatorSummary, L as LegendActionDescriptor, w as LegendCalloutContent, x as LegendCalloutDescriptor, y as LegendCalloutItem, z as LegendCalloutSpec, A as LegendIndicatorInfo, M as MarksControl, N as NativeIndicator, G as NativeIndicatorContext, H as NativeIndicatorDescriptor, J as NativeIndicatorInfo, K as NativeIndicatorOutput, O as OVERRIDABLE_TOPBAR_IDS, P as ParsedSymbol, Q as PreparedScript, T as RendererControl, a as ReplayBounds, U as ReplayControl, X as ReplayEndReason, Y as ReplayStartOptions, R as ReplayState, Z as RunIndicatorResult, _ as SceneInspection, c as ScriptRun, $ as ScriptRunCause, a0 as ScriptRunResult, S as ScriptingEngine, a1 as SidePanelButton, a2 as SidePanelDescriptor, a3 as SidePanelHandle, a4 as SidePanelHeader, a5 as StatePersistenceHandler, a6 as StrategyFill, a7 as StrategyState, a8 as StrategyTrade, a9 as SymbolRankingHook, aa as TypedEventBus, V as Vela, ab as VelaDeps, b as VelaEventMap, ac as VisibleBarRange, ad as WidgetActionDescriptor, ae as WidgetActionTarget, af as WidgetAttachment, W as WidgetContext, ag as getNativeIndicator, ah as legendActions, ai as legendCallouts, aj as nativeIndicatorDescriptors, ak as nativeIndicatorTypes, al as registerDefaultEngine, am as registerLegendAction, an as registerLegendCallout, ao as registerNativeIndicator, ap as registerSidePanel, aq as registerStatePersistence, ar as registerSymbolRanking, as as registerWidgetAction, at as registerWidgetAttachment, au as resolveEngines, av as sidePanels, aw as statePersistenceHandlers, ax as symbolRanking, ay as topbarActionOverride, az as unregisterDefaultEngine, aA as unregisterLegendAction, aB as unregisterLegendCallout, aC as unregisterNativeIndicator, aD as unregisterSidePanel, aE as unregisterStatePersistence, aF as unregisterWidgetAction, aG as unregisterWidgetAttachment, aH as widgetActions, aI as widgetAttachments } from './contributions-BY3zSYiZ.js';
import { D as Drawing, S as SerializedDrawing, U as Unsubscribe, L as LineStyle, P as PriceStyle, e as IChartRenderer, R as RendererCapabilities, f as RendererDisplayOptions, g as IndicatorRenderHandle, h as IndicatorStatus, c as VelaTheme, W as WallClock, O as OHLCV, i as Pane, j as PaneAction, k as MoveTarget, l as IndicatorModel, m as ScenePatch, I as InputValue, n as SymbolPickerFn, o as LegendActionView, p as LegendCalloutView, q as InputChangeEvent, T as ThemeName, C as CrosshairEvent, r as ClickEvent, A as AxisLongPressEvent, s as TimelineMark, t as MarkGroup, u as MarkClickEvent, a as VisibleRange, v as DataWindowReadout, w as IDrawingsRendererPort, x as Millis, y as SnapMode, z as DrawingTypeKey, B as ToolbarDefinition, M as MarketConfig, E as MarketSnapshot } from './options-CSXbjMM5.js';
export { F as AddIndicatorOptions, G as AnimationConfig, H as Background, J as BoxFontFamily, K as BoxHAlign, Q as BoxTextSize, X as BoxVAlign, Y as CandleBarColor, Z as CandleSeries, _ as CandleStyle, $ as DataWindowGroup, a0 as DataWindowOHLC, a1 as DataWindowRow, a2 as DirtyRange, a3 as DrawingBox, a4 as DrawingExtend, a5 as DrawingIntent, a6 as DrawingLabel, a7 as DrawingLine, a8 as DrawingLinefill, a9 as DrawingMode, aa as DrawingPoint, ab as DrawingPolyline, ac as DrawingSeriesBar, ad as DrawingSeriesGateway, ae as DrawingSeriesState, af as DrawingStyle, ag as DrawingTable, ah as DrawingText, ai as DrawingXLoc, aj as DrawingsOption, ak as Fill, al as FillGradientStop, am as IndicatorMeta, an as InputCondition, ao as InputSchema, ap as InputType, aq as InputWhen, ar as IntroAnimation, as as IntroConfig, at as IntroStyle, au as LabelStyle, av as LabelYLoc, aw as LineLikeKind, ax as LineLikeSeries, ay as LineLikeStyle, az as MarkContent, aA as MarkContentSource, aB as MarkGlyph, aC as MarkPanelItem, aD as MarkShape, aE as MarkerPoint, aF as MarkerSeries, aG as MarketSwitch, aH as PaneAxis, aI as PaneAxisBand, aJ as PaneHint, aK as PaneKind, aL as PolylinePoint, aM as PriceAxisOptions, aN as PriceAxisTick, aO as PriceAxisTickContext, aP as PriceAxisTicksFn, aQ as PriceLine, aR as Projector, aS as ProviderName, aT as RendererConstructor, aU as Scene, aV as SchemaPatch, aW as SecondClock, aX as SeriesDisplay, aY as SeriesKind, aZ as SeriesPoint, a_ as SeriesSpec, a$ as SeriesSurface, b0 as SeriesValueDelta, b1 as SettingsField, b2 as SettingsSchema, b3 as SettingsVisibilityPolicy, b4 as TableCell, b5 as TableMerge, b6 as TablePosition, b7 as ToolbarGroupConfig, b8 as TradeExecution, b9 as ValuePatch, b as VelaOptions, V as VisibleRangePreset, ba as buildToolbar, bb as defaultToolbar, bc as inputDeltas, bd as inputVisible, be as seriesInScale, bf as seriesShownOn } from './options-CSXbjMM5.js';
import { S as SettingsSelectOption } from './plugin-BDxUhGO3.js';
export { A as ACCENT, a as ACCENT_BRIGHT, B as BEARISH, b as BULLISH, c as BarTransform, d as BasePaintingModulation, C as CATEGORICAL, e as CHIP_PLATE, f as CROSSHAIR, g as ChartTypeDefinition, h as ChartTypeSettingsInstance, i as ChartTypeSettingsSection, j as ChartTypeSettingsSubsection, D as DrawingTypeMeta, H as HIGHLIGHT, I as INFO, k as INVALID, l as IdentifiableKind, M as MARKER, N as NEUTRAL, m as NormalizedSettingsRow, R as RendererLayerArgs, n as RendererLayerDefinition, o as RendererLayerInstance, p as SERIES_LINE, q as SESSION_OFF, r as SESSION_POST, s as SESSION_PRE, t as SLATE, u as SLATE_DEEP, v as SeriesDataEngine, w as SeriesDataEngineHost, x as SettingsInlineControl, y as SettingsRowCondition, z as SettingsRowDescriptor, E as SettingsRowInlineNumber, F as SettingsRowSwatch, G as SettingsRowValueKey, J as SettingsRowWhen, K as SettingsRowWidth, L as SettingsValueRow, T as TRADE_EXIT, O as TRADE_LONG, P as TRADE_SHORT, V as VALID, W as WARNING, Q as categoricalColor, U as chartType, X as chartTypes, Y as createDrawing, Z as deserializeDrawing, _ as drawingTypes, $ as getDrawingType, a0 as normalizeSettingsRow, a1 as registerChartType, a2 as registerDrawingType, a3 as registerRendererDefaults, a4 as registerRendererLayer, a5 as rendererDefaults, a6 as rendererLayers, a7 as settingsRowValueKeys, a8 as stableSeriesId, a9 as tickerModifierIds, aa as unregisterChartType, ab as unregisterRendererDefaults, ac as unregisterRendererLayer } from './plugin-BDxUhGO3.js';
import { M as MarketDataFeed, D as DataProvider, P as ProviderInfo, a as SymbolDescriptor, S as SymbolInfo, b as ProviderCapabilities, B as BarRange } from './DataProvider-Byo8pEv0.js';
export { C as CONTEXT_MENU_BUILTIN_ORDER, D as DEFAULT_PANEL_MAX_WIDTH, a as DEFAULT_PANEL_MIN_WIDTH, b as DEFAULT_PANEL_WIDTH, S as SidePanelOptions, c as clampPanelWidth } from './side-panel-_2UK1gSm.js';
export { i as iconMarkup, r as registerIcon } from './icons-BZYbJXSV.js';
export { a as KeyBindingDescriptor, R as ResolvedBinding } from './keymap-CGOz5F5f.js';

/**
 * The single source of truth for a chart's user drawings. Owns identity + paint
 * order (z), exposes CRUD + persistence, and fires `onChange` so the controller
 * re-syncs the renderer. Renderer-agnostic — holds {@link Drawing} instances, but
 * everything that leaves is plain {@link SerializedDrawing} data.
 */
declare class DrawingStore {
    private readonly byId;
    private seq;
    private zCounter;
    private readonly listeners;
    /** Allocate a unique, stable drawing id. */
    nextId(): string;
    /** Insert a drawing, assigning a mount-order z (later ⇒ painted in front) when it carries
     *  none. The counter only ever grows, so the fallback stays the front among drawings even
     *  after explicit keys landed below it. */
    add(d: Drawing): Drawing;
    remove(id: string): boolean;
    get(id: string): Drawing | undefined;
    has(id: string): boolean;
    /** Apply a (possibly partial) record onto an existing drawing in place. */
    update(id: string, patch: Partial<SerializedDrawing>): Drawing | null;
    /** Every drawing in paint order (ascending z). */
    all(): Drawing[];
    /** Drawings on one pane, in paint order. */
    byPane(paneId: string): Drawing[];
    /** Raise over every drawing — and over `floorZ`, the top of the pane's series stack when
     *  the renderer shares one z space with it, so "front" beats the candles too. */
    bringToFront(id: string, floorZ?: number): void;
    /** Drop under every drawing — and under `ceilZ`, the bottom of the pane's series stack,
     *  so "back" lands behind the candles and the indicators, not just other drawings. */
    sendToBack(id: string, ceilZ?: number): void;
    setLocked(id: string, v: boolean): void;
    setVisible(id: string, v: boolean): void;
    clear(): void;
    serialize(): DrawingsDocument;
    /** Replace all drawings from a (validated) document. Unknown types are skipped. */
    load(doc: unknown): void;
    onChange(cb: () => void): Unsubscribe;
    /** Keep `nextId()` from colliding with a loaded `dw-N` id. */
    private bumpSeqPast;
    private emit;
}

/** Price-axis display mode: absolute price, percent change vs a visible baseline, or
 *  values indexed to 100 at that same baseline (`index = price / baseline * 100`). */
type ScaleMode = 'price' | 'percent' | 'indexed';

interface GridLineStyle {
    visible: boolean;
    /** `null` ⇒ inherit `theme.gridColor`. */
    color: string | null;
}
interface CrosshairStyle {
    /** `null` ⇒ inherit `theme.textColor`. */
    color: string | null;
    width: number;
    style: LineStyle;
    /** Line opacity (0–1); reference charting crosshairs are translucent. */
    opacity: number;
    /** Axis-chip background; `null` ⇒ inherit `theme.textColor`. */
    labelBackground: string | null;
}
interface CandleStyle {
    /** Whether the filled candle body is drawn (off ⇒ wicks/borders only). */
    bodyVisible: boolean;
    borderVisible: boolean;
    /** `null` ⇒ inherit the body color. */
    borderUpColor: string | null;
    borderDownColor: string | null;
    wickVisible: boolean;
    wickUpColor: string | null;
    wickDownColor: string | null;
}
/**
 * Per-price-style cosmetics — each chart type carries its OWN colors and does NOT
 * inherit from another style. A `null` color is the style's "use the chart's
 * up/down default" sentinel (so an untouched style still matches the candle palette
 * and the prior rendering); set it and that style becomes independent. The candle
 * BODY colors stay the renderer's `upColor`/`downColor` (the `candles` block adds
 * border/wick on top); these four blocks cover the non-candle styles.
 */
interface BarsStyle {
    /** `null` ⇒ inherit the chart up color. */
    upColor: string | null;
    /** `null` ⇒ inherit the chart down color. */
    downColor: string | null;
}
interface LineSeriesStyle {
    /** `null` ⇒ inherit the chart up color. */
    color: string | null;
    width: number;
}
interface AreaSeriesStyle {
    /** `null` ⇒ inherit the chart up color. */
    lineColor: string | null;
    width: number;
    /** Gradient top (near the line); `null` ⇒ the resolved line color. */
    topColor: string | null;
    /** Gradient bottom (at the baseline); `null` ⇒ transparent. */
    bottomColor: string | null;
}
interface BaselineSeriesStyle {
    /** `null` ⇒ the baseline up default (`BASELINE_TOP_LINE`). */
    topLineColor: string | null;
    /** `null` ⇒ the baseline down default (`BASELINE_BOTTOM_LINE`). */
    bottomLineColor: string | null;
    /** Top area fill near the up line; `null` ⇒ a wash of the top line color at `BASELINE_FILL_ALPHA`. */
    topFillColor: string | null;
    /** Top area fill near the baseline (the lower end of the top area); `null` ⇒ a fainter
     *  wash of the top line color at `BASELINE_FILL_ALPHA_FAR`. */
    topFillColor2: string | null;
    /** Bottom area fill near the down line; `null` ⇒ a wash of the bottom line color at `BASELINE_FILL_ALPHA`. */
    bottomFillColor: string | null;
    /** Bottom area fill near the baseline (the upper end of the bottom area); `null` ⇒ a fainter
     *  wash of the bottom line color at `BASELINE_FILL_ALPHA_FAR`. */
    bottomFillColor2: string | null;
    width: number;
    /** Baseline position as a percent of the visible pane price range (0 = low, 100 = high). */
    baselineLevel: number;
}
/** Session-zone shading (the `sessionZones` feature): the washes painted over
 *  pre-market and post-market time bands on day-split tapes, and the single
 *  extended-hours band on overnight roll tapes. Alpha belongs in the
 *  color itself. */
interface SessionShadeStyle {
    premarketColor: string;
    postmarketColor: string;
    extendedColor: string;
}
/**
 * Empty space kept around the data. `top` / `bottom` are the share of each pane's
 * PIXEL height the autoscaled window reserves above the highest / below the lowest
 * visible value (percent); `right` is the whitespace after the newest bar, in bars,
 * that fit, re-frame and scroll-to-latest land on.
 */
interface ChartMargins {
    top: number;
    bottom: number;
    right: number;
}
interface ChartStyle {
    /** Per-chart-type settings (plugin SDK sections), keyed by type id then row key. */
    chartTypes: Record<string, Record<string, unknown>>;
    /** Axis/label font size in CSS px (the family stays on the theme). */
    fontSize: number;
    margins: ChartMargins;
    gridVert: GridLineStyle;
    gridHorz: GridLineStyle;
    /** Axis frame lines (the right price-axis border); `null` ⇒ inherit `theme.borderColor`. */
    borderColor: string | null;
    /** The draggable line between stacked panes; `null` ⇒ inherit `theme.borderColor`. */
    separatorColor: string | null;
    crosshair: CrosshairStyle;
    candle: CandleStyle;
    bars: BarsStyle;
    line: LineSeriesStyle;
    area: AreaSeriesStyle;
    baseline: BaselineSeriesStyle;
    sessions: SessionShadeStyle;
}
interface ChartConfig {
    version: number;
    layout: {
        background: string;
        textColor: string;
        fontFamily: string;
        fontSize: number;
    };
    grid: {
        vertLines: {
            visible: boolean;
            color: string;
        };
        horzLines: {
            visible: boolean;
            color: string;
        };
    };
    crosshair: {
        color: string;
        width: number;
        style: LineStyle;
        opacity: number;
        labelBackground: string;
    };
    priceScale: {
        mode: ScaleMode;
        log: boolean;
        /** Inverted price axis (high at the bottom). */
        invert: boolean;
        borderColor: string;
        labelsVisible: boolean;
        currentPriceLine: boolean;
        priceLabel: boolean;
        countdown: boolean;
        /** Glide the forming bar (and the last-price line/label) toward each live tick
         *  instead of snapping. The duration comes from `animations.liveBar` / the
         *  `animLiveBar` feature; this is only the on/off switch the settings dialog shows. */
        animateLastPrice: boolean;
    };
    /** Motion on/off switches (the settings dialog's Animation group). On/off only — each
     *  motion's duration stays what the host configured (`animations` option / renderer
     *  features); switching one back on restores that duration. `pan` covers both the
     *  drag-release inertia and the programmatic scroll glide. The live-bar glide's switch
     *  is `priceScale.animateLastPrice` (it predates this block). */
    animations: {
        zoom: boolean;
        pan: boolean;
        autoscale: boolean;
        /** The first-paint candle reveal — takes effect on the next load. */
        intro: boolean;
    };
    /** Stacked-pane chrome — the draggable line between an indicator's pane and the one above it. */
    panes: {
        separatorColor: string;
    };
    /** Whitespace around the data (the Canvas tab's Margins group): top/bottom in percent
     *  of pane height, right in bars. See {@link ChartMargins}. */
    margins: ChartMargins;
    /** Strategy trade markers (the `tradeMarkers` feature): the order-fill units on the price pane. */
    trades: {
        visible: boolean;
        /** The order-id/comment text line. */
        labels: boolean;
        /** The signed-quantity text line. */
        qty: boolean;
        longColor: string;
        shortColor: string;
        exitColor: string;
    };
    timeScale: {
        timezone: string;
    };
    /** Timeline marks (the `marks` feature): the lane's master toggle + per-group visibility
     *  (the Events tab's checkboxes). `groups` merges additively, like `stacking.series`. */
    marks: {
        visible: boolean;
        groups: Record<string, boolean>;
    };
    /** Per-chart-type settings (plugin SDK sections), keyed by type id then row key. */
    chartTypes: Record<string, Record<string, unknown>>;
    candles: {
        upColor: string;
        downColor: string;
        bodyVisible: boolean;
        borderVisible: boolean;
        borderUpColor: string;
        borderDownColor: string;
        wickVisible: boolean;
        wickUpColor: string;
        wickDownColor: string;
    };
    /** OHLC-bars style — its own up/down (independent of the candle body colors). */
    bars: {
        upColor: string;
        downColor: string;
    };
    /** Line style — its own color + width. */
    line: {
        color: string;
        width: number;
    };
    /** Area style — its own line + gradient-fill colors + width. */
    area: {
        lineColor: string;
        width: number;
        topColor: string;
        bottomColor: string;
    };
    /** Baseline style — its own above/below line + two-stop fill colors + width + level. */
    baseline: {
        topLineColor: string;
        bottomLineColor: string;
        topFillColor: string;
        topFillColor2: string;
        bottomFillColor: string;
        bottomFillColor2: string;
        width: number;
        baselineLevel: number;
    };
    series: {
        style: PriceStyle;
        baseline: number | null;
        /** Spacing multiplier for non-connecting styles (candles/bars/HA/plugin types): scales the
         *  center-to-center pitch (and the crosshair step) without changing body width. 1 = default. */
        spacing: number;
    };
    /** Session-zone shading — the washes painted over the session bands a host pushes
     *  through the `sessionZones` feature: pre/post-market on day-split tapes, the
     *  single extended-hours phase on overnight roll tapes (no bands ⇒ the colors are
     *  dormant). */
    sessions: {
        premarketColor: string;
        postmarketColor: string;
        extendedColor: string;
    };
    /** Draw-order keys — what paints in front of what. The candles' own key plus one per
     *  indicator id; user drawings persist their keys in the drawings document, in the same
     *  space, so a saved chart keeps a drawing under the candles or between two indicators. */
    stacking: {
        candles: number;
        series: Record<string, number>;
    };
}

/**
 * The native renderer's chart-settings dialog (item 15): a DOM overlay, opened from
 * an in-chart gear, that edits a curated slice of the serializable `ChartConfig`
 * (background, candle/grid/crosshair colors, fonts, price scale, timezone, …). Each
 * control emits a minimal nested patch via `onChange`; the renderer merges it onto
 * the live config and repaints with NO indicator re-run. A footer exposes the whole
 * config as JSON for export/import — the templating surface.
 *
 * It is renderer chrome (a positioned overlay on the chart container), kept
 * dependency-free and themed to match the chart, mirroring `InputsUI`.
 */
/** A host-contributed settings row: callback-based (the host owns the state).
 *  `heading` opens a titled group inside the tab (an in-pane section title);
 *  `color` is a swatch opening the themed picker (any CSS color, alpha included).
 *  `id` is the row's stable visibility id (defaults to the label's slug) — hiding a
 *  heading's id hides its whole group (see `settings-visibility.ts`). */
type HostSettingsRow = {
    kind: 'heading';
    label: string;
    id?: string;
} | {
    kind: 'toggle';
    label: string;
    get: () => boolean;
    set: (v: boolean) => void;
    id?: string;
} | {
    kind: 'select';
    label: string;
    options: readonly SettingsSelectOption[];
    get: () => string;
    set: (v: string) => void;
    id?: string;
} | {
    kind: 'color';
    label: string;
    get: () => string;
    set: (v: string) => void;
    id?: string;
};
/** A host-contributed settings tab (see `RendererControl.setSettingsSections`). */
interface HostSettingsSection {
    title: string;
    rows: readonly HostSettingsRow[];
    /** Tab position: own tab after Symbol (default), end of the rail, or rows INSIDE
     *  the Symbol tab itself (`'symbol'` — e.g. the widget's watermark toggle). */
    placement?: 'after-symbol' | 'end' | 'symbol';
    /** Stable visibility id (defaults to the title's slug). Row ids scope under it. */
    id?: string;
}

/**
 * The from-scratch "native" renderer (canvas2d backend in P0/P1/P2; hand-rolled
 * WebGL2 added in P3 behind the same backend seam). P0 implements the full
 * `IChartRenderer` surface but only the foundation is live: layered DOM, the
 * shared CoordinateSystem, the invalidation scheduler, pane layout, and
 * pointer/wheel pan-zoom over a placeholder grid. Series/fills/drawings/axes/
 * crosshair/inputs land in P1–P2.
 */
declare class NativeRenderer implements IChartRenderer {
    readonly capabilities: RendererCapabilities;
    private theme;
    private surfaceBackground;
    private surfaceTextColor;
    private wrapper;
    private plot;
    private toolbarGutter;
    private mountContainer;
    private backdropCanvas;
    private dataCanvas;
    private volumeCanvas;
    private vpvrCanvas;
    private chromeCanvas;
    private drawingsCanvas;
    private cursorCanvas;
    private overlayRoot;
    /** The host-styleable twin of the `shadeRight` veil (`.vela-shade-right`), directly under
     *  the cursor canvas; hidden whenever the crosshair layer paints no veil. */
    private shadeRightEl;
    /** The veil geometry last written to {@link shadeRightEl} ('' = hidden) — the DOM is
     *  touched only when it changes, never on a plain pointer move. */
    private shadeRightSig;
    private userDrawings;
    /** One price-axis tick source for the gridlines (backdrop) and the labels (chrome). */
    private readonly priceAxisTicks;
    private readonly backdropRenderer;
    private readonly volumeRenderer;
    /** SDK renderer layers instantiated at mount ({@link registerRendererLayer}). */
    /**
     * The mounted SDK layers. One BASE entry per registered definition (channel = the layer
     * id, no owner of its own), plus one DEDICATED entry per mounted native indicator whose
     * model names its own channel (`native.channel` — an instance of a multi-instance type):
     * same definition, its own canvas, reading that instance's channel and following that
     * instance's pane and z key. `channel` is unique across the array.
     */
    private extLayers;
    /** Last applied layer-canvas order (ids below + above the data canvas) — re-slotted only on change. */
    private layerOrderSig;
    private attributionEl;
    private attributionEnabled;
    /** Host-supplied mark shown INSTEAD of the built-in one (`attribution: '<html>'`). */
    private attributionHtml;
    private readonly vpvrRenderer;
    private resizeObserver;
    private dprMedia;
    /** Plot size in INTEGER device px, as last reported by the resize observer's
     *  device-pixel-content-box — the browser's own statement of how many device pixels
     *  it paints the plot into. `null` until the first report or where the box type is
     *  unsupported (WebKit); syncSize then falls back to rounding the client rect. */
    private plotDeviceSize;
    private readonly coords;
    private readonly scene;
    private backend;
    private backendMode;
    private glowAmount;
    private readonly chrome;
    /** Prepaints each indicator's Pine drawings into interleave slices at the model's z. */
    private readonly indicatorSlices;
    /** Hover tooltips for Pine labels (canvas hit-rects collected by the chrome layer). */
    private labelTooltip;
    /** The timeline-mark popup (a kit Popover anchored on a lane glyph); null before mount. */
    private markPopover;
    /** How the fanned mark stack was opened: a hover folds when the pointer leaves, a tap only on a tap elsewhere. */
    private marksExpandedBy;
    /** The rAF loop keeping the chrome repainting while a lane glyph pulses (hover) or flashes (click); null when idle. */
    private markPulseRaf;
    private readonly markClickCbs;
    private readonly crosshairLayer;
    private scheduler;
    /** The second pulse the countdown-to-bar-close chip ticks on: the host's (`setWallClock`)
     *  when one is wired, else the renderer's own second-aligned clock. */
    private hostClock;
    private ownClock;
    /** Live subscription to the pulse while the countdown is on; null when off. */
    private countdownUnsub;
    private animator;
    private input;
    private inputsUI;
    private symbolPicker;
    /** Indicator titles (the legend rows) shown — held here so a remount re-applies it. */
    private indicatorTitlesOn;
    /** Plot values beside the legend titles shown — held here so a remount re-applies it. */
    private indicatorValuesOn;
    /** Host-contributed legend actions — held here so a rebuild of the legend re-wires them. */
    private legendActionsProvider;
    /** Host-contributed legend callouts — held here so a rebuild of the legend re-wires them. */
    private legendCalloutsProvider;
    /** Host override of the legend's fold toggle — held here so a remount re-applies it. */
    private legendOverviewAction;
    private keyboard;
    private keyboardEnabled;
    /** Drawings layer self-serves Ctrl+Z/Y (see the `historyChords` feature). */
    private historyChordsEnabled;
    private liveRegion;
    private readonly animZoom;
    private readonly animPan;
    private readonly animScroll;
    private readonly animAutoscale;
    private readonly animLiveBar;
    private candleUp;
    private candleDown;
    private intro;
    private introOnStyle;
    private introPlayed;
    private introRaf;
    /** The load affordance (three pulsing dots) — up while the host reports a bar load in
     *  flight with nothing painted (first load, market switch). Rebuilt per show, so it
     *  picks up the current theme without a setTheme hook. */
    private loadingEl;
    private modelAlpha;
    private targetBarSpacing;
    private zoomAnchorLogical;
    private zoomAnchorX;
    private zoomAnchorMode;
    private panVelocity;
    private bars;
    private didInitialFit;
    /** A data-tier paint has happened (scales + drawing resolvers are real) — gates the
     *  cheap chrome-only repaint so it never draws over placeholder state. */
    private paintedData;
    private skeletonClockMs;
    private candleBodyAlpha;
    private candleStructureAlpha;
    private lastPointer;
    private volumeActive;
    private volumeHidden;
    private vpvrActive;
    private vpvrHidden;
    private liveEaseTime;
    private liveEaseHigh;
    private liveEaseLow;
    private liveEaseClose;
    private axisDragEnabled;
    private scaleDragHolder;
    private scaleDragHeight;
    private scaleDragStart;
    private paneResizeEnabled;
    private resizeAbove;
    private resizeBelow;
    private resizeSplitStart;
    /** The user drawings take part in pointer input (the runtime `drawingsInteractive` feature). */
    private drawingsInteractive;
    private hoverSeparatorY;
    private maximizedPaneId;
    private rightAxisW;
    private paneControls;
    private axisScaleButtons;
    private readonly paneActionCbs;
    private hoverLogical;
    private settingsDialog;
    /** The host's visibility policy (setting ids hidden from the dialog) — instance
     *  state, never part of the persisted config. */
    private hiddenSettings;
    /** Where modal dialogs mount — a HOST override (multi-chart shells pass their root
     *  so dialogs center globally instead of clipping inside one cell). Null = the plot. */
    private dialogHost;
    private settingsButton;
    private settingsEnabled;
    private scrollButton;
    private pointerNearScrollBtn;
    private scrollTargetRO;
    private scrollBtnBottomPx;
    private scrollBtnRightPx;
    private layoutMode;
    private readonly viewportCbs;
    private readonly crosshairCbs;
    private readonly chartTypeSettingsCbs;
    private readonly configChangedCbs;
    /** The settings dialog's Canvas → Theme row raises the pick here; the host applies it. */
    private readonly themeSelectCbs;
    /** First-run config snapshot — what "Reset defaults" restores. */
    private factoryConfig;
    private hostSettingsSections;
    private readonly clickCbs;
    private readonly axisLongPressCbs;
    private readonly inputChangeCbs;
    private readonly removeIndicatorCbs;
    private readonly toggleVisibleCbs;
    private readonly moveIndicatorCbs;
    private readonly priceStyleCbs;
    private readonly priceStyleWillChangeCbs;
    constructor(opts?: RendererDisplayOptions);
    readonly name = "native";
    readonly features: readonly string[];
    /** Apply a render feature live — mutate the field + invalidate, no engine re-run. */
    applyFeature(key: string, value: unknown): void;
    readFeature(key: string): unknown;
    /**
     * Native-layer data push (see `setNativeData` on the port), keyed by native type. A chart-type
     * indicator pushes its per-bar order-flow (revealed under the candles on zoom); the volume + VPVR
     * indicators push their layer CONFIG only — both layers read the chart's bars each frame.
     */
    setNativeData(type: string, data: unknown): void;
    /** Reflect an indicator's live status (loading / live / idle) in its legend row. */
    setIndicatorStatus(handle: IndicatorRenderHandle, status: IndicatorStatus): void;
    /**
     * The host reports a bar load in flight with nothing painted (first load, market switch —
     * see the port): three small dots pulse at the center of the plot. Web-Animations-driven,
     * so no stylesheet crosses the renderer boundary; pointer-transparent, and removed (not
     * hidden) on clear so a re-show picks up the current theme.
     */
    setLoading(loading: boolean): void;
    /**
     * Set the active symbol's tick size so the price axis shows the instrument's true
     * precision (see the port). Undefined / non-positive ⇒ fall back to the zoom formula.
     */
    setPricePrecision(mintick: number | undefined): void;
    /**
     * Snapshot the full chart cosmetics as one serializable, versioned document.
     * Every inherited value is resolved to a concrete one so an exported template
     * stands on its own. Stable shape — safe to persist (localStorage) or share.
     */
    getConfig(): ChartConfig;
    /**
     * Apply a (possibly partial) config document — the inverse of `getConfig()`.
     * Untrusted JSON is validated + merged onto the current config (`mergeConfig`),
     * so malformed fields are dropped and a partial patch only changes what it names.
     * Repaints with NO indicator re-run; safe to call live or before mount.
     */
    applyConfig(config: unknown): void;
    /**
     * Reorder one indicator's series layer. Accepts `{ id, to: 'front' | 'back' }`
     * (relative to every layer incl. the candles) or `{ id, z }` (an explicit key).
     */
    private applySeriesOrder;
    /** Toggle the in-chart settings gear + dialog (the `settings` feature). The gear
     *  sits above the time axis, clear of the right price-axis strip. */
    private setSettingsEnabled;
    private makeSettingsButton;
    /** Port surface: hosts (bottom-bar / chrome buttons) open the same dialog as the
     *  in-chart gear — created on demand, independent of the gear feature being enabled. */
    openSettingsDialog(section?: string): void;
    /** (Re)aim the dialog's Canvas → Theme row: the current selection reflects the STABLE
     *  app-theme surface (not the plot background, which the config recolors
     *  independently); a pick is raised to the host (`onThemeSelect`), which owns the
     *  canonical theme. */
    private syncThemeControl;
    private toggleSettingsDialog;
    /**
     * The document "Reset defaults" applies: every setting back to its first-run value,
     * with two things that are NOT settings held or resolved here — the price style
     * stays the one the user is looking at, and the timeline-mark groups (an additive
     * merge, like the type bags) are named back to their host-declared visibility.
     */
    private factoryResetDocument;
    /** Close the in-chart dialogs (indicator settings + chart-settings gear). No-op when none are open. */
    closeDialogs(): void;
    /** Jump-back-to-latest button — same size/border chrome as the drawing-toolbar collapse toggle. */
    private makeScrollToRealtimeButton;
    /** Double-chevron icon — the "jump back to the latest bar" affordance. */
    private scrollButtonIcon;
    /** The button's fill — the chart background at 50% so it blends with the plot beneath. */
    private scrollButtonSurface;
    /** Re-sync the scroll button's colors when `layout.background` changes — called from both
     *  `applyConfig` (playground path) and `setTheme` (app-theme swap). */
    private refreshScrollButtonTheme;
    /** Track cursor proximity to the scroll button on the plot (bubbles from the button too,
     *  so moving onto the button doesn't count as leaving). */
    private readonly onScrollProximityMove;
    private readonly onScrollProximityLeave;
    /** Show the button only when the latest bar is scrolled off the right edge. On desktop the
     *  cursor must also be nearby (hover reveal); on mobile — no hovering cursor — the button
     *  appears whenever the latest bars are off-screen and hides again once the view is back
     *  at the right edge. */
    private updateScrollToRealtimeButton;
    /** Glide the view back to the most recent bars, keeping the current zoom (barSpacing). */
    private scrollToRealtime;
    /** Ease rightOffset to `target` at constant zoom (see animTick's scroll glide);
     *  instant when the scroll glide is off. Shared by scroll-to-latest and panBy. */
    private glideRightOffset;
    /**
     * Export the current chart as a PNG data URL by compositing EVERY plot canvas onto
     * an offscreen canvas, in the same stacking order the DOM shows: plugin layers
     * below the data, geometry (L0), volume columns (L0.25), the visible-range volume
     * profile (L0.6), plugin layers above the data, chrome (L1), and user drawings
     * (L1.5). The background is filled first (the canvas2d data layer is transparent —
     * its bg lives on the wrapper), and a fresh synchronous paint runs first so the
     * WebGL2 backend's (non-preserved) drawing buffer is populated before it's read
     * back this tick — the same paint also repaints the drawings layers, so they're
     * current. DOM chrome joins as a best-effort text/chip raster (see
     * `rasterizeOverlay`): the per-pane indicator legends, plus any host overlay that
     * opts in with a `data-vela-screenshot` attribute on the mount container's
     * subtree (the widget marks its status line, and its symbol watermark with
     * `"under"` — drawn beneath the canvases, where it sits on screen). Only the
     * crosshair (L2) is intentionally excluded. {@link screenshot} is this canvas
     * as a PNG data URL.
     */
    screenshotCanvas(): HTMLCanvasElement | null;
    screenshot(): string | null;
    /**
     * The candles-first-appear reveal — animates the **candles themselves** (no extra
     * element). Each candle's OHLC is interpolated from a flat tick at its open up to
     * full size, eased, with a left→right stagger so the chart draws itself; `settle`
     * adds an ease-out-back overshoot. Autoscale stays on the real bars so the frame
     * never moves. Re-callable, so styles can be compared live from the console.
     * Style and sweep duration come from the resolved `intro` setting.
     */
    private playIntro;
    /** After the candle reveal, fade the indicator models (series/fills/…) from hidden to full. */
    private fadeInModels;
    /**
     * One candle of the reveal: interpolate its body + wick from a flat tick at the open
     * up to full size, staggered left→right. `settle` overshoots past full then eases back.
     */
    private revealCandle;
    /** Theme with the configured candle up/down colors applied (candles, wicks,
     *  plotcandle defaults, and the current-price line direction all follow them). */
    private deriveTheme;
    /** The theme the chrome (drawing toolbar / settings popups) paints with: the live theme
     *  but pinned to the stable surface background, text, and border, so custom plot cosmetics
     *  never recolor the toolbar, gutters, or drawing UI chrome. */
    private chromeTheme;
    /** The colors the axis-scale gutters (price + time) paint with: the LIVE chart background
     *  (`layout.background`) and its contrast-corrected text, so the scales read as part of the
     *  plot. Only the toolbar/dialog chrome stays on the stable app-theme surface. */
    private axisSurface;
    mount(container: HTMLElement, theme: VelaTheme): void;
    /**
     * Create + mount the L0 geometry backend and return its canvas. Picks WebGL2
     * when allowed + available (probed), else the canvas2d backend (the permanent
     * fallback). If a GL context can't be acquired the (tainted) canvas is discarded
     * and a fresh one is made for canvas2d.
     */
    private makeDataCanvas;
    private createGeometryBackend;
    /**
     * The WebGL2 context became permanently unusable (a restore couldn't rebuild
     * the program) → replace the L0 backend with the canvas2d fallback on a fresh
     * data canvas. The chrome/cursor layers + viewport state are untouched.
     */
    private swapToCanvas2dFallback;
    /**
     * Re-sync both canvases when devicePixelRatio changes WITHOUT a CSS resize —
     * e.g. dragging the window to a monitor with different scaling, or an OS/
     * browser zoom change (the ResizeObserver doesn't fire for those). A
     * `(resolution: Xdppx)` query only tracks one dpr boundary, so it's re-armed
     * for the new dpr each time it fires.
     */
    private watchDpr;
    private readonly onDprChange;
    setTheme(theme: VelaTheme): void;
    resize(): void;
    /** Drive the countdown chip from the host's second pulse (`null` → the renderer's own). */
    setWallClock(clock: WallClock | null): void;
    /** Subscribe to the second pulse while the countdown chip is on (so it ticks); unsubscribe
     *  otherwise. Chrome tier: only the chip's text moves — an idle chart must not recompute
     *  scales or repaint the geometry/volume/VPVR/SDK layers once a second (that cost
     *  multiplies by the cell count in a multi-chart workspace). */
    private syncCountdownTimer;
    destroy(): void;
    setBars(bars: OHLCV[], opts?: {
        preserveView?: boolean;
    }): void;
    updateBar(bar: OHLCV): void;
    /** Set the reveal (style + duration). A non-off style is also remembered as what the
     *  config's on/off toggle (`animations.intro`) switches back on to. */
    private setIntro;
    /** Snap the eased forming-bar state to `bar` — no glide (a fresh bar or the first tick of one). */
    private syncLiveEase;
    /** Glide the forming bar's displayed high/low/close toward the actual latest. Returns true while easing. */
    private easeLiveBar;
    ensurePane(pane: Pane): void;
    removePane(id: string): void;
    /** Move/merge a mounted indicator to another pane (its scale column follows via `ownScale`). */
    setIndicatorPane(handle: IndicatorRenderHandle, paneId: string, opts?: {
        ownScale?: boolean;
    }): void;
    orderPanes(orderedIds: string[]): void;
    setPaneCollapsed(paneId: string, collapsed: boolean): void;
    setPaneMaximized(paneId: string | null): void;
    onPaneAction(cb: (a: PaneAction) => void): Unsubscribe;
    private emitPaneAction;
    onMoveIndicator(cb: (id: string, target: MoveTarget) => void): Unsubscribe;
    /** The number of merged (own-scale) scale columns needed = max across panes. */
    private maxOwnScaleColumns;
    /** Recompute the right-gutter width (master column + one per merged scale). Re-sizes on change. */
    private refreshAxisWidth;
    /**
     * Re-derive one model's index offset: the chart bar index of its `anchorTime` (see
     * `IndicatorModel.anchorTime`). Absent anchor, or an anchor matching the first bar,
     * means whole-chart alignment — offset 0, today's norm. An anchor that doesn't land
     * exactly on a chart bar renders unanchored (defensive; engines stamp a real bar time).
     */
    private refreshAnchorOffset;
    mountIndicator(model: IndicatorModel): IndicatorRenderHandle;
    updateIndicator(handle: IndicatorRenderHandle, patch: ScenePatch): void;
    removeIndicator(handle: IndicatorRenderHandle): void;
    setIndicatorInputs(handle: IndicatorRenderHandle, values: Record<string, InputValue>, props?: Record<string, InputValue>): void;
    setSymbolPicker(picker: SymbolPickerFn | null): void;
    setLegendActions(provider: ((indicatorId: string) => LegendActionView[]) | null): void;
    setLegendCallouts(provider: ((indicatorId: string) => LegendCalloutView[]) | null): void;
    setLegendOverviewAction(action: (() => void) | null): void;
    openIndicatorSettings(indicatorId: string): void;
    /**
     * Hide/show a mounted indicator. Hiding drops its model from the scene (so every paint path —
     * series, fills, drawings, tables, glow, data window — skips it) while keeping its z key and its
     * legend row (marked hidden). The core re-mounts it on show, so this only needs to drop the
     * visuals and flag the row.
     */
    setIndicatorVisible(handle: IndicatorRenderHandle, visible: boolean): void;
    onInputChange(cb: (e: InputChangeEvent) => void): Unsubscribe;
    onToggleIndicatorVisible(cb: (id: string, visible: boolean) => void): Unsubscribe;
    onPriceStyleChange(cb: (style: PriceStyle) => void): Unsubscribe;
    onPriceStyleWillChange(cb: (from: PriceStyle, to: PriceStyle) => void): Unsubscribe;
    /**
     * THE single write path for the base price style at runtime (feature set / settings dialog /
     * config template — the constructor seeds the field directly, pre-listeners). Announces the
     * switch while the scene still holds the old style (a listener may paint/capture that frame),
     * then updates the scene, eases any reveal layer toward the new style's target, and notifies
     * the core — which owns the DATA side of styles that need one (a chart type's SeriesDataEngine).
     */
    private setPriceStyle;
    onRemoveIndicator(cb: (id: string) => void): Unsubscribe;
    /** Port surface: the host shell's chrome size class. Mobile switches the renderer
     *  chrome to its touch-first presentation — fullscreen dialogs, no docked drawing
     *  toolbar (the shell provides its own picker), the scroll-to-latest button shown
     *  whenever the latest bars are off-screen (touch has no cursor proximity). */
    setLayoutMode(mode: 'mobile' | 'desktop'): void;
    setSettingsSections(sections: HostSettingsSection[]): void;
    setSettingsVisibility(policy: {
        hidden?: readonly string[];
    }): void;
    listSettingsIds(): string[];
    onChartTypeSettingsChange(cb: (typeId: string, values: Record<string, unknown>) => void): Unsubscribe;
    onConfigChanged(cb: () => void): Unsubscribe;
    onThemeSelect(cb: (theme: ThemeName) => void): Unsubscribe;
    onCrosshairMove(cb: (e: CrosshairEvent) => void): Unsubscribe;
    onClick(cb: (e: ClickEvent) => void): Unsubscribe;
    onAxisLongPress(cb: (e: AxisLongPressEvent) => void): Unsubscribe;
    setTimelineMarks(marks: readonly TimelineMark[], groups: readonly MarkGroup[]): void;
    onMarkClick(cb: (e: MarkClickEvent) => void): Unsubscribe;
    /** Every group the lane knows: the defined ones, then those marks name without a definition. */
    private markGroupsInUse;
    /**
     * The groups as the Events tab lists them: nested only under a DEFINED parent. The
     * painter's visibility chain resolves parents against the defined groups alone, so a
     * parent that marks merely name must not nest (and dim) a child the painter still shows.
     */
    private markGroupsForEventsTab;
    onViewportChange(cb: (range: VisibleRange) => void): Unsubscribe;
    getVisibleRange(): VisibleRange | null;
    setVisibleRange(range: VisibleRange): void;
    /** Pan by a fraction of the visible width at constant zoom (positive ⇒ toward the
     *  latest bars). Mirrors a drag exactly: the target is clamped by the same viewport
     *  bounds (so panning forward stops at the newest candle plus the bounded right
     *  whitespace) and eases on the scroll-to-latest glide — repeated calls retarget the
     *  running glide, so a held key reads as one continuous scroll. */
    panBy(fraction: number): void;
    /** Instant viewport set (drag, freeze-on-touch, setVisibleRange) — stops any animation. */
    private applyViewport;
    /** Eased cursor-anchored zoom: glide barSpacing → target, pinning the anchor logical at its pixel. */
    private zoomTo;
    /** Inertial pan: continue with a rightOffset velocity (logical units / ms) that decays. */
    private fling;
    private anchoredRightOffset;
    /**
     * Bound the viewport so the user can't zoom/pan into a useless state:
     *  - zoom OUT no further than "all bars + a small margin fill the width" (no thin strip
     *    of compressed candles floating in whitespace);
     *  - zoom IN no further than keeping ≥ {@link MIN_VISIBLE_BARS} candles on screen;
     *  - pan no further than a bounded right whitespace / the same minimum visible.
     * Applied at every viewport write (drag, wheel, fling, time-axis drag, keyboard).
     */
    private clampViewport;
    /** One animation frame: ease zoom + integrate inertia + glide autoscale, then paint. */
    private animTick;
    /** Ease each pane's rendered scale toward its autoscale target (snap within epsilon).
     *  Log panes ease in LOG space so the glide is uniform on screen (the pane renders
     *  through Math.log), not a non-linear jump. */
    private easeScales;
    private emitViewportChange;
    private handlePointerMove;
    private handleClick;
    /**
     * Fan out (or collapse, with null) a multi-group mark stack; repaints the chrome tier when
     * it changes. A stack whose glyph holds the open popup stays fanned — the pointer leaving
     * the plot for the popup must not bury the glyph under the deck (which would close it).
     */
    private setMarksExpanded;
    /**
     * A click on the mark lane: a collapsed deck fans out (the touch path — a mouse already
     * fanned it by hovering), a glyph reports its cluster (`onMarkClick`) and opens the popup
     * when any of its marks carries content. True when the click landed on the lane.
     */
    private handleMarkClick;
    /** After a chrome frame: keep the open mark popup on its glyph, or close it once the glyph is gone. */
    private trackMarkPopover;
    /** The lane glyph under the pointer — it swells once as the pointer lands (a rAF-driven chrome repaint for the pulse's duration). */
    private setMarkHover;
    /** Run a chrome-tier repaint loop while a glyph's hover pulse or click flash plays; it stops itself once both are over. */
    private syncMarkPulse;
    private paneAtY;
    /** The pane node whose vertical bounds contain `y` (linear scan; panes don't overlap). */
    private paneNodeAtY;
    /** The pane whose bounds sit closest to `y` — the forgiving fallback for points that
     *  fall BETWEEN bounds (separator gaps, the strip under the last pane). */
    private nearestPaneToY;
    /** The scale window a gesture targets: a pane's master scale, or a merged indicator's
     *  own scale column (resolved from the grabbed x). Both share the four scale fields. */
    private resolveScaleHolder;
    /** Grab the price axis: snapshot the grabbed scale's window and freeze it into manual mode. */
    private beginPriceScale;
    /** Rescale the grabbed scale around its center by the total drag (down ⇒ zoom out). */
    private priceScaleBy;
    /** Grab inside the data area: vertical price-pan is available only when the pane is
     *  already manual (so a normal drag stays a pure time-pan until the user opts in). */
    private beginPricePan;
    /** Pan the grabbed pane's price window by the total drag (down ⇒ show lower prices). */
    private pricePanBy;
    /** Double-click the price axis → drop manual mode for that scale (autoscale resumes). */
    private resetPriceScale;
    /**
     * New double-click semantics inside the data area: the price pane toggles collapse of
     * every study pane (hide/show sub panes); a study pane toggles maximize. (Keyboard `0`
     * still fits the view.)
     */
    private dataDblClick;
    /** Re-fit the view and drop every manual scale (keyboard `0`). */
    private resetView;
    private setManualScale;
    /** Relayout + repaint + refresh the hover buttons after a collapse/maximize/order change. */
    private afterPaneLayoutChange;
    /** Thin projection of the panes for the hover-control cluster (top-to-bottom order). */
    private paneControlViews;
    /** Reorder a study pane one slot up/down (renderer-applied, mirrored to core via onPaneAction). */
    private movePaneLocal;
    /** True when `y` is within the hit zone of a draggable sub-pane separator. */
    private paneSeparatorAt;
    /** Pixel y of the draggable separator under the cursor (for the hover highlight), or null. */
    private separatorHoverY;
    /** Index (in `orderedPanes`) of the LOWER pane whose top separator is within the hit
     *  zone of `y`, or null. Separators sit between every adjacent pair, so the first
     *  candidate is index 1 (the top of the second pane). */
    private separatorPaneIndexAt;
    /** Grab the separator at `y`: snapshot the adjacent panes + their shared pixel span. */
    private beginPaneResize;
    /** Resize the grabbed panes by the total drag (down ⇒ grow the upper pane), keeping the
     *  combined weight fixed so every other pane keeps its height. */
    private paneResizeBy;
    /** Double-click a separator → split the two adjacent panes evenly (each gets half of
     *  their combined weight). A simple, predictable reset that leaves siblings untouched. */
    private resetPaneSize;
    /** Enable/disable keyboard control: focusability + ARIA + key listeners + live region. */
    private setKeyboardEnabled;
    /** Pan the view by a whole number of bars (keyboard): +bars ⇒ toward the latest. */
    private panByBars;
    /** Zoom one keyboard notch, right-edge anchored (+1 in, -1 out). */
    private zoomByStep;
    /** Move the focused bar by `delta` from the current crosshair bar (or the last bar). */
    private stepCrosshair;
    /** Center-ish the given bar in view (scrolling minimally), draw the crosshair on it,
     *  and announce its OHLC + indicator values to the ARIA live region. */
    private focusBar;
    /** Update the ARIA live region with a spoken summary of bar `idx` (date + OHLC + values). */
    private announceBar;
    /** The data-window readout (port seam) — the hovered bar's date/time and OHLCV plus every
     *  indicator's value there, or the latest bar when the cursor is off the plot. Values are
     *  pre-formatted on the scale of the pane they belong to, so a host panel renders them as-is. */
    getDataWindowReadout(): DataWindowReadout;
    private dataWindowPricePane;
    private dataWindowFmt;
    private dataWindowOHLC;
    /** One group per indicator (name = indicator title), each with a row per plot shown in the data window. */
    private dataWindowGroups;
    /** One indicator's readout at bar `idx` for one value surface (the legend or the data window):
     *  a row per plot shown on that surface, formatted on its pane's scale. A plot's `display`
     *  decides per surface — a data-window-only plot has a row here and none in the legend. */
    private readoutRowsFor;
    /** The volume indicator's readout: the bar's volume, tinted with the layer's own direction
     *  colors. Hiding volume keeps its model in the scene (only the layer is suppressed — see
     *  `setIndicatorVisible`), so the hidden flag is checked here rather than by model absence. */
    private volumeReadoutRows;
    /** Refresh the plot values beside every legend title — the same bar the data window reads
     *  (crosshair bar, else the latest bar), pushed per paint, filtered to the plots whose
     *  `display` includes the legend. A hidden indicator has no scene model, so its row is
     *  absent from the map and its readout clears. */
    private updateLegendValues;
    private renderFrame;
    /** Repaint the L2 crosshair canvas and keep the `.vela-shade-right` element on the veil it painted. */
    private renderCrosshairLayer;
    /** Position (or hide) the `.vela-shade-right` element over the veil of the last crosshair frame. */
    private syncShadeRight;
    /** Repaint the SDK layers that opted into cursor tracking (their own canvas only). */
    private repaintCursorLayers;
    /** Blank one SDK layer canvas (a collapsed host pane suppresses the layer's painting). */
    private clearLayerCanvas;
    /** One frame's args for an SDK renderer layer (shared by the data + cursor paint paths).
     *  Data + pending come from the entry's channel (per instance for a dedicated entry);
     *  the settings bag is the TYPE's — a chart type's dialog values, one bag per type. */
    private extLayerArgs;
    /** Paint the below-data (L-1) + geometry (L0) + chrome (L1) layers from the current scene/coords. */
    private paintData;
    /** Build the data→pixel projector user drawings resolve their anchors through. */
    private drawingProjector;
    /** OHLC bars whose open-time falls within `[from, to]` (inclusive) — the data a regression
     *  (or other statistical) drawing fits against. `this.bars` is ascending, so a linear scan is fine. */
    private barsInTimeRange;
    /** The interactive user-drawings surface the core DrawingController drives. */
    get userDrawingsPort(): IDrawingsRendererPort | undefined;
    /** Focus the data canvas — the element chart/drawing keyboard shortcuts key off
     *  (tabIndex 0 while the `keyboard` feature is on). Host UIs call it after their
     *  own controls steal focus (e.g. a shared workspace toolbar click). */
    focus(): void;
    /** EXTERNAL (synced) crosshair — a ghost marker driven by another chart. Kept in
     *  DATA space (epoch-ms + optional price) so it stays glued through pan/zoom. */
    private externalCross;
    /** Show/clear the external ghost crosshair (port seam — see IChartRenderer). It only
     *  repaints the cursor overlay (Cursor tier) and NEVER re-emits onCrosshairMove. */
    setExternalCrosshair(time: Millis | null, price?: number | null): void;
    /** Resolve the ghost to pixels for THIS frame (null when off-window or dataless).
     *  Snaps by FLOOR to the bar CONTAINING the foreign time — never by rounding: a 1h
     *  pointer at 14:00 must light THIS day's daily candle, not tomorrow's (a time past
     *  a bar's midpoint still belongs to that bar). Before the first open or past the
     *  forming bar there is no containing bar — no ghost. */
    private externalCrossPx;
    /** Sticky magnet mode for user drawings (off/weak/strong); the drawings toolbar drives it. */
    private snapMode;
    /** Set the sticky magnet mode (called by the drawings toolbar's 3-state button). */
    setSnapMode(mode: SnapMode): void;
    /**
     * Snap a data point to the nearest candle for the drawing magnet: time → the nearest
     * bar, price → that bar's closest OHLC value. Off the price pane (sub-panes have no
     * OHLC) only the time snaps. `weak` only snaps when the candle point is within
     * {@link WEAK_SNAP_PX} of the cursor pixel; `strong` always snaps; `off` is a no-op.
     */
    private snapToCandle;
    /**
     * Per-pane autoscale — the single price-window pass both layers consume. Folds
     * the visible series (computePaneScale) with the visible Pine-drawing range
     * (own drawings per pane + force_overlay drawings on the price pane), so a box/
     * line/label outside the series range still expands the scale and never clips.
     * Runs only on Light/Full frames (the crosshair-only Cursor tier reuses the
     * retained pane.scale).
     */
    private computeScales;
    /** Union of the visible trade-marker autoscale hints across every mounted indicator
     *  (trade markers always target the price pane, whatever pane their model landed on). */
    private tradesScaleHints;
    private fitContent;
    /** Re-frame after a series replacement (a symbol/timeframe switch): keep the user's
     *  zoom (bar spacing), re-anchor the newest bars at the configured right margin.
     *  `clampViewport`'s fit-all-bars floor deliberately does NOT apply — a progressive
     *  head may still be backfilling toward the previous depth, and raising the spacing
     *  to its temporary bar count would lose the zoom this exists to keep. */
    private reframeKeepZoom;
    private paneBoundsFor;
    /** The display title of a study pane's master (pane-scale) indicator — merged own-scale
     *  indicators don't name the pane. Null when the pane holds no indicators. */
    private paneMasterTitle;
    /** The pane a bespoke-layer native indicator (volume/vpvr) currently lives in (null = not mounted). */
    private nativeLayerPane;
    /** One transparent, pointer-transparent SDK layer canvas covering the plot. */
    private createLayerCanvas;
    /**
     * Mount the DEDICATED layer of a native indicator that names its own channel (an
     * instance of a multi-instance type painting through a registered layer): a fresh
     * instance of the layer's definition on its own canvas, reading that channel. Idempotent
     * — a show after hide re-mounts the model, and the layer (kept across the hide, like the
     * z key) is simply reused. Skipped while the renderer itself is unmounted (`mount()`
     * catches up from the scene).
     */
    private ensureInstanceLayer;
    /** Tear down the dedicated layer of a removed indicator (a hide keeps it). */
    private dropInstanceLayer;
    /** The mounted native indicator that OWNS an SDK layer entry. A dedicated entry is
     *  owned by the instance it was mounted for; the base entry by the mounted indicator
     *  whose type equals the layer id and that has no channel of its own (the id doubles
     *  as the data channel, so the pairing is the SDK's own contract). Null for chart-type
     *  channels and while the owner is hidden (a hidden indicator leaves the scene; its
     *  cleared data channel paints nothing anyway). */
    private layerOwner;
    /** The pane an SDK layer paints on: its owner's pane, else the price pane. */
    private layerPane;
    /** The SDK layer canvases split around the data canvas, each side back-to-front:
     *  owned layers by their owner's z key against the candles' (an indicator restacked
     *  below the candles takes its layer canvas along), unowned by declared placement. */
    private orderedLayerCanvases;
    /** The full canvas pile in paint order (backdrop + layers + data/volume/vpvr) — what
     *  the DOM stacking and the screenshot compositor must both follow. */
    private canvasPile;
    /** Re-slot the SDK layer canvases in the plot when the computed order changed (a z
     *  write, a restored config, an indicator mount/remove/restack). Runs at the top of
     *  every data frame; a no-op when the signature is unchanged. Re-inserting an
     *  absolutely-positioned, pointer-transparent canvas repaints nothing by itself. */
    private syncLayerCanvasOrder;
    /** True when an active volume layer is this study pane's ONLY content — so its scale should
     *  come from volume, not the empty {0,1} placeholder. (In the price pane, or alongside a real
     *  series, volume stays a bottom overlay and the master scale wins.) */
    private volumeOwnsPane;
    /** True when this study pane's master content is only SDK-layer natives (series-less
     *  models whose type names a mounted layer) — its scale then follows the visible bars
     *  (see the call site). Any real master series takes over the scale as usual. */
    private layerNativesOwnPane;
    /**
     * True for the layer painting the ACTIVE chart type (the base entry whose id is the
     * current price style) while the price series is hidden. The chart type IS the price
     * series, so "hide chart" blanks its layer along with the bars; an indicator's layer
     * (an overlay layer native, on any pane) is independent content and keeps painting.
     */
    private layerHiddenWithCandles;
    /**
     * True when an overlay layer native (a series-less model whose type names a mounted
     * layer) sits on the price pane: it paints at BAR PRICES without contributing a series,
     * so hiding the candles must keep the bars in the price scale — with nothing else on the
     * pane the scale would fall to the {0,1} placeholder and the layer would paint off-screen
     * and vanish. The chart type's own layer does not count: it is blanked with the candles.
     */
    private priceLayersAnchoredToBars;
    /** True when the pane's master content contributes SOMETHING to its autoscale besides
     *  the candles: a series painted on the pane (force_overlay ones scale elsewhere), a
     *  price line, or a measured drawings range. Mirrors what `computePaneScale` considers. */
    private paneHasMeasurableContent;
    /** Per-pane scale state for a host UI (e.g. a price-axis context menu): the pane's pixel
     *  band (`top`/`height`, so a click y maps to a pane) plus its current axis `mode`/`log`.
     *  Top-to-bottom order. Every pane is independent — the price pane from the scene setting,
     *  study panes from their own. */
    private paneScaleInfos;
    /** Thin projection of the panes for the axis A/L hover buttons (top-to-bottom order). */
    private axisScaleViews;
    /** Toggle one pane's autoscale (the A axis button): off freezes the current window into
     *  manual mode, on drops it — the per-pane twin of the chart-level `autoScale` feature. */
    private togglePaneAuto;
    /** Set one pane's axis mode. The price pane routes to the scene-level setting (persisted +
     *  keyboard shortcuts); a study pane keeps its own, so panes never affect each other. */
    private setPaneScaleMode;
    /** Set one pane's logarithmic flag; the price pane routes to the scene-level flag.
     *  Log and auto are INDEPENDENT: a frozen (manual) window is kept — its price bounds
     *  stay put and only its `log` tag flips, so the same range re-renders in the new
     *  space instead of snapping back to autoscale. */
    private setPaneLog;
    /** Flip one pane's axis (high at the bottom). The price pane routes to the scene-level flag
     *  (persisted with the chart config); study panes keep their own so panes stay independent. */
    private setPaneInvert;
    /** Stamp each pane's current inversion onto the live scale objects that {@link CoordinateSystem}
     *  reads (the pane master scale, its target/manual windows, and any merged own-scale columns),
     *  so `priceToY`/`yToPrice` flip consistently across every layer — data, chrome, drawings,
     *  crosshair, hit-testing. Run once per paint (scales are rebuilt each frame by autoscale/ease),
     *  which also covers pointer-time reads between frames since the objects retain the last stamp. */
    private stampScaleInvert;
    /** The first visible value a study pane measures percent-change from: the earliest finite
     *  value at bar `i0` across its master series (line-like value, else a candle/bar close).
     *  0 when none is available yet — the axis then falls back to absolute. */
    private firstVisibleValue;
    /** Largest volume across the visible bar-index window (0 when none) — the volume pane's scale top. */
    private maxVisibleVolume;
    private layoutPanes;
    /** Pin the scroll-to-realtime button above the bottom-most EXPANDED pane's data area:
     *  with all lower sub-panes collapsed it settles into the lowest open pane. */
    private repositionScrollButton;
    /** For each collapsed pane, the master (master-scale) indicator id whose legend row stays in the
     *  strip — merged own-scale indicators are hidden while collapsed. */
    private collapsedMasterMap;
    /** Reserve `px` of left gutter for the docked drawings toolbar (0 releases it) + re-lay-out the plot. */
    private setToolbarGutter;
    /** Publish the gutters on the mount container as `--vela-toolbar-gutter` (left,
     *  drawings toolbar) and `--vela-scale-gutter` (right, the full price-scale width
     *  incl. merged own-scale columns), so host overlays sharing that container (a
     *  status line, a watermark, a custom legend) can anchor to the plot's edges
     *  without reaching into the renderer's DOM. */
    private publishGutters;
    /** Publish the price pane's vertical insets as `--vela-price-pane-top` /
     *  `--vela-price-pane-bottom` on the mount container, so the symbol watermark
     *  (and any other host overlay) can clip to the price pane instead of spanning
     *  study panes and the time axis. A maximized study pane collapses the box to
     *  zero height — the mark does not appear on a study. */
    private publishPricePaneBounds;
    /** The built-in mark, or the host's own when one is set. */
    private buildAttributionEl;
    /** Swap the mark in place — the content kind changed (built-in ↔ host-supplied). */
    private rebuildAttribution;
    /** Bottom-left of the LOWEST visible, non-collapsed pane, above the time axis, clear of
     *  the drawings toolbar — the same anchor rule as the scroll-to-realtime button. With
     *  collapsed strips (or a maximize hiding the rest) at the bottom, the mark climbs into
     *  the lowest open pane instead of sitting on a strip's legend. */
    private positionAttribution;
    /** Re-tint the mark when the plot background flips light/dark. A host-supplied mark
     *  only gets the ink color — its own artwork keeps whatever colors it declares. */
    private refreshAttributionColor;
    private syncSize;
    private applyBackground;
}

/** Cosmetic/placement options — defaults reproduce the in-renderer docked bar exactly. */
interface DrawingToolbarOptions {
    /** Border/divider color. Default: the theme's border color (follows theme swaps). */
    borderColor?: string;
    /** Bar width in px. In docked (`'absolute'`) use it MUST match the host renderer's
     *  left-gutter reservation ({@link TOOLBAR_WIDTH}, 44). Default 44. */
    width?: number;
    /** `'absolute'` (default): pinned over the renderer's left gutter. `'static'`: a
     *  normal column child — a workspace docks ONE shared bar in its own layout. */
    dock?: 'absolute' | 'static';
    /** Collapse/expand notification — a docked host resizes its gutter reservation to
     *  {@link TOOLBAR_COLLAPSED_WIDTH} / the full width (a static bar reflows on its own). */
    onCollapse?: (collapsed: boolean) => void;
    /** When given, a drawings-sync toggle renders below the stay button: enabled, every
     *  NEWLY CREATED drawing is copied onto the other linked charts and the set stays
     *  linked — edits and removals follow (a multi-chart host's concern — a
     *  single-chart bar omits the callback and never shows it). */
    onDrawingsSync?: (on: boolean) => void;
}
/**
 * The vertical drawing toolbar (renderer chrome), docked as a flush bar in the left gutter. Each
 * {@link ToolGroup} is a cell: clicking the icon arms the group's last-used tool; a chevron beside
 * it — its own hover target, revealed on cell hover — opens a flyout listing the group's tools. A
 * cursor button returns to select/idle; measure/eraser modes sit at the bottom, and the magnet is a
 * cell whose chevron opens an Off/Weak/Strong menu (its icon toggles the last-used strength on/off).
 * Below the magnet, a stay-in-drawing-mode toggle keeps tools armed after each placement.
 * Hover and active tints are CSS-driven (`:hover` + `[data-active]`) so they never lag. Every
 * icon carries a themed tooltip (the chrome default 700ms dwell); a group cell's tip names the
 * tool its icon arms (the last-used one). Pure vanilla DOM on the host (a `pointer-events:auto`
 * island).
 */
declare class DrawingToolbar {
    private readonly host;
    private theme;
    private readonly onArm;
    private readonly onMagnet;
    private readonly onMeasure;
    private readonly onEraser;
    private readonly onToggleFavorite;
    private readonly onStayMode;
    private readonly root;
    private def;
    private active;
    private readonly lastUsed;
    /** FAVORITE tool types (core-authoritative; pushed via setFavorites). */
    private favorites;
    /** Per-tool shortcut display strings (host-pushed via setShortcuts). */
    private shortcuts;
    /** Star elements of the currently open flyout, by tool type (live-updated, never stale). */
    private readonly starEls;
    private flyout;
    private flyoutOwnerId;
    private flyoutCell;
    /** Closed flyouts still playing their exit animation, by owner id — reopening the same
     *  owner takes its element back instead of stacking a second one on it. */
    private readonly exitingFlyouts;
    private readonly groupCells;
    private readonly groupIcons;
    private cursorBtn;
    private magnetCell;
    private magnetIcon;
    private magnetMode;
    private lastMagnetOn;
    private measureBtn;
    private measureActive;
    private eraserBtn;
    private eraserActive;
    private stayBtn;
    private stayActive;
    private syncBtn;
    private syncActive;
    private collapseBtn;
    private collapsed;
    private visible;
    private readonly tipText;
    /** Chrome-tooltip disposers — flushed whenever the cells are recreated (rebuild/destroy). */
    private tipDisposers;
    /** Explicit border override from options; `null` follows the live theme's border. */
    private readonly borderOverride;
    private readonly width;
    private readonly dock;
    private readonly onCollapse;
    private readonly onDrawingsSync;
    constructor(host: HTMLElement, theme: VelaTheme, onArm: (type: DrawingTypeKey | null) => void, onMagnet?: (mode: SnapMode) => void, onMeasure?: () => void, onEraser?: () => void, onToggleFavorite?: (type: DrawingTypeKey, on: boolean) => void, onStayMode?: (on: boolean) => void, options?: DrawingToolbarOptions);
    /** Live divider/border ink — the option override, else the current theme's border
     *  (so a theme swap re-inks the bar without a rebuild option). */
    private get borderColor();
    /** Flush vertical bar pinned to the left gutter (full height, right border, no card chrome).
     *  The shared tokens are written on the root so the scoped stylesheet drives every
     *  hover/active state without per-frame JS — and so a workspace can dock the bar outside a
     *  chart container and still resolve them. */
    private styleRoot;
    setDefinition(def: ToolbarDefinition): void;
    /** Reflect the core's favorite set. An OPEN flyout updates its stars IN PLACE — starring
     *  is a side action, so it must never close the menu the user is still browsing. */
    setFavorites(types: readonly DrawingTypeKey[]): void;
    /** Per-tool shortcut hints (pre-formatted display strings, e.g. `'Alt+T'`) shown at the
     *  right edge of the flyout rows, beside the favorite star. */
    setShortcuts(map: Readonly<Partial<Record<DrawingTypeKey, string>>>): void;
    /** Paint one star for the current favorite state (filled + gold, or outline). */
    private paintStar;
    setVisible(visible: boolean): void;
    setActiveTool(type: DrawingTypeKey | null): void;
    setTheme(theme: VelaTheme): void;
    destroy(): void;
    private rebuild;
    /** Collapse to a slim expand-strip / restore the full bar, and tell the host so a
     *  docked renderer can resize its gutter reservation. */
    private toggleCollapsed;
    private paintCollapse;
    /** A cell: a full-width icon button (arms/toggles the primary action) plus, when
     *  {@link opts.multi} is set, a chevron button absolutely pinned to the right. The icon spans the
     *  whole cell so its glyph stays centered in the bar (aligned with the single-icon buttons); the
     *  hover/active tint lives on a centered square (`.vela-dtb-hit`) that hugs the glyph, not the whole
     *  row. The chevron is its own hover target — revealed on cell hover, tinted only on its own hover. */
    private makeCell;
    private makeGroupCell;
    private makeMagnetCell;
    /** Cursor returns to select/idle: an active measure/eraser mode exits through its own
     *  toggle callback (disarming a tool via `onArm(null)` alone can't — the host treats a
     *  null arm as a no-op side effect of entering those modes), then the tool disarms. */
    private onCursorClick;
    /** Clicking the icon arms the group's last-used tool (it does NOT open the flyout). */
    private onGroupIconClick;
    /** Clicking the chevron toggles the group's flyout (same group → close; another → switch). */
    private onArrowClick;
    /** The magnet icon toggles the last-used strength on/off; the chevron opens the strength menu. */
    private toggleMagnet;
    private onMagnetArrowClick;
    /** Set the magnet mode, notify the renderer, and repaint (used by the menu + icon toggle). */
    private applyMagnet;
    /** Reflect the magnet mode externally (e.g. if set programmatically) without notifying back. */
    setMagnetMode(mode: SnapMode): void;
    /** Highlight the Measure ruler button while the transient ruler is armed. */
    setMeasureActive(active: boolean): void;
    private paintMeasure;
    /** Highlight the Eraser button while erase mode is active. */
    setEraserActive(active: boolean): void;
    private paintEraser;
    private paintMagnet;
    /** Toggle stay-in-drawing-mode on/off and notify the renderer. */
    private toggleStay;
    /** Reflect stay-in-drawing-mode externally without notifying back. */
    setStayMode(on: boolean): void;
    private paintStay;
    /** Toggle drawings sync on/off and notify the host. */
    private toggleDrawingsSync;
    /** Reflect drawings sync externally (e.g. set through the API) without notifying back. */
    setDrawingsSyncMode(on: boolean): void;
    private paintDrawingsSync;
    /** Create the positioned flyout panel anchored to a cell, register it as open, and start the
     *  outside-dismiss. Callers fill it with items. */
    private beginFlyout;
    private openGroupFlyout;
    private openMagnetFlyout;
    private flyoutHeader;
    private flyoutSeparator;
    /** A flyout row, left to right: optional leading icon badge, label, a check when it's the
     *  selected entry, an optional shortcut hint, and — at the far right — the favorite star (tool
     *  rows). Hover tint is CSS (`.vela-dtb-item:hover`), so navigating the menu stays smooth. */
    private makeFlyoutItem;
    private readonly onOutside;
    private closeFlyout;
    private paintGroupIcon;
    /** Reconcile active tints from state (armed group / open flyout / cursor / modes). Active is a
     *  `data-active` attribute the stylesheet paints — no inline background, so hover never sticks. */
    private highlight;
    private makeButton;
    private divider;
}

/**
 * In-memory cache of CLOSED bars, keyed by `(provider, symbol, timeframe)`. Each
 * series holds a single time-sorted, de-duplicated array. Scoped to the current
 * symbol — `retainSymbol` evicts other symbols' series (the agreed purge policy;
 * smarter eviction comes later) — except symbols protected via `retain`, the
 * multi-chart seam: a workspace declares every cell's symbol so one cell's load
 * never evicts the others' history.
 *
 * The default instance (`sharedBarStore`) is shared module-wide so it survives
 * chart re-creation — that's the whole point: a fresh run for the same symbol
 * reuses these bars instead of re-downloading them.
 */
declare class BarStore {
    private readonly series;
    /** Earliest bar-open time fetched for a series — what the cache actually covers. */
    private readonly coveredFrom;
    private currentSymbol?;
    /** Symbols protected from the current-symbol purge (multi-chart cells) — the UNION
     *  of every owner's declaration. Empty = legacy single-chart behavior. */
    private retained;
    /** Per-owner declarations behind {@link retained} — several shells on one page must
     *  not clobber (or, on destroy, evict) each other's protected symbols. */
    private readonly retainedByOwner;
    get(key: string): OHLCV[] | undefined;
    /**
     * Record that the series is covered back to `from`. Tracks the EARLIEST such
     * time — what's been fetched, not what bar boundary happens to align. The
     * coverage check uses this instead of the first cached bar's time (which is
     * always at/after the requested `from`, so it can never prove coverage).
     */
    markCovered(key: string, from: number): void;
    /** The earliest time the series is covered back to, or undefined if never fetched. */
    coveredFromOf(key: string): number | undefined;
    /** Merge `bars` into the series (dedup by time, incoming wins); keeps it sorted. Returns the merged set. */
    merge(key: string, bars: OHLCV[]): OHLCV[];
    /**
     * Scope the cache to the current chart symbol. Idempotent per symbol: only
     * purges other-symbol series when the symbol actually CHANGES — so secondary
     * series (request.security cross-symbol/HTF/LTF) fetched during a run survive
     * re-runs of the same chart, and are dropped only when the chart symbol flips.
     * Symbols declared via {@link retain} are never purged.
     */
    retainSymbol(symbol: string): void;
    /**
     * Declare the set of symbols a multi-chart workspace is displaying (CANONICAL
     * tickers, post-registry resolution — `chart.data.resolve(sym).ticker`). These
     * survive every {@link retainSymbol} purge, so cells loading different symbols
     * stop evicting each other's history. Replaces the previous set FOR THAT OWNER
     * (pass the shell instance as `owner`; several shells on one page keep separate
     * declarations, the effective set is their union) and purges anything now outside
     * the union ∪ {currentSymbol} immediately. An empty set releases the owner's
     * declaration — with no owners left, the legacy single-chart policy is back.
     * Note: SECONDARY symbols a script fetches (`request.security` cross-symbol) are
     * not in this set and still drop on cross-cell loads — correctness is unaffected
     * (they re-fetch on demand).
     */
    retain(symbols: ReadonlySet<string>, owner?: unknown): void;
    /** Drop every series whose symbol is neither `current` nor retained. */
    private purgeOutside;
    clear(): void;
}
/** Shared module-level store — survives chart re-creation so re-runs reuse bars. */
declare const sharedBarStore: BarStore;

/**
 * The default `MarketDataFeed`: a router over a registry of named `DataProvider`s.
 * It parses every symbol (`name:SYMBOL` / bare `SYMBOL`), resolves a provider,
 * rewrites the config to that provider's **canonical** identity, and delegates to
 * an internal {@link CachingDataFeed} — so `BTCUSDT` and `BINANCE:BTCUSDT` collapse
 * to one cache entry. Offline `data` bypasses the registry entirely.
 *
 * Providers are registered at runtime via `chart.data.registerProvider(...)`. Until
 * one that resolves the chart symbol is registered, `load` **parks** (its promise
 * stays pending) rather than fetching — so registration drives the first load.
 */
declare class MultiProviderFeed implements MarketDataFeed {
    private readonly registry;
    private readonly cache;
    /** The chart symbol's resolved provider — the default for bare secondary symbols. */
    private primaryProvider;
    /** Sync-accessible symbol metadata, warmed by load()/symbolInfoFor (the engine reads it synchronously). */
    private readonly symInfoCache;
    /** Requests in flight, keyed like the cache — every concurrent asker shares one round trip. */
    private readonly symInfoInflight;
    constructor(store?: BarStore);
    registerProvider(name: string, provider: DataProvider): Promise<void>;
    unregisterProvider(name: string): void;
    providers(): ProviderInfo[];
    resolveSymbol(raw: string): Resolved | null;
    /**
     * The DISPLAY prefix for `raw` — the descriptor's LISTING prefix when the data
     * declares one (`NASDAQ` for AAPL), else the resolved provider name. Null while
     * nothing resolves the symbol.
     */
    displayPrefix(raw: string): string | null;
    /** The canonical `PREFIX:TICKER` form of `raw`, or null while unresolvable. */
    canonicalSymbol(raw: string): string | null;
    /** The registered provider INSTANCE under `name` (undefined if unknown). */
    providerInstance(name: string): DataProvider | undefined;
    /** The icon URL for a DESCRIPTOR — its owning provider's `resolveSymbolIcon` (picker rows). */
    symbolIconOf(d: SymbolDescriptor): string | undefined;
    /** The icon URL for a raw SYMBOL string — resolve, then route (statusline, object tree). */
    symbolIcon(raw: string): string | undefined;
    symbols(name?: string): SymbolDescriptor[];
    /** Told when a symbol stays unservable by everything registered (the load is parked). */
    onUnresolved(cb: (info: {
        symbol: string;
        providers: string[];
    }) => void): Unsubscribe;
    /** Abandon parked waits — a destroyed chart must not keep listeners on the registry. */
    destroy(): void;
    /** Resolves when every registered provider's eager index has settled. */
    ready(): Promise<void>;
    /** Async per-symbol metadata (the facade's `chart.data.symbolInfo`); also warms the sync cache. */
    symbolInfoFor(raw: string): Promise<SymbolInfo | undefined>;
    /**
     * One round trip per symbol, shared. A market switch probes this metadata from five
     * places at once (the bar load's prefetch, the renderer's tick size, the market-status
     * badge, the session shading, the session toggle) — without the in-flight map each
     * would open its own request for the same answer, and the last one to land decided how
     * late the chrome settled.
     *
     * Cached for {@link SYMBOL_INFO_TTL_MS}: this metadata is stable within a session
     * (tick size, session vocabulary, listing prefix), but not immutable — a continuous
     * futures row rolls its current contract — so the entry expires rather than pinning the
     * session's first answer forever. A failed probe is NOT remembered: the next asker retries.
     */
    private fetchSymbolInfo;
    /**
     * Per-symbol capabilities, resolved through the owning provider's `capabilitiesFor`
     * refinement (an instrument may support more than its provider-wide baseline), falling back to the
     * provider-wide `info()` capabilities. Null when nothing resolves the symbol.
     */
    capabilitiesFor(raw: string): ProviderCapabilities | null;
    load(cfg: MarketConfig): Promise<OHLCV[]>;
    /** Progressive twin of {@link load} — same resolution, the cache streams the batches. */
    loadProgressive(cfg: MarketConfig, onBatch: (bars: OHLCV[]) => void, opts?: {
        signal?: AbortSignal;
    }): Promise<OHLCV[] | null>;
    /**
     * Synchronous per-symbol metadata for engines (Pine `syminfo.*`), served from the cache
     * warmed by load(). Undefined until the prefetch lands (the engine then synthesizes a
     * fallback) and real thereafter — the MarketDataFeed port is synchronous by contract.
     */
    symbolInfo(cfg: MarketConfig): SymbolInfo | undefined;
    private prefetchSymbolInfo;
    loadRange(cfg: MarketConfig, range: BarRange): Promise<OHLCV[]>;
    /** Offline `data` has no source of ticks: the caller's bars are shown exactly as given,
     *  and live updates need a registered provider that implements `subscribe`. */
    subscribe(cfg: MarketConfig, onBar: (bar: OHLCV) => void): Unsubscribe;
}

/**
 * A `MarketDataFeed` decorator that caches CLOSED bars in a shared in-memory
 * `BarStore`. A new indicator run for the same `(provider, symbol, timeframe)`
 * serves the already-fetched bars and re-downloads only the uncached **tail**
 * (newly-closed bars + the forming candle). The forming bar is never cached — the
 * live poll re-fetches it.
 *
 * Savings on a re-run ≈ ⌈N/1000⌉ − 1 requests: dormant for ≤1000-bar charts (the
 * single tail request is the whole fetch either way), paying off with deep
 * history. Needs the inner feed's `loadRange`; without it — or for offline
 * `data` — it transparently falls back to a full `load`.
 */
declare class CachingDataFeed implements MarketDataFeed {
    private readonly inner;
    private readonly store;
    constructor(inner: MarketDataFeed, store?: BarStore);
    load(cfg: MarketConfig): Promise<OHLCV[]>;
    /**
     * Progressive twin of {@link load}: a COLD load streams through the inner feed's
     * progressive path — batches forwarded verbatim, the FINAL answer cached exactly as
     * `load` caches — while a cache-covered load answers once through `load` itself (a
     * warm chart has nothing to stream). Falls back to `load` wholesale when the inner
     * feed lacks the capability, so callers may prefer this method unconditionally.
     */
    loadProgressive(cfg: MarketConfig, onBatch: (bars: OHLCV[]) => void, opts?: {
        signal?: AbortSignal;
    }): Promise<OHLCV[] | null>;
    /**
     * Cache-backed ranged fetch — the gateway engines use for secondary series
     * (`request.security` HTF/LTF/cross-symbol) and the orchestrator's backward
     * history chunks. Caches per `(provider, symbol, timeframe)` in the shared
     * store. Three cache-friendly shapes:
     * - **historical** (`to` before the cached tip): served straight from cache
     *   when it provably holds the window, else fetched whole (and cached — no
     *   forming bar can exist there);
     * - **backward extension** (`from` older than coverage): fetch ONLY the
     *   missing head, never the already-covered remainder again;
     * - **tail** (everything else covered): refresh only from the last cached bar.
     * Falls back to a full `load` when the inner feed has no ranged support.
     */
    loadRange(cfg: MarketConfig, range: BarRange): Promise<OHLCV[]>;
    /**
     * THE provider round-trip chokepoint for ranged fetches. Two jobs:
     * - Every request goes out with an **explicit `limit`** — some sources clip a
     *   limit-less request to a small default window and tail-slice, silently
     *   truncating wide date-bounded fetches (the `request.security` bug).
     * - A request bigger than one page walks **backward in bounded pages**, so a
     *   multi-hundred-thousand-bar series arrives as digestible responses instead
     *   of one giant clip-prone payload.
     * Returns ascending merged bars plus the oldest time the walk PROVED
     * (`coveredDownTo`) — honest coverage marking: a count-satisfied early stop
     * must never claim the requested `from`.
     */
    private fetchRange;
    subscribe(cfg: MarketConfig, onBar: (bar: OHLCV) => void): Unsubscribe;
    symbolInfo(cfg: MarketConfig): SymbolInfo | undefined;
}

/**
 * Bar duration in ms for a Vela timeframe: a bare number is **minutes** (Pine
 * resolution — `60` = 1h, `240` = 4h), `D`/`W`/`M` are the named periods, and the
 * `15m`/`4h`/`1d`/`1w` aliases are also accepted. Falls back to 1h for anything unparsed.
 */
declare function timeframeToMs(timeframe: string): number;

/**
 * Ticks from the chart's own data provider at a finer `timeframe` (`'1'`, `'5'`, …): for
 * each replayed bar, the lower-timeframe bars inside its span are fetched and each becomes
 * one update ({@link barsToTicks}) — a 15m bar replayed from 1m bars takes 15 intervals. The symbol and session are read when the bar is due, so the
 * source follows a market switch. Unresolvable symbol or nothing served ⇒ the bar plays whole.
 */
declare function lowerTimeframeTicks(chart: {
    readonly market: MarketSnapshot;
    readonly data: DataControl;
}, timeframe: string): ReplayTickSource;
/**
 * Turn bars into the ticks a replay plays: one update per bar — the candle closes at its
 * close and stretches to its high and low, with its volume; the first bar also sets the open.
 */
declare function barsToTicks(bars: readonly OHLCV[]): ReplayTick[];

declare const DARK_THEME: VelaTheme;
declare const LIGHT_THEME: VelaTheme;
declare function resolveTheme(theme?: ThemeName | VelaTheme): VelaTheme;

export { AxisLongPressEvent, BarRange, BarStore, CachingDataFeed, type ChartConfig, type ChartStyle, ClickEvent, CrosshairEvent, DARK_THEME, DataControl, DataProvider, DataWindowReadout, Drawing, DrawingStore, DrawingToolbar, type DrawingToolbarOptions, DrawingTypeKey, DrawingsDocument, IChartRenderer, IDrawingsRendererPort, IndicatorModel, IndicatorRenderHandle, InputChangeEvent, InputValue, LIGHT_THEME, LineStyle, MarkClickEvent, MarkGroup, MarketConfig, MarketDataFeed, MarketSnapshot, Millis, MultiProviderFeed, NativeRenderer, OHLCV, Pane, PriceStyle, ProviderCapabilities, ProviderInfo, RendererCapabilities, RendererDisplayOptions, ReplayTick, ReplayTickSource, Resolved, ScenePatch, SerializedDrawing, SettingsSelectOption, SnapMode, SymbolDescriptor, SymbolInfo, ThemeName, TimelineMark, ToolbarDefinition, VelaTheme, VisibleRange, WallClock, barsToTicks, lowerTimeframeTicks, resolveTheme, sharedBarStore, timeframeToMs };
