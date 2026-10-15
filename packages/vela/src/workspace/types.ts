import type { Vela } from "../index";

export type WorkspaceLayoutId = "1x1" | "1x2" | "2x1" | "2x2" | "1+2" | "3x1";

export interface MountedIndicatorConfig {
  slug: string;
  name?: string;
  code?: string;
  inputs?: Record<string, unknown>;
  visible?: boolean;
  paneIndex?: number;
}

export interface AugmentedVelaRenderer {
  offClick?: (cb: (event: any) => void) => void;
  cursorCanvas?: HTMLCanvasElement | null;
  crosshairLayer?: HTMLElement | null;
  openSettings?: (section?: string) => void;
  openSettingsDialog?: (section?: string) => void;
  toggleSettingsDialog?: (section?: string) => void;
  set?: (key: string, value: unknown) => void;
  resetView?: () => void;
  applyViewport?: (vp: any) => void;
  coords?: {
    getViewport?: () => any;
  };
}

/**
 * Strict typing for Vela instances enriched by the Workspace lifecycle,
 * eliminating unsafe `(instance as any)` casts across hooks and persistence.
 */
export interface AugmentedVelaInstance extends Vela {
  __symbol?: string;
  __resolution?: string;
  __renderedResolution?: string;
  __lastBar?: any;
  __statusline?: any;
  __watermark?: any;
  __rebindDrawingsPersistence?: (nextSymbol: string) => void;
  __cleanupListeners?: () => void;
  renderer: Vela["renderer"] & AugmentedVelaRenderer;
}

export interface VelaSettingsStorageAdapter {
  loadLocalSettings: () => string | null;
  saveLocalSettings: (serialized: string) => void;
  loadThemeMode?: () => "dark" | "light" | null;
  saveThemeMode?: (theme: "dark" | "light") => void;
  isReplayActive?: () => boolean;
  fetchRemoteSettings?: () => Promise<Record<string, unknown> | null>;
  patchRemoteSettings?: (
    payload: Record<string, unknown>,
    options?: { keepalive?: boolean }
  ) => Promise<void>;
}
