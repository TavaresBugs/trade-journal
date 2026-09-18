"use client";

import React, { useMemo, useState } from "react";
import {
  calculateExpectedValue,
  runReturnsSimulation,
  getBinomialDistribution,
  NQ_DOLLARS_PER_POINT,
  type SimulationOutcome,
} from "@/lib/quant-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptionSelect } from "@/components/ui/option-select";
import { cn } from "@/lib/utils";

const INSTRUMENTS = [
  { id: "NQ", name: "NQ ($20/pt)", multiplier: 20 },
  { id: "MNQ", name: "MNQ ($2/pt)", multiplier: 2 },
  { id: "ES", name: "ES ($50/pt)", multiplier: 50 },
  { id: "MES", name: "MES ($5/pt)", multiplier: 5 },
] as const;

export function QuantCalculator() {
  // 1. EV Calculator State
  const [evAvgPayout, setEvAvgPayout] = useState<number>(2000);
  const [evPayoutChance, setEvPayoutChance] = useState<number>(40);
  const [evCost, setEvCost] = useState<number>(89);
  const [evPassRate, setEvPassRate] = useState<number>(40);

  const evResult = useMemo(() => {
    return calculateExpectedValue(evCost, evPassRate, evPayoutChance, evAvgPayout);
  }, [evCost, evPassRate, evPayoutChance, evAvgPayout]);

  // 2. Points / Contracts Calculator State
  const [selectedInstrument, setSelectedInstrument] = useState<string>("NQ");
  const multiplier = useMemo(() => {
    return INSTRUMENTS.find((i) => i.id === selectedInstrument)?.multiplier ?? NQ_DOLLARS_PER_POINT;
  }, [selectedInstrument]);

  const [points, setPoints] = useState<number>(8);
  const [contracts, setContracts] = useState<number>(10);
  const [dollars, setDollars] = useState<number>(1600);

  const handlePointsChange = (pts: number) => {
    setPoints(pts);
    setDollars(Math.round(pts * contracts * multiplier));
  };

  const handleContractsChange = (cts: number) => {
    setContracts(cts);
    setDollars(Math.round(points * cts * multiplier));
  };

  const handleDollarsChange = (dlrs: number) => {
    setDollars(dlrs);
    if (contracts > 0 && multiplier > 0) {
      setPoints(Number((dlrs / (contracts * multiplier)).toFixed(2)));
    }
  };

  const handleInstrumentChange = (instId: string) => {
    setSelectedInstrument(instId);
    const newMult = INSTRUMENTS.find((i) => i.id === instId)?.multiplier ?? 20;
    setDollars(Math.round(points * contracts * newMult));
  };

  // 3. Returns Simulator State
  const [simBankroll, setSimBankroll] = useState<number>(500);
  const [simEvalCost, setSimEvalCost] = useState<number>(89);
  const [simPassRate, setSimPassRate] = useState<number>(40);
  const [simPayoutChance, setSimPayoutChance] = useState<number>(40);
  const [simAvgPayout, setSimAvgPayout] = useState<number>(2000);

  const [simResults, setSimResults] = useState<{
    avgPayout: number;
    avgNetProfit: number;
    outcomes: SimulationOutcome[];
  }>({
    avgPayout: 713,
    avgNetProfit: 213,
    outcomes: [
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: true,
        fundedPassed: true,
        payoutAmount: 2000,
        netPnl: 1911,
        description: "Eval passed, funded passed, payout $2,000",
      },
      {
        passed: true,
        fundedPassed: true,
        payoutAmount: 2000,
        netPnl: 1911,
        description: "Eval passed, funded passed, payout $2,000",
      },
      {
        passed: true,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval passed, funded failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
      {
        passed: false,
        fundedPassed: false,
        payoutAmount: 0,
        netPnl: -89,
        description: "Eval failed",
      },
    ],
  });

  const handleRunSimulation = () => {
    const res = runReturnsSimulation(
      simBankroll,
      simEvalCost,
      simPassRate,
      simPayoutChance,
      simAvgPayout,
    );
    setSimResults({
      avgPayout: res.avgPayoutResult,
      avgNetProfit: res.avgNetProfit,
      outcomes: res.sampleOutcomes,
    });
  };

  // 4. Eval Budget & Pass Odds State
  const [budgetFirm, setBudgetFirm] = useState<string>("Topstep 50K");
  const [budgetPassRate, setBudgetPassRate] = useState<number>(40);
  const [budgetBankroll, setBudgetBankroll] = useState<number>(500);
  const [budgetFirmCost, setBudgetFirmCost] = useState<number>(89);

  const budgetEvalCount = Math.max(1, Math.floor(budgetBankroll / (budgetFirmCost || 1)));

  const binomialData = useMemo(() => {
    return getBinomialDistribution(budgetEvalCount, budgetPassRate);
  }, [budgetEvalCount, budgetPassRate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Calculators</h2>
        <p className="text-xs text-muted-foreground">
          EV, NQ points to dollars, risk of ruin, and bankroll sizing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CARD 1: EV CALCULATOR */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
                EV Calculator
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Expected value per eval: (pass rate × payout chance × avg payout) - eval cost.
              </p>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Average payout ($)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={evAvgPayout}
                  onChange={(e) => setEvAvgPayout(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Payout chance (%)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={evPayoutChance}
                  onChange={(e) => setEvPayoutChance(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Eval cost ($)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={evCost}
                  onChange={(e) => setEvCost(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Eval pass rate (%)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={evPassRate}
                  onChange={(e) => setEvPassRate(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </div>

          <CardContent className="border-t border-border/70 pt-4">
            <div
              className={cn(
                "text-lg font-bold tracking-tight",
                evResult >= 0 ? "text-profit" : "text-loss",
              )}
            >
              EV per eval:{" "}
              {evResult >= 0 ? `$${evResult.toFixed(2)}` : `-$${Math.abs(evResult).toFixed(2)}`}
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: NQ POINTS CALCULATOR */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
                  NQ Points · Contracts · $
                </CardTitle>
                <div className="w-36">
                  <OptionSelect
                    value={selectedInstrument}
                    onValueChange={handleInstrumentChange}
                    className="h-7 text-xs"
                  >
                    {INSTRUMENTS.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </OptionSelect>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ${multiplier} per point per contract. Enter any two; the third updates.
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
                    step="0.25"
                    className="text-center font-mono"
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
                    className="text-center font-mono"
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
                    className="text-center font-mono"
                    value={dollars}
                    onChange={(e) => handleDollarsChange(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Instrument tick value:</span>
                  <span className="font-mono font-medium text-foreground">
                    0.25 pts = ${(multiplier * 0.25).toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>1 full point (1.00):</span>
                  <span className="font-mono font-medium text-foreground">
                    ${multiplier.toFixed(2)} / contract
                  </span>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* CARD 3: RETURNS SIMULATOR */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
                Returns Simulator
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Simulate 1,000 eval attempts: pass rate, then payout chance and average payout if
                funded. See average return and sample outcomes.
              </p>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bankroll / amount ($)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={simBankroll}
                  onChange={(e) => setSimBankroll(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Firm (eval cost)
                </label>
                <div className="w-48">
                  <OptionSelect
                    value={String(simEvalCost)}
                    onValueChange={(val) => setSimEvalCost(Number(val))}
                    className="h-8 text-xs"
                  >
                    <option value="89">Topstep 50K ($89)</option>
                    <option value="49">Topstep 50K Promo ($49)</option>
                    <option value="70">Lucid Flex 25K ($70)</option>
                    <option value="65">Tradeify 25K ($65)</option>
                    <option value="35">Apex 50K ($35)</option>
                    <option value="75">MFFU 50K ($75)</option>
                  </OptionSelect>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pass rate (%)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={simPassRate}
                  onChange={(e) => setSimPassRate(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Payout chance (%)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={simPayoutChance}
                  onChange={(e) => setSimPayoutChance(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Average payout ($)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={simAvgPayout}
                  onChange={(e) => setSimAvgPayout(Number(e.target.value))}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full bg-brand font-medium text-white shadow-sm hover:opacity-95"
                  onClick={handleRunSimulation}
                >
                  Simulate returns
                </Button>
              </div>
            </CardContent>
          </div>

          <CardContent className="border-t border-border/70 pt-4">
            <div className="text-sm font-bold text-foreground">
              Average payout ${simResults.avgPayout.toLocaleString("en-US")} on your $
              {simBankroll.toLocaleString("en-US")} investment.
            </div>
            <div className="text-xs text-muted-foreground">
              Plus $2,000 of profit remaining in funded account.
            </div>

            <div className="mt-3 text-xs font-medium text-muted-foreground">Last 10 outcomes:</div>
            <div className="mt-2 space-y-1.5 text-xs font-mono">
              {simResults.outcomes.map((out, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-border/30 pb-1"
                >
                  <span
                    className={
                      out.fundedPassed
                        ? "text-foreground font-sans"
                        : "text-muted-foreground font-sans"
                    }
                  >
                    {out.description}
                  </span>
                  <span
                    className={cn("font-semibold", out.netPnl >= 0 ? "text-profit" : "text-loss")}
                  >
                    {out.netPnl >= 0
                      ? `+$${out.netPnl.toLocaleString("en-US")}`
                      : `-$${Math.abs(out.netPnl).toLocaleString("en-US")}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: EVAL BUDGET & PASS ODDS */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
                Eval Budget & Pass Odds
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Budget + odds. How many evals you can afford, and your chance of passing 1, 2, 3...
                in a row (same pass rate each time).
              </p>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Prop firm challenge
                </label>
                <div className="w-56">
                  <OptionSelect
                    value={budgetFirm}
                    onValueChange={(val) => {
                      setBudgetFirm(val);
                      if (val.includes("Topstep")) {
                        setBudgetFirmCost(89);
                        setBudgetPassRate(40);
                      } else if (val.includes("Lucid")) {
                        setBudgetFirmCost(70);
                        setBudgetPassRate(45);
                      } else if (val.includes("Apex")) {
                        setBudgetFirmCost(35);
                        setBudgetPassRate(35);
                      } else if (val.includes("Tradeify")) {
                        setBudgetFirmCost(65);
                        setBudgetPassRate(48);
                      }
                    }}
                    className="h-8 text-xs"
                  >
                    <option value="Topstep 50K">Topstep 50K (40% pass)</option>
                    <option value="Lucid Flex 25K">Lucid Flex 25K (45% pass)</option>
                    <option value="Apex 50K">Apex 50K (35% pass)</option>
                    <option value="Tradeify 25K">Tradeify 25K (48% pass)</option>
                  </OptionSelect>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Your pass rate (%)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={budgetPassRate}
                  onChange={(e) => setBudgetPassRate(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Bankroll ($)
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono"
                  value={budgetBankroll}
                  onChange={(e) => setBudgetBankroll(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Show evals up to
                </label>
                <Input
                  type="number"
                  className="w-32 text-right font-mono bg-muted/40 cursor-not-allowed opacity-75"
                  value={budgetEvalCount}
                  disabled
                />
              </div>
            </CardContent>
          </div>

          <CardContent className="border-t border-border/70 pt-4 space-y-2.5">
            <div className="text-xs text-muted-foreground">
              With ${budgetBankroll.toLocaleString("en-US")} you can afford ~{budgetEvalCount} evals
              at this firm.
            </div>
            <div className="text-sm font-semibold text-brand">
              Chance you pass at least one of those: {binomialData.atLeastOne}%
            </div>
            <div className="text-[11px] text-muted-foreground">
              Chance of 0 (fail all) is the same as risk of ruin for evals.
            </div>

            <div className="pt-2 text-xs font-semibold text-foreground">
              In {budgetEvalCount} attempts: chance you pass exactly 0, 1, ... {budgetEvalCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Binomial: each row is P(exactly that many passes in {budgetEvalCount} tries). Adds to
              100%.
            </div>

            <div className="mt-2 space-y-1.5 text-xs font-mono">
              {binomialData.rows.map((row) => (
                <div
                  key={row.passes}
                  className="flex items-center justify-between border-b border-border/30 pb-1"
                >
                  <span
                    className={cn(
                      "font-sans",
                      row.passes === 0 ? "text-loss font-medium" : "text-foreground",
                    )}
                  >
                    {row.passes === 0 ? "Exactly 0 (fail all)" : `Exactly ${row.passes}`}
                  </span>
                  <span
                    className={cn("font-semibold", row.passes === 0 ? "text-loss" : "text-profit")}
                  >
                    {row.probability.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
