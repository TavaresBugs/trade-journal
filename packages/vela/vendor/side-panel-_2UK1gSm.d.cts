/**
 * The rank of every built-in context-menu row, by zone and row id (`settings` is each
 * zone's settings row). Contributed `context:*` actions sort TOGETHER with these rows by
 * their `order` (default 0), ascending; on a tie the built-in row comes first, then the
 * actions in registration order. The built-in actions rank below 0 and the settings row at
 * 1000, so an action without `order` lands after the built-in actions and before the
 * settings row, and `order: -100` leads the menu.
 */
declare const CONTEXT_MENU_BUILTIN_ORDER: {
    readonly body: {
        readonly 'reset-view': -30;
        readonly 'remove-drawings': -20;
        readonly 'remove-indicators': -10;
        readonly settings: 1000;
    };
    readonly 'price-axis': {
        readonly auto: -80;
        readonly invert: -70;
        readonly 'scale:regular': -60;
        readonly 'scale:percent': -50;
        readonly 'scale:indexed': -40;
        readonly 'scale:log': -30;
        readonly labels: -20;
        readonly levels: -10;
        readonly settings: 1000;
    };
    readonly 'time-axis': {
        readonly timezone: -10;
        readonly settings: 1000;
    };
};

/** Width (px) a panel takes when it declares none. */
declare const DEFAULT_PANEL_WIDTH = 280;
/** Bounds a RESIZABLE panel takes when it declares none. */
declare const DEFAULT_PANEL_MIN_WIDTH = 200;
declare const DEFAULT_PANEL_MAX_WIDTH = 640;
/** Per-panel width policy. Omitted fields fall back to the module defaults. */
interface SidePanelOptions {
    /** Declared width in px — also where a double-click on the drag handle returns. */
    width?: number;
    /** Let the user drag the panel's inner edge. Fixed width when false/omitted. */
    resizable?: boolean;
    minWidth?: number;
    maxWidth?: number;
    /** Float over the chart's right edge instead of docking beside it — the chart keeps
     *  its width. Docked when false/omitted. A floating panel gets a header pin the user
     *  can dock it with (see {@link SidePanel.onPlacementChange}). */
    overlay?: boolean;
    /** A header button that MAXIMIZES the panel over every chart of the shell, and restores
     *  it. For panels that are sometimes the main work surface (an editor). */
    maximizable?: boolean;
}
/**
 * Clamp a width to its bounds and round to whole pixels — PURE. The drag, a programmatic
 * {@link SidePanel.setWidth}, and the restore of a persisted width all go through it, so a bad
 * stored value (or a `maxWidth` below `minWidth`) can never paint an unusable column.
 */
declare function clampPanelWidth(px: number, min?: number, max?: number): number;
declare class SidePanel {
    readonly el: HTMLElement;
    /**
     * Notified whenever the panel opens or closes, by ANY path — a topbar toggle, the header ✕,
     * or another panel taking the dock. The owning shell reflects it on its chrome, so a button's
     * pressed state can never drift from the panel it controls.
     */
    onOpenChange: ((open: boolean) => void) | null;
    /** Notified when the USER settles a new width (drag release, or double-click reset) — never on
     *  a programmatic {@link setWidth}, so restoring a persisted width raises no change. */
    onWidthChange: ((px: number) => void) | null;
    /** Notified when the USER pins or unpins a floating panel (`overlay` is the NEW placement) —
     *  never on a programmatic {@link setOverlay}, for the same reason as widths. */
    onPlacementChange: ((overlay: boolean) => void) | null;
    protected readonly body: HTMLElement;
    private readonly heading;
    private readonly slot;
    private readonly declaredWidth;
    private readonly minWidth;
    private readonly maxWidth;
    private widthPx;
    /** Declared `overlay` — the panel CAN float; {@link overlay} says whether it does right now. */
    private readonly floatable;
    private overlayOn;
    private readonly pin;
    private readonly maxButton;
    private maximizedOn;
    /** Set while the close is announced, so a listener's own close does not re-enter. */
    private closing;
    /** Open as far as the dock and the host are concerned — a closed panel can still be on
     *  screen while its exit animation runs. */
    private isOpen;
    /** The exit animation of a close; a reopen cancels it. */
    private exit;
    /** `modifier` is the panel's own class, carrying its content styles (e.g. `vela-ot`). */
    constructor(host: HTMLElement, title: string, modifier: string, opts?: SidePanelOptions);
    get open(): boolean;
    /**
     * Open/close the panel — a bare call flips it. The panel reports closed at once, but a
     * close keeps it on screen, marked `data-closing`, while a host exit animation runs.
     * `instant` skips that, and also cuts short the exit of a panel already closing: a panel
     * handing the dock to another leaves at once.
     */
    toggle(open?: boolean, instant?: boolean): void;
    /** Whether the panel covers every chart right now. */
    get maximized(): boolean;
    /** Maximize the panel over the shell's charts, or restore it. A no-op on a panel not
     *  declared `maximizable`. */
    setMaximized(maximized: boolean): void;
    private refreshMaxButton;
    /** The scrolling body, for a panel filled from OUTSIDE the class — a contributed panel's
     *  `mount` receives exactly this element. Subclasses use the protected `body`. */
    get content(): HTMLElement;
    /** The header slot between the title and the close button — a contributed panel's
     *  `mount` receives it (via {@link SidePanelHeader}) to dock compact controls. */
    get headerSlot(): HTMLElement;
    /** Replace the header title. The topbar toggle keeps the DECLARED title as its
     *  tooltip — this only changes what the open column says about itself. */
    setTitle(title: string): void;
    /** Current width in px. */
    get width(): number;
    /** Resize the panel (clamped). Silent — {@link onWidthChange} reports user drags only. */
    setWidth(px: number): void;
    /** Whether the panel floats over the chart right now (false for every docked panel). */
    get overlay(): boolean;
    /** Float or dock the panel. Only a panel declared `overlay` can float — on any other this is
     *  a no-op. Silent — {@link onPlacementChange} reports the user's pin clicks only. */
    setOverlay(overlay: boolean): void;
    private refreshPin;
    destroy(): void;
    /** The drag handle on the panel's inner (left) edge — the panel is docked right, so dragging
     *  AWAY from the edge widens it. Pointer capture keeps the drag alive over the chart canvas. */
    private mountResizer;
}

export { CONTEXT_MENU_BUILTIN_ORDER as C, DEFAULT_PANEL_MAX_WIDTH as D, type SidePanelOptions as S, DEFAULT_PANEL_MIN_WIDTH as a, DEFAULT_PANEL_WIDTH as b, clampPanelWidth as c, SidePanel as d };
