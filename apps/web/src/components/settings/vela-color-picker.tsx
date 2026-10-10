"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export function hslHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`.toLowerCase();
}

export function buildPalette(): string[][] {
  const grays = [100, 90, 80, 68, 56, 45, 35, 25, 14, 0].map((l) => hslHex(0, 0, l));
  const hues = [4, 28, 50, 96, 140, 174, 200, 224, 270, 322];
  const levels: [number, number][] = [
    [82, 56],
    [58, 84],
    [62, 74],
    [66, 62],
    [70, 50],
    [64, 39],
    [54, 29],
  ];
  return [grays, ...levels.map(([s, l]) => hues.map((h) => hslHex(h, s, l)))];
}

export function splitColor(color: string): { hex6: string; alpha: number } {
  const s = String(color ?? "").trim();
  const m6 = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m6 && m6[1]) {
    return {
      hex6: `#${m6[1].toLowerCase()}`,
      alpha: m6[2] ? parseInt(m6[2], 16) / 255 : 1,
    };
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(s);
  if (m3 && m3[1]) {
    const h = m3[1].toLowerCase();
    const r = h[0] ?? "0";
    const g = h[1] ?? "0";
    const b = h[2] ?? "0";
    return {
      hex6: `#${r}${r}${g}${g}${b}${b}`,
      alpha: 1,
    };
  }
  const rgba = /^rgba?\(([^)]+)\)/i.exec(s);
  if (rgba && rgba[1]) {
    const p = rgba[1].split(",").map((v) => v.trim());
    const hx = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0");
    const a = p[3] != null ? Math.max(0, Math.min(1, parseFloat(p[3]))) : 1;
    return {
      hex6: `#${hx(parseInt(p[0] ?? "0", 10))}${hx(parseInt(p[1] ?? "0", 10))}${hx(parseInt(p[2] ?? "0", 10))}`,
      alpha: a,
    };
  }
  return { hex6: "#089981", alpha: 1 };
}

export function combineColor(hex6: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 0.999) return hex6.toLowerCase();
  const alphaHex = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex6.toLowerCase()}${alphaHex}`;
}

export function transparencyChecker(size = 8): string {
  return `repeating-conic-gradient(#9aa0a6 0% 25%, #d3d6da 0% 50%) 0 0 / ${size}px ${size}px`;
}

export interface VelaColorPickerProps {
  value: string;
  onChange: (hexColor: string) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  initialOpen?: boolean;
}

const STATIC_PALETTE = buildPalette();
const DEFAULT_RECENTS = [
  "#089981",
  "#3364eb",
  "#000000",
  "#2962ff",
  "#f23645",
  "#ff9800",
  "#787b86",
];

/**
 * Official LuxAlgo Vela Color Picker Popover (TradingView 1:1 Ground-Truth Specification)
 * - 26x26px trigger swatch with 3px padding, 4px border-radius, and transparency checkerboard
 * - 258px popover width (236px content width + 10px padding)
 * - 80-swatch palette matrix (10 grayscale + 70 hues) with 4px border-radius, borderless, 4px gap
 * - Favorite / Recent swatches matching top matrix (20x20px, 4px border-radius, borderless, 4px gap)
 * - TradingView borderless 20x20px [+] custom color button with theme-adaptive color tokens
 * - Fluid opacity slider with unclipped 15px thumb on 13px track with no overflow clipping
 * - Bidirectional percentage input
 */
export function VelaColorPicker({
  value,
  onChange,
  disabled = false,
  title,
  className = "",
  initialOpen = false,
}: VelaColorPickerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [recents, setRecents] = useState<string[]>(DEFAULT_RECENTS);
  const [opacityInputVal, setOpacityInputVal] = useState<string>("");
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const { hex6, alpha } = useMemo(() => splitColor(value), [value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 258;
    const popHeight = popoverRef.current?.offsetHeight || 298;

    // Horizontal: align popover right edge with trigger right edge
    let left = Math.round(rect.right - popWidth);
    if (typeof window !== "undefined") {
      const minLeft = 12;
      const maxLeft = window.innerWidth - popWidth - 12;
      left = Math.max(minLeft, Math.min(left, maxLeft));
    }

    // Vertical: default below trigger, flip upwards if insufficient space below
    let top = Math.round(rect.bottom + 6);
    if (typeof window !== "undefined") {
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      if (spaceBelow < popHeight && spaceAbove > spaceBelow) {
        // Flip upwards above the trigger button!
        top = Math.round(Math.max(12, rect.top - popHeight - 6));
      } else {
        // Keep downwards, but clamp if overflowing bottom of viewport
        if (top + popHeight > window.innerHeight - 12) {
          top = Math.round(Math.max(12, window.innerHeight - popHeight - 12));
        }
      }
    }

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = (e: Event) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    setOpacityInputVal(`${Math.round(alpha * 100)}%`);
  }, [alpha]);

  const addRecentColor = useCallback((newHex: string) => {
    const cleanHex = splitColor(newHex).hex6.toLowerCase();
    setRecents((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== cleanHex);
      return [cleanHex, ...filtered].slice(0, 7);
    });
  }, []);

  const handleSelectColor = (selectedHex6: string) => {
    const nextColor = combineColor(selectedHex6, alpha);
    addRecentColor(selectedHex6);
    onChange(nextColor);
  };

  const handleAlphaChange = (newAlpha: number) => {
    const clamped = Math.max(0, Math.min(1, newAlpha));
    const nextColor = combineColor(hex6, clamped);
    onChange(nextColor);
  };

  const updateAlphaFromPointer = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    handleAlphaChange(ratio);
  };

  const handlePointerDownTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateAlphaFromPointer(e.clientX);
  };

  const handlePointerMoveTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons > 0) {
      updateAlphaFromPointer(e.clientX);
    }
  };

  // Close on outside pointerdown or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const checkerBg8 = transparencyChecker(8);
  const checkerBg10 = transparencyChecker(10);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Official Vela 26x26px Trigger Swatch Button */}
      <button
        ref={triggerRef}
        type="button"
        title={title}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            updatePosition();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`vela-color-field vela-color-field-circle ${
          disabled ? "vela-field-dim" : ""
        }`}
      >
        <span
          className="vela-color-field-swatch"
          style={{
            background: `linear-gradient(${value}, ${value}), ${checkerBg8}`,
          }}
        />
      </button>

      {/* Popover (Portaled to document.body with fixed coordinates to prevent clipping by cards/footers) */}
      {isOpen &&
        (() => {
          const popoverNode = (
            <div
                ref={popoverRef}
                role="dialog"
                aria-label="Color picker"
                className="vela-popover vela-ui-layer vela-color-field-pop vela-ui pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: "258px",
                  zIndex: 9999,
                  boxSizing: "border-box",
                }}
                onClick={(e) => e.stopPropagation()}
              >
          <div className="flex flex-col gap-[9px] w-[236px]">
            {/* 80 Swatch Matrix (10 columns x 8 rows, gap: 4px, border-radius: 4px) */}
            <div className="grid grid-cols-10 gap-[4px]">
              {STATIC_PALETTE.map((row, rIdx) =>
                row.map((swatchColor, cIdx) => {
                  const isSelected =
                    swatchColor.toLowerCase() === hex6.toLowerCase();
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      type="button"
                      data-c={swatchColor}
                      onClick={() => handleSelectColor(swatchColor)}
                      className="w-full aspect-square rounded-[4px] cursor-pointer p-0 border-0 transition-opacity hover:opacity-90 active:opacity-75 relative outline-none"
                      style={{
                        backgroundColor: swatchColor,
                        outline: isSelected ? "2px solid #ffffff" : "none",
                        outlineOffset: isSelected ? "2px" : "0",
                        zIndex: isSelected ? 10 : 1,
                      }}
                      title={swatchColor}
                    />
                  );
                })
              )}
            </div>

            {/* Favorite / Recent Colors Row + [+] Button (TradingView unified architecture) */}
            <div className="flex items-center gap-[4px] flex-wrap border-t border-[#2a2b30] pt-[9px]">
              <div className="contents">
                {recents.map((rc, idx) => {
                  const isSelected =
                    rc.toLowerCase() === hex6.toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-c={rc}
                      onClick={() => handleSelectColor(rc)}
                      className="w-[20px] h-[20px] rounded-[4px] cursor-pointer p-0 border-0 transition-opacity hover:opacity-90 active:opacity-75 relative outline-none shrink-0"
                      style={{
                        background: `linear-gradient(${rc}, ${rc}), ${checkerBg8}`,
                        outline: isSelected ? "2px solid #ffffff" : "none",
                        outlineOffset: isSelected ? "2px" : "0",
                        zIndex: isSelected ? 10 : 1,
                      }}
                      title={`Favorite: ${rc}`}
                    />
                  );
                })}
              </div>

              {/* [+] Button for custom color (TradingView style: 20x20, borderless, theme-adaptive) */}
              <label
                className="w-[20px] h-[20px] rounded-[4px] border-0 bg-transparent hover:bg-white/10 dark:hover:bg-white/10 text-[var(--vela-fg-muted,#868a96)] hover:text-[var(--vela-fg-bright,#ffffff)] cursor-pointer flex items-center justify-center select-none relative transition-colors shrink-0"
                title="Add custom color"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  className="pointer-events-none"
                >
                  <path d="M5 2v6M2 5h6" />
                </svg>
                <input
                  ref={customInputRef}
                  type="color"
                  value={hex6}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                />
              </label>
            </div>

            {/* Opacity Label */}
            <div className="text-[11px] text-[#787b86] select-none font-sans leading-tight">
              Opacity
            </div>

            {/* Opacity Slider Track + Number Input */}
            <div className="flex items-center gap-[10px]">
              {/* Opacity Slider Track (NO overflow-hidden, rounded 7px, height 13px) */}
              <div
                ref={trackRef}
                onPointerDown={handlePointerDownTrack}
                onPointerMove={handlePointerMoveTrack}
                className="flex-1 relative h-[13px] rounded-[7px] cursor-pointer select-none"
                style={{
                  background: `linear-gradient(to right, ${hex6}00, ${hex6}ff), ${checkerBg10}`,
                }}
              >
                {/* Thumb / Knob (15x15px, floats completely round and unclipped) */}
                <div
                  className="absolute top-1/2 w-[15px] h-[15px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.55)] pointer-events-none"
                  style={{
                    left: `${Math.round(alpha * 100)}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>

              {/* Number Input Box (46px, text-center, border #2a2b30, rounded 5px) */}
              <input
                type="text"
                inputMode="numeric"
                title="Opacity (%)"
                value={opacityInputVal}
                onChange={(e) => {
                  setOpacityInputVal(e.target.value);
                  const parsed = parseInt(e.target.value.replace("%", ""), 10);
                  if (!isNaN(parsed)) {
                    handleAlphaChange(parsed / 100);
                  }
                }}
                onBlur={() => {
                  setOpacityInputVal(`${Math.round(alpha * 100)}%`);
                }}
                className="w-[46px] h-[24px] box-border text-center text-[12px] text-[#d1d4dc] bg-transparent border border-[#2a2b30] rounded-[5px] px-1 py-0.5 outline-none focus:border-[#787b86] font-sans"
              />
            </div>
          </div>
            </div>
          );
          return typeof document !== "undefined" && document.body
            ? createPortal(popoverNode, document.body)
            : popoverNode;
        })()}
    </div>
  );
}

