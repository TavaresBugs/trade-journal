"use client";

import React, { useRef, useState } from "react";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface SoundDurationOption {
  value: number;
  label: string;
}

export const SOUND_DURATION_OPTIONS: SoundDurationOption[] = [
  { value: 0, label: "Once" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
];

export interface VelaBezierSoundDurationSelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 1:1 TradingView Sound Duration Dropdown with Natural Bézier Join (/bezier-style Modo 1).
 * Matches print_20261014_224829.png with seamless #151619 background.
 */
export function VelaBezierSoundDurationSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierSoundDurationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentOption =
    SOUND_DURATION_OPTIONS.find((opt) => opt.value === value) ||
    SOUND_DURATION_OPTIONS[0] || { value: 0, label: "Once" };

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* Trigger Button with Bézier Join State */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[32px] px-2.5 flex items-center justify-between text-[12px] font-normal transition-all cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg-muted,#787b86)] rounded-[6px]"
            : isOpen
            ? "bg-[#151619] border border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] border border-[var(--vela-border,#2a2e39)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <span className="truncate">{currentOption.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
          width="12"
          height="12"
          className={`text-[var(--vela-fg-muted,#787b86)] transition-transform duration-150 shrink-0 ml-1.5 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
          />
        </svg>
      </button>

      {/* Dropdown Menu with Bézier Join Shell */}
      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        minWidth={130}
        maxHeight={220}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="flex flex-col py-1 space-y-0.5">
          {SOUND_DURATION_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] text-[12px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#2a2e39] text-white font-medium"
                    : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 18 18"
                    width="14"
                    height="14"
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
