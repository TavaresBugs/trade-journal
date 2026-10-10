"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export const VELA_TOOLTIPS_CATALOG: Record<string, { title: string; description: string }> = {
  "animate-zoom": {
    title: "Animate zoom",
    description: "Glide the chart to each zoom step instead of jumping.",
  },
  "pan-momentum": {
    title: "Pan momentum",
    description: "Add smooth physics and inertia deceleration when panning the chart.",
  },
  "animate-price-scale": {
    title: "Animate price scale",
    description: "Smoothly interpolate price axis scale transitions during autoscale and data updates.",
  },
  "animate-price-changes": {
    title: "Animate price changes",
    description: "Animate candlestick transitions and price updates seamlessly in real time.",
  },
  "reveal-on-load": {
    title: "Reveal on load",
    description: "Staggered fade and rise animation when loading chart series onto the canvas.",
  },
};

export interface VelaInfoTooltipProps {
  title?: string;
  description?: string;
  tooltipKey?: string;
  openDelayMs?: number;
  className?: string;
  align?: "left" | "right" | "auto";
}

export function VelaInfoIcon({
  className = "",
  size = 12,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 7.4v4.4" />
      <circle cx="8" cy="4.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Official LuxAlgo Vela Info Tooltip Popover (Reference: print_20261009_140056.png)
 * Trigger: Circular 18x18px button positioned immediately before the switch.
 * Popover: 260px floating dark card with 24x24 squircle badge, title, divider, and description.
 */
export function VelaInfoTooltip({
  title,
  description,
  tooltipKey,
  openDelayMs = 180,
  className = "",
  align = "auto",
}: VelaInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverAlign, setPopoverAlign] = useState<"left" | "right">("right");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const catalogEntry = tooltipKey ? VELA_TOOLTIPS_CATALOG[tooltipKey] : undefined;
  const effectiveTitle = title ?? catalogEntry?.title ?? "Info";
  const effectiveDescription = description ?? catalogEntry?.description ?? "";

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, openDelayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen((prev) => !prev);
  };

  // Determine alignment when popover opens
  useEffect(() => {
    if (!isOpen) return;

    if (align === "left" || align === "right") {
      setPopoverAlign(align);
      return;
    }

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // If trigger is closer to left side (< 320px from screen left), align left so popover opens rightwards
      if (rect.left < 320) {
        setPopoverAlign("left");
      } else {
        setPopoverAlign("right");
      }
    }
  }, [isOpen, align]);

  // Close on outside pointerdown or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
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

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        role="button"
        aria-label={`Info: ${effectiveTitle}`}
        aria-expanded={isOpen}
        onClick={handleClick}
        className="w-[18px] h-[18px] rounded-full bg-[#23252a] text-[#868a96] hover:bg-[#2e323b] hover:text-white cursor-pointer transition-colors flex items-center justify-center shrink-0 border border-transparent select-none focus:outline-hidden"
      >
        <VelaInfoIcon size={12} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="tooltip"
          className={`absolute ${
            popoverAlign === "left" ? "left-0" : "right-0"
          } top-full mt-2 w-[260px] bg-[#1a1b1e] border border-[#2a2b30] rounded-xl shadow-2xl p-3.5 z-60 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header Row */}
          <div className="flex items-center gap-2.5">
            <div className="w-[24px] h-[24px] rounded-[7px] bg-[#23252a] text-white flex items-center justify-center shrink-0">
              <VelaInfoIcon size={14} />
            </div>
            <h5 className="text-[13px] font-bold text-white tracking-tight leading-snug">
              {effectiveTitle}
            </h5>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2a2b30] my-2.5 w-full" />

          {/* Description */}
          <p className="text-[12px] leading-relaxed text-[#9aa0a6]">
            {effectiveDescription}
          </p>
        </div>
      )}
    </div>
  );
}
