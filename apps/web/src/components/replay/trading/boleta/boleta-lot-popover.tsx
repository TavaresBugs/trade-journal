"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { computeFloatingPosition, type ComputedFloatingPosition } from "../floating-portal-popover";

export interface BoletaLotPopoverProps {
  isOpen: boolean;
  initialQty: number;
  min?: number;
  max?: number;
  step?: number;
  color?: string;
  onConfirm: (newQty: number) => void;
  onClose: () => void;
  title?: string;
  className?: string;
  anchorRef?: React.RefObject<Element | null>;
  boundsRef?: React.RefObject<HTMLElement | null>;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * BoletaLotPopover (QuantityCalculator)
 * Paridade 1:1 absoluta com TradingView Desktop Module 987465 (QuantityCalculator) & Module 174317.
 * Reproduz o popover oficial de "Change order quantity" extraído via CDP do Electron vivo.
 */
export const BoletaLotPopover: React.FC<BoletaLotPopoverProps> = ({
  isOpen,
  initialQty,
  min = 1,
  max = 99999,
  step = 1,
  onConfirm,
  onClose,
  className = "",
  anchorRef,
  boundsRef,
}) => {
  const [qty, setQty] = useState<number>(initialQty);
  const [inputValue, setInputValue] = useState<string>(String(initialQty));
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<ComputedFloatingPosition | null>(null);

  const resolveCoords = useCallback((): ComputedFloatingPosition => {
    const anchorRect = anchorRef?.current
      ? anchorRef.current.getBoundingClientRect()
      : { top: 200, bottom: 226, left: 400, right: 490, width: 90, height: 26 };
    const popRect = popoverRef.current?.getBoundingClientRect();
    const boundsRect = boundsRef?.current?.getBoundingClientRect() ?? null;

    return computeFloatingPosition({
      anchorRect,
      popWidth: popRect && popRect.width > 0 ? popRect.width : 200,
      popHeight: popRect && popRect.height > 0 ? popRect.height : 265,
      align: "right",
      preferredPlacement: "top",
      offset: 8,
      boundsRect,
    });
  }, [anchorRef, boundsRef]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    setCoords(resolveCoords());
  }, [isOpen, resolveCoords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => setCoords(resolveCoords());
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, resolveCoords]);

  useEffect(() => {
    if (isOpen) {
      const sanitized = Math.max(min, Math.min(max, initialQty));
      setQty(sanitized);
      setInputValue(String(sanitized));

      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialQty, min, max]);

  // Outside click & keyboard handlers
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) return;
      handleSubmit();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleIncDec(step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleIncDec(-step);
      }
    };

    window.addEventListener("pointerdown", handlePointerDownOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, qty, anchorRef]);

  if (!isOpen) return null;

  const updateValue = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    setQty(clamped);
    setInputValue(String(clamped));
  };

  const handleIncDec = (delta: number) => {
    updateValue(qty + delta);
  };

  const handlePlusValue = (addVal: number) => {
    updateValue(qty + addVal);
  };

  const handleClear = () => {
    updateValue(min);
  };

  const handleResetDefault = () => {
    updateValue(initialQty);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= min) {
      setQty(Math.min(max, parsed));
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < min) {
      updateValue(min);
    } else {
      updateValue(parsed);
    }
  };

  const handleSubmit = () => {
    const finalQty = Math.max(min, Math.min(max, qty));
    onConfirm(finalQty);
    onClose();
  };

  const activeCoords = coords ?? resolveCoords();

  const node = (
    <div
      ref={popoverRef}
      data-name="trading-quantity-calculator"
      data-qa-id="quantity-calculator-popup"
      data-placement={activeCoords.placement}
      className={`calculatorWithInput-HqOX_QDa fixed z-[70] w-[200px] rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl p-3 select-none flex flex-col text-xs text-[#f0f3fa] pointer-events-auto animate-in fade-in zoom-in-95 duration-100 ${className}`}
      style={{
        top: `${activeCoords.top}px`,
        left: `${activeCoords.left}px`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header Label: "Quantity" (TradingView Module 359021) */}
      <label
        htmlFor="calculator-input"
        className="block text-[13px] font-medium text-[#9a9ea8] mb-1.5"
      >
        Quantity
      </label>

      {/* 2. Number Input with Stepper Carets (Module 406489) */}
      <div className="relative mb-3">
        <input
          id="calculator-input"
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className="w-full h-[34px] px-2.5 pr-6 rounded-[6px] bg-[#151619] border border-[#2a2b30] focus:border-[#2962ff] text-white font-mono font-semibold text-[13px] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {/* Native-style Stepper Buttons (Up / Down) */}
        <div className="absolute right-1 top-1 bottom-1 w-4 flex flex-col justify-between py-0.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleIncDec(step)}
            className="flex-1 flex items-center justify-center text-[#9a9ea8] hover:text-white hover:bg-white/[0.08] rounded-[2px] transition-colors"
            title="Increment"
          >
            <svg viewBox="0 0 8 5" width="7" height="4" fill="currentColor">
              <path d="M4 0L0 4h8L4 0z" />
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleIncDec(-step)}
            className="flex-1 flex items-center justify-center text-[#9a9ea8] hover:text-white hover:bg-white/[0.08] rounded-[2px] transition-colors"
            title="Decrement"
          >
            <svg viewBox="0 0 8 5" width="7" height="4" fill="currentColor">
              <path d="M4 5L8 1H0l4 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3. Button Matrix (TradingView Module 987465 - buttonsWrapper-HqOX_QDa) */}
      <div className="buttonsWrapper-HqOX_QDa flex flex-col gap-1">
        {/* Row 1: Inc/Dec Buttons (- and +) with margin bottom */}
        <div className="grid grid-cols-2 gap-1 mb-2">
          {/* Minus Button (Module 853003) */}
          <button
            type="button"
            data-value="-1"
            data-name="qtyButtonCalculator--1"
            onClick={() => handleIncDec(-step)}
            disabled={qty <= min}
            className="h-[28px] rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#f0f3fa] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Decrease"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
              className="text-[#f0f3fa]"
            >
              <path fill="currentColor" d="M5 9h9v1H5V9Z" />
            </svg>
          </button>

          {/* Plus Button (Module 114941) */}
          <button
            type="button"
            data-value="1"
            data-name="qtyButtonCalculator-1"
            onClick={() => handleIncDec(step)}
            disabled={qty >= max}
            className="h-[28px] rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#f0f3fa] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Increase"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
              className="text-[#f0f3fa]"
            >
              <path fill="currentColor" d="M9.5 4.5h-1v4h-4v1h4v4h1v-4h4v-1h-4v-4Z" />
            </svg>
          </button>
        </div>

        {/* Rows 2-4: Presets Matrix (1, 5, 25, 100, 500, 1000) */}
        <div className="grid grid-cols-2 gap-1">
          {[1, 5, 25, 100, 500, 1000].map((preset) => (
            <button
              key={preset}
              type="button"
              data-value={preset}
              data-name={`qtyButtonCalculator-${preset}`}
              onClick={() => handlePlusValue(preset)}
              className="h-[28px] rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#f0f3fa] font-mono text-[12px] font-medium flex items-center justify-center transition-colors shadow-xs active:scale-95"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Row 5: Action Buttons (Clear C & Default ↺) */}
        <div className="grid grid-cols-2 gap-1 mt-1">
          {/* Clear Button (Module 86863) */}
          <button
            type="button"
            data-value="clear"
            data-name="qtyButtonCalculator-clear"
            onClick={handleClear}
            className="h-[28px] rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#f0f3fa] flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Clear"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
              className="text-[#f0f3fa]"
            >
              <path
                fill="currentColor"
                d="M9.36 5a4.44 4.44 0 0 0-4.39 4.5c0 2.49 1.97 4.5 4.39 4.5 1.62 0 3.04-.9 3.8-2.25l.84.5A5.33 5.33 0 0 1 9.36 15 5.43 5.43 0 0 1 4 9.5C4 6.46 6.4 4 9.36 4c1.98 0 3.71 1.1 4.64 2.75l-.84.5A4.36 4.36 0 0 0 9.36 5Z"
              />
            </svg>
          </button>

          {/* Default / Reset Button (Module 31813) */}
          <button
            type="button"
            data-value="default"
            data-name="qtyButtonCalculator-default"
            onClick={handleResetDefault}
            className="h-[28px] rounded-[6px] border border-[#2a2b30] bg-[#1e1f24] hover:bg-[#2a2b30] text-[#f0f3fa] flex items-center justify-center transition-colors shadow-xs active:scale-95"
            title="Default quantity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
              className="text-[#f0f3fa]"
            >
              <path
                fill="currentColor"
                d="M10 6.13V8L6 5.5 10 3v2.1A5 5 0 1 1 4 10a.5.5 0 0 1 1 0 4 4 0 1 0 5-3.87Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(node, document.body);
  }
  return node;
};

