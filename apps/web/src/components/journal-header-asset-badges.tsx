"use client";

import { useMemo } from "react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { cn } from "@/lib/utils";

interface JournalHeaderAssetBadgesProps {
  trades?: Array<{ symbol: string }>;
  className?: string;
}

/**
 * Renders the asset badges for all instruments traded on a journal day.
 * Displays clean TradingView vector badges with single or dual-pair layouts.
 */
export function JournalHeaderAssetBadges({
  trades = [],
  className,
}: JournalHeaderAssetBadgesProps) {
  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) {
      if (t.symbol && t.symbol.trim()) {
        set.add(t.symbol.trim().toUpperCase());
      }
    }
    return Array.from(set);
  }, [trades]);

  if (symbols.length === 0) return null;

  const visible = symbols.slice(0, 3);
  const remaining = symbols.length - visible.length;

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}
      aria-label={`Traded instruments: ${symbols.join(", ")}`}
    >
      {visible.map((symbol) => (
        <span
          key={symbol}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/70 bg-card/60 shadow-2xs text-xs font-medium text-foreground"
        >
          <AssetIcon symbol={symbol} size="xs" />
          <span className="font-semibold tracking-tight">{symbol}</span>
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border/70 bg-muted/40 text-[11px] font-semibold text-muted-foreground"
          title={symbols.slice(3).join(", ")}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
