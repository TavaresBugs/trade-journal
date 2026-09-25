"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
import { BrokerIcon } from "@/components/ui/broker-icon";
import { AssetIcon } from "@/components/ui/asset-icon";
import { DirectionBadge } from "@/components/ui/direction-badge";
import { ImportReconciliation } from "@/components/import-reconciliation";
import {
  PLATFORM_METADATA,
  getBrokerMetadata,
  checkPlatformCompatibility,
  getPresetForDetectedStatement,
} from "@/lib/brokers/broker-catalog";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { formatTimestamp } from "@/lib/timezone";
import { dayKeyOf } from "@luxalgo/journal-core";
import { cn } from "@/lib/utils";
import type { PreviewResponse } from "@/types/import";
import type { AccountRow } from "@/types/accounts";
import type { ImportReviewOptions } from "@/lib/import-review";

export interface ImportPreviewTableProps {
  preview: PreviewResponse;
  fileName: string;
  displayTimeZone: string;
  activeAccount?: AccountRow;
  matchedStatementAccount?: AccountRow;
  hasAccountMismatch: boolean;
  isBlocked: boolean;
  forceMismatch: boolean;
  busy: boolean;
  accountId: string;
  reviewOptions: ImportReviewOptions;
  onResetFile: () => void;
  onSelectAccount: (id: string, account?: AccountRow) => void;
  onCreateAccount: () => void;
  onSetForceMismatch: (force: boolean) => void;
  onCommit: () => void;
  onChangeReview: (options: ImportReviewOptions) => void;
  onPreviewRefresh: (options?: { symbol?: string; mapping?: Record<string, string> }) => void;
}

const mappingFields = ["symbol", "side", "quantity", "price", "fee", "timestamp"] as const;

export function ImportPreviewTable({
  preview,
  fileName,
  displayTimeZone,
  activeAccount,
  matchedStatementAccount,
  hasAccountMismatch,
  isBlocked,
  forceMismatch,
  busy,
  accountId,
  reviewOptions,
  onResetFile,
  onSelectAccount,
  onCreateAccount,
  onSetForceMismatch,
  onCommit,
  onChangeReview,
  onPreviewRefresh,
}: ImportPreviewTableProps) {
  const [symbol, setSymbol] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const preset = getPresetForDetectedStatement(preview.detectedAccount, preview.detected);
  const compat =
    activeAccount && preview.detected
      ? checkPlatformCompatibility(activeAccount, preview.detected)
      : (preview.compatibility ?? { compatible: true });

  return (
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
            {preview.detected &&
              (() => {
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
              onClick={onResetFile}
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
                  Statement for account <strong>#{preview.detectedAccount}</strong> matches
                  registered account <strong>{matchedStatementAccount.name}</strong>.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 font-medium shrink-0 cursor-pointer"
                onClick={() => onSelectAccount(matchedStatementAccount.id, matchedStatementAccount)}
              >
                Select {matchedStatementAccount.name}
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
                Account <strong>{activeAccount.name}</strong> had no statement ID and will be bound
                to ID <strong>#{preview.detectedAccount}</strong>.
              </span>
            </div>
          )}

        {!activeAccount && preview.detectedAccount && !matchedStatementAccount && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 text-xs">
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-semibold text-foreground">
                  Detected Statement ID: #{preview.detectedAccount}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No account has this ID registered. Create a new account for this statement or
                  select an existing one above.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-6 text-[11px] px-2.5 font-medium shrink-0 cursor-pointer"
              onClick={onCreateAccount}
            >
              <Plus className="size-3 mr-1" />
              Create account #{preview.detectedAccount}
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
                Fills (Executions)
              </span>
              <span className="text-base font-bold text-foreground font-mono tnum">
                {preview.totals.executions}
              </span>
            </div>
            <div className="bg-card/70 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                Symbols
              </span>
              <span className="text-base font-bold text-foreground font-mono tnum">
                {preview.totals.symbols}
              </span>
            </div>
            <div className="bg-card/70 p-3 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                Date Range
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
                Execution Sample (first 5)
              </span>
              {preview.totals && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {preview.totals.executions} statement executions
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border/30">
                  <tr>
                    <th className="py-2 px-3.5">Date / Time</th>
                    <th className="py-2 px-3.5">Symbol</th>
                    <th className="py-2 px-3.5">Side</th>
                    <th className="py-2 px-3.5 text-right">Qty</th>
                    <th className="py-2 px-3.5 text-right">Price</th>
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
            · {preview.totals.skippedRows} non-trade or invalid rows ignored.
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
              onClick={() => onPreviewRefresh({ symbol })}
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
              onClick={() => onPreviewRefresh({ mapping })}
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

        {/* NinjaTrader Reconciliation */}
        {preview.detected === "ninjatrader" && accountId && (
          <div className="p-3.5 border-t border-border/20">
            <ImportReconciliation
              review={preview.reconciliation}
              options={reviewOptions}
              onChange={onChangeReview}
              onReview={() => onPreviewRefresh()}
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
                      ? `Account Mismatch Detected (#${preview.detectedAccount})`
                      : `Platform Incompatibility (${preview.detected?.toUpperCase()})`}
                  </p>
                  <p
                    className="text-[11px] text-muted-foreground leading-relaxed"
                    style={{ textWrap: "pretty" }}
                  >
                    {hasAccountMismatch ? (
                      <>
                        Statement belongs to ID <strong>#{preview.detectedAccount}</strong> (
                        {preset.suggestedName || preview.detected?.toUpperCase()}), but the selected
                        account is <strong>{activeAccount?.name}</strong> (#
                        {activeAccount?.accountNumber || "no ID"} ·{" "}
                        {activeAccount?.broker?.toUpperCase() ||
                          activeAccount?.platform?.toUpperCase()}
                        ).
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
                    onClick={onCreateAccount}
                  >
                    <Plus className="size-3.5" />
                    Create account #{preview.detectedAccount}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="h-8 gap-1.5 px-3 text-xs font-medium border-loss/25 bg-loss/10 text-loss cursor-not-allowed opacity-80 shadow-none"
                  >
                    <AlertCircle className="size-3.5 text-loss" />
                    Mismatch blocked
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-loss/15 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={forceMismatch}
                  onChange={(e) => onSetForceMismatch(e.target.checked)}
                  className="size-3.5 rounded border-border accent-primary cursor-pointer"
                />
                <span>
                  Force import of this statement into <strong>{activeAccount?.name}</strong> despite
                  mismatch
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
                  All trades already exist in{" "}
                  {preview.accountReconciliation.accountName ||
                    activeAccount?.name ||
                    "selected account"}
                </p>
                <p
                  className="text-[11px] text-muted-foreground leading-relaxed"
                  style={{ textWrap: "pretty" }}
                >
                  All {preview.accountReconciliation.totalFills} executions (
                  {preview.accountReconciliation.totalTrades} closed trades) from this report were
                  previously imported. No duplicates will be created.
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
                Trades already imported
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
                  Incremental update for{" "}
                  {preview.accountReconciliation.accountName || activeAccount?.name || "account"}
                </p>
                <p
                  className="text-[11px] text-muted-foreground leading-relaxed"
                  style={{ textWrap: "pretty" }}
                >
                  {preview.accountReconciliation.existingTrades} trades already exist. Only{" "}
                  {preview.accountReconciliation.newTrades} new trades (
                  {preview.accountReconciliation.newFills} executions) will be added.
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <Button
                onClick={onCommit}
                disabled={!accountId || busy}
                size="sm"
                className="h-8 gap-1.5 px-3.5 text-xs font-semibold cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Import {preview.accountReconciliation.newTrades} new trades
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
                <span>Forced import into account {activeAccount.name} with mismatch.</span>
                <button
                  type="button"
                  onClick={() => onSetForceMismatch(false)}
                  className="text-[10px] text-muted-foreground underline hover:text-foreground cursor-pointer ml-1"
                >
                  Undo
                </button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Statement verified for import into account <strong>{activeAccount?.name}</strong>.
              </div>
            )}

            <div className="shrink-0">
              <Button
                onClick={onCommit}
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
                    Importing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Import{" "}
                    {preview.accountReconciliation?.totalTrades ??
                      Math.ceil((preview.totals?.executions ?? 0) / 2)}{" "}
                    trades ({preview.totals?.executions ?? 0} executions)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
