"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportPdf, exportPng, type ReviewDocument } from "@/lib/export-review";
import { usePrivacy } from "./privacy";
import { cn } from "@/lib/utils";
interface Preview {
  url: string;
  filename: string;
  type: string;
}
export function ReviewExport({
  document,
  containsFinancialData = false,
  className,
}: {
  document: ReviewDocument;
  containsFinancialData?: boolean;
  className?: string;
}) {
  const privateMode = usePrivacy();
  const concealed = privateMode && containsFinancialData;
  const [busyType, setBusyType] = useState<"pdf" | "png" | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Preview[]>([]);
  const [open, setOpen] = useState(false);
  const urls = useRef<string[]>([]);
  const [previewDocument, setPreviewDocument] = useState<ReviewDocument | null>(null);
  useEffect(
    () => () => {
      urls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  async function run(image: boolean) {
    setBusyType(image ? "png" : "pdf");
    setError("");
    try {
      const result = await (image ? exportPng : exportPdf)(document);
      urls.current.forEach(URL.revokeObjectURL);
      const next = result.map((f) => ({
        url: URL.createObjectURL(f.blob),
        filename: f.filename,
        type: f.blob.type,
      }));
      urls.current = next.map((f) => f.url);
      setFiles(next);
      setPreviewDocument(document);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusyType(null);
    }
  }
  const isBusy = busyType !== null;
  return (
    <div className={cn("space-y-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || concealed}
            className="rounded-xl text-xs gap-1.5 h-8 px-2.5 transition-colors"
            title="Export review as PDF or PNG"
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>
              {busyType === "pdf"
                ? "Exporting PDF…"
                : busyType === "png"
                  ? "Exporting PNG…"
                  : "Export"}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl min-w-[150px]">
          <DropdownMenuItem
            onClick={() => void run(false)}
            disabled={isBusy || concealed}
            className="gap-2 text-xs cursor-pointer"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void run(true)}
            disabled={isBusy || concealed}
            className="gap-2 text-xs cursor-pointer"
          >
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <span>Export PNG image</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {concealed && (
        <p className="text-xs text-muted-foreground">
          Turn off privacy mode to export financial figures.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={open && !concealed} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review export</DialogTitle>
          </DialogHeader>
          {files.map((f, i) => (
            <div key={f.url} className="space-y-3">
              <Button asChild size="sm">
                <a href={f.url} download={f.filename}>
                  Download {f.type === "application/pdf" ? "PDF" : "PNG"}
                  {files.length > 1 ? ` · ${i + 1}/${files.length}` : ""}
                </a>
              </Button>
              {f.type === "application/pdf" ? (
                <div className="rounded border bg-white p-6 text-slate-800">
                  <p className="mb-4 text-xs text-slate-500">
                    Review text · download the PDF for the paginated document.
                  </p>
                  <h3 className="mb-2 text-xl font-semibold">{previewDocument?.title}</h3>
                  <p className="mb-6 text-xs text-slate-500">{previewDocument?.subtitle}</p>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {previewDocument?.lines.join("\n")}
                  </div>
                </div>
              ) : (
                <img src={f.url} alt="Exported journal review" className="w-full rounded border" />
              )}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
