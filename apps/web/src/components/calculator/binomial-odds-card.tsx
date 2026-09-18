"use client";

import { useMemo } from "react";
import { getBinomialDistribution, PROP_FIRM_PRESETS } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface BinomialOddsCardProps {
  values: CalculatorState["budget"];
  onChange: (patch: Partial<CalculatorState["budget"]>) => void;
}

export function BinomialOddsCard({ values, onChange }: BinomialOddsCardProps) {
  const { firm, passRate, bankroll } = values;

  const currentPreset = useMemo(() => {
    return PROP_FIRM_PRESETS.find((p) => p.name === firm) ?? PROP_FIRM_PRESETS[0]!;
  }, [firm]);

  const budgetEvalCount = Math.max(1, Math.floor(bankroll / (currentPreset.cost || 1)));

  const binomialData = useMemo(() => {
    return getBinomialDistribution(budgetEvalCount, passRate);
  }, [budgetEvalCount, passRate]);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            Eval Budget & Pass Odds
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Budget + odds. How many evals you can afford, and your chance of passing 1, 2, 3... in a
            row (same pass rate each time).
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prop firm challenge
            </label>
            <div className="w-56">
              <OptionSelect
                value={firm}
                onValueChange={(val) => {
                  const preset = PROP_FIRM_PRESETS.find((p) => p.name === val);
                  onChange({
                    firm: val,
                    passRate: preset?.defaultPassRate ?? passRate,
                  });
                }}
                className="h-9 text-xs"
              >
                {PROP_FIRM_PRESETS.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.defaultPassRate}% pass)
                  </option>
                ))}
              </OptionSelect>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your pass rate (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-right font-mono tnum"
              value={passRate}
              onChange={(e) => onChange({ passRate: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bankroll ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-right font-mono tnum"
              value={bankroll}
              onChange={(e) => onChange({ bankroll: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Show evals up to
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-right font-mono tnum bg-muted/40 cursor-not-allowed opacity-75"
              value={budgetEvalCount}
              disabled
            />
          </div>
        </CardContent>
      </div>

      <CardContent className="border-t border-border/70 pt-4 space-y-2.5">
        <div className="text-xs text-muted-foreground">
          With <MonetaryValue>${bankroll.toLocaleString("en-US")}</MonetaryValue> you can afford ~
          {budgetEvalCount} evals at this firm.
        </div>
        <div className="text-sm font-semibold text-brand">
          Chance you pass at least one of those: {binomialData.atLeastOne}%
        </div>
        <div className="text-[11px] text-muted-foreground">
          Chance of 0 (fail all) is the same as risk of ruin for evals.
        </div>

        <div className="pt-2 text-xs font-semibold text-foreground">
          In {budgetEvalCount} attempts: chance you pass exactly 0, 1, ... {budgetEvalCount}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Binomial: each row is P(exactly that many passes in {budgetEvalCount} tries). Adds to
          100%.
        </div>

        <div className="mt-2 space-y-1.5 text-xs font-mono tnum max-h-60 overflow-y-auto pr-1">
          {binomialData.rows.map((row) => (
            <div
              key={row.passes}
              className="relative flex items-center justify-between overflow-hidden rounded px-1.5 py-0.5 border border-border/20"
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 -z-10 opacity-15",
                  row.passes === 0 ? "bg-loss" : "bg-profit",
                )}
                style={{ width: `${Math.min(100, Math.max(2, row.probability))}%` }}
              />
              <span
                className={cn(
                  "font-sans",
                  row.passes === 0 ? "text-loss font-medium" : "text-foreground",
                )}
              >
                {row.passes === 0 ? "Exactly 0 (fail all)" : `Exactly ${row.passes}`}
              </span>
              <span className={cn("font-semibold", row.passes === 0 ? "text-loss" : "text-profit")}>
                {row.probability.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
