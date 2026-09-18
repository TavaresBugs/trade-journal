import { describe, expect, it } from "vitest";
import {
  calculateExpectedValue,
  binomialProbability,
  getBinomialDistribution,
  runReturnsSimulation,
  NQ_DOLLARS_PER_POINT,
} from "../src/lib/quant-calculator";

describe("quant-calculator", () => {
  it("verifies NQ point multiplier is $20", () => {
    expect(NQ_DOLLARS_PER_POINT).toBe(20);
  });

  describe("calculateExpectedValue", () => {
    it("calculates EV correctly for standard parameters", () => {
      // (0.4 * 0.4 * 2000) - 89 = 320 - 89 = 231
      const ev = calculateExpectedValue(89, 40, 40, 2000);
      expect(ev).toBe(231.0);
    });

    it("calculates negative EV when cost exceeds expected return", () => {
      // (0.1 * 0.1 * 2000) - 89 = 20 - 89 = -69
      const ev = calculateExpectedValue(89, 10, 10, 2000);
      expect(ev).toBe(-69.0);
    });

    it("handles zero cost and zero probability edge cases", () => {
      expect(calculateExpectedValue(0, 0, 50, 2000)).toBe(0);
      expect(calculateExpectedValue(50, 0, 50, 2000)).toBe(-50);
      expect(calculateExpectedValue(0, 100, 100, 2000)).toBe(2000);
    });
  });

  describe("binomialProbability", () => {
    it("computes P(X=k) accurately for n=5, p=0.4", () => {
      // P(0) = 0.6^5 = 0.07776
      const p0 = binomialProbability(5, 0, 0.4);
      expect(p0).toBeCloseTo(0.07776, 4);

      // P(1) = 5 * 0.4 * 0.6^4 = 0.2592
      const p1 = binomialProbability(5, 1, 0.4);
      expect(p1).toBeCloseTo(0.2592, 4);
    });

    it("returns 0 for impossible k values", () => {
      expect(binomialProbability(5, -1, 0.4)).toBe(0);
      expect(binomialProbability(5, 6, 0.4)).toBe(0);
    });
  });

  describe("getBinomialDistribution", () => {
    it("generates a full distribution table that sums to ~100%", () => {
      const dist = getBinomialDistribution(5, 40);
      expect(dist.rows).toHaveLength(6);

      // Risk of ruin = P(0) = 7.78%
      expect(dist.riskOfRuin).toBeCloseTo(7.78, 1);
      // At least one = 100 - riskOfRuin = 92.22%
      expect(dist.atLeastOne).toBeCloseTo(92.22, 1);

      const sum = dist.rows.reduce((acc, r) => acc + r.probability, 0);
      expect(sum).toBeCloseTo(100, 0);
    });
  });

  describe("runReturnsSimulation", () => {
    it("runs Monte Carlo simulation and returns structured outcomes", () => {
      const res = runReturnsSimulation(500, 89, 40, 40, 2000, 100);
      expect(res.numAttempts).toBe(5); // Math.floor(500 / 89) = 5
      expect(typeof res.avgPayoutResult).toBe("number");
      expect(typeof res.avgNetProfit).toBe("number");
      expect(res.sampleOutcomes.length).toBeGreaterThan(0);
      expect(res.sampleOutcomes.length).toBeLessThanOrEqual(10);

      const outcome = res.sampleOutcomes[0]!;
      expect(typeof outcome.passed).toBe("boolean");
      expect(typeof outcome.fundedPassed).toBe("boolean");
      expect(typeof outcome.netPnl).toBe("number");
      expect(typeof outcome.description).toBe("string");
    });
  });
});
