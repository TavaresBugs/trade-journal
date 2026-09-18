"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { calculateExpectedValue } from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface EvCalculatorCardProps {
  values: CalculatorState["ev"];
  onChange: (patch: Partial<CalculatorState["ev"]>) => void;
}

export function EvCalculatorCard({ values, onChange }: EvCalculatorCardProps) {
  const { avgPayout, payoutChance, cost, passRate } = values;
  const [copied, setCopied] = useState(false);

  const evResult = useMemo(() => {
    return calculateExpectedValue(cost, passRate, payoutChance, avgPayout);
  }, [cost, passRate, payoutChance, avgPayout]);

  const expectedPayoutPerPass = useMemo(() => {
    return (payoutChance / 100) * avgPayout;
  }, [payoutChance, avgPayout]);

  const breakevenPassRate = useMemo(() => {
    if (expectedPayoutPerPass <= 0) return 0;
    return Number(((cost / expectedPayoutPerPass) * 100).toFixed(1));
  }, [cost, expectedPayoutPerPass]);

  const roiPercent = useMemo(() => {
    if (cost <= 0) return 0;
    return Math.round((evResult / cost) * 100);
  }, [evResult, cost]);

  const edgeBuffer = useMemo(() => {
    if (breakevenPassRate <= 0) return 0;
    return Number((passRate - breakevenPassRate).toFixed(1));
  }, [passRate, breakevenPassRate]);

  const handleCopyEv = async () => {
    const evFormatted =
      evResult >= 0 ? `+$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`;
    const roiFormatted = roiPercent >= 0 ? `+${roiPercent}%` : `${roiPercent}%`;
    const text = `EV: ${evFormatted}/eval (${roiFormatted} ROI) | Payout: $${avgPayout.toLocaleString("en-US")} (${payoutChance}%) | Cost: $${cost} | Pass: ${passRate}% (Breakeven: ${breakevenPassRate}%)`;

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
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            EV Calculator
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Expected value per eval: (pass rate × payout chance × avg payout) - eval cost.
          </p>
        </CardHeader>
        <CardContent className="space-y-3.5">
          {/* 1º: EVAL PASS RATE (%) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval pass rate (%)
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

          {/* 2º: PAYOUT CHANCE (%) */}
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

          {/* 3º: AVERAGE PAYOUT ($) */}
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

          {/* 4º: EVAL COST ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eval cost ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={cost || ""}
              placeholder="89"
              onChange={(e) => onChange({ cost: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Expected value outcome
            </span>
            <HoverHint content="Copy EV breakdown to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleCopyEv}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy analysis"}
              </Button>
            </HoverHint>
          </div>

          {/* EV HERO HIGHLIGHT */}
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tracking-tight font-mono tnum",
                evResult >= 0 ? "text-profit" : "text-loss",
              )}
            >
              <MonetaryValue>
                {evResult >= 0 ? `+$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`}
              </MonetaryValue>
            </span>
            <span className="text-sm font-medium text-muted-foreground">per eval</span>
            {cost > 0 && (
              <span
                className={cn(
                  "ml-auto text-xs font-mono font-medium",
                  roiPercent >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {roiPercent >= 0 ? `+${roiPercent}% ROI` : `${roiPercent}% ROI`}
              </span>
            )}
          </div>

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Breakeven pass</span>
              <span className="font-mono font-semibold text-foreground">
                {breakevenPassRate > 0 && breakevenPassRate <= 100
                  ? `${breakevenPassRate}%`
                  : "N/A"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Edge buffer</span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  edgeBuffer >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {edgeBuffer >= 0 ? `+${edgeBuffer.toFixed(1)}%` : `${edgeBuffer.toFixed(1)}%`}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Expected payout</span>
              <span className="font-mono font-semibold text-profit">
                <MonetaryValue>
                  +${Math.round(expectedPayoutPerPass).toLocaleString("en-US")}
                </MonetaryValue>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
