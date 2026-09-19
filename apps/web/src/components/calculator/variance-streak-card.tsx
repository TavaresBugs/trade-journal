"use client";

import { useState } from "react";
import { AlertCircle, Copy, Check, ShieldAlert, Dice5 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
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
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    const text = `Variance & Streak Analysis: Win Rate: ${safeWr}% | Sample: ${safeSample} trades | Chance of ≥${selectedStreak} consecutive losses: ${streakProb}% | Fallacy Alert: Each trade is independent (${safeWr}% win prob).`;
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
                  "flex-1 rounded-md border py-1 font-mono text-[11px] transition-all",
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
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5">
          {/* HEADER ROW */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Streak probability
              </span>
              <span className="h-4 inline-flex items-center rounded border border-border/60 bg-background/60 px-1 font-mono text-[9px] text-muted-foreground">
                Markov Exact
              </span>
            </div>
            <HoverHint content="Copy variance metrics to clipboard">
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
                P(Losses ≥ k in N)
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                Trade Independence (p)
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span className="text-muted-foreground/70">P(streak ≥ </span>
                <span className="font-semibold text-loss tnum">{selectedStreak}</span>
                <span className="text-muted-foreground/70"> in </span>
                <span className="font-semibold text-foreground tnum">{safeSample}</span>
                <span className="text-muted-foreground/70">)</span>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span className="text-muted-foreground/70">Next trade: </span>
                <span className="font-semibold text-foreground tnum">{safeWr}% win</span>
                <span className="text-muted-foreground/70 text-[10px] ml-1 font-sans">(Coin flip)</span>
              </div>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 3 (RIGHT): DIRECT ACTIONABLE RESULT */}
            <div className="flex flex-col justify-center text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-foreground tnum">
                  {streakProb}%
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  chance
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-mono font-medium text-muted-foreground tnum">
                {streakProb > 50 ? "Statistically normal" : "Uncommon streak"}
              </span>
            </div>
          </div>

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
                  <div
                    key={item.streak}
                    onClick={() => setSelectedStreak(item.streak)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1 text-xs font-mono transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary/10 ring-1 ring-primary/40 font-semibold"
                        : "hover:bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <span className="w-20 text-foreground">≥ {item.streak} losses</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden mx-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          item.probability > 60
                            ? "bg-amber-500"
                            : item.probability > 25
                              ? "bg-primary"
                              : "bg-muted-foreground/50",
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-20 text-right">
                      <span className="tnum font-bold text-foreground">{item.probability}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GAMBLER'S FALLACY NOTICE */}
            <div className="mt-2 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground border border-border/50">
              <span className="font-semibold text-foreground">Gambler&apos;s Fallacy Inoculation: </span>
              Even after a run of losses, each future trade remains completely independent with exactly {safeWr}% win probability. Never increase position size to recover losses.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
