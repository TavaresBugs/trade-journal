import {
  formatPrice,
  roundToTick,
  getPaperInstrumentSpec,
  calculatePnL,
} from "./symbol-specs";
import {
  type OrderSide,
  type OrderType,
  type PaperOrder,
  type PaperPosition,
} from "./types";

export function formatPriceWithCommas(symbol: string, price: number): string {
  const spec = getPaperInstrumentSpec(symbol);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: spec.decimals,
    maximumFractionDigits: spec.decimals,
  });
}

export type PreOrderMode = "create" | "modify_order" | "edit_position";

export interface PreOrderBracketLevel {
  enabled: boolean;
  price: number;
  ticks: number;
  usd: number;
  percent: number;
  mode: "price" | "ticks" | "usd" | "percent";
}

export interface PreOrderState {
  isOpen: boolean;
  mode: PreOrderMode;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  qtyMode: "units" | "risk_usd" | "risk_percent";
  riskUsdValue?: number;
  riskPercentValue?: number;
  price: number;
  stopPrice: number;
  priceMode: "absolute" | "ask" | "bid" | "last";
  priceIsOffset?: boolean;
  priceOffsetTicks?: number;
  stopPriceIsOffset?: boolean;
  stopPriceOffsetTicks?: number;
  takeProfit: PreOrderBracketLevel;
  stopLoss: PreOrderBracketLevel;
  activeDragTarget?: "entry" | "tp" | "sl" | null;
  lastUpdateSource?: "chart" | "ticket";
  // Modify Order Mode
  editOrderId?: string | null;
  editOrderDescription?: string | null;
  // Edit Position Mode
  editPositionSymbol?: string | null;
  editPositionSide?: "long" | "short" | null;
  editPositionQty?: number | null;
  editPositionAvgPrice?: number | null;
  editPositionDescription?: string | null;
}

type Listener = (state: PreOrderState) => void;

class PreOrderStoreImpl {
  private state: PreOrderState = {
    isOpen: false,
    mode: "create",
    symbol: "MES",
    side: "buy",
    type: "limit",
    qty: 1,
    qtyMode: "units",
    price: 0,
    stopPrice: 0,
    priceMode: "absolute",
    priceIsOffset: false,
    stopPriceIsOffset: false,
    editOrderId: null,
    editOrderDescription: null,
    editPositionSymbol: null,
    editPositionSide: null,
    editPositionQty: null,
    editPositionAvgPrice: null,
    editPositionDescription: null,
    takeProfit: {
      enabled: false,
      price: 0,
      ticks: 40,
      usd: 0,
      percent: 0,
      mode: "price",
    },
    stopLoss: {
      enabled: false,
      price: 0,
      ticks: 20,
      usd: 0,
      percent: 0,
      mode: "price",
    },
    activeDragTarget: null,
  };

  private listeners: Set<Listener> = new Set();

  public getState(): PreOrderState {
    return this.state;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public reset(symbol: string, currentPrice: number = 0) {
    const spec = getPaperInstrumentSpec(symbol);
    const p = currentPrice > 0 ? roundToTick(symbol, currentPrice) : 0;
    const defaultTpTicks = 40;
    const defaultSlTicks = 20;

    const tpDelta = defaultTpTicks * spec.tickSize;
    const slDelta = defaultSlTicks * spec.tickSize;

    this.state = {
      isOpen: false,
      mode: "create",
      symbol,
      side: "buy",
      type: "limit",
      qty: 1,
      qtyMode: "units",
      price: p,
      stopPrice: p,
      priceMode: "absolute",
      priceIsOffset: false,
      stopPriceIsOffset: false,
      editOrderId: null,
      editOrderDescription: null,
      editPositionSymbol: null,
      editPositionSide: null,
      editPositionQty: null,
      editPositionAvgPrice: null,
      editPositionDescription: null,
      takeProfit: {
        enabled: false,
        price: p > 0 ? roundToTick(symbol, p + tpDelta) : 0,
        ticks: defaultTpTicks,
        usd: (tpDelta / spec.tickSize) * spec.tickValue,
        percent: 0,
        mode: "price",
      },
      stopLoss: {
        enabled: false,
        price: p > 0 ? roundToTick(symbol, p - slDelta) : 0,
        ticks: defaultSlTicks,
        usd: (slDelta / spec.tickSize) * spec.tickValue,
        percent: 0,
        mode: "price",
      },
      activeDragTarget: null,
    };
    this.notify();
  }

  public open(
    symbol: string,
    side: OrderSide = "buy",
    type: OrderType = "limit",
    initialPrice?: number
  ) {
    const spec = getPaperInstrumentSpec(symbol);
    const p = initialPrice && initialPrice > 0 ? roundToTick(symbol, initialPrice) : this.state.price;

    this.state = {
      ...this.state,
      isOpen: true,
      mode: "create",
      symbol,
      side,
      type,
      qtyMode: "units",
      price: p,
      stopPrice: p,
      priceIsOffset: false,
      stopPriceIsOffset: false,
      editOrderId: null,
      editOrderDescription: null,
      editPositionSymbol: null,
      editPositionSide: null,
      editPositionQty: null,
      editPositionAvgPrice: null,
      editPositionDescription: null,
      takeProfit: {
        ...this.state.takeProfit,
        enabled: false,
      },
      stopLoss: {
        ...this.state.stopLoss,
        enabled: false,
      },
    };

    if (p > 0) {
      this.recalculateBracketsFromTicks();
    }

    this.notify();
  }

  public openModifyOrder(order: PaperOrder) {
    const spec = getPaperInstrumentSpec(order.symbol);
    const p = roundToTick(order.symbol, order.price);
    const stopP = order.stopPrice ? roundToTick(order.symbol, order.stopPrice) : p;
    const isLong = order.side === "buy";

    let hasTp = false;
    let tpPrice = 0;
    let tpTicks = 40;
    let tpUsd = 0;
    let tpPercent = 0;

    if (order.takeProfit && order.takeProfit > 0) {
      hasTp = true;
      tpPrice = roundToTick(order.symbol, order.takeProfit);
      tpTicks = Math.round(Math.abs(tpPrice - p) / spec.tickSize);
      tpUsd = tpTicks * spec.tickValue * order.qty;
      tpPercent = p > 0 ? Number((((tpTicks * spec.tickSize) / p) * 100).toFixed(2)) : 0;
    } else {
      const tpDelta = tpTicks * spec.tickSize;
      tpPrice = roundToTick(order.symbol, isLong ? p + tpDelta : p - tpDelta);
      tpUsd = tpTicks * spec.tickValue * order.qty;
    }

    let hasSl = false;
    let slPrice = 0;
    let slTicks = 20;
    let slUsd = 0;
    let slPercent = 0;

    if (order.stopLoss && order.stopLoss > 0) {
      hasSl = true;
      slPrice = roundToTick(order.symbol, order.stopLoss);
      slTicks = Math.round(Math.abs(slPrice - p) / spec.tickSize);
      const pnl = calculatePnL(order.symbol, p, slPrice, order.side, order.qty);
      slUsd = Math.abs(pnl.cashAmount);
      slPercent = p > 0 ? Number((((slTicks * spec.tickSize) / p) * 100).toFixed(2)) : 0;
    } else {
      const slDelta = slTicks * spec.tickSize;
      slPrice = roundToTick(order.symbol, isLong ? p - slDelta : p + slDelta);
      const pnl = calculatePnL(order.symbol, p, slPrice, order.side, order.qty);
      slUsd = Math.abs(pnl.cashAmount);
    }

    const typeLabel = order.type === "stop_limit" ? "Stop Limit" : order.type.charAt(0).toUpperCase() + order.type.slice(1);
    const desc = `${order.side === "buy" ? "Buy" : "Sell"} ${typeLabel} ${order.qty} @ ${formatPriceWithCommas(order.symbol, p)}`;

    this.state = {
      ...this.state,
      isOpen: true,
      mode: "modify_order",
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      qty: order.qty,
      qtyMode: "units",
      price: p,
      stopPrice: stopP,
      priceMode: "absolute",
      priceIsOffset: false,
      stopPriceIsOffset: false,
      editOrderId: order.id,
      editOrderDescription: desc,
      editPositionSymbol: null,
      editPositionSide: null,
      editPositionQty: null,
      editPositionAvgPrice: null,
      editPositionDescription: null,
      takeProfit: {
        enabled: hasTp,
        price: tpPrice,
        ticks: tpTicks,
        usd: tpUsd,
        percent: tpPercent,
        mode: "price",
      },
      stopLoss: {
        enabled: hasSl,
        price: slPrice,
        ticks: slTicks,
        usd: slUsd,
        percent: slPercent,
        mode: "price",
      },
    };
    this.notify();
  }

  public openEditPosition(pos: PaperPosition, workingOrders: PaperOrder[] = []) {
    const spec = getPaperInstrumentSpec(pos.symbol);
    const entryPrice = roundToTick(pos.symbol, pos.avgPrice);
    const isLong = pos.side === "long";
    const side: OrderSide = isLong ? "buy" : "sell";

    let hasTp = false;
    let tpPrice = 0;
    let tpTicks = 40;

    let hasSl = false;
    let slPrice = 0;
    let slTicks = 20;

    const tpOrder = workingOrders.find(
      (o) => o.symbol === pos.symbol && o.isBracketChild && o.bracketType === "take_profit" && o.status === "working"
    ) || (pos.takeProfitOrderId ? workingOrders.find((o) => o.id === pos.takeProfitOrderId) : undefined);

    const slOrder = workingOrders.find(
      (o) => o.symbol === pos.symbol && o.isBracketChild && o.bracketType === "stop_loss" && o.status === "working"
    ) || (pos.stopLossOrderId ? workingOrders.find((o) => o.id === pos.stopLossOrderId) : undefined);

    if (tpOrder && tpOrder.price > 0) {
      hasTp = true;
      tpPrice = roundToTick(pos.symbol, tpOrder.price);
      tpTicks = Math.round(Math.abs(tpPrice - entryPrice) / spec.tickSize);
    } else {
      const delta = tpTicks * spec.tickSize;
      tpPrice = roundToTick(pos.symbol, isLong ? entryPrice + delta : entryPrice - delta);
    }

    if (slOrder && (slOrder.stopPrice || slOrder.price) > 0) {
      hasSl = true;
      slPrice = roundToTick(pos.symbol, slOrder.stopPrice ?? slOrder.price);
      slTicks = Math.round(Math.abs(slPrice - entryPrice) / spec.tickSize);
    } else {
      const delta = slTicks * spec.tickSize;
      slPrice = roundToTick(pos.symbol, isLong ? entryPrice - delta : entryPrice + delta);
    }

    const slPnl = calculatePnL(pos.symbol, entryPrice, slPrice, side, pos.qty);
    const tpPercent = entryPrice > 0 ? Number((((tpTicks * spec.tickSize) / entryPrice) * 100).toFixed(2)) : 0;
    const slPercent = entryPrice > 0 ? Number((((slTicks * spec.tickSize) / entryPrice) * 100).toFixed(2)) : 0;

    const desc = `${isLong ? "Long" : "Short"} ${pos.qty} @ ${formatPriceWithCommas(pos.symbol, entryPrice)}`;

    this.state = {
      ...this.state,
      isOpen: true,
      mode: "edit_position",
      symbol: pos.symbol,
      side,
      type: "limit",
      qty: pos.qty,
      qtyMode: "units",
      price: entryPrice,
      stopPrice: entryPrice,
      priceMode: "absolute",
      priceIsOffset: false,
      stopPriceIsOffset: false,
      editOrderId: null,
      editOrderDescription: null,
      editPositionSymbol: pos.symbol,
      editPositionSide: pos.side,
      editPositionQty: pos.qty,
      editPositionAvgPrice: entryPrice,
      editPositionDescription: desc,
      takeProfit: {
        enabled: hasTp,
        price: tpPrice,
        ticks: tpTicks,
        usd: tpTicks * spec.tickValue * pos.qty,
        percent: tpPercent,
        mode: "price",
      },
      stopLoss: {
        enabled: hasSl,
        price: slPrice,
        ticks: slTicks,
        usd: Math.abs(slPnl.cashAmount),
        percent: slPercent,
        mode: "price",
      },
    };
    this.notify();
  }

  public discardEdit() {
    this.state = {
      ...this.state,
      mode: "create",
      qtyMode: "units",
      editOrderId: null,
      editOrderDescription: null,
      editPositionSymbol: null,
      editPositionSide: null,
      editPositionQty: null,
      editPositionAvgPrice: null,
      editPositionDescription: null,
      takeProfit: {
        ...this.state.takeProfit,
        enabled: false,
      },
      stopLoss: {
        ...this.state.stopLoss,
        enabled: false,
      },
    };
    this.notify();
  }

  public togglePriceOffset() {
    this.state = {
      ...this.state,
      priceIsOffset: !this.state.priceIsOffset,
    };
    this.notify();
  }

  public toggleStopPriceOffset() {
    this.state = {
      ...this.state,
      stopPriceIsOffset: !this.state.stopPriceIsOffset,
    };
    this.notify();
  }

  public close() {
    this.state = {
      ...this.state,
      isOpen: false,
      mode: "create",
      qtyMode: "units",
      editOrderId: null,
      editOrderDescription: null,
      editPositionSymbol: null,
      editPositionSide: null,
      editPositionQty: null,
      editPositionAvgPrice: null,
      editPositionDescription: null,
      takeProfit: {
        ...this.state.takeProfit,
        enabled: false,
      },
      stopLoss: {
        ...this.state.stopLoss,
        enabled: false,
      },
      activeDragTarget: null,
    };
    this.notify();
  }

  public setPrice(
    rawPrice: number,
    source: "chart" | "ticket" = "ticket",
    preserveOffsets: boolean = true
  ) {
    const price = roundToTick(this.state.symbol, rawPrice);
    if (this.state.price === price && this.state.lastUpdateSource === source) return;

    const oldPrice = this.state.price;
    const spec = getPaperInstrumentSpec(this.state.symbol);

    let nextTp = { ...this.state.takeProfit };
    let nextSl = { ...this.state.stopLoss };

    if (preserveOffsets && oldPrice > 0) {
      if (nextTp.enabled || nextTp.ticks > 0) {
        const tpDelta = nextTp.ticks * spec.tickSize;
        nextTp.price = roundToTick(
          this.state.symbol,
          this.state.side === "buy" ? price + tpDelta : price - tpDelta
        );
      }
      if (nextSl.enabled || nextSl.ticks > 0) {
        const slDelta = nextSl.ticks * spec.tickSize;
        nextSl.price = roundToTick(
          this.state.symbol,
          this.state.side === "buy" ? price - slDelta : price + slDelta
        );
        const pnl = calculatePnL(this.state.symbol, price, nextSl.price, this.state.side, this.state.qty);
        nextSl.usd = Math.abs(pnl.cashAmount);
      }
    } else {
      // Recalculate ticks from new price
      if (nextTp.price > 0 && spec.tickSize > 0) {
        nextTp.ticks = Math.round(Math.abs(nextTp.price - price) / spec.tickSize);
      }
      if (nextSl.price > 0 && spec.tickSize > 0) {
        nextSl.ticks = Math.round(Math.abs(nextSl.price - price) / spec.tickSize);
        const pnl = calculatePnL(this.state.symbol, price, nextSl.price, this.state.side, this.state.qty);
        nextSl.usd = Math.abs(pnl.cashAmount);
      }
    }

    this.state = {
      ...this.state,
      price,
      takeProfit: nextTp,
      stopLoss: nextSl,
      lastUpdateSource: source,
    };
    this.notify();
  }

  public setStopPrice(rawPrice: number, source: "chart" | "ticket" = "ticket") {
    const stopPrice = roundToTick(this.state.symbol, rawPrice);
    const price = this.state.type === "stop" ? stopPrice : this.state.price;
    this.state = {
      ...this.state,
      stopPrice,
      price,
      lastUpdateSource: source,
    };
    if (this.state.type === "stop") {
      this.recalculateBracketsFromTicks();
    }
    this.notify();
  }

  public setQty(qty: number) {
    const validQty = Math.max(1, Math.round(qty));
    this.state = {
      ...this.state,
      qty: validQty,
    };
    this.recalculateRiskFromQty();
    this.notify();
  }

  public setSide(side: OrderSide) {
    if (this.state.side === side) return;
    this.state = {
      ...this.state,
      side,
    };
    this.recalculateBracketsFromTicks();
    this.notify();
  }

  public setType(type: OrderType) {
    this.state = {
      ...this.state,
      type,
    };
    this.notify();
  }

  public setRiskUsd(targetUsd: number) {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    if (!this.state.stopLoss.enabled || this.state.stopLoss.ticks <= 0) {
      this.state = {
        ...this.state,
        stopLoss: {
          ...this.state.stopLoss,
          enabled: true,
          ticks: this.state.stopLoss.ticks > 0 ? this.state.stopLoss.ticks : 20,
        },
      };
      this.recalculateBracketsFromTicks();
    }
    if (spec.tickValue <= 0 || this.state.stopLoss.ticks <= 0) {
      return;
    }
    const lossPerContract = this.state.stopLoss.ticks * spec.tickValue;
    if (lossPerContract <= 0) return;

    const contracts = Math.max(1, Math.floor(targetUsd / lossPerContract));
    this.state = {
      ...this.state,
      qty: contracts,
      riskUsdValue: targetUsd,
      qtyMode: "risk_usd",
    };
    this.recalculateRiskFromQty();
    this.notify();
  }

  public setTakeProfitEnabled(enabled: boolean) {
    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        enabled,
      },
    };
    if (enabled && (this.state.takeProfit.price === 0 || isNaN(this.state.takeProfit.price))) {
      this.recalculateBracketsFromTicks();
    }
    this.notify();
  }

  public setTakeProfitPrice(rawPrice: number, source: "chart" | "ticket" = "ticket") {
    const price = roundToTick(this.state.symbol, rawPrice);
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const ticks = this.state.price > 0 && spec.tickSize > 0
      ? Math.round(Math.abs(price - this.state.price) / spec.tickSize)
      : this.state.takeProfit.ticks;
    const percent = this.state.price > 0 ? Number((((ticks * spec.tickSize) / this.state.price) * 100).toFixed(2)) : 0;

    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        price,
        ticks,
        usd: ticks * spec.tickValue * this.state.qty,
        percent,
      },
      lastUpdateSource: source,
    };
    this.notify();
  }

  public setTakeProfitTicks(ticks: number) {
    const validTicks = Math.max(1, Math.round(ticks));
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const delta = validTicks * spec.tickSize;
    const isLong = this.state.side === "buy";
    const price = this.state.price > 0
      ? roundToTick(this.state.symbol, isLong ? this.state.price + delta : this.state.price - delta)
      : 0;
    const percent = this.state.price > 0 ? Number((((validTicks * spec.tickSize) / this.state.price) * 100).toFixed(2)) : 0;

    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        ticks: validTicks,
        price,
        usd: validTicks * spec.tickValue * this.state.qty,
        percent,
      },
    };
    this.notify();
  }

  public setStopLossEnabled(enabled: boolean) {
    this.state = {
      ...this.state,
      stopLoss: {
        ...this.state.stopLoss,
        enabled,
      },
    };
    if (enabled && (this.state.stopLoss.price === 0 || isNaN(this.state.stopLoss.price))) {
      this.recalculateBracketsFromTicks();
    }
    this.notify();
  }

  public setStopLossPrice(rawPrice: number, source: "chart" | "ticket" = "ticket") {
    const price = roundToTick(this.state.symbol, rawPrice);
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const ticks = this.state.price > 0 && spec.tickSize > 0
      ? Math.round(Math.abs(price - this.state.price) / spec.tickSize)
      : this.state.stopLoss.ticks;

    const pnl = calculatePnL(this.state.symbol, this.state.price, price, this.state.side, this.state.qty);
    const percent = this.state.price > 0 ? Number((((ticks * spec.tickSize) / this.state.price) * 100).toFixed(2)) : 0;

    this.state = {
      ...this.state,
      stopLoss: {
        ...this.state.stopLoss,
        price,
        ticks,
        usd: Math.abs(pnl.cashAmount),
        percent,
      },
      lastUpdateSource: source,
    };
    this.notify();
  }

  public setStopLossTicks(ticks: number) {
    const validTicks = Math.max(1, Math.round(ticks));
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const delta = validTicks * spec.tickSize;
    const isLong = this.state.side === "buy";
    const price = this.state.price > 0
      ? roundToTick(this.state.symbol, isLong ? this.state.price - delta : this.state.price + delta)
      : 0;

    const pnl = calculatePnL(this.state.symbol, this.state.price, price, this.state.side, this.state.qty);
    const percent = this.state.price > 0 ? Number((((validTicks * spec.tickSize) / this.state.price) * 100).toFixed(2)) : 0;

    this.state = {
      ...this.state,
      stopLoss: {
        ...this.state.stopLoss,
        ticks: validTicks,
        price,
        usd: Math.abs(pnl.cashAmount),
        percent,
      },
    };
    this.notify();
  }

  public setTakeProfitMode(mode: "price" | "ticks" | "usd" | "percent") {
    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        mode,
      },
    };
    this.notify();
  }

  public setStopLossMode(mode: "price" | "ticks" | "usd" | "percent") {
    this.state = {
      ...this.state,
      stopLoss: {
        ...this.state.stopLoss,
        mode,
      },
    };
    this.notify();
  }

  public setTakeProfitUsd(targetUsd: number) {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const tickVal = spec.tickValue * Math.max(1, this.state.qty);
    if (tickVal <= 0) return;
    const ticks = Math.max(1, Math.round(targetUsd / tickVal));
    this.setTakeProfitTicks(ticks);
  }

  public setStopLossUsd(targetUsd: number) {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const tickVal = spec.tickValue * Math.max(1, this.state.qty);
    if (tickVal <= 0) return;
    const ticks = Math.max(1, Math.round(targetUsd / tickVal));
    this.setStopLossTicks(ticks);
  }

  public setRiskPercent(pct: number, accountEquity: number = 100000) {
    const targetUsd = accountEquity * (pct / 100);
    this.setRiskUsd(targetUsd);
    this.state = {
      ...this.state,
      riskPercentValue: pct,
      qtyMode: "risk_percent",
    };
    this.notify();
  }

  public setTakeProfitPercent(pct: number) {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    if (this.state.price <= 0 || spec.tickSize <= 0) return;
    const delta = this.state.price * (pct / 100);
    const ticks = Math.max(1, Math.round(delta / spec.tickSize));
    this.setTakeProfitTicks(ticks);
    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        percent: pct,
      },
    };
    this.notify();
  }

  public setStopLossPercent(pct: number) {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    if (this.state.price <= 0 || spec.tickSize <= 0) return;
    const delta = this.state.price * (pct / 100);
    const ticks = Math.max(1, Math.round(delta / spec.tickSize));
    this.setStopLossTicks(ticks);
    this.state = {
      ...this.state,
      stopLoss: {
        ...this.state.stopLoss,
        percent: pct,
      },
    };
    this.notify();
  }

  public setActiveDragTarget(target: "entry" | "tp" | "sl" | null) {
    this.state = {
      ...this.state,
      activeDragTarget: target,
    };
    this.notify();
  }

  private recalculateBracketsFromTicks() {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    const isLong = this.state.side === "buy";
    const basePrice = this.state.price;

    if (basePrice <= 0) return;

    const tpDelta = this.state.takeProfit.ticks * spec.tickSize;
    const tpPrice = roundToTick(
      this.state.symbol,
      isLong ? basePrice + tpDelta : basePrice - tpDelta
    );

    const slDelta = this.state.stopLoss.ticks * spec.tickSize;
    const slPrice = roundToTick(
      this.state.symbol,
      isLong ? basePrice - slDelta : basePrice + slDelta
    );

    const slPnl = calculatePnL(this.state.symbol, basePrice, slPrice, this.state.side, this.state.qty);
    const tpPercent = basePrice > 0 ? Number((((this.state.takeProfit.ticks * spec.tickSize) / basePrice) * 100).toFixed(2)) : 0;
    const slPercent = basePrice > 0 ? Number((((this.state.stopLoss.ticks * spec.tickSize) / basePrice) * 100).toFixed(2)) : 0;

    this.state = {
      ...this.state,
      takeProfit: {
        ...this.state.takeProfit,
        price: tpPrice,
        usd: this.state.takeProfit.ticks * spec.tickValue * this.state.qty,
        percent: tpPercent,
      },
      stopLoss: {
        ...this.state.stopLoss,
        price: slPrice,
        usd: Math.abs(slPnl.cashAmount),
        percent: slPercent,
      },
    };
  }

  private recalculateRiskFromQty() {
    const spec = getPaperInstrumentSpec(this.state.symbol);
    if (this.state.stopLoss.price > 0 && this.state.price > 0) {
      const pnl = calculatePnL(
        this.state.symbol,
        this.state.price,
        this.state.stopLoss.price,
        this.state.side,
        this.state.qty
      );
      this.state.stopLoss.usd = Math.abs(pnl.cashAmount);
    }
    if (this.state.takeProfit.ticks > 0) {
      this.state.takeProfit.usd = this.state.takeProfit.ticks * spec.tickValue * this.state.qty;
    }
  }
}

export const preOrderStore = new PreOrderStoreImpl();
