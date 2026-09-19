"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getBinomialDistribution } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface BinomialOddsCardProps {
  values: CalculatorState["budget"];
  onChange: (patch: Partial<CalculatorState["budget"]>) => void;
}

export function BinomialOddsCard({ values, onChange }: BinomialOddsCardProps) {
  const { passRate, bankroll } = values;
  const evalCost = values.evalCost ?? 89;
  const [copied, setCopied] = useState(false);
  const [isBankrollFocused, setIsBankrollFocused] = useState(false);
  const [isCostFocused, setIsCostFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [distributionMode, setDistributionMode] = useState<"cumulative" | "exact">("cumulative");

  // Cap at 30 attempts for binomial numerical stability and responsive rendering
  const affordableEvals = Math.max(1, Math.floor(bankroll / (evalCost || 1)));
  const budgetEvalCount = Math.min(30, affordableEvals);

  const binomialData = useMemo(() => {
    return getBinomialDistribution(budgetEvalCount, passRate);
  }, [budgetEvalCount, passRate]);

  const handleCopyAnalysis = async () => {
    const text = `Binomial Pass Odds: Bankroll: $${bankroll.toLocaleString("en-US")} | Eval Cost: $${evalCost} | Affordable Evals: ${affordableEvals} | Pass ≥1 Eval: ${binomialData.atLeastOne.toFixed(2)}% | Risk of Ruin (0 passes): ${binomialData.riskOfRuin.toFixed(2)}% | Base Pass Rate: ${passRate}%`;

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
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Eval Budget & Pass Odds
            </CardTitle>
            {evalCost > 0 && (
              <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
                ${evalCost} eval cost
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Calculate evaluation capacity from bankroll and the cumulative binomial probability of
            qualification.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: PASS RATE (%) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pass rate (%)
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

          {/* 2º: BANKROLL ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bankroll ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={bankroll || ""}
              placeholder="500"
              onFocus={() => setIsBankrollFocused(true)}
              onBlur={() => setIsBankrollFocused(false)}
              onChange={(e) => onChange({ bankroll: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 3º: COST PER EVAL ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cost per eval ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={evalCost || ""}
              placeholder="89"
              onFocus={() => setIsCostFocused(true)}
              onBlur={() => setIsCostFocused(false)}
              onChange={(e) => onChange({ evalCost: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 4º: AFFORDABLE EVALS */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Affordable evals
            </label>
            <div className="flex h-9 w-36 items-center justify-center rounded-md border border-border/70 bg-muted/40 font-mono text-xs font-semibold text-foreground">
              {affordableEvals} {affordableEvals === 1 ? "eval" : "evals"}
            </div>
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5">
          {/* HEADER ROW */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Binomial pass model
              </span>
              <span className="h-4 inline-flex items-center rounded border border-border/60 bg-background/60 px-1 font-mono text-[9px] text-muted-foreground">
                Cumulative Odds
              </span>
            </div>
            <HoverHint content="Copy binomial analysis to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                onClick={handleCopyAnalysis}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy odds"}
              </Button>
            </HoverHint>
          </div>

          {/* MAIN ROW: THE THREE-STEP PROGRESSION (THEORY -> LIVE COMPLEX DATA -> DIRECT RESULT) */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-1">
            {/* STEP 1 (LEFT): CONCEPTUAL / THEORETICAL FORMULA */}
            <div className="inline-flex flex-col items-center text-center shrink-0">
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pb-0.5 tracking-wide whitespace-nowrap">
                1 − (1 − Pass%)ⁿ
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                n = Bankroll ÷ Cost
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA IN FORMULA (RAW INPUTS, NOT RESUMIDO) */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="flex items-center text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span className="text-muted-foreground">1 − (1 − </span>
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
                <span className="text-muted-foreground">)</span>
                <sup
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum text-[10px]",
                    isBankrollFocused || isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-foreground",
                  )}
                >
                  {budgetEvalCount}
                </sup>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span className="text-muted-foreground">{budgetEvalCount} = </span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum",
                    isBankrollFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  ${bankroll.toLocaleString("en-US")}
                </span>
                <span className="text-muted-foreground/60 px-0.5">÷</span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum",
                    isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40 font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  ${evalCost}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 3 (RIGHT): FINAL ACTIONABLE RESULT (DIRECT ANSWER) */}
            <div className="flex flex-col justify-center text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                    binomialData.atLeastOne >= 50 ? "text-profit" : "text-loss",
                  )}
                >
                  {binomialData.atLeastOne.toFixed(1)}%
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">pass ≥ 1</span>
              </div>
              <div className="flex items-baseline justify-end gap-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
                <span className="font-semibold text-loss tnum">
                  {binomialData.riskOfRuin.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">risk of ruin</span>
              </div>
            </div>
          </div>

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Bankroll</span>
              <span className="font-mono font-semibold text-foreground">
                <MonetaryValue>${bankroll.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Eval attempts</span>
              <span className="font-mono font-semibold text-foreground">
                {affordableEvals} {affordableEvals === 1 ? "eval" : "evals"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">
                Risk of ruin (0 passes)
              </span>
              <span className="font-mono font-semibold text-loss tnum">
                {binomialData.riskOfRuin.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* PASS DISTRIBUTION WITH CUMULATIVE / EXACT TOGGLE */}
          <div className="mt-3 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-wider">Pass distribution</span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  ({budgetEvalCount} attempts)
                </span>
              </div>
              <div className="flex items-center rounded border border-border/70 bg-muted/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setDistributionMode("cumulative")}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
                    distributionMode === "cumulative"
                      ? "bg-accent font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  At least (≥)
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionMode("exact")}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
                    distributionMode === "exact"
                      ? "bg-accent font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Exact (=)
                </button>
              </div>
            </div>

            <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto pr-1 text-xs font-mono tnum">
              {binomialData.rows
                .filter((row) =>
                  distributionMode === "cumulative"
                    ? row.cumulativeProbability > 0 || row.passes === 0
                    : row.probability > 0 || row.passes === 0,
                )
                .map((row) => {
                  const isRuin = row.passes === 0;
                  const probValue =
                    distributionMode === "cumulative"
                      ? isRuin
                        ? binomialData.riskOfRuin
                        : row.cumulativeProbability
                      : row.probability;

                  const label =
                    distributionMode === "cumulative"
                      ? isRuin
                        ? "0 passes (risk of ruin)"
                        : row.passes === budgetEvalCount
                          ? `Pass all ${budgetEvalCount} evals`
                          : `Pass ≥ ${row.passes} ${row.passes === 1 ? "eval" : "evals"}`
                      : isRuin
                        ? "0 passes (risk of ruin)"
                        : `Exactly ${row.passes} ${row.passes === 1 ? "pass" : "passes"}`;

                  const barPercent = Math.min(100, Math.max(0, probValue));

                  return (
                    <div
                      key={row.passes}
                      className="group relative flex items-center justify-between rounded px-2 py-1 overflow-hidden transition-colors hover:bg-muted/40"
                    >
                      {/* Translucent Data Bar */}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none rounded",
                          isRuin ? "bg-loss/12" : "bg-profit/12",
                        )}
                        style={{ width: `${barPercent}%` }}
                      />

                      <div className="relative z-10 flex items-center gap-1.5 truncate">
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0",
                            isRuin ? "bg-loss/70" : "bg-profit",
                          )}
                        />
                        <span
                          className={cn(
                            "truncate text-xs",
                            isRuin ? "text-muted-foreground" : "text-foreground font-medium",
                          )}
                        >
                          {label}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "relative z-10 shrink-0 font-semibold ml-2 font-mono",
                          isRuin ? "text-loss" : "text-profit",
                        )}
                      >
                        {probValue.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
