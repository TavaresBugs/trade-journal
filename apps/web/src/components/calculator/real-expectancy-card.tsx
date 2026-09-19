"use client";

import { useState } from "react";
import { DollarSign, Copy, Check, ShieldCheck, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import { calculateRealExpectancy } from "@luxalgo/journal-core";

interface RealExpectancyCardProps {
  winRate?: number;
  riskReward?: number;
  riskDollars?: number;
  feePerTrade?: number;
  slippageDollars?: number;
  onChange?: (patch: {
    winRate?: number;
    riskReward?: number;
    riskDollars?: number;
    feePerTrade?: number;
    slippageDollars?: number;
  }) => void;
}

export function RealExpectancyCard({
  winRate = 45,
  riskReward = 2.5,
  riskDollars = 1000,
  feePerTrade = 5,
  slippageDollars = 10,
  onChange,
}: RealExpectancyCardProps) {
  const [localWr, setLocalWr] = useState(winRate);
  const [localRr, setLocalRr] = useState(riskReward);
  const [localRisk, setLocalRisk] = useState(riskDollars);
  const [localFee, setLocalFee] = useState(feePerTrade);
  const [localSlip, setLocalSlip] = useState(slippageDollars);

  const [isWrFocused, setIsWrFocused] = useState(false);
  const [isRrFocused, setIsRrFocused] = useState(false);
  const [isRiskFocused, setIsRiskFocused] = useState(false);
  const [isFeeFocused, setIsFeeFocused] = useState(false);
  const [isSlipFocused, setIsSlipFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  const safeWr = Math.max(1, Math.min(99, localWr || 45));
  const safeRr = Math.max(0.1, Math.min(20, localRr || 2.5));
  const safeRisk = Math.max(10, localRisk || 1000);
  const safeFee = Math.max(0, localFee ?? 5);
  const safeSlip = Math.max(0, localSlip ?? 10);

  const result = calculateRealExpectancy(safeWr, safeRr, safeRisk, safeFee, safeSlip);

  const handleUpdate = (patch: {
    winRate?: number;
    riskReward?: number;
    riskDollars?: number;
    feePerTrade?: number;
    slippageDollars?: number;
  }) => {
    if (patch.winRate !== undefined) setLocalWr(patch.winRate);
    if (patch.riskReward !== undefined) setLocalRr(patch.riskReward);
    if (patch.riskDollars !== undefined) setLocalRisk(patch.riskDollars);
    if (patch.feePerTrade !== undefined) setLocalFee(patch.feePerTrade);
    if (patch.slippageDollars !== undefined) setLocalSlip(patch.slippageDollars);
    onChange?.(patch);
  };

  const handleCopy = async () => {
    const text = `Real Expectancy Analysis: Win Rate: ${safeWr}% | RR: 1:${safeRr} | Risk: $${safeRisk} | Paper EV: $${result.paperEv} | Friction: -$${result.totalFriction} | Real Net EV: $${result.realEv} (${result.netRMultiple >= 0 ? "+" : ""}${result.netRMultiple}R/trade) | Breakeven Win Rate: ${result.breakevenWinRate}%`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Breakeven & Real Expectancy
            </CardTitle>
            <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
              Paper vs Real
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Compare theoretical Paper EV with Real EV after deducting commissions, exchange fees, and execution slippage.
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* 1º: WIN RATE (%) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Win rate (%)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={localWr || ""}
              placeholder="45"
              onFocus={() => setIsWrFocused(true)}
              onBlur={() => setIsWrFocused(false)}
              onChange={(e) => handleUpdate({ winRate: Number(e.target.value) })}
            />
          </div>

          {/* 2º: RISK TO REWARD (RR) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Risk to reward (1:X)
            </label>
            <Input
              type="number"
              step="0.1"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={localRr || ""}
              placeholder="2.5"
              onFocus={() => setIsRrFocused(true)}
              onBlur={() => setIsRrFocused(false)}
              onChange={(e) => handleUpdate({ riskReward: Number(e.target.value) })}
            />
          </div>

          {/* 3º: RISK DOLLARS ($) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dollar risk per trade ($)
            </label>
            <Input
              type="number"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={localRisk || ""}
              placeholder="1000"
              onFocus={() => setIsRiskFocused(true)}
              onBlur={() => setIsRiskFocused(false)}
              onChange={(e) => handleUpdate({ riskDollars: Number(e.target.value) })}
            />
          </div>

          {/* 4º: FRICTION (FEES & SLIPPAGE) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                Fee / trade ($)
              </label>
              <Input
                type="number"
                className="h-8 text-center font-mono text-xs tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={localFee || ""}
                placeholder="5"
                onFocus={() => setIsFeeFocused(true)}
                onBlur={() => setIsFeeFocused(false)}
                onChange={(e) => handleUpdate({ feePerTrade: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                Slippage / trade ($)
              </label>
              <Input
                type="number"
                className="h-8 text-center font-mono text-xs tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={localSlip || ""}
                placeholder="10"
                onFocus={() => setIsSlipFocused(true)}
                onBlur={() => setIsSlipFocused(false)}
                onChange={(e) => handleUpdate({ slippageDollars: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5">
          {/* HEADER ROW */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Real net expectancy
              </span>
              <span
                className={cn(
                  "h-4 inline-flex items-center rounded border px-1 font-mono text-[9px] font-semibold",
                  result.realEv > 0
                    ? "border-profit/40 bg-profit/10 text-profit"
                    : "border-loss/40 bg-loss/10 text-loss",
                )}
              >
                {result.realEv > 0 ? "Positive Real Edge" : "Friction Erroded Edge"}
              </span>
            </div>
            <HoverHint content="Copy expectancy metrics to clipboard">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-profit" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </HoverHint>
          </div>

          {/* MAIN ROW: THE THREE-STEP PROGRESSION */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-1">
            {/* STEP 1 (LEFT): THEORY */}
            <div className="inline-flex flex-col items-center text-center shrink-0">
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pb-0.5 tracking-wide whitespace-nowrap">
                (Win% × Avg Win) − (Loss% × Avg Loss)
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                − Friction (Fees + Slippage)
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span className={cn("px-0.5 py-0.5 rounded tnum font-semibold", isWrFocused && "bg-primary/20 text-primary")}>
                  {safeWr}%
                </span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span className={cn("px-0.5 py-0.5 rounded tnum font-semibold", isRrFocused && "bg-primary/20 text-primary")}>
                  ${result.avgWin.toLocaleString()}
                </span>
                <span className="text-muted-foreground/60 px-0.5">−</span>
                <span className="text-muted-foreground tnum">{result.lossRate}%</span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span className="text-muted-foreground tnum">${result.avgLoss.toLocaleString()}</span>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span className="text-muted-foreground/70">− </span>
                <span className={cn("px-0.5 py-0.5 rounded tnum font-semibold", isFeeFocused && "bg-primary/20 text-primary")}>
                  ${safeFee}
                </span>
                <span className="text-muted-foreground/60 px-0.5">−</span>
                <span className={cn("px-0.5 py-0.5 rounded tnum font-semibold", isSlipFocused && "bg-primary/20 text-primary")}>
                  ${safeSlip}
                </span>
                <span className="text-muted-foreground/70 text-[10px] ml-1">(= -${result.totalFriction})</span>
              </div>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 3 (RIGHT): DIRECT ACTIONABLE RESULT */}
            <div className="flex flex-col justify-center text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                    result.realEv >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  <MonetaryValue>
                    {result.realEv >= 0 ? `+$${result.realEv.toLocaleString()}` : `-$${Math.abs(result.realEv).toLocaleString()}`}
                  </MonetaryValue>
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  net / trade
                </span>
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-mono font-medium tnum",
                  result.netRMultiple >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {result.netRMultiple >= 0 ? `+${result.netRMultiple}R` : `${result.netRMultiple}R`} net edge
              </span>
            </div>
          </div>

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Paper gross EV</span>
              <span className="font-mono font-semibold text-foreground tnum">
                <MonetaryValue>{result.paperEv >= 0 ? `+$${result.paperEv}` : `-$${Math.abs(result.paperEv)}`}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Friction per trade</span>
              <span className="font-mono font-semibold text-loss tnum">
                <MonetaryValue>-${result.totalFriction}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Breakeven win rate</span>
              <span className="font-mono font-semibold text-foreground tnum">
                {result.breakevenWinRate}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
