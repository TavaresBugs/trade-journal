import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Vela } from "@luxalgo/vela";
import type { MarketBar } from "@/lib/market-data";
import type { SyncOptions } from "@luxalgo/vela/widget";
import { showVelaToast } from "@luxalgo/vela/widget";
import type {
  MarketReplayControlBarProps,
  ReplayBarPosition,
  ReplaySpeedOption,
} from "../replay/market-replay-control-bar";
import type {
  MarketReplayBounds,
  ReplayDatePickerMode,
  ZonedDateParts,
} from "../replay/market-replay-date-picker";
import {
  extractZonedDateParts,
  formatReplayShortDate,
} from "../utils/market-chart-utils";

export interface UseMarketReplayPlaybackParams {
  chartRef: React.RefObject<Vela | null>;
  secondaryChartsRef: React.RefObject<Map<number, any>>;
  workspaceReplayRef: React.RefObject<any>;
  statuslineRef: React.RefObject<any>;
  watermarkRef: React.RefObject<any>;
  hostRef: React.RefObject<HTMLDivElement | null>;
  workspaceAreaRef: React.RefObject<HTMLDivElement | null>;
  topbarHostRef: React.RefObject<HTMLDivElement | null>;
  replayBtnRef: React.RefObject<HTMLButtonElement | null>;

  bars: MarketBar[];
  barsRef: React.RefObject<MarketBar[]>;
  activeCellIndexRef: React.RefObject<number>;
  syncOptionsRef: React.RefObject<SyncOptions>;
  lastCrosshairRef: React.RefObject<{
    price: number | null;
    decimals: number;
    time: number | null;
  }>;

  chartTimezone: string;
  isWorkspaceHydrated: boolean;
  hasHydratedStorageRef: React.RefObject<boolean>;

  triggerPaperTick: (time?: number, targetSymbol?: string) => void;
  broadcastViewport: (sourceId: number, range?: any) => void;
  clearAllExternalCrosshairs: () => void;

  // Layer 0 Shared Single Source of Truth
  isReplayActive: boolean;
  setIsReplayActive: React.Dispatch<React.SetStateAction<boolean>>;
  isReplayActiveRef: React.MutableRefObject<boolean>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isPlayingRef: React.MutableRefObject<boolean>;
  isSelectingCutPoint: boolean;
  setIsSelectingCutPoint: React.Dispatch<React.SetStateAction<boolean>>;
  isSelectingCutPointRef: React.MutableRefObject<boolean>;
  replaySpeed: number;
  setReplaySpeed: React.Dispatch<React.SetStateAction<number>>;
  replaySpeedRef: React.MutableRefObject<number>;
  replayCursorTime: number | null;
  setReplayCursorTime: React.Dispatch<React.SetStateAction<number | null>>;
  replayCursorTimeRef: React.MutableRefObject<number | null>;
  replayRemaining: number;
  setReplayRemaining: React.Dispatch<React.SetStateAction<number>>;
  docked: boolean;
  setDocked: React.Dispatch<React.SetStateAction<boolean>>;
  barPosition: ReplayBarPosition | null;
  setBarPosition: React.Dispatch<React.SetStateAction<ReplayBarPosition | null>>;
  replayBarRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseMarketReplayPlaybackReturn {
  // Replay states & refs
  isReplayActive: boolean;
  isReplayActiveRef: React.MutableRefObject<boolean>;
  isPlaying: boolean;
  isPlayingRef: React.MutableRefObject<boolean>;
  isSelectingCutPoint: boolean;
  isSelectingCutPointRef: React.MutableRefObject<boolean>;
  replaySpeed: number;
  replaySpeedRef: React.MutableRefObject<number>;
  replayCursorTime: number | null;
  replayCursorTimeRef: React.MutableRefObject<number | null>;
  replayRemaining: number;
  setReplayRemaining: React.Dispatch<React.SetStateAction<number>>;

  // UI Bar & Sub-popovers states
  docked: boolean;
  setDocked: React.Dispatch<React.SetStateAction<boolean>>;
  barPosition: ReplayBarPosition | null;
  setBarPosition: React.Dispatch<React.SetStateAction<ReplayBarPosition | null>>;
  replayBarRef: React.RefObject<HTMLDivElement | null>;
  scrubOpen: boolean;
  setScrubOpen: React.Dispatch<React.SetStateAction<boolean>>;
  speedMenuOpen: boolean;
  setSpeedMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  datePickerOpen: boolean;
  setDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  datePickerMode: ReplayDatePickerMode;
  setDatePickerMode: React.Dispatch<React.SetStateAction<ReplayDatePickerMode>>;
  datePickerViewDate: Date;
  setDatePickerViewDate: React.Dispatch<React.SetStateAction<Date>>;

  // Derived values
  bounds: MarketReplayBounds | null;
  scrubPercent: number;
  speedOptions: ReplaySpeedOption[];
  currentSpeedLabel: string;
  formattedCursorDate: string;
  getZonedDateParts: (ms: number) => ZonedDateParts;

  // Handlers
  handleStartReplay: (cutTime: number, sourceCellId?: number) => Promise<void>;
  handleStepForward: () => void;
  handleTogglePlay: () => void;
  handleChangeSpeed: (speedMs: number) => void;
  handleStopReplay: () => void;
  handlePickReplayDate: (year: number, month: number, day: number) => void;
  handleScrubChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleToggleDocked: () => void;
  onGripPointerDown: (e: React.PointerEvent<HTMLElement>) => void;

  // Spread-ready props for <MarketReplayControlBar {...controlBarProps} />
  controlBarProps: MarketReplayControlBarProps;
}

export function useMarketReplayPlayback({
  chartRef,
  secondaryChartsRef,
  workspaceReplayRef,
  statuslineRef,
  watermarkRef,
  hostRef,
  workspaceAreaRef,
  topbarHostRef,
  replayBtnRef,
  bars,
  barsRef,
  activeCellIndexRef,
  syncOptionsRef,
  lastCrosshairRef,
  chartTimezone,
  isWorkspaceHydrated,
  hasHydratedStorageRef,
  triggerPaperTick,
  broadcastViewport,
  clearAllExternalCrosshairs,
  isReplayActive,
  setIsReplayActive,
  isReplayActiveRef,
  isPlaying,
  setIsPlaying,
  isPlayingRef,
  isSelectingCutPoint,
  setIsSelectingCutPoint,
  isSelectingCutPointRef,
  replaySpeed,
  setReplaySpeed,
  replaySpeedRef,
  replayCursorTime,
  setReplayCursorTime,
  replayCursorTimeRef,
  replayRemaining,
  setReplayRemaining,
  docked,
  setDocked,
  barPosition,
  setBarPosition,
  replayBarRef,
}: UseMarketReplayPlaybackParams): UseMarketReplayPlaybackReturn {
  const [scrubOpen, setScrubOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<ReplayDatePickerMode>("day");
  const [datePickerViewDate, setDatePickerViewDate] = useState<Date>(() => new Date());

  // Update topbar replay button state attribute
  useEffect(() => {
    const btn =
      replayBtnRef.current ??
      topbarHostRef.current?.querySelector<HTMLButtonElement>(".vela-replay-topbar-btn") ??
      null;
    if (!btn) return;
    if (isReplayActive || isSelectingCutPoint) {
      btn.setAttribute("data-vela-pro-replay-active", "");
    } else {
      btn.removeAttribute("data-vela-pro-replay-active");
    }
  }, [isReplayActive, isSelectingCutPoint, replayBtnRef, topbarHostRef]);

  // Synchronize native crosshair override with cut mode across all charts
  useEffect(() => {
    const override = isSelectingCutPoint
      ? {
          vertical: true,
          horizontal: false,
          style: "solid",
          color: "#2962ff",
          width: 1,
          opacity: 1,
          shadeRight: { color: "rgba(0,0,0,0)", opacity: 0 },
        }
      : null;

    if (chartRef.current) {
      try {
        (chartRef.current as any).renderer?.set("crosshairOverride", override);
      } catch (err) {
        console.warn("[Replay] Failed to set crosshairOverride:", err);
      }
    }

    for (const secInst of secondaryChartsRef.current.values()) {
      try {
        secInst.renderer?.set?.("crosshairOverride", override);
      } catch {}
    }

    if (!isSelectingCutPoint) {
      clearAllExternalCrosshairs();
    }
  }, [isSelectingCutPoint, chartRef, secondaryChartsRef, clearAllExternalCrosshairs]);

  // Formatters for Timezone & Dates
  const zonedPartsFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: chartTimezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
    } catch {
      return null;
    }
  }, [chartTimezone]);

  const shortDateFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: chartTimezone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return null;
    }
  }, [chartTimezone]);

  const getZonedDateParts = useCallback(
    (ms: number): ZonedDateParts => extractZonedDateParts(ms, zonedPartsFormatter),
    [zonedPartsFormatter],
  );

  const formatReplayShortDateFn = useCallback(
    (ms: number) => formatReplayShortDate(ms, shortDateFormatter),
    [shortDateFormatter],
  );

  const formattedCursorDate = useMemo(() => {
    if (!replayCursorTime) return "";
    return formatReplayShortDateFn(replayCursorTime);
  }, [replayCursorTime, formatReplayShortDateFn]);

  const bounds = useMemo<MarketReplayBounds | null>(() => {
    if (bars.length < 2) return null;
    return {
      first: bars[0]!.time,
      last: bars[bars.length - 1]!.time,
    };
  }, [bars]);

  const scrubPercent = useMemo(() => {
    if (!bounds || !replayCursorTime) return 0;
    const ratio = (replayCursorTime - bounds.first) / (bounds.last - bounds.first);
    return Math.max(0, Math.min(100, Math.round(ratio * 10000) / 100));
  }, [bounds, replayCursorTime]);

  const speedOptions = useMemo<ReplaySpeedOption[]>(
    () => [
      { label: "0.1x", val: 10000 },
      { label: "0.25x", val: 4000 },
      { label: "0.5x", val: 2000 },
      { label: "1x", val: 1000 },
      { label: "2x", val: 500 },
      { label: "3x", val: 333 },
      { label: "5x", val: 200 },
      { label: "10x", val: 100 },
    ],
    [],
  );

  const currentSpeedLabel =
    speedOptions.find((s) => s.val === replaySpeed)?.label ?? "1x";

  // Replay Handlers
  const handleStartReplay = useCallback(
    async (cutTime: number, sourceCellId?: number) => {
      const primaryChart = chartRef.current;
      if (!primaryChart) return;
      setIsSelectingCutPoint(false);
      isSelectingCutPointRef.current = false;
      setIsReplayActive(true);
      isReplayActiveRef.current = true;
      setIsPlaying(false);
      isPlayingRef.current = false;
      setReplayCursorTime(cutTime);
      replayCursorTimeRef.current = cutTime;
      triggerPaperTick(cutTime);

      try {
        if (workspaceReplayRef.current) {
          await workspaceReplayRef.current.start({
            from: cutTime,
            cell: typeof sourceCellId === "number" ? `cell-${sourceCellId}` : undefined,
          });
        } else {
          await primaryChart.replay.start({ from: cutTime });
          for (const secInst of secondaryChartsRef.current.values()) {
            try {
              await secInst.replay.start({ from: cutTime });
              (secInst as any).__statusline?.setReplaying?.(true);
              (secInst as any).__watermark?.setReplaying?.(true);
            } catch {}
          }
        }
        setReplayRemaining(primaryChart.replay.state?.remaining ?? 0);
        statuslineRef.current?.setReplaying?.(true);
        watermarkRef.current?.setReplaying?.(true);

        for (const secInst of secondaryChartsRef.current.values()) {
          try {
            (secInst as any).__statusline?.setReplaying?.(true);
            (secInst as any).__watermark?.setReplaying?.(true);
          } catch {}
        }

        if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
          const srcId = typeof sourceCellId === "number" ? sourceCellId : activeCellIndexRef.current;
          const srcInst = srcId === 0 ? primaryChart : secondaryChartsRef.current.get(srcId);
          broadcastViewport(srcId, srcInst?.getVisibleRange?.());
        }
      } catch (err) {
        console.error("[Replay] Failed to start:", err);
      }
    },
    [
      activeCellIndexRef,
      broadcastViewport,
      chartRef,
      secondaryChartsRef,
      statuslineRef,
      syncOptionsRef,
      triggerPaperTick,
      watermarkRef,
      workspaceReplayRef,
    ],
  );

  const handleStepForward = useCallback(() => {
    if (workspaceReplayRef.current) {
      const hasNext = workspaceReplayRef.current.step();
      if (!hasNext) {
        setIsPlaying(false);
      }
      return;
    }
    const primaryChart = chartRef.current;
    if (!primaryChart) return;
    const hasNext = primaryChart.replay.step();
    for (const secInst of secondaryChartsRef.current.values()) {
      try {
        secInst.replay.step();
      } catch {}
    }
    if (!hasNext) {
      setIsPlaying(false);
    }
  }, [chartRef, secondaryChartsRef, workspaceReplayRef]);

  const handleTogglePlay = useCallback(() => {
    if (workspaceReplayRef.current) {
      if (isPlayingRef.current) {
        workspaceReplayRef.current.pause();
        setIsPlaying(false);
      } else {
        workspaceReplayRef.current.play(replaySpeedRef.current);
        setIsPlaying(true);
      }
      return;
    }
    const primaryChart = chartRef.current;
    if (!primaryChart) return;
    if (isPlayingRef.current) {
      primaryChart.replay.pause();
      for (const secInst of secondaryChartsRef.current.values()) {
        try {
          secInst.replay.pause();
        } catch {}
      }
      setIsPlaying(false);
    } else {
      primaryChart.replay.play(replaySpeedRef.current);
      for (const secInst of secondaryChartsRef.current.values()) {
        try {
          secInst.replay.play(replaySpeedRef.current);
        } catch {}
      }
      setIsPlaying(true);
    }
  }, [chartRef, secondaryChartsRef, workspaceReplayRef]);

  const handleChangeSpeed = useCallback((speedMs: number) => {
    setReplaySpeed(speedMs);
    if (isPlayingRef.current) {
      if (workspaceReplayRef.current) {
        workspaceReplayRef.current.play(speedMs);
      } else {
        chartRef.current?.replay.play(speedMs);
        for (const secInst of secondaryChartsRef.current.values()) {
          try {
            secInst.replay.play(speedMs);
          } catch {}
        }
      }
    }
  }, [chartRef, secondaryChartsRef, workspaceReplayRef]);

  const handleStopReplay = useCallback(() => {
    try {
      if (workspaceReplayRef.current) {
        workspaceReplayRef.current.stop();
      } else if (chartRef.current) {
        chartRef.current.replay.stop();
      }
    } catch {}
    for (const secInst of secondaryChartsRef.current.values()) {
      try {
        secInst.replay.stop();
        (secInst as any).__statusline?.setReplaying?.(false);
        (secInst as any).__watermark?.setReplaying?.(false);
      } catch {}
    }
    statuslineRef.current?.setReplaying?.(false);
    watermarkRef.current?.setReplaying?.(false);
    setScrubOpen(false);
    setSpeedMenuOpen(false);
    setDatePickerOpen(false);
    setIsReplayActive(false);
    isReplayActiveRef.current = false;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsSelectingCutPoint(false);
    isSelectingCutPointRef.current = false;
    setReplayCursorTime(null);
    replayCursorTimeRef.current = null;
    triggerPaperTick();
    if (syncOptionsRef.current.time || syncOptionsRef.current.dateRange) {
      const srcId = activeCellIndexRef.current;
      const srcInst = srcId === 0 ? chartRef.current : secondaryChartsRef.current.get(srcId);
      broadcastViewport(srcId, srcInst?.getVisibleRange?.());
    }
  }, [
    activeCellIndexRef,
    broadcastViewport,
    chartRef,
    secondaryChartsRef,
    statuslineRef,
    syncOptionsRef,
    triggerPaperTick,
    watermarkRef,
    workspaceReplayRef,
  ]);

  const handlePickReplayDate = useCallback(
    (year: number, month: number, day: number) => {
      const list = barsRef.current;
      if (!list.length) return;
      const curParts = getZonedDateParts(replayCursorTime ?? list[list.length - 1]!.time);
      const targetTuple =
        ((year * 100 + (month + 1)) * 100 + day) * 10000 +
        curParts.hour * 100 +
        curParts.minute;
      let chosen = list[list.length - 1]!.time;
      for (let i = 0; i < list.length; i++) {
        const barTime = list[i]!.time;
        const bp = getZonedDateParts(barTime);
        const barTuple =
          ((bp.year * 100 + (bp.month + 1)) * 100 + bp.day) * 10000 +
          bp.hour * 100 +
          bp.minute;
        if (barTuple >= targetTuple) {
          chosen = barTime;
          break;
        }
      }
      setDatePickerOpen(false);
      setReplayCursorTime(chosen);
      replayCursorTimeRef.current = chosen;
      triggerPaperTick(chosen);
      void handleStartReplay(chosen);
    },
    [barsRef, getZonedDateParts, handleStartReplay, replayCursorTime, triggerPaperTick],
  );

  const handleScrubChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!bounds) return;
      const pct = Number(e.target.value) / 100;
      const targetTime = Math.round(bounds.first + pct * (bounds.last - bounds.first));
      setReplayCursorTime(targetTime);
      replayCursorTimeRef.current = targetTime;
      triggerPaperTick(targetTime);
      void handleStartReplay(targetTime);
    },
    [bounds, handleStartReplay, triggerPaperTick],
  );

  const handleToggleDocked = useCallback(() => {
    setDocked((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem("vela-pro.replay.docked", "1");
        } else {
          localStorage.removeItem("vela-pro.replay.docked");
        }
      } catch {}
      return next;
    });
  }, []);

  const clampBarPosition = useCallback((x: number, y: number): ReplayBarPosition => {
    const workspaceEl = workspaceAreaRef.current || hostRef.current?.parentElement || hostRef.current;
    const workspaceRect = workspaceEl?.getBoundingClientRect() ?? { width: 800, height: 600 };
    const barEl =
      replayBarRef.current ||
      workspaceEl?.querySelector<HTMLElement>(".vela-pro-replay-bar") ||
      document.querySelector<HTMLElement>(".vela-pro-replay-bar");
    const barRect = barEl?.getBoundingClientRect();

    const workspaceWidth = workspaceRect.width || (workspaceEl as any)?.offsetWidth || 800;
    const workspaceHeight = workspaceRect.height || (workspaceEl as any)?.offsetHeight || 600;
    const barWidth = barRect?.width || 320;
    const barHeight = barRect?.height || 40;

    const minX = 58; // Respect left drawing toolbar gutter
    const minY = 8;
    const maxX = Math.max(minX, workspaceWidth - barWidth - 8);
    const maxY = Math.max(minY, workspaceHeight - barHeight - 8);

    return {
      x: Math.round(Math.max(minX, Math.min(x, maxX))),
      y: Math.round(Math.max(minY, Math.min(y, maxY))),
    };
  }, [hostRef, workspaceAreaRef]);

  const onGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      const grip = e.currentTarget;
      const barEl = grip.closest(".vela-pro-replay-bar") as HTMLElement | null;
      const workspaceEl = workspaceAreaRef.current || hostRef.current?.parentElement || hostRef.current;
      if (!barEl || !workspaceEl) return;

      try {
        grip.setPointerCapture?.(e.pointerId);
      } catch {}

      const barRect = barEl.getBoundingClientRect();
      const workspaceRect = workspaceEl.getBoundingClientRect();

      const currentPos = barPosition
        ? { ...barPosition }
        : {
            x: Math.round(barRect.left - workspaceRect.left),
            y: Math.round(barRect.top - workspaceRect.top),
          };

      const dragStartX = e.clientX;
      const dragStartY = e.clientY;
      const posStartX = currentPos.x;
      const posStartY = currentPos.y;

      barEl.setAttribute("data-dragging", "1");

      const onPointerMove = (moveEv: PointerEvent) => {
        const dx = moveEv.clientX - dragStartX;
        const dy = moveEv.clientY - dragStartY;
        const clamped = clampBarPosition(posStartX + dx, posStartY + dy);
        barEl.style.left = `${clamped.x}px`;
        barEl.style.top = `${clamped.y}px`;
        barEl.style.bottom = "auto";
        barEl.style.transform = "none";
      };

      const onPointerUp = (upEv: PointerEvent) => {
        barEl.removeAttribute("data-dragging");
        try {
          if (upEv.pointerId !== undefined) {
            grip.releasePointerCapture?.(upEv.pointerId);
          }
        } catch {}
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        const dx = upEv.clientX - dragStartX;
        const dy = upEv.clientY - dragStartY;
        const finalPos = clampBarPosition(posStartX + dx, posStartY + dy);
        setBarPosition(finalPos);
        try {
          localStorage.setItem("vela-pro.replay.bar-position", JSON.stringify(finalPos));
        } catch {}
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [barPosition, clampBarPosition, hostRef, workspaceAreaRef],
  );



  // Close popovers on click outside
  useEffect(() => {
    if (!scrubOpen && !speedMenuOpen && !datePickerOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".vela-pro-replay-bar")) {
        setScrubOpen(false);
        setSpeedMenuOpen(false);
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [scrubOpen, speedMenuOpen, datePickerOpen]);

  const controlBarProps: MarketReplayControlBarProps = {
    isReplayActive,
    isPlaying,
    isSelectingCutPoint,
    replaySpeed,
    currentSpeedLabel,
    speedOptions,
    replayCursorTime,
    formattedCursorDate,
    replayRemaining,
    bounds,
    docked,
    barPosition,
    replayBarRef,
    containerRef: workspaceAreaRef,
    onGripPointerDown,
    onToggleDocked: handleToggleDocked,
    scrubOpen,
    scrubPercent,
    speedMenuOpen,
    datePickerProps: {
      isOpen: datePickerOpen,
      mode: datePickerMode,
      viewDate: datePickerViewDate,
      bounds,
      cursorTime: replayCursorTime,
      timezone: chartTimezone,
      getZonedDateParts,
      onModeChange: setDatePickerMode,
      onViewDateChange: setDatePickerViewDate,
      onPickDate: handlePickReplayDate,
      onClose: () => setDatePickerOpen(false),
    },
    onToggleScrub: () => {
      setScrubOpen((prev) => !prev);
      setSpeedMenuOpen(false);
      setDatePickerOpen(false);
    },
    onScrubChange: handleScrubChange,
    onToggleSpeedMenu: () => {
      setSpeedMenuOpen((prev) => !prev);
      setDatePickerOpen(false);
      setScrubOpen(false);
    },
    onToggleDatePicker: () => {
      setDatePickerOpen((prev) => {
        const next = !prev;
        if (next) {
          const cp = getZonedDateParts(replayCursorTime ?? Date.now());
          setDatePickerViewDate(new Date(cp.year, cp.month, 1));
          setDatePickerMode("day");
        }
        return next;
      });
      setSpeedMenuOpen(false);
      setScrubOpen(false);
    },
    onToggleSelectCutPoint: () => setIsSelectingCutPoint((prev) => !prev),
    onTogglePlay: handleTogglePlay,
    onStepForward: handleStepForward,
    onChangeSpeed: (spd) => {
      handleChangeSpeed(spd);
      setSpeedMenuOpen(false);
    },
    onStopReplay: handleStopReplay,
  };

  return {
    isReplayActive,
    isReplayActiveRef,
    isPlaying,
    isPlayingRef,
    isSelectingCutPoint,
    isSelectingCutPointRef,
    replaySpeed,
    replaySpeedRef,
    replayCursorTime,
    replayCursorTimeRef,
    replayRemaining,
    setReplayRemaining,
    docked,
    setDocked,
    barPosition,
    setBarPosition,
    replayBarRef,
    scrubOpen,
    setScrubOpen,
    speedMenuOpen,
    setSpeedMenuOpen,
    datePickerOpen,
    setDatePickerOpen,
    datePickerMode,
    setDatePickerMode,
    datePickerViewDate,
    setDatePickerViewDate,
    bounds,
    scrubPercent,
    speedOptions,
    currentSpeedLabel,
    formattedCursorDate,
    getZonedDateParts,
    handleStartReplay,
    handleStepForward,
    handleTogglePlay,
    handleChangeSpeed,
    handleStopReplay,
    handlePickReplayDate,
    handleScrubChange,
    handleToggleDocked,
    onGripPointerDown,
    controlBarProps,
  };
}
