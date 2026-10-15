"use client";

import { configureVelaSettingsAdapter } from "@luxalgo/vela/workspace";

export const VELA_SETTINGS_STORAGE_KEY = "tradejournal_vela_settings_v1";
export const THEME_STORAGE_KEY = "journal-theme-v1";
export const REPLAY_ACTIVE_STORAGE_KEY = "vela-pro.replay.active";
export const BUY_SELL_BUTTONS_STORAGE_KEY = "tradejournal_show_buysell_buttons";
export const LEGACY_BUY_SELL_BUTTONS_STORAGE_KEY = "vela_show_buy_sell_buttons";

let initialized = false;

export function ensureTradeJournalVelaSettingsAdapter(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  configureVelaSettingsAdapter({
    loadLocalSettings: () => {
      try {
        return window.localStorage.getItem(VELA_SETTINGS_STORAGE_KEY);
      } catch {
        return null;
      }
    },
    saveLocalSettings: (serialized: string) => {
      try {
        window.localStorage.setItem(VELA_SETTINGS_STORAGE_KEY, serialized);
      } catch {
        // Ignore storage write failures
      }
    },
    loadThemeMode: () => {
      try {
        const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
        return raw === "light" || raw === "dark" ? raw : null;
      } catch {
        return null;
      }
    },
    saveThemeMode: (theme: "dark" | "light") => {
      try {
        window.localStorage.setItem("theme", theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {}
    },
    isReplayActive: () => {
      try {
        return (
          window.sessionStorage.getItem(REPLAY_ACTIVE_STORAGE_KEY) === "1" ||
          window.localStorage.getItem(REPLAY_ACTIVE_STORAGE_KEY) === "1"
        );
      } catch {
        return false;
      }
    },
    fetchRemoteSettings: async () => {
      const res = await fetch("/api/settings", { method: "GET" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.velaChartSettings ?? null;
    },
    patchRemoteSettings: async (payload, options) => {
      const body = JSON.stringify({ velaChartSettings: payload });
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: Boolean(options?.keepalive && body.length < 50_000),
      });
    },
  });
}
