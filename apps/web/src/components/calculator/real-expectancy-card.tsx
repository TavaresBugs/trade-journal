"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormulaHud, type FormulaHudCategory } from "@/components/calculator/shared/formula-hud";
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

  useEffect(() => {
    if (winRate !== undefined) setLocalWr(winRate);
  }, [winRate]);

  useEffect(() => {
    if (riskReward !== undefined) setLocalRr(riskReward);
  }, [riskReward]);

  useEffect(() => {
    if (riskDollars !== undefined) setLocalRisk(riskDollars);
  }, [riskDollars]);

  useEffect(() => {
    if (feePerTrade !== undefined) setLocalFee(feePerTrade);
  }, [feePerTrade]);

  useEffect(() => {
    if (slippageDollars !== undefined) setLocalSlip(slippageDollars);
  }, [slippageDollars]);

  const [isWrFocused, setIsWrFocused] = useState(false);
  const [isRrFocused, setIsRrFocused] = useState(false);
  const [isRiskFocused, setIsRiskFocused] = useState(false);
  const [isFeeFocused, setIsFeeFocused] = useState(false);
  const [isSlipFocused, setIsSlipFocused] = useState(false);

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

  const isPositiveRealEdge = result.realEv > 0;
  const isPaperPositiveOnly = result.paperEv > 0 && result.realEv <= 0;

  const expectancyCategory: FormulaHudCategory = isPositiveRealEdge
    ? {
        label: "Positive Real Edge",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
        heading: "Sustainable Real Edge",
        advice: `Your net return of +$${result.realEv.toLocaleString()} (${result.netRMultiple >= 0 ? "+" : ""}${result.netRMultiple}R/trade) survives execution friction with a ${result.breakevenWinRate}% breakeven requirement.`,
      }
    : isPaperPositiveOnly
      ? {
          label: "Friction Eroded Edge",
          color: "text-loss",
          border: "border-loss/40",
          bg: "bg-loss/10",
          heading: "Execution Friction Trap",
          advice: `The strategy has a positive theoretical Paper EV (+$${result.paperEv.toLocaleString()}), but commissions ($${safeFee}) and slippage ($${safeSlip}) consume 100% of your profit, resulting in -$${Math.abs(result.realEv).toLocaleString()} net per trade.`,
        }
      : {
          label: "Negative Edge",
          color: "text-loss",
          border: "border-loss/40",
          bg: "bg-loss/10",
          heading: "Negative Mathematical Expectancy",
          advice: `Both theoretical paper expectancy (-$${Math.abs(result.paperEv).toLocaleString()}) and real net expectancy (-$${Math.abs(result.realEv).toLocaleString()}) are negative. The system loses capital on every trade.`,
        };

  const copyText = `Real Expectancy Analysis: Win Rate: ${safeWr}% | RR: 1:${safeRr} | Risk: $${safeRisk} | Paper EV: $${result.paperEv} | Friction: -$${result.totalFriction} | Real Net EV: $${result.realEv} (${result.netRMultiple >= 0 ? "+" : ""}${result.netRMultiple}R/trade) | Breakeven Win Rate: ${result.breakevenWinRate}% | Status: ${expectancyCategory.label}`;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            Breakeven & Real Expectancy
          </CardTitle>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <FormulaHud
          title="Real net expectancy"
          category={expectancyCategory}
          copyText={copyText}
          theoryNumerator="(Win% × Avg Win) − (Loss% × Avg Loss)"
          theoryDenominator="− Friction (Fees + Slippage)"
          valueNumerator={
            <>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded tnum font-semibold transition-[background-color,color] duration-150",
                  isWrFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                {safeWr}%
              </span>
              <span className="text-muted-foreground/60 px-0.5">×</span>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded tnum font-semibold transition-[background-color,color] duration-150",
                  isRrFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                <MonetaryValue>${result.avgWin.toLocaleString()}</MonetaryValue>
              </span>
              <span className="text-muted-foreground/60 px-0.5">−</span>
              <span className="text-muted-foreground tnum">{result.lossRate}%</span>
              <span className="text-muted-foreground/60 px-0.5">×</span>
              <span className="text-muted-foreground tnum">
                <MonetaryValue>${result.avgLoss.toLocaleString()}</MonetaryValue>
              </span>
            </>
          }
          valueDenominator={
            <>
              <span className="text-muted-foreground/70">− </span>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded tnum font-semibold transition-[background-color,color] duration-150",
                  isFeeFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                <MonetaryValue>${safeFee}</MonetaryValue>
              </span>
              <span className="text-muted-foreground/60 px-0.5">−</span>
              <span
                className={cn(
                  "px-0.5 py-0.5 rounded tnum font-semibold transition-[background-color,color] duration-150",
                  isSlipFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                <MonetaryValue>${safeSlip}</MonetaryValue>
              </span>
              <span className="text-muted-foreground/70 text-[10px] ml-1 font-sans">
                (= -<MonetaryValue>${result.totalFriction}</MonetaryValue>)
              </span>
            </>
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                result.realEv >= 0 ? "text-profit" : "text-loss",
              )}
            >
              <MonetaryValue>
                {result.realEv >= 0
                  ? `+$${result.realEv.toLocaleString()}`
                  : `-$${Math.abs(result.realEv).toLocaleString()}`}
              </MonetaryValue>
            </span>
          }
          resultLabel="net / trade"
          resultSecondary={
            <span
              className={cn(
                "text-[10px] sm:text-xs font-mono font-medium tnum",
                result.netRMultiple >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {result.netRMultiple >= 0 ? `+${result.netRMultiple}R` : `${result.netRMultiple}R`} net edge
            </span>
          }
        >
          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Paper gross EV</span>
              <span className="font-mono font-semibold text-foreground tnum">
                <MonetaryValue>
                  {result.paperEv >= 0
                    ? `+$${result.paperEv.toLocaleString()}`
                    : `-$${Math.abs(result.paperEv).toLocaleString()}`}
                </MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Friction per trade</span>
              <span className="font-mono font-semibold text-loss tnum">
                <MonetaryValue>-${result.totalFriction.toLocaleString()}</MonetaryValue>
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Breakeven win rate</span>
              <span className="font-mono font-semibold text-foreground tnum">
                {result.breakevenWinRate}%
              </span>
            </div>
          </div>
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
