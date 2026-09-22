"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileUp,
  Landmark,
  PencilLine,
  RefreshCw,
  Sparkles,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { formatTimestamp } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { dayKeyOf } from "@luxalgo/journal-core";
import type { AccountRow } from "@/types/accounts";
import type {
  BrokerCatalogItem,
  BrokerSdkInfo,
  PreviewTotals,
  PreviewResponse,
} from "@/types/import";

export type { BrokerCatalogItem };

export const BROKER_CATALOG: BrokerCatalogItem[] = [
  // Crypto
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    category: "crypto",
    icon: "hyperliquid.png",
    status: "active",
  },
  { id: "binance", name: "Binance", category: "crypto", icon: "binance.png", status: "active" },
  { id: "kraken", name: "Kraken", category: "crypto", icon: "kraken.png", status: "active" },
  {
    id: "bybit",
    name: "Bybit",
    category: "crypto",
    icon: "bybit.png",
    status: "active",
    invertInDark: true,
  },
  {
    id: "okx",
    name: "OKX",
    category: "crypto",
    icon: "okx.png",
    status: "active",
    invertInDark: true,
  },
  {
    id: "crypto-com",
    name: "Crypto.com",
    category: "crypto",
    icon: "cryptocom.png",
    status: "active",
  },

  // Stocks & Options
  { id: "alpaca", name: "Alpaca", category: "stocks", icon: "alpaca.png", status: "active" },
  { id: "public", name: "Public", category: "stocks", icon: "public.png", status: "active" },
  { id: "webull", name: "Webull", category: "stocks", icon: "webull.png", status: "active" },
  { id: "tradier", name: "Tradier", category: "stocks", icon: "tradier.png", status: "active" },
  {
    id: "questrade",
    name: "Questrade",
    category: "stocks",
    icon: "questrade.png",
    status: "active",
    invertInDark: true,
  },
  {
    id: "trading212",
    name: "Trading212",
    category: "stocks",
    icon: "trading212.png",
    status: "active",
  },
  {
    id: "ibkr-flex",
    name: "Interactive Brokers",
    category: "stocks",
    icon: "ibkr.png",
    status: "active",
  },
  {
    id: "etrade",
    name: "E*TRADE",
    category: "stocks",
    icon: "etrade.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },
  {
    id: "tastytrade",
    name: "tastytrade",
    category: "stocks",
    icon: "tastytrade.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },
  {
    id: "tradestation",
    name: "TradeStation",
    category: "stocks",
    icon: "tradestation.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },
  {
    id: "schwab",
    name: "Charles Schwab",
    category: "stocks",
    icon: "schwab.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },

  // Futures & Prop Trading
  {
    id: "ftmo",
    name: "FTMO",
    category: "futures",
    icon: "ftmo.png",
    status: "active",
    subtitle: "MetaTrader & cTrader",
    invertInDark: true,
  },
  {
    id: "topstep",
    name: "Topstep",
    category: "futures",
    icon: "topstep.jpg",
    status: "active",
    subtitle: "TopstepX API sync",
  },
  {
    id: "tradovate",
    name: "Tradovate",
    category: "futures",
    icon: "tradovate.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },
  {
    id: "ninjatrader",
    name: "NinjaTrader",
    category: "futures",
    icon: "ninjatrader.png",
    status: "soon",
    subtitle: "Soon · CSV import today",
  },
];

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: (accountId: string) => void;
  initialTab?: "broker" | "import" | "manual";
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
  initialTab = "broker",
}: AddAccountDialogProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"broker" | "import" | "manual">(initialTab);
  const [selectedBroker, setSelectedBroker] = useState<BrokerCatalogItem | null>(null);

  // Broker SDK API data
  const { data: brokerData } = useApi<{ brokers: BrokerSdkInfo[] }>("/api/brokers");
  const { refresh: refreshAccounts } = useApi<{ accounts: AccountRow[] }>(
    "/api/accounts?summary=1",
  );
  const { data: settingsData } = useApi<{ timeZone: string }>("/api/settings");

  // --- Broker Connect State ---
  const [brokerAccountName, setBrokerAccountName] = useState("");
  const [brokerCredentials, setBrokerCredentials] = useState<Record<string, string>>({});
  const [ftmoPlatform, setFtmoPlatform] = useState("mt5");
  const [ftmoBalance, setFtmoBalance] = useState("100000");
  const [ftmoCurrency, setFtmoCurrency] = useState("USD");
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [brokerError, setBrokerError] = useState<string | null>(null);

  // --- Manual Account State ---
  const [manualName, setManualName] = useState("");
  const [manualCurrency, setManualCurrency] = useState("USD");
  const [manualBalance, setManualBalance] = useState("");
  const [manualProfitCalc, setManualProfitCalc] = useState<"fifo" | "lifo" | "wavg">("fifo");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // --- File Import State ---
  const [importAccountName, setImportAccountName] = useState("");
  const [importContent, setImportContent] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<PreviewResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setSelectedBroker(null);
    setBrokerAccountName("");
    setBrokerCredentials({});
    setBrokerError(null);
    setManualName("");
    setManualCurrency("USD");
    setManualBalance("");
    setManualError(null);
    setImportContent(null);
    setImportFileName(null);
    setImportPreview(null);
    setImportError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetAll();
    onOpenChange(nextOpen);
  };

  // --- Create Manual Account ---
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
      handleOpenChange(false);
    } catch (cause) {
      setManualError(cause instanceof Error ? cause.message : "Failed to create account.");
    } finally {
      setManualBusy(false);
    }
  };

  // --- Create Broker Connected Account (or FTMO) ---
  const handleConnectBroker = async () => {
    if (!selectedBroker) return;
    setBrokerBusy(true);
    setBrokerError(null);

    try {
      if (selectedBroker.id === "ftmo") {
        // FTMO is recorded as a dedicated prop trading account
        const res = await postJson<{ id: string }>("/api/accounts", {
          name: brokerAccountName.trim() || `FTMO (${ftmoPlatform.toUpperCase()})`,
          kind: "manual",
          broker: "ftmo",
          currency: ftmoCurrency,
          initialBalance: Number(ftmoBalance) || 100000,
          profitCalcMethod: "fifo",
        });
        refreshAccounts();
        onAccountCreated?.(res.id);
        handleOpenChange(false);
        return;
      }

      // API Broker connected via SDK
      const brokerMeta = brokerData?.brokers.find((b) => b.id === selectedBroker.id);
      const res = await postJson<{ id: string }>("/api/accounts", {
        name: brokerAccountName.trim() || (brokerMeta?.displayName ?? selectedBroker.name),
        kind: "sync",
        broker: selectedBroker.id,
        credentials: brokerCredentials,
      });
      refreshAccounts();
      onAccountCreated?.(res.id);
      handleOpenChange(false);
    } catch (cause) {
      setBrokerError(cause instanceof Error ? cause.message : "Broker connection failed.");
    } finally {
      setBrokerBusy(false);
    }
  };

  // --- Handle File Drop / Select ---
  const handleFileChange = async (file: File) => {
    setImportBusy(true);
    setImportError(null);
    setImportFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeImportFile(buffer);
      setImportContent(text);

      // Auto-preview
      const previewRes = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content: text,
        fileName: file.name,
        timeZone: settingsData?.timeZone || "UTC",
      });
      setImportPreview(previewRes);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Failed to inspect statement file.");
    } finally {
      setImportBusy(false);
    }
  };

  // --- Commit File Import ---
  const handleCommitImport = async () => {
    if (!importContent || !importPreview) return;
    setImportBusy(true);
    setImportError(null);

    try {
      // Create account automatically named after the custom name, file, or detected format
      const defaultName =
        importAccountName.trim() ||
        importPreview.detected ||
        importFileName?.replace(/\.[^/.]+$/, "") ||
        "Imported Account";

      const accountRes = await postJson<{ id: string }>("/api/accounts", {
        name: defaultName,
        kind: "import",
        broker: importPreview.detected ?? "",
      });
      const finalAccountId = accountRes.id;

      await postJson<{ inserted: number; duplicates: number; skipped?: number }>("/api/import", {
        mode: "commit",
        content: importContent,
        accountId: finalAccountId,
        fileName: importFileName,
        timeZone: importPreview.timeZone || settingsData?.timeZone || "UTC",
      });

      refreshAccounts();
      onAccountCreated?.(finalAccountId);
      handleOpenChange(false);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const matchedSdkBroker = selectedBroker
    ? (brokerData?.brokers.find((b) => b.id === selectedBroker.id) ?? null)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 rounded-3xl">
        <DialogHeader className="gap-1 pb-1">
          <DialogTitle className="text-base font-semibold">Add journal account</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect a broker, import an export file, or start an empty manual account.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as "broker" | "import" | "manual");
            setSelectedBroker(null);
          }}
        >
          <TabsList className="w-full flex h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="broker"
              className="flex-1 h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Landmark className="mr-1.5 size-3.5 shrink-0" />
              Connect broker
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="flex-1 h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <FileUp className="mr-1.5 size-3.5 shrink-0" />
              Import file
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="flex-1 h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <PencilLine className="mr-1.5 size-3.5 shrink-0" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* TAB 1: CONNECT BROKER                                        */}
          {/* ============================================================ */}
          <TabsContent value="broker" className="mt-3 space-y-4">
            {!selectedBroker ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Connected brokers sync into your journal automatically (and refresh daily).
                </p>

                <div className="space-y-4 pt-1">
                  {/* Crypto */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Crypto
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {BROKER_CATALOG.filter((b) => b.category === "crypto").map((broker) => (
                        <button
                          key={broker.id}
                          type="button"
                          onClick={() => {
                            setSelectedBroker(broker);
                            setBrokerAccountName(broker.name);
                          }}
                          className="group flex items-center gap-2.5 rounded-xl border border-border/70 p-2.5 text-left transition-all hover:bg-muted/50 hover:border-border active:scale-[0.98] cursor-pointer"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/80 p-1">
                            <img
                              src={`/assets/brokers/${broker.icon}`}
                              alt=""
                              className={cn(
                                "size-full object-contain",
                                broker.invertInDark && "dark:invert",
                              )}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {broker.name}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stocks & Options */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Stocks & options
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {BROKER_CATALOG.filter((b) => b.category === "stocks").map((broker) => (
                        <button
                          key={broker.id}
                          type="button"
                          onClick={() => {
                            if (broker.status === "active") {
                              setSelectedBroker(broker);
                              setBrokerAccountName(broker.name);
                            } else {
                              setActiveTab("import");
                            }
                          }}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
                            broker.status === "soon"
                              ? "border-dashed border-border/60 opacity-80 hover:opacity-100 hover:bg-muted/30"
                              : "border-border/70 hover:bg-muted/50 hover:border-border",
                          )}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/80 p-1">
                            <img
                              src={`/assets/brokers/${broker.icon}`}
                              alt=""
                              className={cn(
                                "size-full object-contain",
                                broker.invertInDark && "dark:invert",
                              )}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-xs font-medium",
                                broker.status === "soon"
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                              )}
                            >
                              {broker.name}
                            </span>
                            {broker.subtitle && (
                              <span className="block truncate text-[10px] text-muted-foreground/80">
                                {broker.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Futures & Prop Trading (includes FTMO!) */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Futures & prop trading
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {BROKER_CATALOG.filter((b) => b.category === "futures").map((broker) => (
                        <button
                          key={broker.id}
                          type="button"
                          onClick={() => {
                            if (broker.status === "active") {
                              setSelectedBroker(broker);
                              setBrokerAccountName(
                                broker.id === "ftmo" ? "FTMO 100k Challenge" : broker.name,
                              );
                            } else {
                              setActiveTab("import");
                            }
                          }}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
                            broker.status === "soon"
                              ? "border-dashed border-border/60 opacity-80 hover:opacity-100 hover:bg-muted/30"
                              : "border-border/70 hover:bg-muted/50 hover:border-border",
                          )}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/80 p-1">
                            <img
                              src={`/assets/brokers/${broker.icon}`}
                              alt=""
                              className={cn(
                                "size-full object-contain",
                                broker.invertInDark && "dark:invert",
                              )}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-foreground">
                              {broker.name}
                            </span>
                            {broker.subtitle && (
                              <span className="block truncate text-[10px] text-muted-foreground/80">
                                {broker.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Anything else */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Anything else
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("import")}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-border/70 p-2.5 text-left transition-all hover:bg-muted/50 cursor-pointer active:scale-[0.98]"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-xs font-bold text-muted-foreground">
                        I
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          Import a statement
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          Any broker&apos;s CSV or HTML export feeds the same stats
                        </span>
                      </span>
                    </button>
                  </div>
                </div>

                <p className="pt-2 text-[11px] text-muted-foreground/80">
                  Read-only access. Credentials are encrypted and can be revoked from your broker at
                  any time.
                </p>
              </>
            ) : (
              /* --- Single Broker Configuration View --- */
              <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
                <button
                  type="button"
                  onClick={() => setSelectedBroker(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to brokers</span>
                </button>

                <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background p-1.5 shadow-xs">
                    <img
                      src={`/assets/brokers/${selectedBroker.icon}`}
                      alt=""
                      className={cn(
                        "size-full object-contain",
                        selectedBroker.invertInDark && "dark:invert",
                      )}
                    />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Connect {selectedBroker.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedBroker.id === "ftmo"
                        ? "Account management & trade tracking"
                        : "Encrypted read-only synchronization"}
                    </p>
                  </div>
                </div>

                {selectedBroker.id === "ftmo" ? (
                  /* FTMO specific setup */
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Account Name</Label>
                      <Input
                        value={brokerAccountName}
                        onChange={(e) => setBrokerAccountName(e.target.value)}
                        placeholder="e.g. FTMO 100k Challenge"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Trading Platform</Label>
                        <Select value={ftmoPlatform} onValueChange={setFtmoPlatform}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mt5">MetaTrader 5</SelectItem>
                            <SelectItem value="mt4">MetaTrader 4</SelectItem>
                            <SelectItem value="ctrader">cTrader</SelectItem>
                            <SelectItem value="dxtrade">DXtrade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Currency</Label>
                        <Select value={ftmoCurrency} onValueChange={setFtmoCurrency}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CZK">CZK (Kč)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Initial Account Balance</Label>
                      <Input
                        type="number"
                        value={ftmoBalance}
                        onChange={(e) => setFtmoBalance(e.target.value)}
                        placeholder="100000"
                        className="h-8 text-xs tnum"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Unlocks exact drawdown metrics and prop evaluation progress.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Statement Import Ready</p>
                      <p className="text-[11px] leading-relaxed">
                        After creating this account, export your trading history report from
                        MetaTrader (HTML/CSV) or cTrader and import it anytime to sync executions.
                      </p>
                    </div>

                    {brokerError && (
                      <p role="alert" className="text-xs text-destructive">
                        {brokerError}
                      </p>
                    )}

                    <Button
                      onClick={handleConnectBroker}
                      disabled={brokerBusy}
                      className="w-full h-8 text-xs font-semibold cursor-pointer"
                    >
                      {brokerBusy ? "Creating FTMO account…" : "Create FTMO Account"}
                    </Button>
                  </div>
                ) : (
                  /* Standard SDK API Broker */
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Account Name</Label>
                      <Input
                        value={brokerAccountName}
                        onChange={(e) => setBrokerAccountName(e.target.value)}
                        placeholder={`My ${selectedBroker.name} Account`}
                        className="h-8 text-xs"
                      />
                    </div>

                    {(matchedSdkBroker?.credentials ?? []).map((cred) => (
                      <div key={cred.key} className="space-y-1">
                        <Label className="text-xs">{cred.label}</Label>
                        <Input
                          type={cred.secret ? "password" : "text"}
                          value={brokerCredentials[cred.key] ?? ""}
                          onChange={(e) =>
                            setBrokerCredentials((prev) => ({
                              ...prev,
                              [cred.key]: e.target.value,
                            }))
                          }
                          className="h-8 text-xs font-mono"
                          placeholder={cred.secret ? "••••••••" : ""}
                        />
                      </div>
                    ))}

                    {matchedSdkBroker?.readOnlySetup && (
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Setup instructions: </span>
                        <span className="text-[11px] leading-relaxed">
                          {matchedSdkBroker.readOnlySetup}
                        </span>
                      </div>
                    )}

                    {brokerError && (
                      <p role="alert" className="text-xs text-destructive">
                        {brokerError}
                      </p>
                    )}

                    <Button
                      onClick={handleConnectBroker}
                      disabled={brokerBusy}
                      className="w-full h-8 text-xs font-semibold cursor-pointer"
                    >
                      {brokerBusy
                        ? "Connecting & syncing…"
                        : `Connect & Sync ${selectedBroker.name}`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB 2: IMPORT FILE                                           */}
          {/* ============================================================ */}
          <TabsContent value="import" className="mt-3 space-y-3.5">
            <p className="text-xs text-muted-foreground">
              Broker and journal exports are auto-detected — MetaTrader, IBKR, thinkorswim,
              TradingView, TradeZella, Tradervue and more.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Account Name</Label>
              <Input
                value={importAccountName}
                onChange={(e) => setImportAccountName(e.target.value)}
                placeholder="e.g. Main Account (or auto-detected from statement)"
                className="h-8 text-xs"
              />
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.htm,.html,text/csv,text/html"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileChange(f);
              }}
            />

            {/* File Dropzone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className={cn(
                "flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/70 p-4 text-center transition-colors cursor-pointer hover:bg-muted/40 active:scale-[0.99]",
                importPreview && "border-primary/50 bg-primary/5",
              )}
            >
              <FileUp className="size-5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                {importFileName ? importFileName : "Upload CSV or HTML file"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Drag &amp; drop or click to browse CSV or HTML statement
              </span>
            </button>

            {/* Preview Card */}
            {importPreview && (
              <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {importPreview.detected ?? "Auto-detected"}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {importPreview.totals?.executions ?? 0} executions
                  </span>
                  <span className="text-muted-foreground">
                    · {importPreview.totals?.symbols ?? 0} symbols
                  </span>
                  {importPreview.totals?.from && (
                    <span className="text-muted-foreground">
                      · {dayKeyOf(importPreview.totals.from, settingsData?.timeZone || "UTC")} →{" "}
                      {importPreview.totals.to &&
                        dayKeyOf(importPreview.totals.to, settingsData?.timeZone || "UTC")}
                    </span>
                  )}
                </div>

                {importPreview.warnings?.map((warn, i) => (
                  <p key={i} className="text-[11px] text-amber-500">
                    ⚠ {warn}
                  </p>
                ))}
              </div>
            )}

            {importError && (
              <p role="alert" className="text-xs text-destructive">
                {importError}
              </p>
            )}

            {importPreview && (
              <Button
                onClick={handleCommitImport}
                disabled={importBusy || !importPreview.totals?.executions}
                className="w-full h-8 text-xs font-semibold cursor-pointer"
              >
                {importBusy
                  ? "Importing trades…"
                  : `Import ${importPreview.totals?.executions ?? 0} Trades`}
              </Button>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB 3: MANUAL ACCOUNT                                        */}
          {/* ============================================================ */}
          <TabsContent value="manual" className="mt-3 space-y-3.5">
            <p className="text-xs text-muted-foreground">
              Start an empty manual account to record trades and diários directly.
            </p>

            <form onSubmit={handleCreateManual} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Account Name</Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Futures Prop Account"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Currency</Label>
                  <Input
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="h-8 text-xs uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Initial Balance (optional)</Label>
                  <Input
                    type="number"
                    value={manualBalance}
                    onChange={(e) => setManualBalance(e.target.value)}
                    placeholder="Unlocks drawdown %"
                    className="h-8 text-xs tnum"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Profit Calculation Method</Label>
                <Select
                  value={manualProfitCalc}
                  onValueChange={(val) => setManualProfitCalc(val as "fifo" | "lifo" | "wavg")}
                >
                  <SelectTrigger className="h-8 text-xs">
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
                className="w-full h-8 text-xs font-semibold cursor-pointer"
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
