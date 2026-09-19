"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import {
  calculateDrawdown50Probability,
  calculateFundedSurvival,
  STANDARD_RISK_SURVIVAL_TABLE,
  type AccountSurvivalMode,
} from "@luxalgo/journal-core";
import {
  AccountModeToggle,
  UnitToggle,
  FormulaHud,
  ScenarioRuler,
  type ScenarioItem,
} from "./shared";

interface CapitalSurvivalCardProps {
  balance?: number;
  riskPercent?: number;
  initialMode?: AccountSurvivalMode;
  mode?: AccountSurvivalMode;
  onModeChange?: (mode: AccountSurvivalMode) => void;
  onChange?: (patch: {
    riskPercent?: number;
    balance?: number;
    mode?: AccountSurvivalMode;
  }) => void;
}

export function CapitalSurvivalCard({
  balance = 50000,
  riskPercent = 1.0,
  initialMode = "funded",
  mode: controlledMode,
  onModeChange,
  onChange,
}: CapitalSurvivalCardProps) {
  const [internalMode, setInternalMode] = useState<AccountSurvivalMode>(initialMode);
  const mode = controlledMode ?? internalMode;

  const handleModeChange = (nextMode: AccountSurvivalMode) => {
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
    onChange?.({ mode: nextMode });
  };

  // Financial (Funded) mode state - clean free-form values
  const [nominalBalance, setNominalBalance] = useState(50000);
  const [maxDrawdown, setMaxDrawdown] = useState(3000);
  const [fundedRiskDollars, setFundedRiskDollars] = useState(300);
  const [fundedRiskUnit, setFundedRiskUnit] = useState<"$" | "%dd" | "%acc">("$");
  const [fundedRiskInputStr, setFundedRiskInputStr] = useState("300");

  // Live (Cash) mode state - clean free-form values
  const [liveBalance, setLiveBalance] = useState(balance);
  const [liveMaxDd, setLiveMaxDd] = useState(() => Math.round((balance || 50000) * 0.5));
  const [liveRiskPercent, setLiveRiskPercent] = useState(riskPercent);
  const [liveDollarRisk, setLiveDollarRisk] = useState(() =>
    Math.round(balance * (riskPercent / 100)),
  );
  const [liveRiskUnit, setLiveRiskUnit] = useState<"$" | "%">("%");
  const [liveRiskInputStr, setLiveRiskInputStr] = useState(String(riskPercent || 1.0));

  // Focus states for step 2 HUD highlights
  const [isNominalFocused, setIsNominalFocused] = useState(false);
  const [isDdFocused, setIsDdFocused] = useState(false);
  const [isFundedRiskFocused, setIsFundedRiskFocused] = useState(false);
  const [isLiveBalanceFocused, setIsLiveBalanceFocused] = useState(false);
  const [isLiveRiskFocused, setIsLiveRiskFocused] = useState(false);

  // Funded survival calculation
  const safeNominal = Math.max(100, nominalBalance || 50000);
  const safeMaxDrawdown = Math.max(100, maxDrawdown || 3000);
  const safeFundedRisk = Math.max(1, fundedRiskDollars || 300);

  const fundedResult = calculateFundedSurvival(
    safeMaxDrawdown,
    safeFundedRisk,
    safeNominal,
    45,
    100,
  );

  // Live survival calculation
  const safeLiveBalance = Math.max(100, liveBalance || 50000);
  const safeLiveMaxDd = Math.max(100, liveMaxDd || Math.round(safeLiveBalance * 0.5));
  const safeLiveRisk = Math.max(0.05, Math.min(50, liveRiskPercent || 1.0));
  const liveRuinProbability = calculateDrawdown50Probability(safeLiveRisk);
  const liveTradesToLimit = Math.max(1, Math.floor(safeLiveMaxDd / Math.max(1, liveDollarRisk)));

  // Unit switcher handlers - Funded mode
  const handleFundedUnitChange = (nextUnit: "$" | "%dd" | "%acc") => {
    setFundedRiskUnit(nextUnit);
    if (nextUnit === "$") {
      setFundedRiskInputStr(String(safeFundedRisk));
    } else if (nextUnit === "%dd") {
      setFundedRiskInputStr(String(fundedResult.cushionRiskPercent));
    } else {
      setFundedRiskInputStr(String(fundedResult.nominalRiskPercent));
    }
  };

  const handleFundedRiskInputChange = (valStr: string) => {
    setFundedRiskInputStr(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      if (fundedRiskUnit === "$") {
        setFundedRiskDollars(Math.round(num));
      } else if (fundedRiskUnit === "%dd") {
        setFundedRiskDollars(Math.round(safeMaxDrawdown * (num / 100)));
      } else {
        setFundedRiskDollars(Math.round(safeNominal * (num / 100)));
      }
    }
  };

  const handleSelectFundedScenario = (dollars: number) => {
    setFundedRiskDollars(dollars);
    if (fundedRiskUnit === "$") {
      setFundedRiskInputStr(String(dollars));
    } else if (fundedRiskUnit === "%dd") {
      setFundedRiskInputStr(String(Number(((dollars / safeMaxDrawdown) * 100).toFixed(1))));
    } else {
      setFundedRiskInputStr(String(Number(((dollars / safeNominal) * 100).toFixed(2))));
    }
  };

  // Unit switcher handlers - Live mode
  const handleLiveUnitChange = (nextUnit: "$" | "%") => {
    setLiveRiskUnit(nextUnit);
    if (nextUnit === "$") {
      setLiveRiskInputStr(String(liveDollarRisk));
    } else {
      setLiveRiskInputStr(String(safeLiveRisk));
    }
  };

  const handleLiveRiskInputChange = (valStr: string) => {
    setLiveRiskInputStr(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      if (liveRiskUnit === "$") {
        setLiveDollarRisk(Math.round(num));
        if (safeLiveBalance > 0) {
          const p = Number(((num / safeLiveBalance) * 100).toFixed(2));
          setLiveRiskPercent(p);
          onChange?.({ riskPercent: p });
        }
      } else {
        setLiveRiskPercent(num);
        const d = Math.round(safeLiveBalance * (num / 100));
        setLiveDollarRisk(d);
        onChange?.({ riskPercent: num });
      }
    }
  };

  const handleSelectLiveScenario = (pct: number) => {
    setLiveRiskPercent(pct);
    const d = Math.round(safeLiveBalance * (pct / 100));
    setLiveDollarRisk(d);
    setLiveRiskInputStr(liveRiskUnit === "$" ? String(d) : String(pct));
    onChange?.({ riskPercent: pct });
  };

  const getLiveCategory = (r: number) => {
    if (r <= 0.75)
      return {
        label: "Conservative",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
      };
    if (r <= 1.5)
      return {
        label: "Optimal Survival",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
      };
    if (r <= 3.0)
      return {
        label: "Dangerous",
        color: "text-amber-500",
        border: "border-amber-500/40",
        bg: "bg-amber-500/10",
      };
    return {
      label: "Fatal / Ruin Zone",
      color: "text-loss",
      border: "border-loss/40",
      bg: "bg-loss/10",
    };
  };

  const getFundedCategory = (cat: string) => {
    switch (cat) {
      case "Conservative":
        return {
          label: "Safe Buffer (≥15 losses)",
          color: "text-profit",
          border: "border-profit/40",
          bg: "bg-profit/10",
        };
      case "Optimal":
        return {
          label: "Optimal Prop (10–14 losses)",
          color: "text-profit",
          border: "border-profit/40",
          bg: "bg-profit/10",
        };
      case "Dangerous":
        return {
          label: "High Ruin Risk (6–9 losses)",
          color: "text-amber-500",
          border: "border-amber-500/40",
          bg: "bg-amber-500/10",
        };
      default:
        return {
          label: "Fatal / Breach Imminent (<6 losses)",
          color: "text-loss",
          border: "border-loss/40",
          bg: "bg-loss/10",
        };
    }
  };

  const currentCategory =
    mode === "funded" ? getFundedCategory(fundedResult.category) : getLiveCategory(safeLiveRisk);

  const copyText =
    mode === "funded"
      ? `Funded Account Survival: Nominal: $${safeNominal.toLocaleString()} | Max Drawdown Limit: $${safeMaxDrawdown.toLocaleString()} | Risk: $${safeFundedRisk} (${fundedResult.cushionRiskPercent}% DD cushion, ${fundedResult.nominalRiskPercent}% nominal) | Losses to Breach: ${fundedResult.lossesToBreach} | Cushion Ruin Risk: ${fundedResult.cushionRuinProbability}% (${currentCategory.label})`
      : `Live Account Survival: Balance: $${safeLiveBalance.toLocaleString()} | Risk: ${safeLiveRisk}% ($${liveDollarRisk.toLocaleString()}) | 50% Drawdown Prob: ${liveRuinProbability}% (${currentCategory.label})`;

  const fundedScenarios: ScenarioItem[] = [
    {
      pct: 5,
      dollars: Math.round(safeMaxDrawdown * 0.05),
      label: `5% risk ($${Math.round(safeMaxDrawdown * 0.05).toLocaleString()}) · Conservative`,
      dotColor: "bg-profit",
      barColor: "bg-profit/12",
      losses: "20",
      ruin: "0.2",
      barWidth: 100,
      isDanger: false,
    },
    {
      pct: 10,
      dollars: Math.round(safeMaxDrawdown * 0.1),
      label: `10% risk ($${Math.round(safeMaxDrawdown * 0.1).toLocaleString()}) · Optimal prop`,
      dotColor: "bg-profit",
      barColor: "bg-profit/12",
      losses: "10",
      ruin: "4.3",
      barWidth: 50,
      isDanger: false,
    },
    {
      pct: 15,
      dollars: Math.round(safeMaxDrawdown * 0.15),
      label: `15% risk ($${Math.round(safeMaxDrawdown * 0.15).toLocaleString()}) · High volatility`,
      dotColor: "bg-amber-500",
      barColor: "bg-amber-500/12",
      losses: "6.7",
      ruin: "15.2",
      barWidth: 33.3,
      isDanger: false,
    },
    {
      pct: 20,
      dollars: Math.round(safeMaxDrawdown * 0.2),
      label: `20% risk ($${Math.round(safeMaxDrawdown * 0.2).toLocaleString()}) · Dangerous`,
      dotColor: "bg-loss/70",
      barColor: "bg-loss/12",
      losses: "5",
      ruin: "20.9",
      barWidth: 25,
      isDanger: true,
    },
    {
      pct: 33.3,
      dollars: Math.round(safeMaxDrawdown * 0.333),
      label: `33% risk ($${Math.round(safeMaxDrawdown * 0.333).toLocaleString()}) · Fatal`,
      dotColor: "bg-loss",
      barColor: "bg-loss/12",
      losses: "3",
      ruin: "39.0",
      barWidth: 15,
      isDanger: true,
    },
  ].map((row) => {
    const isSelected = Math.abs(safeFundedRisk - row.dollars) < safeMaxDrawdown * 0.03;
    return {
      id: row.pct,
      label: row.label,
      dotColor: row.dotColor,
      barColor: row.barColor,
      barWidthPercent: row.barWidth,
      isSelected,
      isDanger: row.isDanger,
      onClick: () => handleSelectFundedScenario(row.dollars),
      detail: (
        <>
          <span
            className={cn(
              "font-semibold",
              row.isDanger ? "text-loss" : row.pct === 15 ? "text-amber-500" : "text-profit",
            )}
          >
            {row.losses} losses
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span
            className={cn(
              "font-mono text-xs",
              row.isDanger ? "text-loss/90" : "text-muted-foreground",
            )}
          >
            <span className={cn("font-semibold", row.isDanger ? "text-loss" : "text-foreground")}>
              {row.ruin}%
            </span>{" "}
            ruin
          </span>
        </>
      ),
    };
  });

  const liveScenarios: ScenarioItem[] = STANDARD_RISK_SURVIVAL_TABLE.map((row) => {
    const isSafe = row.riskPercent <= 1.0;
    const isWarn = row.riskPercent === 2.0;
    const isDanger = row.riskPercent > 2.0;
    const isSelected = Math.abs(safeLiveRisk - row.riskPercent) < 0.25;
    const rowDollars = Math.round(safeLiveBalance * (row.riskPercent / 100));
    const tradesToLimit = Math.floor(safeLiveMaxDd / Math.max(1, rowDollars));
    const barWidth = Math.min(100, Math.max(3, (row.drawdown50Prob / 70) * 100));

    return {
      id: row.riskPercent,
      label: `${row.riskPercent}% risk ($${rowDollars.toLocaleString()}) · ${row.riskCategory}`,
      dotColor: isSafe ? "bg-profit" : isWarn ? "bg-amber-500" : "bg-loss/70",
      barColor: isSafe ? "bg-profit/12" : isWarn ? "bg-amber-500/12" : "bg-loss/12",
      barWidthPercent: barWidth,
      isSelected,
      isDanger,
      onClick: () => handleSelectLiveScenario(row.riskPercent),
      detail: (
        <>
          <span
            className={cn(
              "font-semibold",
              isSafe ? "text-profit" : isWarn ? "text-amber-500" : "text-loss",
            )}
          >
            {tradesToLimit} trades
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span
            className={cn("font-mono text-xs", isDanger ? "text-loss/90" : "text-muted-foreground")}
          >
            <span className={cn("font-semibold", isDanger ? "text-loss" : "text-foreground")}>
              {row.drawdown50Prob}%
            </span>{" "}
            50% DD risk
          </span>
        </>
      ),
    };
  });

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case [text-wrap:balance]">
              Capital Survival &amp; Ruin Risk
            </CardTitle>
            <AccountModeToggle mode={mode} onChange={handleModeChange} />
          </div>
          <p className="text-xs text-muted-foreground [text-wrap:pretty]">
            {mode === "funded"
              ? "Calculates survival against your actual Drawdown Buffer, exposing the real cushion before breach."
              : "Calculates survival on your personal capital, where risk directly impacts ruin probability."}
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {mode === "funded" ? (
            <>
              {/* 1º: NOMINAL ACCOUNT SIZE */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nominal account ($)
                </label>
                <Input
                  type="number"
                  className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={nominalBalance || ""}
                  placeholder="50000"
                  onFocus={() => setIsNominalFocused(true)}
                  onBlur={() => setIsNominalFocused(false)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setNominalBalance(val);
                    if (fundedRiskUnit === "%acc" && val > 0) {
                      const num = parseFloat(fundedRiskInputStr);
                      if (!isNaN(num)) {
                        setFundedRiskDollars(Math.round(val * (num / 100)));
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 2º: MAX DRAWDOWN */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Max drawdown ($)
                </label>
                <Input
                  type="number"
                  step="100"
                  className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={maxDrawdown || ""}
                  placeholder="3000"
                  onFocus={() => setIsDdFocused(true)}
                  onBlur={() => setIsDdFocused(false)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxDrawdown(val);
                    if (fundedRiskUnit === "%dd" && val > 0) {
                      const num = parseFloat(fundedRiskInputStr);
                      if (!isNaN(num)) {
                        setFundedRiskDollars(Math.round(val * (num / 100)));
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 3º: RISK PER TRADE WITH INTERACTIVE TOGGLE */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Risk per trade
                    </label>
                    <UnitToggle
                      units={["$", "%dd", "%acc"] as const}
                      value={fundedRiskUnit}
                      onChange={handleFundedUnitChange}
                      labels={{ "%dd": "% DD", "%acc": "% Acc" }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {fundedRiskUnit === "$" && (
                      <>
                        {fundedResult.nominalRiskPercent}% nominal ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            fundedResult.cushionRiskPercent > 15
                              ? "text-loss"
                              : fundedResult.cushionRiskPercent > 10
                                ? "text-amber-500"
                                : "text-profit",
                          )}
                        >
                          {fundedResult.cushionRiskPercent}% of DD cushion
                        </span>
                      </>
                    )}
                    {fundedRiskUnit === "%dd" && (
                      <>
                        =${safeFundedRisk.toLocaleString()} per trade ·{" "}
                        <span className="text-muted-foreground">
                          {fundedResult.nominalRiskPercent}% of nominal
                        </span>
                      </>
                    )}
                    {fundedRiskUnit === "%acc" && (
                      <>
                        =${safeFundedRisk.toLocaleString()} per trade ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            fundedResult.cushionRiskPercent > 15
                              ? "text-loss"
                              : fundedResult.cushionRiskPercent > 10
                                ? "text-amber-500"
                                : "text-profit",
                          )}
                        >
                          {fundedResult.cushionRiskPercent}% of DD cushion
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                    {fundedRiskUnit === "$" ? "$" : "%"}
                  </span>
                  <Input
                    type="number"
                    step={fundedRiskUnit === "$" ? "25" : "0.5"}
                    className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pl-6 pr-2"
                    value={fundedRiskInputStr}
                    placeholder={
                      fundedRiskUnit === "$" ? "300" : fundedRiskUnit === "%dd" ? "10.0" : "0.6"
                    }
                    onFocus={() => setIsFundedRiskFocused(true)}
                    onBlur={() => setIsFundedRiskFocused(false)}
                    onChange={(e) => handleFundedRiskInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* LIVE (CASH) MODE INPUTS */}
              {/* 1º: ACCOUNT BALANCE */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Account balance ($)
                </label>
                <Input
                  type="number"
                  className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={liveBalance || ""}
                  placeholder="50000"
                  onFocus={() => setIsLiveBalanceFocused(true)}
                  onBlur={() => setIsLiveBalanceFocused(false)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLiveBalance(v);
                    if (v > 0) {
                      setLiveMaxDd(Math.round(v * 0.5));
                      if (liveRiskUnit === "%") {
                        const d = Math.round(v * (liveRiskPercent / 100));
                        setLiveDollarRisk(d);
                      } else {
                        const p = Number(((liveDollarRisk / v) * 100).toFixed(2));
                        setLiveRiskPercent(p);
                        onChange?.({ riskPercent: p });
                      }
                    }
                    onChange?.({ balance: v });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 2º: MAX DRAWDOWN LIMIT */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Max drawdown limit ($)
                </label>
                <Input
                  type="number"
                  step="100"
                  className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={liveMaxDd || ""}
                  placeholder="25000"
                  onFocus={() => setIsDdFocused(true)}
                  onBlur={() => setIsDdFocused(false)}
                  onChange={(e) => setLiveMaxDd(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 3º: RISK PER TRADE WITH INTERACTIVE TOGGLE */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Risk per trade
                    </label>
                    <UnitToggle
                      units={["$", "%"] as const}
                      value={liveRiskUnit}
                      onChange={handleLiveUnitChange}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {liveRiskUnit === "$" ? (
                      <>
                        {safeLiveRisk.toFixed(2)}% of balance ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            liveRuinProbability > 15
                              ? "text-loss"
                              : liveRuinProbability > 5
                                ? "text-amber-500"
                                : "text-profit",
                          )}
                        >
                          {liveRuinProbability}% 50% DD risk
                        </span>
                      </>
                    ) : (
                      <>
                        =$<MonetaryValue>{liveDollarRisk.toLocaleString("en-US")}</MonetaryValue>{" "}
                        per trade ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            liveRuinProbability > 15
                              ? "text-loss"
                              : liveRuinProbability > 5
                                ? "text-amber-500"
                                : "text-profit",
                          )}
                        >
                          {liveRuinProbability}% 50% DD risk
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                    {liveRiskUnit === "$" ? "$" : "%"}
                  </span>
                  <Input
                    type="number"
                    step={liveRiskUnit === "$" ? "25" : "0.25"}
                    className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pl-6 pr-2"
                    value={liveRiskInputStr}
                    placeholder={liveRiskUnit === "$" ? "250" : "1.0"}
                    onFocus={() => setIsLiveRiskFocused(true)}
                    onBlur={() => setIsLiveRiskFocused(false)}
                    onChange={(e) => handleLiveRiskInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </div>

      {/* PROMINENT HUD OUTPUT */}
      <CardContent className="border-t border-border/70 pt-4">
        <FormulaHud
          title={mode === "funded" ? "Drawdown cushion survival" : "Personal survival probability"}
          category={{
            ...currentCategory,
            heading: mode === "funded" ? "The Funded Account Illusion" : "The 50% Drawdown Trap",
            advice:
              mode === "funded"
                ? `Risking $${safeFundedRisk} on a $${safeNominal.toLocaleString()} account appears to be only ${fundedResult.nominalRiskPercent}%. But against your actual $${safeMaxDrawdown.toLocaleString()} drawdown limit, it consumes ${fundedResult.cushionRiskPercent}% of your real buffer.`
                : "At 1% risk per trade, the probability of reaching a 50% drawdown is only 1.8%. But at 2%, it explodes tenfold to 18.2%, and at 5% it reaches 65.4% — where recovering requires a +100% account gain.",
          }}
          copyText={copyText}
          theoryNumerator="Max Drawdown Limit ($)"
          theoryDenominator="Dollar Risk per Trade ($)"
          valueNumerator={
            <span
              className={cn(
                "text-foreground font-semibold tnum px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                isDdFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
              )}
            >
              $
              {mode === "funded"
                ? safeMaxDrawdown.toLocaleString()
                : safeLiveMaxDd.toLocaleString()}
            </span>
          }
          valueDenominator={
            <span
              className={cn(
                "text-foreground font-semibold tnum px-0.5 py-0.5 rounded transition-[background-color,color] duration-150",
                (mode === "funded" ? isFundedRiskFocused : isLiveRiskFocused) &&
                  "bg-primary/20 text-primary ring-1 ring-primary/40",
              )}
            >
              ${mode === "funded" ? safeFundedRisk : liveDollarRisk.toLocaleString()}
            </span>
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                mode === "funded"
                  ? fundedResult.lossesToBreach < 8
                    ? "text-loss"
                    : "text-profit"
                  : liveTradesToLimit < 20
                    ? "text-loss"
                    : "text-profit",
              )}
            >
              {mode === "funded" ? fundedResult.lossesToBreach : liveTradesToLimit}
            </span>
          }
          resultLabel={mode === "funded" ? "trades to breach" : "trades to limit"}
          resultSecondary={
            <div className="flex items-baseline justify-end gap-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
              <span className="font-semibold text-loss tnum">
                {mode === "funded"
                  ? `${fundedResult.cushionRuinProbability}%`
                  : `${liveRuinProbability}%`}
              </span>
              <span className="text-muted-foreground">
                {mode === "funded" ? "risk of ruin" : "50% DD risk"}
              </span>
            </div>
          }
        >
          <ScenarioRuler
            title={
              mode === "funded"
                ? "Drawdown buffer survival scenarios"
                : "Personal capital drawdown scenarios"
            }
            items={mode === "funded" ? fundedScenarios : liveScenarios}
          />
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
