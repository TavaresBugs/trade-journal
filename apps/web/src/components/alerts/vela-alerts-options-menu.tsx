"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChartAlert, AlertLogItem } from "@/lib/alerts/types";

// ─── SVGS EXACT FROM TRADINGVIEW BUNDLE ───────────────────────────────

const RestartAllIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="currentColor"
    className="shrink-0"
  >
    <path
      fillRule="evenodd"
      d="M23 14.5a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0zm1 0a10.5 10.5 0 1 1-21 0 10.5 10.5 0 0 1 21 0zM11.3 9.6l-.8-.6v11l.8-.6 6-4.5.53-.4-.53-.4-6-4.5zm4.87 4.9L11.5 18v-7l4.67 3.5z"
    />
  </svg>
);

const PauseAllIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="currentColor"
    className="shrink-0"
  >
    <path
      fillRule="evenodd"
      d="M13.5 24a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19zm0 1a10.5 10.5 0 1 0 0-21 10.5 10.5 0 0 0 0 21zM11 10h1v9h-1v-9zm5 0h-1v9h1v-9z"
    />
  </svg>
);

const DeleteAllInactiveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="currentColor"
    className="shrink-0"
  >
    <path d="M18 7h5v1h-2.01l-1.33 14.64a1.5 1.5 0 0 1-1.5 1.36H9.84a1.5 1.5 0 0 1-1.49-1.36L7.01 8H5V7h5V6c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v1Zm-6-2a1 1 0 0 0-1 1v1h6V6a1 1 0 0 0-1-1h-4ZM8.02 8l1.32 14.54a.5.5 0 0 0 .5.46h8.33a.5.5 0 0 0 .5-.46L19.99 8H8.02Z" />
  </svg>
);

const CaretIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 8"
    width="16"
    height="8"
    className={`shrink-0 transition-transform text-[var(--vela-fg-muted,#787b86)] ${
      isOpen ? "rotate-0" : "rotate-180"
    }`}
  >
    <path
      fill="currentColor"
      d="M0 1.475l7.396 6.04.596.485.593-.49L16 1.39 14.807 0 7.393 6.122 8.58 6.12 1.186.08z"
    />
  </svg>
);

const CheckmarkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 11 9"
    width="11"
    height="9"
    fill="none"
    className="shrink-0"
  >
    <path
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M1 4.2L3.8 7L9.5 1.2"
    />
  </svg>
);

const SettingsNutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="currentColor"
    className="shrink-0"
  >
    <path
      fillRule="evenodd"
      d="M18 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <path
      fillRule="evenodd"
      d="M8.5 5h11l5 9-5 9h-11l-5-9 5-9Zm-3.86 9L9.1 6h9.82l4.45 8-4.45 8H9.1l-4.45-8Z"
    />
  </svg>
);

const DownloadCsvIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="currentColor"
    className="shrink-0"
  >
    <path d="M15 16.3V5h-1v11.3l-3.15-3.15-.7.7 4 4 .35.36.35-.36 4-4-.7-.7L15 16.29zm-8 4.2V16H6v4.5c0 .83.67 1.5 1.5 1.5h14c.83 0 1.5-.67 1.5-1.5V16h-1v4.5a.5.5 0 0 1-.5.5h-14a.5.5 0 0 1-.5-.5z" />
  </svg>
);

// ─── REUSABLE UI PRIMITIVES ──────────────────────────────────────────

function TradingViewCheckbox({
  checked,
  onChange,
  label,
  rightSlot,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  label: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="px-3 h-[32px] flex items-center justify-between text-[14px] text-[var(--vela-fg-bright,#d1d4dc)] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer select-none transition-colors"
    >
      <div className="flex items-center">
        <div
          className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors mr-2.5 ${
            checked
              ? "bg-[#2962ff] border-[#2962ff] text-white"
              : "border-[#50535e] bg-transparent hover:border-[#868993]"
          }`}
        >
          {checked && <CheckmarkIcon />}
        </div>
        <span>{label}</span>
      </div>
      {rightSlot && (
        <span className="text-[12px] text-[var(--vela-fg-muted,#787b86)]">
          {rightSlot}
        </span>
      )}
    </div>
  );
}

function TradingViewRadio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div
      onClick={onChange}
      className="px-3 h-[32px] flex items-center justify-between text-[14px] text-[var(--vela-fg-bright,#d1d4dc)] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer select-none transition-colors"
    >
      <div className="flex items-center">
        <div
          className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors mr-2.5 ${
            checked
              ? "border-[#2962ff] bg-transparent"
              : "border-[#50535e] bg-transparent hover:border-[#868993]"
          }`}
        >
          {checked && (
            <div className="w-[10px] h-[10px] rounded-full bg-[#2962ff]" />
          )}
        </div>
        <span>{label}</span>
      </div>
    </div>
  );
}

// ─── 1. ALERTS TAB OPTIONS MENU (1:1 TRADINGVIEW print_20261014_194916.png) ─

export interface AlertsOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ChartAlert[];
  filterStatus: "all" | "active" | "paused" | "triggered";
  onSelectFilterStatus: (st: "all" | "active" | "paused") => void;
  filterCurrentSymbol: boolean;
  onToggleFilterCurrentSymbol: () => void;
  filterCurrentInterval: boolean;
  onToggleFilterCurrentInterval: () => void;
  onRestartAllInactive: () => void;
  onPauseAll: () => void;
  onDeleteAllInactive: () => void;
  onOpenAlertsSettings?: () => void;
}

export function VelaAlertsOptionsMenu({
  isOpen,
  onClose,
  alerts,
  filterStatus,
  onSelectFilterStatus,
  filterCurrentSymbol,
  onToggleFilterCurrentSymbol,
  filterCurrentInterval,
  onToggleFilterCurrentInterval,
  onRestartAllInactive,
  onPauseAll,
  onDeleteAllInactive,
  onOpenAlertsSettings,
}: AlertsOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Accordion collapsible states (open by default, 1:1 with TV)
  const [openShowAlerts, setOpenShowAlerts] = useState(true);
  const [openFilterAlerts, setOpenFilterAlerts] = useState(true);
  const [openShowByType, setOpenShowByType] = useState(true);
  const [openCustomizeList, setOpenCustomizeList] = useState(true);

  // Type filter states
  const [typeFilters, setTypeFilters] = useState({
    price: false,
    technicals: false,
    watchlist: false,
  });

  // Customize list visible columns (all true by default 1:1 TV)
  const [customColumns, setCustomColumns] = useState({
    name: true,
    message: true,
    sourceIcon: true,
    instrumentLogo: true,
    lastTriggered: true,
  });

  const activeCount = alerts.filter((a) => a.status === "active").length;
  const inactiveCount = alerts.length - activeCount;

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-[38px] z-50 w-[260px] bg-[var(--vela-surface-elev,#1e222d)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] py-1.5 text-[14px] text-[var(--vela-fg-bright,#d1d4dc)] select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      }}
    >
      {/* ─── SECTION 1: QUICK ACTIONS ─── */}
      <button
        type="button"
        disabled={inactiveCount === 0}
        onClick={() => {
          onRestartAllInactive();
          onClose();
        }}
        className={`w-full h-[32px] px-1 flex items-center text-left text-[14px] hover:bg-[rgba(255,255,255,0.06)] transition-colors ${
          inactiveCount === 0 ? "opacity-40 cursor-default" : "cursor-pointer"
        }`}
      >
        <span className="w-[28px] h-[28px] shrink-0 flex items-center justify-center text-[var(--vela-fg-muted,#787b86)]">
          <RestartAllIcon />
        </span>
        <span className="text-[14px]">Restart all inactive</span>
      </button>

      <button
        type="button"
        disabled={activeCount === 0}
        onClick={() => {
          onPauseAll();
          onClose();
        }}
        className={`w-full h-[32px] px-1 flex items-center text-left text-[14px] hover:bg-[rgba(255,255,255,0.06)] transition-colors ${
          activeCount === 0 ? "opacity-40 cursor-default" : "cursor-pointer"
        }`}
      >
        <span className="w-[28px] h-[28px] shrink-0 flex items-center justify-center text-[var(--vela-fg-muted,#787b86)]">
          <PauseAllIcon />
        </span>
        <span className="text-[14px]">Pause all</span>
      </button>

      <button
        type="button"
        disabled={inactiveCount === 0}
        onClick={() => {
          onDeleteAllInactive();
          onClose();
        }}
        className={`w-full h-[32px] px-1 flex items-center text-left text-[14px] hover:bg-[rgba(255,255,255,0.06)] transition-colors ${
          inactiveCount === 0 ? "opacity-40 cursor-default" : "cursor-pointer"
        }`}
      >
        <span className="w-[28px] h-[28px] shrink-0 flex items-center justify-center text-[var(--vela-fg-muted,#787b86)]">
          <DeleteAllInactiveIcon />
        </span>
        <span className="text-[14px]">Delete all inactive</span>
      </button>

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 2: SHOW ALERTS ─── */}
      <div
        onClick={() => setOpenShowAlerts(!openShowAlerts)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>SHOW ALERTS</span>
        <CaretIcon isOpen={openShowAlerts} />
      </div>

      {openShowAlerts && (
        <div className="py-0.5">
          <TradingViewRadio
            checked={filterStatus === "all"}
            onChange={() => onSelectFilterStatus("all")}
            label="All"
          />
          <TradingViewRadio
            checked={filterStatus === "active"}
            onChange={() => onSelectFilterStatus("active")}
            label="Active only"
          />
          <TradingViewRadio
            checked={filterStatus === "paused"}
            onChange={() => onSelectFilterStatus("paused")}
            label="Inactive only"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 3: FILTER ALERTS ─── */}
      <div
        onClick={() => setOpenFilterAlerts(!openFilterAlerts)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>FILTER ALERTS</span>
        <CaretIcon isOpen={openFilterAlerts} />
      </div>

      {openFilterAlerts && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={filterCurrentSymbol}
            onChange={onToggleFilterCurrentSymbol}
            label="Current symbol"
          />
          <TradingViewCheckbox
            checked={filterCurrentInterval}
            onChange={onToggleFilterCurrentInterval}
            label="Current time interval"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 4: SHOW ALERTS BY TYPE ─── */}
      <div
        onClick={() => setOpenShowByType(!openShowByType)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>SHOW ALERTS BY TYPE</span>
        <CaretIcon isOpen={openShowByType} />
      </div>

      {openShowByType && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={typeFilters.price}
            onChange={(c) => setTypeFilters({ ...typeFilters, price: c })}
            label="Price"
          />
          <TradingViewCheckbox
            checked={typeFilters.technicals}
            onChange={(c) => setTypeFilters({ ...typeFilters, technicals: c })}
            label="Technicals"
          />
          <TradingViewCheckbox
            checked={typeFilters.watchlist}
            onChange={(c) => setTypeFilters({ ...typeFilters, watchlist: c })}
            label="Watchlist"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 5: CUSTOMIZE LIST ─── */}
      <div
        onClick={() => setOpenCustomizeList(!openCustomizeList)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>CUSTOMIZE LIST</span>
        <CaretIcon isOpen={openCustomizeList} />
      </div>

      {openCustomizeList && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={customColumns.name}
            onChange={(c) => setCustomColumns({ ...customColumns, name: c })}
            label="Name"
          />
          <TradingViewCheckbox
            checked={customColumns.message}
            onChange={(c) => setCustomColumns({ ...customColumns, message: c })}
            label="Message"
          />
          <TradingViewCheckbox
            checked={customColumns.sourceIcon}
            onChange={(c) =>
              setCustomColumns({ ...customColumns, sourceIcon: c })
            }
            label="Source icon"
          />
          <TradingViewCheckbox
            checked={customColumns.instrumentLogo}
            onChange={(c) =>
              setCustomColumns({ ...customColumns, instrumentLogo: c })
            }
            label="Instrument logo"
          />
          <TradingViewCheckbox
            checked={customColumns.lastTriggered}
            onChange={(c) =>
              setCustomColumns({ ...customColumns, lastTriggered: c })
            }
            label="Last triggered"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 6: BOTTOM ACTION ─── */}
      <button
        type="button"
        onClick={() => {
          if (onOpenAlertsSettings) onOpenAlertsSettings();
          onClose();
        }}
        className="w-full h-[32px] px-1 flex items-center text-left text-[14px] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer transition-colors"
      >
        <span className="w-[28px] h-[28px] shrink-0 flex items-center justify-center text-[var(--vela-fg-muted,#787b86)]">
          <SettingsNutIcon />
        </span>
        <span className="text-[14px]">Alerts settings...</span>
      </button>
    </div>
  );
}

// ─── 2. LOG TAB OPTIONS MENU (1:1 TRADINGVIEW print_20261014_194930.png) ────

export interface LogOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AlertLogItem[];
  filterCurrentSymbol: boolean;
  onToggleFilterCurrentSymbol: () => void;
  filterCurrentInterval: boolean;
  onToggleFilterCurrentInterval: () => void;
}

export function VelaAlertsLogOptionsMenu({
  isOpen,
  onClose,
  logs,
  filterCurrentSymbol,
  onToggleFilterCurrentSymbol,
  filterCurrentInterval,
  onToggleFilterCurrentInterval,
}: LogOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const [openFilterEvents, setOpenFilterEvents] = useState(true);
  const [openShowEventsByType, setOpenShowEventsByType] = useState(true);
  const [openCustomizeList, setOpenCustomizeList] = useState(true);

  const [eventTypes, setEventTypes] = useState({
    price: false,
    technicals: false,
    watchlist: false,
  });

  const [customColumns, setCustomColumns] = useState({
    name: true,
    message: true,
    instrumentLogo: true,
    webhookStatus: true,
  });

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  // CSV Export (1:1 TradingView exact format from user file)
  const handleDownloadCsv = () => {
    if (logs.length === 0) {
      alert("No logs available to export.");
      onClose();
      return;
    }
    const headers = [
      "Alert ID",
      "Ticker",
      "Name",
      "Description",
      "Time",
      "Webhook status",
    ];
    const rows = logs.map((l) => {
      const alertIdNum =
        l.id.replace(/\D/g, "").slice(0, 10) ||
        `584920${String(l.timestamp).slice(-4)}`;
      const ticker = `CME_MINI:${l.symbol}`;
      const desc = l.message || `${l.symbol} Crossing ${l.firedPrice}`;
      const isoTime = new Date(l.timestamp)
        .toISOString()
        .replace(/\.\d{3}/, "");
      return [
        alertIdNum,
        ticker,
        "",
        `"${desc.replace(/"/g, '""')}"`,
        isoTime,
        "",
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TradingView_Alerts_Log_${new Date()
      .toISOString()
      .slice(0, 10)}_${Math.random().toString(36).slice(2, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-[38px] z-50 w-[260px] bg-[var(--vela-surface-elev,#1e222d)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] py-1.5 text-[14px] text-[var(--vela-fg-bright,#d1d4dc)] select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      }}
    >
      {/* ─── SECTION 1: DOWNLOAD LOG AS CSV ─── */}
      <button
        type="button"
        onClick={handleDownloadCsv}
        className="w-full h-[32px] px-1 flex items-center text-left text-[14px] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer transition-colors"
      >
        <span className="w-[28px] h-[28px] shrink-0 flex items-center justify-center text-[var(--vela-fg-muted,#787b86)]">
          <DownloadCsvIcon />
        </span>
        <span className="text-[14px]">Download log as CSV</span>
      </button>

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 2: FILTER EVENTS ─── */}
      <div
        onClick={() => setOpenFilterEvents(!openFilterEvents)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>FILTER EVENTS</span>
        <CaretIcon isOpen={openFilterEvents} />
      </div>

      {openFilterEvents && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={filterCurrentSymbol}
            onChange={onToggleFilterCurrentSymbol}
            label="Current symbol"
          />
          <TradingViewCheckbox
            checked={filterCurrentInterval}
            onChange={onToggleFilterCurrentInterval}
            label="Current time interval"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 3: SHOW EVENTS BY TYPE ─── */}
      <div
        onClick={() => setOpenShowEventsByType(!openShowEventsByType)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>SHOW EVENTS BY TYPE</span>
        <CaretIcon isOpen={openShowEventsByType} />
      </div>

      {openShowEventsByType && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={eventTypes.price}
            onChange={(c) => setEventTypes({ ...eventTypes, price: c })}
            label="Price"
          />
          <TradingViewCheckbox
            checked={eventTypes.technicals}
            onChange={(c) => setEventTypes({ ...eventTypes, technicals: c })}
            label="Technicals"
          />
          <TradingViewCheckbox
            checked={eventTypes.watchlist}
            onChange={(c) => setEventTypes({ ...eventTypes, watchlist: c })}
            label="Watchlist"
          />
        </div>
      )}

      <div className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-1.5" />

      {/* ─── SECTION 4: CUSTOMIZE LIST ─── */}
      <div
        onClick={() => setOpenCustomizeList(!openCustomizeList)}
        className="px-3 h-[28px] flex items-center justify-between text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)] uppercase tracking-wider cursor-pointer hover:text-[var(--vela-fg-bright,#f0f3fa)]"
      >
        <span>CUSTOMIZE LIST</span>
        <CaretIcon isOpen={openCustomizeList} />
      </div>

      {openCustomizeList && (
        <div className="py-0.5">
          <TradingViewCheckbox
            checked={customColumns.name}
            onChange={(c) => setCustomColumns({ ...customColumns, name: c })}
            label="Name"
          />
          <TradingViewCheckbox
            checked={customColumns.message}
            onChange={(c) => setCustomColumns({ ...customColumns, message: c })}
            label="Message"
          />
          <TradingViewCheckbox
            checked={customColumns.instrumentLogo}
            onChange={(c) =>
              setCustomColumns({ ...customColumns, instrumentLogo: c })
            }
            label="Instrument logo"
          />
          <TradingViewCheckbox
            checked={customColumns.webhookStatus}
            onChange={(c) =>
              setCustomColumns({ ...customColumns, webhookStatus: c })
            }
            label="Webhook status"
          />
        </div>
      )}
    </div>
  );
}

// ─── 3. SORT MENU (1:1 TRADINGVIEW print_20261014_195209.png) ───────────────

export type AlertSortOption =
  | "symbol_asc"
  | "symbol_desc"
  | "name_asc"
  | "name_desc"
  | "message_asc"
  | "message_desc"
  | "date_created_asc"
  | "date_created_desc"
  | "time_triggering_asc"
  | "time_triggering_desc";

export interface SortOptionItem {
  id: AlertSortOption;
  label: string;
  dir: "asc" | "desc";
}

export const SORT_ITEMS: (SortOptionItem | "separator")[] = [
  { id: "symbol_asc", label: "Symbol (A to Z)", dir: "asc" },
  { id: "symbol_desc", label: "Symbol (Z to A)", dir: "desc" },
  "separator",
  { id: "name_asc", label: "Name (A to Z)", dir: "asc" },
  { id: "name_desc", label: "Name (Z to A)", dir: "desc" },
  "separator",
  { id: "message_asc", label: "Message (A to Z)", dir: "asc" },
  { id: "message_desc", label: "Message (Z to A)", dir: "desc" },
  "separator",
  { id: "date_created_asc", label: "Date created (oldest first)", dir: "asc" },
  { id: "date_created_desc", label: "Date created (newest first)", dir: "desc" },
  "separator",
  {
    id: "time_triggering_asc",
    label: "Time triggering (oldest first)",
    dir: "asc",
  },
  {
    id: "time_triggering_desc",
    label: "Time triggering (newest first)",
    dir: "desc",
  },
];

export const SortAscIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 18.5h-3M21.5 13.5h-5M23.5 8.5h-7M8.5 20.5V7M12.5 11l-4-4-4 4"
    />
  </svg>
);

export const SortDescIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 18.5h-3M21.5 13.5h-5M23.5 8.5h-7M8.5 7v13.5M4.5 16.5l4 4 4-4"
    />
  </svg>
);

export function VelaAlertsSortMenu({
  isOpen,
  onClose,
  selectedSort,
  onSelectSort,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedSort: AlertSortOption;
  onSelectSort: (opt: AlertSortOption) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      data-role="menu"
      className="absolute right-9 top-[38px] z-50 w-[260px] bg-[var(--vela-surface-elev,#1e222d)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] py-[6px] text-[14px] text-[var(--vela-fg-bright,#d1d4dc)] select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      }}
    >
      <div className="menuBox-lBIxIwtz">
        {SORT_ITEMS.map((item, idx) => {
          if (item === "separator") {
            return (
              <div
                key={`sep-${idx}`}
                role="separator"
                className="h-[1px] bg-[var(--vela-border,#2a2e39)] my-[6px]"
              />
            );
          }
          const isSelected = selectedSort === item.id;
          return (
            <div
              key={item.id}
              role="menuitemradio"
              data-role="menuitem"
              data-active={isSelected}
              aria-checked={isSelected}
              onClick={() => {
                onSelectSort(item.id);
                onClose();
              }}
              className={`h-[32px] px-1 flex items-center cursor-default transition-colors ${
                isSelected
                  ? "bg-[#2e2e2e] text-white"
                  : "text-[var(--vela-fg-bright,#d1d4dc)] hover:bg-[rgba(255,255,255,0.06)]"
              }`}
            >
              <div className="labelWrap-Llw4m9HW flex items-center w-full">
                <span
                  role="img"
                  className="icon-Llw4m9HW shrink-0 w-[28px] h-[28px] flex items-center justify-center"
                  aria-hidden="true"
                >
                  {item.dir === "asc" ? <SortAscIcon /> : <SortDescIcon />}
                </span>
                <span className="text-Llw4m9HW text-[14px] leading-normal truncate">
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

