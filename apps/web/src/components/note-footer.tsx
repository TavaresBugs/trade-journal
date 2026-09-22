"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Paperclip, Save, Check, Loader2, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewExport } from "@/components/review-export";
import { AttachmentGrid, type AttachmentItem } from "@/components/attachments";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { ReviewDocument } from "@/lib/export-review";

interface NoteFooterProps {
  type: "day" | "trade" | "note";
  id: string;
  document: ReviewDocument;
  onSave: () => void | Promise<void>;
  savingStatus?: string | null;
  saveDisabled?: boolean;
  containsFinancialData?: boolean;
  className?: string;
  mode?: "preview" | "edit";
  onModeChange?: (mode: "preview" | "edit") => void;
}

export function NoteFooter({
  type,
  id,
  document,
  onSave,
  savingStatus,
  saveDisabled = false,
  containsFinancialData = false,
  className,
  mode,
  onModeChange,
}: NoteFooterProps) {
  const { data, error, refresh } = useApi<{
    attachments: AttachmentItem[];
  }>(`/api/attachments?type=${type}&id=${encodeURIComponent(id)}`);
  const displayedAttachments = (data?.attachments ?? []).filter((a) => !a.slot);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setFailure("");
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("type", type);
        body.append("id", id);
        body.append("file", file);
        const r = await fetch("/api/attachments", { method: "POST", body });
        let result: { error?: string } | undefined;
        try {
          result = await r.json();
        } catch {
          if (!r.ok) throw new Error(`Upload failed (${r.status})`);
        }
        if (!r.ok) throw new Error(result?.error ?? `Upload failed (${r.status})`);
      }
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      refresh();
    }
  };

  const handleRemove = async (attachmentId: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await postJson(`/api/attachments/${attachmentId}`, undefined, "DELETE");
      refresh();
    } catch (e) {
      setFailure(String(e));
    }
  };

  const isSaving = savingStatus === "Saving…";
  const isError = Boolean(savingStatus && savingStatus.startsWith("Not saved"));
  const [savedFeedback, setSavedFeedback] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSavedFeedback = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSavedFeedback(true);
    timerRef.current = setTimeout(() => {
      setSavedFeedback(false);
    }, 2500);
  }, []);

  useEffect(() => {
    if (savingStatus === "Saved") {
      triggerSavedFeedback();
    } else if (savingStatus === "Saving…") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSavedFeedback(false);
    }
  }, [savingStatus, triggerSavedFeedback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleManualSave = async () => {
    if (isSaving) return;
    try {
      await onSave();
      triggerSavedFeedback();
      if (onModeChange) {
        setTimeout(() => {
          onModeChange("preview");
        }, 600);
      }
    } catch {
      // Caught or reflected via savingStatus
    }
  };

  const isSaved = !isSaving && savedFeedback;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl text-xs gap-1.5"
          disabled={busy}
          onClick={() => input.current?.click()}
          title="Upload attachments (images or PDF)"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Paperclip className="size-3.5" />
          )}
          {busy ? "Uploading…" : "Add attachment"}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <ReviewExport
            className="space-y-0"
            containsFinancialData={containsFinancialData}
            document={document}
          />

          {mode === "preview" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onModeChange?.("edit")}
              className="gap-1.5 rounded-xl px-4 py-2 text-xs font-medium border-border/70 hover:bg-muted/80 active:scale-[0.98] shadow-xs transition-all duration-200 shrink-0"
              title="Edit note"
            >
              <Pencil className="size-3.5" />
              <span>Edit note</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={saveDisabled || isSaving}
              onClick={handleManualSave}
              title={
                isSaved
                  ? "Note is saved to local journal"
                  : isSaving
                    ? "Saving note…"
                    : isError
                      ? "Click to retry saving"
                      : "Save note (auto-saves while typing)"
              }
              className="gap-1.5 rounded-xl px-4 py-2 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] shadow-xs transition-all duration-200 shrink-0"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isSaved ? (
                <Check className="size-3.5 animate-in zoom-in-50 duration-200" />
              ) : isError ? (
                <AlertCircle className="size-3.5" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>
                {isSaving ? "Saving…" : isSaved ? "Saved" : isError ? "Retry save" : "Save note"}
              </span>
            </Button>
          )}
        </div>
      </div>
      {isError && (
        <p role="alert" className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{savingStatus}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">Images or PDF · up to 8 MB each</p>
      <input
        ref={input}
        aria-label="Upload attachment"
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        multiple
        onChange={handleUpload}
      />
      {(failure || error) && (
        <p role="alert" className="text-xs text-destructive">
          {failure || error}
        </p>
      )}
      {displayedAttachments.length > 0 && (
        <AttachmentGrid items={displayedAttachments} onRemove={handleRemove} />
      )}
    </div>
  );
}
