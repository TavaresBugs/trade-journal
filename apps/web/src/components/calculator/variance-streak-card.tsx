"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormulaHud, type FormulaHudCategory } from "@/components/calculator/shared/formula-hud";
import { cn } from "@/lib/utils";
import {
  calculateLosingStreakProbability,
  generateStreakDistribution,
} from "@luxalgo/journal-core";

interface VarianceStreakCardProps {
  winRate?: number;
  sampleTrades?: number;
  onChange?: (patch: { winRate?: number; sampleTrades?: number }) => void;
}

export function VarianceStreakCard({
  winRate = 45,
  sampleTrades = 100,
  onChange,
}: VarianceStreakCardProps) {
  const [localWr, setLocalWr] = useState(winRate);
  const [localSample, setLocalSample] = useState(sampleTrades);
  const [selectedStreak, setSelectedStreak] = useState(6);
  const [isWrFocused, setIsWrFocused] = useState(false);
  const [isSampleFocused, setIsSampleFocused] = useState(false);

  useEffect(() => {
    if (winRate !== undefined) {
      setLocalWr(winRate);
    }
  }, [winRate]);

  useEffect(() => {
    if (sampleTrades !== undefined) {
      setLocalSample(sampleTrades);
    }
  }, [sampleTrades]);

  const safeWr = Math.max(1, Math.min(99, localWr || 45));
  const safeSample = Math.max(10, Math.min(1000, localSample || 100));

  const streakProb = calculateLosingStreakProbability(safeWr, safeSample, selectedStreak);
  const streakDistribution = generateStreakDistribution(safeWr, safeSample, [3, 4, 5, 6, 7, 8, 10]);

  const handleWrChange = (val: number) => {
    setLocalWr(val);
    onChange?.({ winRate: val, sampleTrades: safeSample });
  };

  const handleSampleChange = (val: number) => {
    setLocalSample(val);
    onChange?.({ sampleTrades: val, winRate: safeWr });
  };

  const streakCategory: FormulaHudCategory = {
    label: "Markov Exact",
    color: "text-primary",
    border: "border-primary/50",
    bg: "bg-primary/20",
    heading: "Markov Chain Streak Distribution",
    advice: `Calculated via finite Markov chain state transitions over ${safeSample} independent trades. With a ${safeWr}% win rate, experiencing ≥${selectedStreak} consecutive losses has an exact probability of ${streakProb}%.`,
  };

  const copyText = `Variance & Streak Analysis: Win Rate: ${safeWr}% | Sample: ${safeSample} trades | Chance of ≥${selectedStreak} consecutive losses: ${streakProb}% | Fallacy Alert: Each trade is independent (${safeWr}% win prob).`;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Variance & Streak Predictor
            </CardTitle>
            <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
              Video Charts 2 & 3
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculate the exact statistical probability of consecutive losing streaks and inoculate against the Gambler&apos;s Fallacy.
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
              onChange={(e) => handleWrChange(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          {/* 2º: SAMPLE SIZE (TRADES) */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sample size (trades)
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="25"
                className="h-9 w-24 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={localSample || ""}
                placeholder="100"
                onFocus={() => setIsSampleFocused(true)}
                onBlur={() => setIsSampleFocused(false)}
                onChange={(e) => handleSampleChange(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <span className="text-xs font-mono text-muted-foreground">trades</span>
            </div>
          </div>

          {/* QUICK SAMPLE PRESETS */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {[50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSampleChange(preset)}
                className={cn(
                  "flex-1 rounded-md border py-1 font-mono text-[11px] transition-all active:scale-[0.98]",
                  safeSample === preset
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {preset} trades
              </button>
            ))}
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <FormulaHud
          title="Streak probability"
          category={streakCategory}
          copyText={copyText}
          theoryNumerator="P(Losses ≥ k in N)"
          theoryDenominator="Trade Independence (p)"
          valueNumerator={
            <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
              <span className="text-muted-foreground/70">P(streak ≥ </span>
              <span className="font-semibold text-loss tnum">{selectedStreak}</span>
              <span className="text-muted-foreground/70"> in </span>
              <span
                className={cn(
                  "font-semibold text-foreground tnum px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                  isSampleFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                {safeSample}
              </span>
              <span className="text-muted-foreground/70">)</span>
            </div>
          }
          valueDenominator={
            <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
              <span className="text-muted-foreground/70">Next trade: </span>
              <span
                className={cn(
                  "font-semibold text-foreground tnum px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                  isWrFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                {safeWr}% win
              </span>
              <span className="text-muted-foreground/70 text-[10px] ml-1 font-sans">(Coin flip)</span>
            </div>
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                streakProb > 60 ? "text-loss" : streakProb > 30 ? "text-amber-500" : "text-profit",
              )}
            >
              {streakProb}%
            </span>
          }
          resultLabel="chance"
          resultSecondary={
            <span className="text-[10px] sm:text-xs font-mono font-medium text-muted-foreground tnum">
              {streakProb > 50 ? "Statistically normal" : "Uncommon streak"}
            </span>
          }
        >
          {/* STREAK DISTRIBUTION BARS */}
          <div className="mt-3 border-t border-border/40 pt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Consecutive loss probability (in {safeSample} trades):</span>
              <span className="text-[10px]">Click to inspect</span>
            </div>
            <div className="space-y-1">
              {streakDistribution.map((item) => {
                const isSelected = selectedStreak === item.streak;
                const barWidth = Math.max(4, Math.min(100, item.probability));

                return (
                  <button
                    key={item.streak}
                    type="button"
                    onClick={() => setSelectedStreak(item.streak)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded px-2 py-1 text-xs font-mono transition-all text-left active:scale-[0.98]",
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/40 font-semibold"
                        : "hover:bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <span className="w-20 text-foreground shrink-0">≥ {item.streak} losses</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden mx-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          item.probability > 60
                            ? "bg-loss"
                            : item.probability > 25
                              ? "bg-amber-500"
                              : "bg-muted-foreground/50",
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-16 text-right shrink-0">
                      <span className="tnum font-bold text-foreground">{item.probability}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* GAMBLER'S FALLACY NOTICE */}
            <div className="mt-2 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground border border-border/50">
              <span className="font-semibold text-foreground">Gambler&apos;s Fallacy Inoculation: </span>
              Even after a run of losses, each future trade remains completely independent with exactly {safeWr}% win probability. Never increase position size to recover losses.
            </div>
          </div>
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
