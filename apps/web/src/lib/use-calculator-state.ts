"use client";

import { useEffect, useState } from "react";
import type { ExecutionMode, AccountSurvivalMode } from "@luxalgo/journal-core";

export const CALCULATOR_STORAGE_KEY = "journal-calculator-v1";

export interface CalculatorState {
  activeTab?: "risk" | "strategy" | "portfolio";
  strategy: {
    winRate: number;
    riskReward: number;
    riskDollars: number;
    feePerTrade: number;
    slippageDollars: number;
    sampleTrades: number;
  };
  survival: {
    mode?: AccountSurvivalMode;
    riskPercent: number;
    drawdownPercent: number;
  };
  recovery: {
    mode?: AccountSurvivalMode;
  };
  ev: {
    avgPayout: number;
    payoutChance: number;
    cost: number;
    passRate: number;
  };
  sizing: {
    mode: ExecutionMode;
    instrumentId: string;
    stopPoints: number;
    riskDollars: number;
    targetPoints: number;
    contracts: number;
  };
  simulator: {
    bankroll: number;
    evalCost: number;
    passRate: number;
    payoutChance: number;
    avgPayout: number;
  };
  budget: {
    firm: string;
    evalCost: number;
    passRate: number;
    bankroll: number;
  };
}

export const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  activeTab: "risk",
  strategy: {
    winRate: 45,
    riskReward: 2.5,
    riskDollars: 1000,
    feePerTrade: 5,
    slippageDollars: 10,
    sampleTrades: 100,
  },
  survival: {
    mode: "funded",
    riskPercent: 1.0,
    drawdownPercent: 30,
  },
  recovery: {
    mode: "funded",
  },
  ev: {
    avgPayout: 2000,
    payoutChance: 40,
    cost: 89,
    passRate: 40,
  },
  sizing: {
    mode: "eval",
    instrumentId: "NQ",
    stopPoints: 25,
    riskDollars: 1000,
    targetPoints: 38,
    contracts: 2,
  },
  simulator: {
    bankroll: 500,
    evalCost: 89,
    passRate: 40,
    payoutChance: 40,
    avgPayout: 2000,
  },
  budget: {
    firm: "Topstep 50K",
    evalCost: 89,
    passRate: 40,
    bankroll: 500,
  },
};

/**
 * Safely parses raw serialized JSON into a fully-hydrated CalculatorState,
 * filling in defaults for any missing or legacy keys.
 */
export function parseCalculatorState(stored: string | null): CalculatorState {
  if (!stored) return DEFAULT_CALCULATOR_STATE;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return DEFAULT_CALCULATOR_STATE;

    const rawSizing = parsed.sizing;
    const sizing: CalculatorState["sizing"] = {
      mode: rawSizing?.mode ?? "eval",
      instrumentId: rawSizing?.instrumentId ?? DEFAULT_CALCULATOR_STATE.sizing.instrumentId,
      stopPoints:
        rawSizing?.stopPoints ?? rawSizing?.points ?? DEFAULT_CALCULATOR_STATE.sizing.stopPoints,
      riskDollars:
        rawSizing?.riskDollars ?? rawSizing?.dollars ?? DEFAULT_CALCULATOR_STATE.sizing.riskDollars,
      targetPoints: rawSizing?.targetPoints ?? DEFAULT_CALCULATOR_STATE.sizing.targetPoints,
      contracts: rawSizing?.contracts ?? DEFAULT_CALCULATOR_STATE.sizing.contracts,
    };

    const rawBudget = parsed.budget;
    const budget: CalculatorState["budget"] = {
      firm: rawBudget?.firm ?? DEFAULT_CALCULATOR_STATE.budget.firm,
      evalCost:
        typeof rawBudget?.evalCost === "number" && rawBudget.evalCost > 0
          ? rawBudget.evalCost
          : DEFAULT_CALCULATOR_STATE.budget.evalCost,
      passRate: rawBudget?.passRate ?? DEFAULT_CALCULATOR_STATE.budget.passRate,
      bankroll: rawBudget?.bankroll ?? DEFAULT_CALCULATOR_STATE.budget.bankroll,
    };

    const rawStrategy = parsed.strategy;
    const strategy: CalculatorState["strategy"] = {
      winRate:
        typeof rawStrategy?.winRate === "number"
          ? rawStrategy.winRate
          : DEFAULT_CALCULATOR_STATE.strategy.winRate,
      riskReward:
        typeof rawStrategy?.riskReward === "number"
          ? rawStrategy.riskReward
          : DEFAULT_CALCULATOR_STATE.strategy.riskReward,
      riskDollars:
        typeof rawStrategy?.riskDollars === "number"
          ? rawStrategy.riskDollars
          : DEFAULT_CALCULATOR_STATE.strategy.riskDollars,
      feePerTrade:
        typeof rawStrategy?.feePerTrade === "number"
          ? rawStrategy.feePerTrade
          : DEFAULT_CALCULATOR_STATE.strategy.feePerTrade,
      slippageDollars:
        typeof rawStrategy?.slippageDollars === "number"
          ? rawStrategy.slippageDollars
          : DEFAULT_CALCULATOR_STATE.strategy.slippageDollars,
      sampleTrades:
        typeof rawStrategy?.sampleTrades === "number"
          ? rawStrategy.sampleTrades
          : DEFAULT_CALCULATOR_STATE.strategy.sampleTrades,
    };

    const rawSurvival = parsed.survival;
    const survival: CalculatorState["survival"] = {
      mode:
        rawSurvival?.mode === "funded" || rawSurvival?.mode === "live"
          ? rawSurvival.mode
          : DEFAULT_CALCULATOR_STATE.survival.mode,
      riskPercent:
        typeof rawSurvival?.riskPercent === "number"
          ? rawSurvival.riskPercent
          : DEFAULT_CALCULATOR_STATE.survival.riskPercent,
      drawdownPercent:
        typeof rawSurvival?.drawdownPercent === "number"
          ? rawSurvival.drawdownPercent
          : DEFAULT_CALCULATOR_STATE.survival.drawdownPercent,
    };

    const rawRecovery = parsed.recovery;
    const recovery: CalculatorState["recovery"] = {
      mode: rawRecovery?.mode === "live" ? "live" : "funded",
    };

    const activeTab =
      parsed.activeTab === "risk" ||
      parsed.activeTab === "strategy" ||
      parsed.activeTab === "portfolio"
        ? parsed.activeTab
        : DEFAULT_CALCULATOR_STATE.activeTab;

    return {
      activeTab,
      strategy,
      survival,
      recovery,
      ev: { ...DEFAULT_CALCULATOR_STATE.ev, ...parsed.ev },
      sizing,
      simulator: { ...DEFAULT_CALCULATOR_STATE.simulator, ...parsed.simulator },
      budget,
    };
  } catch {
    return DEFAULT_CALCULATOR_STATE;
  }
}

export function useCalculatorState() {
  const [state, setState] = useState<CalculatorState>(DEFAULT_CALCULATOR_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(CALCULATOR_STORAGE_KEY) : null;
      setState(parseCalculatorState(stored));
    } catch {
      // Fallback to default state
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateState = <K extends keyof CalculatorState>(
    section: K,
    patch: Partial<CalculatorState[K]>,
  ) => {
    setState((prev) => {
      const prevVal = prev[section];
      const nextVal =
        typeof prevVal === "object" &&
        prevVal !== null &&
        typeof patch === "object" &&
        patch !== null
          ? { ...prevVal, ...patch }
          : patch;
      const next = {
        ...prev,
        [section]: nextVal,
      };
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // Handle storage quota or access errors gracefully
      }
      return next;
    });
  };

  const setActiveTab = (tab: "risk" | "strategy" | "portfolio") => {
    setState((prev) => {
      const next = { ...prev, activeTab: tab };
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // Handle storage error
      }
      return next;
    });
  };

  const resetSection = (section: keyof CalculatorState) => {
    setState((prev) => {
      const next = {
        ...prev,
        [section]: DEFAULT_CALCULATOR_STATE[section],
      };
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // Handle storage error
      }
      return next;
    });
  };

  return {
    state,
    isLoaded,
    updateState,
    setActiveTab,
    resetSection,
  };
}
