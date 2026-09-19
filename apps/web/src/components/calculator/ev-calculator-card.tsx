"use client";

import { useMemo, useState } from "react";
import { calculateExpectedValue } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";
import { FormulaHud } from "./shared";

interface EvCalculatorCardProps {
  values: CalculatorState["ev"];
  onChange: (patch: Partial<CalculatorState["ev"]>) => void;
}

export function EvCalculatorCard({ values, onChange }: EvCalculatorCardProps) {
  const { avgPayout, payoutChance, cost, passRate } = values;
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

  const evFormatted =
    evResult >= 0 ? `+$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`;
  const roiFormatted = roiPercent >= 0 ? `+${roiPercent}%` : `${roiPercent}%`;
  const copyText = `EV: ${evFormatted}/eval (${roiFormatted} ROI) | Payout: $${avgPayout.toLocaleString("en-US")} (${payoutChance}%) | Cost: $${cost} | Pass: ${passRate}% (Breakeven: ${breakevenPassRate}%)`;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case [text-wrap:balance]">
            EV Calculator
          </CardTitle>
          <p className="text-xs text-muted-foreground [text-wrap:pretty]">
            Expected Value per Eval:{" "}
            <span className="font-mono text-[11px] font-medium text-foreground/80">
              (Pass Rate × Payout Chance × Avg Payout) − Eval Cost
            </span>
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
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
        <FormulaHud
          title="Expected value outcome"
          category={{
            label: "Expected Value",
            color: evResult >= 0 ? "text-profit" : "text-loss",
            border: evResult >= 0 ? "border-profit/50" : "border-loss/50",
            bg: evResult >= 0 ? "bg-profit/20" : "bg-loss/20",
            heading: "EV per Evaluation",
            advice:
              "Quantifies the mathematical average return per evaluation attempt after taking into account qualification rates and payout probabilities.",
          }}
          copyText={copyText}
          theoryNumerator="Pass% × Payout% × Avg"
          theoryDenominator="− Eval Cost ($)"
          valueNumerator={
            <>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                  isPassFocused
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-foreground",
                )}
              >
                {passRate}%
              </span>
              <span className="text-muted-foreground/60 px-0.5">×</span>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                  isPayoutChanceFocused
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-foreground",
                )}
              >
                {payoutChance}%
              </span>
              <span className="text-muted-foreground/60 px-0.5">×</span>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                  isAvgPayoutFocused
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-foreground",
                )}
              >
                ${avgPayout.toLocaleString("en-US")}
              </span>
            </>
          }
          valueDenominator={
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
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                evResult >= 0 ? "text-profit" : "text-loss",
              )}
            >
              <MonetaryValue>
                {evResult >= 0 ? `+$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`}
              </MonetaryValue>
            </span>
          }
          resultLabel="/eval"
          resultSecondary={
            cost > 0 ? (
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-mono font-medium tnum",
                  roiPercent >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {roiPercent >= 0 ? `+${roiPercent}% ROI` : `${roiPercent}% ROI`}
              </span>
            ) : undefined
          }
        >
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
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
