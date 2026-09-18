"use client";

import { useEffect, useState } from "react";
import type { ExecutionMode } from "@luxalgo/journal-core";

export const CALCULATOR_STORAGE_KEY = "journal-calculator-v1";

export interface CalculatorState {
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
    passRate: number;
    bankroll: number;
  };
}

export const DEFAULT_CALCULATOR_STATE: CalculatorState = {
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

    return {
      ev: { ...DEFAULT_CALCULATOR_STATE.ev, ...parsed.ev },
      sizing,
      simulator: { ...DEFAULT_CALCULATOR_STATE.simulator, ...parsed.simulator },
      budget: { ...DEFAULT_CALCULATOR_STATE.budget, ...parsed.budget },
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
      const next = {
        ...prev,
        [section]: { ...prev[section], ...patch },
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
    resetSection,
  };
}
