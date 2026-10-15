"use client";

import React, { useState, useRef, useEffect } from "react";
import { type ClosedTrade } from "@/lib/paper-trading/types";
import { getPaperInstrumentSpec } from "@/lib/paper-trading/symbol-specs";
import { FloatingPortalPopover } from "./floating-portal-popover";

const TRADES_COLS_STORAGE_KEY = "tradejournal_replay_trades_cols_v1";

export interface ReplayTradesListProps {
  closedTrades: ClosedTrade[];
  initialBalance?: number;
  onNavigateToTrade?: (timestamp: number, type: "entry" | "exit", price?: number) => void;
}

export type TradeColumnKey =
  | "dateTime"
  | "orderType"
  | "price"
  | "size"
  | "netPnl"
  | "returnPct"
  | "commission"
  | "favorableExcursion"
  | "adverseExcursion"
  | "cumulativePnl"
  | "durationBars";

interface ColumnOption {
  key: TradeColumnKey;
  label: string;
  qaId: string;
  defaultChecked: boolean;
}

const COLUMN_SETUP_OPTIONS: ColumnOption[] = [
  { key: "dateTime", label: "Date and time", qaId: "datetime-menu-item", defaultChecked: true },
  { key: "orderType", label: "Order type", qaId: "signal-menu-item", defaultChecked: false },
  { key: "price", label: "Price", qaId: "price-menu-item", defaultChecked: true },
  { key: "size", label: "Size", qaId: "positionSize-menu-item", defaultChecked: true },
  { key: "netPnl", label: "Net PnL", qaId: "profit-menu-item", defaultChecked: true },
  { key: "returnPct", label: "Return", qaId: "return-menu-item", defaultChecked: true },
  { key: "commission", label: "Commission", qaId: "commission-menu-item", defaultChecked: false },
  { key: "favorableExcursion", label: "Favorable excursion", qaId: "runup-menu-item", defaultChecked: false },
  { key: "adverseExcursion", label: "Adverse excursion", qaId: "drawdown-menu-item", defaultChecked: false },
  { key: "cumulativePnl", label: "Cumulative PnL", qaId: "cumulativeProfit-menu-item", defaultChecked: false },
  { key: "durationBars", label: "Duration (bars)", qaId: "duration-menu-item", defaultChecked: false },
];

function formatFormattedPrice(symbol: string, price: number): string {
  const spec = getPaperInstrumentSpec(symbol);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: spec.decimals,
    maximumFractionDigits: spec.decimals,
  });
}

function formatNotionalCompact(symbol: string, entryPrice: number, qty: number): string {
  const spec = getPaperInstrumentSpec(symbol);
  const notional = Math.abs(entryPrice * spec.pointValue * qty);
  if (notional >= 1_000_000) {
    return `${Number((notional / 1_000_000).toFixed(2))}M`;
  }
  if (notional >= 1_000) {
    return `${Number((notional / 1_000).toFixed(2))}K`;
  }
  return notional.toFixed(2);
}

function formatTradeDateTime(timestamp: number): string {
  if (!timestamp) return "—";
  // Handle both seconds and milliseconds timestamps
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  const d = new Date(ms);
  const isMidnight =
    (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) ||
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0);

  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isMidnight) {
    return datePart;
  }

  const timePart = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${datePart}, ${timePart}`;
}

function estimateDurationBars(entryTime: number, exitTime: number): number {
  const msEntry = entryTime < 1e11 ? entryTime * 1000 : entryTime;
  const msExit = exitTime < 1e11 ? exitTime * 1000 : exitTime;
  const diffMs = Math.max(0, msExit - msEntry);
  if (diffMs === 0) return 1;
  // If >= 1 day, estimate trading days, otherwise minutes/5m bars
  if (diffMs >= 86_400_000) {
    return Math.max(1, Math.round(diffMs / 86_400_000));
  }
  return Math.max(1, Math.round(diffMs / 60_000));
}

export function downloadTradesCsv(closedTrades: ClosedTrade[], initialBalance = 100000) {
  const headers = [
    "Trade #",
    "Type",
    "Side",
    "Date and time",
    "Order type",
    "Price (USD)",
    "Size (Contracts)",
    "Size (USD)",
    "Net PnL (USD)",
    "Return (%)",
    "Commission (USD)",
    "Favorable excursion (USD)",
    "Favorable excursion (%)",
    "Adverse excursion (USD)",
    "Adverse excursion (%)",
    "Cumulative PnL (USD)",
    "Cumulative PnL (%)",
    "Duration (bars)",
  ];

  const sortedAsc = [...closedTrades].sort((a, b) => a.tradeNumber - b.tradeNumber);
  const rows: string[][] = [];

  for (const t of sortedAsc) {
    const spec = getPaperInstrumentSpec(t.symbol);
    const notional = Math.abs(t.entryPrice * spec.pointValue * t.qty);
    const isLong = t.side === "long";
    const entryOrderLabel = t.signal || (isLong ? "Buy market order" : "Sell market order");
    const exitOrderLabel = "Close";
    const favUsd = t.profit > 0 ? t.profit : 0;
    const favPct = t.profit > 0 ? t.profitPercent : 0;
    const advUsd = t.profit < 0 ? t.profit : 0;
    const advPct = t.profit < 0 ? t.profitPercent : 0;
    const cumPct = initialBalance > 0 ? (t.cumProfit / initialBalance) * 100 : 0;
    const duration = estimateDurationBars(t.entryTime, t.exitTime);

    // Entry row
    rows.push([
      String(t.tradeNumber),
      "Entry",
      isLong ? "Long" : "Short",
      `"${formatTradeDateTime(t.entryTime)}"`,
      `"${entryOrderLabel}"`,
      t.entryPrice.toFixed(spec.decimals),
      String(t.qty),
      notional.toFixed(2),
      t.profit.toFixed(2),
      t.profitPercent.toFixed(2),
      "0.00",
      favUsd.toFixed(2),
      favPct.toFixed(2),
      advUsd.toFixed(2),
      advPct.toFixed(2),
      t.cumProfit.toFixed(2),
      cumPct.toFixed(2),
      String(duration),
    ]);

    // Exit row
    rows.push([
      String(t.tradeNumber),
      "Exit",
      isLong ? "Long" : "Short",
      `"${formatTradeDateTime(t.exitTime)}"`,
      `"${exitOrderLabel}"`,
      t.exitPrice.toFixed(spec.decimals),
      String(t.qty),
      notional.toFixed(2),
      t.profit.toFixed(2),
      t.profitPercent.toFixed(2),
      "0.00",
      favUsd.toFixed(2),
      favPct.toFixed(2),
      advUsd.toFixed(2),
      advPct.toFixed(2),
      t.cumProfit.toFixed(2),
      cumPct.toFixed(2),
      String(duration),
    ]);
  }

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `Replay_Trading_Trades_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReplayTradesList({
  closedTrades,
  initialBalance = 100000,
  onNavigateToTrade,
}: ReplayTradesListProps) {
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<"csv" | "columns" | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<TradeColumnKey, boolean>>(() => {
    const initial = {} as Record<TradeColumnKey, boolean>;
    for (const col of COLUMN_SETUP_OPTIONS) {
      initial[col.key] = col.defaultChecked;
    }
    return initial;
  });

  const csvBtnRef = useRef<HTMLDivElement>(null);
  const colSetupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRADES_COLS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setVisibleColumns((prev) => {
            const next = { ...prev };
            for (const col of COLUMN_SETUP_OPTIONS) {
              if (typeof parsed[col.key] === "boolean") {
                next[col.key] = parsed[col.key];
              }
            }
            return next;
          });
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleColumn = (key: TradeColumnKey) => {
    setVisibleColumns((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      };
      try {
        window.localStorage.setItem(TRADES_COLS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const sortedTrades = [...closedTrades].sort((a, b) => {
    return sortOrder === "asc"
      ? a.tradeNumber - b.tradeNumber
      : b.tradeNumber - a.tradeNumber;
  });

  return (
    <div className="flex-1 flex flex-col select-none overflow-hidden bg-[#151619] text-[#d1d4dc]">
      {/* 1. Header "List of trades" + Action Buttons */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2.5 shrink-0">
        <p className="text-[16px] font-bold text-[#f0f3fa] leading-6 tracking-tight">
          List of trades
        </p>

        <div className="flex items-center gap-2 ml-auto">
          {/* Botão 1: Download .csv */}
          <div className="relative" ref={csvBtnRef}>
            <button
              type="button"
              aria-label="Download .csv"
              onClick={() => downloadTradesCsv(closedTrades, initialBalance)}
              onMouseEnter={() => setHoveredBtn("csv")}
              onMouseLeave={() => setHoveredBtn(null)}
              className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#d1d4dc] hover:text-[#f0f3fa] transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 28 28"
                width="22"
                height="22"
                fill="none"
              >
                <path
                  fill="currentColor"
                  d="M7 17v4.5a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5V17h1v4.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 6 21.5V17zm8-11v11.293l3.146-3.146.707.707-4.353 4.353-4.353-4.353.707-.707L14 17.293V6z"
                />
              </svg>
            </button>
            <FloatingPortalPopover
              anchorRef={csvBtnRef}
              isOpen={hoveredBtn === "csv"}
              align="right"
              preferredPlacement="bottom"
              offset={6}
              estimatedWidth={96}
              estimatedHeight={26}
              closeOnOutsideClick={false}
              closeOnEscape={false}
              className="!z-[80] !pointer-events-none whitespace-nowrap rounded-[4px] bg-[#2a2b30] px-2 py-1 text-[11px] font-medium text-[#f0f3fa] shadow-lg select-none font-sans"
            >
              Download .csv
            </FloatingPortalPopover>
          </div>

          {/* Botão 2: Column setup */}
          <div className="relative" ref={colSetupRef}>
            <button
              type="button"
              data-qa-id="columns-filter-button"
              aria-label="Column setup"
              aria-expanded={columnMenuOpen}
              aria-haspopup="menu"
              onClick={() => setColumnMenuOpen((prev) => !prev)}
              onMouseEnter={() => setHoveredBtn("columns")}
              onMouseLeave={() => setHoveredBtn(null)}
              className={`w-[28px] h-[28px] flex items-center justify-center rounded-[6px] border border-[#2a2b30] transition-colors ${
                columnMenuOpen
                  ? "bg-[#2a2b30] text-[#f0f3fa]"
                  : "bg-[#1e1f24] hover:bg-[#2a2b30] text-[#d1d4dc] hover:text-[#f0f3fa]"
              }`}
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
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="m4 4h-2v10h2zm-2-1c-.55228 0-1 .44772-1 1v10c0 .5523.44772 1 1 1h2c.55228 0 1-.4477 1-1v-10c0-.55228-.44772-1-1-1zm8 1h-2v10h2zm-2-1c-.55228 0-1 .44772-1 1v10c0 .5523.44772 1 1 1h2c.5523 0 1-.4477 1-1v-10c0-.55228-.4477-1-1-1zm6 1h2v10h-2zm-1 0c0-.55228.4477-1 1-1h2c.5523 0 1 .44772 1 1v10c0 .5523-.4477 1-1 1h-2c-.5523 0-1-.4477-1-1z"
                />
              </svg>
            </button>

            <FloatingPortalPopover
              anchorRef={colSetupRef}
              isOpen={hoveredBtn === "columns" && !columnMenuOpen}
              align="right"
              preferredPlacement="bottom"
              offset={6}
              estimatedWidth={92}
              estimatedHeight={26}
              closeOnOutsideClick={false}
              closeOnEscape={false}
              className="!z-[80] !pointer-events-none whitespace-nowrap rounded-[4px] bg-[#2a2b30] px-2 py-1 text-[11px] font-medium text-[#f0f3fa] shadow-lg select-none font-sans"
            >
              Column setup
            </FloatingPortalPopover>

            {/* Popover 1:1 com os 11 checkboxes (Portaled via FloatingPortalPopover z-[70]) */}
            <FloatingPortalPopover
              anchorRef={colSetupRef}
              isOpen={columnMenuOpen}
              onClose={() => setColumnMenuOpen(false)}
              align="right"
              preferredPlacement="bottom"
              offset={6}
              estimatedWidth={210}
              estimatedHeight={390}
              role="menu"
              dataQaId="column-setup-popover"
              className="rounded-[10px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl py-2 px-1.5 w-[210px] max-h-[calc(100vh-16px)] overflow-y-auto select-none font-sans"
            >
              {COLUMN_SETUP_OPTIONS.map((opt) => {
                const checked = visibleColumns[opt.key];
                return (
                  <div
                    key={opt.key}
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    tabIndex={0}
                    data-qa-id={opt.qaId}
                    onClick={() => toggleColumn(opt.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleColumn(opt.key);
                      }
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[6px] hover:bg-[#2a2b30]/80 cursor-pointer transition-colors text-[13px] text-[#f0f3fa]"
                  >
                    <div
                      className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 border transition-colors ${
                        checked
                          ? "bg-[#f0f3fa] border-[#f0f3fa] text-[#151619]"
                          : "bg-transparent border-[#5d606b]"
                      }`}
                    >
                      {checked && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 11 9"
                          width="11"
                          height="9"
                          fill="none"
                        >
                          <path
                            stroke="currentColor"
                            strokeWidth="2"
                            d="M0.999878 4L3.99988 7L9.99988 1"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="truncate leading-5">{opt.label}</span>
                  </div>
                );
              })}
            </FloatingPortalPopover>
          </div>
        </div>
      </div>

      {/* 2. Dual-Row Table Container */}
      <div className="flex-1 overflow-auto">
        <table
          data-selector="table"
          data-qa-id="table"
          className="w-full border-collapse text-[13px] tabular-nums"
        >
          <thead className="sticky top-0 bg-[#151619] z-10">
            <tr className="border-b border-[#2a2b30] text-[#9a9ea8] text-[12px] h-[36px]">
              {/* Coluna 1: Trade number ↓ */}
              <th
                scope="col"
                data-qa-id="column-trade-number"
                onClick={() =>
                  setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                }
                className="pl-5 pr-2 font-normal text-left whitespace-nowrap cursor-pointer hover:text-[#f0f3fa] transition-colors min-w-[110px]"
              >
                <div className="inline-flex items-center gap-1">
                  <span>Trade number</span>
                  <span className="text-[11px] leading-none">
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                </div>
              </th>

              {/* Coluna 1.5: Show on chart (column-goto-trade) */}
              <th
                scope="col"
                data-qa-id="column-goto-trade"
                className="w-[32px] p-0 font-normal text-left"
              >
                <span />
              </th>

              {/* Coluna 2: Type (Exit / Entry) */}
              <th
                scope="col"
                data-qa-id="column-type"
                className="px-3 font-normal text-left whitespace-nowrap min-w-[72px]"
              >
                Type
              </th>

              {/* Coluna 3: Date and time */}
              {visibleColumns.dateTime && (
                <th
                  scope="col"
                  data-qa-id="column-datetime"
                  className="px-3 font-normal text-left whitespace-nowrap min-w-[130px]"
                >
                  Date and time
                </th>
              )}

              {/* Coluna 4: Order type */}
              {visibleColumns.orderType && (
                <th
                  scope="col"
                  data-qa-id="column-signal"
                  className="px-3 font-normal text-left whitespace-nowrap min-w-[120px]"
                >
                  Order type
                </th>
              )}

              {/* Coluna 5: Price */}
              {visibleColumns.price && (
                <th
                  scope="col"
                  data-qa-id="column-price"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[120px]"
                >
                  Price
                </th>
              )}

              {/* Coluna 6: Size */}
              {visibleColumns.size && (
                <th
                  scope="col"
                  data-qa-id="column-position-size"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[110px]"
                >
                  Size
                </th>
              )}

              {/* Coluna 7: Net PnL */}
              {visibleColumns.netPnl && (
                <th
                  scope="col"
                  data-qa-id="column-profit"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[120px]"
                >
                  Net PnL
                </th>
              )}

              {/* Coluna 8: Return */}
              {visibleColumns.returnPct && (
                <th
                  scope="col"
                  data-qa-id="column-return"
                  className="pr-5 pl-3 font-normal text-right whitespace-nowrap min-w-[95px]"
                >
                  Return
                </th>
              )}

              {/* Coluna 9: Commission */}
              {visibleColumns.commission && (
                <th
                  scope="col"
                  data-qa-id="column-commission"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[100px]"
                >
                  Commission
                </th>
              )}

              {/* Coluna 10: Favorable excursion */}
              {visibleColumns.favorableExcursion && (
                <th
                  scope="col"
                  data-qa-id="column-runup"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[130px]"
                >
                  Favorable excursion
                </th>
              )}

              {/* Coluna 11: Adverse excursion */}
              {visibleColumns.adverseExcursion && (
                <th
                  scope="col"
                  data-qa-id="column-drawdown"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[130px]"
                >
                  Adverse excursion
                </th>
              )}

              {/* Coluna 12: Cumulative PnL */}
              {visibleColumns.cumulativePnl && (
                <th
                  scope="col"
                  data-qa-id="column-cumulative-profit"
                  className="px-3 font-normal text-right whitespace-nowrap min-w-[120px]"
                >
                  Cumulative PnL
                </th>
              )}

              {/* Coluna 13: Duration (bars) */}
              {visibleColumns.durationBars && (
                <th
                  scope="col"
                  data-qa-id="column-duration"
                  className="pr-5 pl-3 font-normal text-right whitespace-nowrap min-w-[110px]"
                >
                  Duration (bars)
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {sortedTrades.map((t) => {
              const isLong = t.side === "long";
              const isProfit = t.profit >= 0;
              const entryOrderLabel =
                t.signal || (isLong ? "Buy market order" : "Sell market order");
              const exitOrderLabel = "Close";

              const favUsd = t.profit > 0 ? t.profit : 0;
              const favPct = t.profit > 0 ? t.profitPercent : 0;
              const advUsd = t.profit < 0 ? t.profit : 0;
              const advPct = t.profit < 0 ? t.profitPercent : 0;
              const cumPct =
                initialBalance > 0 ? (t.cumProfit / initialBalance) * 100 : 0;
              const durationBars = estimateDurationBars(t.entryTime, t.exitTime);

              return (
                <tr
                  key={t.id}
                  data-qa-id={`row-${t.tradeNumber}`}
                  className="border-b border-[#2a2b30] hover:bg-white/[0.03] transition-colors group"
                >
                  {/* 1. Trade number + Side (Long / Short) */}
                  <td
                    data-qa-id="column-trade-number"
                    className="pl-5 pr-2 py-2 align-middle whitespace-nowrap text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#f0f3fa] font-normal">
                        {t.tradeNumber}
                      </span>
                      <span
                        className={`font-normal ${
                          isLong ? "text-[#2962ff]" : "text-[#f23645]"
                        }`}
                      >
                        {isLong ? "Long" : "Short"}
                      </span>
                    </div>
                  </td>

                  {/* 1.5. Show on chart (column-goto-trade): Dual-row */}
                  <td
                    data-qa-id="column-goto-trade"
                    className="w-[32px] p-0 align-middle whitespace-nowrap text-left"
                  >
                    <div className="flex flex-col">
                      <div
                        data-part="0"
                        className="h-[34px] flex items-center justify-center border-b border-[#2a2b30]/60"
                      >
                        <button
                          type="button"
                          title="Show on chart"
                          aria-label="Show on chart"
                          data-name="button-navigate-to-bar"
                          onClick={() => onNavigateToTrade?.(t.exitTime, "exit", t.exitPrice)}
                          className="w-[24px] h-[24px] flex items-center justify-center rounded text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity"
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
                              d="M3.58 9.5a5.45 5.45 0 0 0 4.92 4.92V16h1v-1.58a5.45 5.45 0 0 0 4.92-4.92H16v-1h-1.58A5.45 5.45 0 0 0 9.5 3.58V2h-1v1.58A5.45 5.45 0 0 0 3.58 8.5H2v1h1.58Zm5.92-4.92a4.44 4.44 0 0 1 3.92 3.92H11v1h2.42a4.44 4.44 0 0 1-3.92 3.92V11h-1v2.42a4.44 4.44 0 0 1-3.92-3.92H7v-1H4.58a4.44 4.44 0 0 1 3.92-3.92V7h1V4.58Z"
                            />
                          </svg>
                        </button>
                      </div>
                      <div
                        data-part="1"
                        className="h-[34px] flex items-center justify-center"
                      >
                        <button
                          type="button"
                          title="Show on chart"
                          aria-label="Show on chart"
                          data-name="button-navigate-to-bar"
                          onClick={() => onNavigateToTrade?.(t.entryTime, "entry", t.entryPrice)}
                          className="w-[24px] h-[24px] flex items-center justify-center rounded text-[#9a9ea8] hover:text-[#f0f3fa] hover:bg-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity"
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
                              d="M3.58 9.5a5.45 5.45 0 0 0 4.92 4.92V16h1v-1.58a5.45 5.45 0 0 0 4.92-4.92H16v-1h-1.58A5.45 5.45 0 0 0 9.5 3.58V2h-1v1.58A5.45 5.45 0 0 0 3.58 8.5H2v1h1.58Zm5.92-4.92a4.44 4.44 0 0 1 3.92 3.92H11v1h2.42a4.44 4.44 0 0 1-3.92 3.92V11h-1v2.42a4.44 4.44 0 0 1-3.92-3.92H7v-1H4.58a4.44 4.44 0 0 1 3.92-3.92V7h1V4.58Z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* 2. Type: Dual-row (Exit on top, Entry on bottom) */}
                  <td
                    data-qa-id="column-type"
                    className="p-0 align-middle whitespace-nowrap text-left text-[#f0f3fa]"
                  >
                    <div className="flex flex-col">
                      <div
                        data-part="0"
                        className="px-3 h-[34px] flex items-center border-b border-[#2a2b30]/60"
                      >
                        Exit
                      </div>
                      <div
                        data-part="1"
                        className="px-3 h-[34px] flex items-center"
                      >
                        Entry
                      </div>
                    </div>
                  </td>

                  {/* 3. Date and time: Dual-row */}
                  {visibleColumns.dateTime && (
                    <td
                      data-qa-id="column-datetime"
                      className="p-0 align-middle whitespace-nowrap text-left text-[#f0f3fa]"
                    >
                      <div className="flex flex-col">
                        <div
                          data-part="0"
                          className="px-3 h-[34px] flex items-center border-b border-[#2a2b30]/60"
                        >
                          {formatTradeDateTime(t.exitTime)}
                        </div>
                        <div
                          data-part="1"
                          className="px-3 h-[34px] flex items-center"
                        >
                          {formatTradeDateTime(t.entryTime)}
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 4. Order type: Dual-row */}
                  {visibleColumns.orderType && (
                    <td
                      data-qa-id="column-signal"
                      className="p-0 align-middle whitespace-nowrap text-left text-[#f0f3fa]"
                    >
                      <div className="flex flex-col">
                        <div
                          data-part="0"
                          className="px-3 h-[34px] flex items-center border-b border-[#2a2b30]/60"
                        >
                          {exitOrderLabel}
                        </div>
                        <div
                          data-part="1"
                          className="px-3 h-[34px] flex items-center"
                        >
                          {entryOrderLabel}
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 5. Price: Dual-row */}
                  {visibleColumns.price && (
                    <td
                      data-qa-id="column-price"
                      className="p-0 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <div className="flex flex-col">
                        <div
                          data-part="0"
                          className="px-3 h-[34px] flex items-center justify-end border-b border-[#2a2b30]/60"
                        >
                          <span>{formatFormattedPrice(t.symbol, t.exitPrice)}</span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                        <div
                          data-part="1"
                          className="px-3 h-[34px] flex items-center justify-end"
                        >
                          <span>{formatFormattedPrice(t.symbol, t.entryPrice)}</span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 6. Size: Consolidated 2-line block */}
                  {visibleColumns.size && (
                    <td
                      data-qa-id="column-position-size"
                      className="px-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <div className="flex flex-col items-end justify-center gap-0.5">
                        <div>{t.qty}</div>
                        <div>
                          <span>
                            {formatNotionalCompact(t.symbol, t.entryPrice, t.qty)}
                          </span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 7. Net PnL: Consolidated */}
                  {visibleColumns.netPnl && (
                    <td
                      data-qa-id="column-profit"
                      className={`px-3 py-2 align-middle whitespace-nowrap text-right font-normal ${
                        isProfit ? "text-[#089981]" : "text-[#f23645]"
                      }`}
                    >
                      <div className="inline-flex items-baseline justify-end">
                        <span>
                          {isProfit ? "+" : "-"}
                          {Math.abs(t.profit).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] ml-0.5 font-medium">
                          USD
                        </span>
                      </div>
                    </td>
                  )}

                  {/* 8. Return: Consolidated */}
                  {visibleColumns.returnPct && (
                    <td
                      data-qa-id="column-return"
                      className={`pr-5 pl-3 py-2 align-middle whitespace-nowrap text-right font-normal ${
                        isProfit ? "text-[#089981]" : "text-[#f23645]"
                      }`}
                    >
                      {isProfit ? "+" : "-"}
                      {Math.abs(t.profitPercent).toFixed(2)}%
                    </td>
                  )}

                  {/* 9. Commission */}
                  {visibleColumns.commission && (
                    <td
                      data-qa-id="column-commission"
                      className="px-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <span>0.00</span>
                      <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                        USD
                      </span>
                    </td>
                  )}

                  {/* 10. Favorable excursion */}
                  {visibleColumns.favorableExcursion && (
                    <td
                      data-qa-id="column-runup"
                      className="px-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <div className="flex flex-col items-end justify-center gap-0.5">
                        <div>
                          <span>
                            {favUsd.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9a9ea8]">
                          {favPct.toFixed(2)}%
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 11. Adverse excursion */}
                  {visibleColumns.adverseExcursion && (
                    <td
                      data-qa-id="column-drawdown"
                      className="px-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <div className="flex flex-col items-end justify-center gap-0.5">
                        <div>
                          <span>
                            {advUsd < 0 ? "-" : ""}
                            {Math.abs(advUsd).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9a9ea8]">
                          {advPct < 0 ? `-${Math.abs(advPct).toFixed(2)}%` : "0.00%"}
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 12. Cumulative PnL */}
                  {visibleColumns.cumulativePnl && (
                    <td
                      data-qa-id="column-cumulative-profit"
                      className="px-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      <div className="flex flex-col items-end justify-center gap-0.5">
                        <div>
                          <span>
                            {t.cumProfit < 0 ? "-" : ""}
                            {Math.abs(t.cumProfit).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-[#9a9ea8] ml-0.5 font-medium">
                            USD
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9a9ea8]">
                          {cumPct < 0 ? `-${Math.abs(cumPct).toFixed(2)}%` : `${cumPct.toFixed(2)}%`}
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 13. Duration (bars) */}
                  {visibleColumns.durationBars && (
                    <td
                      data-qa-id="column-duration"
                      className="pr-5 pl-3 py-2 align-middle whitespace-nowrap text-right text-[#f0f3fa]"
                    >
                      {durationBars}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
