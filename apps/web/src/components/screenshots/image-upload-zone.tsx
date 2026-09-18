"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Maximize2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ScreenshotAttachment,
  type TimeframeConfig,
  extractImageFromDataTransfer,
} from "./screenshot-types";

interface ImageUploadZoneProps {
  timeframe: TimeframeConfig;
  attachments: ScreenshotAttachment[];
  isUploading?: boolean;
  onUpload: (timeframeKey: string, file: File) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onZoom: (attachments: ScreenshotAttachment[], index: number) => void;
  onActivate?: (timeframeKey: string) => void;
  onHover?: (timeframeKey: string | null) => void;
}

export function ImageUploadZone({
  timeframe,
  attachments,
  isUploading = false,
  onUpload,
  onDelete,
  onZoom,
  onActivate,
  onHover,
}: ImageUploadZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Keep index within bounds
  const safeIndex = attachments.length > 0 ? Math.min(currentIndex, attachments.length - 1) : 0;
  const currentAttachment = attachments[safeIndex];

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const file = extractImageFromDataTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        await onUpload(timeframe.key, file);
        setCurrentIndex(attachments.length); // Navigate to new image
      }
    },
    [attachments.length, onUpload, timeframe.key],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = extractImageFromDataTransfer(e.dataTransfer);
      if (file) {
        await onUpload(timeframe.key, file);
        setCurrentIndex(attachments.length);
      }
    },
    [attachments.length, onUpload, timeframe.key],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await onUpload(timeframe.key, file);
        setCurrentIndex(attachments.length);
      }
      e.target.value = "";
    },
    [attachments.length, onUpload, timeframe.key],
  );

  return (
    <div
      ref={containerRef}
      role="region"
      tabIndex={0}
      aria-label={`Screenshot Slot ${timeframe.label}`}
      onMouseEnter={() => onHover?.(timeframe.key)}
      onMouseLeave={() => onHover?.(null)}
      onMouseDown={() => {
        onActivate?.(timeframe.key);
        containerRef.current?.focus();
      }}
      onFocus={() => onActivate?.(timeframe.key)}
      onClick={() => {
        onActivate?.(timeframe.key);
        containerRef.current?.focus();
      }}
      onPaste={handlePaste}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`group relative aspect-video w-full overflow-hidden rounded-xl border-2 transition-all duration-200 outline-none select-none ${
        isDragOver
          ? "border-primary bg-primary/10 shadow-lg scale-[1.01]"
          : attachments.length > 0
            ? "border-border/80 bg-muted/20 shadow-2xs hover:border-border focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            : "border-dashed border-border/80 bg-muted/30 hover:border-foreground/30 hover:bg-muted/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Timeframe Label Badge (Top Left) */}
      <div
        className={`absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm transition-colors ${
          attachments.length > 0
            ? "bg-black/70 text-white border border-white/20 shadow-xs group-hover:bg-primary group-hover:text-primary-foreground group-focus-within:bg-primary group-focus-within:text-primary-foreground"
            : "bg-background/90 text-foreground border border-border shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground group-focus-within:bg-primary group-focus-within:text-primary-foreground"
        }`}
      >
        <span>{timeframe.label}</span>
        {attachments.length > 1 && (
          <span className="font-mono">
            ({safeIndex + 1}/{attachments.length})
          </span>
        )}
      </div>

      {/* Loading Overlay */}
      {isUploading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/85 backdrop-blur-xs">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="mt-1.5 text-[11px] text-muted-foreground font-medium">
            Compressing & Saving…
          </span>
        </div>
      )}

      {/* Content: Screenshot or Empty Placeholder */}
      {currentAttachment ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/attachments/${currentAttachment.id}`}
            alt={`${timeframe.label} screenshot`}
            className="h-full w-full object-cover select-none"
            loading="lazy"
          />

          {/* Delete Button (Top Right) */}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 z-30 h-7 w-7 rounded bg-black/65 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity border border-white/20 shadow-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove screenshot for ${timeframe.label}?`)) {
                onDelete(currentAttachment.id);
              }
            }}
            title="Remove screenshot"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen Zoom Button (Bottom Left) */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-2 left-2 z-30 h-7 w-7 rounded bg-black/65 hover:bg-black/90 text-white border border-white/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-xs"
            onClick={(e) => {
              e.stopPropagation();
              onZoom(attachments, safeIndex);
            }}
            title="Open fullscreen zoom"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>

          {/* Navigation Arrows for Multiple Images in this Slot */}
          {attachments.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
                }}
                aria-label="Previous image"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-30 p-1 rounded-full bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
                }}
                aria-label="Next image"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-30 p-1 rounded-full bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 shadow-xs"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* CTRL+V Floating Badge in center */}
          <span className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded bg-foreground text-background px-2.5 py-0.5 text-[10px] font-mono font-semibold opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-events-none shadow-md">
            CTRL+V
          </span>

          {/* Add Another Image Button (Bottom Right) */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute bottom-2 right-2 z-30 h-7 w-7 rounded bg-black/65 hover:bg-black/90 text-white border border-white/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-xs"
            title="Add another image to this slot"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      ) : (
        /* Empty Slot State */
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <span className="rounded-full bg-muted/80 p-2.5 mb-1.5 text-muted-foreground group-hover:text-foreground group-hover:bg-accent border border-border/60 transition-colors shadow-2xs">
            <Plus className="h-5 w-5" />
          </span>

          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            {timeframe.label}
          </span>

          {/* CTRL+V Floating Badge */}
          <span className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded bg-foreground text-background px-2.5 py-0.5 text-[10px] font-mono font-semibold shadow-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-events-none">
            CTRL+V
          </span>

          {/* Upload Button (Bottom Right) */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute bottom-2 right-2 z-20 h-6 w-6 rounded bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border shadow-2xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            title="Select image file"
          >
            <UploadCloud className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
