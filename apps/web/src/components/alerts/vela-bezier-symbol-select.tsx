"use client";

import React, { useState, useRef, useMemo } from "react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { useAlerts, ScreenSymbolItem, createScreenSymbolItem } from "@/lib/alerts/alerts-store";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface VelaBezierSymbolSelectProps {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VelaBezierSymbolSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierSymbolSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { screenSymbols } = useAlerts();

  const cleanValue = value.replace(/1!$/, "").toUpperCase();

  // Smart options list: prioritize actual screen panels (1, 2, 3, 4) present on screen!
  const availableOptions: ScreenSymbolItem[] = useMemo(() => {
    if (screenSymbols && screenSymbols.length > 0) {
      // If the current value is not in screenSymbols (e.g. from an existing alert), append it
      const hasCurrent = screenSymbols.some(
        (s) => s.symbol.toUpperCase() === cleanValue,
      );
      if (!hasCurrent) {
        return [
          ...screenSymbols,
          createScreenSymbolItem(cleanValue, screenSymbols.length + 1),
        ];
      }
      return screenSymbols;
    }

    // Default fallback if no screen panels registered yet: current symbol + standard active pair
    return [
      createScreenSymbolItem(cleanValue || "MES", 1),
      createScreenSymbolItem(cleanValue === "MNQ" ? "MES" : "MNQ", 2),
    ];
  }, [screenSymbols, cleanValue]);

  const currentOption =
    availableOptions.find((s) => s.symbol === cleanValue) ??
    createScreenSymbolItem(cleanValue, 1);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Symbol Pill Trigger Button - Seamless / Ghost style matching TradingView header */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`symbolPill-oBNK4RRi inline-flex items-center gap-1.5 px-2 py-1 transition-all cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border border-transparent text-[var(--vela-fg-muted,#787b86)]"
            : isOpen
            ? "bg-[#151619] border border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative shadow-sm"
            : "bg-transparent hover:bg-[var(--vela-hover,rgba(255,255,255,0.08))] border border-transparent rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)] hover:text-white"
        }`}
        title="Change alert symbol"
      >
        <AssetIcon symbol={currentOption.symbol} size="xs" />
        <span className="text-[16px] font-semibold leading-none">
          {currentOption.displaySymbol}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
          width="14"
          height="14"
          className={`text-[var(--vela-fg-muted,#787b86)] transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
          />
        </svg>
      </button>

      {/* Floating Popup with Natural Bézier Join */}
      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        minWidth={280}
        maxHeight={280}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="flex flex-col space-y-1">
          {/* Section Label */}
          <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[var(--vela-fg-muted,#787b86)] uppercase">
            Active Chart Panels on Screen
          </div>

          {availableOptions.map((sym) => {
            const isSelected = sym.symbol === currentOption.symbol;
            return (
              <button
                key={`${sym.symbol}-${sym.panelIndex}`}
                type="button"
                onClick={() => {
                  onChange(sym.symbol);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-[6px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#2a2e39] text-white"
                    : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Panel Number Badge (1, 2, 3, 4) */}
                  <span className="w-[18px] h-[18px] rounded-full bg-[var(--vela-border,#2a2e39)] text-[10px] font-semibold text-[var(--vela-fg-muted,#787b86)] flex items-center justify-center shrink-0">
                    {sym.panelIndex}
                  </span>

                  <AssetIcon symbol={sym.symbol} size="xs" />

                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold leading-tight">
                      {sym.displaySymbol}
                    </span>
                    <span className="text-[11px] text-[var(--vela-fg-muted,#787b86)] truncate leading-tight mt-0.5">
                      {sym.name}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 18 18"
                    width="16"
                    height="16"
                    className="text-[#2962ff] shrink-0 ml-2"
                  >
                    <path
                      fill="currentColor"
                      d="M6.75 12.127 3.623 9l-.873.873 4 4 9-9-.873-.873z"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </VelaBezierDropdownShell>
    </div>
  );
}
