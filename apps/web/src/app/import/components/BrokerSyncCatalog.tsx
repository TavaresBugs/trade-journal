"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Coins,
  FileCheck2,
  FileUp,
  HelpCircle,
  Loader2,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { BROKER_CATALOG, getPlatformOptionsForBroker } from "@/lib/brokers/broker-catalog";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
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
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { BrokerCatalogItem, BrokerSdkInfo } from "@/types/import";

export interface BrokerSyncCatalogProps {
  onGoToFile: (accountId?: string) => void;
}

function BrokerCard({
  broker,
  onSelect,
}: {
  broker: BrokerCatalogItem;
  onSelect: (b: BrokerCatalogItem) => void;
}) {
  const isApi = broker.connectionType === "api";
  return (
    <button
      type="button"
      onClick={() => onSelect(broker)}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
        isApi
          ? "border-solid border-border/70 bg-card/40 hover:bg-muted/50 hover:border-border shadow-2xs"
          : "border-dashed border-border/60 hover:border-border hover:bg-muted/30 opacity-90 hover:opacity-100",
      )}
    >
      <BrokerIcon
        icon={broker.icon}
        iconDark={broker.iconDark}
        name={broker.name}
        invertInDark={broker.invertInDark}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-semibold",
            isApi
              ? "text-foreground group-hover:text-primary transition-colors"
              : "text-foreground/90 group-hover:text-foreground transition-colors",
          )}
        >
          {broker.name}
        </span>
        {broker.subtitle && (
          <span className="block truncate text-[10px] text-muted-foreground/80 mt-0.5">
            {broker.subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

export function BrokerSyncCatalog({ onGoToFile }: BrokerSyncCatalogProps) {
  const router = useRouter();
  const { data: brokerData } = useApi<{ brokers: BrokerSdkInfo[] }>("/api/brokers");
  const { refresh: refreshAccounts } = useApi<{ accounts: unknown[] }>("/api/accounts?summary=1");

  const [selectedBroker, setSelectedBroker] = useState<BrokerCatalogItem | null>(null);
  const [brokerAccountName, setBrokerAccountName] = useState("");
  const [brokerAccountNumber, setBrokerAccountNumber] = useState("");
  const [brokerCredentials, setBrokerCredentials] = useState<Record<string, string>>({});
  const [propPlatform, setPropPlatform] = useState("auto");
  const [propBalance, setPropBalance] = useState("50000");
  const [propMaxDrawdown, setPropMaxDrawdown] = useState("2000");
  const [propCurrency, setPropCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedSdkBroker = selectedBroker
    ? (brokerData?.brokers.find(
        (b) => b.id === selectedBroker.id || (selectedBroker.id === "ibkr" && b.id === "ibkr-flex"),
      ) ?? null)
    : null;

  const platformOptions = selectedBroker ? getPlatformOptionsForBroker(selectedBroker.id) : [];
  const currentPlatformOpt = platformOptions.find((o) => o.value === propPlatform);
  const currencyInfo = getCurrencyInfo(propCurrency);
  const currencySymbol = currencyInfo.symbol || "$";

  const handleSelectBroker = (broker: BrokerCatalogItem) => {
    setSelectedBroker(broker);
    setError(null);
    if (broker.id === "ftmo") {
      setBrokerAccountName("FTMO Challenge");
      setPropPlatform("metatrader5");
      setPropBalance("100000");
      setPropMaxDrawdown("10000");
    } else if (broker.id === "lucid") {
      setBrokerAccountName("Lucid Trading");
      setPropPlatform("tradovate");
      setPropBalance("50000");
      setPropMaxDrawdown("2000");
    } else if (broker.id === "apex") {
      setBrokerAccountName("Apex Trader Funding");
      setPropPlatform("ninjatrader");
      setPropBalance("50000");
      setPropMaxDrawdown("2500");
    } else if (broker.id === "topstep") {
      setBrokerAccountName("Topstep Combine");
      setPropPlatform("topstepx");
      setPropBalance("50000");
      setPropMaxDrawdown("2000");
    } else if (broker.id === "tradeify") {
      setBrokerAccountName("Tradeify Account");
      setPropPlatform("tradovate");
      setPropBalance("50000");
      setPropMaxDrawdown("2000");
    } else if (broker.category === "prop-firm") {
      setBrokerAccountName(`${broker.name} Account`);
      setPropPlatform(broker.platform || "auto");
      setPropBalance("50000");
      setPropMaxDrawdown("2000");
    } else {
      setBrokerAccountName(broker.name);
      setPropPlatform(broker.platform || "auto");
      setPropBalance("10000");
      setPropMaxDrawdown("");
    }
  };

  const handleConnect = async () => {
    if (!selectedBroker) return;
    setBusy(true);
    setError(null);

    try {
      if (!matchedSdkBroker) {
        // Prop firm or non-SDK platform: create journal account for statement import
        const res = await postJson<{ id: string }>("/api/accounts", {
          name: brokerAccountName.trim() || `${selectedBroker.name} Account`,
          kind: "manual",
          broker: selectedBroker.id,
          platform:
            propPlatform === "auto"
              ? selectedBroker.platform || null
              : propPlatform === "mt5"
                ? "metatrader5"
                : propPlatform === "mt4"
                  ? "metatrader4"
                  : propPlatform,
          accountNumber: brokerAccountNumber.trim() || null,
          currency: propCurrency,
          initialBalance: propBalance ? Number(propBalance) : 50000,
          maxDrawdown: propMaxDrawdown ? Number(propMaxDrawdown) : null,
          timeZone: selectedBroker.defaultTimeZone || "UTC",
          profitCalcMethod: "fifo",
        });
        refreshAccounts();
        onGoToFile(res.id);
        return;
      }

      const brokerMeta = brokerData?.brokers.find((b) => b.id === selectedBroker.id);
      await postJson("/api/accounts", {
        name: brokerAccountName.trim() || (brokerMeta?.displayName ?? selectedBroker.name),
        kind: "sync",
        broker: selectedBroker.id,
        credentials: brokerCredentials,
        timeZone: selectedBroker.defaultTimeZone || "UTC",
      });
      refreshAccounts();
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5 space-y-4 shadow-xs">
      {!selectedBroker ? (
        <>
          <div className="border-b border-border/50 pb-3">
            <h3 className="text-sm font-semibold text-foreground">Connect a Broker or Exchange</h3>
            <p className="text-xs text-muted-foreground">
              Connected brokers sync into your journal automatically with encrypted read-only API
              access.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {/* 1. Prop Firms */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-primary uppercase flex items-center gap-1.5">
                <Trophy className="size-3.5 shrink-0" />
                <span>Prop Trading Firms</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter((b) => b.category === "prop-firm").map((broker) => (
                  <BrokerCard key={broker.id} broker={broker} onSelect={handleSelectBroker} />
                ))}
              </div>
            </div>

            {/* 2. Direct Brokers (Forex, CFDs & Stocks) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <Building2 className="size-3.5 shrink-0" />
                <span>Direct Brokers (Forex, CFDs &amp; Stocks)</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter(
                  (b) => b.category === "forex-cfd" || b.category === "stocks",
                ).map((broker) => (
                  <BrokerCard key={broker.id} broker={broker} onSelect={handleSelectBroker} />
                ))}
              </div>
            </div>

            {/* 3. Crypto Exchanges */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <Coins className="size-3.5 shrink-0" />
                <span>Crypto Exchanges</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter((b) => b.category === "crypto").map((broker) => (
                  <BrokerCard key={broker.id} broker={broker} onSelect={handleSelectBroker} />
                ))}
              </div>
            </div>

            {/* 4. Execution Platforms & Gateways */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <Zap className="size-3.5 shrink-0" />
                <span>Execution Platforms &amp; Gateways</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter(
                  (b) => b.category === "platform" || b.category === "futures",
                ).map((broker) => (
                  <BrokerCard key={broker.id} broker={broker} onSelect={handleSelectBroker} />
                ))}
              </div>
            </div>

            {/* Statement fallback */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <HelpCircle className="size-3.5 shrink-0" />
                <span>Anything else</span>
              </span>
              <button
                type="button"
                onClick={() => onGoToFile()}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-all hover:bg-muted/50 cursor-pointer active:scale-[0.98]"
              >
                <FileUp className="size-4.5 shrink-0 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all duration-150" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    Import a statement or journal file
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    Supports Tradovate, NinjaTrader, MT5, TradeZella, Tradervue, CSV &amp; HTML
                  </span>
                </span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Detailed Broker Configuration */
        <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
          <button
            type="button"
            onClick={() => setSelectedBroker(null)}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] rounded-md transition-[color,background-color,transform] duration-150 cursor-pointer"
          >
            <ArrowLeft className="size-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <span>Back to brokers</span>
          </button>

          <div className="flex items-center gap-3 border-b border-border/50 pb-3.5">
            <BrokerIcon
              icon={selectedBroker.icon}
              iconDark={selectedBroker.iconDark}
              name={selectedBroker.name}
              invertInDark={selectedBroker.invertInDark}
              className="size-9 rounded-lg object-contain shrink-0"
            />
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-foreground [text-wrap:balance]">
                Connect {selectedBroker.name}
              </h3>
              <p className="text-[11px] text-muted-foreground [text-wrap:pretty]">
                {!matchedSdkBroker
                  ? "Account management & trade tracking"
                  : "Encrypted read-only synchronization"}
              </p>
            </div>
          </div>

          {!matchedSdkBroker ? (
            /* Prop Firm / Statement Import Account Setup */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">Account Name</Label>
                </div>
                <Input
                  value={brokerAccountName}
                  onChange={(e) => setBrokerAccountName(e.target.value)}
                  placeholder={`e.g. ${selectedBroker.name} Account`}
                  className="h-9 text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">Account ID / Number</Label>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                    Auto-match on import
                  </span>
                </div>
                <Input
                  value={brokerAccountNumber}
                  onChange={(e) => setBrokerAccountNumber(e.target.value)}
                  placeholder="e.g. LFE0506847043001"
                  className="h-9 text-xs sm:text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">Trading Platform</Label>
                </div>
                <Select value={propPlatform} onValueChange={setPropPlatform}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Platform">
                      {currentPlatformOpt ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {currentPlatformOpt.icon ? (
                            <BrokerIcon
                              icon={currentPlatformOpt.icon}
                              iconDark={currentPlatformOpt.iconDark}
                              name={currentPlatformOpt.label}
                              className="size-4 rounded-sm object-contain shrink-0"
                            />
                          ) : currentPlatformOpt.value === "auto" ? (
                            <Sparkles className="size-3.5 text-primary shrink-0" />
                          ) : null}
                          <span className="truncate">{currentPlatformOpt.label}</span>
                        </div>
                      ) : (
                        <span>Platform</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {opt.icon ? (
                            <BrokerIcon
                              icon={opt.icon}
                              iconDark={opt.iconDark}
                              name={opt.label}
                              className="size-4 rounded-sm object-contain shrink-0"
                            />
                          ) : opt.value === "auto" ? (
                            <Sparkles className="size-3.5 text-primary shrink-0" />
                          ) : null}
                          <span className="truncate">{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">Currency</Label>
                </div>
                <Select value={propCurrency} onValueChange={setPropCurrency}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Currency">
                      <CurrencyBadge code={propCurrency} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {CURRENCY_LIST.map((curr) => (
                      <SelectItem
                        key={curr.code}
                        value={curr.code}
                        className="text-xs cursor-pointer"
                      >
                        <CurrencyBadge code={curr.code} showName />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Initial Account Balance ({currencySymbol})
                  </Label>
                </div>
                <Input
                  type="number"
                  value={propBalance}
                  onChange={(e) => setPropBalance(e.target.value)}
                  placeholder={selectedBroker.id === "ftmo" ? "100000" : "50000"}
                  className="h-9 text-xs sm:text-sm font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Max Drawdown Limit ({currencySymbol})
                  </Label>
                </div>
                <Input
                  type="number"
                  value={propMaxDrawdown}
                  onChange={(e) => setPropMaxDrawdown(e.target.value)}
                  placeholder="2000"
                  className="h-9 text-xs sm:text-sm font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <p className="text-[11px] text-muted-foreground [text-wrap:pretty] sm:col-span-2">
                Unlocks exact drawdown metrics and prop evaluation progress.
              </p>

              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/25 dark:bg-muted/15 p-3 text-xs text-muted-foreground shadow-2xs sm:col-span-2">
                <FileCheck2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium text-foreground">Statement Import Ready</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground [text-wrap:pretty]">
                    After creating this account, export your trading history report from{" "}
                    <span className="text-foreground font-medium">{selectedBroker.name}</span> or
                    your execution platform and import it anytime to sync executions.
                  </p>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-destructive sm:col-span-2">
                  {error}
                </p>
              )}

              <Button
                onClick={handleConnect}
                disabled={busy}
                className="w-full h-9.5 text-xs sm:text-sm font-semibold tracking-tight shadow-sm hover:brightness-105 active:scale-[0.99] transition-[background-color,transform,box-shadow,filter] duration-150 cursor-pointer sm:col-span-2"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Creating {selectedBroker.name} account…</span>
                  </span>
                ) : (
                  `Create ${selectedBroker.name} Account`
                )}
              </Button>
            </div>
          ) : (
            /* Standard SDK API Broker */
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Account Name</Label>
                <Input
                  value={brokerAccountName}
                  onChange={(e) => setBrokerAccountName(e.target.value)}
                  placeholder={`My ${selectedBroker.name} Account`}
                  className="h-9 text-xs sm:text-sm"
                />
              </div>

              {(matchedSdkBroker?.credentials ?? []).map((cred) => (
                <div key={cred.key} className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">{cred.label}</Label>
                  <Input
                    type={cred.secret ? "password" : "text"}
                    value={brokerCredentials[cred.key] ?? ""}
                    onChange={(e) =>
                      setBrokerCredentials((prev) => ({
                        ...prev,
                        [cred.key]: e.target.value,
                      }))
                    }
                    className="h-9 text-xs sm:text-sm font-mono"
                    placeholder={cred.secret ? "••••••••" : ""}
                    autoComplete="off"
                  />
                </div>
              ))}

              {matchedSdkBroker?.readOnlySetup && (
                <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/25 dark:bg-muted/15 p-3 text-xs text-muted-foreground shadow-2xs">
                  <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">Setup instructions: </span>
                    <span className="text-[11px] leading-relaxed text-muted-foreground [text-wrap:pretty]">
                      {matchedSdkBroker.readOnlySetup}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button
                onClick={handleConnect}
                disabled={
                  busy ||
                  (matchedSdkBroker?.credentials.some((field) => !brokerCredentials[field.key]) ??
                    false)
                }
                className="w-full h-9.5 text-xs sm:text-sm font-semibold tracking-tight shadow-sm hover:brightness-105 active:scale-[0.99] transition-[background-color,transform,box-shadow,filter] duration-150 cursor-pointer"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Connecting &amp; syncing…</span>
                  </span>
                ) : (
                  `Connect & Sync ${selectedBroker.name}`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
