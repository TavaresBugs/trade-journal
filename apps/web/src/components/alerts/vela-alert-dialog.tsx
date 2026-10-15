"use client";

import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAlerts } from "@/lib/alerts/alerts-store";
import {
  AlertConditionType,
  AlertFrequency,
  AlertSoundName,
  formatConditionLabel,
} from "@/lib/alerts/types";
import { alertAudioEngine } from "@/lib/alerts/alert-audio-engine";
import {
  formatPrice,
  roundToTick,
  getPaperInstrumentSpec,
} from "@/lib/paper-trading/symbol-specs";
import { VelaBezierTriggerSelect } from "./vela-bezier-trigger-select";
import { VelaBezierConditionSelect } from "./vela-bezier-condition-select";
import { VelaBezierSoundSelect } from "./vela-bezier-sound-select";
import { VelaBezierSymbolSelect } from "./vela-bezier-symbol-select";
import { VelaBezierPriceSourceSelect } from "./vela-bezier-price-source-select";
import { VelaBezierValueSelect } from "./vela-bezier-value-select";
import { VelaBezierExpirationSelect } from "./vela-bezier-expiration-select";
import { VelaBezierSoundDurationSelect } from "./vela-bezier-sound-duration-select";

const DURATION_OPTIONS = [
  { value: 0, label: "Once" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
];

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
      <path d="M12.5 4h-7l-.5 1H2v1h14V5h-3l-.5-1ZM3.5 7l.9 9.3c.08.7.67 1.2 1.37 1.2h6.46c.7 0 1.29-.5 1.37-1.2L14.5 7h-11Zm3.5 2.5h1v6h-1v-6Zm3 0h1v6h-1v-6Z" />
    </svg>
  );
}

export function VelaAlertDialog() {
  const {
    isDialogOpen,
    dialogMode,
    editingAlert,
    createInitialPrice,
    createInitialSymbol,
    closeDialog,
    createAlert,
    updateAlert,
    deleteAlert,
    requestDeleteAlert,
  } = useAlerts();

  // Navigation state: main dialog | message subpage | notifications subpage | add_condition subpage
  const [activeView, setActiveView] = useState<"main" | "message" | "notifications" | "add_condition">("main");

  // Multi-conditions state matching media_1792029925681_860dd7fc.png and media_1792029925679_b4a335c3.png
  const [extraConditions, setExtraConditions] = useState<{
    id: string;
    source: string;
    operator: string;
    target?: string;
    interval?: string;
  }[]>([]);
  const [newCondSource, setNewCondSource] = useState("RSI (14, close)");
  const [newCondOperator, setNewCondOperator] = useState("Regular Bullish Divergence");
  const [newCondInterval, setNewCondInterval] = useState("1h");

  // Form Fields
  const [symbol, setSymbol] = useState("MNQ");
  const [priceSource, setPriceSource] = useState("price");
  const [conditionType, setConditionType] = useState<AlertConditionType>("crossing");
  const [valueType, setValueType] = useState("value");
  const [targetPrice, setTargetPrice] = useState<string>("30,781.00");
  const [upperPrice, setUpperPrice] = useState<string>("30,831.00");
  const [lowerPrice, setLowerPrice] = useState<string>("30,731.00");
  const [frequency, setFrequency] = useState<AlertFrequency>("once_only");
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [expirationTime, setExpirationTime] = useState<string>("17:59");
  const [alertName, setAlertName] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  // Notification Options
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [showPopup, setShowPopup] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWebhook, setSendWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [playSound, setPlaySound] = useState(true);
  const [soundName, setSoundName] = useState<AlertSoundName>("fired");
  const [soundDuration, setSoundDuration] = useState<number>(0);
  const [sendPlainText, setSendPlainText] = useState(false);

  // Initialize form state when dialog opens or editingAlert changes
  useEffect(() => {
    if (!isDialogOpen) {
      alertAudioEngine.stop("preview");
      setActiveView("main");
      return;
    }

    if (dialogMode === "edit" && editingAlert) {
      setSymbol(editingAlert.symbol);
      setConditionType(editingAlert.conditionType);
      setTargetPrice(formatPrice(editingAlert.symbol, editingAlert.targetPrice));
      setUpperPrice(
        editingAlert.upperPrice !== undefined
          ? formatPrice(editingAlert.symbol, editingAlert.upperPrice)
          : ""
      );
      setLowerPrice(
        editingAlert.lowerPrice !== undefined
          ? formatPrice(editingAlert.symbol, editingAlert.lowerPrice)
          : ""
      );
      setFrequency(editingAlert.frequency);
      setMessage(editingAlert.message);

      if (editingAlert.expiration) {
        const d = new Date(editingAlert.expiration);
        setExpirationDate(d.toISOString().slice(0, 10));
        setExpirationTime(d.toTimeString().slice(0, 5));
      }

      setNotifyInApp(editingAlert.notifications.sendToast ?? true);
      setShowPopup(editingAlert.notifications.showPopup ?? true);
      setSendEmail(editingAlert.notifications.email ?? false);
      setSendWebhook(Boolean(editingAlert.notifications.webhookUrl));
      setWebhookUrl(editingAlert.notifications.webhookUrl ?? "");
      setPlaySound(editingAlert.notifications.playSound ?? true);
      setSoundName(editingAlert.notifications.soundName ?? "fired");
      setSoundDuration(editingAlert.notifications.soundDurationSeconds ?? 0);
    } else {
      // Create mode
      const activeSym = (createInitialSymbol || "MNQ").toUpperCase();
      setSymbol(activeSym);
      setConditionType("crossing");

      const initPrice =
        createInitialPrice ??
        (activeSym === "MNQ" || activeSym.includes("NQ") ? 20000 : 5800);
      const formattedInit = formatPrice(activeSym, initPrice);
      setTargetPrice(formattedInit);
      setUpperPrice(formatPrice(activeSym, initPrice + 50));
      setLowerPrice(formatPrice(activeSym, Math.max(1, initPrice - 50)));
      setFrequency("once_only");
      setAlertName("");
      setMessage(`${activeSym} Crossing ${formattedInit}`);

      // Default expiration 30 days from now
      const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      setExpirationDate(in30Days.toISOString().slice(0, 10));
      setExpirationTime("17:59");

      setNotifyInApp(true);
      setShowPopup(true);
      setSendEmail(false);
      setSendWebhook(false);
      setWebhookUrl("");
      setPlaySound(true);
      setSoundName("fired");
      setSoundDuration(0);
      setSendPlainText(false);
    }

    setActiveView("main");
  }, [isDialogOpen, dialogMode, editingAlert, createInitialSymbol, createInitialPrice]);

  // Keep default message updated if user hasn't customized it
  const handlePriceChange = (newPrice: string) => {
    setTargetPrice(newPrice);
    if (message.includes("Crossing") || !message.trim()) {
      setMessage(`${symbol} Crossing ${newPrice}`);
    }
  };

  const isChannelCondition = conditionType.includes("channel");

  // Format expiration for display matching TradingView: "November 13, 2026 at 17:59"
  const formattedExpirationLabel = (() => {
    if (!expirationDate) return "End of day";
    try {
      const parts = expirationDate.split("-").map(Number);
      const y = parts[0] ?? 2026;
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const dateObj = new Date(y, m - 1, d);
      const monthName = dateObj.toLocaleDateString("en-US", { month: "long" });
      return `${monthName} ${d}, ${y} at ${expirationTime || "17:59"}`;
    } catch {
      return `${expirationDate} at ${expirationTime}`;
    }
  })();

  // Summary string for notifications row matching TradingView: "App, Toasts, Sound"
  const notificationsSummary = (() => {
    const parts: string[] = [];
    if (notifyInApp) parts.push("App");
    if (showPopup) parts.push("Toasts");
    if (playSound) parts.push("Sound");
    if (sendEmail) parts.push("Email");
    if (sendWebhook) parts.push("Webhook");
    return parts.length > 0 ? parts.join(", ") : "None";
  })();



  const handleStepPrice = (deltaSteps: number) => {
    const spec = getPaperInstrumentSpec(symbol);
    const tick = spec?.tickSize ?? 0.25;
    const cleanStr = targetPrice.replace(/,/g, "");
    const current = parseFloat(cleanStr) || 0;
    const stepped = roundToTick(symbol, current + deltaSteps * tick);
    handlePriceChange(formatPrice(symbol, stepped));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanStr = targetPrice.replace(/,/g, "");
    const numericTarget = parseFloat(cleanStr);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) return;

    const expirationISO =
      expirationDate && expirationTime
        ? new Date(`${expirationDate}T${expirationTime}:00`).toISOString()
        : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const notifications = {
      showPopup,
      sendToast: notifyInApp,
      playSound,
      soundName,
      soundDurationSeconds: soundDuration,
      email: sendEmail,
      webhookUrl: sendWebhook ? webhookUrl : undefined,
    };

    if (dialogMode === "edit" && editingAlert) {
      updateAlert(editingAlert.id, {
        symbol: symbol.toUpperCase(),
        conditionType,
        targetPrice: numericTarget,
        upperPrice: isChannelCondition
          ? parseFloat(upperPrice.replace(/,/g, ""))
          : undefined,
        lowerPrice: isChannelCondition
          ? parseFloat(lowerPrice.replace(/,/g, ""))
          : undefined,
        frequency,
        expiration: expirationISO,
        message: message.trim() || `${symbol} Crossing ${targetPrice}`,
        notifications,
      });
    } else {
      createAlert({
        symbol: symbol.toUpperCase(),
        conditionType,
        targetPrice: numericTarget,
        upperPrice: isChannelCondition
          ? parseFloat(upperPrice.replace(/,/g, ""))
          : undefined,
        lowerPrice: isChannelCondition
          ? parseFloat(lowerPrice.replace(/,/g, ""))
          : undefined,
        frequency,
        expiration: expirationISO,
        message: message.trim() || `${symbol} Crossing ${targetPrice}`,
        notifications,
      });
    }

    closeDialog();
  };

  const handleDelete = () => {
    if (editingAlert) {
      requestDeleteAlert(editingAlert);
      closeDialog();
    }
  };

  if (!isDialogOpen) return null;

  return (
    <DialogPrimitive.Root open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogPrimitive.Portal>
        {/* Backdrop Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-[1px] animate-in fade-in-0" />

        <DialogPrimitive.Content
          data-qa-id={
            activeView === "notifications"
              ? "alerts-notifications-edit-dialog"
              : activeView === "message"
                ? "alerts-message-edit-dialog"
                : "alerts-create-edit-dialog"
          }
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] w-[460px] max-w-[calc(100vw-24px)] bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg,#d1d4dc)] border border-[var(--vela-border,#2a2e39)] rounded-[10px] shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none overflow-hidden select-none font-sans"
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
          }}
        >
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* VIEW 1: MAIN ALERT CREATE / EDIT DIALOG (1:1 TradingView)   */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeView === "main" && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="headerWrapper-gZTBZBB3 h-[52px] px-5 flex items-center justify-between border-b border-[var(--vela-border,#2a2e39)] shrink-0">
                <div className="flex items-center gap-2">
                  <DialogPrimitive.Title className="text-[17px] font-semibold text-[var(--vela-fg-bright,#f0f3fa)] tracking-tight">
                    {dialogMode === "edit" ? "Edit alert on" : "Create alert on"}
                  </DialogPrimitive.Title>

                  {/* Symbol Pill with Bézier Join Dropdown & AssetIcons */}
                  <VelaBezierSymbolSelect
                    value={symbol}
                    onChange={(newSym) => {
                      setSymbol(newSym);
                      const cleanSym = newSym.replace(/1!$/, "");
                      const initP = cleanSym.includes("NQ") ? 20000 : cleanSym.includes("ES") ? 5800 : cleanSym.includes("YM") ? 42000 : 2500;
                      const formatted = formatPrice(cleanSym, initP);
                      setTargetPrice(formatted);
                      setMessage(`${cleanSym} Crossing ${formatted}`);
                    }}
                  />
                </div>

                {/* Header Actions: Presets Icon + Close Button */}
                <div className="flex items-center gap-1">
                  {/* Presets Icon */}
                  <button
                    type="button"
                    title="Alert presets"
                    className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M6 4a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V6a2 2 0 00-2-2H6zm2 1H6a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1zM6 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H6zm2 1H6a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1zM11 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zm2-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V6a1 1 0 011-1z"
                      />
                      <path
                        fill="currentColor"
                        d="M14 13h-2v1h2v2h1v-2h2v-1h-2v-2h-1v2z"
                      />
                    </svg>
                  </button>

                  {/* Close (X) */}
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 14 14"
                      width="12"
                      height="12"
                    >
                      <path
                        stroke="currentColor"
                        strokeWidth="1.4"
                        d="m1.5 1.5 11 11m0-11-11 11"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                {/* 1. Condition Section matching print_20261014_223842.png */}
                <div className="grid grid-cols-[88px_1fr] items-start gap-3">
                  <span className="text-[14px] text-[var(--vela-fg-muted,#787b86)] pt-1.5 font-normal">
                    Condition
                  </span>

                  <div className="space-y-2">
                    {/* Row 1: Source Selector (Price ⌄) */}
                    <div>
                      <VelaBezierPriceSourceSelect
                        value={priceSource}
                        onChange={(val) => setPriceSource(val)}
                      />
                    </div>

                    {/* Row 2: Operator Dropdown (Crossing ⌄ with Bézier Join + #151619) */}
                    <div>
                      <VelaBezierConditionSelect
                        value={conditionType}
                        onChange={(val) => setConditionType(val)}
                      />
                    </div>

                    {/* Row 3: Target Type (Value ⌄) & Numeric Price with Stepper */}
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <VelaBezierValueSelect
                        value={valueType}
                        onChange={(val) => setValueType(val)}
                      />

                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={targetPrice}
                          onChange={(e) => handlePriceChange(e.target.value)}
                          className="w-full h-[34px] pl-3 pr-8 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] font-mono focus:outline-none focus:border-[#2962ff]"
                        />

                        {/* Stepper Buttons (Up / Down) */}
                        <div className="absolute right-1 flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => handleStepPrice(1)}
                            className="p-0.5 text-[var(--vela-fg-muted,#787b86)] hover:text-white leading-none hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] rounded"
                            title="Increase"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 18 18"
                              width="12"
                              height="12"
                              className="rotate-180"
                            >
                              <path
                                fill="currentColor"
                                d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepPrice(-1)}
                            className="p-0.5 text-[var(--vela-fg-muted,#787b86)] hover:text-white leading-none hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] rounded"
                            title="Decrease"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 18 18"
                              width="12"
                              height="12"
                            >
                              <path
                                fill="currentColor"
                                d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Channel bounds if selected */}
                    {isChannelCondition && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[11px] text-[var(--vela-fg-muted,#787b86)] mb-1 block">
                            Upper Price
                          </label>
                          <input
                            type="text"
                            value={upperPrice}
                            onChange={(e) => setUpperPrice(e.target.value)}
                            className="w-full h-[32px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] font-mono focus:outline-none focus:border-[#2962ff]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[var(--vela-fg-muted,#787b86)] mb-1 block">
                            Lower Price
                          </label>
                          <input
                            type="text"
                            value={lowerPrice}
                            onChange={(e) => setLowerPrice(e.target.value)}
                            className="w-full h-[32px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] font-mono focus:outline-none focus:border-[#2962ff]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Multi-condition stacked list matching media_1792029925681_860dd7fc.png */}
                    {extraConditions.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {/* Primary Condition Pill */}
                        <div className="flex items-center justify-between h-[36px] px-3 rounded-[6px] bg-[#1e222d] border border-[var(--vela-border,#2a2e39)] text-[13px]">
                          <span className="truncate">
                            <span className="font-semibold">{symbol}</span>{" "}
                            <span className="text-[#ff9800] font-medium">{formatConditionLabel(conditionType)}</span>{" "}
                            <span className="font-mono">{targetPrice}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setExtraConditions([])}
                            className="pl-3 border-l border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg-muted,#787b86)] hover:text-[#f23645] transition-colors ml-2 cursor-pointer"
                            title="Clear extra conditions"
                          >
                            <TrashIcon />
                          </button>
                        </div>

                        {/* Extra Condition Pills */}
                        {extraConditions.map((cond) => (
                          <React.Fragment key={cond.id}>
                            <div className="text-[10px] font-bold text-[var(--vela-fg-muted,#787b86)] tracking-wider px-1">
                              AND
                            </div>
                            <div className="flex items-center justify-between h-[36px] px-3 rounded-[6px] bg-[#1e222d] border border-[var(--vela-border,#2a2e39)] text-[13px]">
                              <span className="truncate">
                                {cond.source}
                                {cond.interval ? `, ${cond.interval} ` : " "}
                                <span className="text-[#ff9800] font-medium">{cond.operator}</span>
                                {cond.target ? ` ${cond.target}` : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExtraConditions((prev) => prev.filter((c) => c.id !== cond.id))}
                                className="pl-3 border-l border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg-muted,#787b86)] hover:text-[#f23645] transition-colors ml-2 cursor-pointer"
                                title="Remove condition"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}

                    {/* Row 4: + Add condition button + Help Icon matching print_20261014_223842.png */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveView("add_condition")}
                        className="inline-flex items-center gap-1 text-[13px] text-[#2962ff] hover:text-[#1e53e5] font-medium cursor-pointer transition-colors"
                      >
                        <span className="text-[15px] font-bold leading-none">+</span>
                        <span>Add condition</span>
                      </button>

                      <span
                        className="text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] cursor-pointer inline-flex items-center"
                        title="Allows creating alerts that trigger only when multiple conditions are met simultaneously."
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 18 18"
                          width="15"
                          height="15"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm-1-4a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm2.83-3.52c-.49.43-.97.85-1.06 1.52H8.26c.08-1.18.74-1.69 1.32-2.13.49-.38.92-.71.92-1.37C10.5 6.67 9.82 6 9 6s-1.5.67-1.5 1.5V8H6v-.5a3 3 0 1 1 6 0c0 .96-.6 1.48-1.17 1.98Z"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thin Divider Line */}
                <div className="h-[1px] bg-[var(--vela-border,#2a2e39)]" />

                {/* 2. Trigger Section */}
                <div className="grid grid-cols-[88px_1fr] items-center gap-3 relative">
                  <span className="text-[14px] text-[var(--vela-fg-muted,#787b86)] font-normal">
                    Trigger
                  </span>

                  <div>
                    <VelaBezierTriggerSelect
                      value={frequency}
                      onChange={(val) => setFrequency(val)}
                    />
                  </div>
                </div>

                {/* 3. Expiration Section matching print_20261014_224303.png */}
                <div className="grid grid-cols-[88px_1fr] items-start gap-3 relative">
                  <span className="text-[14px] text-[var(--vela-fg-muted,#787b86)] pt-1.5 font-normal">
                    Expiration
                  </span>

                  <div>
                    <VelaBezierExpirationSelect
                      date={expirationDate}
                      time={expirationTime}
                      onChangeDate={setExpirationDate}
                      onChangeTime={setExpirationTime}
                    />
                  </div>
                </div>

                {/* 4. Message Section (Clicking opens Message Sub-View) */}
                <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                  <span className="text-[14px] text-[var(--vela-fg-muted,#787b86)] font-normal">
                    Message
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveView("message")}
                    className="w-full h-[32px] px-2.5 flex items-center justify-between rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors text-left truncate"
                  >
                    <span className="truncate">{message || `${symbol} Crossing ${targetPrice}`}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="16"
                      height="16"
                      className="text-[var(--vela-fg-muted,#787b86)] shrink-0 ml-2"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        d="m7.827 14.078-1.128-.99L10.29 9 6.7 4.911l1.128-.99L12.285 9z"
                      />
                    </svg>
                  </button>
                </div>

                {/* 5. Notifications Section (Clicking opens Notifications Sub-View) */}
                <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                  <span className="text-[14px] text-[var(--vela-fg-muted,#787b86)] font-normal">
                    Notifications
                  </span>

                  <button
                    type="button"
                    onClick={() => setActiveView("notifications")}
                    className="w-full h-[32px] px-2.5 flex items-center justify-between rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors text-left truncate"
                  >
                    <span className="truncate">{notificationsSummary}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="16"
                      height="16"
                      className="text-[var(--vela-fg-muted,#787b86)] shrink-0 ml-2"
                      fill="none"
                    >
                      <path
                        fill="currentColor"
                        d="m7.827 14.078-1.128-.99L10.29 9 6.7 4.911l1.128-.99L12.285 9z"
                      />
                    </svg>
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="footerWrapper-eZjjbpG6 h-[56px] px-5 flex items-center justify-between border-t border-[var(--vela-border,#2a2e39)] bg-[var(--vela-surface,#1e222d)] shrink-0">
                {dialogMode === "edit" ? (
                  /* Red Trash Button (Left Slot) matching print_20261014_180053.png */
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-[34px] h-[34px] flex items-center justify-center rounded-[6px] border border-[#f23645] text-[#f23645] hover:bg-[#f23645]/10 transition-colors"
                    title="Delete alert"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                    >
                      <path
                        fill="currentColor"
                        d="M12 4h3v1h-1.04l-.88 9.64a1.5 1.5 0 0 1-1.5 1.36H6.42a1.5 1.5 0 0 1-1.5-1.36L4.05 5H3V4h3v-.5C6 2.67 6.67 2 7.5 2h3c.83 0 1.5.67 1.5 1.5V4ZM7.5 3a.5.5 0 0 0-.5.5V4h4v-.5a.5.5 0 0 0-.5-.5h-3ZM5.05 5l.87 9.55a.5.5 0 0 0 .5.45h5.17a.5.5 0 0 0 .5-.45L12.94 5h-7.9Z"
                      />
                    </svg>
                  </button>
                ) : (
                  <div />
                )}

                {/* Right Slot: Cancel and Create / Save */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="h-[34px] px-4 rounded-[6px] text-[13px] font-medium text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] hover:text-white transition-colors border border-[var(--vela-border,#2a2e39)]"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="h-[34px] px-5 rounded-[6px] text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#1e53e5] transition-colors shadow-sm"
                  >
                    {dialogMode === "edit" ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* VIEW 2: MESSAGE SUB-VIEW (1:1 alerts-message-edit-dialog)  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeView === "message" && (
            <div className="flex flex-col">
              {/* Header with Back Button */}
              <div className="h-[52px] px-5 flex items-center justify-between border-b border-[var(--vela-border,#2a2e39)] shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("main")}
                    className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                    title="Back"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                    >
                      <path
                        fill="currentColor"
                        d="M12.92 1.92 5.85 9l7.07 7.08-.84.84-7.5-7.5L4.15 9l.43-.42 7.5-7.5z"
                      />
                    </svg>
                  </button>

                  <DialogPrimitive.Title className="text-[17px] font-semibold text-[var(--vela-fg-bright,#f0f3fa)] tracking-tight">
                    Edit message
                  </DialogPrimitive.Title>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 14 14"
                    width="12"
                    height="12"
                  >
                    <path
                      stroke="currentColor"
                      strokeWidth="1.4"
                      d="m1.5 1.5 11 11m0-11-11 11"
                    />
                  </svg>
                </button>
              </div>

              {/* Message Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Alert Name */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[var(--vela-fg-muted,#787b86)] block">
                    Alert name
                  </label>
                  <input
                    type="text"
                    value={alertName}
                    placeholder="Optional"
                    onChange={(e) => setAlertName(e.target.value)}
                    className="w-full h-[34px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] placeholder:text-[var(--vela-fg-muted,#787b86)]/50 focus:outline-none focus:border-[#2962ff]"
                  />
                </div>

                {/* Message Textarea */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[var(--vela-fg-muted,#787b86)] block">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] focus:outline-none focus:border-[#2962ff] resize-none"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMessage((prev) => `${prev} {{close}}`)
                      }
                      className="px-2.5 py-1 text-[12px] rounded border border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                    >
                      Add placeholder
                    </button>
                    <span
                      className="text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] cursor-pointer"
                      title="Learn more about alert placeholders"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 18 18"
                        width="16"
                        height="16"
                      >
                        <path
                          fill="currentColor"
                          fillRule="evenodd"
                          d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm-1-4a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm2.83-3.52c-.49.43-.97.85-1.06 1.52H8.26c.08-1.18.74-1.69 1.32-2.13.49-.38.92-.71.92-1.37C10.5 6.67 9.82 6 9 6s-1.5.67-1.5 1.5V8H6v-.5a3 3 0 1 1 6 0c0 .96-.6 1.48-1.17 1.98Z"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-[56px] px-5 flex items-center justify-end gap-2 border-t border-[var(--vela-border,#2a2e39)] bg-[var(--vela-surface,#1e222d)] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveView("main")}
                  className="h-[34px] px-4 rounded-[6px] text-[13px] font-medium text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] hover:text-white transition-colors border border-[var(--vela-border,#2a2e39)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("main")}
                  className="h-[34px] px-5 rounded-[6px] text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#1e53e5] transition-colors shadow-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* VIEW 3: NOTIFICATIONS SUB-VIEW (1:1 alerts-notifications)  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeView === "notifications" && (
            <div className="flex flex-col">
              {/* Header with Back Button */}
              <div className="h-[52px] px-5 flex items-center justify-between border-b border-[var(--vela-border,#2a2e39)] shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("main")}
                    className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                    title="Back"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                    >
                      <path
                        fill="currentColor"
                        d="M12.92 1.92 5.85 9l7.07 7.08-.84.84-7.5-7.5L4.15 9l.43-.42 7.5-7.5z"
                      />
                    </svg>
                  </button>

                  <DialogPrimitive.Title className="text-[17px] font-semibold text-[var(--vela-fg-bright,#f0f3fa)] tracking-tight">
                    Notifications
                  </DialogPrimitive.Title>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 14 14"
                    width="12"
                    height="12"
                  >
                    <path
                      stroke="currentColor"
                      strokeWidth="1.4"
                      d="m1.5 1.5 11 11m0-11-11 11"
                    />
                  </svg>
                </button>
              </div>

              {/* Notifications Body with Exact TradingView Options & Descriptions */}
              <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* 1. Show Toast Notification */}
                <div className="space-y-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPopup}
                      onChange={(e) => setShowPopup(e.target.checked)}
                      className="size-4 rounded border-[var(--vela-border,#2a2e39)] bg-[var(--vela-bg,#131722)] text-[#2962ff] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[13px] font-medium text-[var(--vela-fg-bright,#f0f3fa)]">
                      Show toast notification
                    </span>
                  </label>
                  <div className="pl-6.5 text-[12px] text-[var(--vela-fg-muted,#787b86)]">
                    Displays an onsite notification in the page corner.
                  </div>
                </div>

                {/* 2. Play Sound */}
                <div className="space-y-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playSound}
                      onChange={(e) => setPlaySound(e.target.checked)}
                      className="size-4 rounded border-[var(--vela-border,#2a2e39)] bg-[var(--vela-bg,#131722)] text-[#2962ff] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[13px] font-medium text-[var(--vela-fg-bright,#f0f3fa)]">
                      Play sound
                    </span>
                  </label>
                  <div className="pl-6.5 text-[12px] text-[var(--vela-fg-muted,#787b86)]">
                    Plays an audio cue when your alert triggers.
                  </div>
                  {playSound && (
                    <div className="pl-6.5 pt-1.5 grid grid-cols-[1fr_110px] gap-2">
                      {/* Sound Title Select with Bézier Join & Audition Play Buttons */}
                      <VelaBezierSoundSelect
                        value={soundName}
                        onChange={(val) => setSoundName(val)}
                      />

                      {/* Sound Duration Select with Bézier Join */}
                      <VelaBezierSoundDurationSelect
                        value={soundDuration}
                        onChange={(val) => setSoundDuration(val)}
                      />
                    </div>
                  )}
                </div>

                {/* Divider Line */}
                <div className="h-[1px] bg-[var(--vela-border,#2a2e39)]" />

                {/* 7. Notification Schedule */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[var(--vela-fg-muted,#787b86)]">
                      Notification schedule
                    </span>
                    <span className="text-[13px] font-medium text-[var(--vela-fg-bright,#f0f3fa)]">
                      24/7
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--vela-fg-muted,#787b86)]">
                    Notifications are muted outside this schedule.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-[56px] px-5 flex items-center justify-end gap-2 border-t border-[var(--vela-border,#2a2e39)] bg-[var(--vela-surface,#1e222d)] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveView("main")}
                  className="h-[34px] px-4 rounded-[6px] text-[13px] font-medium text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] hover:text-white transition-colors border border-[var(--vela-border,#2a2e39)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("main")}
                  className="h-[34px] px-5 rounded-[6px] text-[13px] font-medium text-white bg-[#2962ff] hover:bg-[#1e53e5] transition-colors shadow-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* VIEW 4: ADD CONDITION SUB-VIEW (media_1792029925679_b4a335c3.png) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeView === "add_condition" && (
            <div className="flex flex-col">
              {/* Header with Back Chevron (<), Title "Add condition", and Close button (X) */}
              <div className="h-[52px] px-5 flex items-center justify-between border-b border-[var(--vela-border,#2a2e39)] shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("main")}
                    className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                    title="Back"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 18 18"
                      width="18"
                      height="18"
                    >
                      <path
                        fill="currentColor"
                        d="M12.92 1.92 5.85 9l7.07 7.08-.84.84-7.5-7.5L4.15 9l.43-.42 7.5-7.5z"
                      />
                    </svg>
                  </button>

                  <DialogPrimitive.Title className="text-[17px] font-semibold text-[var(--vela-fg-bright,#f0f3fa)] tracking-tight">
                    Add condition
                  </DialogPrimitive.Title>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 14 14"
                    width="12"
                    height="12"
                  >
                    <path
                      stroke="currentColor"
                      strokeWidth="1.4"
                      d="m1.5 1.5 11 11m0-11-11 11"
                    />
                  </svg>
                </button>
              </div>

              {/* Form Body matching media_1792029925679_b4a335c3.png */}
              <div className="px-5 py-4 space-y-4">
                {/* Dropdown 1: Plot / Indicator */}
                <div>
                  <select
                    value={newCondSource}
                    onChange={(e) => setNewCondSource(e.target.value)}
                    className="w-full h-[38px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] focus:outline-none focus:border-[#2962ff] cursor-pointer"
                  >
                    <option value="RSI (14, close)">RSI (14, close)</option>
                    <option value="Price">Price</option>
                    <option value="SMA (20)">SMA (20)</option>
                    <option value="EMA (50)">EMA (50)</option>
                    <option value="MACD (12, 26)">MACD (12, 26)</option>
                    <option value="Bollinger Bands (20, 2)">Bollinger Bands (20, 2)</option>
                  </select>
                </div>

                {/* Dropdown 2: Condition / Operator */}
                <div>
                  <select
                    value={newCondOperator}
                    onChange={(e) => setNewCondOperator(e.target.value)}
                    className="w-full h-[38px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] focus:outline-none focus:border-[#2962ff] cursor-pointer"
                  >
                    <option value="Regular Bullish Divergence">Regular Bullish Divergence</option>
                    <option value="Regular Bearish Divergence">Regular Bearish Divergence</option>
                    <option value="Crossing">Crossing</option>
                    <option value="Crossing Up">Crossing Up</option>
                    <option value="Crossing Down">Crossing Down</option>
                    <option value="Greater Than">Greater Than</option>
                    <option value="Less Than">Less Than</option>
                    <option value="Entering Channel">Entering Channel</option>
                    <option value="Exiting Channel">Exiting Channel</option>
                    <option value="Inside Channel">Inside Channel</option>
                    <option value="Outside Channel">Outside Channel</option>
                  </select>
                </div>

                {/* Interval Section */}
                <div className="space-y-1.5">
                  <label className="text-[13px] text-[var(--vela-fg-muted,#787b86)] font-normal block">
                    Interval
                  </label>
                  <select
                    value={newCondInterval}
                    onChange={(e) => setNewCondInterval(e.target.value)}
                    className="w-full h-[38px] px-3 bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] rounded-[6px] text-[13px] text-[var(--vela-fg-bright,#f0f3fa)] focus:outline-none focus:border-[#2962ff] cursor-pointer"
                  >
                    <option value="1m">1m</option>
                    <option value="3m">3m</option>
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1D">1D</option>
                  </select>
                </div>
              </div>

              {/* Footer with Cancel and Add buttons matching media_1792029925679_b4a335c3.png */}
              <div className="h-[56px] px-5 flex items-center justify-end gap-2 border-t border-[var(--vela-border,#2a2e39)] bg-[var(--vela-surface,#1e222d)] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveView("main")}
                  className="h-[34px] px-4 rounded-[6px] text-[13px] font-medium text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] hover:text-white transition-colors border border-[var(--vela-border,#2a2e39)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newId = `cond_${Date.now()}`;
                    setExtraConditions((prev) => [
                      ...prev,
                      {
                        id: newId,
                        source: newCondSource,
                        operator: newCondOperator,
                        interval: newCondInterval,
                      },
                    ]);
                    setActiveView("main");
                  }}
                  className="h-[34px] px-5 rounded-[6px] text-[13px] font-medium text-white bg-[#151619] hover:bg-[#2a2e39] border border-[var(--vela-border,#2a2e39)] transition-colors shadow-sm"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
