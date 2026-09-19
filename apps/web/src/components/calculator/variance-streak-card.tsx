"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormulaHud, type FormulaHudCategory } from "@/components/calculator/shared/formula-hud";
import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";
import { calculateLosingStreakProbability } from "@luxalgo/journal-core";

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
  const [distributionMode, setDistributionMode] = useState<"cumulative" | "exact">("cumulative");
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

  const streaksToEvaluate = [3, 4, 5, 6, 7, 8, 10];
  const streakRows = streaksToEvaluate.map((k) => {
    const probAtLeast = calculateLosingStreakProbability(safeWr, safeSample, k);
    const probAtLeastNext = calculateLosingStreakProbability(safeWr, safeSample, k + 1);
    const exactProb = Number(Math.max(0, probAtLeast - probAtLeastNext).toFixed(1));
    const prob = distributionMode === "cumulative" ? probAtLeast : exactProb;

    return {
      streak: k,
      cumulativeProb: probAtLeast,
      exactProb,
      prob,
    };
  });

  const selectedRow = streakRows.find((r) => r.streak === selectedStreak);
  const displayProb = selectedRow ? selectedRow.prob : streakProb;

  const handleWrChange = (val: number) => {
    setLocalWr(val);
    onChange?.({ winRate: val, sampleTrades: safeSample });
  };

  const handleSampleChange = (val: number) => {
    setLocalSample(val);
    onChange?.({ sampleTrades: val, winRate: safeWr });
  };

  const streakCategory: FormulaHudCategory = {
    label: (
      <span className="inline-flex items-center gap-1">
        Markov Exact
        <CircleHelp className="h-2.5 w-2.5 opacity-70" />
      </span>
    ),
    color: "text-primary",
    border: "border-primary/50",
    bg: "bg-primary/20",
    heading: "Markov Distribution & Gambler's Fallacy",
    advice: `Calculated via finite Markov chain state transitions over ${safeSample} independent trades. With a ${safeWr}% win rate, ${
      distributionMode === "cumulative"
        ? `experiencing ≥${selectedStreak} consecutive losses has an exact probability of ${displayProb}%`
        : `having a maximum losing streak of exactly ${selectedStreak} has a probability of ${displayProb}%`
    }.

Gambler's Fallacy Inoculation: Even after a run of losses, each future trade remains completely independent with exactly ${safeWr}% win probability. Never increase position size to recover losses.`,
  };

  const copyText = `Variance & Streak Analysis: Win Rate: ${safeWr}% | Sample: ${safeSample} trades | Chance of ${
    distributionMode === "cumulative" ? `≥${selectedStreak} consecutive losses` : `max streak of exactly ${selectedStreak} losses`
  }: ${displayProb}% | Fallacy Alert: Each trade is independent (${safeWr}% win prob).`;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
            Variance & Streak Predictor
          </CardTitle>
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
              min="1"
              max="99"
              step="0.5"
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
            <Input
              type="number"
              min="10"
              max="1000"
              step="25"
              className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
          </div>
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <FormulaHud
          title="Streak probability"
          category={streakCategory}
          copyText={copyText}
          theoryNumerator={
            distributionMode === "cumulative"
              ? "P(Losses ≥ k in N)"
              : "P(Max losses = k in N)"
          }
          theoryDenominator="Trade Independence (p)"
          valueNumerator={
            <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap font-mono tnum">
              <span className="text-muted-foreground">
                k {distributionMode === "cumulative" ? "≥" : "="}{" "}
              </span>
              <span className="font-semibold text-foreground">
                {selectedStreak}
              </span>
              <span className="text-muted-foreground/60 px-1 font-sans">·</span>
              <span className="text-muted-foreground">N = </span>
              <span
                className={cn(
                  "font-semibold text-foreground px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                  isSampleFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                {safeSample}
              </span>
            </div>
          }
          valueDenominator={
            <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap font-mono tnum">
              <span className="text-muted-foreground">p = </span>
              <span
                className={cn(
                  "font-semibold text-foreground px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                  isWrFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                )}
              >
                {safeWr}%
              </span>
            </div>
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                displayProb > 60 ? "text-loss" : displayProb > 25 ? "text-amber-500" : "text-profit",
              )}
            >
              {displayProb}%
            </span>
          }
          resultLabel="chance"
          resultSecondary={
            <span className="text-[10px] sm:text-xs font-mono font-medium text-muted-foreground tnum">
              {displayProb > 50 ? "Statistically normal" : "Uncommon streak"}
            </span>
          }
        >
          {/* STREAK DISTRIBUTION BARS (MATCHING EVAL BUDGET & PASS ODDS PATTERN) */}
          <div className="mt-3 border-t border-border/40 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-wider">Streak distribution</span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  ({safeSample} trades)
                </span>
              </div>
              <div className="flex items-center rounded border border-border/70 bg-muted/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setDistributionMode("cumulative")}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
                    distributionMode === "cumulative"
                      ? "bg-accent font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  At least (≥)
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionMode("exact")}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors",
                    distributionMode === "exact"
                      ? "bg-accent font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Exact (=)
                </button>
              </div>
            </div>

            <div className="mt-2 space-y-1 text-xs font-mono tnum">
              {streakRows.map((row) => {
                const isSelected = selectedStreak === row.streak;
                const isDanger = row.prob > 60;
                const isWarning = row.prob > 25;
                const barPercent = Math.min(100, Math.max(0, row.prob));

                const label =
                  distributionMode === "cumulative"
                    ? `≥ ${row.streak} consecutive losses`
                    : `Max streak of exactly ${row.streak} losses`;

                return (
                  <button
                    key={row.streak}
                    type="button"
                    onClick={() => setSelectedStreak(row.streak)}
                    className={cn(
                      "group relative w-full flex items-center justify-between rounded px-2.5 py-1.5 overflow-hidden transition-all text-left active:scale-[0.98]",
                      isSelected
                        ? "bg-accent/70 ring-1 ring-primary/40 shadow-xs"
                        : "hover:bg-muted/40",
                    )}
                  >
                    {/* Translucent Data Bar */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none rounded",
                        isDanger
                          ? "bg-loss/15"
                          : isWarning
                            ? "bg-amber-500/15"
                            : "bg-muted-foreground/15",
                      )}
                      style={{ width: `${barPercent}%` }}
                    />

                    {/* Left label with dot */}
                    <div className="relative z-10 flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          isDanger
                            ? "bg-loss"
                            : isWarning
                              ? "bg-amber-500"
                              : "bg-muted-foreground/60",
                        )}
                      />
                      <span
                        className={cn(
                          "truncate text-xs",
                          isSelected ? "text-foreground font-semibold" : "text-foreground font-medium",
                        )}
                      >
                        {label}
                      </span>
                    </div>

                    {/* Right probability */}
                    <span
                      className={cn(
                        "relative z-10 shrink-0 font-semibold ml-2 font-mono tnum",
                        isDanger
                          ? "text-loss"
                          : isWarning
                            ? "text-amber-500"
                            : "text-muted-foreground",
                      )}
                    >
                      {row.prob.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
