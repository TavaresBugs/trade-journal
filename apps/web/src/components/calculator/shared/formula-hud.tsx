"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FormulaHudCategory {
  label: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  heading?: string;
  advice?: string;
}

export interface FormulaHudProps {
  title: string;
  category?: FormulaHudCategory;
  copyText?: string;
  onCopy?: () => void;
  // Step 1: Theory
  theoryNumerator: React.ReactNode;
  theoryDenominator: React.ReactNode;
  // Step 2: Live Values
  valueNumerator: React.ReactNode;
  valueDenominator: React.ReactNode;
  // Step 3: Result
  resultValue: React.ReactNode;
  resultLabel: string;
  resultSecondary?: React.ReactNode;
  // Additional content (e.g. scenario list)
  children?: React.ReactNode;
  className?: string;
}

export function FormulaHud({
  title,
  category,
  copyText,
  onCopy,
  theoryNumerator,
  theoryDenominator,
  valueNumerator,
  valueDenominator,
  resultValue,
  resultLabel,
  resultSecondary,
  children,
  className,
}: FormulaHudProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failure
      }
    }
  };

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/30 p-3.5", className)}>
      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {category && (
            <HoverHint heading={category.heading} content={category.advice}>
              <button
                type="button"
                className={cn(
                  "h-4 inline-flex items-center rounded border px-1.5 font-mono text-[9px] font-semibold cursor-help transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  category.border,
                  category.bg,
                  category.color,
                )}
              >
                {category.label}
              </button>
            </HoverHint>
          )}
        </div>
        {(copyText || onCopy) && (
          <HoverHint content="Copy metrics to clipboard">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-profit" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </HoverHint>
        )}
      </div>

      {/* MAIN ROW: THREE-STEP PROGRESSION */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 py-1">
        {/* STEP 1: THEORY FRACTION */}
        <div className="inline-flex flex-col items-center text-center shrink-0">
          <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pb-0.5 tracking-wide whitespace-nowrap">
            {theoryNumerator}
          </span>
          <span className="w-full border-b border-foreground/30 my-0.5" />
          <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
            {theoryDenominator}
          </span>
        </div>

        <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

        {/* STEP 2: LIVE VALUES FRACTION */}
        <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
          <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
            {valueNumerator}
          </div>
          <span className="w-full border-b border-foreground/30 my-0.5" />
          <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
            {valueDenominator}
          </div>
        </div>

        <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

        {/* STEP 3: ACTIONABLE RESULT */}
        <div className="flex flex-col justify-center text-right shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            {resultValue}
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {resultLabel}
            </span>
          </div>
          {resultSecondary}
        </div>
      </div>

      {/* ADDITIONAL SLOTS (E.G. SCENARIOS) */}
      {children}
    </div>
  );
}
