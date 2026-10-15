"use client";

import React, { useEffect, useState } from "react";
import { usePaperTrading, getGlobalPaperEngine } from "@/lib/paper-trading/use-paper-trading";
import { formatPrice } from "@/lib/paper-trading/symbol-specs";
import { preOrderStore } from "@/lib/paper-trading/pre-order-store";

export interface VelaDesktopTradingButtonsProps {
  symbol: string;
  fallbackPrice?: number;
  onOpenOrderTicket?: () => void;
  onOpenDOM?: () => void;
  visible?: boolean;
  isActive?: boolean;
  className?: string;
}

export function VelaDesktopTradingButtons({
  symbol,
  fallbackPrice,
  onOpenOrderTicket,
  onOpenDOM,
  visible = true,
  isActive = true,
  className = "",
}: VelaDesktopTradingButtonsProps) {
  const { lastPrice } = usePaperTrading(symbol);
  const [hoveredSide, setHoveredSide] = useState<"sell" | "buy" | null>(null);

  const currentPrice = lastPrice && lastPrice > 0 ? lastPrice : (fallbackPrice ?? 0);
  const executionPrice = currentPrice > 0 ? currentPrice : 0;
  const spreadDisplay = "0.00";
  const formattedPrice = executionPrice > 0 ? formatPrice(symbol, executionPrice) : "---";

  // Ensure PaperTradingEngine has an initial price for secondary symbols (e.g. MES in panel 2)
  useEffect(() => {
    if ((!lastPrice || lastPrice <= 0) && fallbackPrice && fallbackPrice > 0) {
      getGlobalPaperEngine().onTick(symbol.toUpperCase(), fallbackPrice, fallbackPrice, fallbackPrice, Date.now());
    }
  }, [symbol, lastPrice, fallbackPrice]);

  // Global keyboard shortcuts: Shift + B (Buy Market in lateral Order Ticket) & Shift + S (Sell Market in lateral Order Ticket)
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "B" || e.key === "b") {
        e.preventDefault();
        if (executionPrice > 0) {
          preOrderStore.open(symbol, "buy", "market", executionPrice);
        }
        onOpenOrderTicket?.();
      } else if (e.key === "S" || e.key === "s") {
        e.preventDefault();
        if (executionPrice > 0) {
          preOrderStore.open(symbol, "sell", "market", executionPrice);
        }
        onOpenOrderTicket?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, symbol, executionPrice, onOpenOrderTicket]);

  const handleSell = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (executionPrice <= 0) return;
    if (!lastPrice || lastPrice <= 0) {
      getGlobalPaperEngine().onTick(symbol.toUpperCase(), executionPrice, executionPrice, executionPrice, Date.now());
    }
    preOrderStore.open(symbol, "sell", "market", executionPrice);
    if (e.shiftKey) {
      onOpenOrderTicket?.();
    }
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (executionPrice <= 0) return;
    if (!lastPrice || lastPrice <= 0) {
      getGlobalPaperEngine().onTick(symbol.toUpperCase(), executionPrice, executionPrice, executionPrice, Date.now());
    }
    preOrderStore.open(symbol, "buy", "market", executionPrice);
    if (e.shiftKey) {
      onOpenOrderTicket?.();
    }
  };

  const handleSpreadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDOM?.();
  };

  if (!visible) return null;

  return (
    <div
      className={`vela-desktop-trading-buttons select-none relative ${className}`}
      data-name="sell-buy-buttons-container"
      onClick={(e) => e.stopPropagation()}
    >
      {/* SELL BUTTON */}
      <div
        className="relative flex items-center"
        onMouseEnter={() => setHoveredSide("sell")}
        onMouseLeave={() => setHoveredSide((prev) => (prev === "sell" ? null : prev))}
      >
        <button
          type="button"
          data-name="sell-order-button"
          onClick={handleSell}
          className="vela-dtb-btn vela-dtb-sell"
        >
          <span className="vela-dtb-text-wrapper">
            <span className="vela-dtb-price">{formattedPrice}</span>
            <span className="vela-dtb-title">Sell</span>
          </span>
        </button>

        {hoveredSide === "sell" && (
          <div
            role="tooltip"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+7px)] z-50 pointer-events-none"
          >
            <div className="vela-dtb-tooltip">
              <div className="vela-dtb-tooltip-arrow" />
              <span>Sell Market</span>
              <span className="w-[1px] h-3.5 bg-[var(--vela-border,#2a2b30)]" />
              <span className="vela-dtb-tooltip-keys">
                <kbd>Shift</kbd>
                <kbd>S</kbd>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SPREAD (WITHOUT QTY) */}
      <div
        className="vela-dtb-spread-wrap withoutQty"
        title={`Spread: ${spreadDisplay} (Click to open DOM)`}
        onClick={handleSpreadClick}
      >
        <span className="vela-dtb-spread">{spreadDisplay}</span>
      </div>

      {/* BUY BUTTON */}
      <div
        className="relative flex items-center"
        onMouseEnter={() => setHoveredSide("buy")}
        onMouseLeave={() => setHoveredSide((prev) => (prev === "buy" ? null : prev))}
      >
        <button
          type="button"
          data-name="buy-order-button"
          onClick={handleBuy}
          className="vela-dtb-btn vela-dtb-buy"
        >
          <span className="vela-dtb-text-wrapper">
            <span className="vela-dtb-price">{formattedPrice}</span>
            <span className="vela-dtb-title">Buy</span>
          </span>
        </button>

        {hoveredSide === "buy" && (
          <div
            role="tooltip"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+7px)] z-50 pointer-events-none"
          >
            <div className="vela-dtb-tooltip">
              <div className="vela-dtb-tooltip-arrow" />
              <span>Buy Market</span>
              <span className="w-[1px] h-3.5 bg-[var(--vela-border,#2a2b30)]" />
              <span className="vela-dtb-tooltip-keys">
                <kbd>Shift</kbd>
                <kbd>B</kbd>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
