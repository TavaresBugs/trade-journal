"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Pencil,
  Save,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpHint } from "@/components/ui/tooltip";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { getAccountBrokerInfo } from "@/lib/brokers/broker-catalog";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type {
  AccountCredentialsResult,
  AccountPlatformCredentials,
} from "@/server/account-credentials";

export function PadlockIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M384,200V144a128,128,0,0,0-256,0v56H88V328c0,92.635,75.364,168,168,168s168-75.365,168-168V200ZM160,144a96,96,0,0,1,192,0v56H160ZM392,328c0,74.99-61.01,136-136,136s-136-61.01-136-136V232H392Z" />
    </svg>
  );
}

function getAccountPlatformBadges(
  account?: AccountCredentialsResult["account"],
  credentials?: AccountPlatformCredentials | null,
): { name: string; src: string; key: string }[] {
  const normPlatform = (account?.platform || "").toLowerCase();
  const normBroker = (account?.broker || "").toLowerCase();
  const normName = (account?.name || "").toLowerCase();

  if (normPlatform.includes("mt5") || normPlatform.includes("metatrader5") || normName.includes("mt5")) {
    return [{ name: "MetaTrader 5", src: "/assets/brokers/metatrader5.png", key: "metatrader5" }];
  }
  if (normPlatform.includes("mt4") || normPlatform.includes("metatrader4") || normName.includes("mt4")) {
    return [{ name: "MetaTrader 4", src: "/assets/brokers/metatrader.png", key: "metatrader" }];
  }
  if (normPlatform.includes("metatrader") || normBroker.includes("ftmo")) {
    return [{ name: "MetaTrader 5", src: "/assets/brokers/metatrader5.png", key: "metatrader5" }];
  }
  if (
    normPlatform.includes("tradovate") ||
    normBroker.includes("lucid") ||
    normBroker.includes("tradeify")
  ) {
    return [
      { name: "NinjaTrader", src: "/assets/brokers/brand-ninjatrader.png", key: "ninjatrader" },
      { name: "Tradovate", src: "/assets/brokers/brand-tradovate.png", key: "tradovate" },
      { name: "TradingView", src: "/assets/brokers/brand-tradingview.png", key: "tradingview" },
    ];
  }
  if (normPlatform.includes("ninjatrader")) {
    return [{ name: "NinjaTrader", src: "/assets/brokers/brand-ninjatrader.png", key: "ninjatrader" }];
  }
  if (normPlatform.includes("tradingview")) {
    return [{ name: "TradingView", src: "/assets/brokers/brand-tradingview.png", key: "tradingview" }];
  }
  if (normPlatform.includes("matchtrader")) {
    return [{ name: "MatchTrader", src: "/assets/brokers/matchtrader.svg", key: "matchtrader" }];
  }
  if (normPlatform.includes("rithmic")) {
    return [{ name: "Rithmic", src: "/assets/brokers/rithmic.png", key: "rithmic" }];
  }

  // If specific platforms are stored in credentials
  if (credentials?.platforms && credentials.platforms.length > 0) {
    const list = credentials.platforms
      .map((p: string) => {
        const lower = p.toLowerCase();
        if (lower === "ninjatrader")
          return { name: "NinjaTrader", src: "/assets/brokers/brand-ninjatrader.png", key: "ninjatrader" };
        if (lower === "tradovate")
          return { name: "Tradovate", src: "/assets/brokers/brand-tradovate.png", key: "tradovate" };
        if (lower === "tradingview")
          return { name: "TradingView", src: "/assets/brokers/brand-tradingview.png", key: "tradingview" };
        if (lower.includes("mt5") || lower.includes("metatrader5"))
          return { name: "MetaTrader 5", src: "/assets/brokers/metatrader5.png", key: "metatrader5" };
        if (lower.includes("mt4") || lower.includes("meta"))
          return { name: "MetaTrader", src: "/assets/brokers/metatrader.png", key: "metatrader" };
        return null;
      })
      .filter(Boolean) as { name: string; src: string; key: string }[];
    if (list.length > 0) return list;
  }

  return [];
}

interface AllAccountsCredentialsResponse {
  accounts: AccountCredentialsResult[];
}

export interface CredentialsDialogProps {
  accountId?: string;
  accountName?: string;
  accountNumber?: string | null;
  isAllAccounts?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CredentialsDialog({
  accountId,
  accountName,
  accountNumber,
  isAllAccounts,
  open,
  onOpenChange,
}: CredentialsDialogProps) {
  const isAll = isAllAccounts || accountId === "all" || !accountId;

  const singleEndpoint = open && !isAll && accountId ? `/api/accounts/${accountId}/credentials` : "";
  const allEndpoint = open && isAll ? `/api/accounts/all/credentials` : "";

  const { data: singleData, loading: singleLoading, refresh: refreshSingle } =
    useApi<AccountCredentialsResult>(singleEndpoint);

  const { data: allData, loading: allLoading, refresh: refreshAll } =
    useApi<AllAccountsCredentialsResponse>(allEndpoint);

  const loading = isAll ? allLoading : singleLoading;
  const refresh = isAll ? refreshAll : refreshSingle;

  // Individual account toggle states
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedUserMap, setCopiedUserMap] = useState<Record<string, boolean>>({});
  const [copiedPassMap, setCopiedPassMap] = useState<Record<string, boolean>>({});
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Editing state
  const [editingAccount, setEditingAccount] = useState<AccountCredentialsResult | null>(null);
  const [configMode, setConfigMode] = useState<"automatic" | "manual">("automatic");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // If single account has no credentials yet, auto-switch to editing mode
  useEffect(() => {
    if (!isAll && singleData) {
      if (!singleData.credentials && !editingAccount) {
        setEditingAccount(singleData);
      }
    }
  }, [isAll, singleData, editingAccount]);

  // When opening/closing or changing target editing account
  const handleStartEdit = (item: AccountCredentialsResult) => {
    setEditingAccount(item);
    setFormUsername(item.credentials?.username || "");
    setFormPassword(item.credentials?.password || "");
    setSaveError(null);
    setConfigMode("automatic");
  };

  const handleCopyUser = async (id: string, username: string) => {
    if (!username) return;
    await navigator.clipboard.writeText(username);
    setCopiedUserMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedUserMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleCopyPass = async (id: string, password?: string) => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopiedPassMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedPassMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeEditingAccount = editingAccount || (isAll ? null : singleData);
  const editingTargetId = activeEditingAccount?.account.id || accountId || "";
  const editingTargetName = activeEditingAccount?.account.name || accountName || "Account";
  const editingEnvKey =
    activeEditingAccount?.suggestedEnvKey ||
    (accountNumber ? `ACCOUNT_${accountNumber}` : `ACCOUNT_${editingTargetId}`);

  const envSnippet = `# Environment credentials for ${editingTargetName}\n${editingEnvKey}_USERNAME=${formUsername || "your_username"}\n${editingEnvKey}_PASSWORD=${formPassword || "your_password"}`;

  const handleCopySnippet = async () => {
    await navigator.clipboard.writeText(envSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formUsername.trim() || !editingTargetId) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await postJson(`/api/accounts/${editingTargetId}/credentials`, {
        username: formUsername.trim(),
        password: formPassword.trim(),
      });
      refresh();
      setEditingAccount(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  const accountsList = isAll
    ? allData?.accounts || []
    : singleData
      ? [singleData]
      : [];

  const isEditing = editingAccount !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-full min-w-0 p-0 sm:p-0 gap-0 sm:gap-0 bg-card border-border/80 shadow-2xl overflow-hidden rounded-xl",
          isAll && !isEditing ? "max-w-3xl" : "max-w-xl",
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs">Loading credentials...</span>
          </div>
        ) : isEditing ? (
          /* Edit / Configure Form State */
          <>
            <DialogHeader className="px-6 py-4 border-b border-border/40 text-left">
              <div className="flex items-center gap-2">
                {/* Back button if came from multi-account table or existing credentials */}
                {(isAll || (!isAll && singleData?.credentials)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 -ml-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setEditingAccount(null)}
                    title={isAll ? "Back to accounts table" : "Back to credentials"}
                  >
                    <ArrowLeft className="size-3.5" />
                  </Button>
                )}
                <KeyRound className="size-4 text-muted-foreground shrink-0" />
                <DialogTitle className="text-sm font-semibold tracking-tight text-foreground pr-0 truncate">
                  Edit credentials — {editingTargetName}
                </DialogTitle>
                <HelpHint heading="Platform Credentials">
                  Enter your credentials below for quick 1-click access or copy the .env snippet for local configuration.
                </HelpHint>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-4 min-w-0">
              <Tabs
                value={configMode}
                onValueChange={(val) => setConfigMode(val as "automatic" | "manual")}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
                  <TabsTrigger
                    value="automatic"
                    className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
                  >
                    Automatic
                  </TabsTrigger>
                  <TabsTrigger
                    value="manual"
                    className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
                  >
                    Manual (.env)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="automatic" className="mt-3.5 space-y-3.5 min-w-0">
                  <form onSubmit={handleSave} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Username</Label>
                      <Input
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="e.g. LTT3UY7XXXX"
                        className="h-8 text-xs font-mono bg-background"
                        autoFocus
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Password</Label>
                      <div className="relative">
                        <Input
                          type={showFormPassword ? "text" : "password"}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="h-8 text-xs font-mono bg-background pr-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => setShowFormPassword(!showFormPassword)}
                          title={showFormPassword ? "Hide password" : "Show password"}
                        >
                          {showFormPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        </Button>
                      </div>
                    </div>

                    {saveError && (
                      <div className="text-[11px] text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded p-2">
                        {saveError}
                      </div>
                    )}

                    <div className="flex items-center justify-center pt-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSaving || !formUsername.trim()}
                        className="h-8 px-6 text-xs gap-1.5 cursor-pointer font-medium"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="size-3.5" />
                            <span>Save Credentials</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="manual" className="mt-3.5 space-y-3 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-0.5">
                    <Info className="size-3.5 shrink-0 text-muted-foreground/80" />
                    <span>
                      Add these variables to your <code className="font-mono text-foreground font-medium">.env.local</code> file in the project root.
                    </span>
                  </div>

                  <div className="relative group rounded-lg bg-black border border-border/60 p-3.5 min-w-0 shadow-inner">
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        type="button"
                        onClick={handleCopySnippet}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer hover:bg-neutral-800"
                        title="Copy snippet"
                      >
                        {copiedSnippet ? (
                          <>
                            <Check className="size-3 text-profit" />
                            <span className="text-profit font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy snippet</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="font-mono text-[11px] text-foreground/90 leading-relaxed overflow-x-auto whitespace-pre max-w-full pt-1 pr-28 block select-all">
                      {envSnippet}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          /* Table View State (Clean full-bleed edge-to-edge, zero bottom footer) */
          <>
            <DialogHeader className="px-6 py-4 border-b border-border/40 text-left">
              <div className="flex items-center gap-2">
                <PadlockIcon className="size-4 text-muted-foreground shrink-0" />
                <DialogTitle className="text-sm font-semibold tracking-tight text-foreground pr-0">
                  Platform Credentials
                </DialogTitle>
                <HelpHint heading="Platform Credentials">
                  Quick 1-click platform credentials. Click copy icons to send username or password to clipboard.
                </HelpHint>
              </div>
            </DialogHeader>

            {isAll ? (
              /* Multi-account (ALL) Table */
              <div>
                {/* Header Row */}
                <div className="grid grid-cols-[190px_130px_1fr_1fr] items-center gap-x-6 px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/30 border-b border-border/40">
                  <span>Mesa / Prop Firm</span>
                  <span className="text-center">Plataforma</span>
                  <span>Username</span>
                  <span>Password</span>
                </div>

                {/* Rows List */}
                <div className="divide-y divide-border/40 bg-black/40 max-h-[60vh] overflow-y-auto">
                  {accountsList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No active accounts found.
                    </div>
                  ) : (
                    accountsList.map((item) => {
                      const brokerInfo = getAccountBrokerInfo(item.account);
                      const badges = getAccountPlatformBadges(item.account, item.credentials);
                      const isShowingPass = !!showPasswordMap[item.account.id];
                      const isUserCopied = !!copiedUserMap[item.account.id];
                      const isPassCopied = !!copiedPassMap[item.account.id];

                      return (
                        <div
                          key={item.account.id}
                          className="grid grid-cols-[190px_130px_1fr_1fr] items-center gap-x-6 px-6 py-3.5 hover:bg-muted/15 transition-colors"
                        >
                          {/* Mesa / Prop Firm Column */}
                          <div className="flex items-center gap-2.5 min-w-0 pr-1">
                            <BrokerIcon
                              icon={brokerInfo?.icon}
                              iconDark={brokerInfo?.iconDark}
                              name={item.account.name}
                              invertInDark={brokerInfo?.invertInDark}
                              className="size-4.5 rounded-xs object-contain shrink-0"
                            />
                            <span
                              className="font-medium text-xs text-foreground truncate"
                              title={item.account.name}
                            >
                              {item.account.name}
                            </span>
                          </div>

                          {/* Plataforma Column (Inteligente e Centralizada) */}
                          <div className="flex items-center justify-center gap-2 shrink-0">
                            {badges.length > 0 ? (
                              badges.map((b) => (
                                <img
                                  key={b.key}
                                  src={b.src}
                                  alt={b.name}
                                  title={b.name}
                                  className="h-4.5 w-auto max-w-[28px] object-contain drop-shadow-xs"
                                />
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60 text-center">--</span>
                            )}
                          </div>

                          {/* Username Column + Copy & Edit */}
                          <div className="flex items-center justify-between min-w-0">
                            <span className="font-mono text-xs font-medium text-foreground truncate select-all">
                              {item.credentials?.username || (
                                <span className="text-[11px] text-muted-foreground/60 italic font-sans font-normal">
                                  Not set
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {item.credentials?.username && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                  onClick={() => handleCopyUser(item.account.id, item.credentials!.username)}
                                  title="Copy username"
                                >
                                  {isUserCopied ? (
                                    <Check className="size-3 text-profit" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                onClick={() => handleStartEdit(item)}
                                title={item.credentials ? "Edit credentials" : "Configure credentials"}
                              >
                                <Pencil className="size-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Password Column + Eye & Copy */}
                          <div className="flex items-center justify-between min-w-0">
                            <span className="font-mono text-xs font-medium text-foreground tracking-widest truncate select-none">
                              {item.credentials?.password ? (
                                isShowingPass ? (
                                  item.credentials.password
                                ) : (
                                  "••••••••••••"
                                )
                              ) : (
                                <span className="text-muted-foreground/40 font-mono tracking-widest">
                                  ••••••••••••
                                </span>
                              )}
                            </span>
                            {item.credentials?.password && (
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => toggleShowPassword(item.account.id)}
                                  title={isShowingPass ? "Hide password" : "Show password"}
                                >
                                  {isShowingPass ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => handleCopyPass(item.account.id, item.credentials!.password)}
                                  title="Copy password"
                                >
                                  {isPassCopied ? (
                                    <Check className="size-3 text-profit" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Single Account Short Table */
              <div>
                {/* Header Row */}
                <div className="grid grid-cols-[140px_1fr_1fr] items-center gap-x-6 px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/30 border-b border-border/40">
                  <span className="text-center">Plataforma</span>
                  <span>Username</span>
                  <span>Password</span>
                </div>

                {/* Body Row (Zero bottom footer, directly bounds dialog) */}
                {singleData && (
                  <div className="grid grid-cols-[140px_1fr_1fr] items-center gap-x-6 px-6 py-4 bg-black/40">
                    {/* Plataforma Column (Centralizada) */}
                    <div className="flex items-center justify-center gap-2 shrink-0">
                      {getAccountPlatformBadges(singleData.account, singleData.credentials).map(
                        (meta) => (
                          <img
                            key={meta.key}
                            src={meta.src}
                            alt={meta.name}
                            title={meta.name}
                            className="h-4.5 w-auto max-w-[28px] object-contain drop-shadow-xs"
                          />
                        ),
                      )}
                    </div>

                    {/* Username + Copy & Edit */}
                    <div className="flex items-center justify-between min-w-0">
                      <span className="font-mono text-xs font-medium text-foreground truncate select-all">
                        {singleData.credentials?.username}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          onClick={() =>
                            handleCopyUser(singleData.account.id, singleData.credentials!.username)
                          }
                          title="Copy username"
                        >
                          {copiedUserMap[singleData.account.id] ? (
                            <Check className="size-3 text-profit" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          onClick={() => handleStartEdit(singleData)}
                          title="Edit credentials"
                        >
                          <Pencil className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Password + Eye & Copy */}
                    <div className="flex items-center justify-between min-w-0">
                      <span className="font-mono text-xs font-medium text-foreground tracking-widest truncate select-none">
                        {showPasswordMap[singleData.account.id]
                          ? singleData.credentials?.password || "••••••••••••"
                          : "••••••••••••"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => toggleShowPassword(singleData.account.id)}
                          title={
                            showPasswordMap[singleData.account.id] ? "Hide password" : "Show password"
                          }
                        >
                          {showPasswordMap[singleData.account.id] ? (
                            <EyeOff className="size-3" />
                          ) : (
                            <Eye className="size-3" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() =>
                            handleCopyPass(singleData.account.id, singleData.credentials?.password)
                          }
                          title="Copy password"
                        >
                          {copiedPassMap[singleData.account.id] ? (
                            <Check className="size-3 text-profit" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShowCredentialsButton({
  accountId,
  accountName,
  accountNumber,
  isAllAccounts,
  className,
}: {
  accountId?: string;
  accountName?: string;
  accountNumber?: string | null;
  isAllAccounts?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Platform credentials"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.98] cursor-pointer select-none",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <PadlockIcon className="size-3.5 text-muted-foreground shrink-0" />
        <span>Show Credentials</span>
      </button>

      <CredentialsDialog
        accountId={accountId}
        accountName={accountName}
        accountNumber={accountNumber}
        isAllAccounts={isAllAccounts}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
