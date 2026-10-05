"use client";

import { useEffect, useMemo, useState } from "react";
import {
  QUANT_INSTRUMENTS,
  calculatePositionSize,
  type QuantInstrument,
} from "@luxalgo/journal-core";
import { Check, Copy, Sparkles, TrendingUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JournalAssetDropdown } from "@/components/journal-asset-dropdown";
import { getQuantInstrument, getSymbolSpec } from "@/lib/assets/symbol-specs";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface PointsSizingCardCockpitProps {
  values: CalculatorState["sizing"];
  onChange: (patch: Partial<CalculatorState["sizing"]>) => void;
}

const COMMON_RISK_PRESETS = [250, 500, 1000, 2000];

export function PointsSizingCardCockpit({ values, onChange }: PointsSizingCardCockpitProps) {
  const { instrumentId, stopPoints, riskDollars, targetPoints } = values;

  const instrument: QuantInstrument = useMemo(() => {
    return getQuantInstrument(instrumentId) ?? QUANT_INSTRUMENTS[0]!;
  }, [instrumentId]);

  const microName = instrument.microId ?? null;
  const microRatio = useMemo(() => {
    if (instrument.id === "BTC") return 50;
    if (instrument.id === "ETH") return 500;
    if (instrument.id === "SI") return 5;
    return 10;
  }, [instrument.id]);

  const pointValue = instrument.multiplier;
  const costPerContract = stopPoints > 0 ? Math.round(stopPoints * pointValue) : 0;
  const effectiveRiskDollars =
    costPerContract > 0 && riskDollars < costPerContract ? costPerContract : riskDollars;

  const [isRiskFocused, setIsRiskFocused] = useState(false);
  const [riskInputText, setRiskInputText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isRiskFocused) {
      setRiskInputText(effectiveRiskDollars > 0 ? String(effectiveRiskDollars) : "");
    }
  }, [effectiveRiskDollars, isRiskFocused]);

  useEffect(() => {
    if (costPerContract > 0 && riskDollars < costPerContract) {
      onChange({ riskDollars: costPerContract });
    }
  }, [costPerContract, riskDollars, onChange]);

  const isDefaultTarget = !targetPoints || targetPoints <= 0;
  const effectiveTargetPoints = !isDefaultTarget
    ? targetPoints
    : stopPoints > 0
      ? Number((stopPoints * 2).toFixed(2))
      : 0;

  const sizing = useMemo(() => {
    return calculatePositionSize(
      effectiveRiskDollars,
      stopPoints,
      instrument.multiplier,
      effectiveTargetPoints,
      microRatio,
    );
  }, [effectiveRiskDollars, stopPoints, instrument.multiplier, effectiveTargetPoints, microRatio]);

  const handleInstrumentChange = (val: string) => {
    const nextInst =
      QUANT_INSTRUMENTS.find((i) => i.id === val) ??
      (() => {
        const spec = getSymbolSpec(val);
        if (spec && spec.pointValue) {
          return {
            id: spec.symbol,
            name: `${spec.symbol} (${spec.currency === "BRL" ? "R$" : "$"}${spec.pointValue}/pt)`,
            multiplier: spec.pointValue,
            tickSize: spec.tickSize ?? 0.01,
            tickValue: spec.tickValue ?? 0.01,
            currency: spec.currency ?? "USD",
            category: (spec.category as any) ?? "indices",
            microId: spec.microId,
            assetTitle: spec.name,
          };
        }
        return instrument;
      })();

    if (stopPoints > 0) {
      const nextCost = Math.round(stopPoints * nextInst.multiplier);
      if (nextCost > riskDollars) {
        onChange({ instrumentId: val, riskDollars: nextCost });
        return;
      }
    }
    onChange({ instrumentId: val });
  };

  const handleStopPointsChange = (pts: number) => {
    const nextStop = Math.max(0, pts);
    if (nextStop <= 0) {
      onChange({ stopPoints: nextStop });
      return;
    }
    const nextCost = Math.round(nextStop * instrument.multiplier);
    if (nextCost > riskDollars) {
      onChange({ stopPoints: nextStop, riskDollars: nextCost });
    } else {
      onChange({ stopPoints: nextStop });
    }
  };

  const isBrl = instrument.currency === "BRL";
  const curr = isBrl ? "R$" : "$";

  const copyText = useMemo(() => {
    const targetLabel = isDefaultTarget
      ? `TP (2:1): ${effectiveTargetPoints} pts (+${curr}${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`
      : `TP: ${targetPoints} pts (+${curr}${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`;

    return `${instrument.id}: ${sizing.recommendedContracts} contract${
      sizing.recommendedContracts > 1 ? "s" : ""
    } | SL: ${stopPoints} pts (-${curr}${sizing.actualRiskDollars.toLocaleString("en-US")}) | ${targetLabel}`;
  }, [
    instrument.id,
    sizing.recommendedContracts,
    sizing.actualRiskDollars,
    sizing.targetDollars,
    stopPoints,
    isDefaultTarget,
    effectiveTargetPoints,
    targetPoints,
    curr,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore failure
    }
  };

  // Calculate Risk / Reward percentage width for visual bar
  const rrRatioNum = Number(sizing.riskRewardRatio ?? (isDefaultTarget && stopPoints > 0 ? "2.00" : "1.00"));
  const safeRrRatio = Number.isFinite(rrRatioNum) && rrRatioNum > 0 ? rrRatioNum : 1;
  // Risk weight = 1, Reward weight = safeRrRatio. Total = 1 + safeRrRatio
  const riskBarWidthPct = Math.max(20, Math.min(80, (1 / (1 + safeRrRatio)) * 100));
  const rewardBarWidthPct = 100 - riskBarWidthPct;

  return (
    <Card className="overflow-hidden border border-border/70 shadow-xs">
      {/* CARD TOP HEADER */}
      <CardHeader className="border-b border-border/60 bg-muted/10 p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 items-center gap-1 rounded bg-brand/10 border border-brand/30 px-1.5 font-mono text-[10px] font-semibold text-brand">
              <Sparkles className="h-3 w-3" />
              Cockpit v2
            </span>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Position &amp; Risk Sizing
            </CardTitle>
          </div>
          <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-2 font-mono text-[10px] font-medium leading-none text-muted-foreground">
            {instrument.id} · Quant Sizing
          </span>
        </div>
        <p className="text-xs text-muted-foreground [text-wrap:pretty]">
          Determine exact contracts from your technical chart stop and dollar risk budget.
        </p>
      </CardHeader>

      {/* 2-COLUMN COCKPIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
        {/* LEFT COLUMN: DENSE INPUT COCKPIT (7 COLS = ~58%) */}
        <div className="lg:col-span-7 p-4 sm:p-5 space-y-4">
          {/* 1. Instrument Selection */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Market instrument
              </span>
              <span className="inline-flex items-center rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                {curr}{instrument.multiplier}/pt
              </span>
            </div>
            <div className="w-40">
              <JournalAssetDropdown
                currentAsset={instrument.id}
                onSelectAsset={(val) => {
                  if (val) handleInstrumentChange(val);
                }}
                triggerVariant="form"
                alignCenter={true}
                hideGeneralJournal={true}
                showValues={true}
                allowClear={false}
                onlyCalculable={true}
                align="end"
                className="h-8 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          {/* 2. Max Risk with Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Max risk budget
              </label>
              <div className="relative w-40">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                  {curr}
                </span>
                <Input
                  type="number"
                  className="h-8 w-full pl-6 pr-2 text-right font-mono text-xs font-medium tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={isRiskFocused ? riskInputText : effectiveRiskDollars || ""}
                  placeholder={costPerContract > 0 ? String(costPerContract) : "500"}
                  onFocus={() => {
                    setIsRiskFocused(true);
                    setRiskInputText(effectiveRiskDollars > 0 ? String(effectiveRiskDollars) : "");
                  }}
                  onChange={(e) => {
                    const text = e.target.value;
                    setRiskInputText(text);
                    const val = Number(text);
                    if (val >= costPerContract) {
                      onChange({ riskDollars: val });
                    }
                  }}
                  onBlur={() => {
                    setIsRiskFocused(false);
                    const val = Number(riskInputText);
                    if (costPerContract > 0 && val < costPerContract) {
                      onChange({ riskDollars: costPerContract });
                      setRiskInputText(String(costPerContract));
                    } else if (val >= costPerContract) {
                      onChange({ riskDollars: val });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            </div>

            {/* Risk Preset Chips */}
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] text-muted-foreground/70 mr-1">Quick:</span>
              {COMMON_RISK_PRESETS.map((preset) => {
                const isActive = effectiveRiskDollars === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (preset >= costPerContract) {
                        onChange({ riskDollars: preset });
                        setRiskInputText(String(preset));
                      }
                    }}
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[10px] font-medium transition-[background-color,border-color,color] duration-150 active:scale-[0.97]",
                      isActive
                        ? "border-primary/50 bg-primary/20 text-primary font-semibold"
                        : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    ${preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Stop Loss & Target in 2-Col Subgrid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
            {/* Stop Loss (pts) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Stop loss
                </label>
                <span className="font-mono text-[10px] text-loss">
                  -{curr}{costPerContract.toLocaleString()} /ct
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step={instrument.tickSize}
                  className="h-8 pr-9 font-mono text-xs font-medium tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={stopPoints || ""}
                  placeholder="20.00"
                  onChange={(e) => handleStopPointsChange(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none">
                  pts
                </span>
              </div>
            </div>

            {/* Take Profit Target (pts) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Take profit
                </label>
                <span className="font-mono text-[10px] text-profit">
                  {isDefaultTarget ? "2:1 auto" : "Custom"}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step={instrument.tickSize}
                  className="h-8 pr-9 font-mono text-xs font-medium tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={targetPoints || ""}
                  placeholder={stopPoints > 0 ? (stopPoints * 2).toFixed(2) : "Optional"}
                  onChange={(e) => onChange({ targetPoints: Number(e.target.value) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none">
                  pts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HERO EXECUTION TELEMETRY (5 COLS = ~42%) */}
        <div className="lg:col-span-5 p-4 sm:p-5 bg-muted/15 flex flex-col justify-between space-y-4">
          {/* Telemetry Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Telemetry
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy order"}
            </Button>
          </div>

          {/* HERO OUTPUT CARD */}
          <div className="rounded-lg border border-border/80 bg-background/90 p-3.5 shadow-xs">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Recommended Entry
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground tnum">
                {sizing.recommendedContracts}
              </span>
              <span className="text-base font-bold text-foreground">
                {instrument.id}
              </span>
              <span className="text-xs text-muted-foreground">
                contract{sizing.recommendedContracts > 1 ? "s" : ""}
              </span>
            </div>
            {microName && sizing.microContracts > 0 && (
              <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                or <strong className="text-foreground">{sizing.microContracts}</strong> {microName} micros
              </p>
            )}
          </div>

          {/* DYNAMIC RISK / REWARD VISUAL BAR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-loss font-medium">
                Loss -{curr}{sizing.actualRiskDollars.toLocaleString("en-US")}
              </span>
              <span className="text-muted-foreground font-semibold">
                1 : {sizing.riskRewardRatio ?? (isDefaultTarget && stopPoints > 0 ? "2.00" : "0")}
              </span>
              <span className="text-profit font-medium">
                Gain +{curr}{(sizing.targetDollars ?? 0).toLocaleString("en-US")}
              </span>
            </div>

            {/* Split Visual Bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/80 p-0.5 gap-0.5">
              <div
                className="h-full rounded-l-full bg-loss transition-all duration-300"
                style={{ width: `${riskBarWidthPct}%` }}
                title={`Risk: ${riskBarWidthPct.toFixed(0)}%`}
              />
              <div
                className="h-full rounded-r-full bg-profit transition-all duration-300"
                style={{ width: `${rewardBarWidthPct}%` }}
                title={`Reward: ${rewardBarWidthPct.toFixed(0)}%`}
              />
            </div>
          </div>

          {/* QUANT DERIVATION FOOTER */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 opacity-70" />
              Formula:
            </span>
            <span className="text-foreground/90 tnum">
              {curr}{effectiveRiskDollars > 0 ? effectiveRiskDollars.toLocaleString("en-US") : "0"} / ({stopPoints > 0 ? stopPoints : "0"} pts × {curr}{pointValue})
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
