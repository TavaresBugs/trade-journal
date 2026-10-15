import { useCallback, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import { showVelaToast } from "@luxalgo/vela/widget";
import builtinCatalog from "../../../../public/draft-indicator-library/builtin-catalog.json";
import {
  loadIndicatorTemplates,
  saveIndicatorTemplate,
  deleteIndicatorTemplate,
  loadFavoriteIndicatorIds,
  loadPersonalPineScripts,
  resolveFavoriteIndicatorItems,
  type SavedIndicatorTemplate,
  type PersistedIndicatorInstance,
  type PersistedIndicatorPreset,
} from "@/lib/replay/workspace-persistence";
import type {
  MarketIndicatorPopoversProps,
  PopoverAnchorCoords,
} from "../indicators/market-indicator-popovers";
import type { SecondaryCellMarketData } from "./use-market-trading-engine";

export interface UseMarketIndicatorsEngineParams {
  chartRef: React.RefObject<Vela | null>;
  hostRef: React.RefObject<HTMLDivElement | null>;
  activeCellIndexRef: React.RefObject<number>;
  secondaryCharts: React.MutableRefObject<Map<number, any>>;
  secondaryCellsData: React.MutableRefObject<Map<number, SecondaryCellMarketData>>;
  bumpSecondaryCells: () => void;
  sidePanelsDockRef: React.RefObject<any>;

  // Layer 0 Shared Single Source of Truth
  initialIndicatorsToRestoreRef: React.MutableRefObject<
    Array<string | PersistedIndicatorInstance>
  >;
  indicatorPresetsBySlugRef: React.MutableRefObject<
    Record<string, PersistedIndicatorPreset>
  >;
}

export interface UseMarketIndicatorsEngineReturn {
  // Dialogs & Pine Editor
  indicatorsDialogOpen: boolean;
  setIndicatorsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pineEditorOpen: boolean;
  setPineEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Active indicators and presets
  activeIndicatorSlugs: string[];
  setActiveIndicatorSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  activeIndicatorConfigs: PersistedIndicatorInstance[];
  setActiveIndicatorConfigs: React.Dispatch<
    React.SetStateAction<PersistedIndicatorInstance[]>
  >;
  initialIndicatorsToRestoreRef: React.MutableRefObject<
    Array<string | PersistedIndicatorInstance>
  >;
  indicatorPresetsBySlugRef: React.MutableRefObject<
    Record<string, PersistedIndicatorPreset>
  >;
  indicatorPresetsVersion: number;
  isHydratingIndicatorsRef: React.MutableRefObject<boolean>;

  // Topbar popovers (Favorites and Templates)
  favMenuOpen: boolean;
  setFavMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  favMenuRect: PopoverAnchorCoords | null;
  setFavMenuRect: React.Dispatch<React.SetStateAction<PopoverAnchorCoords | null>>;
  templatesMenuOpen: boolean;
  setTemplatesMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  templatesMenuRect: PopoverAnchorCoords | null;
  setTemplatesMenuRect: React.Dispatch<
    React.SetStateAction<PopoverAnchorCoords | null>
  >;
  savedTemplates: SavedIndicatorTemplate[];
  setSavedTemplates: React.Dispatch<React.SetStateAction<SavedIndicatorTemplate[]>>;
  isNamingTemplate: boolean;
  setIsNamingTemplate: React.Dispatch<React.SetStateAction<boolean>>;
  newTemplateName: string;
  setNewTemplateName: React.Dispatch<React.SetStateAction<string>>;

  // Handlers
  extractCanonicalIndicatorSlugs: (targetChart: any) => string[];
  extractChartIndicatorConfigs: (targetChart: any) => PersistedIndicatorInstance[];
  hydrateChartIndicatorsSilently: (
    targetChart: any,
    itemsToRestore: Array<string | PersistedIndicatorInstance>,
  ) => Promise<void>;
  handleApplyIndicator: (
    slug: string,
    name: string,
  ) => Promise<boolean>;
  handleApplyNativeIndicator: (
    type: string,
    id: string,
  ) => Promise<boolean>;
  handleApplyIndicatorTemplate: (tpl: SavedIndicatorTemplate) => Promise<void>;
  handleRunPineScript: (
    code: string,
    title: string,
  ) => Promise<{ success: boolean; error?: string }>;
  syncActiveIndicatorsFromChart: (targetChart?: any, cellIdx?: number) => void;

  toggleFavMenu: (btnEl: HTMLElement) => void;
  toggleTemplatesMenu: (btnEl: HTMLElement) => void;

  // Spread-ready props for <MarketIndicatorPopovers {...indicatorPopoversProps} />
  indicatorPopoversProps: MarketIndicatorPopoversProps;
}

export function useMarketIndicatorsEngine({
  chartRef,
  hostRef,
  activeCellIndexRef,
  secondaryCharts,
  secondaryCellsData,
  bumpSecondaryCells,
  sidePanelsDockRef,
  initialIndicatorsToRestoreRef,
  indicatorPresetsBySlugRef,
}: UseMarketIndicatorsEngineParams): UseMarketIndicatorsEngineReturn {
  const [indicatorsDialogOpen, setIndicatorsDialogOpen] = useState(false);
  const [pineEditorOpen, setPineEditorOpen] = useState(false);

  const [activeIndicatorSlugs, setActiveIndicatorSlugs] = useState<string[]>([]);
  const [activeIndicatorConfigs, setActiveIndicatorConfigs] = useState<
    PersistedIndicatorInstance[]
  >([]);
  const [indicatorPresetsVersion, setIndicatorPresetsVersion] = useState(0);
  const isHydratingIndicatorsRef = useRef(false);

  const [favMenuOpen, setFavMenuOpen] = useState(false);
  const [favMenuRect, setFavMenuRect] = useState<PopoverAnchorCoords | null>(null);

  const [templatesMenuOpen, setTemplatesMenuOpen] = useState(false);
  const [templatesMenuRect, setTemplatesMenuRect] = useState<PopoverAnchorCoords | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedIndicatorTemplate[]>([]);
  const [isNamingTemplate, setIsNamingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const extractCanonicalIndicatorSlugs = useCallback((targetChart: any): string[] => {
    try {
      const list = targetChart?.indicators?.() ?? [];
      const slugs = list
        .map((h: any) => {
          const nat = h.nativeType || h.type;
          if (nat) return `native:${nat}`;
          return h.id;
        })
        .filter(
          (s: any): s is string =>
            typeof s === "string" && s.length > 0 && !s.startsWith("custom-pine-"),
        );
      return Array.from(new Set(slugs));
    } catch {
      return [];
    }
  }, []);

  const extractChartIndicatorConfigs = useCallback(
    (targetChart: any): PersistedIndicatorInstance[] => {
      try {
        const list = targetChart?.indicators?.() ?? [];
        const configs: PersistedIndicatorInstance[] = [];
        let presetsMutated = false;
        for (const h of list) {
          if (!h) continue;
          const nat = h.nativeType || h.type;
          const slug = nat ? `native:${nat}` : h.id;
          if (typeof slug !== "string" || !slug || slug.startsWith("custom-pine-")) continue;

          const rawInputs = typeof h.inputValues === "function" ? h.inputValues() : undefined;
          const rawProps = typeof h.propValues === "function" ? h.propValues() : undefined;
          const visible = typeof h.visible === "boolean" ? h.visible : true;

          const inputs =
            rawInputs && typeof rawInputs === "object" && Object.keys(rawInputs).length > 0
              ? { ...rawInputs }
              : undefined;
          const props =
            rawProps && typeof rawProps === "object" && Object.keys(rawProps).length > 0
              ? { ...rawProps }
              : undefined;

          configs.push({
            slug,
            ...(inputs ? { inputs } : {}),
            ...(props ? { props } : {}),
            visible,
          });

          if (inputs || props || visible === false) {
            const preset: PersistedIndicatorPreset = {
              ...(inputs ? { inputs } : {}),
              ...(props ? { props } : {}),
              visible,
            };
            indicatorPresetsBySlugRef.current[slug] = preset;
            const stripped = slug.replace(/^(builtin:|slug:)/, "");
            if (stripped && stripped !== slug) {
              indicatorPresetsBySlugRef.current[stripped] = preset;
            }
            presetsMutated = true;
          }
        }
        if (presetsMutated) {
          setIndicatorPresetsVersion((v) => v + 1);
        }
        return configs;
      } catch {
        return [];
      }
    },
    [],
  );

  const hydrateChartIndicatorsSilently = useCallback(
    async (
      targetChart: any,
      itemsToRestore: Array<string | PersistedIndicatorInstance>,
    ) => {
      if (!targetChart || !Array.isArray(itemsToRestore) || itemsToRestore.length === 0) return;
      const personalScripts = loadPersonalPineScripts();
      const applyHandleConfig = (
        handle: any,
        inputs?: Record<string, string | number | boolean>,
        props?: Record<string, string | number | boolean>,
        visible?: boolean,
      ) => {
        if (!handle) return;
        try {
          if (inputs && Object.keys(inputs).length > 0) {
            handle.setInputs?.(inputs);
          }
        } catch {}
        try {
          if (props && Object.keys(props).length > 0) {
            handle.setProps?.(props);
          }
        } catch {}
        try {
          if (typeof visible === "boolean") {
            handle.setVisible?.(visible);
          }
        } catch {}
      };

      for (const item of itemsToRestore) {
        const rawSlug = typeof item === "string" ? item : item?.slug;
        if (!rawSlug || typeof rawSlug !== "string") continue;
        const trimmed = rawSlug.trim();
        const inner = trimmed.startsWith("slug:") ? trimmed.slice(5).trim() : trimmed;
        const cleanLookup = inner.startsWith("builtin:")
          ? inner.slice("builtin:".length)
          : inner;
        const preset =
          indicatorPresetsBySlugRef.current[trimmed] ??
          indicatorPresetsBySlugRef.current[inner] ??
          indicatorPresetsBySlugRef.current[cleanLookup];
        const savedInputs =
          typeof item === "object" && item?.inputs ? item.inputs : preset?.inputs;
        const savedProps =
          typeof item === "object" && item?.props ? item.props : preset?.props;
        const savedVisible =
          typeof item === "object" && typeof item?.visible === "boolean"
            ? item.visible
            : preset?.visible;

        try {
          const liveList = targetChart.indicators?.() ?? [];
          if (inner.startsWith("native:") || inner === "volume") {
            const natType = inner.startsWith("native:") ? inner.slice("native:".length) : inner;
            let handle = liveList.find(
              (h: any) =>
                h.id === `native:${natType}` || h.nativeType === natType || h.type === natType,
            );
            if (!handle && natType) {
              handle = targetChart.addNativeIndicator(natType);
              if (!handle) {
                const updatedList = targetChart.indicators?.() ?? [];
                handle = updatedList.find(
                  (h: any) =>
                    h.id === `native:${natType}` || h.nativeType === natType || h.type === natType,
                );
              }
            }
            applyHandleConfig(handle, savedInputs, savedProps, savedVisible);
          } else if (inner.startsWith("personal:")) {
            const scriptId = inner.slice("personal:".length);
            const found = personalScripts.find((s) => s.id === scriptId);
            if (found && found.code) {
              let handle = liveList.find((h: any) => h.id === `personal:${scriptId}`);
              if (!handle) {
                handle = await targetChart.addIndicator(found.code, {
                  id: `personal:${scriptId}`,
                  title: found.name,
                  ...(savedInputs ? { inputs: savedInputs } : {}),
                  ...(savedProps ? { props: savedProps } : {}),
                });
                if (!handle) {
                  const updatedList = targetChart.indicators?.() ?? [];
                  handle = updatedList.find((h: any) => h.id === `personal:${scriptId}`);
                }
              }
              applyHandleConfig(handle, savedInputs, savedProps, savedVisible);
            }
          } else {
            const cleanSlug = cleanLookup;
            let handle = liveList.find(
              (h: any) =>
                h.id === trimmed || h.id === cleanSlug || h.id === `builtin:${cleanSlug}`,
            );
            if (!handle && cleanSlug) {
              const res = await fetch(`/api/indicators/${encodeURIComponent(cleanSlug)}`);
              if (res.ok) {
                const data = await res.json();
                const code = data.pineScriptCode || data.sourceCode;
                const displayName = data.indicator?.name || cleanSlug;
                if (code) {
                  handle = await targetChart.addIndicator(code, {
                    id: cleanSlug,
                    title: displayName,
                    ...(savedInputs ? { inputs: savedInputs } : {}),
                    ...(savedProps ? { props: savedProps } : {}),
                  });
                  if (!handle) {
                    const updatedList = targetChart.indicators?.() ?? [];
                    handle = updatedList.find(
                      (h: any) =>
                        h.id === trimmed || h.id === cleanSlug || h.id === `builtin:${cleanSlug}`,
                    );
                  }
                }
              }
            }
            applyHandleConfig(handle, savedInputs, savedProps, savedVisible);
          }
        } catch (err) {
          console.warn(`[MarketIndicators] Failed to restore indicator ${rawSlug}:`, err);
        }
      }
    },
    [],
  );

  const handleApplyIndicator = useCallback(
    async (slug: string, name: string): Promise<boolean> => {
      try {
        const cellIdx = activeCellIndexRef.current;
        const targetChart =
          cellIdx === 0
            ? chartRef.current
            : secondaryCharts.current.get(cellIdx) || chartRef.current;

        if (!targetChart) {
          if (hostRef.current) showVelaToast("Chart not ready", "error", hostRef.current);
          return false;
        }

        const liveList = targetChart.indicators();
        const existing = liveList.find((h: any) => h.id === slug);
        if (existing) {
          existing.remove();
          if (hostRef.current) showVelaToast(`Removed ${name}`, "info", hostRef.current);
          if (cellIdx === 0) {
            setActiveIndicatorSlugs(extractCanonicalIndicatorSlugs(targetChart));
            setActiveIndicatorConfigs(extractChartIndicatorConfigs(targetChart));
          } else {
            const cellData = secondaryCellsData.current.get(cellIdx);
            if (cellData) {
              cellData.indicators = extractCanonicalIndicatorSlugs(targetChart);
              cellData.indicatorConfigs = extractChartIndicatorConfigs(targetChart);
              bumpSecondaryCells();
            }
          }
          return true;
        }

        let code = "";
        let displayName = name || slug;

        if (slug.startsWith("//@version") || slug.includes("indicator(")) {
          code = slug;
        } else {
          const res = await fetch(`/api/indicators/${encodeURIComponent(slug)}`);
          if (!res.ok) {
            if (hostRef.current) showVelaToast(`Failed to load ${name}`, "error", hostRef.current);
            return false;
          }
          const data = await res.json();
          code = data.pineScriptCode || data.sourceCode;
          displayName = data.indicator?.name || name || slug;
        }

        if (!code) {
          if (hostRef.current) showVelaToast(`No Pine Script code found for ${displayName}`, "error", hostRef.current);
          return false;
        }

        const preset =
          indicatorPresetsBySlugRef.current[slug] ??
          indicatorPresetsBySlugRef.current[slug.replace(/^(builtin:|slug:)/, "")];

        const handle = await targetChart.addIndicator(code, {
          id: slug,
          title: displayName,
          ...(preset?.inputs ? { inputs: preset.inputs } : {}),
          ...(preset?.props ? { props: preset.props } : {}),
        });
        const resolvedHandle =
          handle ??
          (targetChart.indicators?.() ?? []).find((h: any) => h.id === slug);
        if (resolvedHandle && preset) {
          try {
            if (preset.inputs && Object.keys(preset.inputs).length > 0) {
              resolvedHandle.setInputs?.(preset.inputs);
            }
            if (preset.props && Object.keys(preset.props).length > 0) {
              resolvedHandle.setProps?.(preset.props);
            }
          } catch {}
        }

        if (cellIdx === 0) {
          setActiveIndicatorSlugs(extractCanonicalIndicatorSlugs(targetChart));
          setActiveIndicatorConfigs(extractChartIndicatorConfigs(targetChart));
        } else {
          const cellData = secondaryCellsData.current.get(cellIdx);
          if (cellData) {
            cellData.indicators = extractCanonicalIndicatorSlugs(targetChart);
            cellData.indicatorConfigs = extractChartIndicatorConfigs(targetChart);
            bumpSecondaryCells();
          }
        }
        if (hostRef.current) showVelaToast(`Added ${displayName} to chart`, "info", hostRef.current);
        return true;
      } catch (err: any) {
        console.error("[MarketIndicators] Error applying indicator:", err);
        if (hostRef.current) showVelaToast(`Error: ${err?.message || "Failed to add indicator"}`, "error", hostRef.current);
        return false;
      }
    },
    [
      activeCellIndexRef,
      bumpSecondaryCells,
      chartRef,
      extractCanonicalIndicatorSlugs,
      extractChartIndicatorConfigs,
      hostRef,
      secondaryCellsData,
      secondaryCharts,
    ],
  );

  const handleApplyNativeIndicator = useCallback(
    async (type: string, id: string): Promise<boolean> => {
      try {
        const cellIdx = activeCellIndexRef.current;
        const targetChart =
          cellIdx === 0
            ? chartRef.current
            : secondaryCharts.current.get(cellIdx) || chartRef.current;

        if (!targetChart) {
          if (hostRef.current) showVelaToast("Chart not ready", "error", hostRef.current);
          return false;
        }

        const liveList = targetChart.indicators();
        const existing = liveList.find(
          (h: any) => h.id === id || h.nativeType === type || h.type === type,
        );
        if (existing) {
          existing.remove();
          if (hostRef.current) showVelaToast(`Removed ${type.toUpperCase()}`, "info", hostRef.current);
          if (cellIdx === 0) {
            setActiveIndicatorSlugs(extractCanonicalIndicatorSlugs(targetChart));
            setActiveIndicatorConfigs(extractChartIndicatorConfigs(targetChart));
          } else {
            const cellData = secondaryCellsData.current.get(cellIdx);
            if (cellData) {
              cellData.indicators = extractCanonicalIndicatorSlugs(targetChart);
              cellData.indicatorConfigs = extractChartIndicatorConfigs(targetChart);
              bumpSecondaryCells();
            }
          }
          return true;
        }

        const preset =
          indicatorPresetsBySlugRef.current[id] ??
          indicatorPresetsBySlugRef.current[`native:${type}`];
        const handle = targetChart.addNativeIndicator(type);
        const resolvedHandle =
          handle ??
          (targetChart.indicators?.() ?? []).find(
            (h: any) => h.id === id || h.nativeType === type || h.type === type,
          );
        if (resolvedHandle && preset) {
          try {
            if (preset.inputs && Object.keys(preset.inputs).length > 0) {
              resolvedHandle.setInputs?.(preset.inputs);
            }
            if (preset.props && Object.keys(preset.props).length > 0) {
              resolvedHandle.setProps?.(preset.props);
            }
          } catch {}
        }

        if (cellIdx === 0) {
          setActiveIndicatorSlugs(extractCanonicalIndicatorSlugs(targetChart));
          setActiveIndicatorConfigs(extractChartIndicatorConfigs(targetChart));
        } else {
          const cellData = secondaryCellsData.current.get(cellIdx);
          if (cellData) {
            cellData.indicators = extractCanonicalIndicatorSlugs(targetChart);
            cellData.indicatorConfigs = extractChartIndicatorConfigs(targetChart);
            bumpSecondaryCells();
          }
        }
        if (hostRef.current) showVelaToast(`Added ${type.toUpperCase()} to chart`, "info", hostRef.current);
        return true;
      } catch (err: any) {
        console.error("[MarketIndicators] Error applying native indicator:", err);
        if (hostRef.current) showVelaToast(`Error: ${err?.message || "Failed to add indicator"}`, "error", hostRef.current);
        return false;
      }
    },
    [
      activeCellIndexRef,
      bumpSecondaryCells,
      chartRef,
      extractCanonicalIndicatorSlugs,
      extractChartIndicatorConfigs,
      hostRef,
      secondaryCellsData,
      secondaryCharts,
    ],
  );

  const handleApplyIndicatorTemplate = useCallback(
    async (tpl: SavedIndicatorTemplate) => {
      const cellIdx = activeCellIndexRef.current;
      const targetChart =
        cellIdx === 0
          ? chartRef.current
          : secondaryCharts.current.get(cellIdx) || chartRef.current;
      if (!targetChart) return;

      isHydratingIndicatorsRef.current = true;
      try {
        const liveList = targetChart.indicators?.() ?? [];
        for (const handle of liveList) {
          try {
            handle.remove?.();
          } catch {}
        }
        const itemsToHydrate =
          tpl.indicatorConfigs && tpl.indicatorConfigs.length > 0
            ? tpl.indicatorConfigs
            : tpl.indicators;
        await hydrateChartIndicatorsSilently(targetChart, itemsToHydrate);
      } finally {
        isHydratingIndicatorsRef.current = false;
      }

      const nextSlugs = extractCanonicalIndicatorSlugs(targetChart);
      const nextConfigs = extractChartIndicatorConfigs(targetChart);
      if (cellIdx === 0) {
        setActiveIndicatorSlugs(nextSlugs);
        setActiveIndicatorConfigs(nextConfigs);
      } else {
        const cellData = secondaryCellsData.current.get(cellIdx);
        if (cellData) {
          cellData.indicators = nextSlugs;
          cellData.indicatorConfigs = nextConfigs;
          bumpSecondaryCells();
        }
      }
      setTemplatesMenuOpen(false);
      setIsNamingTemplate(false);
      if (hostRef.current) showVelaToast(`Applied template: ${tpl.name}`, "info", hostRef.current);
    },
    [
      activeCellIndexRef,
      bumpSecondaryCells,
      chartRef,
      extractCanonicalIndicatorSlugs,
      extractChartIndicatorConfigs,
      hostRef,
      hydrateChartIndicatorsSilently,
      secondaryCellsData,
      secondaryCharts,
    ],
  );

  const handleRunPineScript = useCallback(
    async (code: string, title: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const cellIdx = activeCellIndexRef.current;
        const targetChart =
          cellIdx === 0
            ? chartRef.current
            : secondaryCharts.current.get(cellIdx) || chartRef.current;

        if (!targetChart) {
          return { success: false, error: "Chart instance not ready." };
        }

        const scriptId = `custom-pine-${Date.now()}`;
        targetChart.addIndicator(code, {
          id: scriptId,
          title: title || "Custom Script",
        });

        if (hostRef.current) showVelaToast(`Ran ${title || "Pine script"} on chart`, "info", hostRef.current);
        return { success: true };
      } catch (err: any) {
        console.error("[MarketIndicators] Pine script compile error:", err);
        return { success: false, error: err?.message || "Failed to compile Pine Script v6" };
      }
    },
    [activeCellIndexRef, chartRef, hostRef, secondaryCharts],
  );

  const syncActiveIndicatorsFromChart = useCallback(
    (targetChart?: any, cellIdx?: number) => {
      const activeIdx = cellIdx ?? activeCellIndexRef.current;
      const chartInst =
        targetChart ??
        (activeIdx === 0 ? chartRef.current : secondaryCharts.current.get(activeIdx) || chartRef.current);
      if (!chartInst) return;

      const slugs = extractCanonicalIndicatorSlugs(chartInst);
      const configs = extractChartIndicatorConfigs(chartInst);
      if (activeIdx === 0) {
        setActiveIndicatorSlugs(slugs);
        setActiveIndicatorConfigs(configs);
      } else {
        const cellData = secondaryCellsData.current.get(activeIdx);
        if (cellData) {
          cellData.indicators = slugs;
          cellData.indicatorConfigs = configs;
          bumpSecondaryCells();
        }
      }
    },
    [
      activeCellIndexRef,
      bumpSecondaryCells,
      chartRef,
      extractCanonicalIndicatorSlugs,
      extractChartIndicatorConfigs,
      secondaryCellsData,
      secondaryCharts,
    ],
  );

  const toggleFavMenu = useCallback((btnEl: HTMLElement) => {
    const r = btnEl.getBoundingClientRect();
    setFavMenuRect({ left: r.left, top: r.bottom + 4 });
    setTemplatesMenuOpen(false);
    setIsNamingTemplate(false);
    setFavMenuOpen((prev) => !prev);
  }, []);

  const toggleTemplatesMenu = useCallback((btnEl: HTMLElement) => {
    const r = btnEl.getBoundingClientRect();
    setTemplatesMenuRect({ left: r.left, top: r.bottom + 4 });
    setSavedTemplates(loadIndicatorTemplates());
    setFavMenuOpen(false);
    setIsNamingTemplate(false);
    setNewTemplateName("");
    setTemplatesMenuOpen((prev) => !prev);
  }, []);

  const favIndicatorItems = useMemo(() => {
    if (!favMenuOpen) return [];
    const rawFavIds = loadFavoriteIndicatorIds();
    const personalScripts = loadPersonalPineScripts();
    return resolveFavoriteIndicatorItems(
      rawFavIds,
      (builtinCatalog as any).items ?? [],
      personalScripts,
    );
  }, [favMenuOpen]);

  const indicatorPopoversProps: MarketIndicatorPopoversProps = {
    favMenuOpen,
    favMenuRect,
    favoriteItems: favIndicatorItems,
    onCloseFavMenu: () => setFavMenuOpen(false),
    onSelectFavorite: (item) => {
      setFavMenuOpen(false);
      if (item.kind === "native") {
        void handleApplyNativeIndicator(item.targetId, item.id);
      } else if (item.kind === "personal" && item.code) {
        void handleRunPineScript(item.code, item.label);
      } else {
        void handleApplyIndicator(item.targetId, item.label);
      }
    },
    templatesMenuOpen,
    templatesMenuRect,
    savedTemplates,
    activeIndicatorSlugs,
    activeIndicatorConfigs,
    isNamingTemplate,
    newTemplateName,
    onCloseTemplatesMenu: () => {
      setTemplatesMenuOpen(false);
      setIsNamingTemplate(false);
    },
    onStartNamingTemplate: () => {
      setIsNamingTemplate(true);
      setNewTemplateName("");
    },
    onCancelNamingTemplate: () => {
      setIsNamingTemplate(false);
      setNewTemplateName("");
    },
    onNewTemplateNameChange: setNewTemplateName,
    onSaveTemplate: (name) => {
      const cellIdx = activeCellIndexRef.current;
      const targetChart =
        cellIdx === 0
          ? chartRef.current
          : secondaryCharts.current.get(cellIdx) || chartRef.current;
      const currentInds = targetChart
        ? extractCanonicalIndicatorSlugs(targetChart)
        : activeIndicatorSlugs;
      const currentConfigs = targetChart
        ? extractChartIndicatorConfigs(targetChart)
        : activeIndicatorConfigs;
      const updated = saveIndicatorTemplate(name, currentInds, currentConfigs);
      setSavedTemplates(updated);
      setIsNamingTemplate(false);
      setNewTemplateName("");
      if (hostRef.current) showVelaToast(`Saved template "${name}"`, "info", hostRef.current);
    },
    onApplyTemplate: handleApplyIndicatorTemplate,
    onDeleteTemplate: (tplId) => {
      const next = deleteIndicatorTemplate(tplId);
      setSavedTemplates(next);
    },
  };

  return {
    indicatorsDialogOpen,
    setIndicatorsDialogOpen,
    pineEditorOpen,
    setPineEditorOpen,
    activeIndicatorSlugs,
    setActiveIndicatorSlugs,
    activeIndicatorConfigs,
    setActiveIndicatorConfigs,
    initialIndicatorsToRestoreRef,
    indicatorPresetsBySlugRef,
    indicatorPresetsVersion,
    isHydratingIndicatorsRef,
    favMenuOpen,
    setFavMenuOpen,
    favMenuRect,
    setFavMenuRect,
    templatesMenuOpen,
    setTemplatesMenuOpen,
    templatesMenuRect,
    setTemplatesMenuRect,
    savedTemplates,
    setSavedTemplates,
    isNamingTemplate,
    setIsNamingTemplate,
    newTemplateName,
    setNewTemplateName,
    extractCanonicalIndicatorSlugs,
    extractChartIndicatorConfigs,
    hydrateChartIndicatorsSilently,
    handleApplyIndicator,
    handleApplyNativeIndicator,
    handleApplyIndicatorTemplate,
    handleRunPineScript,
    syncActiveIndicatorsFromChart,
    toggleFavMenu,
    toggleTemplatesMenu,
    indicatorPopoversProps,
  };
}
