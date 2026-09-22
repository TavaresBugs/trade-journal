export const NQ_DOLLARS_PER_POINT = 20;

export interface QuantInstrument {
  id: string;
  name: string;
  multiplier: number;
  tickSize: number;
  tickValue?: number;
  currency?: "USD" | "BRL" | "EUR";
  category?: "indices" | "micros" | "commodities" | "crypto" | "energy" | "metals" | "bonds" | "b3" | "currencies";
  microId?: string;
  assetTitle?: string;
}

export const QUANT_INSTRUMENTS: readonly QuantInstrument[] = [
  // --- US Equity Indices ---
  {
    id: "NQ",
    name: "NQ ($20/pt)",
    multiplier: 20,
    tickSize: 0.25,
    tickValue: 5.0,
    currency: "USD",
    category: "indices",
    microId: "MNQ",
    assetTitle: "Nasdaq-100",
  },
  {
    id: "ES",
    name: "ES ($50/pt)",
    multiplier: 50,
    tickSize: 0.25,
    tickValue: 12.5,
    currency: "USD",
    category: "indices",
    microId: "MES",
    assetTitle: "S&P 500",
  },
  {
    id: "RTY",
    name: "RTY ($50/pt)",
    multiplier: 50,
    tickSize: 0.1,
    tickValue: 5.0,
    currency: "USD",
    category: "indices",
    microId: "M2K",
    assetTitle: "Russell 2000",
  },
  {
    id: "YM",
    name: "YM ($5/pt)",
    multiplier: 5,
    tickSize: 1.0,
    tickValue: 5.0,
    currency: "USD",
    category: "indices",
    microId: "MYM",
    assetTitle: "Dow Jones 30",
  },

  // --- Brazilian B3 Futures ---
  {
    id: "WIN",
    name: "WIN (R$0.20/pt)",
    multiplier: 0.2,
    tickSize: 5.0,
    tickValue: 1.0,
    currency: "BRL",
    category: "b3",
    assetTitle: "Mini Índice B3",
  },
  {
    id: "WDO",
    name: "WDO (R$10/pt)",
    multiplier: 10,
    tickSize: 0.5,
    tickValue: 5.0,
    currency: "BRL",
    category: "b3",
    assetTitle: "Mini Dólar B3",
  },
  {
    id: "IND",
    name: "IND (R$1.00/pt)",
    multiplier: 1.0,
    tickSize: 5.0,
    tickValue: 5.0,
    currency: "BRL",
    category: "b3",
    microId: "WIN",
    assetTitle: "Índice Cheio B3",
  },
  {
    id: "DOL",
    name: "DOL (R$50/pt)",
    multiplier: 50,
    tickSize: 0.5,
    tickValue: 25.0,
    currency: "BRL",
    category: "b3",
    microId: "WDO",
    assetTitle: "Dólar Cheio B3",
  },

  // --- Micro Equity Indices ---
  {
    id: "MNQ",
    name: "MNQ ($2/pt)",
    multiplier: 2,
    tickSize: 0.25,
    tickValue: 0.5,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Nasdaq",
  },
  {
    id: "MES",
    name: "MES ($5/pt)",
    multiplier: 5,
    tickSize: 0.25,
    tickValue: 1.25,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro S&P 500",
  },
  {
    id: "M2K",
    name: "M2K ($5/pt)",
    multiplier: 5,
    tickSize: 0.1,
    tickValue: 0.5,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Russell",
  },
  {
    id: "MYM",
    name: "MYM ($0.50/pt)",
    multiplier: 0.5,
    tickSize: 1.0,
    tickValue: 0.5,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Dow Jones",
  },

  // --- Commodities & Metals ---
  {
    id: "GC",
    name: "GC ($100/pt)",
    multiplier: 100,
    tickSize: 0.1,
    tickValue: 10.0,
    currency: "USD",
    category: "commodities",
    microId: "MGC",
    assetTitle: "Gold Futures",
  },
  {
    id: "MGC",
    name: "MGC ($10/pt)",
    multiplier: 10,
    tickSize: 0.1,
    tickValue: 1.0,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Gold",
  },
  {
    id: "SI",
    name: "SI ($5,000/pt)",
    multiplier: 5000,
    tickSize: 0.005,
    tickValue: 25.0,
    currency: "USD",
    category: "commodities",
    microId: "SIL",
    assetTitle: "Silver Futures",
  },
  {
    id: "SIL",
    name: "SIL ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.005,
    tickValue: 5.0,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Silver",
  },
  {
    id: "CL",
    name: "CL ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.01,
    tickValue: 10.0,
    currency: "USD",
    category: "commodities",
    microId: "MCL",
    assetTitle: "Crude Oil Futures",
  },
  {
    id: "MCL",
    name: "MCL ($100/pt)",
    multiplier: 100,
    tickSize: 0.01,
    tickValue: 1.0,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Crude Oil",
  },
  {
    id: "HG",
    name: "HG ($250/pt)",
    multiplier: 250,
    tickSize: 0.0005,
    tickValue: 12.5,
    currency: "USD",
    category: "commodities",
    microId: "MHG",
    assetTitle: "Copper Futures",
  },
  {
    id: "MHG",
    name: "MHG ($25/pt)",
    multiplier: 25,
    tickSize: 0.0005,
    tickValue: 1.25,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Copper",
  },
  {
    id: "NG",
    name: "NG ($10,000/pt)",
    multiplier: 10000,
    tickSize: 0.001,
    tickValue: 10.0,
    currency: "USD",
    category: "commodities",
    assetTitle: "Natural Gas Futures",
  },
  {
    id: "PL",
    name: "PL ($50/pt)",
    multiplier: 50,
    tickSize: 0.1,
    tickValue: 5.0,
    currency: "USD",
    category: "commodities",
    assetTitle: "Platinum Futures",
  },
  {
    id: "RB",
    name: "RB ($42,000/pt)",
    multiplier: 42000,
    tickSize: 0.0001,
    tickValue: 4.2,
    currency: "USD",
    category: "commodities",
    assetTitle: "RBOB Gasoline",
  },
  {
    id: "HO",
    name: "HO ($42,000/pt)",
    multiplier: 42000,
    tickSize: 0.0001,
    tickValue: 4.2,
    currency: "USD",
    category: "commodities",
    assetTitle: "Heating Oil",
  },

  // --- Bonds & Rates ---
  {
    id: "ZN",
    name: "ZN ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.015625,
    tickValue: 15.625,
    currency: "USD",
    category: "bonds",
    assetTitle: "10-Year T-Note",
  },
  {
    id: "ZB",
    name: "ZB ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.03125,
    tickValue: 31.25,
    currency: "USD",
    category: "bonds",
    assetTitle: "30-Year T-Bond",
  },
  {
    id: "ZF",
    name: "ZF ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.0078125,
    tickValue: 7.8125,
    currency: "USD",
    category: "bonds",
    assetTitle: "5-Year T-Note",
  },
  {
    id: "ZT",
    name: "ZT ($2,000/pt)",
    multiplier: 2000,
    tickSize: 0.00390625,
    tickValue: 7.8125,
    currency: "USD",
    category: "bonds",
    assetTitle: "2-Year T-Note",
  },
  {
    id: "TN",
    name: "TN ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.015625,
    tickValue: 15.625,
    currency: "USD",
    category: "bonds",
    assetTitle: "Ultra 10-Year T-Note",
  },
  {
    id: "UB",
    name: "UB ($1,000/pt)",
    multiplier: 1000,
    tickSize: 0.03125,
    tickValue: 31.25,
    currency: "USD",
    category: "bonds",
    assetTitle: "Ultra T-Bond",
  },

  // --- CME Currency Futures ---
  {
    id: "6E",
    name: "6E ($12.50/pt)",
    multiplier: 125000,
    tickSize: 0.00005,
    tickValue: 6.25,
    currency: "USD",
    category: "currencies",
    microId: "M6E",
    assetTitle: "Euro FX Futures",
  },
  {
    id: "M6E",
    name: "M6E ($1.25/pt)",
    multiplier: 12500,
    tickSize: 0.0001,
    tickValue: 1.25,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Euro FX",
  },
  {
    id: "6B",
    name: "6B ($6.25/pt)",
    multiplier: 62500,
    tickSize: 0.0001,
    tickValue: 6.25,
    currency: "USD",
    category: "currencies",
    microId: "M6B",
    assetTitle: "British Pound Futures",
  },
  {
    id: "M6B",
    name: "M6B ($0.625/pt)",
    multiplier: 6250,
    tickSize: 0.0001,
    tickValue: 0.625,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro British Pound",
  },
  {
    id: "6A",
    name: "6A ($5/pt)",
    multiplier: 100000,
    tickSize: 0.00005,
    tickValue: 5.0,
    currency: "USD",
    category: "currencies",
    assetTitle: "Australian Dollar Futures",
  },
  {
    id: "6C",
    name: "6C ($5/pt)",
    multiplier: 100000,
    tickSize: 0.00005,
    tickValue: 5.0,
    currency: "USD",
    category: "currencies",
    assetTitle: "Canadian Dollar Futures",
  },
  {
    id: "6J",
    name: "6J ($6.25/pt)",
    multiplier: 12500000,
    tickSize: 0.0000005,
    tickValue: 6.25,
    currency: "USD",
    category: "currencies",
    assetTitle: "Japanese Yen Futures",
  },

  // --- Crypto Futures ---
  {
    id: "BTC",
    name: "BTC ($5/pt)",
    multiplier: 5,
    tickSize: 5.0,
    tickValue: 25.0,
    currency: "USD",
    category: "crypto",
    microId: "MBT",
    assetTitle: "Bitcoin Futures",
  },
  {
    id: "MBT",
    name: "MBT ($0.10/pt)",
    multiplier: 0.1,
    tickSize: 5.0,
    tickValue: 0.5,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Bitcoin",
  },
  {
    id: "ETH",
    name: "ETH ($50/pt)",
    multiplier: 50,
    tickSize: 0.25,
    tickValue: 12.5,
    currency: "USD",
    category: "crypto",
    microId: "MET",
    assetTitle: "Ethereum Futures",
  },
  {
    id: "MET",
    name: "MET ($0.10/pt)",
    multiplier: 0.1,
    tickSize: 0.25,
    tickValue: 0.025,
    currency: "USD",
    category: "micros",
    assetTitle: "Micro Ether",
  },
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
  cumulativeProbability: number;
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
      cumulativeProbability: 0,
    });
  }

  // Calculate cumulative probability P(X >= k) for each row
  for (let k = 0; k <= n; k++) {
    let sum = 0;
    for (let i = k; i <= n; i++) {
      sum += rows[i]!.probability;
    }
    rows[k]!.cumulativeProbability = Number(Math.min(100, sum).toFixed(2));
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

  const safeSims = Math.max(1, totalSimulations);
  const avgPayoutResult = Math.round(aggregatePayouts / safeSims);
  const avgNetProfit = Math.round(aggregateNetPnl / safeSims);

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
  microRatio: number = 10,
): PositionSizeResult {
  if (stopPoints <= 0 || multiplier <= 0 || riskDollars <= 0) {
    return {
      recommendedContracts: 0,
      exactContracts: 0,
      microContracts: 0,
      actualRiskDollars: 0,
      stopPoints,
      riskDollars,
    };
  }

  const costPerContract = Math.round(stopPoints * multiplier);
  if (costPerContract <= 0) {
    return {
      recommendedContracts: 0,
      exactContracts: 0,
      microContracts: 0,
      actualRiskDollars: 0,
      stopPoints,
      riskDollars,
    };
  }
  const exactContracts = riskDollars / costPerContract;
  // Fit contracts, minimum 1 contract:
  const recommendedContracts = Math.max(1, Math.floor(exactContracts));
  const actualRiskDollars = Math.round(recommendedContracts * costPerContract);
  const microContracts = Math.round(recommendedContracts * microRatio);

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
  };
}

// -------------------------------------------------------------
// System Design, Sweet Spot & Expectancy (from "The Math of Winning in Trading")
// -------------------------------------------------------------

export interface TradeExpectancyResult {
  paperEv: number;
  rMultiple: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  breakevenWinRate: number;
}

export interface RealExpectancyResult extends TradeExpectancyResult {
  realEv: number;
  totalFriction: number;
  netRMultiple: number;
}

/**
 * Breakeven win rate formula: BE% = 1 / (1 + RR) * 100
 * e.g. 1R -> 50%, 2R -> 33.33%, 4R -> 20%
 */
export function calculateBreakevenWinRate(riskRewardRatio: number): number {
  if (riskRewardRatio <= 0) return 100;
  return Number(((1 / (1 + riskRewardRatio)) * 100).toFixed(2));
}

/**
 * Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
 * rMultiple = (WinRate * RR) - (LossRate * 1)
 */
export function calculateTradeExpectancy(
  winRatePercent: number,
  riskRewardRatio: number,
  riskDollars: number = 1000,
): TradeExpectancyResult {
  const p = Math.max(0, Math.min(100, winRatePercent)) / 100;
  const q = 1 - p;
  const avgWin = riskDollars * Math.max(0, riskRewardRatio);
  const avgLoss = riskDollars;
  const paperEv = Number((p * avgWin - q * avgLoss).toFixed(2));
  const rMultiple = Number((p * riskRewardRatio - q).toFixed(2));
  const breakevenWinRate = calculateBreakevenWinRate(riskRewardRatio);

  return {
    paperEv,
    rMultiple,
    winRate: Number((p * 100).toFixed(1)),
    lossRate: Number((q * 100).toFixed(1)),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    breakevenWinRate,
  };
}

/**
 * Real Expectancy including friction (commissions, exchange fees, slippage)
 */
export function calculateRealExpectancy(
  winRatePercent: number,
  riskRewardRatio: number,
  riskDollars: number = 1000,
  feePerTrade: number = 5,
  slippageDollars: number = 10,
): RealExpectancyResult {
  const base = calculateTradeExpectancy(winRatePercent, riskRewardRatio, riskDollars);
  const totalFriction = Math.max(0, feePerTrade) + Math.max(0, slippageDollars);
  const realEv = Number((base.paperEv - totalFriction).toFixed(2));
  const netRMultiple = riskDollars > 0 ? Number((realEv / riskDollars).toFixed(2)) : 0;

  return {
    ...base,
    realEv,
    totalFriction,
    netRMultiple,
  };
}

export interface MatrixCell {
  winRate: number;
  riskReward: number;
  rMultiple: number;
  breakevenWinRate: number;
  isBreakeven: boolean;
  isProfitable: boolean;
  isSweetSpot: boolean;
}

export const MATRIX_WIN_RATES = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70] as const;
export const MATRIX_RR_RATIOS = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0] as const;

/**
 * Generates the 2D Heatmap Matrix of RR vs Win Rate with Sweet Spot tagging.
 * The Sweet Spot: 2R to 5R with 35% to 50% Win Rate (video's core realism zone).
 */
export function generateSweetSpotMatrix(): MatrixCell[][] {
  return MATRIX_WIN_RATES.map((wr) => {
    return MATRIX_RR_RATIOS.map((rr) => {
      const p = wr / 100;
      const q = 1 - p;
      const rMultiple = Number((p * rr - q).toFixed(2));
      const be = calculateBreakevenWinRate(rr);
      const isBreakeven = Math.abs(wr - be) <= 2.5;
      const isProfitable = wr > be;
      const isSweetSpot = rr >= 2.0 && rr <= 5.0 && wr >= 35 && wr <= 50;

      return {
        winRate: wr,
        riskReward: rr,
        rMultiple,
        breakevenWinRate: be,
        isBreakeven,
        isProfitable,
        isSweetSpot,
      };
    });
  });
}

// -------------------------------------------------------------
// Variance & Losing Streak Probability (Markov Chain / DP)
// -------------------------------------------------------------

/**
 * Exact probability of observing at least one run of >= streakLength consecutive losses
 * in a sample of sampleTrades trades.
 * Solved via exact dynamic programming (O(N * k)).
 */
export function calculateLosingStreakProbability(
  winRatePercent: number,
  sampleTrades: number,
  streakLength: number,
): number {
  if (streakLength <= 0) return 100;
  if (sampleTrades < streakLength) return 0;
  if (winRatePercent >= 100) return 0;
  if (winRatePercent <= 0) return 100;

  const p = winRatePercent / 100; // win probability
  const q = 1 - p; // loss probability
  const N = Math.min(1000, Math.max(1, sampleTrades));
  const k = streakLength;

  // dp[j] = probability of reaching current consecutive loss streak j without ever hitting k
  let dp = new Array(k).fill(0);
  dp[0] = 1;

  for (let i = 0; i < N; i++) {
    const nextDp = new Array(k).fill(0);
    // Any trade that is a win resets the current losing streak to 0
    let sumSurviving = 0;
    for (let j = 0; j < k; j++) {
      sumSurviving += dp[j];
    }
    nextDp[0] = sumSurviving * p;

    // A loss extends streak from j to j+1 (if j+1 < k)
    for (let j = 0; j < k - 1; j++) {
      nextDp[j + 1] = dp[j] * q;
    }

    dp = nextDp;
  }

  // Total probability of never hitting streak length k
  let probNeverHit = 0;
  for (let j = 0; j < k; j++) {
    probNeverHit += dp[j];
  }

  const probHit = Math.max(0, Math.min(1, 1 - probNeverHit));
  return Number((probHit * 100).toFixed(1));
}

export interface StreakDistributionItem {
  streak: number;
  probability: number;
}

export function generateStreakDistribution(
  winRatePercent: number,
  sampleTrades: number = 100,
  streaks: number[] = [3, 4, 5, 6, 7, 8, 9, 10],
): StreakDistributionItem[] {
  return streaks.map((k) => ({
    streak: k,
    probability: calculateLosingStreakProbability(winRatePercent, sampleTrades, k),
  }));
}

// -------------------------------------------------------------
// Capital Survival & Recovery Asymmetry (from "The Math of Winning in Trading")
// -------------------------------------------------------------

/**
 * Recovery gain required to get back to breakeven after a loss:
 * Gain% = L / (1 - L) * 100
 * e.g. 10% loss -> +11.11%, 50% loss -> +100%
 */
export function calculateRecoveryPercentage(drawdownPercent: number): number {
  if (drawdownPercent <= 0) return 0;
  if (drawdownPercent >= 100) return 9999;
  const l = drawdownPercent / 100;
  return Number(((l / (1 - l)) * 100).toFixed(1));
}

export interface RecoveryRulerItem {
  drawdown: number;
  recovery: number;
}

export const STANDARD_RECOVERY_STEPS: RecoveryRulerItem[] = [
  { drawdown: 10, recovery: 11.1 },
  { drawdown: 20, recovery: 25.0 },
  { drawdown: 30, recovery: 42.9 },
  { drawdown: 40, recovery: 66.7 },
  { drawdown: 50, recovery: 100.0 },
  { drawdown: 60, recovery: 150.0 },
  { drawdown: 70, recovery: 233.3 },
  { drawdown: 80, recovery: 400.0 },
  { drawdown: 90, recovery: 900.0 },
];

/**
 * Probability of hitting a 50% account drawdown based on risk per trade.
 * Calibrated against video chart 6:
 * Risk 0.5% -> 0.1% chance
 * Risk 1.0% -> 1.8% chance
 * Risk 2.0% -> 18.2% chance
 * Risk 5.0% -> 65.4% chance
 * Risk 10.0% -> 94.5% chance
 */
export function calculateDrawdown50Probability(riskPercentPerTrade: number): number {
  const r = Math.max(0.1, riskPercentPerTrade);
  if (r <= 0.5) return Number((0.1 * (r / 0.5)).toFixed(1));
  if (r <= 1.0) {
    const t = (r - 0.5) / 0.5;
    return Number((0.1 + t * (1.8 - 0.1)).toFixed(1));
  }
  if (r <= 2.0) {
    const t = (r - 1.0) / 1.0;
    return Number((1.8 + t * (18.2 - 1.8)).toFixed(1));
  }
  if (r <= 5.0) {
    const t = (r - 2.0) / 3.0;
    return Number((18.2 + t * (65.4 - 18.2)).toFixed(1));
  }
  const t = Math.min(1, (r - 5.0) / 5.0);
  return Number((65.4 + t * (95.0 - 65.4)).toFixed(1));
}

export interface RiskDrawdownRow {
  riskPercent: number;
  drawdown50Prob: number;
  riskCategory: "Conservative" | "Optimal" | "Dangerous" | "Fatal";
}

export const STANDARD_RISK_SURVIVAL_TABLE: RiskDrawdownRow[] = [
  { riskPercent: 0.5, drawdown50Prob: 0.1, riskCategory: "Conservative" },
  { riskPercent: 1.0, drawdown50Prob: 1.8, riskCategory: "Optimal" },
  { riskPercent: 2.0, drawdown50Prob: 18.2, riskCategory: "Dangerous" },
  { riskPercent: 5.0, drawdown50Prob: 65.4, riskCategory: "Fatal" },
];

// -------------------------------------------------------------
// Funded Account vs Live Account Survival (Prop Firm Reality)
// -------------------------------------------------------------

export type AccountSurvivalMode = "funded" | "live";

export interface FundedAccountPreset {
  id: string;
  name: string;
  nominalBalance: number;
  maxDrawdown: number;
}

export const FUNDED_ACCOUNT_PRESETS: readonly FundedAccountPreset[] = [
  { id: "10k", name: "10K Account", nominalBalance: 10000, maxDrawdown: 1000 },
  { id: "25k", name: "25K Account", nominalBalance: 25000, maxDrawdown: 1500 },
  { id: "50k", name: "50K Account", nominalBalance: 50000, maxDrawdown: 3000 },
  { id: "100k", name: "100K Account", nominalBalance: 100000, maxDrawdown: 3000 },
  { id: "150k", name: "150K Account", nominalBalance: 150000, maxDrawdown: 4500 },
] as const;

export interface FundedSurvivalResult {
  nominalBalance: number;
  maxDrawdown: number;
  dollarRisk: number;
  nominalRiskPercent: number;
  cushionRiskPercent: number;
  lossesToBreach: number;
  breachProbability: number;
  cushionRuinProbability: number;
  category: "Conservative" | "Optimal" | "Dangerous" | "Fatal";
}

export function calculateFundedSurvival(
  maxDrawdown: number,
  dollarRisk: number,
  nominalBalance: number = 50000,
  winRatePercent: number = 45,
  sampleTrades: number = 100,
): FundedSurvivalResult {
  const safeDd = Math.max(100, maxDrawdown);
  const safeRisk = Math.max(10, dollarRisk);
  const safeNominal = Math.max(safeDd, nominalBalance);

  const nominalRiskPercent = Number(((safeRisk / safeNominal) * 100).toFixed(2));
  const cushionRiskPercent = Number(((safeRisk / safeDd) * 100).toFixed(1));
  const lossesToBreach = Math.max(1, Math.floor(safeDd / safeRisk));
  const breachProbability = calculateLosingStreakProbability(
    winRatePercent,
    sampleTrades,
    lossesToBreach,
  );

  // Absorbing barrier Gambler's Ruin approximation on the drawdown cushion
  // Evaluates systemic ruin probability for a typical trend/mean-reversion edge (e.g. 45% WR at 2.0R)
  const mu = 0.35;
  const variance = 2.23;
  const gamma = (2 * mu) / variance;
  const cushionRuinProbability = Number(
    Math.min(100, Math.max(0.1, Math.exp(-gamma * lossesToBreach) * 100)).toFixed(1),
  );

  let category: FundedSurvivalResult["category"] = "Optimal";
  if (lossesToBreach >= 15) category = "Conservative";
  else if (lossesToBreach >= 10) category = "Optimal";
  else if (lossesToBreach >= 6) category = "Dangerous";
  else category = "Fatal";

  return {
    nominalBalance: safeNominal,
    maxDrawdown: safeDd,
    dollarRisk: safeRisk,
    nominalRiskPercent,
    cushionRiskPercent,
    lossesToBreach,
    breachProbability,
    cushionRuinProbability,
    category,
  };
}
