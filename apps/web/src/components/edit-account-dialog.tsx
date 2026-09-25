"use client";

import { useEffect, useState } from "react";
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
import { BROKER_CATALOG, getBrokerInfo, SUPPORTED_PLATFORMS } from "@/lib/brokers/broker-catalog";
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
  };

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
      <DialogContent className="sm:max-w-[460px] p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
            Account Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage broker connection, timezone offsets, and accounting rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Account Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-account-name" className="text-xs font-medium text-foreground">
              Account Name
            </Label>
            <Input
              id="edit-account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FTMO 100k Challenge, Topstep 50k"
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Account Statement Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-account-number" className="text-xs font-medium text-foreground">
                Account ID / Number
              </Label>
              <span className="text-[10px] text-muted-foreground">Auto-match on import</span>
            </div>
            <Input
              id="edit-account-number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. LFE0506847043001, APEX-123456"
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Statements containing this account ID will automatically bind to this journal.
            </p>
          </div>

          {/* Broker / Prop Firm */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-account-broker" className="text-xs font-medium text-foreground">
              Broker or Prop Firm
            </Label>
            <Select
              value={broker || "custom"}
              onValueChange={(val) => handleSelectBroker(val === "custom" ? "" : val)}
            >
              <SelectTrigger id="edit-account-broker" className="h-9 text-xs">
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
                      {selectedBrokerInfo.platformName && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          ({selectedBrokerInfo.platformName})
                        </span>
                      )}
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
                        {item.platformName && (
                          <span className="text-[11px] text-muted-foreground">
                            ({item.platformName})
                          </span>
                        )}
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
                        {item.platformName && item.platformName !== item.name && (
                          <span className="text-[11px] text-muted-foreground">
                            ({item.platformName})
                          </span>
                        )}
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

                <SelectItem value="custom" className="cursor-pointer text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Landmark className="size-4 shrink-0 opacity-70" />
                    <span>Custom / No broker linked</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Execution Platform */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="edit-account-platform"
                className="text-xs font-medium text-foreground"
              >
                Execution Platform
              </Label>
              {platform ? (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-1.5 py-0 text-muted-foreground border-border/70"
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
              <SelectTrigger id="edit-account-platform" className="h-9 text-xs">
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
                <SelectItem value="auto" className="cursor-pointer text-xs">
                  Auto-detect from statement
                </SelectItem>
                {SUPPORTED_PLATFORMS.map((plat) => (
                  <SelectItem key={plat.value} value={plat.value} className="cursor-pointer text-xs">
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

          {/* Statement Server Timezone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-account-tz" className="text-xs font-medium text-foreground">
                Statement Server Timezone
              </Label>
              <Badge
                variant="outline"
                className="font-mono text-[10px] h-4.5 px-1.5 py-0 text-muted-foreground border-border/70"
              >
                {formatZoneOffset(timeZone)}
              </Badge>
            </div>
            <TimeZonePicker
              id="edit-account-tz"
              label="Statement Server Timezone"
              value={timeZone}
              onValueChange={setTimeZone}
            />
            {selectedBrokerInfo?.defaultTimeZone &&
            timeZone !== selectedBrokerInfo.defaultTimeZone ? (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>
                  Official server time:{" "}
                  <strong className="text-foreground">{selectedBrokerInfo.defaultTimeZone}</strong>{" "}
                  ({formatZoneOffset(selectedBrokerInfo.defaultTimeZone)})
                </span>
                <button
                  type="button"
                  onClick={() => setTimeZone(selectedBrokerInfo.defaultTimeZone)}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  Apply official
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Used to translate statement timestamps into UTC.
              </p>
            )}
          </div>

          {/* Initial Balance, Max Drawdown & Currency */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-account-balance" className="text-xs font-medium text-foreground">
                Initial Balance ({getCurrencyInfo(currency).symbol})
              </Label>
              <Input
                id="edit-account-balance"
                type="number"
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="50000"
                className="h-9 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-account-max-dd" className="text-xs font-medium text-foreground">
                Max Drawdown ({getCurrencyInfo(currency).symbol})
              </Label>
              <Input
                id="edit-account-max-dd"
                type="number"
                step="any"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                placeholder="2000"
                className="h-9 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-account-currency"
                className="text-xs font-medium text-foreground"
              >
                Currency
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="edit-account-currency" className="h-9 text-xs">
                  <SelectValue placeholder="Currency">
                    <CurrencyBadge code={currency} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {CURRENCY_LIST.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      <CurrencyBadge code={c.code} showName />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Profit Calculation Method (Tactile Segmented Control) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">
                Profit Calculation Method
              </Label>
              <span className="font-mono text-[10px] uppercase text-muted-foreground/80">
                {profitCalcMethod}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setProfitCalcMethod("fifo")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center",
                  profitCalcMethod === "fifo"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                FIFO
              </button>
              <button
                type="button"
                onClick={() => setProfitCalcMethod("lifo")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center",
                  profitCalcMethod === "lifo"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                LIFO
              </button>
              <button
                type="button"
                onClick={() => setProfitCalcMethod("wavg")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center",
                  profitCalcMethod === "wavg"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                Weighted Avg
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
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
              className="cursor-pointer h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="cursor-pointer font-medium h-8 text-xs px-3"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
