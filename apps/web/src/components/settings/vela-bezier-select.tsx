"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface VelaBezierSelectOption<T extends string = string> {
  value: T;
  label: string;
  iconSvg?: string;
  description?: string;
}

export interface VelaBezierSelectProps<T extends string = string> {
  value: T;
  options: VelaBezierSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minWidth?: number;
  popupMinWidth?: number;
  maxHeight?: number;
  defaultOpen?: boolean;
}

/**
 * Official LuxAlgo Vela Bézier Select Dropdown (Reference: print_20261009_140301.png)
 * Seamlessly bridges the trigger button to the dropdown menu using the Natural Bézier Join
 * outline (shoulder S = 8, radius R = 6, solid #151619 fill and #34353b edge).
 * Uses a portaled fixed layer to float freely above dialog panes without clipping or scroll trapping.
 */
export function VelaBezierSelect<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  minWidth = 140,
  popupMinWidth,
  maxHeight = 240,
  defaultOpen = false,
}: VelaBezierSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [popupHeight, setPopupHeight] = useState(256);
  const [isScroll, setIsScroll] = useState(false);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Position popup flush with trigger's bottom border (1px overlap per Vela's --chrome-dock-shift)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.round(rect.width);
    const targetPopupW = Math.max(popupMinWidth ?? minWidth, width);
    const maxLeft = typeof window !== "undefined" ? window.innerWidth - targetPopupW - 12 : rect.left;
    const idealLeft = Math.round(rect.left);
    const clampedLeft = Math.max(12, Math.min(idealLeft, maxLeft));

    setCoords({
      top: Math.round(rect.bottom - 1),
      left: clampedLeft,
      width,
    });
  }, [popupMinWidth, minWidth]);

  // Sync coords on open, scroll, or resize synchronously before paint
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = (e: Event) => {
      // Do not recalculate if scrolling inside the dropdown list itself
      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Official Vela scroll thumb update formula (function nW from chunk 3ag7pl36itr_h.js)
  const updateThumb = useCallback(() => {
    if (!itemsRef.current) return;
    const items = itemsRef.current;
    const clientH = items.clientHeight;
    const scrollH = items.scrollHeight;
    if (scrollH <= clientH) {
      setThumbHeight(0);
      return;
    }
    const h = Math.max(20, (clientH / scrollH) * clientH);
    const y = (items.scrollTop / (scrollH - clientH)) * (clientH - h);
    setThumbHeight(Math.round(h));
    setThumbTop(Math.round(y));
  }, []);

  // Update popup height & scroll state when popup renders
  useLayoutEffect(() => {
    if (!isOpen || !popupRef.current) return;

    if (popupRef.current.offsetHeight > 0) {
      setPopupHeight(popupRef.current.offsetHeight);
    }

    if (itemsRef.current) {
      const items = itemsRef.current;
      const needsScroll = items.scrollHeight > items.clientHeight;
      setIsScroll(needsScroll);
      if (needsScroll) {
        updateThumb();
        const checkedEl = items.querySelector<HTMLElement>("[data-checked='1']");
        checkedEl?.scrollIntoView({ block: "nearest" });
        updateThumb();
      }
    }

    const ro = new ResizeObserver(() => {
      if (popupRef.current && popupRef.current.offsetHeight > 0) {
        setPopupHeight(popupRef.current.offsetHeight);
      }
      if (itemsRef.current) {
        const items = itemsRef.current;
        setIsScroll(items.scrollHeight > items.clientHeight);
        updateThumb();
      }
    });

    ro.observe(popupRef.current);
    if (itemsRef.current) ro.observe(itemsRef.current);

    return () => ro.disconnect();
  }, [isOpen, updateThumb]);

  // Handle outside click & Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popupRef.current?.contains(target)
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

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const effectivePopupWidth = Math.max(popupMinWidth ?? minWidth, coords.width || minWidth);
  const effectiveMaxHeight =
    typeof window !== "undefined" && coords.top > 0
      ? Math.max(120, Math.min(maxHeight, window.innerHeight - coords.top - 20))
      : maxHeight;

  // Official LuxAlgo Vela Bézier Path calculation (chunk 3bk-6pmml3oum.js)
  const M = effectivePopupWidth;
  const P = popupHeight;
  const tW = coords.width || minWidth;
  const N = Math.max(0, M - tW);
  const dPath = `M 0.5 0 V ${P - 7} Q 0.5 ${P - 0.5} 7 ${P - 0.5} H ${M - 7} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - 7} ${
    N > 3
      ? `V 7 Q ${M - 0.5} 0.5 ${M - 7} 0.5 H ${Math.max(7, tW)}`
      : "V 0"
  }`;

  const dropdownContent = (
    <>
      {/* Official Vela SVG Join Background Layer */}
      <div
        className="quant-chrome-join"
        aria-hidden="true"
        data-side="below"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <svg
          viewBox={`0 0 ${M} ${P}`}
          style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
        >
          <path className="quant-chrome-join-fill" d={`${dPath} Z`} fill="#151619" />
          <path className="quant-chrome-join-edge" d={dPath} fill="none" stroke="#34353b" strokeWidth="1" />
        </svg>
      </div>

      {/* Select Items Container */}
      <div
        ref={itemsRef}
        onScroll={updateThumb}
        className="vela-select-items quant-chrome-hover flex-1 min-w-0"
        style={{
          position: "relative",
          zIndex: 2,
          maxHeight: effectiveMaxHeight,
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-checked={isSelected ? "1" : undefined}
              onClick={() => handleSelect(opt.value)}
              className={`vela-select-item quant-chrome-hover-row group w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] cursor-pointer transition-colors ${
                isSelected
                  ? "bg-[#282a30]/60 text-white font-medium"
                  : "text-[#d1d4dc] hover:bg-[#282a30]/30 hover:text-white"
              }`}
              style={{
                minHeight: "34px",
                borderRadius: "6px",
                border: "none",
                textAlign: "left",
              }}
            >
              <div className="flex items-center gap-2.5 truncate">
                {opt.iconSvg && (
                  <span
                    className={`quant-style-badge w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-150 ${
                      isSelected
                        ? "!bg-[#f0f3fa] !text-[#151619] shadow-xs"
                        : "bg-[rgba(255,255,255,0.08)] text-[#868a96] group-hover:text-white group-hover:bg-[rgba(255,255,255,0.14)]"
                    }`}
                    dangerouslySetInnerHTML={{ __html: opt.iconSvg }}
                  />
                )}
                <span className="truncate">{opt.label}</span>
              </div>
              {opt.description && (
                <span className="text-[10px] text-[#868a96] ml-2 shrink-0">
                  {opt.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Official Vela 3px Custom Scrollbar Rail & Thumb */}
      {isScroll && (
        <div
          className="vela-select-rail"
          style={{
            position: "relative",
            zIndex: 2,
            flex: "none",
            width: "3px",
            margin: "2px 1px 2px 0",
            pointerEvents: "none",
          }}
        >
          <div
            className="vela-select-thumb"
            style={{
              width: "3px",
              borderRadius: "2px",
              background: "var(--vela-scroll, rgba(255, 255, 255, 0.2))",
              height: `${thumbHeight}px`,
              transform: `translateY(${thumbTop}px)`,
              transition: "transform 0.05s linear",
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`relative inline-block select-none ${className}`}
      style={{ minWidth }}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-quant-open={isOpen ? "1" : undefined}
        data-chrome-join-anchor={isOpen ? "" : undefined}
        onClick={() => {
          if (!disabled) {
            updatePosition();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`vela-select-trigger w-full h-[29px] px-2.5 flex items-center justify-between gap-2 border transition-all text-[12px] cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border-[#34353b]"
            : isOpen
            ? "bg-[#151619] border-[#34353b] border-b-transparent border-b-[#151619] hover:border-[#34353b] hover:border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-transparent border-[#34353b] hover:border-[#4a4b52] rounded-[6px] text-[#d1d4dc] hover:text-white"
        }`}
      >
        <span className="vela-select-label flex items-center gap-2 truncate">
          {selectedOption?.iconSvg && (
            <span
              className="w-5 h-5 rounded-[4px] bg-[rgba(255,255,255,0.08)] text-[#d1d4dc] flex items-center justify-center shrink-0 text-[12px]"
              dangerouslySetInnerHTML={{ __html: selectedOption.iconSvg }}
            />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <span className="vela-select-chevron shrink-0 flex items-center text-[#868a96]">
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          )}
        </span>
      </button>

      {/* Floating Popup with Natural Bézier Join */}
      {isOpen &&
        (typeof document !== "undefined" ? (
          createPortal(
            <div
              ref={popupRef}
              role="listbox"
              tabIndex={-1}
              data-position="fixed"
              data-chrome-joined="below"
              data-chrome-join-kind="field"
              style={{
                position: "fixed",
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${effectivePopupWidth}px`,
                minWidth: `${effectivePopupWidth}px`,
                zIndex: 120,
                padding: "7px",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                isolation: "isolate",
                display: "flex",
                alignItems: "stretch",
                gap: "2px",
              }}
              className={`vela-popover vela-ui-layer vela-select-list vela-select-dropdown vela-ui quant-chrome-menu quant-chrome-select overflow-visible select-none pointer-events-auto ${
                isScroll ? "is-scroll" : ""
              }`}
            >
              {dropdownContent}
            </div>,
            document.body
          )
        ) : (
          <div
            ref={popupRef}
            role="listbox"
            tabIndex={-1}
            data-chrome-joined="below"
            data-chrome-join-kind="field"
            style={{
              minWidth: popupMinWidth ?? minWidth,
              padding: "7px",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              display: "flex",
              alignItems: "stretch",
              gap: "2px",
            }}
            className={`vela-popover vela-ui-layer vela-select-list vela-select-dropdown absolute left-0 top-[28px] w-full min-w-full z-50 overflow-visible ${
              isScroll ? "is-scroll" : ""
            }`}
          >
            {dropdownContent}
          </div>
        ))}
    </div>
  );
}
