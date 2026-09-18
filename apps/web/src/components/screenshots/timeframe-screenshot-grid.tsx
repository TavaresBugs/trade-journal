"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Clock, CheckCircle2 } from "lucide-react";
import { useApi, postJson } from "@/lib/use-api";
import { compressImageToWebP } from "@/lib/image-compression";
import { ImageUploadZone } from "./image-upload-zone";
import { ImagePreviewLightbox, type LightboxImageItem } from "./image-preview-lightbox";
import {
  type ScreenshotAttachment,
  TIMEFRAME_CONFIG,
  buildSlotKey,
  parseSlotKey,
  extractImageFromDataTransfer,
} from "./screenshot-types";

interface TimeframeScreenshotGridProps {
  date: string;
}

export function TimeframeScreenshotGrid({ date }: TimeframeScreenshotGridProps) {
  const { data, error, refresh } = useApi<{
    attachments: ScreenshotAttachment[];
  }>(`/api/attachments?type=day&id=${encodeURIComponent(date)}`);

  const [activeCategory, setActiveCategory] = useState<"pre" | "post">("pre");
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Silent refs for hover and active slot targeting without visual adornments or unnecessary re-renders
  const hoveredSlotRef = React.useRef<string | null>(null);
  const activeSlotRef = React.useRef<string>("tfD");

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Group attachments by parsed category and timeframeKey
  const { preAttachmentsByTf, postAttachmentsByTf, preTotalCount, postTotalCount } = useMemo(() => {
    const preMap = new Map<string, ScreenshotAttachment[]>();
    const postMap = new Map<string, ScreenshotAttachment[]>();
    let preCount = 0;
    let postCount = 0;

    for (const att of data?.attachments ?? []) {
      const parsed = parseSlotKey(att.slot);
      if (parsed) {
        if (parsed.category === "post") {
          const list = postMap.get(parsed.timeframeKey) ?? [];
          list.push(att);
          postMap.set(parsed.timeframeKey, list);
          postCount++;
        } else {
          const list = preMap.get(parsed.timeframeKey) ?? [];
          list.push(att);
          preMap.set(parsed.timeframeKey, list);
          preCount++;
        }
      }
    }

    return {
      preAttachmentsByTf: preMap,
      postAttachmentsByTf: postMap,
      preTotalCount: preCount,
      postTotalCount: postCount,
    };
  }, [data?.attachments]);

  // Flat list of all screenshots across timeframes for complete carousel navigation
  const allScreenshotsFlat = useMemo(() => {
    const list: LightboxImageItem[] = [];
    const categories: ("pre" | "post")[] = ["pre", "post"];

    for (const cat of categories) {
      const catLabel = cat === "pre" ? "Pre-market" : "Post-market";
      const map = cat === "pre" ? preAttachmentsByTf : postAttachmentsByTf;
      for (const tf of TIMEFRAME_CONFIG) {
        const slotAtts = map.get(tf.key) ?? [];
        slotAtts.forEach((att, i) => {
          const multipleSuffix = slotAtts.length > 1 ? ` #${i + 1}` : "";
          list.push({
            id: att.id,
            url: `/api/attachments/${att.id}`,
            title: `${tf.label} (${catLabel})${multipleSuffix}`,
            subtitle: tf.description,
          });
        });
      }
    }
    return list;
  }, [preAttachmentsByTf, postAttachmentsByTf]);

  const currentAttachmentsMap = activeCategory === "pre" ? preAttachmentsByTf : postAttachmentsByTf;

  const handleUpload = useCallback(
    async (timeframeKey: string, file: File) => {
      const slotKey = buildSlotKey(activeCategory, timeframeKey);
      setUploadingSlot(timeframeKey);
      setUploadError(null);

      try {
        const compressed = await compressImageToWebP(file);
        const body = new FormData();
        body.append("type", "day");
        body.append("id", date);
        body.append("slot", slotKey);
        body.append("file", compressed);

        const res = await fetch("/api/attachments", { method: "POST", body });
        let result: { error?: string } | undefined;
        try {
          result = await res.json();
        } catch {
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        }
        if (!res.ok) {
          throw new Error(result?.error || "Upload failed");
        }
        refresh();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to process screenshot");
      } finally {
        setUploadingSlot(null);
      }
    },
    [activeCategory, date, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await postJson(`/api/attachments/${id}`, undefined, "DELETE");
        refresh();
        setLightboxIndex(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to delete screenshot");
      }
    },
    [refresh],
  );

  const handleZoom = useCallback(
    (slotAttachments: ScreenshotAttachment[], index: number) => {
      const clicked = slotAttachments[index];
      if (!clicked) return;

      const flatIndex = allScreenshotsFlat.findIndex((item) => item.id === clicked.id);
      setLightboxIndex(flatIndex !== -1 ? flatIndex : 0);
    },
    [allScreenshotsFlat],
  );

  // Global window-level paste listener: captures Ctrl+V and directs file to target slot
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Do not intercept if user is typing into input, textarea, or rich editor
      const activeEl = document.activeElement as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      const isInput = (el: HTMLElement | null) =>
        Boolean(
          el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable ||
            el.closest("[contenteditable='true']")),
        );

      if (isInput(activeEl) || isInput(target)) {
        return;
      }

      const file = extractImageFromDataTransfer(e.clipboardData);
      if (!file) return;

      const targetTf = hoveredSlotRef.current || activeSlotRef.current || TIMEFRAME_CONFIG[0]?.key;
      if (!targetTf) return;

      e.preventDefault();
      e.stopPropagation();
      await handleUpload(targetTf, file);
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [handleUpload]);

  return (
    <Card className="overflow-hidden border-border/80 bg-card">
      <CardHeader className="pb-3.5 pt-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">
                Visual context & screenshots
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeCategory === "pre"
                  ? "Macro context and market structure prior to session open"
                  : "Trade executions, order management, and session review"}
              </p>
            </div>
          </div>

          {/* Category Tabs: Pre-market vs Post-market (executions) */}
          <div className="flex items-center rounded-lg bg-muted/60 p-1 text-xs border border-border/40">
            <button
              type="button"
              onClick={() => setActiveCategory("pre")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                activeCategory === "pre"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pre-market</span>
              {preTotalCount > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                  {preTotalCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("post")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
                activeCategory === "post"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Post-market (executions)</span>
              {postTotalCount > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                  {postTotalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 sm:px-6 pb-5 space-y-3">
        {(uploadError || error) && (
          <p
            role="alert"
            className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20"
          >
            {uploadError || error}
          </p>
        )}

        {/* 4x2 Demarcated Grid (8 identical slots for both pre and post modes) */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {TIMEFRAME_CONFIG.map((tf) => {
            const slotAttachments = currentAttachmentsMap.get(tf.key) ?? [];
            return (
              <ImageUploadZone
                key={`${activeCategory}_${tf.key}`}
                timeframe={tf}
                attachments={slotAttachments}
                isUploading={uploadingSlot === tf.key}
                onUpload={handleUpload}
                onDelete={handleDelete}
                onZoom={handleZoom}
                onActivate={(key) => {
                  activeSlotRef.current = key;
                }}
                onHover={(key) => {
                  hoveredSlotRef.current = key;
                }}
              />
            );
          })}
        </div>
      </CardContent>

      {/* Lightbox Modal with Zoom & Pan */}
      {lightboxIndex !== null && allScreenshotsFlat.length > 0 && (
        <ImagePreviewLightbox
          images={allScreenshotsFlat}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
          onDelete={handleDelete}
        />
      )}
    </Card>
  );
}
