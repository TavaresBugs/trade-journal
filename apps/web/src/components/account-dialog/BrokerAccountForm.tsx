"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeZonePicker } from "@/components/timezone-picker";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { HoverHint, TooltipProvider } from "@/components/ui/tooltip";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import { BROKER_CATALOG, getBrokerMetadata } from "@/lib/brokers/broker-catalog";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface BrokerAccountFormProps {
  initialBroker?: string;
  initialAccountNumber?: string;
  initialName?: string;
  initialBalance?: number | string;
  initialMaxDrawdown?: number | string;
  onSuccess: (newAccountId: string) => void;
}

export function BrokerAccountForm({
  initialBroker,
  initialAccountNumber,
  initialName,
  initialBalance,
  initialMaxDrawdown,
  onSuccess,
}: BrokerAccountFormProps) {
  const [brokerId, setBrokerId] = useState(initialBroker || "ibkr");
  const [brokerAccountName, setBrokerAccountName] = useState(initialName || "");
  const [brokerAccountNumber, setBrokerAccountNumber] = useState(initialAccountNumber || "");
  const [brokerBalance, setBrokerBalance] = useState(
    initialBalance !== undefined ? String(initialBalance) : "10000",
  );
  const [brokerMaxDrawdown, setBrokerMaxDrawdown] = useState(
    initialMaxDrawdown !== undefined ? String(initialMaxDrawdown) : "",
  );
  const [brokerCurrency, setBrokerCurrency] = useState("USD");
  const [brokerTimeZone, setBrokerTimeZone] = useState("America/New_York");
  const [brokerProfitCalc, setBrokerProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerError, setBrokerError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccountNumber !== undefined) setBrokerAccountNumber(initialAccountNumber);
    if (initialBroker !== undefined) {
      setBrokerId(initialBroker);
      const meta = getBrokerMetadata(initialBroker);
      if (meta?.defaultTimeZone) {
        setBrokerTimeZone(meta.defaultTimeZone);
      }
    }
    if (initialName !== undefined) setBrokerAccountName(initialName);
    if (initialBalance !== undefined) setBrokerBalance(String(initialBalance));
    if (initialMaxDrawdown !== undefined) setBrokerMaxDrawdown(String(initialMaxDrawdown));
  }, [initialAccountNumber, initialBroker, initialName, initialBalance, initialMaxDrawdown]);

  const handleBrokerChange = (id: string) => {
    setBrokerId(id);
    const meta = getBrokerMetadata(id);
    if (meta?.defaultTimeZone) {
      setBrokerTimeZone(meta.defaultTimeZone);
    }
  };

  const handleCreateBrokerAccount = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBrokerBusy(true);
    setBrokerError(null);

    const meta = getBrokerMetadata(brokerId);
    const finalName =
      brokerAccountName.trim() ||
      `${meta?.name || "Broker"} Account${brokerAccountNumber.trim() ? ` (${brokerAccountNumber.trim()})` : ""}`;

    try {
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: finalName,
        kind: "manual",
        broker: brokerId,
        platform: meta?.platform || null,
        accountNumber: brokerAccountNumber.trim() || null,
        currency: brokerCurrency.toUpperCase().trim() || "USD",
        initialBalance: brokerBalance ? Number(brokerBalance) : 0,
        maxDrawdown: brokerMaxDrawdown ? Number(brokerMaxDrawdown) : null,
        timeZone: brokerTimeZone || "America/New_York",
        profitCalcMethod: brokerProfitCalc,
      });
      onSuccess(res.id);
    } catch (cause) {
      setBrokerError(cause instanceof Error ? cause.message : "Failed to create broker account.");
    } finally {
      setBrokerBusy(false);
    }
  };

  const selectedBrokerMeta = BROKER_CATALOG.find((b) => b.id === brokerId);

  return (
    <form onSubmit={handleCreateBrokerAccount} className="space-y-3.5">
      {/* Row 1: Broker or Platform */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label htmlFor="broker-select" className="text-xs font-medium text-foreground">
            Broker or Platform
          </Label>
        </div>
        <Select value={brokerId} onValueChange={handleBrokerChange}>
          <SelectTrigger
            id="broker-select"
            className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          >
            <SelectValue placeholder="Choose broker">
              {selectedBrokerMeta ? (
                <div className="flex items-center gap-2">
                  <BrokerIcon
                    icon={selectedBrokerMeta.icon}
                    iconDark={selectedBrokerMeta.iconDark}
                    name={selectedBrokerMeta.name}
                    className="size-4 rounded-sm object-contain shrink-0"
                  />
                  <span className="truncate">{selectedBrokerMeta.name}</span>
                </div>
              ) : (
                <span>Choose broker</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Supported Direct Brokers &amp; Platforms
              </SelectLabel>
              {BROKER_CATALOG.filter(
                (b) =>
                  b.category === "platform" ||
                  b.category === "stocks" ||
                  b.category === "forex-cfd" ||
                  b.category === "futures",
              ).map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs cursor-pointer">
                  <div className="flex items-center gap-2">
                    <BrokerIcon
                      icon={b.icon}
                      iconDark={b.iconDark}
                      name={b.name}
                      className="size-4 rounded-sm object-contain"
                    />
                    <span>{b.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Account Name & Account ID */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="broker-account-name" className="text-xs font-medium text-foreground">
              Account Name
            </Label>
          </div>
          <Input
            id="broker-account-name"
            value={brokerAccountName}
            onChange={(e) => setBrokerAccountName(e.target.value)}
            placeholder="e.g. IBKR Pro Margin, Schwab Individual"
            className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="broker-account-number" className="text-xs font-medium text-foreground">
              Account ID / Number
            </Label>
            <span className="font-mono text-[10px] text-muted-foreground/80">
              Auto-match on import
            </span>
          </div>
          <Input
            id="broker-account-number"
            value={brokerAccountNumber}
            onChange={(e) => setBrokerAccountNumber(e.target.value)}
            placeholder="e.g. U12345678"
            className="h-9 text-xs font-mono rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          />
        </div>
      </div>

      {/* Row 3: Initial Balance, Max Drawdown & Currency in 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="broker-balance" className="text-xs font-medium text-foreground">
              Initial Balance ({getCurrencyInfo(brokerCurrency).symbol})
            </Label>
          </div>
          <Input
            id="broker-balance"
            type="number"
            step="any"
            value={brokerBalance}
            onChange={(e) => setBrokerBalance(e.target.value)}
            placeholder="10000"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="broker-max-dd" className="text-xs font-medium text-foreground">
              Max Drawdown ({getCurrencyInfo(brokerCurrency).symbol})
            </Label>
          </div>
          <Input
            id="broker-max-dd"
            type="number"
            step="any"
            value={brokerMaxDrawdown}
            onChange={(e) => setBrokerMaxDrawdown(e.target.value)}
            placeholder="Optional"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="broker-currency" className="text-xs font-medium text-foreground">
              Currency
            </Label>
          </div>
          <Select value={brokerCurrency} onValueChange={setBrokerCurrency}>
            <SelectTrigger
              id="broker-currency"
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            >
              <SelectValue placeholder="Currency">
                <CurrencyBadge code={brokerCurrency} />
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

      {/* Row 4: Statement Server Timezone */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label className="text-xs font-medium text-foreground">Statement Server Timezone</Label>
          <span className="font-mono text-[10px] text-muted-foreground/80">
            {formatZoneOffset(brokerTimeZone)}
          </span>
        </div>
        <TimeZonePicker
          id="broker-account-tz"
          label="Statement timezone"
          value={brokerTimeZone}
          onValueChange={setBrokerTimeZone}
        />
      </div>

      {/* Row 5: Profit Calculation Method */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label className="text-xs font-medium text-foreground">Profit Calculation Method</Label>
          <span className="font-mono text-[10px] uppercase text-muted-foreground/80 tracking-wider">
            {brokerProfitCalc}
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
                onClick={() => setBrokerProfitCalc("fifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  brokerProfitCalc === "fifo"
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
                onClick={() => setBrokerProfitCalc("lifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  brokerProfitCalc === "lifo"
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
                onClick={() => setBrokerProfitCalc("wavg")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  brokerProfitCalc === "wavg"
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
          {brokerProfitCalc === "fifo" &&
            "First In, First Out — standard accounting rule for Prop Firms and Forex brokers."}
          {brokerProfitCalc === "lifo" &&
            "Last In, First Out — matches closing orders against most recent positions."}
          {brokerProfitCalc === "wavg" &&
            "Weighted Average — computes the average entry price across all open lots."}
        </p>
      </div>

      {brokerError && (
        <p role="alert" className="text-xs text-destructive">
          {brokerError}
        </p>
      )}

      <Button
        type="submit"
        disabled={brokerBusy}
        className="w-full h-9 text-xs font-medium cursor-pointer active:scale-[0.98] transition-transform duration-100 mt-2"
      >
        {brokerBusy ? "Creating broker account…" : "Create Broker Account"}
      </Button>
    </form>
  );
}
