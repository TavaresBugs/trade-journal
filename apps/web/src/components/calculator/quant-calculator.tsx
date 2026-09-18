"use client";

import { useCalculatorState } from "@/lib/use-calculator-state";
import { EvCalculatorCard } from "./ev-calculator-card";
import { PointsSizingCard } from "./points-sizing-card";
import { ReturnsSimulatorCard } from "./returns-simulator-card";
import { BinomialOddsCard } from "./binomial-odds-card";

export function QuantCalculator() {
  const { state, updateState } = useCalculatorState();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Calculators</h2>
        <p className="text-xs text-muted-foreground">
          EV, NQ points to dollars, risk of ruin, and bankroll sizing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PointsSizingCard
          values={state.sizing}
          onChange={(patch) => updateState("sizing", patch)}
        />
        <EvCalculatorCard values={state.ev} onChange={(patch) => updateState("ev", patch)} />
        <BinomialOddsCard
          values={state.budget}
          onChange={(patch) => updateState("budget", patch)}
        />
        <ReturnsSimulatorCard
          values={state.simulator}
          onChange={(patch) => updateState("simulator", patch)}
        />
      </div>
    </div>
  );
}
