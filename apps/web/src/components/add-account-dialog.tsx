"use client";

import { useEffect, useId, useState } from "react";
import {
  ArrowLeft,
  Check,
  Landmark,
  PencilLine,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TimeZonePicker } from "@/components/timezone-picker";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import {
  BROKER_CATALOG,
  getBrokerInfo,
  getBrokerMetadata,
  type BrokerCatalogItem,
} from "@/lib/brokers/broker-catalog";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/types/accounts";
import type { BrokerSdkInfo } from "@/types/import";

export { BROKER_CATALOG };
export type { BrokerCatalogItem };

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: (accountId: string) => void;
  initialTab?: "prop" | "broker" | "sync" | "manual" | "import";
  initialAccountNumber?: string;
  initialPlatform?: string;
  initialBroker?: string;
  initialName?: string;
  initialBalance?: number | string;
  initialMaxDrawdown?: number | string;
}

const BALANCE_PRESETS = [25000, 50000, 100000, 150000, 200000, 300000];

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

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
  initialTab = "prop",
  initialAccountNumber,
  initialPlatform,
  initialBroker,
  initialName,
  initialBalance,
  initialMaxDrawdown,
}: AddAccountDialogProps) {
  const mapInitialTab = (tab?: string): "prop" | "broker" | "sync" | "manual" => {
    if (tab === "import" || tab === "prop") return "prop";
    if (tab === "broker") return "broker";
    if (tab === "sync") return "sync";
    if (tab === "manual") return "manual";
    return "prop";
  };

  const [activeTab, setActiveTab] = useState<"prop" | "broker" | "sync" | "manual">(() =>
    mapInitialTab(initialTab),
  );

  const { data: brokerData } = useApi<{ brokers: BrokerSdkInfo[] }>("/api/brokers");
  const { refresh: refreshAccounts } = useApi<{ accounts: AccountRow[] }>(
    "/api/accounts?summary=1",
  );

  // --- Tab 1: Prop Firm State ---
  const [propFirm, setPropFirm] = useState("lucid");
  const [propPlatform, setPropPlatform] = useState("tradovate");
  const [propAccountName, setPropAccountName] = useState("");
  const [propAccountNumber, setPropAccountNumber] = useState("");
  const [propBalance, setPropBalance] = useState("50000");
  const [propMaxDrawdown, setPropMaxDrawdown] = useState("2000");
  const [propCurrency, setPropCurrency] = useState("USD");
  const [propTimeZone, setPropTimeZone] = useState("America/Chicago");
  const [propProfitCalc, setPropProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [propBusy, setPropBusy] = useState(false);
  const [propError, setPropError] = useState<string | null>(null);

  // --- Tab 2: Direct Broker State ---
  const [brokerId, setBrokerId] = useState("ibkr");
  const [brokerAccountName, setBrokerAccountName] = useState("");
  const [brokerAccountNumber, setBrokerAccountNumber] = useState("");
  const [brokerBalance, setBrokerBalance] = useState("10000");
  const [brokerCurrency, setBrokerCurrency] = useState("USD");
  const [brokerTimeZone, setBrokerTimeZone] = useState("America/New_York");
  const [brokerProfitCalc, setBrokerProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerError, setBrokerError] = useState<string | null>(null);

  // --- Tab 3: API Sync State ---
  const [syncBrokerId, setSyncBrokerId] = useState<string>("");
  const [syncAccountName, setSyncAccountName] = useState("");
  const [syncCredentials, setSyncCredentials] = useState<Record<string, string>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // --- Tab 4: Manual Account State ---
  const [manualName, setManualName] = useState("");
  const [manualCurrency, setManualCurrency] = useState("USD");
  const [manualBalance, setManualBalance] = useState("");
  const [manualProfitCalc, setManualProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Hydrate initial props when opening
  useEffect(() => {
    if (open) {
      setActiveTab(mapInitialTab(initialTab));

      if (initialAccountNumber) {
        setPropAccountNumber(initialAccountNumber);
        setBrokerAccountNumber(initialAccountNumber);
      }
      if (initialPlatform) {
        setPropPlatform(initialPlatform);
      }
      if (initialBroker) {
        setPropFirm(initialBroker);
        setBrokerId(initialBroker);
        const firm = PROP_FIRMS.find((f) => f.id === initialBroker);
        if (firm) {
          setPropTimeZone(firm.defaultTz);
          if (!initialPlatform) setPropPlatform(firm.defaultPlatform);
        }
        const meta = getBrokerMetadata(initialBroker);
        if (meta?.defaultTimeZone) {
          setBrokerTimeZone(meta.defaultTimeZone);
        }
      }
      if (initialName) {
        setPropAccountName(initialName);
        setBrokerAccountName(initialName);
        setManualName(initialName);
      }
      if (initialBalance !== undefined) {
        setPropBalance(String(initialBalance));
        setBrokerBalance(String(initialBalance));
      }
      if (initialMaxDrawdown !== undefined) {
        setPropMaxDrawdown(String(initialMaxDrawdown));
      }
    }
  }, [
    open,
    initialTab,
    initialAccountNumber,
    initialPlatform,
    initialBroker,
    initialName,
    initialBalance,
    initialMaxDrawdown,
  ]);

  // Update default timezone when prop firm changes
  const handlePropFirmChange = (firmId: string) => {
    setPropFirm(firmId);
    const firm = PROP_FIRMS.find((f) => f.id === firmId);
    if (firm) {
      setPropPlatform(firm.defaultPlatform);
      setPropTimeZone(firm.defaultTz);
    }
  };

  // Update default timezone when broker changes
  const handleBrokerChange = (id: string) => {
    setBrokerId(id);
    const meta = getBrokerMetadata(id);
    if (meta?.defaultTimeZone) {
      setBrokerTimeZone(meta.defaultTimeZone);
    }
  };

  // --- Submit Prop Firm Account ---
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
      refreshAccounts();
      onAccountCreated?.(res.id);
      onOpenChange(false);
    } catch (cause) {
      setPropError(cause instanceof Error ? cause.message : "Failed to create prop account.");
    } finally {
      setPropBusy(false);
    }
  };

  // --- Submit Direct Broker Account ---
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
        timeZone: brokerTimeZone || "America/New_York",
        profitCalcMethod: brokerProfitCalc,
      });
      refreshAccounts();
      onAccountCreated?.(res.id);
      onOpenChange(false);
    } catch (cause) {
      setBrokerError(cause instanceof Error ? cause.message : "Failed to create broker account.");
    } finally {
      setBrokerBusy(false);
    }
  };

  // --- Submit API Sync Account ---
  const handleConnectSync = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!syncBrokerId) return;
    setSyncBusy(true);
    setSyncError(null);

    const brokerMeta = brokerData?.brokers.find((b) => b.id === syncBrokerId);
    const finalName = syncAccountName.trim() || (brokerMeta?.displayName ?? "Connected Exchange");

    try {
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: finalName,
        kind: "sync",
        broker: syncBrokerId,
        credentials: syncCredentials,
        timeZone: "UTC",
      });
      refreshAccounts();
      onAccountCreated?.(res.id);
      onOpenChange(false);
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Failed to connect API broker.");
    } finally {
      setSyncBusy(false);
    }
  };

  // --- Submit Simple Manual Account ---
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
        profitCalcMethod: manualProfitCalc,
      });
      refreshAccounts();
      onAccountCreated?.(res.id);
      onOpenChange(false);
    } catch (cause) {
      setManualError(cause instanceof Error ? cause.message : "Failed to create manual account.");
    } finally {
      setManualBusy(false);
    }
  };

  const selectedSyncMeta = brokerData?.brokers.find((b) => b.id === syncBrokerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="gap-1 pb-1">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Add Journal Account
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure an evaluation prop firm, direct broker, API sync, or manual tracking account.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "prop" | "broker" | "sync" | "manual")}
          className="pt-1"
        >
          <TabsList className="w-full grid grid-cols-4 h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="prop"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Trophy className="mr-1.5 size-3.5 shrink-0" />
              <span>Prop firm</span>
            </TabsTrigger>
            <TabsTrigger
              value="broker"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Landmark className="mr-1.5 size-3.5 shrink-0" />
              <span>Broker</span>
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Radio className="mr-1.5 size-3.5 shrink-0" />
              <span>API sync</span>
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <PencilLine className="mr-1.5 size-3.5 shrink-0" />
              <span>Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* TAB 1: PROP FIRM / EVALUATION                                */}
          {/* ============================================================ */}
          <TabsContent value="prop" className="mt-3.5 space-y-3.5">
            <form onSubmit={handleCreatePropAccount} className="space-y-3">
              {/* Prop Firm & Execution Platform */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Prop Firm</Label>
                  {(() => {
                    const selectedFirm = PROP_FIRMS.find((f) => f.id === propFirm);
                    return (
                      <Select value={propFirm} onValueChange={handlePropFirmChange}>
                        <SelectTrigger className="h-8.5 text-xs">
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
                            <SelectItem
                              key={firm.id}
                              value={firm.id}
                              className="text-xs cursor-pointer"
                            >
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
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Execution Platform</Label>
                  {(() => {
                    const selectedPlat = PLATFORM_CHOICES.find((p) => p.id === propPlatform);
                    return (
                      <Select value={propPlatform} onValueChange={setPropPlatform}>
                        <SelectTrigger className="h-8.5 text-xs">
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
                          {PLATFORM_CHOICES.map((plat) => (
                            <SelectItem
                              key={plat.id}
                              value={plat.id}
                              className="text-xs cursor-pointer"
                            >
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
                    );
                  })()}
                </div>
              </div>

              {/* Account Name & Statement Account Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account Name</Label>
                  <Input
                    value={propAccountName}
                    onChange={(e) => setPropAccountName(e.target.value)}
                    placeholder="e.g. Lucid 50k Combine, Apex PA-1"
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Account ID / Number</Label>
                    <span className="text-[10px] text-muted-foreground">Auto-match on import</span>
                  </div>
                  <Input
                    value={propAccountNumber}
                    onChange={(e) => setPropAccountNumber(e.target.value)}
                    placeholder="e.g. LFE0506847043001"
                    className="h-8.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Initial Balance Chips & Custom Input */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Initial Account Balance ($)</Label>
                  <span className="text-[10px] text-muted-foreground">
                    Unlocks drawdown &amp; return metrics
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pb-1">
                  {BALANCE_PRESETS.map((preset) => {
                    const active = Number(propBalance) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setPropBalance(String(preset));
                          // Suggest realistic max drawdown limit
                          if (preset === 25000) setPropMaxDrawdown("1500");
                          else if (preset === 50000) setPropMaxDrawdown("2000");
                          else if (preset === 100000) setPropMaxDrawdown("3000");
                          else if (preset === 150000) setPropMaxDrawdown("4500");
                          else if (preset === 200000) setPropMaxDrawdown("6000");
                          else if (preset === 300000) setPropMaxDrawdown("7500");
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-mono font-medium transition-colors cursor-pointer",
                          active
                            ? "border-primary bg-primary text-primary-foreground font-semibold"
                            : "border-border/70 bg-card hover:bg-muted/50 text-foreground",
                        )}
                      >
                        ${(preset / 1000).toFixed(0)}k
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Custom Balance ({getCurrencyInfo(propCurrency).symbol})
                    </Label>
                    <Input
                      type="number"
                      value={propBalance}
                      onChange={(e) => setPropBalance(e.target.value)}
                      placeholder="50000"
                      className="h-8.5 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Max Drawdown Limit ({getCurrencyInfo(propCurrency).symbol})
                    </Label>
                    <Input
                      type="number"
                      value={propMaxDrawdown}
                      onChange={(e) => setPropMaxDrawdown(e.target.value)}
                      placeholder="2000"
                      className="h-8.5 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Timezone & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Statement Timezone</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
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

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Select value={propCurrency} onValueChange={setPropCurrency}>
                    <SelectTrigger className="h-8.5 text-xs">
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

              {/* Profit Calculation Method */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Profit Calculation Method</Label>
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {propProfitCalc}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => setPropProfitCalc("fifo")}
                    className={cn(
                      "rounded-md py-1 text-xs font-medium transition-all cursor-pointer text-center",
                      propProfitCalc === "fifo"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    FIFO (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropProfitCalc("lifo")}
                    className={cn(
                      "rounded-md py-1 text-xs font-medium transition-all cursor-pointer text-center",
                      propProfitCalc === "lifo"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    LIFO
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropProfitCalc("wavg")}
                    className={cn(
                      "rounded-md py-1 text-xs font-medium transition-all cursor-pointer text-center",
                      propProfitCalc === "wavg"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Weighted Avg
                  </button>
                </div>
              </div>

              {propError && (
                <p role="alert" className="text-xs text-destructive">
                  {propError}
                </p>
              )}

              <Button
                type="submit"
                disabled={propBusy}
                className="w-full h-8.5 text-xs font-semibold cursor-pointer mt-1"
              >
                {propBusy ? "Creating prop account…" : "Create Prop Account"}
              </Button>
            </form>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB 2: DIRECT BROKER                                         */}
          {/* ============================================================ */}
          <TabsContent value="broker" className="mt-3.5 space-y-3.5">
            <form onSubmit={handleCreateBrokerAccount} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Broker or Platform</Label>
                {(() => {
                  const selectedBrokerMeta = BROKER_CATALOG.find((b) => b.id === brokerId);
                  return (
                    <Select value={brokerId} onValueChange={handleBrokerChange}>
                      <SelectTrigger className="h-8.5 text-xs">
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
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account Name</Label>
                  <Input
                    value={brokerAccountName}
                    onChange={(e) => setBrokerAccountName(e.target.value)}
                    placeholder="e.g. IBKR Pro Margin, Schwab Individual"
                    className="h-8.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account ID / Number (optional)</Label>
                  <Input
                    value={brokerAccountNumber}
                    onChange={(e) => setBrokerAccountNumber(e.target.value)}
                    placeholder="e.g. U12345678"
                    className="h-8.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Initial Balance ({getCurrencyInfo(brokerCurrency).symbol})
                  </Label>
                  <Input
                    type="number"
                    value={brokerBalance}
                    onChange={(e) => setBrokerBalance(e.target.value)}
                    placeholder="10000"
                    className="h-8.5 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Select value={brokerCurrency} onValueChange={setBrokerCurrency}>
                    <SelectTrigger className="h-8.5 text-xs">
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

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Statement Timezone</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">
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

              {brokerError && (
                <p role="alert" className="text-xs text-destructive">
                  {brokerError}
                </p>
              )}

              <Button
                type="submit"
                disabled={brokerBusy}
                className="w-full h-8.5 text-xs font-semibold cursor-pointer"
              >
                {brokerBusy ? "Creating broker account…" : "Create Broker Account"}
              </Button>
            </form>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB 3: API DIRECT SYNC                                       */}
          {/* ============================================================ */}
          <TabsContent value="sync" className="mt-3.5 space-y-3.5">
            <form onSubmit={handleConnectSync} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Select Sync Provider</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(brokerData?.brokers ?? []).map((broker) => {
                    const active = syncBrokerId === broker.id;
                    return (
                      <button
                        key={broker.id}
                        type="button"
                        onClick={() => {
                          setSyncBrokerId(broker.id);
                          setSyncAccountName(`${broker.displayName} Sync`);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                          active
                            ? "border-primary bg-primary/5 text-foreground shadow-xs"
                            : "border-border/70 bg-card/40 hover:bg-muted/40",
                        )}
                      >
                        <BrokerIcon
                          icon={`${broker.id}.svg`}
                          name={broker.displayName}
                          className="size-6"
                        />
                        <div>
                          <span className="block text-xs font-semibold">{broker.displayName}</span>
                          <span className="block text-[10px] text-muted-foreground">API Sync</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedSyncMeta && (
                <div className="space-y-3 pt-1 border-t border-border/50">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Account Name</Label>
                    <Input
                      value={syncAccountName}
                      onChange={(e) => setSyncAccountName(e.target.value)}
                      placeholder={`e.g. My ${selectedSyncMeta.displayName} Sync`}
                      className="h-8.5 text-xs"
                    />
                  </div>

                  {(selectedSyncMeta.credentials ?? []).map((cred) => (
                    <div key={cred.key} className="space-y-1">
                      <Label className="text-xs font-medium">{cred.label}</Label>
                      <Input
                        type={cred.secret ? "password" : "text"}
                        value={syncCredentials[cred.key] ?? ""}
                        onChange={(e) =>
                          setSyncCredentials((prev) => ({
                            ...prev,
                            [cred.key]: e.target.value,
                          }))
                        }
                        className="h-8.5 text-xs font-mono"
                        placeholder={cred.secret ? "••••••••••••" : ""}
                        autoComplete="off"
                      />
                    </div>
                  ))}

                  {selectedSyncMeta.readOnlySetup && (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground">
                          Read-Only Permission Required:
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          {selectedSyncMeta.readOnlySetup}
                        </p>
                      </div>
                    </div>
                  )}

                  {syncError && (
                    <p role="alert" className="text-xs text-destructive">
                      {syncError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      syncBusy ||
                      !syncBrokerId ||
                      (selectedSyncMeta.credentials.some((c) => !syncCredentials[c.key]) ?? false)
                    }
                    className="w-full h-8.5 text-xs font-semibold cursor-pointer"
                  >
                    {syncBusy
                      ? "Connecting & syncing…"
                      : `Connect & Sync ${selectedSyncMeta.displayName}`}
                  </Button>
                </div>
              )}
            </form>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB 4: MANUAL ACCOUNT                                        */}
          {/* ============================================================ */}
          <TabsContent value="manual" className="mt-3.5 space-y-3.5">
            <form onSubmit={handleCreateManual} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Account Name</Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Paper Trading Account"
                  className="h-8.5 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Select value={manualCurrency} onValueChange={setManualCurrency}>
                    <SelectTrigger className="h-8.5 text-xs">
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

                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Initial Balance ({getCurrencyInfo(manualCurrency).symbol}) (optional)
                  </Label>
                  <Input
                    type="number"
                    value={manualBalance}
                    onChange={(e) => setManualBalance(e.target.value)}
                    placeholder="Unlocks drawdown %"
                    className="h-8.5 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Profit Calculation Method</Label>
                <Select
                  value={manualProfitCalc}
                  onValueChange={(val) => setManualProfitCalc(val as "fifo" | "lifo" | "wavg")}
                >
                  <SelectTrigger className="h-8.5 text-xs">
                    <SelectValue placeholder="Calculation method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fifo">FIFO (first in, first out)</SelectItem>
                    <SelectItem value="lifo">LIFO (last in, first out)</SelectItem>
                    <SelectItem value="wavg">Weighted Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {manualError && (
                <p role="alert" className="text-xs text-destructive">
                  {manualError}
                </p>
              )}

              <Button
                type="submit"
                disabled={manualBusy || !manualName.trim()}
                className="w-full h-8.5 text-xs font-semibold cursor-pointer"
              >
                {manualBusy ? "Creating account…" : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
