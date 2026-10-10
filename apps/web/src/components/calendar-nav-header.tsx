"use client";

import React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

export interface CalendarNavHeaderProps {
  year: number;
  month: number; // 1-12
  onMonthChange: (next: { year: number; month: number }) => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

export function CalendarNavHeader({
  year,
  month,
  onMonthChange,
  headerLeft,
  headerRight,
  className,
}: CalendarNavHeaderProps) {
  const handlePrev = () => {
    const prev = new Date(Date.UTC(year, month - 2, 1));
    onMonthChange({ year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 });
  };

  const handleNext = () => {
    const next = new Date(Date.UTC(year, month, 1));
    onMonthChange({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
  };

  return (
    <div className={cn("grid grid-cols-[1fr_auto_1fr] items-center pb-3 px-1 min-h-8", className)}>
      {/* Left slot */}
      <div className="flex items-center justify-start min-w-0">{headerLeft}</div>

      {/* Center: Month & Year Nav */}
      <div className="flex items-center justify-center gap-1">
        {/* Previous Month Button < */}
        <button
          type="button"
          aria-label="Previous month"
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
          onClick={handlePrev}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Month Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
              <span>{MONTH_NAMES[month - 1] ?? `Month ${month}`}</span>
              <ChevronDown className="size-3 text-muted-foreground opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-36">
            {MONTH_NAMES.map((name, idx) => (
              <DropdownMenuItem
                key={name}
                className={cn(
                  "text-xs font-medium cursor-pointer",
                  idx + 1 === month && "bg-accent font-bold text-accent-foreground",
                )}
                onSelect={() => {
                  onMonthChange({ year, month: idx + 1 });
                }}
              >
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Year Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
              <span>{year}</span>
              <ChevronDown className="size-3 text-muted-foreground opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-24 max-h-60 overflow-y-auto">
            {YEARS.map((yr) => (
              <DropdownMenuItem
                key={yr}
                className={cn(
                  "text-xs font-medium cursor-pointer",
                  yr === year && "bg-accent font-bold text-accent-foreground",
                )}
                onSelect={() => {
                  onMonthChange({ year: yr, month });
                }}
              >
                {yr}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Next Month Button > */}
        <button
          type="button"
          aria-label="Next month"
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
          onClick={handleNext}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Right slot */}
      <div className="flex justify-end items-center">{headerRight}</div>
    </div>
  );
}
