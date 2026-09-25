"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Coins,
  FileCheck2,
  FileSpreadsheet,
  FileUp,
  HelpCircle,
  Info,
  Landmark,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { ManualTradeEntry } from "@/components/manual-trade-entry";
import { FilterBar } from "@/components/filter-bar";
import {
  BROKER_CATALOG,
  EXPORT_INSTRUCTIONS,
  PLATFORM_METADATA,
  getBrokerMetadata,
  getPlatformOptionsForBroker,
  checkPlatformCompatibility,
  getPresetForDetectedStatement,
} from "@/lib/brokers/broker-catalog";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DirectionBadge } from "@/components/ui/direction-badge";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { CurrencyBadge } from "@/components/ui/currency-badge";
import { CURRENCY_LIST, getCurrencyInfo } from "@/lib/currencies";
import type {
  BrokerCatalogItem,
  BrokerSdkInfo,
  PreviewTotals,
  PreviewResponse,
} from "@/types/import";
import type { AccountRow } from "@/types/accounts";
import { ImportReconciliation } from "@/components/import-reconciliation";
import type { ImportReviewOptions } from "@/lib/import-review";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { formatTimestamp, isTimeZone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { dayKeyOf } from "@luxalgo/journal-core";
import { TimeZonePicker } from "@/components/timezone-picker";

export default function ImportPage() {
  return (
    <Suspense>
      <ImportView />
    </Suspense>
  );
}

function ImportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"file" | "sync" | "manual">(
    tabParam === "sync" || tabParam === "manual" ? tabParam : "file",
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

  return (
    <div className="min-h-screen bg-background">
      <FilterBar title="Import trades" />
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-5">
        {/* Page Subtitle */}
        <div className="space-y-0.5">
          <h2
            className="text-lg font-bold tracking-tight text-foreground"
            style={{ textWrap: "balance" }}
          >
            Import Trades &amp; Connect Accounts
          </h2>
          <p className="text-xs text-muted-foreground" style={{ textWrap: "pretty" }}>
            Bring executions into your journal via broker statement files, automated read-only sync,
            or manual entry.
          </p>
        </div>

        {/* Standardized Segmented Control */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "file" | "sync" | "manual")}
          className="space-y-4"
        >
          <TabsList className="w-full flex h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="file"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <FileUp className="size-3.5 shrink-0" />
              <span>File upload</span>
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Landmark className="size-3.5 shrink-0" />
              <span>Broker sync</span>
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <PencilLine className="size-3.5 shrink-0" />
              <span>Manual entry</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE IMPORT */}
          <TabsContent value="file" className="focus-visible:outline-none">
            <FileImport initialAccountId={selectedAccountId} />
          </TabsContent>

          {/* TAB 2: BROKER SYNC */}
          <TabsContent value="sync" className="focus-visible:outline-none">
            <BrokerConnect
              onGoToFile={(newId) => {
                if (newId) setSelectedAccountId(newId);
                setActiveTab("file");
              }}
            />
          </TabsContent>

          {/* TAB 3: MANUAL ENTRY */}
          <TabsContent value="manual" className="focus-visible:outline-none">
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5 space-y-4 shadow-xs">
              <div className="border-b border-border/50 pb-3">
                <h3 className="text-sm font-semibold text-foreground">Add executions manually</h3>
                <p className="text-xs text-muted-foreground">
                  Record trades directly into your accounts with custom executions, fees, and notes.
                </p>
              </div>
              <ManualTradeEntry onSaved={() => router.push("/trades")} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FileImport({ initialAccountId }: { initialAccountId?: string }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(initialAccountId || "");

  useEffect(() => {
    if (initialAccountId) {
      setAccountId(initialAccountId);
    }
  }, [initialAccountId]);
  const [reviewOptions, setReviewOptions] = useState<ImportReviewOptions>({});
  const changeReview = (options: ImportReviewOptions) => {
    setReviewOptions(options);
    setPreview((current) =>
      current
        ? {
            ...current,
            reconciliation: current.reconciliation
              ? { ...current.reconciliation, token: null }
              : undefined,
          }
        : null,
    );
  };
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [mappingApplied, setMappingApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: formatData } = useApi<{ formats: { id: string; label: string }[] }>("/api/import");
  const { data: accountsData, refresh: refreshAccounts } = useApi<{ accounts: AccountRow[] }>(
    "/api/accounts",
  );
  const { data: settingsData, error: settingsError } = useApi<{
    timeZone: string;
    importTimeZone: string;
  }>("/api/settings");

  const [statementTimeZone, setStatementTimeZone] = useState<string | null>(null);
  const [userOverrodeTz, setUserOverrodeTz] = useState(false);
  const [tzPresetInfo, setTzPresetInfo] = useState<string | null>(null);
  const [exportGuideOpen, setExportGuideOpen] = useState(false);
  const [selectedExportGuide, setSelectedExportGuide] = useState<string>("tradovate");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [forceMismatch, setForceMismatch] = useState(false);

  const timeZone = statementTimeZone ?? settingsData?.importTimeZone ?? "";
  const validTimeZone = isTimeZone(timeZone);
  const displayTimeZone = settingsData?.timeZone ?? "UTC";

  const activeAccount = accountsData?.accounts.find((a) => a.id === accountId);
  const matchedStatementAccount = accountsData?.accounts.find(
    (a) =>
      !a.archivedAt &&
      a.accountNumber &&
      preview?.detectedAccount &&
      a.accountNumber.trim().toLowerCase() === preview.detectedAccount.trim().toLowerCase(),
  );
  const preset = getPresetForDetectedStatement(preview?.detectedAccount, preview?.detected);
  const compat = activeAccount && preview?.detected
    ? checkPlatformCompatibility(activeAccount, preview.detected)
    : (preview?.compatibility ?? { compatible: true });
  const hasAccountMismatch = Boolean(
    preview?.detectedAccount &&
    activeAccount?.accountNumber &&
    activeAccount.accountNumber.trim().toLowerCase() !== preview.detectedAccount.trim().toLowerCase(),
  );
  const isBlocked = (Boolean(hasAccountMismatch) || !compat.compatible) && !forceMismatch;

  const handleAccountSelect = (id: string, account?: AccountRow) => {
    setAccountId(id);
    setForceMismatch(false);
    setReviewOptions({});
    let targetTz = statementTimeZone;
    if (account) {
      const brokerMeta = account.broker ? getBrokerMetadata(account.broker) : undefined;
      const recTz = account.timeZone || brokerMeta?.defaultTimeZone;
      if (recTz && isTimeZone(recTz) && !userOverrodeTz) {
        targetTz = recTz;
        setStatementTimeZone(recTz);
        const brokerLabel = brokerMeta?.name ?? account.broker;
        setTzPresetInfo(
          brokerLabel
            ? `Preset from ${account.name} (${brokerLabel})`
            : `Preset from ${account.name}`,
        );
      }
      const platformCandidate = (account.platform || brokerMeta?.platform || account.broker || "").toLowerCase();
      if (platformCandidate.includes("metatrader") || platformCandidate.includes("mt5") || platformCandidate.includes("mt4")) {
        setSelectedExportGuide("metatrader");
      } else if (platformCandidate.includes("ninjatrader") || platformCandidate.includes("ninja")) {
        setSelectedExportGuide("ninjatrader");
      } else if (platformCandidate.includes("topstep")) {
        setSelectedExportGuide("topstepx");
      } else if (platformCandidate.includes("tradovate")) {
        setSelectedExportGuide("tradovate");
      } else if (EXPORT_INSTRUCTIONS[platformCandidate]) {
        setSelectedExportGuide(platformCandidate);
      }
    }
    if (content && validTimeZone) {
      void postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content,
        accountId: id || undefined,
        review: {},
        fileName,
        symbol,
        timeZone: targetTz && isTimeZone(targetTz) ? targetTz : timeZone,
      })
        .then((res) => {
          setPreview(res);
          if (res.errors && res.errors.length > 0 && !res.needsMapping && !res.needsSymbol) {
            setError(res.errors[0] ?? null);
          }
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Import preview failed");
        });
    } else {
      setPreview((current) => (current ? { ...current, reconciliation: undefined } : null));
    }
  };

  useEffect(() => {
    if (!accountId && accountsData?.accounts) {
      const active = accountsData.accounts.filter((a) => !a.archivedAt);
      if (active.length === 1 && active[0]) {
        handleAccountSelect(active[0].id, active[0]);
      }
    }
  }, [accountsData, accountId]);

  const onFile = async (file: File) => {
    if (!validTimeZone) return;
    setStatementTimeZone(timeZone);
    setPreview(null);
    setContent(null);
    setFileName(file.name);
    setReviewOptions({});
    setForceMismatch(false);
    setSymbol("");
    setMapping({});
    setMappingApplied(false);
    setError(null);
    setBusy(true);
    try {
      const text = decodeImportFile(await file.arrayBuffer());
      setContent(text);
      const res = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content: text,
        accountId: accountId || undefined,
        review: {},
        fileName: file.name,
        timeZone,
      });
      setPreview(res);

      // Auto-match account if statement has detectedAccount and target isn't explicitly set yet
      if (res.detectedAccount && accountsData?.accounts) {
        const match = accountsData.accounts.find(
          (a) =>
            !a.archivedAt &&
            ((a.accountNumber &&
              a.accountNumber.trim().toLowerCase() === res.detectedAccount?.trim().toLowerCase()) ||
              (a.name && a.name.trim().toLowerCase() === res.detectedAccount?.trim().toLowerCase())),
        );
        if (match) {
          handleAccountSelect(match.id, match);
        }
      } else if (!accountId && res.accountReconciliation?.accountId && accountsData?.accounts) {
        const match = accountsData.accounts.find(
          (a) => !a.archivedAt && a.id === res.accountReconciliation?.accountId,
        );
        if (match) {
          handleAccountSelect(match.id, match);
        }
      }

      if (res.errors && res.errors.length > 0 && !res.needsMapping && !res.needsSymbol) {
        setError(res.errors[0] ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import preview failed");
    } finally {
      setBusy(false);
    }
  };

  const previewFile = async () => {
    if (!content || !validTimeZone) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content,
        accountId: accountId || undefined,
        review: reviewOptions,
        fileName,
        symbol,
        timeZone,
      });
      setPreview(res);
      if (res.errors && res.errors.length > 0 && !res.needsMapping && !res.needsSymbol) {
        setError(res.errors[0] ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import preview failed");
    } finally {
      setBusy(false);
    }
  };

  const previewWithMapping = async () => {
    if (!content || !validTimeZone) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content,
        mapping,
        timeZone,
      });
      setPreview(res);
      setMappingApplied(true);
      if (res.errors && res.errors.length > 0 && !res.needsMapping && !res.needsSymbol) {
        setError(res.errors[0] ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import preview failed");
    } finally {
      setBusy(false);
    }
  };

  const resetFile = () => {
    setContent(null);
    setFileName("");
    setPreview(null);
    setSymbol("");
    setMapping({});
    setMappingApplied(false);
    setForceMismatch(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const commit = async () => {
    if (!content || !accountId || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{
        inserted: number;
        duplicates: number;
        corrected?: number;
        skipped?: number;
        warnings?: string[];
      }>("/api/import", {
        mode: "commit",
        review: { ...reviewOptions, previewToken: preview.reconciliation?.token ?? undefined },
        content,
        accountId,
        mapping: mappingApplied ? mapping : undefined,
        fileName,
        symbol,
        timeZone: preview.timeZone,
        forceMismatch,
      });
      const skippedNote =
        result.skipped && result.skipped > 0
          ? ` ${result.skipped} invalid rows were skipped: ${(result.warnings ?? []).at(-1) ?? ""}`
          : "";
      alert(
        `Imported ${result.inserted} executions (${result.duplicates} duplicates skipped, ${result.corrected ?? 0} fee corrections).${skippedNote}`,
      );
      router.push(`/?accounts=${encodeURIComponent(accountId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const mappingFields = ["symbol", "side", "quantity", "price", "fee", "timestamp"] as const;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden shadow-xs">
      <div className="p-5 space-y-4">
        {/* Account & Timezone Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <AccountPicker
              value={accountId}
              onChange={handleAccountSelect}
              kind="import"
              label="Target Account (recommended)"
            />
            <p className="text-[11px] text-muted-foreground leading-normal" style={{ textWrap: "pretty" }}>
              Select an account to automatically preset its broker timezone and format rules.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex h-5 items-center justify-between">
              <Label htmlFor="statement-timezone" className="text-xs font-semibold text-foreground">
                Statement Timezone
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Displays in{" "}
                <span className="font-mono font-medium text-foreground">{displayTimeZone}</span>
              </span>
            </div>
            <TimeZonePicker
              id="statement-timezone"
              label="Statement timezone"
              value={timeZone}
              disabled={busy || !settingsData}
              describedBy="statement-timezone-help"
              onValueChange={(zone) => {
                setStatementTimeZone(zone);
                setUserOverrodeTz(true);
                setTzPresetInfo(null);
                setPreview(null);
                setMappingApplied(false);
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] leading-normal">
              <p id="statement-timezone-help" className="text-muted-foreground">
                {tzPresetInfo ? "Broker statement timezone." : "Choose the timezone used by your broker's statement."}
              </p>
              {tzPresetInfo && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-profit shrink-0">
                  <CheckCircle2 className="size-3 shrink-0 text-profit" />
                  <span>{tzPresetInfo}</span>
                </span>
              )}
            </div>
            {timeZone && !validTimeZone && (
              <p role="alert" className="text-xs text-loss">
                Enter a valid IANA timezone, such as Europe/Helsinki.
              </p>
            )}
            {settingsError && (
              <p role="alert" className="text-xs text-loss">
                {settingsError}
              </p>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.htm,.html,.tsv"
          disabled={busy || !settingsData || !validTimeZone}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />

        {/* Sleek Reusable Dropzone */}
        {!preview ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none",
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border/70 hover:border-primary/50 hover:bg-muted/30",
            (busy || !settingsData || !validTimeZone) && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-primary mb-2.5" />
          ) : (
            <Upload className="size-6 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all duration-150 mb-2.5" />
          )}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              {busy ? "Parsing statement…" : fileName || "Click or drop your statement here"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supports CSV &amp; HTML exports (FTMO, MT4/MT5, TradeZella, Tradovate, IBKR, etc.)
            </p>
            {formatData?.formats && (
              <p className="text-[10px] text-muted-foreground/75 pt-1">
                Auto-detected:{" "}
                {formatData.formats
                  .map((f) => f.label.split(" (")[0])
                  .slice(0, 7)
                  .join(", ")}
                {formatData.formats.length > 7 ? " and more" : ""}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Preview Section */
        <div className="pt-2">
          <div
            className={cn(
              "rounded-xl border bg-card/40 overflow-hidden shadow-xs transition-colors",
              isBlocked ? "border-loss/30" : "border-border/60",
            )}
          >
            {/* 1. Card Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/20 border-b border-border/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="size-4 text-brand shrink-0" />
                <span className="truncate text-xs font-semibold text-foreground">{fileName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {preview.detected && (() => {
                  const platformMeta =
                    PLATFORM_METADATA[preview.detected] || getBrokerMetadata(preview.detected);
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {platformMeta?.icon && (
                        <BrokerIcon
                          icon={platformMeta.icon}
                          name={platformMeta.name}
                          className="size-4 rounded-xs shrink-0"
                        />
                      )}
                      <span className="font-medium text-foreground">
                        {platformMeta?.name || preview.detected}
                      </span>
                    </div>
                  );
                })()}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={resetFile}
                  disabled={busy}
                >
                  <ArrowLeftRight className="size-3 shrink-0" />
                  <span>Change file</span>
                </Button>
              </div>
            </div>

            {/* 2. Account Matching Context (when matched on different account or auto-linked) */}

            {matchedStatementAccount &&
              (!activeAccount || activeAccount.id !== matchedStatementAccount.id) && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-primary/5 border-b border-primary/20 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="size-4 shrink-0 text-primary" />
                    <span className="truncate">
                      Extrato da conta <strong>#{preview.detectedAccount}</strong> corresponde à conta registrada <strong>{matchedStatementAccount.name}</strong>.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 font-medium shrink-0 cursor-pointer"
                    onClick={() =>
                      handleAccountSelect(matchedStatementAccount.id, matchedStatementAccount)
                    }
                  >
                    Selecionar {matchedStatementAccount.name}
                  </Button>
                </div>
              )}

            {activeAccount &&
              !activeAccount.accountNumber &&
              compat.compatible &&
              preview.detectedAccount && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border-b border-primary/20 text-xs text-foreground">
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  <span>
                    A conta <strong>{activeAccount.name}</strong> não possuía identificador e será vinculada ao ID <strong>#{preview.detectedAccount}</strong>.
                  </span>
                </div>
              )}

            {!activeAccount && preview.detectedAccount && !matchedStatementAccount && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 text-xs">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-semibold text-foreground">
                      ID de Extrato Detectado: #{preview.detectedAccount}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Nenhuma conta possui esse ID registrado. Crie uma nova conta para esse extrato ou selecione uma existente acima.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 text-[11px] px-2.5 font-medium shrink-0 cursor-pointer"
                  onClick={() => setCreateAccountOpen(true)}
                >
                  <Plus className="size-3 mr-1" />
                  Criar conta #{preview.detectedAccount}
                </Button>
              </div>
            )}

            {/* 3. Top Metrics Strip */}
            {preview.totals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40 border-b border-border/30 text-center">
                <div className="bg-card/70 p-3 space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                    Trades
                  </span>
                  <span className="text-base font-bold text-foreground font-mono tnum">
                    {preview.accountReconciliation?.totalTrades ??
                      Math.ceil((preview.totals.executions ?? 0) / 2)}
                  </span>
                </div>
                <div className="bg-card/70 p-3 space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                    Fills (Execuções)
                  </span>
                  <span className="text-base font-bold text-foreground font-mono tnum">
                    {preview.totals.executions}
                  </span>
                </div>
                <div className="bg-card/70 p-3 space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                    Ativos
                  </span>
                  <span className="text-base font-bold text-foreground font-mono tnum">
                    {preview.totals.symbols}
                  </span>
                </div>
                <div className="bg-card/70 p-3 space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                    Período
                  </span>
                  <span
                    className="text-xs font-semibold text-foreground font-mono truncate block tnum"
                    title={`${preview.totals.from} to ${preview.totals.to}`}
                  >
                    {preview.totals.from && preview.totals.to
                      ? `${dayKeyOf(preview.totals.from, displayTimeZone)} → ${dayKeyOf(preview.totals.to, displayTimeZone)}`
                      : "—"}
                  </span>
                </div>
              </div>
            )}

            {/* 4. Executions Data Grid Table */}
            {!!preview.executions?.length && (
              <div>
                <div className="flex items-center justify-between px-3.5 py-2 bg-muted/20 border-b border-border/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Amostra de Execuções (primeiras 5)
                  </span>
                  {preview.totals && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {preview.totals.executions} execuções no extrato
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30">
                      <tr>
                        <th className="py-2 px-3.5">Data / Hora</th>
                        <th className="py-2 px-3.5">Ativo</th>
                        <th className="py-2 px-3.5">Direção</th>
                        <th className="py-2 px-3.5 text-right">Qtd</th>
                        <th className="py-2 px-3.5 text-right">Preço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono text-[11px] tnum">
                      {preview.executions.slice(0, 5).map((execution, index) => {
                        const canonical = normalizeSymbol(execution.symbol);
                        return (
                          <tr key={index} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-3.5 text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(execution.executedAt, displayTimeZone)}
                            </td>
                            <td className="py-2 px-3.5 font-sans">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <AssetIcon symbol={execution.symbol} size="xs" />
                                <span>{canonical}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3.5 font-sans">
                              <DirectionBadge direction={execution.side} size="xs" />
                            </td>
                            <td className="py-2 px-3.5 text-right font-medium text-foreground">
                              {execution.quantity}
                            </td>
                            <td className="py-2 px-3.5 text-right font-medium text-foreground">
                              {execution.price}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Extra Notices */}
            {preview.totals && preview.totals.skippedRows > 0 && (
              <div className="px-4 py-2 border-t border-border/20 bg-muted/10 text-[11px] text-muted-foreground">
                · {preview.totals.skippedRows} linhas inválidas ou não-trade ignoradas.
              </div>
            )}

            {/* Needs Symbol Input */}
            {preview?.needsSymbol && (
              <div className="p-3 border-t border-border/20 bg-muted/20 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                  Symbol Required
                  <Input
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                    placeholder="e.g. AAPL, EURUSD, NQ…"
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer"
                  onClick={previewFile}
                  disabled={busy || !symbol.trim()}
                >
                  Preview
                </Button>
              </div>
            )}

            {/* Needs Column Mapping */}
            {preview?.needsMapping && preview.headers && (
              <div className="p-3.5 border-t border-border/20 bg-muted/20 space-y-2.5">
                <p className="text-xs font-medium text-foreground">
                  Format not recognized — map your columns (nothing is guessed silently):
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {mappingFields.map((field) => (
                    <div key={field}>
                      <Label className="mb-1 block text-[11px] capitalize text-muted-foreground">
                        {field}
                        {field === "fee" ? " (optional)" : ""}
                      </Label>
                      <Select
                        value={mapping[field] ?? "none"}
                        onValueChange={(value) =>
                          setMapping((m) => ({ ...m, [field]: value === "none" ? "" : value }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {preview.headers!.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold cursor-pointer"
                  onClick={previewWithMapping}
                  disabled={
                    busy ||
                    !mapping.symbol ||
                    !mapping.side ||
                    !mapping.quantity ||
                    !mapping.price ||
                    !mapping.timestamp
                  }
                >
                  Preview with mapping
                </Button>
              </div>
            )}

            {/* Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/20 bg-amber-500/5 space-y-1">
                {preview.warnings.map((warning, index) => (
                  <p key={index} className="text-xs text-amber-500">
                    ⚠ {warning}
                  </p>
                ))}
              </div>
            )}

            {preview.detected === "ninjatrader" && accountId && (
              <div className="p-3.5 border-t border-border/20">
                <ImportReconciliation
                  review={preview.reconciliation}
                  options={reviewOptions}
                  onChange={changeReview}
                  onReview={previewFile}
                  busy={busy}
                />
              </div>
            )}

            {/* 5. Card Footer: Status / Divergence / Actions */}
            {isBlocked ? (
              <div className="border-t border-loss/20 bg-loss/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertCircle className="size-4 shrink-0 text-loss mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-loss">
                        {hasAccountMismatch
                          ? `Divergência de Conta Detectada (#${preview.detectedAccount})`
                          : `Incompatibilidade de Plataforma (${preview.detected?.toUpperCase()})`}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed" style={{ textWrap: "pretty" }}>
                        {hasAccountMismatch ? (
                          <>
                            Extrato pertence ao ID <strong>#{preview.detectedAccount}</strong>{" "}
                            ({preset.suggestedName || preview.detected?.toUpperCase()}), mas a conta selecionada é{" "}
                            <strong>{activeAccount?.name}</strong> (#{activeAccount?.accountNumber || "sem ID"}{" "}
                            · {activeAccount?.broker?.toUpperCase() || activeAccount?.platform?.toUpperCase()}).
                          </>
                        ) : (
                          compat.reason
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {preview.detectedAccount ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 px-3 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 shrink-0 cursor-pointer shadow-xs"
                        onClick={() => setCreateAccountOpen(true)}
                      >
                        <Plus className="size-3.5" />
                        Criar conta #{preview.detectedAccount}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled
                        className="h-8 gap-1.5 px-3 text-xs font-medium border-loss/25 bg-loss/10 text-loss cursor-not-allowed opacity-80 shadow-none"
                      >
                        <AlertCircle className="size-3.5 text-loss" />
                        Divergência bloqueada
                      </Button>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-loss/15 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={forceMismatch}
                      onChange={(e) => setForceMismatch(e.target.checked)}
                      className="size-3.5 rounded border-border accent-primary cursor-pointer"
                    />
                    <span>
                      Forçar importação deste extrato na conta <strong>{activeAccount?.name}</strong> mesmo com divergência
                    </span>
                  </label>
                </div>
              </div>
            ) : preview.accountReconciliation?.isFullyImported ? (
              <div className="border-t border-profit/20 bg-profit/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <CheckCircle2 className="size-4 shrink-0 text-profit mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Todos os trades já constam na conta {preview.accountReconciliation.accountName || activeAccount?.name || "selecionada"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed" style={{ textWrap: "pretty" }}>
                      As {preview.accountReconciliation.totalFills} execuções ({preview.accountReconciliation.totalTrades} trades fechados) deste relatório já foram importadas anteriormente. Nenhuma duplicação será feita.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    disabled
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs font-medium border border-profit/25 bg-profit/10 text-profit cursor-not-allowed opacity-90 shadow-none"
                  >
                    <CheckCircle2 className="size-3.5 text-profit" />
                    Trades já importados
                  </Button>
                </div>
              </div>
            ) : preview.accountReconciliation &&
              preview.accountReconciliation.newTrades > 0 &&
              preview.accountReconciliation.existingTrades > 0 ? (
              <div className="border-t border-brand/20 bg-brand/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <RefreshCw className="size-4 shrink-0 text-brand mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Atualização incremental para {preview.accountReconciliation.accountName || activeAccount?.name || "a conta"}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed" style={{ textWrap: "pretty" }}>
                      {preview.accountReconciliation.existingTrades} trades já existem. Apenas os {preview.accountReconciliation.newTrades} novos trades ({preview.accountReconciliation.newFills} execuções) serão adicionados.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    onClick={commit}
                    disabled={!accountId || busy}
                    size="sm"
                    className="h-8 gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Importando…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        Importar {preview.accountReconciliation.newTrades} novos trades
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border/30 bg-muted/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {forceMismatch && activeAccount && (hasAccountMismatch || !compat.compatible) ? (
                  <div className="flex items-center gap-2 text-[11px] text-amber-500 font-medium">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>Importação forçada na conta {activeAccount.name} com divergência.</span>
                    <button
                      type="button"
                      onClick={() => setForceMismatch(false)}
                      className="text-[10px] text-muted-foreground underline hover:text-foreground cursor-pointer ml-1"
                    >
                      Desfazer
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Extrato verificado para importação na conta <strong>{activeAccount?.name}</strong>.
                  </div>
                )}

                <div className="shrink-0">
                  <Button
                    onClick={commit}
                    disabled={
                      !accountId ||
                      busy ||
                      isBlocked ||
                      !!preview.errors?.length ||
                      !preview.totals?.executions ||
                      (preview.detected === "ninjatrader" && !preview.reconciliation?.token)
                    }
                    className="h-8 gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Importando…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        Importar{" "}
                        {preview.accountReconciliation?.totalTrades ??
                          Math.ceil((preview.totals?.executions ?? 0) / 2)}{" "}
                        trades ({preview.totals?.executions ?? 0} execuções)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      </div>

      {/* Footer Banner: Export Instructions (Only shown before file is loaded, flush at card bottom) */}
      {!preview && (
        <div className="border-t border-border/50 bg-muted/15 dark:bg-muted/10 transition-colors">
          <button
            type="button"
            onClick={() => setExportGuideOpen(!exportGuideOpen)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <HelpCircle className="size-3.5 shrink-0 opacity-70" />
              <span className="font-medium text-foreground">Need help exporting?</span>
              <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
                Step-by-step export instructions for your broker
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium shrink-0 ml-3">
              <span>{exportGuideOpen ? "Hide" : "Instructions"}</span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200 shrink-0 opacity-70",
                  exportGuideOpen && "rotate-180",
                )}
              />
            </div>
          </button>

          {exportGuideOpen && (
            <div className="px-5 py-3 border-t border-border/30 space-y-3 bg-muted/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Platform:</span>
                  <Select value={selectedExportGuide} onValueChange={setSelectedExportGuide}>
                    <SelectTrigger className="h-7 w-auto min-w-[170px] gap-2 rounded-md border-border/60 bg-background/70 px-2.5 text-xs font-medium shadow-2xs">
                      <SelectValue>
                        {(() => {
                          const currentPlatform =
                            PLATFORM_METADATA[selectedExportGuide] ||
                            getBrokerMetadata(selectedExportGuide);
                          const currentInstr = EXPORT_INSTRUCTIONS[selectedExportGuide];
                          const currentLabel =
                            currentPlatform?.name ??
                            currentInstr?.title
                              .replace(" Statement Export", "")
                              .replace(" Report Export", "")
                              .replace(" Orders Export", "")
                              .replace(" Executions Export", "")
                              .replace(" Export", "") ??
                            selectedExportGuide;
                          return (
                            <div className="flex items-center gap-1.5 min-w-0">
                              {currentPlatform?.icon && (
                                <BrokerIcon
                                  icon={currentPlatform.icon}
                                  name={currentLabel}
                                  className="size-3.5 rounded-xs object-contain shrink-0"
                                />
                              )}
                              <span className="truncate">{currentLabel}</span>
                            </div>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Object.entries(EXPORT_INSTRUCTIONS).map(([key, instr]) => {
                        const platform = PLATFORM_METADATA[key] || getBrokerMetadata(key);
                        const label =
                          platform?.name ??
                          instr.title
                            .replace(" Statement Export", "")
                            .replace(" Report Export", "")
                            .replace(" Orders Export", "")
                            .replace(" Executions Export", "")
                            .replace(" Export", "");

                        return (
                          <SelectItem key={key} value={key} className="text-xs cursor-pointer">
                            <div className="flex items-center gap-2 min-w-0">
                              {platform?.icon && (
                                <BrokerIcon
                                  icon={platform.icon}
                                  name={label}
                                  className="size-3.5 rounded-xs object-contain shrink-0"
                                />
                              )}
                              <span>{label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <span className="text-[11px] text-muted-foreground/75 font-mono">
                  {EXPORT_INSTRUCTIONS[selectedExportGuide]?.title}
                </span>
              </div>

              {EXPORT_INSTRUCTIONS[selectedExportGuide] && (
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground [text-wrap:pretty] pl-0.5">
                  {EXPORT_INSTRUCTIONS[selectedExportGuide].steps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      <span className="text-foreground/90">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {(() => {
        const preset = getPresetForDetectedStatement(preview?.detectedAccount, preview?.detected);
        return (
          <AddAccountDialog
            open={createAccountOpen}
            onOpenChange={setCreateAccountOpen}
            initialTab={preset.tab}
            initialBroker={preset.broker}
            initialPlatform={preset.platform}
            initialAccountNumber={preset.accountNumber || preview?.detectedAccount || undefined}
            initialName={preset.suggestedName}
            onAccountCreated={(newId) => {
              refreshAccounts();
              setAccountId(newId);
              setCreateAccountOpen(false);
            }}
          />
        );
      })()}
    </div>
  );
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

function BrokerConnect({ onGoToFile }: { onGoToFile: (accountId?: string) => void }) {
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

  const platformOptions = selectedBroker
    ? getPlatformOptionsForBroker(selectedBroker.id)
    : [];
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

            {/* 4. Execution Platforms & Gateways (por último) */}
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
                      <SelectItem key={opt.value} value={opt.value} className="text-xs cursor-pointer">
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
                      <SelectItem key={curr.code} value={curr.code} className="text-xs cursor-pointer">
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
                    <span className="text-foreground font-medium">{selectedBroker.name}</span> or your execution platform and import it anytime to sync executions.
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
