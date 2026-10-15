import type { VelaSettingsStorageAdapter } from "./types";

export const DEFAULT_VELA_SETTINGS_STORAGE_KEY = "vela_workspace_settings_v1";
export const VELA_SETTINGS_STORAGE_KEY = DEFAULT_VELA_SETTINGS_STORAGE_KEY;

export interface StoredVelaSettings {
  version: 1;
  symbol: {
    priceStyle: string;
    candles: {
      bodyVisible: boolean;
      upColor: string;
      downColor: string;
      borderVisible: boolean;
      borderUpColor: string;
      borderDownColor: string;
      wickVisible: boolean;
      wickUpColor: string;
      wickDownColor: string;
      spacing: number;
    };
    animations: {
      zoom: boolean;
      pan: boolean;
      autoscale: boolean;
      priceChanges: boolean;
      intro: boolean;
    };
    sessions?: {
      mode: "regular" | "extended";
      premarketColor: string;
      postmarketColor: string;
    };
    timezone: string;
    symbolWatermark: boolean;
    replayWatermark: boolean;
  };
  statusLine: {
    symbol: boolean;
    meta: boolean;
    market: boolean;
    ohlc: boolean;
    change: boolean;
    indicatorTitles: boolean;
    indicatorValues: boolean;
  };
  scalesAndLines: {
    scaleMode: "regular" | "log" | "percent" | "indexed";
    invertScale: boolean;
    autoScale: boolean;
    axisLabels: boolean;
    currentPriceLine: boolean;
    priceLabel: boolean;
    countdown: boolean;
    scaleBorderColor: string;
    crosshair: {
      style: "dashed" | "dotted" | "solid";
      color: string;
      opacity: number;
      width: number;
    };
  };
  canvas: {
    background: string;
    textColor: string;
    fontSize: number;
    paneSeparatorColor: string;
    gridVertVisible: boolean;
    gridVertColor: string;
    gridHorzVisible: boolean;
    gridHorzColor: string;
    margins: {
      top: number;
      bottom: number;
      right: number;
    };
    colorTheme?: "dark" | "light";
  };
  advanced: {
    barsToFetch: number;
    tradeContextPadding: number;
    axisDrag?: boolean;
    paneResize?: boolean;
    drawingsInteractive?: boolean;
    zoomAnchor?: "cursor" | "right";
  };
}

export const DEFAULT_VELA_SETTINGS: StoredVelaSettings = {
  version: 1,
  symbol: {
    priceStyle: "candles",
    candles: {
      bodyVisible: true,
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: false,
      borderUpColor: "#089981",
      borderDownColor: "#f23645",
      wickVisible: true,
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
      spacing: 1,
    },
    animations: {
      zoom: true,
      pan: true,
      autoscale: true,
      priceChanges: false,
      intro: true,
    },
    sessions: {
      mode: "extended",
      premarketColor: "#ff980040",
      postmarketColor: "#2962ff40",
    },
    timezone: "Etc/UTC",
    symbolWatermark: false,
    replayWatermark: false,
  },
  statusLine: {
    symbol: true,
    meta: true,
    market: true,
    ohlc: true,
    change: true,
    indicatorTitles: true,
    indicatorValues: true,
  },
  scalesAndLines: {
    scaleMode: "regular",
    invertScale: false,
    autoScale: true,
    axisLabels: true,
    currentPriceLine: true,
    priceLabel: true,
    countdown: true,
    scaleBorderColor: "#2a2b30",
    crosshair: {
      style: "dashed",
      color: "#758696",
      opacity: 0.6,
      width: 1,
    },
  },
  canvas: {
    background: "#151619",
    textColor: "#d1d4dc",
    fontSize: 11,
    paneSeparatorColor: "#2a2b30",
    gridVertVisible: true,
    gridVertColor: "#1e222d",
    gridHorzVisible: true,
    gridHorzColor: "#1e222d",
    margins: {
      top: 10,
      bottom: 10,
      right: 5,
    },
    colorTheme: "dark",
  },
  advanced: {
    barsToFetch: 5000,
    tradeContextPadding: 25,
    axisDrag: true,
    paneResize: true,
    drawingsInteractive: true,
    zoomAnchor: "cursor",
  },
};

export function toHexColor(color: string | null | undefined, fallback = "#089981"): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed.slice(0, 7);
  }
  const rgbMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))).toString(16).padStart(2, "0");
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))).toString(16).padStart(2, "0");
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return fallback;
}

export function mapSettingsSectionToTab(section?: string): string {
  if (!section) return "symbol";
  const s = section.trim().toLowerCase();
  if (s === "canvas") return "canvas";
  if (s === "scales and lines" || s.includes("scale")) return "scales-and-lines";
  if (s === "status line" || s.includes("status")) return "status-line";
  if (s === "symbol") return "symbol";
  if (
    s === "data" ||
    s === "data-source" ||
    s === "advanced" ||
    s.includes("fonte") ||
    s.includes("data")
  )
    return "data";
  return "symbol";
}

function getSettingsStorage(): Storage | null {
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

const defaultStorageAdapter: VelaSettingsStorageAdapter = {
  loadLocalSettings: () => {
    const storage = getSettingsStorage();
    return storage?.getItem(DEFAULT_VELA_SETTINGS_STORAGE_KEY) ?? null;
  },
  saveLocalSettings: (serialized: string) => {
    const storage = getSettingsStorage();
    try {
      storage?.setItem(DEFAULT_VELA_SETTINGS_STORAGE_KEY, serialized);
    } catch {}
  },
  loadThemeMode: () => {
    const storage = getSettingsStorage();
    const raw = storage?.getItem("theme");
    return raw === "light" || raw === "dark" ? raw : null;
  },
  saveThemeMode: (theme) => {
    const storage = getSettingsStorage();
    try {
      storage?.setItem("theme", theme);
    } catch {}
  },
  isReplayActive: () => false,
};

let activeAdapter: VelaSettingsStorageAdapter = defaultStorageAdapter;

export function configureVelaSettingsAdapter(
  adapter: Partial<VelaSettingsStorageAdapter>
): void {
  activeAdapter = {
    ...defaultStorageAdapter,
    ...adapter,
  };
}

let pendingSettingsSyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettingsPayload: StoredVelaSettings | null = null;

export function scheduleRemoteVelaSettingsSave(
  settings: StoredVelaSettings,
  debounceMs = 350
): void {
  pendingSettingsPayload = settings;
  if (!activeAdapter.patchRemoteSettings) return;

  if (pendingSettingsSyncTimer) {
    clearTimeout(pendingSettingsSyncTimer);
  }
  pendingSettingsSyncTimer = setTimeout(() => {
    pendingSettingsSyncTimer = null;
    const payload = pendingSettingsPayload;
    pendingSettingsPayload = null;
    if (!payload || !activeAdapter.patchRemoteSettings) return;
    void activeAdapter.patchRemoteSettings(payload as any).catch(() => {});
  }, debounceMs);
}

export function flushPendingVelaSettingsSave(): void {
  if (pendingSettingsSyncTimer) {
    clearTimeout(pendingSettingsSyncTimer);
    pendingSettingsSyncTimer = null;
  }
  if (!pendingSettingsPayload || !activeAdapter.patchRemoteSettings) return;
  const payload = pendingSettingsPayload;
  pendingSettingsPayload = null;
  void activeAdapter
    .patchRemoteSettings(payload as any, { keepalive: true })
    .catch(() => {});
}

export function loadStoredSettings(): StoredVelaSettings {
  try {
    const raw = activeAdapter.loadLocalSettings();
    if (raw) {
      const parsed = JSON.parse(raw);
      const isLegacyAnim = !parsed._animMigratedV2;
      const isLegacyCountdown = !parsed._countdownMigratedV1;
      const storedAnim = parsed.symbol?.animations;
      const animations = {
        ...DEFAULT_VELA_SETTINGS.symbol.animations,
        ...storedAnim,
      };
      if (isLegacyAnim) {
        animations.zoom = true;
        animations.pan = true;
        animations.autoscale = true;
        animations.intro = true;
      }
      const countdown = isLegacyCountdown
        ? true
        : (parsed.scalesAndLines?.countdown ?? DEFAULT_VELA_SETTINGS.scalesAndLines.countdown);
      const upgraded: StoredVelaSettings = {
        ...DEFAULT_VELA_SETTINGS,
        ...parsed,
        symbol: {
          ...DEFAULT_VELA_SETTINGS.symbol,
          ...parsed.symbol,
          candles: { ...DEFAULT_VELA_SETTINGS.symbol.candles, ...parsed.symbol?.candles },
          animations,
          sessions: { ...DEFAULT_VELA_SETTINGS.symbol.sessions!, ...parsed.symbol?.sessions },
        },
        statusLine: { ...DEFAULT_VELA_SETTINGS.statusLine, ...parsed.statusLine },
        scalesAndLines: {
          ...DEFAULT_VELA_SETTINGS.scalesAndLines,
          ...parsed.scalesAndLines,
          countdown,
          crosshair: { ...DEFAULT_VELA_SETTINGS.scalesAndLines.crosshair, ...parsed.scalesAndLines?.crosshair },
        },
        canvas: {
          ...DEFAULT_VELA_SETTINGS.canvas,
          ...parsed.canvas,
          margins: { ...DEFAULT_VELA_SETTINGS.canvas.margins, ...parsed.canvas?.margins },
        },
        advanced: { ...DEFAULT_VELA_SETTINGS.advanced, ...parsed.advanced },
      };
      if (isLegacyAnim || isLegacyCountdown) {
        try {
          activeAdapter.saveLocalSettings(
            JSON.stringify({ ...upgraded, _animMigratedV2: true, _countdownMigratedV1: true })
          );
        } catch {}
      }
      return upgraded;
    }
  } catch {}
  return DEFAULT_VELA_SETTINGS;
}

export const loadStoredVelaSettings = loadStoredSettings;

export function saveStoredSettings(settings: StoredVelaSettings): void {
  try {
    activeAdapter.saveLocalSettings(JSON.stringify(settings));
  } catch {}
  scheduleRemoteVelaSettingsSave(settings, 350);
}

export const saveStoredVelaSettings = saveStoredSettings;

export async function hydrateVelaSettingsFromRemote(
  onUpdated?: (settings: StoredVelaSettings) => void
): Promise<StoredVelaSettings | null> {
  const existingRaw = activeAdapter.loadLocalSettings();
  if (existingRaw) return null;
  if (!activeAdapter.fetchRemoteSettings) return null;

  try {
    const remoteSettings = await activeAdapter.fetchRemoteSettings();
    if (
      remoteSettings &&
      typeof remoteSettings === "object" &&
      !Array.isArray(remoteSettings)
    ) {
      if (!activeAdapter.loadLocalSettings()) {
        activeAdapter.saveLocalSettings(JSON.stringify(remoteSettings));
        const hydrated = loadStoredSettings();
        try {
          onUpdated?.(hydrated);
        } catch {}
        return hydrated;
      }
    }
  } catch {}
  return null;
}

export const VELA_DARK_CANVAS_DEFAULTS = {
  background: "#151619",
  textColor: "#d1d4dc",
  paneSeparatorColor: "#2a2b30",
  gridVertColor: "#1e222d",
  gridHorzColor: "#1e222d",
  scaleBorderColor: "#2a2b30",
} as const;

export const VELA_LIGHT_CANVAS_DEFAULTS = {
  background: "#ffffff",
  textColor: "#1e293b",
  paneSeparatorColor: "#d4dae3",
  gridVertColor: "#cccccc",
  gridHorzColor: "#cccccc",
  scaleBorderColor: "#d4dae3",
} as const;

export function applyColorThemeToSettings(
  settings: StoredVelaSettings,
  theme: "dark" | "light"
): StoredVelaSettings {
  const palette = theme === "light" ? VELA_LIGHT_CANVAS_DEFAULTS : VELA_DARK_CANVAS_DEFAULTS;
  return {
    ...settings,
    scalesAndLines: {
      ...settings.scalesAndLines,
      scaleBorderColor: palette.scaleBorderColor,
    },
    canvas: {
      ...settings.canvas,
      colorTheme: theme,
      background: palette.background,
      textColor: palette.textColor,
      paneSeparatorColor: palette.paneSeparatorColor,
      gridVertColor: palette.gridVertColor,
      gridHorzColor: palette.gridHorzColor,
    },
  };
}

export function syncVelaUiCssTokens(
  theme: "dark" | "light",
  settings?: StoredVelaSettings
): void {
  if (typeof document === "undefined") return;
  const isLight = theme === "light";
  const bg = settings?.canvas?.background || (isLight ? "#ffffff" : "#151619");
  const fg = settings?.canvas?.textColor || (isLight ? "#1e293b" : "#d1d4dc");
  const border = settings?.canvas?.paneSeparatorColor || (isLight ? "#d4dae3" : "#2a2b30");

  const tokens: Record<string, string> = isLight
    ? {
        "--vela-bg": bg,
        "--vela-fg": fg,
        "--vela-fg-muted": "rgba(30, 41, 59, 0.62)",
        "--vela-fg-faint": "rgba(30, 41, 59, 0.35)",
        "--vela-fg-bright": "#0f172a",
        "--vela-surface": bg,
        "--vela-surface-elev": "#f1f5f9",
        "--vela-surface-overlay": "#f1f5f9",
        "--vela-surface-sunken": bg,
        "--vela-border": border,
        "--vela-border-strong": "#cbd5e1",
        "--vela-border-soft": border,
        "--vela-border-faint": "rgba(30, 41, 59, 0.08)",
        "--vela-hover": "rgba(30, 41, 59, 0.06)",
        "--vela-active": "rgba(30, 41, 59, 0.1)",
        "--vela-hover-strong": "rgba(30, 41, 59, 0.14)",
        "--vela-focus": "rgba(30, 41, 59, 0.5)",
        "--vela-focus-soft": "rgba(30, 41, 59, 0.12)",
        "--vela-separator-hover-band": "rgba(30, 41, 59, 0.1)",
        "--vela-separator-hover-line": "rgba(30, 41, 59, 0.55)",
        "--vela-scroll": "rgba(30, 41, 59, 0.3)",
        "--vela-selected-bg": "#1e293b",
        "--vela-selected-fg": "#ffffff",
        "--vela-shadow": "0 8px 30px rgba(15, 23, 42, 0.14)",
        "--vela-shadow-dialog": "0 20px 60px rgba(15, 23, 42, 0.18)",
        "--vela-backdrop": "rgba(15, 23, 42, 0.35)",
      }
    : {
        "--vela-bg": bg,
        "--vela-fg": fg,
        "--vela-fg-muted": "#868a96",
        "--vela-fg-faint": "rgba(178, 181, 190, 0.35)",
        "--vela-fg-bright": "#f0f3fa",
        "--vela-surface": bg,
        "--vela-surface-elev": "rgb(28, 29, 32)",
        "--vela-surface-overlay": "rgb(28, 29, 32)",
        "--vela-surface-sunken": bg,
        "--vela-border": border,
        "--vela-border-strong": "#34353b",
        "--vela-border-soft": border,
        "--vela-border-faint": "rgba(178, 181, 190, 0.08)",
        "--vela-hover": "rgba(255, 255, 255, 0.06)",
        "--vela-active": "rgba(255, 255, 255, 0.1)",
        "--vela-hover-strong": "rgba(255, 255, 255, 0.16)",
        "--vela-focus": "rgba(178, 181, 190, 0.5)",
        "--vela-focus-soft": "rgba(178, 181, 190, 0.12)",
        "--vela-separator-hover-band": "rgba(178, 181, 190, 0.1)",
        "--vela-separator-hover-line": "rgba(178, 181, 190, 0.55)",
        "--vela-scroll": "rgba(178, 181, 190, 0.3)",
        "--vela-selected-bg": "#f0f3fa",
        "--vela-selected-fg": "#151619",
        "--vela-shadow": "0 8px 30px rgba(0, 0, 0, 0.5)",
        "--vela-shadow-dialog": "0 20px 60px rgba(0, 0, 0, 0.5)",
        "--vela-backdrop": "rgba(0, 0, 0, 0.45)",
      };

  const targets: HTMLElement[] = [
    document.documentElement,
    ...Array.from(
      document.querySelectorAll<HTMLElement>(
        ".vela-ui-layer, .vela-topbar, .vela-bottombar, .vela-ui:not(.vela-chart-chrome-replay)"
      )
    ),
  ];

  for (const el of targets) {
    for (const [key, val] of Object.entries(tokens)) {
      el.style.setProperty(key, val);
    }
  }
}

export function syncGlobalColorTheme(
  theme: "dark" | "light",
  options?: { dispatchEvent?: boolean; precomputedSettings?: StoredVelaSettings }
): StoredVelaSettings {
  const updated =
    options?.precomputedSettings ?? applyColorThemeToSettings(loadStoredSettings(), theme);
  saveStoredSettings(updated);

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
    syncVelaUiCssTokens(theme, updated);
  }
  if (typeof window !== "undefined") {
    try {
      if (typeof activeAdapter.saveThemeMode === "function") {
        activeAdapter.saveThemeMode(theme);
      } else {
        localStorage.setItem("theme", theme);
      }
    } catch {}
    if (options?.dispatchEvent !== false) {
      window.dispatchEvent(
        new CustomEvent("vela-theme-change", { detail: { theme, settings: updated } })
      );
    }
  }
  return updated;
}

export function applyStoredSettingsToChart(
  chartInstance: any,
  statusline: any,
  watermark: any,
  settings: StoredVelaSettings
): void {
  if (!chartInstance) return;

  const isLight = settings.canvas.colorTheme === "light";
  const themeObj = {
    background: settings.canvas.background || (isLight ? "#ffffff" : "#151619"),
    textColor: settings.canvas.textColor || (isLight ? "#1e293b" : "#b2b5be"),
    gridColor: settings.canvas.gridVertColor || (isLight ? "#cccccc" : "#20222c"),
    borderColor: settings.canvas.paneSeparatorColor || (isLight ? "#d4dae3" : "#2a2b30"),
    upColor: settings.symbol.candles.upColor || "#089981",
    downColor: settings.symbol.candles.downColor || "#f23645",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };

  try {
    if (typeof chartInstance.setTheme === "function") {
      chartInstance.setTheme(themeObj);
    } else if (typeof chartInstance.applyTheme === "function") {
      chartInstance.applyTheme(themeObj);
    } else {
      chartInstance.renderer?.applyTheme?.(themeObj);
    }
  } catch {}

  try {
    syncVelaUiCssTokens(isLight ? "light" : "dark", settings);
  } catch {}

  const isReplaySession = activeAdapter.isReplayActive?.() ?? false;
  const effectiveCountdown = isReplaySession ? false : settings.scalesAndLines.countdown;

  // 1. Cosmetic applyConfig
  try {
    chartInstance.renderer?.applyConfig?.({
      candles: {
        bodyVisible: settings.symbol.candles.bodyVisible,
        upColor: settings.symbol.candles.upColor,
        downColor: settings.symbol.candles.downColor,
        borderVisible: settings.symbol.candles.borderVisible,
        borderUpColor: settings.symbol.candles.borderUpColor,
        borderDownColor: settings.symbol.candles.borderDownColor,
        wickVisible: settings.symbol.candles.wickVisible,
        wickUpColor: settings.symbol.candles.wickUpColor,
        wickDownColor: settings.symbol.candles.wickDownColor,
      },
      series: {
        style: settings.symbol.priceStyle,
        spacing: settings.symbol.candles.spacing,
      },
      grid: {
        vertLines: {
          visible: settings.canvas.gridVertVisible,
          color: settings.canvas.gridVertColor,
        },
        horzLines: {
          visible: settings.canvas.gridHorzVisible,
          color: settings.canvas.gridHorzColor,
        },
      },
      layout: {
        background: settings.canvas.background,
        textColor: settings.canvas.textColor,
        fontSize: settings.canvas.fontSize,
        paneSeparatorColor: settings.canvas.paneSeparatorColor ?? (isLight ? "#d4dae3" : "#2a2b30"),
      },
      crosshair: {
        style: settings.scalesAndLines.crosshair.style,
        color: settings.scalesAndLines.crosshair.color,
        opacity: settings.scalesAndLines.crosshair.opacity,
        width: settings.scalesAndLines.crosshair.width,
      },
      margins: settings.canvas.margins,
      priceScale: {
        mode: settings.scalesAndLines.scaleMode === "regular" ? "price" : settings.scalesAndLines.scaleMode,
        log: settings.scalesAndLines.scaleMode === "log",
        invert: settings.scalesAndLines.invertScale,
        labelsVisible: settings.scalesAndLines.axisLabels,
        currentPriceLine: settings.scalesAndLines.currentPriceLine,
        priceLabel: settings.scalesAndLines.priceLabel,
        countdown: effectiveCountdown,
        borderColor: settings.scalesAndLines.scaleBorderColor ?? (isLight ? "#d4dae3" : "#2a2b30"),
      },
      animations: {
        zoom: settings.symbol.animations.zoom,
        pan: settings.symbol.animations.pan,
        autoscale: settings.symbol.animations.autoscale,
        intro: settings.symbol.animations.intro,
      },
      sessions: {
        premarketColor: settings.symbol.sessions?.premarketColor ?? "#ff980040",
        postmarketColor: settings.symbol.sessions?.postmarketColor ?? "#2962ff40",
      },
      timeScale: {
        timezone: settings.symbol.timezone,
      },
    });
  } catch {}

  // 2. Behavioral features via renderer.set
  try {
    const r = chartInstance.renderer;
    const inner = r?.renderer && r.renderer !== r ? r.renderer : r;
    if (r) {
      if (settings.symbol.priceStyle) r.set?.("priceStyle", settings.symbol.priceStyle);
      if (settings.symbol.timezone) r.set?.("timezone", settings.symbol.timezone);
      r.set?.("autoScale", settings.scalesAndLines.autoScale);
      r.set?.("logScale", settings.scalesAndLines.scaleMode === "log");
      if (settings.scalesAndLines.scaleMode !== "log") {
        r.set?.("scaleMode", settings.scalesAndLines.scaleMode);
      }
      r.set?.("invertScale", settings.scalesAndLines.invertScale);
      r.set?.("axisLabels", settings.scalesAndLines.axisLabels);
      r.set?.("currentPriceLine", settings.scalesAndLines.currentPriceLine);
      r.set?.("priceLabel", settings.scalesAndLines.priceLabel);
      r.set?.("countdown", effectiveCountdown);
      r.set?.("animZoom", settings.symbol.animations.zoom);
      r.set?.("animPan", settings.symbol.animations.pan);
      r.set?.("animAutoscale", settings.symbol.animations.autoscale);
      r.set?.("animLiveBar", settings.symbol.animations.priceChanges);
      r.set?.("intro", settings.symbol.animations.intro);
      r.set?.("axisDrag", settings.advanced.axisDrag);
      r.set?.("paneResize", settings.advanced.paneResize);
      r.set?.("zoomAnchor", settings.advanced.zoomAnchor);
      r.set?.("indicatorTitles", settings.statusLine.indicatorTitles);
      r.set?.("indicatorValues", settings.statusLine.indicatorValues);
    }
    if (inner && inner !== r) {
      inner.set?.("countdown", effectiveCountdown);
      if (inner.scene) {
        inner.scene.showCountdown = effectiveCountdown;
        inner.syncCountdownTimer?.();
      }
      inner.scheduler?.invalidate?.(2);
    }
  } catch {}

  // 3. Statusline parts
  if (statusline) {
    try {
      statusline.setPartVisible?.("name", settings.statusLine.symbol);
      statusline.setPartVisible?.("symbol", settings.statusLine.symbol);
      statusline.setPartVisible?.("market", settings.statusLine.market);
      statusline.setPartVisible?.("ohlc", settings.statusLine.ohlc);
      statusline.setPartVisible?.("change", settings.statusLine.change);
      if ((statusline as any).metaEl) {
        (statusline as any).metaEl.style.display = settings.statusLine.meta ? "" : "none";
      }
    } catch {}
  }

  // 4. Watermarks
  if (watermark) {
    try {
      watermark.setVisible?.(settings.symbol.symbolWatermark);
      watermark.setReplayVisible?.(settings.symbol.replayWatermark);
    } catch {}
  }
}

/**
 * Intercepta de forma limpa qualquer tentativa do renderer ou context-menu nativo
 * de abrir o settingsDialog vanilla, redirecionando para o <VelaSettingsDialog /> em React.
 */
export function bindExternalSettingsDialog(
  instance: any,
  onOpenSettings: (section?: string) => void,
): void {
  const patchRenderer = (r: any) => {
    if (!r) return;
    r.openSettings = (section?: string) => {
      onOpenSettings(section);
      return r;
    };
    r.openSettingsDialog = (section?: string) => {
      onOpenSettings(section);
      return r;
    };
    r.toggleSettingsDialog = (section?: string) => {
      onOpenSettings(section);
      return r;
    };
    r.setSettingsEnabled = () => {};
    r.settingsEnabled = false;
    try {
      r.settingsButton?.remove?.();
      r.settingsDialog?.close?.();
      r.settingsDialog?.destroy?.();
      r.settingsDialog = null;
    } catch {}
    if (r.renderer && r.renderer !== r) {
      patchRenderer(r.renderer);
    }
  };

  patchRenderer(instance?.renderer ?? instance);
}
