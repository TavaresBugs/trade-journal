"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked = false,
  onCheckedChange,
  className,
  disabled = false,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-white bg-white"
          : "border-zinc-700/70 bg-zinc-800 hover:border-zinc-600 hover:bg-zinc-700/80",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-4.5 rounded-full shadow-xs transition-all duration-200 ease-in-out",
          checked ? "translate-x-5 bg-zinc-950" : "translate-x-0 bg-white",
        )}
      />
    </button>
  );
}
