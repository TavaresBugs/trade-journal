"use client";

import React from "react";
import {
  VelaTradingDock,
  type TradingDockProps,
} from "./vela-trading-dock";
import { type OrderSide, type OrderType } from "@/lib/paper-trading/types";

export interface OrderTicketPanelProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  initialSide?: OrderSide;
  initialType?: OrderType;
  initialPrice?: number;
  className?: string;
}

export function VelaOrderTicketPanel(props: OrderTicketPanelProps) {
  return <VelaTradingDock {...props} defaultTab="order" />;
}
