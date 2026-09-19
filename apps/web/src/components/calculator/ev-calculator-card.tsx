"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { calculateExpectedValue } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface EvCalculatorCardProps {
  values: CalculatorState["ev"];
  onChange: (patch: Partial<CalculatorState["ev"]>) => void;
}

export function EvCalculatorCard({ values, onChange }: EvCalculatorCardProps) {
  const { avgPayout, payoutChance, cost, passRate } = values;
  const [copied, setCopied] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [isPayoutChanceFocused, setIsPayoutChanceFocused] = useState(false);
  const [isAvgPayoutFocused, setIsAvgPayoutFocused] = useState(false);
  const [isCostFocused, setIsCostFocused] = useState(false);

  const evResult = useMemo(() => {
    return calculateExpectedValue(cost, passRate, payoutChance, avgPayout);
  }, [cost, passRate, payoutChance, avgPayout]);

  const expectedPayoutPerPass = useMemo(() => {
    return (payoutChance / 100) * avgPayout;
  }, [payoutChance, avgPayout]);

  const breakevenPassRate = useMemo(() => {
    if (expectedPayoutPerPass <= 0) return 0;
    return Number(((cost / expectedPayoutPerPass) * 100).toFixed(1));
  }, [cost, expectedPayoutPerPass]);

  const roiPercent = useMemo(() => {
    if (cost <= 0) return 0;
    return Math.round((evResult / cost) * 100);
  }, [evResult, cost]);

  const edgeBuffer = useMemo(() => {
    if (breakevenPassRate <= 0) return 0;
    return Number((passRate - breakevenPassRate).toFixed(1));
  }, [passRate, breakevenPassRate]);

  const handleCopyEv = async () => {
    const evFormatted =
      evResult >= 0 ? `+$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`;
    const roiFormatted = roiPercent >= 0 ? `+${roiPercent}%` : `${roiPercent}%`;
    const text = `EV: ${evFormatted}/eval (${roiFormatted} ROI) | Payout: $${avgPayout.toLocaleString("en-US")} (${payoutChance}%) | Cost: $${cost} | Pass: ${passRate}% (Breakeven: ${breakevenPassRate}%)`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case [text-wrap:balance]">
              EV Calculator
            </CardTitle>
            {cost > 0 && (
              <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
                ${cost} eval cost
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground [text-wrap:pretty]">
            Expected Value per Eval:{" "}
            <span className="font-mono text-[11px] font-medium text-foreground/80">
              (Pass Rate × Payout Chance × Avg Payout) − Eval Cost
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3.5">
          {/* 1º: EVAL PASS RATE (%) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval pass rate (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={passRate || ""}
              placeholder="40"
              onFocus={() => setIsPassFocused(true)}
              onBlur={() => setIsPassFocused(false)}
              onChange={(e) => onChange({ passRate: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 2º: PAYOUT CHANCE (%) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payout chance (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={payoutChance || ""}
              placeholder="40"
              onFocus={() => setIsPayoutChanceFocused(true)}
              onBlur={() => setIsPayoutChanceFocused(false)}
              onChange={(e) => onChange({ payoutChance: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 3º: AVERAGE PAYOUT ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Average payout ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={avgPayout || ""}
              placeholder="2000"
              onFocus={() => setIsAvgPayoutFocused(true)}
              onBlur={() => setIsAvgPayoutFocused(false)}
              onChange={(e) => onChange({ avgPayout: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 4º: EVAL COST ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval cost ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={cost || ""}
              placeholder="89"
              onFocus={() => setIsCostFocused(true)}
              onBlur={() => setIsCostFocused(false)}
              onChange={(e) => onChange({ cost: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        {/* UNIFIED HUD: EV HERO + LIVE MATHEMATICAL RESOLUTION */}
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-3">
          {/* HEADER ROW */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Expected value outcome
              </span>
              <span className="h-4 inline-flex items-center rounded border border-border/60 bg-background/60 px-1 font-mono text-[9px] text-muted-foreground">
                Gross Return − Cost
              </span>
            </div>
            <HoverHint content="Copy EV breakdown to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                onClick={handleCopyEv}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy analysis"}
              </Button>
            </HoverHint>
          </div>

          {/* MAIN ROW: THE THREE-STEP PROGRESSION (THEORY -> LIVE COMPLEX DATA -> DIRECT RESULT) */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-1">
            {/* STEP 1 (LEFT): CONCEPTUAL / THEORETICAL FORMULA */}
            <div className="inline-flex flex-col items-center text-center shrink-0">
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pb-0.5 tracking-wide whitespace-nowrap">
                Pass% × Payout% × Avg
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                − Eval Cost ($)
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA IN FORMULA (RAW INPUTS, NOT RESUMIDO) */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="flex items-center text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum",
                    isPassFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-foreground",
                  )}
                >
                  {passRate}%
                </span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum",
                    isPayoutChanceFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-foreground",
                  )}
                >
                  {payoutChance}%
                </span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum",
                    isAvgPayoutFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-foreground",
                  )}
                >
                  ${avgPayout.toLocaleString("en-US")}
                </span>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                    isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "text-muted-foreground",
                  )}
                >
                  − ${cost.toLocaleString("en-US")}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 3 (RIGHT): FINAL ACTIONABLE EV RESULT (DIRECT ANSWER) */}
            <div className="flex flex-col justify-center text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                    evResult >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  <MonetaryValue>
                    {evResult >= 0
                      ? `+$${evResult.toFixed(2)}`
                      : `-$${Math.abs(evResult).toFixed(2)}`}
                  </MonetaryValue>
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">/eval</span>
              </div>
              {cost > 0 && (
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-mono font-medium tnum",
                    roiPercent >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {roiPercent >= 0 ? `+${roiPercent}% ROI` : `${roiPercent}% ROI`}
                </span>
              )}
            </div>
          </div>

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Breakeven pass</span>
              <span className="font-mono font-semibold text-foreground tnum">
                {breakevenPassRate > 0 && breakevenPassRate <= 100
                  ? `${breakevenPassRate}%`
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Edge buffer</span>
              <span
                className={cn(
                  "font-mono font-semibold tnum",
                  edgeBuffer >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {edgeBuffer >= 0 ? `+${edgeBuffer.toFixed(1)}%` : `${edgeBuffer.toFixed(1)}%`}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Expected payout</span>
              <span className="font-mono font-semibold text-profit tnum">
                <MonetaryValue>
                  +${Math.round(expectedPayoutPerPass).toLocaleString("en-US")}
                </MonetaryValue>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
