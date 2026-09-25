"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { TimeZonePicker } from "@/components/timezone-picker";
import { HoverHint, TooltipProvider } from "@/components/ui/tooltip";
import {
  BROKER_CATALOG,
  getBrokerInfo,
  getPlatformOptionsForBroker,
  SUPPORTED_PLATFORMS,
} from "@/lib/brokers/broker-catalog";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/types/accounts";

export interface EditAccountDialogProps {
  account: AccountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountUpdated: () => void;
}

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
  onAccountUpdated,
}: EditAccountDialogProps) {
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [broker, setBroker] = useState("");
  const [platform, setPlatform] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [initialBalance, setInitialBalance] = useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("");
  const [profitCalcMethod, setProfitCalcMethod] = useState("fifo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name || "");
      setAccountNumber(account.accountNumber || "");
      setBroker(account.broker || "");
      setPlatform(account.platform || "");
      setTimeZone(account.timeZone || "UTC");
      setCurrency(account.currency || "USD");
      setInitialBalance(
        account.initialBalance !== undefined && account.initialBalance !== null
          ? String(account.initialBalance)
          : "",
      );
      setMaxDrawdown(
        account.maxDrawdown !== undefined && account.maxDrawdown !== null
          ? String(account.maxDrawdown)
          : "",
      );
      setProfitCalcMethod(account.profitCalcMethod || "fifo");
      setError(null);
    }
  }, [account, open]);

  const selectedBrokerInfo = getBrokerInfo(broker, platform);

  const handleSelectBroker = (brokerId: string) => {
    setBroker(brokerId);
    const info = getBrokerInfo(brokerId, platform);
    if (info?.defaultTimeZone && (timeZone === "UTC" || !timeZone)) {
      setTimeZone(info.defaultTimeZone);
    }
    if (brokerId && brokerId !== "custom") {
      const allowed = getPlatformOptionsForBroker(brokerId)
        .map((p) => p.value)
        .filter((v) => v !== "auto");
      if (allowed.length > 0 && platform && !allowed.includes(platform)) {
        setPlatform(info?.platform || "");
      }
    }
  };

  const availablePlatforms = useMemo(() => {
    if (!broker || broker === "custom") {
      return [{ value: "auto", label: "Auto-detect from statement" }, ...SUPPORTED_PLATFORMS];
    }
    const brokerOpts = getPlatformOptionsForBroker(broker);
    const withoutAuto = brokerOpts.filter((p) => p.value !== "auto");
    if (withoutAuto.length > 0) {
      return [{ value: "auto", label: "Auto-detect from statement" }, ...withoutAuto];
    }
    return [{ value: "auto", label: "Auto-detect from statement" }, ...SUPPORTED_PLATFORMS];
  }, [broker]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    if (!name.trim()) {
      setError("Account name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await postJson(
        `/api/accounts/${account.id}`,
        {
          name: name.trim(),
          accountNumber: accountNumber.trim() || null,
          broker: broker.trim(),
          platform: platform ? platform.trim() : null,
          timeZone: timeZone || "UTC",
          currency: currency.toUpperCase().trim() || "USD",
          initialBalance: initialBalance ? Number(initialBalance) : 0,
          maxDrawdown: maxDrawdown ? Number(maxDrawdown) : null,
          profitCalcMethod,
        },
        "PATCH",
      );
      onAccountUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] p-6 rounded-2xl border-border/70 shadow-xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-balance">
            Account Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground text-pretty">
            Manage broker connection, timezone offsets, and accounting rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Row 1: Account Identity (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-name"
                  className="text-xs font-medium text-foreground flex items-center gap-1"
                >
                  <span>Account Name</span>
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                id="edit-account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. FTMO 100k Challenge, Topstep 50k"
                className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-number"
                  className="text-xs font-medium text-foreground"
                >
                  Account ID / Number
                </Label>
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-1.5 py-0 text-muted-foreground border-border/70 leading-none inline-flex items-center"
                >
                  Auto-match on import
                </Badge>
              </div>
              <Input
                id="edit-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. LFE0506847043001, 530319802"
                className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
              />
            </div>
          </div>

          {/* Row 2: Broker & Execution Platform (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-broker"
                  className="text-xs font-medium text-foreground"
                >
                  Broker or Prop Firm
                </Label>
              </div>
              <Select
                value={broker || "custom"}
                onValueChange={(val) => handleSelectBroker(val === "custom" ? "" : val)}
              >
                <SelectTrigger
                  id="edit-account-broker"
                  className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
                >
                  <SelectValue placeholder="Select broker or platform">
                    {selectedBrokerInfo ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <BrokerIcon
                          icon={selectedBrokerInfo.icon || "default.png"}
                          iconDark={selectedBrokerInfo.iconDark}
                          name={selectedBrokerInfo.name}
                          invertInDark={selectedBrokerInfo.invertInDark}
                          className="size-4.5 rounded-sm object-contain shrink-0"
                        />
                        <span className="font-medium text-foreground truncate">
                          {selectedBrokerInfo.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Landmark className="size-4 shrink-0 opacity-70" />
                        <span>Custom / No broker linked</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Prop Firms
                    </SelectLabel>
                    {BROKER_CATALOG.filter((b) => b.category === "prop-firm").map((item) => (
                      <SelectItem key={item.id} value={item.id} className="cursor-pointer text-xs">
                        <div className="flex items-center gap-2">
                          <BrokerIcon
                            icon={item.icon}
                            iconDark={item.iconDark}
                            name={item.name}
                            invertInDark={item.invertInDark}
                            className="size-4 rounded-sm object-contain shrink-0"
                          />
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Platforms & Direct Brokers
                    </SelectLabel>
                    {BROKER_CATALOG.filter(
                      (b) =>
                        b.category === "platform" ||
                        b.category === "forex-cfd" ||
                        b.category === "stocks" ||
                        b.category === "futures",
                    ).map((item) => (
                      <SelectItem key={item.id} value={item.id} className="cursor-pointer text-xs">
                        <div className="flex items-center gap-2">
                          <BrokerIcon
                            icon={item.icon}
                            iconDark={item.iconDark}
                            name={item.name}
                            invertInDark={item.invertInDark}
                            className="size-4 rounded-sm object-contain shrink-0"
                          />
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Crypto Exchanges
                    </SelectLabel>
                    {BROKER_CATALOG.filter((b) => b.category === "crypto").map((item) => (
                      <SelectItem key={item.id} value={item.id} className="cursor-pointer text-xs">
                        <div className="flex items-center gap-2">
                          <BrokerIcon
                            icon={item.icon}
                            iconDark={item.iconDark}
                            name={item.name}
                            invertInDark={item.invertInDark}
                            className="size-4 rounded-sm object-contain shrink-0"
                          />
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectItem
                    value="custom"
                    className="cursor-pointer text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Landmark className="size-4 shrink-0 opacity-70" />
                      <span>Custom / No broker linked</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-platform"
                  className="text-xs font-medium text-foreground"
                >
                  Execution Platform
                </Label>
                {platform ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4.5 px-1.5 py-0 text-muted-foreground border-border/70 leading-none inline-flex items-center"
                  >
                    Bound from import
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Auto-detected from file</span>
                )}
              </div>
              <Select
                value={platform || "auto"}
                onValueChange={(val) => setPlatform(val === "auto" ? "" : val)}
              >
                <SelectTrigger
                  id="edit-account-platform"
                  className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
                >
                  <SelectValue placeholder="Auto-detect from statement">
                    {selectedBrokerInfo?.platformName ? (
                      <div className="flex items-center gap-2">
                        {selectedBrokerInfo.platformIcon && (
                          <BrokerIcon
                            icon={selectedBrokerInfo.platformIcon}
                            name={selectedBrokerInfo.platformName}
                            className="size-4 rounded-sm object-contain shrink-0"
                          />
                        )}
                        <span className="font-medium text-foreground truncate">
                          {selectedBrokerInfo.platformName}
                        </span>
                        {!platform && (
                          <span className="text-[11px] text-muted-foreground">(Default)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Auto-detect from statement</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {availablePlatforms.map((plat) => (
                    <SelectItem
                      key={plat.value}
                      value={plat.value}
                      className="cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {plat.icon && (
                          <BrokerIcon
                            icon={plat.icon}
                            name={plat.label}
                            className="size-4 rounded-sm object-contain"
                          />
                        )}
                        <span>{plat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Statement Server Timezone (Full Width) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between h-5">
              <Label htmlFor="edit-account-tz" className="text-xs font-medium text-foreground">
                Statement Server Timezone
              </Label>
              <Badge
                variant="outline"
                className="font-mono text-[10px] h-4.5 px-1.5 py-0 text-muted-foreground border-border/70 tnum leading-none inline-flex items-center"
              >
                {formatZoneOffset(timeZone)}
              </Badge>
            </div>
            <TimeZonePicker
              id="edit-account-tz"
              label="Statement Server Timezone"
              value={timeZone}
              onValueChange={setTimeZone}
              className="bg-background/80 border-border/70 hover:bg-background hover:border-border"
            />
            {selectedBrokerInfo?.defaultTimeZone &&
            timeZone !== selectedBrokerInfo.defaultTimeZone ? (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="truncate">
                  Official:{" "}
                  <strong className="text-foreground">{selectedBrokerInfo.defaultTimeZone}</strong>{" "}
                  ({formatZoneOffset(selectedBrokerInfo.defaultTimeZone)})
                </span>
                <button
                  type="button"
                  onClick={() => setTimeZone(selectedBrokerInfo.defaultTimeZone)}
                  className="font-medium text-primary hover:underline cursor-pointer active:scale-[0.98] transition-transform duration-100 text-[11px] shrink-0 ml-1"
                >
                  Apply official
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-pretty truncate pt-0.5">
                Used to translate statement timestamps into UTC.
              </p>
            )}
          </div>

          {/* Row 4: Initial Balance, Max Drawdown & Currency (3 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-balance"
                  className="text-xs font-medium text-foreground"
                >
                  Initial Balance ({getCurrencyInfo(currency).symbol})
                </Label>
              </div>
              <Input
                id="edit-account-balance"
                type="number"
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="50000"
                className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-max-dd"
                  className="text-xs font-medium text-foreground"
                >
                  Max Drawdown ({getCurrencyInfo(currency).symbol})
                </Label>
              </div>
              <Input
                id="edit-account-max-dd"
                type="number"
                step="any"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                placeholder="2000"
                className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5">
                <Label
                  htmlFor="edit-account-currency"
                  className="text-xs font-medium text-foreground"
                >
                  Currency
                </Label>
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger
                  id="edit-account-currency"
                  className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
                >
                  <SelectValue placeholder="Currency">
                    <CurrencyBadge code={currency} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {CURRENCY_LIST.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs cursor-pointer">
                      <CurrencyBadge code={c.code} showName />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Profit Calculation Method (Tactile Segmented Control with Hover Tooltips) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between h-5">
              <Label className="text-xs font-medium text-foreground">
                Profit Calculation Method
              </Label>
              <span className="font-mono text-[10px] uppercase text-muted-foreground/80 tracking-wider">
                {profitCalcMethod}
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
                    onClick={() => setProfitCalcMethod("fifo")}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                      profitCalcMethod === "fifo"
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
                    onClick={() => setProfitCalcMethod("lifo")}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                      profitCalcMethod === "lifo"
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
                    onClick={() => setProfitCalcMethod("wavg")}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                      profitCalcMethod === "wavg"
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
              {profitCalcMethod === "fifo" &&
                "First In, First Out — standard accounting rule for Prop Firms and Forex brokers."}
              {profitCalcMethod === "lifo" &&
                "Last In, First Out — matches closing orders against most recent positions."}
              {profitCalcMethod === "wavg" &&
                "Weighted Average — computes the average entry price across all open lots."}
            </p>
          </div>

          <DialogFooter className="mt-5 border-t border-border/50 pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="cursor-pointer h-8.5 text-xs active:scale-[0.98] transition-transform duration-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="cursor-pointer font-medium h-8.5 text-xs px-4 active:scale-[0.98] transition-transform duration-100"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
