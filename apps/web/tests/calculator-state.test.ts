import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALCULATOR_STATE,
  parseCalculatorState,
} from "../src/lib/use-calculator-state";

describe("calculator state management", () => {
  it("exports sensible defaults", () => {
    expect(DEFAULT_CALCULATOR_STATE.ev.avgPayout).toBe(2000);
    expect(DEFAULT_CALCULATOR_STATE.sizing.instrumentId).toBe("NQ");
    expect(DEFAULT_CALCULATOR_STATE.simulator.bankroll).toBe(500);
    expect(DEFAULT_CALCULATOR_STATE.budget.firm).toBe("Topstep 50K");
  });

  it("handles null or undefined storage cleanly", () => {
    expect(parseCalculatorState(null)).toEqual(DEFAULT_CALCULATOR_STATE);
    expect(parseCalculatorState("")).toEqual(DEFAULT_CALCULATOR_STATE);
  });

  it("handles corrupted JSON without throwing", () => {
    expect(parseCalculatorState("invalid-json{")).toEqual(DEFAULT_CALCULATOR_STATE);
    expect(parseCalculatorState("12345")).toEqual(DEFAULT_CALCULATOR_STATE);
  });

  it("hydrates stored state while preserving defaults for missing properties", () => {
    const stored = JSON.stringify({
      ev: { avgPayout: 3500 },
      sizing: { instrumentId: "ES", points: 15 },
    });

    const parsed = parseCalculatorState(stored);
    expect(parsed.ev.avgPayout).toBe(3500);
    expect(parsed.ev.payoutChance).toBe(DEFAULT_CALCULATOR_STATE.ev.payoutChance);
    expect(parsed.sizing.instrumentId).toBe("ES");
    expect(parsed.sizing.points).toBe(15);
    expect(parsed.simulator.bankroll).toBe(DEFAULT_CALCULATOR_STATE.simulator.bankroll);
  });
});
