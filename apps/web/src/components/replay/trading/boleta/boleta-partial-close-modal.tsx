"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BOLETA_COLORS } from "./boleta-tokens";

export interface BoletaPartialCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: (qty: number) => void;
  symbol: string;
  side: "long" | "short";
  currentQty: number;
  avgPrice: number;
  hasAttachedBrackets?: boolean;
}

/**
 * BoletaPartialCloseModal
 * 1:1 Parity with TradingView Desktop ClosePositionDialog (Module 430806).
 * data-name="trading-partial-closing-dialog"
 */
export const BoletaPartialCloseModal: React.FC<BoletaPartialCloseModalProps> = ({
  isOpen,
  onClose,
  onConfirmClose,
  symbol,
  side,
  currentQty,
  avgPrice,
  hasAttachedBrackets = false,
}) => {
  const totalQty = Math.max(1, Math.abs(currentQty));
  const [isPartial, setIsPartial] = useState(false);
  const [closeQty, setCloseQty] = useState<number>(totalQty);
  const [inputStr, setInputStr] = useState<string>(String(totalQty));
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // By default in TV Desktop, isPartial starts false and closeQty starts at totalQty
      setIsPartial(false);
      setCloseQty(totalQty);
      setInputStr(String(totalQty));
    }
  }, [isOpen, totalQty]);

  // When user toggles partial close on, if closeQty is totalQty, default to 1 (or totalQty - 1)
  const handleTogglePartial = (checked: boolean) => {
    setIsPartial(checked);
    if (checked) {
      const defaultPartial = totalQty > 1 ? Math.max(1, totalQty - 1) : 1;
      setCloseQty(defaultPartial);
      setInputStr(String(defaultPartial));
    } else {
      setCloseQty(totalQty);
      setInputStr(String(totalQty));
    }
  };

  const isLong = side === "long";
  const actionColor = BOLETA_COLORS.buy; // TradingView dialog submit button is primary blue

  // TradingView Desktop validity rules (Module 430806)
  const isCloseQtyValidNumber = !isNaN(closeQty) && closeQty >= 1 && closeQty <= totalQty;
  const isPartialValid = isPartial && isCloseQtyValidNumber && closeQty < totalQty;
  const submitButtonText = isPartialValid ? "Partially close position" : "Close position";
  const leavingQty = Math.max(0, totalQty - (isCloseQtyValidNumber ? closeQty : 0));

  const handleIncrement = () => {
    setCloseQty((prev) => {
      const next = Math.min(totalQty, prev + 1);
      setInputStr(String(next));
      return next;
    });
  };

  const handleDecrement = () => {
    setCloseQty((prev) => {
      const next = Math.max(1, prev - 1);
      setInputStr(String(next));
      return next;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputStr(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      setCloseQty(Math.max(1, Math.min(totalQty, parsed)));
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputStr, 10);
    if (isNaN(parsed) || parsed < 1) {
      setCloseQty(1);
      setInputStr("1");
    } else {
      const clamped = Math.max(1, Math.min(totalQty, parsed));
      setCloseQty(clamped);
      setInputStr(String(clamped));
    }
  };

  const handleSubmit = () => {
    if (isPartial && !isCloseQtyValidNumber) return;
    const effectiveQty = isPartialValid ? closeQty : totalQty;
    onConfirmClose(effectiveQty);
    onClose();
  };

  // Keyboard navigation (Enter / Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPartial, isPartialValid, closeQty, totalQty]);

  if (!isOpen) return null;

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        data-name="trading-partial-closing-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] rounded-xl bg-[#16181D] border border-[#2A2B30] text-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2B30]/60">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[13px] tracking-tight">Close position</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-[12px]">
          {/* Symbol info banner */}
          <div className="flex items-center gap-2.5 bg-[#0F1115] p-3 rounded-lg border border-[#2A2B30]/40">
            <div className="w-8 h-8 rounded-md bg-[#1E2127] border border-[#2A2B30] flex items-center justify-center font-bold text-[12px] text-zinc-200">
              {symbol.slice(0, 3)}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-200 text-[13px]">
                {symbol}
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {isLong ? "Long" : "Short"} {totalQty} {totalQty === 1 ? "unit" : "units"} @ {avgPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkbox: Partial close */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              name="partially-close-checkbox"
              data-name="partially-close-checkbox"
              checked={isPartial}
              onChange={(e) => handleTogglePartial(e.target.checked)}
              className="w-4 h-4 rounded border-[#3D5AFE] text-[#3D5AFE] bg-[#0F1115] focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-zinc-200 group-hover:text-white transition-colors font-medium">
              Partial close
            </span>
          </label>

          {/* Stepper (Only active if partial close is checked) */}
          {isPartial ? (
            <div className="space-y-2.5 bg-[#0F1115] p-3 rounded-lg border border-[#2A2B30]/40">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">Units to close:</span>
                <span className="text-zinc-300 font-mono text-[11px]">
                  of {totalQty} {totalQty === 1 ? "unit" : "units"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={closeQty <= 1}
                  className="w-8 h-8 rounded bg-[#1E2127] border border-[#2A2B30] flex items-center justify-center text-zinc-300 hover:bg-[#2A2B30] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all font-mono text-[14px]"
                  title="Decrease"
                >
                  −
                </button>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="number"
                    min={1}
                    max={totalQty}
                    value={inputStr}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="w-full h-8 bg-[#16181D] border border-[#2A2B30] rounded text-center font-mono font-semibold text-white focus:outline-none focus:border-[#3D5AFE] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={closeQty >= totalQty}
                  className="w-8 h-8 rounded bg-[#1E2127] border border-[#2A2B30] flex items-center justify-center text-zinc-300 hover:bg-[#2A2B30] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all font-mono text-[14px]"
                  title="Increase"
                >
                  +
                </button>
              </div>

              {/* Estimation: 1:1 TradingView string */}
              <div className="text-[11px] text-zinc-400 font-mono pt-0.5">
                Leaving a position of <strong className="text-zinc-200">{leavingQty}</strong>
              </div>
            </div>
          ) : (
            <div className="bg-[#0F1115] p-3 rounded-lg border border-[#2A2B30]/40 text-zinc-400 text-[11px]">
              Full close of <strong className="text-zinc-200">{totalQty}</strong> {totalQty === 1 ? "unit" : "units"} at market price.
            </div>
          )}

          {/* Informer on attached brackets */}
          {hasAttachedBrackets && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
              <span className="font-bold text-amber-400 mt-0.5">⚠</span>
              <span>
                {isPartialValid
                  ? `Attached Take Profit and Stop Loss will be scaled to ${leavingQty} units.`
                  : "Closing this position will cancel any attached bracket orders."}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#0F1115]/50 border-t border-[#2A2B30]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#2A2B30] text-zinc-300 hover:text-white hover:bg-white/5 text-[12px] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPartial && !isCloseQtyValidNumber}
            className="px-4 py-1.5 rounded-lg text-white font-semibold text-[12px] shadow-sm transition-transform hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            style={{ backgroundColor: actionColor }}
          >
            {submitButtonText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
};

