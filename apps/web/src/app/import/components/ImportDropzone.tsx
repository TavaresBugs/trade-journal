"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImportDropzoneProps {
  busy: boolean;
  disabled: boolean;
  fileName?: string;
  formats?: { id: string; label: string }[];
  onFileSelect: (file: File) => void;
}

export function ImportDropzone({
  busy,
  disabled,
  fileName,
  formats,
  onFileSelect,
}: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDisabled = busy || disabled;

  const handleFile = (file?: File) => {
    if (!file || isDisabled) return;
    onFileSelect(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.htm,.html,.tsv"
        disabled={isDisabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          handleFile(file);
        }}
      />

      {/* Sleek Reusable Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDisabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          handleFile(file);
        }}
        onClick={() => {
          if (!isDisabled) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-border/70 hover:border-primary/50 hover:bg-muted/30",
          isDisabled && "pointer-events-none opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-primary mb-2.5" />
        ) : (
          <Upload className="size-6 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all duration-150 mb-2.5" />
        )}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">
            {busy ? "Parsing statement…" : fileName || "Click or drop your statement here"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Supports CSV &amp; HTML exports (FTMO, MT4/MT5, TradeZella, Tradovate, IBKR, etc.)
          </p>
          {formats && (
            <p className="text-[10px] text-muted-foreground/75 pt-1">
              Auto-detected:{" "}
              {formats
                .map((f) => f.label.split(" (")[0])
                .slice(0, 7)
                .join(", ")}
              {formats.length > 7 ? " and more" : ""}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
