"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Hash,
  Layers,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/types/accounts";
import type { PreviewTotals, PreviewResponse } from "@/types/import";

export function QuickTradeImport({ onImported }: { onImported: () => void }) {
  const searchParams = useSearchParams();
  const activeParamAccount = searchParams.get("accounts")?.split(",")[0] || "";

  const { data: accountsData } = useApi<{ accounts: AccountRow[] }>("/api/accounts");
  const { data: settingsData } = useApi<{ timeZone: string }>("/api/settings");

  const accounts = (accountsData?.accounts ?? []).filter(
    (a) => !a.archivedAt && a.broker !== "demo",
  );

  const [accountId, setAccountId] = useState<string>(() => {
    if (activeParamAccount && accounts.some((a) => a.id === activeParamAccount)) {
      return activeParamAccount;
    }
    return accounts[0]?.id || "";
  });

  // Keep accountId in sync when accounts load if initially empty
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      const defaultAcc =
        activeParamAccount && accounts.some((a) => a.id === activeParamAccount)
          ? activeParamAccount
          : accounts[0]?.id || "";
      if (defaultAcc) setAccountId(defaultAcc);
    }
  }, [accountId, accounts, activeParamAccount]);

  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeImportFile(buffer);
      setFileContent(text);

      const previewRes = await postJson<PreviewResponse>("/api/import", {
        mode: "preview",
        content: text,
        fileName: file.name,
        timeZone: settingsData?.timeZone || "UTC",
      });

      if (previewRes.errors && previewRes.errors.length > 0) {
        throw new Error(previewRes.errors[0]);
      }

      setPreview(previewRes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not parse statement file.");
      setFileContent(null);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!fileContent || !accountId || !preview) return;
    setBusy(true);
    setError(null);

    try {
      await postJson("/api/import", {
        mode: "commit",
        content: fileContent,
        accountId,
        fileName: fileName || "statement.csv",
        timeZone: preview.timeZone || settingsData?.timeZone || "UTC",
      });

      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed to save executions.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Target Account Picker */}
      <div className="space-y-1.5">
        <Label htmlFor="import-target-account" className="text-xs font-semibold text-foreground/80">
          Target Account
        </Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger
            id="import-target-account"
            className="h-9 w-full rounded-lg border-input bg-background/80 text-xs font-medium"
          >
            <SelectValue placeholder="Choose an account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id} className="text-xs">
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
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
            if (file) void processFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none",
            isDragging
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border/70 hover:border-primary/50 hover:bg-muted/30",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.htm,.html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file);
            }}
          />

          <div className="flex size-11 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:scale-105 group-hover:text-foreground transition-all duration-150">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              {busy ? "Parsing statement…" : "Click or drop your statement here"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supports CSV & HTML exports (FTMO, MT4/MT5, TradeZella, Tradovate, IBKR)
            </p>
          </div>
        </div>
      ) : (
        /* Preview Card */
        <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="size-4 text-emerald-500 shrink-0" />
              <span className="truncate text-xs font-semibold text-foreground">{fileName}</span>
            </div>
            {preview.detected && (
              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {preview.detected}
              </span>
            )}
          </div>

          {/* Quick Metrics */}
          {preview.totals && (
            <div className="grid grid-cols-3 gap-2 py-1 text-center">
              <div className="rounded-lg bg-muted/20 border border-border/40 p-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Executions
                </span>
                <span className="text-sm font-bold text-foreground font-mono tnum">
                  {preview.totals.executions}
                </span>
              </div>
              <div className="rounded-lg bg-muted/20 border border-border/40 p-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Symbols
                </span>
                <span className="text-sm font-bold text-foreground font-mono tnum">
                  {preview.totals.symbols}
                </span>
              </div>
              <div className="rounded-lg bg-muted/20 border border-border/40 p-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Date Range
                </span>
                <span
                  className="text-xs font-medium text-foreground font-mono truncate block mt-0.5"
                  title={`${preview.totals.from} to ${preview.totals.to}`}
                >
                  {preview.totals.from && preview.totals.to
                    ? `${preview.totals.from.slice(5)} → ${preview.totals.to.slice(5)}`
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setPreview(null);
                setFileContent(null);
                setFileName(null);
              }}
              disabled={busy}
            >
              Choose different file
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
              onClick={handleCommit}
              disabled={busy || !accountId}
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Import {preview.totals?.executions ?? ""} trades
                </>
              )}
            </Button>
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
