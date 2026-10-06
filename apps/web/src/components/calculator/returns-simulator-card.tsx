"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { runReturnsSimulation, type SimulationOutcome } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";
import { FormulaHud } from "./shared";
import { DitherGauge, DitherRatioBar } from "@/components/dither-kit";

interface ReturnsSimulatorCardProps {
  values: CalculatorState["simulator"];
  onChange: (patch: Partial<CalculatorState["simulator"]>) => void;
}

export function ReturnsSimulatorCard({ values, onChange }: ReturnsSimulatorCardProps) {
  const { bankroll, evalCost, passRate, payoutChance, avgPayout } = values;
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBankrollFocused, setIsBankrollFocused] = useState(false);
  const [isCostFocused, setIsCostFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [isPayoutChanceFocused, setIsPayoutChanceFocused] = useState(false);
  const [isAvgPayoutFocused, setIsAvgPayoutFocused] = useState(false);

  const [simResults, setSimResults] = useState<{
    avgPayout: number;
    avgNetProfit: number;
    profitableCyclesCount: number;
    profitableChancePercent: number;
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
      profitableCyclesCount: initial.profitableCyclesCount,
      profitableChancePercent: initial.profitableChancePercent,
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
        profitableCyclesCount: results.profitableCyclesCount,
        profitableChancePercent: results.profitableChancePercent,
        sampleOutcomes: results.sampleOutcomes,
      });
      setIsSimulating(false);
    }, 150);
  };

  const numAttempts = Math.max(1, Math.floor(bankroll / (evalCost || 1)));

  const roi = bankroll > 0 ? Math.round((simResults.avgNetProfit / bankroll) * 100) : 0;
  const roiFormatted = roi >= 0 ? `+${roi}%` : `${roi}%`;
  const netFormatted =
    simResults.avgNetProfit >= 0
      ? `+$${simResults.avgNetProfit.toLocaleString("en-US")}`
      : `-$${Math.abs(simResults.avgNetProfit).toLocaleString("en-US")}`;
  const copyText = `Simulation (1,000 runs): Bankroll: $${bankroll.toLocaleString("en-US")} | Net Profit: ${netFormatted} (${roiFormatted} ROI) | Avg Payout: $${simResults.avgPayout.toLocaleString("en-US")} | Eval Cost: $${evalCost} | Pass: ${passRate}% | Payout Chance: ${payoutChance}%`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
          Returns Simulator
        </CardTitle>
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
      </CardContent>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <FormulaHud
          title="Simulation results (1,000 runs)"
          copyText={copyText}
          actions={
            <HoverHint
              heading="Monte Carlo Simulation"
              content="Simulates 1,000 randomized cycles of evaluation attempts, qualification odds, and payout distributions to project expected net equity."
              side="top"
            >
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                onClick={handleRunSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-profit" />
                )}
                <span>{isSimulating ? "Simulating..." : "Run Monte Carlo"}</span>
              </Button>
            </HoverHint>
          }
          theoryNumerator="n × Pass% × Payout% × Avg"
          theoryDenominator="− n × Eval Cost ($)"
          valueNumerator={
            <>
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
              <span className="text-muted-foreground/70">)</span>
            </>
          }
          valueDenominator={
            <>
              <span className="text-muted-foreground/70">− </span>
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
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold",
                  isCostFocused
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "text-foreground",
                )}
              >
                ${evalCost}
              </span>
            </>
          }
          resultValue={
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
          }
          resultLabel="avg net"
          resultSecondary={
            bankroll > 0 ? (
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
            ) : undefined
          }
        >
          {/* DITHER COCKPIT CYCLE PROFITABILITY */}
          {(() => {
            const gaugeValue = Math.min(1, Math.max(0, simResults.profitableChancePercent / 100));
            const gaugeColor: "green" | "orange" | "red" =
              simResults.profitableChancePercent >= 60
                ? "green"
                : simResults.profitableChancePercent >= 40
                  ? "orange"
                  : "red";

            return (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/30 pt-3">
                <div className="flex items-center gap-3">
                  <DitherGauge
                    size={80}
                    value={gaugeValue}
                    color={gaugeColor}
                    bloom="low"
                    label="Cycle Win Rate"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          simResults.profitableChancePercent >= 60
                            ? "bg-profit"
                            : simResults.profitableChancePercent >= 40
                              ? "bg-amber-500"
                              : "bg-loss",
                        )}
                      />
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold uppercase tracking-wider",
                          simResults.profitableChancePercent >= 60
                            ? "text-profit"
                            : simResults.profitableChancePercent >= 40
                              ? "text-amber-500"
                              : "text-loss",
                        )}
                      >
                        {simResults.profitableChancePercent >= 60
                          ? "Positive Cycle Edge"
                          : simResults.profitableChancePercent >= 40
                            ? "Breakeven Drift"
                            : "Negative Decay"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Across 1,000 trials with {numAttempts} attempts,{" "}
                      {simResults.profitableChancePercent}% yielded net positive capital payout.
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cycle Edge
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold tnum",
                      simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {roiFormatted} ROI
                  </span>
                </div>
              </div>
            );
          })()}

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Bankroll</span>
              <span className="font-mono font-semibold text-foreground">
                <MonetaryValue>${bankroll.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Attempts simulated</span>
              <span className="font-mono font-semibold text-foreground tnum">
                {numAttempts} {numAttempts === 1 ? "eval" : "evals"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Profitable cycles</span>
              <span
                className={cn(
                  "font-mono font-semibold tnum",
                  simResults.profitableChancePercent >= 50 ? "text-profit" : "text-loss",
                )}
              >
                {simResults.profitableChancePercent}% ({simResults.profitableCyclesCount}/1k)
              </span>
            </div>
          </div>

          {/* DITHER RATIO BAR: BANKROLL COST VS NET RETURN */}
          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">Bankroll Cost vs Net Return</span>
              <span className="font-mono text-[10px]">
                {simResults.avgNetProfit > 0
                  ? `+${(simResults.avgNetProfit / (numAttempts * evalCost || 1)).toFixed(1)}x capital multiplier`
                  : "Capital Deficit"}
              </span>
            </div>
            <DitherRatioBar
              order="loss-win"
              winValue={Math.max(0, simResults.avgNetProfit)}
              lossValue={numAttempts * evalCost}
              height={8}
              bloom="low"
              className="rounded-full overflow-hidden"
            />
          </div>

          {/* RECENT SAMPLE RUN OUTCOMES */}
          <div className="mt-3 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">Sample cycle outcomes</span>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                ({simResults.sampleOutcomes.length} attempts)
              </span>
            </div>
            <div className="mt-2 space-y-1.5 pr-1 text-xs font-mono tnum">
              {simResults.sampleOutcomes.map((out, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded px-2 py-1 transition-colors hover:bg-muted/40 border-b border-border/20 last:border-0"
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
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
