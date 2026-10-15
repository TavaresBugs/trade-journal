/**
 * Paper Trading Type Definitions
 * 1:1 Parity with TradingView Paper Trading System
 */

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus = "working" | "filled" | "cancelled" | "rejected";
export type BracketType = "take_profit" | "stop_loss";

export interface OrderBracket {
  takeProfit?: {
    price: number;
    ticks?: number;
    currencyRisk?: number;
  };
  stopLoss?: {
    price: number;
    ticks?: number;
    currencyRisk?: number;
  };
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price: number; // Limit or execution price
  stopPrice?: number; // Trigger price for stop orders
  status: OrderStatus;
  filledPrice?: number;
  filledQty?: number;
  createdAt: number;
  filledAt?: number;
  cancelledAt?: number;
  
  // Bracket (OCO) links
  takeProfit?: number;
  stopLoss?: number;
  parentOrderId?: string;
  bracketChildIds?: string[];
  isBracketChild?: boolean;
  bracketType?: BracketType;
  isStopTriggered?: boolean;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLTicks: number;
  unrealizedPnLPoints: number;
  unrealizedPnLPercent: number;
  openedAt: number;
  updatedAt: number;
  
  // Associated active bracket orders
  takeProfitOrderId?: string;
  stopLossOrderId?: string;
}

export interface PaperExecution {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  timestamp: number;
  realizedPnL?: number;
  commission: number;
}

export interface PaperAccount {
  id: string;
  name: string;
  balance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  currency: string;
  margin: number;
  availableFunds: number;
  createdAt: number;
}

export interface PaperActivityLog {
  id: string;
  timestamp: number;
  type:
    | "order_placed"
    | "order_filled"
    | "order_cancelled"
    | "order_modified"
    | "position_closed"
    | "position_reversed"
    | "account_reset";
  symbol?: string;
  message: string;
}

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  price?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  isBracketChild?: boolean;
  bracketType?: BracketType;
  parentOrderId?: string;
  timestamp?: number;
}

export interface ModifyOrderParams {
  price?: number;
  stopPrice?: number;
  qty?: number;
  takeProfit?: number | null;
  stopLoss?: number | null;
}

export interface ClosedTrade {
  id: string;
  tradeNumber: number;
  symbol: string;
  side: "long" | "short";
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  profit: number;
  profitPercent: number;
  cumProfit: number;
  signal?: string;
}

export interface PaperTradingState {
  account: PaperAccount;
  orders: PaperOrder[];
  positions: Record<string, PaperPosition>; // keyed by symbol
  executions: PaperExecution[];
  logs: PaperActivityLog[];
  closedTrades?: ClosedTrade[];
}

