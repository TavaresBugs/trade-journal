"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import schemaData from "./vela-settings-schema.json";
import type { VelaSettingsSchema, SettingsTab } from "./vela-settings-types";
import { formatDatasetDisplayName, type MarketCsvDataset } from "@/lib/market-csv";
import type { Resolution } from "@/lib/market-data";
import {
  X,
  Database,
  Grid,
  Sliders,
  Calendar,
  RotateCcw,
  AlignLeft,
  ChevronDown,
} from "lucide-react";
import {
  type StoredVelaSettings,
  DEFAULT_VELA_SETTINGS,
  toHexColor,
  loadStoredSettings,
  saveStoredSettings,
  applyStoredSettingsToChart,
  VELA_SETTINGS_STORAGE_KEY,
} from "./vela-settings-bridge";
import { VelaToggle, VelaCheckbox } from "./vela-toggle";
import { VelaInfoTooltip, VELA_TOOLTIPS_CATALOG } from "./vela-info-tooltip";
import { VelaColorPicker } from "./vela-color-picker";
import { VelaBezierSelect, type VelaBezierSelectOption } from "./vela-bezier-select";
import { VELA_TIMEZONE_CATALOG } from "@/lib/vela-timezones";
import { VelaInteractivePreview } from "./vela-interactive-preview";
import { VELA_CHART_STYLE_OPTIONS } from "@/components/vela-style-picker";

const typedSchema = schemaData as VelaSettingsSchema;

const DEFAULT_TAB: SettingsTab = {
  id: "symbol",
  name: "Symbol",
  isSubTab: false,
  sections: [],
};

const MAIN_TAB_ORDER = [
  "symbol",
  "status-line",
  "scales-and-lines",
  "canvas",
  "data",
];

const TIMEZONE_OPTIONS = VELA_TIMEZONE_CATALOG;

const PRICE_SCALE_MODE_OPTIONS: VelaBezierSelectOption[] = [
  { value: "regular", label: "Regular" },
  { value: "percent", label: "Percent" },
  { value: "indexed", label: "Indexed to 100" },
  { value: "log", label: "Logarithmic" },
];

const CROSSHAIR_STYLE_OPTIONS: VelaBezierSelectOption[] = [
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "solid", label: "Solid" },
];

const CANVAS_THEME_OPTIONS: VelaBezierSelectOption[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const BARS_TO_FETCH_OPTIONS: VelaBezierSelectOption[] = [
  { value: "500", label: "500" },
  { value: "1000", label: "1000" },
  { value: "2000", label: "2000" },
  { value: "5000", label: "5000" },
  { value: "10000", label: "10000" },
  { value: "20000", label: "20000" },
  { value: "50000", label: "50000" },
  { value: "60000", label: "60000" },
  { value: "80000", label: "80000" },
  { value: "100000", label: "100000" },
];

const TRADE_CONTEXT_OPTIONS: VelaBezierSelectOption[] = [
  { value: "25", label: "25 candles" },
  { value: "50", label: "50 candles" },
  { value: "100", label: "100 candles" },
  { value: "250", label: "250 candles" },
  { value: "500", label: "500 candles" },
];

export interface VelaSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  chartInstance?: any;
  statusline?: any;
  watermark?: any;
  symbol: string;
  resolution?: Resolution;
  candleCount?: number;
  availableDatasets?: MarketCsvDataset[];
  currentDatasetId?: string;
  onSelectDataset?: (datasetId: string) => void;
  onUploadCsvClick?: () => void;
  onTimezoneChange?: (tz: string) => void;
  currentTimezone?: string;
  onResetDefaults?: () => void;
  onApplySetting?: (path: string, value: any) => void;
}

function ColorPicker({
  value,
  onChange,
  disabled = false,
  title,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  return <VelaColorPicker value={value} onChange={onChange} disabled={disabled} title={title} />;
}

export function VelaSettingsDialog({
  isOpen,
  onClose,
  initialTab = "symbol",
  chartInstance,
  statusline,
  watermark,
  symbol,
  resolution = "1m",
  candleCount = 0,
  availableDatasets = [],
  currentDatasetId = "",
  onSelectDataset,
  onUploadCsvClick,
  onTimezoneChange,
  currentTimezone = "Etc/UTC",
  onResetDefaults,
  onApplySetting,
}: VelaSettingsDialogProps) {
  const resolveTabId = (t: string) => {
    if (t === "advanced" || t === "data-source" || t === "fonte de dados") return "data";
    return t;
  };
  const [activeTabId, setActiveTabId] = useState<string>(() => resolveTabId(initialTab));

  // Settings State initialized from storage / defaults
  const [settings, setSettings] = useState<StoredVelaSettings>(() => loadStoredSettings());

  // Keep activeTabId in sync with initialTab whenever initialTab changes or modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTabId(resolveTabId(initialTab));
    }
  }, [isOpen, initialTab]);

  // Hydrate from live engine config and storage on dialog open
  useEffect(() => {
    if (!isOpen) return;

    const stored = loadStoredSettings();
    const liveConfig = chartInstance?.renderer?.getConfig?.();

    if (liveConfig) {
      const merged: StoredVelaSettings = {
        ...stored,
        symbol: {
          ...stored.symbol,
          priceStyle: liveConfig.series?.style ?? stored.symbol.priceStyle,
          candles: {
            ...stored.symbol.candles,
            bodyVisible: liveConfig.candles?.bodyVisible ?? stored.symbol.candles.bodyVisible,
            upColor: toHexColor(liveConfig.candles?.upColor, stored.symbol.candles.upColor),
            downColor: toHexColor(liveConfig.candles?.downColor, stored.symbol.candles.downColor),
            borderVisible: liveConfig.candles?.borderVisible ?? stored.symbol.candles.borderVisible,
            borderUpColor: toHexColor(
              liveConfig.candles?.borderUpColor,
              stored.symbol.candles.borderUpColor,
            ),
            borderDownColor: toHexColor(
              liveConfig.candles?.borderDownColor,
              stored.symbol.candles.borderDownColor,
            ),
            wickVisible: liveConfig.candles?.wickVisible ?? stored.symbol.candles.wickVisible,
            wickUpColor: toHexColor(
              liveConfig.candles?.wickUpColor,
              stored.symbol.candles.wickUpColor,
            ),
            wickDownColor: toHexColor(
              liveConfig.candles?.wickDownColor,
              stored.symbol.candles.wickDownColor,
            ),
            spacing: liveConfig.series?.spacing ?? stored.symbol.candles.spacing,
          },
          animations: {
            ...stored.symbol.animations,
            zoom: liveConfig.animations?.zoom ?? stored.symbol.animations.zoom,
            pan: liveConfig.animations?.pan ?? stored.symbol.animations.pan,
            autoscale: liveConfig.animations?.autoscale ?? stored.symbol.animations.autoscale,
            intro: liveConfig.animations?.intro ?? stored.symbol.animations.intro,
          },
          timezone: liveConfig.timeScale?.timezone ?? stored.symbol.timezone,
        },
        scalesAndLines: {
          ...stored.scalesAndLines,
          scaleMode: (() => {
            const m = liveConfig.priceScale?.mode ?? stored.scalesAndLines.scaleMode;
            if (m === "price" || m === "regular" || m === "normal") return "regular";
            if (m === "percent" || m === "percentage") return "percent";
            if (m === "indexed" || m === "indexedTo100") return "indexed";
            if (m === "log" || m === "logarithmic") return "log";
            return "regular";
          })(),
          invertScale: liveConfig.priceScale?.invert ?? stored.scalesAndLines.invertScale,
          axisLabels: liveConfig.priceScale?.labelsVisible ?? stored.scalesAndLines.axisLabels,
          currentPriceLine:
            liveConfig.priceScale?.currentPriceLine ?? stored.scalesAndLines.currentPriceLine,
          priceLabel: liveConfig.priceScale?.priceLabel ?? stored.scalesAndLines.priceLabel,
          countdown: liveConfig.priceScale?.countdown ?? stored.scalesAndLines.countdown,
          scaleBorderColor: toHexColor(
            liveConfig.priceScale?.borderColor,
            stored.scalesAndLines.scaleBorderColor ?? "#2a2b30",
          ),
          crosshair: {
            ...stored.scalesAndLines.crosshair,
            style: liveConfig.crosshair?.style ?? stored.scalesAndLines.crosshair.style,
            color: toHexColor(liveConfig.crosshair?.color, stored.scalesAndLines.crosshair.color),
            opacity: liveConfig.crosshair?.opacity ?? stored.scalesAndLines.crosshair.opacity,
            width: liveConfig.crosshair?.width ?? stored.scalesAndLines.crosshair.width,
          },
        },
        canvas: {
          ...stored.canvas,
          background: toHexColor(liveConfig.layout?.background, stored.canvas.background),
          textColor: toHexColor(liveConfig.layout?.textColor, stored.canvas.textColor),
          fontSize: liveConfig.layout?.fontSize ?? stored.canvas.fontSize,
          paneSeparatorColor: toHexColor(
            liveConfig.layout?.paneSeparatorColor,
            stored.canvas.paneSeparatorColor ?? "#2a2b30",
          ),
          gridVertVisible: liveConfig.grid?.vertLines?.visible ?? stored.canvas.gridVertVisible,
          gridVertColor: toHexColor(liveConfig.grid?.vertLines?.color, stored.canvas.gridVertColor),
          gridHorzVisible: liveConfig.grid?.horzLines?.visible ?? stored.canvas.gridHorzVisible,
          gridHorzColor: toHexColor(liveConfig.grid?.horzLines?.color, stored.canvas.gridHorzColor),
          margins: {
            ...stored.canvas.margins,
            ...liveConfig.margins,
          },
          colorTheme: stored.canvas.colorTheme ?? "dark",
        },
        advanced: {
          ...stored.advanced,
          barsToFetch: stored.advanced.barsToFetch ?? 5000,
          tradeContextPadding: stored.advanced.tradeContextPadding ?? 25,
        },
      };

      if (currentTimezone && currentTimezone !== "Etc/UTC") {
        merged.symbol.timezone = currentTimezone;
      }

      setSettings(merged);
    } else {
      setSettings(stored);
    }
  }, [isOpen, chartInstance, currentTimezone]);

  // Central reactive update dispatcher
  const updateSettings = useCallback(
    (updater: (prev: StoredVelaSettings) => StoredVelaSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        saveStoredSettings(next);
        applyStoredSettingsToChart(chartInstance, statusline, watermark, next);
        return next;
      });
    },
    [chartInstance, statusline, watermark],
  );

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeTab: SettingsTab = useMemo(() => {
    return typedSchema.tabs.find((t) => t.id === activeTabId) ?? typedSchema.tabs[0] ?? DEFAULT_TAB;
  }, [activeTabId]);

  if (!isOpen) return null;

  const renderTabIcon = (id: string, isSelected: boolean) => {
    const strokeClass = isSelected ? "text-[#151619]" : "text-[#868a96] group-hover:text-[#f0f3fa]";
    switch (id) {
      case "symbol":
        return (
          <svg
            className={`w-4 h-4 ${strokeClass}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.5 2v2M4.5 12v2M11.5 2v1.5M11.5 11v3" />
            <rect x="2.8" y="4" width="3.4" height="8" rx="0.6" fill="currentColor" fillOpacity="0.25" />
            <rect x="9.8" y="3.5" width="3.4" height="7.5" rx="0.6" fill="currentColor" />
          </svg>
        );
      case "status-line":
        return <AlignLeft className={`w-4 h-4 ${strokeClass}`} strokeWidth={1.5} />;
      case "scales-and-lines":
        return (
          <svg
            className={`w-4 h-4 ${strokeClass}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <path
              d="M2 13h12M2 3v10M5 10l3-3 3 3 3-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "canvas":
        return (
          <svg
            className={`w-4 h-4 ${strokeClass}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <rect x="2.5" y="2.5" width="11" height="11" rx="2" strokeLinecap="round" />
            <path d="M8 2.5v11M2.5 8h11" strokeLinecap="round" />
          </svg>
        );
      case "events":
        return <Calendar className={`w-4 h-4 ${strokeClass}`} strokeWidth={1.5} />;
      case "data":
      case "data-source":
      case "advanced":
        return <Database className={`w-4 h-4 ${strokeClass}`} strokeWidth={1.5} />;
      default:
        return <Grid className={`w-4 h-4 ${strokeClass}`} strokeWidth={1.5} />;
    }
  };

  const tabsToShow = typedSchema.tabs.filter((t) => MAIN_TAB_ORDER.includes(t.id));

  const renderToggle = (checked: boolean, onToggle: () => void, ariaLabel?: string) => (
    <VelaToggle checked={checked} onChange={onToggle} ariaLabel={ariaLabel} />
  );

  const renderCheckbox = (checked: boolean, onChange: (val: boolean) => void, label?: string) => (
    <VelaCheckbox checked={checked} onChange={onChange} label={label} />
  );

  const renderStepperInput = (
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    width = 72,
  ) => (
    <div
      className="vela-num relative inline-flex items-center h-[29px] group"
      data-steppers=""
      data-size="md"
      style={{ width: `${width}px` }}
    >
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          onChange(isNaN(v) ? min : Math.max(min, Math.min(max, v)));
        }}
        className="block w-full h-[29px] pl-2 pr-2 group-hover:pr-4.5 bg-transparent border border-[#34353b] rounded-[6px] text-[11px] text-center text-[#f0f3fa] font-sans focus:outline-hidden focus:border-[#3875f6] hover:border-[#4a4b52] transition-[border-color,padding] appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="vela-num-step absolute right-[2px] top-[2px] bottom-[2px] w-[16px] hidden group-hover:flex flex-col justify-center pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase"
          onClick={() => {
            const next = step < 1 ? Number((value + step).toFixed(2)) : value + step;
            onChange(Math.min(max, next));
          }}
          className="flex-1 w-full min-h-0 border-none bg-transparent text-[#868a96] hover:text-[#f0f3fa] hover:bg-white/10 rounded-[2px] p-0 cursor-pointer flex items-center justify-center transition-colors"
        >
          <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 10 8 5.5 12.5 10" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease"
          onClick={() => {
            const next = step < 1 ? Number((value - step).toFixed(2)) : value - step;
            onChange(Math.max(min, next));
          }}
          className="flex-1 w-full min-h-0 border-none bg-transparent text-[#868a96] hover:text-[#f0f3fa] hover:bg-white/10 rounded-[2px] p-0 cursor-pointer flex items-center justify-center transition-colors"
        >
          <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 6 8 10.5 12.5 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderUnitStepper = (
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    unit: string,
  ) => (
    <div className="vela-field-cell-unit">
      {renderStepperInput(value, min, max, step, onChange, 72)}
      <span className="text-[12px] text-[#868a96] text-left select-none">{unit}</span>
    </div>
  );

  const handleResetDefaults = () => {
    try {
      localStorage.removeItem(VELA_SETTINGS_STORAGE_KEY);
    } catch {}

    const factory =
      chartInstance?.renderer?.factoryConfig ??
      (chartInstance?.renderer as any)?.renderer?.factoryConfig;
    if (factory) {
      chartInstance?.renderer?.applyConfig?.(factory);
    }

    setSettings(DEFAULT_VELA_SETTINGS);
    applyStoredSettingsToChart(chartInstance, statusline, watermark, DEFAULT_VELA_SETTINGS);
    onResetDefaults?.();
  };

  return (
    <div
      className="vela-settings-dialog quant-settings-dialog fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chart settings"
        className="quant-settings-panel quant-settings-dialog vela-settings-dialog relative flex flex-col w-[1100px] max-w-[96vw] h-[680px] max-h-[92vh] bg-[#151619] border border-[#2a2b30] rounded-[13px] shadow-[0_24px_64px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.5)] overflow-hidden font-sans text-[#d1d4dc]"
      >
        {/* HEADER */}
        <div className="vela-dialog-header h-[50px] px-5 flex items-center justify-between border-b border-[#2a2b30] shrink-0 select-none">
          <div className="vela-dialog-title flex items-center gap-2.5 text-[14px] font-medium text-white tracking-normal">
            <Sliders className="w-4 h-4 text-[#868a96]" strokeWidth={1.5} />
            <span>Chart settings</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-7 h-7 rounded-[4px] flex items-center justify-center text-[#787b86] hover:text-white hover:bg-[#202228] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* HORIZONTAL TAB RAIL */}
        <div
          role="tablist"
          aria-label="Settings category"
          className="vela-sd-rail flex flex-row items-center gap-1 px-3.5 py-2 border-b border-[#2a2b30] shrink-0 select-none w-full bg-[#151619]"
        >
          {tabsToShow.map((tab) => {
            const isSelected = tab.id === activeTab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTabId(tab.id)}
                className={`vela-sd-tab group flex-1 min-w-0 inline-flex items-center justify-start gap-2 px-2.5 py-1.5 h-[40px] rounded-[6px] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                  isSelected
                    ? "on bg-[color-mix(in_srgb,#f0f3fa_2%,transparent)] text-white"
                    : "text-[#868a96] hover:text-[#f0f3fa] hover:bg-transparent"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 transition-transform duration-150 ${
                    isSelected
                      ? "bg-[color-mix(in_srgb,#f0f3fa_83%,#151619)] border border-[color-mix(in_srgb,#f0f3fa_40%,transparent)] shadow-xs"
                      : "bg-transparent border border-transparent group-hover:scale-110"
                  }`}
                >
                  {renderTabIcon(tab.id, isSelected)}
                </span>
                <span className="whitespace-nowrap">{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENT & PREVIEW SPLIT */}
        <div
          className={`quant-settings-content flex-1 min-h-0 grid ${
            activeTab.id === "data" ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_340px]"
          } overflow-hidden`}
        >
          {/* LEFT: PANE SETTINGS */}
          <div className="vela-sd-pane p-5 overflow-y-auto">
            {activeTab.id === "symbol" ? (
              /* TAB 1: SYMBOL */
              <div className="space-y-4">
                {/* CHART STYLE SELECT */}
                <div className="quant-settings-type flex items-center justify-between pb-1">
                  <span className="text-[13px] font-normal text-[#d1d4dc]">Chart style</span>
                  <VelaBezierSelect
                    value={settings.symbol.priceStyle}
                    options={VELA_CHART_STYLE_OPTIONS}
                    onChange={(styleKey) => {
                      updateSettings((prev) => ({
                        ...prev,
                        symbol: { ...prev.symbol, priceStyle: styleKey },
                      }));
                      onApplySetting?.("priceStyle", styleKey);
                    }}
                    minWidth={150}
                  />
                </div>

                {/* TWO-COLUMN CARDS GRID */}
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* CARD 1: CANDLES */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Candles
                    </div>

                    {/* BODY ROW */}
                    <div className="quant-settings-row vela-field-row">
                      {renderCheckbox(
                        settings.symbol.candles.bodyVisible,
                        (val) => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              candles: { ...prev.symbol.candles, bodyVisible: val },
                            },
                          }));
                        },
                        "Body",
                      )}
                      <div className="vela-field-cell-double-color">
                        <ColorPicker
                          value={settings.symbol.candles.upColor}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, upColor: col },
                              },
                            }));
                          }}
                          title="Body Up"
                        />
                        <ColorPicker
                          value={settings.symbol.candles.downColor}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, downColor: col },
                              },
                            }));
                          }}
                          title="Body Down"
                        />
                      </div>
                    </div>

                    {/* BORDERS ROW */}
                    <div className="quant-settings-row vela-field-row">
                      {renderCheckbox(
                        settings.symbol.candles.borderVisible,
                        (val) => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              candles: { ...prev.symbol.candles, borderVisible: val },
                            },
                          }));
                        },
                        "Borders",
                      )}
                      <div className="vela-field-cell-double-color">
                        <ColorPicker
                          value={settings.symbol.candles.borderUpColor}
                          disabled={!settings.symbol.candles.borderVisible}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, borderUpColor: col },
                              },
                            }));
                          }}
                          title="Border Up"
                        />
                        <ColorPicker
                          value={settings.symbol.candles.borderDownColor}
                          disabled={!settings.symbol.candles.borderVisible}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, borderDownColor: col },
                              },
                            }));
                          }}
                          title="Border Down"
                        />
                      </div>
                    </div>

                    {/* WICK ROW */}
                    <div className="quant-settings-row vela-field-row">
                      {renderCheckbox(
                        settings.symbol.candles.wickVisible,
                        (val) => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              candles: { ...prev.symbol.candles, wickVisible: val },
                            },
                          }));
                        },
                        "Wick",
                      )}
                      <div className="vela-field-cell-double-color">
                        <ColorPicker
                          value={settings.symbol.candles.wickUpColor}
                          disabled={!settings.symbol.candles.wickVisible}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, wickUpColor: col },
                              },
                            }));
                          }}
                          title="Wick Up"
                        />
                        <ColorPicker
                          value={settings.symbol.candles.wickDownColor}
                          disabled={!settings.symbol.candles.wickVisible}
                          onChange={(col) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, wickDownColor: col },
                              },
                            }));
                          }}
                          title="Wick Down"
                        />
                      </div>
                    </div>

                    {/* SPACING ROW */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Spacing</span>
                      <div className="vela-field-cell-double-color">
                        {renderStepperInput(
                          settings.symbol.candles.spacing ?? 1,
                          0.1,
                          10,
                          0.1,
                          (next) => {
                            updateSettings((prev) => ({
                              ...prev,
                              symbol: {
                                ...prev.symbol,
                                candles: { ...prev.symbol.candles, spacing: next },
                              },
                            }));
                          },
                          59,
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: ANIMATION */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Animation
                    </div>

                    {[
                      {
                        label: "Animate zoom",
                        tooltipKey: "animate-zoom",
                        val: settings.symbol.animations.zoom,
                        toggle: () =>
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              animations: {
                                ...prev.symbol.animations,
                                zoom: !prev.symbol.animations.zoom,
                              },
                            },
                          })),
                      },
                      {
                        label: "Pan momentum",
                        tooltipKey: "pan-momentum",
                        val: settings.symbol.animations.pan,
                        toggle: () =>
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              animations: {
                                ...prev.symbol.animations,
                                pan: !prev.symbol.animations.pan,
                              },
                            },
                          })),
                      },
                      {
                        label: "Animate price scale",
                        tooltipKey: "animate-price-scale",
                        val: settings.symbol.animations.autoscale,
                        toggle: () =>
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              animations: {
                                ...prev.symbol.animations,
                                autoscale: !prev.symbol.animations.autoscale,
                              },
                            },
                          })),
                      },
                      {
                        label: "Animate price changes",
                        tooltipKey: "animate-price-changes",
                        val: settings.symbol.animations.priceChanges,
                        toggle: () =>
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              animations: {
                                ...prev.symbol.animations,
                                priceChanges: !prev.symbol.animations.priceChanges,
                              },
                            },
                          })),
                      },
                      {
                        label: "Reveal on load",
                        tooltipKey: "reveal-on-load",
                        val: settings.symbol.animations.intro,
                        toggle: () =>
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              animations: {
                                ...prev.symbol.animations,
                                intro: !prev.symbol.animations.intro,
                              },
                            },
                          })),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="quant-settings-row vela-field-row"
                      >
                        <span className="vela-field-label">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <VelaInfoTooltip tooltipKey={item.tooltipKey} />
                          {renderToggle(item.val, item.toggle, item.label)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTTOM ROW: TIME ZONE & WATERMARK (WIDE CARD) */}
                <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                  <div className="vela-field-section">
                    Time zone & watermark
                  </div>

                  <div className="grid grid-cols-2 gap-6 items-start">
                    {/* TIME ZONE */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Time zone</span>
                      <VelaBezierSelect
                        value={settings.symbol.timezone}
                        options={TIMEZONE_OPTIONS}
                        onChange={(tz) => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: { ...prev.symbol, timezone: tz },
                          }));
                          onTimezoneChange?.(tz);
                        }}
                        minWidth={110}
                        popupMinWidth={270}
                      />
                    </div>

                    {/* WATERMARKS */}
                    <div className="space-y-1">
                      <div className="quant-settings-row vela-field-row">
                        <span className="vela-field-label">Symbol watermark</span>
                        {renderToggle(settings.symbol.symbolWatermark, () => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              symbolWatermark: !prev.symbol.symbolWatermark,
                            },
                          }));
                        })}
                      </div>

                      <div className="quant-settings-row vela-field-row">
                        <span className="vela-field-label">Replay watermark</span>
                        {renderToggle(settings.symbol.replayWatermark, () => {
                          updateSettings((prev) => ({
                            ...prev,
                            symbol: {
                              ...prev.symbol,
                              replayWatermark: !prev.symbol.replayWatermark,
                            },
                          }));
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab.id === "status-line" ? (
              /* TAB 2: STATUS LINE */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* CARD 1: STATUS LINE */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Status line
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Symbol name</span>
                      {renderToggle(settings.statusLine.symbol, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: { ...prev.statusLine, symbol: !prev.statusLine.symbol },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Market status</span>
                      {renderToggle(settings.statusLine.market, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: { ...prev.statusLine, market: !prev.statusLine.market },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">OHLC values</span>
                      {renderToggle(settings.statusLine.ohlc, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: { ...prev.statusLine, ohlc: !prev.statusLine.ohlc },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Bar change values</span>
                      {renderToggle(settings.statusLine.change, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: { ...prev.statusLine, change: !prev.statusLine.change },
                        }));
                      })}
                    </div>
                  </div>

                  {/* CARD 2: INDICATORS */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Indicators
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Titles</span>
                      {renderToggle(settings.statusLine.indicatorTitles, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: {
                            ...prev.statusLine,
                            indicatorTitles: !prev.statusLine.indicatorTitles,
                          },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Values</span>
                      {renderToggle(settings.statusLine.indicatorValues, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          statusLine: {
                            ...prev.statusLine,
                            indicatorValues: !prev.statusLine.indicatorValues,
                          },
                        }));
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab.id === "scales-and-lines" ? (
              /* TAB 3: SCALES AND LINES */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* CARD 1: PRICE SCALE */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Price scale
                    </div>

                    {/* MODE */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Mode</span>
                      <VelaBezierSelect
                        value={settings.scalesAndLines.scaleMode}
                        options={PRICE_SCALE_MODE_OPTIONS}
                        onChange={(val) => {
                          updateSettings((prev) => ({
                            ...prev,
                            scalesAndLines: {
                              ...prev.scalesAndLines,
                              scaleMode: val as any,
                            },
                          }));
                        }}
                        minWidth={120}
                      />
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Invert scale</span>
                      {renderToggle(settings.scalesAndLines.invertScale, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          scalesAndLines: {
                            ...prev.scalesAndLines,
                            invertScale: !prev.scalesAndLines.invertScale,
                          },
                        }));
                      })}
                    </div>

                    <div className="border-t border-[#2a2b30] my-2 w-full" />

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Last Price Line</span>
                      {renderToggle(settings.scalesAndLines.currentPriceLine, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          scalesAndLines: {
                            ...prev.scalesAndLines,
                            currentPriceLine: !prev.scalesAndLines.currentPriceLine,
                          },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Last price label</span>
                      {renderToggle(settings.scalesAndLines.priceLabel, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          scalesAndLines: {
                            ...prev.scalesAndLines,
                            priceLabel: !prev.scalesAndLines.priceLabel,
                          },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Countdown to bar close</span>
                      {renderToggle(settings.scalesAndLines.countdown, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          scalesAndLines: {
                            ...prev.scalesAndLines,
                            countdown: !prev.scalesAndLines.countdown,
                          },
                        }));
                      })}
                    </div>

                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Axis labels</span>
                      {renderToggle(settings.scalesAndLines.axisLabels, () => {
                        updateSettings((prev) => ({
                          ...prev,
                          scalesAndLines: {
                            ...prev.scalesAndLines,
                            axisLabels: !prev.scalesAndLines.axisLabels,
                          },
                        }));
                      })}
                    </div>

                    {/* SCALE BORDER COLOR */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Scale border color</span>
                      <ColorPicker
                        value={settings.scalesAndLines.scaleBorderColor ?? "#2a2b30"}
                        onChange={(col) => {
                          updateSettings((prev) => ({
                            ...prev,
                            scalesAndLines: {
                              ...prev.scalesAndLines,
                              scaleBorderColor: col,
                            },
                          }));
                        }}
                        title="Scale border color"
                      />
                    </div>
                  </div>

                  {/* CARD 2: CROSSHAIR */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                    <div className="vela-field-section">
                      Crosshair
                    </div>

                    {/* COLOR */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Color</span>
                      <ColorPicker
                        value={settings.scalesAndLines.crosshair.color}
                        onChange={(col) => {
                          updateSettings((prev) => ({
                            ...prev,
                            scalesAndLines: {
                              ...prev.scalesAndLines,
                              crosshair: { ...prev.scalesAndLines.crosshair, color: col },
                            },
                          }));
                        }}
                        title="Crosshair color"
                      />
                    </div>

                    {/* WIDTH */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Width</span>
                      <div className="vela-field-cell-single-input">
                        {renderStepperInput(
                          settings.scalesAndLines.crosshair.width,
                          0.5,
                          8,
                          0.5,
                          (w) => {
                            updateSettings((prev) => ({
                              ...prev,
                              scalesAndLines: {
                                ...prev.scalesAndLines,
                                crosshair: { ...prev.scalesAndLines.crosshair, width: w },
                              },
                            }));
                          },
                          72,
                        )}
                      </div>
                    </div>

                    {/* STYLE */}
                    <div className="quant-settings-row vela-field-row">
                      <span className="vela-field-label">Style</span>
                      <VelaBezierSelect
                        value={settings.scalesAndLines.crosshair.style}
                        options={CROSSHAIR_STYLE_OPTIONS}
                        onChange={(val) => {
                          updateSettings((prev) => ({
                            ...prev,
                            scalesAndLines: {
                              ...prev.scalesAndLines,
                              crosshair: {
                                ...prev.scalesAndLines.crosshair,
                                style: val as any,
                              },
                            },
                          }));
                        }}
                        minWidth={120}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab.id === "canvas" ? (
              /* TAB 4: CANVAS */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* COLUMN 1: BACKGROUND & TEXT + MARGINS */}
                  <div className="space-y-4">
                    {/* CARD 1: BACKGROUND & TEXT */}
                    <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                      <div className="vela-field-section">
                        Background &amp; Text
                      </div>

                      <div className="space-y-0.5">
                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Background</span>
                          <ColorPicker
                            value={settings.canvas.background}
                            onChange={(col) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, background: col },
                              }));
                            }}
                            title="Background color"
                          />
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Text color</span>
                          <ColorPicker
                            value={settings.canvas.textColor}
                            onChange={(col) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, textColor: col },
                              }));
                            }}
                            title="Text color"
                          />
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Text size</span>
                          {renderUnitStepper(
                            settings.canvas.fontSize,
                            8,
                            16,
                            1,
                            (v) =>
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, fontSize: v },
                              })),
                            "px",
                          )}
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Pane separator</span>
                          <ColorPicker
                            value={settings.canvas.paneSeparatorColor ?? "#2a2b30"}
                            onChange={(col) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, paneSeparatorColor: col },
                              }));
                            }}
                            title="Pane separator color"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: MARGINS */}
                    <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                      <div className="vela-field-section">
                        Margins
                      </div>

                      <div className="space-y-0.5">
                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Top</span>
                          {renderUnitStepper(
                            settings.canvas.margins.top,
                            0,
                            30,
                            1,
                            (v) =>
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: {
                                  ...prev.canvas,
                                  margins: { ...prev.canvas.margins, top: v },
                                },
                              })),
                            "%",
                          )}
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Bottom</span>
                          {renderUnitStepper(
                            settings.canvas.margins.bottom,
                            0,
                            30,
                            1,
                            (v) =>
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: {
                                  ...prev.canvas,
                                  margins: { ...prev.canvas.margins, bottom: v },
                                },
                              })),
                            "%",
                          )}
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <span className="vela-field-label">Right</span>
                          {renderUnitStepper(
                            settings.canvas.margins.right,
                            0,
                            100,
                            1,
                            (v) =>
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: {
                                  ...prev.canvas,
                                  margins: { ...prev.canvas.margins, right: v },
                                },
                              })),
                            "bars",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COLUMN 2: GRID + THEME */}
                  <div className="space-y-4">
                    {/* CARD 2: GRID */}
                    <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                      <div className="vela-field-section">
                        Grid
                      </div>

                      <div className="space-y-0.5">
                        <div className="quant-settings-row vela-field-row">
                          {renderCheckbox(
                            settings.canvas.gridVertVisible,
                            (val) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, gridVertVisible: val },
                              }));
                            },
                            "Vertical",
                          )}
                          <ColorPicker
                            value={settings.canvas.gridVertColor}
                            disabled={!settings.canvas.gridVertVisible}
                            onChange={(col) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, gridVertColor: col },
                              }));
                            }}
                            title="Vertical gridline color"
                          />
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          {renderCheckbox(
                            settings.canvas.gridHorzVisible,
                            (val) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, gridHorzVisible: val },
                              }));
                            },
                            "Horizontal",
                          )}
                          <ColorPicker
                            value={settings.canvas.gridHorzColor}
                            disabled={!settings.canvas.gridHorzVisible}
                            onChange={(col) => {
                              updateSettings((prev) => ({
                                ...prev,
                                canvas: { ...prev.canvas, gridHorzColor: col },
                              }));
                            }}
                            title="Horizontal gridline color"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 4: THEME */}
                    <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-1">
                      <div className="vela-field-section">
                        Theme
                      </div>

                      <div className="quant-settings-row vela-field-row">
                        <span className="vela-field-label">Color theme</span>
                        <VelaBezierSelect
                          value={settings.canvas.colorTheme ?? "dark"}
                          onChange={(val) => {
                            updateSettings((prev) => ({
                              ...prev,
                              canvas: { ...prev.canvas, colorTheme: val as "dark" | "light" },
                            }));
                          }}
                          options={CANVAS_THEME_OPTIONS}
                          minWidth={110}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab.id === "data" ? (
              /* TAB 5: DATA */
              <div className="space-y-3.5 max-w-[800px]">
                {/* CARD 1: ACTIVE MARKET DATASET (FULL WIDTH) */}
                <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] space-y-2.5">
                  <div className="vela-field-section">
                    Active Market Dataset
                  </div>

                  <div className="quant-settings-row vela-field-row !h-auto min-h-[38px] py-0.5">
                    <div>
                      <div className="vela-field-label">Active series</div>
                      <div className="text-[11px] text-[#868a96]">
                        Time series loaded for the current chart symbol
                      </div>
                    </div>
                    <VelaBezierSelect
                      value={currentDatasetId || ""}
                      onChange={(val) => onSelectDataset?.(val)}
                      options={[
                        ...(currentDatasetId ? [] : [{ value: "", label: "Select series..." }]),
                        ...availableDatasets.map((ds) => ({
                          value: ds.id,
                          label: formatDatasetDisplayName(ds),
                        })),
                      ]}
                      minWidth={180}
                    />
                  </div>

                  <div className="quant-settings-row vela-field-row !h-auto min-h-[38px] py-0.5">
                    <div>
                      <div className="vela-field-label">Database Engine</div>
                      <div className="text-[11px] text-[#868a96]">
                        Local SQLite Cache (Synced)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onUploadCsvClick) {
                          onUploadCsvClick();
                        } else {
                          window.location.href = "/settings#time-series-catalog";
                        }
                      }}
                      className="h-[28px] px-3 bg-[#151619] hover:bg-[#202228] text-[#d1d4dc] border border-[#2a2b30] rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer"
                    >
                      Manage Data…
                    </button>
                  </div>
                </div>

                {/* ROW 2: SIDE-BY-SIDE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                  {/* CARD 2: HISTORICAL DEPTH & CONTEXT */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] flex flex-col justify-between">
                    <div>
                      <div className="vela-field-section">
                        Historical Depth &amp; Context
                      </div>

                      <div className="space-y-2 mt-2">
                        <div className="quant-settings-row vela-field-row">
                          <div className="flex items-center gap-1.5">
                            <span className="vela-field-label">Bars to fetch</span>
                            <VelaInfoTooltip
                              title="Bars to fetch"
                              description="Maximum number of historical bars loaded into chart memory from the market dataset."
                              align="left"
                            />
                          </div>
                          <VelaBezierSelect
                            value={String(settings.advanced.barsToFetch ?? 5000)}
                            onChange={(v) => {
                              const n = parseInt(v, 10) || 5000;
                              updateSettings((prev) => ({
                                ...prev,
                                advanced: { ...prev.advanced, barsToFetch: n },
                              }));
                            }}
                            options={BARS_TO_FETCH_OPTIONS}
                            minWidth={130}
                          />
                        </div>

                        <div className="quant-settings-row vela-field-row">
                          <div className="flex items-center gap-1.5">
                            <span className="vela-field-label">Trade context padding</span>
                            <VelaInfoTooltip
                              title="Trade context padding"
                              description="Number of candles rendered before entry and after exit of the trade to provide price action context."
                              align="left"
                            />
                          </div>
                          <VelaBezierSelect
                            value={String(settings.advanced.tradeContextPadding ?? 25)}
                            onChange={(v) => {
                              const n = parseInt(v, 10) || 25;
                              updateSettings((prev) => ({
                                ...prev,
                                advanced: { ...prev.advanced, tradeContextPadding: n },
                              }));
                            }}
                            options={TRADE_CONTEXT_OPTIONS}
                            minWidth={130}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: ENGINE MEMORY & CACHE */}
                  <div className="quant-settings-group border border-[#2a2b30] bg-transparent rounded-[10px] p-[15px] flex flex-col justify-between">
                    <div>
                      <div className="vela-field-section">
                        Engine Memory &amp; Cache
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="p-2.5 bg-[#151619] border border-[#2a2b30] rounded-[6px]">
                          <div className="text-[10px] uppercase font-mono text-[#868a96]">
                            Candles in mem
                          </div>
                          <div className="text-[15px] font-mono font-semibold text-white mt-0.5">
                            {candleCount}
                          </div>
                        </div>
                        <div className="p-2.5 bg-[#151619] border border-[#2a2b30] rounded-[6px]">
                          <div className="text-[10px] uppercase font-mono text-[#868a96]">
                            Resolution
                          </div>
                          <div className="text-[15px] font-mono font-semibold text-white mt-0.5">
                            {resolution}
                          </div>
                        </div>
                        <div className="p-2.5 bg-[#151619] border border-[#2a2b30] rounded-[6px]">
                          <div className="text-[10px] uppercase font-mono text-[#868a96]">
                            Local cache
                          </div>
                          <div className="text-[12px] font-semibold text-emerald-400 mt-1">Synced</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: APPEARANCE PREVIEW */}
          {activeTab.id !== "data" && (
            <VelaInteractivePreview settings={settings} symbol={symbol} resolution={resolution} />
          )}
        </div>

        {/* FOOTER */}
        <div className="vela-dialog-footer h-[48px] border-t border-[#2a2b30] px-5 flex items-center justify-between bg-[#151619] shrink-0 select-none">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="vela-sd-btn h-[30px] px-3 border border-[#2a2e39] text-[#868a96] hover:text-white hover:border-[#3a3e4b] rounded-[6px] text-[12px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset defaults
          </button>

          <span className="quant-settings-state inline-flex items-center gap-1.5 text-[11px] text-[#50535e] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#50535e]">
            Changes apply instantly
          </span>

          <button
            type="button"
            onClick={onClose}
            className="vela-sd-btn quant-settings-done h-[30px] px-5 bg-[#22242a] hover:bg-[#2b2d35] text-[#d1d4dc] hover:text-white border border-[#31343e] rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
