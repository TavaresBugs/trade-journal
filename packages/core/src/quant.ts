export const NQ_DOLLARS_PER_POINT = 20;

export interface QuantInstrument {
  id: string;
  name: string;
  multiplier: number;
  tickSize: number;
}

export const QUANT_INSTRUMENTS: readonly QuantInstrument[] = [
  { id: "NQ", name: "NQ ($20/pt)", multiplier: 20, tickSize: 0.25 },
  { id: "MNQ", name: "MNQ ($2/pt)", multiplier: 2, tickSize: 0.25 },
  { id: "ES", name: "ES ($50/pt)", multiplier: 50, tickSize: 0.25 },
  { id: "MES", name: "MES ($5/pt)", multiplier: 5, tickSize: 0.25 },
] as const;

export interface PropFirmPreset {
  id: string;
  name: string;
  cost: number;
  defaultPassRate: number;
}

export const PROP_FIRM_PRESETS: readonly PropFirmPreset[] = [
  { id: "topstep-50k", name: "Topstep 50K", cost: 89, defaultPassRate: 40 },
  { id: "topstep-50k-promo", name: "Topstep 50K Promo", cost: 49, defaultPassRate: 40 },
  { id: "lucid-flex-25k", name: "Lucid Flex 25K", cost: 70, defaultPassRate: 45 },
  { id: "tradeify-25k", name: "Tradeify 25K", cost: 65, defaultPassRate: 48 },
  { id: "apex-50k", name: "Apex 50K", cost: 35, defaultPassRate: 35 },
  { id: "mffu-50k", name: "MFFU 50K", cost: 75, defaultPassRate: 40 },
] as const;

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

/**
 * Calculates dollar profit/loss from chart points, contracts, and instrument multiplier.
 */
export function calculatePointValue(points: number, contracts: number, multiplier: number): number {
  return Math.round(points * contracts * multiplier);
}

/**
 * Calculates chart points from target dollars, contracts, and instrument multiplier.
 */
export function calculatePointsFromDollars(
  dollars: number,
  contracts: number,
  multiplier: number,
): number {
  if (contracts <= 0 || multiplier <= 0) return 0;
  return Number((dollars / (contracts * multiplier)).toFixed(2));
}

export type ExecutionMode = "eval" | "funded" | "custom";

export interface ExecutionPreset {
  id: ExecutionMode;
  label: string;
  description: string;
  riskDollars: number;
  stopPoints: number;
  targetPoints: number;
  contracts: number;
}

export const EXECUTION_PRESETS: Record<ExecutionMode, ExecutionPreset> = {
  eval: {
    id: "eval",
    label: "Eval (50K)",
    description: "25 pts stop, 38 pts target (1:1.5R), 2 NQ contracts",
    riskDollars: 1000,
    stopPoints: 25,
    targetPoints: 38,
    contracts: 2,
  },
  funded: {
    id: "funded",
    label: "Funded (Consistency)",
    description: "25 pts stop, 70 pts target (1:2.8R), 1 NQ contract",
    riskDollars: 500,
    stopPoints: 25,
    targetPoints: 70,
    contracts: 1,
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "Manual risk and technical stop points",
    riskDollars: 500,
    stopPoints: 20,
    targetPoints: 40,
    contracts: 1,
  },
};

export interface PositionSizeResult {
  recommendedContracts: number;
  exactContracts: number;
  microContracts: number;
  actualRiskDollars: number;
  stopPoints: number;
  riskDollars: number;
  targetPoints?: number;
  targetDollars?: number;
  riskRewardRatio?: number;
  requiresMicro?: boolean;
  fullContractRisk?: number;
}

/**
 * Calculates recommended contracts and dollar loss based on maximum dollar risk and technical chart stop.
 * Derived from the JJ Simon Execution Engine (Aulas 09, 16, 20, 21, 48).
 */
export function calculatePositionSize(
  riskDollars: number,
  stopPoints: number,
  multiplier: number = NQ_DOLLARS_PER_POINT,
  targetPoints?: number,
): PositionSizeResult {
  if (stopPoints <= 0 || multiplier <= 0 || riskDollars <= 0) {
    return {
      recommendedContracts: 0,
      exactContracts: 0,
      microContracts: 0,
      actualRiskDollars: 0,
      stopPoints,
      riskDollars,
      requiresMicro: false,
      fullContractRisk: 0,
    };
  }

  const fullContractRisk = Math.round(stopPoints * multiplier);
  const exactContracts = riskDollars / fullContractRisk;
  const fittedContracts = Math.floor(exactContracts);

  // Micro calculation (e.g. MNQ is $2/pt vs NQ $20/pt)
  const isMicroAsset = multiplier <= 5;
  const microMultiplier = isMicroAsset ? multiplier : multiplier / 10;
  const microCostPerContract = stopPoints * microMultiplier;
  const fittedMicroContracts = Math.max(1, Math.floor(riskDollars / microCostPerContract));

  if (fittedContracts >= 1) {
    // Fits at least 1 full contract within the dollar risk
    const recommendedContracts = fittedContracts;
    const actualRiskDollars = Math.round(recommendedContracts * fullContractRisk);
    const microContracts = Math.round(exactContracts * 10);

    const targetDollars =
      targetPoints && targetPoints > 0
        ? Math.round(recommendedContracts * targetPoints * multiplier)
        : undefined;

    const riskRewardRatio =
      targetPoints && stopPoints > 0 ? Number((targetPoints / stopPoints).toFixed(2)) : undefined;

    return {
      recommendedContracts,
      exactContracts: Number(exactContracts.toFixed(2)),
      microContracts,
      actualRiskDollars,
      stopPoints,
      riskDollars,
      targetPoints,
      targetDollars,
      riskRewardRatio,
      requiresMicro: false,
      fullContractRisk,
    };
  }

  // 1 full contract exceeds riskDollars (e.g. $500 risk with 100 pts stop on NQ = $2,000)
  // Sized safely in Micro contracts to never exceed the user's max dollar risk!
  const actualRiskDollars = Math.round(fittedMicroContracts * microCostPerContract);
  const targetDollars =
    targetPoints && targetPoints > 0
      ? Math.round(fittedMicroContracts * targetPoints * microMultiplier)
      : undefined;

  const riskRewardRatio =
    targetPoints && stopPoints > 0 ? Number((targetPoints / stopPoints).toFixed(2)) : undefined;

  return {
    recommendedContracts: 0,
    exactContracts: Number(exactContracts.toFixed(2)),
    microContracts: fittedMicroContracts,
    actualRiskDollars,
    stopPoints,
    riskDollars,
    targetPoints,
    targetDollars,
    riskRewardRatio,
    requiresMicro: true,
    fullContractRisk,
  };
}
