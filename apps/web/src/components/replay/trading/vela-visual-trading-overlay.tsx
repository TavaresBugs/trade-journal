"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePaperTrading } from "@/lib/paper-trading/use-paper-trading";
import {
  type PaperOrder,
  type PaperPosition,
} from "@/lib/paper-trading/types";
import {
  formatPrice,
  roundToTick,
  calculatePnL,
  getPaperInstrumentSpec,
} from "@/lib/paper-trading/symbol-specs";
import {
  preOrderStore,
  formatPriceWithCommas,
  type PreOrderState,
} from "@/lib/paper-trading/pre-order-store";
import {
  BOLETA_COLORS,
  BOLETA_ZONES,
  BoletaCancelButton,
  BoletaAlertButton,
  BoletaActionButton,
  BoletaOrderPill,
  BoletaValueChip,
  BoletaPlaceholderCapsule,
  BoletaConnector,
  BoletaZone,
  BoletaAxisLabel,
  BoletaPartialCloseModal,
  BoletaLotPopover,
  BoletaConfirmUndoGroup,
  BoletaOrderTypePopover,
} from "./boleta";
import { useAlerts, alertsStore } from "@/lib/alerts/alerts-store";
import type { ChartAlert } from "@/lib/alerts/types";

interface VisualTradingOverlayProps {
  chartInstance: any;
  symbol: string;
  className?: string;
  onOpenOrderTicket?: () => void;
  showTrading?: boolean;
}

export function VelaVisualTradingOverlay({
  chartInstance,
  symbol,
  className = "",
  onOpenOrderTicket,
  showTrading = true,
}: VisualTradingOverlayProps) {
  const {
    workingOrders,
    position,
    cancelOrder,
    modifyOrder,
    closePosition,
    placeOrder,
    lastPrice,
  } = usePaperTrading(symbol);

  const {
    activeAlertsForSymbol,
    openEditDialog,
    requestDeleteAlert,
    updateAlert,
  } = useAlerts(symbol);

  const [preOrder, setPreOrder] = useState<PreOrderState>(preOrderStore.getState());
  useEffect(() => {
    return preOrderStore.subscribe((next) => {
      setPreOrder({ ...next });
    });
  }, []);

  const [, setViewportTick] = useState(0);
  const [, setDragTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredLinePrice, setHoveredLinePrice] = useState<{ price: number; y: number } | null>(null);

  // Dragging and hover state for alerts
  const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
  const [dragAlertPrice, setDragAlertPrice] = useState<number | null>(null);
  const [hoveredAlertId, setHoveredAlertId] = useState<string | null>(null);
  const [hoveredButtonAlertId, setHoveredButtonAlertId] = useState<string | null>(null);
  const alertHasDraggedRef = useRef(false);
  const alertStartYRef = useRef(0);
  const alertDragPriceRef = useRef<number | null>(null);

  // Partial close modal state
  const [isPartialCloseOpen, setIsPartialCloseOpen] = useState(false);

  // Right-click Context Menu for brackets, orders and positions
  const [bracketContextMenu, setBracketContextMenu] = useState<{
    x: number;
    y: number;
    order?: PaperOrder;
    position?: PaperPosition;
    isPosition?: boolean;
    preOrderTarget?: "entry" | "tp" | "sl";
    headerLabel?: string;
  } | null>(null);

  useEffect(() => {
    if (!bracketContextMenu) return;
    const handleGlobalPointerDown = (e: MouseEvent | PointerEvent) => {
      const menuEl = document.getElementById("bracket-context-menu");
      if (menuEl && !menuEl.contains(e.target as Node)) {
        setBracketContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBracketContextMenu(null);
      }
    };
    window.addEventListener("pointerdown", handleGlobalPointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleGlobalPointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [bracketContextMenu]);

  // Lot popover state for working orders and pre-order
  const [lotPopoverOrder, setLotPopoverOrder] = useState<{
    orderId: string;
    qty: number;
  } | null>(null);
  const [isPreOrderLotOpen, setIsPreOrderLotOpen] = useState(false);
  const [isPreOrderTypeOpen, setIsPreOrderTypeOpen] = useState(false);
  const orderPillRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const preOrderPillRef = useRef<HTMLDivElement>(null);

  // Independent pending edits map for Estado 3 (Editando: Confirm ✓ / Undo ↶)
  const [pendingEdits, setPendingEdits] = useState<
    Record<
      string,
      {
        id: string;
        target: "order" | "tp" | "sl" | "create_tp" | "create_sl";
        isPosition: boolean;
        initialPrice: number;
        currentPrice: number;
      }
    >
  >({});


  // Active drag session ref: tracks exact item being dragged (zero lag)
  const dragSessionRef = useRef<{
    mode: "order" | "tp" | "sl" | "create_tp" | "create_sl" | "pre_order" | "pre_tp" | "pre_sl";
    id: string; // orderId or positionId
    isPosition: boolean;
    initialPrice: number;
    currentPrice: number;
    startY: number;
  } | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const latestPointerPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const hasDraggedRef = useRef<boolean>(false);
  const lastDragEndTimeRef = useRef<number>(0);
  const spec = getPaperInstrumentSpec(symbol);

  const workingOrdersRef = useRef(workingOrders);
  workingOrdersRef.current = workingOrders;
  const modifyOrderRef = useRef(modifyOrder);
  modifyOrderRef.current = modifyOrder;
  const placeOrderRef = useRef(placeOrder);
  placeOrderRef.current = placeOrder;
  const cancelOrderRef = useRef(cancelOrder);
  cancelOrderRef.current = cancelOrder;
  const positionRef = useRef(position);
  positionRef.current = position;

  // Separate parent orders and active bracket child orders
  const primaryOrders = workingOrders.filter((o) => !o.isBracketChild);
  const activeBrackets = workingOrders.filter((o) => o.isBracketChild);
  const activeTp = activeBrackets.find((o) => o.bracketType === "take_profit");
  const activeSl = activeBrackets.find((o) => o.bracketType === "stop_loss");
  const activeTpRef = useRef(activeTp);
  activeTpRef.current = activeTp;
  const activeSlRef = useRef(activeSl);
  activeSlRef.current = activeSl;

  // Project price to Y coordinate inside the price pane
  const priceToY = useCallback(
    (price: number): number | null => {
      if (!chartInstance) return null;
      try {
        const r = chartInstance.renderer?.renderer ?? chartInstance.renderer;
        const proj = r?.drawingProjector?.();
        if (!proj) return null;
        return proj.yOf(price, "price");
      } catch {
        return null;
      }
    },
    [chartInstance]
  );

  // Convert Y coordinate back to price
  const yToPrice = useCallback(
    (y: number): number | null => {
      if (!chartInstance) return null;
      try {
        const r = chartInstance.renderer?.renderer ?? chartInstance.renderer;
        const proj = r?.drawingProjector?.();
        if (!proj) return null;
        const pt = proj.pxToPoint(100, y, "price");
        if (
          pt &&
          typeof pt.price === "number" &&
          !isNaN(pt.price) &&
          isFinite(pt.price) &&
          pt.price > 0
        ) {
          return roundToTick(symbol, pt.price);
        }
        return null;
      } catch {
        return null;
      }
    },
    [chartInstance, symbol]
  );

  const yToPriceRef = useRef(yToPrice);
  yToPriceRef.current = yToPrice;

  // Synchronize overlay continuously with Vela's render loop (60fps on price scale drag, pan, zoom, tick)
  useEffect(() => {
    if (!chartInstance) return;
    const r = chartInstance.renderer?.renderer ?? chartInstance.renderer;
    if (!r) return;

    let isHooked = true;
    let scheduledFrame: number | null = null;
    const origRenderFrame = r.renderFrame;

    if (typeof origRenderFrame === "function") {
      r.renderFrame = function (...args: any[]) {
        const res = origRenderFrame.apply(this, args);
        if (isHooked && scheduledFrame === null) {
          scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = null;
            if (isHooked) {
              setViewportTick((t) => (t + 1) & 0xffff);
            }
          });
        }
        return res;
      };
    }

    const onViewport = () => {
      setViewportTick((t) => (t + 1) & 0xffff);
    };

    let unsub: (() => void) | undefined;
    if (typeof r.onViewportChange === "function") {
      unsub = r.onViewportChange(onViewport);
    }

    window.addEventListener("resize", onViewport);

    return () => {
      isHooked = false;
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
      }
      if (typeof origRenderFrame === "function") {
        r.renderFrame = origRenderFrame;
      }
      unsub?.();
      window.removeEventListener("resize", onViewport);
    };
  }, [chartInstance]);

  function removeGlobalListeners() {
    window.removeEventListener("pointermove", onGlobalPointerMove);
    window.removeEventListener("pointerup", onGlobalPointerUp);
    window.removeEventListener("pointercancel", onGlobalPointerCancel);
  }

  function addGlobalListeners() {
    removeGlobalListeners();
    window.addEventListener("pointermove", onGlobalPointerMove);
    window.addEventListener("pointerup", onGlobalPointerUp);
    window.addEventListener("pointercancel", onGlobalPointerCancel);
  }

  function onGlobalPointerMove(e: PointerEvent) {
    if (!dragSessionRef.current || !containerRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    latestPointerPosRef.current = { clientX, clientY };

    const dragDist = Math.hypot(
      clientX - dragStartPosRef.current.x,
      clientY - dragStartPosRef.current.y
    );
    if (dragDist > 4) {
      hasDraggedRef.current = true;
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!dragSessionRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect || rect.height === 0) return;

      const localY = latestPointerPosRef.current.clientY - rect.top;
      const newPrice = yToPriceRef.current(localY);
      if (
        newPrice !== null &&
        !isNaN(newPrice) &&
        isFinite(newPrice) &&
        newPrice > 0 &&
        newPrice !== dragSessionRef.current.currentPrice
      ) {
        dragSessionRef.current.currentPrice = newPrice;
        if (dragSessionRef.current.mode === "pre_order") {
          const pre = preOrderStore.getState();
          if (pre.type === "stop") {
            preOrderStore.setStopPrice(newPrice, "chart");
          } else {
            preOrderStore.setPrice(newPrice, "chart", true);
          }
        } else if (dragSessionRef.current.mode === "pre_tp") {
          preOrderStore.setTakeProfitPrice(newPrice, "chart");
        } else if (dragSessionRef.current.mode === "pre_sl") {
          preOrderStore.setStopLossPrice(newPrice, "chart");
        }
        setDragTick((t) => (t + 1) & 0xffff);
      }
    });
  }

  function onGlobalPointerCancel() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    removeGlobalListeners();

    if (!dragSessionRef.current) return;
    const { mode } = dragSessionRef.current;
    dragSessionRef.current = null;
    hasDraggedRef.current = false;
    if (mode.startsWith("pre_")) {
      preOrderStore.setActiveDragTarget(null);
    }
    setDragTick((t) => (t + 1) & 0xffff);
  }

  function onGlobalPointerUp(e: PointerEvent) {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    removeGlobalListeners();

    if (!dragSessionRef.current) return;

    // Immediately resolve exact final price at pointerup coordinate (prevents RAF cancellation dropping the drag)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect && rect.height > 0) {
        const localY = e.clientY - rect.top;
        const finalPrice = yToPriceRef.current(localY);
        if (finalPrice !== null && !isNaN(finalPrice) && isFinite(finalPrice) && finalPrice > 0) {
          dragSessionRef.current.currentPrice = finalPrice;
        }
      }
    }

    const dragDist = Math.hypot(
      e.clientX - dragStartPosRef.current.x,
      e.clientY - dragStartPosRef.current.y
    );
    if (dragDist > 3) {
      hasDraggedRef.current = true;
    }

    if (hasDraggedRef.current) {
      lastDragEndTimeRef.current = Date.now();
    }
    const { mode, id, isPosition, initialPrice, currentPrice } = dragSessionRef.current;
    dragSessionRef.current = null;
    if (mode.startsWith("pre_")) {
      preOrderStore.setActiveDragTarget(null);
    }
    setDragTick((t) => (t + 1) & 0xffff);

    if (mode.startsWith("pre_")) {
      return;
    }

    // Se for criação de bracket e o usuário não arrastou (distância <= 3px ou preço igual), não cria ordem na entrada
    if (mode.startsWith("create_") && (!hasDraggedRef.current || currentPrice === initialPrice)) {
      return;
    }

    if (currentPrice === initialPrice && !mode.startsWith("create_")) {
      return;
    }

    // Transição para Estado 3 (Editando): salva no mapa de pendingEdits para confirmação explícita (✓ / ↶)
    if (hasDraggedRef.current && (mode === "tp" || mode === "sl" || mode === "create_tp" || mode === "create_sl" || mode === "order")) {
      const targetType = mode === "create_tp" ? "tp" : mode === "create_sl" ? "sl" : mode;
      const targetId = isPosition && positionRef.current ? positionRef.current.id : id;
      const editKey = `${isPosition ? "pos" : "ord"}_${targetId}_${targetType}`;
      setPendingEdits((prev) => ({
        ...prev,
        [editKey]: {
          id: targetId,
          target: mode,
          isPosition,
          initialPrice,
          currentPrice,
        },
      }));
      return;
    }
  }

  const handleConfirmEdit = (editKey: string) => {
    const edit = pendingEdits[editKey];
    if (!edit) return;

    const { id, target, isPosition, currentPrice } = edit;

    if (target === "tp") {
      if (isPosition && activeTpRef.current) {
        modifyOrderRef.current(activeTpRef.current.id, { price: currentPrice });
      } else if (!isPosition) {
        modifyOrderRef.current(id, { takeProfit: currentPrice });
      }
    } else if (target === "sl") {
      if (isPosition && activeSlRef.current) {
        modifyOrderRef.current(activeSlRef.current.id, { price: currentPrice, stopPrice: currentPrice });
      } else if (!isPosition) {
        modifyOrderRef.current(id, { stopLoss: currentPrice });
      }
    } else if (target === "create_tp") {
      if (isPosition && positionRef.current) {
        placeOrderRef.current({
          symbol,
          side: positionRef.current.side === "long" ? "sell" : "buy",
          type: "limit",
          qty: positionRef.current.qty,
          price: currentPrice,
          isBracketChild: true,
          bracketType: "take_profit",
        });
      } else if (!isPosition) {
        modifyOrderRef.current(id, { takeProfit: currentPrice });
      }
    } else if (target === "create_sl") {
      if (isPosition && positionRef.current) {
        placeOrderRef.current({
          symbol,
          side: positionRef.current.side === "long" ? "sell" : "buy",
          type: "stop",
          qty: positionRef.current.qty,
          price: currentPrice,
          stopPrice: currentPrice,
          isBracketChild: true,
          bracketType: "stop_loss",
        });
      } else if (!isPosition) {
        modifyOrderRef.current(id, { stopLoss: currentPrice });
      }
    } else if (target === "order") {
      const ord = workingOrdersRef.current.find((o) => o.id === id);
      const isStop = ord?.type === "stop" || ord?.type === "stop_limit";
      modifyOrderRef.current(id, {
        price: currentPrice,
        stopPrice: isStop ? currentPrice : undefined,
      });
    }

    setPendingEdits((prev) => {
      const next = { ...prev };
      delete next[editKey];
      return next;
    });
  };

  const handleUndoEdit = (editKey: string) => {
    setPendingEdits((prev) => {
      const next = { ...prev };
      delete next[editKey];
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = Object.keys(pendingEdits);
      if (keys.length === 0) return;

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        keys.forEach((k) => handleConfirmEdit(k));
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        keys.forEach((k) => handleUndoEdit(k));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingEdits]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      removeGlobalListeners();
    };
  }, []);

  // Handle drag to move alert line
  const handleAlertPointerDown = (
    e: React.PointerEvent,
    alert: ChartAlert,
    _currentY: number,
  ) => {
    // Left click only
    if (e.button !== 0) return;
    // Never start line drag if clicking a button (such as the Delete or Edit button)
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    alertHasDraggedRef.current = false;
    alertStartYRef.current = e.clientY;

    const targetEl = e.currentTarget as HTMLElement;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {}

    setDraggingAlertId(alert.id);
    setDragAlertPrice(alert.targetPrice);
    alertDragPriceRef.current = alert.targetPrice;

    const onPointerMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - alertStartYRef.current) > 3) {
        alertHasDraggedRef.current = true;
      }
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = ev.clientY - rect.top;
      const newPrice = yToPrice(relativeY);
      if (newPrice !== null && newPrice > 0) {
        alertDragPriceRef.current = newPrice;
        setDragAlertPrice(newPrice);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        targetEl.releasePointerCapture(ev.pointerId);
      } catch {}

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      const finalPrice = alertDragPriceRef.current;
      alertDragPriceRef.current = null;

      setDraggingAlertId(null);
      setDragAlertPrice(null);

      if (
        alertHasDraggedRef.current &&
        finalPrice !== null &&
        finalPrice !== alert.targetPrice
      ) {
        const hasCrossing = typeof alert.message === "string" && alert.message.includes("Crossing");
        const defaultMsg = `${alert.symbol} Crossing ${formatPrice(alert.symbol, finalPrice)}`;
        updateAlert(alert.id, {
          targetPrice: finalPrice,
          message: hasCrossing || !alert.message
            ? defaultMsg
            : alert.message,
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Pointer drag initiation (left click only)
  const handlePointerDown = (
    e: React.PointerEvent,
    mode: "order" | "tp" | "sl" | "create_tp" | "create_sl" | "pre_order" | "pre_tp" | "pre_sl",
    id: string,
    isPosition: boolean,
    initialPrice: number
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    latestPointerPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    hasDraggedRef.current = false;

    const targetType = mode === "create_tp" ? "tp" : mode === "create_sl" ? "sl" : mode;
    const targetId = isPosition && positionRef.current ? positionRef.current.id : id;
    const editKey = `${isPosition ? "pos" : "ord"}_${targetId}_${targetType}`;
    const effectiveInitialPrice = pendingEdits[editKey]?.initialPrice ?? initialPrice;

    dragSessionRef.current = {
      mode,
      id: targetId,
      isPosition,
      initialPrice: effectiveInitialPrice,
      currentPrice: initialPrice,
      startY: e.clientY,
    };
    if (mode.startsWith("pre_")) {
      preOrderStore.setActiveDragTarget(
        mode === "pre_order" ? "entry" : mode === "pre_tp" ? "tp" : "sl"
      );
    }
    addGlobalListeners();
  };



  const handleQuickCreateBracket = (
    type: "tp" | "sl",
    id: string,
    isPosition: boolean,
    entryPrice: number,
    side: "buy" | "sell" | "long" | "short",
    qty: number
  ) => {
    // Se acabou de arrastar ou se houve arrasto real, ignora o synthetic click
    if (hasDraggedRef.current || Date.now() - lastDragEndTimeRef.current < 350) {
      return;
    }

    const isLong = side === "buy" || side === "long";
    const delta = spec.tickSize * 40;
    const targetPrice =
      type === "tp"
        ? roundToTick(symbol, isLong ? entryPrice + delta : entryPrice - delta)
        : roundToTick(symbol, isLong ? entryPrice - delta : entryPrice + delta);

    if (type === "tp") {
      if (isPosition) {
        placeOrder({
          symbol,
          side: isLong ? "sell" : "buy",
          type: "limit",
          qty,
          price: targetPrice,
          isBracketChild: true,
          bracketType: "take_profit",
        });
      } else {
        modifyOrder(id, { takeProfit: targetPrice });
      }
    } else {
      if (isPosition) {
        placeOrder({
          symbol,
          side: isLong ? "sell" : "buy",
          type: "stop",
          qty,
          price: targetPrice,
          stopPrice: targetPrice,
          isBracketChild: true,
          bracketType: "stop_loss",
        });
      } else {
        modifyOrder(id, { stopLoss: targetPrice });
      }
    }
  };

  // Helper to resolve order type string for BoletaOrderPill
  const getOrderTypeLabel = (order: PaperOrder) => {
    const side = order.side === "buy" ? "Buy" : "Sell";
    switch (order.type) {
      case "limit":
        return `${side} limit`;
      case "stop":
        return `${side} stop`;
      case "stop_limit":
        return `${side} stop limit`;
      case "market":
        return `${side} market`;
      default:
        return `${side} limit`;
    }
  };

  const dragSession = dragSessionRef.current;

  return (
    <div
      ref={containerRef}
      className={`vela-visual-trading-overlay absolute inset-0 pointer-events-none select-none overflow-visible z-[23] ${className}`}
      style={{
        left: "var(--vela-toolbar-gutter, 0px)",
        right: "var(--vela-scale-gutter, 64px)",
        bottom: "var(--vela-bottom-gutter, 22px)",
      }}
    >
      {/* =========================================================================
          ACTIVE ALERTS (Continuous 60fps tracking, draggable, amber #F0A030)
         ========================================================================= */}
      {activeAlertsForSymbol.map((alert) => {
        const isDragging = draggingAlertId === alert.id;
        const displayPrice =
          isDragging && dragAlertPrice !== null
            ? dragAlertPrice
            : alert.targetPrice;

        const y = priceToY(displayPrice);
        const containerHeight = containerRef.current?.clientHeight ?? 800;
        if (y === null || y < -40 || y > containerHeight + 40) {
          return null;
        }

        const formatted = formatPrice(alert.symbol, displayPrice);
        const isHovered = hoveredAlertId === alert.id;
        const isButtonHovered = hoveredButtonAlertId === alert.id;

        return (
          <div
            key={`alert-${alert.id}`}
            className="absolute left-0 right-0 group"
            style={{ top: `${y}px` }}
            onMouseEnter={() => setHoveredAlertId(alert.id)}
            onMouseLeave={() => {
              setHoveredAlertId(null);
              setHoveredButtonAlertId(null);
            }}
          >
            {/* Proximity Hit Area: 28px height (+/- 14px) around line so controls reveal when mouse approaches */}
            <div
              className="absolute left-0 right-0 h-[28px] -top-[14px] pointer-events-auto cursor-ns-resize"
              onPointerDown={(e) => handleAlertPointerDown(e, alert, y)}
              onMouseEnter={() => setHoveredAlertId(alert.id)}
            />

            {/* Horizontal Dashed Line (Amber #F0A030 matching prototipo_botao_alerta.svg) */}
            <div
              className={`absolute left-0 right-0 pointer-events-none transition-all duration-150 ${
                isHovered || isDragging ? "opacity-100" : "opacity-75"
              }`}
              style={{
                top: 0,
                borderTop: "1.5px dashed #F0A030",
                filter:
                  isHovered || isDragging
                    ? "drop-shadow(0 0 3px rgba(240, 160, 48, 0.75))"
                    : undefined,
              }}
            />

            {/* Price Scale Axis Label (Matching Entry/TP/SL standard with BoletaAxisLabel) */}
            <BoletaAxisLabel
              y={0}
              price={formatted}
              bg="#F0A030"
              textColor="#0F1115"
              dataComponent="axis-label-alert"
            />

            {/* Circular Handle on Line */}
            {(isHovered || isDragging) && (
              <div
                className="absolute w-[9px] h-[9px] rounded-full bg-white border-[1.5px] border-[#2962ff] shadow-sm transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: "calc(100% - 200px)", top: 0 }}
              />
            )}

            {/* Controls Container: Right-aligned before the price scale */}
            <div className="absolute right-3 -top-[11px] pointer-events-auto flex items-center gap-[8px]">
              {/* Botão de Alarme com Tooltip da Condição Revelado no Hover */}
              <div
                className="relative"
                onMouseEnter={() => setHoveredButtonAlertId(alert.id)}
                onMouseLeave={() => setHoveredButtonAlertId(null)}
              >
                {/* Tooltip com mensagem da condição: só aparece no hover do ícone */}
                <div
                  className={`absolute bottom-full mb-2 right-0 pointer-events-none transition-all duration-150 z-30 ${
                    isButtonHovered
                      ? "opacity-100 transform translate-y-0"
                      : "opacity-0 transform translate-y-1"
                  }`}
                >
                  <div className="bg-[#0F1115]/95 border border-[#F0A030] text-[#F0A030] px-2.5 py-1 rounded-[4px] shadow-xl text-[11px] font-mono whitespace-nowrap flex items-center gap-1.5">
                    <span className="font-semibold text-white">{alert.symbol}</span>
                    <span>{alert.message || `Crossing ${formatted}`}</span>
                  </div>
                  {/* Seta do Tooltip */}
                  <div className="w-0 h-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-[#F0A030] ml-auto mr-2.5" />
                </div>

                <BoletaAlertButton
                  state={isButtonHovered ? "hover" : "active"}
                  title="Edit alert"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(alert);
                  }}
                />
              </div>

              {/* Botão X de Cancelar/Excluir (Aparece quando chegamos perto da linha) */}
              <div
                className={`transition-opacity duration-150 ${
                  isHovered || isDragging
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <BoletaCancelButton
                  color="#E0474C"
                  title="Remove alert"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    requestDeleteAlert(alert);
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Partial close modal */}
      {showTrading && position && (
        <BoletaPartialCloseModal
          isOpen={isPartialCloseOpen}
          onClose={() => setIsPartialCloseOpen(false)}
          onConfirmClose={(qty) => {
            closePosition(symbol, qty);
            setIsPartialCloseOpen(false);
          }}
          symbol={symbol}
          side={position.side}
          currentQty={position.qty}
          avgPrice={position.avgPrice}
          hasAttachedBrackets={Boolean(activeTp || activeSl)}
        />
      )}

      {/* Hover tooltip */}
      {showTrading && hoveredLinePrice && (
        <div
          id="hover-tooltip"
          data-component="hover-tooltip"
          className="absolute z-40 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-900 pointer-events-none shadow-md backdrop-blur-sm"
          style={{
            backgroundColor: "#FFFFFF",
            top: `${hoveredLinePrice.y < 32 ? hoveredLinePrice.y + 8 : hoveredLinePrice.y - 28}px`,
            right: "260px",
            border: "1px solid rgba(0, 0, 0, 0.15)",
          }}
        >
          Price {formatPrice(symbol, hoveredLinePrice.price)}
        </div>
      )}

      {/* =========================================================================
          ESTADO 4: POSIÇÃO ABERTA (filled-line, BoletaOrderPill, brackets, modal)
         ========================================================================= */}
      {showTrading && position && position.qty > 0 && (() => {
        const isLong = position.side === "long";
        const themeColor = isLong ? BOLETA_COLORS.buy : BOLETA_COLORS.sell;
        const entryPrice = position.avgPrice;
        const entryY = priceToY(entryPrice);
        if (entryY === null || entryY < -50 || entryY > 3000) return null;

        // Existing active brackets
        const hasTp = !!activeTp;
        const hasSl = !!activeSl;

        const isDraggingThisTp = Boolean(
          dragSession?.isPosition &&
            (dragSession.mode === "tp" || dragSession.mode === "create_tp") &&
            (hasDraggedRef.current || dragSession.currentPrice !== dragSession.initialPrice)
        );
        const isDraggingThisSl = Boolean(
          dragSession?.isPosition &&
            (dragSession.mode === "sl" || dragSession.mode === "create_sl") &&
            (hasDraggedRef.current || dragSession.currentPrice !== dragSession.initialPrice)
        );

        const pendingTp = pendingEdits[`pos_${position.id}_tp`];
        const pendingSl = pendingEdits[`pos_${position.id}_sl`];

        const isEditingThisTp = isDraggingThisTp || !!pendingTp;
        const isEditingThisSl = isDraggingThisSl || !!pendingSl;
        const isEditingThis = isEditingThisTp || isEditingThisSl;

        // O TP e SL da posição coexistem de forma independente: mexer em um NUNCA zera o outro!
        const tpPrice = isDraggingThisTp
          ? dragSession!.currentPrice
          : pendingTp
          ? pendingTp.currentPrice
          : activeTp?.price ?? null;

        const slPrice = isDraggingThisSl
          ? dragSession!.currentPrice
          : pendingSl
          ? pendingSl.currentPrice
          : activeSl?.price ?? null;

        const tpY = tpPrice !== null ? priceToY(tpPrice) : null;
        const slY = slPrice !== null ? priceToY(slPrice) : null;

        const tpUsd = tpPrice !== null
          ? calculatePnL(symbol, entryPrice, tpPrice, position.side, position.qty).cashAmount
          : 0;

        const slUsd = slPrice !== null
          ? calculatePnL(symbol, entryPrice, slPrice, position.side, position.qty).cashAmount
          : 0;

        return (
          <React.Fragment key={`pos-${position.id}`}>
            {/* Estados 3a e 3b: Faixas de largura total (14%) durante edição/arrasto */}
            {isEditingThisTp && tpY !== null && (
              <BoletaZone type="TP" entryY={entryY} targetY={tpY} />
            )}
            {isEditingThisSl && slY !== null && (
              <BoletaZone type="SL" entryY={entryY} targetY={slY} />
            )}

            {/* filled-line: 1.5px sólida na cor da posição */}
            <div
              id="filled-line"
              data-component="filled-line"
              className="absolute left-0 right-0 h-[1.5px] pointer-events-auto cursor-pointer z-[2]"
              style={{
                top: `${entryY}px`,
                backgroundColor: themeColor,
                transform: "translateY(-50%)",
              }}
              onMouseEnter={() => setHoveredLinePrice({ price: entryPrice, y: entryY })}
              onMouseLeave={() => setHoveredLinePrice(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBracketContextMenu({ x: e.clientX, y: e.clientY, position, isPosition: true });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                preOrderStore.openEditPosition(position, workingOrders);
              }}
            />

            {/* Conector vertical a x=940 (20px antes do eixo) */}
            {(tpY !== null || slY !== null) && (
              <BoletaConnector
                tpY={tpY}
                entryY={entryY}
                slY={slY}
                orderColor={themeColor}
                isTpActive={isEditingThisTp}
                isSlActive={isEditingThisSl}
              />
            )}

            {/* Coluna de Controles da Entrada: Tag Grossa ancorada na coluna vertical + botões à esquerda */}
            <div
              className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
              style={{
                top: `${entryY}px`,
                left: "calc(100% - 260px)",
                transform: "translateY(-50%)",
              }}
            >
              {/* Controles à esquerda da tag (sem deslocar a coluna vertical da pill) */}
              <div className="absolute right-full mr-2 flex items-center gap-1.5">
                {pendingTp || pendingSl ? (
                  <div className="flex items-center gap-1.5" data-component="edit-central">
                    <BoletaCancelButton
                      color={themeColor}
                      dataComponent="close-button"
                      title="Close position"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (position.qty > 1) {
                          setIsPartialCloseOpen(true);
                        } else {
                          closePosition(symbol);
                        }
                      }}
                    />
                    <BoletaConfirmUndoGroup
                      onConfirm={(e) => {
                        e.stopPropagation();
                        if (pendingTp) handleConfirmEdit(`pos_${position.id}_tp`);
                        if (pendingSl) handleConfirmEdit(`pos_${position.id}_sl`);
                      }}
                      onUndo={(e) => {
                        e.stopPropagation();
                        if (pendingTp) handleUndoEdit(`pos_${position.id}_tp`);
                        if (pendingSl) handleUndoEdit(`pos_${position.id}_sl`);
                      }}
                    />
                  </div>
                ) : (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-[8px]">
                    <BoletaAlertButton
                      state={activeAlertsForSymbol.some((a) => Math.abs(a.targetPrice - position.avgPrice) < 0.001) ? "active" : "idle"}
                      title={activeAlertsForSymbol.some((a) => Math.abs(a.targetPrice - position.avgPrice) < 0.001) ? "Edit alert at entry price" : "Create alert at entry price"}
                      onClick={(e) => {
                        e.stopPropagation();
                        const existing = activeAlertsForSymbol.find((a) => Math.abs(a.targetPrice - position.avgPrice) < 0.001);
                        if (existing) {
                          openEditDialog(existing);
                        } else {
                          alertsStore.openCreateDialog(symbol, position.avgPrice);
                        }
                      }}
                    />
                    <BoletaCancelButton
                      color="#E0474C"
                      dataComponent="close-button"
                      title="Close position"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLotPopoverOrder(null);
                        setIsPreOrderLotOpen(false);
                        setIsPreOrderTypeOpen(false);
                        setBracketContextMenu(null);
                        if (position.qty > 1) {
                          setIsPartialCloseOpen(true);
                        } else {
                          closePosition(symbol);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Tag grossa em operação (E3, E4, E5): [qty] | [lado] | [resultado em USD] */}
              <BoletaOrderPill
                qty={position.qty}
                orderType={isLong ? "Long" : "Short"}
                pnlUsd={position.unrealizedPnL}
                color={themeColor}
                isSelected={true}
                onClickQty={(e) => {
                  e.stopPropagation();
                  setLotPopoverOrder(null);
                  setIsPreOrderLotOpen(false);
                  setIsPreOrderTypeOpen(false);
                  setBracketContextMenu(null);
                  setIsPartialCloseOpen(true);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBracketContextMenu({ x: e.clientX, y: e.clientY, position, isPosition: true });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  preOrderStore.openEditPosition(position, workingOrders);
                }}
              />

              {/* Placeholders +TP e +SL lado a lado se os alvos ainda não estiverem definidos */}
              {!hasTp && !isDraggingThisTp && !pendingTp && (
                <BoletaPlaceholderCapsule
                  type="TP"
                  onPointerDown={(e) =>
                    handlePointerDown(e, "create_tp", position.id, true, entryPrice)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef.current || Date.now() - lastDragEndTimeRef.current < 350) return;
                    handleQuickCreateBracket("tp", position.id, true, entryPrice, position.side, position.qty);
                  }}
                />
              )}

              {!hasSl && !isDraggingThisSl && !pendingSl && (
                <BoletaPlaceholderCapsule
                  type="SL"
                  onPointerDown={(e) =>
                    handlePointerDown(e, "create_sl", position.id, true, entryPrice)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef.current || Date.now() - lastDragEndTimeRef.current < 350) return;
                    handleQuickCreateBracket("sl", position.id, true, entryPrice, position.side, position.qty);
                  }}
                />
              )}
            </div>

            {/* Etiqueta de preço no eixo */}
            <BoletaAxisLabel
              id="axis-label-entry"
              dataComponent="axis-label-entry"
              y={entryY}
              price={formatPrice(symbol, entryPrice)}
              bg={themeColor}
            />

            {/* ==================== TP DA POSIÇÃO ==================== */}
            {tpY !== null && (hasTp || isEditingThisTp) ? (
              (() => {
                const currentTpOrder: PaperOrder = activeTp ?? {
                  id: position.id,
                  symbol,
                  side: position.side === "long" ? "sell" : "buy",
                  type: "limit",
                  qty: position.qty,
                  price: tpPrice!,
                  status: "working",
                  createdAt: Date.now(),
                  isBracketChild: true,
                  bracketType: "take_profit",
                };
                return (
                  <>
                    {/* Linha pontilhada do TP: width 100% de ponta a ponta */}
                    <svg
                      width="100%"
                      className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                      style={{ top: `${tpY}px`, height: "2px" }}
                    >
                      <line
                        data-component="tp-line"
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke={BOLETA_COLORS.tp}
                        strokeWidth="1.5"
                        strokeDasharray="1 4"
                        strokeLinecap="round"
                      />
                      <line
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke="transparent"
                        strokeWidth="12"
                        className="pointer-events-auto cursor-pointer"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: currentTpOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(currentTpOrder);
                        }}
                      />
                    </svg>

                    {/* Controles do TP alinhados na mesma coluna vertical */}
                    <div
                      className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                      style={{
                        top: `${tpY}px`,
                        left: "calc(100% - 260px)",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {!isDraggingThisTp && hasTp && (
                        <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <BoletaCancelButton
                            color={BOLETA_COLORS.tp}
                            dataComponent="remove-button-tp"
                            title="Remove Take Profit"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeTp) cancelOrder(activeTp.id);
                            }}
                          />
                        </div>
                      )}

                      <BoletaValueChip
                        type="TP"
                        qty={position.qty}
                        usdAmount={tpUsd}
                        isDragging={isEditingThisTp}
                        onPointerDown={(e) => {
                          const basePrice = tpPrice ?? (activeTp ? activeTp.price : entryPrice);
                          handlePointerDown(
                            e,
                            activeTp ? "tp" : "create_tp",
                            position.id,
                            true,
                            basePrice
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: currentTpOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(currentTpOrder);
                        }}
                      />
                    </div>

                    <BoletaAxisLabel
                      id="axis-label-tp"
                      dataComponent="axis-label-tp"
                      y={tpY}
                      price={formatPrice(symbol, tpPrice!)}
                      oldPrice={isEditingThisTp && activeTp ? formatPrice(symbol, activeTp.price) : undefined}
                      bg={BOLETA_COLORS.tp}
                      textColor="#0F1115"
                    />
                  </>
                );
              })()
            ) : null}

            {/* ==================== SL DA POSIÇÃO ==================== */}
            {slY !== null && (hasSl || isEditingThisSl) ? (
              (() => {
                const currentSlOrder: PaperOrder = activeSl ?? {
                  id: position.id,
                  symbol,
                  side: position.side === "long" ? "sell" : "buy",
                  type: "stop",
                  qty: position.qty,
                  price: slPrice!,
                  stopPrice: slPrice!,
                  status: "working",
                  createdAt: Date.now(),
                  isBracketChild: true,
                  bracketType: "stop_loss",
                };
                return (
                  <>
                    {/* Linha pontilhada do SL: width 100% de ponta a ponta */}
                    <svg
                      width="100%"
                      className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                      style={{ top: `${slY}px`, height: "2px" }}
                    >
                      <line
                        data-component="sl-line"
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke={BOLETA_COLORS.sl}
                        strokeWidth="1.5"
                        strokeDasharray="1 4"
                        strokeLinecap="round"
                      />
                      <line
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke="transparent"
                        strokeWidth="12"
                        className="pointer-events-auto cursor-pointer"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: currentSlOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(currentSlOrder);
                        }}
                      />
                    </svg>

                    {/* Controles do SL alinhados na mesma coluna vertical */}
                    <div
                      className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                      style={{
                        top: `${slY}px`,
                        left: "calc(100% - 260px)",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {!isDraggingThisSl && hasSl && (
                        <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <BoletaCancelButton
                            color={BOLETA_COLORS.sl}
                            dataComponent="remove-button-sl"
                            title="Remove Stop Loss"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeSl) cancelOrder(activeSl.id);
                            }}
                          />
                        </div>
                      )}

                      <BoletaValueChip
                        type="SL"
                        qty={position.qty}
                        usdAmount={slUsd}
                        isDragging={isEditingThisSl}
                        onPointerDown={(e) => {
                          const basePrice = slPrice ?? (activeSl ? activeSl.price : entryPrice);
                          handlePointerDown(
                            e,
                            activeSl ? "sl" : "create_sl",
                            position.id,
                            true,
                            basePrice
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: currentSlOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(currentSlOrder);
                        }}
                      />
                    </div>

                    <BoletaAxisLabel
                      id="axis-label-sl"
                      dataComponent="axis-label-sl"
                      y={slY}
                      price={formatPrice(symbol, slPrice!)}
                      oldPrice={isEditingThisSl && activeSl ? formatPrice(symbol, activeSl.price) : undefined}
                      bg={BOLETA_COLORS.sl}
                      textColor="#0F1115"
                    />
                  </>
                );
              })()
            ) : null}
          </React.Fragment>
        );
      })()}

      {/* =========================================================================
          ESTADO 2 & 3: WORKING ORDERS (pending-line, BoletaOrderPill, etc.)
         ========================================================================= */}
      {showTrading && primaryOrders.map((order) => {
        const isDraggingThisOrder = dragSession?.id === order.id && dragSession.mode === "order";
        const isDraggingThisTp = Boolean(
          dragSession?.id === order.id &&
            (dragSession.mode === "tp" || dragSession.mode === "create_tp") &&
            (hasDraggedRef.current || dragSession.currentPrice !== dragSession.initialPrice)
        );
        const isDraggingThisSl = Boolean(
          dragSession?.id === order.id &&
            (dragSession.mode === "sl" || dragSession.mode === "create_sl") &&
            (hasDraggedRef.current || dragSession.currentPrice !== dragSession.initialPrice)
        );

        const pendingOrd = pendingEdits[`ord_${order.id}_order`];
        const pendingTp = pendingEdits[`ord_${order.id}_tp`];
        const pendingSl = pendingEdits[`ord_${order.id}_sl`];

        const isEditingThisOrder = isDraggingThisOrder || !!pendingOrd;
        const isEditingThisTp = isDraggingThisTp || !!pendingTp;
        const isEditingThisSl = isDraggingThisSl || !!pendingSl;

        const displayPrice = isDraggingThisOrder
          ? dragSession!.currentPrice
          : pendingOrd
          ? pendingOrd.currentPrice
          : order.price;
        const entryY = priceToY(displayPrice);
        if (entryY === null || entryY < -50 || entryY > 3000) return null;

        const isBuy = order.side === "buy";
        const themeColor = isBuy ? BOLETA_COLORS.buy : BOLETA_COLORS.sell;

        const hasTp = order.takeProfit !== undefined && order.takeProfit !== null && order.takeProfit > 0;
        const hasSl = order.stopLoss !== undefined && order.stopLoss !== null && order.stopLoss > 0;

        // O TP e SL da ordem coexistem de forma independente: mexer em um NUNCA zera o outro!
        const tpPrice = isDraggingThisTp
          ? dragSession!.currentPrice
          : pendingTp
          ? pendingTp.currentPrice
          : hasTp
          ? order.takeProfit!
          : null;

        const slPrice = isDraggingThisSl
          ? dragSession!.currentPrice
          : pendingSl
          ? pendingSl.currentPrice
          : hasSl
          ? order.stopLoss!
          : null;

        const tpY = tpPrice !== null ? priceToY(tpPrice) : null;
        const slY = slPrice !== null ? priceToY(slPrice) : null;

        const tpUsd = tpPrice !== null
          ? calculatePnL(symbol, displayPrice, tpPrice, order.side, order.qty).cashAmount
          : 0;

        const slUsd = slPrice !== null
          ? calculatePnL(symbol, displayPrice, slPrice, order.side, order.qty).cashAmount
          : 0;

        return (
          <React.Fragment key={`ord-${order.id}`}>
            {/* Estados 3a e 3b: Faixas de largura total (14%) durante edição/arrasto */}
            {isEditingThisTp && tpY !== null && (
              <BoletaZone type="TP" entryY={entryY} targetY={tpY} />
            )}
            {isEditingThisSl && slY !== null && (
              <BoletaZone type="SL" entryY={entryY} targetY={slY} />
            )}

            {/* pending-line: tracejada 8 5 na cor da ordem (width 100% de ponta a ponta) */}
            <svg
              width="100%"
              className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
              style={{ top: `${entryY}px`, height: "2px" }}
            >
              <line
                data-component="pending-line"
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke={themeColor}
                strokeWidth="1.5"
                strokeDasharray="8 5"
              />
            </svg>

            {/* Hit target largo para hover na linha */}
            <div
              className="absolute left-0 right-0 h-[10px] pointer-events-auto cursor-pointer z-[2]"
              style={{
                top: `${entryY}px`,
                transform: "translateY(-50%)",
              }}
              onMouseEnter={() => setHoveredLinePrice({ price: displayPrice, y: entryY })}
              onMouseLeave={() => setHoveredLinePrice(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBracketContextMenu({ x: e.clientX, y: e.clientY, order });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                preOrderStore.openModifyOrder(order);
              }}
            />

            {/* Conector vertical a x=940 */}
            {(tpY !== null || slY !== null) && (
              <BoletaConnector
                tpY={tpY}
                entryY={entryY}
                slY={slY}
                orderColor={themeColor}
                isTpActive={isEditingThisTp}
                isSlActive={isEditingThisSl}
              />
            )}

            {/* Coluna de Controles da Ordem alinhada na mesma coluna vertical */}
            <div
              className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
              style={{
                top: `${entryY}px`,
                left: "calc(100% - 260px)",
                transform: "translateY(-50%)",
              }}
            >
              <div className="absolute right-full mr-2 flex items-center gap-1.5">
                {pendingOrd || pendingTp || pendingSl ? (
                  <div className="flex items-center gap-1.5" data-component="edit-central">
                    <BoletaCancelButton
                      color={themeColor}
                      dataComponent="cancel-button"
                      title="Cancel order"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelOrder(order.id);
                      }}
                    />
                    <BoletaConfirmUndoGroup
                      onConfirm={(e) => {
                        e.stopPropagation();
                        if (pendingOrd) handleConfirmEdit(`ord_${order.id}_order`);
                        if (pendingTp) handleConfirmEdit(`ord_${order.id}_tp`);
                        if (pendingSl) handleConfirmEdit(`ord_${order.id}_sl`);
                      }}
                      onUndo={(e) => {
                        e.stopPropagation();
                        if (pendingOrd) handleUndoEdit(`ord_${order.id}_order`);
                        if (pendingTp) handleUndoEdit(`ord_${order.id}_tp`);
                        if (pendingSl) handleUndoEdit(`ord_${order.id}_sl`);
                      }}
                    />
                  </div>
                ) : (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-[8px]">
                    <BoletaAlertButton
                      state={activeAlertsForSymbol.some((a) => Math.abs(a.targetPrice - order.price) < 0.001) ? "active" : "idle"}
                      title={activeAlertsForSymbol.some((a) => Math.abs(a.targetPrice - order.price) < 0.001) ? "Edit alert at order price" : "Create alert at order price"}
                      onClick={(e) => {
                        e.stopPropagation();
                        const existing = activeAlertsForSymbol.find((a) => Math.abs(a.targetPrice - order.price) < 0.001);
                        if (existing) {
                          openEditDialog(existing);
                        } else {
                          alertsStore.openCreateDialog(symbol, order.price);
                        }
                      }}
                    />
                    <BoletaCancelButton
                      color="#E0474C"
                      dataComponent="cancel-button"
                      title="Cancel order"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelOrder(order.id);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Tag fina da ordem pendente (E2 em espera e E6 editando) */}
              <div
                ref={(el) => {
                  orderPillRefs.current[order.id] = el;
                }}
                className="relative flex items-center"
              >
                <BoletaOrderPill
                  qty={order.qty}
                  orderType={getOrderTypeLabel(order)}
                  color={themeColor}
                  isSelected={false}
                  isDragging={isDraggingThisOrder}
                  onPointerDown={(e) =>
                    handlePointerDown(e, "order", order.id, false, order.price)
                  }
                  onClickQty={(e) => {
                    e.stopPropagation();
                    setLotPopoverOrder({
                      orderId: order.id,
                      qty: order.qty,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBracketContextMenu({ x: e.clientX, y: e.clientY, order });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    preOrderStore.openModifyOrder(order);
                  }}
                />

                {lotPopoverOrder?.orderId === order.id && (
                  <BoletaLotPopover
                    isOpen={true}
                    initialQty={order.qty}
                    color={themeColor}
                    anchorRef={{ current: orderPillRefs.current[order.id] ?? null }}
                    boundsRef={containerRef}
                    onConfirm={(newQty) => {
                      modifyOrder(order.id, { qty: newQty });
                      setLotPopoverOrder(null);
                    }}
                    onClose={() => setLotPopoverOrder(null)}
                  />
                )}
              </div>

              {/* Placeholders +TP e +SL lado a lado à direita da tag enquanto os alvos não estiverem definidos */}
              {!hasTp && !isDraggingThisTp && !pendingTp && (
                <BoletaPlaceholderCapsule
                  type="TP"
                  onPointerDown={(e) =>
                    handlePointerDown(e, "create_tp", order.id, false, displayPrice)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef.current || Date.now() - lastDragEndTimeRef.current < 350) return;
                    handleQuickCreateBracket("tp", order.id, false, displayPrice, order.side, order.qty);
                  }}
                />
              )}

              {!hasSl && !isDraggingThisSl && !pendingSl && (
                <BoletaPlaceholderCapsule
                  type="SL"
                  onPointerDown={(e) =>
                    handlePointerDown(e, "create_sl", order.id, false, displayPrice)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef.current || Date.now() - lastDragEndTimeRef.current < 350) return;
                    handleQuickCreateBracket("sl", order.id, false, displayPrice, order.side, order.qty);
                  }}
                />
              )}
            </div>

            {/* Etiqueta de preço no eixo */}
            <BoletaAxisLabel
              id="axis-label-entry"
              dataComponent="axis-label-entry"
              y={entryY}
              price={formatPrice(symbol, displayPrice)}
              oldPrice={isEditingThisOrder ? formatPrice(symbol, order.price) : undefined}
              bg={themeColor}
            />

            {/* ==================== TP DA ORDEM ==================== */}
            {tpY !== null && (hasTp || isEditingThisTp) ? (
              (() => {
                const tpOrder: PaperOrder = {
                  id: order.id,
                  symbol: order.symbol,
                  side: order.side === "buy" ? "sell" : "buy",
                  type: "limit",
                  qty: order.qty,
                  price: tpPrice ?? order.takeProfit!,
                  status: "working",
                  createdAt: order.createdAt,
                  isBracketChild: true,
                  bracketType: "take_profit",
                  parentOrderId: order.id,
                };
                return (
                  <>
                    <svg
                      width="100%"
                      className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                      style={{ top: `${tpY}px`, height: "2px" }}
                    >
                      <line
                        data-component="tp-line"
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke={BOLETA_COLORS.tp}
                        strokeWidth="1.5"
                        strokeDasharray="1 4"
                        strokeLinecap="round"
                      />
                      <line
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke="transparent"
                        strokeWidth="12"
                        className="pointer-events-auto cursor-pointer"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: tpOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(order);
                        }}
                      />
                    </svg>

                    <div
                      className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                      style={{
                        top: `${tpY}px`,
                        left: "calc(100% - 260px)",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {isDraggingThisTp ? null : (
                        hasTp && (
                          <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <BoletaCancelButton
                              color={BOLETA_COLORS.tp}
                              dataComponent="remove-button-tp"
                              title="Remove Take Profit"
                              onClick={(e) => {
                                e.stopPropagation();
                                modifyOrder(order.id, { takeProfit: null });
                              }}
                            />
                          </div>
                        )
                      )}

                      <BoletaValueChip
                        type="TP"
                        qty={order.qty}
                        usdAmount={tpUsd}
                        isDragging={isEditingThisTp}
                        onPointerDown={(e) => {
                          handlePointerDown(
                            e,
                            hasTp ? "tp" : "create_tp",
                            order.id,
                            false,
                            tpPrice ?? displayPrice
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: tpOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(order);
                        }}
                      />
                    </div>

                    <BoletaAxisLabel
                      id="axis-label-tp"
                      dataComponent="axis-label-tp"
                      y={tpY}
                      price={formatPrice(symbol, tpPrice!)}
                      oldPrice={isEditingThisTp && hasTp ? formatPrice(symbol, order.takeProfit!) : undefined}
                      bg={BOLETA_COLORS.tp}
                      textColor="#0F1115"
                    />
                  </>
                );
              })()
            ) : null}

            {/* ==================== SL DA ORDEM ==================== */}
            {slY !== null && (hasSl || isEditingThisSl) ? (
              (() => {
                const slOrder: PaperOrder = {
                  id: order.id,
                  symbol: order.symbol,
                  side: order.side === "buy" ? "sell" : "buy",
                  type: "stop",
                  qty: order.qty,
                  price: slPrice ?? order.stopLoss!,
                  stopPrice: slPrice ?? order.stopLoss!,
                  status: "working",
                  createdAt: order.createdAt,
                  isBracketChild: true,
                  bracketType: "stop_loss",
                  parentOrderId: order.id,
                };
                return (
                  <>
                    <svg
                      width="100%"
                      className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                      style={{ top: `${slY}px`, height: "2px" }}
                    >
                      <line
                        data-component="sl-line"
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke={BOLETA_COLORS.sl}
                        strokeWidth="1.5"
                        strokeDasharray="1 4"
                        strokeLinecap="round"
                      />
                      <line
                        x1="0"
                        y1="1"
                        x2="100%"
                        y2="1"
                        stroke="transparent"
                        strokeWidth="12"
                        className="pointer-events-auto cursor-pointer"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: slOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(order);
                        }}
                      />
                    </svg>

                    <div
                      className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                      style={{
                        top: `${slY}px`,
                        left: "calc(100% - 260px)",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {isDraggingThisSl ? null : (
                        hasSl && (
                          <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <BoletaCancelButton
                              color={BOLETA_COLORS.sl}
                              dataComponent="remove-button-sl"
                              title="Remove Stop Loss"
                              onClick={(e) => {
                                e.stopPropagation();
                                modifyOrder(order.id, { stopLoss: null });
                              }}
                            />
                          </div>
                        )
                      )}

                      <BoletaValueChip
                        type="SL"
                        qty={order.qty}
                        usdAmount={slUsd}
                        isDragging={isEditingThisSl}
                        onPointerDown={(e) => {
                          handlePointerDown(
                            e,
                            hasSl ? "sl" : "create_sl",
                            order.id,
                            false,
                            slPrice ?? displayPrice
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBracketContextMenu({ x: e.clientX, y: e.clientY, order: slOrder });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.openModifyOrder(order);
                        }}
                      />
                    </div>

                    <BoletaAxisLabel
                      id="axis-label-sl"
                      dataComponent="axis-label-sl"
                      y={slY}
                      price={formatPrice(symbol, slPrice!)}
                      oldPrice={isEditingThisSl && hasSl ? formatPrice(symbol, order.stopLoss!) : undefined}
                      bg={BOLETA_COLORS.sl}
                      textColor="#0F1115"
                    />
                  </>
                );
              })()
            ) : null}
          </React.Fragment>
        );
      })}

      {/* =========================================================================
          ESTADO 1: PROJEÇÃO (Draft / Pre-Order: action-button, cancel-button, placeholders)
         ========================================================================= */}
      {showTrading && preOrder.isOpen && preOrder.symbol === symbol && (() => {
        // Se for ordem Market, sincroniza automaticamente com o fechamento/preço atual (lastPrice)
        const entryPrice =
          preOrder.type === "market"
            ? (lastPrice && lastPrice > 0 ? lastPrice : preOrder.price)
            : preOrder.type === "stop"
            ? (preOrder.stopPrice || preOrder.price)
            : preOrder.price;
        if (!entryPrice || entryPrice <= 0) return null;
        const isBuy = preOrder.side === "buy";
        const themeColor = isBuy ? BOLETA_COLORS.buy : BOLETA_COLORS.sell;
        const entryY = priceToY(entryPrice);
        if (entryY === null || entryY < -50 || entryY > 3000) return null;

        const isDraggingEntry = dragSession?.mode === "pre_order";
        const isDraggingTp = dragSession?.mode === "pre_tp";
        const isDraggingSl = dragSession?.mode === "pre_sl";

        const hasTp = preOrder.takeProfit.enabled && preOrder.takeProfit.price > 0;
        const hasSl = preOrder.stopLoss.enabled && preOrder.stopLoss.price > 0;
        const tpPrice = isDraggingTp
          ? dragSession?.currentPrice ?? preOrder.takeProfit.price
          : preOrder.takeProfit.price;
        const slPrice = isDraggingSl
          ? dragSession?.currentPrice ?? preOrder.stopLoss.price
          : preOrder.stopLoss.price;

        const tpY = (hasTp || isDraggingTp) && tpPrice ? priceToY(tpPrice) : null;
        const slY = (hasSl || isDraggingSl) && slPrice ? priceToY(slPrice) : null;

        const tpUsd = tpPrice ? calculatePnL(symbol, entryPrice, tpPrice, preOrder.side, preOrder.qty).cashAmount : 0;
        const slUsd = slPrice ? calculatePnL(symbol, entryPrice, slPrice, preOrder.side, preOrder.qty).cashAmount : 0;

        return (
          <React.Fragment key="pre-order-projection">
            {/* Faixas coloridas de largura total (14%) durante arrasto dos alvos no Estado 1 */}
            {isDraggingTp && tpY !== null && (
              <BoletaZone type="TP" entryY={entryY} targetY={tpY} />
            )}
            {isDraggingSl && slY !== null && (
              <BoletaZone type="SL" entryY={entryY} targetY={slY} />
            )}

            {/* Linha da Projeção (dashed 8 5, width 100% de ponta a ponta) */}
            <svg
              width="100%"
              className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
              style={{ top: `${entryY}px`, height: "2px" }}
            >
              <line
                data-component="pending-line"
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke={themeColor}
                strokeWidth="1.5"
                strokeDasharray="8 5"
              />
              <line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="transparent"
                strokeWidth="12"
                className="pointer-events-auto cursor-pointer"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBracketContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    preOrderTarget: "entry",
                    headerLabel: `${preOrder.side.toUpperCase()} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, entryPrice)} ${preOrder.type.toUpperCase()}`,
                  });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenOrderTicket?.();
                }}
              />
            </svg>

            {/* Conector vertical a x=940 se houver alvos definidos */}
            {(tpY !== null || slY !== null) && (
              <BoletaConnector
                tpY={tpY}
                entryY={entryY}
                slY={slY}
                orderColor={themeColor}
                isTpActive={isDraggingTp}
                isSlActive={isDraggingSl}
              />
            )}

            {/* Controles da Projeção no Estado 1 alinhados na mesma coluna vertical */}
            <div
              className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap"
              style={{
                top: `${entryY}px`,
                left: "calc(100% - 260px)",
                transform: "translateY(-50%)",
              }}
            >
              {/* Botões X e Buy/Sell à esquerda da coluna da tag */}
              <div className="absolute right-full mr-2 flex items-center gap-2">
                <BoletaCancelButton
                  color={themeColor}
                  dataComponent="cancel-button"
                  title="Discard projection"
                  onClick={(e) => {
                    e.stopPropagation();
                    preOrderStore.close();
                  }}
                />

                <BoletaActionButton
                  side={isBuy ? "buy" : "sell"}
                  onClick={(e) => {
                    e.stopPropagation();
                    placeOrder({
                      symbol,
                      side: preOrder.side,
                      type: preOrder.type,
                      qty: Math.max(1, preOrder.qty),
                      price: entryPrice,
                      stopPrice:
                        preOrder.type === "stop" || preOrder.type === "stop_limit"
                          ? preOrder.stopPrice || entryPrice
                          : undefined,
                      takeProfit:
                        preOrder.takeProfit.enabled && preOrder.takeProfit.price > 0
                          ? preOrder.takeProfit.price
                          : undefined,
                      stopLoss:
                        preOrder.stopLoss.enabled && preOrder.stopLoss.price > 0
                          ? preOrder.stopLoss.price
                          : undefined,
                    });
                    preOrderStore.close();
                  }}
                />
              </div>

              <div ref={preOrderPillRef} className="relative flex items-center">
                {/* Pill principal da ordem com seletor de tipo de ordem */}
                <BoletaOrderPill
                  qty={preOrder.qty}
                  orderType={
                    preOrder.type === "limit"
                      ? "Limit"
                      : preOrder.type === "stop"
                      ? "Stop"
                      : preOrder.type === "stop_limit"
                      ? "Stop limit"
                      : "Market"
                  }
                  color={themeColor}
                  isSelected={false}
                  isDragging={isDraggingEntry}
                  onPointerDown={(e) => {
                    if (preOrder.type === "market") return;
                    handlePointerDown(e, "pre_order", "pre-order", false, entryPrice);
                  }}
                  onClickQty={(e) => {
                    e.stopPropagation();
                    setIsPreOrderLotOpen(true);
                  }}
                  onClickOrderType={(e) => {
                    e.stopPropagation();
                    setIsPreOrderTypeOpen(true);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBracketContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      preOrderTarget: "entry",
                      headerLabel: `${preOrder.side.toUpperCase()} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, entryPrice)} ${preOrder.type.toUpperCase()}`,
                    });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenOrderTicket?.();
                  }}
                />

                {isPreOrderTypeOpen && (
                  <BoletaOrderTypePopover
                    isOpen={true}
                    currentType={preOrder.type}
                    color={themeColor}
                    anchorRef={preOrderPillRef}
                    boundsRef={containerRef}
                    onSelectType={(newType) => {
                      if (
                        lastPrice &&
                        lastPrice > 0 &&
                        (preOrder.type === "market" || newType === "market" || preOrder.price <= 0)
                      ) {
                        preOrderStore.setPrice(lastPrice);
                        if (!preOrder.stopPrice || preOrder.stopPrice <= 0 || preOrder.type === "market") {
                          preOrderStore.setStopPrice(lastPrice);
                        }
                      }
                      preOrderStore.setType(newType);
                      setIsPreOrderTypeOpen(false);
                    }}
                    onClose={() => setIsPreOrderTypeOpen(false)}
                  />
                )}

                {isPreOrderLotOpen && (
                  <BoletaLotPopover
                    isOpen={true}
                    initialQty={preOrder.qty}
                    color={themeColor}
                    anchorRef={preOrderPillRef}
                    boundsRef={containerRef}
                    onConfirm={(newQty) => {
                      preOrderStore.setQty(newQty);
                      setIsPreOrderLotOpen(false);
                    }}
                    onClose={() => setIsPreOrderLotOpen(false)}
                  />
                )}
              </div>

              {/* Placeholders +TP e +SL lado a lado se os alvos ainda não estiverem definidos */}
              {!hasTp && !isDraggingTp && (
                <BoletaPlaceholderCapsule
                  type="TP"
                  onPointerDown={(e) => {
                    preOrderStore.setTakeProfitEnabled(true);
                    handlePointerDown(
                      e,
                      "pre_tp",
                      "pre-tp",
                      false,
                      preOrder.takeProfit.price || entryPrice
                    );
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    preOrderStore.setTakeProfitEnabled(true);
                  }}
                />
              )}

              {!hasSl && !isDraggingSl && (
                <BoletaPlaceholderCapsule
                  type="SL"
                  onPointerDown={(e) => {
                    preOrderStore.setStopLossEnabled(true);
                    handlePointerDown(
                      e,
                      "pre_sl",
                      "pre-sl",
                      false,
                      preOrder.stopLoss.price || entryPrice
                    );
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    preOrderStore.setStopLossEnabled(true);
                  }}
                />
              )}
            </div>

            {/* Etiqueta de preço no eixo */}
            <BoletaAxisLabel
              id="axis-label-entry"
              dataComponent="axis-label-entry"
              y={entryY}
              price={formatPrice(symbol, entryPrice)}
              bg={themeColor}
            />

            {/* ==================== TP DA PROJEÇÃO ==================== */}
            {tpY !== null && (hasTp || isDraggingTp) ? (
              <>
                <svg
                  width="100%"
                  className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                  style={{ top: `${tpY}px`, height: "2px" }}
                >
                  <line
                    data-component="tp-line"
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke={BOLETA_COLORS.tp}
                    strokeWidth="1.5"
                    strokeDasharray="1 4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="transparent"
                    strokeWidth="12"
                    className="pointer-events-auto cursor-pointer"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const tpSide = preOrder.side === "buy" ? "SELL" : "BUY";
                      setBracketContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        preOrderTarget: "tp",
                        headerLabel: `${tpSide} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, tpPrice!)} LIMIT`,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderTicket?.();
                    }}
                  />
                </svg>

                <div
                  className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                  style={{
                    top: `${tpY}px`,
                    left: "calc(100% - 260px)",
                    transform: "translateY(-50%)",
                  }}
                >
                  {isDraggingTp ? null : (
                    <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <BoletaCancelButton
                        color={BOLETA_COLORS.tp}
                        dataComponent="remove-button-tp"
                        title="Remove Take Profit"
                        onClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.setTakeProfitEnabled(false);
                        }}
                      />
                    </div>
                  )}

                  <BoletaValueChip
                    type="TP"
                    qty={preOrder.qty}
                    usdAmount={tpUsd}
                    isDragging={isDraggingTp}
                    onPointerDown={(e) =>
                      handlePointerDown(
                        e,
                        "pre_tp",
                        "pre-tp",
                        false,
                        tpPrice ?? entryPrice
                      )
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const tpSide = preOrder.side === "buy" ? "SELL" : "BUY";
                      setBracketContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        preOrderTarget: "tp",
                        headerLabel: `${tpSide} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, tpPrice!)} LIMIT`,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderTicket?.();
                    }}
                  />
                </div>

                <BoletaAxisLabel
                  id="axis-label-tp"
                  dataComponent="axis-label-tp"
                  y={tpY}
                  price={formatPrice(symbol, tpPrice!)}
                  bg={BOLETA_COLORS.tp}
                  textColor="#0F1115"
                />
              </>
            ) : null}

            {/* ==================== SL DA PROJEÇÃO ==================== */}
            {slY !== null && (hasSl || isDraggingSl) ? (
              <>
                <svg
                  width="100%"
                  className="absolute left-0 right-0 w-full pointer-events-none overflow-visible z-[2]"
                  style={{ top: `${slY}px`, height: "2px" }}
                >
                  <line
                    data-component="sl-line"
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke={BOLETA_COLORS.sl}
                    strokeWidth="1.5"
                    strokeDasharray="1 4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="transparent"
                    strokeWidth="12"
                    className="pointer-events-auto cursor-pointer"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const slSide = preOrder.side === "buy" ? "SELL" : "BUY";
                      setBracketContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        preOrderTarget: "sl",
                        headerLabel: `${slSide} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, slPrice!)} STOP`,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderTicket?.();
                    }}
                  />
                </svg>

                <div
                  className="absolute pointer-events-auto z-20 flex items-center gap-2 w-max whitespace-nowrap group"
                  style={{
                    top: `${slY}px`,
                    left: "calc(100% - 260px)",
                    transform: "translateY(-50%)",
                  }}
                >
                  {isDraggingSl ? null : (
                    <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <BoletaCancelButton
                        color={BOLETA_COLORS.sl}
                        dataComponent="remove-button-sl"
                        title="Remove Stop Loss"
                        onClick={(e) => {
                          e.stopPropagation();
                          preOrderStore.setStopLossEnabled(false);
                        }}
                      />
                    </div>
                  )}

                  <BoletaValueChip
                    type="SL"
                    qty={preOrder.qty}
                    usdAmount={slUsd}
                    isDragging={isDraggingSl}
                    onPointerDown={(e) =>
                      handlePointerDown(
                        e,
                        "pre_sl",
                        "pre-sl",
                        false,
                        slPrice ?? entryPrice
                      )
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const slSide = preOrder.side === "buy" ? "SELL" : "BUY";
                      setBracketContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        preOrderTarget: "sl",
                        headerLabel: `${slSide} ${preOrder.qty} @ ${formatPriceWithCommas(symbol, slPrice!)} STOP`,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderTicket?.();
                    }}
                  />
                </div>

                <BoletaAxisLabel
                  id="axis-label-sl"
                  dataComponent="axis-label-sl"
                  y={slY}
                  price={formatPrice(symbol, slPrice!)}
                  bg={BOLETA_COLORS.sl}
                  textColor="#0F1115"
                />
              </>
            ) : null}
          </React.Fragment>
        );
      })()}

      {/* =========================================================================
          RIGHT-CLICK CONTEXT MENU (TradingView 1:1 Parity — Portaled & Cell-Clamped)
         ========================================================================= */}
      {showTrading && bracketContextMenu && (() => {
        const rect = containerRef.current?.getBoundingClientRect();
        const winW = typeof window !== "undefined" ? window.innerWidth : 1000;
        const winH = typeof window !== "undefined" ? window.innerHeight : 800;
        const minX = rect && rect.width > 0 ? Math.max(8, rect.left + 8) : 8;
        const maxX = rect && rect.width > 0 ? Math.max(minX, Math.min(rect.right - 228, winW - 228)) : winW - 228;
        const minY = rect && rect.height > 0 ? Math.max(8, rect.top + 8) : 8;
        const maxY = rect && rect.height > 0 ? Math.max(minY, Math.min(rect.bottom - 148, winH - 148)) : winH - 148;
        const menuLeft = Math.max(minX, Math.min(bracketContextMenu.x, maxX));
        const menuTop = Math.max(minY, Math.min(bracketContextMenu.y, maxY));

        const menuNode = (
          <div
            id="bracket-context-menu"
            data-testid="bracket-context-menu"
            className="fixed pointer-events-auto z-[70] select-none rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl py-1.5 w-[220px] text-xs text-[#d1d4dc] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${menuLeft}px`,
              top: `${menuTop}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="px-3 py-1.5 text-[11px] font-semibold text-[#868a96] tracking-wider truncate border-b border-[#2a2b30]/60 mb-1">
              {bracketContextMenu.headerLabel
                ? bracketContextMenu.headerLabel
                : bracketContextMenu.isPosition && bracketContextMenu.position
                ? `${bracketContextMenu.position.side.toUpperCase()} ${bracketContextMenu.position.qty} @ ${formatPriceWithCommas(symbol, bracketContextMenu.position.avgPrice)} POSITION`
                : bracketContextMenu.order
                ? `${bracketContextMenu.order.side.toUpperCase()} ${bracketContextMenu.order.qty} @ ${formatPriceWithCommas(symbol, bracketContextMenu.order.price)} ${bracketContextMenu.order.type.toUpperCase()}`
                : ""}
            </div>

            {/* Item 1: Modify order / Edit position */}
            <div
              data-testid="context-menu-item-modify"
              className="px-3 py-1.5 flex items-center hover:bg-[#2a2b30] hover:text-white cursor-pointer transition-colors"
              onClick={() => {
                if (bracketContextMenu.preOrderTarget) {
                  onOpenOrderTicket?.();
                } else if (bracketContextMenu.isPosition && bracketContextMenu.position) {
                  preOrderStore.openEditPosition(bracketContextMenu.position, workingOrders);
                  onOpenOrderTicket?.();
                } else if (bracketContextMenu.order) {
                  preOrderStore.openModifyOrder(bracketContextMenu.order);
                  onOpenOrderTicket?.();
                }
                setBracketContextMenu(null);
              }}
            >
              {bracketContextMenu.isPosition ? "Edit position" : "Modify order"}
            </div>

            {/* Item 2: Cancel order / Close position */}
            <div
              data-testid="context-menu-item-cancel"
              className="px-3 py-1.5 flex items-center hover:bg-[#2a2b30] hover:text-white cursor-pointer transition-colors"
              onClick={() => {
                if (bracketContextMenu.preOrderTarget === "tp") {
                  preOrderStore.setTakeProfitEnabled(false);
                } else if (bracketContextMenu.preOrderTarget === "sl") {
                  preOrderStore.setStopLossEnabled(false);
                } else if (bracketContextMenu.preOrderTarget === "entry") {
                  preOrderStore.close();
                } else if (bracketContextMenu.isPosition && bracketContextMenu.position) {
                  if (bracketContextMenu.position.qty > 1) {
                    setIsPartialCloseOpen(true);
                  } else {
                    closePosition(symbol);
                  }
                } else if (bracketContextMenu.order) {
                  const ord = bracketContextMenu.order;
                  if (ord.parentOrderId && ord.bracketType === "take_profit") {
                    modifyOrder(ord.parentOrderId, { takeProfit: null });
                  } else if (ord.parentOrderId && ord.bracketType === "stop_loss") {
                    modifyOrder(ord.parentOrderId, { stopLoss: null });
                  } else {
                    cancelOrder(ord.id);
                  }
                }
                setBracketContextMenu(null);
              }}
            >
              {bracketContextMenu.isPosition ? "Close position" : "Cancel order"}
            </div>

            {/* Divisor */}
            <div className="my-1 border-t border-[#2a2b30]" />

            {/* Item 3: No overlap orders and positions */}
            <div className="px-3 py-1.5 text-[#5d606b] cursor-not-allowed select-none text-[11px]">
              No overlap orders and positions
            </div>
          </div>
        );

        return typeof document !== "undefined" && document.body
          ? createPortal(menuNode, document.body)
          : menuNode;
      })()}
    </div>
  );
}
