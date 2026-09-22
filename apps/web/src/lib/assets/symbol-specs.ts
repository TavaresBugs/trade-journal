/**
 * Symbol Specifications & Metadata Engine
 * Official specifications extracted from TradingView runtime:
 * - Multipliers / Point Values
 * - Minimum Tick Sizes
 * - Cash Tick Values
 * - Currencies & Exchanges
 */

import { QUANT_INSTRUMENTS, type QuantInstrument } from "@luxalgo/journal-core";
import { normalizeSymbol } from "./symbol-utils";

export interface SymbolSpec {
  symbol: string;
  name: string;
  category: "indices" | "commodities" | "forex" | "crypto" | "stocks" | "b3" | "bonds" | "currencies";
  pointValue?: number;
  tickSize?: number;
  tickValue?: number;
  currency?: "USD" | "BRL" | "EUR";
  exchange?: string;
  microId?: string;
  aliases?: string[];
  description?: string;
}

/** Pre-indexed dictionary of symbol specifications. */
export const SYMBOL_SPECS: Record<string, SymbolSpec> = {
  // --- US Futures Indices (CME / CBOT) ---
  NQ: {
    symbol: "NQ",
    name: "Nasdaq 100 Futures",
    category: "indices",
    pointValue: 20,
    tickSize: 0.25,
    tickValue: 5.0,
    currency: "USD",
    exchange: "CME",
    microId: "MNQ",
    aliases: ["NAS100", "USTEC", "NQ1!"],
  },
  MNQ: {
    symbol: "MNQ",
    name: "Micro E-mini Nasdaq 100",
    category: "indices",
    pointValue: 2,
    tickSize: 0.25,
    tickValue: 0.5,
    currency: "USD",
    exchange: "CME",
    aliases: ["MNQ1!"],
  },
  ES: {
    symbol: "ES",
    name: "S&P 500 Futures",
    category: "indices",
    pointValue: 50,
    tickSize: 0.25,
    tickValue: 12.5,
    currency: "USD",
    exchange: "CME",
    microId: "MES",
    aliases: ["SPX", "SP500", "ES1!"],
  },
  MES: {
    symbol: "MES",
    name: "Micro E-mini S&P 500",
    category: "indices",
    pointValue: 5,
    tickSize: 0.25,
    tickValue: 1.25,
    currency: "USD",
    exchange: "CME",
    aliases: ["MES1!"],
  },
  YM: {
    symbol: "YM",
    name: "Dow Jones 30 Futures",
    category: "indices",
    pointValue: 5,
    tickSize: 1.0,
    tickValue: 5.0,
    currency: "USD",
    exchange: "CBOT",
    microId: "MYM",
    aliases: ["DJ30", "DOW", "YM1!"],
  },
  MYM: {
    symbol: "MYM",
    name: "Micro E-mini Dow Jones",
    category: "indices",
    pointValue: 0.5,
    tickSize: 1.0,
    tickValue: 0.5,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["MYM1!"],
  },
  RTY: {
    symbol: "RTY",
    name: "Russell 2000 Futures",
    category: "indices",
    pointValue: 50,
    tickSize: 0.1,
    tickValue: 5.0,
    currency: "USD",
    exchange: "CME",
    microId: "M2K",
    aliases: ["RUSSELL", "RTY1!"],
  },
  M2K: {
    symbol: "M2K",
    name: "Micro E-mini Russell 2000",
    category: "indices",
    pointValue: 5,
    tickSize: 0.1,
    tickValue: 0.5,
    currency: "USD",
    exchange: "CME",
    aliases: ["M2K1!"],
  },

  // --- Brazilian B3 Futures ---
  WIN: {
    symbol: "WIN",
    name: "Mini Índice Ibovespa",
    category: "b3",
    pointValue: 0.2,
    tickSize: 5.0,
    tickValue: 1.0,
    currency: "BRL",
    exchange: "BMFBOVESPA",
    aliases: ["WIN1!", "IBOV", "MINIINDICE"],
  },
  WDO: {
    symbol: "WDO",
    name: "Mini Dólar Futuro",
    category: "b3",
    pointValue: 10,
    tickSize: 0.5,
    tickValue: 5.0,
    currency: "BRL",
    exchange: "BMFBOVESPA",
    aliases: ["WDO1!", "DOLAR", "MINIDOLAR"],
  },
  IND: {
    symbol: "IND",
    name: "Índice Bovespa Cheio",
    category: "b3",
    pointValue: 1.0,
    tickSize: 5.0,
    tickValue: 5.0,
    currency: "BRL",
    exchange: "BMFBOVESPA",
    microId: "WIN",
    aliases: ["IND1!"],
  },
  DOL: {
    symbol: "DOL",
    name: "Dólar Futuro Cheio",
    category: "b3",
    pointValue: 50,
    tickSize: 0.5,
    tickValue: 25.0,
    currency: "BRL",
    exchange: "BMFBOVESPA",
    microId: "WDO",
    aliases: ["DOL1!"],
  },

  // --- Global Indices (CFD Spot) ---
  US100: { symbol: "US100", name: "Nasdaq 100 (CFD Spot)", category: "indices", aliases: ["NAS100", "USTEC"] },
  US500: { symbol: "US500", name: "S&P 500 (CFD Spot)", category: "indices", aliases: ["SPX500"] },
  US30: { symbol: "US30", name: "Dow Jones 30 (CFD Spot)", category: "indices", aliases: ["DJ30", "WALLSTREET"] },
  US2000: { symbol: "US2000", name: "Russell 2000 (CFD Spot)", category: "indices", aliases: ["RUSSELL2000"] },
  DXY: { symbol: "DXY", name: "US Dollar Index", category: "indices", aliases: ["USDX", "DOLAR_INDEX"] },
  GER40: { symbol: "GER40", name: "DAX 40 (Germany)", category: "indices", aliases: ["DAX", "DE40"] },
  UK100: { symbol: "UK100", name: "FTSE 100 (United Kingdom)", category: "indices", aliases: ["FTSE"] },
  JP225: { symbol: "JP225", name: "Nikkei 225 (Japan)", category: "indices", aliases: ["NIKKEI", "JPN225"] },
  EU50: { symbol: "EU50", name: "Euro Stoxx 50", category: "indices" },

  // --- Commodities & Metals ---
  GC: {
    symbol: "GC",
    name: "Gold Futures",
    category: "commodities",
    pointValue: 100,
    tickSize: 0.1,
    tickValue: 10.0,
    currency: "USD",
    exchange: "COMEX",
    microId: "MGC",
    aliases: ["GOLD", "XAUUSD", "GC1!"],
  },
  MGC: {
    symbol: "MGC",
    name: "Micro Gold Futures",
    category: "commodities",
    pointValue: 10,
    tickSize: 0.1,
    tickValue: 1.0,
    currency: "USD",
    exchange: "COMEX",
    aliases: ["MGC1!"],
  },
  XAUUSD: { symbol: "XAUUSD", name: "Gold Spot / USD", category: "commodities", aliases: ["GOLD", "OURO"] },
  SI: {
    symbol: "SI",
    name: "Silver Futures",
    category: "commodities",
    pointValue: 5000,
    tickSize: 0.005,
    tickValue: 25.0,
    currency: "USD",
    exchange: "COMEX",
    microId: "SIL",
    aliases: ["SILVER", "XAGUSD", "SI1!"],
  },
  SIL: {
    symbol: "SIL",
    name: "Micro Silver Futures",
    category: "commodities",
    pointValue: 1000,
    tickSize: 0.005,
    tickValue: 5.0,
    currency: "USD",
    exchange: "COMEX",
    aliases: ["SIL1!", "MSI"],
  },
  XAGUSD: { symbol: "XAGUSD", name: "Silver Spot / USD", category: "commodities", aliases: ["SILVER", "PRATA"] },
  CL: {
    symbol: "CL",
    name: "Crude Oil (WTI)",
    category: "commodities",
    pointValue: 1000,
    tickSize: 0.01,
    tickValue: 10.0,
    currency: "USD",
    exchange: "NYMEX",
    microId: "MCL",
    aliases: ["USOIL", "WTI", "CL1!"],
  },
  MCL: {
    symbol: "MCL",
    name: "Micro Crude Oil",
    category: "commodities",
    pointValue: 100,
    tickSize: 0.01,
    tickValue: 1.0,
    currency: "USD",
    exchange: "NYMEX",
    aliases: ["MCL1!"],
  },
  NG: {
    symbol: "NG",
    name: "Natural Gas Futures",
    category: "commodities",
    pointValue: 10000,
    tickSize: 0.001,
    tickValue: 10.0,
    currency: "USD",
    exchange: "NYMEX",
    aliases: ["NATGAS", "NG1!"],
  },
  HG: {
    symbol: "HG",
    name: "Copper Futures",
    category: "commodities",
    pointValue: 250,
    tickSize: 0.0005,
    tickValue: 12.5,
    currency: "USD",
    exchange: "COMEX",
    microId: "MHG",
    aliases: ["COPPER", "COBRE", "HG1!"],
  },
  MHG: {
    symbol: "MHG",
    name: "Micro Copper Futures",
    category: "commodities",
    pointValue: 25,
    tickSize: 0.0005,
    tickValue: 1.25,
    currency: "USD",
    exchange: "COMEX",
    aliases: ["MHG1!"],
  },
  PL: {
    symbol: "PL",
    name: "Platinum Futures",
    category: "commodities",
    pointValue: 50,
    tickSize: 0.1,
    tickValue: 5.0,
    currency: "USD",
    exchange: "NYMEX",
    aliases: ["PL1!"],
  },
  RB: {
    symbol: "RB",
    name: "RBOB Gasoline Futures",
    category: "commodities",
    pointValue: 42000,
    tickSize: 0.0001,
    tickValue: 4.2,
    currency: "USD",
    exchange: "NYMEX",
    aliases: ["RB1!"],
  },
  HO: {
    symbol: "HO",
    name: "Heating Oil Futures",
    category: "commodities",
    pointValue: 42000,
    tickSize: 0.0001,
    tickValue: 4.2,
    currency: "USD",
    exchange: "NYMEX",
    aliases: ["HO1!"],
  },

  // --- Bonds & Rates ---
  ZN: {
    symbol: "ZN",
    name: "10-Year T-Note Futures",
    category: "bonds",
    pointValue: 1000,
    tickSize: 0.015625,
    tickValue: 15.625,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["ZN1!"],
  },
  ZB: {
    symbol: "ZB",
    name: "30-Year T-Bond Futures",
    category: "bonds",
    pointValue: 1000,
    tickSize: 0.03125,
    tickValue: 31.25,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["ZB1!"],
  },
  ZF: {
    symbol: "ZF",
    name: "5-Year T-Note Futures",
    category: "bonds",
    pointValue: 1000,
    tickSize: 0.0078125,
    tickValue: 7.8125,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["ZF1!"],
  },
  ZT: {
    symbol: "ZT",
    name: "2-Year T-Note Futures",
    category: "bonds",
    pointValue: 2000,
    tickSize: 0.00390625,
    tickValue: 7.8125,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["ZT1!"],
  },
  TN: {
    symbol: "TN",
    name: "Ultra 10-Year T-Note",
    category: "bonds",
    pointValue: 1000,
    tickSize: 0.015625,
    tickValue: 15.625,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["TN1!"],
  },
  UB: {
    symbol: "UB",
    name: "Ultra T-Bond Futures",
    category: "bonds",
    pointValue: 1000,
    tickSize: 0.03125,
    tickValue: 31.25,
    currency: "USD",
    exchange: "CBOT",
    aliases: ["UB1!"],
  },

  // --- CME Currency Futures ---
  "6E": {
    symbol: "6E",
    name: "Euro FX Futures",
    category: "currencies",
    pointValue: 125000,
    tickSize: 0.00005,
    tickValue: 6.25,
    currency: "USD",
    exchange: "CME",
    microId: "M6E",
    aliases: ["6E1!"],
  },
  M6E: {
    symbol: "M6E",
    name: "Micro Euro FX",
    category: "currencies",
    pointValue: 12500,
    tickSize: 0.0001,
    tickValue: 1.25,
    currency: "USD",
    exchange: "CME",
    aliases: ["M6E1!"],
  },
  "6B": {
    symbol: "6B",
    name: "British Pound Futures",
    category: "currencies",
    pointValue: 62500,
    tickSize: 0.0001,
    tickValue: 6.25,
    currency: "USD",
    exchange: "CME",
    microId: "M6B",
    aliases: ["6B1!"],
  },
  M6B: {
    symbol: "M6B",
    name: "Micro British Pound",
    category: "currencies",
    pointValue: 6250,
    tickSize: 0.0001,
    tickValue: 0.625,
    currency: "USD",
    exchange: "CME",
    aliases: ["M6B1!"],
  },
  "6A": {
    symbol: "6A",
    name: "Australian Dollar Futures",
    category: "currencies",
    pointValue: 100000,
    tickSize: 0.00005,
    tickValue: 5.0,
    currency: "USD",
    exchange: "CME",
    aliases: ["6A1!"],
  },
  "6C": {
    symbol: "6C",
    name: "Canadian Dollar Futures",
    category: "currencies",
    pointValue: 100000,
    tickSize: 0.00005,
    tickValue: 5.0,
    currency: "USD",
    exchange: "CME",
    aliases: ["6C1!"],
  },
  "6J": {
    symbol: "6J",
    name: "Japanese Yen Futures",
    category: "currencies",
    pointValue: 12500000,
    tickSize: 0.0000005,
    tickValue: 6.25,
    currency: "USD",
    exchange: "CME",
    aliases: ["6J1!"],
  },

  // --- Forex (Spot Currencies) ---
  EURUSD: { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex", aliases: ["EUR/USD"] },
  GBPUSD: { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex", aliases: ["GBP/USD", "CABLE"] },
  USDJPY: { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex", aliases: ["USD/JPY", "YEN"] },
  AUDUSD: { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex", aliases: ["AUD/USD", "AUSSIE"] },
  USDCAD: { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex", aliases: ["USD/CAD", "LOONIE"] },
  USDCHF: { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex", aliases: ["USD/CHF", "SWISSIE"] },
  NZDUSD: { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex", aliases: ["NZD/USD", "KIWI"] },
  EURGBP: { symbol: "EURGBP", name: "Euro / British Pound", category: "forex", aliases: ["EUR/GBP"] },
  EURJPY: { symbol: "EURJPY", name: "Euro / Japanese Yen", category: "forex", aliases: ["EUR/JPY"] },
  GBPJPY: { symbol: "GBPJPY", name: "British Pound / Japanese Yen", category: "forex", aliases: ["GBP/JPY", "GUFFY"] },

  // --- Crypto ---
  BTCUSD: { symbol: "BTCUSD", name: "Bitcoin / USD", category: "crypto", aliases: ["BTC", "BTCUSDT", "BITCOIN"] },
  ETHUSD: { symbol: "ETHUSD", name: "Ethereum / USD", category: "crypto", aliases: ["ETH", "ETHUSDT", "ETHEREUM"] },
  SOLUSD: { symbol: "SOLUSD", name: "Solana / USD", category: "crypto", aliases: ["SOL", "SOLUSDT", "SOLANA"] },
  XRPUSD: { symbol: "XRPUSD", name: "Ripple / USD", category: "crypto", aliases: ["XRP", "RIPPLE"] },
  ADAUSD: { symbol: "ADAUSD", name: "Cardano / USD", category: "crypto", aliases: ["ADA", "CARDANO"] },
  DOGEUSD: { symbol: "DOGEUSD", name: "Dogecoin / USD", category: "crypto", aliases: ["DOGE", "DOGEUSDT"] },
  BNBUSD: { symbol: "BNBUSD", name: "BNB / USD", category: "crypto", aliases: ["BNB", "BNBUSDT"] },
  AVAXUSD: { symbol: "AVAXUSD", name: "Avalanche / USD", category: "crypto", aliases: ["AVAX", "AVAXUSDT"] },

  // --- CME Crypto Futures ---
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    category: "crypto",
    pointValue: 5,
    tickSize: 5.0,
    tickValue: 25.0,
    currency: "USD",
    exchange: "CME",
    microId: "MBT",
    aliases: ["BTCUSD", "BTCUSDT", "BTC1!"],
  },
  MBT: {
    symbol: "MBT",
    name: "Micro Bitcoin Futures (MBT)",
    category: "crypto",
    pointValue: 0.1,
    tickSize: 5.0,
    tickValue: 0.5,
    currency: "USD",
    exchange: "CME",
    aliases: ["MBT1!"],
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    category: "crypto",
    pointValue: 50,
    tickSize: 0.25,
    tickValue: 12.5,
    currency: "USD",
    exchange: "CME",
    microId: "MET",
    aliases: ["ETHUSD", "ETHUSDT", "ETH1!"],
  },
  MET: {
    symbol: "MET",
    name: "Micro Ether Futures (MET)",
    category: "crypto",
    pointValue: 0.1,
    tickSize: 0.25,
    tickValue: 0.025,
    currency: "USD",
    exchange: "CME",
    aliases: ["MET1!"],
  },

  // --- US Stocks & ETFs ---
  AAPL: { symbol: "AAPL", name: "Apple Inc.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["APPLE"] },
  NVDA: { symbol: "NVDA", name: "NVIDIA Corp.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["NVIDIA"] },
  TSLA: { symbol: "TSLA", name: "Tesla Inc.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["TESLA"] },
  MSFT: { symbol: "MSFT", name: "Microsoft Corp.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["MICROSOFT"] },
  AMZN: { symbol: "AMZN", name: "Amazon.com Inc.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["AMAZON"] },
  META: { symbol: "META", name: "Meta Platforms", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["FACEBOOK", "FB"] },
  GOOGL: { symbol: "GOOGL", name: "Alphabet (Google)", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD", aliases: ["GOOGLE"] },
  AMD: { symbol: "AMD", name: "Advanced Micro Devices", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },
  SPY: { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },
  QQQ: { symbol: "QQQ", name: "Invesco QQQ Trust", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },
  NFLX: { symbol: "NFLX", name: "Netflix Inc.", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },
  COIN: { symbol: "COIN", name: "Coinbase Global", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },
  PLTR: { symbol: "PLTR", name: "Palantir Technologies", category: "stocks", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "USD" },

  // --- Brazilian B3 Equities & ETFs ---
  PETR4: { symbol: "PETR4", name: "Petrobras PN", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL", aliases: ["PETROBRAS"] },
  VALE3: { symbol: "VALE3", name: "Vale ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL", aliases: ["VALE"] },
  ITUB4: { symbol: "ITUB4", name: "Itaú Unibanco PN", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL", aliases: ["ITAU"] },
  BBDC4: { symbol: "BBDC4", name: "Bradesco PN", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL", aliases: ["BRADESCO"] },
  BBAS3: { symbol: "BBAS3", name: "Banco do Brasil ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  BOVA11: { symbol: "BOVA11", name: "iShares Ibovespa ETF", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  WEGE3: { symbol: "WEGE3", name: "WEG ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  PRIO3: { symbol: "PRIO3", name: "PRIO ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  ITSA4: { symbol: "ITSA4", name: "Itaúsa PN", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  RENT3: { symbol: "RENT3", name: "Localiza ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  MGLU3: { symbol: "MGLU3", name: "Magazine Luiza ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
  B3SA3: { symbol: "B3SA3", name: "B3 ON", category: "b3", pointValue: 1, tickSize: 0.01, tickValue: 0.01, currency: "BRL" },
};

/** Get symbol specification from normalized ticker. */
export function getSymbolSpec(rawSymbol: string): SymbolSpec | null {
  const norm = normalizeSymbol(rawSymbol);
  if (SYMBOL_SPECS[norm]) return SYMBOL_SPECS[norm];

  // Try direct match
  const upper = rawSymbol.trim().toUpperCase();
  if (SYMBOL_SPECS[upper]) return SYMBOL_SPECS[upper];

  // Fallback lookup in core QUANT_INSTRUMENTS
  const coreInst = QUANT_INSTRUMENTS.find((i) => i.id === norm || i.id === upper);
  if (coreInst) {
    return {
      symbol: coreInst.id,
      name: coreInst.assetTitle || coreInst.name,
      category: (coreInst.category as SymbolSpec["category"]) || "indices",
      pointValue: coreInst.multiplier,
      tickSize: coreInst.tickSize,
      tickValue: coreInst.tickValue,
      currency: coreInst.currency,
      microId: coreInst.microId,
    };
  }

  return null;
}

/** Get multiplier / point value for position sizing. */
export function getPointValue(rawSymbol: string): number | null {
  const spec = getSymbolSpec(rawSymbol);
  return spec?.pointValue ?? null;
}

/** Format a sleek compact badge representing the contract/asset specification. */
export function formatSpecBadge(spec: SymbolSpec): string | null {
  if (spec.category === "b3" && spec.currency === "BRL" && spec.pointValue !== undefined) {
    const ptStr = spec.pointValue < 1 ? spec.pointValue.toFixed(2) : String(spec.pointValue);
    const tickStr = spec.tickValue !== undefined ? ` • tick R$${spec.tickValue.toFixed(2)}` : "";
    return `R$${ptStr}/pt${tickStr}`;
  }
  if (spec.pointValue !== undefined && spec.tickValue !== undefined) {
    const currSym = spec.currency === "EUR" ? "€" : spec.currency === "BRL" ? "R$" : "$";
    const formattedTick = spec.tickValue % 1 === 0 ? spec.tickValue : spec.tickValue.toFixed(2);
    const formattedPt = spec.pointValue >= 1000 ? spec.pointValue.toLocaleString("en-US") : spec.pointValue;
    return `${currSym}${formattedPt}/pt • tick ${currSym}${formattedTick}`;
  }
  if (spec.category === "stocks") {
    return "$1/share";
  }
  if (spec.category === "forex") {
    return null;
  }
  if (spec.category === "crypto") {
    return "Spot $1";
  }
  return null;
}

/**
 * Checks whether an asset has an explicit futures/quant specification with a point value.
 * Used by the Position Sizing Calculator to ensure only calculable instruments are selectable.
 */
export function isCalculableSymbol(rawSymbol: string): boolean {
  if (!rawSymbol) return false;
  const upper = rawSymbol.toUpperCase();
  const spec = getSymbolSpec(rawSymbol);
  if (!spec) return false;

  // Must have a positive point value and tick size
  if (typeof spec.pointValue !== "number" || spec.pointValue <= 0) {
    return false;
  }

  // Spot forex and equities cannot be sized with point contracts
  if (spec.category === "forex" || spec.category === "stocks") return false;
  if (spec.category === "crypto" && !["BTC", "MBT", "ETH", "MET"].includes(upper)) {
    return false;
  }

  return true;
}

/**
 * Bridges a SymbolSpec into a Core QuantInstrument for sizing calculations.
 */
export function getQuantInstrument(rawSymbol: string): QuantInstrument | null {
  if (!isCalculableSymbol(rawSymbol)) return null;
  const spec = getSymbolSpec(rawSymbol);
  if (!spec || typeof spec.pointValue !== "number" || spec.pointValue <= 0) {
    return null;
  }
  const currSym = spec.currency === "BRL" ? "R$" : spec.currency === "EUR" ? "€" : "$";
  return {
    id: spec.symbol,
    name: `${spec.symbol} (${currSym}${spec.pointValue}/pt)`,
    multiplier: spec.pointValue,
    tickSize: spec.tickSize ?? 0.01,
    tickValue: spec.tickValue ?? 0.01,
    currency: spec.currency ?? "USD",
    category: (spec.category as any) ?? "indices",
    microId: spec.microId,
    assetTitle: spec.name,
  };
}
