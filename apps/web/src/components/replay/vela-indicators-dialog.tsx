"use client";

import React, { useEffect, useRef, useCallback } from "react";
import builtinCatalog from "../../../public/draft-indicator-library/builtin-catalog.json";
import { saveFavoriteIndicators } from "@/lib/replay/workspace-persistence";

const CHANNEL = "quant-draft-library";
const FAVORITES_STORAGE_KEY = "tradejournal_favorite_indicators";

export interface IndicatorMeta {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  family?: string;
  displayFamily?: string;
  creationDateDisplayed?: string;
}

interface VelaIndicatorsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyIndicator: (slug: string, name: string) => Promise<boolean> | boolean;
  onApplyNativeIndicator?: (type: string, id: string) => Promise<boolean> | boolean;
  activeIndicatorSlugs?: string[];
}

export function VelaIndicatorsDialog({
  isOpen,
  onClose,
  onApplyIndicator,
  onApplyNativeIndicator,
  activeIndicatorSlugs = [],
}: VelaIndicatorsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isIframeReadyRef = useRef(false);

  // Helper to load stored favorites with slug: prefix
  const getStoredFavorites = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        return parsed.map((id) =>
          id.startsWith("slug:") || id.startsWith("native:") ? id : `slug:${id}`
        );
      }
    } catch {}
    return [];
  }, []);

  const saveStoredFavorites = useCallback((ids: string[]) => {
    try {
      saveFavoriteIndicators(ids);
    } catch {}
  }, []);

  // Send message safely to iframe
  const postToIframe = useCallback((type: string, payload: Record<string, any> = {}) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          channel: CHANNEL,
          type,
          ...payload,
        },
        window.location.origin
      );
    } catch (err) {
      console.warn("[VelaIndicatorsDialog] Failed to post message to iframe:", err);
    }
  }, []);

  // Sync theme with documentElement
  const syncTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    postToIframe("theme", { theme: isDark ? "dark" : "light" });
  }, [postToIframe]);

  // Sync favorites
  const syncFavorites = useCallback(() => {
    const ids = getStoredFavorites();
    postToIframe("favorites", { ids });
  }, [getStoredFavorites, postToIframe]);

  // Sync built-in catalog (80 Basic + 17 Order Flow) + Personal saved scripts
  const syncCatalog = useCallback(() => {
    let personalItems: any[] = [];
    try {
      const raw = localStorage.getItem("tradejournal_saved_pine_scripts_v1");
      const savedScripts: any[] = raw ? JSON.parse(raw) : [];
      personalItems = savedScripts.map((s) => ({
        id: `personal:${s.id}`,
        name: s.title || "My script",
        group: "personal",
        summary: "Your script",
        overlay:
          s.code?.includes("overlay = true") ||
          s.code?.includes("overlay=true") ||
          false,
        code: s.code,
        supported: true,
      }));
    } catch {}

    postToIframe("catalog", {
      items: [...builtinCatalog.items, ...personalItems],
      sections: builtinCatalog.sections,
      personalLoaded: true,
      promptAvailable: false,
    });
  }, [postToIframe]);

  // Open/close native <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
      if (isIframeReadyRef.current) {
        syncTheme();
        syncFavorites();
        syncCatalog();
        postToIframe("opened", { id: String(Date.now()) });
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, syncTheme, syncFavorites, syncCatalog, postToIframe]);

  // Watch documentElement theme changes
  useEffect(() => {
    if (!isOpen) return;
    const observer = new MutationObserver(() => {
      syncTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [isOpen, syncTheme]);

  // IPC Message Bridge
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: Validate origin, source window, and channel
      if (event.origin !== window.location.origin) return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      if (event.data?.channel !== CHANNEL) return;

      const data = event.data;

      switch (data.type) {
        case "ready": {
          isIframeReadyRef.current = true;
          syncTheme();
          syncFavorites();
          syncCatalog();
          postToIframe("opened", { id: String(Date.now()) });
          break;
        }

        case "catalog-request":
        case "personal-request": {
          syncCatalog();
          break;
        }

        case "add": {
          const slug: string = data.slug;
          const keepOpen: boolean = !!data.keepOpen;
          try {
            const success = await onApplyIndicator(slug, slug);
            if (success) {
              postToIframe("add-result", { slug, error: null });
              if (!keepOpen) {
                onClose();
              }
            } else {
              postToIframe("add-result", { slug, error: `Failed to add indicator: ${slug}` });
            }
          } catch (err: any) {
            postToIframe("add-result", {
              slug,
              error: err?.message || `Error compiling Pine Script: ${slug}`,
            });
          }
          break;
        }

        case "add-item": {
          const id: string = data.id;
          const keepOpen: boolean = !!data.keepOpen;
          try {
            if (id.startsWith("personal:")) {
              const raw = localStorage.getItem("tradejournal_saved_pine_scripts_v1");
              const savedScripts: any[] = raw ? JSON.parse(raw) : [];
              const scriptId = id.replace("personal:", "");
              const found = savedScripts.find((s) => s.id === scriptId);
              if (found) {
                const success = await onApplyIndicator(found.code, found.title || "My script");
                if (success) {
                  postToIframe("item-result", { id, error: null });
                  if (!keepOpen) onClose();
                } else {
                  postToIframe("item-result", {
                    id,
                    error: `Failed to compile personal script: ${found.title}`,
                  });
                }
              } else {
                postToIframe("item-result", { id, error: "Script not found." });
              }
            } else if (id.startsWith("native:")) {
              const type = id.replace("native:", "");
              const success = onApplyNativeIndicator
                ? await onApplyNativeIndicator(type, id)
                : await onApplyIndicator(id, type);
              if (success) {
                postToIframe("item-result", { id, error: null });
                if (!keepOpen) onClose();
              } else {
                postToIframe("item-result", { id, error: `Failed to add native indicator: ${type}` });
              }
            } else if (id.startsWith("builtin:")) {
              const slug = id.replace("builtin:", "");
              const success = await onApplyIndicator(slug, slug);
              if (success) {
                postToIframe("item-result", { id, error: null });
                if (!keepOpen) onClose();
              } else {
                postToIframe("item-result", { id, error: `Failed to add built-in indicator: ${slug}` });
              }
            } else {
              const success = await onApplyIndicator(id, id);
              if (success) {
                postToIframe("item-result", { id, error: null });
                if (!keepOpen) onClose();
              } else {
                postToIframe("item-result", { id, error: `Failed to add indicator: ${id}` });
              }
            }
          } catch (err: any) {
            postToIframe("item-result", {
              id,
              error: err?.message || `Error adding indicator: ${id}`,
            });
          }
          break;
        }

        case "favorite-item": {
          const id: string = data.id;
          const current = new Set(getStoredFavorites());
          if (current.has(id)) {
            current.delete(id);
          } else {
            current.add(id);
          }
          const nextList = Array.from(current);
          saveStoredFavorites(nextList);
          postToIframe("favorites", { ids: nextList });
          break;
        }

        case "favorite": {
          const slug: string = data.slug;
          const favId = slug.startsWith("slug:") || slug.startsWith("native:") ? slug : `slug:${slug}`;
          const current = new Set(getStoredFavorites());
          if (current.has(favId)) {
            current.delete(favId);
          } else {
            current.add(favId);
          }
          const nextList = Array.from(current);
          saveStoredFavorites(nextList);
          postToIframe("favorites", { ids: nextList });
          break;
        }

        case "close": {
          onClose();
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    onApplyIndicator,
    onApplyNativeIndicator,
    onClose,
    postToIframe,
    syncTheme,
    syncFavorites,
    syncCatalog,
    getStoredFavorites,
    saveStoredFavorites,
  ]);

  // Backdrop click detection
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-draft-library=""
      aria-label="Indicators library"
      onClick={handleDialogClick}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="vela-draft-library-dialog"
    >
      <iframe
        ref={iframeRef}
        title="Library and concepts"
        src="/draft-indicator-library/index.html"
        tabIndex={isOpen ? 0 : -1}
        className="w-full h-full block border-0"
      />
    </dialog>
  );
}
