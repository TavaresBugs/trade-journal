"use client";

import React, { useState, useRef } from "react";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface PriceSourceOption {
  value: string;
  label: string;
  description?: string;
}

const PRICE_SOURCES: PriceSourceOption[] = [
  { value: "price", label: "Price", description: "Current market / last price" },
  { value: "open", label: "Open", description: "Bar opening price" },
  { value: "high", label: "High", description: "Bar high extreme" },
  { value: "low", label: "Low", description: "Bar low extreme" },
  { value: "close", label: "Close", description: "Bar closing price" },
  { value: "hl2", label: "HL2", description: "(High + Low) / 2" },
  { value: "hlc3", label: "HLC3", description: "(High + Low + Close) / 3" },
  { value: "ohlc4", label: "OHLC4", description: "(Open + High + Low + Close) / 4" },
];

export interface VelaBezierPriceSourceSelectProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VelaBezierPriceSourceSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierPriceSourceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = PRICE_SOURCES.find((s) => s.value === value) ?? PRICE_SOURCES[0]!;

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[34px] px-3 flex items-center justify-between gap-2 border transition-all text-[13px] cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg-muted,#787b86)]"
            : isOpen
            ? "bg-[#151619] border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] border-[var(--vela-border,#2a2e39)] hover:border-[#4a4b52] hover:bg-[rgba(255,255,255,0.03)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <span className="font-normal">{selected.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
          width="14"
          height="14"
          className={`text-[var(--vela-fg-muted,#787b86)] shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
          />
        </svg>
      </button>

      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        minWidth={220}
        maxHeight={260}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="flex flex-col space-y-0.5">
          {PRICE_SOURCES.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[6px] text-[13px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#252830] text-white font-medium"
                    : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
              >
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-[11px] text-[var(--vela-fg-muted,#787b86)]">
                    {opt.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </VelaBezierDropdownShell>
    </div>
  );
}
