"use client";

import { useEffect, useState } from "react";

export const CALCULATOR_STORAGE_KEY = "journal-calculator-v1";

export interface CalculatorState {
  ev: {
    avgPayout: number;
    payoutChance: number;
    cost: number;
    passRate: number;
  };
  sizing: {
    instrumentId: string;
    points: number;
    contracts: number;
    dollars: number;
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
    instrumentId: "NQ",
    points: 8,
    contracts: 10,
    dollars: 1600,
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
 * filling in defaults for any missing or corrupted keys.
 */
export function parseCalculatorState(stored: string | null): CalculatorState {
  if (!stored) return DEFAULT_CALCULATOR_STATE;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return DEFAULT_CALCULATOR_STATE;
    return {
      ev: { ...DEFAULT_CALCULATOR_STATE.ev, ...parsed.ev },
      sizing: { ...DEFAULT_CALCULATOR_STATE.sizing, ...parsed.sizing },
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
      const stored = typeof window !== "undefined" ? localStorage.getItem(CALCULATOR_STORAGE_KEY) : null;
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
