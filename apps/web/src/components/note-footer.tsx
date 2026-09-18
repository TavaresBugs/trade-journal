"use client";

import { useRef, useState } from "react";
import { Paperclip, Save } from "lucide-react";
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

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <ReviewExport
          className="space-y-0"
          containsFinancialData={containsFinancialData}
          document={document}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Paperclip />
          {busy ? "Uploading…" : "Add attachment"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saveDisabled || isSaving}
          onClick={() => void onSave()}
        >
          <Save />
          {isSaving ? "Saving…" : "Save note"}
        </Button>
        {savingStatus && !isSaving && (
          <span role="status" className="text-xs text-muted-foreground">
            {savingStatus}
          </span>
        )}
      </div>
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
