"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { type OrderType } from "@/lib/paper-trading/types";
import { BOLETA_COLORS } from "./boleta-tokens";
import { computeFloatingPosition, type ComputedFloatingPosition } from "../floating-portal-popover";

export interface BoletaOrderTypePopoverProps {
  isOpen: boolean;
  currentType: OrderType;
  color?: string;
  onSelectType: (type: OrderType) => void;
  onClose: () => void;
  className?: string;
  anchorRef?: React.RefObject<Element | null>;
  boundsRef?: React.RefObject<HTMLElement | null>;
}

const ORDER_TYPES: Array<{ type: OrderType; label: string; desc: string }> = [
  { type: "limit", label: "Limit", desc: "Execute at limit price or better" },
  { type: "stop", label: "Stop", desc: "Trigger market when price crosses level" },
  { type: "market", label: "Market", desc: "Execute immediately at market price" },
  { type: "stop_limit", label: "Stop limit", desc: "Trigger limit order at price" },
];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const BoletaOrderTypePopover: React.FC<BoletaOrderTypePopoverProps> = ({
  isOpen,
  currentType,
  color = BOLETA_COLORS.buy,
  onSelectType,
  onClose,
  className = "",
  anchorRef,
  boundsRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<ComputedFloatingPosition | null>(null);

  const resolveCoords = useCallback((): ComputedFloatingPosition => {
    const anchorRect = anchorRef?.current
      ? anchorRef.current.getBoundingClientRect()
      : { top: 200, bottom: 226, left: 400, right: 490, width: 90, height: 26 };
    const popRect = popoverRef.current?.getBoundingClientRect();
    const boundsRect = boundsRef?.current?.getBoundingClientRect() ?? null;

    return computeFloatingPosition({
      anchorRect,
      popWidth: popRect && popRect.width > 0 ? popRect.width : 176,
      popHeight: popRect && popRect.height > 0 ? popRect.height : 196,
      align: "right",
      preferredPlacement: "top",
      offset: 8,
      boundsRect,
    });
  }, [anchorRef, boundsRef]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    setCoords(resolveCoords());
  }, [isOpen, resolveCoords]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => setCoords(resolveCoords());
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, resolveCoords]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const activeCoords = coords ?? resolveCoords();

  const node = (
    <div
      ref={popoverRef}
      data-component="order-type-popover"
      data-placement={activeCoords.placement}
      className={`fixed z-[70] w-44 rounded-lg bg-[#0F1115] border border-[#2a2b30] shadow-2xl p-1.5 select-none pointer-events-auto animate-in fade-in zoom-in-95 duration-100 ${className}`}
      style={{
        top: `${activeCoords.top}px`,
        left: `${activeCoords.left}px`,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-[#9a9ea8] uppercase tracking-wider">
        Order Type
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {ORDER_TYPES.map((item) => {
          const isSelected = item.type === currentType;
          return (
            <button
              key={item.type}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectType(item.type);
                onClose();
              }}
              className={`flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors ${
                isSelected
                  ? "bg-[#1e1f24] text-white font-medium"
                  : "text-[#d1d4dc] hover:bg-[#1a1b20] hover:text-white"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[12px] leading-tight font-sans" style={{ color: isSelected ? color : undefined }}>
                  {item.label}
                </span>
                <span className="text-[10px] text-[#787b86] leading-tight">
                  {item.desc}
                </span>
              </div>
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 ml-1">
                  <path
                    d="M3 8.5L6.5 12L13 4"
                    stroke={color}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(node, document.body);
  }
  return node;
};

