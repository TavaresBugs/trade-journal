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
  Sliders,
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
import { RESOLUTIONS, type MarketBar, type Resolution } from "@/lib/market-data";
import { getAssetFamily } from "@/lib/assets/symbol-utils";
import { postJson, useApi } from "@/lib/use-api";
import { decodeImportFile } from "@/lib/decode-import";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import { MonetaryValue } from "./privacy";
import { JournalAssetDropdown } from "./journal-asset-dropdown";

interface Preview {
  count: number;
  from: string;
  to: string;
  sample: MarketBar[];
}

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
  const [preview, setPreview] = useState<Preview | null>(null);
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
    setPreview(null);
    setMessage("");
    setError("");
  };

  const handleSelectedFile = async (selected: File) => {
    change();
    setFile(null);
    if (!selected) return;
    if (selected.size > MAX_CSV_BYTES) {
      setError("Use um arquivo CSV menor que 5 MB.");
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
        if (detected.family) {
          setCompatibleSymbols([...detected.family.symbols]);
        } else {
          setCompatibleSymbols([detected.symbol]);
        }
      }
      if (detected.resolution) setResolution(detected.resolution);
      if (detected.currency) setCurrency(detected.currency);
      if (detected.priceBasis) setPriceBasis(detected.priceBasis);
    } catch {
      setError("Não foi possível ler este arquivo CSV.");
    } finally {
      setBusy(false);
    }
  };

  const handleSymbolChange = (newSymbol: string) => {
    change();
    const clean = newSymbol.trim();
    setSymbol(clean);
    const fam = getAssetFamily(clean);
    if (fam) {
      setCompatibleSymbols((prev) => {
        const merged = new Set([...fam.symbols, ...prev]);
        return [...merged];
      });
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

  const act = async (action: "preview" | "import") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = await postJson<Preview & MarketCsvImportResponse>("/api/market-data/csv", {
        action,
        ...file,
        symbol,
        resolution,
        currency,
        priceBasis,
        compatibleSymbols,
      });
      if (action === "preview") {
        setPreview(body);
      } else {
        setPreview(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        if (body && typeof body.newBarCount === "number") {
          const newCount = body.newBarCount.toLocaleString();
          const dupCount = (body.duplicateBarCount ?? 0).toLocaleString();
          const totalCount = (body.totalInDb ?? body.newBarCount).toLocaleString();
          const targetSym = body.symbol || symbol;
          const targetRes = body.resolution || resolution;
          setMessage(
            `Foram adicionadas ${newCount} novas velas ao ${targetSym} (${targetRes}). ${dupCount} velas repetidas foram ignoradas. Total no banco: ${totalCount} velas.`
          );
        } else {
          setMessage(
            "Candles de mercado importados com sucesso! Disponíveis no gráfico e relatórios."
          );
        }
        refresh();
        onChange();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na requisição de CSV.");
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
          ? `Todas as velas de ${sym} (${res}) foram expurgadas com sucesso.`
          : `Todas as velas de ${sym} foram expurgadas com sucesso.`,
      );
      refresh();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao expurgar velas da série.");
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
          ? `Lote "${batchName}" revertido com sucesso. Velas do lote foram removidas.`
          : `Lote revertido com sucesso. Velas do lote foram removidas.`,
      );
      refresh();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao reverter lote.");
      throw cause;
    } finally {
      setBusy(false);
    }
  };

  const family = symbol ? getAssetFamily(symbol) : null;
  const brotherSymbols = family ? family.symbols : [];
  const inactiveBrotherSymbols = brotherSymbols.filter((s) => !compatibleSymbols.includes(s));

  return (
    <div
      className="space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5"
      id="market-csv"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Market data CSV (Candles Históricos)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Carregue velas de mercado para renderização de alta resolução no gráfico Vela e cálculo
            preciso de MAE/MFE nos seus trades. Suporta arquivos de até 5 MB / 50.000 barras.
          </p>
        </div>
        <a
          className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          href="/market-data-template.csv"
          download
        >
          Baixar template de cabeçalho
        </a>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        disabled={busy}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) void handleSelectedFile(selected);
        }}
      />

      {/* Dropzone Area */}
      {!file ? (
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
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void handleSelectedFile(dropped);
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
              Arraste e solte o arquivo CSV de candles aqui, ou{" "}
              <span className="text-emerald-400 underline">clique para selecionar</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Suporta exportações de TradingView, NinjaTrader, MetaTrader e Tradovate (.csv ou .tsv)
            </p>
          </div>
        </div>
      ) : (
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
                <Check className="size-3" /> Metadados identificados automaticamente
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
            <RotateCcw className="size-3.5" /> Trocar arquivo
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
                Símbolo do Instrumento
              </Label>
              {family && (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Família {family.name}
                </span>
              )}
            </div>
            <JournalAssetDropdown
              currentAsset={symbol || null}
              onSelectAsset={(val) => handleSymbolChange(val ?? "")}
              allTradedSymbols={data?.tradedSymbols}
              triggerVariant="form"
              hideGeneralJournal={true}
              placeholder="Buscar ou digitar símbolo (ex: MES, US500)…"
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Símbolo de origem deste arquivo. Mantém a identidade empírica no banco.
            </p>
          </div>

          {/* Interactive Family Chips / Permissions */}
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">
                Ativos vinculados permitidos:
              </span>
              <span className="text-[10px] text-muted-foreground">
                Clique para permitir ou remover
              </span>
            </div>

            {/* Chips Container */}
            <div className="flex flex-wrap items-center gap-1.5">
              {compatibleSymbols.map((sym) => (
                <button
                  type="button"
                  key={sym}
                  onClick={() => toggleCompatibleSymbol(sym)}
                  className="group inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all select-none"
                  title="Clique para desmarcar este ativo da lista permitida"
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
                  className="inline-flex items-center gap-1 rounded-md bg-muted/40 border border-border/40 px-2 py-1 text-xs text-muted-foreground line-through hover:bg-muted/70 hover:no-underline transition-all select-none"
                  title="Clique para reativar este ativo"
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
                    className="flex size-6 items-center justify-center rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs"
                  >
                    <Plus className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Trades destes ativos poderão utilizar as velas deste CSV como base gráfica.
            </p>
          </div>
        </div>

        {/* Right Column: Resolution, Quote Currency, Price Basis */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3.5">
          {/* Resolution */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="candle-resolution" className="text-xs font-medium">
                Resolução do Candle (Timeframe)
              </Label>
              {resolution && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  {resolution} (detectado)
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
                Escolha o timeframe do arquivo
              </option>
              {Object.keys(RESOLUTIONS).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </OptionSelect>
          </div>

          {/* Quote Currency */}
          <div className="space-y-1">
            <Label htmlFor="candle-currency" className="text-xs font-medium">
              Moeda de Cotação (Quote currency)
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
              Moeda do preço (USD para futuros CME/ações EUA, BRL para B3).
            </p>
          </div>

          {/* Price Basis */}
          <div className="space-y-1">
            <Label htmlFor="candle-basis" className="text-xs font-medium">
              Base de Preço
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
                Escolha a base de preço
              </option>
              <option value="raw">Unadjusted / raw (Recomendado)</option>
              <option value="split">Split adjusted</option>
              <option value="adjusted">Other adjusted</option>
              <option value="midpoint">Midpoint</option>
              <option value="bid">Bid</option>
              <option value="ask">Ask</option>
            </OptionSelect>
            <p className="text-[10px] text-muted-foreground">
              Mantenha &ldquo;Unadjusted / raw&rdquo; para contratos futuros e preços puros.
            </p>
          </div>
        </div>
      </div>

      {/* Centered Action Button at Bottom */}
      <div className="flex flex-col items-center justify-center pt-3 gap-2 border-t border-border/40">
        <Button
          size="lg"
          className="bg-white text-zinc-950 hover:bg-zinc-100 font-semibold shadow-md active:scale-[0.98] px-8 h-10 gap-2 min-w-[240px] dark:bg-white dark:text-zinc-950 transition-all"
          disabled={busy || !file || !symbol || !currency || !resolution || !priceBasis}
          onClick={() => void act("import")}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-zinc-950" />
          ) : (
            <Save className="size-4 text-zinc-950" />
          )}
          Importar Candles de Mercado
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground h-7"
            disabled={busy || !file || !symbol || !currency || !resolution || !priceBasis}
            onClick={() => void act("preview")}
          >
            Pré-visualizar candles (tabela)
          </Button>

          {file && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive h-7"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Limpar seleção
            </Button>
          )}
        </div>
      </div>

      {/* Preview Table */}
      {preview && (
        <div className="space-y-2 rounded-xl border border-border/80 bg-background/50 p-3.5 animate-in fade-in-50">
          <div className="flex items-center justify-between text-xs">
            <p className="font-medium text-foreground">
              Pré-visualização: {preview.count.toLocaleString()} candles encontrados
            </p>
            <p className="text-muted-foreground text-[11px]">
              {preview.from.slice(0, 16).replace("T", " ")} até{" "}
              {preview.to.slice(0, 16).replace("T", " ")} UTC
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/50">
                <tr>
                  {["Horário (UTC)", "Open", "High", "Low", "Close"].map((label) => (
                    <th key={label} className="p-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {preview.sample.map((bar) => (
                  <tr key={bar.time} className="hover:bg-muted/20">
                    <td className="p-2 text-muted-foreground">
                      {new Date(bar.time).toISOString().replace(".000Z", "Z")}
                    </td>
                    {[bar.open, bar.high, bar.low, bar.close].map((val, idx) => (
                      <td key={idx} className="p-2">
                        <MonetaryValue>{val}</MonetaryValue>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Resumo da Base de Velas & Abertura do Modal de Gerenciamento */}
      <div className="pt-3 border-t border-border/40" id="time-series-catalog">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-background/50 hover:border-emerald-500/30 transition-all shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <span>Base de Dados de Velas (market_candles)</span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
                  {distinctSymbolsCount} {distinctSymbolsCount === 1 ? "ativo" : "ativos"} · {totalCandlesCount.toLocaleString()} velas
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Séries contínuas em SQLite com deduplicação nativa em UTC · Integração com Vela
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManagerOpen(true)}
            className="h-8 px-3 text-xs gap-1.5 border-border/70 hover:border-emerald-500/40 hover:text-emerald-400 cursor-pointer"
          >
            <Sliders className="size-3.5 text-emerald-400" />
            <span>Gerenciar Dados & Séries</span>
          </Button>
        </div>
      </div>

      {/* Modal Dedicado no Padrão Vela */}
      <MarketDataManagerDialog
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        series={activeSeries}
        batches={data?.batches ?? []}
        onPurgeSeries={handlePurgeSeries}
        onRevertBatch={handleRevertBatch}
      />
    </div>
  );
}
