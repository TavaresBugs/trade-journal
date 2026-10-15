"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY, themePreference, type Theme } from "@/lib/theme";
import { syncGlobalColorTheme, syncVelaUiCssTokens, loadStoredSettings } from "./settings/vela-settings-bridge";
import { Button } from "./ui/button";

const ThemeContext = createContext({ theme: "dark" as Theme, ready: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const apply = (next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  };
  useEffect(() => {
    // Read the pre-paint result, including its storage-unavailable fallback.
    const initial = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(initial);
    setReady(true);
    try {
      const stored = loadStoredSettings();
      if (stored.canvas.colorTheme !== initial) {
        syncGlobalColorTheme(initial, { dispatchEvent: false });
      } else {
        syncVelaUiCssTokens(initial, stored);
      }
    } catch {}
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) {
        const next = themePreference(event.newValue);
        apply(next);
        syncGlobalColorTheme(next, { dispatchEvent: false });
        setError("");
      }
    };
    const onVelaThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme?: Theme }>;
      const next = custom.detail?.theme;
      if (next === "dark" || next === "light") {
        apply(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {}
        setError("");
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("vela-theme-change", onVelaThemeChange);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("vela-theme-change", onVelaThemeChange);
    };
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
      syncGlobalColorTheme(next);
      setError("");
    } catch {
      setError("Appearance changed, but your browser could not save it for next time.");
    }
  };
  return (
    <ThemeContext.Provider value={{ theme, ready, toggle }}>
      {children}
      {error && (
        <p
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-32px)] rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
        >
          {error}
        </p>
      )}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const { theme, ready, toggle } = useContext(ThemeContext);
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      className={
        iconOnly
          ? "h-9 w-9 shrink-0 rounded-lg"
          : "w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      }
      onClick={toggle}
      aria-label={label}
      title={iconOnly ? label : undefined}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {!iconOnly && (theme === "dark" ? "Light mode" : "Dark mode")}
    </Button>
  );
}
