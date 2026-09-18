"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Shield, Sparkles, Sliders } from "lucide-react";
import {
  QUANT_INSTRUMENTS,
  EXECUTION_PRESETS,
  calculatePositionSize,
  type QuantInstrument,
  type ExecutionMode,
} from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface PointsSizingCardProps {
  values: CalculatorState["sizing"];
  onChange: (patch: Partial<CalculatorState["sizing"]>) => void;
}

export function PointsSizingCard({ values, onChange }: PointsSizingCardProps) {
  const { mode, instrumentId, stopPoints, riskDollars, targetPoints } = values;
  const [copied, setCopied] = useState(false);

  const instrument: QuantInstrument = useMemo(() => {
    return (
      QUANT_INSTRUMENTS.find((i) => i.id === instrumentId) ?? {
        id: "NQ",
        name: "NQ ($20/pt)",
        multiplier: 20,
        tickSize: 0.25,
      }
    );
  }, [instrumentId]);

  const sizing = useMemo(() => {
    return calculatePositionSize(riskDollars, stopPoints, instrument.multiplier, targetPoints);
  }, [riskDollars, stopPoints, instrument.multiplier, targetPoints]);

  const handleSelectMode = (newMode: ExecutionMode) => {
    if (newMode === "eval") {
      const preset = EXECUTION_PRESETS.eval;
      onChange({
        mode: "eval",
        riskDollars: preset.riskDollars,
        stopPoints: preset.stopPoints,
        targetPoints: preset.targetPoints,
        instrumentId: "NQ",
      });
    } else if (newMode === "funded") {
      const preset = EXECUTION_PRESETS.funded;
      onChange({
        mode: "funded",
        riskDollars: preset.riskDollars,
        stopPoints: preset.stopPoints,
        targetPoints: preset.targetPoints,
        instrumentId: "NQ",
      });
    } else {
      onChange({ mode: "custom" });
    }
  };

  const handleCopySizing = async () => {
    const text = `${instrument.id}: ${sizing.recommendedContracts} contract${
      sizing.recommendedContracts > 1 ? "s" : ""
    } | SL: ${stopPoints} pts (-$${sizing.actualRiskDollars.toLocaleString(
      "en-US",
    )}) | TP: ${targetPoints} pts (+$${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`;
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
                Position & Risk Sizing Engine
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                JJ Simon execution rules: determine exact contracts from chart stop and dollar risk.
              </p>
            </div>

            {/* PRESET PILLS */}
            <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleSelectMode("eval")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors",
                  mode === "eval"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="h-3 w-3 text-brand" />
                Eval (50k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode("funded")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors",
                  mode === "funded"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Shield className="h-3 w-3 text-profit" />
                Funded
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode("custom")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors",
                  mode === "custom"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sliders className="h-3 w-3" />
                Custom
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* ROW 1: STOP LOSS (POINTS) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Technical stop loss (pts)
              </label>
              <div className="mt-1 flex items-center gap-1">
                {[10, 12.5, 25].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => onChange({ stopPoints: pts, mode: "custom" })}
                    className={cn(
                      "rounded border px-1.5 py-0.2 text-[10px] font-medium transition-colors",
                      stopPoints === pts
                        ? "border-brand/60 bg-brand/10 text-brand"
                        : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {pts} pts
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              step={instrument.tickSize}
              className="h-9 w-36 text-right font-mono tnum"
              value={stopPoints}
              onChange={(e) => onChange({ stopPoints: Number(e.target.value), mode: "custom" })}
            />
          </div>

          {/* ROW 2: TAKE PROFIT (POINTS) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Take profit target (pts)
              </label>
              <div className="mt-1 flex items-center gap-1">
                {[19, 38, 70].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => onChange({ targetPoints: pts, mode: "custom" })}
                    className={cn(
                      "rounded border px-1.5 py-0.2 text-[10px] font-medium transition-colors",
                      targetPoints === pts
                        ? "border-profit/60 bg-profit/10 text-profit"
                        : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {pts} pts
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              step={instrument.tickSize}
              className="h-9 w-36 text-right font-mono tnum"
              value={targetPoints}
              onChange={(e) => onChange({ targetPoints: Number(e.target.value), mode: "custom" })}
            />
          </div>

          {/* ROW 3: MAX DOLLAR RISK & INSTRUMENT */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max dollar risk ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-right font-mono tnum"
              value={riskDollars}
              onChange={(e) => onChange({ riskDollars: Number(e.target.value), mode: "custom" })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Market instrument
            </label>
            <div className="w-36">
              <OptionSelect
                value={instrumentId}
                onValueChange={(val) => onChange({ instrumentId: val })}
                className="h-9 text-xs"
              >
                {QUANT_INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </OptionSelect>
            </div>
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Recommended entry size
            </span>
            <HoverHint content="Copy sizing breakdown to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleCopySizing}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy sizing"}
              </Button>
            </HoverHint>
          </div>

          {/* SIZING HIGHLIGHT */}
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono tnum">
              {sizing.recommendedContracts} {instrument.id}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              contract{sizing.recommendedContracts > 1 ? "s" : ""}
            </span>
            {instrument.id === "NQ" && sizing.microContracts > 0 && (
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                or {sizing.microContracts} MNQ
              </span>
            )}
          </div>

          {/* RISK & TARGET SUMMARY */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Max loss</span>
              <span className="font-mono font-semibold text-loss">
                <MonetaryValue>-${sizing.actualRiskDollars.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Target profit</span>
              <span className="font-mono font-semibold text-profit">
                <MonetaryValue>
                  +${(sizing.targetDollars ?? 0).toLocaleString("en-US")}
                </MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Risk : Reward</span>
              <span className="font-mono font-semibold text-foreground">
                1 : {sizing.riskRewardRatio ?? 0}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
