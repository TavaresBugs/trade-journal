"use client";

import React, { useState, useRef, useEffect } from "react";
import { AlertConditionType } from "@/lib/alerts/types";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface VelaBezierConditionSelectProps {
  value: AlertConditionType;
  onChange: (value: AlertConditionType) => void;
  disabled?: boolean;
  className?: string;
}

interface ConditionOption {
  value: AlertConditionType;
  label: string;
  icon: React.ReactNode;
}

const PRIMARY_CONDITIONS: ConditionOption[] = [
  {
    value: "crossing",
    label: "Crossing",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M16 5h5.3L5 21.3l.7.7L22 5.7V11h1V4h-7zM5.7 6l6.23 6.22-.7.7L5 6.7zm15.6 17-7.25-7.24.7-.7L22 22.28V17h1v7h-7v-1z" />
      </svg>
    ),
  },
  {
    value: "crossing_up",
    label: "Crossing Up",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M23 6.5V6h-7v1h5.3L7 21.3l.7.7L22 7.7V13h1zM5 17h4.17l-1 1H5zm18 1h-9.17l1-1H23z" />
      </svg>
    ),
  },
  {
    value: "crossing_down",
    label: "Crossing Down",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M23 21.49v.5h-7v-1h5.3L6 5.71l.72-.7L22 20.27v-5.3h1zM5 11h4.17l-1-1H5zm18-1h-9.17l1 1H23z" />
      </svg>
    ),
  },
];

const EXTENDED_CONDITIONS: ConditionOption[] = [
  {
    value: "greater_than",
    label: "Greater Than",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M12 8h5.3L9 16.3l.7.7L18 8.7V14h1V7h-7zm11 13H5v1h18z" />
      </svg>
    ),
  },
  {
    value: "less_than",
    label: "Less Than",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M12 20h5.3L9 11.7l.7-.7 8.3 8.3V14h1v7h-7zM23 7H5V6h18z" />
      </svg>
    ),
  },
  {
    value: "entering_channel",
    label: "Entering Channel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M9 9h4.3L8 3.7l.7-.7L14 8.3V4h1v6H9zm-4 4v-1h18v1zm18 3v-1H5v1zM9 19h4.3L8 24.3l.7.7 5.3-5.3V24h1v-6H9z" />
      </svg>
    ),
  },
  {
    value: "exiting_channel",
    label: "Exiting Channel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M9 4h4.3L8 9.3l.7.7L14 4.7V9h1V3H9zm0 20h4.3L8 18.7l.7-.7 5.3 5.3V19h1v6H9zM5 12h18v1H5zm18 3H5v1h18z" />
      </svg>
    ),
  },
  {
    value: "inside_channel",
    label: "Inside Channel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M5 4h18v1H5zm8.49 2.98-4.5 4.3.7.72 3.3-3.16v10.3L9.7 16l-.69.72 4.49 4.29L18 16.72l-.68-.72-3.33 3.15V8.84L17.32 12l.68-.72zM23 23H5v1h18z" />
      </svg>
    ),
  },
  {
    value: "outside_channel",
    label: "Outside Channel",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M9 8.28 13.5 4l4.5 4.28-.68.72-3.32-3.16V12H23v1H5v-1h7.99V5.84L9.69 9zM9.7 19l-.7.72L13.5 24l4.5-4.28-.68-.72-3.32 3.16V16H23v-1H5v1h7.99v6.15z" />
      </svg>
    ),
  },
  {
    value: "moving_up",
    label: "Moving Up",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M19.3 8H11V7h10v10h-1V8.7L7.7 21l-.7-.7z" />
      </svg>
    ),
  },
  {
    value: "moving_down",
    label: "Moving Down",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path d="M7.7 7 20 19.3V11h1v10H11v-1h8.3L7 7.7z" />
      </svg>
    ),
  },
  {
    value: "moving_up_percent",
    label: "Moving Up %",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path fillRule="evenodd" d="M14 3 7.68 8.24l.64.76L14 4.27 19.68 9l.64-.76zm-2 11.36a2 2 0 1 1-4 0 2 2 0 0 1 4 0m1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-3.5 8.08L17.69 11l.81.58L10.32 23zM20 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0m1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    value: "moving_down_percent",
    label: "Moving Down %",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
        <path fillRule="evenodd" d="M9.5 16.44 17.69 5l.81.58-8.17 11.44zM12 8.36a2 2 0 1 1-4 0 2 2 0 0 1 4 0m1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0M14 24l-6-4.8.62-.77L14 22.78l5.38-4.35.62.78zm6-10a2 2 0 1 1-4 0 2 2 0 0 1 4 0m1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      </svg>
    ),
  },
];

const ALL_CONDITIONS = [...PRIMARY_CONDITIONS, ...EXTENDED_CONDITIONS];

export function VelaBezierConditionSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierConditionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() =>
    EXTENDED_CONDITIONS.some((opt) => opt.value === value)
  );

  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-expand if active value is in extended group
  useEffect(() => {
    if (EXTENDED_CONDITIONS.some((opt) => opt.value === value)) {
      setIsExpanded(true);
    }
  }, [value]);

  const selectedOption =
    ALL_CONDITIONS.find((opt) => opt.value === value) ?? ALL_CONDITIONS[0]!;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[34px] px-3 flex items-center justify-between gap-2 border transition-all text-[13px] cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border-[var(--vela-border,#2a2e39)]"
            : isOpen
            ? "bg-[#151619] border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] border-[var(--vela-border,#2a2e39)] hover:border-[#4a4b52] hover:bg-[rgba(255,255,255,0.03)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span className="text-[var(--vela-fg-muted,#787b86)] shrink-0">
            {selectedOption.icon}
          </span>
          <span className="truncate font-normal">{selectedOption.label}</span>
        </div>

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

      {/* Floating Popup with Natural Bézier Join */}
      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        minWidth={240}
        maxHeight={340}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="flex flex-col space-y-0.5">
          {/* 1. Primary Conditions (Crossing, Crossing Up, Crossing Down) */}
          {PRIMARY_CONDITIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[13px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#252830] text-white font-medium"
                    : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
              >
                <span
                  className={`shrink-0 ${
                    isSelected ? "text-white" : "text-[var(--vela-fg-muted,#787b86)]"
                  }`}
                >
                  {opt.icon}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}

          {/* 2. Accordion Toggle: SHOW MORE / SHOW LESS */}
          <div className="pt-1.5 pb-1 border-t border-[var(--vela-border,#2a2e39)]/60 mt-1">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--vela-fg-muted,#787b86)] hover:text-white uppercase transition-colors rounded hover:bg-[var(--vela-hover,rgba(255,255,255,0.04))]"
            >
              <span>{isExpanded ? "Show less" : "Show more"}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 18 18"
                width="14"
                height="14"
                className={`transition-transform duration-150 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                <path
                  fill="currentColor"
                  d="m14.078 7.827-.99-1.128L9 10.29 4.911 6.7l-.99 1.128L9 12.285z"
                />
              </svg>
            </button>
          </div>

          {/* 3. Extended Conditions (Shown when accordion expanded) */}
          {isExpanded &&
            EXTENDED_CONDITIONS.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[13px] text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#252830] text-white font-medium"
                      : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      isSelected ? "text-white" : "text-[var(--vela-fg-muted,#787b86)]"
                    }`}
                  >
                    {opt.icon}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
        </div>
      </VelaBezierDropdownShell>
    </div>
  );
}
