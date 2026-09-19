"use client";

import { useEffect, useMemo, useState } from "react";
import {
  QUANT_INSTRUMENTS,
  calculatePositionSize,
  type QuantInstrument,
} from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { AssetIcon } from "@/components/ui/asset-icon";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import type { CalculatorState } from "@/lib/use-calculator-state";
import { FormulaHud } from "./shared";

interface PointsSizingCardProps {
  values: CalculatorState["sizing"];
  onChange: (patch: Partial<CalculatorState["sizing"]>) => void;
}

export function PointsSizingCard({ values, onChange }: PointsSizingCardProps) {
  const { instrumentId, stopPoints, riskDollars, targetPoints } = values;

  const instrument: QuantInstrument = useMemo(() => {
    return (
      QUANT_INSTRUMENTS.find((i) => i.id === instrumentId) ?? {
        id: "NQ",
        name: "NQ ($20/pt)",
        multiplier: 20,
        tickSize: 0.25,
        category: "indices",
        microId: "MNQ",
        assetTitle: "Nasdaq-100",
      }
    );
  }, [instrumentId]);

  const microName = instrument.microId ?? null;
  const microRatio = instrument.id === "BTC" ? 50 : 10;

  // 1. Point value: fixed multiplier per instrument (e.g. $20/pt for NQ)
  const pointValue = instrument.multiplier;

  // 2. Stop value defined by user: stopPoints
  // Cost of 1 full contract for this stop
  const costPerContract = stopPoints > 0 ? Math.round(stopPoints * pointValue) : 0;

  // 3. Floating Max Dollar Risk:
  // If margin does not cover 1 contract, the effective risk floats to the max loss of 1 contract
  const effectiveRiskDollars =
    costPerContract > 0 && riskDollars < costPerContract ? costPerContract : riskDollars;

  const [isRiskFocused, setIsRiskFocused] = useState(false);
  const [isStopFocused, setIsStopFocused] = useState(false);
  const [riskInputText, setRiskInputText] = useState("");

  // Keep input text in sync when not actively focused
  useEffect(() => {
    if (!isRiskFocused) {
      setRiskInputText(effectiveRiskDollars > 0 ? String(effectiveRiskDollars) : "");
    }
  }, [effectiveRiskDollars, isRiskFocused]);

  // If margin doesn't cover 1 contract, update parent state/localStorage to match max loss
  useEffect(() => {
    if (costPerContract > 0 && riskDollars < costPerContract) {
      onChange({ riskDollars: costPerContract });
    }
  }, [costPerContract, riskDollars, onChange]);

  // If user leaves target points empty or 0, fallback to a 2:1 (2R) hypothetical target
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
    const nextInst = QUANT_INSTRUMENTS.find((i) => i.id === val) ?? instrument;
    if (stopPoints > 0) {
      const nextCost = Math.round(stopPoints * nextInst.multiplier);
      // If current risk budget does not cover 1 contract of the new instrument, adjust to max loss
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
    // If current risk budget does not cover the new stop loss, adjust to max loss
    if (nextCost > riskDollars) {
      onChange({ stopPoints: nextStop, riskDollars: nextCost });
    } else {
      onChange({ stopPoints: nextStop });
    }
  };

  const copyText = useMemo(() => {
    const targetLabel = isDefaultTarget
      ? `TP (2:1): ${effectiveTargetPoints} pts (+$${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`
      : `TP: ${targetPoints} pts (+$${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`;

    return `${instrument.id}: ${sizing.recommendedContracts} contract${
      sizing.recommendedContracts > 1 ? "s" : ""
    } | SL: ${stopPoints} pts (-$${sizing.actualRiskDollars.toLocaleString("en-US")}) | ${targetLabel}`;
  }, [
    instrument.id,
    sizing.recommendedContracts,
    sizing.actualRiskDollars,
    sizing.targetDollars,
    stopPoints,
    isDefaultTarget,
    effectiveTargetPoints,
    targetPoints,
  ]);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case [text-wrap:balance]">
              Position & Risk Sizing
            </CardTitle>
            <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
              Futures · Quant Sizing
            </span>
          </div>
          <p className="text-xs text-muted-foreground [text-wrap:pretty]">
            Determine exact contracts from your technical chart stop and dollar risk.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: MARKET INSTRUMENT */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Market instrument
              </label>
              <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
                tick: {instrument.tickSize} pt
              </span>
            </div>
            <div className="w-48 sm:w-56">
              <Select value={instrumentId} onValueChange={handleInstrumentChange}>
                <SelectTrigger className="h-9 w-full justify-between gap-2 px-2.5 text-xs font-mono font-semibold transition-all hover:bg-accent/40 active:scale-[0.98]">
                  <div className="flex items-center gap-2 truncate">
                    <AssetIcon symbol={instrument.id} size="xs" />
                    <span className="font-bold text-foreground">{instrument.id}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/70 px-1 py-0.5 rounded border border-border/50">
                      ${instrument.multiplier}/pt
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80 w-72 p-1">
                  {/* US Indices */}
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    US Equity Indices
                  </div>
                  {QUANT_INSTRUMENTS.filter((i) => i.category === "indices").map((inst) => (
                    <SelectItem key={inst.id} value={inst.id} className="text-xs py-1.5">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <AssetIcon symbol={inst.id} size="xs" />
                          <span className="font-mono font-bold text-foreground">{inst.id}</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {inst.assetTitle}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted/60 px-1 py-0.5 rounded border border-border/40">
                          ${inst.multiplier}/pt
                        </span>
                      </div>
                    </SelectItem>
                  ))}

                  {/* Micro Indices */}
                  <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-t border-border/40">
                    Micro Equity Indices
                  </div>
                  {QUANT_INSTRUMENTS.filter((i) => i.category === "micros").map((inst) => (
                    <SelectItem key={inst.id} value={inst.id} className="text-xs py-1.5">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <AssetIcon symbol={inst.id} size="xs" />
                          <span className="font-mono font-bold text-foreground">{inst.id}</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {inst.assetTitle}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted/60 px-1 py-0.5 rounded border border-border/40">
                          ${inst.multiplier}/pt
                        </span>
                      </div>
                    </SelectItem>
                  ))}

                  {/* Commodities */}
                  <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-t border-border/40">
                    Commodities
                  </div>
                  {QUANT_INSTRUMENTS.filter((i) => i.category === "commodities").map((inst) => (
                    <SelectItem key={inst.id} value={inst.id} className="text-xs py-1.5">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <AssetIcon symbol={inst.id} size="xs" />
                          <span className="font-mono font-bold text-foreground">{inst.id}</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {inst.assetTitle}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted/60 px-1 py-0.5 rounded border border-border/40">
                          ${inst.multiplier}/pt
                        </span>
                      </div>
                    </SelectItem>
                  ))}

                  {/* Crypto Futures */}
                  <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-t border-border/40">
                    Crypto Futures (CME)
                  </div>
                  {QUANT_INSTRUMENTS.filter((i) => i.category === "crypto").map((inst) => (
                    <SelectItem key={inst.id} value={inst.id} className="text-xs py-1.5">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <AssetIcon symbol={inst.id} size="xs" />
                          <span className="font-mono font-bold text-foreground">{inst.id}</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {inst.assetTitle}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted/60 px-1 py-0.5 rounded border border-border/40">
                          ${inst.multiplier}/pt
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2º: MAX DOLLAR RISK */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max dollar risk ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  // If margin does not cover 1 contract, snap input to the exact max loss
                  onChange({ riskDollars: costPerContract });
                  setRiskInputText(String(costPerContract));
                } else if (val >= costPerContract) {
                  onChange({ riskDollars: val });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 3º: STOP LOSS (PTS) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stop loss (pts)
            </label>
            <Input
              type="number"
              step={instrument.tickSize}
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={stopPoints || ""}
              placeholder="20.00"
              onFocus={() => setIsStopFocused(true)}
              onBlur={() => setIsStopFocused(false)}
              onChange={(e) => handleStopPointsChange(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 4º: TAKE PROFIT TARGET (OPTIONAL) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Take profit target (pts)
              </label>
              <span className="text-[10px] text-muted-foreground/70">Optional · 2:1 default</span>
            </div>
            <Input
              type="number"
              step={instrument.tickSize}
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={targetPoints || ""}
              placeholder={stopPoints > 0 ? (stopPoints * 2).toFixed(2) : "Optional"}
              onChange={(e) => onChange({ targetPoints: Number(e.target.value) })}
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
        <FormulaHud
          title="Recommended entry size"
          category={{
            label: `${instrument.id} · Futures Quant`,
            color: "text-primary",
            border: "border-primary/50",
            bg: "bg-primary/20",
            heading: `${instrument.assetTitle ?? instrument.id} Position Sizing`,
            advice: `Calculated from technical chart stop (${stopPoints} pts @ $${instrument.multiplier}/pt) and maximum allowable dollar risk.`,
          }}
          copyText={copyText}
          theoryNumerator="Max Risk ($)"
          theoryDenominator="Stop × Point Value"
          valueNumerator={
            <span
              className={cn(
                "font-semibold text-foreground tnum px-1 py-0.5 rounded transition-[background-color,color] duration-150",
                isRiskFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
              )}
            >
              ${effectiveRiskDollars > 0 ? effectiveRiskDollars.toLocaleString("en-US") : "0"}
            </span>
          }
          valueDenominator={
            <span
              className={cn(
                "px-1 py-0.5 rounded transition-[background-color,color] duration-150 tnum whitespace-nowrap",
                isStopFocused
                  ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                  : "text-muted-foreground",
              )}
            >
              {stopPoints > 0 ? stopPoints : "0"} pts × ${pointValue}
            </span>
          }
          resultValue={
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono tnum">
              {sizing.recommendedContracts} {instrument.id}
            </span>
          }
          resultLabel={`contract${sizing.recommendedContracts > 1 ? "s" : ""}`}
          resultSecondary={
            microName && sizing.microContracts > 0 ? (
              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono whitespace-nowrap">
                or {sizing.microContracts} {microName} micros
              </span>
            ) : undefined
          }
        >
          {/* RISK & TARGET SUMMARY */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Max loss</span>
              <span className="font-mono font-semibold text-loss">
                <MonetaryValue>-${sizing.actualRiskDollars.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">
                Target profit{" "}
                {isDefaultTarget && (
                  <span className="text-[10px] text-muted-foreground">(2:1)</span>
                )}
              </span>
              <span className="font-mono font-semibold text-profit">
                <MonetaryValue>
                  +${(sizing.targetDollars ?? 0).toLocaleString("en-US")}
                </MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Risk : Reward</span>
              <span className="font-mono font-semibold text-foreground">
                1 : {sizing.riskRewardRatio ?? (isDefaultTarget && stopPoints > 0 ? "2.00" : "0")}
              </span>
            </div>
          </div>
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
