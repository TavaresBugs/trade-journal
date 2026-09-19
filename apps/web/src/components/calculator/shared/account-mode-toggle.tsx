"use client";

import { Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountModeToggleProps {
  mode: "funded" | "live";
  onChange: (mode: "funded" | "live") => void;
  className?: string;
}

export function AccountModeToggle({ mode, onChange, className }: AccountModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Account Mode"
      className={cn(
        "inline-flex items-center rounded-lg border border-border/70 bg-muted/50 p-0.5 text-xs font-medium",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("funded")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-[background-color,color] duration-150 font-medium",
          mode === "funded"
            ? "bg-background text-foreground font-semibold shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Building2 className="h-3 w-3 text-primary shrink-0" />
        Funded Account
      </button>
      <button
        type="button"
        onClick={() => onChange("live")}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-[background-color,color] duration-150 font-medium",
          mode === "live"
            ? "bg-background text-foreground font-semibold shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <User className="h-3 w-3 text-profit shrink-0" />
        Live
      </button>
    </div>
  );
}
