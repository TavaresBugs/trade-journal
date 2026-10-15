"use client";

import React, { useState } from "react";
import { usePaperTrading } from "@/lib/paper-trading/use-paper-trading";
import { formatPrice, getPaperInstrumentSpec } from "@/lib/paper-trading/symbol-specs";

interface QuickTradingButtonsProps {
  symbol: string;
  fallbackPrice?: number;
  onOpenOrderTicket?: () => void;
  onOpenDOM?: () => void;
  className?: string;
}

export function VelaQuickTradingButtons({
  symbol,
  fallbackPrice,
  onOpenOrderTicket,
  onOpenDOM,
  className = "",
}: QuickTradingButtonsProps) {
  const { lastPrice, placeOrder } = usePaperTrading(symbol);
  const [qty, setQty] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const spec = getPaperInstrumentSpec(symbol);

  const currentPrice = (lastPrice && lastPrice > 0) ? lastPrice : (fallbackPrice ?? 0);
  const spread = spec.tickSize;
  const bidPrice = currentPrice > 0 ? currentPrice : 0;
  const askPrice = currentPrice > 0 ? currentPrice + spread : 0;

  const handleSellMarket = () => {
    if (currentPrice <= 0) return;
    placeOrder({
      symbol,
      side: "sell",
      type: "market",
      qty: Math.max(1, qty),
      price: bidPrice,
    });
  };

  const handleBuyMarket = () => {
    if (currentPrice <= 0) return;
    placeOrder({
      symbol,
      side: "buy",
      type: "market",
      qty: Math.max(1, qty),
      price: askPrice,
    });
  };

  return (
    <div
      className={`vela-quick-trading-bar flex items-center bg-[#151619] border border-[#2a2b30] rounded-lg shadow-lg p-1 gap-1 select-none text-white backdrop-blur-md z-30 ${className}`}
    >
      {/* Drag Grip Handle */}
      <div
        className="px-1 text-[#868a96] hover:text-white cursor-grab active:cursor-grabbing flex items-center justify-center text-xs"
        title="Quick trading toolbar"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      </div>

      {/* Red Sell Button */}
      <button
        type="button"
        onClick={handleSellMarket}
        title={`Sell Market ${qty} ${symbol} @ ${formatPrice(symbol, bidPrice)}`}
        className="flex flex-col items-center justify-center px-3 py-1 bg-[#f23645] hover:bg-[#e02d3c] active:bg-[#c92432] rounded min-w-[76px] transition-all duration-75 text-white active:scale-95 shadow-sm group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
          Sell
        </span>
        <span className="text-xs font-mono font-bold leading-tight">
          {currentPrice > 0 ? formatPrice(symbol, bidPrice) : "---"}
        </span>
      </button>

      {/* Center Spread & Quantity Pill */}
      <div className="flex flex-col items-center justify-center px-1.5 py-0.5 bg-[#1f2126] border border-[#2e3037] rounded min-w-[54px]">
        <span className="text-[9px] font-mono text-[#868a96] leading-none mb-0.5" title="Spread">
          {formatPrice(symbol, spread)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="text-[#868a96] hover:text-white text-[10px] px-0.5"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={9999}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-7 text-center bg-transparent text-xs font-mono font-semibold text-white focus:outline-none p-0"
          />
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="text-[#868a96] hover:text-white text-[10px] px-0.5"
          >
            +
          </button>
        </div>
      </div>

      {/* Blue Buy Button */}
      <button
        type="button"
        onClick={handleBuyMarket}
        title={`Buy Market ${qty} ${symbol} @ ${formatPrice(symbol, askPrice)}`}
        className="flex flex-col items-center justify-center px-3 py-1 bg-[#2962ff] hover:bg-[#1e53e5] active:bg-[#1744be] rounded min-w-[76px] transition-all duration-75 text-white active:scale-95 shadow-sm group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
          Buy
        </span>
        <span className="text-xs font-mono font-bold leading-tight">
          {currentPrice > 0 ? formatPrice(symbol, askPrice) : "---"}
        </span>
      </button>

      {/* More Options / Ticket Trigger (···) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Trading options"
          className="px-1.5 py-2 text-[#868a96] hover:text-white hover:bg-white/5 rounded transition-colors"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <circle cx="3" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="13" cy="8" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-[#151619] border border-[#2a2b30] rounded-md shadow-xl py-1 z-50 text-xs font-sans">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenOrderTicket?.();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-[#d1d4dc] hover:text-white flex items-center justify-between"
            >
              <span>Order ticket</span>
              <span className="text-[10px] text-[#868a96]">Shift+T</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenDOM?.();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-[#d1d4dc] hover:text-white flex items-center justify-between"
            >
              <span>DOM</span>
              <span className="text-[10px] text-[#868a96]">Depth</span>
            </button>
            <div className="border-t border-[#2a2b30] my-1" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                placeOrder({ symbol, side: "buy", type: "market", qty: 1 });
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#2962ff]/10 text-[#38c0fd]"
            >
              Quick Buy 1
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                placeOrder({ symbol, side: "sell", type: "market", qty: 1 });
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#f23645]/10 text-[#f23645]"
            >
              Quick Sell 1
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
