import React from "react";
import { createPortal } from "react-dom";
import type {
  SavedIndicatorTemplate,
  PersistedIndicatorInstance,
  ResolvedFavoriteIndicatorItem,
} from "@/lib/replay/workspace-persistence";

export interface PopoverAnchorCoords {
  left: number;
  top: number;
}

export interface MarketIndicatorPopoversProps {
  // Popover de Indicadores Favoritos (.vela-fav-indicators-popover)
  favMenuOpen: boolean;
  favMenuRect: PopoverAnchorCoords | null;
  favoriteItems: ResolvedFavoriteIndicatorItem[];
  onCloseFavMenu: () => void;
  onSelectFavorite: (item: ResolvedFavoriteIndicatorItem) => void | Promise<void>;

  // Popover de Templates de Indicadores (.vela-indicator-templates-popover)
  templatesMenuOpen: boolean;
  templatesMenuRect: PopoverAnchorCoords | null;
  savedTemplates: SavedIndicatorTemplate[];
  activeIndicatorSlugs: string[];
  activeIndicatorConfigs: PersistedIndicatorInstance[];
  isNamingTemplate: boolean;
  newTemplateName: string;
  onCloseTemplatesMenu: () => void;
  onStartNamingTemplate: () => void;
  onCancelNamingTemplate: () => void;
  onNewTemplateNameChange: (name: string) => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (template: SavedIndicatorTemplate) => void | Promise<void>;
  onDeleteTemplate: (templateId: string) => void;
}

export function MarketIndicatorPopovers({
  favMenuOpen,
  favMenuRect,
  favoriteItems,
  onCloseFavMenu,
  onSelectFavorite,
  templatesMenuOpen,
  templatesMenuRect,
  savedTemplates,
  isNamingTemplate,
  newTemplateName,
  onStartNamingTemplate,
  onNewTemplateNameChange,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
}: MarketIndicatorPopoversProps) {
  if (typeof document === "undefined") return null;

  return (
    <>
      {/* Topbar Popover: Favorite Indicators Dropdown */}
      {favMenuOpen &&
        favMenuRect &&
        createPortal(
          <div
            className="vela-fav-indicators-popover fixed z-[70] w-[260px] rounded-md border border-[var(--vela-border,#2a2e39)] bg-[var(--vela-dialog-bg,#1e222d)] text-[var(--vela-text,#d1d4dc)] shadow-xl py-1.5 select-none"
            style={{
              left: Math.max(
                8,
                Math.min(
                  favMenuRect.left,
                  (typeof window !== "undefined" ? window.innerWidth : 1200) - 272,
                ),
              ),
              top: favMenuRect.top,
            }}
            role="menu"
            aria-label="Favorite indicators"
          >
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#787b86]">
              Favorite Indicators
            </div>
            {favoriteItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#787b86]">
                No favorite indicators yet. Star indicators in the Indicators dialog to pin them here.
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto py-0.5">
                {favoriteItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-white/5 transition-colors"
                    onClick={() => {
                      onCloseFavMenu();
                      void onSelectFavorite(item);
                    }}
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-[#787b86]">
                      {item.kind === "native"
                        ? "Built-in"
                        : item.kind === "personal"
                          ? "My Script"
                          : "Pine"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Topbar Popover: Indicator Templates Dropdown */}
      {templatesMenuOpen &&
        templatesMenuRect &&
        createPortal(
          <div
            className="vela-indicator-templates-popover fixed z-[70] w-[280px] rounded-md border border-[var(--vela-border,#2a2e39)] bg-[var(--vela-dialog-bg,#1e222d)] text-[var(--vela-text,#d1d4dc)] shadow-xl py-1.5 select-none"
            style={{
              left: Math.max(
                8,
                Math.min(
                  templatesMenuRect.left,
                  (typeof window !== "undefined" ? window.innerWidth : 1200) - 292,
                ),
              ),
              top: templatesMenuRect.top,
            }}
            role="menu"
            aria-label="Indicator templates"
          >
            {!isNamingTemplate ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] font-medium hover:bg-white/5 transition-colors"
                onClick={onStartNamingTemplate}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                >
                  <path d="M8 3.2v9.6M3.2 8h9.6" strokeLinecap="round" />
                </svg>
                <span>Save indicator template...</span>
              </button>
            ) : (
              <form
                className="px-3 py-1.5 flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newTemplateName.trim();
                  if (!trimmed) return;
                  onSaveTemplate(trimmed);
                }}
              >
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => onNewTemplateNameChange(e.target.value)}
                  placeholder="Template name..."
                  autoFocus
                  className="flex-1 min-w-0 rounded border border-[var(--vela-border,#2a2e39)] bg-black/20 px-2 py-1 text-xs text-[var(--vela-text,#d1d4dc)] outline-none focus:border-[#2962ff]"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded bg-[#2962ff] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1e53e5]"
                >
                  Save
                </button>
              </form>
            )}

            <div className="my-1 border-t border-[var(--vela-border,#2a2e39)]" />

            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#787b86]">
              Saved Templates
            </div>

            {savedTemplates.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[#787b86]">No saved templates yet.</div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto py-0.5">
                {savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="group flex items-center justify-between gap-1 px-2 py-1 hover:bg-white/5 transition-colors"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex-1 min-w-0 text-left px-1 py-0.5 text-[13px] truncate"
                      onClick={() => void onApplyTemplate(tpl)}
                    >
                      <span className="font-medium">{tpl.name}</span>
                      <span className="ml-1.5 text-[11px] text-[#787b86]">
                        ({tpl.indicators.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete template ${tpl.name}`}
                      title="Delete template"
                      className="shrink-0 rounded p-1 text-[#787b86] opacity-70 hover:opacity-100 hover:text-red-400 hover:bg-white/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTemplate(tpl.id);
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      >
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
