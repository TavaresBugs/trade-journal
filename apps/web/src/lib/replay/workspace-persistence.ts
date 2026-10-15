export const STORAGE_KEY = "tradejournal_replay_workspace_v1";
export const REPLAY_WORKSPACE_KEY = STORAGE_KEY;
export const TEMPLATES_STORAGE_KEY = "tradejournal_indicator_templates_v1";
export const FAVORITES_STORAGE_KEY = "tradejournal_favorite_indicators";
export const PERSONAL_SCRIPTS_STORAGE_KEY = "tradejournal_saved_pine_scripts_v1";

export interface PersistedIndicatorInstance {
  slug: string;
  inputs?: Record<string, string | number | boolean>;
  props?: Record<string, string | number | boolean>;
  visible?: boolean;
}

export interface PersistedIndicatorPreset {
  inputs?: Record<string, string | number | boolean>;
  props?: Record<string, string | number | boolean>;
  visible?: boolean;
}

export interface PersistedCellState {
  symbol: string;
  resolution: string;
  indicators?: string[];
  indicatorConfigs?: PersistedIndicatorInstance[];
}

export interface PersistedReplayWorkspace {
  version: 1;
  layout: { rows: number; cols: number };
  syncOptions: {
    symbol: boolean;
    interval: boolean;
    crosshair: boolean;
    time: boolean;
    dateRange: boolean;
    style: boolean;
  };
  activeCellIndex: number;
  cells: Record<number, PersistedCellState>;
  activeIndicatorSlugs: string[];
  activeIndicatorConfigs?: PersistedIndicatorInstance[];
  indicatorPresetsBySlug?: Record<string, PersistedIndicatorPreset>;
  isPaperBottomOpen: boolean;
  paperBottomHeight: number;
  isOrderTicketOpen: boolean;
  isDomOpen: boolean;
  updatedAt?: number;
}

export interface SavedIndicatorTemplate {
  id: string;
  name: string;
  indicators: string[];
  indicatorConfigs?: PersistedIndicatorInstance[];
  createdAt: number;
}

export interface ResolvedFavoriteIndicatorItem {
  id: string;
  kind: "native" | "builtin" | "personal";
  targetId: string;
  label: string;
  code?: string;
}

export interface CatalogIndicatorLookupItem {
  slug?: string;
  id?: string;
  type?: string;
  name: string;
  shortTitle?: string;
}

export interface PersonalScriptLookupItem {
  id: string;
  name?: string;
  title?: string;
  code: string;
}

const VALID_RESOLUTIONS = new Set<string>([
  "1m",
  "2m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h",
  "3h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1mo",
]);

const ACRONYM_INDICATORS = new Set<string>([
  "ema",
  "sma",
  "rma",
  "wma",
  "hma",
  "vwma",
  "dema",
  "tema",
  "vwap",
  "rsi",
  "macd",
  "atr",
  "adx",
  "cci",
  "obv",
  "mfi",
  "roc",
  "tsi",
  "uo",
  "ao",
  "dmi",
  "psar",
  "supertrend",
  "vidya",
  "trama",
  "cvd",
]);

export const DEFAULT_REPLAY_WORKSPACE: PersistedReplayWorkspace = {
  version: 1,
  layout: { rows: 1, cols: 1 },
  syncOptions: {
    symbol: false,
    interval: false,
    crosshair: true,
    time: false,
    dateRange: false,
    style: false,
  },
  activeCellIndex: 0,
  cells: {
    0: { symbol: "MES", resolution: "1m", indicators: [] },
  },
  activeIndicatorSlugs: [],
  isPaperBottomOpen: false,
  paperBottomHeight: 39,
  isOrderTicketOpen: false,
  isDomOpen: false,
};

export const DEFAULT_INDICATOR_TEMPLATES: SavedIndicatorTemplate[] = [
  {
    id: "tpl-default-volume-ema",
    name: "Volume + EMA Cross",
    indicators: ["native:volume", "native:ema"],
    createdAt: 1700000000000,
  },
];

let pendingRemoteSyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRemoteSyncPayload: Record<string, unknown> = {};

function scheduleRemoteSettingsPatch(patch: Record<string, unknown>, debounceMs = 350): void {
  if (typeof fetch === "undefined") return;
  pendingRemoteSyncPayload = { ...pendingRemoteSyncPayload, ...patch };
  if (pendingRemoteSyncTimer) {
    clearTimeout(pendingRemoteSyncTimer);
  }
  pendingRemoteSyncTimer = setTimeout(() => {
    pendingRemoteSyncTimer = null;
    const payload = pendingRemoteSyncPayload;
    pendingRemoteSyncPayload = {};
    if (Object.keys(payload).length === 0) return;
    try {
      void fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}
  }, debounceMs);
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined" && localStorage !== null) {
      return localStorage;
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return null;
}

function cloneDefaultWorkspace(): PersistedReplayWorkspace {
  return {
    version: 1,
    layout: { ...DEFAULT_REPLAY_WORKSPACE.layout },
    syncOptions: { ...DEFAULT_REPLAY_WORKSPACE.syncOptions },
    activeCellIndex: DEFAULT_REPLAY_WORKSPACE.activeCellIndex,
    cells: {
      0: {
        symbol: DEFAULT_REPLAY_WORKSPACE.cells[0]!.symbol,
        resolution: DEFAULT_REPLAY_WORKSPACE.cells[0]!.resolution,
        indicators: [...(DEFAULT_REPLAY_WORKSPACE.cells[0]!.indicators ?? [])],
      },
    },
    activeIndicatorSlugs: [...DEFAULT_REPLAY_WORKSPACE.activeIndicatorSlugs],
    isPaperBottomOpen: DEFAULT_REPLAY_WORKSPACE.isPaperBottomOpen,
    paperBottomHeight: DEFAULT_REPLAY_WORKSPACE.paperBottomHeight,
    isOrderTicketOpen: DEFAULT_REPLAY_WORKSPACE.isOrderTicketOpen,
    isDomOpen: DEFAULT_REPLAY_WORKSPACE.isDomOpen,
  };
}

function clampGridDimension(val: unknown, fallback = 1): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(1, Math.min(4, Math.floor(val)));
}

function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0 && !seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  return out;
}

function sanitizeParamRecord(
  raw: unknown,
): Record<string, string | number | boolean> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (
      typeof v === "string" ||
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v))
    ) {
      out[key] = v;
    }
  }
  return out;
}

function sanitizeIndicatorInstance(raw: unknown): PersistedIndicatorInstance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const slug = typeof obj.slug === "string" ? obj.slug.trim() : "";
  if (!slug) return null;
  const result: PersistedIndicatorInstance = { slug };
  const inputs = sanitizeParamRecord(obj.inputs);
  if (inputs !== undefined) result.inputs = inputs;
  const props = sanitizeParamRecord(obj.props);
  if (props !== undefined) result.props = props;
  if (typeof obj.visible === "boolean") result.visible = obj.visible;
  return result;
}

function sanitizeIndicatorConfigs(arr: unknown): PersistedIndicatorInstance[] {
  if (!Array.isArray(arr)) return [];
  const out: PersistedIndicatorInstance[] = [];
  for (const item of arr) {
    const clean = sanitizeIndicatorInstance(item);
    if (clean) out.push(clean);
  }
  return out;
}

function sanitizeIndicatorPresetsBySlug(
  raw: unknown,
): Record<string, PersistedIndicatorPreset> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, PersistedIndicatorPreset> = {};
  for (const [rawSlug, rawPreset] of Object.entries(raw as Record<string, unknown>)) {
    const slug = rawSlug.trim();
    if (!slug || !rawPreset || typeof rawPreset !== "object" || Array.isArray(rawPreset)) continue;
    const presetObj = rawPreset as Record<string, unknown>;
    const preset: PersistedIndicatorPreset = {};
    const inputs = sanitizeParamRecord(presetObj.inputs);
    if (inputs !== undefined) preset.inputs = inputs;
    const props = sanitizeParamRecord(presetObj.props);
    if (props !== undefined) preset.props = props;
    if (typeof presetObj.visible === "boolean") preset.visible = presetObj.visible;
    out[slug] = preset;
  }
  return out;
}

function sanitizeCellState(raw: unknown, fallbackSymbol = "MES", fallbackRes = "1m"): PersistedCellState {
  if (!raw || typeof raw !== "object") {
    return { symbol: fallbackSymbol, resolution: fallbackRes };
  }
  const obj = raw as Record<string, unknown>;
  const rawSym = typeof obj.symbol === "string" ? obj.symbol.trim().toUpperCase() : "";
  const symbol = rawSym.length > 0 ? rawSym : fallbackSymbol;
  const rawRes = typeof obj.resolution === "string" ? obj.resolution.trim() : "";
  const resolution = VALID_RESOLUTIONS.has(rawRes) ? rawRes : fallbackRes;

  const result: PersistedCellState = { symbol, resolution };
  if (Array.isArray(obj.indicators)) {
    result.indicators = sanitizeStringArray(obj.indicators);
  }
  if (Array.isArray(obj.indicatorConfigs)) {
    result.indicatorConfigs = sanitizeIndicatorConfigs(obj.indicatorConfigs);
  }
  return result;
}

function sanitizeWorkspace(raw: unknown): PersistedReplayWorkspace {
  if (!raw || typeof raw !== "object") {
    return cloneDefaultWorkspace();
  }
  const obj = raw as Record<string, unknown>;
  const rawLayout = (obj.layout && typeof obj.layout === "object" ? obj.layout : {}) as Record<
    string,
    unknown
  >;
  const rows = clampGridDimension(rawLayout.rows, 1);
  const cols = clampGridDimension(rawLayout.cols, 1);
  const totalCells = rows * cols;

  const rawSync = (obj.syncOptions && typeof obj.syncOptions === "object"
    ? obj.syncOptions
    : {}) as Record<string, unknown>;
  const syncOptions = {
    symbol: typeof rawSync.symbol === "boolean" ? rawSync.symbol : false,
    interval: typeof rawSync.interval === "boolean" ? rawSync.interval : false,
    crosshair: typeof rawSync.crosshair === "boolean" ? rawSync.crosshair : true,
    time: typeof rawSync.time === "boolean" ? rawSync.time : false,
    dateRange: typeof rawSync.dateRange === "boolean" ? rawSync.dateRange : false,
    style: typeof rawSync.style === "boolean" ? rawSync.style : false,
  };

  const cells: Record<number, PersistedCellState> = {};
  if (obj.cells && typeof obj.cells === "object") {
    for (const [key, val] of Object.entries(obj.cells as Record<string, unknown>)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < 16) {
        cells[idx] = sanitizeCellState(val);
      }
    }
  }

  if (!cells[0]) {
    cells[0] = { symbol: "MES", resolution: "1m", indicators: [] };
  }

  const rawActiveIdx = obj.activeCellIndex;
  const activeCellIndex =
    typeof rawActiveIdx === "number" &&
    Number.isInteger(rawActiveIdx) &&
    rawActiveIdx >= 0 &&
    rawActiveIdx < totalCells
      ? rawActiveIdx
      : 0;

  const activeIndicatorSlugs = sanitizeStringArray(obj.activeIndicatorSlugs);
  const isPaperBottomOpen =
    typeof obj.isPaperBottomOpen === "boolean" ? obj.isPaperBottomOpen : false;
  const paperBottomHeight =
    typeof obj.paperBottomHeight === "number" &&
    Number.isFinite(obj.paperBottomHeight) &&
    obj.paperBottomHeight >= 30
      ? Math.min(800, Math.round(obj.paperBottomHeight))
      : 39;
  const isOrderTicketOpen =
    typeof obj.isOrderTicketOpen === "boolean" ? obj.isOrderTicketOpen : false;
  const isDomOpen = typeof obj.isDomOpen === "boolean" ? obj.isDomOpen : false;

  const result: PersistedReplayWorkspace = {
    version: 1,
    layout: { rows, cols },
    syncOptions,
    activeCellIndex,
    cells,
    activeIndicatorSlugs,
    isPaperBottomOpen,
    paperBottomHeight,
    isOrderTicketOpen,
    isDomOpen,
  };

  if (Array.isArray(obj.activeIndicatorConfigs)) {
    result.activeIndicatorConfigs = sanitizeIndicatorConfigs(obj.activeIndicatorConfigs);
  }
  const presets = sanitizeIndicatorPresetsBySlug(obj.indicatorPresetsBySlug);
  if (presets !== undefined) {
    result.indicatorPresetsBySlug = presets;
  }
  if (typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt)) {
    result.updatedAt = obj.updatedAt;
  }

  return result;
}

export function loadReplayWorkspace(): PersistedReplayWorkspace {
  const storage = getSafeStorage();
  if (!storage) {
    return cloneDefaultWorkspace();
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultWorkspace();
    }
    const parsed = JSON.parse(raw);
    return sanitizeWorkspace(parsed);
  } catch {
    return cloneDefaultWorkspace();
  }
}

export function saveReplayWorkspace(
  partial: Partial<PersistedReplayWorkspace>,
): PersistedReplayWorkspace {
  const current = loadReplayWorkspace();
  const mergedCells: Record<number, PersistedCellState> = { ...current.cells };
  if (partial.cells && typeof partial.cells === "object") {
    for (const [key, val] of Object.entries(partial.cells)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < 16 && val) {
        mergedCells[idx] = sanitizeCellState(
          val,
          mergedCells[idx]?.symbol ?? "MES",
          mergedCells[idx]?.resolution ?? "1m",
        );
      }
    }
  }

  const mergedPresets =
    partial.indicatorPresetsBySlug !== undefined || current.indicatorPresetsBySlug !== undefined
      ? {
          ...(current.indicatorPresetsBySlug ?? {}),
          ...(partial.indicatorPresetsBySlug ?? {}),
        }
      : undefined;

  const next = sanitizeWorkspace({
    ...current,
    ...partial,
    version: 1,
    layout: partial.layout ? { ...current.layout, ...partial.layout } : current.layout,
    syncOptions: partial.syncOptions
      ? { ...current.syncOptions, ...partial.syncOptions }
      : current.syncOptions,
    cells: mergedCells,
    ...(mergedPresets !== undefined ? { indicatorPresetsBySlug: mergedPresets } : {}),
  });

  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  scheduleRemoteSettingsPatch({
    replayWorkspace: { ...next, updatedAt: next.updatedAt ?? Date.now() },
  });

  return next;
}

function sanitizeTemplateArray(parsed: unknown): SavedIndicatorTemplate[] {
  if (!Array.isArray(parsed)) return [];
  const out: SavedIndicatorTemplate[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : "";
    const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "";
    if (!id || !name) continue;
    const indicators = sanitizeStringArray(obj.indicators);
    const createdAt =
      typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt)
        ? obj.createdAt
        : Date.now();
    const tpl: SavedIndicatorTemplate = { id, name, indicators, createdAt };
    if (Array.isArray(obj.indicatorConfigs)) {
      tpl.indicatorConfigs = sanitizeIndicatorConfigs(obj.indicatorConfigs);
    }
    out.push(tpl);
  }
  return out;
}

export function loadIndicatorTemplates(): SavedIndicatorTemplate[] {
  const storage = getSafeStorage();
  if (!storage) {
    return DEFAULT_INDICATOR_TEMPLATES.map((t) => ({ ...t, indicators: [...t.indicators] }));
  }
  try {
    const raw = storage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_INDICATOR_TEMPLATES.map((t) => ({ ...t, indicators: [...t.indicators] }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_INDICATOR_TEMPLATES.map((t) => ({ ...t, indicators: [...t.indicators] }));
    }
    return sanitizeTemplateArray(parsed);
  } catch {
    return DEFAULT_INDICATOR_TEMPLATES.map((t) => ({ ...t, indicators: [...t.indicators] }));
  }
}

export function saveIndicatorTemplates(
  templates: SavedIndicatorTemplate[],
): SavedIndicatorTemplate[] {
  const next = sanitizeTemplateArray(templates);
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }
  scheduleRemoteSettingsPatch({ replayIndicatorTemplates: next });
  return next;
}

export function saveIndicatorTemplate(
  name: string,
  indicators: string[],
  indicatorConfigs?: PersistedIndicatorInstance[],
): SavedIndicatorTemplate[] {
  const current = loadIndicatorTemplates();
  const cleanName = (typeof name === "string" ? name.trim() : "") || `Template ${current.length + 1}`;
  const cleanIndicators = sanitizeStringArray(indicators);
  const cleanConfigs =
    indicatorConfigs !== undefined ? sanitizeIndicatorConfigs(indicatorConfigs) : undefined;
  const now = Date.now();

  const existingIdx = current.findIndex(
    (t) => t.name.toLowerCase() === cleanName.toLowerCase(),
  );

  let next: SavedIndicatorTemplate[];
  if (existingIdx >= 0) {
    next = current.map((t, idx) =>
      idx === existingIdx
        ? {
            ...t,
            name: cleanName,
            indicators: cleanIndicators,
            ...(cleanConfigs !== undefined ? { indicatorConfigs: cleanConfigs } : {}),
            createdAt: now,
          }
        : t,
    );
  } else {
    const newTpl: SavedIndicatorTemplate = {
      id: `tpl_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      indicators: cleanIndicators,
      ...(cleanConfigs !== undefined ? { indicatorConfigs: cleanConfigs } : {}),
      createdAt: now,
    };
    next = [...current, newTpl];
  }

  return saveIndicatorTemplates(next);
}

export function deleteIndicatorTemplate(id: string): SavedIndicatorTemplate[] {
  const current = loadIndicatorTemplates();
  const next = current.filter((t) => t.id !== id);
  return saveIndicatorTemplates(next);
}

export function loadFavoriteIndicatorIds(): string[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeStringArray(parsed);
  } catch {
    return [];
  }
}

export function saveFavoriteIndicators(ids: string[]): string[] {
  const clean = sanitizeStringArray(ids);
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(clean));
    } catch {}
  }
  scheduleRemoteSettingsPatch({ replayFavoriteIndicators: clean });
  return clean;
}

export const saveFavoriteIndicatorIds = saveFavoriteIndicators;

export function loadPersonalPineScripts(): Array<{ id: string; name: string; code: string }> {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PERSONAL_SCRIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Array<{ id: string; name: string; code: string }> = [];
    for (const s of parsed) {
      if (!s || typeof s !== "object") continue;
      const id = typeof s.id === "string" ? s.id.trim() : "";
      const name =
        (typeof s.name === "string" && s.name.trim()) ||
        (typeof s.title === "string" && s.title.trim()) ||
        "My Script";
      const code = typeof s.code === "string" ? s.code : "";
      if (id && code) {
        out.push({ id, name, code });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function savePersonalPineScripts(
  scripts: Array<{ id: string; name?: string; title?: string; code: string; [key: string]: any } | { id: string; name?: string; title?: string; code: string }>,
): Array<{ id: string; name: string; code: string }> {
  const out: Array<{ id: string; name: string; code: string }> = [];
  if (Array.isArray(scripts)) {
    for (const s of scripts) {
      if (!s || typeof s !== "object") continue;
      const id = typeof s.id === "string" ? s.id.trim() : "";
      const name =
        (typeof s.name === "string" && s.name.trim()) ||
        (typeof s.title === "string" && s.title.trim()) ||
        "My Script";
      const code = typeof s.code === "string" ? s.code : "";
      if (id && code) {
        out.push({ id, name, code });
      }
    }
  }
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(PERSONAL_SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
    } catch {}
  }
  scheduleRemoteSettingsPatch({ replayPersonalPineScripts: scripts });
  return out;
}

export async function hydrateWorkspaceFromRemoteSettings(
  onHydrated?: (changed: boolean) => void,
): Promise<boolean> {
  if (typeof fetch === "undefined") {
    onHydrated?.(false);
    return false;
  }
  const storage = getSafeStorage();
  if (!storage) {
    onHydrated?.(false);
    return false;
  }

  let changed = false;
  try {
    const res = await fetch("/api/settings", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      onHydrated?.(false);
      return false;
    }
    const data = (await res.json()) as Record<string, unknown>;

    // 1. Hydrate replayWorkspace
    if (
      data?.replayWorkspace &&
      typeof data.replayWorkspace === "object" &&
      !Array.isArray(data.replayWorkspace)
    ) {
      const remoteWs = data.replayWorkspace as Record<string, unknown>;
      const localRaw = storage.getItem(STORAGE_KEY);
      let shouldHydrateWs = !localRaw;
      if (localRaw) {
        try {
          const localParsed = JSON.parse(localRaw) as Record<string, unknown>;
          const remoteTs =
            typeof remoteWs.updatedAt === "number" && Number.isFinite(remoteWs.updatedAt)
              ? remoteWs.updatedAt
              : 0;
          const localTs =
            typeof localParsed?.updatedAt === "number" && Number.isFinite(localParsed.updatedAt)
              ? localParsed.updatedAt
              : 0;
          if (remoteTs > localTs) {
            shouldHydrateWs = true;
          }
        } catch {
          shouldHydrateWs = true;
        }
      }
      if (shouldHydrateWs) {
        const sanitized = sanitizeWorkspace(remoteWs);
        storage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        changed = true;
      }
    }

    // 2. Hydrate replayFavoriteIndicators
    if (Array.isArray(data?.replayFavoriteIndicators) && data.replayFavoriteIndicators.length > 0) {
      const localFavRaw = storage.getItem(FAVORITES_STORAGE_KEY);
      const localFavs = loadFavoriteIndicatorIds();
      if (!localFavRaw || localFavs.length === 0) {
        const cleanFavs = sanitizeStringArray(data.replayFavoriteIndicators);
        if (cleanFavs.length > 0) {
          storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cleanFavs));
          changed = true;
        }
      }
    }

    // 3. Hydrate replayIndicatorTemplates
    if (Array.isArray(data?.replayIndicatorTemplates) && data.replayIndicatorTemplates.length > 0) {
      const localTplRaw = storage.getItem(TEMPLATES_STORAGE_KEY);
      let hasLocalTpls = false;
      if (localTplRaw) {
        try {
          const parsed = JSON.parse(localTplRaw);
          hasLocalTpls = Array.isArray(parsed) && parsed.length > 0;
        } catch {}
      }
      if (!localTplRaw || !hasLocalTpls) {
        const cleanTpls = sanitizeTemplateArray(data.replayIndicatorTemplates);
        if (cleanTpls.length > 0) {
          storage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(cleanTpls));
          changed = true;
        }
      }
    }

    // 4. Hydrate replayPersonalPineScripts
    if (
      Array.isArray(data?.replayPersonalPineScripts) &&
      data.replayPersonalPineScripts.length > 0
    ) {
      const localScriptsRaw = storage.getItem(PERSONAL_SCRIPTS_STORAGE_KEY);
      const localScripts = loadPersonalPineScripts();
      if (!localScriptsRaw || localScripts.length === 0) {
        storage.setItem(
          PERSONAL_SCRIPTS_STORAGE_KEY,
          JSON.stringify(data.replayPersonalPineScripts),
        );
        changed = true;
      }
    }
  } catch {}

  try {
    onHydrated?.(changed);
  } catch {}
  return changed;
}

function humanizeIndicatorSlug(slug: string): string {
  const clean = slug
    .replace(/^(native:|builtin:|slug:|personal:)+/i, "")
    .trim();
  if (!clean) return "Indicator";
  if (ACRONYM_INDICATORS.has(clean.toLowerCase())) {
    return clean.toUpperCase();
  }
  return clean
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (ACRONYM_INDICATORS.has(part.toLowerCase())) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function resolveFavoriteIndicatorItems(
  rawFavIds: string[],
  builtinCatalog: CatalogIndicatorLookupItem[],
  personalScripts: PersonalScriptLookupItem[] = [],
): ResolvedFavoriteIndicatorItem[] {
  if (!Array.isArray(rawFavIds) || rawFavIds.length === 0) return [];
  const safeCatalog = Array.isArray(builtinCatalog) ? builtinCatalog : [];
  const safePersonal = Array.isArray(personalScripts) ? personalScripts : [];

  const results: ResolvedFavoriteIndicatorItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawEntry of rawFavIds) {
    if (typeof rawEntry !== "string") continue;
    const trimmed = rawEntry.trim();
    if (!trimmed) continue;

    // Strip optional outer "slug:" wrapper added by VelaIndicatorsDialog when wrapping prefixed IDs
    const inner = trimmed.startsWith("slug:") ? trimmed.slice(5).trim() : trimmed;
    if (!inner) continue;

    if (inner.startsWith("native:")) {
      const targetId = inner.slice("native:".length).trim();
      if (!targetId) continue;
      const canonicalId = `native:${targetId}`;
      const dedupKey = `native:${targetId.toLowerCase()}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      const catalogMatch = safeCatalog.find(
        (c) =>
          c.id === canonicalId ||
          c.type === targetId ||
          c.slug === canonicalId ||
          c.slug === targetId,
      );
      const label = catalogMatch?.name || humanizeIndicatorSlug(targetId);

      results.push({
        id: canonicalId,
        kind: "native",
        targetId,
        label,
      });
      continue;
    }

    if (inner.startsWith("personal:")) {
      const scriptId = inner.slice("personal:".length).trim();
      if (!scriptId) continue;
      const canonicalId = `personal:${scriptId}`;
      const dedupKey = `personal:${scriptId}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      const personalMatch = safePersonal.find(
        (p) => p.id === scriptId || p.id === canonicalId,
      );
      const label =
        personalMatch?.name ||
        personalMatch?.title ||
        humanizeIndicatorSlug(scriptId);

      results.push({
        id: canonicalId,
        kind: "personal",
        targetId: scriptId,
        label,
        ...(personalMatch?.code ? { code: personalMatch.code } : {}),
      });
      continue;
    }

    // Built-in or catalog indicator slug ("builtin:sma-001", "slug:sma-001", or "sma-001")
    const targetId = inner.startsWith("builtin:")
      ? inner.slice("builtin:".length).trim()
      : inner;
    if (!targetId) continue;

    const dedupKey = `builtin:${targetId.toLowerCase()}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const catalogMatch = safeCatalog.find(
      (c) =>
        c.slug === targetId ||
        c.id === `builtin:${targetId}` ||
        c.id === targetId ||
        c.slug === `builtin:${targetId}`,
    );
    const label = catalogMatch?.name || humanizeIndicatorSlug(targetId);

    results.push({
      id: trimmed,
      kind: "builtin",
      targetId,
      label,
    });
  }

  return results;
}
