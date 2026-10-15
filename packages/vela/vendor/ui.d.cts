import { c as VelaTheme } from './options-CSXbjMM5.cjs';
import { MachineSchema, Service, Machine } from '@zag-js/core';
export { a as KeyBindingDescriptor, K as KeymapManager, b as KeymapOptions, R as ResolvedBinding } from './keymap-CGOz5F5f.cjs';
import * as tooltip from '@zag-js/tooltip';
import * as menu from '@zag-js/menu';
import * as dialog from '@zag-js/dialog';
export { i as iconMarkup, r as registerIcon, s as svg16, a as svg24 } from './icons-BZYbJXSV.cjs';
export { normalizeProps, spreadProps } from '@zag-js/vanilla';

/** Apply an alpha to any parseable color → an `rgba(...)` string. Unparseable input is
 *  returned unchanged so callers can pass through `transparent`, `currentColor`, etc. */
declare function withAlpha(color: string, alpha: number): string;

/** One menu entry. `id` is the selection value reported to `onSelect`. */
interface MenuItemDescriptor {
    id: string;
    label: string;
    disabled?: boolean;
    /** Draw a separator line above this item. */
    separatorBefore?: boolean;
    /** Right-aligned hint (e.g. a shortcut display from KeymapManager). */
    hint?: string;
    /** Selected state (undefined = plain item). A plain checked item renders as a
     *  highlighted row (brighter surface + bright ink) — or, in a menu built with
     *  `checkmarks`, as a leading ✓ with the row surface left free for hover. */
    checked?: boolean;
    /** Render as a SWITCH row (a right-aligned toggle pill reflecting `checked`)
     *  instead of the selected-row highlight, and keep the menu OPEN on selection —
     *  the shape for boolean settings living inside a dropdown. */
    toggle?: boolean;
    /** Icon id (see the `vela/ui` icon registry) rendered before the label. A level where
     *  any row has one gives its iconless rows an empty slot, so the labels align. */
    icon?: string;
    /** Favorite-star affordance at the row's right edge: `false` renders an outline
     *  star revealed on row hover, `true` a filled star that stays visible. Clicking
     *  it reports through the menu's `onFavorite` WITHOUT selecting (or closing) the
     *  row — undefined rows carry no star at all. */
    favorite?: boolean;
    /** Nested entries — the row becomes a submenu trigger opening its own list to the side.
     *  A branch is not selectable itself: `onSelect` only ever reports leaf ids. */
    submenu?: readonly MenuItemDescriptor[];
}
interface MenuControllerOptions {
    items: readonly MenuItemDescriptor[];
    onSelect?: (id: string) => void;
    placement?: menu.Props['positioning'] extends infer P | undefined ? P extends {
        placement?: infer PL;
    } ? PL : never : never;
    onOpenChange?: (open: boolean) => void;
    /** Pin the floating list to this rect (viewport coords). Used to keep an open
     *  menu still when its trigger moves — starring a timeframe adds a chip and
     *  would otherwise drag the list with the caret. `null` falls through to the
     *  live trigger. */
    getAnchorRect?: () => {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    /** Share the trigger's DOM id with other machines composed on the same element. */
    triggerId?: string;
    /** Pin the machine's own id instead of taking a fresh one. A parent registers its
     *  submenus under this key, so rebuilding a branch replaces its entry rather than
     *  piling a new one on top. */
    id?: string;
}
type MenuService = menu.Service;
type MenuApi = menu.Api;
interface MenuController {
    machine: typeof menu.machine;
    props: Partial<menu.Props>;
    connect(service: MenuService): MenuApi;
}
declare function menuController(opts: MenuControllerOptions): MenuController;

interface MenuOptions extends MenuControllerOptions {
    /** Element that opens the menu on click (gets the machine's trigger props). */
    trigger?: HTMLElement;
    host?: HTMLElement;
    /** Override the root list's min-width (the stylesheet default suits full-word labels;
     *  compact lists like the timeframe dropdown pass something snug). Submenus keep the
     *  default. */
    minWidth?: string;
    /** Star-toggle reports from items carrying `favorite` (the menu stays open — starring
     *  is a side action on a row, never a selection). */
    onFavorite?: (id: string, on: boolean) => void;
    /** Mark checked items with a leading ✓ instead of the selected-row background wash —
     *  the shape for pointer-anchored action menus (right-click context menus), where a
     *  washed row reads as hover state. A level holding checkable rows reserves the mark
     *  column on all its rows so labels align; an all-action level keeps its natural left
     *  edge. Submenus inherit the mode. Dropdown menus (a trigger button opening a
     *  picker) keep the default wash. */
    checkmarks?: boolean;
    /** Sit each row's icon in a squared badge (a 24px rounded tile with a faint fill and a soft
     *  border) instead of a bare glyph: its glyph brightens on a hovered row, and the tile
     *  inverts on the selected one. A
     *  level where some rows carry an icon reserves the badge column on all its rows so
     *  labels align; a level with no icon keeps its natural left edge. With `checkmarks`,
     *  the mark column leads and the badge follows. Submenus inherit the mode. */
    iconBadges?: boolean;
}
declare class Menu {
    private readonly root;
    constructor(opts: MenuOptions);
    get api(): menu.Api;
    open(): void;
    /** Open anchored to a viewport point (context menus). */
    openAt(clientX: number, clientY: number): void;
    close(): void;
    /** Swap the item descriptors (e.g. checked states) and re-project. */
    setItems(items: readonly MenuItemDescriptor[]): void;
    destroy(): void;
}

/** A ready-to-insert element rendering the icon (empty span when unknown). */
declare function iconEl(id: string, doc?: Document): HTMLElement;

/** Overlay scrollbar used by settings panes, dialog bodies, and similar chrome. */
declare function overlayScrollbarCss(selector: string, width?: number): string;
/** Focus ring shared by typeable fields (combo inputs, textareas). */
declare const FIELD_FOCUS_CSS = "outline:none;transition:border-color .12s ease,box-shadow .12s ease;";
declare const FIELD_FOCUS_RING = "border-color:var(--vela-focus);box-shadow:0 0 0 3px var(--vela-focus-soft);";
/** Inject a stylesheet once per root (document or shadow root). Idempotent by id. */
declare function injectStyles(id: string, css: string, root?: Document | ShadowRoot): void;

/** Write the theme-derived custom properties onto a host element (the widget root and
 *  every floating layer — menus/tooltips portal outside the root, so layers re-apply). */
declare function applyThemeTokens(el: HTMLElement, t: VelaTheme): void;
/** Re-token a chart-overlay host (statusline, watermark, toast — chrome floating OVER
 *  the plot) from the LIVE plot surface: a config edit can recolor the plot background
 *  independently of the app theme (a white plot typed into settings on the dark theme),
 *  and the overlay ink must stay readable either way. `config` is the renderer's
 *  `getConfig()` snapshot; a missing/shapeless one falls back to the base app theme.
 *  Floating menus and dropdowns do NOT use this — they mount on {@link floatingLayerHost}
 *  so their surface follows the app theme alone. */
declare function applyPlotOverlayTokens(host: HTMLElement, base: VelaTheme, config: unknown): void;
/** Mark an element as a kit host: static token sheet + the `.vela-ui` class. */
declare function ensureUIHost(el: HTMLElement, theme?: VelaTheme): void;

interface MachineHandle<T extends MachineSchema> {
    service: Service<T>;
    /** Re-run the view projection now (e.g. after external DOM swaps). */
    flush(): void;
    stop(): void;
}
/** Start a machine and keep `render(service)` in sync with every transition.
 *  `render` runs once immediately (initial projection) and on each machine notification. */
declare function runMachine<T extends MachineSchema>(machine: Machine<T>, props: Partial<T['props']> | (() => Partial<T['props']>), render: (service: Service<T>) => void): MachineHandle<T>;
/** Unique ids for machine instances (Zag keys its DOM lookups on them). */
declare function nextUid(prefix: string): string;

/** Dispatched on a surface's element once it is shown. */
declare const SURFACE_OPEN_EVENT = "vela:surface-open";
/** Dispatched on a surface's element as it starts to close, before it hides or leaves the DOM. */
declare const SURFACE_CLOSE_EVENT = "vela:surface-close";
/** What opened or closed: a menu (submenus included), a popover (select lists, color
 *  pickers, mark cards, the layout picker), a dialog, a drawer, or a side panel. */
type SurfaceKind = 'menu' | 'popover' | 'dialog' | 'drawer' | 'panel';
/** The `detail` of a {@link SURFACE_OPEN_EVENT} / {@link SURFACE_CLOSE_EVENT} event. */
interface SurfaceEventDetail {
    kind: SurfaceKind;
    /** The element that opened it, when there is one (a menu's button, a popover's trigger). */
    trigger: HTMLElement | null;
}

interface TooltipControllerOptions {
    placement?: tooltip.Placement;
    /** ms before opening on hover (default 0 — the reference tooltips are instant). */
    openDelay?: number;
    closeDelay?: number;
    /** Keep open while the pointer is over the content (rich tooltips). */
    interactive?: boolean;
    /** Share the trigger's DOM id with other machines composed on the SAME element
     *  (each Zag machine otherwise stamps its own id — last one wins and breaks the rest). */
    triggerId?: string;
}
type TooltipService = tooltip.Service;
type TooltipApi = tooltip.Api;
interface TooltipController {
    machine: typeof tooltip.machine;
    props: Partial<tooltip.Props>;
    connect(service: TooltipService): TooltipApi;
}
declare function tooltipController(opts?: TooltipControllerOptions): TooltipController;

interface TooltipOptions extends TooltipControllerOptions {
    content: string | Node | (() => Node);
    host?: HTMLElement;
}
declare class Tooltip {
    private readonly positioner;
    private readonly content;
    private readonly handle;
    private readonly trigger;
    constructor(trigger: HTMLElement, opts: TooltipOptions);
    setContent(content: string | Node | (() => Node)): void;
    destroy(): void;
}

interface DialogControllerOptions {
    /** Trap focus + backdrop (default true). Non-modal = floating panel. */
    modal?: boolean;
    closeOnEscape?: boolean;
    closeOnInteractOutside?: boolean;
    /** Element to focus on open (default: the machine's first-tabbable pick). */
    initialFocusEl?: () => HTMLElement | null;
    onOpenChange?: (open: boolean) => void;
}
type DialogService = dialog.Service;
type DialogApi = dialog.Api;
interface DialogController {
    machine: typeof dialog.machine;
    props: Partial<dialog.Props>;
    connect(service: DialogService): DialogApi;
}
declare function dialogController(opts?: DialogControllerOptions): DialogController;

interface DialogOptions extends DialogControllerOptions {
    title?: string;
    content?: Node | ((body: HTMLElement) => void);
    host?: HTMLElement;
    /** Drag the dialog by its header (the reference dialogs move; search stays fixed). */
    draggable?: boolean;
    /** Darken the page behind the dialog (default false — the chart stays readable while
     *  dialogs edit live content). Pass true for a dimming scrim; the backdrop still
     *  catches interact-outside dismissal either way. */
    dimBackdrop?: boolean;
    /** Vertical placement of the card. Default `top` (current 10vh pad). */
    align?: 'top' | 'center';
    /** Pin the overlay to `host` (absolute) instead of the viewport (fixed). */
    contained?: boolean;
    /** Footer pinned below the scrollable body. */
    footer?: Node | ((el: HTMLElement) => void);
    /** Extra nodes before the title (e.g. a mobile section burger). */
    headerStart?: Node;
    /** Skip default body padding — the caller owns the body layout. */
    flush?: boolean;
    /** Extra class on the panel. */
    className?: string;
    /** Close when the backdrop itself is pressed (not when a portaled popover is). */
    closeOnBackdrop?: boolean;
}
declare class Dialog {
    /** Caller-owned content area — append your form/panel here. */
    readonly body: HTMLElement;
    readonly panel: HTMLElement;
    readonly titleEl: HTMLElement;
    readonly positioner: HTMLElement;
    readonly backdrop: HTMLElement;
    readonly footer: HTMLElement | null;
    private readonly handle;
    private readonly ctrl;
    constructor(opts?: DialogOptions);
    private opener;
    private wasOpen;
    /** The panel and scrim's exit animation after a close; a reopen cancels it. */
    private exit;
    private destroyed;
    private setShown;
    /** Keep the just-closed dialog up through its exit animation, then hide it — or
     *  remove it, when it was destroyed meanwhile. `spreadProps` re-applies the close
     *  props' `hidden` only when its value changes, so lifting it keeps the panel and
     *  scrim up until the exit ends. The positioner spans the viewport: inert, it lets
     *  clicks through to the page while the panel animates out. */
    private holdExit;
    private detach;
    /** Closing hands focus back to whatever opened it (Escape, the ✕, hide(), or a
     *  teardown that outruns the machine's close notification). */
    private restoreOpener;
    private announce;
    get open(): boolean;
    show(): void;
    hide(): void;
    contains(node: Node | null): boolean;
    destroy(): void;
}

interface DrawerControllerOptions {
    closeOnEscape?: boolean;
    /** Tap outside (on the backdrop) dismisses — default true. */
    closeOnInteractOutside?: boolean;
    /** Element to focus on open (default: the machine's first-tabbable pick). The view
     *  points this at the sheet itself so opening never focuses an input — on touch
     *  devices that would pop the on-screen keyboard over the sheet. */
    initialFocusEl?: () => HTMLElement | null;
    onOpenChange?: (open: boolean) => void;
}
type DrawerService = dialog.Service;
type DrawerApi = dialog.Api;
interface DrawerController {
    machine: typeof dialog.machine;
    props: Partial<dialog.Props>;
    connect(service: DrawerService): DrawerApi;
}
declare function drawerController(opts?: DrawerControllerOptions): DrawerController;

interface DrawerOptions extends DrawerControllerOptions {
    title?: string;
    content?: Node | ((body: HTMLElement) => void);
    host?: HTMLElement;
    /** Horizontal swipe across the sheet (fires on release; `'left'` = the finger moved
     *  left). Gestures that start inside a horizontally scrollable strip (tabs, chip
     *  rows) keep their native scroll instead. */
    onSwipe?: (dir: 'left' | 'right') => void;
}
declare class Drawer {
    /** Caller-owned content area — append your rows/lists here. */
    readonly body: HTMLElement;
    private readonly backdrop;
    private readonly positioner;
    private readonly panel;
    private readonly titleEl;
    private readonly handle;
    private readonly ctrl;
    constructor(opts?: DrawerOptions);
    /** Any element between `from` and the panel that has already been scrolled down —
     *  a downward pull there must scroll it back up, never drag the sheet. */
    private scrolledAncestor;
    /** Any element between `from` and the panel that scrolls horizontally on its own
     *  (the tab strip, chip rows) — a sideways move there is ITS scroll, not a swipe. */
    private hScrollableAncestor;
    /**
     * One gesture recognizer for the whole sheet. A downward pull dismisses from
     * anywhere — the grab handle immediately, the content once it is decidedly vertical
     * and its scroller is at rest (a scrolled list keeps native scrolling). A decidedly
     * horizontal move becomes an `onSwipe` (tabbed drawers flip pages with it). The
     * non-passive touchmove hook is what keeps the browser from claiming the pull as a
     * scroll once the sheet is (or may become) the drag target.
     */
    private wireGestures;
    setTitle(title: string): void;
    private opener;
    private wasOpen;
    /** The sheet and scrim's exit animation after a close; a reopen cancels it. */
    private exit;
    private destroyed;
    private setShown;
    /** Keep the just-closed sheet up through its exit animation, then hide it — or
     *  remove it, when it was destroyed meanwhile. `spreadProps` re-applies the close
     *  props' `hidden` only when its value changes, so lifting it keeps the sheet and
     *  scrim up until the exit ends. The positioner spans the host: inert, it lets
     *  clicks through to the page while the sheet animates out. */
    private holdExit;
    private detach;
    /** Closing hands focus back to whatever opened it (Escape, the ✕, hide(), or a
     *  teardown that outruns the machine's close notification). */
    private restoreOpener;
    private announce;
    get open(): boolean;
    show(): void;
    hide(): void;
    destroy(): void;
}

type PopoverAlign = 'start' | 'end' | 'center';
type PopoverPosition = 'fixed' | 'absolute';
/** Axis-aligned rectangle in viewport coordinates. */
interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}
interface PlaceArgs {
    trigger: Rect;
    pop: {
        width: number;
        height: number;
    };
    gap: number;
    align: PopoverAlign;
    /** Already-inset clamp rectangle in viewport coordinates. */
    clamp: Rect;
    /** Subtracted from left/top when the popover is `position:absolute` inside a host. */
    originX: number;
    originY: number;
}
interface PlaceResult {
    left: number;
    top: number;
}
/** Inset a rectangle uniformly (positive inset shrinks). */
declare function insetRect(r: Rect, inset: number): Rect;
/** Viewport rect with a uniform inset (the 6px air ColorField / glyph-select used). */
declare function viewportRect(width: number, height: number, inset: number): Rect;
/** Intersection of two rects. Empty (non-positive size) if they don't overlap. */
declare function intersectRects(a: Rect, b: Rect): Rect;
/**
 * Place a popover under `trigger`, flipping above when it would leave `clamp`.
 * Prefers the side with more room when neither fully fits. `align: 'end'` right-aligns
 * to the trigger (swatches and width fields sit at the row's right edge); `'center'`
 * centers it on the trigger (a popup over a small glyph).
 */
declare function placePopover(a: PlaceArgs): PlaceResult;
interface PopoverControllerOptions {
    gap?: number;
    align?: PopoverAlign;
    matchWidth?: boolean;
    position?: PopoverPosition;
    boundaryInset?: number;
    viewportInset?: number;
    onClose?: () => void;
}
interface PopoverController {
    gap: number;
    align: PopoverAlign;
    matchWidth: boolean;
    position: PopoverPosition;
    boundaryInset: number;
    viewportInset: number;
    onClose?: () => void;
}
declare function popoverController(opts?: PopoverControllerOptions): PopoverController;

type PopoverBoundary = 'viewport' | HTMLElement | (() => DOMRect | null);
interface PopoverOptions extends PopoverControllerOptions {
    trigger: HTMLElement;
    content?: Node | ((body: HTMLElement) => void);
    /** Portal target. Defaults to `document.body`. Drawing chrome passes the chart host. */
    host?: HTMLElement;
    theme?: VelaTheme;
    className?: string;
    zIndex?: string | number;
    /** Clamp rectangle. `'viewport'` (default) or an element (dialog / chart host). */
    boundary?: PopoverBoundary;
    /** Fade the shell in on show and out on hide over this many ms (default 0 — instant). */
    fadeMs?: number;
}
/** Close whichever kit popover is showing (dialog teardown, a second trigger). */
declare function closeOpenPopovers(): void;
declare function isPopoverOpen(): boolean;
declare function openPopoverTrigger(): HTMLElement | null;
/**
 * True when this event already dismissed a popover on its way down — a dialog's
 * outside-click close must swallow it instead of closing the dialog too (the popover
 * hides itself on document CAPTURE, so by the time a backdrop listener runs,
 * {@link isPopoverOpen} is already false).
 */
declare function eventDismissedPopover(e: Event): boolean;
declare class Popover {
    readonly el: HTMLElement;
    readonly trigger: HTMLElement;
    private readonly host;
    private readonly ctrl;
    private readonly boundary;
    private readonly theme?;
    /** Hosted under a `.vela-ui` we resolved ourselves — its tokens win over `theme`. */
    private readonly inheritsTokens;
    private onOutside;
    private onKey;
    private onReflow;
    private shown;
    private readonly fadeMs;
    /** The pending removal of a fading-out shell; a show() that reuses the shell cancels it. */
    private leaveTimer;
    /** The shell's exit animation before it leaves the DOM; a show() that reuses the shell cancels it. */
    private exit;
    constructor(opts: PopoverOptions);
    get open(): boolean;
    get position(): PopoverPosition;
    get align(): PopoverAlign;
    show(): void;
    hide(): void;
    /** Show if closed, hide if this instance is the open popover. */
    toggle(): void;
    destroy(): void;
    reposition(): void;
    private clampRect;
    private readBoundary;
    private place;
}

type SwitchSize = 'sm' | 'md';
/** `bright` = settings-dialog fill (`--vela-fg-bright`); `selected` = `--vela-selected-bg`. */
type SwitchTone = 'bright' | 'selected';
interface SwitchControllerOptions {
    checked?: boolean;
    disabled?: boolean;
    size?: SwitchSize;
    tone?: SwitchTone;
    onChange?: (checked: boolean) => void;
}
interface SwitchController {
    checked: boolean;
    disabled: boolean;
    size: SwitchSize;
    tone: SwitchTone;
    setChecked(v: boolean): void;
    toggle(): boolean;
}
declare function switchController(opts?: SwitchControllerOptions): SwitchController;

interface SwitchOptions extends SwitchControllerOptions {
    id?: string;
}
declare class Switch {
    readonly el: HTMLButtonElement;
    private readonly ctrl;
    constructor(opts?: SwitchOptions);
    get checked(): boolean;
    setChecked(v: boolean): void;
    private paint;
}

type SelectSize = 'sm' | 'md';
interface SelectOption {
    value: string;
    label: string;
}
interface SelectControllerOptions {
    options: readonly SelectOption[];
    value?: string;
    size?: SelectSize;
    /** Stretch the trigger to its parent. Off: the shared 100px kit column (ellipsis). */
    fill?: boolean;
    disabled?: boolean;
    onChange?: (value: string, label: string) => void;
}
interface SelectController {
    options: readonly SelectOption[];
    value: string;
    size: SelectSize;
    fill: boolean;
    disabled: boolean;
    setValue(v: string): void;
    labelOf(value: string): string;
    pick(value: string): {
        value: string;
        label: string;
    };
}
declare function selectController(opts: SelectControllerOptions): SelectController;

interface SelectListPopoverOpts {
    theme?: VelaTheme;
    matchWidth?: boolean;
    boundary?: PopoverBoundary;
    boundaryInset?: number;
    gap?: number;
    align?: PopoverOptions['align'];
    host?: HTMLElement;
    position?: PopoverOptions['position'];
    zIndex?: string | number;
    size?: SelectSize;
    onClose?: () => void;
}
interface SelectOptions extends SelectControllerOptions {
    id?: string;
    theme?: VelaTheme;
    /** Placement for the open list (dialog-rect clamp, etc.). */
    list?: SelectListPopoverOpts;
}
/** Fill `menu` with option buttons. Call {@link decorateSelectScroll} after the menu is on screen. */
declare function fillSelectList(menu: HTMLElement, options: readonly SelectOption[], current: string, onPick: (value: string, label: string) => void): void;
/** Overlay scrollbar + scroll-into-view — needs a laid-out list (after the popover is shown). */
declare function decorateSelectScroll(menu: HTMLElement): void;
/** Open (or re-click close) a themed option list under `trigger`. */
declare function toggleSelectList(trigger: HTMLElement, options: readonly SelectOption[], current: string, onPick: (value: string, label: string) => void, opts?: SelectListPopoverOpts): Popover | null;
declare function openSelectList(trigger: HTMLElement, options: readonly SelectOption[], current: string, onPick: (value: string, label: string) => void, opts?: SelectListPopoverOpts): Popover;
declare class Select {
    readonly el: HTMLElement;
    private readonly trigger;
    private readonly labelEl;
    private readonly ctrl;
    private readonly listOpts;
    private list;
    constructor(opts: SelectOptions);
    get value(): string;
    setValue(v: string): void;
    toggle(): void;
    destroy(): void;
}

type NumberSize = 'sm' | 'md';
type NumberCommit = 'blur' | 'live';
interface NumberInputControllerOptions {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
    size?: NumberSize;
    /** `blur` clamps on commit (indicator dialog). `live` emits on every keystroke
     *  (chart settings). Steppers default on for `blur`; pass `steppers: true` to
     *  keep them with live commit. */
    commit?: NumberCommit;
    steppers?: boolean;
    clamp?: boolean;
    disabled?: boolean;
    onChange?: (value: number) => void;
}
declare function clampNumber(n: number, opts: {
    min?: number;
    max?: number;
    integer?: boolean;
}): number;
/** Trim binary-float noise after stepper arithmetic (`1.7 + 0.1` → `1.8`, not
 *  `1.7999999999999998`): round to the decimals the base value and step imply. */
declare function snapToStep(n: number, base: number, step: number): number;
interface NumberInputController {
    value: number;
    min?: number;
    max?: number;
    step: number;
    integer: boolean;
    size: NumberSize;
    commit: NumberCommit;
    steppers: boolean;
    clamp: boolean;
    disabled: boolean;
    apply(raw: number): number | null;
    /** Write the displayed value without emitting (vela-sync / external refresh). */
    sync(raw: number): number;
    nudge(dir: 1 | -1): number | null;
}
declare function numberInputController(opts: NumberInputControllerOptions): NumberInputController;

interface NumberInputOptions extends NumberInputControllerOptions {
    id?: string;
    title?: string;
    /** Chart-settings placeholder mode: empty field means `emptyValue` (the default). */
    placeholder?: string;
    emptyValue?: number;
    compact?: boolean;
    /** Stretch to the parent. Defaults to on for `md`, off for `sm`. Chart settings
     *  passes `false` so the field stays a 100px kit column instead of filling the pane. */
    fill?: boolean;
}
declare class NumberInput {
    readonly el: HTMLElement;
    readonly input: HTMLInputElement;
    private readonly ctrl;
    private last;
    private readonly placeholderMode;
    private readonly emptyValue;
    constructor(opts: NumberInputOptions);
    get value(): number;
    setValue(v: number): void;
    private buildSteppers;
}

type TextFieldSize = 'sm' | 'md';
interface TextFieldControllerOptions {
    value?: string;
    size?: TextFieldSize;
    fill?: boolean;
    disabled?: boolean;
    onChange?: (value: string) => void;
}
interface TextFieldController {
    value: string;
    size: TextFieldSize;
    fill: boolean;
    disabled: boolean;
    commit(next: string): string | null;
    /** Write without emitting (external refresh). */
    sync(next: string): void;
}
declare function textFieldController(opts?: TextFieldControllerOptions): TextFieldController;

interface TextFieldOptions extends TextFieldControllerOptions {
    id?: string;
}
declare class TextField {
    readonly el: HTMLElement;
    readonly input: HTMLInputElement;
    private readonly ctrl;
    constructor(opts?: TextFieldOptions);
    get value(): string;
    setValue(v: string): void;
}

/** Split a color into its `#RRGGBB` part + alpha 0..1 (handles `#RGB`, `#RRGGBB(AA)`, `rgba()`). */
declare function splitColor(color: string): {
    hex6: string;
    alpha: number;
};
/** Combine a `#RRGGBB` + alpha into `#RRGGBB` (opaque) or `#RRGGBBAA`. */
declare function combineColor(hex6: string, alpha: number): string;
/** Composite `fg` over `bg` at `alpha`, returning an opaque `#rrggbb`. */
declare function blendOver(fg: string, bg: string, alpha: number): string;
/** HSL (h 0-360, s/l 0-100) → `#rrggbb`. */
declare function hslHex(h: number, s: number, l: number): string;
/** A swatch palette: a grayscale row, then hue columns × shade rows. */
declare function buildPalette(): string[][];
/** The alpha checkerboard laid under translucent colors. Its grays are fixed on purpose:
 *  it stands for "nothing here", so it must not shift with the theme. */
declare function transparencyChecker(size: number): string;
type ColorFieldShape = 'square' | 'circle';
interface ColorPickerControllerOptions {
    color?: string;
    onChange?: (value: string) => void;
}
interface ColorPickerController {
    hex6: string;
    alpha: number;
    combined(): string;
    setHex(hex: string): void;
    setAlpha(a: number): void;
}
declare function colorPickerController(opts?: ColorPickerControllerOptions): ColorPickerController;

/**
 * When the opacity slider hands its value to `onChange` during a drag: `'live'` on every
 * pointer move (the consumer repaints cheaply, so the chart previews the drag), `'release'`
 * once on pointerup/pointercancel (the consumer recomputes — a script re-runs over its whole
 * history, so a per-move commit would queue seconds of work behind the pointer). The knob,
 * gradient and percentage follow the pointer either way; swatch picks always emit at once.
 */
type ColorCommit = 'live' | 'release';
interface ColorPickerOptions {
    commit?: ColorCommit;
}
/**
 * A self-contained color picker: a swatch grid (grays + hue × shade), a
 * recents row with a custom "+" picker, and an opacity slider over a transparency checker.
 * Emits `#RRGGBB` / `#RRGGBBAA` through `onChange`.
 */
declare function buildColorPicker(color: string, theme: VelaTheme, onChange: (v: string) => void, options?: ColorPickerOptions): HTMLElement;
interface ColorFieldOpts {
    shape?: ColorFieldShape;
    theme: VelaTheme;
    getVal: () => string;
    onVal: (v: string) => void;
    id?: string;
    popover?: Pick<PopoverOptions, 'host' | 'position' | 'boundary' | 'zIndex' | 'gap' | 'align'>;
    /** Opacity-drag commit policy of the popover picker (default `'live'`) — see {@link ColorCommit}. */
    commit?: ColorCommit;
}
/** Closed-state swatch shape. `circle` is the settings-dialog preview (a square chip
 *  inset from a matching field border); `square` is the compact drawing-chrome swatch. */
declare function colorField(theme: VelaTheme, getVal: () => string, onVal: (v: string) => void, opts?: {
    shape?: ColorFieldShape;
    id?: string;
    popover?: ColorFieldOpts['popover'];
    commit?: ColorCommit;
}): HTMLElement;
declare class ColorField {
    readonly el: HTMLButtonElement;
    private readonly swatch;
    private readonly getVal;
    private readonly onVal;
    private readonly theme;
    private readonly popoverOpts;
    private readonly commit;
    constructor(opts: ColorFieldOpts);
    private paint;
    private toggle;
}
/** Close any open color (or other kit) popover — dialog teardown. */
declare function closeColorPopover(): void;

type FieldGridVariant = 'settings' | 'inputs';
type FieldLabelSize = 'sm' | 'md';
/** Label↔control and between-row rhythm shared by the settings surfaces. */
declare const FIELD_GAP_PX = 16;
/** Grid tracks for a field grid. Settings hugs both columns; inputs give leftover
 *  space to the control column. Mobile flips the label to a flexible track. */
declare function fieldGridColumns(variant: FieldGridVariant, mobile: boolean): string;

interface FieldGridOptions {
    variant?: FieldGridVariant;
    mobile?: boolean;
}
/** Shared label/control grid. Rows with `display:contents` participate in these tracks. */
declare function fieldGrid(opts?: FieldGridOptions): HTMLElement;
interface FieldSectionOptions {
    variant?: FieldGridVariant;
    first?: boolean;
}
/** Uppercase group heading that spans the field grid. */
declare function fieldSection(title: string, opts?: FieldSectionOptions): HTMLElement;
/** Vertical breathing space between row clusters. */
declare function fieldSeparator(): HTMLElement;
interface FieldToggleOpts {
    checked: boolean;
    onChange: (v: boolean) => void;
    get?: () => boolean;
    id?: string;
}
interface FieldInlineItem {
    label?: string;
    id?: string;
    control: HTMLElement;
    /** Toggle sits left of its label (bool companion on an inline row). */
    toggleFirst?: boolean;
    fit?: boolean;
}
interface FieldRowOptions {
    label: string;
    id?: string;
    control?: HTMLElement | HTMLElement[];
    info?: HTMLElement;
    toggle?: FieldToggleOpts;
    /** Full-width toggle + label (no control column). */
    bool?: boolean;
    /** Full-width stacked: centered label above a full-width control (textarea). */
    stacked?: boolean;
    /** Full-width wrap of several labeled controls. */
    inline?: FieldInlineItem[];
    /** Skip the 100px control wrap (color / session / time). */
    fit?: boolean;
    /** Wrap a single control at this width (indicator dialog number/select column). */
    controlWidth?: number;
    labelSize?: FieldLabelSize;
    className?: string;
}
/** Label + control slot, optional master toggle, optional ⓘ. Grid-aware. */
declare function fieldRow(opts: FieldRowOptions): HTMLElement;
interface FieldControlHandle {
    el: HTMLElement;
    setValue?: (v: unknown) => void;
}
type FieldControlDesc = {
    kind: 'number';
    id?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
    commit?: 'blur' | 'live';
    steppers?: boolean;
    fill?: boolean;
    compact?: boolean;
    clamp?: boolean;
    placeholder?: string;
    emptyValue?: number;
    title?: string;
    onChange: (v: number) => void;
    sync?: () => number;
} | {
    kind: 'select';
    id?: string;
    options: readonly SelectOption[];
    value: string;
    fill?: boolean;
    theme?: VelaTheme;
    list?: SelectListPopoverOpts;
    title?: string;
    onChange: (v: string) => void;
    sync?: () => string;
} | {
    kind: 'switch';
    id?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    sync?: () => boolean;
} | {
    kind: 'color';
    id?: string;
    theme: VelaTheme;
    get: () => string;
    onChange: (v: string) => void;
    popover?: ColorFieldOpts['popover'];
    /** Opacity-drag commit policy (default `'live'`): `'release'` when `onChange` recomputes rather than repaints. */
    commit?: ColorFieldOpts['commit'];
    title?: string;
} | {
    kind: 'text';
    id?: string;
    value: string;
    fill?: boolean;
    placeholder?: string;
    onChange: (v: string) => void;
    sync?: () => string;
} | {
    kind: 'textarea';
    id?: string;
    value: string;
    rows?: number;
    autoGrow?: boolean;
    maxLines?: number;
    placeholder?: string;
    onChange: (v: string) => void;
    sync?: () => string;
} | {
    kind: 'width';
    theme: VelaTheme;
    get: () => number;
    onChange: (v: number) => void;
    title?: string;
};
/** One kit control from a neutral descriptor. `sync` re-reads on `vela-sync`. */
declare function buildFieldControl(desc: FieldControlDesc): FieldControlHandle;

type TextAreaSize = 'sm' | 'md';
interface TextAreaControllerOptions {
    value?: string;
    size?: TextAreaSize;
    rows?: number;
    disabled?: boolean;
    onChange?: (value: string) => void;
}
interface TextAreaController {
    value: string;
    size: TextAreaSize;
    rows: number;
    disabled: boolean;
    commit(next: string): string | null;
    sync(next: string): void;
}
declare function textAreaController(opts?: TextAreaControllerOptions): TextAreaController;

interface TextAreaOptions extends TextAreaControllerOptions {
    id?: string;
    placeholder?: string;
    /** Grow with content up to `maxLines`, then scroll. */
    autoGrow?: boolean;
    maxLines?: number;
}
declare class TextArea {
    readonly el: HTMLElement;
    readonly input: HTMLTextAreaElement;
    private readonly ctrl;
    private readonly autoGrow;
    private readonly maxLines;
    constructor(opts?: TextAreaOptions);
    get value(): string;
    setValue(v: string): void;
    private grow;
}

interface GlyphOption<T extends string | number = string | number> {
    value: T;
    label: string;
    /** Inner HTML of the preview glyph (currentColor stroke). */
    glyph: string;
}
interface GlyphSelectControllerOptions<T extends string | number = string | number> {
    options: readonly GlyphOption<T>[];
    value: T;
    onChange?: (value: T) => void;
}
interface GlyphSelectController<T extends string | number = string | number> {
    options: readonly GlyphOption<T>[];
    value: T;
    setValue(v: T): void;
    optionOf(value: T): GlyphOption<T> | undefined;
    pick(value: T): T;
}
declare function glyphSelectController<T extends string | number>(opts: GlyphSelectControllerOptions<T>): GlyphSelectController<T>;
/** The classic 1–5 px line-width ladder. */
declare const WIDTH_FIELD_OPTIONS: readonly number[];
/** A horizontal line glyph whose stroke IS the previewed weight. */
declare function lineWidthGlyph(width: number): string;
declare function widthFieldOptions(): readonly GlyphOption<number>[];

interface GlyphSelectOptions<T extends string | number = string | number> extends GlyphSelectControllerOptions<T> {
    theme: VelaTheme;
    title?: string;
    get?: () => T;
}
declare class GlyphSelect<T extends string | number = string | number> {
    readonly el: HTMLButtonElement;
    private readonly ctrl;
    private readonly theme;
    private readonly get;
    constructor(opts: GlyphSelectOptions<T>);
    setValue(v: T): void;
    private paint;
    private toggle;
}
/** Settings-dialog line-width field (1–5 px glyphs). */
declare function widthField(theme: VelaTheme, getVal: () => number, onVal: (v: number) => void): HTMLElement;
declare function closeWidthPopover(): void;

/** One block of a deployed callout panel — plain text, or a button running a caller action. */
type CalloutPanelItem = {
    type: 'text';
    text: string;
} | {
    type: 'button';
    label: string;
    /** Emphasized (selection-colored) button — the panel's main action. */
    primary?: boolean;
    /** Close the panel after `run` (default true — an action answers the panel). */
    close?: boolean;
    run(): void;
};
/** The deployed panel: an optional heading over ordered text/button blocks. */
interface CalloutPanel {
    title?: string;
    items: CalloutPanelItem[];
}
/** What dresses the bubble itself (the panel is what the click deploys). */
interface CalloutBubbleSpec {
    /** Icon id in the icon registry (`registerIcon`), centered in the bubble. */
    icon: string;
    /** Bubble fill — any CSS color, token expressions included. */
    background: string;
    /** Icon ink (default: `currentColor` inherited from the slot). */
    color?: string;
    /** Accessible name. Callers typically show the same text in their own tooltip. */
    label: string;
    /** Deployed panel — presence makes the bubble clickable. */
    panel?: CalloutPanel;
}
/** Whether activating a panel button also closes the panel (defaults to yes). */
declare function closesPanel(item: Extract<CalloutPanelItem, {
    type: 'button';
}>): boolean;
/** A panel row as the view lays it out: one text block, or a run of adjacent buttons. */
type CalloutPanelRow = {
    type: 'text';
    text: string;
} | {
    type: 'buttons';
    buttons: Array<Extract<CalloutPanelItem, {
        type: 'button';
    }>>;
};
/**
 * Group a panel's ordered items into layout rows: consecutive buttons share one row
 * (the common "text above, actions below" shape falls out naturally), text blocks
 * stand alone. Pure — unit-tested apart from the DOM.
 */
declare function calloutPanelRows(items: CalloutPanelItem[]): CalloutPanelRow[];

interface CalloutBubbleOptions extends CalloutBubbleSpec {
    /** Bubble diameter in px (default 16; the icon renders 4px smaller). */
    size?: number;
    /** Where the deployed panel portals (default: the document body). Pass the chart
     *  or widget root so the panel lives inside the host's DOM. */
    host?: HTMLElement;
    /** Live theme, for a panel deployed OUTSIDE a `.vela-ui` token host (renderer
     *  chrome on a bare chart passes its theme getter; widget chrome may omit it). */
    theme?: () => VelaTheme;
    /** Panel clamp — `'viewport'` (default) flips the panel above the bubble when the
     *  bottom screen edge is too close for it to deploy below. */
    boundary?: PopoverBoundary;
}
declare class CalloutBubble {
    readonly el: HTMLElement;
    private spec;
    private readonly size;
    private readonly host;
    private readonly theme;
    private readonly boundary;
    private pop;
    constructor(opts: CalloutBubbleOptions);
    /** Re-dress the bubble (a status change: new icon, tint, label, panel). */
    set(spec: Partial<CalloutBubbleSpec>): void;
    /** Whether the deployed panel is currently open. */
    get open(): boolean;
    /** Close the deployed panel, if any. The bubble itself stays. */
    hidePanel(): void;
    destroy(): void;
    private dress;
    private toggle;
    private buildPanel;
}

declare const CALLOUT_STYLE_ID = "vela-ui-callout-bubble";
declare const CALLOUT_CSS = "\n.vela-callout {\n    display: inline-grid;\n    place-items: center;\n    border-radius: 50%;\n    flex: none;\n    line-height: 0;\n    box-sizing: border-box;\n    cursor: default;\n    user-select: none;\n    -webkit-user-select: none;\n}\n.vela-callout[role='button'] { cursor: pointer; }\n.vela-callout svg { display: block; }\n/* The deployed panel \u2014 carries the kit's elevated-card look itself (the popover\n   shell is bare positioning chrome). */\n.vela-callout-panel {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n    padding: 10px 12px;\n    max-width: 280px;\n    box-sizing: border-box;\n    background: var(--vela-surface-elev);\n    border: 1px solid var(--vela-border-strong);\n    border-radius: 6px;\n    box-shadow: var(--vela-shadow);\n    color: var(--vela-fg);\n    font: var(--vela-font-size-md) var(--vela-font);\n}\n.vela-callout-title { font-weight: 600; color: var(--vela-fg-bright); }\n.vela-callout-text { color: var(--vela-fg-muted); line-height: 1.45; white-space: pre-line; }\n.vela-callout-actions { display: flex; flex-wrap: wrap; gap: 8px; }\n.vela-callout-btn {\n    cursor: pointer;\n    height: 26px;\n    padding: 0 10px;\n    border-radius: 5px;\n    border: 1px solid var(--vela-border);\n    background: transparent;\n    color: var(--vela-fg);\n    font-size: var(--vela-font-size-md);\n    font-family: inherit;\n    transition: background var(--vela-dur-fast) ease, color var(--vela-dur-fast) ease, opacity var(--vela-dur-fast) ease, border-color var(--vela-dur-fast) ease;\n}\n.vela-callout-btn:hover { background: var(--vela-hover); color: var(--vela-fg-bright); border-color: var(--vela-fg-muted); }\n.vela-callout-btn-primary { border-color: var(--vela-selected-bg); background: var(--vela-selected-bg); color: var(--vela-selected-fg); }\n.vela-callout-btn-primary:hover { background: var(--vela-selected-bg); color: var(--vela-selected-fg); opacity: 0.85; border-color: var(--vela-selected-bg); }\n";

type DatePickerPanel = 'date' | 'month' | 'year';
interface DatePickerControllerOptions {
    /** The selected date (`YYYY-MM-DD`); the calendar opens on its month. */
    value?: string;
    /** "Today" for the today ring and the initial month when nothing is selected. */
    today?: Date;
}
/** One cell of the current panel. `blank` cells pad the first week of a month. */
interface DatePickerCell {
    label: string;
    /** The day (`YYYY-MM-DD`) on the date panel; the month index or the year otherwise. */
    value: string | number;
    checked: boolean;
    today: boolean;
    /** A padding year outside the decade on the year panel. */
    outside?: boolean;
    blank?: boolean;
}
interface DatePickerController {
    readonly panel: DatePickerPanel;
    readonly year: number;
    readonly month: number;
    readonly value: string | null;
    /** Header text: the month switch (hidden off the date panel) and the year switch. */
    header(): {
        month: string;
        monthVisible: boolean;
        year: string;
        yearDisabled: boolean;
    };
    /** What the arrows step on the current panel. */
    navLabels(): {
        prev: string;
        next: string;
    };
    cells(): DatePickerCell[];
    /** One month, one year or ten, depending on the panel. */
    step(dir: 1 | -1): void;
    showMonths(): void;
    showYears(): void;
    /** Activate a cell: a day returns its date (the pick); a month or year only navigates. */
    choose(cell: DatePickerCell): string | null;
    /** Rewrite the selection without emitting (and open on its month). */
    setValue(value: string | null): void;
}
/** `YYYY-MM-DD` for a local date. */
declare function isoDate(d: Date): string;
/** Accept `YYYY-MM-DD` or `YYYY-M-D` and return a padded ISO date, or null if unusable. */
declare function normalizeDateInput(raw: string): string | null;
declare function datePickerController(opts?: DatePickerControllerOptions): DatePickerController;

interface DatePickerOptions extends DatePickerControllerOptions {
    /** A day was picked (`YYYY-MM-DD`). */
    onPick?: (value: string) => void;
}
declare class DatePicker {
    private readonly opts;
    readonly el: HTMLDivElement;
    private readonly ctrl;
    private readonly prev;
    private readonly next;
    private readonly monthBtn;
    private readonly yearBtn;
    private readonly week;
    private readonly grid;
    constructor(opts?: DatePickerOptions);
    get value(): string | null;
    /** Rewrite the selection without emitting (the calendar opens on its month). */
    setValue(value: string | null): void;
    private paint;
    private cellEl;
}

export { CALLOUT_CSS, CALLOUT_STYLE_ID, CalloutBubble, type CalloutBubbleOptions, type CalloutBubbleSpec, type CalloutPanel, type CalloutPanelItem, type CalloutPanelRow, type ColorCommit, ColorField, type ColorFieldOpts, type ColorFieldShape, type ColorPickerController, type ColorPickerControllerOptions, type ColorPickerOptions, DatePicker, type DatePickerCell, type DatePickerController, type DatePickerControllerOptions, type DatePickerOptions, type DatePickerPanel, Dialog, type DialogApi, type DialogControllerOptions, type DialogOptions, type DialogService, Drawer, type DrawerApi, type DrawerControllerOptions, type DrawerOptions, type DrawerService, FIELD_FOCUS_CSS, FIELD_FOCUS_RING, FIELD_GAP_PX, type FieldControlDesc, type FieldControlHandle, type FieldGridOptions, type FieldGridVariant, type FieldInlineItem, type FieldLabelSize, type FieldRowOptions, type FieldSectionOptions, type FieldToggleOpts, type GlyphOption, GlyphSelect, type GlyphSelectController, type GlyphSelectControllerOptions, type GlyphSelectOptions, type MachineHandle, Menu, type MenuApi, type MenuControllerOptions, type MenuItemDescriptor, type MenuOptions, type MenuService, type NumberCommit, NumberInput, type NumberInputController, type NumberInputControllerOptions, type NumberInputOptions, type NumberSize, type PlaceArgs, type PlaceResult, Popover, type PopoverAlign, type PopoverBoundary, type PopoverController, type PopoverControllerOptions, type PopoverOptions, type PopoverPosition, type Rect, SURFACE_CLOSE_EVENT, SURFACE_OPEN_EVENT, Select, type SelectController, type SelectControllerOptions, type SelectListPopoverOpts, type SelectOption, type SelectOptions, type SelectSize, type SurfaceEventDetail, type SurfaceKind, Switch, type SwitchController, type SwitchControllerOptions, type SwitchOptions, type SwitchSize, type SwitchTone, TextArea, type TextAreaController, type TextAreaControllerOptions, type TextAreaOptions, type TextAreaSize, TextField, type TextFieldController, type TextFieldControllerOptions, type TextFieldOptions, type TextFieldSize, Tooltip, type TooltipApi, type TooltipControllerOptions, type TooltipOptions, type TooltipService, WIDTH_FIELD_OPTIONS, applyPlotOverlayTokens, applyThemeTokens, blendOver, buildColorPicker, buildFieldControl, buildPalette, calloutPanelRows, clampNumber, closeColorPopover, closeOpenPopovers, closeWidthPopover, closesPanel, colorField, colorPickerController, combineColor, datePickerController, decorateSelectScroll, dialogController, drawerController, ensureUIHost, eventDismissedPopover, fieldGrid, fieldGridColumns, fieldRow, fieldSection, fieldSeparator, fillSelectList, glyphSelectController, hslHex, iconEl, injectStyles, insetRect, intersectRects, isPopoverOpen, isoDate, lineWidthGlyph, menuController, nextUid, normalizeDateInput, numberInputController, openPopoverTrigger, openSelectList, overlayScrollbarCss, placePopover, popoverController, runMachine, selectController, snapToStep, splitColor, switchController, textAreaController, textFieldController, toggleSelectList, tooltipController, transparencyChecker, viewportRect, widthField, widthFieldOptions, withAlpha };
