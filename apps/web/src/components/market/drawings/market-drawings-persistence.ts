/**
 * Vela Drawings & Preferences Persistence Bridge
 *
 * Handles:
 * 1. Global user preferences for drawing tools (favorites, snap mode, stay-in-drawing mode).
 * 2. Per-trade plotted drawings isolation and persistence (localStorage + debounced API sync).
 * 3. Bidirectional hydration without spurious write-back cycles.
 */

import {
  bindNativeDrawingControllerPersistence,
  extractControllerToolStyles,
  applyControllerToolStyles,
} from "@luxalgo/vela/workspace";

export { extractControllerToolStyles, applyControllerToolStyles };

export const VELA_DRAWING_FAVORITES_KEY = "tradejournal_vela_drawing_favorites_v1";
export const VELA_DRAWING_PREFS_KEY = "tradejournal_vela_drawing_prefs_v1";
export const VELA_TRADE_DRAWINGS_PREFIX = "tradejournal_vela_drawings_v1:";

export interface VelaDrawingPrefs {
  snapMode?: "off" | "weak" | "strong";
  stayMode?: boolean;
  toolStyles?: Record<string, Record<string, unknown>>;
}

export type DrawingToolPrefs = VelaDrawingPrefs;

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

function sanitizeToolStylesMap(
  raw: unknown,
): Record<string, Record<string, unknown>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [toolType, style] of Object.entries(raw as Record<string, unknown>)) {
    const key = toolType.trim();
    if (key && style && typeof style === "object" && !Array.isArray(style)) {
      out[key] = { ...(style as Record<string, unknown>) };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}



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

let pendingFavoritesTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFavoritesPayload: string[] | null = null;
let pendingFavoritesFetchFn: typeof fetch | undefined = undefined;

let pendingPrefsTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPrefsPayload: VelaDrawingPrefs | Record<string, unknown> | null = null;
let pendingPrefsFetchFn: typeof fetch | undefined = undefined;

/**
 * Saves favorite drawing tools list to local storage AND debounced (300ms) sync to /api/settings.
 */
export function saveDrawingFavorites(
  favorites: string[],
  options?: { fetchImpl?: typeof fetch; debounceMs?: number },
): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(VELA_DRAWING_FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
  }

  const fn = options?.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fn) return;

  const debounceMs = options?.debounceMs ?? 300;
  pendingFavoritesPayload = favorites;
  pendingFavoritesFetchFn = fn;
  if (pendingFavoritesTimer) {
    clearTimeout(pendingFavoritesTimer);
  }
  pendingFavoritesTimer = setTimeout(() => {
    pendingFavoritesTimer = null;
    const payload = pendingFavoritesPayload;
    pendingFavoritesPayload = null;
    pendingFavoritesFetchFn = undefined;
    if (payload) {
      try {
        void fn("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ velaDrawingFavorites: payload }),
        }).catch(() => {});
      } catch {}
    }
  }, debounceMs);
}

/**
 * Loads drawing tool preferences (snap mode, stay mode, toolStyles) from local storage.
 */
export function loadDrawingToolPrefs(): VelaDrawingPrefs {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(VELA_DRAWING_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const result: VelaDrawingPrefs = {};
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
      const toolStyles = sanitizeToolStylesMap(parsed.toolStyles);
      if (toolStyles) {
        result.toolStyles = toolStyles;
      }
      return result;
    }
  } catch {}
  return {};
}

export const loadLocalPrefs = loadDrawingToolPrefs;

export function saveLocalPrefs(patch: VelaDrawingPrefs): VelaDrawingPrefs {
  const current = loadDrawingToolPrefs();
  const mergedToolStyles =
    patch.toolStyles !== undefined || current.toolStyles !== undefined
      ? {
          ...(current.toolStyles ?? {}),
          ...(patch.toolStyles ?? {}),
        }
      : undefined;
  const updated: VelaDrawingPrefs = {
    ...current,
    ...patch,
    ...(mergedToolStyles && Object.keys(mergedToolStyles).length > 0
      ? { toolStyles: mergedToolStyles }
      : {}),
  };
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(VELA_DRAWING_PREFS_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function saveRemoteGlobalPrefs(
  prefs: VelaDrawingPrefs,
  options?: { fetchImpl?: typeof fetch; debounceMs?: number },
): void {
  const fn = options?.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fn) return;

  const debounceMs = options?.debounceMs ?? 300;
  pendingPrefsPayload = prefs;
  pendingPrefsFetchFn = fn;
  if (pendingPrefsTimer) {
    clearTimeout(pendingPrefsTimer);
  }
  pendingPrefsTimer = setTimeout(() => {
    pendingPrefsTimer = null;
    const payload = pendingPrefsPayload;
    pendingPrefsPayload = null;
    pendingPrefsFetchFn = undefined;
    if (payload) {
      try {
        void fn("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ velaDrawingPrefs: payload }),
        }).catch(() => {});
      } catch {}
    }
  }, debounceMs);
}

/**
 * Updates drawing tool preferences in local storage with the provided patch
 * AND debounced (300ms) sync to /api/settings.
 */
export function saveDrawingToolPrefs(
  patch: VelaDrawingPrefs,
  options?: { fetchImpl?: typeof fetch; debounceMs?: number },
): void {
  const updated = saveLocalPrefs(patch);
  saveRemoteGlobalPrefs(updated, options);
}

export async function fetchRemoteGlobalPrefs(
  options?: { fetchImpl?: typeof fetch },
): Promise<{
  velaDrawingFavorites?: string[];
  velaDrawingPrefs?: VelaDrawingPrefs;
  velaReplayDrawings?: Record<string, string> | null;
} | null> {
  const fn = options?.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fn) return null;
  try {
    const res = await fn("/api/settings", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res || !res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    const result: {
      velaDrawingFavorites?: string[];
      velaDrawingPrefs?: VelaDrawingPrefs;
      velaReplayDrawings?: Record<string, string> | null;
    } = {};

    if (
      Array.isArray(data.velaDrawingFavorites) &&
      data.velaDrawingFavorites.every((item) => typeof item === "string")
    ) {
      result.velaDrawingFavorites = data.velaDrawingFavorites as string[];
    }

    if (
      data.velaDrawingPrefs &&
      typeof data.velaDrawingPrefs === "object" &&
      !Array.isArray(data.velaDrawingPrefs)
    ) {
      const rawPrefs = data.velaDrawingPrefs as Record<string, unknown>;
      const prefs: VelaDrawingPrefs = {};
      if (
        rawPrefs.snapMode === "off" ||
        rawPrefs.snapMode === "weak" ||
        rawPrefs.snapMode === "strong"
      ) {
        prefs.snapMode = rawPrefs.snapMode;
      }
      if (typeof rawPrefs.stayMode === "boolean") {
        prefs.stayMode = rawPrefs.stayMode;
      }
      const toolStyles = sanitizeToolStylesMap(rawPrefs.toolStyles);
      if (toolStyles) {
        prefs.toolStyles = toolStyles;
      }
      result.velaDrawingPrefs = prefs;
    }

    if (
      data.velaReplayDrawings &&
      typeof data.velaReplayDrawings === "object" &&
      !Array.isArray(data.velaReplayDrawings)
    ) {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.velaReplayDrawings as Record<string, unknown>)) {
        if (typeof v === "string") {
          map[k] = v;
        }
      }
      result.velaReplayDrawings = map;
    }

    return result;
  } catch {
    return null;
  }
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

export function loadLocalDrawings(tradeKey: string): string | null {
  if (!tradeKey) return null;
  const storage = getStorage();
  if (!storage) return null;
  try {
    return (
      storage.getItem(VELA_TRADE_DRAWINGS_PREFIX + tradeKey) ??
      storage.getItem(tradeKey) ??
      storage.getItem(`tradejournal_replay_drawings_${tradeKey}`)
    );
  } catch {
    return null;
  }
}

let lifecycleFlushListenersBound = false;

function ensureDrawingsUnloadFlushBound(): void {
  if (lifecycleFlushListenersBound || typeof window === "undefined") return;
  lifecycleFlushListenersBound = true;

  const handleUnload = () => {
    flushPendingTradeDrawingsSave(undefined, true);
  };

  window.addEventListener("pagehide", handleUnload);
  window.addEventListener("beforeunload", handleUnload);
}

const sendRemotePatch = (
  tradeKey: string,
  serialized: string,
  fetchFn?: typeof fetch,
  keepalive = false,
): void => {
  const fn = fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fn) return;
  const useKeepalive = keepalive && serialized.length < 50_000;
  try {
    if (tradeKey.startsWith("replay-")) {
      void fn("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ velaReplayDrawings: { [tradeKey]: serialized } }),
        ...(useKeepalive ? { keepalive: true } : {}),
      } as RequestInit).catch(() => {});
    } else {
      void fn(`/api/trades/${encodeURIComponent(tradeKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawingsJson: serialized }),
        ...(useKeepalive ? { keepalive: true } : {}),
      } as RequestInit).catch(() => {});
    }
  } catch {}
};

/**
 * Saves drawings document for a trade key:
 * 1. Synchronously to localStorage.
 * 2. Debounced (default 350ms) PATCH to /api/trades/[key] (or /api/settings for replay-* keys).
 */
export function saveTradeDrawings(
  tradeKey: string,
  doc: VelaDrawingsDoc,
  options?: SaveTradeDrawingsOptions,
): void {
  if (!tradeKey) return;
  ensureDrawingsUnloadFlushBound();
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
 * Immediately flushes any pending debounced remote save for favorites/preferences.
 */
export function flushPendingPreferencesSave(fetchFn?: typeof fetch, forceKeepalive = false): void {
  if (pendingFavoritesTimer) {
    clearTimeout(pendingFavoritesTimer);
    pendingFavoritesTimer = null;
    const payload = pendingFavoritesPayload;
    const fn = fetchFn ?? pendingFavoritesFetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
    pendingFavoritesPayload = null;
    pendingFavoritesFetchFn = undefined;
    if (payload && fn) {
      try {
        const body = JSON.stringify({ velaDrawingFavorites: payload });
        void fn("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          ...(forceKeepalive && body.length < 50_000 ? { keepalive: true } : {}),
        } as RequestInit).catch(() => {});
      } catch {}
    }
  }

  if (pendingPrefsTimer) {
    clearTimeout(pendingPrefsTimer);
    pendingPrefsTimer = null;
    const payload = pendingPrefsPayload;
    const fn = fetchFn ?? pendingPrefsFetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
    pendingPrefsPayload = null;
    pendingPrefsFetchFn = undefined;
    if (payload && fn) {
      try {
        const body = JSON.stringify({ velaDrawingPrefs: payload });
        void fn("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          ...(forceKeepalive && body.length < 50_000 ? { keepalive: true } : {}),
        } as RequestInit).catch(() => {});
      } catch {}
    }
  }
}

/**
 * Immediately flushes any pending debounced remote save for a trade (or all trades).
 */
export function flushPendingTradeDrawingsSave(tradeKey?: string, forceKeepalive = false): void {
  flushPendingPreferencesSave(undefined, forceKeepalive);
  if (tradeKey) {
    const pending = pendingSaves.get(tradeKey);
    if (pending) {
      clearTimeout(pending.timer);
      pendingSaves.delete(tradeKey);
      sendRemotePatch(pending.tradeKey, pending.serialized, pending.fetchFn, forceKeepalive);
    }
  } else {
    for (const [key, pending] of Array.from(pendingSaves.entries())) {
      clearTimeout(pending.timer);
      pendingSaves.delete(key);
      sendRemotePatch(pending.tradeKey, pending.serialized, pending.fetchFn, forceKeepalive);
    }
  }
}

/**
 * Attaches drawings persistence to a Vela chart instance for a specific trade or replay symbol.
 *
 * Guarantees:
 * - Hydrates favorite tools, snap/stay modes, toolStyles, and trade/replay drawings without write-back echo.
 * - Auto-saves on drawing:created, drawing:edited, drawing:removed, and undo/redo (drawing:selected with doc change).
 * - Captures and persists per-tool default styles (`ctrl.lastStyle`) on drawing:created and drawing:edited.
 * - Ignores pure drawing:selected events where doc did not change.
 * - Flushes pending debounced remote saves on cleanup.
 */
export function attachVelaDrawingsPersistence(
  instance: any,
  tradeKey: string,
  options?: AttachVelaDrawingsPersistenceOptions,
): () => void {
  const savedDoc = loadTradeDrawings(tradeKey, options?.initialDrawingsJson);

  return bindNativeDrawingControllerPersistence(instance, {
    loadInitialDoc: () => savedDoc,
    loadFavorites: () => loadDrawingFavorites(),
    loadPrefs: () => loadLocalPrefs(),
    saveDoc: (doc) => saveTradeDrawings(tradeKey, doc, options),
    saveFavorites: (favs) =>
      saveDrawingFavorites(favs, {
        fetchImpl: options?.fetchImpl,
        debounceMs: options?.debounceMs,
      }),
    savePrefs: (patch) => {
      if (patch.toolStyles) {
        const existingPrefs = loadLocalPrefs();
        const mergedToolStyles = {
          ...(existingPrefs.toolStyles ?? {}),
          ...patch.toolStyles,
        };
        const updated = saveLocalPrefs({ toolStyles: mergedToolStyles });
        saveRemoteGlobalPrefs(updated, {
          fetchImpl: options?.fetchImpl,
          debounceMs: options?.debounceMs,
        });
      } else {
        saveDrawingToolPrefs(patch, {
          fetchImpl: options?.fetchImpl,
          debounceMs: options?.debounceMs,
        });
      }
    },
    fetchRemoteState:
      options?.syncRemote !== false &&
      (tradeKey.startsWith("replay-") || (typeof window !== "undefined" && !options?.fetchImpl))
        ? async () => {
            const remote = await fetchRemoteGlobalPrefs({ fetchImpl: options?.fetchImpl });
            if (!remote) return null;
            const localFavs = loadDrawingFavorites();
            const favorites =
              localFavs.length === 0 && remote.velaDrawingFavorites?.length
                ? remote.velaDrawingFavorites
                : undefined;
            if (favorites) {
              const storage = getStorage();
              if (storage) {
                try {
                  storage.setItem(VELA_DRAWING_FAVORITES_KEY, JSON.stringify(favorites));
                } catch {}
              }
            }
            const currentLocal = loadLocalPrefs();
            const mergedPrefs: VelaDrawingPrefs = {
              ...remote.velaDrawingPrefs,
              ...currentLocal,
              toolStyles: {
                ...(remote.velaDrawingPrefs?.toolStyles ?? {}),
                ...(currentLocal.toolStyles ?? {}),
              },
            };
            saveLocalPrefs(mergedPrefs);
            const remoteJson =
              tradeKey.startsWith("replay-") && !savedDoc
                ? remote.velaReplayDrawings?.[tradeKey]
                : undefined;
            const doc = remoteJson ? loadTradeDrawings(tradeKey, remoteJson) : null;
            return { favorites, prefs: mergedPrefs, doc };
          }
        : undefined,
    onRestored: options?.onDrawingsRestored,
    onDispose: () => flushPendingTradeDrawingsSave(tradeKey),
  });
}

