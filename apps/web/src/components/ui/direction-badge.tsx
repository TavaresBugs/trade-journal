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
  if (!direction) {
    return <span className="text-muted-foreground select-none">–</span>;
  }

  const dir = direction.toLowerCase();
  if (dir !== "long" && dir !== "short") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-transparent bg-muted/50 font-medium text-muted-foreground select-none",
          size === "xs" && "px-1.5 py-0.5 text-[10px]",
          size === "sm" && "px-2 py-0.5 text-xs",
          size === "md" && "px-2.5 py-1 text-xs",
          className,
        )}
        {...props}
      >
        {direction.toUpperCase()}
      </span>
    );
  }

  const isLong = dir === "long";
  const Icon = isLong ? TrendingUp : TrendingDown;
  const label = isLong ? "LONG" : "SHORT";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 font-medium tracking-wide rounded-md border border-transparent select-none transition-colors",
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        isLong ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          "shrink-0",
          size === "xs" && "h-2.5 w-2.5",
          size === "sm" && "h-3.5 w-3.5",
          size === "md" && "h-4 w-4",
        )}
        strokeWidth={2}
      />
      <span>{label}</span>
    </span>
  );
}
