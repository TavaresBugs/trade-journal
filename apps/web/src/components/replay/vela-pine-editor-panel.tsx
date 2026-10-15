"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  savePersonalPineScripts,
  saveFavoriteIndicators,
} from "@/lib/replay/workspace-persistence";

export interface LogEntry {
  id: string;
  time: string;
  severity: "ok" | "error" | "warning";
  message: string;
  line?: number;
}

interface VelaPineEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRunScript: (code: string, title: string) => Promise<{ success: boolean; error?: string }>;
}

const DEFAULT_SCRIPT = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
//@version=6
indicator("My script", overlay = true)
`;

export interface SavedPineScript {
  id: string;
  title: string;
  code: string;
  updatedAt: number;
}

export interface SessionHistoryItem {
  id: string;
  time: string;
  title: string;
  code: string;
  linesCount: number;
}

const SAVED_SCRIPTS_KEY = "tradejournal_saved_pine_scripts_v1";

export function VelaPineEditorPanel({
  isOpen,
  onClose,
  onRunScript,
}: VelaPineEditorPanelProps) {
  const [code, setCode] = useState<string>(DEFAULT_SCRIPT);
  const [scriptTitle, setScriptTitle] = useState<string>("My script");
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [panelWidth, setPanelWidth] = useState<number>(800);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [savedScripts, setSavedScripts] = useState<SavedPineScript[]>([]);
  const [activeScriptId, setActiveScriptId] = useState<string>("script_default");
  const [isNameMenuOpen, setIsNameMenuOpen] = useState<boolean>(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState<boolean>(false);
  const [isKebabMenuOpen, setIsKebabMenuOpen] = useState<boolean>(false);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameInput, setRenameInput] = useState<string>("My script");
  const [historyList, setHistoryList] = useState<SessionHistoryItem[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isResizingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(800);

  // Load saved scripts on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_SCRIPTS_KEY);
      if (raw) {
        const parsed: SavedPineScript[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
          setSavedScripts(parsed);
          const first = parsed[0];
          setActiveScriptId(first.id);
          setScriptTitle(first.title);
          setRenameInput(first.title);
          setCode(first.code);
          return;
        }
      }
      const initial: SavedPineScript = {
        id: "script_default",
        title: "My script",
        code: DEFAULT_SCRIPT,
        updatedAt: Date.now(),
      };
      setSavedScripts([initial]);
      localStorage.setItem(SAVED_SCRIPTS_KEY, JSON.stringify([initial]));
    } catch {}
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!isNameMenuOpen && !isHistoryMenuOpen && !isKebabMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".vela-pro-editor-name-container") &&
        !target.closest(".vela-pro-editor-history-container") &&
        !target.closest(".vela-pro-editor-kebab-container")
      ) {
        setIsNameMenuOpen(false);
        setIsHistoryMenuOpen(false);
        setIsKebabMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [isNameMenuOpen, isHistoryMenuOpen, isKebabMenuOpen]);

  // Resize handling via left-edge handle
  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const delta = startXRef.current - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, 400), 1200);
      setPanelWidth(newWidth);
    };

    const onPointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard shortcut inside textarea (Tab -> 4 spaces)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextCode = code.substring(0, start) + "    " + code.substring(end);
      setCode(nextCode);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleRun();
    }
  };

  const recordHistory = useCallback((title: string, currentCode: string) => {
    const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false });
    const item: SessionHistoryItem = {
      id: String(Date.now()),
      time: nowTime,
      title,
      code: currentCode,
      linesCount: currentCode.split("\n").length,
    };
    setHistoryList((prev) => [item, ...prev.slice(0, 19)]);
  }, []);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });

    try {
      // Extract title from indicator("...", ...) or indicator(title = "...", ...)
      const titleMatch = code.match(/indicator\s*\(\s*(?:title\s*=\s*)?["']([^"']+)["']/);
      const title: string = titleMatch && titleMatch[1] ? titleMatch[1] : (scriptTitle || "My script");
      setScriptTitle(title);

      const res = await onRunScript(code, title);
      recordHistory(title, code);

      if (res.success) {
        setLogs((prev) => [
          {
            id: String(Date.now()),
            time: now,
            severity: "ok",
            message: `Script compiled successfully and applied to chart.`,
          },
          ...prev,
        ]);
      } else {
        setLogs((prev) => [
          {
            id: String(Date.now()),
            time: now,
            severity: "error",
            message: res.error || "Compilation error in Pine Script v6.",
          },
          ...prev,
        ]);
        setIsLogsOpen(true);
      }
    } catch (err: any) {
      setLogs((prev) => [
        {
          id: String(Date.now()),
          time: now,
          severity: "error",
          message: err?.message || "Execution failed.",
        },
        ...prev,
      ]);
      setIsLogsOpen(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setSavedNotice("Code copied to clipboard");
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleSave = () => {
    try {
      const titleMatch = code.match(/indicator\s*\(\s*(?:title\s*=\s*)?["']([^"']+)["']/);
      const title: string = titleMatch && titleMatch[1] ? titleMatch[1] : (scriptTitle || "My script");
      setScriptTitle(title);

      const now = Date.now();
      const updatedList = savedScripts.map((s) =>
        s.id === activeScriptId ? { ...s, title, code, updatedAt: now } : s
      );

      const exists = updatedList.some((s) => s.id === activeScriptId);
      const finalList = exists
        ? updatedList
        : [{ id: activeScriptId, title, code, updatedAt: now }, ...updatedList];

      setSavedScripts(finalList);
      savePersonalPineScripts(finalList);
      setSavedNotice("Saved to your scripts");
      setTimeout(() => setSavedNotice(null), 2500);

      recordHistory(title, code);
    } catch {}
  };

  const handleNewScript = () => {
    const newId = `script_${Date.now()}`;
    const newTitle = "Untitled script";
    const newCode = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/\n//@version=6\nindicator("${newTitle}", overlay = true)\n`;

    const newScript: SavedPineScript = {
      id: newId,
      title: newTitle,
      code: newCode,
      updatedAt: Date.now(),
    };

    const nextList = [newScript, ...savedScripts];
    setSavedScripts(nextList);
    setActiveScriptId(newId);
    setScriptTitle(newTitle);
    setRenameInput(newTitle);
    setCode(newCode);
    setIsNameMenuOpen(false);
    try {
      savePersonalPineScripts(nextList);
    } catch {}
    setSavedNotice("Created new script");
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleSelectScript = (s: SavedPineScript) => {
    setActiveScriptId(s.id);
    setScriptTitle(s.title);
    setRenameInput(s.title);
    setCode(s.code);
    setIsNameMenuOpen(false);
  };

  const handleCommitRename = () => {
    const trimmed = renameInput.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === scriptTitle) return;

    setScriptTitle(trimmed);
    const updatedCode = code.replace(
      /indicator\s*\(\s*(?:title\s*=\s*)?["']([^"']+)["']/,
      (match) => {
        if (match.includes("title")) {
          return match.replace(/(title\s*=\s*["'])([^"']+)(["'])/, `$1${trimmed}$3`);
        }
        return `indicator("${trimmed}"`;
      }
    );
    setCode(updatedCode);

    const now = Date.now();
    const nextList = savedScripts.map((s) =>
      s.id === activeScriptId ? { ...s, title: trimmed, code: updatedCode, updatedAt: now } : s
    );
    setSavedScripts(nextList);
    try {
      savePersonalPineScripts(nextList);
    } catch {}
    setSavedNotice(`Renamed to "${trimmed}"`);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleDeleteScript = (targetId?: string) => {
    const idToDelete = targetId || activeScriptId;
    const remaining = savedScripts.filter((s) => s.id !== idToDelete);

    if (remaining.length === 0) {
      const freshId = `script_${Date.now()}`;
      const freshTitle = "Untitled script";
      const freshCode = DEFAULT_SCRIPT;
      const freshScript: SavedPineScript = {
        id: freshId,
        title: freshTitle,
        code: freshCode,
        updatedAt: Date.now(),
      };
      setSavedScripts([freshScript]);
      setActiveScriptId(freshId);
      setScriptTitle(freshTitle);
      setRenameInput(freshTitle);
      setCode(freshCode);
      try {
        savePersonalPineScripts([freshScript]);
      } catch {}
    } else {
      setSavedScripts(remaining);
      try {
        savePersonalPineScripts(remaining);
      } catch {}

      if (idToDelete === activeScriptId) {
        const next = remaining[0];
        if (next) {
          setActiveScriptId(next.id);
          setScriptTitle(next.title);
          setRenameInput(next.title);
          setCode(next.code);
        }
      }
    }

    try {
      const rawFav = localStorage.getItem("tradejournal_favorite_indicators");
      if (rawFav) {
        const favs: string[] = JSON.parse(rawFav);
        const filtered = favs.filter((f) => f !== `personal:${idToDelete}`);
        saveFavoriteIndicators(filtered);
      }
    } catch {}

    setSavedNotice("Script deleted");
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const isFavorite = React.useMemo(() => {
    try {
      const rawFav = localStorage.getItem("tradejournal_favorite_indicators");
      if (rawFav) {
        const favs: string[] = JSON.parse(rawFav);
        return favs.includes(`personal:${activeScriptId}`);
      }
    } catch {}
    return false;
  }, [activeScriptId, savedNotice]);

  const handleToggleFavorite = () => {
    try {
      const rawFav = localStorage.getItem("tradejournal_favorite_indicators");
      const favs: string[] = rawFav ? JSON.parse(rawFav) : [];
      const favKey = `personal:${activeScriptId}`;
      let nextFavs: string[];
      let notice: string;

      if (favs.includes(favKey)) {
        nextFavs = favs.filter((f) => f !== favKey);
        notice = "Removed from favorites";
      } else {
        nextFavs = [...favs, favKey];
        notice = "Added to favorites";
      }

      saveFavoriteIndicators(nextFavs);
      setSavedNotice(notice);
      setTimeout(() => setSavedNotice(null), 2500);
    } catch {}
    setIsKebabMenuOpen(false);
  };

  const handleRestoreHistory = (item: SessionHistoryItem) => {
    setCode(item.code);
    setScriptTitle(item.title);
    setIsHistoryMenuOpen(false);
    setSavedNotice(`Restored version from ${item.time}`);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const linesCount = Math.max(code.split("\n").length, 12);
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1);

  if (!isOpen) return null;

  return (
    <div
      className="vela-panel vela-panel-vela-pro.code"
      data-maximized={isMaximized ? "true" : undefined}
      style={{
        ["--vela-panel-w" as any]: `${panelWidth}px`,
      }}
    >
      {/* Resizer Handle */}
      {!isMaximized && (
        <div
          className="vela-pro-editor-resizer"
          onPointerDown={handlePointerDownResize}
          title="Drag to resize panel"
        />
      )}

      {/* Header matching official Vela 1:1 */}
      <div className="vela-panel-header">
        <div className="vela-panel-header-slot">
          {/* Script Name Dropdown with Popover & Inline Rename */}
          <div className="relative inline-flex items-center vela-pro-editor-name-container">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                className="vela-pro-editor-name-input"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommitRename();
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setRenameInput(scriptTitle);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="vela-pro-editor-name quant-chrome-hover-row"
                data-open={isNameMenuOpen ? "1" : "0"}
                onClick={() => setIsNameMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isNameMenuOpen}
                aria-label={`${scriptTitle} — open a recent script`}
                title="Recent scripts"
              >
                <span className="vela-pro-editor-name-text">{scriptTitle}</span>
                <span className="vela-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 6 8 10.5 12.5 6" />
                  </svg>
                </span>
              </button>
            )}

            {/* Dropdown Menu */}
            {isNameMenuOpen && (
              <div
                className="vela-pro-editor-menu quant-chrome-hover quant-chrome-menu"
                role="menu"
              >
                <div className="vela-pro-editor-menu-heading" data-quant-recent="">
                  Recent scripts
                </div>

                {savedScripts.length === 0 ? (
                  <div className="vela-pro-editor-menu-empty">
                    No saved scripts yet — save the script you are editing to list it here.
                  </div>
                ) : (
                  savedScripts.map((s) => (
                    <div
                      key={s.id}
                      className="vela-pro-editor-menu-item-row group"
                    >
                      <button
                        type="button"
                        className="vela-pro-editor-menu-item quant-chrome-hover-row pr-8"
                        role="menuitem"
                        data-current={s.id === activeScriptId ? "1" : "0"}
                        onClick={() => handleSelectScript(s)}
                      >
                        <span className="vela-pro-editor-menu-item-mark">
                          {s.id === activeScriptId ? "✓" : ""}
                        </span>
                        <span className="vela-pro-editor-menu-item-label">{s.title}</span>
                        <span className="quant-recent-time">
                          {new Date(s.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="quant-script-del-btn"
                        title="Delete script"
                        aria-label={`Delete ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScript(s.id);
                        }}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.5 4h11M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M12.5 4v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4" />
                          <path d="M6.5 7v4.5M9.5 7v4.5" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}

                <div className="vela-pro-editor-menu-sep" />

                <button
                  type="button"
                  className="vela-pro-editor-menu-item quant-chrome-hover-row"
                  role="menuitem"
                  onClick={handleNewScript}
                >
                  <span className="vela-pro-editor-menu-item-mark">+</span>
                  <span className="vela-pro-editor-menu-item-label">New script</span>
                </button>
              </div>
            )}
          </div>

          {/* Run Button (Inverse theme-flipping chip) */}
          <button
            type="button"
            className="vela-pro-editor-run"
            onClick={handleRun}
            disabled={isRunning}
            aria-label="Run script"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 2.7a.8.8 0 0 1 1.2-.7l8 5.3a.8.8 0 0 1 0 1.4l-8 5.3a.8.8 0 0 1-1.2-.7V2.7z" />
            </svg>
            <span>{isRunning ? "Running…" : "Run"}</span>
          </button>

          <span className="vela-pro-editor-sep" aria-hidden="true" />

          {/* New Script Button */}
          <button
            type="button"
            className="vela-pro-editor-hbtn quant-chrome-hover-row"
            onClick={handleNewScript}
            aria-label="New script"
            title="New script"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            className="vela-pro-editor-hbtn"
            onClick={handleCopy}
            aria-label="Copy the code"
            title="Copy code"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 5.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6a1.5 1.5 0 0 0 1.5 1.5h2.5" />
            </svg>
          </button>

          {/* Save Button */}
          <button
            type="button"
            className="vela-pro-editor-hbtn"
            onClick={handleSave}
            aria-label="Save to your scripts"
            title="Save script"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.5 13.5H2.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h8l3 3v7a1 1 0 0 1-1 1z" />
              <path d="M10.5 13.5v-4h-5v4" />
              <path d="M4.5 2.5v3h5v-3" />
            </svg>
          </button>

          {/* History Button with Popover */}
          <div className="relative inline-flex items-center vela-pro-editor-history-container">
            <button
              type="button"
              className="vela-pro-editor-hbtn quant-chrome-hover-row"
              onClick={() => setIsHistoryMenuOpen((prev) => !prev)}
              aria-label="Version history (this session)"
              title="Version history"
              data-open={isHistoryMenuOpen ? "1" : "0"}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v3.8l2.5 1.4" />
              </svg>
            </button>

            {/* History Menu */}
            {isHistoryMenuOpen && (
              <div
                className="vela-pro-editor-menu quant-chrome-hover quant-chrome-menu"
                role="menu"
                style={{ right: 0, left: "auto" }}
              >
                <div className="vela-pro-editor-menu-heading">
                  Session History
                </div>
                {historyList.length === 0 ? (
                  <div className="vela-pro-editor-menu-empty">
                    No run or save events recorded in this session yet.
                  </div>
                ) : (
                  historyList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="vela-pro-editor-menu-item quant-chrome-hover-row"
                      role="menuitem"
                      onClick={() => handleRestoreHistory(item)}
                    >
                      <span className="vela-pro-editor-menu-item-mark">⏱</span>
                      <span className="vela-pro-editor-menu-item-label">
                        {item.title} ({item.linesCount} lines)
                      </span>
                      <span className="quant-recent-time">{item.time}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {savedNotice && (
            <span className="text-[11px] text-[var(--vela-accent,#2962ff)] font-medium ml-2 animate-fade-in">
              {savedNotice}
            </span>
          )}
        </div>

        {/* Maximize Button */}
        <button
          type="button"
          className="vela-panel-max"
          onClick={() => setIsMaximized((prev) => !prev)}
          title={isMaximized ? "Restore panel size" : "Maximize"}
          aria-label={isMaximized ? "Restore panel size" : "Maximize"}
          aria-pressed={isMaximized}
        >
          <span className="vela-icon" aria-hidden="true">
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isMaximized ? (
                <path d="M5 2.5H2.5V5M11 2.5h2.5V5M5 13.5H2.5V11M11 13.5h2.5V11" />
              ) : (
                <path d="M2.5 6V3a.5.5 0 0 1 .5-.5h3M10 2.5h3a.5.5 0 0 1 .5.5v3M13.5 10v3a.5.5 0 0 1-.5.5h-3M6 13.5H3a.5.5 0 0 1-.5-.5v-3" />
              )}
            </svg>
          </span>
        </button>

        {/* Kebab Button with Popover Menu */}
        <div className="vela-pro-editor-kebab-container">
          <button
            type="button"
            className="vela-panel-max quant-editor-kebab"
            data-open={isKebabMenuOpen ? "1" : "0"}
            onClick={() => setIsKebabMenuOpen((prev) => !prev)}
            title="Script options"
            aria-label="Script options"
            aria-haspopup="menu"
            aria-expanded={isKebabMenuOpen}
          >
            <span className="vela-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <circle cx="8" cy="3.5" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="8" cy="12.5" r="1.2" />
              </svg>
            </span>
          </button>

          {isKebabMenuOpen && (
            <div
              className="vela-pro-editor-kebab-menu quant-chrome-hover quant-chrome-menu"
              role="menu"
            >
              {/* New script */}
              <button
                type="button"
                className="vela-pro-editor-menu-item quant-chrome-hover-row"
                role="menuitem"
                onClick={() => {
                  setIsKebabMenuOpen(false);
                  handleNewScript();
                }}
              >
                <span className="vela-pro-editor-menu-item-mark">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 1.5H3.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z" />
                    <path d="M9 1.5V6h4.5M6 9h4M8 7v4" />
                  </svg>
                </span>
                <span className="vela-pro-editor-menu-item-label">New script</span>
                <span className="quant-menu-shortcut">Ctrl/⌘+K, I</span>
              </button>

              {/* Rename */}
              <button
                type="button"
                className="vela-pro-editor-menu-item quant-chrome-hover-row"
                role="menuitem"
                onClick={() => {
                  setIsKebabMenuOpen(false);
                  setRenameInput(scriptTitle);
                  setIsRenaming(true);
                  setTimeout(() => {
                    renameInputRef.current?.focus();
                    renameInputRef.current?.select();
                  }, 50);
                }}
              >
                <span className="vela-pro-editor-menu-item-mark">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L4.5 13.5l-3 1 1-3 9-9z" />
                  </svg>
                </span>
                <span className="vela-pro-editor-menu-item-label">Rename</span>
              </button>

              {/* Add to favorites */}
              <button
                type="button"
                className="vela-pro-editor-menu-item quant-chrome-hover-row"
                role="menuitem"
                onClick={handleToggleFavorite}
              >
                <span className="vela-pro-editor-menu-item-mark">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 2.5l1.6 3.8 4.1.4-3.1 2.8.9 4-3.5-2.1-3.5 2.1.9-4-3.1-2.8 4.1-.4L8 2.5z" />
                  </svg>
                </span>
                <span className="vela-pro-editor-menu-item-label">
                  {isFavorite ? "Remove from favorites" : "Add to favorites"}
                </span>
              </button>

              {/* Dock beside chart */}
              <button
                type="button"
                className="vela-pro-editor-menu-item quant-chrome-hover-row"
                role="menuitem"
                onClick={() => {
                  setIsKebabMenuOpen(false);
                  setIsMaximized(false);
                  setSavedNotice("Docked beside chart");
                  setTimeout(() => setSavedNotice(null), 2000);
                }}
              >
                <span className="vela-pro-editor-menu-item-mark">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 2l4 4-2 2-1-1-3 3v3l-1 1-1-1v-3l-3-3-1 1-2-2 4-4" />
                  </svg>
                </span>
                <span className="vela-pro-editor-menu-item-label">Dock beside chart</span>
              </button>

              <div className="vela-pro-editor-menu-sep" />

              {/* Delete script */}
              <button
                type="button"
                className="vela-pro-editor-menu-item quant-chrome-hover-row"
                role="menuitem"
                data-danger="1"
                onClick={() => {
                  setIsKebabMenuOpen(false);
                  handleDeleteScript();
                }}
              >
                <span className="vela-pro-editor-menu-item-mark">
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 4h11M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M12.5 4v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4" />
                    <path d="M6.5 7v4.5M9.5 7v4.5" />
                  </svg>
                </span>
                <span className="vela-pro-editor-menu-item-label">Delete script</span>
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          className="vela-panel-close"
          onClick={onClose}
          title="Close Pine editor"
          aria-label="Close"
        >
          <span className="vela-icon" aria-hidden="true">
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3.8 3.8 8.4 8.4M12.2 3.8l-8.4 8.4" />
            </svg>
          </span>
        </button>
      </div>

      {/* Editor Body */}
      <div className="vela-pro-editor">
        <div className="vela-pro-editor-host">
          {/* Line Numbers Column */}
          <div
            className="select-none py-3 px-3 text-right text-[12px] font-mono leading-[20px] text-[var(--vela-fg-faint,rgba(178,181,190,0.3))] border-r border-[var(--vela-border-faint,rgba(178,181,190,0.08))] bg-[var(--vela-surface-sunken,#121316)]"
            style={{ width: "46px" }}
          >
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>

          {/* Code Textarea with Pine Script syntax font */}
          <div className="relative flex-1 h-full min-w-0 bg-[var(--vela-surface-sunken,#151619)]">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="w-full h-full p-3 font-mono text-[13px] leading-[20px] text-[var(--vela-fg-bright,#f0f3fa)] bg-transparent resize-none outline-none overflow-auto border-0 focus:ring-0"
              style={{
                tabSize: 4,
                fontFamily:
                  '"JetBrains Mono", "Fira Code", Consolas, Menlo, Monaco, monospace',
              }}
            />
          </div>
        </div>

        {/* Bottom Statusline / Logs strip */}
        <div
          className="vela-pro-editor-logs"
          data-collapsed={isLogsOpen ? "0" : "1"}
        >
          <div
            className="vela-pro-editor-logs-bar"
            onClick={() => setIsLogsOpen((prev) => !prev)}
          >
            <span
              className="text-[12px] font-medium text-[var(--vela-fg-muted,#868a96)] flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 16 16"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-150 ${isLogsOpen ? "rotate-180" : ""}`}
              >
                <path d="M3.5 6 8 10.5 12.5 6" />
              </svg>
              <span>Logs</span>
            </span>

            <span className="vela-pro-editor-logs-count">{logs.length}</span>

            <div className="vela-pro-editor-logs-right">
              <span className="vela-pro-editor-chip">Pine v6</span>
            </div>
          </div>

          {/* Expanded logs body */}
          {isLogsOpen && (
            <div className="vela-pro-editor-logs-body">
              {logs.length === 0 ? (
                <div className="py-2 px-3 text-[11px] text-[var(--vela-fg-faint,rgba(178,181,190,0.35))]">
                  No compiler messages. Click Run to compile script.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="vela-pro-editor-log"
                    data-severity={log.severity}
                  >
                    <span className="text-[11px] opacity-50 tabular-nums">
                      {log.time}
                    </span>
                    <span className="text-[11px] font-semibold">
                      {log.severity === "ok" ? "✓" : "✕"}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
