"use client";

import { cn } from "@/lib/utils";

export interface UnitToggleProps<T extends string> {
  units: readonly T[] | T[];
  value: T;
  onChange: (next: T) => void;
  labels?: Partial<Record<T, string>>;
  className?: string;
}

export function UnitToggle<T extends string>({
  units,
  value,
  onChange,
  labels,
  className,
}: UnitToggleProps<T>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center rounded border border-border/70 bg-muted/60 p-0.5 text-[10px] font-mono",
        className,
      )}
    >
      {units.map((u) => {
        const isActive = value === u;
        const displayLabel = labels?.[u] ?? u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            className={cn(
              "px-1.5 py-0.5 rounded transition-[background-color,color] duration-150 font-medium",
              isActive
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
}
