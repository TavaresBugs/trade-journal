"use client";

import React, { useState, useRef } from "react";
import { AlertFrequency } from "@/lib/alerts/types";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface VelaBezierTriggerSelectProps {
  value: AlertFrequency;
  onChange: (value: AlertFrequency) => void;
  disabled?: boolean;
  className?: string;
}

const TRIGGER_OPTIONS: {
  value: AlertFrequency;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "once_only",
    title: "Once only",
    subtitle: "Triggers once when condition is met",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 28 28"
        width="24"
        height="24"
        fill="none"
        className="shrink-0"
      >
        <path
          fill="currentColor"
          d="M14 6a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 1a8 8 0 1 0 0 16 8 8 0 0 0 0-16m.726 12.041h-.988v-7.024h-.073l-2.053 1.422v-.976L13.743 11h.983zM8.643 4.68 3.734 9.997l-.367-.339L3 9.32l4.91-5.317zM25 9.32l-.73.677-4.91-5.317.735-.678z"
        />
      </svg>
    ),
  },
  {
    value: "every_time",
    title: "Every time",
    subtitle: "Triggers once per minute while condition remains met",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 28 28"
        width="24"
        height="24"
        fill="none"
        className="shrink-0"
      >
        <path
          fill="currentColor"
          d="M14 6a9 9 0 0 1 0 18 9 9 0 0 1-8-4.879V22H5v-5h5v1H6.582A8.002 8.002 0 0 0 22 15a8 8 0 0 0-15.936-1H5.057C5.554 9.5 9.367 6 14 6m.998 13h-.987v-6.983h-.072l-2.054 1.422v-.976L14.017 11h.981zM8.641 4.68 3.733 9.997 3 9.32l4.907-5.317zm16.356 4.64-.734.677-4.908-5.317.735-.678z"
        />
      </svg>
    ),
  },
];

export function VelaBezierTriggerSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierTriggerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption =
    TRIGGER_OPTIONS.find((opt) => opt.value === value) ?? TRIGGER_OPTIONS[0]!;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`h-[32px] px-3 flex items-center justify-between gap-2 border transition-all text-[13px] cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border-[var(--vela-border,#2a2e39)]"
            : isOpen
            ? "bg-[#151619] border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] border-[var(--vela-border,#2a2e39)] hover:border-[#4a4b52] hover:bg-[rgba(255,255,255,0.03)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <span className="font-normal">{selectedOption.title}</span>
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
        minWidth={280}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="space-y-1">
          {TRIGGER_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-2.5 rounded-[6px] text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#252830] text-white"
                    : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${
                    isSelected ? "text-white" : "text-[var(--vela-fg-muted,#787b86)]"
                  }`}
                >
                  {opt.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium leading-snug">
                    {opt.title}
                  </span>
                  <span
                    className={`text-[11px] leading-tight mt-0.5 ${
                      isSelected
                        ? "text-[#b2b5be]"
                        : "text-[var(--vela-fg-muted,#787b86)]"
                    }`}
                  >
                    {opt.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </VelaBezierDropdownShell>
    </div>
  );
}
