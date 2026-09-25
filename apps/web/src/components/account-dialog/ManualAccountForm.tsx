"use client";

import { useEffect, useState } from "react";
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
import { TimeZonePicker } from "@/components/timezone-picker";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { HoverHint, TooltipProvider } from "@/components/ui/tooltip";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface ManualAccountFormProps {
  initialName?: string;
  initialBalance?: number | string;
  initialMaxDrawdown?: number | string;
  onSuccess: (newAccountId: string) => void;
}

export function ManualAccountForm({
  initialName,
  initialBalance,
  initialMaxDrawdown,
  onSuccess,
}: ManualAccountFormProps) {
  const [manualName, setManualName] = useState(initialName || "");
  const [manualCurrency, setManualCurrency] = useState("USD");
  const [manualBalance, setManualBalance] = useState(
    initialBalance !== undefined ? String(initialBalance) : "",
  );
  const [manualMaxDrawdown, setManualMaxDrawdown] = useState(
    initialMaxDrawdown !== undefined ? String(initialMaxDrawdown) : "",
  );
  const [manualTimeZone, setManualTimeZone] = useState("America/New_York");
  const [manualProfitCalc, setManualProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (initialName !== undefined) setManualName(initialName);
    if (initialBalance !== undefined) setManualBalance(String(initialBalance));
    if (initialMaxDrawdown !== undefined) setManualMaxDrawdown(String(initialMaxDrawdown));
  }, [initialName, initialBalance, initialMaxDrawdown]);

  const handleCreateManual = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!manualName.trim()) {
      setManualError("Account name is required.");
      return;
    }
    setManualBusy(true);
    setManualError(null);

    try {
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: manualName.trim(),
        kind: "manual",
        currency: manualCurrency.trim().toUpperCase() || "USD",
        initialBalance: manualBalance.trim() ? Number(manualBalance) : 0,
        maxDrawdown: manualMaxDrawdown.trim() ? Number(manualMaxDrawdown) : null,
        timeZone: manualTimeZone || "America/New_York",
        profitCalcMethod: manualProfitCalc,
      });
      onSuccess(res.id);
    } catch (cause) {
      setManualError(cause instanceof Error ? cause.message : "Failed to create manual account.");
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <form onSubmit={handleCreateManual} className="space-y-3.5">
      {/* Row 1: Account Name */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label htmlFor="manual-account-name" className="text-xs font-medium text-foreground">
            Account Name
          </Label>
        </div>
        <Input
          id="manual-account-name"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="e.g. Paper Trading Account, Personal Swing"
          className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          required
        />
      </div>

      {/* Row 2: Initial Balance, Max Drawdown & Currency in 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="manual-balance" className="text-xs font-medium text-foreground">
              Initial Balance ({getCurrencyInfo(manualCurrency).symbol})
            </Label>
          </div>
          <Input
            id="manual-balance"
            type="number"
            step="any"
            value={manualBalance}
            onChange={(e) => setManualBalance(e.target.value)}
            placeholder="Optional"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="manual-max-dd" className="text-xs font-medium text-foreground">
              Max Drawdown ({getCurrencyInfo(manualCurrency).symbol})
            </Label>
          </div>
          <Input
            id="manual-max-dd"
            type="number"
            step="any"
            value={manualMaxDrawdown}
            onChange={(e) => setManualMaxDrawdown(e.target.value)}
            placeholder="Optional"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="manual-currency" className="text-xs font-medium text-foreground">
              Currency
            </Label>
          </div>
          <Select value={manualCurrency} onValueChange={setManualCurrency}>
            <SelectTrigger
              id="manual-currency"
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            >
              <SelectValue placeholder="Currency">
                <CurrencyBadge code={manualCurrency} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CURRENCY_LIST.map((curr) => (
                <SelectItem key={curr.code} value={curr.code} className="text-xs cursor-pointer">
                  <CurrencyBadge code={curr.code} showName />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Statement Server Timezone */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label className="text-xs font-medium text-foreground">Statement Server Timezone</Label>
          <span className="font-mono text-[10px] text-muted-foreground/80">
            {formatZoneOffset(manualTimeZone)}
          </span>
        </div>
        <TimeZonePicker
          id="manual-account-tz"
          label="Statement timezone"
          value={manualTimeZone}
          onValueChange={setManualTimeZone}
        />
      </div>

      {/* Row 4: Profit Calculation Method */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label className="text-xs font-medium text-foreground">Profit Calculation Method</Label>
          <span className="font-mono text-[10px] uppercase text-muted-foreground/80 tracking-wider">
            {manualProfitCalc}
          </span>
        </div>
        <TooltipProvider delayDuration={150}>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
            <HoverHint
              heading="FIFO (First In, First Out)"
              content="Matches closing orders against the oldest open positions. Standard required accounting for Prop Firms and Forex brokers."
              side="top"
            >
              <button
                type="button"
                onClick={() => setManualProfitCalc("fifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  manualProfitCalc === "fifo"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                FIFO
              </button>
            </HoverHint>
            <HoverHint
              heading="LIFO (Last In, First Out)"
              content="Matches closing orders against the most recent open positions first. Useful for scalping inside swing positions."
              side="top"
            >
              <button
                type="button"
                onClick={() => setManualProfitCalc("lifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  manualProfitCalc === "lifo"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                LIFO
              </button>
            </HoverHint>
            <HoverHint
              heading="Weighted Average (WAVG)"
              content="Calculates a single volume-weighted average entry price across all open lots before computing PnL on exits."
              side="top"
            >
              <button
                type="button"
                onClick={() => setManualProfitCalc("wavg")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  manualProfitCalc === "wavg"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                Weighted Avg
              </button>
            </HoverHint>
          </div>
        </TooltipProvider>
        <p className="text-[11px] text-muted-foreground text-pretty leading-normal">
          {manualProfitCalc === "fifo" &&
            "First In, First Out — standard accounting rule for Prop Firms and Forex brokers."}
          {manualProfitCalc === "lifo" &&
            "Last In, First Out — matches closing orders against most recent positions."}
          {manualProfitCalc === "wavg" &&
            "Weighted Average — computes the average entry price across all open lots."}
        </p>
      </div>

      {manualError && (
        <p role="alert" className="text-xs text-destructive">
          {manualError}
        </p>
      )}

      <Button
        type="submit"
        disabled={manualBusy || !manualName.trim()}
        className="w-full h-9 text-xs font-medium cursor-pointer active:scale-[0.98] transition-transform duration-100 mt-2"
      >
        {manualBusy ? "Creating account…" : "Create Manual Account"}
      </Button>
    </form>
  );
}
