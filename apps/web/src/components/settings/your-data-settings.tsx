"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  ImageOff,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { OptionSelect } from "../ui/option-select";
import { postJson, useApi } from "@/lib/use-api";
import type { DataMaintenanceMetrics } from "@/server/data-maintenance";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function YourDataSettings() {
  const { data: metrics, refresh } = useApi<DataMaintenanceMetrics>("/api/data-maintenance");

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [clearImagesDialogOpen, setClearImagesDialogOpen] = useState(false);
  const [factoryResetDialogOpen, setFactoryResetDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  const handleResetTrades = async () => {
    setBusy(true);
    try {
      const res = await postJson<{
        deletedTradeCount: number;
        deletedExecutionCount: number;
        preservedAttachmentCount: number;
        preservedNoteCount: number;
      }>("/api/data-maintenance", {
        action: "reset_trades",
        accountId: selectedAccount === "all" ? undefined : selectedAccount,
      });
      setResetDialogOpen(false);
      showFeedback(
        "success",
        `Reset complete: ${res.deletedTradeCount} trades and ${res.deletedExecutionCount} executions removed. ${res.preservedAttachmentCount} screenshots and ${res.preservedNoteCount} notes preserved.`,
      );
      refresh();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Failed to reset broker trades.");
    } finally {
      setBusy(false);
    }
  };

  const handleClearScreenshots = async () => {
    setBusy(true);
    try {
      const res = await postJson<{
        deletedAttachmentCount: number;
        freedBytes: number;
      }>("/api/data-maintenance", {
        action: "clear_screenshots",
      });
      setClearImagesDialogOpen(false);
      showFeedback(
        "success",
        `Cleaned up ${res.deletedAttachmentCount} screenshots. Reclaimed ${formatBytes(res.freedBytes)} of storage.`,
      );
      refresh();
    } catch (err) {
      showFeedback("error", err instanceof Error ? err.message : "Failed to clear screenshots.");
    } finally {
      setBusy(false);
    }
  };

  const handleFactoryReset = async () => {
    if (confirmInput.trim() !== "RESET") return;
    setBusy(true);
    try {
      const res = await postJson<{
        deletedTradeCount: number;
        deletedAttachmentCount: number;
      }>("/api/data-maintenance", {
        action: "factory_reset",
        confirmText: "RESET",
      });
      setFactoryResetDialogOpen(false);
      setConfirmInput("");
      showFeedback(
        "success",
        `Factory reset completed: all ${res.deletedTradeCount} trades and ${res.deletedAttachmentCount} attachments permanently deleted.`,
      );
      refresh();
    } catch (err) {
      showFeedback(
        "error",
        err instanceof Error ? err.message : "Failed to perform factory reset.",
      );
    } finally {
      setBusy(false);
    }
  };

  const currentAccountMetrics =
    selectedAccount === "all"
      ? {
          trades: metrics?.tradesCount ?? 0,
          executions: metrics?.executionsCount ?? 0,
        }
      : {
          trades: metrics?.accounts.find((a) => a.id === selectedAccount)?.tradeCount ?? 0,
          executions: metrics?.accounts.find((a) => a.id === selectedAccount)?.executionCount ?? 0,
        };

  return (
    <Card id="your-data" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Your data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Section 1: Exports & Backups */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Download your raw trade history and full journal backups.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export" download="trade-journal-export.json">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="size-3.5 text-muted-foreground" />
                <span>Full backup (JSON)</span>
              </Button>
            </a>
            <a href="/api/export?format=csv" download>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="size-3.5 text-muted-foreground" />
                <span>Trades (CSV)</span>
              </Button>
            </a>
          </div>
        </div>

        {/* Section 2: Data Maintenance & Cleanup */}
        <div className="border-t border-border/50 pt-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 text-amber-400" />
                <span>Data Maintenance & Cleanup</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Manage broker executions, reclaim disk storage, or reset trade data.
              </p>
            </div>

            {metrics && (
              <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/60">
                {metrics.tradesCount.toLocaleString()} trades ·{" "}
                {metrics.attachmentsCount.toLocaleString()} screenshots (
                {formatBytes(metrics.attachmentsSizeBytes)})
              </div>
            )}
          </div>

          {feedback && (
            <div
              role="status"
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <Check className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              <span className="leading-snug">{feedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Action 1: Safe Trade Reset */}
            <div className="flex flex-col justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:border-amber-500/30 transition-all space-y-2.5 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <RotateCcw className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Reset Broker Trades</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Safe Reset: Wipes broker fills to re-import fresh. Preserves all notes, playbooks,
                  and screenshots.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                className="w-full h-7.5 text-xs border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 font-medium cursor-pointer"
              >
                <RotateCcw className="size-3 text-amber-400" />
                <span>Reset Trades</span>
              </Button>
            </div>

            {/* Action 2: Clear Screenshots */}
            <div className="flex flex-col justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:border-blue-500/30 transition-all space-y-2.5 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <ImageOff className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Clear Screenshots</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Disk cleanup: Deletes chart images from database. Preserves all trades, P&L, tags,
                  and notes.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearImagesDialogOpen(true)}
                className="w-full h-7.5 text-xs border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300 font-medium cursor-pointer"
              >
                <ImageOff className="size-3 text-blue-400" />
                <span>Clear Images</span>
              </Button>
            </div>

            {/* Action 3: Factory Reset */}
            <div className="flex flex-col justify-between p-3 rounded-xl border border-destructive/30 bg-destructive/5 hover:border-destructive/60 transition-all space-y-2.5 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-destructive/20 border border-destructive/30 text-destructive flex items-center justify-center shrink-0">
                    <Trash2 className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Reset All Data</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Factory Reset: Irreversible cleanup. Permanently destroys all accounts, trades,
                  and personal data.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmInput("");
                  setFactoryResetDialogOpen(true);
                }}
                className="w-full h-7.5 text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-white font-medium cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>Factory Reset</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Modal 1: Reset Broker Trades Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="size-4 text-amber-400" />
              <span>Reset Broker Trades (Safe Reset)</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Use this if your broker import had missing orders or corrupted data. This will remove
              broker fills while preserving your journal text, playbook checklists, and setup
              screenshots.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            {metrics?.accounts && metrics.accounts.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="reset-account-picker" className="text-xs font-medium">
                  Select Account
                </Label>
                <OptionSelect
                  id="reset-account-picker"
                  value={selectedAccount}
                  onValueChange={setSelectedAccount}
                  disabled={busy}
                >
                  <option value="all">
                    All Accounts ({metrics.tradesCount.toLocaleString()} trades)
                  </option>
                  {metrics.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.tradeCount} trades · {acc.currency})
                    </option>
                  ))}
                </OptionSelect>
              </div>
            )}

            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Trades to remove:</span>
                <span className="font-mono font-medium text-foreground">
                  {currentAccountMetrics.trades.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Executions to remove:</span>
                <span className="font-mono font-medium text-foreground">
                  {currentAccountMetrics.executions.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-border/50 pt-2 flex justify-between items-center text-emerald-400 font-medium">
                <span>Screenshots & notes preserved:</span>
                <span>
                  ✓ {metrics?.attachmentsCount ?? 0} images / {metrics?.notesCount ?? 0} notes
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When you re-import your corrected CSV, all preserved notes and screenshots will
              re-anchor automatically.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setResetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleResetTrades()}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              <span>Confirm Trade Reset</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Clear Screenshots Dialog */}
      <Dialog open={clearImagesDialogOpen} onOpenChange={setClearImagesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ImageOff className="size-4 text-blue-400" />
              <span>Clear Saved Screenshots</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Reclaim database storage by deleting setup images and chart screenshots. All trades,
              P&L calculations, and written notes remain intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1 text-xs">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Screenshots to purge:</span>
                <span className="font-mono font-medium text-foreground">
                  {metrics?.imageAttachmentsCount.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Disk space reclaimed:</span>
                <span className="font-mono font-medium text-foreground">
                  {formatBytes(metrics?.imageAttachmentsSizeBytes ?? 0)}
                </span>
              </div>
              <div className="border-t border-border/50 pt-2 flex justify-between items-center text-emerald-400 font-medium">
                <span>Trades & analytics preserved:</span>
                <span>✓ 100% Intact</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setClearImagesDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !metrics?.imageAttachmentsCount}
              onClick={() => void handleClearScreenshots()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageOff className="size-3.5" />
              )}
              <span>Purge Screenshots</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Factory Reset Dialog */}
      <Dialog open={factoryResetDialogOpen} onOpenChange={setFactoryResetDialogOpen}>
        <DialogContent className="sm:max-w-md border-destructive/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="size-4" />
              <span>Factory Reset (Irreversible)</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              This will permanently destroy all accounts, trades, executions, notes, playbooks, and
              screenshots. Your database will be reset to a clean state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1.5 text-destructive">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-4" />
                <span>Warning: Data cannot be recovered</span>
              </div>
              <p className="text-[11px] text-destructive/90 leading-relaxed">
                Make sure you downloaded a full JSON backup first if you wish to keep any records.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="factory-reset-confirm" className="text-xs">
                To confirm, type <strong className="font-mono text-foreground">RESET</strong> below:
              </Label>
              <Input
                id="factory-reset-confirm"
                value={confirmInput}
                disabled={busy}
                placeholder="RESET"
                className="font-mono text-xs uppercase"
                onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setFactoryResetDialogOpen(false);
                setConfirmInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || confirmInput.trim() !== "RESET"}
              onClick={() => void handleFactoryReset()}
              variant="destructive"
              className="font-medium gap-1.5"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>Destroy All Data</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
