interface KeyBindingDescriptor {
    /** Stable id, e.g. `'chart.toggle-log-scale'`. Re-registering an id replaces it. */
    id: string;
    /** Default chord(s). Users can `rebind()` without touching the descriptor. */
    keys: string | string[];
    /** Human label for the shortcuts help panel. */
    label: string;
    /** Help-panel grouping, e.g. `'Chart'`, `'Drawings'`. */
    category?: string;
    /** `'global'` fires in ANY scope; anything else only while it is the top scope. Default `'chart'`. */
    scope?: string;
    /** Extra runtime gate evaluated at match time. */
    when?: () => boolean;
    /** Fire even while an input/textarea/contenteditable has focus (default false). */
    allowInInput?: boolean;
    /** preventDefault + stopPropagation on match (default true). */
    preventDefault?: boolean;
    run: (ev: KeyboardEvent) => void;
}
interface ResolvedBinding {
    readonly id: string;
    readonly label: string;
    readonly category: string;
    readonly scope: string;
    /** Active chords (custom rebinds if present, else descriptor defaults). */
    readonly keys: readonly string[];
    /** Display form per platform, e.g. `'⌘⇧K'` (mac) / `'Ctrl+Shift+K'`. */
    readonly display: readonly string[];
}
interface KeymapOptions {
    /** Force the platform (default: sniffed from `navigator.platform`). */
    platform?: 'mac' | 'other';
    /** The scope active when the stack is empty. Default `'chart'`. */
    baseScope?: string;
}
declare class KeymapManager {
    private readonly mac;
    private readonly baseScope;
    private readonly descriptors;
    private readonly rebinds;
    private readonly scopeStack;
    private target;
    private readonly onKeydown;
    constructor(opts?: KeymapOptions);
    /** Register (or replace, by id) a binding. Returns a disposer. */
    register(desc: KeyBindingDescriptor): () => void;
    unregister(id: string): void;
    /** User-level rebinding: overrides the descriptor's default chords (null resets). */
    rebind(id: string, keys: string | string[] | null): void;
    /** Snapshot for a shortcuts help panel / rebinding UI. */
    bindings(): ResolvedBinding[];
    pushScope(scope: string): () => void;
    /** Pops the TOPMOST occurrence of `scope` (tolerates out-of-order teardown). */
    popScope(scope: string): void;
    get activeScope(): string;
    attach(target: EventTarget): void;
    detach(): void;
    /** The matcher — public so hosts/tests can feed events from their own listeners. */
    handleKeydown(ev: KeyboardEvent): boolean;
    destroy(): void;
    private activeKeys;
}

export { KeymapManager as K, type ResolvedBinding as R, type KeyBindingDescriptor as a, type KeymapOptions as b };
