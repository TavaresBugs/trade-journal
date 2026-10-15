export type Resolution =
  | "1m"
  | "2m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "3h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1mo";

export interface MarketBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Converts standard internal resolution (e.g. "1m", "1h", "1d") into Vela timeframe format ("1", "60", "D").
 */
export function toVelaTf(res: Resolution | string): string {
  const canonical = fromVelaTf(res) ?? res;
  const map: Record<string, string> = {
    "1m": "1",
    "2m": "2",
    "3m": "3",
    "5m": "5",
    "10m": "10",
    "15m": "15",
    "30m": "30",
    "45m": "45",
    "1h": "60",
    "2h": "120",
    "3h": "180",
    "4h": "240",
    "6h": "360",
    "8h": "480",
    "12h": "720",
    "1d": "D",
    "3d": "3D",
    "1w": "W",
    "1mo": "M",
  };
  return map[canonical] ?? map[res] ?? res;
}

/**
 * Converts Vela timeframe format into standard internal resolution.
 */
export function fromVelaTf(tf: string): Resolution | undefined {
  const map: Record<string, Resolution> = {
    "1": "1m",
    "1m": "1m",
    "2": "2m",
    "2m": "2m",
    "3": "3m",
    "3m": "3m",
    "5": "5m",
    "5m": "5m",
    "10": "10m",
    "10m": "10m",
    "15": "15m",
    "15m": "15m",
    "30": "30m",
    "30m": "30m",
    "45": "45m",
    "45m": "45m",
    "60": "1h",
    "1h": "1h",
    "1H": "1h",
    "120": "2h",
    "2h": "2h",
    "2H": "2h",
    "180": "3h",
    "3h": "3h",
    "3H": "3h",
    "240": "4h",
    "4h": "4h",
    "4H": "4h",
    "360": "6h",
    "6h": "6h",
    "6H": "6h",
    "480": "8h",
    "8h": "8h",
    "8H": "8h",
    "720": "12h",
    "12h": "12h",
    "12H": "12h",
    "1D": "1d",
    "1d": "1d",
    D: "1d",
    "3D": "3d",
    "3d": "3d",
    "1W": "1w",
    "1w": "1w",
    W: "1w",
    "1M": "1mo",
    "1mo": "1mo",
    M: "1mo",
  };
  return map[tf];
}

/**
 * Converts internal resolution into uppercase human-friendly display label (e.g. "1H", "4H", "1D").
 */
export function toDisplayTf(res: Resolution | string): string {
  const canonical = fromVelaTf(res) ?? res;
  const map: Record<string, string> = {
    "1m": "1m",
    "2m": "2m",
    "3m": "3m",
    "5m": "5m",
    "10m": "10m",
    "15m": "15m",
    "30m": "30m",
    "45m": "45m",
    "1h": "1H",
    "1H": "1H",
    "2h": "2H",
    "2H": "2H",
    "3h": "3H",
    "3H": "3H",
    "4h": "4H",
    "4H": "4H",
    "6h": "6H",
    "6H": "6H",
    "8h": "8H",
    "8H": "8H",
    "12h": "12H",
    "12H": "12H",
    "1d": "1D",
    "3d": "3D",
    "1w": "1W",
    "1mo": "1M",
  };
  return map[canonical] ?? map[res] ?? res;
}

/**
 * Resolves timeframe duration step in milliseconds.
 */
export function resolutionToStepMs(res?: string): number {
  if (!res) return 60_000;
  const canonical = fromVelaTf(res) ?? (res as Resolution);
  const map: Record<string, number> = {
    "1m": 60_000,
    "2m": 120_000,
    "3m": 180_000,
    "5m": 300_000,
    "10m": 600_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "45m": 2_700_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "3h": 10_800_000,
    "4h": 14_400_000,
    "6h": 21_600_000,
    "8h": 28_800_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
    "3d": 259_200_000,
    "1w": 604_800_000,
    "1mo": 2_592_000_000,
  };
  return map[canonical] ?? 60_000;
}

/**
 * Checks whether two resolution strings match (e.g. "60" and "1h").
 */
export function matchResolution(resA?: string, resB?: string): boolean {
  if (!resA || !resB) return false;
  const canA = fromVelaTf(resA) ?? resA;
  const canB = fromVelaTf(resB) ?? resB;
  return canA === canB || resolutionToStepMs(canA) === resolutionToStepMs(canB);
}

/**
 * Normalizes timezone string to ensure standard IANA identifiers.
 */
export function normalizeChartTimezone(tz?: string | null): string {
  return !tz || tz === "UTC" || tz === "Etc/GMT" ? "Etc/UTC" : tz;
}

/**
 * Imperatively synchronizes Statusline and Watermark widgets for a chart instance.
 */
export function syncStatuslineAndWatermark(
  statusline: any,
  watermark: any,
  sym: string,
  res: Resolution | string,
  provider = "Market",
  barsList?: MarketBar[],
  marketStatus: "open" | "closed" = "closed",
  chartInst?: any,
): void {
  const velaTf = toVelaTf(res);
  const lastBar = barsList && barsList.length > 0 ? barsList[barsList.length - 1] : undefined;
  if (chartInst) {
    chartInst.__symbol = sym;
    chartInst.__resolution = res;
    if (lastBar) chartInst.__lastBar = lastBar;
  }
  if (statusline) {
    try {
      statusline.setSymbol?.(sym);
      statusline.setMeta?.(velaTf, provider);
      statusline.setMarketStatus?.(marketStatus);
      if (statusline.metaEl && typeof statusline.metaEl.textContent === "string") {
        statusline.metaEl.textContent = statusline.metaEl.textContent.replace(/\b(\d+)h\b/g, "$1H");
        statusline.fit?.();
      }
      if (lastBar) {
        statusline.lastBar = lastBar;
        statusline.render?.();
        statusline.setValues?.({
          open: lastBar.open,
          high: lastBar.high,
          low: lastBar.low,
          close: lastBar.close,
          change: lastBar.close - lastBar.open,
          changePercent:
            lastBar.open !== 0
              ? ((lastBar.close - lastBar.open) / lastBar.open) * 100
              : 0,
          volume: lastBar.volume,
        });
      }
    } catch {}
  }
  if (watermark) {
    try {
      watermark.setSymbol?.(sym);
      watermark.setInterval?.(toDisplayTf(res));
      watermark.update?.(sym, velaTf);
      if (watermark.text && typeof watermark.text.textContent === "string") {
        watermark.text.textContent = watermark.text.textContent.replace(/\b(\d+)h\b/g, "$1H");
        watermark.fit?.();
      }
      watermark.setLoading?.(false);
      watermark.sync?.();
    } catch {}
  }
}
