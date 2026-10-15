"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export interface FloatingPositionConfig {
  anchorRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  popWidth: number;
  popHeight: number;
  align?: "left" | "right" | "center";
  preferredPlacement?: "bottom" | "top";
  offset?: number;
  boundsRect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null;
}

export interface ComputedFloatingPosition {
  top: number;
  left: number;
  placement: "bottom" | "top";
  maxHeight: number;
}

export function computeFloatingPosition({
  anchorRect,
  popWidth,
  popHeight,
  align = "left",
  preferredPlacement = "bottom",
  offset = 6,
  boundsRect = null,
}: FloatingPositionConfig): ComputedFloatingPosition {
  const winW = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280;
  const winH = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 800;

  const hasValidBounds =
    boundsRect !== null &&
    boundsRect !== undefined &&
    boundsRect.width > 0 &&
    boundsRect.height > 0;

  const minTop = hasValidBounds ? Math.max(8, boundsRect!.top + 6) : 8;
  const maxBottom = hasValidBounds ? Math.min(winH - 8, boundsRect!.bottom - 6) : winH - 8;
  const minLeft = hasValidBounds ? Math.max(8, boundsRect!.left + 6) : 8;
  const maxRight = hasValidBounds ? Math.min(winW - 8, boundsRect!.right - 6) : winW - 8;

  const effectivePopW = popWidth > 0 ? popWidth : 200;
  const effectivePopH = popHeight > 0 ? popHeight : 180;

  // Vertical calculation with Auto-Flip
  let placement: "bottom" | "top" = preferredPlacement;
  let top =
    preferredPlacement === "top"
      ? anchorRect.top - effectivePopH - offset
      : anchorRect.bottom + offset;

  if (preferredPlacement === "top") {
    if (top < minTop) {
      const flippedTop = anchorRect.bottom + offset;
      if (flippedTop + effectivePopH <= maxBottom || maxBottom - anchorRect.bottom > anchorRect.top - minTop) {
        placement = "bottom";
        top = flippedTop;
      }
    }
  } else {
    if (top + effectivePopH > maxBottom) {
      const flippedTop = anchorRect.top - effectivePopH - offset;
      if (flippedTop >= minTop || anchorRect.top - minTop > maxBottom - anchorRect.bottom) {
        placement = "top";
        top = flippedTop;
      }
    }
  }

  // Final vertical clamp so it never overflows [minTop, maxBottom]
  const clampedMaxTop = Math.max(minTop, maxBottom - effectivePopH);
  top = Math.max(minTop, Math.min(top, clampedMaxTop));

  // Horizontal calculation with Clamping
  let left = anchorRect.left;
  if (align === "right") {
    left = anchorRect.right - effectivePopW;
  } else if (align === "center") {
    left = anchorRect.left + anchorRect.width / 2 - effectivePopW / 2;
  }

  const clampedMaxLeft = Math.max(minLeft, maxRight - effectivePopW);
  left = Math.max(minLeft, Math.min(left, clampedMaxLeft));

  const maxHeight = Math.max(120, maxBottom - minTop);

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
    maxHeight: Math.round(maxHeight),
  };
}

export interface FloatingPortalPopoverProps {
  anchorRef: React.RefObject<Element | null>;
  isOpen: boolean;
  onClose?: () => void;
  align?: "left" | "right" | "center";
  preferredPlacement?: "bottom" | "top";
  offset?: number;
  boundsRef?: React.RefObject<HTMLElement | null>;
  estimatedWidth?: number;
  estimatedHeight?: number;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  role?: string;
  dataQaId?: string;
  dataComponent?: string;
  dataName?: string;
  id?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const FloatingPortalPopover: React.FC<FloatingPortalPopoverProps> = ({
  anchorRef,
  isOpen,
  onClose,
  align = "left",
  preferredPlacement = "bottom",
  offset = 6,
  boundsRef,
  estimatedWidth = 200,
  estimatedHeight = 180,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  className = "",
  style,
  children,
  role,
  dataQaId,
  dataComponent,
  dataName,
  id,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<ComputedFloatingPosition | null>(null);

  const resolvePosition = useCallback((): ComputedFloatingPosition => {
    const anchorEl = anchorRef?.current;
    const anchorRect = anchorEl
      ? anchorEl.getBoundingClientRect()
      : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };

    const popEl = popoverRef.current;
    const popRect = popEl ? popEl.getBoundingClientRect() : null;
    const popWidth = popRect && popRect.width > 0 ? popRect.width : estimatedWidth;
    const popHeight = popRect && popRect.height > 0 ? popRect.height : estimatedHeight;

    const boundsRect = boundsRef?.current
      ? boundsRef.current.getBoundingClientRect()
      : null;

    return computeFloatingPosition({
      anchorRect,
      popWidth,
      popHeight,
      align,
      preferredPlacement,
      offset,
      boundsRect,
    });
  }, [anchorRef, align, preferredPlacement, offset, boundsRef, estimatedWidth, estimatedHeight]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    setCoords(resolvePosition());
  }, [isOpen, resolvePosition, children]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      setCoords(resolvePosition());
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, resolvePosition]);

  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      if (!closeOnOutsideClick) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!closeOnEscape) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDownOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, closeOnOutsideClick, closeOnEscape, anchorRef]);

  if (!isOpen) return null;

  const activeCoords = coords ?? resolvePosition();

  const node = (
    <div
      ref={popoverRef}
      id={id}
      role={role}
      data-qa-id={dataQaId}
      data-component={dataComponent}
      data-name={dataName}
      data-placement={activeCoords.placement}
      className={`fixed z-[70] pointer-events-auto ${className}`}
      style={{
        top: `${activeCoords.top}px`,
        left: `${activeCoords.left}px`,
        maxHeight: `${activeCoords.maxHeight}px`,
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(node, document.body);
  }
  return node;
};
