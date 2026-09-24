"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  HelpCircle,
  Landmark,
  Loader2,
  PencilLine,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { ManualTradeEntry } from "@/components/manual-trade-entry";
import { FilterBar } from "@/components/filter-bar";
import {
  BROKER_CATALOG,
  EXPORT_INSTRUCTIONS,
  getBrokerMetadata,
  getPlatformOptionsForBroker,
} from "@/lib/brokers/broker-catalog";
import { BrokerIcon } from "@/components/ui/broker-icon";
import type {
  BrokerCatalogItem,
  BrokerSdkInfo,
  PreviewTotals,
  PreviewResponse,
} from "@/types/import";
import type { AccountRow } from "@/types/accounts";
import { ImportReconciliation } from "@/components/import-reconciliation";
import type { ImportReviewOptions } from "@/lib/import-review";
import { Badge } from "@/components/ui/badge";
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
  const [activeTab, setActiveTab] = useState<"file" | "sync" | "manual">("file");
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

  const timeZone = statementTimeZone ?? settingsData?.importTimeZone ?? "";
  const validTimeZone = isTimeZone(timeZone);
  const displayTimeZone = settingsData?.timeZone ?? "UTC";

  const handleAccountSelect = (id: string, account?: AccountRow) => {
    setAccountId(id);
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
            ? `Preset to ${recTz} from ${account.name} (${brokerLabel})`
            : `Preset to ${recTz} from ${account.name}`,
        );
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

  const onFile = async (file: File) => {
    if (!validTimeZone) return;
    setStatementTimeZone(timeZone);
    setPreview(null);
    setContent(null);
    setFileName(file.name);
    setReviewOptions({});
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
            a.accountNumber &&
            a.accountNumber.trim().toLowerCase() === res.detectedAccount?.trim().toLowerCase(),
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
    <div className="rounded-2xl border border-border/70 bg-card/40 p-5 space-y-4 shadow-xs">
      {/* Account & Timezone Configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <AccountPicker
            value={accountId}
            onChange={handleAccountSelect}
            kind="import"
            label="Target Account (recommended)"
          />
          <p className="text-[11px] text-muted-foreground" style={{ textWrap: "pretty" }}>
            Select an account to automatically preset its broker timezone and format rules.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between text-[11px]">
            <p id="statement-timezone-help" className="text-muted-foreground">
              Choose the timezone used by your broker&apos;s statement.
            </p>
            {tzPresetInfo && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                ✓ {tzPresetInfo}
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

      {/* Collapsible Export Guide Accordion */}
      <div className="rounded-xl border border-border/70 bg-card/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setExportGuideOpen(!exportGuideOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary shrink-0" />
            <span className="font-semibold">Need help exporting?</span>
            <span className="text-muted-foreground hidden sm:inline">
              Step-by-step export instructions for Tradovate, NinjaTrader, MT5 &amp; more
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
              exportGuideOpen && "rotate-180",
            )}
          />
        </button>
        {exportGuideOpen && (
          <div className="p-3 pt-1 border-t border-border/50 space-y-2.5 bg-muted/10">
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(EXPORT_INSTRUCTIONS).map(([key, instr]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedExportGuide(key)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer",
                    selectedExportGuide === key
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "border-border/70 bg-card hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  {instr.title
                    .replace(" Statement Export", "")
                    .replace(" Report Export", "")
                    .replace(" Orders Export", "")
                    .replace(" Executions Export", "")
                    .replace(" Export", "")}
                </button>
              ))}
            </div>
            {EXPORT_INSTRUCTIONS[selectedExportGuide] && (
              <div className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-1.5 text-xs">
                <span className="font-semibold text-foreground">
                  {EXPORT_INSTRUCTIONS[selectedExportGuide].title}
                </span>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                  {EXPORT_INSTRUCTIONS[selectedExportGuide].steps.map((step, idx) => (
                    <li key={idx}>
                      <span className="text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

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
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:scale-105 group-hover:text-foreground transition-all duration-150">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </div>
          <div className="mt-3 space-y-1">
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
        /* Preview Card */
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
              <span className="truncate text-xs font-semibold text-foreground">{fileName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {preview.detected && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold uppercase tracking-wider"
                >
                  {preview.detected}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={resetFile}
                disabled={busy}
              >
                Change file
              </Button>
            </div>
          </div>

          {/* Account Auto-Matching Banner */}
          {preview.detectedAccount &&
            (() => {
              const activeAccount = accountsData?.accounts.find((a) => a.id === accountId);
              const matchedStatementAccount = accountsData?.accounts.find(
                (a) =>
                  !a.archivedAt &&
                  a.accountNumber &&
                  a.accountNumber.trim().toLowerCase() ===
                    preview.detectedAccount?.trim().toLowerCase(),
              );

              if (
                activeAccount?.accountNumber?.trim().toLowerCase() ===
                preview.detectedAccount.trim().toLowerCase()
              ) {
                return (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      Auto-matched to account: <strong>{activeAccount.name}</strong> (#
                      {preview.detectedAccount}). Executions will import into this account.
                    </span>
                  </div>
                );
              }

              if (matchedStatementAccount) {
                return (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="size-4 shrink-0 text-primary" />
                      <span className="truncate">
                        Detected statement ID <strong>#{preview.detectedAccount}</strong> matching
                        registered account <strong>{matchedStatementAccount.name}</strong>.
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
                      Select {matchedStatementAccount.name}
                    </Button>
                  </div>
                );
              }

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
                  <div className="flex items-start sm:items-center gap-2 min-w-0">
                    <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
                    <div>
                      <span className="font-semibold text-foreground">
                        Statement Account ID: #{preview.detectedAccount}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        No account has this ID registered yet. You can create a new account or
                        import into an existing one.
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
                    Create Account #{preview.detectedAccount}
                  </Button>
                </div>
              );
            })()}

          {/* Quick Metrics Grid */}
          {preview.totals && (
            <div className="grid grid-cols-3 gap-2.5 py-1 text-center">
              <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Executions
                </span>
                <span className="text-base font-bold text-foreground font-mono tnum">
                  {preview.totals.executions}
                </span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Symbols
                </span>
                <span className="text-base font-bold text-foreground font-mono tnum">
                  {preview.totals.symbols}
                </span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Date Range
                </span>
                <span
                  className="text-xs font-medium text-foreground font-mono truncate block mt-0.5"
                  title={`${preview.totals.from} to ${preview.totals.to}`}
                >
                  {preview.totals.from && preview.totals.to
                    ? `${dayKeyOf(preview.totals.from, displayTimeZone)} → ${dayKeyOf(preview.totals.to, displayTimeZone)}`
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {preview.totals && preview.totals.skippedRows > 0 && (
            <p className="text-[11px] text-muted-foreground">
              · {preview.totals.skippedRows} invalid or non-trade rows skipped.
            </p>
          )}

          {/* Execution Sample Table */}
          {!!preview.executions?.length && (
            <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Execution Sample (first 5):
              </span>
              <div className="space-y-1 pt-1">
                {preview.executions.slice(0, 5).map((execution, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center justify-between text-[11px] font-mono text-muted-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      {execution.symbol}{" "}
                      <span
                        className={cn(
                          "ml-1 font-bold",
                          execution.side.toLowerCase() === "buy" ? "text-profit" : "text-loss",
                        )}
                      >
                        {execution.side.toUpperCase()}
                      </span>
                    </span>
                    <span className="tnum">
                      {execution.quantity} @ {execution.price} ·{" "}
                      {formatTimestamp(execution.executedAt, displayTimeZone)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Needs Symbol Input */}
          {preview?.needsSymbol && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
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
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
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

          {/* Warnings & Notes */}
          {preview.warnings?.map((warning, index) => (
            <p key={index} className="text-xs text-amber-500">
              ⚠ {warning}
            </p>
          ))}

          {/* Target Account Selection & Commit Action */}
          <div className="space-y-2 border-t border-border/40 pt-3">
            <fieldset disabled={busy}>
              <AccountPicker value={accountId} onChange={handleAccountSelect} kind="import" />
            </fieldset>
            {preview.detected === "ninjatrader" && accountId && (
              <ImportReconciliation
                review={preview.reconciliation}
                options={reviewOptions}
                onChange={changeReview}
                onReview={previewFile}
                busy={busy}
              />
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                onClick={commit}
                disabled={
                  !accountId ||
                  busy ||
                  !!preview.errors?.length ||
                  !preview.totals?.executions ||
                  (preview.detected === "ninjatrader" && !preview.reconciliation?.token)
                }
                className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Import {preview.totals?.executions ?? 0} trades
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AddAccountDialog
        open={createAccountOpen}
        onOpenChange={setCreateAccountOpen}
        initialTab="prop"
        initialAccountNumber={preview?.detectedAccount || undefined}
        initialPlatform={preview?.detected || undefined}
        initialName={
          preview?.detectedAccount?.startsWith("LFE")
            ? `Lucid ${preview.detectedAccount}`
            : preview?.detected
              ? `${preview.detected.toUpperCase()} Account`
              : "New Account"
        }
        onAccountCreated={(newId) => {
          refreshAccounts();
          setAccountId(newId);
          setCreateAccountOpen(false);
        }}
      />
    </div>
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
    ? (brokerData?.brokers.find((b) => b.id === selectedBroker.id) ?? null)
    : null;

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
                <span>🏆</span>
                <span>Prop Trading Firms</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter((b) => b.category === "prop-firm").map((broker) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => handleSelectBroker(broker)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
                      broker.status === "soon"
                        ? "border-dashed border-border/60 opacity-80 hover:opacity-100 hover:bg-muted/30"
                        : "border-border/70 bg-card/40 hover:bg-muted/50 hover:border-border",
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
                          broker.status === "soon"
                            ? "text-muted-foreground"
                            : "text-foreground group-hover:text-primary transition-colors",
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
                ))}
              </div>
            </div>

            {/* 2. Execution Platforms */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <span>⚡</span>
                <span>Execution Platforms &amp; Gateways</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter((b) => b.category === "platform").map((broker) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => handleSelectBroker(broker)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
                      broker.status === "soon"
                        ? "border-dashed border-border/60 opacity-80 hover:opacity-100 hover:bg-muted/30"
                        : "border-border/70 bg-card/40 hover:bg-muted/50 hover:border-border",
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
                          broker.status === "soon"
                            ? "text-muted-foreground"
                            : "text-foreground group-hover:text-primary transition-colors",
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
                ))}
              </div>
            </div>

            {/* 3. Direct Brokers (Forex & Stocks) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <span>🏛️</span>
                <span>Direct Brokers (Forex, CFDs &amp; Stocks)</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter(
                  (b) => b.category === "forex-cfd" || b.category === "stocks",
                ).map((broker) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => handleSelectBroker(broker)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer",
                      broker.status === "soon"
                        ? "border-dashed border-border/60 opacity-80 hover:opacity-100 hover:bg-muted/30"
                        : "border-border/70 bg-card/40 hover:bg-muted/50 hover:border-border",
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
                          broker.status === "soon"
                            ? "text-muted-foreground"
                            : "text-foreground group-hover:text-primary transition-colors",
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
                ))}
              </div>
            </div>

            {/* 4. Crypto */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <span>🪙</span>
                <span>Crypto Exchanges</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BROKER_CATALOG.filter((b) => b.category === "crypto").map((broker) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => handleSelectBroker(broker)}
                    className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/40 p-2.5 text-left transition-all hover:bg-muted/50 hover:border-border active:scale-[0.98] cursor-pointer"
                  >
                    <BrokerIcon
                      icon={broker.icon}
                      iconDark={broker.iconDark}
                      name={broker.name}
                      invertInDark={broker.invertInDark}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {broker.name}
                      </span>
                      {broker.subtitle && (
                        <span className="block truncate text-[10px] text-muted-foreground/80 mt-0.5">
                          {broker.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Statement fallback */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Anything else
              </span>
              <button
                type="button"
                onClick={() => onGoToFile()}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border/70 p-2.5 text-left transition-all hover:bg-muted/50 cursor-pointer active:scale-[0.98]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-xs font-bold text-muted-foreground">
                  I
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    Import a statement file
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    Any broker&apos;s CSV or HTML export feeds the same stats
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
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to brokers</span>
          </button>

          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <BrokerIcon
              icon={selectedBroker.icon}
              iconDark={selectedBroker.iconDark}
              name={selectedBroker.name}
              invertInDark={selectedBroker.invertInDark}
              className="size-9 rounded-lg object-contain"
            />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Connect {selectedBroker.name}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {!matchedSdkBroker
                  ? "Account management & trade tracking"
                  : "Encrypted read-only synchronization"}
              </p>
            </div>
          </div>

          {!matchedSdkBroker ? (
            /* Prop Firm / Statement Import Account Setup */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Account Name</Label>
                  <Input
                    value={brokerAccountName}
                    onChange={(e) => setBrokerAccountName(e.target.value)}
                    placeholder={`e.g. ${selectedBroker.name} Account`}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Account ID / Number</Label>
                    <span className="text-[10px] text-muted-foreground">Auto-match on import</span>
                  </div>
                  <Input
                    value={brokerAccountNumber}
                    onChange={(e) => setBrokerAccountNumber(e.target.value)}
                    placeholder="e.g. LFE0506847043001"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Trading Platform</Label>
                  <Select value={propPlatform} onValueChange={setPropPlatform}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {getPlatformOptionsForBroker(selectedBroker.id).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={propCurrency} onValueChange={setPropCurrency}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="CZK">CZK (Kč)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Initial Account Balance ($)</Label>
                  <Input
                    type="number"
                    value={propBalance}
                    onChange={(e) => setPropBalance(e.target.value)}
                    placeholder={selectedBroker.id === "ftmo" ? "100000" : "50000"}
                    className="h-8 text-xs font-mono tnum"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max Drawdown Limit ($)</Label>
                  <Input
                    type="number"
                    value={propMaxDrawdown}
                    onChange={(e) => setPropMaxDrawdown(e.target.value)}
                    placeholder="2000"
                    className="h-8 text-xs font-mono tnum"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Unlocks exact drawdown metrics and prop evaluation progress.
              </p>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Statement Import Ready</p>
                <p className="text-[11px] leading-relaxed">
                  After creating this account, export your trading history report from{" "}
                  {selectedBroker.name} or your execution platform and import it anytime to sync
                  executions.
                </p>
              </div>

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button
                onClick={handleConnect}
                disabled={busy}
                className="w-full h-8 text-xs font-semibold cursor-pointer"
              >
                {busy
                  ? `Creating ${selectedBroker.name} account…`
                  : `Create ${selectedBroker.name} Account`}
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
                    autoComplete="off"
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
                className="w-full h-8 text-xs font-semibold cursor-pointer"
              >
                {busy ? "Connecting & syncing…" : `Connect & Sync ${selectedBroker.name}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
