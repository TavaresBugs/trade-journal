/**
 * Paper Trading Instrument Specifications & Financial Math Engine
 * Integrates directly with SYMBOL_SPECS for accurate point values and tick calculations.
 */

import { getSymbolSpec, SYMBOL_SPECS, type SymbolSpec } from "@/lib/assets/symbol-specs";

export interface PaperInstrumentSpec {
  symbol: string;
  name: string;
  tickSize: number;
  pointValue: number;
  tickValue: number;
  currency: string;
  decimals: number;
}

/**
 * Resolves instrument specs for any symbol (Futures, Crypto, Forex, Stocks).
 */
export function getPaperInstrumentSpec(rawSymbol: string): PaperInstrumentSpec {
  const spec = getSymbolSpec(rawSymbol);

  const tickSize = spec?.tickSize ?? 0.01;
  const pointValue = spec?.pointValue ?? 1;
  const tickValue = spec?.tickValue ?? tickSize * pointValue;
  const currency = spec?.currency ?? "USD";
  const name = spec?.name ?? rawSymbol;

  // Determine decimals based on tick size
  const tickStr = tickSize.toString();
  const decimals = tickStr.includes(".") ? (tickStr.split(".")[1]?.length ?? 0) : 0;

  return {
    symbol: rawSymbol.toUpperCase(),
    name,
    tickSize,
    pointValue,
    tickValue,
    currency,
    decimals,
  };
}

/**
 * Calculates financial PnL for a given price movement and quantity.
 */
export function calculatePnL(
  symbol: string,
  entryPrice: number,
  exitPrice: number,
  side: "buy" | "sell" | "long" | "short",
  qty: number
): {
  points: number;
  ticks: number;
  cashAmount: number;
  percent: number;
} {
  const spec = getPaperInstrumentSpec(symbol);
  const isLong = side === "buy" || side === "long";

  const diff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  const points = diff;
  const ticks = Math.round(diff / spec.tickSize);
  const cashAmount = points * spec.pointValue * qty;
  const percent = entryPrice > 0 ? (diff / entryPrice) * 100 : 0;

  return {
    points: Number(points.toFixed(spec.decimals + 2)),
    ticks,
    cashAmount: Number(cashAmount.toFixed(2)),
    percent: Number(percent.toFixed(2)),
  };
}

/**
 * Formats a price according to the instrument's tick size and decimal precision.
 */
export function formatPrice(symbol: string, price: number): string {
  const spec = getPaperInstrumentSpec(symbol);
  if (price === undefined || price === null || !Number.isFinite(price)) {
    return (0).toFixed(spec.decimals);
  }
  return price.toFixed(spec.decimals);
}

/**
 * Rounds a price to the nearest valid tick.
 */
export function roundToTick(symbol: string, price: number): number {
  if (price === undefined || price === null || !Number.isFinite(price)) {
    return 0;
  }
  const spec = getPaperInstrumentSpec(symbol);
  const inv = 1 / spec.tickSize;
  return Math.round(price * inv) / inv;
}
