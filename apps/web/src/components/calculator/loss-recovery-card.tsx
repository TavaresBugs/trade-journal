"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonetaryValue } from "@/components/privacy";
import { cn } from "@/lib/utils";
import { calculateRecoveryPercentage } from "@luxalgo/journal-core";
import type { AccountSurvivalMode } from "@luxalgo/journal-core";
import {
  AccountModeToggle,
  UnitToggle,
  FormulaHud,
  ScenarioRuler,
  type ScenarioItem,
} from "./shared";

interface LossRecoveryCardProps {
  initialCapital?: number;
  drawdownPercent?: number;
  mode?: AccountSurvivalMode;
  onModeChange?: (mode: AccountSurvivalMode) => void;
  onChange?: (patch: {
    drawdownPercent?: number;
    initialCapital?: number;
    mode?: AccountSurvivalMode;
  }) => void;
}

export function LossRecoveryCard({
  initialCapital = 50000,
  drawdownPercent = 30,
  mode: initialMode = "funded",
  onModeChange,
  onChange,
}: LossRecoveryCardProps) {
  const [mode, setMode] = useState<AccountSurvivalMode>(initialMode);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const handleModeChange = (nextMode: AccountSurvivalMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
    onChange?.({ mode: nextMode });
  };

  // Funded mode state
  const [nominalBalance, setNominalBalance] = useState(50000);
  const [maxDrawdown, setMaxDrawdown] = useState(3000);
  const [cushionDdPercent, setCushionDdPercent] = useState(drawdownPercent || 30);
  const [cushionUnit, setCushionUnit] = useState<"%" | "$">("%");
  const [cushionInputStr, setCushionInputStr] = useState(String(drawdownPercent || 30));

  // Live mode state
  const [liveCapital, setLiveCapital] = useState(initialCapital || 50000);
  const [liveMaxDd, setLiveMaxDd] = useState(Math.round((initialCapital || 50000) * 0.5));
  const [liveDdPercent, setLiveDdPercent] = useState(drawdownPercent || 30);
  const [liveUnit, setLiveUnit] = useState<"%" | "$">("%");
  const [liveInputStr, setLiveInputStr] = useState(String(drawdownPercent || 30));

  // Focus states
  const [isNominalFocused, setIsNominalFocused] = useState(false);
  const [isMaxDdFocused, setIsMaxDdFocused] = useState(false);
  const [isCushionFocused, setIsCushionFocused] = useState(false);
  const [isLiveCapitalFocused, setIsLiveCapitalFocused] = useState(false);
  const [isLiveMaxDdFocused, setIsLiveMaxDdFocused] = useState(false);
  const [isLiveDdFocused, setIsLiveDdFocused] = useState(false);

  // Sync with initialCapital if parent updates
  useEffect(() => {
    if (!isLiveCapitalFocused && initialCapital !== undefined) {
      setLiveCapital(initialCapital);
      setLiveMaxDd(Math.round(initialCapital * 0.5));
    }
  }, [initialCapital, isLiveCapitalFocused]);

  // Calculations: Funded mode
  const safeNominal = Math.max(100, nominalBalance || 50000);
  const safeMaxDrawdown = Math.max(100, maxDrawdown || 3000);
  const safeCushionDd = Math.max(1, Math.min(99, cushionDdPercent || 30));
  const cushionDollarLoss = Math.round(safeMaxDrawdown * (safeCushionDd / 100));
  const remainingBuffer = safeMaxDrawdown - cushionDollarLoss;
  const cushionRecoveryNeeded = calculateRecoveryPercentage(safeCushionDd);
  const nominalLossPercent = Number(((cushionDollarLoss / safeNominal) * 100).toFixed(2));

  // Calculations: Live mode
  const safeLiveCapital = Math.max(100, liveCapital || 50000);
  const safeLiveMaxDd = Math.max(100, liveMaxDd || Math.round(safeLiveCapital * 0.5));
  const safeLiveDd = Math.max(1, Math.min(95, liveDdPercent || 30));
  const liveDollarLoss = Math.round(safeLiveCapital * (safeLiveDd / 100));
  const liveRemainingCapital = safeLiveCapital - liveDollarLoss;
  const liveRecoveryNeeded = calculateRecoveryPercentage(safeLiveDd);
  const liveLimitLossPercent = Number(((liveDollarLoss / safeLiveMaxDd) * 100).toFixed(1));
  const remainingLiveBuffer = Math.max(0, safeLiveMaxDd - liveDollarLoss);

  // Category advice helpers
  const getFundedCategory = (dd: number) => {
    if (dd <= 15) {
      return {
        label: "Manageable Cushion",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
        heading: "Manageable Cushion Range",
        advice: `At a ${dd}% cushion loss ($${cushionDollarLoss.toLocaleString()} out of $${safeMaxDrawdown.toLocaleString()}), you retain $${remainingBuffer.toLocaleString()} of buffer. Recovering requires only a +${calculateRecoveryPercentage(dd)}% gain on your remaining buffer.`,
      };
    }
    if (dd <= 25) {
      return {
        label: "Moderate Cushion",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
        heading: "Moderate Cushion Range",
        advice: `At a ${dd}% cushion loss ($${cushionDollarLoss.toLocaleString()}), you need +${calculateRecoveryPercentage(dd)}% on remaining buffer to reach full health. Maintain strict risk to prevent cascading.`,
      };
    }
    if (dd <= 40) {
      return {
        label: "Steep Asymmetry",
        color: "text-amber-500",
        border: "border-amber-500/40",
        bg: "bg-amber-500/10",
        heading: "Steep Cushion Asymmetry",
        advice: `At ${dd}% cushion loss, you have consumed over a third of your prop firm buffer ($${remainingBuffer.toLocaleString()} left). Recovering requires a +${calculateRecoveryPercentage(dd)}% gain on your remaining buffer, though it represents only a -${nominalLossPercent}% nominal loss.`,
      };
    }
    if (dd <= 60) {
      return {
        label: "Severe (Buffer Halved)",
        color: "text-loss",
        border: "border-loss/40",
        bg: "bg-loss/10",
        heading: "The 50% Cushion Trap",
        advice: `At ${dd}% cushion loss ($${cushionDollarLoss.toLocaleString()} lost), your buffer is cut in half ($${remainingBuffer.toLocaleString()} left). You must DOUBLE (+100%) your remaining buffer just to recover, with half the room for errors before account liquidation.`,
      };
    }
    return {
      label: "Fatal Liquidation Zone",
      color: "text-loss",
      border: "border-loss/40",
      bg: "bg-loss/10",
      heading: "Near Account Termination",
      advice: `At ${dd}% cushion loss, you have only $${remainingBuffer.toLocaleString()} left before total account breach. Recovery requires an extreme +${calculateRecoveryPercentage(dd)}% gain on remaining buffer.`,
    };
  };

  const getLiveCategory = (dd: number) => {
    if (dd <= 15) {
      return {
        label: "Manageable",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
        heading: "Manageable Loss Range",
        advice: `At a ${dd}% drawdown, recovery requires only a +${calculateRecoveryPercentage(dd)}% gain. Normal trading expectancy easily recovers this deficit without altering position sizing.`,
      };
    }
    if (dd <= 25) {
      return {
        label: "Moderate",
        color: "text-profit",
        border: "border-profit/40",
        bg: "bg-profit/10",
        heading: "Moderate Recovery Range",
        advice: `At a ${dd}% drawdown, you need +${calculateRecoveryPercentage(dd)}% to reach breakeven. Discipline is critical to prevent cascading into exponential drawdown.`,
      };
    }
    if (dd <= 40) {
      return {
        label: "Steep Asymmetry",
        color: "text-amber-500",
        border: "border-amber-500/40",
        bg: "bg-amber-500/10",
        heading: "Steep Asymmetric Zone",
        advice: `At ${dd}% drawdown, you need +${calculateRecoveryPercentage(dd)}% to recover. Losses and gains are heavily asymmetric here: you have lost over a third of your capital base.`,
      };
    }
    if (dd <= 60) {
      return {
        label: "Severe (2x Trap)",
        color: "text-loss",
        border: "border-loss/40",
        bg: "bg-loss/10",
        heading: "The 50% Drawdown Trap",
        advice: `At ${dd}% drawdown, you need +${calculateRecoveryPercentage(dd)}% to break even. A 50% loss requires a 100% gain (doubling remaining capital) just to return to starting equity.`,
      };
    }
    return {
      label: "Catastrophic",
      color: "text-loss",
      border: "border-loss/40",
      bg: "bg-loss/10",
      heading: "Catastrophic Capital Destruction",
      advice: `At ${dd}% drawdown, you need an extreme +${calculateRecoveryPercentage(dd)}% gain. Most accounts experiencing drawdowns beyond 60% never recover.`,
    };
  };

  const currentCategory =
    mode === "funded" ? getFundedCategory(safeCushionDd) : getLiveCategory(safeLiveDd);

  // Unit switcher handlers - Funded mode
  const handleFundedUnitChange = (nextUnit: "%" | "$") => {
    setCushionUnit(nextUnit);
    if (nextUnit === "%") {
      setCushionInputStr(String(safeCushionDd));
    } else {
      setCushionInputStr(String(cushionDollarLoss));
    }
  };

  const handleFundedInputChange = (valStr: string) => {
    setCushionInputStr(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      if (cushionUnit === "%") {
        setCushionDdPercent(num);
        onChange?.({ drawdownPercent: num });
      } else {
        const pct = Number(((num / safeMaxDrawdown) * 100).toFixed(1));
        setCushionDdPercent(pct);
        onChange?.({ drawdownPercent: pct });
      }
    }
  };

  const handleSelectFundedScenario = (pct: number) => {
    setCushionDdPercent(pct);
    setCushionInputStr(
      cushionUnit === "%" ? String(pct) : String(Math.round(safeMaxDrawdown * (pct / 100))),
    );
    onChange?.({ drawdownPercent: pct });
  };

  // Unit switcher handlers - Live mode
  const handleLiveUnitChange = (nextUnit: "%" | "$") => {
    setLiveUnit(nextUnit);
    if (nextUnit === "%") {
      setLiveInputStr(String(safeLiveDd));
    } else {
      setLiveInputStr(String(liveDollarLoss));
    }
  };

  const handleLiveInputChange = (valStr: string) => {
    setLiveInputStr(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      if (liveUnit === "%") {
        setLiveDdPercent(num);
        onChange?.({ drawdownPercent: num, initialCapital: safeLiveCapital });
      } else {
        const pct = Number(((num / safeLiveCapital) * 100).toFixed(1));
        setLiveDdPercent(pct);
        onChange?.({ drawdownPercent: pct, initialCapital: safeLiveCapital });
      }
    }
  };

  const handleSelectLiveScenario = (pct: number) => {
    setLiveDdPercent(pct);
    setLiveInputStr(
      liveUnit === "%" ? String(pct) : String(Math.round(safeLiveCapital * (pct / 100))),
    );
    onChange?.({ drawdownPercent: pct, initialCapital: safeLiveCapital });
  };

  const copyText =
    mode === "funded"
      ? `Funded Recovery Asymmetry: Nominal: $${safeNominal.toLocaleString()} | Max DD Cushion: $${safeMaxDrawdown.toLocaleString()} | Cushion Loss: -${safeCushionDd}% (-$${cushionDollarLoss.toLocaleString()}) | Buffer Remaining: $${remainingBuffer.toLocaleString()} | Gain on Buffer Needed: +${cushionRecoveryNeeded}% (only -${nominalLossPercent}% nominal)`
      : `Loss Recovery Asymmetry: Capital: $${safeLiveCapital.toLocaleString()} | Drawdown: -${safeLiveDd}% (-$${liveDollarLoss.toLocaleString()}) | Remaining: $${liveRemainingCapital.toLocaleString()} | Gain Required: +${liveRecoveryNeeded}% (+$${liveDollarLoss.toLocaleString()})`;

  const fundedScenarios: ScenarioItem[] = [
    { dd: 10, rec: 11.1 },
    { dd: 20, rec: 25.0 },
    { dd: 30, rec: 42.9 },
    { dd: 50, rec: 100.0 },
    { dd: 80, rec: 400.0 },
  ].map((step) => {
    const isSelected = Math.abs(safeCushionDd - step.dd) < 3;
    const recBarWidth = Math.max(4, Math.min(100, (step.rec / 400) * 100));
    const isSafe = step.dd <= 20;
    const isWarn = step.dd <= 30;
    const isDanger = step.dd >= 50;
    const dollars = Math.round(safeMaxDrawdown * (step.dd / 100));
    const left = safeMaxDrawdown - dollars;

    return {
      id: step.dd,
      label: `-${step.dd}% cushion DD (-$${dollars.toLocaleString()} · ${left.toLocaleString()} buffer left)`,
      dotColor: isSafe ? "bg-profit" : isWarn ? "bg-amber-500" : "bg-loss",
      barColor: isSafe ? "bg-profit/12" : isWarn ? "bg-amber-500/12" : "bg-loss/12",
      barWidthPercent: recBarWidth,
      isSelected,
      isDanger,
      onClick: () => handleSelectFundedScenario(step.dd),
      detail: (
        <span
          className={cn(
            "relative z-10 shrink-0 font-mono text-xs font-semibold",
            isSafe ? "text-profit" : isWarn ? "text-amber-500" : "text-loss",
          )}
        >
          +{step.rec}% buffer gain
        </span>
      ),
    };
  });

  const liveScenarios: ScenarioItem[] = [
    { dd: 10, rec: 11.1 },
    { dd: 20, rec: 25.0 },
    { dd: 30, rec: 42.9 },
    { dd: 50, rec: 100.0 },
    { dd: 80, rec: 400.0 },
  ].map((step) => {
    const isSelected = Math.abs(safeLiveDd - step.dd) < 3;
    const recBarWidth = Math.max(4, Math.min(100, (step.rec / 400) * 100));
    const isSafe = step.dd <= 20;
    const isWarn = step.dd <= 30;
    const isDanger = step.dd >= 50;
    const dollars = Math.round(safeLiveCapital * (step.dd / 100));

    return {
      id: step.dd,
      label: `-${step.dd}% drawdown (-$${dollars.toLocaleString()})`,
      dotColor: isSafe ? "bg-profit" : isWarn ? "bg-amber-500" : "bg-loss",
      barColor: isSafe ? "bg-profit/12" : isWarn ? "bg-amber-500/12" : "bg-loss/12",
      barWidthPercent: recBarWidth,
      isSelected,
      isDanger,
      onClick: () => handleSelectLiveScenario(step.dd),
      detail: (
        <span
          className={cn(
            "relative z-10 shrink-0 font-mono text-xs font-semibold",
            isSafe ? "text-profit" : isWarn ? "text-amber-500" : "text-loss",
          )}
        >
          +{step.rec}% gain to BE
        </span>
      ),
    };
  });

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground normal-case">
              Loss Recovery Asymmetry
            </CardTitle>
            <AccountModeToggle mode={mode} onChange={handleModeChange} />
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "funded"
              ? "The cushion trap: drawdowns consume your strict trailing/EOD buffer, creating severe recovery asymmetry."
              : "Losses and gains are not equal: the mathematical asymmetry required to recover back to breakeven."}
          </p>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {mode === "funded" ? (
            <>
              {/* 1º: NOMINAL ACCOUNT ($) */}
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
                  onChange={(e) => setNominalBalance(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 2º: MAX DRAWDOWN LIMIT ($) */}
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
                  onFocus={() => setIsMaxDdFocused(true)}
                  onBlur={() => setIsMaxDdFocused(false)}
                  onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 3º: CUSHION DRAWDOWN (% or $) */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Cushion drawdown
                    </label>
                    <UnitToggle
                      units={["%", "$"] as const}
                      value={cushionUnit}
                      onChange={handleFundedUnitChange}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    -${cushionDollarLoss.toLocaleString("en-US")} loss ·{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        safeCushionDd > 40
                          ? "text-loss"
                          : safeCushionDd > 20
                            ? "text-amber-500"
                            : "text-profit",
                      )}
                    >
                      {safeCushionDd}% of DD cushion
                    </span>{" "}
                    (-{nominalLossPercent}% nominal)
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                    {cushionUnit === "%" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    step={cushionUnit === "%" ? "5" : "100"}
                    className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pl-6 pr-2"
                    value={cushionInputStr}
                    placeholder={cushionUnit === "%" ? "30" : "900"}
                    onFocus={() => setIsCushionFocused(true)}
                    onBlur={() => setIsCushionFocused(false)}
                    onChange={(e) => handleFundedInputChange(e.target.value)}
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
              {/* LIVE CASH MODE */}
              {/* 1º: ACCOUNT BALANCE ($) */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Account balance ($)
                </label>
                <Input
                  type="number"
                  className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={liveCapital || ""}
                  placeholder="50000"
                  onFocus={() => setIsLiveCapitalFocused(true)}
                  onBlur={() => setIsLiveCapitalFocused(false)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setLiveCapital(v);
                    if (v > 0) {
                      setLiveMaxDd(Math.round(v * 0.5));
                      if (liveUnit === "$") {
                        const num = parseFloat(liveInputStr);
                        if (!isNaN(num)) {
                          const p = Number(((num / v) * 100).toFixed(1));
                          setLiveDdPercent(p);
                          onChange?.({ drawdownPercent: p, initialCapital: v });
                        }
                      } else {
                        const num = parseFloat(liveInputStr);
                        if (!isNaN(num)) {
                          onChange?.({ drawdownPercent: num, initialCapital: v });
                        }
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

              {/* 2º: MAX DRAWDOWN LIMIT ($) */}
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
                  onFocus={() => setIsLiveMaxDdFocused(true)}
                  onBlur={() => setIsLiveMaxDdFocused(false)}
                  onChange={(e) => setLiveMaxDd(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </div>

              {/* 3º: CURRENT DRAWDOWN (% or $) */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Account drawdown
                    </label>
                    <UnitToggle
                      units={["%", "$"] as const}
                      value={liveUnit}
                      onChange={handleLiveUnitChange}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    -${liveDollarLoss.toLocaleString("en-US")} loss ·{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        liveLimitLossPercent > 40
                          ? "text-loss"
                          : liveLimitLossPercent > 20
                            ? "text-amber-500"
                            : "text-profit",
                      )}
                    >
                      {liveLimitLossPercent}% of DD limit
                    </span>{" "}
                    (${remainingLiveBuffer.toLocaleString("en-US")} buffer left)
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                    {liveUnit === "%" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    step={liveUnit === "%" ? "5" : "500"}
                    className="h-9 w-36 text-center font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pl-6 pr-2"
                    value={liveInputStr}
                    placeholder={liveUnit === "%" ? "30" : "15000"}
                    onFocus={() => setIsLiveDdFocused(true)}
                    onBlur={() => setIsLiveDdFocused(false)}
                    onChange={(e) => handleLiveInputChange(e.target.value)}
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
          title={mode === "funded" ? "Required cushion recovery" : "Required recovery gain"}
          category={currentCategory}
          copyText={copyText}
          theoryNumerator={mode === "funded" ? "Cushion Loss ($)" : "Dollar Loss ($)"}
          theoryDenominator={mode === "funded" ? "Remaining Buffer ($)" : "Remaining Capital ($)"}
          valueNumerator={
            mode === "funded" ? (
              <>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold text-foreground",
                    isCushionFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                  )}
                >
                  ${cushionDollarLoss.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                  ({safeCushionDd}%)
                </span>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "px-0.5 py-0.5 rounded transition-[background-color,color] duration-150 tnum font-semibold text-foreground",
                    isLiveDdFocused && "bg-primary/20 text-primary ring-1 ring-primary/40",
                  )}
                >
                  ${liveDollarLoss.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                  ({safeLiveDd}%)
                </span>
              </>
            )
          }
          valueDenominator={
            mode === "funded" ? (
              <>
                <span className="tnum font-semibold text-foreground">
                  ${remainingBuffer.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                  ({100 - safeCushionDd}%)
                </span>
              </>
            ) : (
              <>
                <span className="tnum font-semibold text-foreground">
                  ${liveRemainingCapital.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1 font-sans">
                  ({100 - safeLiveDd}%)
                </span>
              </>
            )
          }
          resultValue={
            <span
              className={cn(
                "text-xl sm:text-2xl font-bold tracking-tight font-mono tnum",
                (mode === "funded" ? safeCushionDd : safeLiveDd) > 40
                  ? "text-loss"
                  : (mode === "funded" ? safeCushionDd : safeLiveDd) > 25
                    ? "text-amber-500"
                    : "text-profit",
              )}
            >
              +{mode === "funded" ? cushionRecoveryNeeded : liveRecoveryNeeded}%
            </span>
          }
          resultLabel={mode === "funded" ? "on buffer" : "gain needed"}
          resultSecondary={
            mode === "funded" ? (
              <div className="flex items-baseline justify-end gap-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
                <span className="font-semibold text-loss tnum">
                  -<MonetaryValue>${cushionDollarLoss.toLocaleString("en-US")}</MonetaryValue>
                </span>
                <span className="text-muted-foreground">cushion loss</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-semibold text-loss tnum">-{nominalLossPercent}%</span>
                <span className="text-muted-foreground">nominal</span>
              </div>
            ) : (
              <div className="flex items-baseline justify-end gap-1 text-[10px] sm:text-xs font-mono whitespace-nowrap">
                <span className="font-semibold text-loss tnum">
                  -<MonetaryValue>${liveDollarLoss.toLocaleString("en-US")}</MonetaryValue>
                </span>
                <span className="text-muted-foreground">capital loss</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-semibold text-loss tnum">{liveLimitLossPercent}%</span>
                <span className="text-muted-foreground">of DD limit</span>
              </div>
            )
          }
        >
          <ScenarioRuler
            title={
              mode === "funded" ? "Exponential cushion recovery" : "Exponential recovery staircase"
            }
            items={mode === "funded" ? fundedScenarios : liveScenarios}
          />
        </FormulaHud>
      </CardContent>
    </Card>
  );
}
