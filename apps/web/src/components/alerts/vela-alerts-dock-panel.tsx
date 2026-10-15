"use client";

import React, { useState } from "react";
import { useAlerts } from "@/lib/alerts/alerts-store";
import {
  ChartAlert,
  AlertLogItem,
  AlertConditionType,
  formatConditionLabel,
} from "@/lib/alerts/types";
import { formatPrice } from "@/lib/paper-trading/symbol-specs";
import { formatSymbolWithVenue, getSymbolSpec } from "@/lib/assets/symbol-specs";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";
import {
  VelaAlertsOptionsMenu,
  VelaAlertsLogOptionsMenu,
  VelaAlertsSortMenu,
  AlertSortOption,
  SORT_ITEMS,
  SortAscIcon,
  SortDescIcon,
} from "./vela-alerts-options-menu";

interface VelaAlertsDockPanelProps {
  currentSymbol?: string;
  onClose?: () => void;
  className?: string;
}

/**
 * Institutional dynamic symbol badge icon:
 * Resolves official vector SVG asset (Nasdaq 100, S&P 500, Dow, Crypto, Commodities, etc.)
 * with zero hardcoded tickers. Falls back gracefully to canonical ticker initials.
 */
function AlertSymbolIcon({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const iconSrc = React.useMemo(() => {
    try {
      const cfg = getAssetIconConfig(symbol);
      return cfg.icons[0];
    } catch {
      return null;
    }
  }, [symbol]);

  if (iconSrc && !failed) {
    return (
      <img
        src={iconSrc}
        alt={symbol}
        onError={() => setFailed(true)}
        className="w-[16px] h-[16px] rounded-full object-cover shrink-0 select-none pointer-events-none"
      />
    );
  }

  const spec = getSymbolSpec(symbol);
  const fallbackText = (spec?.symbol || symbol).slice(0, 2).toUpperCase();

  return (
    <div className="w-[16px] h-[16px] rounded-full bg-[#00a4d8] text-white flex items-center justify-center text-[8px] font-bold shrink-0 select-none">
      {fallbackText}
    </div>
  );
}

function formatAlertDate(ts: number): string {
  const d = new Date(ts);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dayName = days[d.getDay()];
  const dateNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year2 = String(d.getFullYear()).slice(-2);
  const time = d.toTimeString().slice(0, 8);
  return `${dayName} ${dateNum} ${monthName} '${year2}  ${time}`;
}

function formatLogDateHeader(ts: number): string {
  const d = new Date(ts);
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function VelaAlertsDockPanel({
  currentSymbol = "MNQ",
  onClose,
  className = "",
}: VelaAlertsDockPanelProps) {
  const {
    alerts,
    filteredAlerts,
    logs,
    activePanelTab,
    filterStatus,
    searchQuery,
    setActivePanelTab,
    setFilterStatus,
    setSearchQuery,
    openCreateDialog,
    openEditDialog,
    requestDeleteAlert,
    toggleAlert,
    pauseAll,
    resumeAll,
    deleteAllInactive,
    clearLogs,
  } = useAlerts(currentSymbol);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showLogOptionsMenu, setShowLogOptionsMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortOption, setSortOption] =
    useState<AlertSortOption>("date_created_desc");
  const [filterCurrentSymbol, setFilterCurrentSymbol] = useState(false);
  const [filterCurrentInterval, setFilterCurrentInterval] = useState(false);
  const [hoveredAlertTooltip, setHoveredAlertTooltip] = useState<{
    alert: ChartAlert;
    rect: { top: number; left: number; height: number };
  } | null>(null);

  const displayedAlerts = filteredAlerts.filter((a) => {
    if (filterCurrentSymbol && a.symbol !== currentSymbol) return false;
    return true;
  });

  const sortedAlerts = [...displayedAlerts].sort((a, b) => {
    switch (sortOption) {
      case "symbol_asc":
        return a.symbol.localeCompare(b.symbol);
      case "symbol_desc":
        return b.symbol.localeCompare(a.symbol);
      case "name_asc":
        return (a.message || a.symbol).localeCompare(b.message || b.symbol);
      case "name_desc":
        return (b.message || b.symbol).localeCompare(a.message || a.symbol);
      case "message_asc":
        return (a.message || "").localeCompare(b.message || "");
      case "message_desc":
        return (b.message || "").localeCompare(a.message || "");
      case "date_created_asc":
        return a.createdAt - b.createdAt;
      case "date_created_desc":
        return b.createdAt - a.createdAt;
      case "time_triggering_asc":
        return (a.lastFiredAt || 0) - (b.lastFiredAt || 0);
      case "time_triggering_desc":
        return (b.lastFiredAt || 0) - (a.lastFiredAt || 0);
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const activeSortItem = SORT_ITEMS.find(
    (item) => typeof item === "object" && item.id === sortOption,
  );
  const currentSortLabel =
    typeof activeSortItem === "object"
      ? activeSortItem.label
      : "Date created (newest first)";
  const isSortAsc =
    typeof activeSortItem === "object" && activeSortItem.dir === "asc";

  const displayedLogs = logs.filter((l) => {
    if (filterCurrentSymbol && l.symbol !== currentSymbol) return false;
    return true;
  });

  const activeCount = displayedAlerts.filter(
    (a) => a.status === "active",
  ).length;
  const isAllPaused = displayedAlerts.length > 0 && activeCount === 0;

  return (
    <div
      className={`widget-aKdZqnMd widgetbar-widget widgetbar-widget-alerts w-[380px] sm:w-[411px] h-full flex flex-col bg-[var(--vela-bg,#131722)] text-[var(--vela-fg,#d1d4dc)] border-l border-[var(--vela-border,#2a2e39)] shrink-0 select-none z-20 overflow-hidden ${className}`}
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      }}
    >
      {/* ─── 1. Header: Segmented Control Tabs (Alerts | Log) 1:1 TradingView ─── */}
      <div className="widgetHeader-aKdZqnMd h-[48px] px-4 flex items-center shrink-0 border-0 bg-transparent box-content">
        <div className="tab-L3Cq0MYl tabs-DBdWKlAd w-full h-[34px] flex items-center pb-[2px]">
          <div className="segmentedControlsScope-O9cSv1MO w-full">
            <div
              className="segmentedControls-O9cSv1MO xsmall-O9cSv1MO grid grid-cols-2 p-[3px] gap-[3px] rounded-[8px] bg-[var(--vela-surface-elev,rgba(255,255,255,0.06))] w-full h-[34px] box-border items-center"
              role="tablist"
              aria-orientation="horizontal"
              data-qa-id="alerts-widget-header-tabs"
            >
              <button
                type="button"
                role="tab"
                id="list"
                onClick={() => setActivePanelTab("alerts")}
                className={`segmentedControlBase-Wsyc2cnT xsmall-Wsyc2cnT h-[28px] rounded-[5px] text-[14px] font-medium transition-all flex items-center justify-center select-none ${
                  activePanelTab === "alerts"
                    ? "bg-[#080809] text-[var(--vela-fg-bright,#f0f3fa)] shadow-none font-medium checked-Wsyc2cnT"
                    : "text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] bg-transparent"
                }`}
                aria-selected={activePanelTab === "alerts"}
              >
                <span className="contentWrap-_X6UjuEd contentOnly-_X6UjuEd">
                  <span className="content-_X6UjuEd contentCenter-_X6UjuEd">Alerts</span>
                </span>
              </button>

              <button
                type="button"
                role="tab"
                id="log"
                onClick={() => setActivePanelTab("log")}
                className={`segmentedControlBase-Wsyc2cnT xsmall-Wsyc2cnT h-[28px] rounded-[5px] text-[14px] font-medium transition-all flex items-center justify-center select-none ${
                  activePanelTab === "log"
                    ? "bg-[#080809] text-[var(--vela-fg-bright,#f0f3fa)] shadow-none font-medium checked-Wsyc2cnT"
                    : "text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] bg-transparent"
                }`}
                aria-selected={activePanelTab === "log"}
              >
                <span className="contentWrap-_X6UjuEd flex items-center justify-center gap-1.5">
                  <span className="content-_X6UjuEd contentCenter-_X6UjuEd">Log</span>
                  {logs.length > 0 && (
                    <span
                      data-qa-id="alerts-tab-counter"
                      className="counter-Afd6t4Zj xsmall-Afd6t4Zj min-w-[14px] h-[14px] px-[3.5px] text-[10px] leading-[14px] font-normal text-white bg-[#f23645] rounded-full flex items-center justify-center"
                      role="img"
                      aria-label="counter"
                    >
                      {logs.length}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Subheader Bar (Exact TradingView Icons & Layout) ─── */}
      <div className="subheader-c3JkvD1d h-[39px] px-2 flex items-center justify-between border-b border-[var(--vela-border,#2a2e39)] shrink-0 bg-[var(--vela-bg,#131722)]">
        {activePanelTab === "alerts" ? (
          <>
            {/* Left Slot: Thin Crosshair Plus Icon (Create Alert) */}
            <div className="leftSlot-rSCEcYF0">
              <button
                type="button"
                aria-label="Create Alert"
                data-name="set-alert-button"
                data-tooltip="Create Alert"
                onClick={() => openCreateDialog(currentSymbol)}
                className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                title="Create Alert (Alt + A)"
              >
                <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 28 28"
                    width="28"
                    height="28"
                  >
                    <path
                      fill="currentColor"
                      d="M13.9 14.1V22h1.2v-7.9H23v-1.2h-7.9V5h-1.2v7.9H6v1.2h7.9Z"
                    />
                  </svg>
                </span>
              </button>
            </div>

            {/* Right Slot: Search, Sort, Three Dots Options */}
            <div className="rightSlot-rSCEcYF0 flex items-center gap-0.5 relative">
              {/* Search Button */}
              <button
                type="button"
                id="alerts-search-button"
                aria-label="Search"
                data-name="alerts-search-button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className={`w-[28px] h-[28px] flex items-center justify-center rounded transition-colors ${
                  isSearchOpen
                    ? "bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg-bright,#f0f3fa)]"
                    : "text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
                title="Search"
              >
                <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 28 28"
                    width="28"
                    height="28"
                    fill="none"
                  >
                    <path
                      stroke="currentColor"
                      d="M17.4 17.5a7 7 0 1 0-4.9 2c1.9 0 3.64-.76 4.9-2zm0 0l5.1 5"
                    />
                  </svg>
                </span>
              </button>

              {/* Sort Button & Popover (1:1 TradingView print_20261014_195209.png) */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={`Sorted by ${currentSortLabel}`}
                  data-name="alert-sort-button"
                  aria-expanded={showSortMenu}
                  onClick={() => setShowSortMenu((prev) => !prev)}
                  className={`w-[28px] h-[28px] flex items-center justify-center rounded transition-colors ${
                    showSortMenu
                      ? "bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg-bright,#f0f3fa)]"
                      : "text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                  }`}
                  title={`Sorted by ${currentSortLabel}`}
                >
                  <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                    {isSortAsc ? <SortAscIcon /> : <SortDescIcon />}
                  </span>
                </button>

                <VelaAlertsSortMenu
                  isOpen={showSortMenu}
                  onClose={() => setShowSortMenu(false)}
                  selectedSort={sortOption}
                  onSelectSort={(opt) => setSortOption(opt)}
                />
              </div>

              {/* Options (Three Dots) Button */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Options"
                  data-name="alerts-settings-button"
                  aria-expanded={showOptionsMenu}
                  onClick={() => setShowOptionsMenu((prev) => !prev)}
                  className={`w-[28px] h-[28px] flex items-center justify-center rounded transition-colors ${
                    showOptionsMenu
                      ? "bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg-bright,#f0f3fa)]"
                      : "text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                  }`}
                  title="Options"
                >
                  <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z"
                      />
                    </svg>
                  </span>
                </button>

                {/* 1:1 TradingView Alerts Options Popover Menu */}
                <VelaAlertsOptionsMenu
                  isOpen={showOptionsMenu}
                  onClose={() => setShowOptionsMenu(false)}
                  alerts={alerts}
                  filterStatus={filterStatus}
                  onSelectFilterStatus={(st) => setFilterStatus(st)}
                  filterCurrentSymbol={filterCurrentSymbol}
                  onToggleFilterCurrentSymbol={() =>
                    setFilterCurrentSymbol((prev) => !prev)
                  }
                  filterCurrentInterval={filterCurrentInterval}
                  onToggleFilterCurrentInterval={() =>
                    setFilterCurrentInterval((prev) => !prev)
                  }
                  onRestartAllInactive={resumeAll}
                  onPauseAll={pauseAll}
                  onDeleteAllInactive={deleteAllInactive}
                />
              </div>
            </div>
          </>
        ) : (
          /* Log Tab Subheader: Clear Log (Broom) & Options */
          <>
            <div className="leftSlot-rSCEcYF0">
              <button
                type="button"
                aria-label="Clear log"
                data-name="clear-log-button"
                data-tooltip="Clear log"
                disabled={logs.length === 0}
                onClick={clearLogs}
                className={`w-[28px] h-[28px] flex items-center justify-center rounded transition-colors ${
                  logs.length > 0
                    ? "text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                    : "text-[var(--vela-fg-muted,#787b86)] opacity-40 cursor-default"
                }`}
                title="Clear log"
              >
                <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="none"
                  >
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      d="M5.5 16.5c1 3 7 7 11 7 2-4 2-8.5 2-8.5s-1-3.5-2-4-4.5.5-4.5.5-3 3.5-6.5 5z"
                    />
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      d="M15.5 11l3-6s.5-1 1.5-.5.5 1.5.5 1.5l-3 6M12 11.5l6.5 3.5M7.5 19c2-.5 4-2.5 4-2.5m0 5.5c2-1 3-3.5 3-3.5"
                    />
                  </svg>
                </span>
              </button>
            </div>

            <div className="rightSlot-rSCEcYF0 relative">
              <button
                type="button"
                aria-label="Options"
                data-name="alerts-log-actions-button"
                aria-expanded={showLogOptionsMenu}
                onClick={() => setShowLogOptionsMenu((prev) => !prev)}
                className={`w-[28px] h-[28px] flex items-center justify-center rounded transition-colors ${
                  showLogOptionsMenu
                    ? "bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg-bright,#f0f3fa)]"
                    : "text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
                title="Options"
              >
                <span role="img" className="icon-zm3YRUFG" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    fill="none"
                  >
                    <path
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z"
                    />
                  </svg>
                </span>
              </button>

              {/* 1:1 TradingView Log Options Popover Menu */}
              <VelaAlertsLogOptionsMenu
                isOpen={showLogOptionsMenu}
                onClose={() => setShowLogOptionsMenu(false)}
                logs={logs}
                filterCurrentSymbol={filterCurrentSymbol}
                onToggleFilterCurrentSymbol={() =>
                  setFilterCurrentSymbol((prev) => !prev)
                }
                filterCurrentInterval={filterCurrentInterval}
                onToggleFilterCurrentInterval={() =>
                  setFilterCurrentInterval((prev) => !prev)
                }
              />
            </div>
          </>
        )}
      </div>

      {/* ─── Search Input Bar 1:1 TradingView (print_20261014_195930.png) ─── */}
      {isSearchOpen && activePanelTab === "alerts" && (
        <div className="h-[38px] px-3.5 flex items-center gap-2 border-b border-[var(--vela-border,#2a2e39)] bg-[var(--vela-bg,#131722)] shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 18 18"
            width="16"
            height="16"
            fill="none"
            className="text-[var(--vela-fg-muted,#787b86)] shrink-0"
          >
            <path
              stroke="currentColor"
              strokeWidth="1.5"
              d="M13 13l3.5 3.5M7.5 13a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-[14px] text-[var(--vela-fg-bright,#f0f3fa)] placeholder:text-[var(--vela-fg-muted,#787b86)] p-0"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[var(--vela-fg-muted,#787b86)] hover:text-white text-[12px] p-1"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ─── Counter Header: '3 alerts' (print_20261014_200147.png) ─── */}
      {activePanelTab === "alerts" && sortedAlerts.length > 0 && (
        <div className="h-[30px] px-4 flex items-center text-[12px] font-normal text-[var(--vela-fg-muted,#787b86)] border-b border-[var(--vela-border,#2a2e39)] select-none shrink-0 bg-[var(--vela-bg,#131722)]">
          {sortedAlerts.length} {sortedAlerts.length === 1 ? "alert" : "alerts"}
        </div>
      )}

      {/* ─── 3. Content Area: Alerts List or Log (Exact TradingView DOM) ─── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 bg-[var(--vela-bg,#131722)]"
        onScroll={() => setHoveredAlertTooltip(null)}
      >
        {activePanelTab === "alerts" ? (
          sortedAlerts.length === 0 ? (
            /* Empty State for Alerts (1:1 TradingView) */
            <div
              data-name="alerts-empty-state"
              className="inner-iMkff_PV flex flex-col items-center justify-center h-full p-8 text-center"
            >
              <div className="container-D6_nhOMF flex flex-col items-center text-center w-full">
                <div className="icon-D6_nhOMF mb-3 flex justify-center">
                  <img
                    src={
                      alerts.length === 0
                        ? "/images/alerts/create-alerts-dark.32eb11e76d6c00a23985.svg"
                        : "/images/alerts/magnifier-dark.59dc12a3166942ea5ac9.svg"
                    }
                    width={120}
                    height={120}
                    alt=""
                    className="select-none pointer-events-none"
                  />
                </div>
                <div className="text-D6_nhOMF text-[16px] leading-[24px] text-[var(--vela-fg-bright,#d1d4dc)] max-w-[280px]">
                  <p>
                    {alerts.length === 0
                      ? "Alerts notify you instantly when your conditions are met. Create one to get started."
                      : "No alerts found"}
                  </p>
                </div>
                {alerts.length === 0 && (
                  <div className="action-D6_nhOMF flex justify-center mt-5 w-full">
                    <button
                      type="button"
                      onClick={() => openCreateDialog(currentSymbol)}
                      className="h-[34px] px-4 rounded-[8px] bg-[#2a2e39] hover:bg-[#363a45] active:bg-[#1e222d] text-white text-[14px] font-medium transition-colors select-none"
                    >
                      Create alert
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Alerts List */
            <div className="list-WzTCRKnG relative w-full">
              {sortedAlerts.map((alert) => (
                <TradingViewAlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={() => {
                    setHoveredAlertTooltip(null);
                    openEditDialog(alert);
                  }}
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => {
                    setHoveredAlertTooltip(null);
                    requestDeleteAlert(alert);
                  }}
                  onHover={(a, rect) => setHoveredAlertTooltip({ alert: a, rect })}
                  onHoverEnd={() => setHoveredAlertTooltip(null)}
                />
              ))}
            </div>
          )
        ) : displayedLogs.length === 0 ? (
          /* Empty State for Log (1:1 TradingView) */
          <div
            data-name="alerts-empty-state"
            className="inner-iMkff_PV flex flex-col items-center justify-center h-full p-8 text-center"
          >
            <div className="container-D6_nhOMF flex flex-col items-center text-center w-full">
              <div className="icon-D6_nhOMF mb-3 flex justify-center">
                <img
                  src="/images/alerts/palm-dark.8ee7531f599adfa7287a.svg"
                  width={120}
                  height={120}
                  alt=""
                  className="select-none pointer-events-none"
                />
              </div>
              <div className="text-D6_nhOMF text-[16px] leading-[24px] text-[var(--vela-fg-bright,#d1d4dc)] max-w-[280px]">
                <p>No alerts triggered yet! You will see a list here when they do.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Log Event List 1:1 TradingView media_1792018906408_620eb2ad.png */
          <div>
            {Object.entries(
              displayedLogs.reduce<Record<string, AlertLogItem[]>>(
                (acc, log) => {
                  const header = formatLogDateHeader(log.timestamp);
                  if (!acc[header]) acc[header] = [];
                  acc[header].push(log);
                  return acc;
                },
                {},
              ),
            ).map(([dateHeader, dayLogs]) => (
              <div key={dateHeader}>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-[var(--vela-fg-muted,#787b86)] tracking-wide uppercase select-none">
                  {dateHeader}
                </div>
                {dayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="px-4 py-2.5 border-b border-[var(--vela-border,#2a2e39)] hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
                  >
                    <div className="text-[14px] text-[var(--vela-fg-bright,#f0f3fa)] font-normal leading-tight mb-1 truncate">
                      {log.message ||
                        `${log.symbol} Crossing ${formatPrice(log.symbol, log.firedPrice)}`}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--vela-fg-muted,#787b86)]">
                      <AlertSymbolIcon symbol={log.symbol} />
                      <span className="text-[var(--vela-fg,#d1d4dc)] font-medium">
                        {log.symbol}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(log.timestamp).toTimeString().slice(0, 8)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 1:1 TradingView Rich Hover Card Tooltip (print_20261015_064350.png) ─── */}
      {hoveredAlertTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none select-none -translate-x-full -translate-y-1/2 flex items-center"
          style={{
            top: hoveredAlertTooltip.rect.top + hoveredAlertTooltip.rect.height / 2,
            left: hoveredAlertTooltip.rect.left - 10,
          }}
        >
          <div className="relative bg-[#2e2e2e] text-[var(--vela-fg-bright,#f0f3fa)] px-3 py-2.5 rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-[#3e424b]/60 flex flex-col gap-1 min-w-[210px] whitespace-nowrap text-left">
            {/* Line 1: SYMBOL Condition PRICE */}
            <div className="text-[13px] leading-tight text-white font-normal">
              <span>{hoveredAlertTooltip.alert.symbol} </span>
              <span className="text-[#f59e0b] font-medium">
                {formatConditionLabel(hoveredAlertTooltip.alert.conditionType)}{" "}
              </span>
              <span>
                {formatPrice(
                  hoveredAlertTooltip.alert.symbol,
                  hoveredAlertTooltip.alert.targetPrice,
                )}
              </span>
            </div>

            {/* Line 2: VENUE:SYMBOL • Status */}
            <div className="flex items-center gap-1.5 text-[12px] leading-tight text-[#d1d4dc]">
              <span>{formatSymbolWithVenue(hoveredAlertTooltip.alert.symbol)}</span>
              <span className="text-[#787b86]">•</span>
              <span
                className={`capitalize font-medium ${
                  hoveredAlertTooltip.alert.status === "active"
                    ? "text-[#089981]"
                    : hoveredAlertTooltip.alert.status === "paused"
                      ? "text-[#f59e0b]"
                      : "text-[#787b86]"
                }`}
              >
                {hoveredAlertTooltip.alert.status === "active"
                  ? "Active"
                  : hoveredAlertTooltip.alert.status === "paused"
                    ? "Paused"
                    : "Triggered"}
              </span>
            </div>

            {/* Line 3: Created: Date */}
            <div className="text-[11px] leading-tight text-[#868993] mt-0.5">
              Created: {formatAlertDate(hoveredAlertTooltip.alert.createdAt)}
            </div>

            {/* Right-pointing Arrow / Caret matching print_20261015_064350.png */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-[1px] w-[6px] h-[10px] pointer-events-none">
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                <path d="M0 0 L6 5 L0 10 Z" fill="#2e2e2e" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 1:1 TradingView Alert Item Card
 * Matches classes, markup, and SVGs extracted from TradingView Desktop:
 * .itemBody-Ou7TqO2N, .description-OuydEyn9, .attributesRow-OuydEyn9, .overlayButtons-Ou7TqO2N
 */
function TradingViewAlertCard({
  alert,
  onEdit,
  onToggle,
  onDelete,
  onHover,
  onHoverEnd,
}: {
  alert: ChartAlert;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onHover: (
    alert: ChartAlert,
    rect: { top: number; left: number; height: number },
  ) => void;
  onHoverEnd: () => void;
}) {
  const isPaused = alert.status === "paused";
  const formattedPrice = formatPrice(alert.symbol, alert.targetPrice);

  return (
    <div
      onClick={onEdit}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(alert, { top: rect.top, left: rect.left, height: rect.height });
      }}
      onMouseLeave={onHoverEnd}
      className={`itemBody-Ou7TqO2N group relative h-[55px] px-4 flex flex-col justify-center border-b border-[var(--vela-border,#2a2e39)] cursor-pointer hover:bg-[var(--vela-hover,rgba(255,255,255,0.04))] transition-colors ${
        isPaused ? "opacity-60" : ""
      }`}
    >
      {/* Top Line: {SYMBOL} Condition {PRICE} (14px font matching print_20261014_180039.png) */}
      <div
        className="description-OuydEyn9 text-[14px] text-[var(--vela-fg-bright,#f0f3fa)] font-normal leading-tight truncate pr-20"
        data-name="alert-item-description"
      >
        {alert.symbol} {formatConditionLabel(alert.conditionType)} {formattedPrice}
      </div>

      {/* Bottom Line: Symbol Badge + Ticker + Dot + Status */}
      <div className="attributesRow-OuydEyn9 flex items-center gap-1.5 mt-1 text-[12px] text-[var(--vela-fg-muted,#787b86)]">
        <AlertSymbolIcon symbol={alert.symbol} />

        <div data-name="alert-item-ticker" className="attribute-OuydEyn9 text-[var(--vela-fg,#d1d4dc)]">
          {alert.symbol}
        </div>

        <span>•</span>

        <span
          className={`attribute-OuydEyn9 status-OuydEyn9 capitalize font-medium ${
            alert.status === "active"
              ? "text-[var(--vela-up,#089981)]"
              : alert.status === "paused"
                ? "text-[#f59e0b]"
                : "text-[var(--vela-fg-muted,#787b86)]"
          }`}
          data-name="alert-item-status"
        >
          {alert.status === "active" ? "Active" : alert.status}
        </span>
      </div>

      {/* Hover Overlay Buttons: Pause, Edit, Delete (Extracted 1:1 SVGs) */}
      <div
        className="overlayButtons-Ou7TqO2N absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-inherit pl-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pause / Resume Button */}
        <button
          type="button"
          title={isPaused ? "Restart" : "Pause"}
          data-name="alert-stop-button"
          onClick={onToggle}
          className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.1))] transition-colors"
        >
          {isPaused ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
            >
              <path
                fill="currentColor"
                d="M9 2a7 7 0 1 0 0 14A7 7 0 0 0 9 2zM1 9a8 8 0 1 1 16 0A8 8 0 0 1 1 9zm5.5 3.5v-7l6 3.5-6 3.5z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
            >
              <path
                fill="currentColor"
                d="M9 2a7 7 0 1 0 0 14A7 7 0 0 0 9 2zM1 9a8 8 0 1 1 16 0A8 8 0 0 1 1 9zm6.5-4c.28 0 .5.22.5.5v7a.5.5 0 0 1-1 0v-7c0-.28.22-.5.5-.5zm3.5.5a.5.5 0 0 0-1 0v7a.5.5 0 0 0 1 0v-7z"
              />
            </svg>
          )}
        </button>

        {/* Edit Button (Hexagon Gear SVG) */}
        <button
          type="button"
          title="Edit"
          data-name="alert-edit-button"
          onClick={onEdit}
          className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.1))] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 18 18"
            width="18"
            height="18"
          >
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M12 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            />
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M4.73 2h8.54L17 9l-3.73 7H4.73L1 9l3.73-7Zm-2.6 7 3.2-6h7.34l3.2 6-3.2 6H5.33l-3.2-6Z"
            />
          </svg>
        </button>

        {/* Delete Button (Trash Can SVG) */}
        <button
          type="button"
          title="Delete"
          data-name="alert-delete-button"
          onClick={onDelete}
          className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg,#d1d4dc)] hover:text-[var(--vela-down,#f23645)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.1))] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 18 18"
            width="18"
            height="18"
          >
            <path
              fill="currentColor"
              d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
