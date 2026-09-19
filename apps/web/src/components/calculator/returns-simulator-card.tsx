"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Play } from "lucide-react";
import { runReturnsSimulation, type SimulationOutcome } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface ReturnsSimulatorCardProps {
  values: CalculatorState["simulator"];
  onChange: (patch: Partial<CalculatorState["simulator"]>) => void;
}

export function ReturnsSimulatorCard({ values, onChange }: ReturnsSimulatorCardProps) {
  const { bankroll, evalCost, passRate, payoutChance, avgPayout } = values;
  const [isSimulating, setIsSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBankrollFocused, setIsBankrollFocused] = useState(false);
  const [isCostFocused, setIsCostFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [isPayoutChanceFocused, setIsPayoutChanceFocused] = useState(false);
  const [isAvgPayoutFocused, setIsAvgPayoutFocused] = useState(false);

  const [simResults, setSimResults] = useState<{
    avgPayout: number;
    avgNetProfit: number;
    sampleOutcomes: SimulationOutcome[];
  }>(() => {
    const initial = runReturnsSimulation(
      bankroll,
      evalCost,
      passRate,
      payoutChance,
      avgPayout,
      1000,
    );
    return {
      avgPayout: initial.avgPayoutResult,
      avgNetProfit: initial.avgNetProfit,
      sampleOutcomes: initial.sampleOutcomes,
    };
  });

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const results = runReturnsSimulation(
        bankroll,
        evalCost,
        passRate,
        payoutChance,
        avgPayout,
        1000,
      );
      setSimResults({
        avgPayout: results.avgPayoutResult,
        avgNetProfit: results.avgNetProfit,
        sampleOutcomes: results.sampleOutcomes,
      });
      setIsSimulating(false);
    }, 150);
  };

  const handleCopySimulation = async () => {
    const roi = bankroll > 0 ? Math.round((simResults.avgNetProfit / bankroll) * 100) : 0;
    const roiFormatted = roi >= 0 ? `+${roi}%` : `${roi}%`;
    const netFormatted =
      simResults.avgNetProfit >= 0
        ? `+$${simResults.avgNetProfit.toLocaleString("en-US")}`
        : `-$${Math.abs(simResults.avgNetProfit).toLocaleString("en-US")}`;
    const text = `Simulation (1,000 runs): Bankroll: $${bankroll.toLocaleString("en-US")} | Net Profit: ${netFormatted} (${roiFormatted} ROI) | Avg Payout: $${simResults.avgPayout.toLocaleString("en-US")} | Eval Cost: $${evalCost} | Pass: ${passRate}% | Payout Chance: ${payoutChance}%`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const numAttempts = Math.max(1, Math.floor(bankroll / (evalCost || 1)));

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Returns Simulator
            </CardTitle>
            {evalCost > 0 && (
              <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
                ${evalCost} eval cost
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Simulate 1,000 evaluation cycles based on your bankroll, qualification, and payout
            expectations.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: BANKROLL ($) */}
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

          {/* 2º: COST PER EVAL ($) */}
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

          {/* 3º: PASS RATE (%) */}
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

          {/* 4º: PAYOUT CHANCE (%) */}
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

          {/* 5º: AVERAGE PAYOUT ($) */}
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

          {/* SIMULATE BUTTON */}
          <div className="pt-1">
            <Button
              type="button"
              disabled={isSimulating}
              variant="outline"
              className="h-9 w-full border-border/80 bg-muted/40 font-mono text-xs font-medium tracking-tight text-foreground transition-all hover:bg-accent hover:text-foreground"
              onClick={handleRunSimulation}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Simulating 1,000 attempts...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-profit" />
                  Run Monte Carlo simulation (1,000 runs)
                </>
              )}
            </Button>
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
                Simulation results (1,000 runs)
              </span>
              <span className="h-4 inline-flex items-center rounded border border-border/60 bg-background/60 px-1 font-mono text-[9px] text-muted-foreground">
                Monte Carlo
              </span>
            </div>
            <HoverHint content="Copy simulation results to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                onClick={handleCopySimulation}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy simulation"}
              </Button>
            </HoverHint>
          </div>

          {/* MAIN ROW: THE THREE-STEP PROGRESSION (THEORY -> LIVE COMPLEX DATA -> DIRECT RESULT) */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-1">
            {/* STEP 1 (LEFT): CONCEPTUAL / THEORETICAL FORMULA */}
            <div className="inline-flex flex-col items-center text-center shrink-0">
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pb-0.5 tracking-wide whitespace-nowrap">
                n × Pass% × Payout% × Avg
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                − n × Eval Cost ($)
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA IN FORMULA (RAW INPUTS, NOT RESUMIDO) */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="flex items-center text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                    isBankrollFocused || isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "text-foreground",
                  )}
                >
                  {numAttempts}
                </span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span className="text-muted-foreground/70">(</span>
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
                <span className="text-muted-foreground/70">)</span>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span className="text-muted-foreground/70">− </span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                    isBankrollFocused || isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "text-muted-foreground",
                  )}
                >
                  {numAttempts}
                </span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                    isCostFocused
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
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
                    simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  <MonetaryValue>
                    {simResults.avgNetProfit >= 0
                      ? `+$${simResults.avgNetProfit.toLocaleString("en-US")}`
                      : `-$${Math.abs(simResults.avgNetProfit).toLocaleString("en-US")}`}
                  </MonetaryValue>
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">avg net</span>
              </div>
              {bankroll > 0 && (
                <div className="flex items-baseline justify-end gap-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
                  <span
                    className={cn(
                      "font-semibold tnum",
                      simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {simResults.avgNetProfit >= 0 ? "+" : ""}
                    {((simResults.avgNetProfit / bankroll) * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">ROI</span>
                </div>
              )}
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
                {numAttempts} {numAttempts === 1 ? "eval" : "evals"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Average payout</span>
              <span className="font-mono font-semibold text-profit">
                <MonetaryValue>+${simResults.avgPayout.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
          </div>

          {/* RECENT SAMPLE RUN OUTCOMES */}
          <div className="mt-3 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">Sample cycle outcomes</span>
              <span className="font-mono">{simResults.sampleOutcomes.length} attempts</span>
            </div>
            <div className="mt-2 max-h-[180px] space-y-1.5 overflow-y-auto pr-1 text-xs font-mono tnum">
              {simResults.sampleOutcomes.map((out, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-border/25 pb-1 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        out.fundedPassed ? "bg-profit" : out.passed ? "bg-amber-400" : "bg-loss/70",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-xs",
                        out.fundedPassed ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      {out.description}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-semibold ml-2 font-mono",
                      out.netPnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    <MonetaryValue>
                      {out.netPnl >= 0
                        ? `+$${out.netPnl.toLocaleString("en-US")}`
                        : `-$${Math.abs(out.netPnl).toLocaleString("en-US")}`}
                    </MonetaryValue>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
