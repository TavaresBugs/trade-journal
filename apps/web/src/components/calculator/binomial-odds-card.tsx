"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getBinomialDistribution, PROP_FIRM_PRESETS } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface BinomialOddsCardProps {
  values: CalculatorState["budget"];
  onChange: (patch: Partial<CalculatorState["budget"]>) => void;
}

export function BinomialOddsCard({ values, onChange }: BinomialOddsCardProps) {
  const { firm, passRate, bankroll } = values;
  const [copied, setCopied] = useState(false);

  const currentPreset = useMemo(() => {
    return PROP_FIRM_PRESETS.find((p) => p.name === firm) ?? PROP_FIRM_PRESETS[0]!;
  }, [firm]);

  // Cap at 30 attempts for binomial numerical stability and responsive rendering
  const affordableEvals = Math.max(1, Math.floor(bankroll / (currentPreset.cost || 1)));
  const budgetEvalCount = Math.min(30, affordableEvals);

  const binomialData = useMemo(() => {
    return getBinomialDistribution(budgetEvalCount, passRate);
  }, [budgetEvalCount, passRate]);

  const handleCopyAnalysis = async () => {
    const text = `Binomial Pass Odds (${currentPreset.name}): Bankroll: $${bankroll.toLocaleString("en-US")} | Affordable Evals: ${affordableEvals} | Pass ≥1 Eval: ${binomialData.atLeastOne.toFixed(2)}% | Risk of Ruin (0 passes): ${binomialData.riskOfRuin.toFixed(2)}% | Base Pass Rate: ${passRate}%`;

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
            <span className="rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              Binomial Model
            </span>
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
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
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
              <span className="rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                ${currentPreset.cost}/eval
              </span>
            </div>
            <div className="w-36">
              <OptionSelect
                value={firm}
                onValueChange={(val) => {
                  const preset = PROP_FIRM_PRESETS.find((p) => p.name === val);
                  onChange({
                    firm: val,
                    passRate: preset?.defaultPassRate ?? passRate,
                  });
                }}
                className="relative h-9 justify-center text-xs font-mono font-semibold [&>span]:text-center [&>svg]:absolute [&>svg]:right-2.5"
              >
                {PROP_FIRM_PRESETS.map((p) => (
                  <option key={p.id} value={p.name}>
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
            <span className="text-sm font-medium text-muted-foreground">
              chance to pass ≥1 eval
            </span>
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

          {/* EXACT PASS DISTRIBUTION */}
          <div className="mt-3 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wider">Exact pass distribution</span>
              <span className="font-mono">{budgetEvalCount} attempts</span>
            </div>
            <div className="mt-2 space-y-1.5 text-xs font-mono tnum">
              {binomialData.rows.map((row) => (
                <div
                  key={row.passes}
                  className="flex items-center justify-between border-b border-border/25 pb-1 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        row.passes === 0 ? "bg-loss/70" : "bg-profit",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-xs",
                        row.passes === 0 ? "text-muted-foreground" : "text-foreground font-medium",
                      )}
                    >
                      {row.passes === 0
                        ? "0 passes (risk of ruin)"
                        : `Exactly ${row.passes} ${row.passes === 1 ? "pass" : "passes"}`}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-semibold ml-2 font-mono",
                      row.passes === 0 ? "text-loss" : "text-profit",
                    )}
                  >
                    {row.probability.toFixed(2)}%
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
