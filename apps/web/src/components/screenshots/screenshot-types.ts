export interface ScreenshotAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  slot: string | null;
}

export interface TimeframeConfig {
  key: string;
  label: string;
  description?: string;
}

/**
 * 8 standard multi-timeframe analysis slots (Monthly down to M3/M1).
 * Both Pre-Market and Post-Market (Executions) modes share the identical 4x2 slot grid.
 */
export const TIMEFRAME_CONFIG = [
  { key: "tfM", label: "Monthly", description: "Macro Context & Secular Trend" },
  { key: "tfW", label: "Weekly", description: "Weekly Structure & Major Zones" },
  { key: "tfD", label: "Daily", description: "Daily Bias & Directional Trend" },
  { key: "tfH4", label: "4H", description: "4H Structure & Liquidity Pools" },
  { key: "tfH1", label: "1H", description: "1H Intraday Structure" },
  { key: "tfM15", label: "15M", description: "Points of Interest & 15M Structure" },
  { key: "tfM5", label: "5M", description: "Operational Structure & Trigger" },
  { key: "tfM3", label: "M3/M1", description: "Refined Execution / Entry & Stop" },
] as const;

export type TimeframeKey = (typeof TIMEFRAME_CONFIG)[number]["key"];

/** Builds a scoped slot key combining session category ('pre' | 'post') and timeframe key. */
export function buildSlotKey(category: "pre" | "post", timeframeKey: string): string {
  return `${category}_${timeframeKey}`;
}

/** Parses the session category and timeframe key from a stored slot string. */
export function parseSlotKey(
  slot: string | null,
): { category: "pre" | "post"; timeframeKey: string } | null {
  if (!slot) return null;
  if (slot.startsWith("post_")) {
    return { category: "post", timeframeKey: slot.slice(5) };
  }
  if (slot.startsWith("pre_")) {
    return { category: "pre", timeframeKey: slot.slice(4) };
  }
  // Default prefix fallback (treated as pre-market)
  return { category: "pre", timeframeKey: slot };
}

/**
 * Extracts a valid image file from a DataTransfer payload (clipboard or drag-and-drop).
 * Prioritizes direct image MIME items, then files list, then file-kind items.
 */
export function extractImageFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) return null;

  // 1. Priority: clipboard items with image MIME type
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (!item) continue;
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }

  // 2. Second priority: files list with image MIME or graphic extension
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (!file) continue;
      if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
        return file;
      }
    }
  }

  // 3. Fallback: any item with kind === 'file'
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item && item.kind === "file") {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }

  return null;
}
