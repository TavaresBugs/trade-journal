import React from "react";
import { formatReplayShortDate } from "../utils/market-chart-utils";
import {
  MarketReplayDatePicker,
  type MarketReplayBounds,
  type MarketReplayDatePickerProps,
} from "./market-replay-date-picker";

export interface ReplaySpeedOption {
  label: string;
  val: number; // ms per bar
}

export interface ReplayBarPosition {
  x: number;
  y: number;
}

export interface MarketReplayControlBarProps {
  // Replay main state
  isReplayActive: boolean;
  isPlaying: boolean;
  isSelectingCutPoint: boolean;
  replaySpeed: number;
  currentSpeedLabel: string;
  speedOptions: ReplaySpeedOption[];
  replayCursorTime: number | null;
  formattedCursorDate: string;
  replayRemaining: number;
  bounds: MarketReplayBounds | null;

  // Positioning and Docked / Floating mode
  docked: boolean;
  barPosition: ReplayBarPosition | null;
  replayBarRef: React.RefObject<HTMLDivElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  onGripPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onToggleDocked: () => void;

  // Sub-menus and popovers
  scrubOpen: boolean;
  scrubPercent: number;
  speedMenuOpen: boolean;
  datePickerProps: MarketReplayDatePickerProps;
  onToggleScrub: () => void;
  onScrubChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSpeedMenu: () => void;
  onToggleDatePicker: () => void;

  // Playback & Cut actions
  onToggleSelectCutPoint: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onChangeSpeed: (speedMs: number) => void;
  onStopReplay: () => void;
}

export function MarketReplayControlBar({
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
  containerRef,
  onGripPointerDown,
  onToggleDocked,
  scrubOpen,
  scrubPercent,
  speedMenuOpen,
  datePickerProps,
  onToggleScrub,
  onScrubChange,
  onToggleSpeedMenu,
  onToggleDatePicker,
  onToggleSelectCutPoint,
  onTogglePlay,
  onStepForward,
  onChangeSpeed,
  onStopReplay,
}: MarketReplayControlBarProps) {
  if (!isReplayActive) return null;

  const getPopVerticalClass = (requiredHeight: number) => {
    const barEl = replayBarRef.current;
    const containerEl = containerRef?.current;
    if (barEl && containerEl) {
      const barRect = barEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const spaceBelow = containerRect.bottom - barRect.bottom - 8;
      const spaceAbove = barRect.top - containerRect.top - 8;
      if (spaceBelow >= requiredHeight || spaceBelow >= spaceAbove) {
        return "top-full mt-1.5";
      }
      return "bottom-full mb-1.5";
    }
    if (barPosition !== null) {
      const containerHeight = containerRef?.current?.clientHeight ?? 800;
      const spaceBelow = containerHeight - (barPosition.y + 40) - 8;
      return spaceBelow >= requiredHeight ? "top-full mt-1.5" : "bottom-full mb-1.5";
    }
    return requiredHeight <= 72 ? "top-full mt-1.5" : "bottom-full mb-1.5";
  };

  const getPopHorizontalStyle = (
    popoverWidth: number,
    anchorSelector: string,
    preferStart = false,
  ): React.CSSProperties => {
    const barEl = replayBarRef.current;
    const containerEl = containerRef?.current;
    if (!barEl || !containerEl) return {};
    const anchorEl = barEl.querySelector<HTMLElement>(anchorSelector) ?? barEl;
    const anchorRect = anchorEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    if (containerRect.width <= 0 || anchorRect.width <= 0) return {};

    const desiredLeft = preferStart
      ? anchorRect.left
      : anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
    const minLeft = containerRect.left + (docked ? 8 : 58);
    const maxLeft = Math.max(minLeft, containerRect.right - popoverWidth - 8);
    const clampedLeft = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
    return {
      left: `${Math.round(clampedLeft - anchorRect.left)}px`,
      transform: "none",
    };
  };

  const speedPopVerticalClass = getPopVerticalClass(220);
  const datePopVerticalClass = getPopVerticalClass(310);
  const scrubPopVerticalClass = getPopVerticalClass(64);

  const controls = (
    <>
      {!docked && (
        <button
          type="button"
          className="vela-pro-replay-grip"
          onPointerDown={onGripPointerDown}
          aria-label="Drag replay toolbar"
          title="Drag to reposition"
        >
          <svg
            viewBox="0 0 16 16"
            width="18"
            height="18"
            fill="currentColor"
            stroke="none"
            aria-hidden="true"
          >
            <circle cx="6" cy="3.5" r="1.1" />
            <circle cx="10" cy="3.5" r="1.1" />
            <circle cx="6" cy="8" r="1.1" />
            <circle cx="10" cy="8" r="1.1" />
            <circle cx="6" cy="12.5" r="1.1" />
            <circle cx="10" cy="12.5" r="1.1" />
          </svg>
        </button>
      )}

      {/* Start Bar / Jump Button */}
      <button
        type="button"
        className="vela-pro-replay-btn"
        aria-label="Start bar"
        data-labelled=""
        aria-pressed={isSelectingCutPoint ? "true" : "false"}
        onClick={onToggleSelectCutPoint}
        title="Select bar to jump to"
      >
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
            <path d="M4 3.5v9" />
            <path d="M12 3.5 6.5 8l5.5 4.5z" fill="currentColor" />
          </svg>
        </span>
        <span className="vela-pro-replay-label">Start bar</span>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        className="vela-pro-replay-btn"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        <span className="vela-icon" aria-hidden="true">
          {isPlaying ? (
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
              <rect x="4.5" y="3.5" width="2.2" height="9" rx="0.5" fill="currentColor" />
              <rect x="9.3" y="3.5" width="2.2" height="9" rx="0.5" fill="currentColor" />
            </svg>
          ) : (
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
              <path d="M5 3.5v9L12 8z" fill="currentColor" />
            </svg>
          )}
        </span>
      </button>

      {/* Next update (Step Forward) */}
      <button
        type="button"
        className="vela-pro-replay-btn"
        onClick={onStepForward}
        aria-label="Next update"
        title="Next update (Right Arrow)"
      >
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
            <path d="M4 3.5v9L9.5 8z" fill="currentColor" />
            <path d="M12 3.5v9" />
          </svg>
        </span>
      </button>

      <span className="vela-pro-replay-sep" />

      {/* Speed dropdown */}
      <div className="relative flex items-center">
        <button
          type="button"
          className="vela-pro-replay-drop"
          data-control="speed"
          aria-expanded={speedMenuOpen ? "true" : "false"}
          onClick={onToggleSpeedMenu}
          title="Replay speed"
        >
          <span>{currentSpeedLabel}</span>
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
              data-quant-chevron="down"
            >
              <path d="M3.5 6 8 10.5 12.5 6" />
            </svg>
          </span>
        </button>

        {speedMenuOpen && (
          <div
            className={`vela-pro-replay-speed-pop absolute ${speedPopVerticalClass} left-0 z-50`}
            style={getPopHorizontalStyle(140, '[data-control="speed"]', true)}
            role="listbox"
            aria-label="Replay Speed"
          >
            <div className="vela-pro-replay-list-title">Replay Speed</div>
            <div className="vela-select-items">
              {speedOptions.map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className="vela-select-item"
                  data-checked={replaySpeed === opt.val ? "1" : undefined}
                  onClick={() => {
                    onChangeSpeed(opt.val);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="vela-pro-replay-sep" />

      {/* Date Chip & Date Picker Popover */}
      {formattedCursorDate && (
        <div className="relative flex items-center">
          <button
            type="button"
            className="vela-pro-replay-chip"
            aria-label="Go to date"
            aria-haspopup="dialog"
            aria-expanded={datePickerProps.isOpen ? "true" : "false"}
            data-when=""
            onClick={onToggleDatePicker}
            title="Go to date"
          >
            {formattedCursorDate}
          </button>

          {datePickerProps.isOpen && (
            <div
              className={`vela-pro-replay-pop absolute ${datePopVerticalClass} left-1/2 -translate-x-1/2 z-50`}
              style={getPopHorizontalStyle(252, '[aria-label="Go to date"]')}
              role="dialog"
              aria-label="Go to date"
            >
              <MarketReplayDatePicker {...datePickerProps} />
            </div>
          )}
        </div>
      )}

      {/* Scrubber Chip & Slider Popover */}
      <div className="relative flex items-center">
        <button
          type="button"
          className="vela-pro-replay-chip"
          aria-label="Move through history"
          aria-haspopup="dialog"
          aria-expanded={scrubOpen ? "true" : "false"}
          aria-live="polite"
          onClick={onToggleScrub}
          title="Move through history"
        >
          {replayRemaining} bars left
        </button>

        {scrubOpen && bounds && (
          <div
            className={`vela-pro-replay-pop absolute ${scrubPopVerticalClass} left-1/2 -translate-x-1/2 z-50`}
            style={getPopHorizontalStyle(240, '[aria-label="Move through history"]')}
            role="dialog"
            aria-label="Replay position"
          >
            <div className="vela-pro-replay-scrub">
              <input
                type="range"
                className="vela-pro-replay-range"
                min="0"
                max="100"
                step="0.1"
                value={scrubPercent}
                style={{ "--fill": `${scrubPercent}%` } as React.CSSProperties}
                onChange={onScrubChange}
                aria-label="Replay position"
              />
              <div className="vela-pro-replay-scrub-ends">
                <span>{formatReplayShortDate(bounds.first)}</span>
                <span>{formatReplayShortDate(bounds.last)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pin / Dock button */}
      <button
        type="button"
        className="vela-pro-replay-btn"
        aria-label={docked ? "Unpin from bottom" : "Pin to bottom"}
        data-slot="pin"
        onClick={onToggleDocked}
        title={docked ? "Unpin (float)" : "Pin to bottom"}
      >
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
            <path d="M5.6 2.5h4.8M6.4 2.5v3.6L4.4 8.4v.9h7.2v-.9L9.6 6.1V2.5M8 9.3v4.2" />
          </svg>
        </span>
      </button>

      {/* Exit button */}
      <button
        type="button"
        className="vela-pro-replay-btn"
        aria-label="Exit replay"
        data-slot="exit"
        onClick={onStopReplay}
        title="Exit replay (Esc)"
      >
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
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
          </svg>
        </span>
      </button>
    </>
  );

  if (docked) {
    return (
      <div className="vela-pro-replay-dock">
        <div
          ref={replayBarRef}
          className="vela-pro-replay-bar"
          role="toolbar"
          aria-label="Bar replay"
          style={{ zIndex: 35 }}
        >
          {controls}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={replayBarRef}
      className="vela-pro-replay-bar"
      role="toolbar"
      aria-label="Bar replay"
      data-placed={barPosition ? "" : undefined}
      style={{
        ...(barPosition
          ? {
              left: barPosition.x,
              top: barPosition.y,
              bottom: "auto",
              transform: "none",
            }
          : {}),
        zIndex: 35,
      }}
    >
      {controls}
    </div>
  );
}
