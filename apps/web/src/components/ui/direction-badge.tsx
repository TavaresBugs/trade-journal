import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DirectionBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  direction?: "long" | "short" | string | null;
  size?: "xs" | "sm" | "md";
}

/**
 * Visual direction indicator matching institutional trading interfaces.
 * Features trending sparkline vectors with emerald LONG and rose SHORT styling.
 */
export function DirectionBadge({
  direction,
  size = "sm",
  className,
  ...props
}: DirectionBadgeProps) {
  const isLong = (direction ?? "").toLowerCase() === "long";
  const Icon = isLong ? TrendingUp : TrendingDown;
  const label = isLong ? "LONG" : "SHORT";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tracking-wide rounded-full border select-none transition-colors",
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        isLong
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "border-rose-500/25 bg-rose-500/10 text-rose-500 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-400",
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          "shrink-0",
          size === "xs" && "h-2.5 w-2.5",
          size === "sm" && "h-3 w-3",
          size === "md" && "h-3.5 w-3.5",
        )}
        strokeWidth={2.5}
      />
      <span>{label}</span>
    </span>
  );
}
