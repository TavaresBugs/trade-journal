"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface VelaBezierExpirationSelectProps {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  onChangeDate: (date: string) => void;
  onChangeTime: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTimeStr(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 1:1 TradingView Expiration Dropdown + Custom Date/Time Picker.
 * Extracted directly from TradingView Desktop Webpack module 695326 (Ky/wy/Ay).
 * Implements:
 * - View 1 ("list"): Open-ended, End of day, 1 week, 1 month, and Custom date with 📅 icon.
 * - View 2 ("date"): Header with back button, Date & Time inputs, Time 15m dropdown,
 *   interactive calendar grid, and "Set YYYY-MM-DD" action button.
 * - Natural Bézier Join (/bezier-style Modo 1) with seamless #151619 background.
 */
export function VelaBezierExpirationSelect({
  date,
  time,
  onChangeDate,
  onChangeTime,
  disabled = false,
  className = "",
}: VelaBezierExpirationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "date">("list");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Temporary date and time while inside Custom Date view
  const [tempDate, setTempDate] = useState(date || formatDateStr(new Date()));
  const [tempTime, setTempTime] = useState(time || "17:59");

  // Calendar month/year navigation state
  const [viewYear, setViewYear] = useState(() => {
    const y = parseInt(date?.split("-")[0] || "", 10);
    return Number.isFinite(y) && y > 2000 ? y : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const m = parseInt(date?.split("-")[1] || "", 10);
    return Number.isFinite(m) && m >= 1 && m <= 12
      ? m - 1
      : new Date().getMonth();
  });

  // Sync temp state whenever dropdown opens or props change
  useEffect(() => {
    if (isOpen) {
      const activeDate = date || formatDateStr(new Date());
      const activeTime = time || "17:59";
      setTempDate(activeDate);
      setTempTime(activeTime);

      const parts = activeDate.split("-").map(Number);
      if (parts[0] && parts[0] > 2000) {
        setViewYear(parts[0]);
        setViewMonth((parts[1] || 1) - 1);
      }
    } else {
      setView("list");
      setShowTimePicker(false);
    }
  }, [isOpen, date, time]);

  // Is this date configured as open-ended? (e.g. > 10 years ahead)
  const isOpenEnded = useMemo(() => {
    if (!date) return false;
    const y = parseInt(date.split("-")[0] || "0", 10);
    return y > 2034;
  }, [date]);

  // Format Top Trigger Label: "November 13, 2026 at 22:53" or "Open-ended"
  const formattedTopLabel = useMemo(() => {
    if (isOpenEnded) return "Open-ended";
    try {
      if (!date) return "Select expiration";
      const parts = date.split("-").map(Number);
      const y = parts[0] ?? 2026;
      const m = (parts[1] ?? 1) - 1;
      const d = parts[2] ?? 1;
      const monthName = MONTH_NAMES[m] || "November";
      return `${monthName} ${d}, ${y} at ${time || "17:59"}`;
    } catch {
      return `${date} at ${time}`;
    }
  }, [date, time, isOpenEnded]);

  // Dynamic presets for View 1 ("list")
  const presets = useMemo(() => {
    const now = new Date();
    const curTime = time || formatTimeStr(now);

    // End of day: today at 23:59
    const endOfDayLabel = `${SHORT_MONTH_NAMES[now.getMonth()]} ${now.getDate()}, 23:59`;
    const endOfDayDate = formatDateStr(now);

    // 1 week: today + 7 days
    const in1Week = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const in1WeekLabel = `${SHORT_MONTH_NAMES[in1Week.getMonth()]} ${in1Week.getDate()}, ${curTime}`;
    const in1WeekDate = formatDateStr(in1Week);

    // 1 month: today + 30 days
    const in1Month = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const in1MonthLabel = `${SHORT_MONTH_NAMES[in1Month.getMonth()]} ${in1Month.getDate()}, ${curTime}`;
    const in1MonthDate = formatDateStr(in1Month);

    return [
      {
        id: "open-ended",
        title: "Open-ended",
        displayValue: "Won't expire",
        date: "2036-12-31",
        time: "23:59",
      },
      {
        id: "end-of-day",
        title: "End of day",
        displayValue: endOfDayLabel,
        date: endOfDayDate,
        time: "23:59",
      },
      {
        id: "1-week",
        title: "1 week",
        displayValue: in1WeekLabel,
        date: in1WeekDate,
        time: curTime,
      },
      {
        id: "1-month",
        title: "1 month",
        displayValue: in1MonthLabel,
        date: in1MonthDate,
        time: curTime,
      },
    ];
  }, [time]);

  // Generate 15-minute intervals for Time dropdown (print_20261014_225501.png)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${pad2(h)}:${pad2(m)}`);
      }
    }
    if (tempTime && !slots.includes(tempTime)) {
      slots.push(tempTime);
      slots.sort();
    }
    return slots;
  }, [tempTime]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Days matrix for the active month (Monday first)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const dayOfWeek = firstDay.getDay(); // 0 is Sunday
    const startPadding = (dayOfWeek + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: {
      dayNumber: number | null;
      dateStr: string;
      isPast: boolean;
      isSelected: boolean;
    }[] = [];

    // Leading empty cells
    for (let i = 0; i < startPadding; i++) {
      cells.push({
        dayNumber: null,
        dateStr: "",
        isPast: false,
        isSelected: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(viewYear, viewMonth, d);
      cellDate.setHours(0, 0, 0, 0);
      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      const isPast = cellDate.getTime() < today.getTime();
      const isSelected = dateStr === tempDate;

      cells.push({
        dayNumber: d,
        dateStr,
        isPast,
        isSelected,
      });
    }

    return cells;
  }, [viewYear, viewMonth, tempDate]);

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* 1. Main Trigger Button with Bézier Join State */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[34px] px-3 flex items-center justify-between text-[13px] font-normal transition-all cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-[var(--vela-bg,#131722)] border border-[var(--vela-border,#2a2e39)] text-[var(--vela-fg-muted,#787b86)] rounded-[6px]"
            : isOpen
            ? "bg-[#151619] border border-[var(--vela-border,#2a2e39)] border-t-transparent rounded-b-[6px] rounded-t-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] border border-[var(--vela-border,#2a2e39)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <span className="truncate">{formattedTopLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
          width="14"
          height="14"
          className={`text-[var(--vela-fg-muted,#787b86)] transition-transform duration-150 shrink-0 ml-2 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
          />
        </svg>
      </button>

      {/* 2. Floating Popup with Natural Bézier Join Shell (#151619, opening upwards matching TV) */}
      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setView("list");
          setShowTimePicker(false);
        }}
        triggerRef={triggerRef}
        minWidth={view === "list" ? 270 : 285}
        maxHeight={420}
        placement="top"
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VIEW 1: PRESET LIST (print_20261014_225344.png)             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === "list" && (
          <div className="flex flex-col py-1 space-y-0.5">
            {presets.map((preset) => {
              const isSelected =
                preset.id === "open-ended"
                  ? isOpenEnded
                  : date === preset.date && time === preset.time;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onChangeDate(preset.date);
                    onChangeTime(preset.time);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[4px] text-[13px] text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#2a2e39] text-white font-medium"
                      : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
                  }`}
                >
                  <span>{preset.title}</span>
                  <span className="text-[12px] text-[var(--vela-fg-muted,#787b86)] ml-3">
                    {preset.displayValue}
                  </span>
                </button>
              );
            })}

            {/* Custom date Button with 📅 Calendar Icon (Highlighted dark pill) */}
            <button
              type="button"
              onClick={() => {
                setView("date");
                setShowTimePicker(false);
              }}
              className="w-full mt-1 flex items-center justify-between px-3 py-2 rounded-[6px] text-[13px] font-medium bg-[#2a2e39] text-white hover:bg-[#363a45] transition-colors cursor-pointer"
            >
              <span>Custom date</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 18 18"
                width="16"
                height="16"
                className="text-white shrink-0 ml-2"
                fill="none"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 6.5h12M12 2v3M6 2v3M3.75 3.5h10.5A1.75 1.75 0 0 1 16 5.25v9A1.75 1.75 0 0 1 14.25 16H3.75A1.75 1.75 0 0 1 2 14.25v-9A1.75 1.75 0 0 1 3.75 3.5Z"
                />
              </svg>
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VIEW 2: SET CUSTOM DATE (print_20261014_225442.png)         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {view === "date" && (
          <div className="flex flex-col p-2 space-y-2.5">
            {/* Header: Back Chevron (<) and "Set custom date" Title */}
            <div className="flex items-center gap-2 pb-1 border-b border-[var(--vela-border,#2a2e39)]">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setShowTimePicker(false);
                }}
                className="w-[26px] h-[26px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-white hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
                title="Back to list"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  width="16"
                  height="16"
                >
                  <path
                    fill="currentColor"
                    d="M12.92 1.92 5.85 9l7.07 7.08-.84.84-7.5-7.5L4.15 9l.43-.42 7.5-7.5z"
                  />
                </svg>
              </button>
              <span className="text-[14px] font-semibold text-white tracking-tight">
                Set custom date
              </span>
            </div>

            {/* Date and Time Inputs Row */}
            <div className="grid grid-cols-2 gap-2 relative">
              {/* Date Input Box */}
              <div className="h-[32px] px-2.5 flex items-center justify-between rounded-[6px] border border-[var(--vela-border,#2a2e39)] bg-[var(--vela-bg,#131722)] text-[12px] text-white">
                <span className="font-mono">{tempDate}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  width="14"
                  height="14"
                  className="text-[var(--vela-fg-muted,#787b86)] shrink-0 ml-1"
                  fill="none"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 6.5h12M12 2v3M6 2v3M3.75 3.5h10.5A1.75 1.75 0 0 1 16 5.25v9A1.75 1.75 0 0 1 14.25 16H3.75A1.75 1.75 0 0 1 2 14.25v-9A1.75 1.75 0 0 1 3.75 3.5Z"
                  />
                </svg>
              </div>

              {/* Time Input Box with Clock Icon (print_20261014_225501.png) */}
              <button
                type="button"
                onClick={() => setShowTimePicker((prev) => !prev)}
                className={`h-[32px] px-2.5 flex items-center justify-between rounded-[6px] border text-[12px] cursor-pointer transition-colors ${
                  showTimePicker
                    ? "border-[#2962ff] bg-[var(--vela-bg,#131722)] text-white ring-1 ring-[#2962ff]"
                    : "border-[var(--vela-border,#2a2e39)] bg-[var(--vela-bg,#131722)] text-white hover:border-[#434651]"
                }`}
              >
                <span className="font-mono">{tempTime}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  width="14"
                  height="14"
                  className="text-[var(--vela-fg-muted,#787b86)] shrink-0 ml-1"
                  fill="none"
                >
                  <circle
                    cx="9"
                    cy="9"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    d="M9 5.5V9l2.5 1.5"
                  />
                </svg>
              </button>

              {/* Timepicker Floating Overlay (print_20261014_225501.png) */}
              {showTimePicker && (
                <div className="absolute right-0 top-[36px] w-[110px] max-h-[170px] overflow-y-auto bg-[#1c202a] border border-[#2a2e39] rounded-[6px] shadow-xl z-50 py-1 scrollbar-thin">
                  {timeSlots.map((slot) => {
                    const isSelected = slot === tempTime;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setTempTime(slot);
                          setShowTimePicker(false);
                        }}
                        className={`w-full px-3 py-1 text-left text-[12px] font-mono transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#2a2e39] text-white font-semibold"
                            : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[rgba(255,255,255,0.06)]"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Month Navigator Header (< Month Year >) */}
            <div className="flex items-center justify-between px-1 pt-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-[24px] h-[24px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  width="14"
                  height="14"
                >
                  <path
                    fill="currentColor"
                    d="M11.92 2.92 6.85 8l5.07 5.08-.84.84-5.5-5.5L5.15 8l.43-.42 5.5-5.5z"
                  />
                </svg>
              </button>

              <span className="text-[13px] font-medium text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-[24px] h-[24px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  width="14"
                  height="14"
                >
                  <path
                    fill="currentColor"
                    d="M6.08 2.92 11.15 8l-5.07 5.08.84.84 5.5-5.5.43-.42-.43-.42-5.5-5.5z"
                  />
                </svg>
              </button>
            </div>

            {/* Days of Week Header (Mo Tu We Th Fr Sa Su) */}
            <div className="grid grid-cols-7 gap-1 text-center py-0.5">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-[11px] font-medium text-[var(--vela-fg-muted,#787b86)]"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((cell, idx) => {
                if (cell.dayNumber === null) {
                  return <div key={`empty-${idx}`} className="h-[28px]" />;
                }

                if (cell.isPast) {
                  return (
                    <div
                      key={cell.dateStr}
                      className="h-[28px] flex items-center justify-center text-[12px] text-[#434651] cursor-not-allowed select-none"
                    >
                      {cell.dayNumber}
                    </div>
                  );
                }

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      setTempDate(cell.dateStr);
                      setShowTimePicker(false);
                    }}
                    className={`h-[28px] flex items-center justify-center rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                      cell.isSelected
                        ? "bg-[#2a2e39] text-white font-bold ring-1 ring-[#434651]"
                        : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[rgba(255,255,255,0.08)]"
                    }`}
                  >
                    {cell.dayNumber}
                  </button>
                );
              })}
            </div>

            {/* Bottom Commit Action Button: "Set YYYY-MM-DD" */}
            <button
              type="button"
              onClick={() => {
                onChangeDate(tempDate);
                onChangeTime(tempTime);
                setIsOpen(false);
                setView("list");
                setShowTimePicker(false);
              }}
              className="w-full h-[36px] mt-1 flex items-center justify-center rounded-[6px] text-[13px] font-medium bg-[#2a2e39] text-white hover:bg-[#363a45] transition-colors cursor-pointer"
            >
              Set {tempDate}
            </button>
          </div>
        )}
      </VelaBezierDropdownShell>
    </div>
  );
}
