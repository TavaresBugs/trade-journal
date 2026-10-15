"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { usePaperTrading } from "@/lib/paper-trading/use-paper-trading";
import {
  formatPrice,
  roundToTick,
  getPaperInstrumentSpec,
  calculatePnL,
} from "@/lib/paper-trading/symbol-specs";
import {
  preOrderStore,
  formatPriceWithCommas,
  type PreOrderState,
} from "@/lib/paper-trading/pre-order-store";
import { type OrderSide, type OrderType } from "@/lib/paper-trading/types";
import { FloatingPortalPopover } from "./floating-portal-popover";

// ============================================================================
// SVG ICONS (TradingView 1:1 Parity)
// ============================================================================

function ReplayBrokerLogo() {
  return (
    <div
      className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 overflow-hidden shadow-sm bg-[#2962ff]"
      title="Replay Paper Broker"
    >
      <svg viewBox="0 0 56 56" width="28" height="28" fill="none">
        <rect width="56" height="56" rx="8" fill="#2962ff" />
        <path fill="#ffffff" d="M27 45 9 28l18-17zm18 0L27 28l18-17z" />
      </svg>
    </div>
  );
}

function GridPlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 6a2 2 0 00-2 2v3a2 2 0 002 2h3a2 2 0 002-2V8a2 2 0 00-2-2H8zm3 1H8a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V8a1 1 0 00-1-1zM8 15a2 2 0 00-2 2v3a2 2 0 002 2h3a2 2 0 002-2v-3a2 2 0 00-2-2H8zm3 1H8a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1v-3a1 1 0 00-1-1zM15 8a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V8zm2-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V8a1 1 0 011-1z"
      />
      <path fill="currentColor" d="M18 19h-3v-1h3v-3h1v3h3v1h-3v3h-1v-3z" />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
      <path
        fill="currentColor"
        d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19 14.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none">
      <path stroke="currentColor" strokeWidth="1.2" d="M7 6l15 15m0-15L7 21" />
    </svg>
  );
}

function ArrowBackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none">
      <path stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" d="M17 6L9 14l8 8" />
    </svg>
  );
}

function SwapArrowsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="14" height="14" fill="none">
      <path
        fill="currentColor"
        d="M15 10.5a2.5 2.5 0 0 1-2.5 2.5H4.948l1.337 1.308L5.57 15 3 12.485 5.57 10l.715.662L4.918 12H12.5a1.5 1.5 0 0 0 1.5-1.5V9h1zm-.002-4.977L12.426 8l-.715-.653L13.087 6H5.5A1.5 1.5 0 0 0 4 7.5V9H3V7.5A2.5 2.5 0 0 1 5.5 5h7.538L11.71 3.701l.715-.7z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="12" height="12" fill="currentColor" className={className}>
      <path d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z" />
    </svg>
  );
}

function ChevronUpIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="12" height="12" fill="currentColor" className={className}>
      <path d="M3.92 10.17 9 5.71l5.08 4.46-1 1.13L9 7.71 4.91 11.3l-.99-1.13Z" />
    </svg>
  );
}

function NullCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9" width="9" height="9" fill="none">
      <path
        fill="currentColor"
        d="M0.539939 8.83122L-6.05136e-05 8.29122L1.04394 7.24722C0.39594 6.47922 0.0119395 5.49522 0.0119395 4.41522C0.0119395 1.97922 1.97994 0.0112183 4.41594 0.0112183C5.49594 0.0112183 6.47994 0.395218 7.24794 1.04322L8.29194 -0.000781536L8.83194 0.539219L7.78794 1.58322C8.43594 2.35122 8.81994 3.33522 8.81994 4.41522C8.81994 6.85122 6.82794 8.81922 4.41594 8.81922C3.33594 8.81922 2.35194 8.43522 1.58394 7.78722L0.539939 8.83122ZM0.87594 4.41522C0.87594 5.25522 1.16394 6.02322 1.65594 6.63522L6.63594 1.65522C6.02394 1.16322 5.25594 0.875219 4.41594 0.875219C2.45994 0.875219 0.87594 2.45922 0.87594 4.41522ZM4.41594 7.95522C6.37194 7.95522 7.95594 6.37122 7.95594 4.41522C7.95594 3.57522 7.66794 2.80722 7.17594 2.19522L2.19594 7.17522C2.80794 7.66722 3.57594 7.95522 4.41594 7.95522Z"
      />
    </svg>
  );
}

function CloudPresetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="20" height="20">
      <path
        fill="currentColor"
        d="M8.4 10.68A7 7 0 0 1 22 12.65l.01.37.36.09A3.5 3.5 0 0 1 21.5 20H18v1h3.5a4.5 4.5 0 0 0 1.46-8.76A8 8 0 0 0 7.58 10 5.52 5.52 0 0 0 2 15.5 5.5 5.5 0 0 0 7.5 21H11v-1H7.5a4.5 4.5 0 1 1 .38-8.98l.38.03.13-.37Zm6.45 1.47-.35-.36-.35.36-3.5 3.5.7.7L14 13.71V24h1V13.71l2.65 2.64.7-.7-3.5-3.5Z"
      />
    </svg>
  );
}

function PushpinUndockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 28 28" fill="none">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 6h11v.5c0 1.115-.442 2.004-1.273 2.593-.7.498-1.637.755-2.727.814v2.267c2.867.677 5 3.252 5 6.326v.5h-6v4h-1v-4H8v-.5a6.502 6.502 0 0 1 5-6.326V9.907c-1.09-.059-2.027-.316-2.727-.814C9.443 8.503 9 7.615 9 6.5V6zm1.043 1c.102.56.383.976.809 1.278.57.405 1.452.642 2.648.642h.5V13.006l-.417.07A5.503 5.503 0 0 0 9.023 18h10.955a5.503 5.503 0 0 0-4.56-4.924l-.418-.07V8.92h.5c1.196 0 2.078-.237 2.648-.642A1.93 1.93 0 0 0 18.958 7h-8.915z"
      />
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="7.5" width="11" height="8" rx="1.5" />
      <path d="M6 7.5V5a3 3 0 0 1 6 0v2.5" />
    </svg>
  );
}

function TradingSettingsGearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="20" height="20" fill="currentColor">
      <path fillRule="evenodd" d="M18 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path fillRule="evenodd" d="M8.5 5h11l5 9-5 9h-11l-5-9 5-9Zm-3.86 9L9.1 6h9.82l4.45 8-4.45 8H9.1l-4.45-8Z" />
    </svg>
  );
}

function UfoEmptyStateSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="80" height="80" className="text-[#50535e] my-1">
      <path
        fill="currentColor"
        d="M60.05 8c7.12 0 13.17 3.59 15.7 8.68C86.02 19.32 93 24.48 93 30.4c0 4.73-4.45 8.96-11.47 11.82L115 112h-4.43L77.73 43.56A62 62 0 0 1 60 46a61 61 0 0 1-19.17-2.9L9.42 112H5l32.1-70.36C30.89 38.81 27 34.83 27 30.41c0-5.93 6.98-11.1 17.27-13.74C46.82 11.58 52.92 8 60.05 8m1.7 53.19A17.2 17.2 0 0 1 75.94 71.3L77 73.9l-1.3 1.8-16.3 22.56-17.4 3.67V84.99l16.17-22.17L59.5 61zM46 97l9-1.9-9-6.54zm15.4-31.83L47.28 84.55l11.18 8.13 14-19.33a13.2 13.2 0 0 0-11.05-8.18M43.03 21.18q-2.55.8-4.65 1.8C32.74 25.64 31 28.54 31 30.4c0 1.86 1.74 4.75 7.37 7.41C43.7 40.34 51.34 42 60 42s16.3-1.66 21.63-4.18c5.63-2.66 7.37-5.55 7.37-7.41s-1.74-4.77-7.38-7.43a36 36 0 0 0-4.65-1.8q.03.4.03.8l-.01.3C76.7 25.57 72.12 30 60.05 30 49.25 30 43.2 25.9 43 22.15v-.18q0-.4.03-.79M60 34a2 2 0 1 1 0 4 2 2 0 0 1 0-4m-22-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4m44 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4M60.05 12c-7.96 0-13 5.13-13.05 9.92 0-.05.16.83 2.29 1.95C51.46 25.04 55.04 26 60.05 26c5.78 0 9.24-1.1 11.1-2.21 1.67-1 1.83-1.8 1.85-1.85l-.01-.42c-.3-4.69-5.24-9.52-12.94-9.52"
      />
    </svg>
  );
}

// ============================================================================
// DROPDOWN POPOVER HELPERS
// ============================================================================

interface DropdownOption {
  label: string;
  value: string;
}

export interface OrderPreset {
  id: string;
  name: string;
  orderType: OrderType;
  qty: number;
  qtyMode: "units" | "risk_usd" | "risk_percent";
  tpEnabled: boolean;
  tpMode: "price" | "ticks" | "usd" | "percent";
  tpTicks: number;
  slEnabled: boolean;
  slMode: "price" | "ticks" | "usd" | "percent";
  slTicks: number;
}

const ORDER_PRESETS_STORAGE_KEY = "tradejournal_order_presets_v1";
const SL_RISK_STORAGE_KEY = "tradejournal_order_ticket_sl_risk_v1";

function DockDropdown({
  value,
  options,
  onChange,
  trigger,
  align = "left",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  trigger: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <div onClick={() => setOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>
      <FloatingPortalPopover
        anchorRef={containerRef}
        isOpen={open}
        onClose={() => setOpen(false)}
        align={align}
        preferredPlacement="bottom"
        offset={6}
        estimatedWidth={148}
        estimatedHeight={options.length * 32 + 12}
        className="min-w-[140px] rounded-[8px] bg-white dark:bg-[#1e1f24] border border-[#e0e3eb] dark:border-[#2a2b30] shadow-xl py-1 select-none font-sans"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors ${
              opt.value === value
                ? "bg-[#2962ff]/10 text-[#2962ff] font-semibold"
                : "text-[#0f0f0f] dark:text-[#f0f3fa] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <span>{opt.label}</span>
            {opt.value === value && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </button>
        ))}
      </FloatingPortalPopover>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT PROPS
// ============================================================================

export interface TradingDockProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "order" | "dom";
  initialSide?: OrderSide;
  initialType?: OrderType;
  initialPrice?: number;
  className?: string;
}

export function VelaTradingDock({
  symbol,
  isOpen,
  onClose,
  defaultTab = "order",
  initialSide = "buy",
  initialType = "limit",
  initialPrice,
  className = "",
}: TradingDockProps) {
  const {
    lastPrice,
    placeOrder,
    modifyOrder,
    updatePositionBrackets,
    workingOrders,
    position,
    flattenAll,
    reversePosition,
    cancelOrder,
  } = usePaperTrading(symbol);

  const spec = getPaperInstrumentSpec(symbol);
  const [activeTab, setActiveTab] = useState<"order" | "dom">(defaultTab);

  // Pre-Order Store Draft State
  const [draft, setDraft] = useState<PreOrderState>(preOrderStore.getState());
  const [isSideExplicitlySelected, setIsSideExplicitlySelected] = useState(false);
  const [exitsCollapsed, setExitsCollapsed] = useState(false);
  const [unitsMode, setUnitsMode] = useState<"units" | "risk_usd" | "risk_percent">("units");
  const [tpDisplayMode, setTpDisplayMode] = useState<"price" | "ticks" | "usd" | "percent">("price");
  const [slDisplayMode, setSlDisplayMode] = useState<"price" | "ticks" | "usd" | "percent">("price");
  const [centerOffset, setCenterOffset] = useState(0);
  const [domDetailsOpen, setDomDetailsOpen] = useState(false);
  const [domPlView, setDomPlView] = useState<"usd" | "ticks" | "percent">("usd");

  // Popover States & Persisted Presets / Settings
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slEnablesQtyRisk, setSlEnablesQtyRisk] = useState<boolean>(false);
  const [orderPresets, setOrderPresets] = useState<OrderPreset[]>([]);

  const presetsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedRisk = window.localStorage.getItem(SL_RISK_STORAGE_KEY);
      if (storedRisk !== null) {
        setSlEnablesQtyRisk(storedRisk === "true");
      }
      const storedPresets = window.localStorage.getItem(ORDER_PRESETS_STORAGE_KEY);
      if (storedPresets) {
        const parsed = JSON.parse(storedPresets);
        if (Array.isArray(parsed)) {
          setOrderPresets(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleToggleSlQtyRisk = (checked: boolean) => {
    setSlEnablesQtyRisk(checked);
    try {
      window.localStorage.setItem(SL_RISK_STORAGE_KEY, String(checked));
    } catch {
      // ignore storage errors
    }
  };

  const handleSaveOrderPreset = () => {
    const tpEnabled = draft.takeProfit.enabled;
    const slEnabled = draft.stopLoss.enabled;
    const bracketStr = `${tpEnabled ? "TP" : ""}${tpEnabled && slEnabled ? "/" : ""}${
      slEnabled ? "SL" : !tpEnabled ? "No Bracket" : ""
    }`;
    const newPreset: OrderPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${draft.type.toUpperCase()} ${draft.qty} (${bracketStr})`,
      orderType: draft.type,
      qty: draft.qty,
      qtyMode: unitsMode,
      tpEnabled,
      tpMode: tpDisplayMode,
      tpTicks: draft.takeProfit.ticks,
      slEnabled,
      slMode: slDisplayMode,
      slTicks: draft.stopLoss.ticks,
    };
    setOrderPresets((prev) => {
      const next = [...prev, newPreset];
      try {
        window.localStorage.setItem(ORDER_PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleApplyOrderPreset = (preset: OrderPreset) => {
    preOrderStore.setType(preset.orderType);
    preOrderStore.setQty(preset.qty);
    setUnitsMode(preset.qtyMode);
    preOrderStore.setTakeProfitEnabled(preset.tpEnabled);
    setTpDisplayMode(preset.tpMode);
    if (preset.tpEnabled && preset.tpTicks > 0) {
      preOrderStore.setTakeProfitTicks(preset.tpTicks);
    }
    preOrderStore.setStopLossEnabled(preset.slEnabled);
    setSlDisplayMode(preset.slMode);
    if (preset.slEnabled && preset.slTicks > 0) {
      preOrderStore.setStopLossTicks(preset.slTicks);
    }
    setPresetsOpen(false);
  };

  const handleDeleteOrderPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrderPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        window.localStorage.setItem(ORDER_PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Sync draft state from PreOrderStore
  useEffect(() => {
    return preOrderStore.subscribe((next) => {
      setDraft({ ...next });
      if (next.isOpen && next.mode === "create") {
        setIsSideExplicitlySelected(true);
      }
    });
  }, []);

  // Sync activeTab with defaultTab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Open preOrderStore when dock opens or active panel symbol changes
  const prevIsOpenRef = useRef(false);
  const prevSymbolRef = useRef(symbol);
  useEffect(() => {
    const symbolChanged = prevSymbolRef.current !== symbol;
    prevSymbolRef.current = symbol;

    if (isOpen && (!prevIsOpenRef.current || symbolChanged)) {
      const currentDraft = preOrderStore.getState();
      if (currentDraft.isOpen && currentDraft.symbol === symbol) {
        setDraft({ ...currentDraft });
        setIsSideExplicitlySelected(true);
      } else {
        preOrderStore.open(
          symbol,
          currentDraft.side || initialSide,
          currentDraft.type || initialType,
          initialPrice ?? (lastPrice && lastPrice > 0 ? lastPrice : 5000)
        );
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      preOrderStore.close();
      setIsSideExplicitlySelected(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, symbol, initialSide, initialType, initialPrice, lastPrice]);

  // Keyboard shortcut listener (Esc closes)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // In replay mode: BID = ASK = LAST PRICE (Spread = 0.00)
  const currentPrice = (lastPrice && lastPrice > 0) ? lastPrice : draft.price;
  const replayBid = currentPrice;
  const replayAsk = currentPrice;
  const replaySpread = "0.00";

  // Financial calculations
  const notionalValue = (draft.price > 0 ? draft.price : currentPrice) * draft.qty * spec.pointValue;

  // Calculate Risk / Reward
  let riskRewardRatio = "---";
  let rewardRatioNum = 0;
  if (
    draft.takeProfit.enabled &&
    draft.stopLoss.enabled &&
    draft.price > 0 &&
    draft.takeProfit.price > 0 &&
    draft.stopLoss.price > 0
  ) {
    const profitDistance = Math.abs(draft.takeProfit.price - draft.price);
    const riskDistance = Math.abs(draft.stopLoss.price - draft.price);
    if (riskDistance > 0) {
      rewardRatioNum = profitDistance / riskDistance;
      riskRewardRatio = rewardRatioNum.toFixed(2);
    }
  }

  // Position editing metrics
  let positionRiskReward = "---";
  if (
    position &&
    draft.takeProfit.enabled &&
    draft.stopLoss.enabled &&
    position.avgPrice > 0 &&
    draft.takeProfit.price > 0 &&
    draft.stopLoss.price > 0
  ) {
    const pDist = Math.abs(draft.takeProfit.price - position.avgPrice);
    const rDist = Math.abs(draft.stopLoss.price - position.avgPrice);
    if (rDist > 0) {
      positionRiskReward = (pDist / rDist).toFixed(2);
    }
  }
  const positionTradeValue = position ? position.avgPrice * position.qty * spec.pointValue : notionalValue;

  // Submit Order Handlers
  const handleSubmitOrder = () => {
    if (!isSideExplicitlySelected && draft.type === "limit") {
      setIsSideExplicitlySelected(true);
      return;
    }

    const execPrice =
      draft.type === "market"
        ? currentPrice
        : draft.type === "stop"
        ? draft.stopPrice
        : draft.price;

    const stopTriggerPrice =
      draft.type === "stop" || draft.type === "stop_limit"
        ? draft.stopPrice
        : undefined;

    placeOrder({
      symbol,
      side: draft.side,
      type: draft.type,
      qty: Math.max(1, draft.qty),
      price: execPrice,
      stopPrice: stopTriggerPrice,
      takeProfit:
        draft.takeProfit.enabled && draft.takeProfit.price > 0
          ? draft.takeProfit.price
          : undefined,
      stopLoss:
        draft.stopLoss.enabled && draft.stopLoss.price > 0
          ? draft.stopLoss.price
          : undefined,
    });
    onClose();
  };

  // Modify Order Confirm
  const handleConfirmModifyOrder = () => {
    if (!draft.editOrderId) return;
    modifyOrder(draft.editOrderId, {
      price: draft.price,
      stopPrice: draft.stopPrice,
      qty: draft.qty,
      takeProfit: draft.takeProfit.enabled ? draft.takeProfit.price : undefined,
      stopLoss: draft.stopLoss.enabled ? draft.stopLoss.price : undefined,
    });
    preOrderStore.discardEdit();
  };

  // Edit Position Confirm
  const handleConfirmEditPosition = () => {
    updatePositionBrackets(
      symbol,
      draft.takeProfit.enabled ? draft.takeProfit.price : undefined,
      draft.stopLoss.enabled ? draft.stopLoss.price : undefined
    );
    preOrderStore.discardEdit();
  };

  // DOM Working orders count
  const workingBuyCount = workingOrders.filter((o) => o.side === "buy").length;
  const workingSellCount = workingOrders.filter((o) => o.side === "sell").length;

  // DOM 25-step ladder centered around current price
  const ladderSteps = (() => {
    if (currentPrice <= 0) return [];
    const basePrice = roundToTick(symbol, currentPrice + centerOffset * spec.tickSize);
    const steps: number[] = [];
    for (let i = 12; i >= -12; i--) {
      steps.push(roundToTick(symbol, basePrice + i * spec.tickSize));
    }
    return steps;
  })();

  const handleDomCellClick = (price: number, column: "bid" | "ask") => {
    if (column === "bid") {
      const type = price < currentPrice ? "limit" : "stop";
      placeOrder({
        symbol,
        side: "buy",
        type,
        qty: draft.qty,
        price,
        stopPrice: type === "stop" ? price : undefined,
      });
    } else {
      const type = price > currentPrice ? "limit" : "stop";
      placeOrder({
        symbol,
        side: "sell",
        type,
        qty: draft.qty,
        price,
        stopPrice: type === "stop" ? price : undefined,
      });
    }
  };

  // Dynamic multiline CTA content
  const renderCtaContent = () => {
    if (!isSideExplicitlySelected && draft.type === "limit") {
      return (
        <span className="text-[15px] font-bold tracking-tight text-[#0f0f0f] dark:text-white">
          Start creating order
        </span>
      );
    }

    const sideWord = draft.side === "buy" ? "Buy" : "Sell";
    let desc = "";
    let subDesc = "";

    if (draft.type === "market") {
      desc = `${draft.qty} ${symbol} MARKET`;
    } else if (draft.type === "limit") {
      desc = `${draft.qty} ${symbol} @ ${formatPrice(symbol, draft.price)} LIMIT`;
    } else if (draft.type === "stop") {
      desc = `${draft.qty} ${symbol} @ ${formatPrice(symbol, draft.stopPrice || draft.price)} STOP`;
    } else if (draft.type === "stop_limit") {
      desc = `${draft.qty} ${symbol} @ ${formatPrice(symbol, draft.stopPrice)} STOP`;
      subDesc = `${formatPrice(symbol, draft.price)} LIMIT`;
    }

    return (
      <div className="flex flex-col items-center justify-center leading-tight">
        <span className="text-[17px] font-bold tracking-tight">{sideWord}</span>
        <span className="text-[12px] font-mono font-medium opacity-95">{desc}</span>
        {subDesc && <span className="text-[11px] font-mono font-medium opacity-90">{subDesc}</span>}
      </div>
    );
  };

  // Helper calculation for Price Offset Label and Text
  const getPriceEquivalentText = () => {
    if (draft.priceIsOffset) {
      return formatPrice(symbol, draft.price);
    }
    if (draft.type === "stop_limit") {
      const diffTicks = Math.round((draft.price - draft.stopPrice) / spec.tickSize);
      if (diffTicks === 0) return "Stop";
      return diffTicks > 0 ? `Stop + ${diffTicks}` : `Stop − ${Math.abs(diffTicks)}`;
    }
    const diffTicks = Math.round((draft.price - currentPrice) / spec.tickSize);
    if (diffTicks === 0) return draft.side === "buy" ? "Ask" : "Bid";
    return diffTicks > 0
      ? `${draft.side === "buy" ? "Ask" : "Bid"} + ${diffTicks}`
      : `${draft.side === "buy" ? "Ask" : "Bid"} − ${Math.abs(diffTicks)}`;
  };

  const getStopPriceEquivalentText = () => {
    if (draft.stopPriceIsOffset) {
      return formatPrice(symbol, draft.stopPrice);
    }
    const diffTicks = Math.round((draft.stopPrice - currentPrice) / spec.tickSize);
    if (diffTicks === 0) return draft.side === "buy" ? "Ask" : "Bid";
    return diffTicks > 0
      ? `${draft.side === "buy" ? "Ask" : "Bid"} + ${diffTicks}`
      : `${draft.side === "buy" ? "Ask" : "Bid"} − ${Math.abs(diffTicks)}`;
  };

  const isEditing = draft.mode === "modify_order" || draft.mode === "edit_position";

  return (
    <aside
      className={`vela-trading-dock layout__area--tradingpanel relative flex flex-col self-stretch shrink-0 w-[315px] bg-[#151619] text-[#f0f3fa] border-l border-[#2a2b30] z-20 select-none overflow-hidden font-sans ${className}`}
      data-testid="unified-trading-dock-panel"
      aria-label="Trading panel"
    >
      {/* =====================================================================
          1. HEADER (TradingView 1:1, Height 48px — trading-panel-header-wspftEtf)
         ===================================================================== */}
      <div className="trading-panel-header-wspftEtf flex flex-col border-b border-[#2a2b30] shrink-0 bg-[#151619]">
        <div className="flex items-center justify-between h-[48px] px-3.5">
          {/* Left: Back button (if modify_order) + Broker Logo + Symbol Title */}
          <div className="flex items-center gap-2 overflow-hidden">
            {draft.mode === "modify_order" && (
              <button
                type="button"
                data-qa-id="modify-order-back-button"
                data-name="button-back"
                onClick={() => preOrderStore.discardEdit()}
                className="w-7 h-7 -ml-1 flex items-center justify-center rounded text-[#9a9ea8] hover:text-white hover:bg-white/5 transition-colors"
                title="Discard & Go Back"
              >
                <ArrowBackIcon />
              </button>
            )}

            <ReplayBrokerLogo />

            <div className="flex flex-col truncate">
              <span className="title-eXazYeWn font-bold text-white text-[15px] tracking-tight truncate">
                {draft.mode === "modify_order"
                  ? `${symbol}, order ${draft.editOrderId}`
                  : symbol}
              </span>
            </div>
          </div>

          {/* Right: Presets (⊞) + Settings (···) + Close (✕) */}
          <div className="flex items-center gap-1 text-[#9a9ea8]">
            {!isEditing && activeTab === "order" && (
              <div ref={presetsRef} className="relative">
                <button
                  type="button"
                  data-qa-id="header-order-presets-menu-button"
                  title="Order presets"
                  onClick={() => {
                    setPresetsOpen(!presetsOpen);
                    setSettingsOpen(false);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#9a9ea8] hover:text-white hover:bg-white/5 transition-colors"
                >
                  <GridPlusIcon />
                </button>

                {/* Popover 252px (Portaled via FloatingPortalPopover z-[70]) */}
                <FloatingPortalPopover
                  anchorRef={presetsRef}
                  isOpen={presetsOpen}
                  onClose={() => setPresetsOpen(false)}
                  align="right"
                  preferredPlacement="bottom"
                  offset={6}
                  estimatedWidth={252}
                  estimatedHeight={200}
                  dataQaId="order-presets-popover"
                  className="w-[252px] rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl p-2 text-[12px] select-none font-sans"
                >
                  <button
                    type="button"
                    data-qa-id="save-order-preset-btn"
                    onClick={handleSaveOrderPreset}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/5 text-[#f0f3fa] transition-colors"
                  >
                    <CloudPresetIcon />
                    <span>Save order preset...</span>
                  </button>
                  <div className="my-1.5 border-t border-[#2a2b30]" />
                  {orderPresets.length > 0 ? (
                    <div className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
                      {orderPresets.map((preset) => (
                        <div
                          key={preset.id}
                          data-qa-id={`order-preset-item-${preset.id}`}
                          onClick={() => handleApplyOrderPreset(preset)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/5 text-[#f0f3fa] cursor-pointer transition-colors group"
                        >
                          <span className="truncate font-mono text-[11px]">{preset.name}</span>
                          <button
                            type="button"
                            data-qa-id={`delete-order-preset-${preset.id}`}
                            title="Delete preset"
                            onClick={(e) => handleDeleteOrderPreset(preset.id, e)}
                            className="ml-2 w-5 h-5 rounded flex items-center justify-center text-[#9a9ea8] hover:text-[#f23645] hover:bg-white/10 transition-colors shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2 text-center text-[#9a9ea8]">
                      <UfoEmptyStateSvg />
                      <span className="text-[12px] font-medium mt-1">No order presets created yet</span>
                    </div>
                  )}
                </FloatingPortalPopover>
              </div>
            )}

            {/* Settings Button */}
            <div ref={settingsRef} className="relative">
              <button
                type="button"
                data-qa-id="header-settings"
                title="Trading settings"
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setPresetsOpen(false);
                }}
                className="w-7 h-7 flex items-center justify-center rounded text-[#9a9ea8] hover:text-white hover:bg-white/5 transition-colors"
              >
                <ThreeDotsIcon />
              </button>

              {/* Popover 220px (Portaled via FloatingPortalPopover z-[70]) */}
              <FloatingPortalPopover
                anchorRef={settingsRef}
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                align="right"
                preferredPlacement="bottom"
                offset={6}
                estimatedWidth={220}
                estimatedHeight={136}
                dataQaId="order-settings-popover"
                className="w-[220px] rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] shadow-2xl p-2 text-[12px] select-none font-sans"
              >
                <button
                  type="button"
                  data-qa-id="dock-undock-order-panel-button"
                  onClick={() => setSettingsOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/5 text-[#f0f3fa] transition-colors"
                >
                  <PushpinUndockIcon />
                  <span>Undock order ticket</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/5 text-[#f0f3fa] transition-colors"
                >
                  <TradingSettingsGearIcon />
                  <span>Trading settings…</span>
                </button>
                <div className="my-1.5 border-t border-[#2a2b30]" />
                <label
                  data-qa-id="order-ticket-sl-qty-in-risk"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/5 text-[#f0f3fa] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={slEnablesQtyRisk}
                    onChange={(e) => handleToggleSlQtyRisk(e.target.checked)}
                    className="rounded border-[#2a2b30] bg-[#151619] text-[#2962ff] focus:ring-0"
                  />
                  <span className="text-[11px] leading-tight">SL enables quantity in risk</span>
                </label>
              </FloatingPortalPopover>
            </div>

            {/* Close Button 28x28 stroke 1.2px */}
            <button
              type="button"
              onClick={onClose}
              data-qa-id="button-close"
              aria-label="Close button"
              title="Close trading panel (Esc)"
              className="w-7 h-7 flex items-center justify-center rounded text-[#9a9ea8] hover:text-white hover:bg-white/5 transition-colors ml-0.5"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Subtitle Description line for Modify Order & Edit Position */}
        {isEditing && (
          <div className="description-eXazYeWn text-[13px] text-[#9a9ea8] px-3.5 pb-2 -mt-1 font-medium truncate">
            {draft.mode === "modify_order"
              ? draft.editOrderDescription
              : draft.editPositionDescription}
          </div>
        )}
      </div>

      {/* =====================================================================
          2. SEGMENTED CONTROL: [ Order | DOM ] (Hidden in Edit Modes)
         ===================================================================== */}
      {!isEditing && (
        <div className="px-4 py-2 shrink-0 border-b border-[#2a2b30] bg-[#151619]">
          <div
            className="flex p-[3px] rounded-[8px] bg-[#1e1f24] border border-[#2a2b30]"
            role="radiogroup"
            aria-orientation="horizontal"
          >
            <button
              type="button"
              role="radio"
              aria-checked={activeTab === "order"}
              onClick={() => setActiveTab("order")}
              className={`flex-1 h-[28px] rounded-[5px] text-[13px] font-medium flex items-center justify-center transition-all ${
                activeTab === "order"
                  ? "bg-[#2a2b30] text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  : "text-[#9a9ea8] hover:text-white"
              }`}
            >
              Order
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={activeTab === "dom"}
              onClick={() => setActiveTab("dom")}
              className={`flex-1 h-[28px] rounded-[5px] text-[13px] font-medium flex items-center justify-center transition-all ${
                activeTab === "dom"
                  ? "bg-[#2a2b30] text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  : "text-[#9a9ea8] hover:text-white"
              }`}
            >
              DOM
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. MAIN CONTENT: ORDER TICKET / MODIFY ORDER / EDIT POSITION
         ===================================================================== */}
      {(activeTab === "order" || isEditing) && (
        <div
          data-name={draft.mode === "edit_position" ? "position-panel" : "order-panel"}
          className="flex-1 flex flex-col justify-between overflow-y-auto bg-[#151619]"
        >
          <div className="p-4 space-y-3.5">
            {/* BUY / SELL SPLIT (Hidden in Modify Order & Edit Position) */}
            {!isEditing && (
              <div className="side-u3DtG1BP relative flex rounded-[8px] overflow-hidden p-0.5 bg-[#1e1f24] border border-[#2a2b30]">
                {/* SELL BUTTON */}
                <div
                  role="button"
                  tabIndex={0}
                  data-name="side-control-sell"
                  onClick={() => {
                    preOrderStore.setSide("sell");
                    setIsSideExplicitlySelected(true);
                  }}
                  className={`flex-1 py-1.5 px-3 flex flex-col items-center justify-center rounded-[6px] cursor-pointer transition-all ${
                    isSideExplicitlySelected && draft.side === "sell"
                      ? "bg-[#f23645] text-white font-bold shadow-sm"
                      : "text-[#9a9ea8] hover:text-white"
                  }`}
                >
                  <span className="text-[11px] uppercase font-semibold tracking-wider">Sell</span>
                  <span className="text-[13px] font-mono font-bold">{formatPrice(symbol, replayBid)}</span>
                </div>

                {/* SPREAD CHIP: 0.00 in Replay Mode */}
                <div
                  data-name="side-control-spread"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-[4px] bg-[#151619] text-[10px] font-mono font-semibold text-[#9a9ea8] border border-[#2a2b30] shadow-sm z-10"
                  title="Spread (0.00 in replay)"
                >
                  {replaySpread}
                </div>

                {/* BUY BUTTON */}
                <div
                  role="button"
                  tabIndex={0}
                  data-name="side-control-buy"
                  onClick={() => {
                    preOrderStore.setSide("buy");
                    setIsSideExplicitlySelected(true);
                  }}
                  className={`flex-1 py-1.5 px-3 flex flex-col items-center justify-center rounded-[6px] cursor-pointer transition-all ${
                    isSideExplicitlySelected && draft.side === "buy"
                      ? "bg-[#2962ff] text-white font-bold shadow-sm"
                      : "text-[#9a9ea8] hover:text-white"
                  }`}
                >
                  <span className="text-[11px] uppercase font-semibold tracking-wider">Buy</span>
                  <span className="text-[13px] font-mono font-bold">{formatPrice(symbol, replayAsk)}</span>
                </div>
              </div>
            )}

            {/* ORDER TYPE TABS (Hidden in Modify Order & Edit Position) */}
            {!isEditing && (
              <div id="order-type-tabs" className="flex border-b border-[#2a2b30] text-xs">
                {(["market", "limit", "stop", "stop_limit"] as OrderType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (
                        currentPrice > 0 &&
                        (draft.type === "market" || t === "market" || draft.price <= 0)
                      ) {
                        preOrderStore.setPrice(currentPrice, "ticket");
                        if (!draft.stopPrice || draft.stopPrice <= 0 || draft.type === "market") {
                          preOrderStore.setStopPrice(currentPrice, "ticket");
                        }
                      }
                      preOrderStore.setType(t);
                      if (t === "market") {
                        setIsSideExplicitlySelected(true);
                      }
                    }}
                    className={`flex-1 pb-2 text-center transition-colors relative ${
                      draft.type === t
                        ? "text-[#f0f3fa] font-semibold"
                        : "text-[#9a9ea8] hover:text-[#f0f3fa]"
                    }`}
                  >
                    {t === "stop_limit" ? "Stop Limit" : t.charAt(0).toUpperCase() + t.slice(1)}
                    {draft.type === t && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2962ff] rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ===============================================================
                FIELDS: Only for Create or Modify Order modes (NOT for edit_position)
               =============================================================== */}
            {draft.mode !== "edit_position" && (
              <>
                {/* STOP PRICE (For Stop and Stop Limit) */}
                {(draft.type === "stop" || draft.type === "stop_limit") && (
                  <div className="controlContainer-xBCAz8DE space-y-1">
                    <span
                      data-qa-id={draft.stopPriceIsOffset ? "relative-price-label-text" : "absolute-price-label-text"}
                      className="text-[13px] text-[#9a9ea8]"
                    >
                      {draft.stopPriceIsOffset ? "Stop price offset" : "Stop price"}
                    </span>
                    <div className="flex items-center h-[34px] bg-[#1e1f24] border border-[#2a2b30] rounded-[8px] focus-within:border-[#2962ff] transition-colors px-2">
                      <input
                        type="number"
                        step={spec.tickSize}
                        value={draft.stopPrice}
                        data-qa-id={
                          draft.stopPriceIsOffset
                            ? "ui-lib-Input-input order-ticket-relative-price-input"
                            : "ui-lib-Input-input order-ticket-absolute-price-input"
                        }
                        onChange={(e) => preOrderStore.setStopPrice(parseFloat(e.target.value) || 0, "ticket")}
                        className="w-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 shrink-0 text-[#9a9ea8]">
                        <button
                          type="button"
                          data-qa-id="price-input-swap-button"
                          onClick={() => preOrderStore.toggleStopPriceOffset()}
                          title="Swap between absolute price and offset"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <SwapArrowsIcon />
                        </button>
                        <button
                          type="button"
                          data-qa-id="price-input-equivalent-text"
                          onClick={() => preOrderStore.setStopPrice(currentPrice, "ticket")}
                          className="text-[11px] font-medium hover:text-[#2962ff] transition-colors"
                        >
                          {getStopPriceEquivalentText()}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* LIMIT PRICE (For Limit and Stop Limit, and Modify Order) */}
                {(draft.type === "limit" || draft.type === "stop_limit") && (
                  <div className="controlContainer-xBCAz8DE space-y-1">
                    <span
                      data-qa-id={draft.priceIsOffset ? "relative-price-label-text" : "absolute-price-label-text"}
                      className="text-[13px] text-[#9a9ea8]"
                    >
                      {draft.priceIsOffset
                        ? (draft.type === "stop_limit" ? "Limit price offset" : "Price offset")
                        : (draft.type === "stop_limit" ? "Limit price" : "Price")}
                    </span>
                    <div className="flex items-center h-[34px] bg-[#1e1f24] border border-[#2a2b30] rounded-[8px] focus-within:border-[#2962ff] transition-colors px-2">
                      <input
                        type="number"
                        step={spec.tickSize}
                        value={draft.price}
                        data-qa-id={
                          draft.priceIsOffset
                            ? "ui-lib-Input-input order-ticket-relative-price-input"
                            : "ui-lib-Input-input order-ticket-absolute-price-input"
                        }
                        onChange={(e) => preOrderStore.setPrice(parseFloat(e.target.value) || 0, "ticket")}
                        className="w-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 shrink-0 text-[#9a9ea8]">
                        <button
                          type="button"
                          data-qa-id="price-input-swap-button"
                          onClick={() => preOrderStore.togglePriceOffset()}
                          title="Swap between absolute price and offset"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <SwapArrowsIcon />
                        </button>
                        <button
                          type="button"
                          data-qa-id="price-input-equivalent-text"
                          onClick={() => {
                            if (draft.type === "stop_limit") {
                              preOrderStore.setPrice(draft.stopPrice + spec.tickSize, "ticket");
                            } else {
                              preOrderStore.setPrice(currentPrice, "ticket");
                            }
                          }}
                          className="text-[11px] font-medium hover:text-[#2962ff] transition-colors"
                        >
                          {getPriceEquivalentText()}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* QUANTITY / UNITS SECTION */}
                <div className="quantityWrapper-u3DtG1BP space-y-1">
                  <div className="flex items-center justify-between text-[13px] text-[#9a9ea8]">
                    <DockDropdown
                      value={unitsMode}
                      onChange={(val) => setUnitsMode(val as "units" | "risk_usd" | "risk_percent")}
                      options={[
                        { label: "Units", value: "units" },
                        { label: "USD risk", value: "risk_usd" },
                        { label: "Risk % balance", value: "risk_percent" },
                      ]}
                      trigger={
                        <div
                          data-qa-id="quantity-dropdown-types"
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          <span>{unitsMode === "risk_usd" ? "USD risk" : unitsMode === "risk_percent" ? "Risk % balance" : "Units"}</span>
                          <ChevronDownIcon />
                        </div>
                      }
                    />
                    <span className="text-[11px] font-mono text-[#9a9ea8]">
                      Val: ${notionalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center h-[34px] bg-[#1e1f24] border border-[#2a2b30] rounded-[8px] focus-within:border-[#2962ff] transition-colors px-2">
                    <input
                      type="number"
                      min={unitsMode === "risk_percent" ? 0.1 : 1}
                      step={unitsMode === "risk_percent" ? 0.1 : 1}
                      data-qa-id="ui-lib-Input-input units-quantity-field-input"
                      value={
                        unitsMode === "risk_usd"
                          ? (draft.riskUsdValue ?? (draft.stopLoss.usd > 0 ? draft.stopLoss.usd : 50))
                          : unitsMode === "risk_percent"
                          ? (draft.riskPercentValue ?? 1)
                          : draft.qty
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (unitsMode === "risk_usd") {
                          preOrderStore.setRiskUsd(val || 50);
                        } else if (unitsMode === "risk_percent") {
                          preOrderStore.setRiskPercent(val || 1);
                        } else {
                          preOrderStore.setQty(Math.round(val) || 1);
                        }
                      }}
                      className="w-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none"
                    />

                    {/* Swap Units <-> Risk and Dropdown Equivalent */}
                    <div className="flex items-center gap-1.5 shrink-0 text-[#9a9ea8]">
                      <button
                        type="button"
                        data-qa-id="quantity-input-swap-button"
                        onClick={() => {
                          setUnitsMode((m) => (m === "units" ? "risk_usd" : "units"));
                        }}
                        title="Swap calculation between units and risk"
                        className="p-1 hover:text-white transition-colors"
                      >
                        <SwapArrowsIcon />
                      </button>

                      <DockDropdown
                        value={unitsMode}
                        align="right"
                        onChange={(val) => {
                          setUnitsMode(val as "units" | "risk_usd" | "risk_percent");
                          if (!draft.stopLoss.enabled) {
                            preOrderStore.setStopLossEnabled(true);
                          }
                        }}
                        options={[
                          { label: "USD risk", value: "risk_usd" },
                          { label: "Risk % balance", value: "risk_percent" },
                        ]}
                        trigger={
                          <div
                            data-qa-id="quantity-input-equivalent-dropdown-button"
                            className="flex items-center gap-1 text-[11px] font-medium hover:text-white transition-colors"
                          >
                            {!draft.stopLoss.enabled ? (
                              <>
                                <span className="emptyValueIcon-lPMYnrTk">
                                  <NullCircleIcon />
                                </span>
                                <span>USD risk</span>
                              </>
                            ) : (
                              <span>
                                {unitsMode === "risk_percent"
                                  ? `${draft.stopLoss.percent?.toFixed(2) ?? "0.08"} % balance`
                                  : `${draft.stopLoss.usd.toFixed(2)} USD risk`}
                              </span>
                            )}
                            <ChevronDownIcon />
                          </div>
                        }
                      />
                    </div>
                  </div>

                  {/* Tick Value Info Row */}
                  <div
                    data-qa-id="order-ticket-quantity-info-pip-value"
                    className="flex items-center justify-between text-[12px] text-[#9a9ea8] pt-0.5"
                  >
                    <span>Tick value</span>
                    <span className="font-mono text-white font-medium">
                      {spec.tickValue} <span className="text-[10px] text-[#9a9ea8]">USD</span>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ===============================================================
                EXITS ACCORDION (TAKE PROFIT & STOP LOSS)
               =============================================================== */}
            <div className="brackets-wrapper-u3DtG1BP pt-1">
              <button
                type="button"
                data-qa-id="hide-brackets-button"
                aria-expanded={!exitsCollapsed}
                onClick={() => setExitsCollapsed(!exitsCollapsed)}
                className="w-full flex items-center justify-between py-1 text-[13px] font-bold text-white hover:opacity-80 transition-opacity"
              >
                <span>Exits</span>
                {exitsCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </button>

              {!exitsCollapsed && (
                <div className="bracketControlGroup-GtfnT17n space-y-3 pt-1">
                  {/* TAKE PROFIT ROW */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <DockDropdown
                        value={tpDisplayMode}
                        onChange={(val) => setTpDisplayMode(val as "price" | "ticks" | "usd" | "percent")}
                        options={[
                          { label: "Take profit price", value: "price" },
                          { label: "Ticks", value: "ticks" },
                          { label: "% price", value: "percent" },
                          { label: "Reward USD", value: "usd" },
                        ]}
                        trigger={
                          <div
                            data-qa-id="order-ticket-take-profit-dropdown-button"
                            className="flex items-center gap-1 text-[12px] text-[#9a9ea8] hover:text-white transition-colors"
                          >
                            <span>
                              {tpDisplayMode === "price"
                                ? "Take profit price"
                                : tpDisplayMode === "ticks"
                                ? "Take profit (ticks)"
                                : tpDisplayMode === "usd"
                                ? "Reward USD"
                                : "Take profit (% price)"}
                            </span>
                            <ChevronDownIcon />
                          </div>
                        }
                      />

                      {/* iOS Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.takeProfit.enabled}
                        data-qa-id="order-ticket-take-profit-checkbox-bracket"
                        onClick={() => preOrderStore.setTakeProfitEnabled(!draft.takeProfit.enabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                          draft.takeProfit.enabled ? "bg-[#2962ff]" : "bg-[#2a2b30]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            draft.takeProfit.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div
                      className={`flex items-center h-[34px] rounded-[8px] border transition-colors px-2 ${
                        draft.takeProfit.enabled
                          ? "bg-[#1e1f24] border-[#2a2b30] text-white"
                          : "bg-[#1a1b1e] border-transparent text-[#555555] opacity-60 pointer-events-none"
                      }`}
                    >
                      <input
                        type="number"
                        step={tpDisplayMode === "price" ? spec.tickSize : tpDisplayMode === "percent" ? 0.1 : 1}
                        disabled={!draft.takeProfit.enabled}
                        data-qa-id="ui-lib-Input-input order-ticket-take-profit-input"
                        value={
                          tpDisplayMode === "ticks"
                            ? draft.takeProfit.ticks
                            : tpDisplayMode === "usd"
                            ? Math.round(draft.takeProfit.usd)
                            : tpDisplayMode === "percent"
                            ? (draft.takeProfit.percent || 0)
                            : draft.takeProfit.price
                        }
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (tpDisplayMode === "ticks") {
                            preOrderStore.setTakeProfitTicks(val);
                          } else if (tpDisplayMode === "usd") {
                            preOrderStore.setTakeProfitUsd(val);
                          } else if (tpDisplayMode === "percent") {
                            preOrderStore.setTakeProfitPercent(val);
                          } else {
                            preOrderStore.setTakeProfitPrice(val, "ticket");
                          }
                        }}
                        className="w-full bg-transparent text-xs font-mono font-semibold focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 shrink-0 text-[#9a9ea8]">
                        <button
                          type="button"
                          data-qa-id="bracket-input-input-swap-button"
                          onClick={() => {
                            setTpDisplayMode((m) => (m === "price" ? "ticks" : "price"));
                          }}
                          title="Swap TP mode"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <SwapArrowsIcon />
                        </button>
                        <DockDropdown
                          value={tpDisplayMode}
                          align="right"
                          onChange={(val) => setTpDisplayMode(val as "price" | "ticks" | "usd" | "percent")}
                          options={[
                            { label: "Ticks", value: "ticks" },
                            { label: "Reward USD", value: "usd" },
                            { label: "Price", value: "price" },
                            { label: "% price", value: "percent" },
                          ]}
                          trigger={
                            <div
                              data-qa-id="bracket-input-equivalent-dropdown-button"
                              className="flex items-center gap-1 text-[11px] font-medium hover:text-white transition-colors"
                            >
                              <span>
                                {tpDisplayMode === "price"
                                  ? `${draft.takeProfit.ticks} ticks`
                                  : tpDisplayMode === "percent"
                                  ? `${draft.takeProfit.ticks} ticks`
                                  : `@ ${formatPrice(symbol, draft.takeProfit.price)}`}
                              </span>
                              <ChevronDownIcon />
                            </div>
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* STOP LOSS ROW */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <DockDropdown
                        value={slDisplayMode}
                        onChange={(val) => setSlDisplayMode(val as "price" | "ticks" | "usd" | "percent")}
                        options={[
                          { label: "Stop loss price", value: "price" },
                          { label: "Ticks", value: "ticks" },
                          { label: "% price", value: "percent" },
                          { label: "Risk USD", value: "usd" },
                        ]}
                        trigger={
                          <div
                            data-qa-id="order-ticket-stop-loss-dropdown-button"
                            className="flex items-center gap-1 text-[12px] text-[#9a9ea8] hover:text-white transition-colors"
                          >
                            <span>
                              {slDisplayMode === "price"
                                ? "Stop loss price"
                                : slDisplayMode === "ticks"
                                ? "Stop loss (ticks)"
                                : slDisplayMode === "usd"
                                ? "Risk USD"
                                : "Stop loss (% price)"}
                            </span>
                            <ChevronDownIcon />
                          </div>
                        }
                      />

                      {/* iOS Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.stopLoss.enabled}
                        data-qa-id="order-ticket-stop-loss-checkbox-bracket"
                        onClick={() => preOrderStore.setStopLossEnabled(!draft.stopLoss.enabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                          draft.stopLoss.enabled ? "bg-[#2962ff]" : "bg-[#2a2b30]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            draft.stopLoss.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div
                      className={`flex items-center h-[34px] rounded-[8px] border transition-colors px-2 ${
                        draft.stopLoss.enabled
                          ? "bg-[#1e1f24] border-[#2a2b30] text-white"
                          : "bg-[#1a1b1e] border-transparent text-[#555555] opacity-60 pointer-events-none"
                      }`}
                    >
                      <input
                        type="number"
                        step={slDisplayMode === "price" ? spec.tickSize : slDisplayMode === "percent" ? 0.1 : 1}
                        disabled={!draft.stopLoss.enabled}
                        data-qa-id="ui-lib-Input-input order-ticket-stop-loss-input"
                        value={
                          slDisplayMode === "ticks"
                            ? draft.stopLoss.ticks
                            : slDisplayMode === "usd"
                            ? Math.round(draft.stopLoss.usd)
                            : slDisplayMode === "percent"
                            ? (draft.stopLoss.percent || 0)
                            : draft.stopLoss.price
                        }
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (slDisplayMode === "ticks") {
                            preOrderStore.setStopLossTicks(val);
                          } else if (slDisplayMode === "usd") {
                            preOrderStore.setStopLossUsd(val);
                          } else if (slDisplayMode === "percent") {
                            preOrderStore.setStopLossPercent(val);
                          } else {
                            preOrderStore.setStopLossPrice(val, "ticket");
                          }
                        }}
                        className="w-full bg-transparent text-xs font-mono font-semibold focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5 shrink-0 text-[#9a9ea8]">
                        <button
                          type="button"
                          data-qa-id="bracket-input-input-swap-button"
                          onClick={() => {
                            setSlDisplayMode((m) => (m === "price" ? "ticks" : "price"));
                          }}
                          title="Swap SL mode"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <SwapArrowsIcon />
                        </button>
                        <DockDropdown
                          value={slDisplayMode}
                          align="right"
                          onChange={(val) => setSlDisplayMode(val as "price" | "ticks" | "usd" | "percent")}
                          options={[
                            { label: "Ticks", value: "ticks" },
                            { label: "Risk USD", value: "usd" },
                            { label: "Price", value: "price" },
                            { label: "% price", value: "percent" },
                          ]}
                          trigger={
                            <div
                              data-qa-id="bracket-input-equivalent-dropdown-button"
                              className="flex items-center gap-1 text-[11px] font-medium hover:text-white transition-colors"
                            >
                              <span>
                                {slDisplayMode === "price"
                                  ? `${draft.stopLoss.ticks} ticks`
                                  : slDisplayMode === "percent"
                                  ? `${draft.stopLoss.ticks} ticks`
                                  : `@ ${formatPrice(symbol, draft.stopLoss.price)}`}
                              </span>
                              <ChevronDownIcon />
                            </div>
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean 1:1 Risk / Reward Badge */}
                  {draft.takeProfit.enabled && draft.stopLoss.enabled && (
                    <div
                      data-qa-id="order-ticket-brackets-info"
                      className="infoBlock-lBT_g5ou py-1.5 px-3 rounded-[6px] bg-[#1e1f24] border border-[#2a2b30] mt-2"
                    >
                      <div data-qa-id="risk-reward-value" className="flex items-center justify-between text-xs text-[#9a9ea8]">
                        <span>Risk / Reward</span>
                        <span className="font-semibold text-white font-mono">{riskRewardRatio}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===============================================================
                EDIT POSITION METRICS (Only in edit_position mode)
               =============================================================== */}
            {draft.mode === "edit_position" && (
              <div
                data-qa-id="position-info"
                className="infoBlock-lBT_g5ou withBackground-lBT_g5ou p-3 rounded-[8px] bg-[#1e1f24] border border-[#2a2b30] space-y-2 text-xs"
              >
                <div data-qa-id="position-info-risk-reward" className="flex items-center justify-between text-[#9a9ea8]">
                  <span>Risk / Reward</span>
                  <span className="font-mono text-white font-medium">{positionRiskReward}</span>
                </div>
                <div data-qa-id="position-info-trade-value" className="flex items-center justify-between text-[#9a9ea8]">
                  <span>Trade value</span>
                  <span className="font-mono text-white font-medium">
                    {positionTradeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div data-qa-id="position-info-pip-value" className="flex items-center justify-between text-[#9a9ea8]">
                  <span>Tick value</span>
                  <span className="font-mono text-white font-medium">{spec.tickValue.toFixed(2)} USD</span>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================
              BOTTOM ACTION BUTTONS
             =================================================================== */}
          <div className="doneButton-u3DtG1BP p-4 border-t border-[#2a2b30] bg-[#151619] shrink-0">
            {/* Standard Create Order CTA */}
            {draft.mode === "create" && (
              <button
                type="button"
                data-name="place-and-modify-button"
                onClick={handleSubmitOrder}
                className={`w-full py-3.5 px-4 rounded-[10px] shadow-sm transition-transform active:scale-[0.98] ${
                  !isSideExplicitlySelected && draft.type === "limit"
                    ? "bg-[#1e1f24] hover:bg-[#25262c] text-white border border-[#2a2b30]"
                    : draft.side === "buy"
                    ? "bg-[#2962ff] hover:bg-[#1e53e5] text-white"
                    : "bg-[#f23645] hover:bg-[#e02d3c] text-white"
                }`}
              >
                {renderCtaContent()}
              </button>
            )}

            {/* Modify Order Duet: Confirm (50%) & Discard (50%) */}
            {draft.mode === "modify_order" && (
              <div className="modifyButtons-e3ECpiMr grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-name="place-and-modify-button"
                  onClick={handleConfirmModifyOrder}
                  className="py-3 px-4 rounded-[8px] bg-[#2962ff] hover:bg-[#1e53e5] text-white font-semibold text-[13px] active:scale-[0.98] transition-all shadow-sm"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  data-name="button-back"
                  onClick={() => preOrderStore.discardEdit()}
                  className="py-3 px-4 rounded-[8px] bg-[#2a2b30] hover:bg-[#34363e] border border-[#3b3e48] text-white font-semibold text-[13px] active:scale-[0.98] transition-all"
                >
                  Discard
                </button>
              </div>
            )}

            {/* Edit Position Duet: Confirm (top) & Discard (bottom) stacked vertically */}
            {draft.mode === "edit_position" && (
              <div className="modifyButtons-e3ECpiMr flex flex-col gap-2 w-full">
                <button
                  type="button"
                  data-name="place-and-modify-button"
                  onClick={handleConfirmEditPosition}
                  className="w-full py-3 px-4 rounded-[8px] bg-[#2962ff] hover:bg-[#1e53e5] text-white font-semibold text-[13px] active:scale-[0.98] transition-all shadow-sm"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  data-name="button-back"
                  onClick={() => preOrderStore.discardEdit()}
                  className="w-full py-3 px-4 rounded-[8px] bg-[#2a2b30] hover:bg-[#34363e] border border-[#3b3e48] text-white font-semibold text-[13px] active:scale-[0.98] transition-all"
                >
                  Discard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          4. MAIN CONTENT: DOM (DEPTH OF MARKET) TAB (TradingView 1:1, 5 Columns)
         ===================================================================== */}
      {!isEditing && activeTab === "dom" && (
        <div className="tv-dom-panel-JWIlccIU flex-1 flex flex-col justify-between overflow-hidden bg-[#151619]">
          {/* Ladder Column Headers: Orders Buy | Bid size | (empty) | Ask size | Orders Sell */}
          <div className="grid grid-cols-[38px_1fr_80px_1fr_38px] text-[10px] font-semibold text-[#9a9ea8] px-2 py-1.5 border-b border-[#2a2b30] bg-[#1e1f24] shrink-0 text-center">
            <span></span>
            <span className="text-left pl-1">Bid size</span>
            <span></span>
            <span className="text-right pr-1">Ask size</span>
            <span></span>
          </div>

          {/* 5-Column Price Ladder */}
          <div className="tv-dom-widget-main-VBTMesvS flex-1 overflow-y-auto font-mono text-xs select-none">
            {ladderSteps.map((price, idx) => {
              const isCurrent = Math.abs(price - currentPrice) < spec.tickSize / 2;
              const isAbove = price > currentPrice;

              // Find working orders at this level
              const getEffectivePrice = (o: (typeof workingOrders)[number]) =>
                o.type === "stop" ? (o.stopPrice ?? o.price) : o.price;

              const buyOrdersAtPrice = workingOrders.filter(
                (o) => o.side === "buy" && Math.abs(getEffectivePrice(o) - price) < spec.tickSize / 2
              );
              const sellOrdersAtPrice = workingOrders.filter(
                (o) => o.side === "sell" && Math.abs(getEffectivePrice(o) - price) < spec.tickSize / 2
              );

              const buyQtyAtPrice = buyOrdersAtPrice.reduce((acc, o) => acc + o.qty, 0);
              const sellQtyAtPrice = sellOrdersAtPrice.reduce((acc, o) => acc + o.qty, 0);

              return (
                <div
                  key={price}
                  className={`tv-dom-widget-main__row-VBTMesvS grid grid-cols-[38px_1fr_80px_1fr_38px] items-center h-[23px] border-b border-[#222328] transition-colors group ${
                    isCurrent ? "font-bold" : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* 1. Orders Buy Column */}
                  <div
                    data-qa-id={`dom-cell-${idx}-orders-buy`}
                    className="h-full border-r border-[#2a2b30]/50 flex items-center justify-center text-[10px]"
                  >
                    {buyQtyAtPrice > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="px-1 py-0.2 rounded bg-[#2962ff] text-white font-bold text-[9px]">
                          {buyQtyAtPrice}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            buyOrdersAtPrice.forEach((o) => cancelOrder(o.id));
                          }}
                          className="text-[#9a9ea8] hover:text-[#f23645]"
                          title="Cancel order"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-60 text-[9px] text-[#2962ff]">
                        {isAbove ? "Stop" : "Limit"}
                      </span>
                    )}
                  </div>

                  {/* 2. Bid Column (Empty in Replay — Level 2 not simulated; soft blue highlight on current price) */}
                  <div
                    data-qa-id={`dom-cell-${idx}-bid`}
                    onClick={() => handleDomCellClick(price, "bid")}
                    className={`h-full border-r border-[#2a2b30]/50 relative flex items-center px-1.5 cursor-pointer hover:bg-[#2962ff]/10 overflow-hidden ${
                      isCurrent ? "bg-[#2962ff]/20" : ""
                    }`}
                  />

                  {/* 3. Centered Price Column */}
                  <div
                    data-qa-id={`dom-cell-${idx}-price`}
                    className={`h-full border-r border-[#2a2b30]/50 flex items-center justify-center text-[11px] font-semibold ${
                      isCurrent
                        ? "tv-dom-widget-main__value--highlighted-VBTMesvS text-[#f23645] font-bold"
                        : isAbove
                        ? "text-[#f23645]"
                        : "text-[#2962ff]"
                    }`}
                  >
                    {formatPrice(symbol, price)}
                  </div>

                  {/* 4. Ask Column (Empty in Replay — Level 2 not simulated; soft red highlight on current price) */}
                  <div
                    data-qa-id={`dom-cell-${idx}-ask`}
                    onClick={() => handleDomCellClick(price, "ask")}
                    className={`h-full border-r border-[#2a2b30]/50 relative flex items-center justify-end px-1.5 cursor-pointer hover:bg-[#f23645]/10 overflow-hidden ${
                      isCurrent ? "bg-[#f23645]/20" : ""
                    }`}
                  />

                  {/* 5. Orders Sell Column */}
                  <div
                    data-qa-id={`dom-cell-${idx}-orders-sell`}
                    className="h-full flex items-center justify-center text-[10px]"
                  >
                    {sellQtyAtPrice > 0 ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sellOrdersAtPrice.forEach((o) => cancelOrder(o.id));
                          }}
                          className="text-[#9a9ea8] hover:text-[#f23645]"
                          title="Cancel order"
                        >
                          ✕
                        </button>
                        <span className="px-1 py-0.2 rounded bg-[#f23645] text-white font-bold text-[9px]">
                          {sellQtyAtPrice}
                        </span>
                      </div>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-60 text-[9px] text-[#f23645]">
                        {isAbove ? "Limit" : "Stop"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DOM Bottom Quick Actions Toolbar */}
          <div className="bottomBlock-QLqPWEBq p-3 border-t border-[#2a2b30] bg-[#1e1f24] shrink-0 space-y-2">
            {/* Centering / Cancel row */}
            <div className="flex items-center justify-between text-xs text-[#9a9ea8]">
              <button
                type="button"
                data-qa-id="cancel-all-buy-orders"
                disabled={workingBuyCount === 0}
                onClick={() => {
                  workingOrders.filter((o) => o.side === "buy").forEach((o) => cancelOrder(o.id));
                }}
                className={`w-7 h-6 flex items-center justify-center rounded transition-colors ${
                  workingBuyCount > 0 ? "hover:text-white" : "opacity-40 cursor-not-allowed"
                }`}
                title="Cancel all bid orders"
              >
                ✕
              </button>

              <div className="flex items-center gap-2">
                <div
                  title="Total buy quantity"
                  className="rounded-[4px] border border-[#2a2b30] bg-[#1e1f24] px-2 py-0.5 text-center min-w-[28px] text-[11px] font-mono font-medium text-[#2962ff]"
                >
                  {workingBuyCount > 0 ? workingBuyCount : "—"}
                </div>

                <button
                  type="button"
                  data-qa-id="switch-mode-DOM"
                  onClick={() => setCenterOffset(0)}
                  title="Lock / Recenter ladder to market price"
                  className="w-7 h-6 flex items-center justify-center rounded text-[#9a9ea8] hover:text-white"
                >
                  <LockIcon />
                </button>

                <div
                  title="Total sell quantity"
                  className="rounded-[4px] border border-[#2a2b30] bg-[#1e1f24] px-2 py-0.5 text-center min-w-[28px] text-[11px] font-mono font-medium text-[#f23645]"
                >
                  {workingSellCount > 0 ? workingSellCount : "—"}
                </div>
              </div>

              <button
                type="button"
                data-qa-id="cancel-all-sell-orders"
                disabled={workingSellCount === 0}
                onClick={() => {
                  workingOrders.filter((o) => o.side === "sell").forEach((o) => cancelOrder(o.id));
                }}
                className={`flex items-center gap-1 px-1.5 h-6 rounded transition-colors font-mono font-medium ${
                  workingSellCount > 0 ? "hover:text-white" : "opacity-40 cursor-not-allowed"
                }`}
                title="Cancel all ask orders"
              >
                {workingSellCount > 0 && <span>{workingSellCount}</span>}
                <span>✕</span>
              </button>
            </div>

            {/* Position Status & PnL Switcher View (Cycling USD, Ticks, %) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                data-qa-id="position-DOM"
                className="flex items-center justify-center py-1.5 rounded-[6px] border border-[#2a2b30] bg-[#151619] font-semibold text-white shadow-sm"
              >
                {position && position.qty > 0 ? (
                  <span>{position.side === "long" ? "Long" : "Short"} {position.qty}</span>
                ) : (
                  <span>—</span>
                )}
              </button>

              <button
                type="button"
                data-qa-id="switch-pl-view"
                onClick={() => {
                  setDomPlView((prev) => (prev === "usd" ? "ticks" : prev === "ticks" ? "percent" : "usd"));
                }}
                className="flex items-center justify-center py-1.5 rounded-[6px] border border-[#2a2b30] bg-[#151619] font-semibold shadow-sm hover:border-[#3b3e48] transition-colors"
                title="Click to switch PnL format (USD / Ticks / %)"
              >
                {position && position.qty > 0 ? (
                  <span className={position.unrealizedPnL >= 0 ? "text-[#089981]" : "text-[#f23645]"}>
                    {domPlView === "usd" && `${position.unrealizedPnL >= 0 ? "+" : ""}$${position.unrealizedPnL.toFixed(2)} USD`}
                    {domPlView === "ticks" && `${position.unrealizedPnLTicks >= 0 ? "+" : ""}${position.unrealizedPnLTicks} ticks`}
                    {domPlView === "percent" && `${position.unrealizedPnLPercent >= 0 ? "+" : ""}${position.unrealizedPnLPercent.toFixed(2)}%`}
                  </span>
                ) : (
                  <span className="text-[#9a9ea8]">—</span>
                )}
              </button>
            </div>

            {/* Flatten | CXL All | Reverse */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-qa-id="flatten"
                onClick={() => flattenAll()}
                className="py-1.5 rounded-[6px] border border-[#2a2b30] bg-[#25262c] text-[12px] font-semibold text-white hover:bg-white/5 transition-colors shadow-sm"
              >
                Flatten
              </button>
              <button
                type="button"
                data-qa-id="cancel-all-orders-dom"
                onClick={() => {
                  workingOrders.forEach((o) => cancelOrder(o.id));
                }}
                className="py-1.5 rounded-[6px] border border-[#2a2b30] bg-[#25262c] text-[12px] font-semibold text-white hover:bg-white/5 transition-colors shadow-sm"
              >
                CXL All
              </button>
              <button
                type="button"
                data-qa-id="reverse"
                onClick={() => reversePosition(symbol)}
                className="py-1.5 rounded-[6px] border border-[#2a2b30] bg-[#25262c] text-[12px] font-semibold text-white hover:bg-white/5 transition-colors shadow-sm"
              >
                Reverse
              </button>
            </div>

            {/* Buy Mkt | Units | Sell Mkt */}
            <div className="grid grid-cols-[1fr_56px_1fr] gap-2 pt-1">
              <button
                type="button"
                data-qa-id="buy-market-dom"
                onClick={() => {
                  placeOrder({
                    symbol,
                    side: "buy",
                    type: "market",
                    qty: draft.qty,
                    price: currentPrice,
                  });
                }}
                className="py-2.5 rounded-[8px] bg-[#2962ff] text-white text-[12px] font-bold hover:bg-[#1e53e5] active:scale-[0.98] transition-transform shadow-sm"
              >
                Buy Mkt
              </button>
              <input
                type="number"
                min={1}
                value={draft.qty}
                data-qa-id="ui-lib-Input-input qty-dom-input"
                onChange={(e) => preOrderStore.setQty(parseInt(e.target.value) || 1)}
                className="h-full rounded-[8px] border border-[#2a2b30] bg-[#151619] text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-[#2962ff]"
              />
              <button
                type="button"
                data-qa-id="sell-market-dom"
                onClick={() => {
                  placeOrder({
                    symbol,
                    side: "sell",
                    type: "market",
                    qty: draft.qty,
                    price: currentPrice,
                  });
                }}
                className="py-2.5 rounded-[8px] bg-[#f23645] text-white text-[12px] font-bold hover:bg-[#e02d3c] active:scale-[0.98] transition-transform shadow-sm"
              >
                Sell Mkt
              </button>
            </div>

            {/* Details Week Collapse */}
            <div className="pt-2 border-t border-[#2a2b30]">
              <button
                type="button"
                onClick={() => setDomDetailsOpen(!domDetailsOpen)}
                className="w-full flex items-center justify-between text-[11px] font-semibold tracking-wider text-[#9a9ea8] uppercase hover:text-white"
              >
                <span>DETAILS <span className="font-semibold text-[#9a9ea8]">WEEK</span></span>
                {domDetailsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>

              {domDetailsOpen && (
                <div className="mt-2 p-2 rounded-[6px] bg-[#151619] border border-[#2a2b30] text-[11px] space-y-1 text-[#9a9ea8]">
                  <div className="flex justify-between">
                    <span>Working Orders</span>
                    <span className="font-mono text-white">{workingOrders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Spread</span>
                    <span className="font-mono text-white">0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tick Size</span>
                    <span className="font-mono text-white">{spec.tickSize}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
