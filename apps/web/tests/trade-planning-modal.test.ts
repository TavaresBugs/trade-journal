import { describe, expect, it } from "vitest";
import { computeTradePlanning, formatFeeDisplay } from "../src/components/trade-planning-modal";

describe("computeTradePlanning", () => {
  describe("Long trades", () => {
    it("computes Planned R:R, Risk, and Reward correctly for a standard Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(20);
      expect(result.rewardPerUnit).toBe(25);
      expect(result.totalReward).toBe(50);
      expect(result.plannedR).toBe(2.5);
      expect(result.plannedRFormatted).toBe("1 : 2.50R");
      expect(result.isStopValidForDirection).toBe(true);
      expect(result.isTargetValidForDirection).toBe(true);
    });

    it("correctly computes Realized R for closed winning and losing Long trades", () => {
      const winResult = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
        grossPnl: 30,
        isClosed: true,
      });
      expect(winResult.realizedR).toBe(1.5);
      expect(winResult.realizedRFormatted).toBe("+1.50R");

      const lossResult = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 2,
        contractMultiplier: 1,
        stopLoss: 90,
        profitTarget: 125,
        grossPnl: -20,
        isClosed: true,
      });
      expect(lossResult.realizedR).toBe(-1);
      expect(lossResult.realizedRFormatted).toBe("-1.00R");
    });

    it("flags invalid stop loss that is above entry price for a Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 105,
        profitTarget: 120,
      });

      expect(result.isStopValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });

    it("flags invalid profit target that is below entry price for a Long trade", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: 80,
      });

      expect(result.isTargetValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });
  });

  describe("Short trades", () => {
    it("computes Planned R:R, Risk, and Reward correctly for a Short trade with contract multiplier", () => {
      // e.g. ES E-mini Futures: entry 5000, stop 5010 (10 pts risk), target 4975 (25 pts reward), multiplier 50
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(500); // 10 * 1 * 50
      expect(result.rewardPerUnit).toBe(25);
      expect(result.totalReward).toBe(1250); // 25 * 1 * 50
      expect(result.plannedR).toBe(2.5);
      expect(result.plannedRFormatted).toBe("1 : 2.50R");
      expect(result.isStopValidForDirection).toBe(true);
      expect(result.isTargetValidForDirection).toBe(true);
    });

    it("correctly computes Realized R for closed Short trades", () => {
      const winResult = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
        grossPnl: 1000,
        isClosed: true,
      });
      expect(winResult.realizedR).toBe(2);
      expect(winResult.realizedRFormatted).toBe("+2.00R");

      const lossResult = computeTradePlanning({
        direction: "short",
        avgEntry: 5000,
        quantity: 1,
        contractMultiplier: 50,
        stopLoss: 5010,
        profitTarget: 4975,
        grossPnl: -500,
        isClosed: true,
      });
      expect(lossResult.realizedR).toBe(-1);
      expect(lossResult.realizedRFormatted).toBe("-1.00R");
    });

    it("flags invalid stop loss that is below entry price for a Short trade", () => {
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 95,
        profitTarget: 80,
      });

      expect(result.isStopValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });

    it("flags invalid profit target that is above entry price for a Short trade", () => {
      const result = computeTradePlanning({
        direction: "short",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 105,
        profitTarget: 110,
      });

      expect(result.isTargetValidForDirection).toBe(false);
      expect(result.plannedR).toBeNull();
      expect(result.plannedRFormatted).toBeNull();
    });
  });

  describe("Edge cases & Incomplete plans", () => {
    it("handles null stop loss gracefully", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: null,
        profitTarget: 120,
      });

      expect(result.riskPerUnit).toBeNull();
      expect(result.totalRisk).toBeNull();
      expect(result.rewardPerUnit).toBe(20);
      expect(result.plannedR).toBeNull();
      expect(result.realizedR).toBeNull();
    });

    it("handles null profit target gracefully", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: null,
      });

      expect(result.riskPerUnit).toBe(10);
      expect(result.totalRisk).toBe(10);
      expect(result.rewardPerUnit).toBeNull();
      expect(result.plannedR).toBeNull();
    });

    it("does not compute realized R if trade is open", () => {
      const result = computeTradePlanning({
        direction: "long",
        avgEntry: 100,
        quantity: 1,
        stopLoss: 90,
        profitTarget: 120,
        grossPnl: 15,
        isClosed: false,
      });

      expect(result.realizedR).toBeNull();
      expect(result.realizedRFormatted).toBeNull();
    });
  });
});

describe("formatFeeDisplay", () => {
  it("formats positive fees as negative currency deduction (-$X.XX)", () => {
    expect(formatFeeDisplay(5.2)).toBe("-$5.20");
    expect(formatFeeDisplay(142.5)).toBe("-$142.50");
    expect(formatFeeDisplay(0.01)).toBe("-$0.01");
  });

  it("formats zero fees as $0.00", () => {
    expect(formatFeeDisplay(0)).toBe("$0.00");
  });

  it("handles negative zero or zero-like numbers without producing positive or weird signs", () => {
    expect(formatFeeDisplay(-0)).toBe("$0.00");
    expect(formatFeeDisplay(-5)).toBe("$0.00");
  });

  it("NEVER outputs a positive +$ sign for fees under any circumstance", () => {
    const testCases = [0, 1, 5.2, 10, 99.99, 1000, 0.0001];
    for (const val of testCases) {
      const formatted = formatFeeDisplay(val);
      expect(formatted.startsWith("+")).toBe(false);
      expect(formatted).not.toContain("+$");
    }
  });

  it("supports alternative currencies like EUR and GBP with correct negative sign", () => {
    expect(formatFeeDisplay(10.5, "EUR")).toBe("-€10.50");
    expect(formatFeeDisplay(15.75, "GBP")).toBe("-£15.75");
    expect(formatFeeDisplay(0, "EUR")).toBe("€0.00");
    expect(formatFeeDisplay(0, "GBP")).toBe("£0.00");
  });
});
