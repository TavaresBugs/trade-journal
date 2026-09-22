"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Landmark,
  Loader2,
  PencilLine,
  Upload,
} from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { ManualTradeEntry } from "@/components/manual-trade-entry";
import { FilterBar } from "@/components/filter-bar";
import { BROKER_CATALOG } from "@/components/add-account-dialog";
import type {
  BrokerCatalogItem,
  BrokerSdkInfo,
  PreviewTotals,
  PreviewResponse,
} from "@/types/import";
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
            <FileImport />
          </TabsContent>

          {/* TAB 2: BROKER SYNC */}
          <TabsContent value="sync" className="focus-visible:outline-none">
            <BrokerConnect onGoToFile={() => setActiveTab("file")} />
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

function FileImport() {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
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
  const { data: settingsData, error: settingsError } = useApi<{
    timeZone: string;
    importTimeZone: string;
  }>("/api/settings");

  const [statementTimeZone, setStatementTimeZone] = useState<string | null>(null);
  const timeZone = statementTimeZone ?? settingsData?.importTimeZone ?? "";
  const validTimeZone = isTimeZone(timeZone);
  const displayTimeZone = settingsData?.timeZone ?? "UTC";

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
      {/* Statement Timezone */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="statement-timezone" className="text-xs font-semibold text-foreground">
            Statement Timezone
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Journal displays in{" "}
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
            setPreview(null);
            setMappingApplied(false);
          }}
        />
        <p
          id="statement-timezone-help"
          className="text-[11px] text-muted-foreground"
          style={{ textWrap: "pretty" }}
        >
          Choose the timezone used by your broker&apos;s statement. Timestamps with an explicit
          offset keep that offset.
        </p>
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
            <Label className="text-xs font-semibold text-foreground">Target Account</Label>
            <fieldset disabled={busy}>
              <AccountPicker
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setReviewOptions({});
                  setPreview((current) =>
                    current ? { ...current, reconciliation: undefined } : null,
                  );
                }}
                kind="import"
              />
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
    </div>
  );
}

function BrokerConnect({ onGoToFile }: { onGoToFile: () => void }) {
  const router = useRouter();
  const { data: brokerData } = useApi<{ brokers: BrokerSdkInfo[] }>("/api/brokers");
  const { refresh: refreshAccounts } = useApi<{ accounts: unknown[] }>("/api/accounts?summary=1");

  const [selectedBroker, setSelectedBroker] = useState<BrokerCatalogItem | null>(null);
  const [brokerAccountName, setBrokerAccountName] = useState("");
  const [brokerCredentials, setBrokerCredentials] = useState<Record<string, string>>({});
  const [ftmoPlatform, setFtmoPlatform] = useState("mt5");
  const [ftmoBalance, setFtmoBalance] = useState("100000");
  const [ftmoCurrency, setFtmoCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedSdkBroker = selectedBroker
    ? (brokerData?.brokers.find((b) => b.id === selectedBroker.id) ?? null)
    : null;

  const handleConnect = async () => {
    if (!selectedBroker) return;
    setBusy(true);
    setError(null);

    try {
      if (selectedBroker.id === "ftmo") {
        await postJson("/api/accounts", {
          name: brokerAccountName.trim() || `FTMO (${ftmoPlatform.toUpperCase()})`,
          kind: "manual",
          broker: "ftmo",
          currency: ftmoCurrency,
          initialBalance: Number(ftmoBalance) || 100000,
          profitCalcMethod: "fifo",
        });
        refreshAccounts();
        router.push("/");
        return;
      }

      const brokerMeta = brokerData?.brokers.find((b) => b.id === selectedBroker.id);
      await postJson("/api/accounts", {
        name: brokerAccountName.trim() || (brokerMeta?.displayName ?? selectedBroker.name),
        kind: "sync",
        broker: selectedBroker.id,
        credentials: brokerCredentials,
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
                Stocks &amp; options
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
                        onGoToFile();
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
                          broker.status === "soon" ? "text-muted-foreground" : "text-foreground",
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

            {/* Futures & Prop Trading (includes FTMO) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Futures &amp; prop trading
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
                        onGoToFile();
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

            {/* Statement fallback */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Anything else
              </span>
              <button
                type="button"
                onClick={onGoToFile}
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
            /* FTMO dedicated setup */
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
                  className="h-8 text-xs font-mono tnum"
                />
                <p className="text-[10px] text-muted-foreground">
                  Unlocks exact drawdown metrics and prop evaluation progress.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Statement Import Ready</p>
                <p className="text-[11px] leading-relaxed">
                  After creating this account, export your trading history report from MetaTrader
                  (HTML/CSV) or cTrader and import it anytime to sync executions.
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
                {busy ? "Creating FTMO account…" : "Create FTMO Account"}
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
