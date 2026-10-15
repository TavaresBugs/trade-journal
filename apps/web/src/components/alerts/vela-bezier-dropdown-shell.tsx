"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export interface VelaBezierDropdownShellProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  minWidth?: number;
  width?: number;
  maxHeight?: number;
  className?: string;
  backgroundColor?: string;
  borderColor?: string;
  placement?: "bottom" | "top" | "auto";
  children: React.ReactNode;
}

/**
 * Vela Bézier Dropdown Shell (Natural Bézier Style - Modo 1: field-join)
 * Connects the trigger button to the portaled floating popup with a seamless
 * Bézier shoulder curve (sideOffset: -1px, viewBox="0 0 M P").
 * Features dynamic continuous ResizeObserver so expanding accordions
 * automatically recalculate the Bézier path without layout flicker.
 * Supports placement="top" for elements at bottom of viewports (e.g. Expiration).
 */
export function VelaBezierDropdownShell({
  isOpen,
  onClose,
  triggerRef,
  minWidth = 240,
  width,
  maxHeight = 360,
  className = "",
  backgroundColor = "#151619",
  borderColor = "#2a2e39",
  placement = "bottom",
  children,
}: VelaBezierDropdownShellProps) {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    triggerWidth: number;
    isTop: boolean;
  }>({
    top: 0,
    left: 0,
    triggerWidth: 0,
    isTop: false,
  });
  const [popupHeight, setPopupHeight] = useState(120);

  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Position popup flush with trigger (-1px seam)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tWidth = Math.round(rect.width);
    const targetPopupW = width ?? Math.max(minWidth, tWidth);
    const maxLeft = typeof window !== "undefined" ? window.innerWidth - targetPopupW - 12 : rect.left;
    const idealLeft = Math.round(rect.left);
    const clampedLeft = Math.max(12, Math.min(idealLeft, maxLeft));

    let isTop = placement === "top";
    if (placement === "auto" && typeof window !== "undefined") {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
        isTop = true;
      }
    }

    const calculatedTop = isTop
      ? Math.round(rect.top - popupHeight + 1)
      : Math.round(rect.bottom - 1);

    setCoords({
      top: calculatedTop,
      left: clampedLeft,
      triggerWidth: tWidth,
      isTop,
    });
  }, [minWidth, width, triggerRef, placement, popupHeight]);

  // Sync coords on open, scroll, or resize
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = (e: Event) => {
      // Don't reposition if user scrolls inside the popup content itself
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

  // Continuous height sync via ResizeObserver (crucial for accordions)
  useLayoutEffect(() => {
    if (!isOpen || !popupRef.current) return;

    if (popupRef.current.offsetHeight > 0) {
      setPopupHeight(popupRef.current.offsetHeight);
    }

    const ro = new ResizeObserver(() => {
      if (popupRef.current && popupRef.current.offsetHeight > 0) {
        setPopupHeight(popupRef.current.offsetHeight);
      }
    });

    ro.observe(popupRef.current);
    if (contentRef.current) ro.observe(contentRef.current);

    return () => ro.disconnect();
  }, [isOpen]);

  // Outside click & Escape listener
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
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose, triggerRef]);

  // Direct wheel scroll handler to ensure smooth scrolling inside Radix Dialogs
  useEffect(() => {
    const el = contentRef.current;
    if (!isOpen || !el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = el;
      const delta = e.deltaY;
      const canScrollDown = delta > 0 && scrollTop + clientHeight < scrollHeight;
      const canScrollUp = delta < 0 && scrollTop > 0;
      if (canScrollDown || canScrollUp) {
        el.scrollTop += delta;
      }
      e.preventDefault();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isOpen]);

  if (!isOpen) return null;

  const effectivePopupWidth = width ?? Math.max(minWidth, coords.triggerWidth || minWidth);
  const M = effectivePopupWidth;
  const P = Math.max(30, popupHeight);
  const tW = coords.triggerWidth || minWidth;
  const N = Math.max(0, M - tW);

  // Modo 1A Bézier path calculation:
  // Starts at trigger seam edge, goes across, rounds walls,
  // and rounds concave back to the trigger edge.
  const dPath = coords.isTop
    ? `M 0.5 ${P} V 7 Q 0.5 0.5 7 0.5 H ${M - 7} Q ${M - 0.5} 0.5 ${M - 0.5} 7 ${
        N > 3
          ? `V ${P - 7} Q ${M - 0.5} ${P - 0.5} ${M - 7} ${P - 0.5} H ${Math.max(7, tW)}`
          : `V ${P}`
      }`
    : `M 0.5 0 V ${P - 7} Q 0.5 ${P - 0.5} 7 ${P - 0.5} H ${M - 7} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - 7} ${
        N > 3
          ? `V 7 Q ${M - 0.5} 0.5 ${M - 7} 0.5 H ${Math.max(7, tW)}`
          : "V 0"
      }`;

  const effectiveMaxHeight =
    typeof window !== "undefined" && coords.top > 0
      ? Math.max(120, Math.min(maxHeight, coords.isTop ? coords.top + popupHeight - 20 : window.innerHeight - coords.top - 20))
      : maxHeight;

  return createPortal(
    <div
      ref={popupRef}
      role="region"
      tabIndex={-1}
      data-chrome-joined={coords.isTop ? "above" : "below"}
      data-chrome-join-kind="field"
      data-scroll-lock-scrollable="true"
      data-radix-scroll-lock-ignore="true"
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${effectivePopupWidth}px`,
        minWidth: `${effectivePopupWidth}px`,
        zIndex: 150,
        background: "transparent",
        border: "none",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        isolation: "isolate",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
      }}
      className={`vela-bezier-dropdown-shell select-none pointer-events-auto ${className}`}
    >
      {/* SVG Join Background Layer */}
      <div
        aria-hidden="true"
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
          <path d={`${dPath} Z`} fill={backgroundColor} />
          <path d={dPath} fill="none" stroke={borderColor} strokeWidth="1" />
        </svg>
      </div>

      {/* Internal Content Container with Visible Sleek Scrollbar */}
      <div
        ref={contentRef}
        data-scroll-lock-scrollable="true"
        tabIndex={0}
        className="vela-bezier-dropdown-content relative z-10 flex flex-col p-1.5 overflow-x-hidden outline-none"
        style={{
          maxHeight: effectiveMaxHeight,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#434651 transparent",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
