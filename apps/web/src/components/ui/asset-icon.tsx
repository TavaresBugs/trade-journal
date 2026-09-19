"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";

export interface AssetIconProps {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showBorder?: boolean;
}

const SIZE_MAP = {
  xs: { container: 20, icon: 14, single: 18 },
  sm: { container: 26, icon: 18, single: 24 },
  md: { container: 34, icon: 24, single: 32 },
  lg: { container: 44, icon: 30, single: 40 },
};

const FALLBACK_ICON = "/assets/icons/fallback.svg";

/**
 * Institutional TradingView-style asset icon.
 * Supports single circular branded icons and dual diagonal overlapping flag pairs.
 */
export function AssetIcon({ symbol, size = "sm", className, showBorder = false }: AssetIconProps) {
  const config = useMemo(() => getAssetIconConfig(symbol), [symbol]);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const isPair = config.type === "pair" && config.icons.length >= 2;
  const s = SIZE_MAP[size];

  const getSrc = (index: number) => {
    if (failed[index]) return FALLBACK_ICON;
    return config.icons[index] || FALLBACK_ICON;
  };

  const handleError = (index: number) => {
    setFailed((prev) => ({ ...prev, [index]: true }));
  };

  // Dual diagonal layout for forex and crypto pairs (TradingView style)
  if (isPair) {
    return (
      <span
        className={cn("relative inline-flex shrink-0 select-none", className)}
        style={{ width: s.container, height: s.container }}
        title={symbol}
        aria-label={symbol}
      >
        {/* Back icon (quote currency) - Top Right */}
        <span
          className="absolute top-0 right-0 overflow-hidden rounded-full bg-muted/40 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
          style={{ width: s.icon, height: s.icon, zIndex: 1 }}
        >
          <img
            src={getSrc(1)}
            alt={`${symbol} quote`}
            className="h-full w-full object-cover"
            onError={() => handleError(1)}
            loading="lazy"
            draggable={false}
          />
        </span>

        {/* Front icon (base currency) - Bottom Left with theme background ring */}
        <span
          className="absolute bottom-0 left-0 overflow-hidden rounded-full bg-muted/40 ring-2 ring-background shadow-xs"
          style={{ width: s.icon, height: s.icon, zIndex: 2 }}
        >
          <img
            src={getSrc(0)}
            alt={`${symbol} base`}
            className="h-full w-full object-cover"
            onError={() => handleError(0)}
            loading="lazy"
            draggable={false}
          />
        </span>
      </span>
    );
  }

  // Single circular icon (Indices, Commodities, Standalone Assets)
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none bg-muted/30 ring-1 ring-black/5 dark:ring-white/10",
        showBorder && "ring-1 ring-border",
        className,
      )}
      style={{ width: s.single, height: s.single }}
      title={symbol}
      aria-label={symbol}
    >
      <img
        src={getSrc(0)}
        alt={symbol}
        className="h-full w-full object-cover"
        onError={() => handleError(0)}
        loading="lazy"
        draggable={false}
      />
    </span>
  );
}
