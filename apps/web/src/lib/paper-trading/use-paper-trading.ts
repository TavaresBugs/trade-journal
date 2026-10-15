"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PaperTradingEngine } from "./paper-engine";
import {
  type PaperAccount,
  type PaperOrder,
  type PaperPosition,
  type PaperExecution,
  type PaperActivityLog,
  type PlaceOrderParams,
  type ModifyOrderParams,
} from "./types";

let globalEngineInstance: PaperTradingEngine | null = null;

export function getGlobalPaperEngine(): PaperTradingEngine {
  if (!globalEngineInstance) {
    globalEngineInstance = new PaperTradingEngine({
      persistKey: "vela-paper-trading-v1",
      initialBalance: 100000,
    });
  }
  return globalEngineInstance;
}

export function usePaperTrading(symbol?: string) {
  const engine = getGlobalPaperEngine();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsub = engine.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsub;
  }, [engine]);

  const upperSymbol = symbol?.toUpperCase();
  const account = engine.getAccount();
  const allOrders = engine.getOrders();
  const orders = upperSymbol
    ? allOrders.filter((o) => o.symbol === upperSymbol)
    : allOrders;
  const workingOrders = engine.getWorkingOrders(upperSymbol);
  const positions = engine.getPositions();
  const position = upperSymbol ? positions[upperSymbol] : undefined;
  const executions = engine.getExecutions();
  const closedTrades = engine.getClosedTrades();
  const logs = engine.getLogs();
  const lastPrice = upperSymbol ? engine.getLastPrice(upperSymbol) : undefined;

  return {
    engine,
    account,
    orders,
    allOrders,
    workingOrders,
    position,
    positions,
    executions,
    closedTrades,
    logs,
    lastPrice,
    placeOrder: (params: PlaceOrderParams) => engine.placeOrder(params),
    cancelOrder: (id: string) => engine.cancelOrder(id),
    modifyOrder: (id: string, params: ModifyOrderParams) =>
      engine.modifyOrder(id, params),
    updatePositionBrackets: (sym: string, takeProfit?: number, stopLoss?: number) =>
      engine.updatePositionBrackets(sym, takeProfit, stopLoss),
    closePosition: (sym?: string, qty?: number) =>
      engine.closePosition(sym ?? upperSymbol ?? "", qty),
    closePositionOnRewind: (sym?: string, currentTimestamp?: number) =>
      engine.closePositionOnRewind(sym ?? upperSymbol ?? "", currentTimestamp),
    checkRewindPositions: (timestamp: number) =>
      engine.checkRewindPositions(timestamp),
    reversePosition: (sym?: string) =>
      engine.reversePosition(sym ?? upperSymbol ?? ""),
    flattenAll: () => engine.flattenAll(),
    resetAccount: (initialBalance?: number) => engine.resetAccount(initialBalance),
    onTick: (
      sym: string,
      price: number,
      high?: number,
      low?: number,
      timestamp?: number
    ) => engine.onTick(sym, price, high, low, timestamp),
  };
}
