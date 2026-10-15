"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePaperTrading } from "@/lib/paper-trading/use-paper-trading";
import { formatPrice } from "@/lib/paper-trading/symbol-specs";
import { ReplayEmptyState } from "./replay-empty-state";
import { ReplayStrategyReport } from "./replay-strategy-report";
import { ReplayTradesList, downloadTradesCsv } from "./replay-trades-list";
import { FloatingPortalPopover } from "./floating-portal-popover";

const BOTTOM_SUBTAB_STORAGE_KEY = "tradejournal_replay_bottom_subtab_v1";

export interface PaperTradingBottomPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  isReplayMode?: boolean;
  onExitReplay?: () => void;
  onHeightChange?: (height: number) => void;
  onNavigateToTrade?: (timestamp: number, type: "entry" | "exit", price?: number) => void;
}

type ReplaySubTabType = "strategy_report" | "trades_list" | "open_positions";

export function VelaPaperTradingBottomPanel({
  isOpen,
  onToggle,
  className = "",
  onHeightChange,
  onNavigateToTrade,
}: PaperTradingBottomPanelProps) {
  const {
    account,
    positions,
    closedTrades,
    closePosition,
    reversePosition,
    resetAccount,
  } = usePaperTrading();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Replay internal toolbar tabs: Strategy report vs List of Trades (ReportTabId)
  const [replaySubTab, setReplaySubTabState] = useState<ReplaySubTabType>("strategy_report");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BOTTOM_SUBTAB_STORAGE_KEY);
      if (saved === "trades" || saved === "trades_list") {
        setReplaySubTabState("trades_list");
      } else if (saved === "report" || saved === "strategy_report") {
        setReplaySubTabState("strategy_report");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setReplaySubTab = useCallback((nextTab: ReplaySubTabType) => {
    setReplaySubTabState(nextTab);
    if (nextTab === "strategy_report" || nextTab === "trades_list") {
      try {
        window.localStorage.setItem(
          BOTTOM_SUBTAB_STORAGE_KEY,
          nextTab === "trades_list" ? "trades" : "report"
        );
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  // Maximize / Custom height state
  const [isMaximized, setIsMaximized] = useState(false);
  const [customHeight, setCustomHeight] = useState<number>(300);
  const [isResizing, setIsResizing] = useState(false);

  // Settings Modal state (from Context Menu -> Settings…)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [initialBalanceInput, setInitialBalanceInput] = useState<number>(100000);

  // Replay Context Menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const effectiveHeight = !isOpen ? 39 : isMaximized ? 540 : customHeight;

  // Notify height change if requested
  useEffect(() => {
    onHeightChange?.(effectiveHeight);
  }, [effectiveHeight, onHeightChange]);

  // Top edge vertical resize handler
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startHeight = isMaximized ? 540 : customHeight;
      setIsMaximized(false);
      setIsResizing(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const maxAllowed =
          typeof window !== "undefined" ? Math.max(320, window.innerHeight - 120) : 720;
        const nextHeight = Math.min(maxAllowed, Math.max(160, startHeight + deltaY));
        setCustomHeight(nextHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [customHeight, isMaximized]
  );

  const positionList = Object.values(positions);

  // When panel is collapsed (height 39px — 1:1 with .quant-side-rail-cap-foot)
  if (!isOpen) {
    return (
      <div
        className={`vela-paper-trading-bottom-panel is-collapsed relative w-full shrink-0 z-20 h-[39px] box-border bg-[#151619] border-t border-[#2a2b30] flex items-center justify-between px-2 text-xs text-[#9a9ea8] select-none ${className}`}
        style={{ height: "var(--quant-rail-cap, 39px)" }}
      >
        {/* Left Tabs Bar */}
        <div className="flex items-center h-full gap-1">
          {/* Tab 1: Replay Trading */}
          <button
            type="button"
            data-qa-id="replay_trading"
            data-active="true"
            onClick={onToggle}
            className="flex items-center gap-1.5 h-full px-2.5 font-medium text-[#f0f3fa] hover:bg-white/[0.04] rounded transition-colors"
            title="Expand Replay Trading"
          >
            <span className="w-2 h-2 rounded-full bg-[#089981]" />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              className="text-[#f0f3fa]"
            >
              <path
                fill="currentColor"
                d="M10.67 6.67v10.66L5.33 12zM16 6.67v10.66L10.67 12z"
              />
            </svg>
            <span className="font-semibold text-xs tracking-tight">Replay Trading</span>
          </button>
        </div>

        {/* Right Financial & Controls Bar */}
        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-3 font-mono text-[11px]"
            suppressHydrationWarning
          >
            <span>
              Equity:{" "}
              <b className="text-white">
                $
                {mounted
                  ? account.equity.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "100,000.00"}
              </b>
            </span>
            <span>
              Realized:{" "}
              <b
                className={
                  (mounted ? account.realizedPnL : 0) >= 0
                    ? "text-[#089981]"
                    : "text-[#f23645]"
                }
              >
                {(mounted ? account.realizedPnL : 0) >= 0 ? "+" : ""}
                $
                {mounted
                  ? account.realizedPnL.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "0.00"}
              </b>
            </span>
          </div>

          <div className="buttons-tQ8Kilpy flex items-center gap-0.5">
            {/* Expand/Collapse Panel Button */}
            <button
              type="button"
              data-name="toggle-visibility-button"
              data-tooltip="Expand panel"
              onClick={onToggle}
              className="flex items-center justify-center w-[28px] h-[28px] text-[#9a9ea8] hover:text-white hover:bg-white/5 rounded transition-colors"
              title="Expand panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
              >
                <path fill="currentColor" d="M7 20h14v1H7z" />
              </svg>
            </button>

            {/* Maximize panel Button */}
            <button
              type="button"
              data-name="toggle-maximize-button"
              data-tooltip="Maximize panel"
              onClick={() => {
                setIsMaximized(true);
                onToggle();
              }}
              className="flex items-center justify-center w-[28px] h-[28px] text-[#9a9ea8] hover:text-white hover:bg-white/5 rounded transition-colors"
              title="Maximize panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
              >
                <path
                  fill="currentColor"
                  d="M7 15v6h6v1H6v-7zm15-9v7h-1V7h-6V6z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height: `${effectiveHeight}px` }}
      className={`vela-paper-trading-bottom-panel relative w-full shrink-0 bg-[#151619] border-t border-[#2a2b30] shadow-2xl flex flex-col z-20 text-white select-none ${
        isResizing ? "transition-none" : "transition-[height] duration-150"
      } ${className}`}
    >
      {/* Top Edge Resize Handle (ns-resize) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize panel"
        onMouseDown={handleResizeMouseDown}
        className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-30 group flex items-center justify-center"
      >
        <div className="w-full h-[2px] bg-transparent group-hover:bg-[#2962ff]/70 transition-colors" />
      </div>

      {/* 1. Header do Footer Panel (altura: 39px — 1:1 com .quant-side-rail-cap-foot) */}
      <div
        id="footer-chart-panel"
        className="h-[39px] shrink-0 box-border flex items-center justify-between px-2 bg-[#18191d] border-b border-[#2a2b30] text-xs text-[#9a9ea8]"
        style={{ height: "var(--quant-rail-cap, 39px)" }}
      >
        {/* Left Tabs Bar */}
        <div className="flex items-center h-full relative">
          {/* Tab 1: Replay Trading Tab */}
          <div className="flex items-center h-full text-[#f0f3fa]">
            <button
              type="button"
              data-qa-id="replay_trading"
              data-active="true"
              className="flex items-center gap-1.5 h-7 px-2 rounded-[6px] font-medium transition-colors bg-white/[0.06] text-[#f0f3fa]"
            >
              {/* Green indicator dot */}
              <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
              {/* Double Arrow Replay SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                className="text-[#f0f3fa]"
              >
                <path
                  fill="currentColor"
                  d="M10.67 6.67v10.66L5.33 12zM16 6.67v10.66L10.67 12z"
                />
              </svg>
              <span className="font-semibold text-xs tracking-tight">Replay Trading</span>
            </button>

            {/* Caret Button for Context Menu ∨ */}
            <div
              className="relative pr-1 ml-0.5"
              ref={contextMenuRef}
              data-qa-id="replay-open-context-menu"
            >
              <button
                type="button"
                data-qa-id="tab-menu-trigger"
                aria-expanded={contextMenuOpen}
                aria-haspopup="menu"
                onClick={() => setContextMenuOpen((prev) => !prev)}
                className={`flex items-center justify-center w-[22px] h-[22px] rounded transition-colors ${
                  contextMenuOpen
                    ? "bg-white/[0.1] text-[#f0f3fa]"
                    : "text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-white/[0.06]"
                }`}
                title="Open context menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 8"
                  width="10"
                  height="5"
                  className={`transition-transform duration-150 ${
                    contextMenuOpen ? "rotate-180" : ""
                  }`}
                >
                  <path
                    fill="currentColor"
                    d="M0 1.475l7.396 6.04.596.485.593-.49L16 1.39 14.807 0 7.393 6.122 8.58 6.12 1.186.08z"
                  />
                </svg>
              </button>

              {/* Context Dropdown Menu 1:1 with TradingView */}
              <FloatingPortalPopover
                isOpen={contextMenuOpen}
                anchorRef={contextMenuRef}
                onClose={() => setContextMenuOpen(false)}
                preferredPlacement="bottom"
                align="left"
                offset={4}
                dataQaId="tab-menu-popover"
                role="menu"
                className="w-[234px] rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl py-1.5 px-1 text-[13px]"
              >
                {/* Item 1: Settings… */}
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Settings…"
                  onClick={() => {
                    setContextMenuOpen(false);
                    setSettingsModalOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-[5px] hover:bg-[#2a2b30] text-[#f0f3fa] transition-colors flex items-center gap-2.5"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 18 18"
                    width="18"
                    height="18"
                    className="text-[#d1d4dc] shrink-0"
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
                  <span className="truncate">Settings…</span>
                </button>

                {/* Item 2: Download data as XLSX / CSV */}
                <button
                  type="button"
                  role="menuitem"
                  aria-label="Download data as XLSX"
                  onClick={() => {
                    downloadTradesCsv(closedTrades, initialBalanceInput);
                    setContextMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-[5px] hover:bg-[#2a2b30] text-[#f0f3fa] transition-colors flex items-center gap-2.5"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 28 28"
                    width="18"
                    height="18"
                    fill="none"
                    className="text-[#d1d4dc] shrink-0"
                  >
                    <path
                      fill="currentColor"
                      d="M7 17v4.5a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5V17h1v4.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 6 21.5V17zm8-11v11.293l3.146-3.146.707.707-4.353 4.353-4.353-4.353.707-.707L14 17.293V6z"
                    />
                  </svg>
                  <span className="truncate">Download data as XLSX</span>
                </button>

                <div className="my-1 border-t border-[#2a2b30]" />

                {/* Item 3: Reset account balance ($100k) */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    resetAccount(100000);
                    setInitialBalanceInput(100000);
                    setContextMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-[5px] hover:bg-[#2a2b30] text-[#f0f3fa] transition-colors flex items-center justify-between"
                >
                  <span>Reset account balance</span>
                  <span className="text-[11px] text-[#9a9ea8] font-mono">$100k</span>
                </button>
              </FloatingPortalPopover>
            </div>
          </div>
        </div>

        {/* Right Financial Metrics & Window Controls */}
        <div className="flex items-center gap-3">
          <div
            className="hidden md:flex items-center gap-4 font-mono text-[11px]"
            suppressHydrationWarning
          >
            <div>
              <span className="text-[#9a9ea8]">Equity: </span>
              <span className="font-semibold text-white">
                $
                {mounted
                  ? account.equity.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "100,000.00"}
              </span>
            </div>
            <div>
              <span className="text-[#9a9ea8]">Realized: </span>
              <span
                className={`font-semibold ${
                  (mounted ? account.realizedPnL : 0) >= 0
                    ? "text-[#089981]"
                    : "text-[#f23645]"
                }`}
              >
                {(mounted ? account.realizedPnL : 0) >= 0 ? "+" : ""}
                $
                {mounted
                  ? account.realizedPnL.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "0.00"}
              </span>
            </div>
          </div>

          <div className="buttons-tQ8Kilpy flex items-center gap-0.5">
            {/* Collapse panel Button */}
            <button
              type="button"
              data-name="toggle-visibility-button"
              data-tooltip="Collapse panel"
              onClick={onToggle}
              className="flex items-center justify-center w-[28px] h-[28px] text-[#9a9ea8] hover:text-white hover:bg-white/5 rounded transition-colors"
              title="Collapse panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
              >
                <path fill="currentColor" d="M7 20h14v1H7z" />
              </svg>
            </button>

            {/* Maximize panel Button */}
            <button
              type="button"
              data-name="toggle-maximize-button"
              data-tooltip={isMaximized ? "Restore panel" : "Maximize panel"}
              onClick={() => setIsMaximized((prev) => !prev)}
              className="flex items-center justify-center w-[28px] h-[28px] text-[#9a9ea8] hover:text-white hover:bg-white/5 rounded transition-colors"
              title={isMaximized ? "Restore panel" : "Maximize panel"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
              >
                {isMaximized ? (
                  <path
                    fill="currentColor"
                    d="M13 15v6h-1v-5H7v-1h6zm2-2V7h1v5h5v1h-6z"
                  />
                ) : (
                  <path
                    fill="currentColor"
                    d="M7 15v6h6v1H6v-7zm15-9v7h-1V7h-6V6z"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Dialog Modal (Triggered via Settings… in Replay Context Menu) */}
      {settingsModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
            <div className="w-[340px] rounded-[10px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl p-4 text-xs text-[#f0f3fa]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2a2b30]">
                <span className="text-[14px] font-semibold">Replay Trading Settings</span>
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#2a2b30] text-[#9a9ea8] hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[#9a9ea8] mb-1">
                    Initial Account Balance (USD)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={initialBalanceInput}
                    onChange={(e) =>
                      setInitialBalanceInput(Math.max(1000, Number(e.target.value) || 100000))
                    }
                    className="w-full h-8 px-2.5 rounded-[6px] bg-[#151619] border border-[#2a2b30] text-[#f0f3fa] font-mono text-xs focus:outline-none focus:border-[#2962ff]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
                    className="px-3 py-1.5 rounded-[6px] border border-[#2a2b30] bg-transparent hover:bg-[#2a2b30] text-[#d1d4dc]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetAccount(initialBalanceInput);
                      setSettingsModalOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-[6px] bg-[#2962ff] hover:bg-[#1e53e5] text-white font-medium"
                  >
                    Apply & Reset
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 2. Main Content Area */}
      <div id="bottom-area" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden bg-[#151619]">
          {/* Toolbar Interna com Abas Compactas de Ícone 1:1 (lightTabs-QxCHfVYN) */}
          <div
            data-qa-id="backtesting-report-toolbar"
            className="min-h-[44px] py-1.5 shrink-0 flex items-center justify-between px-5 bg-[#151619] text-xs overflow-visible"
          >
              {/* Left Sub-tabs: Compact Icon Pill Group (Strategy report & List of Trades) */}
              <div
                data-name="light-tabs-buttons"
                data-qa-id="backtesting-report-toolbar-tabs"
                className="flex items-center gap-2"
              >
                <div
                  id="report-tabs"
                  role="tablist"
                  aria-orientation="horizontal"
                  className="inline-flex items-center gap-[2px] bg-[#1e1f24] p-[3px] rounded-[8px] border border-[#2a2b30]/80 shadow-sm"
                >
                  {/* 1. Strategy report Icon Button (28x28) */}
                  <button
                    type="button"
                    role="tab"
                    data-name="light-tab-0"
                    id="Strategy report"
                    aria-selected={replaySubTab === "strategy_report"}
                    onClick={() => setReplaySubTab("strategy_report")}
                    className={`w-[28px] h-[28px] flex items-center justify-center rounded-[5px] transition-colors ${
                      replaySubTab === "strategy_report"
                        ? "bg-[#2a2b30] text-[#f0f3fa] shadow-sm"
                        : "text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-white/[0.04]"
                    }`}
                    title="Strategy report"
                    aria-label="Strategy report"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        d="m16.001 7.05-4.81 4.887-4.308-3.835-3.81 3.899L2 10.95l4.81-4.92 4.312 3.838 3.81-3.87z"
                      />
                    </svg>
                  </button>

                  {/* 2. List of Trades Icon Button (28x28) */}
                  <button
                    type="button"
                    role="tab"
                    data-name="light-tab-1"
                    id="List of Trades"
                    aria-selected={replaySubTab === "trades_list"}
                    onClick={() => setReplaySubTab("trades_list")}
                    className={`w-[28px] h-[28px] flex items-center justify-center rounded-[5px] transition-colors ${
                      replaySubTab === "trades_list"
                        ? "bg-[#2a2b30] text-[#f0f3fa] shadow-sm"
                        : "text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-white/[0.04]"
                    }`}
                    title="List of Trades"
                    aria-label="List of Trades"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        d="M14.653 3.008A1.5 1.5 0 0 1 16 4.5v10l-.008.153a1.5 1.5 0 0 1-1.339 1.34L14.5 16h-11a1.5 1.5 0 0 1-1.492-1.347L2 14.5v-10A1.5 1.5 0 0 1 3.5 3h11zM3 14.5a.5.5 0 0 0 .5.5H6v-3H3zm4 .5h7.5a.5.5 0 0 0 .5-.5V12H7zm-4-4h3V8H3zm4 0h8V8H7zM3.5 4a.5.5 0 0 0-.5.5V7h3V4zM7 7h8V4.5a.5.5 0 0 0-.5-.5H7z"
                      />
                    </svg>
                  </button>
                </div>

                {/* 3. Open Positions Pill (only shown when there are active open positions) */}
                {positionList.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    id="Open Positions"
                    aria-selected={replaySubTab === "open_positions"}
                    onClick={() => setReplaySubTab("open_positions")}
                    className={`flex items-center gap-1.5 h-[28px] px-2.5 rounded-[6px] text-xs font-medium transition-colors border border-[#2a2b30]/60 ${
                      replaySubTab === "open_positions"
                        ? "bg-[#2a2b30] text-[#f0f3fa]"
                        : "bg-[#1e1f24] text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-[#2a2b30]/60"
                    }`}
                  >
                    <span>Positions</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#2962ff] text-white font-mono">
                      {positionList.length}
                    </span>
                  </button>
                )}
              </div>

              <div data-qa-id="backtesting-report-toolbar-end" />
            </div>

            {/* Sub-tab Body Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* If user clicked Open Positions tab */}
              {replaySubTab === "open_positions" ? (
                <div className="flex-1 overflow-y-auto px-5 py-2 font-mono text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[#9a9ea8] text-[11px] border-b border-[#2a2b30]">
                        <th className="pb-1.5">Symbol</th>
                        <th className="pb-1.5">Side</th>
                        <th className="pb-1.5">Qty</th>
                        <th className="pb-1.5">Avg Price</th>
                        <th className="pb-1.5">Current Price</th>
                        <th className="pb-1.5">Unrealized PnL</th>
                        <th className="pb-1.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2025]">
                      {positionList.map((pos) => {
                        const isLong = pos.side === "long";
                        const isProfit = pos.unrealizedPnL >= 0;
                        return (
                          <tr key={pos.id} className="hover:bg-white/[0.02]">
                            <td className="py-1.5 font-bold text-white">{pos.symbol}</td>
                            <td className="py-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${
                                  isLong ? "bg-[#2962ff]" : "bg-[#f23645]"
                                }`}
                              >
                                {pos.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-1.5 text-white">{pos.qty}</td>
                            <td className="py-1.5">{formatPrice(pos.symbol, pos.avgPrice)}</td>
                            <td className="py-1.5">{formatPrice(pos.symbol, pos.currentPrice)}</td>
                            <td
                              className={`py-1.5 font-semibold ${
                                isProfit ? "text-[#089981]" : "text-[#f23645]"
                              }`}
                            >
                              {isProfit ? `+${pos.unrealizedPnL.toFixed(2)}` : pos.unrealizedPnL.toFixed(2)} USD
                            </td>
                            <td className="py-1.5 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => reversePosition(pos.symbol)}
                                className="px-2 py-0.5 rounded text-[10px] bg-[#2962ff]/20 text-[#38c0fd] hover:bg-[#2962ff]/40"
                              >
                                Reverse
                              </button>
                              <button
                                type="button"
                                onClick={() => closePosition(pos.symbol)}
                                className="px-2 py-0.5 rounded text-[10px] bg-[#f23645]/20 text-[#f23645] hover:bg-[#f23645]/40"
                              >
                                Close ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : closedTrades.length === 0 ? (
                /* 3. Empty State Oficial quando não há trades executados */
                <ReplayEmptyState />
              ) : replaySubTab === "strategy_report" ? (
                /* 4. Visão de Dados: Strategy report */
                <ReplayStrategyReport
                  closedTrades={closedTrades}
                  initialBalance={initialBalanceInput}
                />
              ) : (
                /* 4. Visão de Dados: List of Trades */
                <ReplayTradesList
                  closedTrades={closedTrades}
                  initialBalance={initialBalanceInput}
                  onNavigateToTrade={onNavigateToTrade}
                />
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
