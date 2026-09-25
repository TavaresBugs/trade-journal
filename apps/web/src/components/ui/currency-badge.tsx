"use client";

import { cn } from "@/lib/utils";
import { getCurrencyInfo } from "@/lib/currencies";

interface CurrencyBadgeProps {
  code?: string | null;
  className?: string;
  showName?: boolean;
}

export function CurrencyBadge({ code, className, showName = false }: CurrencyBadgeProps) {
  const info = getCurrencyInfo(code);
  return (
    <div className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <img
        src={info.flag}
        alt={info.code}
        className="w-4.5 h-3 rounded-[2px] object-cover shrink-0 border border-border/50 shadow-2xs"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = "none";
        }}
      />
      <span className="font-medium text-foreground">{info.code}</span>
      <span className="text-[11px] text-muted-foreground">({info.symbol})</span>
      {showName && info.name !== info.code && (
        <span className="text-[11px] text-muted-foreground/80 truncate">· {info.name}</span>
      )}
    </div>
  );
}
