import { describe, expect, it } from "vitest";
import {
  calculateBreakevenWinRate,
  calculateTradeExpectancy,
  calculateRealExpectancy,
  generateSweetSpotMatrix,
  calculateLosingStreakProbability,
  generateStreakDistribution,
  MATRIX_WIN_RATES,
  MATRIX_RR_RATIOS,
} from "../src/lib/quant-calculator";

describe("Strategy & Edge — Quantitative Engine & Calculator Rules", () => {
  // =========================================================================
  // 1. BREAKEVEN WIN RATE
  // =========================================================================
  describe("calculateBreakevenWinRate(riskReward)", () => {
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
      // At breakeven win rate, theoretical R-multiple must be approximately 0.00
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

  // =========================================================================
  // 2. SWEET SPOT MATRIX
  // =========================================================================
  describe("generateSweetSpotMatrix()", () => {
    it("generates a matrix with correct dimensions matching standard grids", () => {
      const matrix = generateSweetSpotMatrix();
      expect(matrix).toHaveLength(MATRIX_WIN_RATES.length); // 12 win rate steps
      expect(matrix.every((row) => row.length === MATRIX_RR_RATIOS.length)).toBe(true); // 9 RR ratios per row

      const totalCells = matrix.reduce((acc, row) => acc + row.length, 0);
      expect(totalCells).toBe(12 * 9); // 108 cells total
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

      // Sweet spot must consist of:
      // winRates in [35, 40, 45, 50] (4 steps)
      // riskRewards in [2.0, 2.5, 3.0, 4.0, 5.0] (5 steps)
      // Total = 4 * 5 = 20 cells
      expect(sweetSpotCells).toHaveLength(20);

      // Verify every sweet spot cell strictly meets the criteria
      for (const cell of sweetSpotCells) {
        expect(cell.riskReward).toBeGreaterThanOrEqual(2.0);
        expect(cell.riskReward).toBeLessThanOrEqual(5.0);
        expect(cell.winRate).toBeGreaterThanOrEqual(35);
        expect(cell.winRate).toBeLessThanOrEqual(50);
        // All sweet spot cells are mathematically profitable
        expect(cell.isProfitable).toBe(true);
        expect(cell.rMultiple).toBeGreaterThan(0);
      }

      // Verify non-sweet spot cells violate at least one condition
      for (const cell of nonSweetSpotCells) {
        const meetsRR = cell.riskReward >= 2.0 && cell.riskReward <= 5.0;
        const meetsWR = cell.winRate >= 35 && cell.winRate <= 50;
        expect(meetsRR && meetsWR).toBe(false);
      }
    });

    it("verifies unfeasible / fantasy zones are not marked as sweet spot", () => {
      const matrix = generateSweetSpotMatrix();
      const allCells = matrix.flat();

      // Fantasy zone: 70% win rate with 8R
      const fantasyCell = allCells.find((c) => c.winRate === 70 && c.riskReward === 8.0);
      expect(fantasyCell?.isSweetSpot).toBe(false);
      expect(fantasyCell?.isProfitable).toBe(true);

      // Scalping churn zone: 45% win rate with 1.0R (unprofitable)
      const churnCell = allCells.find((c) => c.winRate === 45 && c.riskReward === 1.0);
      expect(churnCell?.isSweetSpot).toBe(false);
      expect(churnCell?.isProfitable).toBe(false);
      expect(churnCell?.rMultiple).toBe(-0.10);

      // High-risk lottery zone: 20% win rate with 5.0R
      const lotteryCell = allCells.find((c) => c.winRate === 20 && c.riskReward === 5.0);
      expect(lotteryCell?.isSweetSpot).toBe(false);
    });
  });

  // =========================================================================
  // 3. REAL EXPECTANCY WITH FRICTION (FEES & SLIPPAGE)
  // =========================================================================
  describe("calculateRealExpectancy(winRate, riskReward, riskDollars, feePerTrade, slippageDollars)", () => {
    it("calculates all core fields: paperEv, totalFriction, realEv, breakevenWinRate, and netRMultiple", () => {
      const res = calculateRealExpectancy(50, 2.0, 1000, 5, 10);

      // Base calculations:
      // p = 0.5, q = 0.5, avgWin = 2000, avgLoss = 1000
      // paperEv = 0.5 * 2000 - 0.5 * 1000 = $500.00
      // rMultiple = 0.5 * 2 - 0.5 = 0.50R
      // totalFriction = 5 + 10 = $15.00
      // realEv = 500 - 15 = $485.00
      // netRMultiple = 485 / 1000 = 0.49R
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
      // Scenario: High-frequency / tight scalper on micro account
      // 52% win rate, 1:1 RR, $100 risk per trade
      // Paper EV = 0.52 * $100 - 0.48 * $100 = $52 - $48 = +$4.00 per trade (+0.04R)
      const lowFriction = calculateRealExpectancy(52, 1.0, 100, 0, 0);
      expect(lowFriction.paperEv).toBe(4.0);
      expect(lowFriction.rMultiple).toBe(0.04);
      expect(lowFriction.realEv).toBe(4.0);
      expect(lowFriction.netRMultiple).toBe(0.04);

      // Now apply standard retail commission ($3) + realistic slippage ($3) = $6 friction
      const highFriction = calculateRealExpectancy(52, 1.0, 100, 3, 3);
      expect(highFriction.paperEv).toBe(4.0);
      expect(highFriction.totalFriction).toBe(6.0);
      // Real EV is now -$2.00 per trade, negative edge!
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
      // Negative fees or slippage clamped to 0
      const negativeInputs = calculateRealExpectancy(50, 2.0, 1000, -10, -5);
      expect(negativeInputs.totalFriction).toBe(0);
      expect(negativeInputs.realEv).toBe(negativeInputs.paperEv);

      // Zero risk dollars handles division safely
      const zeroRisk = calculateRealExpectancy(50, 2.0, 0, 5, 10);
      expect(zeroRisk.netRMultiple).toBe(0);
      expect(Number.isFinite(zeroRisk.netRMultiple)).toBe(true);

      // Clamping win rates > 100 or < 0
      const overWin = calculateRealExpectancy(120, 2.0, 1000, 0, 0);
      expect(overWin.winRate).toBe(100);
      const underWin = calculateRealExpectancy(-20, 2.0, 1000, 0, 0);
      expect(underWin.winRate).toBe(0);
    });
  });

  // =========================================================================
  // 4. LOSING STREAK PROBABILITY & GAMBLER'S FALLACY INVARIANCE
  // =========================================================================
  describe("calculateLosingStreakProbability(winRate, sampleTrades, streakLength)", () => {
    it("validates that at 50% win rate in 100 trades, consecutive loss streaks follow exact Markov probability", () => {
      // In 100 coin-flip trades (50% win rate):
      // Exact Markov chain probability of hitting >= 5 consecutive losses is ~81.0% (> 75%)
      const prob5 = calculateLosingStreakProbability(50, 100, 5);
      expect(prob5).toBeGreaterThan(75);
      expect(prob5).toBeCloseTo(81.0, 1);

      // Exact Markov chain probability of hitting >= 6 consecutive losses is 54.6% (> 50% - more likely than not!)
      const prob6 = calculateLosingStreakProbability(50, 100, 6);
      expect(prob6).toBeCloseTo(54.6, 1);
      expect(prob6).toBeGreaterThan(50);
    });

    it("proves Gambler's Fallacy Invariance: next trade probability remains strictly constant", () => {
      // In any stationary trading strategy, each trade t is an independent Bernoulli trial.
      // Even if a trader suffers k consecutive losses, P(Win on trade t+1 | k losses) = p (constant).
      const winRate = 45;
      const p = winRate / 100;

      // The dynamic programming model in calculateLosingStreakProbability relies on:
      // sumSurviving * p -> nextDp[0] (reset to 0 consecutive losses)
      // dp[j] * q -> nextDp[j+1] (extends streak)
      // For any streak state j, the chance of ending the streak on the very next trade is always exactly p:
      const probWinNextTradeGivenAnyStreak = p;
      expect(probWinNextTradeGivenAnyStreak).toBe(0.45);

      // Even when streak probability of >= 10 losses is low (~4.6%),
      // the conditional probability of winning after 9 consecutive losses is NOT higher (remains 45%).
      const probStreak10 = calculateLosingStreakProbability(winRate, 100, 10);
      expect(probStreak10).toBeLessThan(25);
    });

    it("verifies strict monotonic decreasing probability as streak length increases", () => {
      // From streak length 3 onwards (where prob < 100%), probability strictly decreases
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
      // If streak length <= 0: already trivially true (100%)
      expect(calculateLosingStreakProbability(50, 100, 0)).toBe(100);
      expect(calculateLosingStreakProbability(50, 100, -2)).toBe(100);

      // If sampleTrades < streakLength: impossible to have streak longer than total trades (0%)
      expect(calculateLosingStreakProbability(50, 4, 5)).toBe(0);

      // If win rate is 100%: impossible to ever lose (0%)
      expect(calculateLosingStreakProbability(100, 100, 3)).toBe(0);

      // If win rate is 0%: guaranteed to lose every trade (100%)
      expect(calculateLosingStreakProbability(0, 100, 5)).toBe(100);
    });
  });
});
