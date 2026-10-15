import React from "react";
import { formatReplayShortDate } from "../utils/market-chart-utils";

export type ReplayDatePickerMode = "day" | "month" | "year";

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface MarketReplayBounds {
  first: number;
  last: number;
}

export interface MarketReplayDatePickerProps {
  isOpen: boolean;
  mode: ReplayDatePickerMode;
  viewDate: Date;
  bounds: MarketReplayBounds | null;
  cursorTime: number | null;
  timezone: string;
  getZonedDateParts: (ms: number) => ZonedDateParts;
  onModeChange: (mode: ReplayDatePickerMode) => void;
  onViewDateChange: (date: Date) => void;
  onPickDate: (year: number, month: number, day: number) => void;
  onClose: () => void;
}

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function MarketReplayDatePicker({
  isOpen,
  mode,
  viewDate,
  bounds,
  cursorTime,
  getZonedDateParts,
  onModeChange,
  onViewDateChange,
  onPickDate,
}: MarketReplayDatePickerProps) {
  if (!isOpen) return null;

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const cursorParts = cursorTime ? getZonedDateParts(cursorTime) : null;
  const todayParts = getZonedDateParts(Date.now());
  const minParts = bounds ? getZonedDateParts(bounds.first) : null;
  const maxParts = bounds ? getZonedDateParts(bounds.last) : null;

  const minDayKey = minParts
    ? minParts.year * 10000 + minParts.month * 100 + minParts.day
    : null;
  const maxDayKey = maxParts
    ? maxParts.year * 10000 + maxParts.month * 100 + maxParts.day
    : null;
  const minMonthKey = minParts ? minParts.year * 12 + minParts.month : null;
  const maxMonthKey = maxParts ? maxParts.year * 12 + maxParts.month : null;
  const currentMonthKey = viewYear * 12 + viewMonth;

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDecade = Math.floor(viewYear / 10) * 10 - 1;

  const prevDisabled =
    mode === "day"
      ? minMonthKey !== null && currentMonthKey <= minMonthKey
      : mode === "month"
        ? minParts !== null && viewYear <= minParts.year
        : minParts !== null && startDecade >= minParts.year;

  const nextDisabled =
    mode === "day"
      ? maxMonthKey !== null && currentMonthKey >= maxMonthKey
      : mode === "month"
        ? maxParts !== null && viewYear >= maxParts.year
        : maxParts !== null && startDecade + 11 >= maxParts.year;

  return (
    <div className="vela-date-picker">
      <div className="vela-date-picker-head">
        <button
          type="button"
          className="vela-date-picker-nav"
          aria-label="Previous month"
          disabled={prevDisabled}
          onClick={() => {
            if (prevDisabled) return;
            if (mode === "day") {
              onViewDateChange(new Date(viewYear, viewMonth - 1, 1));
            } else if (mode === "month") {
              onViewDateChange(new Date(viewYear - 1, viewMonth, 1));
            } else {
              onViewDateChange(new Date(viewYear - 10, viewMonth, 1));
            }
          }}
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
              data-quant-chevron="left"
            >
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </span>
        </button>
        <div className="vela-date-picker-title">
          <button
            type="button"
            className="vela-date-picker-switch"
            aria-label="Choose month"
            onClick={() => onModeChange(mode === "month" ? "day" : "month")}
          >
            {MONTH_NAMES_FULL[viewMonth]}
          </button>
          <button
            type="button"
            className="vela-date-picker-switch"
            aria-label="Choose year"
            onClick={() => onModeChange(mode === "year" ? "day" : "year")}
          >
            {viewYear}
          </button>
        </div>
        <button
          type="button"
          className="vela-date-picker-nav"
          aria-label="Next month"
          disabled={nextDisabled}
          onClick={() => {
            if (nextDisabled) return;
            if (mode === "day") {
              onViewDateChange(new Date(viewYear, viewMonth + 1, 1));
            } else if (mode === "month") {
              onViewDateChange(new Date(viewYear + 1, viewMonth, 1));
            } else {
              onViewDateChange(new Date(viewYear + 10, viewMonth, 1));
            }
          }}
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
              data-quant-chevron="right"
            >
              <path d="m6 3.5 4.5 4.5L6 12.5" />
            </svg>
          </span>
        </button>
      </div>

      {mode === "day" && (
        <>
          <div className="vela-date-picker-week">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>
          <div className="vela-date-picker-grid">
            {Array.from({ length: firstDayOfWeek }, (_, i) => (
              <span key={`blank-${i}`} className="vela-date-picker-blank" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum = i + 1;
              const dayKey = viewYear * 10000 + viewMonth * 100 + dayNum;
              const isDayDisabled =
                (minDayKey !== null && dayKey < minDayKey) ||
                (maxDayKey !== null && dayKey > maxDayKey);
              const isChecked =
                cursorParts !== null &&
                cursorParts.year === viewYear &&
                cursorParts.month === viewMonth &&
                cursorParts.day === dayNum;
              const isToday =
                todayParts.year === viewYear &&
                todayParts.month === viewMonth &&
                todayParts.day === dayNum;
              return (
                <button
                  key={dayNum}
                  type="button"
                  className="vela-date-picker-day"
                  disabled={isDayDisabled}
                  data-disabled={isDayDisabled ? "1" : undefined}
                  data-checked={isChecked ? "1" : undefined}
                  data-today={isToday ? "1" : undefined}
                  title={isDayDisabled ? "No candles available on this date" : undefined}
                  onClick={() => {
                    if (isDayDisabled) return;
                    onPickDate(viewYear, viewMonth, dayNum);
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "month" && (
        <div className="vela-date-picker-cells">
          {MONTH_NAMES_SHORT.map((mLabel, mIdx) => {
            const mKey = viewYear * 12 + mIdx;
            const isMonthDisabled =
              (minMonthKey !== null && mKey < minMonthKey) ||
              (maxMonthKey !== null && mKey > maxMonthKey);
            return (
              <button
                key={mLabel}
                type="button"
                className="vela-date-picker-cell"
                disabled={isMonthDisabled}
                data-disabled={isMonthDisabled ? "1" : undefined}
                data-checked={mIdx === viewMonth ? "1" : undefined}
                onClick={() => {
                  if (isMonthDisabled) return;
                  onViewDateChange(new Date(viewYear, mIdx, 1));
                  onModeChange("day");
                }}
              >
                {mLabel}
              </button>
            );
          })}
        </div>
      )}

      {mode === "year" && (
        <div className="vela-date-picker-cells">
          {Array.from({ length: 12 }, (_, i) => {
            const yr = startDecade + i;
            const isYearDisabled =
              (minParts !== null && yr < minParts.year) ||
              (maxParts !== null && yr > maxParts.year);
            return (
              <button
                key={yr}
                type="button"
                className="vela-date-picker-cell"
                disabled={isYearDisabled}
                data-disabled={isYearDisabled ? "1" : undefined}
                data-checked={yr === viewYear ? "1" : undefined}
                onClick={() => {
                  if (isYearDisabled) return;
                  const targetMonth =
                    minParts && yr === minParts.year && viewMonth < minParts.month
                      ? minParts.month
                      : maxParts && yr === maxParts.year && viewMonth > maxParts.month
                        ? maxParts.month
                        : viewMonth;
                  onViewDateChange(new Date(yr, targetMonth, 1));
                  onModeChange("day");
                }}
              >
                {yr}
              </button>
            );
          })}
        </div>
      )}

      {bounds && (
        <div className="vela-date-picker-range" aria-label="Available candle history range">
          <span>{formatReplayShortDate(bounds.first)}</span>
          <span>—</span>
          <span>{formatReplayShortDate(bounds.last)}</span>
        </div>
      )}
    </div>
  );
}
