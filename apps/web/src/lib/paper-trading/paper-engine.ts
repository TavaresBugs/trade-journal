/**
 * Paper Trading Execution Engine
 * High-performance, reactive simulated broker matching engine.
 * 1:1 Parity with TradingView Paper Trading Controller.
 */

import {
  type PaperAccount,
  type PaperOrder,
  type PaperPosition,
  type PaperExecution,
  type PaperActivityLog,
  type PlaceOrderParams,
  type ModifyOrderParams,
  type PaperTradingState,
  type OrderSide,
  type ClosedTrade,
} from "./types";
import { calculatePnL, roundToTick, formatPrice } from "./symbol-specs";

export interface PaperEngineOptions {
  persistKey?: string | null;
  initialBalance?: number;
}

export class PaperTradingEngine {
  private persistKey: string | null;
  private initialBalance: number;
  private account: PaperAccount;
  private orders: PaperOrder[] = [];
  private positions: Record<string, PaperPosition> = {};
  private executions: PaperExecution[] = [];
  private closedTrades: ClosedTrade[] = [];
  private logs: PaperActivityLog[] = [];
  private lastPrices: Record<string, number> = {};
  private lastTimestamps: Record<string, number> = {};
  private listeners: Set<() => void> = new Set();

  constructor(options?: PaperEngineOptions) {
    this.persistKey = options?.persistKey ?? "vela-paper-trading-v1";
    this.initialBalance = options?.initialBalance ?? 100000;

    this.account = {
      id: "paper-main-account",
      name: "Paper Trading Account",
      balance: this.initialBalance,
      equity: this.initialBalance,
      realizedPnL: 0,
      unrealizedPnL: 0,
      currency: "USD",
      margin: 0,
      availableFunds: this.initialBalance,
      createdAt: Date.now(),
    };

    if (this.persistKey && typeof window !== "undefined") {
      this.load();
    }
  }

  // --- Read Accessors ---

  public getAccount(): PaperAccount {
    return { ...this.account };
  }

  public getOrders(): PaperOrder[] {
    return [...this.orders];
  }

  public getWorkingOrders(symbol?: string): PaperOrder[] {
    return this.orders.filter(
      (o) => o.status === "working" && (!symbol || o.symbol === symbol.toUpperCase())
    );
  }

  public getOrder(id: string): PaperOrder | undefined {
    return this.orders.find((o) => o.id === id);
  }

  public getPositions(): Record<string, PaperPosition> {
    return { ...this.positions };
  }

  public getPosition(symbol: string): PaperPosition | undefined {
    return this.positions[symbol.toUpperCase()];
  }

  public getExecutions(): PaperExecution[] {
    return [...this.executions];
  }

  public getClosedTrades(): ClosedTrade[] {
    return [...this.closedTrades];
  }

  public getLogs(): PaperActivityLog[] {
    return [...this.logs];
  }

  public getLastPrice(symbol: string): number | undefined {
    return this.lastPrices[symbol.toUpperCase()];
  }

  public getLastTimestamp(symbol: string): number | undefined {
    return this.lastTimestamps[symbol.toUpperCase()];
  }

  // --- Order Lifecycle ---

  public placeOrder(params: PlaceOrderParams): PaperOrder {
    const symbol = params.symbol.toUpperCase();
    const now = params.timestamp ?? this.lastTimestamps[symbol] ?? Date.now();
    const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let price = params.price ?? this.lastPrices[symbol] ?? 0;
    price = roundToTick(symbol, price);

    const order: PaperOrder = {
      id,
      symbol,
      side: params.side,
      type: params.type,
      qty: params.qty,
      price,
      stopPrice: params.stopPrice ? roundToTick(symbol, params.stopPrice) : undefined,
      status: "working",
      createdAt: now,
      takeProfit: params.takeProfit ? roundToTick(symbol, params.takeProfit) : undefined,
      stopLoss: params.stopLoss ? roundToTick(symbol, params.stopLoss) : undefined,
      isBracketChild: params.isBracketChild,
      bracketType: params.bracketType,
      parentOrderId: params.parentOrderId,
    };

    if (params.isBracketChild && this.positions[symbol]) {
      if (params.bracketType === "take_profit") {
        this.positions[symbol].takeProfitOrderId = id;
      } else if (params.bracketType === "stop_loss") {
        this.positions[symbol].stopLossOrderId = id;
      }
    }

    this.orders.unshift(order);
    this.addLog("order_placed", symbol, `Order placed: ${order.side.toUpperCase()} ${order.qty} ${symbol} @ ${formatPrice(symbol, price)} (${order.type})`);

    // Immediate fill for market orders
    if (params.type === "market") {
      this.fillOrder(order, price, now);
    }

    this.save();
    this.notify();
    return order;
  }

  public cancelOrder(id: string): PaperOrder {
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }

    if (order.status !== "working") {
      return order;
    }

    order.status = "cancelled";
    order.cancelledAt = Date.now();

    this.addLog("order_cancelled", order.symbol, `Order cancelled: ${order.side.toUpperCase()} ${order.qty} ${order.symbol}`);

    // If this had bracket children that are still working, cancel them
    if (order.bracketChildIds?.length) {
      for (const childId of order.bracketChildIds) {
        const child = this.getOrder(childId);
        if (child && child.status === "working") {
          child.status = "cancelled";
          child.cancelledAt = Date.now();
        }
      }
    }

    this.save();
    this.notify();
    return order;
  }

  public modifyOrder(id: string, params: ModifyOrderParams): PaperOrder {
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }

    if (order.status !== "working") {
      return order;
    }

    if (params.price !== undefined) {
      order.price = roundToTick(order.symbol, params.price);
    }
    if (params.stopPrice !== undefined) {
      order.stopPrice = roundToTick(order.symbol, params.stopPrice);
    }
    if (params.qty !== undefined) {
      order.qty = params.qty;
    }
    if (params.takeProfit !== undefined) {
      if (params.takeProfit === null || params.takeProfit === 0) {
        order.takeProfit = undefined;
      } else {
        order.takeProfit = roundToTick(order.symbol, params.takeProfit);
      }
    }
    if (params.stopLoss !== undefined) {
      if (params.stopLoss === null || params.stopLoss === 0) {
        order.stopLoss = undefined;
      } else {
        order.stopLoss = roundToTick(order.symbol, params.stopLoss);
      }
    }

    this.addLog("order_modified", order.symbol, `Order modified: ${order.id} @ ${formatPrice(order.symbol, order.price)}`);

    this.save();
    this.notify();
    return order;
  }

  public closePosition(symbol: string, qty?: number): PaperOrder {
    const s = symbol.toUpperCase();
    const pos = this.positions[s];
    if (!pos) {
      throw new Error(`No open position for ${s}`);
    }

    const currentPrice = this.lastPrices[s] ?? pos.avgPrice;
    const exitSide: OrderSide = pos.side === "long" ? "sell" : "buy";
    const closeQty = qty && qty > 0 ? Math.min(pos.qty, Math.floor(qty)) : pos.qty;

    if (closeQty >= pos.qty) {
      // Cancel any active brackets for this position
      this.cancelPositionBrackets(s);
    } else {
      // Partially closing: adjust working brackets qty to remainingQty
      const remaining = pos.qty - closeQty;
      for (const ord of Object.values(this.orders)) {
        if (ord.symbol === s && ord.status === "working" && ord.isBracketChild) {
          ord.qty = remaining;
        }
      }
    }

    const closeOrder = this.placeOrder({
      symbol: s,
      side: exitSide,
      type: "market",
      qty: closeQty,
      price: currentPrice,
    });

    this.addLog(
      "position_closed",
      s,
      `Position ${closeQty < pos.qty ? "partially " : ""}closed for ${s} (${closeQty} units) @ ${formatPrice(s, currentPrice)}`
    );
    return closeOrder;
  }

  public reversePosition(symbol: string): void {
    const s = symbol.toUpperCase();
    const pos = this.positions[s];
    if (!pos) return;

    const currentPrice = this.lastPrices[s] ?? pos.avgPrice;
    const reverseQty = pos.qty * 2;
    const reverseSide: OrderSide = pos.side === "long" ? "sell" : "buy";

    // Cancel existing brackets
    this.cancelPositionBrackets(s);

    this.placeOrder({
      symbol: s,
      side: reverseSide,
      type: "market",
      qty: reverseQty,
      price: currentPrice,
    });

    this.addLog("position_reversed", s, `Position reversed on ${s}`);
  }

  public flattenAll(): void {
    // Cancel all working orders
    for (const order of this.orders) {
      if (order.status === "working") {
        order.status = "cancelled";
        order.cancelledAt = Date.now();
      }
    }

    // Close all open positions
    for (const sym of Object.keys(this.positions)) {
      const pos = this.positions[sym];
      if (pos) {
        const currentPrice = this.lastPrices[sym] ?? pos.avgPrice;
        const exitSide: OrderSide = pos.side === "long" ? "sell" : "buy";

        this.placeOrder({
          symbol: sym,
          side: exitSide,
          type: "market",
          qty: pos.qty,
          price: currentPrice,
        });
      }
    }

    this.save();
    this.notify();
  }

  public resetAccount(initialBalance?: number): void {
    this.initialBalance = initialBalance ?? 100000;
    this.orders = [];
    this.positions = {};
    this.executions = [];
    this.closedTrades = [];
    this.logs = [];
    this.account = {
      id: "paper-main-account",
      name: "Paper Trading Account",
      balance: this.initialBalance,
      equity: this.initialBalance,
      realizedPnL: 0,
      unrealizedPnL: 0,
      currency: "USD",
      margin: 0,
      availableFunds: this.initialBalance,
      createdAt: Date.now(),
    };

    this.addLog("account_reset", undefined, `Account reset to ${this.initialBalance} USD`);
    this.lastTimestamps = {};
    this.save();
    this.notify();
  }

  public closePositionOnRewind(symbol: string, currentTimestamp?: number): void {
    const s = symbol.toUpperCase();
    const pos = this.positions[s];
    if (!pos) return;

    const ts = currentTimestamp ?? this.lastTimestamps[s] ?? Date.now();
    const toEpochMs = (t: number) => (t < 1e11 ? t * 1000 : t);
    const nowMs = toEpochMs(ts);

    // Cancel existing brackets for this position
    this.cancelPositionBrackets(s);

    // Remove open position
    delete this.positions[s];

    // Cancel working orders created at or after the rewound timestamp
    for (const order of this.orders) {
      if (order.symbol === s && order.status === "working") {
        if (toEpochMs(order.createdAt) >= nowMs) {
          order.status = "cancelled";
          order.cancelledAt = ts;
        }
      }
    }

    this.addLog(
      "position_closed",
      s,
      `Position closed: replay rewound before entry time for ${s}`
    );

    this.recalculateAccount();
    this.save();
    this.notify();
  }

  public checkRewindPositions(timestamp: number): void {
    const toEpochMs = (t: number) => (t < 1e11 ? t * 1000 : t);
    const nowMs = toEpochMs(timestamp);
    for (const s of Object.keys(this.positions)) {
      const pos = this.positions[s];
      if (pos && nowMs < toEpochMs(pos.openedAt)) {
        this.closePositionOnRewind(s, timestamp);
      }
    }

    // Also cancel any standalone working orders created after the rewound timestamp
    let cancelledWorking = false;
    for (const order of this.orders) {
      if (order.status === "working" && toEpochMs(order.createdAt) > nowMs) {
        order.status = "cancelled";
        order.cancelledAt = timestamp;
        cancelledWorking = true;
      }
    }
    if (cancelledWorking) {
      this.recalculateAccount();
      this.save();
      this.notify();
    }
  }

  public cancelAllOnExitReplay(): void {
    let changed = false;

    for (const order of this.orders) {
      if (order.status === "working") {
        order.status = "cancelled";
        order.cancelledAt = Date.now();
        changed = true;
      }
    }

    const openSymbols = Object.keys(this.positions);
    if (openSymbols.length > 0) {
      for (const s of openSymbols) {
        this.cancelPositionBrackets(s);
        delete this.positions[s];
      }
      this.addLog("position_closed", undefined, "Open replay positions and working orders cancelled on Replay exit");
      changed = true;
    }

    if (changed) {
      this.recalculateAccount();
      this.save();
      this.notify();
    }
  }

  // --- Realtime / Replay Tick Engine ---

  public onTick(
    symbol: string,
    price: number,
    high?: number,
    low?: number,
    timestamp?: number
  ): void {
    const s = symbol.toUpperCase();
    const now = timestamp ?? Date.now();
    this.lastPrices[s] = price;
    this.lastTimestamps[s] = now;

    // Check if replay timeline rewound before an open position was opened/filled
    if (timestamp !== undefined) {
      this.checkRewindPositions(timestamp);
    }

    const effHigh = high ?? price;
    const effLow = low ?? price;

    // 1. Check working orders for fills
    const workingOrders = this.orders.filter(
      (o) => o.status === "working" && o.symbol === s
    );

    for (const order of workingOrders) {
      let triggered = false;
      let fillPrice = order.price;

      if (order.type === "limit") {
        if (order.side === "buy" && effLow <= order.price) {
          triggered = true;
          fillPrice = order.price;
        } else if (order.side === "sell" && effHigh >= order.price) {
          triggered = true;
          fillPrice = order.price;
        }
      } else if (order.type === "stop") {
        const stopTrigger = order.stopPrice ?? order.price;
        if (order.side === "buy" && effHigh >= stopTrigger) {
          triggered = true;
          fillPrice = order.price;
        } else if (order.side === "sell" && effLow <= stopTrigger) {
          triggered = true;
          fillPrice = order.price;
        }
      } else if (order.type === "stop_limit") {
        const stopTrigger = order.stopPrice ?? order.price;
        // Check if stop activation condition is met or previously activated
        if (!order.isStopTriggered) {
          if (order.side === "buy" && effHigh >= stopTrigger) {
            order.isStopTriggered = true;
          } else if (order.side === "sell" && effLow <= stopTrigger) {
            order.isStopTriggered = true;
          }
        }

        // Once triggered, execute as a limit order
        if (order.isStopTriggered) {
          if (order.side === "buy" && effLow <= order.price) {
            triggered = true;
            fillPrice = order.price;
          } else if (order.side === "sell" && effHigh >= order.price) {
            triggered = true;
            fillPrice = order.price;
          }
        }
      }

      if (triggered) {
        this.fillOrder(order, fillPrice, now);
      }
    }

    // 2. Update open position metrics & unrealized PnL
    this.updatePositionPnL(s, price);

    // 3. Recalculate account summary
    this.recalculateAccount();

    this.notify();
  }

  // --- Private Engine Internals ---

  private fillOrder(order: PaperOrder, fillPrice: number, timestamp: number): void {
    order.status = "filled";
    order.filledPrice = fillPrice;
    order.filledQty = order.qty;
    order.filledAt = timestamp;

    const execution: PaperExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      qty: order.qty,
      price: fillPrice,
      timestamp,
      commission: 0,
    };
    this.executions.unshift(execution);

    this.addLog(
      "order_filled",
      order.symbol,
      `Order filled: ${order.side.toUpperCase()} ${order.qty} ${order.symbol} @ ${formatPrice(order.symbol, fillPrice)}`
    );

    // Update position and realized PnL
    this.applyOrderToPosition(order, fillPrice, timestamp);

    // Handle OCO sibling cancellation if this order is a bracket child
    if (order.isBracketChild && order.parentOrderId) {
      const parent = this.getOrder(order.parentOrderId);
      if (parent && parent.bracketChildIds) {
        for (const siblingId of parent.bracketChildIds) {
          if (siblingId !== order.id) {
            const sibling = this.getOrder(siblingId);
            if (sibling && sibling.status === "working") {
              sibling.status = "cancelled";
              sibling.cancelledAt = timestamp;
              this.addLog(
                "order_cancelled",
                sibling.symbol,
                `OCO: Cancelled ${sibling.bracketType} order ${sibling.id}`
              );
            }
          }
        }
      }
    }

    // Spawn bracket child orders if defined and not already spawned
    if ((order.takeProfit || order.stopLoss) && !order.isBracketChild) {
      this.spawnBrackets(order, fillPrice, timestamp);
    }
  }

  private applyOrderToPosition(
    order: PaperOrder,
    fillPrice: number,
    timestamp: number
  ): void {
    const s = order.symbol;
    const existing = this.positions[s];
    const isBuy = order.side === "buy";

    if (!existing) {
      // Create new position
      const side = isBuy ? "long" : "short";
      this.positions[s] = {
        id: `pos-${s}-${Date.now()}`,
        symbol: s,
        side,
        qty: order.qty,
        avgPrice: fillPrice,
        currentPrice: fillPrice,
        unrealizedPnL: 0,
        unrealizedPnLTicks: 0,
        unrealizedPnLPoints: 0,
        unrealizedPnLPercent: 0,
        openedAt: timestamp,
        updatedAt: timestamp,
      };
      return;
    }

    const sameDirection =
      (existing.side === "long" && isBuy) || (existing.side === "short" && !isBuy);

    if (sameDirection) {
      // Increase position size
      const totalQty = existing.qty + order.qty;
      const totalCost = existing.qty * existing.avgPrice + order.qty * fillPrice;
      existing.avgPrice = Number((totalCost / totalQty).toFixed(4));
      existing.qty = totalQty;
      existing.updatedAt = timestamp;
    } else {
      // Reducing, closing or reversing position
      const closeQty = Math.min(existing.qty, order.qty);
      const remainingQty = existing.qty - closeQty;
      const pnl = calculatePnL(
        s,
        existing.avgPrice,
        fillPrice,
        existing.side,
        closeQty
      );

      // Credit Realized PnL to balance
      this.account.realizedPnL = Number((this.account.realizedPnL + pnl.cashAmount).toFixed(2));
      this.account.balance = Number((this.account.balance + pnl.cashAmount).toFixed(2));

      // Record Closed Trade for Replay Trading Strategy Report & List of Trades
      const tradeNumber = this.closedTrades.length + 1;
      const closedTrade: ClosedTrade = {
        id: `trade-${Date.now()}-${tradeNumber}-${Math.random().toString(36).slice(2, 6)}`,
        tradeNumber,
        symbol: s,
        side: existing.side,
        entryTime: existing.openedAt,
        exitTime: timestamp,
        entryPrice: existing.avgPrice,
        exitPrice: fillPrice,
        qty: closeQty,
        profit: pnl.cashAmount,
        profitPercent: pnl.percent,
        cumProfit: this.account.realizedPnL,
        signal:
          order.bracketType === "take_profit"
            ? "Take Profit"
            : order.bracketType === "stop_loss"
            ? "Stop Loss"
            : order.type === "market"
            ? "Market Exit"
            : "Exit",
      };
      this.closedTrades.push(closedTrade);

      if (remainingQty === 0) {
        // Cancel brackets attached to this position before closing or flipping
        this.cancelPositionBrackets(s);

        if (order.qty > closeQty) {
          // Flip / Reverse position
          const flippedSide = isBuy ? "long" : "short";
          const excessQty = order.qty - closeQty;
          this.positions[s] = {
            id: `pos-${s}-${Date.now()}`,
            symbol: s,
            side: flippedSide,
            qty: excessQty,
            avgPrice: fillPrice,
            currentPrice: fillPrice,
            unrealizedPnL: 0,
            unrealizedPnLTicks: 0,
            unrealizedPnLPoints: 0,
            unrealizedPnLPercent: 0,
            openedAt: timestamp,
            updatedAt: timestamp,
          };
        } else {
          // Exactly closed
          delete this.positions[s];
        }
      } else {
        // Partially closed
        existing.qty = remainingQty;
        existing.updatedAt = timestamp;

        // Rescale working bracket child orders to match remaining position quantity
        for (const ord of this.orders) {
          if (ord.symbol === s && ord.status === "working" && ord.isBracketChild) {
            ord.qty = remainingQty;
          }
        }
      }
    }
  }

  private spawnBrackets(
    parentOrder: PaperOrder,
    fillPrice: number,
    timestamp: number
  ): void {
    const s = parentOrder.symbol;
    const isLong = parentOrder.side === "buy";
    const bracketIds: string[] = [];

    // Take Profit Bracket
    if (parentOrder.takeProfit) {
      const tpSide: OrderSide = isLong ? "sell" : "buy";
      const tpOrder: PaperOrder = {
        id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: s,
        side: tpSide,
        type: "limit",
        qty: parentOrder.qty,
        price: parentOrder.takeProfit,
        status: "working",
        createdAt: timestamp,
        parentOrderId: parentOrder.id,
        isBracketChild: true,
        bracketType: "take_profit",
      };
      this.orders.unshift(tpOrder);
      bracketIds.push(tpOrder.id);
      if (this.positions[s]) {
        this.positions[s].takeProfitOrderId = tpOrder.id;
      }
    }

    // Stop Loss Bracket
    if (parentOrder.stopLoss) {
      const slSide: OrderSide = isLong ? "sell" : "buy";
      const slOrder: PaperOrder = {
        id: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: s,
        side: slSide,
        type: "stop",
        qty: parentOrder.qty,
        price: parentOrder.stopLoss,
        stopPrice: parentOrder.stopLoss,
        status: "working",
        createdAt: timestamp,
        parentOrderId: parentOrder.id,
        isBracketChild: true,
        bracketType: "stop_loss",
      };
      this.orders.unshift(slOrder);
      bracketIds.push(slOrder.id);
      if (this.positions[s]) {
        this.positions[s].stopLossOrderId = slOrder.id;
      }
    }

    parentOrder.bracketChildIds = bracketIds;
  }

  public updatePositionBrackets(
    symbol: string,
    takeProfit?: number,
    stopLoss?: number
  ): void {
    const s = symbol.toUpperCase();
    const pos = this.positions[s];
    if (!pos) return;

    const isLong = pos.side === "long";
    const exitSide: OrderSide = isLong ? "sell" : "buy";
    const timestamp = Date.now();

    // Take Profit
    if (takeProfit && takeProfit > 0) {
      const roundedTp = roundToTick(s, takeProfit);
      if (pos.takeProfitOrderId) {
        const existingTp = this.getOrder(pos.takeProfitOrderId);
        if (existingTp && existingTp.status === "working") {
          existingTp.price = roundedTp;
          existingTp.qty = pos.qty;
        } else {
          pos.takeProfitOrderId = undefined;
        }
      }
      if (!pos.takeProfitOrderId) {
        const tpOrder: PaperOrder = {
          id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: s,
          side: exitSide,
          type: "limit",
          qty: pos.qty,
          price: roundedTp,
          status: "working",
          createdAt: timestamp,
          isBracketChild: true,
          bracketType: "take_profit",
        };
        this.orders.unshift(tpOrder);
        pos.takeProfitOrderId = tpOrder.id;
      }
    } else if (pos.takeProfitOrderId) {
      this.cancelOrderSilently(pos.takeProfitOrderId);
      pos.takeProfitOrderId = undefined;
    }

    // Stop Loss
    if (stopLoss && stopLoss > 0) {
      const roundedSl = roundToTick(s, stopLoss);
      if (pos.stopLossOrderId) {
        const existingSl = this.getOrder(pos.stopLossOrderId);
        if (existingSl && existingSl.status === "working") {
          existingSl.price = roundedSl;
          existingSl.stopPrice = roundedSl;
          existingSl.qty = pos.qty;
        } else {
          pos.stopLossOrderId = undefined;
        }
      }
      if (!pos.stopLossOrderId) {
        const slOrder: PaperOrder = {
          id: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: s,
          side: exitSide,
          type: "stop",
          qty: pos.qty,
          price: roundedSl,
          stopPrice: roundedSl,
          status: "working",
          createdAt: timestamp,
          isBracketChild: true,
          bracketType: "stop_loss",
        };
        this.orders.unshift(slOrder);
        pos.stopLossOrderId = slOrder.id;
      }
    } else if (pos.stopLossOrderId) {
      this.cancelOrderSilently(pos.stopLossOrderId);
      pos.stopLossOrderId = undefined;
    }

    this.addLog("order_modified", s, `Brackets updated for ${s} position`);
    this.save();
    this.notify();
  }

  private cancelPositionBrackets(symbol: string): void {
    const pos = this.positions[symbol];
    if (pos) {
      if (pos.takeProfitOrderId) {
        this.cancelOrderSilently(pos.takeProfitOrderId);
      }
      if (pos.stopLossOrderId) {
        this.cancelOrderSilently(pos.stopLossOrderId);
      }
    }

    // Defensively cancel any working bracket child orders for this symbol
    for (const ord of this.orders) {
      if (ord.symbol === symbol && ord.isBracketChild && ord.status === "working") {
        this.cancelOrderSilently(ord.id);
      }
    }
  }

  private cancelOrderSilently(id: string): void {
    const order = this.getOrder(id);
    if (order && order.status === "working") {
      order.status = "cancelled";
      order.cancelledAt = Date.now();
    }
  }

  private updatePositionPnL(symbol: string, currentPrice: number): void {
    const pos = this.positions[symbol];
    if (!pos) return;

    pos.currentPrice = currentPrice;
    const pnl = calculatePnL(symbol, pos.avgPrice, currentPrice, pos.side, pos.qty);
    pos.unrealizedPnL = pnl.cashAmount;
    pos.unrealizedPnLPoints = pnl.points;
    pos.unrealizedPnLTicks = pnl.ticks;
    pos.unrealizedPnLPercent = pnl.percent;
  }

  private recalculateAccount(): void {
    let totalUnrealized = 0;
    for (const pos of Object.values(this.positions)) {
      totalUnrealized += pos.unrealizedPnL;
    }
    this.account.unrealizedPnL = Number(totalUnrealized.toFixed(2));
    this.account.equity = Number((this.account.balance + this.account.unrealizedPnL).toFixed(2));
    this.account.availableFunds = this.account.equity;
  }

  private addLog(type: PaperActivityLog["type"], symbol: string | undefined, message: string): void {
    this.logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      symbol,
      message,
    });
    // Keep max 200 logs
    if (this.logs.length > 200) {
      this.logs.pop();
    }
  }

  // --- Persistence & React Subscriptions ---

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      l();
    }
  }

  public save(): void {
    if (!this.persistKey || typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      const state: PaperTradingState = {
        account: this.account,
        orders: this.orders.slice(0, 500),
        positions: this.positions,
        executions: this.executions.slice(0, 500),
        closedTrades: this.closedTrades.slice(0, 500),
        logs: this.logs.slice(0, 200),
      };
      window.localStorage.setItem(this.persistKey, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }

  public load(): void {
    if (!this.persistKey || typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(this.persistKey);
      if (!raw) return;
      const state = JSON.parse(raw) as PaperTradingState;
      if (state.account) this.account = state.account;
      if (state.orders) this.orders = state.orders;
      if (state.positions) this.positions = state.positions;
      if (state.executions) this.executions = state.executions;
      if (state.closedTrades) this.closedTrades = state.closedTrades;
      if (state.logs) this.logs = state.logs;
    } catch {
      // Fallback to fresh state
    }
  }
}
