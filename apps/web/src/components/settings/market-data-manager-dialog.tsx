"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Database,
  Layers,
  Calendar,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
} from "lucide-react";
import type { MarketSeriesSummary, MarketCandleBatch } from "@/lib/market-csv";
import { SYMBOL_SPECS } from "@/lib/assets/symbol-specs";
import { getAssetFamily } from "@/lib/assets/symbol-utils";
import { cn } from "@/lib/utils";

interface MarketDataManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  series: MarketSeriesSummary[];
  batches?: MarketCandleBatch[];
  onPurgeSeries: (symbol: string, resolution?: string) => Promise<void>;
  onRevertBatch: (batchId: string) => Promise<void>;
}

interface GroupedAssetSeries {
  symbol: string;
  displayName: string;
  currency: string;
  priceBasis: string;
  compatibleSymbols: string[];
  totalBars: number;
  timeframes: MarketSeriesSummary[];
}

function formatDateHuman(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function formatSeriesRange(firstTime?: number, lastTime?: number): string {
  if (!firstTime || !lastTime) return "—";
  return `${formatDateHuman(firstTime)} → ${formatDateHuman(lastTime)}`;
}

export function MarketDataManagerDialog({
  isOpen,
  onClose,
  series = [],
  batches = [],
  onPurgeSeries,
  onRevertBatch,
}: MarketDataManagerDialogProps) {
  const [activeTab, setActiveTab] = useState<"assets" | "batches">("assets");
  const [purgingKey, setPurgingKey] = useState<string | null>(null);
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Agrupamento inteligente das séries por Símbolo / Ativo
  const groupedAssets: GroupedAssetSeries[] = useMemo(() => {
    const map = new Map<string, GroupedAssetSeries>();

    for (const s of series) {
      const sym = s.symbol.toUpperCase();
      const spec = SYMBOL_SPECS[sym];
      const fam = getAssetFamily(sym);

      if (!map.has(sym)) {
        const compatibleSymbols = fam
          ? Array.from(new Set([...fam.symbols]))
          : [sym];

        map.set(sym, {
          symbol: sym,
          displayName: spec?.name ?? fam?.name ?? sym,
          currency: s.currency || "USD",
          priceBasis: s.priceBasis || "raw",
          compatibleSymbols: compatibleSymbols.filter((x) => x !== sym),
          totalBars: 0,
          timeframes: [],
        });
      }

      const entry = map.get(sym)!;
      entry.totalBars += s.barCount;
      entry.timeframes.push(s);
    }

    const orderMap: Record<string, number> = {
      "1m": 1,
      "3m": 2,
      "5m": 3,
      "15m": 4,
      "30m": 5,
      "1h": 6,
      "4h": 7,
      "1d": 8,
      "1w": 9,
      "1mo": 10,
    };

    for (const asset of map.values()) {
      asset.timeframes.sort((a, b) => {
        const orderA = orderMap[a.resolution.toLowerCase()] ?? 99;
        const orderB = orderMap[b.resolution.toLowerCase()] ?? 99;
        return orderA - orderB;
      });
    }

    return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [series]);

  const handleConfirmPurge = async (symbol: string, resolution?: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onPurgeSeries(symbol, resolution);
      setPurgingKey(null);
      setFeedback(
        resolution
          ? `Velas de ${symbol} (${resolution}) foram removidas com sucesso.`
          : `Todas as séries de ${symbol} foram limpas.`,
      );
    } catch {
      setFeedback("Erro ao remover série do banco.");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRevertBatch = async (batchId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await onRevertBatch(batchId);
      setRevertingBatchId(null);
      setFeedback("Lote revertido e removido do banco com sucesso.");
    } catch {
      setFeedback("Erro ao reverter lote.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#151619] border border-[#2a2b30] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* TOP HEADER */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#2a2b30] bg-[#121316] shrink-0">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-[#089981]" />
            <h3 className="text-sm font-semibold text-[#d1d4dc] tracking-tight">
              Gerenciar Dados de Mercado
            </h3>
            <span className="text-[11px] font-mono text-[#868a96] px-2 py-0.5 rounded-full bg-[#1c1d22] border border-[#2a2b30]">
              market_candles
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#202228] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NAVIGATION RAIL (ABAS NO ESTILO VELA) */}
        <div className="h-10 px-4 flex items-center gap-1 border-b border-[#2a2b30] bg-[#151619] text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={cn(
              "h-8 px-3 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === "assets"
                ? "bg-[#202228] text-[#d1d4dc] shadow-xs"
                : "text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#1a1b20]",
            )}
          >
            <Layers className="w-3.5 h-3.5 text-[#089981]" />
            <span>Ativos & Timeframes ({groupedAssets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            className={cn(
              "h-8 px-3 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === "batches"
                ? "bg-[#202228] text-[#d1d4dc] shadow-xs"
                : "text-[#868a96] hover:text-[#d1d4dc] hover:bg-[#1a1b20]",
            )}
          >
            <Calendar className="w-3.5 h-3.5 text-[#868a96]" />
            <span>Histórico de Lotes ({batches.length})</span>
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className="px-4 py-2 bg-[#089981]/10 border-b border-[#089981]/20 flex items-center justify-between text-xs text-[#089981]">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="hover:opacity-75 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "assets" ? (
            groupedAssets.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
                <Database className="w-8 h-8 text-[#868a96]/40 mx-auto" />
                <p className="text-xs font-medium text-[#d1d4dc]">
                  Nenhum ativo indexado no banco ainda.
                </p>
                <p className="text-[11px] text-[#868a96]">
                  Faça o upload de um arquivo CSV na página de configurações para iniciar.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {groupedAssets.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="border border-[#2a2b30] rounded-xl bg-[#121316] overflow-hidden"
                  >
                    {/* ASSET CARD HEADER */}
                    <div className="px-4 py-3 bg-[#17181c] border-b border-[#2a2b30] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#089981]/15 border border-[#089981]/30 text-xs font-mono font-bold text-[#089981]">
                          {asset.symbol}
                        </span>
                        <div>
                          <span className="text-xs font-semibold text-[#d1d4dc]">
                            {asset.displayName}
                          </span>
                          <span className="text-[11px] font-mono text-[#868a96] ml-2">
                            {asset.currency} · {asset.priceBasis}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[#868a96]">
                          Total: <strong className="text-[#d1d4dc]">{asset.totalBars.toLocaleString()}</strong> velas
                        </span>

                        {purgingKey === asset.symbol ? (
                          <div className="flex items-center gap-1.5 ml-1">
                            <button
                              type="button"
                              onClick={() => handleConfirmPurge(asset.symbol)}
                              disabled={busy}
                              className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[11px] font-medium cursor-pointer"
                            >
                              Confirmar expurgo
                            </button>
                            <button
                              type="button"
                              onClick={() => setPurgingKey(null)}
                              className="px-2 py-0.5 text-[11px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPurgingKey(asset.symbol)}
                            className="p-1 rounded text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-colors cursor-pointer"
                            title={`Limpar todas as velas de ${asset.symbol}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* COMPATIBILITY NOTICE CHIPS */}
                    {asset.compatibleSymbols.length > 0 && (
                      <div className="px-4 py-1.5 bg-[#141518] border-b border-[#202228] flex items-center gap-2 text-[10px] text-[#868a96]">
                        <span className="text-[#868a96]">Compatível com:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {asset.compatibleSymbols.map((item) => (
                            <span
                              key={item}
                              className="px-1.5 py-0.2 rounded bg-[#1c1d22] border border-[#2a2e39] text-[#d1d4dc] font-mono"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TIMEFRAME ROWS */}
                    <div className="divide-y divide-[#202228]">
                      {asset.timeframes.map((tf) => {
                        const tfKey = `${asset.symbol}__${tf.resolution}`;
                        const isPurgingTf = purgingKey === tfKey;

                        return (
                          <div
                            key={tf.resolution}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#151619] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-10 text-center font-mono font-bold text-[#d1d4dc] bg-[#1c1d22] py-0.5 rounded border border-[#2a2b30] text-[11px]">
                                {tf.resolution}
                              </span>
                              <span className="font-mono text-[#d1d4dc] text-[12px]">
                                {tf.barCount.toLocaleString()} velas
                              </span>
                              <span className="text-[11px] text-[#868a96] font-mono">
                                │ {formatSeriesRange(tf.firstTime, tf.lastTime)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isPurgingTf ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmPurge(asset.symbol, tf.resolution)}
                                    disabled={busy}
                                    className="px-2 py-0.5 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-[10px] font-medium cursor-pointer"
                                  >
                                    Limpar {tf.resolution}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPurgingKey(null)}
                                    className="px-2 py-0.5 text-[10px] text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPurgingKey(tfKey)}
                                  className="px-2 py-1 rounded text-[11px] text-[#868a96] hover:text-[#f23645] hover:bg-[#202228] transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Limpar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            batches.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-[#2a2b30] rounded-xl bg-[#121316]">
                <Calendar className="w-8 h-8 text-[#868a96]/40 mx-auto" />
                <p className="text-xs font-medium text-[#d1d4dc]">
                  Nenhum lote recente registrado no banco.
                </p>
                <p className="text-[11px] text-[#868a96]">
                  Uploads futuros registrarão novos lotes com histórico e opção de reversão.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const isReverting = revertingBatchId === batch.id;

                  return (
                    <div
                      key={batch.id}
                      className="p-3 border border-[#2a2b30] rounded-xl bg-[#121316] flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#d1d4dc]">
                            {batch.symbol} · {batch.resolution}
                          </span>
                          <span className="text-[11px] text-[#868a96] font-mono">
                            ({batch.name})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#868a96] font-mono">
                          <span>
                            {new Date(batch.importedAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>│</span>
                          <span className="text-[#089981]">+{batch.newBarCount} novas</span>
                          <span>│</span>
                          <span>{batch.duplicateBarCount} repetidas</span>
                          <span>│</span>
                          <span>Total: {batch.barCount}</span>
                        </div>
                      </div>

                      <div>
                        {isReverting ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmRevertBatch(batch.id)}
                              disabled={busy}
                              className="px-2.5 py-1 rounded bg-[#f23645]/20 hover:bg-[#f23645]/30 border border-[#f23645]/40 text-[#f23645] text-xs font-medium cursor-pointer"
                            >
                              Confirmar reversão
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevertingBatchId(null)}
                              className="px-2 py-1 text-xs text-[#868a96] hover:text-[#d1d4dc] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRevertingBatchId(batch.id)}
                            className="px-2.5 py-1 rounded border border-[#2a2b30] bg-[#17181c] hover:bg-[#202228] text-[#868a96] hover:text-[#f23645] text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reverter Lote</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* BOTTOM FOOTER */}
        <div className="h-12 px-4 border-t border-[#2a2b30] bg-[#121316] flex items-center justify-between text-xs text-[#868a96] shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#089981]" />
            <span>Alimentação incremental contínua em SQLite</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md bg-[#202228] hover:bg-[#2a2e39] text-[#d1d4dc] font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
