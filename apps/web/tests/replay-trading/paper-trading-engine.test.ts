import { describe, it, expect, beforeEach } from "vitest";
import { PaperTradingEngine } from "@/lib/paper-trading/paper-engine";
import { calculatePnL, getPaperInstrumentSpec } from "@/lib/paper-trading/symbol-specs";

describe("Paper Trading Financial Math", () => {
  it("resolves correct specs for CME Futures (MNQ, NQ, ES, MES)", () => {
    const mnq = getPaperInstrumentSpec("MNQ");
    expect(mnq.pointValue).toBe(2);
    expect(mnq.tickSize).toBe(0.25);
    expect(mnq.tickValue).toBe(0.5);

    const es = getPaperInstrumentSpec("ES");
    expect(es.pointValue).toBe(50);
    expect(es.tickSize).toBe(0.25);
    expect(es.tickValue).toBe(12.5);
  });

  it("calculates exact PnL for Long and Short positions", () => {
    // MNQ: Buy at 20000, Exit at 20050 (+50 points = +200 ticks)
    // 50 points * $2 pointValue * 2 contracts = $200
    const longPnl = calculatePnL("MNQ", 20000, 20050, "buy", 2);
    expect(longPnl.points).toBe(50);
    expect(longPnl.ticks).toBe(200);
    expect(longPnl.cashAmount).toBe(200);

    // Short MNQ: Sell at 20050, Exit at 20000 (+50 points = $100 for 1 contract)
    const shortPnl = calculatePnL("MNQ", 20050, 20000, "sell", 1);
    expect(shortPnl.points).toBe(50);
    expect(shortPnl.cashAmount).toBe(100);

    // Loss calculation
    const lossPnl = calculatePnL("MNQ", 20000, 19990, "buy", 1);
    expect(lossPnl.points).toBe(-10);
    expect(lossPnl.cashAmount).toBe(-20);
  });
});

describe("PaperTradingEngine Core", () => {
  let engine: PaperTradingEngine;

  beforeEach(() => {
    // Instantiate fresh engine without localStorage side-effects
    engine = new PaperTradingEngine({ persistKey: null, initialBalance: 100000 });
  });

  it("initializes with default $100,000 balance and empty state", () => {
    const account = engine.getAccount();
    expect(account.balance).toBe(100000);
    expect(account.equity).toBe(100000);
    expect(account.realizedPnL).toBe(0);
    expect(account.unrealizedPnL).toBe(0);
    expect(engine.getOrders()).toHaveLength(0);
    expect(engine.getPositions()).toEqual({});
  });

  it("executes Market Buy order immediately", () => {
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    expect(order.status).toBe("filled");
    expect(order.filledPrice).toBe(20000);
    expect(order.filledQty).toBe(2);

    const position = engine.getPosition("MNQ");
    expect(position).toBeDefined();
    expect(position?.side).toBe("long");
    expect(position?.qty).toBe(2);
    expect(position?.avgPrice).toBe(20000);

    const executions = engine.getExecutions();
    expect(executions).toHaveLength(1);
    expect(executions[0]!.price).toBe(20000);
    expect(executions[0]!.qty).toBe(2);
  });

  it("updates unrealized PnL and Equity on ticks", () => {
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    // Price moves to 20010 (+10 points * $2 * 2 contracts = +$40)
    engine.onTick("MNQ", 20010);

    const pos = engine.getPosition("MNQ");
    expect(pos?.currentPrice).toBe(20010);
    expect(pos?.unrealizedPnL).toBe(40);
    expect(pos?.unrealizedPnLPoints).toBe(10);
    expect(pos?.unrealizedPnLTicks).toBe(40);

    const acct = engine.getAccount();
    expect(acct.unrealizedPnL).toBe(40);
    expect(acct.equity).toBe(100040);
    expect(acct.balance).toBe(100000);
  });

  it("places Limit order as working and fills on matching tick", () => {
    // Current price 20000, Place Buy Limit at 19950
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "limit",
      qty: 1,
      price: 19950,
    });

    expect(order.status).toBe("working");
    expect(engine.getPosition("MNQ")).toBeUndefined();

    // Tick at 19960 - should NOT fill
    engine.onTick("MNQ", 19960, 19970, 19960);
    expect(engine.getOrder(order.id)?.status).toBe("working");

    // Tick reaching 19950 (or low reaching 19945) - should fill!
    engine.onTick("MNQ", 19950, 19960, 19945);
    const updated = engine.getOrder(order.id);
    expect(updated?.status).toBe("filled");
    expect(updated?.filledPrice).toBe(19950);

    const pos = engine.getPosition("MNQ");
    expect(pos?.qty).toBe(1);
    expect(pos?.avgPrice).toBe(19950);
  });

  it("places Stop order as working and fills when price breaks through stop", () => {
    // Current price 20000, Place Buy Stop at 20050
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "stop",
      qty: 1,
      price: 20050,
      stopPrice: 20050,
    });

    expect(order.status).toBe("working");

    // Price reaches 20055 - breaks above stop
    engine.onTick("MNQ", 20055, 20060, 20040);
    expect(engine.getOrder(order.id)?.status).toBe("filled");
    expect(engine.getPosition("MNQ")?.qty).toBe(1);
  });

  it("handles Brackets (OCO Take Profit & Stop Loss) on filled orders", () => {
    // Place Market Buy with TP at 20050 and SL at 19950
    const parentOrder = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 1,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    expect(parentOrder.status).toBe("filled");

    // Both TP and SL bracket orders must be created as working orders
    const workingOrders = engine.getWorkingOrders("MNQ");
    expect(workingOrders).toHaveLength(2);

    const tpOrder = workingOrders.find((o) => o.bracketType === "take_profit");
    const slOrder = workingOrders.find((o) => o.bracketType === "stop_loss");

    expect(tpOrder).toBeDefined();
    expect(tpOrder?.side).toBe("sell");
    expect(tpOrder?.type).toBe("limit");
    expect(tpOrder?.price).toBe(20050);

    expect(slOrder).toBeDefined();
    expect(slOrder?.side).toBe("sell");
    expect(slOrder?.type).toBe("stop");
    expect(slOrder?.price).toBe(19950);

    // Now price hits Take Profit (20050)
    engine.onTick("MNQ", 20055, 20060, 20020);

    // TP must be filled
    expect(engine.getOrder(tpOrder!.id)?.status).toBe("filled");

    // SL must be CANCELLED via OCO!
    expect(engine.getOrder(slOrder!.id)?.status).toBe("cancelled");

    // Position must now be closed (qty = 0)
    expect(engine.getPosition("MNQ")).toBeUndefined();

    // Account Realized PnL should be +$100 (+50 pts * $2)
    const acct = engine.getAccount();
    expect(acct.realizedPnL).toBe(100);
    expect(acct.balance).toBe(100100);
  });

  it("cancels working orders cleanly", () => {
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "limit",
      qty: 1,
      price: 19000,
    });

    expect(order.status).toBe("working");
    const cancelled = engine.cancelOrder(order.id);
    expect(cancelled.status).toBe("cancelled");
    expect(engine.getWorkingOrders("MNQ")).toHaveLength(0);
  });

  it("modifies price and qty of working order", () => {
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "limit",
      qty: 1,
      price: 19000,
    });

    const modified = engine.modifyOrder(order.id, { price: 19500, qty: 3 });
    expect(modified.price).toBe(19500);
    expect(modified.qty).toBe(3);
  });

  it("closes open position at market price", () => {
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    engine.onTick("MNQ", 20020);
    const closeOrder = engine.closePosition("MNQ");

    expect(closeOrder.status).toBe("filled");
    expect(closeOrder.side).toBe("sell");
    expect(closeOrder.qty).toBe(2);
    expect(engine.getPosition("MNQ")).toBeUndefined();

    // +20 points * $2 * 2 contracts = +$80
    expect(engine.getAccount().realizedPnL).toBe(80);
    expect(engine.getAccount().balance).toBe(100080);
  });

  it("reverses open position in one atomic action", () => {
    // Open Long 2 contracts at 20000
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    engine.onTick("MNQ", 20010);
    // Reverse at 20010: closes Long 2 contracts (+40 PnL) and opens Short 2 contracts
    engine.reversePosition("MNQ");

    const newPos = engine.getPosition("MNQ");
    expect(newPos?.side).toBe("short");
    expect(newPos?.qty).toBe(2);
    expect(newPos?.avgPrice).toBe(20010);

    expect(engine.getAccount().realizedPnL).toBe(40);
  });

  it("flattens all positions and cancels all working orders", () => {
    // Open position on MNQ
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 1,
      price: 20000,
    });

    // Working order on ES
    engine.placeOrder({
      symbol: "ES",
      side: "buy",
      type: "limit",
      qty: 1,
      price: 5000,
    });

    expect(engine.getPosition("MNQ")).toBeDefined();
    expect(engine.getWorkingOrders()).toHaveLength(1);

    engine.flattenAll();

    expect(engine.getPositions()).toEqual({});
    expect(engine.getWorkingOrders()).toHaveLength(0);
  });

  it("notifies subscribers when state changes", () => {
    let callCount = 0;
    const unsub = engine.subscribe(() => {
      callCount++;
    });

    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 1,
      price: 20000,
    });

    expect(callCount).toBeGreaterThan(0);
    unsub();
  });

  it("handles Stop-Limit orders: activates on stop hit and executes on limit match", () => {
    // Buy Stop-Limit: stop trigger 20050, limit price 20045
    const order = engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "stop_limit",
      qty: 1,
      stopPrice: 20050,
      price: 20045,
    });

    expect(order.status).toBe("working");
    expect(order.isStopTriggered).toBeFalsy();

    // Tick below stop: should NOT trigger
    engine.onTick("MNQ", 20040, 20042, 20038);
    expect(order.status).toBe("working");
    expect(order.isStopTriggered).toBeFalsy();

    // Tick touching stop price but above limit: triggers stop, but does NOT fill yet
    engine.onTick("MNQ", 20050, 20052, 20048);
    expect(order.status).toBe("working");
    expect(order.isStopTriggered).toBe(true);

    // Tick pulling back to limit price: fills at limit price 20045
    engine.onTick("MNQ", 20044, 20046, 20043);
    expect(order.status).toBe("filled");
    expect(order.filledPrice).toBe(20045);
    expect(engine.getPosition("MNQ")?.qty).toBe(1);
    expect(engine.getPosition("MNQ")?.avgPrice).toBe(20045);
  });

  it("automatically cancels orphan bracket orders when position is closed via regular order", () => {
    // Open Long 1 MNQ with TP and SL
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 1,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    const working = engine.getWorkingOrders();
    expect(working).toHaveLength(2); // TP and SL
    expect(working.some((o) => o.bracketType === "take_profit")).toBe(true);
    expect(working.some((o) => o.bracketType === "stop_loss")).toBe(true);

    // Close position directly with a normal Market Sell order
    engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "market",
      qty: 1,
      price: 20020,
    });

    expect(engine.getPosition("MNQ")).toBeUndefined();
    // Brackets must have been automatically cancelled
    expect(engine.getWorkingOrders()).toHaveLength(0);
    const allOrders = engine.getOrders();
    const cancelledBrackets = allOrders.filter(
      (o) => o.isBracketChild && o.status === "cancelled"
    );
    expect(cancelledBrackets).toHaveLength(2);
  });

  it("supports partial position closure and scales attached bracket quantities", () => {
    // Open Long 2 MNQ with TP and SL
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    expect(engine.getPosition("MNQ")?.qty).toBe(2);
    const bracketsBefore = engine.getWorkingOrders("MNQ");
    expect(bracketsBefore).toHaveLength(2);
    expect(bracketsBefore[0]?.qty).toBe(2);

    // Partially close 1 unit out of 2
    engine.onTick("MNQ", 20020);
    const closeOrder = engine.closePosition("MNQ", 1);

    expect(closeOrder.status).toBe("filled");
    expect(closeOrder.qty).toBe(1);

    // Remaining position should be 1 unit
    const pos = engine.getPosition("MNQ");
    expect(pos).toBeDefined();
    expect(pos?.qty).toBe(1);

    // Working brackets should have had their qty reduced to 1 unit
    const bracketsAfter = engine.getWorkingOrders("MNQ");
    expect(bracketsAfter).toHaveLength(2);
    expect(bracketsAfter[0]?.qty).toBe(1);
    expect(bracketsAfter[1]?.qty).toBe(1);

    // Realized PnL: +20 points * $2 * 1 unit = +$40
    expect(engine.getAccount().realizedPnL).toBe(40);
  });

  it("handles sequential partial closures and continually rescales brackets until full close", () => {
    // Open Long 5 MNQ with TP at 20050 and SL at 19950
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 5,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    expect(engine.getPosition("MNQ")?.qty).toBe(5);
    let brackets = engine.getWorkingOrders("MNQ");
    expect(brackets).toHaveLength(2);
    expect(brackets[0]?.qty).toBe(5);
    expect(brackets[1]?.qty).toBe(5);

    // Step 1: Partially close 2 contracts at 20020 (+20 pts * $2 * 2 = +$80)
    engine.onTick("MNQ", 20020);
    const close1 = engine.closePosition("MNQ", 2);
    expect(close1.qty).toBe(2);
    expect(engine.getPosition("MNQ")?.qty).toBe(3);
    brackets = engine.getWorkingOrders("MNQ");
    expect(brackets).toHaveLength(2);
    expect(brackets[0]?.qty).toBe(3);
    expect(brackets[1]?.qty).toBe(3);
    expect(engine.getAccount().realizedPnL).toBe(80);

    // Step 2: Partially close another 2 contracts at 20030 (+30 pts * $2 * 2 = +$120)
    engine.onTick("MNQ", 20030);
    const close2 = engine.closePosition("MNQ", 2);
    expect(close2.qty).toBe(2);
    expect(engine.getPosition("MNQ")?.qty).toBe(1);
    brackets = engine.getWorkingOrders("MNQ");
    expect(brackets).toHaveLength(2);
    expect(brackets[0]?.qty).toBe(1);
    expect(brackets[1]?.qty).toBe(1);
    expect(engine.getAccount().realizedPnL).toBe(200); // 80 + 120

    // Step 3: Close final remaining 1 contract
    engine.onTick("MNQ", 20040);
    const close3 = engine.closePosition("MNQ", 1);
    expect(close3.qty).toBe(1);
    expect(engine.getPosition("MNQ")).toBeUndefined();
    // Brackets must be completely cancelled
    expect(engine.getWorkingOrders("MNQ")).toHaveLength(0);
    expect(engine.getAccount().realizedPnL).toBe(280); // 200 + (40 pts * $2 * 1 = 80)
  });

  it("rescales active brackets when position is partially reduced by matching opposite order", () => {
    // Open Long 3 MNQ with TP and SL
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 3,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    expect(engine.getPosition("MNQ")?.qty).toBe(3);

    // Place a Sell Limit for 1 contract at 20010
    const sellLimit = engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "limit",
      qty: 1,
      price: 20010,
    });

    // Tick reaches 20010 -> fills the sell limit
    engine.onTick("MNQ", 20010, 20015, 20005);
    expect(engine.getOrder(sellLimit.id)?.status).toBe("filled");

    // Position must be reduced to 2 contracts
    expect(engine.getPosition("MNQ")?.qty).toBe(2);

    // Working brackets should now have qty rescaled to 2
    const brackets = engine.getWorkingOrders("MNQ").filter((o) => o.isBracketChild);
    expect(brackets).toHaveLength(2);
    expect(brackets[0]?.qty).toBe(2);
    expect(brackets[1]?.qty).toBe(2);
  });

  it("cancels all brackets when closePosition is called with qty >= current position", () => {
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
    });

    expect(engine.getWorkingOrders("MNQ")).toHaveLength(2);

    // Calling closePosition with qty = 5 (greater than current qty of 2)
    engine.onTick("MNQ", 20010);
    const closeOrder = engine.closePosition("MNQ", 5);

    expect(closeOrder.qty).toBe(2);
    expect(engine.getPosition("MNQ")).toBeUndefined();
    expect(engine.getWorkingOrders("MNQ")).toHaveLength(0);
  });

  it("synchronizes market order execution with historical replay tick price and timestamp", () => {
    const replayCutTimestamp = 1712000000;
    const replayCutPrice = 5250.25;

    // Simulate Replay tick at historical cut point
    engine.onTick("ES", replayCutPrice, replayCutPrice + 2, replayCutPrice - 2, replayCutTimestamp);

    expect(engine.getLastPrice("ES")).toBe(replayCutPrice);
    expect(engine.getLastTimestamp("ES")).toBe(replayCutTimestamp);

    // Place market order without explicit timestamp/price (simulates quick buy/sell in replay mode)
    const order = engine.placeOrder({
      symbol: "ES",
      side: "buy",
      type: "market",
      qty: 1,
    });

    expect(order.status).toBe("filled");
    expect(order.price).toBe(replayCutPrice);
    expect(order.filledPrice).toBe(replayCutPrice);
    expect(order.createdAt).toBe(replayCutTimestamp);
    expect(order.filledAt).toBe(replayCutTimestamp);

    const pos = engine.getPosition("ES");
    expect(pos?.avgPrice).toBe(replayCutPrice);
    expect(pos?.openedAt).toBe(replayCutTimestamp);
  });

  it("records ClosedTrade instances for Replay Trading Strategy report and List of Trades", () => {
    // 1. Buy 2 contracts of MNQ at 20000
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    expect(engine.getClosedTrades()).toHaveLength(0);

    // 2. Close 1 contract at 20050 (+50 pts * $2 * 1 = +$100)
    engine.onTick("MNQ", 20050);
    engine.closePosition("MNQ", 1);

    let trades = engine.getClosedTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0]!.tradeNumber).toBe(1);
    expect(trades[0]!.symbol).toBe("MNQ");
    expect(trades[0]!.side).toBe("long");
    expect(trades[0]!.entryPrice).toBe(20000);
    expect(trades[0]!.exitPrice).toBe(20050);
    expect(trades[0]!.qty).toBe(1);
    expect(trades[0]!.profit).toBe(100);
    expect(trades[0]!.cumProfit).toBe(100);

    // 3. Close remaining 1 contract at 20025 (+25 pts * $2 * 1 = +$50)
    engine.onTick("MNQ", 20025);
    engine.closePosition("MNQ", 1);

    trades = engine.getClosedTrades();
    expect(trades).toHaveLength(2);
    expect(trades[1]!.tradeNumber).toBe(2);
    expect(trades[1]!.profit).toBe(50);
    expect(trades[1]!.cumProfit).toBe(150);

    // 4. Open short and close with a loss: Sell 1 MNQ at 20000, exit at 20020 (-20 pts * $2 = -$40)
    engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "market",
      qty: 1,
      price: 20000,
    });
    engine.onTick("MNQ", 20020);
    engine.closePosition("MNQ", 1);

    trades = engine.getClosedTrades();
    expect(trades).toHaveLength(3);
    expect(trades[2]!.tradeNumber).toBe(3);
    expect(trades[2]!.side).toBe("short");
    expect(trades[2]!.profit).toBe(-40);
    expect(trades[2]!.cumProfit).toBe(110);
  });

  it("allows independent placement, modification and coexistence of TP and SL brackets on open position", () => {
    // 1. Open a Long Position
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 2,
      price: 20000,
    });

    const pos = engine.getPosition("MNQ");
    expect(pos).toBeDefined();
    expect(pos?.qty).toBe(2);

    // 2. Drag/Place Stop Loss Bracket at 19950
    const slOrder = engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "stop",
      qty: 2,
      price: 19950,
      stopPrice: 19950,
      isBracketChild: true,
      bracketType: "stop_loss",
    });
    expect(slOrder.status).toBe("working");

    let working = engine.getWorkingOrders("MNQ");
    expect(working).toHaveLength(1);
    expect(working[0]!.bracketType).toBe("stop_loss");
    expect(working[0]!.price).toBe(19950);

    // 3. Drag/Place Take Profit Bracket at 20050 (must NOT wipe out or affect SL!)
    const tpOrder = engine.placeOrder({
      symbol: "MNQ",
      side: "sell",
      type: "limit",
      qty: 2,
      price: 20050,
      isBracketChild: true,
      bracketType: "take_profit",
    });
    expect(tpOrder.status).toBe("working");

    // Both brackets must coexist
    working = engine.getWorkingOrders("MNQ");
    expect(working).toHaveLength(2);
    const activeSl = working.find((o) => o.bracketType === "stop_loss");
    const activeTp = working.find((o) => o.bracketType === "take_profit");
    expect(activeSl?.price).toBe(19950);
    expect(activeTp?.price).toBe(20050);

    // 4. Modify SL to 19970 (trailing stop) - TP must stay intact at 20050!
    engine.modifyOrder(slOrder.id, { price: 19970, stopPrice: 19970 });
    working = engine.getWorkingOrders("MNQ");
    expect(working.find((o) => o.bracketType === "stop_loss")?.price).toBe(19970);
    expect(working.find((o) => o.bracketType === "take_profit")?.price).toBe(20050);

    // 5. Modify TP to 20080 - SL must stay intact at 19970!
    engine.modifyOrder(tpOrder.id, { price: 20080 });
    working = engine.getWorkingOrders("MNQ");
    expect(working.find((o) => o.bracketType === "stop_loss")?.price).toBe(19970);
    expect(working.find((o) => o.bracketType === "take_profit")?.price).toBe(20080);
  });

  it("updates position brackets via updatePositionBrackets method", () => {
    // 1. Establish position on MES with 2 contracts at 5000
    engine.placeOrder({
      symbol: "MES",
      side: "buy",
      type: "market",
      qty: 2,
      price: 5000,
    });
    expect(engine.getPosition("MES")?.qty).toBe(2);

    // 2. Set new TP at 5020 and SL at 4985
    engine.updatePositionBrackets("MES", 5020, 4985);
    let working = engine.getWorkingOrders("MES");
    expect(working).toHaveLength(2);

    const tp = working.find((o) => o.bracketType === "take_profit");
    const sl = working.find((o) => o.bracketType === "stop_loss");
    expect(tp?.price).toBe(5020);
    expect(tp?.qty).toBe(2);
    expect(sl?.price).toBe(4985);
    expect(sl?.qty).toBe(2);

    // 3. Update TP to 5030, remove SL
    engine.updatePositionBrackets("MES", 5030, undefined);
    working = engine.getWorkingOrders("MES");
    expect(working).toHaveLength(1);
    expect(working[0]?.price).toBe(5030);
  });

  it("automatically closes position and cancels brackets when replay rewinds before position openedAt", () => {
    const entryTime = 1712345000; // bar timestamp in seconds
    // 1. Establish position on MNQ at entryTime
    engine.onTick("MNQ", 20000, 20010, 19990, entryTime);
    engine.placeOrder({
      symbol: "MNQ",
      side: "buy",
      type: "market",
      qty: 1,
      price: 20000,
      takeProfit: 20050,
      stopLoss: 19950,
      timestamp: entryTime,
    });

    expect(engine.getPosition("MNQ")).toBeDefined();
    expect(engine.getPosition("MNQ")?.openedAt).toBe(entryTime);
    expect(engine.getWorkingOrders("MNQ")).toHaveLength(2); // TP + SL

    // 2. Advance time forward - position stays open
    engine.onTick("MNQ", 20010, 20020, 20000, entryTime + 60);
    expect(engine.getPosition("MNQ")).toBeDefined();

    // 3. Rewind time before entryTime (e.g. entryTime - 300)
    engine.onTick("MNQ", 19980, 19990, 19970, entryTime - 300);

    // Position must be closed and active brackets cancelled!
    expect(engine.getPosition("MNQ")).toBeUndefined();
    expect(engine.getWorkingOrders("MNQ")).toHaveLength(0);
  });
});



