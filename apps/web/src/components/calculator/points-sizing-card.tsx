"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  QUANT_INSTRUMENTS,
  calculatePointValue,
  calculatePointsFromDollars,
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
  const { instrumentId, points, contracts, dollars } = values;
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

  const handlePointsChange = (pts: number) => {
    const nextDollars = calculatePointValue(pts, contracts, instrument.multiplier);
    onChange({ points: pts, dollars: nextDollars });
  };

  const handleContractsChange = (cts: number) => {
    const nextDollars = calculatePointValue(points, cts, instrument.multiplier);
    onChange({ contracts: cts, dollars: nextDollars });
  };

  const handleDollarsChange = (dlrs: number) => {
    const nextPoints = calculatePointsFromDollars(dlrs, contracts, instrument.multiplier);
    onChange({ dollars: dlrs, points: nextPoints });
  };

  const handleInstrumentChange = (newId: string) => {
    const nextInst = QUANT_INSTRUMENTS.find((i) => i.id === newId);
    const multiplier = nextInst?.multiplier ?? 20;
    const nextDollars = calculatePointValue(points, contracts, multiplier);
    onChange({ instrumentId: newId, dollars: nextDollars });
  };

  const handleCopySizing = async () => {
    const text = `${instrument.id}: ${points} pts × ${contracts} contract${contracts > 1 ? "s" : ""} = $${dollars.toLocaleString("en-US")}`;
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
              {instrument.id} Points · Contracts · $
            </CardTitle>
            <div className="w-36">
              <OptionSelect
                value={instrumentId}
                onValueChange={handleInstrumentChange}
                className="h-7 text-xs"
              >
                {QUANT_INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </OptionSelect>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ${instrument.multiplier} per point per contract. Enter any two; the third updates.
          </p>
        </CardHeader>

        <CardContent>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Points
              </label>
              <Input
                type="number"
                step={instrument.tickSize}
                className="text-center font-mono tnum"
                value={points}
                onChange={(e) => handlePointsChange(Number(e.target.value))}
              />
            </div>

            <span className="pt-6 font-semibold text-muted-foreground">×</span>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Contracts
              </label>
              <Input
                type="number"
                min="1"
                className="text-center font-mono tnum"
                value={contracts}
                onChange={(e) => handleContractsChange(Number(e.target.value))}
              />
            </div>

            <span className="pt-6 font-semibold text-muted-foreground">=</span>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                $
              </label>
              <Input
                type="number"
                className="text-center font-mono tnum"
                value={dollars}
                onChange={(e) => handleDollarsChange(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Presets:</span>
              {[10, 20, 38].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => handlePointsChange(pts)}
                  className="rounded border border-border/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {pts} pts
                </button>
              ))}
            </div>

            <HoverHint content="Copy sizing breakdown to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={handleCopySizing}
              >
                {copied ? <Check className="h-3 w-3 text-profit" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy sizing"}
              </Button>
            </HoverHint>
          </div>

          <div className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Instrument tick value:</span>
              <span className="font-mono font-medium text-foreground">
                {instrument.tickSize} pts = $
                {(instrument.multiplier * instrument.tickSize).toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>1 full point (1.00):</span>
              <span className="font-mono font-medium text-foreground">
                ${instrument.multiplier.toFixed(2)} / contract
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border/40 pt-1">
              <span>Current total position risk:</span>
              <span className="font-mono font-medium text-foreground">
                <MonetaryValue>${dollars.toLocaleString("en-US")}</MonetaryValue>
              </span>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
