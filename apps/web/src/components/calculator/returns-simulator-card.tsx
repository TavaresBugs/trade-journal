"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  runReturnsSimulation,
  PROP_FIRM_PRESETS,
  type SimulationOutcome,
} from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
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

  const [simResults, setSimResults] = useState<{
    avgPayout: number;
    avgNetProfit: number;
    outcomes: SimulationOutcome[];
  }>({
    avgPayout: 713,
    avgNetProfit: 213,
    outcomes: [
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: true,
        fundedPassed: true,
        payoutAmount: 2000,
        netPnl: 1911,
        description: "Eval passed, funded passed, payout $2,000",
      },
      {
        passed: true,
        fundedPassed: true,
        payoutAmount: 2000,
        netPnl: 1911,
        description: "Eval passed, funded passed, payout $2,000",
      },
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
    ],
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

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            Returns Simulator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Simulate 1,000 eval attempts: pass rate, then payout chance and average payout if
            funded. See average return and sample outcomes.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Bankroll / amount ($)
              </label>
              <div className="hidden sm:flex items-center gap-1">
                {[500, 1000, 2000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onChange({ bankroll: b })}
                    className="rounded border border-border/70 px-1 py-0.2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    ${b >= 1000 ? `${b / 1000}k` : b}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={bankroll}
              onChange={(e) => onChange({ bankroll: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Firm (eval cost)
            </label>
            <div className="w-56">
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
                className="h-9 text-xs"
              >
                {PROP_FIRM_PRESETS.map((p) => (
                  <option key={p.id} value={String(p.cost)}>
                    {p.name} (${p.cost})
                  </option>
                ))}
              </OptionSelect>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pass rate (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={passRate}
              onChange={(e) => onChange({ passRate: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payout chance (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={payoutChance}
              onChange={(e) => onChange({ payoutChance: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Average payout ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={avgPayout}
              onChange={(e) => onChange({ avgPayout: Number(e.target.value) })}
            />
          </div>

          <div className="pt-2">
            <Button
              type="button"
              disabled={isSimulating}
              className="h-9 w-full bg-brand font-medium text-white shadow-sm hover:opacity-95"
              onClick={handleRunSimulation}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                "Simulate returns"
              )}
            </Button>
          </div>
        </CardContent>
      </div>

      <CardContent className="border-t border-border/70 pt-4">
        <div className="text-sm font-bold text-foreground">
          Average payout{" "}
          <MonetaryValue>${simResults.avgPayout.toLocaleString("en-US")}</MonetaryValue> on your $
          <MonetaryValue>{bankroll.toLocaleString("en-US")}</MonetaryValue> investment.
        </div>
        <div className="text-xs text-muted-foreground">
          Expected average net P&L:{" "}
          <span
            className={cn(
              "font-mono font-semibold",
              simResults.avgNetProfit >= 0 ? "text-profit" : "text-loss",
            )}
          >
            <MonetaryValue>
              {simResults.avgNetProfit >= 0
                ? `+$${simResults.avgNetProfit.toLocaleString("en-US")}`
                : `-$${Math.abs(simResults.avgNetProfit).toLocaleString("en-US")}`}
            </MonetaryValue>
          </span>
        </div>

        <div className="mt-3 text-xs font-medium text-muted-foreground">Last 10 outcomes:</div>
        <div className="mt-2 space-y-1.5 text-xs font-mono tnum">
          {simResults.outcomes.map((out, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border-b border-border/30 pb-1"
            >
              <span
                className={
                  out.fundedPassed ? "text-foreground font-sans" : "text-muted-foreground font-sans"
                }
              >
                {out.description}
              </span>
              <span className={cn("font-semibold", out.netPnl >= 0 ? "text-profit" : "text-loss")}>
                <MonetaryValue>
                  {out.netPnl >= 0
                    ? `+$${out.netPnl.toLocaleString("en-US")}`
                    : `-$${Math.abs(out.netPnl).toLocaleString("en-US")}`}
                </MonetaryValue>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
