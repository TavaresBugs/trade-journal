"use client";

export const VELA_SETTINGS_STORAGE_KEY = "tradejournal_vela_settings_v1";

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
      zoom: false,
      pan: false,
      autoscale: false,
      priceChanges: false,
      intro: false,
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
    countdown: false,
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

export function loadStoredSettings(): StoredVelaSettings {
  if (typeof window === "undefined") return DEFAULT_VELA_SETTINGS;
  try {
    const raw = localStorage.getItem(VELA_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_VELA_SETTINGS,
        ...parsed,
        symbol: {
          ...DEFAULT_VELA_SETTINGS.symbol,
          ...parsed.symbol,
          candles: { ...DEFAULT_VELA_SETTINGS.symbol.candles, ...parsed.symbol?.candles },
          animations: { ...DEFAULT_VELA_SETTINGS.symbol.animations, ...parsed.symbol?.animations },
        },
        statusLine: { ...DEFAULT_VELA_SETTINGS.statusLine, ...parsed.statusLine },
        scalesAndLines: {
          ...DEFAULT_VELA_SETTINGS.scalesAndLines,
          ...parsed.scalesAndLines,
          crosshair: { ...DEFAULT_VELA_SETTINGS.scalesAndLines.crosshair, ...parsed.scalesAndLines?.crosshair },
        },
        canvas: {
          ...DEFAULT_VELA_SETTINGS.canvas,
          ...parsed.canvas,
          margins: { ...DEFAULT_VELA_SETTINGS.canvas.margins, ...parsed.canvas?.margins },
        },
        advanced: { ...DEFAULT_VELA_SETTINGS.advanced, ...parsed.advanced },
      };
    }
  } catch {}
  return DEFAULT_VELA_SETTINGS;
}

export function saveStoredSettings(settings: StoredVelaSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VELA_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function applyStoredSettingsToChart(
  chartInstance: any,
  statusline: any,
  watermark: any,
  settings: StoredVelaSettings
): void {
  if (!chartInstance) return;

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
        paneSeparatorColor: settings.canvas.paneSeparatorColor ?? "#2a2b30",
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
        countdown: settings.scalesAndLines.countdown,
        borderColor: settings.scalesAndLines.scaleBorderColor ?? "#2a2b30",
      },
      animations: {
        zoom: settings.symbol.animations.zoom,
        pan: settings.symbol.animations.pan,
        autoscale: settings.symbol.animations.autoscale,
        intro: settings.symbol.animations.intro,
      },
      timeScale: {
        timezone: settings.symbol.timezone,
      },
    });
  } catch {}

  // 2. Behavioral features via renderer.set
  try {
    const r = chartInstance.renderer;
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
      r.set?.("countdown", settings.scalesAndLines.countdown);
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
