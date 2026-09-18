"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Play } from "lucide-react";
import {
  runReturnsSimulation,
  PROP_FIRM_PRESETS,
  type SimulationOutcome,
} from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
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

  const [simResults, setSimResults] = useState<{
    avgPayout: number;
    avgNetProfit: number;
    outcomes: SimulationOutcome[];
  }>(() => {
    const res = runReturnsSimulation(bankroll, evalCost, passRate, payoutChance, avgPayout);
    return {
      avgPayout: res.avgPayoutResult,
      avgNetProfit: res.avgNetProfit,
      outcomes: res.sampleOutcomes,
    };
  });

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const res = runReturnsSimulation(bankroll, evalCost, passRate, payoutChance, avgPayout);
      setSimResults({
        avgPayout: res.avgPayoutResult,
        avgNetProfit: res.avgNetProfit,
        outcomes: res.sampleOutcomes,
      });
      setIsSimulating(false);
    }, 120);
  };

  const handleCopySimulation = async () => {
    const roiFormatted =
      bankroll > 0 ? `${((simResults.avgNetProfit / bankroll) * 100).toFixed(1)}%` : "0%";
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

  const currentPreset = PROP_FIRM_PRESETS.find((p) => p.cost === evalCost);
  const numAttempts = Math.max(1, Math.floor(bankroll / (evalCost || 1)));

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Returns Simulator
            </CardTitle>
            <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
              Monte Carlo · 1,000 Runs
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Simulate 1,000 evaluation cycles based on your bankroll, qualification, and payout
            expectations.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: BANKROLL / AMOUNT */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bankroll ($)
              </label>
              <div className="flex items-center gap-1">
                {[500, 1000, 2000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onChange({ bankroll: b })}
                    className={cn(
                      "h-5 inline-flex items-center justify-center rounded border px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none transition-colors",
                      bankroll === b
                        ? "border-border bg-accent text-foreground font-semibold"
                        : "border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    ${b >= 1000 ? `${b / 1000}k` : b}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={bankroll || ""}
              placeholder="500"
              onChange={(e) => onChange({ bankroll: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 2º: FIRM PRESET */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Firm preset
              </label>
              <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
                ${evalCost}/eval
              </span>
            </div>
            <div className="w-36">
              <OptionSelect
                value={String(evalCost)}
                onValueChange={(val) => {
                  const cost = Number(val);
                  const preset = PROP_FIRM_PRESETS.find((p) => p.cost === cost);
                  onChange({
                    evalCost: cost,
                    passRate: preset?.defaultPassRate ?? passRate,
                  });
                }}
                className="relative h-9 justify-center text-xs font-mono font-semibold [&>span]:text-center [&>svg]:absolute [&>svg]:right-2.5"
              >
                {!currentPreset && <option value={String(evalCost)}>Custom (${evalCost})</option>}
                {PROP_FIRM_PRESETS.map((p) => (
                  <option key={p.id} value={String(p.cost)}>
                    {p.name}
                  </option>
                ))}
              </OptionSelect>
            </div>
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
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Simulation results (1,000 runs)
            </span>
            <HoverHint content="Copy simulation results to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
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

          {/* SIMULATION HERO HIGHLIGHT */}
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight font-mono tnum",
                simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
              )}
            >
              <MonetaryValue>
                {simResults.avgNetProfit >= 0
                  ? `+$${simResults.avgNetProfit.toLocaleString("en-US")}`
                  : `-$${Math.abs(simResults.avgNetProfit).toLocaleString("en-US")}`}
              </MonetaryValue>
            </span>
            <span className="text-sm font-medium text-muted-foreground">avg net P&L</span>
            {bankroll > 0 && (
              <span
                className={cn(
                  "ml-auto text-xs font-mono font-medium",
                  simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {simResults.avgNetProfit >= 0 ? "+" : ""}
                {((simResults.avgNetProfit / bankroll) * 100).toFixed(1)}% ROI
              </span>
            )}
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
              <span className="font-mono">{simResults.outcomes.length} attempts</span>
            </div>
            <div className="mt-2 space-y-1.5 text-xs font-mono tnum">
              {simResults.outcomes.map((out, idx) => (
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
