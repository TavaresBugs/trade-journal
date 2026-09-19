"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoverHint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MATRIX_RR_RATIOS,
  MATRIX_WIN_RATES,
  calculateBreakevenWinRate,
  generateSweetSpotMatrix,
} from "@luxalgo/journal-core";

interface SweetSpotMatrixCardProps {
  winRate?: number;
  riskReward?: number;
  onSelect?: (winRate: number, riskReward: number) => void;
}

export function SweetSpotMatrixCard({
  winRate = 45,
  riskReward = 2.5,
  onSelect,
}: SweetSpotMatrixCardProps) {
  const [selectedWr, setSelectedWr] = useState(winRate);
  const [selectedRr, setSelectedRr] = useState(riskReward);
  const [copied, setCopied] = useState(false);

  const matrix = generateSweetSpotMatrix();
  const beRate = calculateBreakevenWinRate(selectedRr);
  const p = selectedWr / 100;
  const q = 1 - p;
  const currentRMultiple = Number((p * selectedRr - q).toFixed(2));
  const isSweetSpot = selectedRr >= 2.0 && selectedRr <= 5.0 && selectedWr >= 35 && selectedWr <= 50;
  const isProfitable = selectedWr > beRate;

  const handleCellClick = (wr: number, rr: number) => {
    setSelectedWr(wr);
    setSelectedRr(rr);
    onSelect?.(wr, rr);
  };

  const handleCopy = async () => {
    const text = `System Matrix: Win Rate: ${selectedWr}% | RR: 1:${selectedRr} | Expectancy: ${currentRMultiple >= 0 ? "+" : ""}${currentRMultiple}R/trade | Breakeven Win Rate: ${beRate}% | Status: ${isSweetSpot ? "Sweet Spot" : isProfitable ? "Profitable" : "Negative Edge"}`;
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
              System Design & Sweet Spot Matrix
            </CardTitle>
            <span className="h-5 inline-flex items-center justify-center rounded border border-border/70 bg-muted/60 px-1.5 pt-[1px] font-mono text-[10px] font-medium leading-none text-muted-foreground">
              Video Charts 1 & 4
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Risk:Reward vs Win Rate matrix. Highlighted cells represent the realistic sweet spot (2R–5R with 35%–50% win rate).
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* MATRIX HEATMAP */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[480px]">
              {/* HEADER ROW: RR RATIOS */}
              <div className="flex items-center text-center text-[10px] font-mono text-muted-foreground pb-1 border-b border-border/60">
                <div className="w-14 text-left font-semibold uppercase tracking-wider">Win %</div>
                {MATRIX_RR_RATIOS.map((rr) => (
                  <div key={rr} className="flex-1 font-semibold">
                    1:{rr}R
                  </div>
                ))}
              </div>

              {/* ROWS: WIN RATES */}
              <div className="space-y-1 pt-1">
                {matrix.map((row) => {
                  const wr = row[0]!.winRate;
                  return (
                    <div key={wr} className="flex items-center text-center">
                      <div className="w-14 text-left font-mono text-[11px] font-medium text-foreground">
                        {wr}%
                      </div>
                      {row.map((cell) => {
                        const isSelected = selectedWr === cell.winRate && selectedRr === cell.riskReward;
                        const r = cell.rMultiple;

                        // Color styles
                        let bgStyle = "bg-loss/10 text-loss/80 hover:bg-loss/20";
                        if (cell.isSweetSpot) {
                          bgStyle = "bg-primary/20 text-primary font-semibold hover:bg-primary/30 ring-1 ring-primary/50";
                        } else if (r > 0.6) {
                          bgStyle = "bg-profit/25 text-profit font-semibold hover:bg-profit/35";
                        } else if (r > 0) {
                          bgStyle = "bg-profit/10 text-profit hover:bg-profit/20";
                        } else if (cell.isBreakeven) {
                          bgStyle = "bg-muted text-muted-foreground hover:bg-muted/80";
                        }

                        return (
                          <button
                            key={cell.riskReward}
                            type="button"
                            onClick={() => handleCellClick(cell.winRate, cell.riskReward)}
                            title={`Win Rate: ${cell.winRate}%, RR: ${cell.riskReward}R -> Expectancy: ${r >= 0 ? "+" : ""}${r}R per trade`}
                            className={cn(
                              "flex-1 h-6 mx-0.5 rounded flex items-center justify-center font-mono text-[10px] transition-all relative tnum",
                              bgStyle,
                              isSelected && "ring-2 ring-foreground font-bold shadow-sm z-10",
                            )}
                          >
                            {r >= 0 ? `+${r}` : `${r}`}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEGEND ROW */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/40 ring-1 ring-primary/60 inline-block" />
                <span className="font-medium text-foreground">Sweet Spot (2R–5R, 35–50%)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-profit/25 inline-block" />
                <span>Profitable</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-loss/15 inline-block" />
                <span>Negative</span>
              </span>
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
                Selected system edge
              </span>
              <span
                className={cn(
                  "h-4 inline-flex items-center rounded border px-1 font-mono text-[9px] font-semibold",
                  isSweetSpot
                    ? "border-primary/50 bg-primary/20 text-primary"
                    : isProfitable
                      ? "border-profit/40 bg-profit/10 text-profit"
                      : "border-loss/40 bg-loss/10 text-loss",
                )}
              >
                {isSweetSpot ? "Sweet Spot" : isProfitable ? "Profitable" : "Negative Edge"}
              </span>
            </div>
            <HoverHint content="Copy system metrics to clipboard">
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
                (Win% × RR) − Loss%
              </span>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <span className="text-[10px] sm:text-[11px] font-serif italic text-muted-foreground px-1 pt-0.5 tracking-wide whitespace-nowrap">
                Breakeven = 1 / (1 + RR)
              </span>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 2 (CENTER): LIVE COMPLEX DATA */}
            <div className="inline-flex flex-col items-center text-center font-mono shrink-0">
              <div className="text-[11px] sm:text-xs font-medium tracking-tight px-1 pb-0.5 whitespace-nowrap">
                <span className="font-semibold text-foreground tnum">{selectedWr}%</span>
                <span className="text-muted-foreground/60 px-0.5">×</span>
                <span className="font-semibold text-foreground tnum">{selectedRr}R</span>
                <span className="text-muted-foreground/60 px-0.5">−</span>
                <span className="font-semibold text-muted-foreground tnum">{100 - selectedWr}%</span>
              </div>
              <span className="w-full border-b border-foreground/30 my-0.5" />
              <div className="text-[10px] sm:text-xs px-1 pt-0.5 whitespace-nowrap">
                <span className="text-muted-foreground/70">BE: </span>
                <span className="font-semibold text-foreground tnum">{beRate}%</span>
                <span
                  className={cn(
                    "text-[10px] ml-1 font-semibold tnum",
                    selectedWr >= beRate ? "text-profit" : "text-loss",
                  )}
                >
                  ({selectedWr >= beRate ? "+" : ""}
                  {(selectedWr - beRate).toFixed(1)}% buffer)
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/50 text-sm font-sans font-light shrink-0">=</span>

            {/* STEP 3 (RIGHT): DIRECT ACTIONABLE RESULT */}
            <div className="flex flex-col justify-center text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                    currentRMultiple >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {currentRMultiple >= 0 ? `+${currentRMultiple}` : currentRMultiple}R
                </span>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  / trade
                </span>
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs font-mono font-medium tnum",
                  isSweetSpot ? "text-primary font-semibold" : isProfitable ? "text-profit" : "text-loss",
                )}
              >
                {isSweetSpot ? "Sweet Spot" : isProfitable ? "Positive Edge" : "Negative Edge"}
              </span>
            </div>
          </div>

          {/* 3-COLUMN METRICS BREAKDOWN */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-muted-foreground">Breakeven rate</span>
              <span className="font-mono font-semibold text-foreground tnum">{beRate}%</span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Edge buffer</span>
              <span
                className={cn(
                  "font-mono font-semibold tnum",
                  selectedWr >= beRate ? "text-profit" : "text-loss",
                )}
              >
                {selectedWr >= beRate ? "+" : ""}
                {(selectedWr - beRate).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">Realistic status</span>
              <span className="font-mono font-semibold text-foreground">
                {isSweetSpot ? "Sweet Spot" : selectedRr >= 6.0 ? "Hard to execute" : "Valid edge"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
