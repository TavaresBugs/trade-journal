import { describe, expect, it } from "vitest";
import {
  calculateExpectedValue,
  binomialProbability,
  getBinomialDistribution,
  runReturnsSimulation,
  calculatePointValue,
  calculatePointsFromDollars,
  calculatePositionSize,
  EXECUTION_PRESETS,
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

      // Verify cumulative probabilities P(X >= k)
      expect(dist.rows[0]!.cumulativeProbability).toBeCloseTo(100, 1);
      expect(dist.rows[1]!.cumulativeProbability).toBeCloseTo(92.22, 1);
      expect(dist.rows[2]!.cumulativeProbability).toBeCloseTo(66.3, 1);
      expect(dist.rows[3]!.cumulativeProbability).toBeCloseTo(31.74, 1);
      expect(dist.rows[4]!.cumulativeProbability).toBeCloseTo(8.7, 1);
      expect(dist.rows[5]!.cumulativeProbability).toBeCloseTo(1.02, 1);
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

  describe("calculatePositionSize (JJ Simon execution rules)", () => {
    it("sizes 2 NQ contracts for standard 50k eval (25 pts SL, $1000 risk)", () => {
      const sizing = calculatePositionSize(1000, 25, 20, 38);
      expect(sizing.recommendedContracts).toBe(2);
      expect(sizing.exactContracts).toBe(2);
      expect(sizing.microContracts).toBe(20);
      expect(sizing.actualRiskDollars).toBe(1000);
      expect(sizing.targetDollars).toBe(1520);
      expect(sizing.riskRewardRatio).toBe(1.52);
    });

    it("sizes 1 NQ contract for funded consistency (25 pts SL, $500 risk)", () => {
      const sizing = calculatePositionSize(500, 25, 20, 70);
      expect(sizing.recommendedContracts).toBe(1);
      expect(sizing.exactContracts).toBe(1);
      expect(sizing.microContracts).toBe(10);
      expect(sizing.actualRiskDollars).toBe(500);
      expect(sizing.targetDollars).toBe(1400);
      expect(sizing.riskRewardRatio).toBe(2.8);
    });

    it("sizes 5 NQ contracts when dollar risk allows more contracts (10 pts SL, $1000 risk)", () => {
      // 10 pts * $20 = $200 per contract -> $1000 / $200 = 5 contracts!
      const sizing = calculatePositionSize(1000, 10, 20, 20);
      expect(sizing.recommendedContracts).toBe(5);
      expect(sizing.actualRiskDollars).toBe(1000);
      expect(sizing.targetDollars).toBe(2000);
      expect(sizing.riskRewardRatio).toBe(2);
    });

    it("handles arbitrary fractional stops with micro contracts", () => {
      // $500 risk with 16.5 pts stop on NQ ($20/pt): 500 / (16.5 * 20) = 500 / 330 = 1.515 NQ
      // Floored to 1 contract so actual risk ($330) never exceeds $500!
      const sizing = calculatePositionSize(500, 16.5, 20);
      expect(sizing.recommendedContracts).toBe(1);
      expect(sizing.exactContracts).toBe(1.52);
      expect(sizing.microContracts).toBe(10);
      expect(sizing.actualRiskDollars).toBe(330);
    });

    it("sizes 1 contract with proportional risk when stop is 100 pts ($2,000 risk)", () => {
      // 100 pts stop on NQ ($20/pt) = $2,000 risk for 1 contract
      const sizing = calculatePositionSize(2000, 100, 20, 38);
      expect(sizing.recommendedContracts).toBe(1);
      expect(sizing.microContracts).toBe(10);
      expect(sizing.actualRiskDollars).toBe(2000);
      expect(sizing.targetDollars).toBe(760);
      expect(sizing.riskRewardRatio).toBe(0.38);
    });

    it("handles zero or invalid inputs safely", () => {
      expect(calculatePositionSize(0, 25, 20).recommendedContracts).toBe(0);
      expect(calculatePositionSize(500, 0, 20).recommendedContracts).toBe(0);
      // Tight stop points where costPerContract rounds to 0
      const tight = calculatePositionSize(500, 0.001, 10);
      expect(tight.recommendedContracts).toBe(0);
      expect(tight.exactContracts).toBe(0);
      expect(Number.isFinite(tight.exactContracts)).toBe(true);
    });
  });

  describe("runReturnsSimulation safety", () => {
    it("handles zero simulations without NaN", () => {
      const result = runReturnsSimulation(1, 0.4, 89, 2000, 0);
      expect(Number.isNaN(result.avgPayoutResult)).toBe(false);
      expect(Number.isNaN(result.avgNetProfit)).toBe(false);
    });
  });
});
