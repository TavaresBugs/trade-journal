export const NQ_DOLLARS_PER_POINT = 20;

export interface SimulationOutcome {
  passed: boolean;
  fundedPassed: boolean;
  payoutAmount: number;
  netPnl: number;
  description: string;
}

export interface SimulationResults {
  numAttempts: number;
  avgPayoutResult: number;
  avgNetProfit: number;
  sampleOutcomes: SimulationOutcome[];
}

export interface BinomialRow {
  passes: number;
  probability: number;
}

export interface BinomialDistributionResult {
  rows: BinomialRow[];
  riskOfRuin: number;
  atLeastOne: number;
}

/**
 * Expected value per evaluation:
 * EV = (PassRate * PayoutChance * AvgPayout) - EvalCost
 */
export function calculateExpectedValue(
  evalCost: number,
  passRatePercent: number,
  payoutChancePercent: number,
  avgPayout: number,
): number {
  const pPass = passRatePercent / 100;
  const pPayout = payoutChancePercent / 100;
  const ev = pPass * pPayout * avgPayout - evalCost;
  return Number(ev.toFixed(2));
}

/**
 * Binomial probability mass function: P(X = k) = C(n, k) * p^k * (1 - p)^(n - k)
 */
export function binomialProbability(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 && n === 0) return 1;

  let coef = 1;
  for (let i = 1; i <= k; i++) {
    coef = (coef * (n - (k - i))) / i;
  }

  return coef * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/**
 * Generates binomial distribution table for n attempts.
 */
export function getBinomialDistribution(
  n: number,
  passRatePercent: number,
): BinomialDistributionResult {
  const p = Math.max(0, Math.min(100, passRatePercent)) / 100;
  const rows: BinomialRow[] = [];

  for (let k = 0; k <= n; k++) {
    const prob = binomialProbability(n, k, p);
    rows.push({
      passes: k,
      probability: Number((prob * 100).toFixed(2)),
    });
  }

  const riskOfRuin = rows[0]?.probability ?? 0;
  const atLeastOne = Number((100 - riskOfRuin).toFixed(2));

  return {
    rows,
    riskOfRuin,
    atLeastOne,
  };
}

/**
 * Monte Carlo returns simulation (1,000 trials by default).
 */
export function runReturnsSimulation(
  bankroll: number,
  evalCost: number,
  passRatePercent: number,
  payoutChancePercent: number,
  avgPayout: number,
  totalSimulations: number = 1000,
): SimulationResults {
  const validEvalCost = Math.max(1, evalCost);
  const numAttempts = Math.max(1, Math.floor(bankroll / validEvalCost));
  const pPass = Math.max(0, Math.min(100, passRatePercent)) / 100;
  const pPayout = Math.max(0, Math.min(100, payoutChancePercent)) / 100;

  let aggregateNetPnl = 0;
  let aggregatePayouts = 0;
  const sampleOutcomes: SimulationOutcome[] = [];

  for (let s = 0; s < totalSimulations; s++) {
    let simPnl = -(numAttempts * validEvalCost);
    let simPayouts = 0;

    for (let i = 0; i < numAttempts; i++) {
      const passed = Math.random() < pPass;
      let fundedPassed = false;
      let payout = 0;

      if (passed) {
        fundedPassed = Math.random() < pPayout;
        if (fundedPassed) {
          payout = avgPayout;
          simPayouts += payout;
          simPnl += payout;
        }
      }

      if (s === totalSimulations - 1 && sampleOutcomes.length < 10) {
        let desc = "";
        let net = -validEvalCost;
        if (passed && fundedPassed) {
          desc = `Eval passed, funded passed, payout $${avgPayout.toLocaleString("en-US")}`;
          net = avgPayout - validEvalCost;
        } else if (passed) {
          desc = "Eval passed, funded failed";
        } else {
          desc = "Eval failed";
        }

        sampleOutcomes.push({
          passed,
          fundedPassed,
          payoutAmount: payout,
          netPnl: net,
          description: desc,
        });
      }
    }

    aggregateNetPnl += simPnl;
    aggregatePayouts += simPayouts;
  }

  const avgPayoutResult = Math.round(aggregatePayouts / totalSimulations);
  const avgNetProfit = Math.round(aggregateNetPnl / totalSimulations);

  return {
    numAttempts,
    avgPayoutResult,
    avgNetProfit,
    sampleOutcomes: sampleOutcomes.slice(0, 10),
  };
}
