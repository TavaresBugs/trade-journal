"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vela } from "@luxalgo/vela";
import {
  RESOLUTIONS,
  type MarketConnection,
  type ExcursionEstimate,
  type Resolution,
  type TradeMarketResult,
} from "@/lib/market-data";
import { providerInfo } from "@/lib/market-providers";
import type {
  MarketCandleBatch,
  MarketCsvDataset,
  MarketSeriesSummary,
} from "@/lib/market-csv";
import { getAssetFamily, normalizeSymbol } from "@/lib/assets/symbol-utils";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";
import { useApi } from "@/lib/use-api";
import { cn, fmtMoney } from "@/lib/utils";
import { TradeChart, type ChartExecution, type ChartTrade } from "./trade-chart";
import { usePrivacy } from "./privacy";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OptionSelect } from "./ui/option-select";
import { enhanceVelaDrawingToolbar } from "./vela-drawing-enhancer";
import * as drawingEnhancerMod from "./vela-drawing-enhancer";
import { attachVelaDrawingsPersistence } from "./vela-drawings-bridge";
import { attachVelaTimeframePicker } from "./vela-timeframe-picker";
import { attachVelaStylePicker } from "./vela-style-picker";
import { enhanceVelaChromeHover, enhanceVelaSideRail } from "./vela-chrome-enhancer";
import { attachVelaScreenshotMenu, type ScreenshotMenuController } from "./vela-screenshot-menu";
import {
  showVelaToast,
  registerCopyPriceAction,
  enhanceVelaContextMenu,
} from "./vela-context-menu";
import { VelaSettingsDialog } from "./settings/vela-settings-dialog";
import {
  mapSettingsSectionToTab,
  applyStoredSettingsToChart,
  loadStoredSettings,
} from "./settings/vela-settings-bridge";



export function TradeMarketData({
  trade,
  executions,
}: {
  trade: ChartTrade & { currency: string };
  executions: ChartExecution[];
}) {
  const privacy = usePrivacy();
  const { data: saved, refresh: refreshSaved } = useApi<{
    saved: {
      estimate: ExcursionEstimate & { datasetId?: string };
      provider?: string;
      symbol?: string;
      resolution?: Resolution;
      fetchedAt?: string;
    } | null;
  }>(`/api/trades/${encodeURIComponent(trade.key)}/market-data`);
  const { data: connections, error: connectionError } = useApi<{ connections: MarketConnection[] }>(
    "/api/market-data/connections",
  );
  const available = connections?.connections.filter((connection) => connection.configured) ?? [];
  const [provider, setProvider] = useState("");
  const [symbol, setSymbol] = useState(trade.symbol);
  const [dataset, setDataset] = useState("");
  const [resolution, setResolution] = useState<Resolution>("1m");
  const info = providerInfo(provider);
  const hasCsvConfigured = available.some((p) => p.id === "market-csv");
  const { data: csv } = useApi<{
    datasets?: MarketCsvDataset[];
    series?: MarketSeriesSummary[];
    batches?: MarketCandleBatch[];
  }>(
    hasCsvConfigured || info?.mode === "csv" ? "/api/market-data/csv" : null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<TradeMarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [switchingTf, setSwitchingTf] = useState<Resolution | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const autoLoadedRef = useRef(false);
  const dismissedRef = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  const invalidate = () => {
    requestSeqRef.current++;
    controller.current?.abort();
    setBusy(false);
    setSwitchingTf(null);
    setResult(null);
    setError("");
    dismissedRef.current = true;
  };

  const load = async (override?: {
    provider?: string;
    symbol?: string;
    dataset?: string;
    resolution?: Resolution;
    confirmed?: boolean;
  }) => {
    dismissedRef.current = false;
    const p = override?.provider ?? provider;
    const s = override?.symbol ?? symbol;
    const d = override?.dataset ?? dataset;
    const r = override?.resolution ?? resolution;
    const c = override?.confirmed ?? confirmed;
    const pInfo = providerInfo(p);

    if (!available.some((item) => item.id === p) || (pInfo?.datasets && !d)) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;

    const seq = ++requestSeqRef.current;
    const isSwitchingResolution = Boolean(result && r !== result.resolution);

    if (isSwitchingResolution) {
      setSwitchingTf(r);
    } else {
      setResult(null);
    }

    setBusy(true);
    setError("");

    try {
      const storedSettings = loadStoredSettings();
      const contextPadding = storedSettings.advanced.tradeContextPadding ?? 25;
      const response = await fetch(`/api/trades/${encodeURIComponent(trade.key)}/market-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: p,
          symbol: s,
          dataset: d,
          resolution: r,
          basisConfirmed: c,
          contextPadding,
        }),
        signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "History request failed.");
      if (seq === requestSeqRef.current && !request.signal.aborted) {
        setResult(body);
        setResolution(r);
        setSwitchingTf(null);
        refreshSaved();
      }
    } catch (cause) {
      if (request.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
        return;
      }
      if (seq === requestSeqRef.current) {
        setError(cause instanceof Error ? cause.message : "History request failed.");
        setSwitchingTf(null);
      }
    } finally {
      if (seq === requestSeqRef.current) setBusy(false);
    }
  };

  // Auto-load candles if saved configuration exists or matching dataset is found
  useEffect(() => {
    if (autoLoadedRef.current || dismissedRef.current || busy || result || !available.length) return;

    // 1. If saved estimate/configuration exists, load automatically with saved parameters
    if (saved?.saved) {
      const savedProvider = saved.saved.provider;
      const targetProvider =
        available.find((p) => p.id === savedProvider || p.name === savedProvider)?.id ??
        (available.length === 1 ? available[0]?.id : "");

      if (targetProvider) {
        autoLoadedRef.current = true;
        const targetSymbol = saved.saved.symbol || trade.symbol;
        const targetResolution = (saved.saved.resolution as Resolution) || "1m";
        const targetDataset = saved.saved.estimate?.datasetId || "";

        setProvider(targetProvider);
        setSymbol(targetSymbol);
        setResolution(targetResolution);
        if (targetDataset) setDataset(targetDataset);
        setConfirmed(true);

        void load({
          provider: targetProvider,
          symbol: targetSymbol,
          resolution: targetResolution,
          dataset: targetDataset,
          confirmed: true,
        });
        return;
      }
    }

    // 2. If no saved estimate, check if continuous series or datasets match this trade's symbol / family
    if (hasCsvConfigured) {
      const tradeTime = Date.parse(trade.openedAt);
      const tradeNorm = normalizeSymbol(trade.symbol);
      const family = getAssetFamily(trade.symbol);
      const familySymbols = family ? family.symbols.map(normalizeSymbol) : [];

      const seriesList = csv?.series ?? [];
      const matchingSeries = seriesList.filter((s) => {
        const norm = normalizeSymbol(s.symbol);
        const margin = RESOLUTIONS[s.resolution as Resolution] ?? 60_000;
        const inRange = tradeTime >= s.firstTime && tradeTime <= s.lastTime + margin;
        return inRange && (norm === tradeNorm || familySymbols.includes(norm));
      });

      const matchingDatasets = (csv?.datasets ?? []).filter((d) => {
        const norm = normalizeSymbol(d.symbol);
        const dFrom = d.from ? Date.parse(d.from) : NaN;
        const dTo = d.to ? Date.parse(d.to) : NaN;
        const margin = RESOLUTIONS[d.resolution as Resolution] ?? 60_000;
        const inRange =
          !Number.isFinite(dFrom) ||
          !Number.isFinite(dTo) ||
          (tradeTime >= dFrom && tradeTime <= dTo + margin);
        return (
          inRange &&
          (norm === tradeNorm ||
            (d.compatibleSymbols ?? []).some((s) => normalizeSymbol(s) === tradeNorm) ||
            familySymbols.includes(norm))
        );
      });

      if (matchingSeries.length > 0 || matchingDatasets.length > 0) {
        const order: Record<string, number> = { "1m": 1, "3m": 2, "5m": 3, "15m": 4, "1h": 5, "4h": 6, "1d": 7 };
        const allRes = [
          ...matchingSeries.map((s) => s.resolution),
          ...matchingDatasets.map((d) => d.resolution),
        ];
        const bestRes = (allRes.sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99))[0] as Resolution) || "1m";

        autoLoadedRef.current = true;
        setProvider("market-csv");
        setSymbol(trade.symbol);
        setDataset(""); // Seamless continuous feed from database
        setResolution(bestRes);
        setConfirmed(true);

        void load({
          provider: "market-csv",
          symbol: trade.symbol,
          dataset: "", // Default to continuous database feed!
          resolution: bestRes,
          confirmed: true,
        });
      }
    }
  }, [available, saved, csv, trade, busy, result, hasCsvConfigured]);

  const availableResolutions = useMemo(() => {
    const set = new Set<Resolution>();
    if (hasCsvConfigured || provider === "market-csv") {
      const tradeNorm = normalizeSymbol(trade.symbol);
      const family = getAssetFamily(trade.symbol);
      const familySymbols = family ? family.symbols.map(normalizeSymbol) : [];

      // Check series summary from continuous database
      const seriesList = csv?.series ?? [];
      for (const s of seriesList) {
        const norm = normalizeSymbol(s.symbol);
        if (norm === tradeNorm || familySymbols.includes(norm)) {
          set.add(s.resolution as Resolution);
        }
      }

      // Check datasets
      for (const d of csv?.datasets ?? []) {
        const norm = normalizeSymbol(d.symbol);
        const symMatches =
          norm === tradeNorm ||
          (d.compatibleSymbols ?? []).some((s) => normalizeSymbol(s) === tradeNorm) ||
          familySymbols.includes(norm);
        if (symMatches) {
          set.add(d.resolution as Resolution);
        }
      }
    }
    return set;
  }, [hasCsvConfigured, provider, csv, trade]);

  const handleSelectResolution = (newRes: Resolution) => {
    const effectiveProvider = provider || result?.provider || (hasCsvConfigured ? "market-csv" : "");
    if (effectiveProvider === "market-csv" || hasCsvConfigured) {
      setProvider("market-csv");
      setResolution(newRes);
      // Keep dataset selection as an optional override only if it specifically matches newRes, else default to continuous feed
      const currentOverride = dataset ? (csv?.datasets ?? []).find((d) => d.id === dataset && d.resolution === newRes)?.id : "";
      const targetDataset = currentOverride || "";
      setDataset(targetDataset);
      void load({
        provider: "market-csv",
        symbol: symbol || trade.symbol,
        dataset: targetDataset,
        resolution: newRes,
        confirmed: false,
      });
    } else if (effectiveProvider) {
      setResolution(newRes);
      void load({
        provider: effectiveProvider,
        symbol: symbol || trade.symbol,
        dataset,
        resolution: newRes,
        confirmed: false,
      });
    }
  };

  return (
    <div className="space-y-3">
      {result && result.bars.length > 0 ? (
        <HistoricalMarketChart
          history={result}
          trade={trade}
          executions={executions}
          privacy={privacy}
          availableResolutions={availableResolutions}
          onSelectResolution={handleSelectResolution}
          onReset={invalidate}
          availableDatasets={csv?.datasets ?? []}
          currentDatasetId={dataset}
          onSelectDataset={(dsId) => {
            setDataset(dsId);
            setProvider("market-csv");
            setConfirmed(true);
            void load({
              provider: "market-csv",
              dataset: dsId,
              confirmed: true,
            });
          }}
          switchingTf={switchingTf}
          error={error}
          savedEstimate={saved?.saved}
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 sm:px-5 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-sm font-semibold tracking-tight">
                Market data & replay
              </CardTitle>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
                {trade.symbol}
              </span>
            </div>
            {saved?.saved && (
              <span className="text-[11px] font-mono text-profit font-medium">
                Saved estimates active
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {/* Primary Chart on Top */}
            <div className="p-4 sm:p-5">
              <TradeChart trade={trade} executions={executions} hideCaption />
            </div>

            {/* Unified Data & Replay Footer Section */}
            <div className="border-t border-border/40 bg-muted/15 p-4 sm:p-5 space-y-3.5">
              {/* Feature status metrics */}
              <div
                className="grid gap-3 rounded-lg border border-border/50 bg-background/60 p-3 sm:grid-cols-3"
                aria-label="Market data feature status"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Estimated MAE
                  </p>
                  <p className="mt-0.5">
                    {busy ? (
                      <span className="text-xs text-muted-foreground font-mono">
                        Loading candles…
                      </span>
                    ) : error ? (
                      <span className="text-xs text-destructive">Data request failed</span>
                    ) : saved?.saved ? (
                      <span className="text-sm font-mono font-semibold text-foreground">
                        {privacy ? "••••" : fmtMoney(saved.saved.estimate.mae!, trade.currency)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Load market data to calculate
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Estimated MFE
                  </p>
                  <p className="mt-0.5">
                    {busy ? (
                      <span className="text-xs text-muted-foreground font-mono">
                        Loading candles…
                      </span>
                    ) : error ? (
                      <span className="text-xs text-destructive">Data request failed</span>
                    ) : saved?.saved ? (
                      <span className="text-sm font-mono font-semibold text-foreground">
                        {privacy ? "••••" : fmtMoney(saved.saved.estimate.mfe!, trade.currency)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Load market data to calculate
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Trade replay
                  </p>
                  <p className="mt-0.5">
                    {busy ? (
                      <span className="text-xs text-muted-foreground font-mono">
                        Loading candles…
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Available after candles load
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Data controls & informational notes */}
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <p>
                  Price path above is plotted from recorded broker fills. To view market candles,
                  replay bar-by-bar, and calculate monetary MAE/MFE estimates for Reports, configure
                  a market data source below.
                </p>

                {connectionError && (
                  <p role="alert" className="text-sm text-destructive">
                    {connectionError}
                  </p>
                )}

                {!available.length && (
                  <p>
                    <a
                      className="underline hover:text-foreground transition-colors font-medium"
                      href="/settings#market-data"
                    >
                      Connect a market data provider in Settings
                    </a>{" "}
                    to use historical replay and estimates.
                  </p>
                )}

                {!trade.closedAt ? (
                  <p>Available after this trade closes.</p>
                ) : (
                  available.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="market-provider">Data provider</Label>
                          <OptionSelect
                            id="market-provider"
                            value={provider}
                            onValueChange={(value) => {
                              invalidate();
                              setProvider(value);
                              setDataset("");
                              setConfirmed(false);
                            }}
                          >
                            <option value="" disabled>
                              Choose a data source
                            </option>
                            {available.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </OptionSelect>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="market-symbol">Provider symbol</Label>
                          <Input
                            id="market-symbol"
                            value={symbol}
                            onChange={(event) => {
                              invalidate();
                              setSymbol(event.target.value);
                              setConfirmed(false);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="market-resolution">Candle resolution</Label>
                          <OptionSelect
                            id="market-resolution"
                            value={resolution}
                            onValueChange={(value) => {
                              invalidate();
                              setResolution(value as Resolution);
                            }}
                          >
                            {Object.keys(RESOLUTIONS).map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </OptionSelect>
                        </div>
                        {(info?.datasets ||
                          info?.mode === "csv" ||
                          info?.id === "london-strategic-edge") && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="market-dataset">
                                {info?.mode === "csv" ? "Dataset / Origem (Opcional)" : "Data feed / dataset"}
                              </Label>
                              {info?.mode === "csv" && !dataset && (
                                <span className="text-[10px] text-emerald-400 font-medium font-mono">
                                  Banco contínuo ativo
                                </span>
                              )}
                            </div>
                            {info?.mode === "csv" ? (
                              <OptionSelect
                                id="market-dataset"
                                value={dataset}
                                onValueChange={(value) => {
                                  invalidate();
                                  setDataset(value);
                                  setConfirmed(false);
                                }}
                              >
                                <option value="">Banco Contínuo de Velas (Automático · Recomendado)</option>
                                {(csv?.datasets ?? []).map((item) => (
                                  <option key={item.id} value={item.id}>
                                    Override isolado: {item.name} ({item.symbol} · {item.resolution})
                                  </option>
                                ))}
                              </OptionSelect>
                            ) : info?.datasets ? (
                              <OptionSelect
                                id="market-dataset"
                                value={dataset}
                                onValueChange={(value) => {
                                  invalidate();
                                  setDataset(value);
                                  setConfirmed(false);
                                }}
                              >
                                {info.datasets.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </OptionSelect>
                            ) : (
                              <Input
                                id="market-dataset"
                                value={dataset}
                                placeholder="Leave blank for automatic selection"
                                onChange={(event) => {
                                  invalidate();
                                  setDataset(event.target.value);
                                  setConfirmed(false);
                                }}
                              />
                            )}
                            {info?.mode === "csv" && (
                              <p className="text-[10px] text-muted-foreground">
                                Por padrão, as velas contínuas do banco são consultadas automaticamente. Selecione um arquivo apenas para forçar um lote específico.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {info?.mode === "csv"
                          ? "Consulta a série contínua no banco de dados SQLite. Velas importadas em múltiplos lotes são integradas automaticamente."
                          : `${info?.description} ${info?.symbolHint}`} Option contract history is not supported yet.
                      </p>
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          className="mt-0.5"
                          onChange={(event) => {
                            invalidate();
                            setConfirmed(event.target.checked);
                          }}
                        />
                        <span>
                          Calculate and save MAE/MFE estimates for Reports. I confirm that this
                          instrument, price adjustments and quote currency match my fills and
                          account ({trade.currency}).
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Unchecked: load candles and replay only. Checked: also calculate monetary
                        estimates and save valid results to Reports. Missing or mismatched data
                        stays unavailable.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          disabled={
                            busy ||
                            !symbol.trim() ||
                            !available.some((item) => item.id === provider) ||
                            Boolean(info?.datasets && !dataset)
                          }
                          onClick={() => void load()}
                        >
                          {busy
                            ? "Loading history…"
                            : confirmed
                              ? "Load data & save estimates"
                              : "Load candles & replay"}
                        </Button>
                        {busy && (
                          <Button variant="outline" onClick={invalidate}>
                            Cancel
                          </Button>
                        )}
                        {result && (
                          <Button variant="outline" onClick={invalidate}>
                            Show original chart
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                )}

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {result && result.bars.length === 0 && (
                  <p role="status" className="text-sm text-muted-foreground">
                    No candles were returned for this instrument and trade period. Check the symbol,
                    dataset and plan coverage.
                  </p>
                )}
                {!result && saved?.saved && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Previously saved MAE/MFE estimates are shown above. Loading candles without the
                    checkbox keeps those saved estimates; it does not calculate new ones.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toVelaTf(res: Resolution): string {
  const map: Record<Resolution, string> = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
    "1w": "W",
    "1mo": "M",
  };
  return map[res] ?? "5";
}

function fromVelaTf(tf: string): Resolution | undefined {
  const map: Record<string, Resolution> = {
    "1": "1m",
    "1m": "1m",
    "3": "3m",
    "3m": "3m",
    "5": "5m",
    "5m": "5m",
    "15": "15m",
    "15m": "15m",
    "30": "15m",
    "30m": "15m",
    "60": "1h",
    "1h": "1h",
    "240": "4h",
    "4h": "4h",
    "1D": "1d",
    "1d": "1d",
    "D": "1d",
    "1W": "1w",
    "1w": "1w",
    "W": "1w",
    "1M": "1mo",
    "1mo": "1mo",
    "M": "1mo",
  };
  return map[tf];
}

/**
 * Synchronizes Vela's left toolbar gutter to 52px to prevent canvas overlap and left-clipping.
 * In @luxalgo/vela, TOOLBAR_WIDTH defaults to 44px, whereas TradeJournal styles the toolbar to 52px.
 * This helper sets the renderer's toolbar gutter to 52px, intercepts syncToolbarGutter on the
 * drawings controllers so it preserves 52px (and 16px when collapsed), sets --vela-toolbar-gutter: 52px
 * on the host container, and triggers syncSize() to recalculate canvas bounds.
 */
export function syncVelaToolbarGutter(instance: any, container?: HTMLElement | null): void {
  if (!instance) return;

  const renderer = (instance.renderer as any)?.renderer || instance.renderer;

  if (renderer?.setToolbarGutter) {
    renderer.setToolbarGutter(52);
  }

  const drawings = instance.drawings;
  if (drawings && typeof drawings.syncToolbarGutter === "function") {
    drawings.syncToolbarGutter = () => {
      const shown = drawings.toolbarVisible && !drawings.mobileLayout;
      const gutter = shown ? (drawings.toolbarCollapsed ? 16 : 52) : 0;
      renderer?.setToolbarGutter?.(gutter);
    };
    drawings.syncToolbarGutter();
  }

  const userDrawings = renderer?.userDrawings || (instance.renderer as any)?.userDrawings;
  if (userDrawings && typeof userDrawings.syncToolbarGutter === "function") {
    userDrawings.syncToolbarGutter = () => {
      const shown = userDrawings.toolbarVisible && !userDrawings.mobileLayout;
      const gutter = shown ? (userDrawings.toolbarCollapsed ? 16 : 52) : 0;
      renderer?.setToolbarGutter?.(gutter);
    };
    userDrawings.syncToolbarGutter();
  }

  if (container) {
    container.style.setProperty("--vela-toolbar-gutter", "52px");
  }

  // Explicitly align plot left immediately so layout is guaranteed 52px before any deferred resize
  if (renderer?.plot) {
    renderer.plot.style.left = "52px";
  }

  renderer?.syncSize?.();
  (instance.renderer as any)?.syncSize?.();
}

export interface VelaSidePanelsController {
  objectTree: any;
  dataWindow: any;
  openId: () => "objects" | "dataWindow" | null;
  toggle: (id: "objects" | "dataWindow", open?: boolean) => void;
  close: () => void;
  setSymbol: (symbol: string) => void;
  refresh?: () => void;
  onChart: (instance: any) => void;
  destroy: () => void;
}

export function setupVelaSidePanels({
  panelContainer,
  chartInstance,
  symbol,
  resolveIcon,
  onOpenChange,
  ObjectTreeClass,
  DataWindowClass,
}: {
  panelContainer: HTMLElement;
  chartInstance?: any;
  symbol: string;
  resolveIcon?: (sym: string) => string | undefined;
  onOpenChange?: (activeId: "objects" | "dataWindow" | null) => void;
  ObjectTreeClass?: any;
  DataWindowClass?: any;
}): VelaSidePanelsController {
  let activeId: "objects" | "dataWindow" | null = null;
  let currentChart = chartInstance ?? null;

  const OT = ObjectTreeClass;
  const DW = DataWindowClass;

  const objectTree = new OT(panelContainer, resolveIcon);
  objectTree.setSymbol?.(symbol);
  if (currentChart) objectTree.onChart?.(currentChart);

  const dataWindow = new DW(panelContainer);
  if (currentChart) dataWindow.onChart?.(currentChart);

  let syncRaf: number | null = null;
  const sync = () => {
    currentChart?.renderer?.syncSize?.();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      if (syncRaf !== null) {
        window.cancelAnimationFrame(syncRaf);
      }
      syncRaf = window.requestAnimationFrame(() => {
        syncRaf = null;
        currentChart?.renderer?.syncSize?.();
      });
    }
  };

  objectTree.onOpenChange = (open: boolean) => {
    if (open) {
      dataWindow?.toggle?.(false, true);
      activeId = "objects";
    } else if (activeId === "objects") {
      activeId = null;
    }
    onOpenChange?.(activeId);
    sync();
  };

  dataWindow.onOpenChange = (open: boolean) => {
    if (open) {
      objectTree?.toggle?.(false, true);
      activeId = "dataWindow";
    } else if (activeId === "dataWindow") {
      activeId = null;
    }
    onOpenChange?.(activeId);
    sync();
  };

  return {
    objectTree,
    dataWindow,
    openId: () => activeId,
    toggle: (id: "objects" | "dataWindow", open?: boolean) => {
      const willOpen = open !== undefined ? open : activeId !== id;
      if (id === "objects") {
        if (willOpen) {
          dataWindow?.toggle?.(false, true);
          objectTree?.toggle?.(true);
        } else {
          objectTree?.toggle?.(false);
        }
      } else {
        if (willOpen) {
          objectTree?.toggle?.(false, true);
          dataWindow?.toggle?.(true);
        } else {
          dataWindow?.toggle?.(false);
        }
      }
    },
    close: () => {
      objectTree?.toggle?.(false, true);
      dataWindow?.toggle?.(false, true);
      activeId = null;
      onOpenChange?.(null);
      sync();
    },
    setSymbol: (newSymbol: string) => {
      objectTree?.setSymbol?.(newSymbol);
      objectTree?.refresh?.();
    },
    refresh: () => {
      objectTree?.refresh?.();
    },
    onChart: (inst: any) => {
      currentChart = inst;
      objectTree?.onChart?.(inst);
      dataWindow?.onChart?.(inst);
    },
    destroy: () => {
      if (syncRaf !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(syncRaf);
        syncRaf = null;
      }
      try {
        objectTree?.destroy?.();
      } catch {}
      try {
        dataWindow?.destroy?.();
      } catch {}
      activeId = null;
      onOpenChange?.(null);
      currentChart = null;
    },
  };
}

function HistoricalMarketChart({
  history,
  trade,
  executions,
  privacy,
  availableResolutions,
  onSelectResolution,
  onReset,
  availableDatasets = [],
  currentDatasetId = "",
  onSelectDataset,
  switchingTf,
  error,
  savedEstimate,
}: {
  history: TradeMarketResult;
  trade: ChartTrade & { currency: string };
  executions: ChartExecution[];
  privacy: boolean;
  availableResolutions: Set<Resolution>;
  onSelectResolution: (resolution: Resolution) => void;
  onReset?: () => void;
  availableDatasets?: MarketCsvDataset[];
  currentDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  switchingTf?: Resolution | null;
  error?: string;
  savedEstimate?: {
    estimate: ExcursionEstimate & { datasetId?: string };
    provider?: string;
    symbol?: string;
    resolution?: Resolution;
    fetchedAt?: string;
  } | null;
}) {
  const isSavedCanonical = Boolean(
    savedEstimate?.estimate?.mae !== null &&
    savedEstimate?.estimate?.mae !== undefined &&
    savedEstimate?.resolution
  );
  const canonicalEstimate = isSavedCanonical ? savedEstimate!.estimate : history.estimate;
  const canonicalResolution = isSavedCanonical ? savedEstimate!.resolution : history.resolution;

  const frame = useMemo(
    () => ({
      bars: history.bars,
      through: Infinity,
      fills: history.estimate.priceBasisMismatch ? [] : executions,
    }),
    [history, executions],
  );

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive animate-in fade-in duration-150"
        >
          <span>{error}</span>
        </div>
      )}
      {privacy ? (
        <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-xs">
          Historical prices and excursion amounts are hidden in privacy mode.
        </div>
      ) : (
        <>
          {history.estimate.priceBasisMismatch && (
            <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
              The market candles and recorded fill prices do not match. Showing market
              prices; fill labels and MAE/MFE estimates are withheld. See the data limits below.
            </p>
          )}
          <MarketCandlesChart
            history={history}
            tradeKey={trade.key}
            initialDrawingsJson={(trade as any).drawingsJson ?? null}
            executions={executions}
            nextFrame={frame}
            availableResolutions={availableResolutions}
            onSelectResolution={onSelectResolution}
            onReset={onReset}
            availableDatasets={availableDatasets}
            currentDatasetId={currentDatasetId}
            onSelectDataset={onSelectDataset}
            switchingTf={switchingTf}
          />
        </>
      )}

      {/* MAE / MFE Excursion Cards */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/15">
        <div>
          <p className="text-xs text-muted-foreground">
            Estimated MAE · adverse ({canonicalResolution})
          </p>
          <p className="font-mono font-semibold text-sm">
            {privacy
              ? "••••"
              : canonicalEstimate.mae === null
                ? "Unavailable"
                : fmtMoney(canonicalEstimate.mae, trade.currency).replace(/^\+/, "")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Estimated MFE · favorable ({canonicalResolution})
          </p>
          <p className="font-mono font-semibold text-sm">
            {privacy
              ? "••••"
              : canonicalEstimate.mfe === null
                ? "Unavailable"
                : fmtMoney(canonicalEstimate.mfe, trade.currency).replace(/^\+/, "")}
          </p>
        </div>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground transition-colors">
          Data coverage & estimate limits
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {[...history.warnings, ...history.estimate.warnings].map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function MarketCandlesChart({
  history,
  tradeKey,
  initialDrawingsJson,
  executions = [],
  nextFrame,
  initialPriceStyle = "candles",
  availableResolutions,
  onSelectResolution,
  onReset,
  availableDatasets = [],
  currentDatasetId = "",
  onSelectDataset,
  switchingTf,
}: {
  history: TradeMarketResult;
  tradeKey?: string;
  initialDrawingsJson?: string | null;
  executions?: ChartExecution[];
  nextFrame: { bars: TradeMarketResult["bars"]; fills: ChartExecution[] };
  initialPriceStyle?: string;
  availableResolutions?: Set<Resolution>;
  onSelectResolution?: (resolution: Resolution) => void;
  onReset?: () => void;
  availableDatasets?: MarketCsvDataset[];
  currentDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  switchingTf?: Resolution | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const topbarHost = useRef<HTMLDivElement>(null);
  const bottombarHost = useRef<HTMLDivElement>(null);
  const panelDockHost = useRef<HTMLDivElement>(null);
  const sideRailHost = useRef<HTMLElement>(null);
  const chart = useRef<Vela | null>(null);
  const topbarRef = useRef<any>(null);
  const statuslineRef = useRef<any>(null);
  const watermarkRef = useRef<any>(null);
  const sidePanelsDockRef = useRef<VelaSidePanelsController | null>(null);
  const screenshotMenuControllerRef = useRef<ScreenshotMenuController | null>(null);
  const isInitializedRef = useRef(false);
  const isApplyingProgrammaticTfRef = useRef(false);
  const hotSwapSeqRef = useRef(0);

  const frame = useRef(nextFrame);
  const latest = useRef(nextFrame);
  latest.current = nextFrame;
  const historyRef = useRef(history);
  historyRef.current = history;
  const tradeKeyRef = useRef(tradeKey);
  tradeKeyRef.current = tradeKey;
  const initialDrawingsJsonRef = useRef(initialDrawingsJson);
  initialDrawingsJsonRef.current = initialDrawingsJson;
  const drawingsPersistenceCleanupRef = useRef<(() => void) | null>(null);
  const lastAttachedTradeKeyRef = useRef<string | null>(null);
  const executionsRef = useRef(executions);
  executionsRef.current = executions;
  const availableResolutionsRef = useRef(availableResolutions);
  availableResolutionsRef.current = availableResolutions;
  const onSelectResolutionRef = useRef(onSelectResolution);
  onSelectResolutionRef.current = onSelectResolution;

  const update = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<"objects" | "dataWindow" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("symbol");

  const allVelaTimeframes = useMemo(
    () => ["1", "3", "5", "15", "60", "240", "D", "W", "M"],
    [],
  );

  // Mount effect: instantiates Vela and widgets ONCE per [history.symbol, initialPriceStyle]
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setError("");

    void (async () => {
      const [
        {
          Vela,
          registerNativeIndicator,
          unregisterNativeIndicator,
          DARK_THEME,
          LIGHT_THEME,
          getDrawingType,
        },
        { Statusline, Watermark, ChartContextMenu, Topbar, Bottombar, ObjectTree, DataWindow },
      ] = await Promise.all([
        import("@luxalgo/vela"),
        import("@luxalgo/vela/widget"),
      ]);

      if (disposed || !host.current) return;

      const initialHistory = historyRef.current;
      const initialExecutions = executionsRef.current;

      frame.current = {
        bars: initialHistory.bars,
        fills: initialHistory.estimate.priceBasisMismatch ? [] : initialExecutions,
      };

      const type = `replay-fills-${crypto.randomUUID()}`;
      registerNativeIndicator({
        type,
        title: "Recorded fills",
        paneHint: "price",
        overlay: true,
        inputsSchema: () => [],
        defaultInputs: () => ({}),
        create: () => ({
          start(ctx) {
            ctx.emit({
              labels: frame.current.fills.map((fill, index) => ({
                id: `fill-${index}`,
                paneId: "price",
                xloc: "bar_time" as const,
                x: Date.parse(fill.executedAt),
                y: fill.price,
                yloc: "price" as const,
                text: `${fill.side.toUpperCase()} ${fill.quantity}`,
                style: "label_left" as const,
                color: fill.side === "buy" ? "#087f23" : "#bd2626",
                textColor: "#ffffff",
                size: "small" as const,
                textAlign: "center" as const,
                fontFamily: "default" as const,
                overlay: true,
              })),
            });
            ctx.setStatus("idle");
          },
          onBars() {},
          onViewport() {},
          setInputs() {},
          suspend() {},
          resume() {},
          stop() {},
        }),
      });

      const dark = () => document.documentElement.classList.contains("dark");
      const getChartTheme = () => ({
        ...((dark() ? DARK_THEME : LIGHT_THEME) || {}),
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      });
      const instance = new Vela(host.current, {
        symbol: initialHistory.symbol,
        timeframe: toVelaTf(initialHistory.resolution),
        data: frame.current.bars,
        live: false,
        height: 700,
        theme: getChartTheme(),
        priceStyle: initialPriceStyle,
        volume: true,
        drawings: true,
      });

      chart.current = instance;
      instance.addNativeIndicator(type);

      // Fix 8px Overlap / Canvas Left-Clipping: synchronize 52px toolbar gutter (ADR-003)
      syncVelaToolbarGutter(instance, host.current);

      // Context Menu & Renderer Settings Interception (ADR-001)
      const handleOpenSettings = (section?: string) => {
        const targetTab = mapSettingsSectionToTab(section);
        setSettingsInitialTab(targetTab);
        setSettingsOpen(true);
      };

      instance.renderer.openSettings = (section?: string) => {
        handleOpenSettings(section);
        return instance.renderer;
      };

      if ((instance.renderer as any)?.renderer) {
        (instance.renderer as any).renderer.openSettingsDialog = instance.renderer.openSettings;
        (instance.renderer as any).renderer.settingsEnabled = false;
        try {
          (instance.renderer as any).renderer.settingsDialog?.close?.();
        } catch {}
      }

      // 1. Vela Native Topbar Widget
      let topbar: any = null;
      let cleanupTfp: (() => void) | null = null;
      let cleanupStylePicker: (() => void) | null = null;
      let cleanupChromeHoverTop: (() => void) | null = null;
      let screenshotMenuController: ScreenshotMenuController | null = null;
      let cleanupScreenshotMenu: (() => void) | null = null;
      if (topbarHost.current) {
        const loadFavs = (): string[] => {
          try {
            const raw = localStorage.getItem("vela_tf_favorites");
            if (raw) {
              const p = JSON.parse(raw);
              if (Array.isArray(p) && p.length > 0) return p;
            }
          } catch {}
          return ["1", "5"];
        };
        const saveFavs = (f: string[]) => {
          try {
            localStorage.setItem("vela_tf_favorites", JSON.stringify(f));
          } catch {}
        };

        const defaultFavs = loadFavs();
        let currentFavs = defaultFavs;
        topbar = new Topbar(topbarHost.current, {
          symbol: initialHistory.symbol,
          timeframe: toVelaTf(initialHistory.resolution),
          timeframes: allVelaTimeframes,
          timeframeFavorites: defaultFavs,
          priceStyle: initialPriceStyle,
          composition: {
            left: ["symbol", "timeframes", "style", "undo-redo"],
            right: [],
          },
          onTimeframe: (tf: string) => {
            if (isApplyingProgrammaticTfRef.current) return;
            const res = fromVelaTf(tf);
            if (res) {
              onSelectResolutionRef.current?.(res);
            }
          },
          onTimeframeFavorite: (tf: string, on: boolean) => {
            if (on) {
              if (!currentFavs.includes(tf)) currentFavs = [...currentFavs, tf];
            } else {
              currentFavs = currentFavs.filter((f) => f !== tf);
            }
            saveFavs(currentFavs);
            topbar?.setTimeframeFavorites(currentFavs);
          },
          onPriceStyle: (style: string) => {
            instance.renderer.set("priceStyle", style);
            topbar?.setPriceStyle(style);
          },
          onIndicatorsClick: () => {
            setSettingsInitialTab("status-line");
            setSettingsOpen(true);
          },
          onUndoClick: () => {
            instance.drawings.undo();
          },
          onRedoClick: () => {
            instance.drawings.redo();
          },
        });

        cleanupTfp = attachVelaTimeframePicker({
          container: topbarHost.current,
          currentTimeframe: toVelaTf(initialHistory.resolution),
          getCurrentTimeframe: () => toVelaTf(historyRef.current.resolution),
          timeframeFavorites: currentFavs,
          availableTimeframes: new Set(allVelaTimeframes),
          onSelectTimeframe: (tf: string) => {
            const res = fromVelaTf(tf);
            if (res) {
              onSelectResolutionRef.current?.(res);
            }
          },
          onFavoritesChange: (favs: string[]) => {
            currentFavs = favs;
            saveFavs(favs);
            topbar?.setTimeframeFavorites(favs);
          },
        });

        if (topbar?.styleMenu) {
          try {
            topbar.styleMenu.destroy();
          } catch {}
        }

        cleanupStylePicker = attachVelaStylePicker({
          container: topbarHost.current,
          currentStyle: initialPriceStyle,
          onSelectStyle: (style: string) => {
            instance.renderer.set("priceStyle", style);
            topbar?.setPriceStyle(style);
          },
        });

        cleanupChromeHoverTop = enhanceVelaChromeHover(topbarHost.current);

        screenshotMenuController = attachVelaScreenshotMenu({
          topbarContainer: topbarHost.current,
          chartContainer: host.current,
          getChartInstance: () => chart.current,
          getSymbol: () => historyRef.current.symbol,
          getResolution: () => historyRef.current.resolution,
        });
        screenshotMenuControllerRef.current = screenshotMenuController;
        cleanupScreenshotMenu = () => {
          screenshotMenuController?.destroy();
          screenshotMenuControllerRef.current = null;
        };
      }
      topbarRef.current = topbar;

      // 2. Vela Native Bottombar Widget
      let bottombar: any = null;
      let cleanupChromeHoverBottom: (() => void) | null = null;
      if (bottombarHost.current) {
        bottombar = new Bottombar(bottombarHost.current, {
          timezone: String(instance.renderer.get("timezone") ?? "Etc/UTC"),
          onTimezone: (zone: string) => {
            instance.renderer.set("timezone", zone);
          },
          onRange: (preset: { id: string; preset: any }) => {
            instance.setVisibleRangePreset(preset.preset);
          },
          onSettingsClick: () => {
            setSettingsInitialTab("symbol");
            setSettingsOpen(true);
          },
        });

        const tzPositioning = (bottombar as any)?.tzMenu?.root?.ctrl?.props?.positioning;
        if (tzPositioning && typeof tzPositioning === "object") {
          tzPositioning.listeners = false;
          tzPositioning.flip = false;
          tzPositioning.slide = false;
          delete tzPositioning.getAnchorRect;
        }

        cleanupChromeHoverBottom = enhanceVelaChromeHover(bottombarHost.current);

        // Customize settings button icon to Sliders (print_20261009_225234.png)
        const bbSettingsBtn = bottombarHost.current.querySelector(".vela-bb-settings");
        if (bbSettingsBtn) {
          const iconSpan = bbSettingsBtn.querySelector(".vela-icon") || bbSettingsBtn;
          iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>`;
        }
      }

      // 3. Vela Native Statusline Widget
      const resolveIcon = (sym: string): string | undefined => {
        try {
          return getAssetIconConfig(sym).icons[0];
        } catch {
          return undefined;
        }
      };
      const statusline = new Statusline(host.current, initialHistory.symbol, resolveIcon);
      const initialProviderLabel =
        initialHistory.provider === "market-csv" || initialHistory.provider?.toLowerCase().includes("csv")
          ? "CSV"
          : initialHistory.provider;
      statusline.setMeta(toVelaTf(initialHistory.resolution), initialProviderLabel);
      statusline.onChart(instance);
      if (frame.current.bars.length > 0) {
        (statusline as any).lastBar = frame.current.bars[frame.current.bars.length - 1];
        (statusline as any).render?.();
      }
      statusline.attachMenu({
        setPart: (part, visible) => statusline.setPartVisible(part, visible),
        chartVisible: () => instance.renderer.get("candleVisible") !== false,
        setChartVisible: (visible) => instance.renderer.set("candleVisible", visible),
      });
      statuslineRef.current = statusline;

      // 4. Vela Native Watermark Widget
      const watermark = new Watermark(host.current, initialHistory.symbol, toVelaTf(initialHistory.resolution));
      watermark.setLoading(false);
      watermarkRef.current = watermark;

      // 5. Vela Native Context Menu
      let lastCrosshair: { price: number | null; decimals: number; time: number | null } = {
        price: null,
        decimals: 2,
        time: null,
      };

      instance.renderer.onCrosshairMove((e: any) => {
        if (e && typeof e.price === "number") {
          let decimals = 2;
          if (e.ohlc) {
            let maxDec = 0;
            for (const val of [e.ohlc.open, e.ohlc.high, e.ohlc.low, e.ohlc.close]) {
              if (typeof val === "number") {
                const s = String(Number(val.toPrecision(12)));
                if (!s.includes("e")) {
                  const dot = s.indexOf(".");
                  if (dot >= 0) maxDec = Math.max(maxDec, s.length - dot - 1);
                }
              }
            }
            decimals = Math.min(maxDec, 8);
          }
          lastCrosshair = { price: e.price, decimals, time: e.time ?? null };
        }
      });

      const onContextMenuCapture = (_e: MouseEvent) => {
        // Keeps pointer synced on right-click moment
      };
      host.current.addEventListener("contextmenu", onContextMenuCapture, true);

      // Register Copy Price Action
      const getActivePointer = () => {
        if (lastCrosshair.price !== null) return lastCrosshair;
        const lastBar = frame.current.bars.at(-1);
        if (lastBar && typeof lastBar.close === "number") {
          return { price: lastBar.close, decimals: 2, time: lastBar.time };
        }
        return null;
      };
      const unregisterCopyPrice = registerCopyPriceAction(getActivePointer);

      const contextMenu = new ChartContextMenu(host.current, {
        getContext: () => ({
          chart: instance,
          symbol: initialHistory.symbol,
          timeframe: toVelaTf(initialHistory.resolution),
          priceStyle: initialPriceStyle,
          setSymbol: () => {},
          setTimeframe: (tf: string) => instance.setMarket({ timeframe: tf }),
          setPriceStyle: (style: string) => instance.renderer.set("priceStyle", style),
          openSymbolSearch: () => {},
          togglePanel: () => {},
          dockStrip: () => () => {},
          host: host.current!,
          toast: (msg: string, kind?: "info" | "success" | "error") => {
            showVelaToast(msg, kind, host.current);
          },
          addIndicator: () => {},
          addNativeIndicator: () => {},
          stateChanged: () => {},
          pointer: {
            price: getActivePointer()?.price ?? null,
            decimals: getActivePointer()?.decimals ?? 2,
            time: getActivePointer()?.time ?? null,
            paneKind: "price",
          },
        } as any),
        resetView: () => {
          instance.renderer.set("autoScale", true);
          if (typeof (instance.renderer as any).resetView === "function") {
            (instance.renderer as any).resetView();
          } else {
            instance.setVisibleRangePreset("ALL");
          }
        },
        timezone: () => String(instance.renderer.get("timezone") ?? "Etc/UTC"),
        setTimezone: (zone) => instance.renderer.set("timezone", zone),
      });
      contextMenu.onChart(instance);

      const cleanupContextMenu = enhanceVelaContextMenu(
        host.current,
        contextMenu,
        () => lastCrosshair,
      );

      // Hydrate live chart with persisted settings on mount
      try {
        const stored = loadStoredSettings();
        applyStoredSettingsToChart(instance, statusline, watermark, stored);
      } catch {}

      // 6. Vela Native Drawing Toolbar Enhancer
      const cleanupDrawingEnhancer = enhanceVelaDrawingToolbar(host.current);

      // 7. Vela Native Side Panels (ObjectTree & DataWindow) Dock
      let sidePanelsDock: VelaSidePanelsController | null = null;
      if (panelDockHost.current) {
        sidePanelsDock = setupVelaSidePanels({
          panelContainer: panelDockHost.current,
          chartInstance: instance,
          symbol: initialHistory.symbol,
          resolveIcon,
          onOpenChange: (active) => setActivePanel(active),
          ObjectTreeClass: ObjectTree,
          DataWindowClass: DataWindow,
        });
        sidePanelsDockRef.current = sidePanelsDock;
      }

      // 8. Drawings Persistence & Favorite Tools Toolbar
      const currentTradeKey = tradeKeyRef.current || initialHistory.symbol;
      const cleanupDrawingsPersistence = attachVelaDrawingsPersistence(
        instance,
        currentTradeKey,
        {
          initialDrawingsJson: initialDrawingsJsonRef.current,
          onDrawingsRestored: () => {
            sidePanelsDock?.refresh?.();
          },
        },
      );
      drawingsPersistenceCleanupRef.current = cleanupDrawingsPersistence;
      lastAttachedTradeKeyRef.current = currentTradeKey;

      let cleanupFavToolbar: (() => void) | null = null;
      const attachFavToolbar = (drawingEnhancerMod as any).attachVelaFavoriteToolbar;
      if (typeof attachFavToolbar === "function") {
        try {
          cleanupFavToolbar = attachFavToolbar(instance, host.current, {
            resolveToolMeta: (t: string) => getDrawingType?.(t),
          });
        } catch {}
      }

      const cleanupSideRail = sideRailHost.current
        ? enhanceVelaSideRail(sideRailHost.current)
        : null;

      let updating = false;
      const flush = async () => {
        if (updating || disposed) return;
        updating = true;
        try {
          do {
            frame.current = latest.current;
            await instance.setMarket({ data: frame.current.bars });
          } while (!disposed && frame.current !== latest.current);
        } catch {
          if (!disposed) setError("The replay chart could not be updated.");
        } finally {
          updating = false;
        }
      };

      update.current = () => {
        void flush();
      };

      const observer = new MutationObserver(() => instance.setTheme(getChartTheme()));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      isInitializedRef.current = true;

      // If resolution changed while async mount was in flight, trigger hot-swap sync immediately
      if (
        historyRef.current.resolution !== initialHistory.resolution ||
        historyRef.current.bars !== initialHistory.bars
      ) {
        void (async () => {
          const cur = historyRef.current;
          const curExecs = executionsRef.current;
          frame.current = {
            bars: cur.bars,
            fills: cur.estimate.priceBasisMismatch ? [] : curExecs,
          };
          await instance.setMarket({
            timeframe: toVelaTf(cur.resolution),
            data: cur.bars,
          });
          if (topbarRef.current) {
            isApplyingProgrammaticTfRef.current = true;
            try {
              topbarRef.current.setTimeframe(toVelaTf(cur.resolution));
            } finally {
              isApplyingProgrammaticTfRef.current = false;
            }
          }
          const pLabel =
            cur.provider === "market-csv" || cur.provider?.toLowerCase().includes("csv")
              ? "CSV"
              : cur.provider;
          statuslineRef.current?.setMeta(toVelaTf(cur.resolution), pLabel);
          if (cur.bars.length > 0) {
            (statuslineRef.current as any).lastBar = cur.bars[cur.bars.length - 1];
            (statuslineRef.current as any).render?.();
          }
          watermarkRef.current?.update(cur.symbol, toVelaTf(cur.resolution));
          (watermarkRef.current as any)?.sync?.();
          watermarkRef.current?.setLoading(false);
          sidePanelsDockRef.current?.setSymbol(cur.symbol);
          instance.renderer.set("autoScale", true);
        })();
      }

      cleanup = () => {
        isInitializedRef.current = false;
        update.current = null;
        observer.disconnect();
        drawingsPersistenceCleanupRef.current?.();
        drawingsPersistenceCleanupRef.current = null;
        lastAttachedTradeKeyRef.current = null;
        cleanupFavToolbar?.();
        cleanupDrawingEnhancer();
        cleanupContextMenu?.();
        unregisterCopyPrice?.();
        host.current?.removeEventListener("contextmenu", onContextMenuCapture, true);
        cleanupTfp?.();
        cleanupStylePicker?.();
        cleanupScreenshotMenu?.();
        cleanupChromeHoverTop?.();
        cleanupChromeHoverBottom?.();
        cleanupSideRail?.();
        sidePanelsDock?.destroy();
        sidePanelsDockRef.current = null;
        setActivePanel(null);
        screenshotMenuControllerRef.current = null;
        topbar?.destroy();
        bottombar?.destroy();
        statusline.destroy();
        watermark.destroy();
        contextMenu.destroy();
        instance.destroy();
        unregisterNativeIndicator(type);
        if (chart.current === instance) chart.current = null;
        topbarRef.current = null;
        statuslineRef.current = null;
        watermarkRef.current = null;
      };
    })().catch(() => {
      if (!disposed) setError("The historical chart could not be rendered.");
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [history.symbol, initialPriceStyle, allVelaTimeframes]);

  // Re-attach drawings persistence if tradeKey changes while mounted (e.g. switching trades of same symbol)
  useEffect(() => {
    if (!chart.current || !isInitializedRef.current) return;
    const targetKey = tradeKey || historyRef.current.symbol;
    if (lastAttachedTradeKeyRef.current === targetKey) return;
    lastAttachedTradeKeyRef.current = targetKey;

    drawingsPersistenceCleanupRef.current?.();
    drawingsPersistenceCleanupRef.current = attachVelaDrawingsPersistence(
      chart.current,
      targetKey,
      {
        initialDrawingsJson,
        onDrawingsRestored: () => {
          sidePanelsDockRef.current?.refresh?.();
        },
      },
    );
    sidePanelsDockRef.current?.refresh?.();

    return () => {
      drawingsPersistenceCleanupRef.current?.();
      drawingsPersistenceCleanupRef.current = null;
      lastAttachedTradeKeyRef.current = null;
    };
  }, [tradeKey, initialDrawingsJson]);

  // Hot-swap effect (triggered on [history, executions])
  useEffect(() => {
    if (!chart.current || !isInitializedRef.current) return;

    let disposed = false;
    const seq = ++hotSwapSeqRef.current;

    void (async () => {
      try {
        const instance = chart.current;
        if (!instance) return;

        // 1. Update frame fills before setMarket so indicators re-emit cleanly
        frame.current = {
          bars: history.bars,
          fills: history.estimate.priceBasisMismatch ? [] : executions,
        };

        // 2. Hot-swap market candles in-place on existing WebGL canvas
        await instance.setMarket({
          timeframe: toVelaTf(history.resolution),
          data: history.bars,
        });

        if (disposed || seq !== hotSwapSeqRef.current) return;

        // 3. Update topbar timeframe with guard against synthetic event echo
        if (topbarRef.current) {
          isApplyingProgrammaticTfRef.current = true;
          try {
            topbarRef.current.setTimeframe(toVelaTf(history.resolution));
          } finally {
            isApplyingProgrammaticTfRef.current = false;
          }
        }

        // 4. Update statusline meta
        const providerLabel =
          history.provider === "market-csv" || history.provider?.toLowerCase().includes("csv")
            ? "CSV"
            : history.provider;
        statuslineRef.current?.setMeta(toVelaTf(history.resolution), providerLabel);
        if (history.bars.length > 0) {
          (statuslineRef.current as any).lastBar = history.bars[history.bars.length - 1];
          (statuslineRef.current as any).render?.();
        }

        // 5. Update watermark
        watermarkRef.current?.update(history.symbol, toVelaTf(history.resolution));
        (watermarkRef.current as any)?.sync?.();
        watermarkRef.current?.setLoading(false);
        sidePanelsDockRef.current?.setSymbol(history.symbol);

        // 6. Recalculate autoScale viewport
        instance.renderer.set("autoScale", true);
      } catch {
        if (!disposed && seq === hotSwapSeqRef.current) {
          setError("The historical chart could not be updated.");
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [history, executions]);

  // Sync watermark loading state and rollback topbar on failed/cancelled hot-swap
  useEffect(() => {
    watermarkRef.current?.setLoading(Boolean(switchingTf));
    if (!switchingTf && topbarRef.current) {
      isApplyingProgrammaticTfRef.current = true;
      try {
        topbarRef.current.setTimeframe(toVelaTf(history.resolution));
      } finally {
        isApplyingProgrammaticTfRef.current = false;
      }
    }
  }, [switchingTf, history.resolution]);

  useEffect(() => {
    update.current?.();
  }, [nextFrame]);

  const handleToggleObjectTree = () => {
    sidePanelsDockRef.current?.toggle("objects");
  };

  const handleToggleDataWindow = () => {
    sidePanelsDockRef.current?.toggle("dataWindow");
  };

  const handleScreenshot = () => {
    if (screenshotMenuControllerRef.current) {
      screenshotMenuControllerRef.current.toggle();
    } else if (host.current) {
      const canvases = host.current.querySelectorAll("canvas");
      const first = canvases[0];
      if (!first) return;
      const out = document.createElement("canvas");
      out.width = first.width;
      out.height = first.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      canvases.forEach((c) => {
        ctx.drawImage(c, 0, 0);
      });
      const a = document.createElement("a");
      const curH = historyRef.current;
      a.download = `${curH.symbol}_${curH.resolution}_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = out.toDataURL("image/png");
      a.click();
    }
  };

  return (
    <div className="relative rounded-xl border border-[var(--vela-border)] bg-[#151619] overflow-hidden shadow-xs vela-ui quant-chart-chrome flex flex-row">
      {error && (
        <p role="alert" className="absolute top-0 left-0 right-0 z-50 text-sm text-destructive p-3 bg-[#151619]/90 border-b border-destructive/30">
          {error}
        </p>
      )}

      {/* Main Chart Column: Topbar, Canvas + Panel Dock, Bottombar */}
      <div className="flex flex-col min-w-0 flex-1 h-full">
        {/* Topbar row: Native Vela Topbar */}
        <div className="flex items-center border-b border-[var(--vela-border)] bg-[#151619] min-h-[39px]">
          <div ref={topbarHost} className="w-full bg-[#151619]" />
        </div>

        {/* Subtle in-place progress indicator for hot-swap without layout shift */}
        {switchingTf && (
          <div
            role="progressbar"
            aria-label={`Switching timeframe to ${switchingTf}`}
            className="absolute top-[39px] left-0 right-0 z-30 h-[2px] overflow-hidden bg-transparent pointer-events-none"
          >
            <div className="h-full w-1/3 bg-brand/80 rounded-full vela-hot-swap-progress" />
          </div>
        )}

        {/* Relative Canvas Area & Side Panel Dock Row */}
        <div className="relative flex flex-row flex-1 h-[700px] min-h-[700px] w-full bg-[#151619] overflow-hidden">
          {/* Relative Canvas Area */}
          <div ref={host} className="relative h-[700px] min-h-[700px] flex-1 min-w-0 bg-[#151619]" />

          {/* Dock Host for ObjectTree and DataWindow */}
          <div ref={panelDockHost} className="relative flex flex-row self-stretch shrink-0" />
        </div>

        {/* Bottombar row: Native Vela Bottombar */}
        <div ref={bottombarHost} className="w-full shrink-0 bg-[#151619] h-[39px]" />
      </div>

      {/* Right Sidebar Rail matching official Vela 1:1 (print_20261009_232822.png & print_20261009_232839.png) */}
      <nav ref={sideRailHost} aria-label="Panels" className="quant-side-rail">
        {/* Top Cap with Screenshot */}
        <div className="quant-side-rail-cap">
          <button
            type="button"
            aria-label="Screenshot"
            className="quant-side-rail-corner"
            onClick={handleScreenshot}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="shrink-0 size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.5h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
              <circle cx="12" cy="12.75" r="3.25" />
            </svg>
          </button>
        </div>

        {/* Rail Body */}
        <div className="quant-side-rail-body">
          <div className="quant-side-rail-end quant-side-rail-foot mt-auto">
            <div className="quant-side-rail-group">
              {/* Object tree button */}
              <button
                type="button"
                aria-label="Object tree"
                aria-pressed={activePanel === "objects" ? "true" : "false"}
                data-rail-item="dock-objects"
                data-open={activePanel === "objects" ? "1" : undefined}
                className="quant-side-rail-row"
                onClick={handleToggleObjectTree}
              >
                <span className="quant-side-rail-tile">
                  <span className="quant-side-rail-icon">
                    <span aria-hidden="true" className="quant-side-rail-vela-icon">
                      <span className="vela-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 16 16"
                          width="1em"
                          height="1em"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M8 1.8 14 5 8 8.2 2 5z" />
                          <path d="M2 8l6 3.2L14 8" opacity="0.7" />
                          <path d="M2 11l6 3.2 6-3.2" opacity="0.4" />
                        </svg>
                      </span>
                    </span>
                  </span>
                </span>
              </button>

              {/* Data window button */}
              <button
                type="button"
                aria-label="Data window"
                aria-pressed={activePanel === "dataWindow" ? "true" : "false"}
                data-rail-item="dock-dataWindow"
                data-open={activePanel === "dataWindow" ? "1" : undefined}
                className="quant-side-rail-row"
                onClick={handleToggleDataWindow}
              >
                <span className="quant-side-rail-tile">
                  <span className="quant-side-rail-icon">
                    <span aria-hidden="true" className="quant-side-rail-vela-icon">
                      <span className="vela-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 16 16"
                          width="1em"
                          height="1em"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5" />
                          <path d="M4.5 5.5h4M4.5 8h7M4.5 10.5h5.5" />
                        </svg>
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Cap with Chart Settings */}
        <div className="quant-side-rail-cap quant-side-rail-cap-foot">
          <button
            type="button"
            aria-label="Chart settings"
            data-rail-item="chart-settings"
            className="quant-side-rail-row"
            onClick={() => {
              setSettingsInitialTab("symbol");
              setSettingsOpen(true);
            }}
          >
            <span className="quant-side-rail-tile">
              <span className="quant-side-rail-icon">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="quant-side-rail-settings-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4" />
                </svg>
              </span>
            </span>
          </button>
        </div>
      </nav>

      {/* Full Data-Driven Vela Settings Dialog */}
      <VelaSettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsInitialTab}
        chartInstance={chart.current}
        statusline={statuslineRef.current}
        watermark={watermarkRef.current}
        symbol={history.symbol}
        resolution={history.resolution}
        candleCount={history.bars.length}
        availableDatasets={availableDatasets}
        currentDatasetId={currentDatasetId}
        onSelectDataset={onSelectDataset}
        currentTimezone={String(chart.current?.renderer?.get?.("timezone") ?? "Etc/UTC")}
        onTimezoneChange={(tz) => {
          chart.current?.renderer?.set?.("timezone", tz);
        }}
        onApplySetting={(path, value) => {
          if (path.includes("Chart style") || path.includes("style")) {
            chart.current?.renderer?.set?.("priceStyle", value);
          }
        }}
      />
    </div>
  );
}

