"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  QUANT_INSTRUMENTS,
  calculatePositionSize,
  type QuantInstrument,
} from "@luxalgo/journal-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import type { CalculatorState } from "@/lib/use-calculator-state";

interface PointsSizingCardProps {
  values: CalculatorState["sizing"];
  onChange: (patch: Partial<CalculatorState["sizing"]>) => void;
}

export function PointsSizingCard({ values, onChange }: PointsSizingCardProps) {
  const {
    instrumentId,
    stopPoints,
    riskDollars,
    targetPoints,
    contracts: storedContracts,
  } = values;
  const contracts = storedContracts ?? 1;
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

  const microName = instrument.id === "NQ" ? "MNQ" : instrument.id === "ES" ? "MES" : null;

  // If user leaves target points empty or 0, fallback to a 2:1 (2R) hypothetical target
  const isDefaultTarget = !targetPoints || targetPoints <= 0;
  const effectiveTargetPoints = !isDefaultTarget
    ? targetPoints
    : stopPoints > 0
      ? Number((stopPoints * 2).toFixed(2))
      : 0;

  const sizing = useMemo(() => {
    return calculatePositionSize(
      riskDollars,
      stopPoints,
      instrument.multiplier,
      effectiveTargetPoints,
      contracts,
    );
  }, [riskDollars, stopPoints, instrument.multiplier, effectiveTargetPoints, contracts]);

  const handleInstrumentChange = (val: string) => {
    const nextInst = QUANT_INSTRUMENTS.find((i) => i.id === val) ?? instrument;
    const nextRisk =
      contracts > 0 && stopPoints > 0
        ? Math.round(contracts * stopPoints * nextInst.multiplier)
        : riskDollars;
    onChange({ instrumentId: val, riskDollars: nextRisk });
  };

  const handleContractsChange = (c: number) => {
    const nextContracts = Math.max(1, c);
    const nextRisk =
      stopPoints > 0 ? Math.round(nextContracts * stopPoints * instrument.multiplier) : riskDollars;
    onChange({ contracts: nextContracts, riskDollars: nextRisk });
  };

  const handleStopPointsChange = (pts: number) => {
    const nextStop = Math.max(0, pts);
    const nextRisk =
      contracts > 0 ? Math.round(contracts * nextStop * instrument.multiplier) : riskDollars;
    onChange({ stopPoints: nextStop, riskDollars: nextRisk });
  };

  const handleRiskDollarsChange = (dollars: number) => {
    const nextRisk = Math.max(0, dollars);
    if (stopPoints > 0 && instrument.multiplier > 0) {
      const fitted = Math.floor(nextRisk / (stopPoints * instrument.multiplier));
      if (fitted >= 1) {
        onChange({ riskDollars: nextRisk, contracts: fitted });
        return;
      }
    }
    onChange({ riskDollars: nextRisk });
  };

  const handleCopySizing = async () => {
    const targetLabel = isDefaultTarget
      ? `TP (2:1): ${effectiveTargetPoints} pts (+$${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`
      : `TP: ${targetPoints} pts (+$${(sizing.targetDollars ?? 0).toLocaleString("en-US")})`;

    const text = `${instrument.id}: ${sizing.recommendedContracts} contract${
      sizing.recommendedContracts > 1 ? "s" : ""
    } | SL: ${stopPoints} pts (-$${sizing.actualRiskDollars.toLocaleString("en-US")}) | ${targetLabel}`;

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
            Position & Risk Sizing
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Determine exact contracts from your technical chart stop and dollar risk.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: MARKET INSTRUMENT */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Market instrument
            </label>
            <div className="w-36">
              <OptionSelect
                value={instrumentId}
                onValueChange={handleInstrumentChange}
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

          {/* 2º: CONTRACTS */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contracts
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={contracts || ""}
              placeholder="1"
              onChange={(e) => handleContractsChange(Number(e.target.value))}
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
              onChange={(e) => handleStopPointsChange(Number(e.target.value))}
            />
          </div>

          {/* 4º: MAX DOLLAR RISK */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Max dollar risk ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={riskDollars || ""}
              placeholder="500"
              onChange={(e) => handleRiskDollarsChange(Number(e.target.value))}
            />
          </div>

          {/* 5º: TAKE PROFIT TARGET (OPTIONAL) */}
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
            />
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
            {microName && sizing.microContracts > 0 && (
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                or {sizing.microContracts} {microName}
              </span>
            )}
          </div>

          {/* EXCEEDS BUDGET ALERT IF RELEVANT */}
          {sizing.exceedsBudget && (
            <div className="mt-2 rounded border border-loss/30 bg-loss/10 px-2.5 py-1 text-[11px] text-loss">
              Notice: 1 {instrument.id} requires ${stopPoints * instrument.multiplier} min risk.
              {microName &&
                ` Consider ${sizing.microContracts} ${microName} to stay within budget.`}
            </div>
          )}

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
        </div>
      </CardContent>
    </Card>
  );
}
