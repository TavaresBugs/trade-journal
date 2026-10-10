"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { getAssetIconConfig } from "@/lib/assets/asset-icons";
import {
  applyStoredSettingsToChart,
  type StoredVelaSettings,
} from "./vela-settings-bridge";

export interface VelaInteractivePreviewProps {
  settings: StoredVelaSettings;
  symbol: string;
  resolution?: string;
  className?: string;
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Canonical June 1, 2026 UTC timestamp from LuxAlgo Vela chunk-main.pretty.js (line 44259: yT = Date.UTC(2026, 5, 1))
export const START_TIME = Date.UTC(2026, 5, 1);

// Signature walk deltas from LuxAlgo Vela chunk-main.pretty.js (lines 44298–44315: y_)
export const SIGNATURE_DELTAS = [
  [0, 2, 0.6, 0.5],
  [0, 1.2, 0.3, 0.8],
  [0, -0.6, 1.4, 0.2],
  [0, 1.6, 0.4, 0.4],
  [0, 0.05, 0.9, 0.9],
  [0, -1.8, 0.3, 0.6],
  [0, -0.8, 0.2, 1.6],
  [0, 1, 0.5, 0.3],
  [0.8, 1.4, 0.4, 0.3],
  [0, 0.9, 1.2, 0.2],
  [0, -1.2, 0.3, 0.4],
  [0, -1.6, 0.2, 0.4],
  [0, 0.6, 0.3, 1.3],
  [0, -1.5, 0.4, 0.3],
  [0, 0.5, 0.9, 0.4],
  [0, 0.4, 0.4, 0.4],
] as const;

/**
 * Synthetic Data Generator replicating lines 47140–47203 of chunk-main.pretty.js:
 * Generates 72 bars of 15m (9e5 ms) realistic price action for BTCUSDT (base price 85,300, tick 0.5).
 */
export function generateSyntheticBars(
  basePrice = 85300,
  tick = 0.5,
  totalBars = 72
): CandleBar[] {
  const roundTick = (v: number) =>
    Number((Math.round(v / tick) * tick).toFixed(8));
  const r = basePrice;
  let cur = basePrice;
  const wavyCount = Math.max(0, totalBars - SIGNATURE_DELTAS.length);

  const wavyBars: CandleBar[] = Array.from({ length: wavyCount }, (_, n) => {
    const prev = cur;
    cur =
      prev +
      r * (0.001 * Math.sin(1.3 * n) + 0.0005 * Math.cos(0.4 * n));
    const open = roundTick(prev);
    const close = roundTick(cur);
    const high = roundTick(Math.max(open, close) + 0.00045 * r);
    const low = roundTick(Math.min(open, close) - 0.0005 * r);
    const volume = 800 + 27 * n;
    return {
      time: START_TIME + n * 900000,
      open,
      high,
      low,
      close,
      volume,
    };
  });

  const stepScale = 0.001 * r;
  const signatureBars: CandleBar[] = SIGNATURE_DELTAS.map(
    ([t, nVal, rWick, iWick], idx) => {
      const openRaw = cur + t * stepScale;
      const closeRaw = openRaw + nVal * stepScale;
      cur = closeRaw;
      const open = roundTick(openRaw);
      const close = roundTick(closeRaw);
      const high = roundTick(Math.max(openRaw, closeRaw) + rWick * stepScale);
      const low = roundTick(Math.min(openRaw, closeRaw) - iWick * stepScale);
      const volume = Math.round(
        1400 + 900 * Math.abs(nVal) + (rWick + iWick) * 300
      );
      return {
        time: START_TIME + (wavyBars.length + idx) * 900000,
        open,
        high,
        low,
        close,
        volume,
      };
    }
  );

  return [...wavyBars, ...signatureBars];
}

/**
 * Heikin-Ashi transformation matching official LuxAlgo Vela logic.
 */
export function toHeikinAshi(bars: CandleBar[]): CandleBar[] {
  if (bars.length === 0) return [];
  const result: CandleBar[] = [];
  const first = bars[0]!;
  let prevHaOpen = (first.open + first.close) / 2;
  let prevHaClose = (first.open + first.high + first.low + first.close) / 4;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen =
      i === 0 ? (b.open + b.close) / 2 : (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);
    prevHaOpen = haOpen;
    prevHaClose = haClose;
    result.push({
      time: b.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: b.volume,
    });
  }
  return result;
}

export function hexToRgba(color: string, alpha: number): string {
  if (!color) return `rgba(8, 153, 129, ${alpha})`;
  if (color.startsWith("rgba")) {
    return color.replace(/[\d\.]+\)$/g, `${alpha})`);
  }
  if (color.startsWith("rgb")) {
    return color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(8, 153, 129, ${alpha})`;
}

const TICK_FRACTIONS = [0.2, 0.8, 0.4, 0.9, 0.55, 0.15, 0.7];

/**
 * Official LuxAlgo Vela Interactive Settings Preview Chart Engine
 *
 * Ground truth from chunk 394lt55mz__4m.js:
 * - HTML Architecture:
 *   <aside class="quant-settings-preview" aria-label="Chart settings preview">
 *     <h4>Appearance preview</h4>
 *     <div class="quant-settings-preview-card">
 *       <div class="quant-settings-preview-meta">
 *         <span>Sample data</span><b>BTCUSDT</b>
 *       </div>
 *       <div class="quant-settings-preview-chart vela-ui vela-has-statusline vela-sl-stacked-host" aria-label="Interactive settings preview">
 *          ... mini Vela chart engine instance ...
 *       </div>
 *     </div>
 *     <p class="quant-settings-preview-caption">Simulated prices · scroll to zoom, drag to pan.</p>
 *   </aside>
 * - Real Vela Engine:
 *   - Native price scale with functional 'A' (Auto) and 'L' (Log) scale buttons.
 *   - Native time scale with 15m intervals.
 *   - Stacked statusline (`Statusline`) connected via `statusline.onChart(instance)`.
 *   - Watermark (`Watermark`).
 *   - Pan and clamped zoom built-in.
 *   - Simulated price ticking every 1200ms.
 *   - 100% reactive to parent settings changes.
 *   - SSR fallback preserves 100% compatibility with renderToString unit tests.
 */
export function VelaInteractivePreview({
  settings,
  symbol,
  resolution = "15m",
  className = "",
}: VelaInteractivePreviewProps) {
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Chart engine instances
  const chartRef = useRef<any>(null);
  const statuslineRef = useRef<any>(null);
  const watermarkRef = useRef<any>(null);
  const tickIndexRef = useRef<number>(0);

  // Client hydration flag
  const [isClientMounted, setIsClientMounted] = useState<boolean>(false);

  // Generate synthetic base dataset (72 bars of 15m BTCUSDT)
  const baseBars = useMemo(() => generateSyntheticBars(85300, 0.5, 72), []);

  // Display symbol and avatar
  const rawSymbol = symbol || "BTCUSDT";
  const displaySymbol = rawSymbol.includes(":")
    ? rawSymbol.split(":")[1]!
    : rawSymbol;
  const avatarText =
    displaySymbol.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "BT";

  // Active bar numbers for SSR fallback
  const lastBar = baseBars[baseBars.length - 1] ?? {
    time: START_TIME,
    open: 85300,
    high: 85500,
    low: 85200,
    close: 85450,
    volume: 1200,
  };
  const prevBar = baseBars[baseBars.length - 2] ?? lastBar;
  const diff = lastBar.close - prevBar.close;
  const pct = (diff / prevBar.close) * 100;
  const isUp = diff >= 0;
  const changeFormatted = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} (${diff >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
  const activeColor = isUp
    ? settings?.symbol?.candles?.upColor || "#089981"
    : settings?.symbol?.candles?.downColor || "#f23645";

  const formatPrice = (p: number) =>
    p.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // 1. Client mount lifecycle: dynamically imports Vela & mounts the real chart
  useEffect(() => {
    setIsClientMounted(true);
    let disposed = false;
    let tickerInterval: any = null;

    void (async () => {
      try {
        const [
          { Vela },
          { Statusline, Watermark },
        ] = await Promise.all([
          import("@luxalgo/vela"),
          import("@luxalgo/vela/widget"),
        ]);

        if (disposed || !chartWrapperRef.current) return;

        const isDark =
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark");

        // Clean previous instances if any
        if (chartRef.current) {
          try {
            watermarkRef.current?.destroy?.();
            statuslineRef.current?.destroy?.();
            chartRef.current?.destroy?.();
          } catch {}
        }

        // Initialize mini Vela instance (1:1 with official chunk 394lt55mz__4m.js)
        const instance = new Vela(chartWrapperRef.current, {
          symbol: "BINANCE:BTCUSDT",
          timeframe: "15",
          data: baseBars,
          live: true,
          theme: isDark ? "dark" : "light",
          drawings: false,
          volume: false,
          priceStyle: settings?.symbol?.priceStyle || "candles",
          nativeBackend: "canvas2d",
          animations: {
            intro: settings?.symbol?.animations?.intro,
          },
        });

        instance.renderer.set({
          settings: false,
          attribution: false,
          keyboard: false,
        });
        chartRef.current = instance;

        // Stacked statusline attached to chart with project vector SVG icon
        const resolveIcon = (sym: string): string | undefined => {
          try {
            const config = getAssetIconConfig(sym);
            return config.icons[0];
          } catch {
            return undefined;
          }
        };

        const statusline = new Statusline(
          chartWrapperRef.current,
          "BINANCE:BTCUSDT",
          resolveIcon
        );
        statusline.setMeta("15", "");
        statusline.onChart?.(instance);
        if (baseBars.length > 0) {
          (statusline as any).lastBar = baseBars[baseBars.length - 1];
          (statusline as any).render?.();
        }
        statuslineRef.current = statusline;

        // Watermark
        const watermark = new Watermark(
          chartWrapperRef.current,
          "BINANCE:BTCUSDT",
          "15"
        );
        watermark.setLoading?.(false);
        watermarkRef.current = watermark;

        // Apply active settings
        applyStoredSettingsToChart(
          instance,
          statusline,
          watermark,
          settings
        );

        // Simulated price updates every 1200ms
        const lastCandle = { ...baseBars[baseBars.length - 1]! };
        tickerInterval = setInterval(() => {
          if (
            typeof document !== "undefined" &&
            (document.hidden || !chartWrapperRef.current?.isConnected)
          ) {
            return;
          }
          const fraction =
            TICK_FRACTIONS[tickIndexRef.current++ % TICK_FRACTIONS.length] ??
            0.5;
          const oscClose = Number(
            (
              lastCandle.low +
              (lastCandle.high - lastCandle.low) * fraction
            ).toFixed(2)
          );
          const updated = {
            ...lastCandle,
            close: oscClose,
            high: Math.max(lastCandle.high, oscClose),
            low: Math.min(lastCandle.low, oscClose),
          };
          try {
            (instance.renderer as any)?.updateBar?.(updated);
          } catch {}
        }, 1200);
      } catch (err) {
        console.warn("[VelaInteractivePreview] Chart engine mount failed:", err);
      }
    })();

    return () => {
      disposed = true;
      if (tickerInterval) clearInterval(tickerInterval);
      try {
        watermarkRef.current?.destroy?.();
      } catch {}
      try {
        statuslineRef.current?.destroy?.();
      } catch {}
      try {
        chartRef.current?.destroy?.();
      } catch {}
      chartRef.current = null;
      statuslineRef.current = null;
      watermarkRef.current = null;
    };
  }, [baseBars]);

  // 2. Reactive settings updates to the live chart engine
  useEffect(() => {
    if (!chartRef.current) return;
    applyStoredSettingsToChart(
      chartRef.current,
      statuslineRef.current,
      watermarkRef.current,
      settings
    );
  }, [settings]);

  return (
    <aside
      className={`quant-settings-preview select-none ${className}`}
      aria-label="Chart settings preview"
    >
      <h4>Appearance preview</h4>

      {/* Preview Market Scenarios (optional/hidden per official Vela) */}
      <div
        className="quant-settings-scenarios"
        role="group"
        aria-label="Preview market"
        hidden
      >
        <button type="button" data-market="stock" aria-pressed="false">
          Stocks
        </button>
        <button type="button" data-market="forex" aria-pressed="false">
          Forex
        </button>
      </div>

      {/* Card Container */}
      <div className="quant-settings-preview-card">
        {/* Top Meta Bar */}
        <div className="quant-settings-preview-meta">
          <span>Sample data</span>
          <b>BTCUSDT</b>
        </div>

        {/* Interactive Chart Container */}
        <div
          ref={chartWrapperRef}
          className="quant-settings-preview-chart vela-ui vela-has-statusline vela-sl-stacked-host select-none"
          aria-label="Interactive settings preview"
          style={{
            backgroundColor: settings?.canvas?.background || "#151619",
          }}
        >
          {/* Static SSR Fallback (rendered in Node.js / before client hydration) */}
          {!isClientMounted && (
            <div className="vela-preview-ssr-fallback absolute inset-0 w-full h-full pointer-events-none">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full block"
              />

              {/* SSR Statusline */}
              <div className="vela-statusline vela-sl-stacked absolute top-2 left-2 z-10 pointer-events-auto">
                <span className="vela-sl-row vela-sl-identity">
                  <span className="vela-sl-avatar w-[18px] h-[18px] rounded-full bg-[#d92672] text-white text-[9px] font-bold inline-flex items-center justify-center shrink-0">
                    {avatarText}
                  </span>

                  {settings?.statusLine?.symbol !== false && (
                    <span className="vela-sl-symbol font-semibold text-[#d1d4dc] text-[13.5px]">
                      {displaySymbol}
                    </span>
                  )}

                  {settings?.statusLine?.meta !== false && (
                    <span className="vela-sl-meta text-[#868a96] text-[12px] font-medium">
                      {`· ${resolution}`}
                    </span>
                  )}

                  {settings?.statusLine?.market !== false && (
                    <span className="vela-sl-market inline-flex items-center">
                      <svg
                        className="w-3 h-3 text-[#089981]"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <circle cx="8" cy="8" r="5" />
                        <line x1="8" y1="1" x2="8" y2="4" />
                        <line x1="8" y1="12" x2="8" y2="15" />
                        <line x1="1" y1="8" x2="4" y2="8" />
                        <line x1="12" y1="8" x2="15" y2="8" />
                        <circle cx="8" cy="8" r="1" fill="currentColor" />
                      </svg>
                    </span>
                  )}
                </span>

                <span className="vela-sl-row vela-sl-values">
                  {settings?.statusLine?.ohlc !== false && (
                    <span className="vela-sl-ohlc">
                      <span>
                        C <b style={{ color: activeColor }}>{formatPrice(lastBar.close)}</b>
                      </span>
                    </span>
                  )}
                  {settings?.statusLine?.change !== false && (
                    <span
                      className="vela-sl-change"
                      style={{ color: activeColor }}
                    >
                      {changeFormatted}
                    </span>
                  )}
                </span>
              </div>

              {/* SSR Watermark */}
              <div
                className="vela-watermark absolute inset-0 bottom-[22px] right-[58px] flex flex-col items-center justify-center pointer-events-none select-none z-[1]"
                style={{
                  display: settings?.symbol?.symbolWatermark ? "flex" : "none",
                }}
              >
                <span className="text-white opacity-[0.06] text-[22px] font-bold tracking-[0.04em] whitespace-nowrap">
                  {`${displaySymbol} ${resolution}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtitle / Caption outside the card matching official Vela DOM */}
      <p className="quant-settings-preview-caption">
        Simulated prices · scroll to zoom, drag to pan.
      </p>
    </aside>
  );
}
