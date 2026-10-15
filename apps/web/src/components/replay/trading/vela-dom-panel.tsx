"use client";

import React from "react";
import {
  VelaTradingDock,
  type TradingDockProps,
} from "./vela-trading-dock";

export interface DOMPanelProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  isFloating?: boolean;
  className?: string;
}

export function VelaDOMPanel({
  symbol,
  isOpen,
  onClose,
  isFloating = false,
  className = "",
}: DOMPanelProps) {
  return (
    <VelaTradingDock
      symbol={symbol}
      isOpen={isOpen}
      onClose={onClose}
      defaultTab="dom"
      className={`${isFloating ? "fixed top-20 right-20 shadow-2xl rounded-lg" : ""} ${className}`}
    />
  );
}
