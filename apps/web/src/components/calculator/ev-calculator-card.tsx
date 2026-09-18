"use client";

import { useMemo } from "react";
import { calculateExpectedValue } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface EvCalculatorCardProps {
  values: CalculatorState["ev"];
  onChange: (patch: Partial<CalculatorState["ev"]>) => void;
}

export function EvCalculatorCard({ values, onChange }: EvCalculatorCardProps) {
  const { avgPayout, payoutChance, cost, passRate } = values;

  const evResult = useMemo(() => {
    return calculateExpectedValue(cost, passRate, payoutChance, avgPayout);
  }, [cost, passRate, payoutChance, avgPayout]);

  const breakevenPassRate = useMemo(() => {
    const expectedPayoutPerPass = (payoutChance / 100) * avgPayout;
    if (expectedPayoutPerPass <= 0) return 0;
    return Number(((cost / expectedPayoutPerPass) * 100).toFixed(1));
  }, [cost, payoutChance, avgPayout]);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            EV Calculator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Expected value per eval: (pass rate × payout chance × avg payout) - eval cost.
          </p>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Average payout ($)
            </label>
            <Input
              type="number"
              className="w-32 text-right font-mono tnum"
              value={avgPayout}
              onChange={(e) => onChange({ avgPayout: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payout chance (%)
            </label>
            <Input
              type="number"
              className="w-32 text-right font-mono tnum"
              value={payoutChance}
              onChange={(e) => onChange({ payoutChance: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval cost ($)
            </label>
            <Input
              type="number"
              className="w-32 text-right font-mono tnum"
              value={cost}
              onChange={(e) => onChange({ cost: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval pass rate (%)
            </label>
            <Input
              type="number"
              className="w-32 text-right font-mono tnum"
              value={passRate}
              onChange={(e) => onChange({ passRate: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </div>

      <CardContent className="border-t border-border/70 pt-4">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "text-lg font-bold tracking-tight tnum",
              evResult >= 0 ? "text-profit" : "text-loss",
            )}
          >
            EV per eval:{" "}
            <MonetaryValue>
              {evResult >= 0 ? `$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`}
            </MonetaryValue>
          </div>
          {breakevenPassRate > 0 && breakevenPassRate <= 100 && (
            <span className="text-xs text-muted-foreground">
              Breakeven pass rate:{" "}
              <span className="font-mono font-medium text-foreground">{breakevenPassRate}%</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
