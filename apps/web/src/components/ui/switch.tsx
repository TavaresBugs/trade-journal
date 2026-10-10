"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "default" | "sm" | "compact";
}

export function Switch({
  checked = false,
  onCheckedChange,
  className,
  size = "default",
  disabled = false,
  ...props
}: SwitchProps) {
  const isCompact = size === "compact";
  const isSm = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-in-out select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isCompact
          ? "h-[15px] w-[26px] px-[2px]"
          : isSm
          ? "h-5 w-9 p-0.5"
          : "h-6 w-11 p-0.5",
        isCompact
          ? checked
            ? "border-[#6b7080] bg-[#5c606d]"
            : "border-[#34353b]/80 bg-[#22242a] hover:border-[#444752] hover:bg-[#282a32]"
          : checked
          ? "border-white bg-white"
          : "border-zinc-700/70 bg-zinc-800 hover:border-zinc-600 hover:bg-zinc-700/80",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full transition-transform duration-200 ease-in-out",
          isCompact
            ? "size-[9px]"
            : isSm
            ? "size-3.5 shadow-xs"
            : "size-4.5 shadow-xs",
          isCompact
            ? checked
              ? "translate-x-[11px] bg-[#ffffff]"
              : "translate-x-0 bg-[#6c707d]"
            : checked
            ? isSm
              ? "translate-x-4 bg-zinc-950"
              : "translate-x-5 bg-zinc-950"
            : "translate-x-0 bg-white",
        )}
      />
    </button>
  );
}
