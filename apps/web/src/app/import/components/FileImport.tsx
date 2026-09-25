"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { TimeZonePicker } from "@/components/timezone-picker";
import { Label } from "@/components/ui/label";
import { ImportDropzone } from "./ImportDropzone";
import { ExportGuideSection } from "./ExportGuideSection";
import { ImportPreviewTable } from "./ImportPreviewTable";
import {
  EXPORT_INSTRUCTIONS,
  getBrokerMetadata,
  checkPlatformCompatibility,
  getPresetForDetectedStatement,
} from "@/lib/brokers/broker-catalog";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { isTimeZone } from "@/lib/timezone";
import type { AccountRow } from "@/types/accounts";
import type { PreviewResponse } from "@/types/import";
import type { ImportReviewOptions } from "@/lib/import-review";

export interface FileImportProps {
  initialAccountId?: string;
}

export function FileImport({ initialAccountId }: FileImportProps) {
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
  const compat =
    activeAccount && preview?.detected
      ? checkPlatformCompatibility(activeAccount, preview.detected)
      : (preview?.compatibility ?? { compatible: true });
  const hasAccountMismatch = Boolean(
    preview?.detectedAccount &&
    activeAccount?.accountNumber &&
    activeAccount.accountNumber.trim().toLowerCase() !==
      preview.detectedAccount.trim().toLowerCase(),
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
      const platformCandidate = (
        account.platform ||
        brokerMeta?.platform ||
        account.broker ||
        ""
      ).toLowerCase();
      if (
        platformCandidate.includes("metatrader") ||
        platformCandidate.includes("mt5") ||
        platformCandidate.includes("mt4")
      ) {
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
              (a.name &&
                a.name.trim().toLowerCase() === res.detectedAccount?.trim().toLowerCase())),
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

  const handlePreviewRefresh = async (options?: {
    symbol?: string;
    mapping?: Record<string, string>;
  }) => {
    if (!content || !validTimeZone) return;
    setBusy(true);
    setError(null);
    try {
      const nextSymbol = options?.symbol !== undefined ? options.symbol : symbol;
      const nextMapping =
        options?.mapping !== undefined ? options.mapping : mappingApplied ? mapping : undefined;
      if (options?.symbol !== undefined) setSymbol(options.symbol);
      if (options?.mapping !== undefined) {
        setMapping(options.mapping);
        setMappingApplied(true);
      }

      const res = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content,
        accountId: accountId || undefined,
        review: reviewOptions,
        fileName,
        symbol: nextSymbol,
        mapping: nextMapping,
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

  const resetFile = () => {
    setContent(null);
    setFileName("");
    setPreview(null);
    setSymbol("");
    setMapping({});
    setMappingApplied(false);
    setForceMismatch(false);
    setError(null);
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
            <p
              className="text-[11px] text-muted-foreground leading-normal"
              style={{ textWrap: "pretty" }}
            >
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
                {tzPresetInfo
                  ? "Broker statement timezone."
                  : "Choose the timezone used by your broker's statement."}
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

        {/* Dropzone or Preview */}
        {!preview ? (
          <ImportDropzone
            busy={busy}
            disabled={!settingsData || !validTimeZone}
            fileName={fileName}
            formats={formatData?.formats}
            onFileSelect={onFile}
          />
        ) : (
          <ImportPreviewTable
            preview={preview}
            fileName={fileName}
            displayTimeZone={displayTimeZone}
            activeAccount={activeAccount}
            matchedStatementAccount={matchedStatementAccount}
            hasAccountMismatch={hasAccountMismatch}
            isBlocked={isBlocked}
            forceMismatch={forceMismatch}
            busy={busy}
            accountId={accountId}
            reviewOptions={reviewOptions}
            onResetFile={resetFile}
            onSelectAccount={handleAccountSelect}
            onCreateAccount={() => setCreateAccountOpen(true)}
            onSetForceMismatch={setForceMismatch}
            onCommit={commit}
            onChangeReview={changeReview}
            onPreviewRefresh={handlePreviewRefresh}
          />
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer Banner: Export Instructions (Only shown before file is loaded, flush at card bottom) */}
      {!preview && <ExportGuideSection defaultPlatform={selectedExportGuide} />}

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
