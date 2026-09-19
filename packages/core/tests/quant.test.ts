import { describe, expect, it } from "vitest";
import {
  calculateExpectedValue,
  binomialProbability,
  getBinomialDistribution,
  runReturnsSimulation,
  calculatePointValue,
  calculatePointsFromDollars,
  calculatePositionSize,
  calculateBreakevenWinRate,
  calculateTradeExpectancy,
  calculateRealExpectancy,
  generateSweetSpotMatrix,
  calculateLosingStreakProbability,
  generateStreakDistribution,
  calculateRecoveryPercentage,
  calculateDrawdown50Probability,
  calculateFundedSurvival,
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

    it("handles zero simulations without NaN", () => {
      const result = runReturnsSimulation(500, 89, 40, 40, 2000, 0);
      expect(Number.isNaN(result.avgPayoutResult)).toBe(false);
      expect(Number.isNaN(result.avgNetProfit)).toBe(false);
      expect(result.avgPayoutResult).toBe(0);
      expect(result.avgNetProfit).toBe(0);
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


  describe("breakeven win rate", () => {
    it("computes 50% for 1R system", () => {
      expect(calculateBreakevenWinRate(1.0)).toBe(50.0);
    });

    it("computes 33.33% for 2R system", () => {
      expect(calculateBreakevenWinRate(2.0)).toBe(33.33);
    });

    it("computes 20% for 4R system", () => {
      expect(calculateBreakevenWinRate(4.0)).toBe(20.0);
    });
  });

  describe("trade expectancy & friction", () => {
    it("calculates paper expectancy for standard 50% win rate at 2R", () => {
      // win 50% * $2,000 - loss 50% * $1,000 = $1,000 - $500 = $500
      const res = calculateTradeExpectancy(50, 2.0, 1000);
      expect(res.paperEv).toBe(500.0);
      expect(res.rMultiple).toBe(0.5);
      expect(res.breakevenWinRate).toBe(33.33);
    });

    it("calculates real expectancy deducting fees and slippage", () => {
      const res = calculateRealExpectancy(50, 2.0, 1000, 10, 25);
      expect(res.paperEv).toBe(500.0);
      expect(res.totalFriction).toBe(35);
      expect(res.realEv).toBe(465.0);
      expect(res.netRMultiple).toBe(0.47);
    });
  });

  describe("sweet spot matrix", () => {
    it("generates full matrix with sweet spot highlights", () => {
      const matrix = generateSweetSpotMatrix();
      expect(matrix.length).toBe(12); // 12 win rates
      expect(matrix[0]?.length).toBe(9); // 9 RR ratios

      // Check sweet spot in 40% win rate with 3R
      const row40 = matrix.find((r) => r[0]?.winRate === 40);
      const cell40_3R = row40?.find((c) => c.riskReward === 3.0);
      expect(cell40_3R?.isSweetSpot).toBe(true);
      expect(cell40_3R?.isProfitable).toBe(true);

      // Check unfeasible zone: 70% win rate with 8R is not sweet spot
      const row70 = matrix.find((r) => r[0]?.winRate === 70);
      const cell70_8R = row70?.find((c) => c.riskReward === 8.0);
      expect(cell70_8R?.isSweetSpot).toBe(false);
    });
  });

  describe("losing streak probability", () => {
    it("calculates probability of losing streaks in a 100-trade sample", () => {
      // At 50% win rate in 100 trades, prob of 5 consecutive losses is ~81%
      const prob5 = calculateLosingStreakProbability(50, 100, 5);
      expect(prob5).toBeGreaterThan(75);
      expect(prob5).toBeCloseTo(81.0, 0);

      // At 50% win rate in 100 trades, prob of 10 consecutive losses is small (~5% - 10%)
      const prob10 = calculateLosingStreakProbability(50, 100, 10);
      expect(prob10).toBeGreaterThan(1);
      expect(prob10).toBeLessThan(20);

      const dist = generateStreakDistribution(50, 100, [4, 6, 8]);
      expect(dist).toHaveLength(3);
      expect(dist[0]!.probability).toBeGreaterThan(dist[1]!.probability);
      expect(dist[1]!.probability).toBeGreaterThan(dist[2]!.probability);
    });
  });

  describe("loss recovery asymmetry", () => {
    it("matches standard asymmetric recovery rules", () => {
      expect(calculateRecoveryPercentage(10)).toBe(11.1);
      expect(calculateRecoveryPercentage(20)).toBe(25.0);
      expect(calculateRecoveryPercentage(50)).toBe(100.0);
      expect(calculateRecoveryPercentage(80)).toBe(400.0);
    });
  });

  describe("drawdown 50% risk probability", () => {
    it("matches video chart 6 calibrations", () => {
      expect(calculateDrawdown50Probability(0.5)).toBe(0.1);
      expect(calculateDrawdown50Probability(1.0)).toBe(1.8);
      expect(calculateDrawdown50Probability(2.0)).toBe(18.2);
      expect(calculateDrawdown50Probability(5.0)).toBe(65.4);
    });
  });

  describe("funded account survival", () => {
    it("reveals real risk on $3,000 drawdown cushion for 50k account", () => {
      // $500 risk is 1.0% of nominal 50k, but 16.7% of the 3k drawdown cushion!
      const res = calculateFundedSurvival(3000, 500, 50000, 45, 100);
      expect(res.nominalRiskPercent).toBe(1.0);
      expect(res.cushionRiskPercent).toBe(16.7);
      expect(res.lossesToBreach).toBe(6);
      expect(res.cushionRuinProbability).toBeGreaterThan(10);
      expect(res.cushionRuinProbability).toBeLessThan(25);
      expect(res.category).toBe("Dangerous");
    });

    it("calculates conservative sizing for 10k account ($1,000 drawdown)", () => {
      // $50 risk on 1k drawdown = 5% cushion risk, 20 losses to breach
      const res = calculateFundedSurvival(1000, 50, 10000, 45, 100);
      expect(res.cushionRiskPercent).toBe(5.0);
      expect(res.lossesToBreach).toBe(20);
      expect(res.cushionRuinProbability).toBeLessThan(1.0);
      expect(res.category).toBe("Conservative");
    });
  });
});


