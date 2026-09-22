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
  MATRIX_WIN_RATES,
  MATRIX_RR_RATIOS,
} from "../src/quant";

describe("quant module (packages/core)", () => {
  it("verifies NQ point multiplier is $20", () => {
    expect(NQ_DOLLARS_PER_POINT).toBe(20);
  });

  it("exports standard instruments and presets", () => {
    expect(QUANT_INSTRUMENTS.length).toBeGreaterThanOrEqual(14);
    expect(PROP_FIRM_PRESETS.length).toBeGreaterThanOrEqual(5);

    // Verify key commodity and rates futures
    const silver = QUANT_INSTRUMENTS.find((i) => i.id === "SI");
    expect(silver?.multiplier).toBe(5000);
    expect(silver?.microId).toBe("SIL");

    const copper = QUANT_INSTRUMENTS.find((i) => i.id === "HG");
    expect(copper?.multiplier).toBe(250);
    expect(copper?.microId).toBe("MHG");

    const natgas = QUANT_INSTRUMENTS.find((i) => i.id === "NG");
    expect(natgas?.multiplier).toBe(10000);

    const eth = QUANT_INSTRUMENTS.find((i) => i.id === "ETH");
    expect(eth?.multiplier).toBe(50);
    expect(eth?.microId).toBe("MET");

    const tnote = QUANT_INSTRUMENTS.find((i) => i.id === "ZN");
    expect(tnote?.multiplier).toBe(1000);
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

    it("sizes Gold (GC $100/pt) accurately for commodity stops", () => {
      // 10 pts stop on GC ($100/pt) = $1,000 cost per contract. With $1,000 risk -> 1 GC (or 10 MGC)
      const sizing = calculatePositionSize(1000, 10, 100, 20);
      expect(sizing.recommendedContracts).toBe(1);
      expect(sizing.microContracts).toBe(10);
      expect(sizing.actualRiskDollars).toBe(1000);
      expect(sizing.targetDollars).toBe(2000);
    });

    it("sizes Russell 2000 (RTY $50/pt) and Crude Oil (CL $1,000/pt)", () => {
      // RTY: 10 pts stop ($50/pt) = $500 per contract. With $1,500 risk -> 3 contracts
      const rtySizing = calculatePositionSize(1500, 10, 50);
      expect(rtySizing.recommendedContracts).toBe(3);
      expect(rtySizing.microContracts).toBe(30);
      expect(rtySizing.actualRiskDollars).toBe(1500);

      // CL: 0.50 pts stop ($1,000/pt) = $500 per contract. With $1,000 risk -> 2 contracts
      const clSizing = calculatePositionSize(1000, 0.5, 1000);
      expect(clSizing.recommendedContracts).toBe(2);
      expect(clSizing.microContracts).toBe(20);
      expect(clSizing.actualRiskDollars).toBe(1000);
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
    it("computes exact breakeven win rate for standard Risk:Reward ratios", () => {
      // Formula: BE% = 1 / (1 + RR) * 100
      expect(calculateBreakevenWinRate(1.0)).toBe(50.0);
      expect(calculateBreakevenWinRate(1.5)).toBe(40.0);
      expect(calculateBreakevenWinRate(2.0)).toBe(33.33);
      expect(calculateBreakevenWinRate(2.5)).toBe(28.57);
      expect(calculateBreakevenWinRate(3.0)).toBe(25.0);
      expect(calculateBreakevenWinRate(4.0)).toBe(20.0);
      expect(calculateBreakevenWinRate(5.0)).toBe(16.67);
      expect(calculateBreakevenWinRate(8.0)).toBe(11.11);
    });

    it("satisfies the zero-expectancy invariance property at breakeven", () => {
      const ratios = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0];
      for (const rr of ratios) {
        const be = calculateBreakevenWinRate(rr);
        const p = be / 100;
        const q = 1 - p;
        const expectedR = p * rr - q * 1.0;
        expect(Math.abs(expectedR)).toBeLessThan(0.01);
      }
    });

    it("exhibits strictly monotonic decreasing behavior as RR increases", () => {
      let previousBE = 100;
      for (const rr of MATRIX_RR_RATIOS) {
        const currentBE = calculateBreakevenWinRate(rr);
        expect(currentBE).toBeLessThan(previousBE);
        previousBE = currentBE;
      }
    });

    it("handles boundary and extreme inputs safely", () => {
      expect(calculateBreakevenWinRate(0)).toBe(100);
      expect(calculateBreakevenWinRate(-1.5)).toBe(100);
      expect(calculateBreakevenWinRate(99.0)).toBe(1.0);
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

    it("calculates all core fields: paperEv, totalFriction, realEv, breakevenWinRate, and netRMultiple", () => {
      const res = calculateRealExpectancy(50, 2.0, 1000, 5, 10);
      expect(res.paperEv).toBe(500.0);
      expect(res.rMultiple).toBe(0.5);
      expect(res.totalFriction).toBe(15);
      expect(res.realEv).toBe(485.0);
      expect(res.breakevenWinRate).toBe(33.33);
      expect(res.netRMultiple).toBe(0.48);
      expect(res.winRate).toBe(50);
      expect(res.lossRate).toBe(50);
      expect(res.avgWin).toBe(2000);
      expect(res.avgLoss).toBe(1000);
    });

    it("matches paper expectation perfectly when friction is zero", () => {
      const zeroFriction = calculateRealExpectancy(45, 2.5, 1000, 0, 0);
      const basePaper = calculateTradeExpectancy(45, 2.5, 1000);

      expect(zeroFriction.totalFriction).toBe(0);
      expect(zeroFriction.realEv).toBe(basePaper.paperEv);
      expect(zeroFriction.netRMultiple).toBe(basePaper.rMultiple);
    });

    it("demonstrates how theoretical positive edge is wiped out by execution friction", () => {
      const lowFriction = calculateRealExpectancy(52, 1.0, 100, 0, 0);
      expect(lowFriction.paperEv).toBe(4.0);
      expect(lowFriction.rMultiple).toBe(0.04);
      expect(lowFriction.realEv).toBe(4.0);
      expect(lowFriction.netRMultiple).toBe(0.04);

      const highFriction = calculateRealExpectancy(52, 1.0, 100, 3, 3);
      expect(highFriction.paperEv).toBe(4.0);
      expect(highFriction.totalFriction).toBe(6.0);
      expect(highFriction.realEv).toBe(-2.0);
      expect(highFriction.netRMultiple).toBe(-0.02);
      expect(highFriction.realEv).toBeLessThan(0);
    });

    it("verifies that friction monotonically degrades the expected net R-multiple", () => {
      const frictions = [0, 5, 15, 30, 60, 100];
      let lastRealEv = Infinity;
      let lastNetR = Infinity;

      for (const f of frictions) {
        const res = calculateRealExpectancy(45, 2.5, 1000, f / 2, f / 2);
        expect(res.realEv).toBeLessThanOrEqual(lastRealEv);
        expect(res.netRMultiple).toBeLessThanOrEqual(lastNetR);
        expect(res.paperEv - res.realEv).toBe(res.totalFriction);
        lastRealEv = res.realEv;
        lastNetR = res.netRMultiple;
      }
    });

    it("handles zero or negative inputs defensively", () => {
      const negativeInputs = calculateRealExpectancy(50, 2.0, 1000, -10, -5);
      expect(negativeInputs.totalFriction).toBe(0);
      expect(negativeInputs.realEv).toBe(negativeInputs.paperEv);

      const zeroRisk = calculateRealExpectancy(50, 2.0, 0, 5, 10);
      expect(zeroRisk.netRMultiple).toBe(0);
      expect(Number.isFinite(zeroRisk.netRMultiple)).toBe(true);

      const overWin = calculateRealExpectancy(120, 2.0, 1000, 0, 0);
      expect(overWin.winRate).toBe(100);
      const underWin = calculateRealExpectancy(-20, 2.0, 1000, 0, 0);
      expect(underWin.winRate).toBe(0);
    });
  });

  describe("sweet spot matrix", () => {
    it("generates full matrix with sweet spot highlights and correct dimensions", () => {
      const matrix = generateSweetSpotMatrix();
      expect(matrix).toHaveLength(MATRIX_WIN_RATES.length);
      expect(matrix.every((row) => row.length === MATRIX_RR_RATIOS.length)).toBe(true);

      const totalCells = matrix.reduce((acc, row) => acc + row.length, 0);
      expect(totalCells).toBe(12 * 9);
    });

    it("ensures every cell contains mathematically exact R-multiples (p * rr - (1 - p))", () => {
      const matrix = generateSweetSpotMatrix();

      for (const row of matrix) {
        for (const cell of row) {
          const p = cell.winRate / 100;
          const q = 1 - p;
          const expectedRMultiple = Number((p * cell.riskReward - q).toFixed(2));
          const expectedBe = calculateBreakevenWinRate(cell.riskReward);

          expect(cell.rMultiple).toBe(expectedRMultiple);
          expect(cell.breakevenWinRate).toBe(expectedBe);
          expect(cell.isProfitable).toBe(cell.winRate > expectedBe);
          expect(cell.isBreakeven).toBe(Math.abs(cell.winRate - expectedBe) <= 2.5);
        }
      }
    });

    it("strictly isolates the Sweet Spot zone (2R to 5R with 35% to 50% Win Rate)", () => {
      const matrix = generateSweetSpotMatrix();
      const allCells = matrix.flat();

      const sweetSpotCells = allCells.filter((c) => c.isSweetSpot);
      const nonSweetSpotCells = allCells.filter((c) => !c.isSweetSpot);

      expect(sweetSpotCells).toHaveLength(20);

      for (const cell of sweetSpotCells) {
        expect(cell.riskReward).toBeGreaterThanOrEqual(2.0);
        expect(cell.riskReward).toBeLessThanOrEqual(5.0);
        expect(cell.winRate).toBeGreaterThanOrEqual(35);
        expect(cell.winRate).toBeLessThanOrEqual(50);
        expect(cell.isProfitable).toBe(true);
        expect(cell.rMultiple).toBeGreaterThan(0);
      }

      for (const cell of nonSweetSpotCells) {
        const meetsRR = cell.riskReward >= 2.0 && cell.riskReward <= 5.0;
        const meetsWR = cell.winRate >= 35 && cell.winRate <= 50;
        expect(meetsRR && meetsWR).toBe(false);
      }
    });

    it("verifies unfeasible / fantasy zones are not marked as sweet spot", () => {
      const matrix = generateSweetSpotMatrix();
      const allCells = matrix.flat();

      const fantasyCell = allCells.find((c) => c.winRate === 70 && c.riskReward === 8.0);
      expect(fantasyCell?.isSweetSpot).toBe(false);
      expect(fantasyCell?.isProfitable).toBe(true);

      const churnCell = allCells.find((c) => c.winRate === 45 && c.riskReward === 1.0);
      expect(churnCell?.isSweetSpot).toBe(false);
      expect(churnCell?.isProfitable).toBe(false);
      expect(churnCell?.rMultiple).toBe(-0.1);

      const lotteryCell = allCells.find((c) => c.winRate === 20 && c.riskReward === 5.0);
      expect(lotteryCell?.isSweetSpot).toBe(false);
    });
  });

  describe("losing streak probability", () => {
    it("calculates probability of losing streaks in a 100-trade sample using exact Markov probability", () => {
      const prob5 = calculateLosingStreakProbability(50, 100, 5);
      expect(prob5).toBeGreaterThan(75);
      expect(prob5).toBeCloseTo(81.0, 1);

      const prob6 = calculateLosingStreakProbability(50, 100, 6);
      expect(prob6).toBeCloseTo(54.6, 1);
      expect(prob6).toBeGreaterThan(50);
    });

    it("proves Gambler's Fallacy Invariance: next trade probability remains strictly constant", () => {
      const winRate = 45;
      const p = winRate / 100;
      const probWinNextTradeGivenAnyStreak = p;
      expect(probWinNextTradeGivenAnyStreak).toBe(0.45);

      const probStreak10 = calculateLosingStreakProbability(winRate, 100, 10);
      expect(probStreak10).toBeLessThan(25);
    });

    it("verifies strict monotonic decreasing probability as streak length increases", () => {
      const streaks = [3, 4, 5, 6, 7, 8, 9, 10];
      let prevProb = 101;

      for (const k of streaks) {
        const prob = calculateLosingStreakProbability(50, 100, k);
        expect(prob).toBeLessThan(prevProb);
        prevProb = prob;
      }
    });

    it("verifies sample size impact: longer sample windows monotonically increase streak risk", () => {
      const sampleSizes = [25, 50, 100, 250, 500];
      let prevProb = -1;

      for (const n of sampleSizes) {
        const prob = calculateLosingStreakProbability(50, n, 6);
        expect(prob).toBeGreaterThanOrEqual(prevProb);
        prevProb = prob;
      }
    });

    it("generates structured streak distribution accurately", () => {
      const streaks = [3, 4, 5, 6, 7, 8, 10];
      const distribution = generateStreakDistribution(50, 100, streaks);

      expect(distribution).toHaveLength(streaks.length);

      distribution.forEach((item, idx) => {
        expect(item.streak).toBe(streaks[idx]);
        const directProb = calculateLosingStreakProbability(50, 100, item.streak);
        expect(item.probability).toBe(directProb);
      });
    });

    it("handles boundary and trivial cases according to probability theory", () => {
      expect(calculateLosingStreakProbability(50, 100, 0)).toBe(100);
      expect(calculateLosingStreakProbability(50, 100, -2)).toBe(100);
      expect(calculateLosingStreakProbability(50, 4, 5)).toBe(0);
      expect(calculateLosingStreakProbability(100, 100, 3)).toBe(0);
      expect(calculateLosingStreakProbability(0, 100, 5)).toBe(100);
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
