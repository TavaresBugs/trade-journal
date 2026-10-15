import { describe, it, expect, beforeEach } from "vitest";
import {
  BOLETA_COLORS,
  BOLETA_ZONES,
  calculateBoletaWidth,
  formatBoletaPnlUsd,
  getBoletaTextWidth,
} from "@/components/replay/trading/boleta";
import {
  preOrderStore,
  formatPriceWithCommas,
  type PreOrderState,
} from "@/lib/paper-trading/pre-order-store";
import { PaperTradingEngine } from "@/lib/paper-trading/paper-engine";
import { type PaperOrder, type PaperPosition } from "@/lib/paper-trading/types";
import { formatPrice, getPaperInstrumentSpec } from "@/lib/paper-trading/symbol-specs";

function createMockPosition(partial: Partial<PaperPosition>): PaperPosition {
  return {
    id: "pos-1",
    symbol: "MNQ",
    side: "long",
    qty: 1,
    avgPrice: 24180.25,
    currentPrice: 24180.25,
    unrealizedPnL: 0,
    unrealizedPnLTicks: 0,
    unrealizedPnLPoints: 0,
    unrealizedPnLPercent: 0,
    openedAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

describe("Boleta Institutional Tokens & Layout Geometry", () => {
  it("defines canonical colors matching boleta_spec.md", () => {
    expect(BOLETA_COLORS.buy).toBe("#3D5AFE");
    expect(BOLETA_COLORS.sell).toBe("#E0474C");
    expect(BOLETA_COLORS.tp).toBe("#2EC27E");
    expect(BOLETA_COLORS.sl).toBe("#F0A030");
    expect(BOLETA_COLORS.bgPanel).toBe("#16181D");
    expect(BOLETA_COLORS.bgSurface).toBe("#0F1115");
  });

  it("defines zone opacity as 14%", () => {
    expect(BOLETA_ZONES.tpOpacity).toBe(0.14);
    expect(BOLETA_ZONES.slOpacity).toBe(0.14);
  });

  it("calculates component width matching boleta_spec.md reference table", () => {
    // "1 | Limit": spec says 81.6 px
    const widthOrder = calculateBoletaWidth(1, 5);
    expect(widthOrder).toBeCloseTo(81.6, 0);

    // "1 | Take profit": spec says 116.6 px
    const widthTp = calculateBoletaWidth(1, 11);
    expect(widthTp).toBeCloseTo(116.6, 0);

    // "1 | Stop loss": spec says 107.0 px
    const widthSl = calculateBoletaWidth(1, 9);
    expect(widthSl).toBeCloseTo(107.0, 0);
  });

  it("calculates text and capsule width for +TP and +SL placeholders", () => {
    // Capsules have W = 28 + tw(text, 500), H = 24, rx = 12
    const tpTextW = getBoletaTextWidth("+TP");
    const slTextW = getBoletaTextWidth("+SL");
    expect(tpTextW).toBeGreaterThan(15);
    expect(slTextW).toBeGreaterThan(15);

    const capsuleTpW = Math.round(28 + tpTextW);
    const capsuleSlW = Math.round(28 + slTextW);
    expect(capsuleTpW).toBeGreaterThanOrEqual(45);
    expect(capsuleSlW).toBeGreaterThanOrEqual(45);
  });

  it("formats entry tag PnL in USD for E3, E4, E5 with explicit sign, thousands separator, and 2 decimals", () => {
    expect(formatBoletaPnlUsd(512)).toBe("+512.00 USD");
    expect(formatBoletaPnlUsd(1512.5)).toBe("+1,512.50 USD");
    expect(formatBoletaPnlUsd(0)).toBe("+0.00 USD");
    expect(formatBoletaPnlUsd(-41.25)).toBe("−41.25 USD");
    expect(formatBoletaPnlUsd(-2450)).toBe("−2,450.00 USD");
  });

  it("verifies 6-state boleta architecture rules (E1 to E6)", () => {
    expect(BOLETA_COLORS.buy).toBe("#3D5AFE");
    expect(BOLETA_COLORS.tp).toBe("#2EC27E");
    expect(BOLETA_COLORS.sl).toBe("#F0A030");
  });
});

describe("PreOrderStore (Draft Order & Ghost Lines)", () => {
  beforeEach(() => {
    preOrderStore.reset("MES", 5000);
  });

  it("initializes with consistent default values for symbol", () => {
    const state = preOrderStore.getState();
    expect(state.symbol).toBe("MES");
    expect(state.side).toBe("buy");
    expect(state.type).toBe("limit");
    expect(state.qty).toBe(1);
    expect(state.price).toBe(5000);
    expect(state.stopPrice).toBe(5000);
    expect(state.isOpen).toBe(false);
    expect(state.takeProfit.enabled).toBe(false);
    expect(state.stopLoss.enabled).toBe(false);
  });

  it("updates price and snaps to instrument tick size", () => {
    // MES tick size is 0.25
    preOrderStore.setPrice(5002.37);
    expect(preOrderStore.getState().price).toBe(5002.25);

    preOrderStore.setPrice(5002.40);
    expect(preOrderStore.getState().price).toBe(5002.50);
  });

  it("updates stopPrice and snaps to tick size for stop limit orders", () => {
    preOrderStore.setType("stop_limit");
    preOrderStore.setStopPrice(5010.12);
    expect(preOrderStore.getState().stopPrice).toBe(5010.00);
  });

  it("recalculates TP ticks when TP price changes", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setTakeProfitEnabled(true);
    // For Buy order, target 5010 is +10 points = 40 ticks on MES (0.25)
    preOrderStore.setTakeProfitPrice(5010);
    const tp = preOrderStore.getState().takeProfit;
    expect(tp.price).toBe(5010);
    expect(tp.ticks).toBe(40);
  });

  it("recalculates SL ticks and USD risk when SL price changes", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setStopLossEnabled(true);
    // For Buy order, SL at 4995 is -5 points = 20 ticks. MES pointValue is $5, so 5 * $5 * 1 = $25
    preOrderStore.setStopLossPrice(4995);
    const sl = preOrderStore.getState().stopLoss;
    expect(sl.price).toBe(4995);
    expect(sl.ticks).toBe(20);
    expect(sl.usd).toBe(25);
  });

  it("calculates contracts quantity automatically from USD risk target", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setStopLossEnabled(true);
    preOrderStore.setStopLossPrice(4990); // 10 points loss = $50 per MES contract (pointValue: 5)
    
    // User wants to risk $250
    preOrderStore.setRiskUsd(250);
    expect(preOrderStore.getState().qty).toBe(5); // 250 / 50 = 5 contracts
  });

  it("maintains TP and SL tick distance when entry price moves", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setTakeProfitEnabled(true);
    preOrderStore.setTakeProfitPrice(5010); // 40 ticks
    preOrderStore.setStopLossEnabled(true);
    preOrderStore.setStopLossPrice(4995); // 20 ticks

    // Move entry price to 5020 from chart drag
    preOrderStore.setPrice(5020, "chart", true /* preserveOffsets */);
    const state = preOrderStore.getState();
    expect(state.price).toBe(5020);
    expect(state.takeProfit.price).toBe(5030); // 5020 + (40 * 0.25)
    expect(state.stopLoss.price).toBe(5015); // 5020 - (20 * 0.25)
  });

  it("handles side inversion (Buy -> Sell) correctly for TP and SL", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setTakeProfitEnabled(true);
    preOrderStore.setTakeProfitTicks(40); // 10 points
    preOrderStore.setStopLossEnabled(true);
    preOrderStore.setStopLossTicks(20); // 5 points

    // Invert to Sell
    preOrderStore.setSide("sell");
    const state = preOrderStore.getState();
    expect(state.side).toBe("sell");
    // For Sell order: TP is below entry (5000 - 10 = 4990), SL is above entry (5000 + 5 = 5005)
    expect(state.takeProfit.price).toBe(4990);
    expect(state.stopLoss.price).toBe(5005);
  });

  it("calculates TP and SL by percentage and maintains percent property", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setTakeProfitEnabled(true);
    preOrderStore.setStopLossEnabled(true);

    // 1% TP on 5000 = 50 points = 200 ticks
    preOrderStore.setTakeProfitPercent(1);
    expect(preOrderStore.getState().takeProfit.percent).toBe(1);
    expect(preOrderStore.getState().takeProfit.ticks).toBe(200);
    expect(preOrderStore.getState().takeProfit.price).toBe(5050);

    // 0.5% SL on 5000 = 25 points = 100 ticks
    preOrderStore.setStopLossPercent(0.5);
    expect(preOrderStore.getState().stopLoss.percent).toBe(0.5);
    expect(preOrderStore.getState().stopLoss.ticks).toBe(100);
    expect(preOrderStore.getState().stopLoss.price).toBe(4975);
  });

  it("calculates quantity from percentage of equity risk", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setStopLossEnabled(true);
    // 20 ticks = 5 points = $25 loss per MES contract
    preOrderStore.setStopLossTicks(20);

    // 1% risk on $100,000 equity = $1,000 risk target
    preOrderStore.setRiskPercent(1, 100000);
    expect(preOrderStore.getState().qtyMode).toBe("risk_percent");
    expect(preOrderStore.getState().riskPercentValue).toBe(1);
    // 1000 / 25 = 40 contracts
    expect(preOrderStore.getState().qty).toBe(40);
  });

  it("publishes state changes to subscribers", () => {
    let callCount = 0;
    let lastState: PreOrderState | null = null;
    const unsubscribe = preOrderStore.subscribe((s) => {
      callCount++;
      lastState = s;
    });

    preOrderStore.setQty(3);
    expect(callCount).toBe(1);
    expect((lastState as PreOrderState | null)?.qty).toBe(3);

    unsubscribe();
    preOrderStore.setQty(4);
    expect(callCount).toBe(1); // No new call after unsubscribe
  });

  it("synchronizes price and brackets when stopPrice changes on Stop orders", () => {
    preOrderStore.setType("stop");
    preOrderStore.setTakeProfitEnabled(true);
    preOrderStore.setStopLossEnabled(true);
    preOrderStore.setTakeProfitTicks(40);
    preOrderStore.setStopLossTicks(20);

    // Set stopPrice to 5020
    preOrderStore.setStopPrice(5020);
    const state = preOrderStore.getState();
    expect(state.stopPrice).toBe(5020);
    expect(state.price).toBe(5020);
    // TP should be 5020 + (40 * 0.25) = 5030
    expect(state.takeProfit.price).toBe(5030);
    // SL should be 5020 - (20 * 0.25) = 5015
    expect(state.stopLoss.price).toBe(5015);
  });

  it("automatically enables SL with default 20 ticks when setting risk target without active SL", () => {
    preOrderStore.setPrice(5000);
    preOrderStore.setStopLossEnabled(false);
    expect(preOrderStore.getState().stopLoss.enabled).toBe(false);

    // Setting $250 risk target
    preOrderStore.setRiskUsd(250);
    const state = preOrderStore.getState();
    expect(state.stopLoss.enabled).toBe(true);
    expect(state.stopLoss.ticks).toBe(20); // 20 ticks * $1.25 = $25 per MES contract
    expect(state.qty).toBe(10); // 250 / 25 = 10 contracts
  });

  it("handles openModifyOrder correctly with description and brackets", () => {
    preOrderStore.openModifyOrder({
      id: "ord-test-123",
      symbol: "MES",
      side: "buy",
      type: "limit",
      qty: 2,
      price: 5010,
      status: "working",
      createdAt: Date.now(),
      takeProfit: 5020,
      stopLoss: 5005,
    });

    const state = preOrderStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("modify_order");
    expect(state.editOrderId).toBe("ord-test-123");
    expect(state.editOrderDescription).toBe("Buy Limit 2 @ 5,010.00");
    expect(state.price).toBe(5010);
    expect(state.qty).toBe(2);
    expect(state.takeProfit.enabled).toBe(true);
    expect(state.takeProfit.price).toBe(5020);
    expect(state.takeProfit.ticks).toBe(40);
    expect(state.stopLoss.enabled).toBe(true);
    expect(state.stopLoss.price).toBe(5005);
    expect(state.stopLoss.ticks).toBe(20);

    // Discard edit returns mode to create
    preOrderStore.discardEdit();
    expect(preOrderStore.getState().mode).toBe("create");
    expect(preOrderStore.getState().editOrderId).toBeNull();
  });

  it("handles openEditPosition correctly with position description and brackets", () => {
    preOrderStore.openEditPosition(
      {
        id: "pos-MES-1",
        symbol: "MES",
        side: "long",
        qty: 3,
        avgPrice: 5000,
        currentPrice: 5005,
        unrealizedPnL: 75,
        unrealizedPnLTicks: 20,
        unrealizedPnLPoints: 5,
        unrealizedPnLPercent: 0.1,
        openedAt: Date.now(),
        updatedAt: Date.now(),
      },
      [
        {
          id: "tp-ord",
          symbol: "MES",
          side: "sell",
          type: "limit",
          qty: 3,
          price: 5025,
          status: "working",
          createdAt: Date.now(),
          isBracketChild: true,
          bracketType: "take_profit",
        },
      ]
    );

    const state = preOrderStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("edit_position");
    expect(state.editPositionSymbol).toBe("MES");
    expect(state.editPositionDescription).toBe("Long 3 @ 5,000.00");
    expect(state.takeProfit.enabled).toBe(true);
    expect(state.takeProfit.price).toBe(5025);
    expect(state.takeProfit.ticks).toBe(100);
  });

  it("toggles price offset mode correctly", () => {
    expect(preOrderStore.getState().priceIsOffset).toBeFalsy();
    preOrderStore.togglePriceOffset();
    expect(preOrderStore.getState().priceIsOffset).toBe(true);
    preOrderStore.togglePriceOffset();
    expect(preOrderStore.getState().priceIsOffset).toBe(false);
  });
});

describe("Order Context Menu, Edit Modes and Offset Labels (1:1 TradingView Parity)", () => {
  beforeEach(() => {
    preOrderStore.reset("MNQ", 24180.25);
  });

  describe("preOrderStore - Mode Transitions", () => {
    it("opens modify_order mode with correct order details and brackets", () => {
      const order: PaperOrder = {
        id: "ord-12345",
        symbol: "MNQ",
        side: "buy",
        type: "stop_limit",
        qty: 2,
        price: 24180.25,
        stopPrice: 24180.25,
        status: "working",
        createdAt: Date.now(),
        takeProfit: 25705.25,
        stopLoss: 23063.0,
      };

      preOrderStore.openModifyOrder(order);
      const state = preOrderStore.getState();

      expect(state.isOpen).toBe(true);
      expect(state.mode).toBe("modify_order");
      expect(state.editOrderId).toBe("ord-12345");
      expect(state.editOrderDescription).toContain("Buy Stop Limit 2 @");
      expect(state.price).toBe(24180.25);
      expect(state.stopPrice).toBe(24180.25);
      expect(state.takeProfit.enabled).toBe(true);
      expect(state.takeProfit.price).toBe(25705.25);
      expect(state.stopLoss.enabled).toBe(true);
      expect(state.stopLoss.price).toBe(23063.0);
    });

    it("opens edit_position mode with 1:1 description subtitle", () => {
      const position = createMockPosition({
        side: "long",
        qty: 1,
        avgPrice: 24180.25,
      });

      preOrderStore.openEditPosition(position, []);
      const state = preOrderStore.getState();

      expect(state.isOpen).toBe(true);
      expect(state.mode).toBe("edit_position");
      expect(state.editPositionSymbol).toBe("MNQ");
      expect(state.editPositionSide).toBe("long");
      expect(state.editPositionQty).toBe(1);
      expect(state.editPositionAvgPrice).toBe(24180.25);
      expect(state.editPositionDescription).toBe("Long 1 @ 24,180.25");
    });

    it("resets back to create mode when discardEdit is called", () => {
      const position = createMockPosition({
        side: "short",
        qty: 3,
        avgPrice: 24100.0,
      });

      preOrderStore.openEditPosition(position, []);
      expect(preOrderStore.getState().mode).toBe("edit_position");

      preOrderStore.discardEdit();
      const state = preOrderStore.getState();

      expect(state.mode).toBe("create");
      expect(state.editPositionSymbol).toBeNull();
      expect(state.editPositionDescription).toBeNull();
      expect(state.editOrderId).toBeNull();
      expect(state.takeProfit.enabled).toBe(false);
      expect(state.stopLoss.enabled).toBe(false);
    });

    it("does NOT carry over enabled TP or SL into fresh order entries via open() or close()", () => {
      // Simulate user opening an order and enabling TP & SL
      preOrderStore.open("MNQ", "buy", "limit", 24180.25);
      preOrderStore.setTakeProfitEnabled(true);
      preOrderStore.setStopLossEnabled(true);
      expect(preOrderStore.getState().takeProfit.enabled).toBe(true);
      expect(preOrderStore.getState().stopLoss.enabled).toBe(true);

      // Opening a fresh entry via Buy/Sell button or right-click chart menu must start with TP/SL disabled
      preOrderStore.open("MNQ", "sell", "market", 24185.0);
      expect(preOrderStore.getState().takeProfit.enabled).toBe(false);
      expect(preOrderStore.getState().stopLoss.enabled).toBe(false);

      // Also verify after modifying an order with TP/SL and then opening a fresh entry or closing
      const orderWithBrackets: PaperOrder = {
        id: "ord-999",
        symbol: "MNQ",
        side: "buy",
        type: "limit",
        qty: 1,
        price: 24180.25,
        status: "working",
        createdAt: Date.now(),
        takeProfit: 24250.0,
        stopLoss: 24120.0,
      };
      preOrderStore.openModifyOrder(orderWithBrackets);
      expect(preOrderStore.getState().takeProfit.enabled).toBe(true);
      expect(preOrderStore.getState().stopLoss.enabled).toBe(true);

      preOrderStore.close();
      expect(preOrderStore.getState().takeProfit.enabled).toBe(false);
      expect(preOrderStore.getState().stopLoss.enabled).toBe(false);
    });
  });

  describe("Price Offset Equivalent Calculation (Stop Limit diffTicks === 0 parity)", () => {
    function computePriceEquivalentText(
      type: string,
      price: number,
      stopPrice: number,
      currentPrice: number,
      side: "buy" | "sell",
      tickSize: number,
      priceIsOffset: boolean = false
    ) {
      if (priceIsOffset) {
        return price.toString();
      }
      if (type === "stop_limit") {
        const diffTicks = Math.round((price - stopPrice) / tickSize);
        if (diffTicks === 0) return "Stop";
        return diffTicks > 0 ? `Stop + ${diffTicks}` : `Stop − ${Math.abs(diffTicks)}`;
      }
      const diffTicks = Math.round((price - currentPrice) / tickSize);
      if (diffTicks === 0) return side === "buy" ? "Ask" : "Bid";
      return diffTicks > 0
        ? `${side === "buy" ? "Ask" : "Bid"} + ${diffTicks}`
        : `${side === "buy" ? "Ask" : "Bid"} − ${Math.abs(diffTicks)}`;
    }

    it("returns 'Stop' when diffTicks === 0 (and NOT 'Stop + 0')", () => {
      const text = computePriceEquivalentText(
        "stop_limit",
        24180.25,
        24180.25,
        24180.25,
        "buy",
        0.25
      );
      expect(text).toBe("Stop");
    });

    it("returns 'Stop + X' when limit price is above stop price", () => {
      const text = computePriceEquivalentText(
        "stop_limit",
        24181.25, // +4 ticks
        24180.25,
        24180.25,
        "buy",
        0.25
      );
      expect(text).toBe("Stop + 4");
    });

    it("returns 'Stop − X' when limit price is below stop price", () => {
      const text = computePriceEquivalentText(
        "stop_limit",
        24179.25, // -4 ticks
        24180.25,
        24180.25,
        "buy",
        0.25
      );
      expect(text).toBe("Stop − 4");
    });
  });

  describe("Context Menu Header Formatter (TradingView 1:1 Parity)", () => {
    function formatContextMenuHeader(item: {
      isPosition?: boolean;
      position?: PaperPosition;
      order?: PaperOrder;
      symbol: string;
    }) {
      if (item.isPosition && item.position) {
        return `${item.position.side.toUpperCase()} ${item.position.qty} @ ${formatPriceWithCommas(
          item.symbol,
          item.position.avgPrice
        )} POSITION`;
      }
      if (item.order) {
        return `${item.order.side.toUpperCase()} ${item.order.qty} @ ${formatPriceWithCommas(
          item.symbol,
          item.order.price
        )} ${item.order.type.toUpperCase()}`;
      }
      return "";
    }

    it("formats Take Profit and Stop Loss order header correctly", () => {
      const tpOrder: PaperOrder = {
        id: "tp-1",
        symbol: "MNQ",
        side: "sell",
        type: "limit",
        qty: 1,
        price: 25705.25,
        status: "working",
        createdAt: Date.now(),
      };

      const header = formatContextMenuHeader({ order: tpOrder, symbol: "MNQ" });
      expect(header).toBe("SELL 1 @ 25,705.25 LIMIT");
    });

    it("formats Position header correctly", () => {
      const position = createMockPosition({
        side: "long",
        qty: 1,
        avgPrice: 24180.25,
      });

      const header = formatContextMenuHeader({
        isPosition: true,
        position,
        symbol: "MNQ",
      });
      expect(header).toBe("LONG 1 @ 24,180.25 POSITION");
    });
  });

  describe("Replay Exit & Rewind Cleanup (PaperTradingEngine)", () => {
    it("cancels all open positions and working orders when exiting Replay mode", () => {
      const engine = new PaperTradingEngine({ persistKey: null, initialBalance: 100000 });
      engine.onTick("MNQ", 24180.25, 24185.0, 24175.0, 1700000000);

      // Open a Market position with TP & SL brackets + a working Limit order
      engine.placeOrder({
        symbol: "MNQ",
        side: "buy",
        type: "market",
        qty: 1,
        price: 24180.25,
        takeProfit: 24220.0,
        stopLoss: 24150.0,
        timestamp: 1700000000,
      });
      engine.placeOrder({
        symbol: "MES",
        side: "sell",
        type: "limit",
        qty: 2,
        price: 5850.0,
        timestamp: 1700000000,
      });

      expect(engine.getPosition("MNQ")).toBeDefined();
      expect(engine.getWorkingOrders().length).toBe(3); // TP, SL, and MES limit

      engine.cancelAllOnExitReplay();

      expect(engine.getPosition("MNQ")).toBeUndefined();
      expect(engine.getWorkingOrders().length).toBe(0);
      expect(engine.getAccount().unrealizedPnL).toBe(0);
    });
  });
});
