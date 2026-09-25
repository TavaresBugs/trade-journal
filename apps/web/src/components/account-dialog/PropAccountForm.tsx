"use client";

import { useEffect, useMemo, useState } from "react";
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
import { BrokerIcon } from "@/components/ui/broker-icon";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { HoverHint, TooltipProvider } from "@/components/ui/tooltip";
import { getPlatformOptionsForBroker } from "@/lib/brokers/broker-catalog";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface PropAccountFormProps {
  initialBroker?: string;
  initialPlatform?: string;
  initialAccountNumber?: string;
  initialName?: string;
  initialBalance?: number | string;
  initialMaxDrawdown?: number | string;
  onSuccess: (newAccountId: string) => void;
}

const PROP_FIRMS = [
  {
    id: "lucid",
    name: "Lucid Trading",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
    icon: "lucid.png",
  },
  {
    id: "topstep",
    name: "Topstep",
    defaultPlatform: "topstepx",
    defaultTz: "America/Chicago",
    icon: "topstep.png",
  },
  {
    id: "apex",
    name: "Apex Trader Funding",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
    icon: "apex.png",
  },
  {
    id: "ftmo",
    name: "FTMO",
    defaultPlatform: "metatrader5",
    defaultTz: "Europe/Helsinki",
    icon: "ftmo-light.svg",
    iconDark: "ftmo-dark.svg",
  },
  {
    id: "bulenox",
    name: "Bulenox",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
    icon: "bulenox.png",
  },
  {
    id: "tradeify",
    name: "Tradeify",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
    icon: "tradeify.png",
  },
  {
    id: "fasttrack",
    name: "Fast Track Trading",
    defaultPlatform: "rithmic",
    defaultTz: "America/Chicago",
    icon: "rithmic.png",
  },
  {
    id: "tradeday",
    name: "TradeDay",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
    icon: "tradovate.svg",
  },
  {
    id: "goatfunded",
    name: "Goat Funded Trader",
    defaultPlatform: "metatrader5",
    defaultTz: "Europe/Helsinki",
    icon: "metatrader5.png",
  },
  {
    id: "other",
    name: "Other Prop Firm",
    defaultPlatform: "tradovate",
    defaultTz: "America/Chicago",
  },
];

const PLATFORM_CHOICES = [
  { id: "tradovate", name: "Tradovate", icon: "tradovate.svg", defaultTz: "America/Chicago" },
  {
    id: "ninjatrader",
    name: "NinjaTrader 8",
    icon: "ninjatrader.svg",
    defaultTz: "America/Chicago",
  },
  { id: "topstepx", name: "TopstepX", icon: "topstep.png", defaultTz: "America/Chicago" },
  {
    id: "rithmic",
    name: "Rithmic",
    icon: "rithmic.png",
    defaultTz: "America/Chicago",
  },
  { id: "tradesea", name: "TradeSea", icon: "tradesea.png", defaultTz: "America/Chicago" },
  {
    id: "wealthcharts",
    name: "WealthCharts",
    icon: "wealthcharts.png",
    defaultTz: "America/Chicago",
  },
  {
    id: "metatrader5",
    name: "MetaTrader 5",
    icon: "metatrader5.png",
    defaultTz: "Europe/Helsinki",
  },
  {
    id: "metatrader4",
    name: "MetaTrader 4",
    icon: "metatrader5.png",
    defaultTz: "Europe/Helsinki",
  },
  {
    id: "ctrader",
    name: "cTrader",
    icon: "ctrader.png",
    defaultTz: "UTC",
  },
  {
    id: "matchtrader",
    name: "Match-Trader",
    icon: "matchtrader.png",
    defaultTz: "UTC",
  },
  {
    id: "quantower",
    name: "Quantower",
    icon: "quantower.svg",
    defaultTz: "UTC",
  },
];

export function PropAccountForm({
  initialBroker,
  initialPlatform,
  initialAccountNumber,
  initialName,
  initialBalance,
  initialMaxDrawdown,
  onSuccess,
}: PropAccountFormProps) {
  const [propFirm, setPropFirm] = useState(initialBroker || "lucid");
  const [propPlatform, setPropPlatform] = useState(initialPlatform || "tradovate");
  const [propAccountName, setPropAccountName] = useState(initialName || "");
  const [propAccountNumber, setPropAccountNumber] = useState(initialAccountNumber || "");
  const [propBalance, setPropBalance] = useState(
    initialBalance !== undefined ? String(initialBalance) : "50000",
  );
  const [propMaxDrawdown, setPropMaxDrawdown] = useState(
    initialMaxDrawdown !== undefined ? String(initialMaxDrawdown) : "2000",
  );
  const [propCurrency, setPropCurrency] = useState("USD");
  const [propTimeZone, setPropTimeZone] = useState("America/Chicago");
  const [propProfitCalc, setPropProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [propBusy, setPropBusy] = useState(false);
  const [propError, setPropError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccountNumber !== undefined) setPropAccountNumber(initialAccountNumber);
    if (initialPlatform !== undefined) setPropPlatform(initialPlatform);
    if (initialBroker !== undefined) {
      setPropFirm(initialBroker);
      const firm = PROP_FIRMS.find((f) => f.id === initialBroker);
      if (firm) {
        setPropTimeZone(firm.defaultTz);
        if (!initialPlatform) setPropPlatform(firm.defaultPlatform);
      }
    }
    if (initialName !== undefined) setPropAccountName(initialName);
    if (initialBalance !== undefined) setPropBalance(String(initialBalance));
    if (initialMaxDrawdown !== undefined) setPropMaxDrawdown(String(initialMaxDrawdown));
  }, [
    initialAccountNumber,
    initialPlatform,
    initialBroker,
    initialName,
    initialBalance,
    initialMaxDrawdown,
  ]);

  const handlePropFirmChange = (firmId: string) => {
    setPropFirm(firmId);
    const firm = PROP_FIRMS.find((f) => f.id === firmId);
    if (firm) {
      setPropPlatform(firm.defaultPlatform);
      setPropTimeZone(firm.defaultTz);
    }
  };

  const handleCreatePropAccount = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPropBusy(true);
    setPropError(null);

    const firmObj = PROP_FIRMS.find((f) => f.id === propFirm);
    const firmLabel = firmObj ? firmObj.name : "Prop Account";
    const balanceNum = propBalance ? Number(propBalance) : 50000;
    const balanceLabel = balanceNum >= 1000 ? `${Math.round(balanceNum / 1000)}k` : `${balanceNum}`;
    const finalName =
      propAccountName.trim() ||
      `${firmLabel} ${balanceLabel}${propAccountNumber.trim() ? ` (${propAccountNumber.trim()})` : ""}`;

    try {
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: finalName,
        kind: "manual",
        broker: propFirm === "other" ? "" : propFirm,
        platform: propPlatform,
        accountNumber: propAccountNumber.trim() || null,
        currency: propCurrency.toUpperCase().trim() || "USD",
        initialBalance: balanceNum,
        maxDrawdown: propMaxDrawdown ? Number(propMaxDrawdown) : null,
        timeZone: propTimeZone || "America/Chicago",
        profitCalcMethod: propProfitCalc,
      });
      onSuccess(res.id);
    } catch (cause) {
      setPropError(cause instanceof Error ? cause.message : "Failed to create prop account.");
    } finally {
      setPropBusy(false);
    }
  };

  const selectedFirm = PROP_FIRMS.find((f) => f.id === propFirm);
  const selectedPlat = PLATFORM_CHOICES.find((p) => p.id === propPlatform);

  const availablePlatforms = useMemo(() => {
    const opts = getPlatformOptionsForBroker(propFirm)
      .filter((p) => p.value !== "auto")
      .map((p) => p.value);
    if (opts.length > 0) {
      return PLATFORM_CHOICES.filter((p) => opts.includes(p.id));
    }
    return PLATFORM_CHOICES;
  }, [propFirm]);

  return (
    <form onSubmit={handleCreatePropAccount} className="space-y-3.5">
      {/* Row 1: Prop Firm & Execution Platform */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-firm" className="text-xs font-medium text-foreground">
              Prop Firm
            </Label>
          </div>
          <Select value={propFirm} onValueChange={handlePropFirmChange}>
            <SelectTrigger
              id="prop-firm"
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            >
              <SelectValue placeholder="Select prop firm">
                {selectedFirm ? (
                  <div className="flex items-center gap-2">
                    <BrokerIcon
                      icon={selectedFirm.icon}
                      name={selectedFirm.name}
                      className="size-4 rounded-sm object-contain shrink-0"
                    />
                    <span className="truncate">{selectedFirm.name}</span>
                  </div>
                ) : (
                  <span>Select prop firm</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {PROP_FIRMS.map((firm) => (
                <SelectItem key={firm.id} value={firm.id} className="text-xs cursor-pointer">
                  <div className="flex items-center gap-2">
                    <BrokerIcon
                      icon={firm.icon}
                      name={firm.name}
                      className="size-4 rounded-sm object-contain"
                    />
                    <span>{firm.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-platform" className="text-xs font-medium text-foreground">
              Execution Platform
            </Label>
          </div>
          <Select value={propPlatform} onValueChange={setPropPlatform}>
            <SelectTrigger
              id="prop-platform"
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            >
              <SelectValue placeholder="Execution platform">
                {selectedPlat ? (
                  <div className="flex items-center gap-2">
                    <BrokerIcon
                      icon={selectedPlat.icon}
                      name={selectedPlat.name}
                      className="size-4 rounded-sm object-contain shrink-0"
                    />
                    <span className="truncate">{selectedPlat.name}</span>
                  </div>
                ) : (
                  <span>Execution platform</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availablePlatforms.map((plat) => (
                <SelectItem key={plat.id} value={plat.id} className="text-xs cursor-pointer">
                  <div className="flex items-center gap-2">
                    <BrokerIcon
                      icon={plat.icon}
                      name={plat.name}
                      className="size-4 rounded-sm object-contain"
                    />
                    <span>{plat.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Account Name & Statement Account ID */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-account-name" className="text-xs font-medium text-foreground">
              Account Name
            </Label>
          </div>
          <Input
            id="prop-account-name"
            value={propAccountName}
            onChange={(e) => setPropAccountName(e.target.value)}
            placeholder="e.g. Lucid 50k Combine, Apex PA-1"
            className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-account-number" className="text-xs font-medium text-foreground">
              Account ID / Number
            </Label>
            <span className="font-mono text-[10px] text-muted-foreground/80">
              Auto-match on import
            </span>
          </div>
          <Input
            id="prop-account-number"
            value={propAccountNumber}
            onChange={(e) => setPropAccountNumber(e.target.value)}
            placeholder="e.g. LFE0506847043001"
            className="h-9 text-xs font-mono rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
          />
        </div>
      </div>

      {/* Row 3: Initial Balance, Max Drawdown & Currency in 3 columns (matching Edit dialog) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-balance" className="text-xs font-medium text-foreground">
              Initial Balance ({getCurrencyInfo(propCurrency).symbol})
            </Label>
          </div>
          <Input
            id="prop-balance"
            type="number"
            step="any"
            value={propBalance}
            onChange={(e) => setPropBalance(e.target.value)}
            placeholder="50000"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-max-dd" className="text-xs font-medium text-foreground">
              Max Drawdown ({getCurrencyInfo(propCurrency).symbol})
            </Label>
          </div>
          <Input
            id="prop-max-dd"
            type="number"
            step="any"
            value={propMaxDrawdown}
            onChange={(e) => setPropMaxDrawdown(e.target.value)}
            placeholder="2000"
            className="h-9 text-xs font-mono tnum rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-5">
            <Label htmlFor="prop-currency" className="text-xs font-medium text-foreground">
              Currency
            </Label>
          </div>
          <Select value={propCurrency} onValueChange={setPropCurrency}>
            <SelectTrigger
              id="prop-currency"
              className="h-9 text-xs rounded-lg bg-background/80 border-border/70 hover:bg-background hover:border-border transition-colors shadow-xs text-foreground"
            >
              <SelectValue placeholder="Currency">
                <CurrencyBadge code={propCurrency} />
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
            {formatZoneOffset(propTimeZone)}
          </span>
        </div>
        <TimeZonePicker
          id="prop-account-tz"
          label="Statement timezone"
          value={propTimeZone}
          onValueChange={setPropTimeZone}
        />
      </div>

      {/* Row 5: Profit Calculation Method (Tactile Segmented Control with Tooltips) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-5">
          <Label className="text-xs font-medium text-foreground">Profit Calculation Method</Label>
          <span className="font-mono text-[10px] uppercase text-muted-foreground/80 tracking-wider">
            {propProfitCalc}
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
                onClick={() => setPropProfitCalc("fifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  propProfitCalc === "fifo"
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
                onClick={() => setPropProfitCalc("lifo")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  propProfitCalc === "lifo"
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
                onClick={() => setPropProfitCalc("wavg")}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer text-center active:scale-[0.98]",
                  propProfitCalc === "wavg"
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
          {propProfitCalc === "fifo" &&
            "First In, First Out — standard accounting rule for Prop Firms and Forex brokers."}
          {propProfitCalc === "lifo" &&
            "Last In, First Out — matches closing orders against most recent positions."}
          {propProfitCalc === "wavg" &&
            "Weighted Average — computes the average entry price across all open lots."}
        </p>
      </div>

      {propError && (
        <p role="alert" className="text-xs text-destructive">
          {propError}
        </p>
      )}

      <Button
        type="submit"
        disabled={propBusy}
        className="w-full h-9 text-xs font-medium cursor-pointer active:scale-[0.98] transition-transform duration-100 mt-2"
      >
        {propBusy ? "Creating prop account…" : "Create Prop Account"}
      </Button>
    </form>
  );
}
