import { describe, expect, it } from "vitest";
import {
  calculateExpectedValue,
  binomialProbability,
  getBinomialDistribution,
  runReturnsSimulation,
  calculatePointValue,
  calculatePointsFromDollars,
  NQ_DOLLARS_PER_POINT,
  QUANT_INSTRUMENTS,
  PROP_FIRM_PRESETS,
} from "../src/quant";

describe("quant module (packages/core)", () => {
  it("verifies NQ point multiplier is $20", () => {
    expect(NQ_DOLLARS_PER_POINT).toBe(20);
  });

  it("exports standard instruments and presets", () => {
    expect(QUANT_INSTRUMENTS.length).toBeGreaterThanOrEqual(4);
    expect(PROP_FIRM_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  describe("calculateExpectedValue", () => {
    it("calculates EV correctly for standard parameters", () => {
      // (0.4 * 0.4 * 2000) - 89 = 320 - 89 = 231
      const ev = calculateExpectedValue(89, 40, 40, 2000);
      expect(ev).toBe(231.0);
    });

    it("calculates negative EV when cost exceeds expected return", () => {
      const ev = calculateExpectedValue(89, 10, 10, 2000);
      expect(ev).toBe(-69.0);
    });
  });

  describe("point value calculations", () => {
    it("converts points to dollars", () => {
      expect(calculatePointValue(8, 10, 20)).toBe(1600);
      expect(calculatePointValue(10, 1, 50)).toBe(500);
    });

    it("converts dollars to points", () => {
      expect(calculatePointsFromDollars(1600, 10, 20)).toBe(8);
      expect(calculatePointsFromDollars(500, 1, 50)).toBe(10);
    });
  });

  describe("binomial distribution", () => {
    it("computes exact binomial probability and sums to 100%", () => {
      const dist = getBinomialDistribution(5, 40);
      expect(dist.rows).toHaveLength(6);
      expect(dist.riskOfRuin).toBeCloseTo(7.78, 1);
      expect(dist.atLeastOne).toBeCloseTo(92.22, 1);
    });
  });

  describe("runReturnsSimulation", () => {
    it("executes Monte Carlo trials", () => {
      const res = runReturnsSimulation(500, 89, 40, 40, 2000, 50);
      expect(res.numAttempts).toBe(5);
      expect(typeof res.avgPayoutResult).toBe("number");
      expect(typeof res.avgNetProfit).toBe("number");
      expect(res.sampleOutcomes.length).toBeGreaterThan(0);
    });
  });
});
