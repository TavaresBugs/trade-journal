"use client";

import { useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaHud, type FormulaHudCategory } from "@/components/calculator/shared/formula-hud";
import { cn } from "@/lib/utils";
import {
  MATRIX_RR_RATIOS,
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

  useEffect(() => {
    if (winRate !== undefined) {
      setSelectedWr(winRate);
    }
  }, [winRate]);

  useEffect(() => {
    if (riskReward !== undefined) {
      setSelectedRr(riskReward);
    }
  }, [riskReward]);

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

  const hudCategory: FormulaHudCategory = isSweetSpot
    ? {
        label: "Sweet Spot",
        color: "text-primary",
        border: "border-primary/50",
        bg: "bg-primary/20",
        heading: "Realistic Sweet Spot (2R–5R, 35%–50%)",
        advice:
          "2R–5R with 35%–50% win rate represents the realistic zone: sustainable psychology, high resilience against drawdown variance, and strong positive mathematical expectancy.",
      }
    : isProfitable
      ? {
          label: "Profitable",
          color: "text-profit",
          border: "border-profit/40",
          bg: "bg-profit/10",
          heading: "Positive Expectancy System",
          advice:
            "System maintains positive statistical expectancy. Verify execution friction (fees & slippage) does not erode profitability.",
        }
      : {
          label: "Negative Edge",
          color: "text-loss",
          border: "border-loss/40",
          bg: "bg-loss/10",
          heading: "Negative Edge System",
          advice:
            "The current win rate is below the breakeven threshold for this risk-to-reward ratio. Every trade loses capital on average.",
        };

  const copyText = `System Matrix: Win Rate: ${selectedWr}% | RR: 1:${selectedRr} | Expectancy: ${currentRMultiple >= 0 ? "+" : ""}${currentRMultiple}R/trade | Breakeven Win Rate: ${beRate}% | Status: ${hudCategory.label}`;

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
          {/* MATRIX HEATMAP MOSAIC */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[500px]">
              {/* HEADER ROW: RR RATIOS */}
              <div className="grid grid-cols-[52px_repeat(9,1fr)] gap-[1px] mb-[1px] text-center text-[10px] font-mono text-muted-foreground">
                <div className="flex items-center justify-start pl-1.5 font-semibold uppercase tracking-wider">
                  Win %
                </div>
                {MATRIX_RR_RATIOS.map((rr) => (
                  <div key={rr} className="py-1 font-semibold">
                    1:{rr}R
                  </div>
                ))}
              </div>

              {/* CONTIGUOUS HEATMAP GRID */}
              <div className="grid grid-cols-[52px_repeat(9,1fr)] gap-[1px] bg-border/40 p-[1px] rounded-lg overflow-hidden">
                {matrix.map((row) => {
                  const wr = row[0]!.winRate;
                  return (
                    <Fragment key={wr}>
                      {/* ROW HEADER: WIN % */}
                      <div className="flex items-center justify-start pl-1.5 font-mono text-[11px] font-medium text-foreground bg-muted/30">
                        {wr}%
                      </div>

                      {/* TILES */}
                      {row.map((cell) => {
                        const isSelected = selectedWr === cell.winRate && selectedRr === cell.riskReward;
                        const r = cell.rMultiple;

                        // Continuous Heatmap Gradient
                        let cellStyle = "bg-loss/10 text-loss/80 hover:bg-loss/20";
                        if (cell.isSweetSpot) {
                          if (r > 0.8) {
                            cellStyle = "bg-primary/30 text-primary font-bold hover:bg-primary/40";
                          } else if (r > 0.4) {
                            cellStyle = "bg-primary/22 text-primary font-semibold hover:bg-primary/30";
                          } else {
                            cellStyle = "bg-primary/15 text-primary font-medium hover:bg-primary/25";
                          }
                        } else if (r > 1.5) {
                          cellStyle = "bg-profit/35 text-profit font-bold hover:bg-profit/45";
                        } else if (r > 0.8) {
                          cellStyle = "bg-profit/25 text-profit font-semibold hover:bg-profit/35";
                        } else if (r > 0.4) {
                          cellStyle = "bg-profit/18 text-profit font-medium hover:bg-profit/28";
                        } else if (r > 0) {
                          cellStyle = "bg-profit/10 text-profit/90 hover:bg-profit/20";
                        } else if (cell.isBreakeven) {
                          cellStyle = "bg-muted/40 text-muted-foreground hover:bg-muted/70";
                        } else if (r < -0.3) {
                          cellStyle = "bg-loss/20 text-loss font-medium hover:bg-loss/30";
                        }

                        // Saturated styling ONLY for the selected cell, in the same hue as its internal text
                        if (isSelected) {
                          if (cell.isSweetSpot) {
                            cellStyle = "bg-primary text-primary-foreground font-bold shadow-md ring-1 ring-white/30 z-10 scale-[1.04]";
                          } else if (r > 0) {
                            cellStyle = "bg-profit text-white font-bold shadow-md ring-1 ring-white/30 z-10 scale-[1.04]";
                          } else if (r < 0) {
                            cellStyle = "bg-loss text-white font-bold shadow-md ring-1 ring-white/30 z-10 scale-[1.04]";
                          } else {
                            cellStyle = "bg-muted-foreground text-background font-bold shadow-md z-10 scale-[1.04]";
                          }
                        }

                        return (
                          <button
                            key={cell.riskReward}
                            type="button"
                            onClick={() => handleCellClick(cell.winRate, cell.riskReward)}
                            title={`Win Rate: ${cell.winRate}%, RR: ${cell.riskReward}R -> Expectancy: ${r >= 0 ? "+" : ""}${r}R per trade`}
                            className={cn(
                              "h-8 sm:h-8.5 flex items-center justify-center font-mono text-[10px] sm:text-[11px] transition-all relative tnum select-none",
                              cellStyle,
                            )}
                          >
                            {r >= 0 ? `+${r}` : `${r}`}
                          </button>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEGEND ROW */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/30 inline-block" />
                <span className="font-medium text-foreground">Sweet Spot (2R–5R, 35–50%)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-profit/20 inline-block" />
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
        <FormulaHud
          title="Selected system edge"
          category={hudCategory}
          copyText={copyText}
          theoryNumerator="(Win% × RR) − Loss%"
          theoryDenominator="Breakeven = 1 / (1 + RR)"
          valueNumerator={
            <>
              <span className="font-semibold text-foreground tnum">{selectedWr}%</span>
              <span className="text-muted-foreground/60 px-0.5">×</span>
              <span className="font-semibold text-foreground tnum">{selectedRr}R</span>
              <span className="text-muted-foreground/60 px-0.5">−</span>
              <span className="font-semibold text-muted-foreground tnum">{100 - selectedWr}%</span>
            </>
          }
          valueDenominator={
            <>
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
            </>
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                currentRMultiple >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {currentRMultiple >= 0 ? `+${currentRMultiple}` : currentRMultiple}R
            </span>
          }
          resultLabel="/ trade"
          resultSecondary={
            <span
              className={cn(
                "text-[10px] sm:text-xs font-mono font-medium tnum",
                isSweetSpot ? "text-primary font-semibold" : isProfitable ? "text-profit" : "text-loss",
              )}
            >
              {isSweetSpot ? "Sweet Spot" : isProfitable ? "Positive Edge" : "Negative Edge"}
            </span>
          }
        >
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
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
