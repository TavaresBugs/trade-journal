"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Database,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { MarketDataManagerDialog } from "./settings/market-data-manager-dialog";
import {
  detectCsvMetadata,
  MAX_CSV_BYTES,
  type MarketCandleBatch,
  type MarketCsvDataset,
  type MarketCsvImportResponse,
  type MarketSeriesSummary,
} from "@/lib/market-csv";
import { RESOLUTIONS, formatResolutionDisplay, type Resolution } from "@/lib/market-data";
import { getAssetFamily, getDefaultCompatibleSymbols } from "@/lib/assets/symbol-utils";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import { JournalAssetDropdown } from "./journal-asset-dropdown";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MarketCsvSettings({ onChange }: { onChange: () => void }) {
  const {
    data,
    refresh,
    error: listError,
  } = useApi<{
    datasets?: MarketCsvDataset[];
    series?: MarketSeriesSummary[];
    batches?: MarketCandleBatch[];
    tradedSymbols?: string[];
  }>("/api/market-data/csv");

  const [file, setFile] = useState<{ name: string; content: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [currency, setCurrency] = useState("");
  const [priceBasis, setPriceBasis] = useState("raw");
  const [compatibleSymbols, setCompatibleSymbols] = useState<string[]>([]);
  const [customSymbolInput, setCustomSymbolInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active series directly from database summary
  const activeSeries: MarketSeriesSummary[] = useMemo(() => {
    return data?.series ?? [];
  }, [data]);

  const distinctSymbolsCount = useMemo(() => {
    return new Set(activeSeries.map((s) => s.symbol.toUpperCase())).size;
  }, [activeSeries]);

  const totalCandlesCount = useMemo(() => {
    return activeSeries.reduce((acc, s) => acc + s.barCount, 0);
  }, [activeSeries]);

  const change = () => {
    setMessage("");
    setError("");
  };

  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    current: number;
    currentName: string;
    completed: number;
    totalBars: number;
    duplicateBars: number;
  } | null>(null);

  const handleSelectedFile = async (selected: File) => {
    change();
    setFile(null);
    if (!selected) return;
    if (selected.size > MAX_CSV_BYTES) {
      setError("Please select a CSV file smaller than 30 MB.");
      return;
    }
    setBusy(true);
    try {
      const content = decodeImportFile(await selected.arrayBuffer());
      setFile({
        name: selected.name,
        content,
        size: selected.size,
      });
      const detected = detectCsvMetadata(selected.name, content);
      if (detected.symbol) {
        setSymbol(detected.symbol);
        if (detected.compatibleSymbols && detected.compatibleSymbols.length > 0) {
          setCompatibleSymbols([...detected.compatibleSymbols]);
        } else {
          setCompatibleSymbols(getDefaultCompatibleSymbols(detected.symbol));
        }
      }
      if (detected.resolution) setResolution(detected.resolution);
      if (detected.currency) setCurrency(detected.currency);
      if (detected.priceBasis) setPriceBasis(detected.priceBasis);
    } catch {
      setError("Unable to read this CSV file.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectedFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (list.length === 1) {
      void handleSelectedFile(list[0]!);
      return;
    }

    // Multi-file batch sequential ingestion with smart de-duplication
    change();
    setFile(null);
    setBusy(true);
    setBatchProgress({
      total: list.length,
      current: 1,
      currentName: list[0]!.name,
      completed: 0,
      totalBars: 0,
      duplicateBars: 0,
    });

    let completedCount = 0;
    let totalBarsCount = 0;
    let duplicateBarsCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const f = list[i]!;
      setBatchProgress({
        total: list.length,
        current: i + 1,
        currentName: f.name,
        completed: completedCount,
        totalBars: totalBarsCount,
        duplicateBars: duplicateBarsCount,
      });

      if (f.size > MAX_CSV_BYTES) {
        errors.push(`${f.name}: Exceeds 30 MB limit`);
        continue;
      }

      try {
        const content = decodeImportFile(await f.arrayBuffer());
        const detected = detectCsvMetadata(f.name, content);
        const resolvedSymbol = detected.symbol || symbol || "US100";
        const resolvedResolution = detected.resolution || resolution || "1m";
        const resolvedCurrency = detected.currency || currency || "USD";
        const resolvedPriceBasis = detected.priceBasis || priceBasis || "raw";
        const existingSeries = activeSeries.find(
          (s) => s.symbol.toUpperCase() === resolvedSymbol.toUpperCase(),
        );
        const resolvedCompat =
          existingSeries?.compatibleSymbols ??
          (detected.compatibleSymbols && detected.compatibleSymbols.length > 0
            ? detected.compatibleSymbols
            : getDefaultCompatibleSymbols(resolvedSymbol));

        const res = await postJson<MarketCsvImportResponse>("/api/market-data/csv", {
          action: "import",
          name: f.name,
          symbol: resolvedSymbol,
          resolution: resolvedResolution,
          currency: resolvedCurrency,
          priceBasis: resolvedPriceBasis,
          content,
          compatibleSymbols: resolvedCompat,
        });

        completedCount++;
        totalBarsCount += res.newBarCount ?? res.result?.newBarCount ?? 0;
        duplicateBarsCount += res.duplicateBarCount ?? res.result?.duplicateBarCount ?? 0;
      } catch (err) {
        errors.push(`${f.name}: ${err instanceof Error ? err.message : "Ingestion failed"}`);
      }
    }

    setBatchProgress(null);
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
    onChange();

    if (errors.length > 0) {
      setError(`Imported ${completedCount} of ${list.length} files. Errors: ${errors.join("; ")}`);
    } else {
      setMessage(
        `Successfully imported all ${completedCount} files (+${totalBarsCount.toLocaleString()} new bars added, ${duplicateBarsCount.toLocaleString()} overlapping duplicates skipped).`,
      );
    }
  };

  const handleSymbolChange = (newSymbol: string) => {
    change();
    const clean = newSymbol.trim();
    setSymbol(clean);
    const defaults = getDefaultCompatibleSymbols(clean);
    if (defaults.length > 0) {
      setCompatibleSymbols(defaults);
    } else if (clean && !compatibleSymbols.includes(clean)) {
      setCompatibleSymbols([clean]);
    }
  };

  const toggleCompatibleSymbol = (sym: string) => {
    change();
    setCompatibleSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const handleAddCustomSymbol = () => {
    const trimmed = customSymbolInput.trim().toUpperCase();
    if (!trimmed) return;
    change();
    if (!compatibleSymbols.includes(trimmed)) {
      setCompatibleSymbols((prev) => [...prev, trimmed]);
    }
    setCustomSymbolInput("");
  };

  const handleImport = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = await postJson<MarketCsvImportResponse>("/api/market-data/csv", {
        action: "import",
        ...file,
        symbol,
        resolution,
        currency,
        priceBasis,
        compatibleSymbols,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (body && typeof body.newBarCount === "number") {
        const newCount = body.newBarCount.toLocaleString();
        const dupCount = (body.duplicateBarCount ?? 0).toLocaleString();
        const totalCount = (body.totalInDb ?? body.newBarCount).toLocaleString();
        const targetSym = body.symbol || symbol;
        const targetRes = body.resolution || resolution;
        setMessage(
          `Added ${newCount} new bars to ${targetSym} (${targetRes}). ${dupCount} duplicate bars skipped. Total in database: ${totalCount} bars.`,
        );
      } else {
        setMessage("Market candles imported successfully! Available in chart and reports.");
      }
      refresh();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV request failed.");
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeSeries = async (sym: string, res?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/market-data/csv", {
        action: "purge_symbol",
        symbol: sym,
        resolution: res,
      });
      setMessage(
        res
          ? `All bars for ${sym} (${res}) were purged successfully.`
          : `All bars for ${sym} were purged successfully.`,
      );
      refresh();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to purge series bars.");
      throw cause;
    } finally {
      setBusy(false);
    }
  };

  const handleRevertBatch = async (batchId: string, batchName?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/market-data/csv", {
        action: "revert_batch",
        id: batchId,
        batchId,
      });
      setMessage(
        batchName
          ? `Batch "${batchName}" reverted successfully. Batch bars were removed.`
          : `Batch reverted successfully. Batch bars were removed.`,
      );
      refresh();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revert batch.");
      throw cause;
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCompatibleSymbols = async (sym: string, allowedSymbols: string[]) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/market-data/csv", {
        action: "update_compatible_symbols",
        symbol: sym,
        compatibleSymbols: allowedSymbols,
      });
      setMessage(
        `Updated linked compatible instruments for ${sym} (${allowedSymbols.join(", ")}).`,
      );
      refresh();
      onChange();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to update compatible instruments.",
      );
      throw cause;
    } finally {
      setBusy(false);
    }
  };

  const family = symbol ? getAssetFamily(symbol) : null;
  const brotherSymbols = symbol ? getDefaultCompatibleSymbols(symbol) : [];
  const inactiveBrotherSymbols = brotherSymbols.filter((s) => !compatibleSymbols.includes(s));

  return (
    <div
      className="space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5"
      id="market-csv"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Market Data CSV (Historical Candles)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Import market candles for high-resolution chart rendering in Vela and precise trade
            excursion (MAE/MFE) calculations. Supports single or bulk multi-file uploads up to 30 MB / 100,000 bars per file.
          </p>
          <div className="pt-0.5">
            <a
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              href="/market-data-template.csv"
              download
            >
              Download CSV template
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManagerOpen(true)}
            className="h-8 px-3 text-xs gap-1.5 border-border/70 hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer font-medium"
          >
            <Database className="size-3.5 text-emerald-400" />
            <span>Manage Data & Coverage</span>
            {totalCandlesCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
                {distinctSymbolsCount} {distinctSymbolsCount === 1 ? "asset" : "assets"}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Hidden File Input (supports multiple file selection) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        disabled={busy}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files;
          if (selected && selected.length > 0) void handleSelectedFiles(selected);
          event.target.value = "";
        }}
      />

      {/* Batch Ingestion Progress Banner */}
      {batchProgress && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-400 flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Batch Ingestion: Importing file {batchProgress.current} of {batchProgress.total}
            </span>
            <span className="font-mono text-emerald-300 font-semibold">
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate max-w-sm">File: {batchProgress.currentName}</span>
            <span className="font-mono text-emerald-400 font-medium">
              +{batchProgress.totalBars.toLocaleString()} new bars ·{" "}
              {batchProgress.duplicateBars.toLocaleString()} duplicates skipped
            </span>
          </div>
        </div>
      )}

      {/* Dropzone Area */}
      {!file && !batchProgress ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            if (busy) return;
            setIsDragging(false);
            const dropped = e.dataTransfer.files;
            if (dropped && dropped.length > 0) void handleSelectedFiles(dropped);
          }}
          onClick={() => {
            if (!busy) fileInputRef.current?.click();
          }}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-7 text-center transition-all cursor-pointer select-none",
            isDragging
              ? "border-emerald-500 bg-emerald-500/10 scale-[0.99]"
              : "border-border/70 hover:border-emerald-500/50 hover:bg-muted/30 bg-muted/10",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="size-8 animate-spin text-emerald-400 mb-2.5" />
          ) : (
            <Upload className="size-8 text-muted-foreground group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-150 mb-2.5" />
          )}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Drop candle CSV files here (single or multiple), or{" "}
              <span className="text-emerald-400 underline">click to browse</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supports multi-file bulk upload with automatic timeframe detection and smart de-duplication
            </p>
          </div>
        </div>
      ) : !file ? null : (
        /* Selected File Card */
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground truncate max-w-sm">{file.name}</p>
                <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <Check className="size-3" /> Metadata automatically detected
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs gap-1.5 h-8"
          >
            <RotateCcw className="size-3.5" /> Change file
          </Button>
        </div>
      )}

      {/* Configuration Grid */}
      <div className="grid gap-4 sm:grid-cols-2 pt-1">
        {/* Left Column: Instrument Symbol & Family Chips */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="candle-symbol" className="text-xs font-medium">
                Instrument Symbol
              </Label>
              {family && (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Family {family.name}
                </span>
              )}
            </div>
            <JournalAssetDropdown
              currentAsset={symbol || null}
              onSelectAsset={(val) => handleSymbolChange(val ?? "")}
              allTradedSymbols={data?.tradedSymbols}
              triggerVariant="form"
              hideGeneralJournal={true}
              placeholder="Search or enter symbol (e.g. MES, US500)..."
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Source instrument symbol. Preserves empirical identity in the database.
            </p>
          </div>

          {/* Interactive Family Chips / Permissions */}
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">
                Linked Compatible Instruments:
              </span>
              <span className="text-[10px] text-muted-foreground">
                Click to toggle allowed symbols
              </span>
            </div>

            {/* Chips Container */}
            <div className="flex flex-wrap items-center gap-1.5">
              {compatibleSymbols.map((sym) => (
                <button
                  type="button"
                  key={sym}
                  onClick={() => toggleCompatibleSymbol(sym)}
                  className="group inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all select-none cursor-pointer"
                  title="Click to remove this instrument"
                >
                  <Check className="size-3 text-emerald-400" />
                  <span>{sym}</span>
                  <X className="size-3 text-emerald-400/60 group-hover:text-emerald-300 ml-0.5" />
                </button>
              ))}

              {/* Inactive Brother Symbols that user can re-enable */}
              {inactiveBrotherSymbols.map((sym) => (
                <button
                  type="button"
                  key={sym}
                  onClick={() => toggleCompatibleSymbol(sym)}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/40 border border-border/40 px-2 py-1 text-xs text-muted-foreground line-through hover:bg-muted/70 hover:no-underline transition-all select-none cursor-pointer"
                  title="Click to re-enable this instrument"
                >
                  <Plus className="size-3" />
                  <span>{sym}</span>
                </button>
              ))}

              {/* Mini Custom Symbol Input */}
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={customSymbolInput}
                  disabled={busy}
                  placeholder="+ Ticker"
                  className="h-6 w-20 rounded border border-border/60 bg-transparent px-1.5 text-[11px] uppercase placeholder:normal-case placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500"
                  onChange={(e) => setCustomSymbolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomSymbol();
                    }
                  }}
                />
                {customSymbolInput.trim() && (
                  <button
                    type="button"
                    onClick={handleAddCustomSymbol}
                    className="flex size-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Trades in these instruments can use these candles as chart data.
            </p>
          </div>
        </div>

        {/* Right Column: Resolution, Quote Currency, Price Basis */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3.5">
          {/* Resolution */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="candle-resolution" className="text-xs font-medium">
                Candle Resolution (Timeframe)
              </Label>
              {resolution && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  {formatResolutionDisplay(resolution)} (detected)
                </span>
              )}
            </div>
            <OptionSelect
              id="candle-resolution"
              value={resolution}
              disabled={busy}
              onValueChange={(value) => {
                change();
                setResolution(value as Resolution);
              }}
            >
              <option value="" disabled>
                Select file timeframe
              </option>
              {resolution && !Object.keys(RESOLUTIONS).includes(resolution) && (
                <optgroup label="Custom / Detected">
                  <option value={resolution}>{formatResolutionDisplay(resolution)} (Custom)</option>
                </optgroup>
              )}
              <optgroup label="Minutes">
                {(["1m", "2m", "3m", "5m", "10m", "15m", "30m", "45m"] as const).map((value) => (
                  <option key={value} value={value}>
                    {formatResolutionDisplay(value)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Hours">
                {(["1h", "2h", "3h", "4h", "6h", "8h", "12h"] as const).map((value) => (
                  <option key={value} value={value}>
                    {formatResolutionDisplay(value)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Daily & Above">
                {(["1d", "3d", "1w", "1mo"] as const).map((value) => (
                  <option key={value} value={value}>
                    {formatResolutionDisplay(value)}
                  </option>
                ))}
              </optgroup>
            </OptionSelect>
          </div>

          {/* Quote Currency */}
          <div className="space-y-1">
            <Label htmlFor="candle-currency" className="text-xs font-medium">
              Quote Currency
            </Label>
            <Input
              id="candle-currency"
              value={currency}
              disabled={busy}
              maxLength={12}
              placeholder="Ex: USD, BRL, EUR"
              className="text-xs uppercase font-mono h-9"
              onChange={(event) => {
                change();
                setCurrency(event.target.value.toUpperCase());
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              Price currency (USD for CME futures / US equities, BRL for B3).
            </p>
          </div>

          {/* Price Basis */}
          <div className="space-y-1">
            <Label htmlFor="candle-basis" className="text-xs font-medium">
              Price Basis
            </Label>
            <OptionSelect
              id="candle-basis"
              value={priceBasis}
              disabled={busy}
              onValueChange={(value) => {
                change();
                setPriceBasis(value);
              }}
            >
              <option value="" disabled>
                Select price basis
              </option>
              <option value="raw">Unadjusted / raw (Recommended)</option>
              <option value="split">Split adjusted</option>
              <option value="adjusted">Other adjusted</option>
              <option value="midpoint">Midpoint</option>
              <option value="bid">Bid</option>
              <option value="ask">Ask</option>
            </OptionSelect>
            <p className="text-[10px] text-muted-foreground">
              Keep “Unadjusted / raw” for futures contracts and pure price action.
            </p>
          </div>
        </div>
      </div>

      {/* Centered Action Button at Bottom */}
      <div className="flex flex-col items-center justify-center pt-3 gap-2 border-t border-border/40">
        <Button
          size="lg"
          className="bg-white text-zinc-950 hover:bg-zinc-100 font-semibold shadow-md active:scale-[0.98] px-8 h-10 gap-2 min-w-[240px] dark:bg-white dark:text-zinc-950 transition-all cursor-pointer"
          disabled={busy || !file || !symbol || !currency || !resolution || !priceBasis}
          onClick={() => void handleImport()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-zinc-950" />
          ) : (
            <Save className="size-4 text-zinc-950" />
          )}
          Import Market Candles
        </Button>

        {file && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive h-7 cursor-pointer"
            disabled={busy}
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Clear file
          </Button>
        )}
      </div>

      {/* Notifications / Live Ingestion Feedback */}
      {(error || listError) && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span>{error || listError}</span>
        </div>
      )}
      {message && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 font-medium"
        >
          <Check className="size-4 shrink-0 text-emerald-400" />
          <span className="leading-relaxed">{message}</span>
        </div>
      )}

      {/* Dedicated Vela-standard Dialog */}
      <MarketDataManagerDialog
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        series={activeSeries}
        batches={data?.batches ?? []}
        onPurgeSeries={handlePurgeSeries}
        onRevertBatch={handleRevertBatch}
        onUpdateCompatibleSymbols={handleUpdateCompatibleSymbols}
      />
    </div>
  );
}
