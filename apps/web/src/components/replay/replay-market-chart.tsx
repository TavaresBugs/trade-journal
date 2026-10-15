"use client";

/**
 * Replay Market Chart (Compatibility Shim)
 *
 * This file serves as a transparent zero-regression backward-compatibility shim.
 * The core domain has been relocated to the Market Terminal subsystem:
 * `apps/web/src/components/market/market-terminal-chart.tsx`.
 */

export {
  MarketTerminalChart as ReplayMarketChart,
  isFuturesOrEquitySymbol,
  filterCandlesBySession,
  resolveVenue,
  resolveAssetIcon,
} from "../market/market-terminal-chart";
