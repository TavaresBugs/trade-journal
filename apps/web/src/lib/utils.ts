import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Signed money — the sign is ALWAYS in the text; color never carries P&L alone. */
export const fmtMoney = (value: number, currency = "USD"): string => {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      signDisplay: "exceptZero",
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(value);
};

const amountFormatters = new Map<string, Intl.NumberFormat>();

/** Unsigned money/balance — standard currency format with negative sign only if value < 0. */
export const fmtAmount = (value: number, currency = "USD"): string => {
  let formatter = amountFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      signDisplay: "auto",
    });
    amountFormatters.set(currency, formatter);
  }
  return formatter.format(value);
};

const numberFormatters = new Map<number, Intl.NumberFormat>();
export const fmtNumber = (value: number, digits = 2): string => {
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits });
    numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
};

export const fmtPercent = (value: number | null, digits = 1): string =>
  value === null ? "–" : `${(value * 100).toFixed(digits)}%`;

export const fmtDuration = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) return "–";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

export const pnlClass = (value: number): string =>
  value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted-foreground";

const compactCurrencyFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Compact signed currency (e.g. +$1.2K, -$450, $0) with SSR locale parity (en-US).
 * Handles NaN, null, and normalizes negative zero to prevent hydration drift.
 */
export const compactMoney = (value: number | null | undefined, currency = "USD"): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const normalized = Object.is(value, -0) || Math.abs(value) < 0.0001 ? 0 : value;
  let formatter = compactCurrencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    });
    compactCurrencyFormatters.set(currency, formatter);
  }
  return formatter.format(normalized);
};

/**
 * Adaptive percentage tick formatter for charts.
 * When reference scale is sub-1% (e.g. max drawdown is -0.3%), dynamically uses 1 or 2 decimals
 * instead of integer round showing "0%, 0%, 0%".
 */
export const fmtAdaptivePercent = (value: number | null | undefined, maxSpan: number): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const absSpan = Math.abs(maxSpan);
  const digits = absSpan < 0.002 ? 2 : absSpan < 0.01 ? 1 : 0;
  return fmtPercent(value, digits);
};

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats an ISO date/timestamp string (e.g. "2025-09-23" or "2025-09-23T14:30:00Z")
 * into a compact TradingView-style chart axis date: "Sep 23".
 * Pure string parsing: SSR-safe, zero timezone shifts, retains pure numeric data internally.
 */
export const fmtChartDate = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  if (str.length >= 10 && str[4] === "-" && str[7] === "-") {
    const monthNum = parseInt(str.slice(5, 7), 10);
    const dayNum = parseInt(str.slice(8, 10), 10);
    const month = MONTH_ABBR[monthNum - 1];
    if (month && !Number.isNaN(dayNum)) {
      return `${month} ${dayNum}`;
    }
  }
  return str.slice(0, 10);
};

/**
 * Formats an ISO date/timestamp string into a full date with year for hover tooltips: "Sep 23, 2025".
 * Pure string parsing: SSR-safe, zero timezone shifts.
 */
export const fmtFullDate = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  if (str.length >= 10 && str[4] === "-" && str[7] === "-") {
    const year = str.slice(0, 4);
    const monthNum = parseInt(str.slice(5, 7), 10);
    const dayNum = parseInt(str.slice(8, 10), 10);
    const month = MONTH_ABBR[monthNum - 1];
    if (month && !Number.isNaN(dayNum)) {
      return `${month} ${dayNum}, ${year}`;
    }
  }
  return str.slice(0, 10);
};

