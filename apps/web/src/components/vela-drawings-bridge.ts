/**
 * Vela Drawings & Preferences Persistence Bridge
 *
 * Handles:
 * 1. Global user preferences for drawing tools (favorites, snap mode, stay-in-drawing mode).
 * 2. Per-trade plotted drawings isolation and persistence (localStorage + debounced API sync).
 * 3. Bidirectional hydration without spurious write-back cycles.
 */

export const VELA_DRAWING_FAVORITES_KEY = "tradejournal_vela_drawing_favorites_v1";
export const VELA_DRAWING_PREFS_KEY = "tradejournal_vela_drawing_prefs_v1";
export const VELA_TRADE_DRAWINGS_PREFIX = "tradejournal_vela_drawings_v1:";

export interface DrawingToolPrefs {
  snapMode?: "off" | "weak" | "strong";
  stayMode?: boolean;
}

export interface VelaDrawingsDoc {
  version: 1;
  drawings: any[];
}

export interface SaveTradeDrawingsOptions {
  syncRemote?: boolean;
  fetchImpl?: typeof fetch;
  debounceMs?: number;
}

export interface AttachVelaDrawingsPersistenceOptions extends SaveTradeDrawingsOptions {
  initialDrawingsJson?: string | null;
  onDrawingsRestored?: () => void;
}

interface PendingRemoteSave {
  timer: ReturnType<typeof setTimeout>;
  tradeKey: string;
  serialized: string;
  fetchFn?: typeof fetch;
}

const pendingSaves = new Map<string, PendingRemoteSave>();

const getStorage = (): Storage | null => {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return null;
};

/**
 * Loads favorite drawing tools list from local storage.
 */
export function loadDrawingFavorites(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(VELA_DRAWING_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {}
  return [];
}

/**
 * Saves favorite drawing tools list to local storage.
 */
export function saveDrawingFavorites(favorites: string[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(VELA_DRAWING_FAVORITES_KEY, JSON.stringify(favorites));
  } catch {}
}

/**
 * Loads drawing tool preferences (snap mode, stay mode) from local storage.
 */
export function loadDrawingToolPrefs(): DrawingToolPrefs {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(VELA_DRAWING_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const result: DrawingToolPrefs = {};
      if (
        parsed.snapMode === "off" ||
        parsed.snapMode === "weak" ||
        parsed.snapMode === "strong"
      ) {
        result.snapMode = parsed.snapMode;
      }
      if (typeof parsed.stayMode === "boolean") {
        result.stayMode = parsed.stayMode;
      }
      return result;
    }
  } catch {}
  return {};
}

/**
 * Updates drawing tool preferences in local storage with the provided patch.
 */
export function saveDrawingToolPrefs(patch: DrawingToolPrefs): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const current = loadDrawingToolPrefs();
    const updated: DrawingToolPrefs = { ...current, ...patch };
    storage.setItem(VELA_DRAWING_PREFS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Loads drawings document for a specific trade from localStorage or initial SQLite JSON.
 */
export function loadTradeDrawings(
  tradeKey: string,
  initialDrawingsJson?: string | null,
): VelaDrawingsDoc | null {
  if (!tradeKey) return null;
  const storage = getStorage();

  if (storage) {
    try {
      const localRaw = storage.getItem(VELA_TRADE_DRAWINGS_PREFIX + tradeKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.drawings)) {
          return parsed as VelaDrawingsDoc;
        }
      }
    } catch {}
  }

  if (initialDrawingsJson && typeof initialDrawingsJson === "string") {
    try {
      const parsed = JSON.parse(initialDrawingsJson);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.drawings)) {
        if (storage) {
          try {
            storage.setItem(VELA_TRADE_DRAWINGS_PREFIX + tradeKey, initialDrawingsJson);
          } catch {}
        }
        return parsed as VelaDrawingsDoc;
      }
    } catch {}
  }

  return null;
}

const sendRemotePatch = (
  tradeKey: string,
  serialized: string,
  fetchFn?: typeof fetch,
): void => {
  const fn = fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fn) return;
  try {
    void fn(`/api/trades/${encodeURIComponent(tradeKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drawingsJson: serialized }),
    }).catch(() => {});
  } catch {}
};

/**
 * Saves drawings document for a trade key:
 * 1. Synchronously to localStorage.
 * 2. Debounced (default 350ms) PATCH to /api/trades/[key].
 */
export function saveTradeDrawings(
  tradeKey: string,
  doc: VelaDrawingsDoc,
  options?: SaveTradeDrawingsOptions,
): void {
  if (!tradeKey) return;
  const serialized = JSON.stringify(doc);

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(VELA_TRADE_DRAWINGS_PREFIX + tradeKey, serialized);
    } catch {}
  }

  if (options?.syncRemote !== false) {
    const existing = pendingSaves.get(tradeKey);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const fetchFn = options?.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
    const debounceMs = options?.debounceMs ?? 350;

    const timer = setTimeout(() => {
      pendingSaves.delete(tradeKey);
      sendRemotePatch(tradeKey, serialized, fetchFn);
    }, debounceMs);

    pendingSaves.set(tradeKey, {
      timer,
      tradeKey,
      serialized,
      fetchFn,
    });
  }
}

/**
 * Immediately flushes any pending debounced remote save for a trade (or all trades).
 */
export function flushPendingTradeDrawingsSave(tradeKey?: string): void {
  if (tradeKey) {
    const pending = pendingSaves.get(tradeKey);
    if (pending) {
      clearTimeout(pending.timer);
      pendingSaves.delete(tradeKey);
      sendRemotePatch(pending.tradeKey, pending.serialized, pending.fetchFn);
    }
  } else {
    for (const [key, pending] of Array.from(pendingSaves.entries())) {
      clearTimeout(pending.timer);
      pendingSaves.delete(key);
      sendRemotePatch(pending.tradeKey, pending.serialized, pending.fetchFn);
    }
  }
}

/**
 * Attaches drawings persistence to a Vela chart instance for a specific trade.
 *
 * Guarantees:
 * - Hydrates favorite tools, snap/stay modes, and trade drawings without write-back echo.
 * - Auto-saves on drawing:created, drawing:edited, drawing:removed, and undo/redo (drawing:selected with doc change).
 * - Ignores pure drawing:selected events where doc did not change.
 * - Flushes pending debounced remote saves on cleanup.
 */
export function attachVelaDrawingsPersistence(
  instance: any,
  tradeKey: string,
  options?: AttachVelaDrawingsPersistenceOptions,
): () => void {
  let isHydrating = true;
  const unsubs: Array<() => void> = [];

  // 1. Hydrate favorites
  const favs = loadDrawingFavorites();
  if (favs.length > 0 && typeof instance?.drawings?.setFavorites === "function") {
    try {
      instance.drawings.setFavorites(favs);
    } catch {}
  }

  // 2. Hydrate tool preferences
  const prefs = loadDrawingToolPrefs();
  if (prefs.snapMode && typeof instance?.drawings?.setSnapMode === "function") {
    try {
      instance.drawings.setSnapMode(prefs.snapMode);
    } catch {}
  }
  if (
    typeof prefs.stayMode === "boolean" &&
    typeof instance?.drawings?.setStayMode === "function"
  ) {
    try {
      instance.drawings.setStayMode(prefs.stayMode);
    } catch {}
  }

  // 3. Hydrate trade drawings
  const savedDoc = loadTradeDrawings(tradeKey, options?.initialDrawingsJson);
  if (savedDoc && Array.isArray(savedDoc.drawings)) {
    try {
      instance?.drawings?.fromJSON?.(savedDoc);
    } catch {}
  } else {
    try {
      instance?.drawings?.fromJSON?.({ version: 1, drawings: [] });
    } catch {}
  }

  try {
    options?.onDrawingsRestored?.();
  } catch {}

  // Baseline serialization to avoid duplicate saves & ignore pure selection changes
  let lastSerialized = JSON.stringify(
    instance?.drawings?.toJSON?.() ?? { version: 1, drawings: [] },
  );
  isHydrating = false;

  const persistIfChanged = () => {
    if (isHydrating) return;
    const currentDoc = instance?.drawings?.toJSON?.() ?? { version: 1, drawings: [] };
    const nextSerialized = JSON.stringify(currentDoc);
    if (nextSerialized !== lastSerialized) {
      lastSerialized = nextSerialized;
      saveTradeDrawings(tradeKey, currentDoc, options);
    }
  };

  // Event handlers
  if (typeof instance?.on === "function") {
    const handleDrawingEvent = () => {
      persistIfChanged();
    };

    const drawingEvents = [
      "drawing:created",
      "drawing:edited",
      "drawing:removed",
      "drawing:selected",
    ];

    for (const evt of drawingEvents) {
      const unsub = instance.on(evt, handleDrawingEvent);
      if (typeof unsub === "function") {
        unsubs.push(unsub);
      } else if (typeof instance.off === "function") {
        unsubs.push(() => instance.off(evt, handleDrawingEvent));
      }
    }

    const handleFavs = ({ favorites }: any = {}) => {
      if (!isHydrating && Array.isArray(favorites)) {
        saveDrawingFavorites(favorites);
      }
    };
    const unsubFavs = instance.on("drawing:favorites", handleFavs);
    if (typeof unsubFavs === "function") {
      unsubs.push(unsubFavs);
    } else if (typeof instance.off === "function") {
      unsubs.push(() => instance.off("drawing:favorites", handleFavs));
    }

    const handleSnap = ({ mode }: any = {}) => {
      if (!isHydrating && mode) {
        saveDrawingToolPrefs({ snapMode: mode });
      }
    };
    const unsubSnap = instance.on("drawing:snap", handleSnap);
    if (typeof unsubSnap === "function") {
      unsubs.push(unsubSnap);
    } else if (typeof instance.off === "function") {
      unsubs.push(() => instance.off("drawing:snap", handleSnap));
    }

    const handleStay = ({ on }: any = {}) => {
      if (!isHydrating && typeof on === "boolean") {
        saveDrawingToolPrefs({ stayMode: on });
      }
    };
    const unsubStay = instance.on("drawing:stay", handleStay);
    if (typeof unsubStay === "function") {
      unsubs.push(unsubStay);
    } else if (typeof instance.off === "function") {
      unsubs.push(() => instance.off("drawing:stay", handleStay));
    }
  }

  // Hook into internal store onChange if present
  const store = (instance?.drawings as any)?.ctrl?.store;
  if (store && typeof store.onChange === "function") {
    const unsubStore = store.onChange(() => {
      persistIfChanged();
    });
    if (typeof unsubStore === "function") {
      unsubs.push(unsubStore);
    }
  }

  return () => {
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch {}
    }
    unsubs.length = 0;
    flushPendingTradeDrawingsSave(tradeKey);
  };
}
