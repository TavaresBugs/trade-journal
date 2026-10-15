"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAlerts } from "@/lib/alerts/alerts-store";
import { ChartAlert } from "@/lib/alerts/types";
import { formatPrice, roundToTick } from "@/lib/paper-trading/symbol-specs";
import {
  BoletaAlertButton,
  BoletaCancelButton,
  BoletaAxisLabel,
} from "../replay/trading/boleta";

interface VelaChartAlertsOverlayProps {
  chartInstance: any;
  symbol: string;
  className?: string;
}

export function VelaChartAlertsOverlay({
  chartInstance,
  symbol,
  className = "",
}: VelaChartAlertsOverlayProps) {
  const { activeAlertsForSymbol, openEditDialog, requestDeleteAlert, updateAlert } =
    useAlerts(symbol);

  const [, setViewportTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging state for adjusting alert level visually on chart
  const [draggingAlertId, setDraggingAlertId] = useState<string | null>(null);
  const [dragCurrentPrice, setDragCurrentPrice] = useState<number | null>(null);
  const [hoveredAlertId, setHoveredAlertId] = useState<string | null>(null);
  const [hoveredButtonAlertId, setHoveredButtonAlertId] = useState<string | null>(null);
  const hasDraggedRef = useRef(false);
  const startYRef = useRef(0);
  const dragPriceRef = useRef<number | null>(null);

  // Project price to screen Y
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
    [chartInstance],
  );

  // Project screen Y back to price
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
    [chartInstance, symbol],
  );

  // Continuous sync with chart renderer (60fps on price scale drag, zoom, pan)
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
      if (typeof origRenderFrame === "function" && r.renderFrame === origRenderFrame) {
        // Keep original if untouched
      }
      unsub?.();
      window.removeEventListener("resize", onViewport);
    };
  }, [chartInstance]);

  // Handle drag to move alert line
  const handlePointerDown = (
    e: React.PointerEvent,
    alert: ChartAlert,
    currentY: number,
  ) => {
    // Left click only
    if (e.button !== 0) return;
    // Never start line drag if clicking a button (such as the Delete button)
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    hasDraggedRef.current = false;
    startYRef.current = e.clientY;

    const targetEl = e.currentTarget as HTMLElement;
    targetEl.setPointerCapture(e.pointerId);

    setDraggingAlertId(alert.id);
    setDragCurrentPrice(alert.targetPrice);
    dragPriceRef.current = alert.targetPrice;

    const onPointerMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startYRef.current) > 3) {
        hasDraggedRef.current = true;
      }
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = ev.clientY - rect.top;
      const newPrice = yToPrice(relativeY);
      if (newPrice !== null && newPrice > 0) {
        dragPriceRef.current = newPrice;
        setDragCurrentPrice(newPrice);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        targetEl.releasePointerCapture(ev.pointerId);
      } catch {}

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      const finalPrice = dragPriceRef.current;
      dragPriceRef.current = null;

      setDraggingAlertId(null);
      setDragCurrentPrice(null);

      if (
        hasDraggedRef.current &&
        finalPrice !== null &&
        finalPrice !== alert.targetPrice
      ) {
        const defaultMsg = `${alert.symbol} Crossing ${formatPrice(alert.symbol, finalPrice)}`;
        updateAlert(alert.id, {
          targetPrice: finalPrice,
          message: alert.message.includes("Crossing")
            ? defaultMsg
            : alert.message,
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  if (!activeAlertsForSymbol.length) {
    return null;
  }

  const containerHeight = containerRef.current?.clientHeight ?? 800;

  return (
    <div
      ref={containerRef}
      className={`vela-chart-alerts-overlay absolute inset-0 pointer-events-none select-none z-15 overflow-visible ${className}`}
      style={{
        left: "var(--vela-toolbar-gutter, 0px)",
        right: "var(--vela-scale-gutter, 64px)",
        bottom: "var(--vela-bottom-gutter, 22px)",
      }}
    >
      {activeAlertsForSymbol.map((alert) => {
        const isDragging = draggingAlertId === alert.id;
        const displayPrice =
          isDragging && dragCurrentPrice !== null
            ? dragCurrentPrice
            : alert.targetPrice;

        const y = priceToY(displayPrice);
        if (y === null || y < -40 || y > containerHeight + 40) {
          return null;
        }

        const formatted = formatPrice(alert.symbol, displayPrice);
        const isHovered = hoveredAlertId === alert.id;
        const isButtonHovered = hoveredButtonAlertId === alert.id;

        return (
          <div
            key={alert.id}
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
              onPointerDown={(e) => handlePointerDown(e, alert, y)}
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
    </div>
  );
}
