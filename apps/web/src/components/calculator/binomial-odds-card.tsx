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
          {/* 1º: BANKROLL ($) */}
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
              onChange={(e) => onChange({ passRate: Number(e.target.value) })}
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
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Binomial pass model
            </span>
            <HoverHint content="Copy binomial analysis to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
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

          {/* HERO METRIC */}
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight font-mono tnum",
                binomialData.atLeastOne >= 50 ? "text-profit" : "text-loss",
              )}
            >
              {binomialData.atLeastOne.toFixed(2)}%
            </span>
            <HoverHint content={`Cumulative probability of passing 1 or more funded accounts across your ${budgetEvalCount} attempts`}>
              <span className="cursor-help text-sm font-medium text-muted-foreground underline decoration-muted-foreground/30 underline-offset-2">
                chance to pass at least 1 eval
              </span>
            </HoverHint>
            <span
              className={cn(
                "ml-auto text-xs font-mono font-medium",
                binomialData.riskOfRuin > 15 ? "text-loss" : "text-muted-foreground",
              )}
            >
              Risk of ruin: {binomialData.riskOfRuin.toFixed(2)}%
            </span>
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
              <span
                className={cn(
                  "font-mono font-semibold",
                  binomialData.riskOfRuin > 15 ? "text-loss" : "text-muted-foreground",
                )}
              >
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
                            isRuin
                              ? "text-muted-foreground"
                              : "text-foreground font-medium",
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
