export interface VelaDrawingPrefs {
  snapMode?: "off" | "weak" | "strong";
  stayMode?: boolean;
  toolStyles?: Record<string, Record<string, unknown>>;
}

export interface VelaDrawingsDoc {
  version: 1;
  drawings: any[];
}

export interface NativeDrawingPersistenceAdapter {
  loadInitialDoc: () => VelaDrawingsDoc | null;
  loadFavorites: () => string[];
  loadPrefs: () => VelaDrawingPrefs;
  saveDoc: (doc: VelaDrawingsDoc) => void;
  saveFavorites: (favorites: string[]) => void;
  savePrefs: (patch: VelaDrawingPrefs) => void;
  fetchRemoteState?: () => Promise<{
    favorites?: string[];
    prefs?: VelaDrawingPrefs;
    doc?: VelaDrawingsDoc | null;
  } | null>;
  onRestored?: () => void;
  onDispose?: () => void;
}

/**
 * Conecta o DrawingController nativo do Vela 0.8.4 (ADR-0005) a um adaptador de persistência
 * com proteção contra loop de hidratação (echo write-back guard).
 */
export function bindNativeDrawingControllerPersistence(
  instance: any,
  adapter: NativeDrawingPersistenceAdapter,
): () => void {
  const drawingsCtrl = instance?.drawings;
  if (!drawingsCtrl) return () => {};

  let isHydrating = true;
  let isDisposed = false;
  const unsubs: Array<() => void> = [];

  // 1. Hidratação Síncrona (L1: LocalStorage / SQLite inicial)
  try {
    const favs = adapter.loadFavorites();
    if (favs.length > 0 && typeof drawingsCtrl.setFavorites === "function") {
      drawingsCtrl.setFavorites(favs);
    }

    const prefs = adapter.loadPrefs();
    if (prefs.snapMode && typeof drawingsCtrl.setSnapMode === "function") {
      drawingsCtrl.setSnapMode(prefs.snapMode);
    }
    if (typeof prefs.stayMode === "boolean" && typeof drawingsCtrl.setStayMode === "function") {
      drawingsCtrl.setStayMode(prefs.stayMode);
    }
    if (prefs.toolStyles) {
      applyControllerToolStyles(instance, prefs.toolStyles);
    }

    const initialDoc = adapter.loadInitialDoc();
    drawingsCtrl.fromJSON?.(
      initialDoc && Array.isArray(initialDoc.drawings)
        ? initialDoc
        : { version: 1, drawings: [] },
    );
    adapter.onRestored?.();
  } catch {}

  let lastSerialized = JSON.stringify(
    drawingsCtrl.toJSON?.() ?? { version: 1, drawings: [] },
  );
  isHydrating = false;

  // 2. Hidratação Assíncrona Opcional (L2: SQLite /api/settings fallback)
  if (adapter.fetchRemoteState) {
    void adapter
      .fetchRemoteState()
      .then((remote) => {
        if (!remote || isDisposed) return;
        isHydrating = true;
        try {
          if (remote.favorites?.length) {
            drawingsCtrl.setFavorites?.(remote.favorites);
          }
          if (remote.prefs) {
            if (remote.prefs.snapMode) drawingsCtrl.setSnapMode?.(remote.prefs.snapMode);
            if (typeof remote.prefs.stayMode === "boolean") {
              drawingsCtrl.setStayMode?.(remote.prefs.stayMode);
            }
            if (remote.prefs.toolStyles) {
              applyControllerToolStyles(instance, remote.prefs.toolStyles);
            }
          }
          if (remote.doc && Array.isArray(remote.doc.drawings)) {
            drawingsCtrl.fromJSON?.(remote.doc);
            lastSerialized = JSON.stringify(drawingsCtrl.toJSON?.() ?? remote.doc);
            adapter.onRestored?.();
          }
        } finally {
          isHydrating = false;
        }
      })
      .catch(() => {});
  }

  // 3. Listeners Nativos do Vela 0.8.4
  const syncDocIfChanged = () => {
    if (isHydrating || isDisposed) return;
    const currentDoc: VelaDrawingsDoc = drawingsCtrl.toJSON?.() ?? { version: 1, drawings: [] };
    const nextSerialized = JSON.stringify(currentDoc);
    if (nextSerialized !== lastSerialized) {
      lastSerialized = nextSerialized;
      adapter.saveDoc(currentDoc);
    }
  };

  const syncToolDefaults = () => {
    if (isHydrating || isDisposed) return;
    const styles = extractControllerToolStyles(instance);
    if (Object.keys(styles).length > 0) {
      adapter.savePrefs({ toolStyles: styles });
    }
  };

  const on = (evt: string, handler: (payload?: any) => void) => {
    if (typeof instance.on !== "function") return;
    const off = instance.on(evt, handler);
    if (typeof off === "function") unsubs.push(off);
    else if (typeof instance.off === "function") unsubs.push(() => instance.off(evt, handler));
  };

  for (const evt of ["drawing:created", "drawing:edited", "drawing:defaults"]) {
    on(evt, () => {
      syncDocIfChanged();
      syncToolDefaults();
    });
  }

  // drawing:removed e undo/redo (que disparam drawing:selected quando o doc muda)
  for (const evt of ["drawing:removed", "drawing:selected"]) {
    on(evt, syncDocIfChanged);
  }

  on("drawing:favorites", ({ favorites }: { favorites?: string[] } = {}) => {
    if (!isHydrating && Array.isArray(favorites)) {
      adapter.saveFavorites(favorites);
    }
  });

  on("drawing:snap", ({ mode }: { mode?: "off" | "weak" | "strong" } = {}) => {
    if (!isHydrating && mode) {
      adapter.savePrefs({ snapMode: mode });
    }
  });

  on("drawing:stay", ({ on: stayOn }: { on?: boolean } = {}) => {
    if (!isHydrating && typeof stayOn === "boolean") {
      adapter.savePrefs({ stayMode: stayOn });
    }
  });

  // 4. Internal store change listener (if present)
  const store = (drawingsCtrl as any)?.ctrl?.store ?? (drawingsCtrl as any)?.store;
  if (store && typeof store.onChange === "function") {
    const unsubStore = store.onChange(() => {
      syncDocIfChanged();
    });
    if (typeof unsubStore === "function") {
      unsubs.push(unsubStore);
    }
  }

  return () => {
    isDisposed = true;
    for (const unsub of unsubs.splice(0)) {
      try { unsub(); } catch {}
    }
    adapter.onDispose?.();
  };
}

/**
 * Extracts per-tool default styles from the Vela drawing controller:
 * 1. Uses official Vela 0.8.4+ API `chart.drawings.toolDefaults()` when available.
 * 2. Falls back to legacy Vela 0.8.3 `ctrl.lastStyle` Map.
 */
export function extractControllerToolStyles(
  instance: any,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  try {
    // 1. Official Vela 0.8.4+ API
    if (typeof instance?.drawings?.toolDefaults === "function") {
      const defs = instance.drawings.toolDefaults();
      if (defs && typeof defs === "object" && !Array.isArray(defs)) {
        for (const [toolType, val] of Object.entries(defs)) {
          if (toolType && val && typeof val === "object" && !Array.isArray(val)) {
            result[toolType.trim()] = { ...(val as Record<string, unknown>) };
          }
        }
        if (Object.keys(result).length > 0) return result;
      }
    }

    // 2. Legacy Vela 0.8.3 fallback (ctrl.lastStyle)
    const lastStyle = (instance?.drawings as any)?.ctrl?.lastStyle;
    if (!lastStyle) return result;
    if (lastStyle instanceof Map || typeof lastStyle.entries === "function") {
      for (const [toolType, style] of lastStyle.entries()) {
        if (
          typeof toolType === "string" &&
          toolType.trim() &&
          style &&
          typeof style === "object" &&
          !Array.isArray(style)
        ) {
          result[toolType.trim()] = { ...(style as Record<string, unknown>) };
        }
      }
    } else if (typeof lastStyle === "object" && !Array.isArray(lastStyle)) {
      for (const [toolType, style] of Object.entries(lastStyle as Record<string, unknown>)) {
        if (
          typeof toolType === "string" &&
          toolType.trim() &&
          style &&
          typeof style === "object" &&
          !Array.isArray(style)
        ) {
          result[toolType.trim()] = { ...(style as Record<string, unknown>) };
        }
      }
    }
  } catch {}
  return result;
}

/**
 * Applies saved per-tool default styles into the Vela drawing controller:
 * 1. Uses official Vela 0.8.4+ API `chart.drawings.setToolDefaults()` when available.
 * 2. Falls back to legacy Vela 0.8.3 `ctrl.lastStyle` Map.
 */
export function applyControllerToolStyles(
  instance: any,
  toolStyles?: Record<string, Record<string, unknown>>,
): void {
  if (!toolStyles || typeof toolStyles !== "object") return;
  try {
    // 1. Official Vela 0.8.4+ API
    if (typeof instance?.drawings?.setToolDefaults === "function") {
      instance.drawings.setToolDefaults(toolStyles);
    }

    // 2. Legacy Vela 0.8.3 fallback (ctrl.lastStyle)
    const lastStyle = (instance?.drawings as any)?.ctrl?.lastStyle;
    if (!lastStyle) return;
    if (lastStyle instanceof Map || typeof lastStyle.set === "function") {
      for (const [toolType, style] of Object.entries(toolStyles)) {
        if (
          typeof toolType === "string" &&
          toolType.trim() &&
          style &&
          typeof style === "object" &&
          !Array.isArray(style)
        ) {
          const existing =
            typeof lastStyle.get === "function" ? lastStyle.get(toolType.trim()) : undefined;
          lastStyle.set(toolType.trim(), {
            ...(existing && typeof existing === "object" ? existing : {}),
            ...style,
          });
        }
      }
    } else if (typeof lastStyle === "object" && !Array.isArray(lastStyle)) {
      for (const [toolType, style] of Object.entries(toolStyles)) {
        if (
          typeof toolType === "string" &&
          toolType.trim() &&
          style &&
          typeof style === "object" &&
          !Array.isArray(style)
        ) {
          const existing = (lastStyle as Record<string, unknown>)[toolType.trim()];
          (lastStyle as Record<string, unknown>)[toolType.trim()] = {
            ...(existing && typeof existing === "object" ? existing : {}),
            ...style,
          };
        }
      }
    }
  } catch {}
}
