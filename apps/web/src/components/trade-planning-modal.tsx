"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DirectionBadge } from "@/components/ui/direction-badge";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Pnl } from "@/components/pnl";
import { MonetaryValue } from "@/components/privacy";
import { cn, fmtAmount, fmtDuration, fmtMoney, fmtNumber } from "@/lib/utils";
import { postJson, useApi } from "@/lib/use-api";
import type { TradeDetail } from "./journal-view";

export interface PlanningCalculationInput {
  direction: "long" | "short";
  avgEntry: number;
  quantity: number;
  contractMultiplier?: number | null;
  stopLoss?: number | null;
  profitTarget?: number | null;
  grossPnl?: number | null;
  isClosed?: boolean;
}

export interface PlanningCalculationResult {
  riskPerUnit: number | null;
  totalRisk: number | null;
  rewardPerUnit: number | null;
  totalReward: number | null;
  plannedR: number | null;
  plannedRFormatted: string | null;
  realizedR: number | null;
  realizedRFormatted: string | null;
  isStopValidForDirection: boolean;
  isTargetValidForDirection: boolean;
}

/**
 * Pure calculation logic for Trade Planning Risk / Reward HUD.
 * Handles Long vs Short direction geometry, position multiplier, and realized R outcome.
 */
export function computeTradePlanning(input: PlanningCalculationInput): PlanningCalculationResult {
  const {
    direction,
    avgEntry,
    quantity,
    contractMultiplier,
    stopLoss,
    profitTarget,
    grossPnl,
    isClosed,
  } = input;

  const multiplier = contractMultiplier && contractMultiplier > 0 ? contractMultiplier : 1;
  const isLong = direction === "long";

  // Risk calculation
  let riskPerUnit: number | null = null;
  let totalRisk: number | null = null;
  let isStopValidForDirection = true;

  if (stopLoss !== null && stopLoss !== undefined && Number.isFinite(stopLoss)) {
    const rawDiff = isLong ? avgEntry - stopLoss : stopLoss - avgEntry;
    isStopValidForDirection = rawDiff > 0;
    riskPerUnit = Math.abs(avgEntry - stopLoss);
    totalRisk = riskPerUnit * quantity * multiplier;
  }

  // Reward calculation
  let rewardPerUnit: number | null = null;
  let totalReward: number | null = null;
  let isTargetValidForDirection = true;

  if (profitTarget !== null && profitTarget !== undefined && Number.isFinite(profitTarget)) {
    const rawDiff = isLong ? profitTarget - avgEntry : avgEntry - profitTarget;
    isTargetValidForDirection = rawDiff > 0;
    rewardPerUnit = Math.abs(profitTarget - avgEntry);
    totalReward = rewardPerUnit * quantity * multiplier;
  }

  // Planned R:R
  let plannedR: number | null = null;
  let plannedRFormatted: string | null = null;

  if (
    riskPerUnit !== null &&
    rewardPerUnit !== null &&
    riskPerUnit > 0 &&
    isStopValidForDirection &&
    isTargetValidForDirection
  ) {
    plannedR = rewardPerUnit / riskPerUnit;
    plannedRFormatted = `1 : ${plannedR.toFixed(2)}R`;
  }

  // Realized R (if trade is closed and risk is known)
  let realizedR: number | null = null;
  let realizedRFormatted: string | null = null;

  if (
    isClosed &&
    grossPnl !== null &&
    grossPnl !== undefined &&
    totalRisk !== null &&
    totalRisk > 0 &&
    isStopValidForDirection
  ) {
    realizedR = grossPnl / totalRisk;
    realizedRFormatted = `${realizedR >= 0 ? "+" : ""}${realizedR.toFixed(2)}R`;
  }

  return {
    riskPerUnit,
    totalRisk,
    rewardPerUnit,
    totalReward,
    plannedR,
    plannedRFormatted,
    realizedR,
    realizedRFormatted,
    isStopValidForDirection,
    isTargetValidForDirection,
  };
}

/**
 * Standard fee formatting helper.
 * Fees represent a deduction/cost: always negative (-$X.XX) or zero ($0.00), NEVER positive (+$X.XX).
 */
export function formatFeeDisplay(fees: number, currency = "USD"): string {
  if (!fees || fees <= 0) {
    return fmtAmount(0, currency);
  }
  return fmtAmount(-Math.abs(fees), currency);
}

export interface TradePlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: TradeDetail;
  mae?: number | null;
  mfe?: number | null;
  dayJournalTitle?: string | null;
  dayDate?: string | null;
  hasDayJournal?: boolean;
  onSave?: (patches: {
    stopLoss?: number | null;
    profitTarget?: number | null;
    linkedJournalDate?: string | null;
  }) => Promise<void> | void;
}

export function TradePlanningModal({
  isOpen,
  onClose,
  trade,
  mae: propMae,
  mfe: propMfe,
  dayJournalTitle,
  dayDate,
  hasDayJournal,
  onSave,
}: TradePlanningModalProps) {
  const [stopInput, setStopInput] = useState<string>("");
  const [targetInput, setTargetInput] = useState<string>("");
  const [linkedJournalValue, setLinkedJournalValue] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync inputs with trade props on open
  useEffect(() => {
    if (isOpen) {
      setStopInput(trade.stopLoss !== null ? String(trade.stopLoss) : "");
      setTargetInput(trade.profitTarget !== null ? String(trade.profitTarget) : "");
      const initialJournal = trade.linkedJournalDate ?? "none";
      setLinkedJournalValue(initialJournal);
      setError(null);
      setSaving(false);
    }
  }, [isOpen, trade.stopLoss, trade.profitTarget, trade.linkedJournalDate]);

  // Connect to excursion estimates if not passed as props
  const { data: marketData } = useApi<{
    saved: {
      estimate: { mae: number | null; mfe: number | null };
    } | null;
  }>(
    isOpen && propMae === undefined && propMfe === undefined
      ? `/api/trades/${encodeURIComponent(trade.key)}/market-data`
      : null,
  );

  const effectiveMae = propMae !== undefined ? propMae : (marketData?.saved?.estimate?.mae ?? null);
  const effectiveMfe = propMfe !== undefined ? propMfe : (marketData?.saved?.estimate?.mfe ?? null);

  const parsedStop = useMemo(() => {
    const trimmed = stopInput.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }, [stopInput]);

  const parsedTarget = useMemo(() => {
    const trimmed = targetInput.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }, [targetInput]);

  const isClosed = trade.status !== "open" || Boolean(trade.closedAt);

  const calculations = useMemo(() => {
    return computeTradePlanning({
      direction: trade.direction,
      avgEntry: trade.avgEntry,
      quantity: trade.quantity,
      contractMultiplier: trade.contractMultiplier,
      stopLoss: parsedStop,
      profitTarget: parsedTarget,
      grossPnl: trade.grossPnl,
      isClosed,
    });
  }, [
    trade.direction,
    trade.avgEntry,
    trade.quantity,
    trade.contractMultiplier,
    parsedStop,
    parsedTarget,
    trade.grossPnl,
    isClosed,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (stopInput.trim() !== "" && parsedStop === null) {
      setError("Please enter a valid numeric Stop Loss price.");
      return;
    }
    if (targetInput.trim() !== "" && parsedTarget === null) {
      setError("Please enter a valid numeric Profit Target price.");
      return;
    }

    setSaving(true);
    try {
      const patches: {
        stopLoss: number | null;
        profitTarget: number | null;
        linkedJournalDate: string | null;
      } = {
        stopLoss: parsedStop,
        profitTarget: parsedTarget,
        linkedJournalDate: linkedJournalValue === "none" ? null : linkedJournalValue,
      };

      if (onSave) {
        await onSave(patches);
      } else {
        await postJson(`/api/trades/${encodeURIComponent(trade.key)}`, patches, "PATCH");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trade planning");
    } finally {
      setSaving(false);
    }
  };

  const isLong = trade.direction === "long";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[580px] p-5 sm:p-6 rounded-2xl border-border/70 shadow-2xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
            Trade Inspector & Planning
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Section 1: Verified Execution (Vela gradient heading + unboxed ledger) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground select-none">
              <span className="flex items-center gap-1.5">
                <Lock className="size-3 opacity-70" />
                <span>Verified Execution</span>
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
            </div>

            {/* Primary Identity: Direction, Symbol, Status, Account */}
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2">
                <AssetIcon symbol={trade.symbol} size="sm" />
                <span className="font-mono text-sm font-bold text-foreground tracking-tight">
                  {trade.symbol}
                </span>
                <DirectionBadge
                  direction={trade.direction}
                  size="xs"
                  className="h-5 px-2 text-[10px] leading-none"
                />
                <Badge
                  variant={
                    trade.status === "win"
                      ? "profit"
                      : trade.status === "loss"
                        ? "loss"
                        : "secondary"
                  }
                  className="h-5 px-2 text-[10px] font-semibold tracking-wider uppercase leading-none inline-flex items-center justify-center rounded-md border-transparent"
                >
                  {trade.status}
                </Badge>
              </div>
              <div
                className="text-[11px] font-mono text-muted-foreground tnum truncate max-w-[200px]"
                title={`Account: ${trade.accountId}`}
              >
                {trade.accountId || "Default Account"}
              </div>
            </div>

            {/* Clean Flat Ledger Grid (Unboxed, natural typography, tabular numbers) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Quantity
                </span>
                <span className="font-mono font-semibold text-foreground block tnum">
                  {fmtNumber(trade.quantity, 4)}{" "}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({trade.executionCount ?? 1} fills)
                  </span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Avg Entry
                </span>
                <span className="font-mono font-semibold text-foreground block tnum">
                  <MonetaryValue>{fmtAmount(trade.avgEntry, trade.currency)}</MonetaryValue>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Avg Exit
                </span>
                <span className="font-mono font-semibold text-foreground block tnum">
                  {trade.avgExit !== null ? (
                    <MonetaryValue>{fmtAmount(trade.avgExit, trade.currency)}</MonetaryValue>
                  ) : (
                    <span className="text-muted-foreground">Open</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Duration
                </span>
                <span className="font-mono font-semibold text-foreground block tnum">
                  {fmtDuration(trade.durationMs)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Gross P&L
                </span>
                <Pnl
                  value={trade.grossPnl}
                  currency={trade.currency}
                  className="font-mono text-xs font-semibold block"
                />
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Broker Fees
                </span>
                <span
                  className={cn(
                    "font-mono font-semibold text-xs block tnum",
                    trade.fees > 0 ? "text-loss/80" : "text-muted-foreground",
                  )}
                >
                  <MonetaryValue>{formatFeeDisplay(trade.fees, trade.currency)}</MonetaryValue>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  Net P&L
                </span>
                <Pnl
                  value={trade.netPnl}
                  currency={trade.currency}
                  className="font-mono text-xs font-bold block"
                />
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                  MFE / MAE
                </span>
                <span className="font-mono text-xs block tnum">
                  <span
                    className={
                      effectiveMfe !== null && effectiveMfe > 0
                        ? "text-profit font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {effectiveMfe !== null
                      ? effectiveMfe > 0
                        ? fmtMoney(effectiveMfe, trade.currency).replace(/^\+?/, "+")
                        : fmtAmount(0, trade.currency)
                      : "–"}
                  </span>
                  <span className="text-muted-foreground/40 mx-1">/</span>
                  <span
                    className={
                      effectiveMae !== null && effectiveMae > 0
                        ? "text-loss font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {effectiveMae !== null
                      ? effectiveMae > 0
                        ? fmtAmount(-Math.abs(effectiveMae), trade.currency)
                        : fmtAmount(0, trade.currency)
                      : "–"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Trade Planning (Vela gradient heading + clean inputs + inline HUD) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground select-none">
              <span>Trade Planning</span>
              <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Stop Loss Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="plan-stop-loss" className="text-xs font-medium text-foreground">
                    Planned Stop Loss
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {isLong ? "< Entry" : "> Entry"}
                  </span>
                </div>
                <Input
                  id="plan-stop-loss"
                  type="number"
                  step="any"
                  placeholder={isLong ? "Price below entry..." : "Price above entry..."}
                  value={stopInput}
                  onChange={(e) => setStopInput(e.target.value)}
                  className="font-mono tnum h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors text-foreground"
                  autoFocus
                />
                {!calculations.isStopValidForDirection && parsedStop !== null && (
                  <p className="text-[10px] text-loss font-medium leading-tight">
                    {isLong
                      ? "Stop is at or above entry for Long."
                      : "Stop is at or below entry for Short."}
                  </p>
                )}
              </div>

              {/* Profit Target Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="plan-profit-target"
                    className="text-xs font-medium text-foreground"
                  >
                    Planned Profit Target
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {isLong ? "> Entry" : "< Entry"}
                  </span>
                </div>
                <Input
                  id="plan-profit-target"
                  type="number"
                  step="any"
                  placeholder={isLong ? "Price above entry..." : "Price below entry..."}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="font-mono tnum h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors text-foreground"
                />
                {!calculations.isTargetValidForDirection && parsedTarget !== null && (
                  <p className="text-[10px] text-loss font-medium leading-tight">
                    {isLong
                      ? "Target is at or below entry for Long."
                      : "Target is at or above entry for Short."}
                  </p>
                )}
              </div>
            </div>

            {/* Inline Minimalist HUD Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono tnum">
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground text-[11px]">
                  Risk:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      calculations.totalRisk !== null ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {calculations.totalRisk !== null
                      ? fmtAmount(-Math.abs(calculations.totalRisk), trade.currency)
                      : "–"}
                  </span>
                  {calculations.riskPerUnit !== null && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({fmtNumber(calculations.riskPerUnit, 2)} pts)
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-muted-foreground text-[11px]">
                  Reward:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      calculations.totalReward !== null ? "text-profit" : "text-muted-foreground",
                    )}
                  >
                    {calculations.totalReward !== null
                      ? fmtAmount(calculations.totalReward, trade.currency)
                      : "–"}
                  </span>
                  {calculations.rewardPerUnit !== null && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({fmtNumber(calculations.rewardPerUnit, 2)} pts)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">Planned R:R:</span>
                <span className="font-semibold text-foreground px-1.5 py-0.5 rounded bg-background border border-border/60 text-[11px]">
                  {calculations.plannedRFormatted ?? "–"}
                </span>
                {isClosed && calculations.realizedRFormatted && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-muted-foreground text-[11px]">Realized:</span>
                    <span
                      className={cn(
                        "font-semibold text-[11px]",
                        calculations.realizedR !== null && calculations.realizedR >= 0
                          ? "text-profit"
                          : "text-loss",
                      )}
                    >
                      {calculations.realizedRFormatted}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Session Journal Link (Vela gradient heading + clean select) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground select-none">
              <span>Session Journal</span>
              <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="linked-journal" className="text-xs font-medium text-foreground">
                Linked Session Journal
              </Label>
              <Select value={linkedJournalValue} onValueChange={setLinkedJournalValue}>
                <SelectTrigger
                  id="linked-journal"
                  className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors text-foreground"
                >
                  <SelectValue placeholder="Select a session journal to link..." />
                </SelectTrigger>
                <SelectContent>
                  {hasDayJournal && dayDate && (
                    <SelectItem value={dayDate} className="text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-3.5 text-muted-foreground" />
                        <span>{dayJournalTitle || `${trade.symbol} Journal`}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({dayDate})
                        </span>
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="none" className="text-xs">
                    <span className="text-muted-foreground">
                      No linked journal (Standalone trade)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="h-8 px-3 text-xs rounded-lg border-border/70 text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="h-8 px-4 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-transform active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
